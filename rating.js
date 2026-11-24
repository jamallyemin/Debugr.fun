// Ratings: Elo for the solo bug game and for the puzzle path.
//
// Part 1 is pure maths (works in node, covered by tests/rating.test.js).
// Part 2 (Ratings) keeps the player's state, mirrors it to Firestore (ratings/{uid}) and tells the UI.
//
// What gets rated, and how:
//  - bug game, solo only (not daily, rooms or tutorial): the opponent is the task's rating, which comes from its
//    difficulty and rule count. The bug can't "kill" you, so the loss signal is bites: score = 1 - 0.175 per bite
//    (5.7+ bites counts as a full loss). Leaving a run after the bug has woken up counts as a loss too.
//  - puzzle path: only the FIRST clear of a level is rated, against the level's fixed rating. Hints and wrong runs
//    lower the score, they never go below 0.3 (you did solve it). (Wrong runs aren't counted: the puzzle checks
//    itself while you type, so a "wrong run" would just be every pause between keystrokes.)
// Fairness: ratings only come from your own solo play, so there is nobody to trade wins with. firestore.rules caps
// every write (one game at a time, +-70 rating), and a daily gain cap stops grinding the board in one sitting.
(function (root) {
  "use strict";

  const START = 1000, PLACEMENT = 10, DAILY_CAP = 150, MAX_STEP = 70, FLOOR = 100, CEIL = 4000;
  const TIERS = [
    { name: "LARVA", min: 0, color: "#8a948a" },
    { name: "GRUB", min: 800, color: "#4daa6e" },
    { name: "BEETLE", min: 1100, color: "#5ec2e8" },
    { name: "MANTIS", min: 1400, color: "#9b8cff" },
    { name: "HORNET", min: 1700, color: "#cd9d3c" },
    { name: "APEX", min: 2000, color: "#ec6a5e" },
  ];
  const DIFFS = ["easy", "medium", "hard"];
  const TWIST_KEYS = ["forbidName", "exactVars", "firstLine"];

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const tierIndex = (r) => { let t = 0; TIERS.forEach((x, i) => { if (r >= x.min) t = i; }); return t; };
  const tierFor = (r) => TIERS[tierIndex(r)];
  function tierProgress(r) {
    const i = tierIndex(r), cur = TIERS[i], next = TIERS[i + 1] || null;
    return { tier: cur, next, pct: next ? clamp((r - cur.min) / (next.min - cur.min), 0, 1) : 1, toNext: next ? next.min - r : 0 };
  }

  const expected = (r, opp) => 1 / (1 + Math.pow(10, (opp - r) / 400));
  const kFor = (games) => (games < PLACEMENT ? 64 : 32);

  // the whole rating step. positive changes can be cut short by the daily cap (gainLeft)
  function step(rating, games, opp, score, gainLeft) {
    const e = expected(rating, opp), k = kFor(games);
    let delta = clamp(Math.round(k * (score - e)), -MAX_STEP, MAX_STEP);
    let capped = false;
    if (delta > 0 && gainLeft !== undefined && delta > gainLeft) { delta = Math.max(0, gainLeft); capped = true; }
    const next = clamp(rating + delta, FLOOR, CEIL);
    return { rating: next, delta: next - rating, expected: e, k, capped };
  }

  // ----- what the opponent is worth -----
  function taskRating(task, diff) {
    const base = { easy: 900, medium: 1250, hard: 1600 }[diff] || 1000;
    const rules = (task && task.rules) || [];
    const normal = rules.filter((r) => TWIST_KEYS.indexOf(r.key) < 0).length;
    const twist = rules.length - normal;
    return base + clamp((normal - { easy: 2, medium: 4, hard: 6 }[diff]) * 35, -105, 140) + twist * 50;
  }
  const levelRating = (level) => 800 + 15 * Math.min(Math.max(0, level) + 1, 140);

  // ----- how well you did -----
  const bugScore = (bites, abandoned) => (abandoned ? 0 : Math.round(Math.max(0, 1 - 0.175 * bites) * 1000) / 1000);
  const puzzleScore = (hints, wrongRuns) => Math.round(Math.max(0.3, 1 - 0.15 * hints - 0.04 * wrongRuns) * 1000) / 1000;

  // ----- state -----
  // day is "Y-M-D" (UTC, no zero padding) because firestore.rules builds the same string from request.time
  function dayKey(d) { d = d || new Date(); return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`; }
  function blank() {
    return { v: 1, bug: { r: START, g: 0, peak: START }, puz: { r: START, g: 0, peak: START }, race: { r: START, g: 0, peak: START },
      wins: { easy: 0, medium: 0, hard: 0 }, best: {}, bestStreak: 0, day: dayKey(), dayGain: 0 };
  }
  function clean(s) {
    const b = blank();
    if (!s || typeof s !== "object") return b;
    const num = (x, d) => (Number.isFinite(x) ? x : d);
    const kind = (k) => ({ r: num(k && k.r, START), g: Math.max(0, num(k && k.g, 0) | 0), peak: num(k && k.peak, START) });
    const out = { v: 1, bug: kind(s.bug), puz: kind(s.puz), race: kind(s.race), wins: {}, best: {}, bestStreak: Math.max(0, num(s.bestStreak, 0) | 0),
      day: typeof s.day === "string" ? s.day : b.day, dayGain: Math.max(0, num(s.dayGain, 0)) };
    DIFFS.forEach((d) => {
      out.wins[d] = Math.max(0, num(s.wins && s.wins[d], 0) | 0);
      if (s.best && Number.isFinite(s.best[d])) out.best[d] = s.best[d];
    });
    return out;
  }
  const gainLeft = (s, day) => Math.max(0, DAILY_CAP - (s.day === day ? s.dayGain : 0));
  function rollDay(s, day) { if (s.day !== day) { s.day = day; s.dayGain = 0; } }

  function result(kind, before, after, st, score, opp, tierUp) {
    return { kind, before, after, delta: after - before, expected: st.expected, score, opp, k: st.k, capped: st.capped, tierUp };
  }

  // one solo bug-game result. returns { state, change }
  function applyBug(state, { diff, task, opp: oppIn, bites, abandoned, elapsedMs, winStreak, day }) {
    const s = clean(JSON.parse(JSON.stringify(state)));
    day = day || dayKey();
    rollDay(s, day);
    const opp = Number.isFinite(oppIn) ? oppIn : taskRating(task, diff), score = bugScore(bites || 0, !!abandoned);
    const st = step(s.bug.r, s.bug.g, opp, score, gainLeft(s, day));
    const before = s.bug.r, tierUp = tierIndex(st.rating) > tierIndex(before) ? tierFor(st.rating).name : null;
    s.bug.r = st.rating; s.bug.g += 1; s.bug.peak = Math.max(s.bug.peak, st.rating);
    if (st.delta > 0) s.dayGain += st.delta;
    if (!abandoned && DIFFS.indexOf(diff) >= 0) {
      s.wins[diff] += 1;
      if (Number.isFinite(elapsedMs) && elapsedMs > 1200 && !(s.best[diff] <= elapsedMs)) s.best[diff] = Math.round(elapsedMs);
    }
    if (Number.isFinite(winStreak) && winStreak > s.bestStreak) s.bestStreak = Math.min(winStreak, s.bestStreak + 1);
    return { state: s, change: result("bug", before, st.rating, st, score, opp, tierUp) };
  }

  // first clear of a puzzle level
  function applyPuzzle(state, { level, hints, wrongRuns, day }) {
    const s = clean(JSON.parse(JSON.stringify(state)));
    day = day || dayKey();
    rollDay(s, day);
    const opp = levelRating(level), score = puzzleScore(hints || 0, wrongRuns || 0);
    const st = step(s.puz.r, s.puz.g, opp, score, gainLeft(s, day));
    const before = s.puz.r, tierUp = tierIndex(st.rating) > tierIndex(before) ? tierFor(st.rating).name : null;
    s.puz.r = st.rating; s.puz.g += 1; s.puz.peak = Math.max(s.puz.peak, st.rating);
    if (st.delta > 0) s.dayGain += st.delta;
    return { state: s, change: result("puzzle", before, st.rating, st, score, opp, tierUp) };
  }

  // one rated quick-match result (server side). score is 1 for a win, 0 for a loss, against the other player's rating.
  function applyRace(state, { opp, score, day, repeat }) {
    const s = clean(JSON.parse(JSON.stringify(state)));
    day = day || dayKey();
    rollDay(s, day);
    // meeting the same opponent again and again in one day stops counting (nobody can farm a friend)
    const st = repeat ? { rating: s.race.r, delta: 0, expected: expected(s.race.r, opp), k: kFor(s.race.g), capped: false } : step(s.race.r, s.race.g, opp, score, gainLeft(s, day));
    const before = s.race.r, tierUp = tierIndex(st.rating) > tierIndex(before) ? tierFor(st.rating).name : null;
    s.race.r = st.rating; if (!repeat) s.race.g += 1; s.race.peak = Math.max(s.race.peak, st.rating);
    if (st.delta > 0) s.dayGain += st.delta;
    const c = result("race", before, st.rating, st, score, opp, tierUp);
    c.repeat = !!repeat;
    return { state: s, change: c };
  }

  // rated players show up on the board after their placement games
  const placed = (kindState) => kindState.g >= PLACEMENT;

  // flat shape stored in Firestore (ratings/{uid}); the board* fields only exist for linked, placed players
  function toDoc(s, { nickname, avatar, linked }) {
    const d = { nickname, avatar, bugRating: s.bug.r, bugGames: s.bug.g, bugPeak: s.bug.peak,
      puzRating: s.puz.r, puzGames: s.puz.g, puzPeak: s.puz.peak, bestStreak: s.bestStreak, day: s.day, dayGain: s.dayGain };
    DIFFS.forEach((x) => { d["wins_" + x] = s.wins[x]; if (s.best[x] !== undefined) d["best_" + x] = s.best[x]; });
    if (linked && placed(s.bug)) d.boardBug = s.bug.r;
    if (linked && placed(s.puz)) d.boardPuz = s.puz.r;
    // race fields only exist once a quick match was played (only the Cloud Function writes them)
    if (s.race.g > 0) { d.raceRating = s.race.r; d.raceGames = s.race.g; d.racePeak = s.race.peak; if (linked && placed(s.race)) d.boardRace = s.race.r; }
    return d;
  }
  function fromDoc(d) {
    if (!d) return null;
    const s = { v: 1, bug: { r: d.bugRating, g: d.bugGames, peak: d.bugPeak }, puz: { r: d.puzRating, g: d.puzGames, peak: d.puzPeak },
      race: { r: d.raceRating, g: d.raceGames, peak: d.racePeak },
      wins: { easy: d.wins_easy, medium: d.wins_medium, hard: d.wins_hard }, best: {}, bestStreak: d.bestStreak, day: d.day, dayGain: d.dayGain };
    DIFFS.forEach((x) => { if (Number.isFinite(d["best_" + x])) s.best[x] = d["best_" + x]; });
    return clean(s);
  }

  const api = { START, PLACEMENT, DAILY_CAP, MAX_STEP, TIERS, DIFFS, tierFor, tierIndex, tierProgress, expected, kFor, step,
    taskRating, levelRating, bugScore, puzzleScore, dayKey, blank, clean, applyBug, applyPuzzle, applyRace, placed, toDoc, fromDoc };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Rating = api;

  if (typeof document === "undefined") return;

  // ---------- browser side: state, cloud mirror, events ----------
  const Ratings = (() => {
    const KEY = "debugr_rating";
    let state = blank(), cloudOk = false, linkedToken = false;

    function load() {
      try { const raw = localStorage.getItem(KEY); if (raw) state = clean(JSON.parse(raw)); } catch { }
    }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { } }
    const fire = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

    const fc = () => (typeof FirebaseClient !== "undefined" ? FirebaseClient : null);
    const who = () => ({ nickname: PlayerState.getNickname(), avatar: PlayerState.getAvatar(), linked: !!(fc() && fc().isLinked()) });

    // the cloud copy wins whenever it can be read, so a second device or a cleared browser picks up where you were
    async function sync() {
      const F = fc();
      if (!F || !F.getUid() || !who().nickname) return;
      try {
        if (F.useFunctions()) {
          // server mode: the Cloud Function creates the document (carrying over old wins and best times) and returns it
          const r = await F.callFn("ensureRating");
          if (r && r.doc) { state = fromDoc(r.doc) || state; cloudOk = true; save(); fire("debugr:rating", { state }); }
          return;
        }
        const doc = await F.fetchRating();
        if (doc) { state = fromDoc(doc) || state; cloudOk = true; }
        else {
          // first time: start at 1000 but keep the wins and best times you already earned
          const seed = await F.seedFromScores();
          state = blank();
          DIFFS.forEach((d) => { state.wins[d] = seed.wins[d] || 0; if (seed.best[d]) state.best[d] = seed.best[d]; });
          state.bestStreak = Math.max(0, (PlayerState.getStreakCache() || {}).win | 0);
          await push();
          cloudOk = true;
        }
        save(); fire("debugr:rating", { state });
      } catch (err) { console.warn("rating sync failed", err); }
    }
    async function push() {
      const F = fc();
      if (!F || !F.getUid()) return;
      const w = who();
      if (!w.nickname) return;
      await F.pushRating(toDoc(state, w), w.linked);
    }
    // server mode: the Cloud Function checks the run (it re-runs the rules on your code) and does the maths.
    // Only when the server cannot be reached at all do we keep the result locally; a refusal changes nothing.
    async function serverRecord(kind, info, local) {
      const F = fc();
      const payload = kind === "bug"
        ? { kind, diff: info.diff, opp: info.opp, bites: info.bites | 0, abandoned: !!info.abandoned, task: info.task, code: info.code, elapsedMs: Math.round(info.elapsedMs || 0), winStreak: info.winStreak | 0 }
        : { kind, track: info.track, level: info.level, hints: info.hints | 0, code: info.code };
      try {
        const res = await F.callFn("submitSolo", payload);
        if (res && res.doc) { state = fromDoc(res.doc) || state; save(); }
        fire("debugr:rating", { state, change: res && res.change });
        return res && res.change;
      } catch (err) {
        console.warn("rating call failed", err && err.code, err && err.message);
        if (err && (err.code === "functions/unavailable" || err.code === "functions/deadline-exceeded")) { state = local.state; save(); fire("debugr:rating", { state, change: local.change }); return local.change; }
        await sync();
        return null;
      }
    }
    async function commit(next, change) {
      state = next; save();
      fire("debugr:rating", { state, change });
      try { await push(); }
      catch (err) { console.warn("rating push refused, re-syncing", err); await sync(); }
    }

    // A run is "pending" from the moment the bug wakes until you win. If you leave (menu, reload, closed tab) it counts
    // as a loss, otherwise quitting would be a free way to dodge a bad game.
    const PKEY = "debugr_rating_pending";
    const readPending = () => { try { return JSON.parse(localStorage.getItem(PKEY)); } catch { return null; } };
    return {
      load, sync,
      get: () => state,
      tier: (kind) => tierFor((kind === "puz" ? state.puz : state.bug).r),
      placement: (kind) => Math.max(0, PLACEMENT - (kind === "puz" ? state.puz : state.bug).g),
      async recordBug(info) { const r = applyBug(state, info); if (fc() && fc().useFunctions()) return serverRecord("bug", info, r); await commit(r.state, r.change); return r.change; },
      async recordPuzzle(info) { const r = applyPuzzle(state, info); if (fc() && fc().useFunctions()) return serverRecord("puzzle", info, r); await commit(r.state, r.change); return r.change; },
      // preview without committing (the result screen shows the number straight away)
      previewBug: (info) => applyBug(state, info).change,
      markPending(diff, opp) { try { localStorage.setItem(PKEY, JSON.stringify({ diff, opp, at: Date.now() })); } catch { } },
      clearPending() { try { localStorage.removeItem(PKEY); } catch { } },
      async resolvePending() {
        const p = readPending();
        try { localStorage.removeItem(PKEY); } catch { }
        if (!p || !Number.isFinite(p.opp) || DIFFS.indexOf(p.diff) < 0 || Date.now() - p.at > 6 * 3600 * 1000) return null;
        return this.recordBug({ diff: p.diff, opp: p.opp, bites: 0, abandoned: true });
      },
    };
  })();
  Ratings.load();
  root.Ratings = Ratings;
})(typeof window !== "undefined" ? window : globalThis);
