// Cloud Functions for debugr.fun. Deploy: firebase deploy --only functions,firestore:rules   (see README, "server mode")
// - ensureRating / submitSolo : ratings computed here from a verified run, so the browser can no longer write them
// - joinQueue / leaveQueue    : rated quick match (pairs two linked players by rating, makes the room)
// - settleQuickMatch, quickMatchLeft : rate the race when it ends, a player who leaves mid-race loses
"use strict";
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const core = require("./core.js");
const Rating = require("./shared/rating.js");

const strip = (d) => { if (!d) return null; const o = Object.assign({}, d); delete o.updatedAt; return o; };
const guard = (fn) => async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "sign in first");
  try { return await fn(req); }
  catch (e) { if (e instanceof core.Refused) throw new HttpsError(e.code, e.message); throw e; }
};
const linked = (req) => !!(req.auth.token && req.auth.token.firebase && req.auth.token.firebase.sign_in_provider !== "anonymous");
async function who(req) {
  const p = await db.doc(`players/${req.auth.uid}`).get();
  const d = p.exists ? p.data() : null;
  if (!d || !d.nickname) throw new core.Refused("failed-precondition", "pick a nickname first");
  return { nickname: d.nickname, avatar: d.avatar || "bug", linked: linked(req), nowMs: Date.now(), day: Rating.dayKey() };
}

exports.ensureRating = onCall(guard(async (req) => {
  const ctx = await who(req), ref = db.doc(`ratings/${req.auth.uid}`);
  const scores = (await db.collection("scores").where("uid", "==", req.auth.uid).limit(500).get()).docs.map((d) => d.data());
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return { doc: strip(snap.data()) };
    const doc = core.seedDoc(scores, ctx);
    tx.set(ref, Object.assign({}, doc, { updatedAt: FieldValue.serverTimestamp() }));
    return { doc };
  });
}));

exports.submitSolo = onCall(guard(async (req) => {
  const ctx = await who(req), ref = db.doc(`ratings/${req.auth.uid}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref), doc = snap.exists ? snap.data() : null;
    const run = req.data && req.data.kind === "puzzle" ? core.runPuzzle : core.runBug;
    const res = run(doc, req.data, ctx);
    if (res.doc && res.change) tx.set(ref, Object.assign({}, res.doc, { updatedAt: FieldValue.serverTimestamp() }));
    return { change: res.change, doc: strip(res.doc) };
  });
}));

// ---------- rated quick match ----------
const genCode = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };
const newPlayer = (e) => ({ nickname: e.nickname, avatar: e.avatar, ready: true, passed: 0, total: 0, bites: 0, done: false, elapsedMs: 0, grid: "", round: 0 });

exports.joinQueue = onCall(guard(async (req) => {
  const ctx = await who(req), uid = req.auth.uid;
  if (!ctx.linked) throw new core.Refused("permission-denied", "link a Google account to play rated quick match");
  const difficulty = Rating.DIFFS.indexOf(req.data && req.data.difficulty) >= 0 ? req.data.difficulty : "easy";
  const rdoc = await db.doc(`ratings/${uid}`).get();
  if (!rdoc.exists) throw new core.Refused("failed-precondition", "play a solo game first");
  const rating = Number.isFinite(rdoc.data().raceRating) ? rdoc.data().raceRating : Rating.START;
  const qref = db.doc(`queue/${uid}`);

  return db.runTransaction(async (tx) => {
    const mine = await tx.get(qref);
    if (mine.exists && mine.data().room) return { room: mine.data().room };
    const at = mine.exists && Number.isFinite(mine.data().at) ? mine.data().at : ctx.nowMs;
    const me = { uid, nickname: ctx.nickname, avatar: ctx.avatar, difficulty, rating, at, seen: ctx.nowMs, room: null, expireAt: new Date(ctx.nowMs + 10 * 60 * 1000) };
    const waiting = (await tx.get(db.collection("queue").where("difficulty", "==", difficulty).where("room", "==", null).limit(25))).docs.map((d) => d.data());

    // skip people this player has already met too often today
    let pool = waiting.filter((o) => o.uid !== uid), opp = null;
    while (pool.length) {
      const cand = core.findOpponent(me, pool, ctx.nowMs);
      if (!cand) break;
      const pair = await tx.get(db.doc(`pairs/${core.pairKey(uid, cand.uid, ctx.day)}`));
      if ((pair.exists ? pair.data().n : 0) >= core.MAX_PAIR_PER_DAY) { pool = pool.filter((o) => o.uid !== cand.uid); continue; }
      opp = cand; break;
    }
    if (!opp) { tx.set(qref, me); return { room: null }; }

    let code = genCode();
    for (let i = 0; i < 5; i++) { if (!(await tx.get(db.doc(`rooms/${code}`))).exists) break; code = genCode(); }
    const host = me.at <= opp.at ? me : opp;
    const room = db.doc(`rooms/${code}`);
    tx.set(room, { difficulty, rounds: 1, speed: "normal", sabotage: false, phase: "lobby", round: 0, roundWinners: [], hostUid: host.uid, hostName: host.nickname,
      winnerUid: null, createdAt: FieldValue.serverTimestamp(), expireAt: new Date(ctx.nowMs + 2 * 3600 * 1000), quick: true, pair: [me.uid, opp.uid] });
    tx.set(room.collection("players").doc(me.uid), newPlayer(me));
    tx.set(room.collection("players").doc(opp.uid), newPlayer(opp));
    tx.set(qref, Object.assign({}, me, { room: code }));
    tx.update(db.doc(`queue/${opp.uid}`), { room: code });
    return { room: code };
  });
}));

exports.leaveQueue = onCall(guard(async (req) => {
  const ref = db.doc(`queue/${req.auth.uid}`), s = await ref.get();
  if (s.exists && !s.data().room) await ref.delete();
  return { ok: true };
}));

// rate a finished quick match once. winnerUid is the player who finished first (or the one still there)
async function settle(code, winnerUid) {
  const rref = db.doc(`rooms/${code}`);
  await db.runTransaction(async (tx) => {
    const room = (await tx.get(rref)).data();
    if (!room || !room.quick || room.ratedDone || !Array.isArray(room.pair) || room.pair.length !== 2) return;
    const [a, b] = room.pair;
    if (winnerUid !== a && winnerUid !== b) { tx.update(rref, { ratedDone: true, rated: {} }); return; }
    const day = Rating.dayKey(), nowMs = Date.now();
    const refs = { [a]: db.doc(`ratings/${a}`), [b]: db.doc(`ratings/${b}`) };
    const pref = db.doc(`pairs/${core.pairKey(a, b, day)}`);
    const [sa, sb, sp] = await Promise.all([tx.get(refs[a]), tx.get(refs[b]), tx.get(pref)]);
    const docs = { [a]: sa.exists ? sa.data() : null, [b]: sb.exists ? sb.data() : null };
    const pairCount = sp.exists ? sp.data().n : 0;
    const res = core.rateRace({ docs, winnerUid, pairCount, ctx: { day, nowMs, players: {} } });
    const rated = {};
    for (const u of [a, b]) {
      tx.set(refs[u], Object.assign({}, res[u].doc, { updatedAt: FieldValue.serverTimestamp() }));
      const c = res[u].change;
      rated[u] = { before: c.before, after: c.after, delta: c.delta, repeat: !!c.repeat, tierUp: c.tierUp || null };
    }
    tx.set(pref, { n: pairCount + 1, day, expireAt: new Date(nowMs + 3 * 24 * 3600 * 1000) });
    tx.update(rref, { ratedDone: true, rated });
  });
}

exports.settleQuickMatch = onDocumentUpdated("rooms/{code}", async (event) => {
  const before = event.data.before.data(), after = event.data.after.data();
  if (!after || !after.quick || after.ratedDone || after.phase !== "results" || before.phase === "results") return;
  await settle(event.params.code, after.winnerUid);
});

// leaving a quick match after the race started is a loss (otherwise quitting would dodge it)
exports.quickMatchLeft = onDocumentDeleted("rooms/{code}/players/{uid}", async (event) => {
  const r = (await db.doc(`rooms/${event.params.code}`).get()).data();
  if (!r || !r.quick || r.ratedDone || r.phase !== "race" || !Array.isArray(r.pair)) return;
  const winner = r.pair.find((u) => u !== event.params.uid);
  if (winner && r.pair.indexOf(event.params.uid) >= 0) await settle(event.params.code, winner);
});
