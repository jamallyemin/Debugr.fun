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

  async function fetchLeaderboard(tab) {
    if (tab === "streak") {
      const snap = await db.collection("streaks").orderBy("winStreak", "desc").limit(50).get();
      const rows = [];
      for (const doc of snap.docs) {
        rows.push({ token: doc.id, nickname: doc.data().nickname, wins: "-", bestTime: "-", winStreak: doc.data().winStreak || 0 });
      }
      return rows;
    }

    const snap = await db.collection("scores").where("difficulty", "==", tab).orderBy("elapsedMs", "asc").limit(300).get();
    const byPlayer = new Map();
    for (const doc of snap.docs) {
      const s = doc.data();
      const entry = byPlayer.get(s.uid) || { token: s.uid, nickname: s.nickname, wins: 0, bestTimeMs: Infinity };
      entry.wins += 1;
      entry.bestTimeMs = Math.min(entry.bestTimeMs, s.elapsedMs);
      byPlayer.set(s.uid, entry);
    }

    const streakSnap = await db.collection("streaks").get();
    const streakByUid = new Map();
    for (const doc of streakSnap.docs) streakByUid.set(doc.id, doc.data().winStreak || 0);

    const rows = [];
    for (const entry of byPlayer.values()) {
      rows.push({
        ...entry,
        bestTime: (entry.bestTimeMs / 1000).toFixed(1) + "s",
        winStreak: streakByUid.get(entry.token) || 0,
      });
    }
    rows.sort((a, b) => b.wins - a.wins || a.bestTimeMs - b.bestTimeMs);
    return rows.slice(0, 50);
  }

  function genCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  async function hostRoom(difficulty, nickname) {
    let code, existing, attempts = 0;
    do {
      code = genCode();
      existing = await db.collection("rooms").doc(code).get();
      attempts++;
    } while (existing.exists && attempts < 5); // 32^4 codes, collisions are basically never

    await db.collection("rooms").doc(code).set({
      difficulty, hostUid: uid, started: false, winnerUid: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection("rooms").doc(code).collection("players").doc(uid).set({ nickname, done: false, avatar: PlayerState.getAvatar() });
    return code;
  }

  async function joinRoom(code, nickname) {
    const ref = db.collection("rooms").doc(code);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Room not found.");
    if (snap.data().started) throw new Error("That race already started.");
    await ref.collection("players").doc(uid).set({ nickname, done: false, avatar: PlayerState.getAvatar() });
    return snap.data();
  }

  function listenRoomPlayers(code, cb) {
    return db.collection("rooms").doc(code).collection("players").onSnapshot((snap) => {
      const players = [];
      for (const doc of snap.docs) players.push({ token: doc.id, nickname: doc.data().nickname, done: doc.data().done, avatar: doc.data().avatar });
      cb(players);
    });
  }

  function listenRoomState(code, cb) {
    return db.collection("rooms").doc(code).onSnapshot((snap) => {
      if (snap.exists) cb(snap.data());
    });
  }

  async function startRace(code, difficulty) {
    const task = TaskEngine.generateTask(difficulty);
    await db.collection("rooms").doc(code).update({
      started: true,
      task: TaskEngine.serializeTask(task),
      startTime: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Firestore retries this transaction if two players collide, so exactly
  // one of them ends up as the winner even on a near-simultaneous submit.
  async function submitRaceSolution(code, nickname, elapsedMs) {
    const ref = db.collection("rooms").doc(code);
    await ref.collection("players").doc(uid).update({ done: true });
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.data().winnerUid) return; // someone already won
        tx.update(ref, { winnerUid: uid, winnerNickname: nickname, winnerElapsedMs: Math.round(elapsedMs) });
      });
    } catch (err) {
      console.error("Race submit failed (likely a rules/permissions issue):", err);
    }
  }

  async function leaveRoom(code) {
    if (!code) return;
    await db.collection("rooms").doc(code).collection("players").doc(uid).delete().catch(() => {});
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

  return {
    setAvatar, recordPuzzleSolve, fetchPuzzleTop, submitDaily, fetchDaily, fetchMyDaily,
    submitFeedback, getUser, loadSave, writeSave, linkGoogle,
    init, getUid, claimNickname, submitScore, updateStreaks, fetchLeaderboard,
    hostRoom, joinRoom, listenRoomPlayers, listenRoomState, startRace, submitRaceSolution, leaveRoom,
  };
})();