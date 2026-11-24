// Python lessons: the LEARN screen (menu row), the lesson screen and the full-screen Python loader.
// Lessons are data (lessons.js, lessons3-6.js). Code runs in real Python (pyrun.js / Pyodide).
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KEY = "debugr_learn";
  const CH = Lessons.CHAPTERS;
  const ALL = CH.flatMap((c) => c.lessons.map((l) => Object.assign({ chapter: c }, l)));
  const BUG = '<svg class="bug" aria-hidden="true"><use href="#bug-sprite" /></svg>';

  // ---------- progress ----------
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { } };
  const isDone = (id) => !!load()[id];
  const unlockedIdx = () => { const i = ALL.findIndex((l) => !isDone(l.id)); return i < 0 ? ALL.length : i; };
  // exercises you got wrong are kept for REVIEW; they leave the list when you get them right there
  const MKEY = "debugr_learn_miss";
  const misses = () => { try { return JSON.parse(localStorage.getItem(MKEY)) || {}; } catch { return {}; } };
  const saveMiss = (m) => { try { localStorage.setItem(MKEY, JSON.stringify(m)); } catch { } };
  const validKey = (k) => { const [id, i] = k.split(":"); const l = ALL.find((x) => x.id === id); return !!(l && l.ex[+i]); };
  const missKeys = () => Object.keys(misses()).filter(validKey);
  let pg = false; // playground open
  let rv = null; // review session: { items: ["4.2:1", ...], pos, cleared }
  const chDone = (c) => c.lessons.length > 0 && c.lessons.every((l) => isDone(l.id));

  // ---------- errors in plain words (the real Python message is always shown first) ----------
  function hint(err) {
    const m = err.message || "", t = err.type;
    const q = (m.match(/'([^']+)'/) || [])[1];
    if (t === "SyntaxError" || t === "IndentationError" || t === "TabError") {
      if (/unterminated string/.test(m)) return "A quote is missing. Every opening quote needs a closing quote.";
      if (/never closed/.test(m)) return "A bracket was opened but never closed.";
      if (/unmatched/.test(m)) return "There is a closing bracket with no opening one.";
      if (/expected an indented block/.test(m)) return "After a line that ends with a colon, the next line must be pushed in with 4 spaces.";
      if (/unexpected indent/.test(m)) return "This line is pushed in too far. Only lines after a colon are indented.";
      if (/unindent/.test(m)) return "The indentation does not line up with an earlier line.";
      if (/expected ':'/.test(m)) return "A line like if, for, while or def must end with a colon.";
      if (/invalid decimal literal/.test(m)) return "A name can't start with a number.";
      if (/cannot assign/.test(m)) return "The left side of = has to be a plain name.";
      if (/Missing parentheses/.test(m)) return "print needs brackets: print(...).";
      return "Python can't read this line. Check brackets, quotes, colons and spelling.";
    }
    if (t === "NameError") return `Python doesn't know the name ${q ? "'" + q + "'" : "you used"}. Is it spelled the same everywhere (capital letters count) and created before this line?`;
    if (t === "UnboundLocalError") return "You use a variable inside a function before giving it a value there.";
    if (t === "TypeError") {
      if (/can only concatenate str|must be str, not|unsupported operand type/.test(m)) return "You mixed two kinds of things Python can't mix with this sign, like text and a number. Convert one with str() or int().";
      if (/not callable/.test(m)) return "You put brackets after something that is not a function.";
      if (/positional argument/.test(m)) return "The number of arguments does not match what the function wants.";
      if (/not subscriptable/.test(m)) return "You used [ ] on something that has no positions.";
      if (/not iterable/.test(m)) return "You tried to loop over something that can't be looped over, like a single number.";
      return "You used a value of the wrong kind here.";
    }
    if (t === "ZeroDivisionError") return "You can't divide by zero.";
    if (t === "IndexError") return "That position does not exist. Counting starts at 0, so the last position is len(list) - 1.";
    if (t === "KeyError") return "That key is not in the dictionary.";
    if (t === "ValueError") return /invalid literal/.test(m) ? "That text can't be turned into a number." : "The value is the right kind but not allowed here.";
    if (t === "AttributeError") return "That thing has no such method or attribute. Check the spelling.";
    if (t === "RecursionError") return "A function keeps calling itself and never stops.";
    if (t === "EOFError") return "The program asked for input() but no more input was given.";
    if (t === "TimeoutError") return "Your program ran for more than 5 seconds. Is there a loop that never ends?";
    if (t === "ModuleNotFoundError") return "Python can't find that module. Check the spelling of the import.";
    if (t === "AssertionError") return "An assert said something that should be true was not.";
    if (t === "StopIteration") return "There was nothing left to take from the iterator.";
    return "";
  }
  function showOut(r) {
    const o = $("ls-out"); if (!o) return;
    o.classList.toggle("err", !r.ok);
    let txt = (r.output || "").replace(/\s+$/, "");
    o.textContent = "";
    if (r.ok) { o.textContent = txt || "(nothing was printed)"; return; }
    const e = r.error;
    o.append(document.createTextNode((txt ? txt + "\n" : "") + `${e.type}: ${e.message}${e.line ? ` (line ${e.line})` : ""}`));
    const h = hint(e);
    if (h) { const s = document.createElement("span"); s.className = "hint"; s.textContent = "→ " + h; o.append(s); }
  }
  const norm = (t) => String(t).replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").trim();

  // ---------- the full-screen loader ----------
  const LINES = ["booting python", "teaching the bug to count", "feeding the bug semicolons", "polishing the indentation", "warming up the interpreter", "sweeping out old bugs"];
  let typer = null, lineTimer = null;
  function typeLine(txt) {
    const el = $("pl-text"); clearInterval(typer); let i = 0; el.textContent = "";
    typer = setInterval(() => { el.textContent = txt.slice(0, ++i); if (i >= txt.length) clearInterval(typer); }, 28);
  }
  function paintLoader() {
    const ov = $("py-loading"), st = PyRun.state(), sg = PyRun.stage();
    const frac = st === "ready" ? 1 : [0.05, 0.25, 0.8, 0.95, 1][sg] || 0.05;
    [...$("pl-dots").children].forEach((d, i) => d.classList.toggle("on", i < Math.round(frac * 6)));
    ov.classList.toggle("failed", st === "failed");
    $("pl-retry").classList.toggle("hidden", st !== "failed");
    if (st === "failed") {
      clearInterval(lineTimer); typeLine("python could not load");
      $("pl-sub").textContent = navigator.onLine === false
        ? "You're offline and Python is not saved on this device yet. Open Learn once with internet and it works offline after that."
        : "Check your internet connection, then press RETRY. Nothing you did is lost.";
    }
  }
  // resolves true when Python is ready, false if the player closed the loader. Shows the loader only if it takes a moment.
  function gate() {
    let first = false;
    try { first = !localStorage.getItem("debugr_py_seen"); } catch { }
    if (PyRun.state() === "ready" && !first) return Promise.resolve(true);
    PyRun.preload();
    return new Promise((resolve) => {
      const born = Date.now();
      const ov = $("py-loading");
      let shown = false, finished = false;
      const finish = (ok) => {
        if (finished) return; finished = true; off(); clearTimeout(t0); clearInterval(lineTimer);
        if (!shown) return resolve(ok);
        if (ok) { try { localStorage.setItem("debugr_py_seen", "1"); } catch { } }
        if (ok && first && Date.now() - born < 1800) { finished = false; return void setTimeout(() => finish(true), 1800 - (Date.now() - born)); }
        if (ok) { ov.classList.add("done"); setTimeout(() => { ov.classList.add("wipe"); setTimeout(() => { ov.classList.add("hidden"); ov.classList.remove("wipe", "done", "failed"); resolve(true); }, 350); }, 550); }
        else { ov.classList.add("hidden"); ov.classList.remove("failed"); resolve(false); }
      };
      const off = PyRun.onChange(() => { paintLoader(); if (PyRun.state() === "ready") finish(true); });
      const t0 = setTimeout(() => {
        if (finished) return; shown = true;
        ov.classList.remove("hidden", "failed", "done", "wipe"); $("pl-sub").textContent = "First time only, about 10 MB. After this it opens instantly.";
        let n = 0; typeLine(LINES[0]); lineTimer = setInterval(() => { n = (n + 1) % LINES.length; typeLine(LINES[n]); }, 2400);
        paintLoader();
      }, first ? 0 : 350);
      if (PyRun.state() === "ready") setTimeout(() => finish(true), 0);
      $("py-load-x").onclick = () => finish(false);
      $("pl-retry").onclick = () => { PyRun.retry(); $("pl-sub").textContent = "Trying again..."; let n = 0; typeLine(LINES[0]); clearInterval(lineTimer); lineTimer = setInterval(() => { n = (n + 1) % LINES.length; typeLine(LINES[n]); }, 2400); paintLoader(); };
      if (PyRun.state() === "failed") PyRun.retry();
    });
  }

  function reviewBtn() {
    const n = missKeys().length;
    return n ? `<button class="btn" id="ln-review">REVIEW<span class="ln-cont-sub">${n} to revisit</span></button>` : "";
  }
  // the colour skin a chapter gives, shown as a small chip in the chapter header
  function rewardChip(c, cd) {
    const sk = typeof Skins !== "undefined" && Skins.SKINS.find((s) => s.unlock === "learn:" + c.id);
    if (!sk) return "";
    return `<span class="ln-rw${cd ? " got" : ""}" title="Finish this chapter to unlock the ${esc(sk.name)} bug skin"><i style="background:${sk.color}"></i>${esc(sk.name.toUpperCase())} SKIN</span>`;
  }

  // ---------- the LEARN screen ----------
  function paintLearn() {
    const total = ALL.length, done = ALL.filter((l) => isDone(l.id)).length, next = unlockedIdx();
    const nextL = ALL[next];
    let html = `<div class="ln-top"><div class="ln-prog"><div class="ln-k">YOUR PROGRESS</div>
      <div class="ln-num">${done} <span>/ ${total} lessons</span></div>
      <div class="ln-bar"><i style="width:${Math.round((done / total) * 100)}%"></i></div></div>
      ${reviewBtn()}<button class="btn primary" id="ln-continue">${done === 0 ? "START" : nextL ? "CONTINUE" : "REVIEW"}${nextL ? `<span class="ln-cont-sub">${esc(nextL.id)} ${esc(nextL.title)}</span>` : ""}</button></div>`;
    const allDone = typeof Certificate !== "undefined" && Certificate.complete();
    html += `<div class="ln-tools"><button class="btn small" id="ln-play">PLAYGROUND<span class="ln-cont-sub">run any Python</span></button>${allDone ? `<button class="btn small" id="ln-cert">CERTIFICATE<span class="ln-cont-sub">you finished the course</span></button>` : ""}</div>`;
    html += CH.map((c) => {
      const cd = chDone(c), n = c.lessons.filter((l) => isDone(l.id)).length;
      const nodes = c.lessons.map((l) => {
        const idx = ALL.findIndex((a) => a.id === l.id);
        const cls = isDone(l.id) ? "done" : idx === next ? "current" : "locked";
        return `<button class="ln-node ${cls}" data-lesson="${l.id}" ${cls === "locked" ? "disabled" : ""}><span class="ln-dot">${cls === "done" ? BUG : l.id.split(".")[1]}</span><em>${esc(l.title)}</em></button>`;
      }).join("");
      return `<section class="ln-chap${cd ? " cleared" : ""}"><header><span class="ln-cn">CHAPTER ${c.id}</span>
        <b>${esc(c.name)}</b><span class="ln-cs">${esc(c.sub)}</span>
        <span class="ln-cc">${cd ? "CLEARED" : `${n} / ${c.lessons.length}`}</span>${rewardChip(c, cd)}</header>
        <div class="ln-nodes">${nodes}</div></section>`;
    }).join("");
    $("learn-view").innerHTML = html;
  }

  $("learn-view").addEventListener("click", (e) => {
    if (e.target.closest("#ln-review")) return openReview();
    if (e.target.closest("#ln-play")) return openPlayground();
    if (e.target.closest("#ln-cert")) return Certificate.open();
    if (e.target.closest("#ln-continue")) { const l = ALL[Math.min(unlockedIdx(), ALL.length - 1)]; return open(l.id); }
    const n = e.target.closest(".ln-node:not(:disabled)"); if (n) open(n.dataset.lesson);
  });
  document.addEventListener("debugr:screen", (e) => { if (e.detail.name === "learn") { paintLearn(); PyRun.preload(); } });

  // ---------- the lesson screen ----------
  let L = null, step = 0, exi = 0, solved = false, tipGone = false, busy = false;

  // a lesson can be opened once it is done or is the next one on the path; later ones stay locked
  const canOpen = (id) => { const i = ALL.findIndex((l) => l.id === id); return i >= 0 && i <= unlockedIdx(); };
  async function open(id) {
    const lesson = ALL.find((l) => l.id === id); if (!lesson || !canOpen(id)) return;
    if (!(await gate())) return;
    rv = null; pg = false; L = lesson; step = 0; exi = 0; solved = false; tipGone = false; busy = false;
    App.showScreen("lesson");
    paint();
  }
  function back() { rv = null; pg = false; App.showScreen("learn"); }

  async function openReview() {
    const keys = missKeys(); if (!keys.length) return;
    if (!(await gate())) return;
    for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
    pg = false; rv = { items: keys.slice(0, 8), pos: 0, cleared: 0 };
    App.showScreen("lesson");
    loadReviewItem();
  }
  function loadReviewItem() {
    const [id, i] = rv.items[rv.pos].split(":");
    L = ALL.find((x) => x.id === id); exi = +i; step = 2; solved = false; tipGone = false; busy = false;
    paint();
  }

  const STEPS = ["READ", "TRY", "EXERCISES"];
  function paintReviewScreen() {
    const done = rv.pos >= rv.items.length;
    $("lesson-head").innerHTML = `<div class="ls-crumb">REVIEW${done ? "" : ` · FROM LESSON ${esc(L.id)}`}</div><h2>${done ? "Review finished" : "Practice what you missed"}</h2>`;
    const body = $("lesson-body");
    if (done) {
      const left = missKeys().length;
      body.innerHTML = `<div class="ls-done"><div class="ls-check">${BUG}</div><h3>${rv.cleared} of ${rv.items.length} cleared</h3>
        <p>${left ? `${left} still ${left === 1 ? "needs" : "need"} another go. They stay in REVIEW until you get them right.` : "Nothing left to review. Nice."}</p>
        <div class="ls-actions">${left ? `<button class="btn primary" id="ls-again">REVIEW AGAIN</button>` : ""}<button class="btn" id="ls-path">BACK TO PATH</button></div></div>`;
      const bx = $("lesson-bug"); bx.innerHTML = "";
      return;
    }
    paintEx(); paintBug();
  }
  // ---------- playground: run anything, nothing is checked or counted ----------
  const PKEY = "debugr_play_code", PIN = "debugr_play_stdin";
  const EXAMPLES = [
    ["Hello, world", 'print("Hello, world!")', ""],
    ["A loop", 'for i in range(1, 6):\n    print(i, "squared is", i * i)', ""],
    ["A function", 'def greet(name):\n    return f"Hi {name}!"\n\nprint(greet("Ada"))', ""],
    ["Asking for input", 'name = input("What is your name? ")\nprint("Hello,", name)', "Ada"],
    ["Lists and dictionaries", 'words = ["apple", "fig", "banana"]\nlengths = {w: len(w) for w in words}\nprint(lengths)\nprint([w.upper() for w in words if len(w) > 3])', ""],
    ["A class", 'class Dog:\n    def __init__(self, name):\n        self.name = name\n\n    def speak(self):\n        return self.name + " says woof"\n\nprint(Dog("Rex").speak())', ""],
    ["Generators and errors", 'def numbers():\n    yield 1\n    yield 2\n    yield 3\n\nfor n in numbers():\n    print(n)\n\ntry:\n    print(10 / 0)\nexcept ZeroDivisionError:\n    print("cannot divide by zero")', ""],
  ].map(([n, c, s]) => [n, c.replace(/\\n/g, "\n"), s]);
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch { } };
  const fetchKey = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } };

  async function openPlayground() {
    if (!(await gate())) return;
    pg = true; rv = null; step = 1; solved = false; busy = false;
    App.showScreen("lesson");
    paintPlayground();
  }
  function paintPlayground() {
    $("lesson-head").innerHTML = `<div class="ls-crumb">PLAYGROUND</div><h2>Run any Python</h2><div class="ls-sub">Nothing here is checked or counted. Try things, break things.</div>`;
    $("lesson-body").innerHTML = `<div class="ls-play">
      <label class="ls-lab" for="pg-ex">EXAMPLES</label>
      <select id="pg-ex" class="ls-sel"><option value="">Load an example…</option>${EXAMPLES.map((e, i) => `<option value="${i}">${esc(e[0])}</option>`).join("")}</select>
      <label class="ls-lab" for="ls-try">YOUR CODE <span class="ls-tip">Ctrl+Enter runs it</span></label>
      <textarea id="ls-try" class="ls-code" spellcheck="false" autocapitalize="off" autocomplete="off" rows="12">${esc(fetchKey(PKEY, EXAMPLES[0][1]))}</textarea>
      <label class="ls-lab" for="ls-stdin">TYPED INPUT <span class="ls-tip">one line per input() call</span></label>
      <textarea id="ls-stdin" class="ls-code ls-stdin" spellcheck="false" rows="2" placeholder="only needed if your code uses input()">${esc(fetchKey(PIN, ""))}</textarea>
      <div class="ls-actions"><button class="btn primary" id="ls-run" data-target="ls-try">RUN</button><button class="btn" id="pg-reset">START OVER</button></div>
      <div class="ls-out hidden" id="ls-out" role="status" aria-live="polite"></div></div>`;
    $("lesson-bug").innerHTML = "";
  }
  document.addEventListener("change", (e) => {
    if (!pg || !e.target || e.target.id !== "pg-ex" || e.target.value === "") return;
    const ex = EXAMPLES[+e.target.value]; if (!ex) return;
    $("ls-try").value = ex[1]; $("ls-stdin").value = ex[2]; store(PKEY, ex[1]); store(PIN, ex[2]);
    e.target.value = "";
  });
  document.addEventListener("input", (e) => {
    if (!pg || !e.target) return;
    if (e.target.id === "ls-try") store(PKEY, e.target.value);
    if (e.target.id === "ls-stdin") store(PIN, e.target.value);
  });

  function paint() {
    if (pg) return paintPlayground();
    if (rv) return paintReviewScreen();
    const exDots = L.ex.map((_, i) => `<i class="${i < exi || step === 3 ? "on" : i === exi && step === 2 ? "cur" : ""}"></i>`).join("");
    $("lesson-head").innerHTML = `<div class="ls-crumb">CHAPTER ${L.chapter.id} · LESSON ${esc(L.id)}</div><h2>${esc(L.title)}</h2>
      <div class="ls-steps">${STEPS.map((s, i) => `<span class="${step > i ? "done" : step === i ? "cur" : ""}">${s}</span>`).join("")}<span class="ls-dots">${step >= 2 ? exDots : ""}</span></div>`;
    const body = $("lesson-body");
    if (step === 0) {
      body.innerHTML = `<div class="ls-read">${L.read.map((p) => `<p>${p}</p>`).join("")}</div>
        <div class="ls-actions"><button class="btn primary" id="ls-next">NEXT: TRY IT</button></div>`;
    } else if (step === 1) {
      const wantsInput = /input\s*\(/.test(L.try.code);
      body.innerHTML = `<p class="ls-note">${L.try.note}</p>
        <textarea class="ls-code" id="ls-try" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Code">${esc(L.try.code)}</textarea>
        ${wantsInput ? `<label class="ls-note" for="ls-stdin">What the player types (one line for each input())</label><textarea class="ls-code small ls-stdin" id="ls-stdin" rows="2" spellcheck="false">${esc((L.try.stdin || []).join("\n"))}</textarea>` : ""}
        <div class="ls-actions"><button class="btn" id="ls-run" data-target="ls-try">RUN</button><button class="btn primary" id="ls-next">NEXT: EXERCISES</button></div>
        <pre class="ls-out" id="ls-out" aria-live="polite"></pre>`;
    } else if (step === 2) paintEx();
    else {
      const nx = ALL[ALL.findIndex((l) => l.id === L.id) + 1];
      const chapterDone = chDone(L.chapter);
      body.innerHTML = `<div class="ls-done"><div class="ls-check">${BUG}</div><h3>${chapterDone ? "Chapter cleared" : "Lesson cleared"}</h3>
        <p>${chapterDone ? `You finished <b>chapter ${L.chapter.id}: ${esc(L.chapter.name)}</b>. Nice work.` : "You got through every exercise."}</p>
        <div class="ls-actions">${nx ? `<button class="btn primary" id="ls-nextlesson">NEXT LESSON</button>` : ""}<button class="btn" id="ls-path">BACK TO PATH</button></div></div>`;
    }
    paintBug();
  }

  function paintEx() {
    const e = L.ex[exi]; solved = false;
    let ui = "";
    if (e.type === "choice") {
      ui = `<div class="ls-choices" role="radiogroup">${e.options.map((o, i) => `<label class="ls-choice"><input type="radio" name="ls-ch" value="${i}"><span>${o}</span></label>`).join("")}</div>`;
    } else if (e.type === "fill") {
      const parts = e.code.split("___");
      ui = `<pre class="ls-pre">${esc(parts[0])}<input class="ls-blank" id="ls-ans" size="8" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Your answer">${esc(parts[1] || "")}</pre>`;
    } else if (e.type === "predict") {
      ui = `<pre class="ls-pre">${esc(e.code)}</pre><label class="ls-note" for="ls-ans">What does it show? (type it exactly, one line each)</label>
        <textarea class="ls-code small" id="ls-ans" rows="2" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>`;
    } else {
      ui = `<textarea class="ls-code" id="ls-ans" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Your code">${esc(e.type === "fix" ? e.code : e.start || "")}</textarea>`;
    }
    if (e.stdin) ui += `<p class="ls-note">The program gets this input: ${e.stdin.map((s) => `<code>${esc(s)}</code>`).join(" ")}</p>`;
    const canRun = e.type === "fix" || e.type === "write";
    $("lesson-body").innerHTML = `<div class="ls-q"><span class="ls-qn">${rv ? `${rv.pos + 1} / ${rv.items.length}` : `${exi + 1} / ${L.ex.length}`}</span> ${e.prompt}</div>${ui}
      <div class="ls-actions">${canRun ? `<button class="btn" id="ls-run" data-target="ls-ans">RUN</button>` : ""}<button class="btn primary" id="ls-check">CHECK</button></div>
      <pre class="ls-out" id="ls-out" aria-live="polite"></pre><div class="ls-verdict hidden" id="ls-verdict" role="status"></div>`;
    const a = $("ls-ans"); if (a) a.focus();
  }

  const stdinOf = (e) => (e && e.stdin) || ($("ls-stdin") ? $("ls-stdin").value.split("\n") : []);
  async function runCode(code, stdin, tests) {
    return PyRun.run({ code, stdin, tests: tests || [] });
  }

  async function doRun(targetId) {
    if (busy) return; busy = true;
    const o = $("ls-out"); o.classList.remove("err"); o.textContent = "running...";
    const e = step === 2 ? L.ex[exi] : null;
    const r = await runCode($(targetId).value, stdinOf(e));
    busy = false; showOut(r);
  }

  function verdict(ok, text, last, soft) {
    if (!soft) {
      const key = L.id + ":" + exi, m = misses();
      if (!ok) { m[key] = 1; saveMiss(m); }
      else if (rv && m[key]) { delete m[key]; saveMiss(m); rv.cleared++; }
    }
    const v = $("ls-verdict");
    v.className = "ls-verdict " + (ok ? "good" : "bad");
    v.innerHTML = `<b>${ok ? "Correct." : "Not yet."}</b> <span>${text}</span>${ok ? `<button class="btn small primary" id="ls-continue">${last ? "FINISH" : "NEXT"}</button>` : ""}`;
    if (ok) { const b = $("ls-continue"); if (b) b.focus(); }
    if (typeof Sound !== "undefined") try { Sound.play(ok ? "clear" : "error"); } catch { }
  }

  async function check() {
    if (solved || busy) return;
    const e = L.ex[exi], last = rv ? rv.pos === rv.items.length - 1 : exi === L.ex.length - 1;
    if (e.type === "choice") {
      const c = document.querySelector('input[name="ls-ch"]:checked');
      if (!c) return verdict(false, "Pick an answer first.", last, true);
      const ok = +c.value === e.answer; solved = ok;
      return verdict(ok, ok ? e.why : `Not that one. ${e.why}`, last);
    }
    const val = $("ls-ans").value;
    busy = true; $("lesson-body").classList.add("ls-wait");
    try {
      if (e.type === "predict") {
        let want = e.expect;
        if (want === undefined) { const r = await runCode(e.code, e.stdin || []); want = (r.output || "").trim(); }
        const ok = norm(val) === norm(want); solved = ok;
        return verdict(ok, ok ? e.why : `It shows <code>${esc(norm(want).split("\n").join(" ⏎ "))}</code>. ${e.why}`, last);
      }
      if (e.type === "fill" && !val.trim()) return verdict(false, "Type something in the blank first.", last, true);
      const code = e.type === "fill" ? e.code.replace("___", val.trim()) : val;
      const r = await runCode(code, stdinOf(e), e.tests);
      showOut(r);
      if (!r.ok) return verdict(false, `The program stopped with an error. ${e.why}`, last);
      if (e.expect !== undefined && norm(r.output) !== norm(e.expect))
        return verdict(false, `It shows <code>${esc(norm(r.output) || "nothing")}</code> but we want <code>${esc(norm(e.expect))}</code>. ${e.why}`, last);
      const bad = (r.tests || []).find((t) => !t.ok);
      if (bad) return verdict(false, `<code>${esc(bad.expr)}</code> gave <code>${esc(bad.got)}</code> but should give <code>${esc(bad.want)}</code>. ${e.why}`, last);
      if (e.must && !e.must.test(code)) return verdict(false, `The result is right, but this exercise is about using the idea from this lesson. ${e.why}`, last);
      solved = true;
      verdict(true, e.type === "fill" ? e.why : "That does exactly what it should. " + (e.why ? `<i>${e.why}</i>` : ""), last);
    } finally { busy = false; $("lesson-body").classList.remove("ls-wait"); }
  }

  function nextEx() {
    if (rv) { rv.pos++; if (rv.pos >= rv.items.length) paint(); else loadReviewItem(); return; }
    if (exi < L.ex.length - 1) { exi++; paintEx(); paint2(); return; }
    const d = load(); d[L.id] = 1; save(d);
    document.dispatchEvent(new CustomEvent("debugr:lesson-done", { detail: { id: L.id } }));
    step = 3; paint();
  }
  function paint2() { // refresh just the progress dots
    const dots = document.querySelector(".ls-dots");
    if (dots) dots.innerHTML = L.ex.map((_, i) => `<i class="${i < exi ? "on" : i === exi ? "cur" : ""}"></i>`).join("");
  }

  $("lesson-body").addEventListener("click", (e) => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.id === "ls-next") { step++; paint(); }
    else if (t.id === "ls-run") doRun(t.dataset.target);
    else if (t.id === "ls-check") check();
    else if (t.id === "ls-continue") nextEx();
    else if (t.id === "ls-path") back();
    else if (t.id === "ls-again") openReview();
    else if (t.id === "pg-reset") { $("ls-try").value = EXAMPLES[0][1]; $("ls-stdin").value = ""; store(PKEY, EXAMPLES[0][1]); store(PIN, ""); $("ls-out").classList.add("hidden"); }
    else if (t.id === "ls-nextlesson") { const nx = ALL[ALL.findIndex((l) => l.id === L.id) + 1]; if (nx) open(nx.id); }
  });
  // Ctrl/Cmd+Enter runs or checks; Tab inserts spaces in code boxes
  $("lesson-body").addEventListener("keydown", (e) => {
    const t = e.target;
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); const b = $("ls-check") || $("ls-run"); if (b) b.click(); return; }
    if (e.key === "Enter" && t.id === "ls-ans" && t.tagName === "INPUT") { e.preventDefault(); check(); return; }
    if (e.key === "Tab" && t.classList.contains("ls-code")) {
      e.preventDefault();
      const s = t.selectionStart; t.value = t.value.slice(0, s) + "    " + t.value.slice(t.selectionEnd); t.selectionStart = t.selectionEnd = s + 4;
    }
  });
  $("lesson-body").addEventListener("input", () => { const v = $("ls-verdict"); if (v && !solved) v.classList.add("hidden"); });
  $("lesson-body").addEventListener("change", () => { const v = $("ls-verdict"); if (v && !solved) v.classList.add("hidden"); });

  // ---------- the bug that gives the tips ----------
  function paintBug() {
    const box = $("lesson-bug");
    box.classList.remove("gone", "squash");
    box.innerHTML = `<div class="lb-bubble" id="lb-bubble"><button class="lb-hide" id="lb-hide" title="Send the bug away">HIDE</button><div class="lb-k">TIP FROM THE BUG</div><p>${esc(L.bug)}</p></div>
      <svg class="bug lb-bug" id="lb-bug" aria-hidden="true"><use href="#bug-sprite" /></svg>
      <button class="lb-back" id="lb-back" aria-label="Bring the bug back" title="Bring the bug back">?</button>`;
    box.classList.toggle("away", tipGone);
  }
  $("lesson-bug").addEventListener("click", (e) => {
    const box = $("lesson-bug");
    if (e.target.closest("#lb-hide")) {
      // squashed flat, then spins off the screen. The bubble goes away straight away.
      box.classList.add("squash");
      setTimeout(() => { tipGone = true; box.classList.remove("squash"); box.classList.add("away"); }, 1100);
    } else if (e.target.closest("#lb-back")) {
      tipGone = false; box.classList.remove("away"); box.classList.add("return");
      setTimeout(() => box.classList.remove("return"), 700);
    }
  });

  window.Learn = { open, back, canOpen, chapters: () => ({ done: CH.filter(chDone).length, total: CH.length }), progress: () => ({ done: ALL.filter((l) => isDone(l.id)).length, total: ALL.length }) };
})();
