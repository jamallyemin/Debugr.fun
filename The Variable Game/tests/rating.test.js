// run with: node tests/rating.test.js   (no dependencies)
"use strict";
const assert = require("assert");
const path = require("path");
const R = require(path.join(__dirname, "..", "rating.js"));
const TaskEngine = require(path.join(__dirname, "..", "taskEngine.js"));

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("FAIL  " + name + "\n      " + (e && e.stack || e)); process.exitCode = 1; }
}
const task = (n) => ({ rules: Array.from({ length: n }, () => ({ key: "equals" })) });

test("equal ratings expect 0.5 and a clean win at K=32 gives +16", () => {
  assert.strictEqual(R.expected(1200, 1200), 0.5);
  const s = R.step(1200, 50, 1200, 1);
  assert.strictEqual(s.delta, 16);
});

test("placement games move faster than settled ones", () => {
  assert.strictEqual(R.kFor(0), 64);
  assert.strictEqual(R.kFor(9), 64);
  assert.strictEqual(R.kFor(10), 32);
});

test("one step never moves more than MAX_STEP and never leaves the rating floor", () => {
  const up = R.step(100, 0, 3000, 1), down = R.step(100, 0, 100, 0);
  assert.ok(up.delta <= R.MAX_STEP);
  assert.ok(down.rating >= 100);
  assert.strictEqual(R.step(120, 0, 120, 0).rating, 100, "a big loss at the floor stops at the floor");
});

test("a hard opponent is worth more than an easy one for the same score", () => {
  assert.ok(R.step(1200, 20, 1500, 1).delta > R.step(1200, 20, 1000, 1).delta);
});

test("the same clean run is worth the same score as before: bites lower it, 6 bites is a loss", () => {
  assert.strictEqual(R.bugScore(0, false), 1);
  assert.strictEqual(R.bugScore(2, false), 0.65);
  assert.strictEqual(R.bugScore(6, false), 0);
  assert.strictEqual(R.bugScore(0, true), 0);
});

test("puzzle score: hints and wrong runs cost points but never below 0.3", () => {
  assert.strictEqual(R.puzzleScore(0, 0), 1);
  assert.strictEqual(R.puzzleScore(2, 0), 0.7);
  assert.strictEqual(R.puzzleScore(9, 9), 0.3);
});

test("tiers: boundaries and progress", () => {
  assert.strictEqual(R.tierFor(799).name, "LARVA");
  assert.strictEqual(R.tierFor(800).name, "GRUB");
  assert.strictEqual(R.tierFor(1184).name, "BEETLE");
  assert.strictEqual(R.tierFor(2500).name, "APEX");
  const p = R.tierProgress(1184);
  assert.strictEqual(p.next.name, "MANTIS");
  assert.strictEqual(p.toNext, 216);
  assert.strictEqual(R.tierProgress(2300).next, null);
});

test("task and level ratings grow with difficulty", () => {
  assert.ok(R.taskRating(task(2), "easy") < R.taskRating(task(4), "medium"));
  assert.ok(R.taskRating(task(4), "medium") < R.taskRating(task(6), "hard"));
  assert.ok(R.levelRating(0) < R.levelRating(30));
  const twisted = { rules: [{ key: "equals" }, { key: "forbidName" }] };
  assert.ok(R.taskRating(twisted, "easy") > R.taskRating(task(1), "easy"));
});

test("real generated tasks all get a sane rating", () => {
  for (const d of ["easy", "medium", "hard"]) {
    for (let i = 0; i < 40; i++) {
      const r = R.taskRating(TaskEngine.generateTask(d), d);
      assert.ok(r >= 700 && r <= 2100, d + " " + r);
    }
  }
});

test("applyBug: a clean win raises the rating, counts the win and records a best time", () => {
  const { state, change } = R.applyBug(R.blank(), { diff: "easy", task: task(2), bites: 0, elapsedMs: 14200, winStreak: 1, day: "2026-11-12" });
  assert.ok(change.delta > 0);
  assert.strictEqual(state.bug.g, 1);
  assert.strictEqual(state.wins.easy, 1);
  assert.strictEqual(state.best.easy, 14200);
  assert.strictEqual(state.bestStreak, 1);
});

test("applyBug: a slower run never replaces a better best time", () => {
  let s = R.applyBug(R.blank(), { diff: "easy", task: task(2), bites: 0, elapsedMs: 9000, day: "d" }).state;
  s = R.applyBug(s, { diff: "easy", task: task(2), bites: 0, elapsedMs: 20000, day: "d" }).state;
  assert.strictEqual(s.best.easy, 9000);
  assert.strictEqual(s.wins.easy, 2);
});

test("applyBug: abandoning is a loss and does not count as a win", () => {
  const { state, change } = R.applyBug(R.blank(), { diff: "easy", task: task(2), bites: 0, abandoned: true, day: "d" });
  assert.ok(change.delta < 0);
  assert.strictEqual(state.wins.easy, 0);
  assert.strictEqual(state.bug.g, 1);
});

test("an absurd 0.3s time is not recorded as a best", () => {
  const { state } = R.applyBug(R.blank(), { diff: "easy", task: task(2), bites: 0, elapsedMs: 300, day: "d" });
  assert.strictEqual(state.best.easy, undefined);
});

test("daily gain cap: points stop at the cap, losses still count", () => {
  let s = R.blank();
  let total = 0;
  for (let i = 0; i < 40; i++) {
    const r = R.applyBug(s, { diff: "hard", task: task(6), bites: 0, elapsedMs: 9000, day: "d1" });
    s = r.state; total += r.change.delta;
  }
  assert.ok(total <= R.DAILY_CAP, "gained " + total);
  assert.strictEqual(s.dayGain, total);
  const loss = R.applyBug(s, { diff: "hard", task: task(6), bites: 0, abandoned: true, day: "d1" });
  assert.ok(loss.change.delta < 0);
  const next = R.applyBug(loss.state, { diff: "hard", task: task(6), bites: 0, elapsedMs: 9000, day: "d2" });
  assert.ok(next.change.delta > 0, "a new day lifts the cap");
});

test("tier up is reported once, when a boundary is crossed", () => {
  const s = R.blank(); s.bug.r = 1095; s.bug.g = 30;
  const r = R.applyBug(s, { diff: "hard", task: task(6), bites: 0, elapsedMs: 9000, day: "d" });
  assert.strictEqual(r.change.tierUp, "BEETLE");
  assert.strictEqual(R.applyBug(r.state, { diff: "hard", task: task(6), bites: 0, elapsedMs: 9000, day: "d" }).change.tierUp, null);
});

test("applyPuzzle moves only the puzzle rating", () => {
  const { state, change } = R.applyPuzzle(R.blank(), { level: 10, hints: 0, wrongRuns: 0, day: "d" });
  assert.strictEqual(state.bug.r, 1000);
  assert.strictEqual(state.puz.g, 1);
  assert.strictEqual(change.kind, "puzzle");
});

test("junk state is cleaned instead of trusted", () => {
  const s = R.clean({ bug: { r: "x", g: -5 }, wins: { easy: -3 }, best: { easy: "fast" }, bestStreak: NaN });
  assert.strictEqual(s.bug.r, 1000);
  assert.strictEqual(s.bug.g, 0);
  assert.strictEqual(s.wins.easy, 0);
  assert.strictEqual(s.best.easy, undefined);
  assert.strictEqual(s.bestStreak, 0);
});

test("toDoc/fromDoc round-trip, and the board fields only appear for linked, placed players", () => {
  let s = R.blank();
  s.bug = { r: 1234, g: 12, peak: 1250 }; s.puz = { r: 1010, g: 3, peak: 1010 };
  s.wins.easy = 5; s.best.easy = 8000;
  const me = { nickname: "echo", avatar: "bug" };
  const linked = R.toDoc(s, { ...me, linked: true }), anon = R.toDoc(s, { ...me, linked: false });
  assert.strictEqual(linked.boardBug, 1234);
  assert.strictEqual(linked.boardPuz, undefined, "puzzle still in placement");
  assert.strictEqual(anon.boardBug, undefined);
  assert.deepStrictEqual(R.fromDoc(linked), s);
});

test("every field written to the doc is one the rules know about", () => {
  const known = new Set(["nickname", "avatar", "bugRating", "bugGames", "bugPeak", "puzRating", "puzGames", "puzPeak",
    "bestStreak", "day", "dayGain", "wins_easy", "wins_medium", "wins_hard", "best_easy", "best_medium", "best_hard",
    "boardBug", "boardPuz", "updatedAt"]);
  const s = R.blank(); s.bug.g = 20; s.puz.g = 20; R.DIFFS.forEach((d) => { s.best[d] = 5000; });
  Object.keys(R.toDoc(s, { nickname: "x", avatar: "bug", linked: true })).forEach((k) => assert.ok(known.has(k), k));
});

// A JS port of the ratingStep() rule in firestore.rules. It can't check the rules' syntax (that needs the Firebase
// emulator) but it proves that every document this client produces satisfies the rule's arithmetic.
function ruleStep(o, n, today) {
  const pos = (x) => (x > 0 ? x : 0);
  const kind = (oR, nR, oG, nG) => nG >= oG && (nG === oG ? nR === oR : Math.abs(nR - oR) <= 70);
  const best = (f) => (!(f in o) || f in n) && (!(f in n) || (n[f] >= 1201 && n[f] <= 600000 && (!(f in o) || n[f] <= o[f])));
  return n.day === today && n.dayGain >= 0 && n.dayGain <= 150
    && (n.bugGames - o.bugGames) + (n.puzGames - o.puzGames) <= 1
    && kind(o.bugRating, n.bugRating, o.bugGames, n.bugGames) && kind(o.puzRating, n.puzRating, o.puzGames, n.puzGames)
    && n.bugPeak === (n.bugRating > o.bugPeak ? n.bugRating : o.bugPeak)
    && n.puzPeak === (n.puzRating > o.puzPeak ? n.puzRating : o.puzPeak)
    && n.wins_easy >= o.wins_easy && n.wins_medium >= o.wins_medium && n.wins_hard >= o.wins_hard
    && (n.wins_easy - o.wins_easy) + (n.wins_medium - o.wins_medium) + (n.wins_hard - o.wins_hard) <= n.bugGames - o.bugGames
    && n.bestStreak >= o.bestStreak && n.bestStreak <= o.bestStreak + 1
    && best("best_easy") && best("best_medium") && best("best_hard")
    && n.dayGain === (o.day === today ? o.dayGain : 0) + pos(n.bugRating - o.bugRating) + pos(n.puzRating - o.puzRating);
}
test("every state change the client makes passes the firestore.rules arithmetic (200 random games over 3 days)", () => {
  const me = { nickname: "echo", avatar: "bug", linked: true };
  let s = R.blank(), days = ["2026-11-12", "2026-11-13", "2026-11-14"], streak = 0, prev = null;
  s.day = days[0]; prev = R.toDoc(s, me);
  for (let i = 0; i < 200; i++) {
    const day = days[Math.floor(i / 70)];
    let r;
    if (i % 3 === 0) r = R.applyPuzzle(s, { level: i % 40, hints: i % 4, wrongRuns: i % 5, day });
    else {
      const abandoned = i % 7 === 0, bites = i % 6;
      streak = abandoned || bites ? 0 : streak + 1;
      r = R.applyBug(s, { diff: ["easy", "medium", "hard"][i % 3], task: task(2 + (i % 5)), bites, abandoned, elapsedMs: 2000 + ((i * 977) % 30000), winStreak: streak, day });
    }
    s = r.state;
    const doc = R.toDoc(s, me);
    assert.ok(ruleStep(prev, doc, day), "game " + i + " would be refused:\n" + JSON.stringify(prev) + "\n" + JSON.stringify(doc));
    prev = doc;
  }
});

console.log("\n" + passed + " tests passed");
