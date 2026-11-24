// The server's rules, with no Firebase in them so they can be tested in plain node (tests/functions.test.js).
// index.js only moves data between Firestore and these functions.
"use strict";
const Rating = require("./shared/rating.js");
const TaskEngine = require("./shared/taskEngine.js");
const CodeParser = require("./shared/parser.js");
const Puzzles = require("./shared/puzzles.js");

const MIN_GAP_MS = 6000;            // two rated games can't be reported closer together than this
const MIN_RULES = { easy: 2, medium: 3, hard: 4 };
const MAX_PAIR_PER_DAY = 3;         // the same two players only count this many rated quick matches a day
const STALE_MS = 20000;             // a queue entry that has not checked in for this long is ignored

class Refused extends Error { constructor(code, message) { super(message); this.code = code; } }
const int = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;

// ---------- checking what the client claims ----------
// A solo win must come with the task (rule keys and params) and the code. The server rebuilds the task and runs the
// same parser and rule checks as the browser, so "I solved it" is proven, not claimed. Time and bites are still
// self-reported, but time has a floor based on how much was typed, and ratings can't move faster than MIN_GAP_MS.
function verifyBug(input) {
  if (!input || typeof input !== "object") throw new Refused("invalid-argument", "bad request");
  const diff = input.diff;
  if (Rating.DIFFS.indexOf(diff) < 0) throw new Refused("invalid-argument", "bad difficulty");
  if (!int(input.bites, 0, 50)) throw new Refused("invalid-argument", "bad bites");
  const base = Rating.taskRating({ rules: [] }, diff);
  if (input.abandoned === true) {
    // leaving a run is a loss: it can only cost points, so a sane opponent rating is all that is needed
    const opp = Number.isFinite(input.opp) ? Math.max(base - 150, Math.min(base + 220, Math.round(input.opp))) : base;
    return { diff, opp, bites: input.bites, abandoned: true, elapsedMs: 0 };
  }
  let task;
  try { task = TaskEngine.rebuildTask(input.task); } catch (e) { throw new Refused("invalid-argument", "bad task"); }
  if (task.difficulty !== diff || task.rules.length < MIN_RULES[diff]) throw new Refused("invalid-argument", "task does not match difficulty");
  const code = input.code;
  if (typeof code !== "string" || code.length === 0 || code.length > 4000) throw new Refused("invalid-argument", "bad code");
  const ev = task.evaluate(CodeParser.parseProgram(code));
  if (ev.passed !== ev.total) throw new Refused("failed-precondition", "that code does not satisfy the task");
  if (!int(input.elapsedMs, 1500 + code.length * 15, 6 * 3600 * 1000)) throw new Refused("invalid-argument", "implausible time");
  return { diff, opp: Rating.taskRating({ rules: task.rules.map((r) => ({ key: r.key })) }, diff), bites: input.bites, abandoned: false, elapsedMs: input.elapsedMs };
}

function verifyPuzzle(input) {
  if (!input || typeof input !== "object") throw new Refused("invalid-argument", "bad request");
  const { track, level, hints, code } = input;
  if (Puzzles.TRACKS.indexOf(track) < 0 || !int(level, 0, 500) || !int(hints, 0, 20)) throw new Refused("invalid-argument", "bad puzzle");
  if (typeof code !== "string" || code.length === 0 || code.length > 4000) throw new Refused("invalid-argument", "bad code");
  const gen = Puzzles.generate(track, level);
  if (!gen.check(code).ok) throw new Refused("failed-precondition", "that code does not solve the level");
  return { track, level, hints };
}

// ---------- applying a result to a rating document ----------
// A player's document is the flat shape from Rating.toDoc plus server-only fields: lastGameAt, puzDone, race fields.
function gate(doc, nowMs) {
  if (doc && Number.isFinite(doc.lastGameAt) && nowMs - doc.lastGameAt < MIN_GAP_MS) throw new Refused("resource-exhausted", "slow down");
}
function merge(doc, state, ctx, extra) {
  return Object.assign({}, doc || {}, Rating.toDoc(state, { nickname: ctx.nickname, avatar: ctx.avatar, linked: ctx.linked }), extra || {}, { lastGameAt: ctx.nowMs });
}
const stateOf = (doc) => (doc ? Rating.fromDoc(doc) : Rating.blank());

function runBug(doc, input, ctx) {
  const v = verifyBug(input);
  gate(doc, ctx.nowMs);
  const winStreak = int(input.winStreak, 0, 100000) ? input.winStreak : 0;
  const r = Rating.applyBug(stateOf(doc), { diff: v.diff, opp: v.opp, bites: v.bites, abandoned: v.abandoned, elapsedMs: v.elapsedMs, winStreak, day: ctx.day });
  return { doc: merge(doc, r.state, ctx), change: r.change };
}

// only the first clear of a level is rated, and only the next few levels: nobody can jump to level 90 for a big gain.
// A player who has never been rated here gets one free pass up to level 80, to cover progress made before ratings existed.
function runPuzzle(doc, input, ctx) {
  const v = verifyPuzzle(input);
  const done = doc && doc.puzDone && Number.isInteger(doc.puzDone[v.track]) ? doc.puzDone[v.track] : null;
  const ok = done === null ? v.level <= 80 : (v.level >= done && v.level <= done + 5);
  if (!ok) return { doc: doc || null, change: null };
  gate(doc, ctx.nowMs);
  const r = Rating.applyPuzzle(stateOf(doc), { level: v.level, hints: v.hints, wrongRuns: 0, day: ctx.day });
  const puzDone = Object.assign({}, doc && doc.puzDone, { [v.track]: v.level + 1 });
  return { doc: merge(doc, r.state, ctx, { puzDone }), change: r.change };
}

// ---------- quick match ----------
const waitWindow = (ms) => Math.min(600, 100 + Math.floor(Math.max(0, ms) / 1000) * 25);
// who to pair with: the closest rating inside either player's (growing) window, oldest first on a tie
function findOpponent(me, queue, nowMs, skip) {
  let best = null;
  for (const o of queue) {
    if (!o || o.uid === me.uid || o.room || o.difficulty !== me.difficulty) continue;
    if (nowMs - o.seen > STALE_MS) continue;
    if (skip && skip(o)) continue;
    const gap = Math.abs(o.rating - me.rating);
    const allowed = Math.max(waitWindow(nowMs - me.at), waitWindow(nowMs - o.at));
    if (gap > allowed) continue;
    if (!best || gap < best.gap || (gap === best.gap && o.at < best.o.at)) best = { o, gap };
  }
  return best && best.o;
}
const pairKey = (a, b, day) => `${day}_${[a, b].sort().join("_")}`;

// result of one rated quick match: a map uid -> { doc, change }. docs: uid -> rating doc (or null)
function rateRace({ docs, winnerUid, pairCount, ctx }) {
  const uids = Object.keys(docs);
  if (uids.length !== 2 || uids.indexOf(winnerUid) < 0) throw new Refused("failed-precondition", "needs two players and a winner");
  const repeat = pairCount >= MAX_PAIR_PER_DAY;
  const st = {};
  uids.forEach((u) => { st[u] = stateOf(docs[u]); });
  const out = {};
  uids.forEach((u) => {
    const other = uids.find((x) => x !== u);
    const r = Rating.applyRace(st[u], { opp: st[other].race.r, score: u === winnerUid ? 1 : 0, day: ctx.day, repeat });
    const meta = ctx.players[u] || {};
    out[u] = { doc: merge(docs[u], r.state, { nickname: meta.nickname || (docs[u] && docs[u].nickname) || "player", avatar: meta.avatar || (docs[u] && docs[u].avatar) || "bug", linked: true, nowMs: ctx.nowMs }), change: r.change };
  });
  return out;
}

// first rating document for a player: starts at 1000 but keeps the wins and best times from their old score entries
// (read by the server itself from the append-only scores collection, so none of it is taken on trust)
function seedDoc(scores, ctx) {
  const st = Rating.blank();
  for (const sc of scores || []) {
    if (Rating.DIFFS.indexOf(sc.difficulty) < 0) continue;
    st.wins[sc.difficulty] = Math.min(500, st.wins[sc.difficulty] + 1);
    if (Number.isFinite(sc.elapsedMs) && sc.elapsedMs > 1200 && !(st.best[sc.difficulty] <= sc.elapsedMs)) st.best[sc.difficulty] = Math.round(sc.elapsedMs);
  }
  st.day = ctx.day;
  return Rating.toDoc(st, { nickname: ctx.nickname, avatar: ctx.avatar, linked: ctx.linked });
}

module.exports = { seedDoc, Refused, MIN_GAP_MS, MAX_PAIR_PER_DAY, STALE_MS, verifyBug, verifyPuzzle, runBug, runPuzzle, waitWindow, findOpponent, pairKey, rateRace };
