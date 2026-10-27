(function (root) {
    "use strict";

    const PyEval = root.PyEval || (typeof require === "function" ? require("./pyeval.js") : null);

    const TRACKS = ["syntax", "complete", "typefix"];
    const TRACK_INFO = {
        syntax: { name: "SYNTAX", sub: "fix broken code" },
        complete: { name: "COMPLETE", sub: "fill the blanks" },
        typefix: { name: "TYPEFIX", sub: "fix type errors" },
    };

    // seeeding
    function hashSeed(str) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h;
    }
    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function makeRng(seed) {
        const f = mulberry32(hashSeed(seed))
        return {
            int(min, max) { return Math.floor(f() * (max - min + 1)) + min; },
            pick(arr) { return arr[Math.floor(f() * arr.length)]; },
            chance(p) { return f() < p; },
            sample(arr, n) {
                const pool = arr.slice();
                const out = [];
                while (out.length < n && pool.length) out.push(pool.splice(Math.floor(f() * pool.length), 1)[0]);
                return out;
            },
        };
    }

    // names
    const WORDS = ["debug", "python", "script", "kernel", "packet", "syntax", "cursor", "binary", "loop", "array", "token", "stack", "queue", "logic", "pixel", "cache", "vector", "signal", "buffer", "thread"];
    const NAME_POOLS = {
        num: ["score", "price", "width", "height", "speed", "coins", "lives", "limit", "age", "size", "level", "damage"],
        str: ["name", "word", "title", "msg", "label", "city", "tag", "user"],
        nlist: ["nums", "scores", "ages", "values", "prices"],
        wlist: ["items", "words", "names", "tags", "labels"],
    };
    function makeNamer(rng) {
        const used = new Set();
        function take(pool) {
            const free = pool.filter((n) => !used.has(n));
            const n = free.length ? rng.pick(free) : rng.pick(pool) + (used.size + 1);
            used.add(n);
            return n;
        }
        return {
            num: () => take(NAME_POOLS.num), str: () => take(NAME_POOLS.str),
            nlist: () => take(NAME_POOLS.nlist), wlist: () => take(NAME_POOLS.wlist),
        };
    }
    const q = (s) => `"${s}"`;
    const strList = (arr) => `[${arr.map(q).join(", ")}]`;
    const numList = (arr) => `[${arr.join(", ")}]`;
    function distinctInts(rng, count, min, max) {
        const set = new Set();
        while (set.size < count) set.add(rng.int(min, max));
        return [...set];
    }

    function tierFor(level) { return Math.min(3, Math.floor(level / 4)); }
    function pickTpl(rng, pool, tier) {
        const top = pool.filter((t) => t.tier >= tier - 1);
        return rng.pick(rng.chance(0.6) && top.length ? top : pool);
    }

// syntax

  const SYNTAX = [
    { tier: 0, make: (r, nm) => { const s = nm.str(); return [`${s} = ${q(r.pick(WORDS))}`, `print(${s})`]; } },
    { tier: 0, make: (r, nm) => { const a = nm.num(), b = nm.num(); return [`${a} = ${r.int(2, 40)}`, `${b} = ${r.int(2, 40)}`, `print(${a} + ${b})`]; } },
    { tier: 0, make: (r, nm) => { const l = nm.wlist(); return [`${l} = ${strList(r.sample(WORDS, r.int(3, 5)))}`, `print(len(${l}))`]; } },
    { tier: 0, make: (r, nm) => { const s = nm.str(); return [`${s} = ${q(r.pick(WORDS))}`, `print(${s}.upper())`]; } },
    { tier: 1, make: (r, nm) => {
      const x = nm.num(), k = r.int(5, 20);
      const n = r.chance(0.5) ? k + r.int(1, 15) : k - r.int(1, 4);
      return [`${x} = ${n}`, `if ${x} > ${k}:`, `    print("big")`, `else:`, `    print("small")`];
    } },
    { tier: 1, make: (r) => [`for i in range(${r.int(3, 6)}):`, `    print(i)`] },
    { tier: 1, make: (r, nm) => { const x = nm.num(); return [`${x} = ${r.int(1, 30)}`, `if ${x} % 2 == 0:`, `    print("even")`, `else:`, `    print("odd")`]; } },
    { tier: 2, make: (r, nm) => {
      const l = nm.nlist();
      return [`${l} = ${numList(distinctInts(r, r.int(3, 5), 1, 20))}`, `total = 0`, `for n in ${l}:`, `    total += n`, `print(total)`];
    } },
    { tier: 2, make: (r, nm) => {
      const l = nm.nlist();
      return [`${l} = ${numList(distinctInts(r, r.int(4, 6), 1, 12))}`, `big = 0`, `for n in ${l}:`, `    if n > 5:`, `        big += 1`, `print(big)`];
    } },
  ];
 
  const SYNTAX_HINTS = {
    quote: "A string is missing its closing quote.",
    paren: "A parenthesis is never closed.",
    bracket: "A list bracket is never closed.",
    colon: "Look at the end of the if / else / for lines. Something is missing.",
    indent: "The line after a colon must be indented.",
    assign: "A line is missing the = between the name and its value.",
    printname: "Check how print is spelled.",
    eqcond: "An if condition uses = where it should compare with ==.",
  };
 
  function findSites(lines) {
    const sites = [];
    lines.forEach((ln, i) => {
      if (/print\(/.test(ln)) { sites.push({ i, kind: "paren" }, { i, kind: "printname" }); }
      if ((ln.match(/"/g) || []).length >= 2) sites.push({ i, kind: "quote" });
      if (ln.includes("[") && ln.includes("]")) sites.push({ i, kind: "bracket" });
      if (ln.endsWith(":")) sites.push({ i, kind: "colon" });
      if (i > 0 && lines[i - 1].endsWith(":") && ln.startsWith("    ")) sites.push({ i, kind: "indent" });
      if (/^\w+ = -?\d+(\.\d+)?$/.test(ln)) sites.push({ i, kind: "assign" });
      if (/^if .*==/.test(ln)) sites.push({ i, kind: "eqcond" });
    });
    return sites;
  }


  function applyBreak(lines, site) {
    const out = lines.slice();
    let ln = out[site.i];
    const dropLast = (s, ch) => {const k = s.lastIndexOf(ch); return s.slice(0, k) + s.slice(k + 1); };
    switch (site.kind) {
        case "paren": ln = dropLast(ln, ")"); break;
        case "printname": ln = ln.replace("print(", "prnt("); break;
        case "quote": ln = dropLast(ln, '"'); break;
        case "bracket": ln = dropLast(ln, "]"); break;
        case "colon": ln = ln.slice(0, -1); break;
        case "indent": ln = ln.slice(4); break;
        case "assign": ln = ln.replace(" = ", " "); break;
        case "eqcond": ln = ln.replace("==", "="); break;
    }
    out[site.i] = ln;
    return out;
  }

  function buildSyntax(rng, nm, tier) {
    const tpl = pickTpl(rng, SYNTAX.filter((t) => t.tier <= tier), tier);
    const lines = tpl.make(rng, nm);
    const byLine = new Map();
    for (const s of findSites(lines)) {
        if (!byLine.has(s.i)) byLine.set(s.i, []);
        byLine.get(s.i).push(s);
    }
    const bugCount = tier >= 3 ? 2 : 1;
    const chosen = rng.sample([...byLine.keys()], Math.min(bugCount, byLine.size));
    let broken = lines;
    const hints = [];
    for (const li of chosen) {
        const site = rng.pick(byLine.get(li));
        broken = applyBreak(broken, site);
        hints.push(SYNTAX_HINTS[site.kind]);
    }
    return {solution: lines.join("\n"), start: broken.join("\n"), hints, bugs: chosen.length};
  }

  // complete: fill every ___ so the output matches
  const COMPLETE = [
    { tier: 0, make: (r, nm) => {
      const x = nm.num(), n = r.int(2, 15);
      return { code: [`${x} = ___`, `print(${x} * 2)`], sol: [`${x} = ${n}`, `print(${x} * 2)`], hint: "The blank is a number. Work backwards from the expected output." };
    } },
    { tier: 0, make: (r) => {
      const k = r.int(3, 6);
      return { code: [`for i in range(___):`, `    print(i)`], sol: [`for i in range(${k}):`, `    print(i)`], hint: "range(n) counts from 0 up to n - 1. Count the lines of output." };
    } },
    { tier: 0, make: (r, nm) => {
      const s = nm.str(), w = r.pick(WORDS), m = r.pick(["upper", "lower"]);
      const given = m === "upper" ? w : w.toUpperCase();
      return { code: [`${s} = ${q(given)}`, `print(${s}.___())`], sol: [`${s} = ${q(given)}`, `print(${s}.${m}())`], hint: "A string method changes the case: upper or lower." };
    } },
    { tier: 1, make: (r, nm) => {
      const l = nm.wlist(), words = r.sample(WORDS, r.int(2, 3)), w = r.pick(WORDS);
      return { code: [`${l} = ${strList(words)}`, `${l}.___(${q(w)})`, `print(len(${l}))`], sol: [`${l} = ${strList(words)}`, `${l}.append(${q(w)})`, `print(len(${l}))`], hint: "Which list method adds an item to the end?" };
    } },
    { tier: 1, make: (r, nm) => {
      const x = nm.num(), k = r.int(10, 20), big = r.chance(0.5);
      const n = big ? k + r.int(1, 8) : k - r.int(1, 8);
      const mk = (op) => [`${x} = ${n}`, `if ${x} ${op} ${k}:`, `    print("yes")`, `else:`, `    print("no")`];
      return { code: mk("___"), sol: mk(big ? ">" : "<"), hint: `Compare ${x} with ${k}. Is it bigger or smaller? Check the expected output.` };
    } },
    { tier: 1, make: (r, nm) => {
      const l = nm.nlist(), nums = numList(distinctInts(r, r.int(3, 5), 1, 20));
      const mk = (op) => [`${l} = ${nums}`, `total = 0`, `for n in ${l}:`, `    total ${op} n`, `print(total)`];
      return { code: mk("___"), sol: mk("+="), hint: "Add each n to total. Which operator updates a variable in place?" };
    } },
    { tier: 2, make: (r, nm) => {
      const l = nm.nlist(), nums = numList(distinctInts(r, r.int(4, 6), 1, 40));
      const mk = (op) => [`${l} = ${nums}`, `print(max(${l}) ${op} min(${l}))`];
      return { code: mk("___"), sol: mk("-"), hint: "The gap between the biggest and the smallest value." };
    } },
    { tier: 2, make: (r, nm) => {
      const l = nm.nlist(), nums = numList(distinctInts(r, r.int(5, 7), 1, 12)), k = r.int(4, 8), op = r.pick([">", "<"]);
      const mk = (o) => [`${l} = ${nums}`, `count = 0`, `for n in ${l}:`, `    if n ${o} ${k}:`, `        count += 1`, `print(count)`];
      return { code: mk("___"), sol: mk(op), hint: `The program counts numbers that are bigger or smaller than ${k}. Try both and compare with the expected output.` };
    } },
    { tier: 2, make: (r, nm) => {
      const a = nm.num(), b = nm.num(), x = r.int(2, 20), y = r.int(2, 20);
      return { code: [`${a} = ___`, `${b} = ___`, `print(${a} + ${b})`], sol: [`${a} = ${x}`, `${b} = ${y}`, `print(${a} + ${b})`], hint: "Any two numbers that add up to the expected output will do." };
    } },
  ];

  function buildComplete(rng, nm, tier) {
    const tpl = pickTpl(rng, COMPLETE.filter((t) => t.tier <= tier), tier);
    const m = tpl.make(rng, nm);
    return {
      solution: m.sol.join("\n"), start: m.code.join("\n"), hints: [m.hint],
      prompt: "Replace every ___ so the program prints the expected output.",
      needsFilled: true,
    };
  }

  // typefix: program crashes on a type error
  const TYPEFIX = [
    { tier: 0, make: (r, nm) => {
      const x = nm.num(), n = r.int(5, 60);
      return { start: [`${x} = ${n}`, `print("${x}: " + ${x})`], sol: [`${x} = ${n}`, `print("${x}: " + str(${x}))`], hint: "You can only join text to text. Convert the number with str()." };
    } },
    { tier: 0, make: (r) => {
      const a = r.int(2, 30), b = r.int(2, 30);
      return { start: [`a = "${a}"`, `b = ${b}`, `print(a + b)`], sol: [`a = "${a}"`, `b = ${b}`, `print(int(a) + b)`], hint: "a is text, b is a number. Convert a with int()." };
    } },
    { tier: 0, make: (r) => {
      const k = r.int(3, 6);
      return { start: [`count = "${k}"`, `for i in range(count):`, `    print(i)`], sol: [`count = "${k}"`, `for i in range(int(count)):`, `    print(i)`], hint: "range() needs a whole number, not text." };
    } },
    { tier: 1, make: (r) => {
      const n = r.int(100, 99999);
      return { start: [`n = ${n}`, `print(len(n))`], sol: [`n = ${n}`, `print(len(str(n)))`], hint: "len() works on text and lists, not on numbers. Convert first." };
    } },
    { tier: 1, make: (r) => {
      const v = distinctInts(r, 3, 1, 30);
      return { start: [`nums = [${v[0]}, ${v[1]}, "${v[2]}"]`, `print(sum(nums))`], sol: [`nums = [${v[0]}, ${v[1]}, ${v[2]}]`, `print(sum(nums))`], hint: "One item in the list is text. Make it a number." };
    } },
    { tier: 2, make: (r, nm) => {
      const l = nm.nlist(), nums = numList(distinctInts(r, r.int(3, 5), 1, 20));
      return { start: [`${l} = ${nums}`, `total = "0"`, `for n in ${l}:`, `    total += n`, `print(total)`], sol: [`${l} = ${nums}`, `total = 0`, `for n in ${l}:`, `    total += n`, `print(total)`], hint: "total starts out as text. It should start as a number." };
    } },
    { tier: 2, make: (r) => {
      const v = r.sample([10, 12, 15, 21, 27, 34, 42, 56, 63, 78, 85, 91], 3);
      return { start: [`ages = ${strList(v)}`, `print(max(ages) + 1)`], sol: [`ages = ${strList(v)}`, `print(int(max(ages)) + 1)`], hint: "max() works on the text values, but its result is still text. Convert it before adding." };
    } },
    { tier: 3, make: (r) => {
      const a = r.int(2, 12), b = r.int(2, 12);
      return { start: [`x = "${a}"`, `y = "${b}"`, `print(x * y)`], sol: [`x = "${a}"`, `y = "${b}"`, `print(int(x) * int(y))`], hint: "Both values are text. Convert both with int() before multiplying." };
    } },
  ];

  function buildTypefix(rng, nm, tier) {
    const tpl = pickTpl(rng, TYPEFIX.filter((t) => t.tier <= tier), tier);
    const m = tpl.make(rng, nm);
    return {
      solution: m.sol.join("\n"), start: m.start.join("\n"), hints: [m.hint],
      prompt: "This program crashes with a type error. Fix it so it prints the expected output.",
    };
  }

  // checking what the player wrote
  function sameOutput(a, b) { return a.length === b.length && a.every((l, i) => l === b[i]); }

  function judge(code, expected, needsFilled) {
    if (needsFilled && /___/.test(code)) {
      return { ok: false, output: [], error: "There is still a ___ blank to fill in." };
    }
    const res = PyEval.run(code);
    if (!res.ok) return { ok: false, output: res.output, error: PyEval.formatError(res.error) };
    return { ok: sameOutput(res.output, expected), output: res.output, error: null };
  }

  const BUILDERS = { syntax: buildSyntax, complete: buildComplete, typefix: buildTypefix };

  function generate(track, level) {
    if (!BUILDERS[track]) track = "syntax";
    level = Math.max(0, level | 0);
    const rng = makeRng(`${track}:${level}`);
    const tier = tierFor(level);
    let built = null, expected = null;
    for (let tries = 0; tries < 40; tries++) {
      const b = BUILDERS[track](rng, makeNamer(rng), tier);
      const sol = PyEval.run(b.solution);
      if (!sol.ok || !sol.output.length) continue;
      built = b; expected = sol.output;
      if (!judge(b.start, expected, b.needsFilled).ok) break; // the start code really is broken
    }
    return {
      track, level, tier, expected,
      prompt: built.prompt || (built.bugs > 1 ? "This program has 2 bugs that stop it from running. Fix them so it prints the expected output." : "This program has a bug that stops it from running. Fix it so it prints the expected output."), start: built.start, solution: built.solution, hints: built.hints,
      check: (code) => judge(code, expected, built.needsFilled),
    };
  }

  const api = { TRACKS, TRACK_INFO, generate, tierFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Puzzles = api;

  // browser ui (path + level screen), skipped in node
  if (typeof document === "undefined") return;

  const PuzzleUI = (() => {
    const $ = (id) => document.getElementById(id);
    const KEY_TRACK = "debugr_puzzle_track";
    let track = "syntax";
    try { const t = localStorage.getItem(KEY_TRACK); if (TRACKS.includes(t)) track = t; } catch {}
    let period = "daily";
    let cur = null, shownHints = 0, runTimer = null, topCache = {};

    const editor = $("debug-editor");
    const nums = $("puzzles-line-numbers");

    function sfx(name) { if (typeof Sound !== "undefined") Sound.play(name); }

    // path screen
    function paintMeta() {
      const streak = PlayerState.currentPuzzleStreak();
      $("puzzle-meta").innerHTML = `
        <div class="pm-streak ${streak >= 3 ? "hot" : ""}"><span class="flame">▲</span><b>${streak}</b>PUZZLE STREAK</div>
        <div class="pm-top">
          <div class="pm-top-head"><span>TOP SOLVERS</span>
            <span class="pm-toggle">
              <button class="pm-tab ${period === "daily" ? "active" : ""}" data-period="daily">TODAY</button>
              <button class="pm-tab ${period === "weekly" ? "active" : ""}" data-period="weekly">WEEK</button>
            </span>
          </div>
          <ul class="pm-top-list" id="pm-top-list"><li class="pm-empty">loading...</li></ul>
        </div>`;
      paintTop();
    }
    async function paintTop() {
      const list = $("pm-top-list");
      if (!list) return;
      const key = period;
      let rows = null;
      const hit = topCache[key];
      if (hit && Date.now() - hit.at < 30000) rows = hit.rows;
      else {
        try { rows = await FirebaseClient.fetchPuzzleTop(period); topCache[key] = { at: Date.now(), rows }; }
        catch { rows = null; }
      }
      if (period !== key || !$("pm-top-list")) return;
      if (!rows) { $("pm-top-list").innerHTML = `<li class="pm-empty">couldn't load rankings</li>`; return; }
      if (!rows.length) { $("pm-top-list").innerHTML = `<li class="pm-empty">nobody yet. be the first</li>`; return; }
      $("pm-top-list").innerHTML = rows.slice(0, 5).map((r, i) =>
        `<li><span class="pm-rank r${i + 1}">${i + 1}</span><span class="pm-name">${typeof Rewards !== "undefined" ? Rewards.pfp(r.avatar) : ""}${esc(r.nickname)}</span><span class="pm-count">${r.solved} solved</span></li>`).join("");
    }

    function paintTabs() {
      const progress = PuzzleState.load();
      $("puzzle-tabs").innerHTML = TRACKS.map((t) => `
        <button class="puzzle-tab ${t === track ? "active" : ""}" data-track="${t}">
          <span class="pt-name">${TRACK_INFO[t].name}</span><span class="pt-sub">${TRACK_INFO[t].sub}</span>
          <span class="pt-count">${progress[t] || 0} cleared</span>
        </button>`).join("");
    }

    function paintTrack(flash) {
      const done = PuzzleState.completedCount(track);
      const first = Math.max(0, done - 30);
      let html = `<div class="puzzle-more">LEVELS NEVER RUN OUT</div>`;
      for (let i = done + 2; i >= first; i--) {
        const cls = i < done ? "done" : i === done ? "current" : "locked";
        const extra = flash && i === flash.cleared ? " just-cleared" : flash && i === flash.unlocked ? " just-unlocked" : "";
        const off = Math.round(Math.sin(i * 0.9) * 60);
        html += `<div class="puzzle-row"><div class="puzzle-slot" style="--off:${off}px">
          ${i === done ? `<div class="puzzle-marker">▼</div>` : ""}
          <button class="puzzle-node ${cls}${extra}" data-level="${i}" style="--n:${done + 2 - i}" ${cls === "locked" ? "disabled" : ""} aria-label="Level ${i + 1}"><span>${i + 1}</span></button>
        </div></div>`;
      }
      if (first > 0) html += `<div class="puzzle-more">${first} earlier levels cleared</div>`;
      $("puzzle-tracks").innerHTML = html;
      const curEl = $("puzzle-tracks").querySelector(".puzzle-node.current");
      if (curEl && curEl.scrollIntoView) curEl.scrollIntoView({ block: "center" });
    }

    function renderPath(flash) {
      paintMeta(); paintTabs(); paintTrack(flash);
    }

    $("puzzle-meta").addEventListener("click", (e) => {
      const b = e.target.closest(".pm-tab");
      if (!b) return;
      period = b.dataset.period;
      paintMeta();
    });
    $("puzzle-tabs").addEventListener("click", (e) => {
      const b = e.target.closest(".puzzle-tab");
      if (!b) return;
      track = b.dataset.track;
      try { localStorage.setItem(KEY_TRACK, track); } catch {}
      paintTabs(); paintTrack();
    });
    $("puzzle-tracks").addEventListener("click", (e) => {
      const b = e.target.closest(".puzzle-node:not(:disabled)");
      if (b) open(track, parseInt(b.dataset.level, 10));
    });

    // level screen
    function lineNumbers() {
      const n = editor.value.split("\n").length;
      let out = "";
      for (let i = 1; i <= n; i++) out += (i > 1 ? "\n" : "") + i;
      nums.textContent = out;
    }
    function showConsole(text, isError) {
      $("puzzles-console").innerHTML = `<div class="pc-label">OUTPUT</div><div class="pc-body ${isError ? "error" : ""}">${esc(text)}</div>`;
    }
    function paintHints() {
      const btn = $("puzzles-hint-btn");
      const total = cur ? cur.hints.length : 0;
      btn.textContent = `HINT ${shownHints}/${total}`;
      btn.disabled = !cur || shownHints >= total;
      $("puzzles-rules-list").innerHTML = cur ? cur.hints.slice(0, shownHints).map((h, i) =>
        `<li class="rule-item visible pz-hint"><div class="rule-num">${i + 1}</div><div class="rule-body"><div class="rule-text">${esc(h)}</div></div></li>`).join("") : "";
    }

    function open(t, level) {
      track = t;
      cur = generate(t, level);
      shownHints = 0;
      clearTimeout(runTimer);
      App.showScreen("puzzles");
      $("puzzles-track-label").textContent = TRACK_INFO[t].name;
      $("puzzles-progress").textContent = `LEVEL ${level + 1}`;
      $("puzzles-prompt").textContent = cur.prompt;
      $("puzzles-given").innerHTML = `<div class="pg-label">EXPECTED OUTPUT</div><pre>${esc(cur.expected.join("\n"))}</pre>`;
      editor.value = cur.start;
      lineNumbers();
      showConsole("# your output shows up here as you type", false);
      $("puzzle-solved").classList.add("hidden");
      paintHints();
      editor.focus();
    }

    function runNow() {
      if (!cur) return;
      const code = editor.value;
      if (!code.trim()) return showConsole("# empty", false);
      const res = cur.check(code);
      if (res.error) return showConsole(res.error, true);
      showConsole(res.output.length ? res.output.join("\n") : "(no output)", false);
      if (res.ok) solved();
    }

    function solved() {
      const level = cur.level;
      const wasNew = level >= PuzzleState.completedCount(cur.track);
      PuzzleState.markSolved(cur.track, level);
      if (wasNew) {
        PlayerState.bumpStat("puzzles");
        PlayerState.bumpPuzzleStreak();
        const nick = PlayerState.getNickname();
        if (nick && typeof FirebaseClient !== "undefined") {
          FirebaseClient.recordPuzzleSolve({ nickname: nick, avatar: PlayerState.getAvatar() }).then(() => { topCache = {}; }).catch(() => {});
        }
      }
      sfx("clear");
      $("puzzle-solved-text").textContent = wasNew ? "LEVEL CLEARED" : "SOLVED AGAIN";
      $("puzzle-solved").classList.remove("hidden");
      editor.blur();
      pendingFlash = { cleared: level, unlocked: level + 1 };
      document.dispatchEvent(new CustomEvent("debugr:progress"));
      if (typeof Rewards !== "undefined") Rewards.check();
    }
    let pendingFlash = null;

    editor.addEventListener("input", () => {
      lineNumbers();
      sfx("key");
      $("puzzle-solved").classList.add("hidden");
      clearTimeout(runTimer);
      runTimer = setTimeout(runNow, 300);
    });
    editor.addEventListener("scroll", () => { nums.scrollTop = editor.scrollTop; });
    editor.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      const s = editor.selectionStart;
      editor.value = editor.value.slice(0, s) + "    " + editor.value.slice(editor.selectionEnd);
      editor.selectionStart = editor.selectionEnd = s + 4;
      editor.dispatchEvent(new Event("input"));
    });

    $("puzzles-hint-btn").addEventListener("click", () => {
      if (!cur || shownHints >= cur.hints.length) return;
      shownHints++;
      paintHints();
    });
    function backToPath() {
      clearTimeout(runTimer);
      App.showScreen("puzzleSelect");
      renderPath(pendingFlash);
      pendingFlash = null;
    }
    $("puzzles-back-btn").addEventListener("click", backToPath);
    $("puzzle-path-btn").addEventListener("click", backToPath);
    $("puzzle-next-btn").addEventListener("click", () => { if (cur) open(cur.track, cur.level + 1); });

    return { renderPath, open };
  })();

  root.PuzzleUI = PuzzleUI;
})(typeof window !== "undefined" ? window : globalThis);