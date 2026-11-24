(function () {
  "use strict";

  // subtle static noise for the CRT look
  const grainCanvas = document.getElementById("grain-canvas");
  const gctx = grainCanvas.getContext("2d");
  function drawGrain() {
    grainCanvas.width = window.innerWidth;
    grainCanvas.height = window.innerHeight;
    const imgData = gctx.createImageData(grainCanvas.width, grainCanvas.height);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.random() * 255;
      imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = v;
      imgData.data[i + 3] = 255;
    }
    gctx.putImageData(imgData, 0, 0);
  }
  drawGrain();
  window.addEventListener("resize", drawGrain);

  // screen routing
  const SCREENS = {
    menu: "screen-menu", difficulty: "screen-difficulty", lobby: "screen-lobby",
    join: "screen-join", quick: "screen-quick", leaderboard: "screen-leaderboard", game: "screen-game",
    puzzleSelect: "screen-puzzle-select", profile: "screen-profile", puzzles: "screen-puzzles", daily: "screen-daily", lesson: "screen-lesson", learn: "screen-learn",
  };

  let currentScreen = "menu";
  function showScreen(name) {
    for (const id of Object.values(SCREENS)) document.getElementById(id).classList.add("hidden");
    document.getElementById(SCREENS[name]).classList.remove("hidden");
    document.getElementById("success-screen").classList.add("hidden");
    document.getElementById("room-results").classList.add("hidden");
    currentScreen = name;
    document.dispatchEvent(new CustomEvent("debugr:screen", { detail: { name } }));
  }
  function goHome() { teardownGame(); showScreen("menu"); }
  // bridge for tutorial.js, keys.js, daily.js and the puzzles
  window.App = {
    showScreen, goHome, startGame,
    current: () => currentScreen,
    // hooks the room controller (rooms.js) uses
    boostAppetite: (amount) => { if (run && !dead) { run.appetite = Math.min(0.98, run.appetite + amount); paintAppetite(); } },
    stopRun: () => { dead = true; clearInterval(loop); loop = null; lane.classList.add("hidden"); },
    runSummary: () => run,
    inRun: () => currentScreen === "game" && !!task && !dead,
    // tutorial.js: keep a solved mission open until the player has done what the mission teaches
    holdWin: (on) => { if (run) { run.holdWin = !!on; if (!on) evaluate(); } },
  };

  // header: nickname + streak display
  function refreshHeader() {
    document.getElementById("nickname-display").textContent = PlayerState.getNickname() || "GUEST";
    const streak = PlayerState.getStreakCache();
    document.getElementById("streak-count").textContent = streak.daily;
    document.getElementById("streak-chip").classList.toggle("hot", streak.daily >= 3);
    if (typeof Rewards !== "undefined") Rewards.refresh();
    document.dispatchEvent(new CustomEvent("debugr:streak"));
  }

  function bumpDailyStreak() {
    const streak = PlayerState.getStreakCache();
    const today = new Date().toISOString().slice(0, 10);
    if (streak.lastPlayDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      streak.daily = streak.lastPlayDate === yesterday ? streak.daily + 1 : 1;
      streak.lastPlayDate = today;
      PlayerState.setStreakCache(streak);
    }
    refreshHeader();
    FirebaseClient.updateStreaks({ nickname: PlayerState.getNickname(), daily: streak.daily, win: streak.win }).catch(() => { });
  }

  // nickname onboarding
  const nicknamePrompt = document.getElementById("nickname-prompt");
  const nicknameInput = document.getElementById("nickname-input");
  const nicknameError = document.getElementById("nickname-error");
  const confirmNicknameBtn = document.getElementById("confirm-nickname-btn");

  async function trySubmitNickname() {
    const name = nicknameInput.value.trim();
    nicknameError.textContent = "";
    if (name.length < 3) return (nicknameError.textContent = "At least 3 characters.");
    if (!/^[A-Za-z0-9_\-]+$/.test(name)) return (nicknameError.textContent = "Letters, numbers, _ and - only.");
    if (!looksCleanClientSide(name)) return (nicknameError.textContent = "That name isn't allowed. Try another.");

    confirmNicknameBtn.disabled = true;
    confirmNicknameBtn.textContent = "CHECKING...";
    const result = await FirebaseClient.claimNickname(name);
    confirmNicknameBtn.disabled = false;
    confirmNicknameBtn.textContent = "CONFIRM";

    if (!result.allowed) return (nicknameError.textContent = result.reason);

    PlayerState.setNickname(name);
    nicknamePrompt.classList.add("hidden");
    refreshHeader();
    Ratings.sync();
    document.getElementById("nick-x").classList.add("hidden");
    if (currentScreen === "profile") { if (typeof Friends !== "undefined") Friends.paintMe(); } else maybeShowTutorialPrompt();
  }
  confirmNicknameBtn.addEventListener("click", trySubmitNickname);
  nicknameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") trySubmitNickname(); });

  // editing the name lives on the profile screen (friends.js opens this dialog); the X only shows when a name already exists
  window.openNicknameEdit = () => {
    nicknameInput.value = PlayerState.getNickname() || "";
    nicknameError.textContent = "";
    document.getElementById("nick-x").classList.remove("hidden");
    document.getElementById("nick-title").textContent = "CHANGE CALLSIGN";
    nicknamePrompt.classList.remove("hidden");
    nicknameInput.focus();
  };
  document.getElementById("nick-x").addEventListener("click", () => nicknamePrompt.classList.add("hidden"));
  document.getElementById("nickname-display").addEventListener("click", () => showScreen("profile"));

  // tutorial onboarding
  const tutorialPrompt = document.getElementById("tutorial-prompt");
  function maybeShowTutorialPrompt() {
    if (PlayerState.tutorialDone()) return showScreen("menu");
    tutorialPrompt.classList.remove("hidden");
  }
  document.getElementById("start-tutorial-btn").addEventListener("click", () => {
    tutorialPrompt.classList.add("hidden");
    Tutorial.start();
  });
  document.getElementById("skip-tutorial-btn").addEventListener("click", () => {
    tutorialPrompt.classList.add("hidden");
    PlayerState.markTutorialDone();
    showScreen("menu");
  });
  document.querySelector('[data-action="tutorial"]').addEventListener("click", () => Tutorial.start());

  // first load
  async function init() {
    refreshHeader();
    try {
      await FirebaseClient.init();
    } catch (err) {
      console.error("Firebase failed to initialize — check FIREBASE_CONFIG in config.js.", err);
    }
    if (!PlayerState.hasVisited()) {
      PlayerState.markVisited();
      nicknamePrompt.classList.remove("hidden");
    } else if (!PlayerState.getNickname()) {
      nicknamePrompt.classList.remove("hidden");
    } else {
      showScreen("menu");
    }
    // ratings: pick up the cloud copy, and settle a run that was left unfinished last time (counts as a loss)
    Ratings.sync().then(() => Ratings.resolvePending()).catch(() => { });
    window.__debugrReady = true; // scripts loaded after this one (rooms.js) check the flag, they may miss the event
    document.dispatchEvent(new CustomEvent("debugr:ready"));
  }

  // menu navigation
  document.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", () => {
      const action = el.dataset.action;
      if (action === "singleplayer") showScreen("difficulty");
      if (action === "host") Rooms.host();
      if (action === "join") Rooms.openJoin();
      if (action === "quickmatch") QuickMatch.open();
      if (action === "leaderboard") { showScreen("leaderboard"); loadLeaderboard(); }
      if (action === "profile" || action === "friends") { showScreen("profile"); if (typeof Friends !== "undefined") Friends.open(action === "friends"); }
      if (action === "learn") showScreen("learn");
      if (action === "puzzles") { showScreen("puzzleSelect"); PuzzleUI.renderPath(); }
      if (action === "back-to-menu") { teardownGame(); showScreen("menu"); }
    });
  });
  document.getElementById("logo-home-btn").addEventListener("click", () => { teardownGame(); showScreen("menu"); });

  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || !SiteKeys.on()) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return; // dont jump around while typing
    if (document.querySelector(".modal-backdrop:not(.hidden)")) return;
    if (!document.getElementById(SCREENS.menu).classList.contains("hidden")) {
      const n = parseInt(e.key, 10);
      const act = n === 1 ? "singleplayer" : n >= 2 ? (typeof MenuOrder !== "undefined" && MenuOrder.actionForKey ? MenuOrder.actionForKey(n) : null) : null;
      // preventDefault so keys.js doesnt also treat the same 1/2/3 as a difficulty pick
      if (act) { e.preventDefault(); document.querySelector(`.menu-screen [data-action="${act}"]`).click(); }
    }
  });

  // difficulty select (singleplayer path)
  document.querySelectorAll("#screen-difficulty .diff-card").forEach((card) => {
    card.addEventListener("click", () => startGame(card.dataset.diff, "singleplayer"));
  });

  // leaderboard: every board is one sorted query on the ratings/{uid} documents (see firebaseclient.js)
  const LB = { tab: "rating", sub: { rating: "bug", best: "easy", wins: "easy" }, friends: false };
  const LB_CHIPS = {
    rating: [],
    best: [["easy", "EASY"], ["medium", "MEDIUM"], ["hard", "HARD"]],
    wins: [["easy", "EASY"], ["medium", "MEDIUM"], ["hard", "HARD"]],
    streak: [],
  };
  const fmtTime = (ms) => (Number.isFinite(ms) ? (ms / 1000).toFixed(1) + "s" : "—");
  // one row of choices: which game (SOLO / PUZZLES), how to sort, and optionally only your friends
  document.getElementById("lb-seg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-game]"); if (!b) return;
    LB.sub.rating = b.dataset.game;
    if (b.dataset.game !== "bug") { LB.tab = "rating"; document.getElementById("lb-sort").value = "rating"; }
    loadLeaderboard();
  });
  document.getElementById("lb-sort").addEventListener("change", (e) => {
    LB.tab = e.target.value;
    if (LB.tab !== "rating") LB.sub.rating = "bug"; // times and streaks only exist for the solo game
    loadLeaderboard();
  });
  document.getElementById("lb-scope").addEventListener("click", (e) => {
    const b = e.target.closest("[data-scope]"); if (!b) return;
    LB.friends = b.dataset.scope === "friends"; loadLeaderboard();
  });
  document.getElementById("lb-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sub]");
    if (!b) return;
    LB.sub[LB.tab] = b.dataset.sub;
    loadLeaderboard();
  });
  // what one board row looks like: [head labels, a function row -> cells]
  function lbColumns() {
    const sub = LB.sub[LB.tab];
    if (LB.tab === "rating") {
      const K = { bug: ["boardBug", "bugGames", "bug"], puzzle: ["boardPuz", "puzGames", "puz"], race: ["boardRace", "raceGames", "race"] }[sub] || ["boardBug", "bugGames", "bug"];
      return { head: ["PLAYER", "TIER", "RATING", "GAMES"], kind: sub === "puzzle" || sub === "race" ? sub : "bug",
        cells: (r) => { const v = r[K[0]], t = Rating.tierFor(v);
          return [`<span style="color:${t.color};letter-spacing:1px">${t.name}</span>`, `<b>${v}</b>`, r[K[1]]]; },
        mine: () => { const st = Ratings.get()[K[2]], t = Rating.tierFor(st.r);
          return [`<span style="color:${t.color};letter-spacing:1px">${t.name}</span>`, `<b>${st.r}${st.g < Rating.PLACEMENT ? "?" : ""}</b>`, st.g]; } };
    }
    if (LB.tab === "best") {
      return { head: ["PLAYER", "BEST TIME", "WINS"], kind: "best",
        cells: (r) => [`<b>${fmtTime(r["best_" + sub])}</b>`, r["wins_" + sub] || 0],
        mine: () => { const s = Ratings.get(); return [`<b>${fmtTime(s.best[sub])}</b>`, s.wins[sub]]; } };
    }
    if (LB.tab === "wins") {
      return { head: ["PLAYER", "WINS", "BEST TIME"], kind: "wins",
        cells: (r) => [`<b>${r["wins_" + sub]}</b>`, fmtTime(r["best_" + sub])],
        mine: () => { const s = Ratings.get(); return [`<b>${s.wins[sub]}</b>`, fmtTime(s.best[sub])]; } };
    }
    return { head: ["PLAYER", "BEST WIN STREAK"], kind: "streak",
      cells: (r) => [`<b>${r.bestStreak}</b>`],
      mine: () => [`<b>${Ratings.get().bestStreak}</b>`] };
  }
  // why you might not be on a board, in words
  function lbNote(col) {
    if (LB.tab === "rating") {
      const st = Ratings.get()[col.kind === "puzzle" ? "puz" : col.kind === "race" ? "race" : "bug"];
      if (st.g < Rating.PLACEMENT) return `Placement: ${Rating.PLACEMENT - st.g} more rated ${col.kind === "puzzle" ? "levels" : col.kind === "race" ? "quick matches" : "games"} before you appear here.`;
      if (!FirebaseClient.isLinked()) return "Rating boards are for players with a linked Google account (Settings > Save). Your rating still counts for you.";
      return "Updated as soon as you finish a game. Each day's gains are capped, so the board can't be farmed in one sitting.";
    }
    return "Wins and best times count solo runs from the day ratings started, plus your older leaderboard scores.";
  }
  async function loadLeaderboard() {
    const body = document.getElementById("lb-body"), head = document.getElementById("lb-head"), chips = document.getElementById("lb-chips");
    const col = lbColumns(), sub = LB.sub[LB.tab];
    // paint the controls
    const game = LB.sub.rating;
    document.querySelectorAll("#lb-seg [data-game]").forEach((t) => t.classList.toggle("active", t.dataset.game === game));
    document.getElementById("lb-race").classList.toggle("hidden", !FirebaseClient.useFunctions());
    document.getElementById("lb-sort").value = LB.tab === "wins" ? "rating" : LB.tab;
    document.getElementById("lb-sort").disabled = game !== "bug";
    const fids = typeof Friends !== "undefined" ? Friends.ids() : [];
    const sc = document.getElementById("lb-scope");
    sc.classList.toggle("hidden", !fids.length);
    if (!fids.length) LB.friends = false;
    sc.querySelectorAll("[data-scope]").forEach((t) => t.classList.toggle("active", (t.dataset.scope === "friends") === LB.friends));
    chips.innerHTML = (LB_CHIPS[LB.tab] || []).filter(([id]) => id !== "race" || FirebaseClient.useFunctions()).map(([id, label]) => `<button type="button" class="lb-chip ${id === sub ? "active" : ""}" data-sub="${id}">${label}</button>`).join("");
    head.innerHTML = `<th>#</th>` + col.head.map((h, i) => `<th${i ? ' class="num"' : ""}>${h}</th>`).join("");
    const span = col.head.length + 1;
    body.innerHTML = `<tr><td colspan="${span}" style="color:var(--text-muted);">loading...</td></tr>`;
    document.getElementById("lb-note").textContent = lbNote(col);
    const stamp = LB.tab + sub; LB.stamp = stamp;
    try {
      const kind = LB.tab === "rating" ? (sub === "puzzle" ? "puzzle" : sub === "race" ? "race" : "bug") : LB.tab;
      const me = FirebaseClient.getUid();
      // FRIENDS reads each friend's own rating document (you included), so nobody is missed for not being in the top 100
      const rows = LB.friends && fids.length ? await FirebaseClient.fetchBoardFor(kind, sub, fids.concat(me)) : await FirebaseClient.fetchBoard(kind, sub);
      if (LB.stamp !== stamp) return; // another tab was opened meanwhile
      const list = rows;
      const row = (rank, name, avatar, cells, you, cls) => `<tr class="${you ? "you" : ""}">
          <td class="lb-rank ${cls || ""}">${rank}</td>
          <td class="lb-name">${typeof Rewards !== "undefined" ? Rewards.pfp(avatar) : ""}${esc(name)}${you ? ' <span class="lb-you">YOU</span>' : ""}</td>
          ${cells.map((c) => `<td class="num">${c}</td>`).join("")}</tr>`;
      let html = list.slice(0, 50).map((r, i) => row(i + 1, r.nickname, r.avatar, col.cells(r), r.uid === me, i < 3 ? "top" + (i + 1) : "")).join("");
      if (!list.length) html = `<tr><td colspan="${span}" style="color:var(--text-muted);">${LB.friends ? "none of you are on this board yet" : "no entries yet. be the first"}</td></tr>`;
      // your own row, pinned under the list when you're not in the top 50
      const at = list.findIndex((r) => r.uid === me);
      if (!LB.friends && (at >= 50 || (at < 0 && PlayerState.getNickname()))) {
        html += row(at >= 50 ? at + 1 : (rows.length >= 100 ? "100+" : "—"), PlayerState.getNickname(), PlayerState.getAvatar(), col.mine(), true, "");
      }
      body.innerHTML = html;
    } catch (err) {
      console.error(err);
      if (LB.stamp === stamp) body.innerHTML = `<tr><td colspan="${span}" style="color:var(--text-muted);">couldn't load. check your Firebase setup in config.js</td></tr>`;
    }
  }

  // ---------- game: spec rules + the bug ----------
  const editor = document.getElementById("code-editor");
  const lineNums = document.getElementById("line-numbers");
  const rulesList = document.getElementById("rules-list");
  const rulesPanel = document.getElementById("rules-panel");
  const progressEl = document.getElementById("rules-progress");
  const timerEl = document.getElementById("timer-display");
  const saveBtn = document.getElementById("save-btn");
  const modeLabel = document.getElementById("game-mode-label");
  const container = document.getElementById("editor-container");
  const lane = document.getElementById("bug-lane");
  const laneBug = document.getElementById("bug-live");
  const laneMsg = document.getElementById("bug-msg");
  const appetiteEl = document.getElementById("appetite");
  const segsEl = document.getElementById("appetite-segs");
  const appetiteTime = document.getElementById("appetite-time");
  const liveSyncs = document.getElementById("live-syncs");
  const liveBites = document.getElementById("live-bites");
  const liveCombo = document.getElementById("live-combo");
  const hintPop = document.getElementById("hint-pop");
  const MAX_HINTS = 2;

  const SEGS = 12, GRACE_MS = 5000, SYNC_COOLDOWN_MS = 2500, SYNC_SHOVE = 0.45, TICK_MS = 100;
  const sfx = (n) => { if (typeof Sound !== "undefined") Sound.play(n); };

  let task = null, mode = "singleplayer", difficulty = "easy", dead = false;
  let loop = null;
  // everything about the current run that the result screen and the share card need
  let run = null;
  let lastSummary = null;

  segsEl.innerHTML = "<i></i>".repeat(SEGS);
  const segNodes = [...segsEl.children];

  const ICON_DOT = '<svg viewBox="0 0 14 14" aria-hidden="true"><rect x="5" y="5" width="4" height="4" fill="currentColor"/></svg>';
  const ICON_OK = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 7.5l3.2 3.2L12 3.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const ICON_BAD = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2v6M7 10.5v1.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

  function buildRulesUI() {
    rulesList.innerHTML = task.rules.map((r, i) => `
      <li class="spec-rule" id="rule-${i}" style="--i:${i}">
        <span class="mark">${ICON_DOT}</span>
        <div><div class="txt">${r.html}</div><div class="hint"></div></div>
      </li>`).join("");
    progressEl.textContent = `0 / ${task.rules.length}`;
    rulesPanel.classList.remove("expanded");
    markFirstOpen([]);
  }
  function markFirstOpen(oks) {
    let idx = oks.findIndex((o) => !o);
    if (idx < 0) idx = oks.length ? oks.length - 1 : 0;
    task.rules.forEach((_, i) => document.getElementById(`rule-${i}`).classList.toggle("first-open", i === idx));
  }
  document.getElementById("rules-header").addEventListener("click", () => {
    if (window.matchMedia("(max-width: 720px)").matches) rulesPanel.classList.toggle("expanded");
  });

  function updateLines() {
    const n = editor.value.split("\n").length;
    let out = "";
    for (let i = 1; i <= n; i++) out += (i > 1 ? "\n" : "") + i;
    lineNums.textContent = out;
  }

  // checks the code against the spec, paints each rule, returns true on a win
  function evaluate() {
    if (dead || !task) return;
    const env = CodeParser.parseProgram(editor.value);
    const ev = task.evaluate(env);
    const oks = ev.results.map((r) => !!r.ok);
    ev.results.forEach((r, i) => {
      const el = document.getElementById(`rule-${i}`);
      const touched = task.rules[i].vars.some((v) => env.vars[v]);
      el.classList.toggle("passed", !!r.ok);
      el.classList.toggle("failed", !r.ok && touched);
      el.querySelector(".mark").innerHTML = r.ok ? ICON_OK : touched ? ICON_BAD : ICON_DOT;
      el.querySelector(".hint").textContent = r.ok || !touched ? "" : (r.hint || "");
    });
    markFirstOpen(oks);
    // combo: every rule satisfied for the first time since the last bite. A bite resets it.
    if (run && (mode === "singleplayer" || mode === "daily")) {
      let gained = 0;
      oks.forEach((ok, i) => { if (ok && !run.comboSet.has(i)) { run.comboSet.add(i); gained++; } });
      if (gained && !run.quiet) {
        run.combo += gained; run.bestCombo = Math.max(run.bestCombo, run.combo);
        liveCombo.textContent = run.combo;
        liveCombo.classList.remove("pop"); void liveCombo.offsetWidth; liveCombo.classList.add("pop");
      }
    }
    progressEl.textContent = `${ev.passed} / ${ev.total}`;
    if (run && run.lastPassed !== ev.passed) {
      run.lastPassed = ev.passed;
      document.dispatchEvent(new CustomEvent("debugr:rules", { detail: { passed: ev.passed, total: ev.total } }));
    }
    if (run) {
      if (ev.passed > run.bestPassed) { run.bestPassed = ev.passed; if (ev.passed < ev.total) sfx("rule"); }
    }
    if (ev.passed === ev.total && !(run && run.holdWin)) win();
  }

  // ----- the bug -----
  const bugMs = () => (TaskEngine.BUG_MS[difficulty] || 13000) * ((run && run.bugScale) || 1) * (mode === "singleplayer" ? Prefs.bugMult() : 1);
  let charW = 9;
  function measure() {
    const c = document.createElement("canvas").getContext("2d");
    c.font = getComputedStyle(editor).font;
    charW = c.measureText("M").width || 9;
  }
  function placeBug() {
    const lines = editor.value.split("\n");
    const row = lines.length - 1;
    const cs = getComputedStyle(editor);
    const lh = parseFloat(cs.lineHeight) || 30;
    const padL = parseFloat(cs.paddingLeft) || 0, padT = parseFloat(cs.paddingTop) || 0;
    const top = padT + row * lh - editor.scrollTop;
    let left = lineNums.offsetWidth + padL + lines[row].length * charW + 14 - editor.scrollLeft;
    left = Math.max(lineNums.offsetWidth + 6, Math.min(left, container.clientWidth - 150));
    lane.style.top = Math.max(0, Math.min(top, container.clientHeight - lh)) + "px";
    lane.style.left = left + "px";
  }

  function paintAppetite() {
    const a = run.appetite;
    const awake = run.awake;
    const lit = awake ? Math.ceil(a * SEGS - 1e-6) : 0;
    segNodes.forEach((s, i) => {
      s.className = i < lit ? ("on" + (i >= 9 ? " hot" : i >= 6 ? " warm" : "")) : "";
    });
    const left = (1 - a) * bugMs();
    appetiteEl.classList.toggle("asleep", !awake);
    appetiteEl.classList.toggle("danger", awake && a > 0.75);
    appetiteTime.textContent = awake ? (left / 1000).toFixed(1) + "s" : "bug is asleep";
    laneBug.classList.toggle("hungry", awake && a > 0.6);
    lane.style.visibility = /\S/.test(editor.value) ? "" : "hidden";
    if (performance.now() < run.msgUntil) return;
    laneMsg.classList.toggle("hot", awake && a > 0.8);
    laneMsg.textContent = !awake ? "zzz" : a > 0.8 ? "SYNC NOW" : a > 0.5 ? "so hungry..." : "sniffing...";
  }

  function say(text, ms, hot) {
    laneMsg.textContent = text;
    laneMsg.classList.toggle("hot", !!hot);
    run.msgUntil = performance.now() + ms;
  }

  function fmtClock(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function bite() {
    // the tutorial never takes your code: a bite is only a nibble
    if (mode === "tutorial") {
      run.appetite = 0.35; paintAppetite();
      say("nibble! in a real game that eats a line.", 2400, true); sfx("bite");
      return;
    }
    // forgiving mode (solo only): the first bite of a run is just a warning
    if (mode === "singleplayer" && Prefs.get("forgiving") && !run.warned) {
      run.warned = true; run.appetite = 0; paintAppetite();
      say("careful. the next one counts.", 1800, true); sfx("bite");
      return;
    }
    const lines = editor.value.split("\n");
    let i = lines.length - 1;
    while (i > 0 && !lines[i].trim()) i--;
    const eaten = lines[i];
    // remember what was eaten and which rule was still open, for the review on the result screen
    try {
      const open = task.evaluate(CodeParser.parseProgram(editor.value)).results.findIndex((r) => !r.ok);
      if (eaten && eaten.trim()) run.bitten.push({ line: eaten.trim(), sec: Math.floor((Date.now() - run.startedAt) / 1000), rule: open });
    } catch (_) { /* review is optional */ }
    lines.splice(i, 1);
    editor.value = lines.join("\n");
    run.bites++; run.biteSec = Math.floor((Date.now() - run.startedAt) / 1000);
    run.appetite = 0;
    PlayerState.bumpStat("bites");
    document.dispatchEvent(new CustomEvent("debugr:bite", { detail: { bites: run.bites } }));
    liveBites.textContent = run.bites;
    liveBites.classList.remove("green"); liveBites.classList.add("red");
    run.combo = 0; run.comboSet = new Set(); liveCombo.textContent = "0";
    updateLines(); placeBug(); run.quiet = true; evaluate(); run.quiet = false;
    container.classList.remove("bitten"); void container.offsetWidth; container.classList.add("bitten");
    crumbs();
    say("nom.", 1100, true);
    sfx("bite");
    if (eaten && navigator.vibrate) { try { navigator.vibrate(60); } catch { } }
  }
  function crumbs() {
    const r = lane.getBoundingClientRect(), c = container.getBoundingClientRect();
    for (let k = 0; k < 9; k++) {
      const el = document.createElement("i");
      el.className = "crumb";
      el.style.left = (r.left - c.left + 12) + "px";
      el.style.top = (r.top - c.top + 12) + "px";
      el.style.setProperty("--dx", (Math.random() * 60 - 30) + "px");
      el.style.setProperty("--dy", (Math.random() * 50 - 10) + "px");
      container.appendChild(el);
      setTimeout(() => el.remove(), 750);
    }
  }

  // hint (solo only): shows one line of the answer. The bug gets hungrier and the hint counts as a bite for the rating.
  function hint() {
    if (dead || !run || mode !== "singleplayer" || !task.solution) return;
    if (run.hints >= MAX_HINTS) { say("no hints left", 900); return; }
    const env = CodeParser.parseProgram(editor.value);
    const i = task.evaluate(env).results.findIndex((r) => !r.ok);
    if (i < 0) return;
    const v = task.rules[i].vars.find((x) => !env.vars[x]) || task.rules[i].vars[0];
    const sol = String(task.solution).split("\n");
    const line = sol.find((l) => l.startsWith(v + " = ")) || sol[0];
    run.hints++;
    run.appetite = Math.min(0.95, run.appetite + 0.25);
    document.getElementById("hint-left").textContent = MAX_HINTS - run.hints;
    hintPop.innerHTML = `<span>HINT</span> rule ${i + 1} wants <code></code>`;
    hintPop.querySelector("code").textContent = line;
    hintPop.classList.remove("hidden");
    clearTimeout(run.hintT); run.hintT = setTimeout(() => hintPop.classList.add("hidden"), 9000);
    paintAppetite();
  }
  document.getElementById("hint-btn").addEventListener("click", hint);
  window.App.hint = hint;

  function save() {
    if (dead || !run) return;
    const now = performance.now();
    if (now < run.syncReadyAt) { say("sync is cooling down", 700); sfx("error"); return; }
    run.syncReadyAt = now + SYNC_COOLDOWN_MS;
    run.syncs++;
    document.dispatchEvent(new CustomEvent("debugr:sync"));
    run.appetite = Math.max(0, run.appetite - SYNC_SHOVE);
    liveSyncs.textContent = run.syncs;
    saveBtn.classList.add("flash");
    setTimeout(() => saveBtn.classList.remove("flash"), 300);
    laneBug.classList.remove("shoved"); void laneBug.getBoundingClientRect(); laneBug.classList.add("shoved");
    say("hey!", 700);
    sfx("clear");
    saveBtn.style.setProperty("--cd", "1");
    paintAppetite();
  }

  function frame() {
    if (dead || !run) return;
    const now = performance.now();
    const dt = Math.min(250, now - run.last);
    run.last = now;
    const elapsed = Date.now() - run.startedAt;
    if (!run.awake && (run.typed || elapsed >= GRACE_MS)) {
      run.awake = true; say("awake.", 700);
      if (mode === "singleplayer") Ratings.markPending(difficulty, run.oppRating);
    }
    if (run.awake) {
      const edible = /\S/.test(editor.value);
      // nothing to eat yet: the bug waits at the edge of a bite instead of costing the player a free hit
      run.appetite = Math.min(edible ? 1 : 0.9, run.appetite + dt / bugMs());
      if (run.appetite >= 1) bite();
    }
    // one cell per second for the share grid: g = bug far, a = close call, r = bitten
    const sec = Math.floor(elapsed / 1000);
    while (run.track.length <= sec) {
      const i = run.track.length;
      run.track.push(run.biteSec === i ? "r" : run.awake && run.appetite > 0.6 ? "a" : "g");
    }
    if (run.biteSec === sec) run.track[sec] = "r";
    else if (run.awake && run.appetite > 0.6 && run.track[sec] === "g") run.track[sec] = "a";
    timerEl.textContent = fmtClock(elapsed);
    const cd = Math.max(0, (run.syncReadyAt - now) / SYNC_COOLDOWN_MS);
    saveBtn.style.setProperty("--cd", cd.toFixed(2));
    paintAppetite();
  }

  // ----- finishing -----
  function resampled(track) {
    const MAX = 16;
    if (track.length <= MAX) return track.slice();
    const rank = { g: 0, a: 1, r: 2 }, out = [];
    for (let i = 0; i < MAX; i++) {
      const from = Math.floor((i * track.length) / MAX), to = Math.max(from + 1, Math.floor(((i + 1) * track.length) / MAX));
      let worst = "g";
      for (let j = from; j < to; j++) if (rank[track[j]] > rank[worst]) worst = track[j];
      out.push(worst);
    }
    return out;
  }
  function dailyNumber(date) {
    const d = Date.parse((date || todayKey()) + "T00:00:00Z");
    return Math.floor((d - Date.UTC(2026, 0, 1)) / 86400000) + 1;
  }
  const SHARE_EMOJI = { g: "🟩", a: "🟨", r: "🟥" };
  // one text format for the result screen and the daily screen
  function buildShare({ daily, date, difficulty: diff, elapsedMs, bites, grid, streak }) {
    const head = daily ? `DEBUGR DAILY #${dailyNumber(date)} [${diff.toUpperCase()}]` : `DEBUGR [${diff.toUpperCase()}]`;
    const l2 = `${(elapsedMs / 1000).toFixed(1)}s · ${bites} ${bites === 1 ? "bite" : "bites"} · ${streak} day streak`;
    const cells = (grid && grid.length ? grid : ["g"]).map((c) => SHARE_EMOJI[c] || SHARE_EMOJI.g).join("");
    return { head, l2, cells, text: `${head}\n${l2}\n${cells}\nhttps://debugr.fun` };
  }

  function win() {
    if (dead) return;
    dead = true;
    clearInterval(loop); loop = null;
    lane.classList.add("hidden");
    const elapsedMs = Date.now() - run.startedAt;
    const sec = Math.floor(elapsedMs / 1000);
    while (run.track.length <= sec) run.track.push("g");
    const grid = resampled(run.track);
    run.elapsedMs = elapsedMs; run.grid = grid;
    sfx("win");

    if (mode === "tutorial") { document.dispatchEvent(new CustomEvent("debugr:tutorial-win")); return; }
    if (mode === "multiplayer") {
      // rooms.js writes the result and shows the round results once Firestore settles who won
      document.dispatchEvent(new CustomEvent("debugr:race-finish", { detail: { elapsedMs, bites: run.bites, syncs: run.syncs, grid: grid.join("") } }));
      return;
    }
    bumpDailyStreak();
    if (mode === "daily") {
      document.dispatchEvent(new CustomEvent("debugr:daily-win", { detail: { elapsedMs, difficulty, bites: run.bites, syncs: run.syncs, grid } }));
    } else {
      PlayerState.bumpStat("wins");
      Rewards.check();
      document.dispatchEvent(new CustomEvent("debugr:progress"));
      const streak = PlayerState.getStreakCache();
      streak.win = run.bites > 0 ? 0 : streak.win + 1;
      PlayerState.setStreakCache(streak);
      FirebaseClient.submitScore({ difficulty, elapsedMs, nickname: PlayerState.getNickname() }).catch(() => { });
      FirebaseClient.updateStreaks({ nickname: PlayerState.getNickname(), daily: streak.daily, win: streak.win }).catch(() => { });
      // rated: solo wins only. The change is worked out first so the result screen can show it straight away.
      const info = { diff: difficulty, opp: run.oppRating, bites: run.bites + run.hints, elapsedMs, winStreak: streak.win, task: TaskEngine.serializeTask(task), code: editor.value };
      run.ratingChange = Ratings.previewBug(info);
      Ratings.clearPending();
      Ratings.recordBug(info).catch(() => { });
    }
    showSuccess({ won: true, elapsedMs, isMultiplayer: false });
  }

  function showSuccess({ won, elapsedMs, isMultiplayer, opponentName }) {
    clearInterval(loop); loop = null; lane.classList.add("hidden");
    const screen = document.getElementById("success-screen");
    const eyebrow = document.getElementById("success-label");
    const bug = document.getElementById("success-bug");
    const r = run || { bites: 0, syncs: 0, track: ["g"], grid: ["g"] };
    screen.querySelector(".success-title").textContent = won ? "TASK CLEARED" : "TOO SLOW";
    eyebrow.textContent = won ? "SYNCED. BUG SQUASHED." : "DEFEAT";
    eyebrow.classList.toggle("lose", !won);
    bug.classList.toggle("flipped", won);
    document.getElementById("success-msg").textContent = won
      ? (r.bites === 0 ? "Clean run. The bug never touched your code." : "Rules satisfied. The script compiles.") + (r.bestCombo >= 3 ? ` Best combo x${r.bestCombo}.` : "")
      : `${opponentName || "An opponent"} synced first this round.`;
    document.getElementById("stat-time").textContent = (elapsedMs / 1000).toFixed(1) + "s";
    const sb = document.getElementById("stat-bites");
    sb.textContent = r.bites; sb.classList.toggle("green", r.bites === 0); sb.classList.toggle("red", r.bites > 0);
    document.getElementById("stat-syncs").textContent = r.syncs;
    document.getElementById("stat-streak").textContent = PlayerState.getStreakCache().win;
    document.getElementById("stat-diff").textContent = difficulty.toUpperCase();

    const showShare = won && mode !== "multiplayer";
    document.getElementById("share-card").classList.toggle("hidden", !showShare);
    document.getElementById("daily-share-btn").classList.toggle("hidden", !showShare);
    if (showShare) {
      const s = buildShare({ daily: mode === "daily", date: todayKey(), difficulty, elapsedMs, bites: r.bites, grid: r.grid, streak: PlayerState.getStreakCache().daily });
      lastSummary = s;
      document.getElementById("share-l1").textContent = s.head;
      document.getElementById("share-l2").textContent = s.l2;
      document.getElementById("share-grid").innerHTML = (r.grid || ["g"]).map((c) => `<i class="${c === "a" || c === "r" ? c : ""}"></i>`).join("");
    }
    paintRatingChange(won && mode === "singleplayer" ? r.ratingChange : null);
    paintReview(won && (mode === "singleplayer" || mode === "daily") ? r : null);
    document.getElementById("next-task-btn").classList.toggle("hidden", isMultiplayer || mode === "daily");
    document.getElementById("success-side").classList.add("hidden");
    screen.classList.remove("hidden");
    document.dispatchEvent(new CustomEvent("debugr:result", { detail: { won, mode } }));
  }

  // "what bit you": each eaten line, the rule that was still open, and the line that would have fixed it
  function paintReview(r) {
    const el = document.getElementById("review");
    const list = (r && r.bitten) || [];
    if (!r || !list.length) { el.classList.add("hidden"); el.open = false; return; }
    document.getElementById("review-n").textContent = `(${list.length})`;
    const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    // the line that would have satisfied the open rule, taken from the task's own solution
    const fixFor = (ri) => {
      if (!task || !task.solution || !task.rules[ri]) return "";
      const sol = String(task.solution).split("\n");
      for (const v of task.rules[ri].vars) { const l = sol.find((x) => x.startsWith(v + " = ")); if (l) return l; }
      return "";
    };
    // the Learn lesson that teaches what that rule is about
    const lessonFor = (ri) => {
      const k = task && task.rules[ri] ? String(task.rules[ri].key) : "";
      let id = "";
      if (/^num(Prime|Parity|Multiple|NotMultiple|Mod|TwoDivs|EvenAbove)$/.test(k)) id = "2.2";
      else if (/^num(Between|AtLeast|AtMost|AboveNum|Closer)$|^bool/.test(k)) id = "3.1";
      else if (/^num/.test(k)) id = "2.1";
      else if (/^list(Sum|Max|Min)|^listSumIs|^listMaxIs/.test(k)) id = "5.4";
      else if (/^list/.test(k)) id = "5.1";
      else if (/^str/.test(k)) id = "5.5";
      else if (k === "forbidName") id = "1.5";
      else if (k === "exactVars") id = "1.3";
      try { if (!id || !Unlocks.isUnlocked("learn")) return null; } catch { return null; }
      const l = typeof Lessons !== "undefined" && Lessons.CHAPTERS.flatMap((c) => c.lessons).find((x) => x.id === id);
      return l ? { id, title: l.title, locked: !(typeof Learn !== "undefined" && Learn.canOpen(id)) } : null;
    };
    document.getElementById("review-list").innerHTML = list.map((b) => {
      const fix = fixFor(b.rule), les = lessonFor(b.rule);
      return `<li><span class="rv-t">${fmtClock(b.sec * 1000)}</span> ate <code>${esc(b.line)}</code>`
        + (b.rule >= 0 && task && task.rules[b.rule] ? `<div class="rv-rule">still open: ${task.rules[b.rule].html}</div>` : "")
        + (fix ? `<div class="rv-fix">try: <code>${esc(fix)}</code></div>` : "")
        + (les ? (les.locked
          ? `<span class="rv-learn locked" title="Finish the earlier lessons on the Learn path to unlock this one">LOCKED: ${les.id} ${esc(les.title)}</span>`
          : `<button type="button" class="rv-learn" data-learn="${les.id}">LEARN: ${les.id} ${esc(les.title)}</button>`) : "") + `</li>`;
    }).join("")
      + (r.hints ? `<li class="rv-note">You used ${r.hints} hint${r.hints > 1 ? "s" : ""}. Each one counted as a bite for your rating.</li>` : "")
      + (task && task.solution ? `<li><details class="rv-sol"><summary>SHOW A FULL SOLUTION</summary><pre>${esc(String(task.solution))}</pre></details></li>` : "");
    el.open = true; el.classList.remove("hidden"); // open by default: it only appears when you were bitten
  }

  document.getElementById("review-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-learn]");
    if (b && typeof Learn !== "undefined") Learn.open(b.dataset.learn);
  });

  // "BEETLE 1184 +17" under the stats. Tier-ups and the daily cap get a line of their own.
  function paintRatingChange(c) {
    const el = document.getElementById("rating-change");
    if (!c) { el.classList.add("hidden"); el.innerHTML = ""; return; }
    const t = Rating.tierFor(c.after), sign = c.delta > 0 ? "+" : c.delta < 0 ? "−" : "±";
    const placing = Ratings.get().bug.g <= Rating.PLACEMENT;
    el.innerHTML = `<span class="rc-label">RATING</span><b class="rc-num">${placing ? c.after + "?" : c.after}</b>`
      + `<b class="rc-delta ${c.delta > 0 ? "up" : c.delta < 0 ? "down" : ""}">${sign}${Math.abs(c.delta)}</b>`
      + `<span class="rc-tier" style="color:${t.color}">${t.name}</span>`
      + (c.tierUp ? `<div class="rc-note up">NEW TIER: ${c.tierUp}</div>` : "")
      + (c.capped ? `<div class="rc-note">daily rating cap reached, more points tomorrow</div>` : "")
      + (placing ? `<div class="rc-note">placement game ${Math.min(Rating.PLACEMENT, Ratings.get().bug.g)} of ${Rating.PLACEMENT}</div>` : "");
    el.classList.remove("hidden");
  }

  async function copyText(text) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand("copy"); } catch { }
      ta.remove();
    }
    Rewards.toast(ok ? "Result copied" : "Couldn't copy it, sorry");
  }
  document.getElementById("daily-share-btn").addEventListener("click", () => { if (lastSummary) copyText(lastSummary.text); });
  window.App.buildShare = buildShare;
  window.App.copyText = copyText;
  window.App.dailyNumber = dailyNumber;

  function startGame(diff, gameMode, presetTask, opts) {
    difficulty = diff; mode = gameMode;
    task = presetTask || TaskEngine.generateTask(diff);
    dead = false;
    run = { oppRating: Rating.taskRating(task, diff), startedAt: Date.now(), last: performance.now(), appetite: 0, awake: false, typed: false, bites: 0, syncs: 0, track: [], biteSec: -1, bestPassed: 0, syncReadyAt: 0, msgUntil: 0, bugScale: (opts && opts.bugScale) || 1, lastPassed: -1, combo: 0, bestCombo: 0, comboSet: new Set(), hints: 0, bitten: [] };
    editor.value = "";
    modeLabel.textContent = `${{ singleplayer: "SOLO", daily: "DAILY", multiplayer: "RACE", tutorial: "TUTORIAL" }[gameMode]} · ${diff.toUpperCase()}`;
    document.getElementById("race-bar").classList.toggle("hidden", gameMode !== "multiplayer");
    liveCombo.textContent = "0";
    document.getElementById("combo-cell").classList.toggle("hidden", gameMode !== "singleplayer" && gameMode !== "daily");
    document.getElementById("hint-btn").classList.toggle("hidden", gameMode !== "singleplayer");
    document.getElementById("hint-left").textContent = MAX_HINTS;
    hintPop.classList.add("hidden");
    liveSyncs.textContent = "0"; liveBites.textContent = "0"; liveBites.classList.add("green"); liveBites.classList.remove("red");
    timerEl.textContent = "0:00";
    buildRulesUI(); updateLines();
    lane.classList.remove("hidden");
    showScreen("game");
    measure(); placeBug(); paintAppetite();
    clearInterval(loop);
    loop = setInterval(frame, TICK_MS);
    if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches) editor.focus();
  }
  function teardownGame() {
    clearInterval(loop); loop = null;
    // leaving a solo run after the bug woke up counts as a loss
    if (run && !dead && mode === "singleplayer" && run.awake) {
      Ratings.clearPending();
      Ratings.recordBug({ diff: difficulty, opp: run.oppRating, bites: run.bites, abandoned: true }).catch(() => { });
    }
    if (window.Rooms) Rooms.leave();
    task = null; run = null;
  }

  editor.addEventListener("input", () => {
    if (run) run.typed = true;
    updateLines(); placeBug(); evaluate();
  });
  editor.addEventListener("scroll", () => { lineNums.scrollTop = editor.scrollTop; placeBug(); });
  // auto-close quotes and brackets (settings: PLAY > editor). Typing the closer steps over it.
  editor.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !Prefs.get("autoClose")) return;
    const closers = { '"': '"', "'": "'", "[": "]", "(": ")" };
    const s = editor.selectionStart, t = editor.selectionEnd, v = editor.value;
    if ((e.key === "]" || e.key === ")" || e.key === '"' || e.key === "'") && s === t && v[s] === e.key) {
      e.preventDefault(); editor.selectionStart = editor.selectionEnd = s + 1; return;
    }
    if (closers[e.key] && s === t) {
      const quote = e.key === '"' || e.key === "'";
      if (quote && /[A-Za-z0-9_]/.test(v[s - 1] || "")) return; // an apostrophe inside a word, not a string
      e.preventDefault();
      editor.value = v.slice(0, s) + e.key + closers[e.key] + v.slice(t);
      editor.selectionStart = editor.selectionEnd = s + 1;
      if (run) run.typed = true;
      updateLines(); placeBug(); evaluate();
    }
  });
  editor.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const s = editor.selectionStart;
    editor.value = editor.value.slice(0, s) + "    " + editor.value.slice(editor.selectionEnd);
    editor.selectionStart = editor.selectionEnd = s + 4;
    updateLines(); placeBug(); evaluate();
  });
  window.addEventListener("resize", () => { if (run) { measure(); placeBug(); } });
  saveBtn.addEventListener("click", save);
  document.getElementById("next-task-btn").addEventListener("click", () => startGame(difficulty, mode));

  // keyboard-aware height on phones: the visual viewport shrinks when the keyboard opens
  if (window.visualViewport) {
    const fit = () => {
      // the desktop layout is zoomed 1.2x (see style.css), so only phones and tablets size to the keyboard-aware viewport
      if (window.matchMedia("(min-width: 1100px)").matches) document.documentElement.style.removeProperty("--app-h");
      else document.documentElement.style.setProperty("--app-h", window.visualViewport.height + "px");
      if (window.scrollY) window.scrollTo(0, 0);
    };
    window.visualViewport.addEventListener("resize", fit);
    window.visualViewport.addEventListener("scroll", fit);
    fit();
  }

  // symbol row (phones): inserts at the caret, pairs quotes and brackets
  let lastEditor = editor;
  [editor, document.getElementById("debug-editor")].forEach((el) => el.addEventListener("focus", () => { lastEditor = el; }));
  document.querySelectorAll(".symbol-row").forEach((row) => {
    row.addEventListener("pointerdown", (e) => e.preventDefault()); // keep the keyboard open
    row.addEventListener("click", (e) => {
      const b = e.target.closest("[data-sym]");
      if (!b) return;
      const ed = row.closest(".editor-panel").querySelector("textarea") || lastEditor;
      const sym = b.dataset.sym;
      const pair = { '"': '""', "[": "[]", "(": "()" }[sym];
      const ins = pair || (sym === "=" ? " = " : sym === "," ? ", " : sym);
      const s = ed.selectionStart, t = ed.selectionEnd;
      ed.value = ed.value.slice(0, s) + ins + ed.value.slice(t);
      ed.selectionStart = ed.selectionEnd = s + (pair ? 1 : ins.length);
      ed.focus();
      ed.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  init();
})();