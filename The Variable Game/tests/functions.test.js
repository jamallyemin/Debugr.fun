// run with: node tests/functions.test.js   (no dependencies: firebase-admin and firebase-functions are faked in memory)
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const root = path.join(__dirname, "..");

let passed = 0, pending = Promise.resolve();
function test(name, fn) {
  pending = pending.then(async () => {
    try { await fn(); passed++; console.log("  ok  " + name); }
    catch (e) { console.error("FAIL  " + name + "\n      " + (e && e.stack || e)); process.exitCode = 1; }
  });
}

// ---------------- the shared copies must match the game's own files ----------------
require(path.join(root, "functions", "sync-shared.js"));
test("functions/shared holds exact copies of the game modules", () => {
  for (const f of ["rating.js", "taskEngine.js", "parser.js", "pyeval.js", "puzzles.js"]) {
    assert.strictEqual(fs.readFileSync(path.join(root, "functions", "shared", f), "utf8"), fs.readFileSync(path.join(root, f), "utf8"), f);
  }
});

const core = require(path.join(root, "functions", "core.js"));
const Rating = require(path.join(root, "functions", "shared", "rating.js"));
const TaskEngine = require(path.join(root, "functions", "shared", "taskEngine.js"));
const Puzzles = require(path.join(root, "functions", "shared", "puzzles.js"));

const ctx = (over) => Object.assign({ nickname: "echo", avatar: "bug", linked: true, nowMs: 1_000_000, day: "2026-11-13" }, over);
const bugInput = (diff, over) => {
  const t = TaskEngine.generateTask(diff);
  return Object.assign({ kind: "bug", diff, bites: 0, task: TaskEngine.serializeTask(t), code: t.solution, elapsedMs: 9000, winStreak: 1 }, over || {});
};
const refused = (fn, code) => { try { fn(); } catch (e) { assert.ok(e instanceof core.Refused, "not a Refused: " + e); if (code) assert.strictEqual(e.code, code); return; } assert.fail("should have been refused"); };

// ---------------- core ----------------
test("a real solo win is accepted and rated against the task", () => {
  const r = core.runBug(null, bugInput("easy"), ctx());
  assert.ok(r.change.delta > 0 && r.doc.bugGames === 1 && r.doc.wins_easy === 1 && r.doc.lastGameAt === 1_000_000);
});
test("code that does not satisfy the task is refused", () => {
  refused(() => core.runBug(null, bugInput("easy", { code: "x = 1" }), ctx()), "failed-precondition");
});
test("a task that does not match the claimed difficulty is refused", () => {
  const easy = bugInput("easy");
  refused(() => core.runBug(null, Object.assign({}, easy, { diff: "hard" }), ctx()), "invalid-argument");
});
test("a forged task (unknown rule) is refused", () => {
  const i = bugInput("easy"); i.task.rules[0] = { key: "doesNotExist", params: {} };
  refused(() => core.runBug(null, i, ctx()), "invalid-argument");
});
test("an impossible time is refused", () => {
  refused(() => core.runBug(null, bugInput("easy", { elapsedMs: 300 }), ctx()), "invalid-argument");
});
test("two games closer together than 6 seconds are refused", () => {
  const a = core.runBug(null, bugInput("easy"), ctx());
  refused(() => core.runBug(a.doc, bugInput("easy"), ctx({ nowMs: 1_003_000 })), "resource-exhausted");
  assert.ok(core.runBug(a.doc, bugInput("easy"), ctx({ nowMs: 1_010_000 })).change);
});
test("leaving a run is a loss and needs no code", () => {
  const r = core.runBug(null, { kind: "bug", diff: "easy", bites: 0, abandoned: true, opp: 900 }, ctx());
  assert.ok(r.change.delta < 0 && r.doc.wins_easy === 0);
});
test("the daily gain cap holds on the server too", () => {
  let doc = null, t = 1_000_000, gain = 0;
  for (let i = 0; i < 40; i++) { const r = core.runBug(doc, bugInput("hard"), ctx({ nowMs: (t += 10_000) })); doc = r.doc; gain = doc.dayGain; }
  assert.ok(gain <= Rating.DAILY_CAP, "gain " + gain);
});
test("a puzzle level is rated once, replays and level skipping change nothing", () => {
  const sol = (l) => Puzzles.generate("syntax", l).solution;
  const a = core.runPuzzle(null, { kind: "puzzle", track: "syntax", level: 0, hints: 0, code: sol(0) }, ctx());
  assert.ok(a.change && a.doc.puzDone.syntax === 1);
  const replay = core.runPuzzle(a.doc, { kind: "puzzle", track: "syntax", level: 0, hints: 0, code: sol(0) }, ctx({ nowMs: 1_020_000 }));
  assert.strictEqual(replay.change, null);
  const skip = core.runPuzzle(a.doc, { kind: "puzzle", track: "syntax", level: 30, hints: 0, code: sol(30) }, ctx({ nowMs: 1_040_000 }));
  assert.strictEqual(skip.change, null);
  refused(() => core.runPuzzle(a.doc, { kind: "puzzle", track: "syntax", level: 1, hints: 0, code: "print(1)" }, ctx({ nowMs: 1_060_000 })), "failed-precondition");
});
test("matching: nearest rating wins, the allowed gap grows with waiting, stale entries are skipped", () => {
  const me = { uid: "a", rating: 1000, difficulty: "easy", at: 0 };
  const q = [{ uid: "b", rating: 1400, difficulty: "easy", at: 0, seen: 0, room: null }, { uid: "c", rating: 1090, difficulty: "easy", at: 0, seen: 0, room: null },
    { uid: "d", rating: 1050, difficulty: "hard", at: 0, seen: 0, room: null }];
  assert.strictEqual(core.findOpponent(me, q, 1000).uid, "c");
  assert.strictEqual(core.findOpponent(me, [q[0]], 1000), null);
  assert.strictEqual(core.findOpponent(me, [q[0]], 20_000).uid, "b");
  assert.strictEqual(core.findOpponent(me, [Object.assign({}, q[1], { seen: -50_000 })], 1000), null);
});
test("a quick match moves the winner up and the loser down, and a repeat opponent changes nothing", () => {
  const docs = { a: null, b: null };
  const res = core.rateRace({ docs, winnerUid: "a", pairCount: 0, ctx: { day: "2026-11-13", nowMs: 5, players: {} } });
  assert.ok(res.a.change.delta > 0 && res.b.change.delta < 0 && res.a.doc.raceGames === 1);
  const rep = core.rateRace({ docs, winnerUid: "a", pairCount: 3, ctx: { day: "2026-11-13", nowMs: 5, players: {} } });
  assert.strictEqual(rep.a.change.delta, 0); assert.strictEqual(rep.b.change.delta, 0); assert.ok(!rep.a.doc.raceGames);
});
test("server mode rules differ from firestore.rules only in the ratings block", () => {
  require(path.join(root, "functions", "make-rules.js"));
  const a = fs.readFileSync(path.join(root, "firestore.rules"), "utf8"), b = fs.readFileSync(path.join(root, "functions", "firestore.rules.server"), "utf8");
  assert.ok(/allow create, update, delete: if false;/.test(b) && !/allow update: if isOwner\(uid\) && ratingStep/.test(b));
  assert.ok(a.length > b.length && /match \/queue\/\{uid\}/.test(b));
});

// ---------------- index.js against an in-memory Firestore ----------------
class HttpsError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const store = new Map();
const TS = { __ts: true };
function snap(p) { const d = store.get(p); return { exists: d !== undefined, id: p.split("/").pop(), data: () => (d === undefined ? undefined : JSON.parse(JSON.stringify(d))), ref: docRef(p) }; }
function docRef(p) {
  return { path: p, get: async () => snap(p), set: async (d) => { store.set(p, d); }, update: async (d) => { store.set(p, Object.assign({}, store.get(p), d)); },
    delete: async () => { store.delete(p); }, collection: (n) => collRef(p + "/" + n) };
}
function collRef(c, filters = [], lim = 1e9) {
  const run = () => {
    const rows = [];
    for (const [k, v] of store) {
      const parts = k.split("/");
      if (k.startsWith(c + "/") && parts.length === c.split("/").length + 1) rows.push({ id: parts[parts.length - 1], d: v });
    }
    return rows.filter((r) => filters.every(([f, , val]) => r.d[f] === val)).slice(0, lim).map((r) => ({ id: r.id, exists: true, data: () => JSON.parse(JSON.stringify(r.d)), ref: docRef(c + "/" + r.id) }));
  };
  return { where: (f, o, v) => collRef(c, filters.concat([[f, o, v]]), lim), limit: (n) => collRef(c, filters, n), get: async () => ({ docs: run() }), doc: (id) => docRef(c + "/" + id), _run: run };
}
const fakeDb = {
  doc: docRef, collection: (n) => collRef(n),
  async runTransaction(fn) {
    const writes = [];
    const tx = {
      get: async (x) => (x._run ? { docs: x._run() } : snap(x.path)),
      set: (ref, d) => writes.push(() => store.set(ref.path, d)),
      update: (ref, d) => writes.push(() => store.set(ref.path, Object.assign({}, store.get(ref.path), d))),
    };
    const out = await fn(tx);
    writes.forEach((w) => w());
    return out;
  },
};
const fakeAdmin = { initializeApp() {}, firestore: Object.assign(() => fakeDb, { FieldValue: { serverTimestamp: () => TS } }) };
const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === "firebase-functions/v2/https") return { onCall: (a, b) => b || a, HttpsError };
  if (req === "firebase-functions/v2/firestore") return { onDocumentUpdated: (p, h) => h, onDocumentDeleted: (p, h) => h };
  if (req === "firebase-admin") return fakeAdmin;
  return origLoad.call(this, req, ...rest);
};
const fns = require(path.join(root, "functions", "index.js"));
Module._load = origLoad;

const reqFor = (uid, data, provider) => ({ auth: { uid, token: { firebase: { sign_in_provider: provider || "google.com" } } }, data });
const seedPlayer = (uid, nickname) => { store.set(`players/${uid}`, { nickname, avatar: "bug" }); };
const fail = async (p, code) => { try { await p; } catch (e) { assert.strictEqual(e.code, code, e.message); return; } assert.fail("should have thrown " + code); };

test("ensureRating creates the document and carries over old wins and best times", async () => {
  store.clear(); seedPlayer("u1", "echo");
  store.set("scores/s1", { uid: "u1", difficulty: "easy", elapsedMs: 9000 }); store.set("scores/s2", { uid: "u1", difficulty: "easy", elapsedMs: 7000 });
  store.set("scores/s3", { uid: "other", difficulty: "easy", elapsedMs: 3000 });
  const r = await fns.ensureRating(reqFor("u1", {}));
  assert.strictEqual(r.doc.wins_easy, 2); assert.strictEqual(r.doc.best_easy, 7000); assert.strictEqual(r.doc.bugRating, 1000);
  assert.ok(store.get("ratings/u1").updatedAt);
});
test("submitSolo needs a nickname and refuses cheats, then writes the verified result", async () => {
  store.clear();
  await fail(fns.submitSolo(reqFor("u1", bugInput("easy"))), "failed-precondition");
  seedPlayer("u1", "echo");
  await fail(fns.submitSolo(reqFor("u1", bugInput("easy", { code: "x = 1" }))), "failed-precondition");
  const r = await fns.submitSolo(reqFor("u1", bugInput("easy")));
  assert.ok(r.change.delta > 0 && store.get("ratings/u1").bugGames === 1);
  await fail(fns.submitSolo(reqFor("u1", bugInput("easy"))), "resource-exhausted");
  await fail(fns.submitSolo({ data: {} }), "unauthenticated");
});

function setupPlayers() {
  store.clear();
  for (const [u, n, r] of [["A", "ann", 1000], ["B", "bob", 1040], ["C", "cat", 1900]]) {
    seedPlayer(u, n);
    store.set(`ratings/${u}`, Rating.toDoc((() => { const s = Rating.blank(); s.bug.g = 12; return s; })(), { nickname: n, avatar: "bug", linked: true }));
    if (r !== 1000) store.set(`ratings/${u}`, Object.assign(store.get(`ratings/${u}`), { raceRating: r, raceGames: 12, racePeak: r }));
  }
}
test("quick match: anonymous players are refused", async () => {
  setupPlayers();
  await fail(fns.joinQueue(reqFor("A", { difficulty: "easy" }, "anonymous")), "permission-denied");
});
test("quick match: pairs close ratings, makes a room with both players, and keeps far ratings apart", async () => {
  setupPlayers();
  assert.deepStrictEqual(await fns.joinQueue(reqFor("A", { difficulty: "easy" })), { room: null });
  assert.deepStrictEqual(await fns.joinQueue(reqFor("C", { difficulty: "easy" })), { room: null }); // 1900 vs 1000: too far apart
  const b = await fns.joinQueue(reqFor("B", { difficulty: "easy" }));
  assert.ok(/^[A-Z2-9]{4}$/.test(b.room));
  const room = store.get(`rooms/${b.room}`);
  assert.ok(room.quick && room.rounds === 1 && room.phase === "lobby" && room.pair.sort().join() === "A,B" && room.hostUid === "A");
  assert.ok(store.get(`rooms/${b.room}/players/A`).ready && store.get(`rooms/${b.room}/players/B`).ready);
  assert.strictEqual((await fns.joinQueue(reqFor("A", { difficulty: "easy" }))).room, b.room); // asking again returns the match
  assert.strictEqual(store.get("queue/C").room, null);
});
test("quick match: the result is rated once, winner up, loser down", async () => {
  setupPlayers();
  await fns.joinQueue(reqFor("A", {})); const room = (await fns.joinQueue(reqFor("B", {}))).room;
  const before = store.get(`rooms/${room}`);
  store.set(`rooms/${room}`, Object.assign({}, before, { phase: "results", winnerUid: "B" }));
  const ev = { params: { code: room }, data: { before: { data: () => before }, after: { data: () => store.get(`rooms/${room}`) } } };
  await fns.settleQuickMatch(ev);
  const done = store.get(`rooms/${room}`);
  assert.ok(done.ratedDone && done.rated.B.delta > 0 && done.rated.A.delta < 0);
  assert.strictEqual(store.get("ratings/B").raceGames, 13);
  const rB = store.get("ratings/B").raceRating;
  await fns.settleQuickMatch({ params: { code: room }, data: { before: { data: () => before }, after: { data: () => store.get(`rooms/${room}`) } } });
  assert.strictEqual(store.get("ratings/B").raceRating, rB, "a second trigger must not rate again");
});
test("quick match: leaving a started race loses, and the same pair stops counting after 3 matches a day", async () => {
  setupPlayers();
  let room;
  for (let i = 0; i < 3; i++) {
    // keep both players at the same rating so the matcher always pairs them (the pair counter is what is under test)
    for (const u of ["A", "B"]) store.set(`ratings/${u}`, Object.assign(store.get(`ratings/${u}`), { raceRating: 1000, raceGames: 12, racePeak: 1000 }));
    await fns.joinQueue(reqFor("A", {})); room = (await fns.joinQueue(reqFor("B", {}))).room;
    assert.ok(room, "round " + i + " should have been paired");
    store.set(`rooms/${room}`, Object.assign({}, store.get(`rooms/${room}`), { phase: "race" }));
    store.delete(`rooms/${room}/players/A`);
    await fns.quickMatchLeft({ params: { code: room, uid: "A" } });
    const r = store.get(`rooms/${room}`).rated;
    assert.ok(r, "room " + room + " round " + i + ": " + JSON.stringify(store.get(`rooms/${room}`)));
    assert.ok(r.A.delta <= 0 && r.B.delta >= 0 && !r.A.repeat);
    store.delete("queue/A"); store.delete("queue/B");
  }
  // fourth meeting: the queue refuses to pair them
  for (const u of ["A", "B"]) store.set(`ratings/${u}`, Object.assign(store.get(`ratings/${u}`), { raceRating: 1000, raceGames: 12, racePeak: 1000 }));
  await fns.joinQueue(reqFor("A", {}));
  assert.deepStrictEqual(await fns.joinQueue(reqFor("B", {})), { room: null });
});

pending.then(() => console.log("\n" + passed + " tests passed"));
