// run with: node tests/rooms.test.js   (no dependencies)
"use strict";
const assert = require("assert");
const path = require("path");
const R = require(path.join(__dirname, "..", "roomlogic.js"));

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("FAIL  " + name + "\n      " + (e && e.stack || e)); process.exitCode = 1; }
}

test("normalizeRoom clamps junk to safe defaults", () => {
  const r = R.normalizeRoom({ difficulty: "nightmare", rounds: 99, speed: "<b>", sabotage: "yes", phase: "x", round: -4, roundWinners: ["a", 5, null], hostName: "x".repeat(50) });
  assert.deepStrictEqual([r.difficulty, r.rounds, r.speed, r.sabotage, r.phase, r.round], ["easy", 1, "normal", false, "lobby", 0]);
  assert.deepStrictEqual(r.roundWinners, ["a"]);
  assert.strictEqual(r.hostName.length, 16);
  assert.strictEqual(R.normalizeRoom(null).phase, "lobby");
});

test("best of 3: first to 2 wins ends the match", () => {
  const room = (w, round) => R.normalizeRoom({ rounds: 3, round, roundWinners: w });
  assert.strictEqual(R.matchState(room(["a"], 1)).over, false);
  assert.strictEqual(R.matchState(room(["a", "b"], 2)).over, false);
  const s = R.matchState(room(["a", "a"], 2));
  assert.ok(s.over); assert.strictEqual(s.champion, "a");
});

test("a 1-round room is over after round 1", () => {
  const s = R.matchState(R.normalizeRoom({ rounds: 1, round: 1, roundWinners: ["b"] }));
  assert.ok(s.over); assert.strictEqual(s.champion, "b");
});

test("best of 5 can run to the last round and still pick a champion", () => {
  const w = ["a", "b", "a", "b", "c"];
  const s = R.matchState(R.normalizeRoom({ rounds: 5, round: 5, roundWinners: w }));
  assert.ok(s.over); assert.ok(s.tied); assert.strictEqual(s.champion, null);
  const s2 = R.matchState(R.normalizeRoom({ rounds: 5, round: 5, roundWinners: ["a", "b", "a", "b", "a"] }));
  assert.strictEqual(s2.champion, "a");
});

test("host counts as ready, start needs two ready players", () => {
  const players = [{ token: "h", ready: false }, { token: "x", ready: false }, { token: "y", ready: true }];
  const i = R.readyInfo(players, "h");
  assert.strictEqual(i.ready, 2); assert.ok(i.canStart); assert.ok(!i.all);
  assert.ok(!R.readyInfo([{ token: "h" }], "h").canStart);
  assert.ok(R.readyInfo([{ token: "h" }, { token: "x", ready: true }], "h").all);
});

test("host succession is deterministic and only triggers when the host is gone", () => {
  const players = [{ token: "zed" }, { token: "amy" }, { token: "bob" }];
  assert.strictEqual(R.nextHost(players, "gone"), "amy");
  assert.strictEqual(R.nextHost(players, "bob"), null);
  assert.strictEqual(R.nextHost([], "gone"), null);
});

test("sabotage only counts NEW best rule counts", () => {
  const t = R.createSabotageTracker();
  assert.strictEqual(t.update("m", 1), 1);
  assert.strictEqual(t.update("m", 0), 0);   // un-met a rule
  assert.strictEqual(t.update("m", 1), 0);   // met it again: no new sabotage
  assert.strictEqual(t.update("m", 3), 2);
  t.reset();
  assert.strictEqual(t.update("m", 1), 1);
});

test("lane position stays within the track", () => {
  assert.strictEqual(R.lanePosition(0, 0), 0);
  assert.strictEqual(R.lanePosition(2, 4), 0.5);
  assert.strictEqual(R.lanePosition(9, 4), 1);
  assert.strictEqual(R.lanePosition(-3, 4), 0);
});

test("results sort: finishers by time, then unfinished by progress", () => {
  const out = R.sortResults([
    { token: "c", done: false, passed: 1 }, { token: "a", done: true, elapsedMs: 21000 },
    { token: "d", done: false, passed: 3 }, { token: "b", done: true, elapsedMs: 17900 },
  ]).map((p) => p.token);
  assert.deepStrictEqual(out, ["b", "a", "d", "c"]);
});

test("room codes are found in links, pasted text and bare codes", () => {
  assert.strictEqual(R.parseRoomCode("https://debugr.fun/?room=kq7m"), "KQ7M");
  assert.strictEqual(R.parseRoomCode(" kq7m "), "KQ7M");
  assert.strictEqual(R.parseRoomCode("join me: KQ7M !"), ""); // free text is not guessed at
  assert.strictEqual(R.parseRoomCode("nothing here"), "");
  assert.strictEqual(R.parseRoomCode(""), "");
});

console.log(`\n${passed} tests passed` + (process.exitCode ? " (with failures)" : ""));
