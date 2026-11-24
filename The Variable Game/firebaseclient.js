const FirebaseClient = (() => {
  let app, auth, db, uid = null;

  async function init() {
    app = firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    await auth.signInAnonymously();
    return new Promise((resolve) => {
      auth.onAuthStateChanged((user) => {
        if (user) { uid = user.uid; resolve(uid); }
      });
    });
  }

  function getUid() { return uid; }

  async function claimNickname(nickname) {
    const lower = nickname.toLowerCase();
    const nickRef = db.collection("nicknames").doc(lower);
    const playerRef = db.collection("players").doc(uid);
    try {
      await db.runTransaction(async (tx) => {
        const nickSnap = await tx.get(nickRef);
        if (nickSnap.exists && nickSnap.data().uid !== uid) {
          throw new Error("TAKEN");
        }
        tx.set(nickRef, { uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        tx.set(playerRef, { nickname, uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      });
      return { allowed: true };
    } catch (err) {
      if (err.message === "TAKEN") return { allowed: false, reason: "That nickname is already taken." };
      if (err.code === "permission-denied") return { allowed: false, reason: "That name isn't allowed." };
      console.error(err);
      return { allowed: false, reason: "Couldn't reach Firebase — check your config.js setup." };
    }
  }

  async function submitScore({ difficulty, elapsedMs, nickname }) {
    await db.collection("scores").add({
      uid, nickname, difficulty, elapsedMs: Math.round(elapsedMs),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  async function updateStreaks({ nickname, daily, win }) {
    await db.collection("streaks").doc(uid).set({
      nickname, dailyStreak: daily, winStreak: win,
      lastPlayDate: new Date().toISOString().slice(0, 10),
      avatar: PlayerState.getAvatar(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  // ---------- ratings + leaderboard ----------
  // one document per player (ratings/{uid}, see firestore.rules). Every board is ONE sorted query on a single
  // field, so no composite index is needed and a board costs at most 100 reads.
  const isLinked = () => !!(auth && auth.currentUser && !auth.currentUser.isAnonymous);
  async function fetchRating() {
    if (!uid) return null;
    const snap = await db.collection("ratings").doc(uid).get();
    return snap.exists ? snap.data() : null;
  }
  // first time only: carry over wins and best times from this player's old score entries (append-only, so they can't be edited)
  async function seedFromScores() {
    const out = { wins: { easy: 0, medium: 0, hard: 0 }, best: {} };
    const snap = await db.collection("scores").where("uid", "==", uid).limit(500).get();
    snap.forEach((doc) => {
      const s = doc.data();
      if (!out.wins.hasOwnProperty(s.difficulty)) return;
      out.wins[s.difficulty] = Math.min(500, out.wins[s.difficulty] + 1);
      if (s.elapsedMs > 1200 && !(out.best[s.difficulty] <= s.elapsedMs)) out.best[s.difficulty] = s.elapsedMs;
    });
    return out;
  }
  let tokenFresh = false;
  async function pushRating(data, linked) {
    // after linking Google the sign-in token must be refreshed once, or the rules can't see the email yet
    if (linked && !tokenFresh) { await auth.currentUser.getIdToken(true); tokenFresh = true; }
    await db.collection("ratings").doc(uid).set({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  }
  const BOARDS = {
    bug: { field: () => "boardBug", dir: "desc" },
    race: { field: () => "boardRace", dir: "desc" },
    puzzle: { field: () => "boardPuz", dir: "desc" },
    best: { field: (d) => "best_" + d, dir: "asc" },
    wins: { field: (d) => "wins_" + d, dir: "desc", positive: true },
    streak: { field: () => "bestStreak", dir: "desc", positive: true },
  };
  async function fetchBoard(kind, diff) {
    const b = BOARDS[kind];
    if (!b) return [];
    const field = b.field(diff);
    let q = db.collection("ratings");
    if (b.positive) q = q.where(field, ">", 0);
    const snap = await q.orderBy(field, b.dir).limit(100).get();
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  }

  // the same board, but only for the given players (friends): read each rating document and sort here.
  // Reads at most 60 documents, so a friends board stays cheap and finds friends even outside the global top 100.
  async function fetchBoardFor(kind, diff, uids) {
    const b = BOARDS[kind];
    if (!b) return [];
    const field = b.field(diff);
    const snaps = await Promise.all(Array.from(new Set(uids)).slice(0, 60).map((u) => db.collection("ratings").doc(u).get().catch(() => null)));
    const rows = snaps.filter((s) => s && s.exists).map((s) => ({ uid: s.id, ...s.data() }))
      .filter((r) => typeof r[field] === "number" && (!b.positive || r[field] > 0));
    rows.sort((x, y) => (b.dir === "asc" ? x[field] - y[field] : y[field] - x[field]));
    return rows;
  }

  // ---------- server mode (Cloud Functions) ----------
  const useFunctions = () => typeof USE_CLOUD_FUNCTIONS !== "undefined" && USE_CLOUD_FUNCTIONS === true && !!firebase.functions;
  let fns = null;
  async function callFn(name, data) {
    if (!fns) fns = firebase.functions();
    const res = await fns.httpsCallable(name)(data || {});
    return res.data;
  }
  const listenQueue = (cb) => db.collection("queue").doc(uid).onSnapshot((s) => cb(s.exists ? s.data() : null));

  function genCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  // ---------- rooms ----------
  // A room is one document (rooms/{code}) plus one document per player (rooms/{code}/players/{uid}).
  //   room:   difficulty, rounds, speed, sabotage, phase (lobby | race | results), round, roundWinners[],
  //           hostUid, hostName, task (rule keys + params only), startTime, winner*, createdAt, expireAt
  //   player: nickname, avatar, ready, passed/total (rules met), bites, done, elapsedMs, grid
  // The host moves the room between phases. Players only write their own player document, plus the
  // one-shot "I won this round" update on the room. firestore.rules enforces all of that.
  const roomRef = (code) => db.collection("rooms").doc(code);
  const playerRef = (code, id) => roomRef(code).collection("players").doc(id || uid);
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();

  async function hostRoom({ difficulty, rounds, speed, sabotage }, nickname) {
    let code, existing, attempts = 0;
    do {
      code = genCode();
      existing = await roomRef(code).get();
      attempts++;
    } while (existing.exists && attempts < 5); // 32^4 codes, collisions are basically never

    await roomRef(code).set({
      difficulty, rounds, speed, sabotage, phase: "lobby", round: 0, roundWinners: [],
      hostUid: uid, hostName: nickname, winnerUid: null,
      createdAt: ts(),
      expireAt: new Date(Date.now() + 24 * 3600 * 1000), // set a Firestore TTL policy on rooms.expireAt to auto-delete old rooms
    });
    await playerRef(code).set(freshPlayer(nickname, true));
    return code;
  }

  function freshPlayer(nickname, ready) {
    return { nickname, avatar: PlayerState.getAvatar(), ready: !!ready, passed: 0, total: 0, bites: 0, done: false, elapsedMs: 0, grid: "", round: 0, seen: ts() };
  }

  // what the join screen shows before you commit: room settings and who is inside
  async function peekRoom(code) {
    const snap = await roomRef(code).get();
    if (!snap.exists) return null;
    const players = await roomRef(code).collection("players").get();
    return { room: snap.data(), players: players.docs.map((d) => ({ token: d.id, nickname: d.data().nickname, avatar: d.data().avatar })) };
  }

  async function joinRoom(code, nickname) {
    const peek = await peekRoom(code);
    if (!peek) throw new Error("No room called " + code + ".");
    if (peek.room.phase !== "lobby") throw new Error("That match already started.");
    if (peek.players.length >= RoomLogic.MAX_PLAYERS && !peek.players.some((p) => p.token === uid)) throw new Error("That room is full.");
    await playerRef(code).set(freshPlayer(nickname, false));
    return peek.room;
  }

  function listenRoomPlayers(code, cb) {
    return roomRef(code).collection("players").onSnapshot((snap) => {
      cb(snap.docs.map((d) => ({ token: d.id, ...d.data() })));
    });
  }

  function listenRoomState(code, cb, onGone) {
    return roomRef(code).onSnapshot((snap) => {
      if (snap.exists) cb(snap.data()); else if (onGone) onGone();
    });
  }

  const updateRoomSettings = (code, patch) => roomRef(code).update(patch);
  const setReady = (code, ready) => playerRef(code).update({ ready: !!ready });
  const writeProgress = (code, patch) => playerRef(code).update(patch);
  const kickPlayer = (code, id) => playerRef(code, id).delete();
  // friend activity (presence/{uid}): one word and a time, readable only by friends (see firestore.rules)
  const presence = {
    set: (kind) => db.collection("presence").doc(uid).set({ kind, at: ts() }),
    clear: () => db.collection("presence").doc(uid).delete(),
    get: async (u) => { const s = await db.collection("presence").doc(u).get(); return s.exists ? s.data() : null; },
  };
  const heartbeat = (code) => playerRef(code).update({ seen: ts() });
  const sendSay = (code, id) => playerRef(code).update({ say: id, sayAt: ts() });
  const sendReaction = (code, id) => playerRef(code).update({ react: id, reactAt: ts() });

  // host: begin round n with a fresh task
  async function startRound(code, round, difficulty) {
    const task = TaskEngine.generateTask(difficulty);
    await roomRef(code).update({
      phase: "race", round, task: TaskEngine.serializeTask(task), startTime: ts(),
      winnerUid: null, winnerNickname: "", winnerElapsedMs: 0,
    });
  }

  // a player finished: write their own result, then try to claim the round. Firestore retries the
  // transaction on a collision, so exactly one near-simultaneous finisher ends up as the winner.
  async function finishRound(code, round, nickname, { elapsedMs, bites, grid, total }) {
    elapsedMs = Math.round(elapsedMs);
    await playerRef(code).update({ done: true, elapsedMs, bites, grid, round, passed: total, total });
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(roomRef(code));
        const r = snap.data();
        if (r.phase !== "race" || r.round !== round || r.winnerUid) return; // someone already won it
        tx.update(roomRef(code), {
          phase: "results", winnerUid: uid, winnerNickname: nickname, winnerElapsedMs: elapsedMs,
          roundWinners: [...(r.roundWinners || []), uid],
        });
      });
    } catch (err) {
      console.error("Race submit failed (likely a rules/permissions issue):", err);
    }
  }

  // host: back to the lobby with a clean score, same players
  const rematch = (code) => roomRef(code).update({ phase: "lobby", round: 0, roundWinners: [], winnerUid: null, winnerNickname: "", winnerElapsedMs: 0 });
  // any player, only when the host's player document is gone (the rules check that)
  const claimHost = (code, nickname) => roomRef(code).update({ hostUid: uid, hostName: nickname });

  async function leaveRoom(code) {
    if (!code) return;
    await playerRef(code).delete().catch(() => {});
  }

  // avatar
  async function setAvatar(avatar) {
    if (!uid) return;
    await db.collection("players").doc(uid).set({ avatar }, { merge: true });
  }

  // puzzle rankings, one counter per player per day / week
  async function bumpCounter(collection, field, value, data) {
    const ref = db.collection(collection).doc(uid + "_" + value);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const solved = snap.exists ? (snap.data().solved || 0) + 1 : 1;
      tx.set(ref, { uid, nickname: data.nickname, avatar: data.avatar, [field]: value, solved,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    });
  }
  async function recordPuzzleSolve({ nickname, avatar }) {
    if (!uid || !nickname) return;
    const data = { nickname, avatar };
    await Promise.all([
      bumpCounter("puzzleDaily", "date", todayKey(), data),
      bumpCounter("puzzleWeekly", "week", weekKey(), data),
    ]);
  }
  // only one equality filter and the sort happens here, so no composite index needed
  async function fetchPuzzleTop(period) {
    const weekly = period === "weekly";
    const snap = await db.collection(weekly ? "puzzleWeekly" : "puzzleDaily")
      .where(weekly ? "week" : "date", "==", weekly ? weekKey() : todayKey()).limit(200).get();
    return snap.docs.map((d) => ({ token: d.data().uid, ...d.data() })).sort((a, b) => b.solved - a.solved).slice(0, 10);
  }

  // daily challenge
  async function submitDaily({ date, difficulty, elapsedMs, nickname, avatar }) {
    await db.collection("dailyScores").doc(uid + "_" + date).set({
      uid, nickname, avatar, date, difficulty, elapsedMs: Math.round(elapsedMs),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
  async function fetchDaily(date) {
    const snap = await db.collection("dailyScores").where("date", "==", date).limit(200).get();
    return snap.docs.map((d) => d.data()).sort((a, b) => a.elapsedMs - b.elapsedMs).slice(0, 10);
  }
  async function fetchMyDaily(date) {
    if (!uid) return null;
    const snap = await db.collection("dailyScores").doc(uid + "_" + date).get();
    return snap.exists ? snap.data() : null;
  }

  // feedback
  async function submitFeedback(data) {
    await db.collection("feedback").add({
      uid, ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  // cloud save
  function getUser() { return auth ? auth.currentUser : null; }
  async function loadSave() {
    if (!uid) return null;
    const snap = await db.collection("saves").doc(uid).get();
    return snap.exists ? snap.data() : null;
  }
  async function writeSave(data) {
    await db.collection("saves").doc(uid).set({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  }
  async function linkGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      const res = await auth.currentUser.linkWithPopup(provider);
      return { mode: "linked", email: res.user.email };
    } catch (err) {
      // google account already has a save from another device, switch to it
      if (err.code === "auth/credential-already-in-use" && err.credential) {
        const res = await auth.signInWithCredential(err.credential);
        uid = res.user.uid;
        return { mode: "switched", email: res.user.email };
      }
      throw err;
    }
  }

  // ---------- friends ----------
  // friendCodes/{CODE} -> {uid}; friendReqs/{to_from}; friendships/{a_b} (a<b); invites/{toUid}. See firestore.rules.
  const FC_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pairId = (a, b) => (a < b ? a + "_" + b : b + "_" + a);
  const fts = () => firebase.firestore.FieldValue.serverTimestamp();
  async function myFriendCode() {
    if (!uid) return null;
    const q = await db.collection("friendCodes").where("uid", "==", uid).limit(1).get();
    if (!q.empty) return q.docs[0].id;
    for (let i = 0; i < 6; i++) {
      let c = ""; for (let k = 0; k < 6; k++) c += FC_ALPHA[Math.floor(Math.random() * FC_ALPHA.length)];
      try { await db.collection("friendCodes").doc(c).set({ uid, createdAt: fts() }); return c; } catch (e) { if (e.code !== "permission-denied") throw e; }
    }
    return null;
  }
  const setShowcase = (v) => db.collection("players").doc(uid).set({ showcase: String(v || "").slice(0, 40) }, { merge: true });
  async function playerInfo(u) {
    const d = await db.collection("players").doc(u).get();
    const x = d.exists ? d.data() : {};
    return { uid: u, nickname: x.nickname || "player", avatar: x.avatar || "bug", showcase: typeof x.showcase === "string" ? x.showcase.slice(0, 40) : "" };
  }
  async function findByCode(code) {
    const d = await db.collection("friendCodes").doc(String(code).toUpperCase()).get();
    return d.exists ? playerInfo(d.data().uid) : null;
  }
  const sendRequest = (to) => db.collection("friendReqs").doc(to + "_" + uid).set({ from: uid, to, createdAt: fts() });
  async function acceptRequest(from) {
    const b = db.batch();
    b.set(db.collection("friendships").doc(pairId(uid, from)), { users: [uid, from].sort(), createdAt: fts() });
    b.delete(db.collection("friendReqs").doc(uid + "_" + from));
    await b.commit();
  }
  const declineRequest = (from) => db.collection("friendReqs").doc(uid + "_" + from).delete();
  const cancelRequest = (to) => db.collection("friendReqs").doc(to + "_" + uid).delete();
  const removeFriend = (other) => db.collection("friendships").doc(pairId(uid, other)).delete();
  const listenFriends = (cb) => db.collection("friendships").where("users", "array-contains", uid).onSnapshot((s) => cb(s.docs.map((d) => d.data().users.find((x) => x !== uid))), () => cb(null));
  const listenIncoming = (cb) => db.collection("friendReqs").where("to", "==", uid).onSnapshot((s) => cb(s.docs.map((d) => d.data().from)), () => cb(null));
  const listenOutgoing = (cb) => db.collection("friendReqs").where("from", "==", uid).onSnapshot((s) => cb(s.docs.map((d) => d.data().to)), () => cb(null));
  const sendInvite = (to, code, fromName) => db.collection("invites").doc(to).set({ from: uid, fromName, code, at: fts() });
  const listenInvites = (cb) => db.collection("invites").doc(uid).onSnapshot((d) => cb(d.exists ? d.data() : null), () => cb(null));
  const clearInvite = () => db.collection("invites").doc(uid).delete();
  const friends = { myFriendCode, playerInfo, findByCode, sendRequest, acceptRequest, declineRequest, cancelRequest, removeFriend, listenFriends, listenIncoming, listenOutgoing, sendInvite, listenInvites, clearInvite };

  async function signOut() { try { await auth.signOut(); } catch { } }

  return {
    signOut,
    friends, presence, setShowcase,
    setAvatar, recordPuzzleSolve, fetchPuzzleTop, submitDaily, fetchDaily, fetchMyDaily,
    submitFeedback, getUser, loadSave, writeSave, linkGoogle,
    init, getUid, claimNickname, submitScore, updateStreaks, fetchRating, seedFromScores, pushRating, fetchBoard, fetchBoardFor, isLinked, useFunctions, callFn, listenQueue,
    hostRoom, peekRoom, joinRoom, listenRoomPlayers, listenRoomState, updateRoomSettings, setReady, writeProgress,
    startRound, finishRound, rematch, claimHost, kickPlayer, leaveRoom, heartbeat, sendReaction, sendSay,
  };
})();