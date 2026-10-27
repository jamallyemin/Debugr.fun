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
    menu: "screen-menu", difficulty: "screen-difficulty", host: "screen-host",
    join: "screen-join", leaderboard: "screen-leaderboard", game: "screen-game",
    puzzleSelect: "screen-puzzle-select", puzzles: "screen-puzzles", daily: "screen-daily",
  };
  let currentRoomCode = null;
  let roomUnsubscribers = [];

  let currentScreen = "menu";
  function showScreen(name) {
    for (const id of Object.values(SCREENS)) document.getElementById(id).classList.add("hidden");
    document.getElementById(SCREENS[name]).classList.remove("hidden");
    document.getElementById("success-screen").classList.add("hidden");
    currentScreen = name;
    document.dispatchEvent(new CustomEvent("debugr:screen", { detail: { name } }));
  }
  function goHome() { teardownGame(); showScreen("menu"); }
  // bridge for tutorial.js, keys.js, daily.js and the puzzles
  window.App = {
    showScreen, goHome, startGame,
    current: () => currentScreen,
    inRun: () => currentScreen === "game" && !!task && !dead,
  };

  // header: nickname + streak display
  function refreshHeader() {
    document.getElementById("nickname-display").textContent = PlayerState.getNickname() || "GUEST";
    const streak = PlayerState.getStreakCache();
    document.getElementById("streak-count").textContent = streak.daily;
    document.getElementById("streak-chip").classList.toggle("hot", streak.daily >= 3);
    if (typeof Rewards !== "undefined") Rewards.refresh();
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
    confirmNicknameBtn.textContent = "[ CHECKING... ]";
    const result = await FirebaseClient.claimNickname(name);
    confirmNicknameBtn.disabled = false;
    confirmNicknameBtn.textContent = "[ CONFIRM ]";

    if (!result.allowed) return (nicknameError.textContent = result.reason);

    PlayerState.setNickname(name);
    nicknamePrompt.classList.add("hidden");
    refreshHeader();
    maybeShowTutorialPrompt();
  }
  confirmNicknameBtn.addEventListener("click", trySubmitNickname);
  nicknameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") trySubmitNickname(); });

  document.getElementById("change-nickname-btn").addEventListener("click", () => {
    nicknameInput.value = PlayerState.getNickname() || "";
    nicknamePrompt.classList.remove("hidden");
  });

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
  }

  // menu navigation
  document.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", () => {
      const action = el.dataset.action;
      if (action === "singleplayer") showScreen("difficulty");
      if (action === "host") showScreen("host");
      if (action === "join") showScreen("join");
      if (action === "leaderboard") { showScreen("leaderboard"); loadLeaderboard("easy"); }
      if (action === "puzzles") { showScreen("puzzleSelect"); PuzzleUI.renderPath(); }
      if (action === "back-to-menu") { teardownGame(); showScreen("menu"); }
    });
  });
  document.getElementById("logo-home-btn").addEventListener("click", () => { teardownGame(); showScreen("menu"); });

  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return; // dont jump around while typing
    if (document.querySelector(".modal-backdrop:not(.hidden)")) return;
    if (!document.getElementById(SCREENS.menu).classList.contains("hidden")) {
      const act = { 1: "singleplayer", 2: "host", 3: "join", 4: "leaderboard", 5: "puzzles" }[e.key];
      // preventDefault so keys.js doesnt also treat the same 1/2/3 as a difficulty pick
      if (act) { e.preventDefault(); document.querySelector(`[data-action="${act}"]`).click(); }
    }
  });

  // difficulty select (singleplayer path)
  document.querySelectorAll("#screen-difficulty .diff-card").forEach((card) => {
    card.addEventListener("click", () => startGame(card.dataset.diff, "singleplayer"));
  });

  // host lobby
  document.querySelectorAll("#host-pre-code .diff-card").forEach((card) => {
    card.addEventListener("click", async () => {
      const diff = card.dataset.diff;
      const code = await FirebaseClient.hostRoom(diff, PlayerState.getNickname());
      currentRoomCode = code;
      document.getElementById("host-pre-code").classList.add("hidden");
      document.getElementById("host-post-code").classList.remove("hidden");
      document.getElementById("room-code-value").textContent = code.split("").join(" ");
      subscribeToRoom(code, diff);
    });
  });
  document.getElementById("start-race-btn").addEventListener("click", () => {
    if (currentRoomCode) FirebaseClient.startRace(currentRoomCode, hostDifficulty);
  });

  let hostDifficulty = "easy";
  function subscribeToRoom(code, difficulty) {
    hostDifficulty = difficulty;
    roomUnsubscribers.forEach((u) => u());
    roomUnsubscribers = [];

    roomUnsubscribers.push(FirebaseClient.listenRoomPlayers(code, (players) => {
      const hostList = document.getElementById("host-player-list");
      hostList.innerHTML = players.map((p) => `<li>${Rewards.pfp(p.avatar)}${esc(p.nickname)}<span class="status">READY</span></li>`).join("");
      document.getElementById("start-race-btn").disabled = players.length < 2;

      const joinList = document.getElementById("join-player-list");
      if (joinList) {
        joinList.innerHTML = players.map((p) => `<li>${Rewards.pfp(p.avatar)}${esc(p.nickname)}</li>`).join("");
        document.getElementById("join-waiting").classList.remove("hidden");
      }
      renderOpponents(players);
    }));

    roomUnsubscribers.push(FirebaseClient.listenRoomState(code, (state) => {
      if (state.started && state.task && task?.id !== state.task.id) {
        startGame(state.difficulty, "multiplayer", TaskEngine.rebuildTask(state.task));
      }
      if (state.winnerUid && !raceDone) {
        raceDone = true;
        const iWon = state.winnerUid === FirebaseClient.getUid();
        if (iWon) { PlayerState.bumpStat("wins"); Rewards.check(); }
        showSuccess({ won: iWon, elapsedMs: state.winnerElapsedMs, isMultiplayer: true, opponentName: state.winnerNickname });
      }
    }));
  }

  // join lobby
  document.getElementById("join-submit-btn").addEventListener("click", async () => {
    const code = document.getElementById("join-code-input").value.trim().toUpperCase();
    const errEl = document.getElementById("join-error");
    errEl.textContent = "";
    if (code.length !== 4) return (errEl.textContent = "Enter the 4-character room code.");
    try {
      const roomData = await FirebaseClient.joinRoom(code, PlayerState.getNickname());
      currentRoomCode = code;
      subscribeToRoom(code, roomData.difficulty);
    } catch (err) {
      errEl.textContent = err.message || "Couldn't join that room.";
    }
  });

  function renderOpponents(players) {
    const strip = document.getElementById("opponents-strip");
    if (players.length < 2) return strip.classList.add("hidden");
    strip.classList.remove("hidden");
    strip.innerHTML = players
      .filter((p) => p.token !== FirebaseClient.getUid())
      .map((p) => `<span class="opponent-chip ${p.done ? "done" : ""}">${Rewards.pfp(p.avatar)}${esc(p.nickname)}${p.done ? " ✓" : "…"}</span>`)
      .join("");
  }

  // leaderboard
  document.querySelectorAll(".lb-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".lb-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      loadLeaderboard(tab.dataset.lbtab);
    });
  });
  async function loadLeaderboard(tab) {
    const body = document.getElementById("lb-body");
    body.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted);">loading...</td></tr>`;
    try {
      const rows = await FirebaseClient.fetchLeaderboard(tab);
      if (!rows.length) return (body.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted);">no entries yet — be the first</td></tr>`);
      let html = "";
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rankClass = i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : "";
        html += `
          <tr class="${r.token === FirebaseClient.getUid() ? "you" : ""}">
            <td class="lb-rank ${rankClass}">${i + 1}</td>
            <td>${esc(r.nickname)}</td><td>${r.wins}</td><td>${r.bestTime ?? "—"}</td><td>${r.winStreak}</td>
          </tr>`;
      }
      body.innerHTML = html;
    } catch (err) {
      console.error(err);
      body.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted);">couldn't load — check your Firebase setup in config.js</td></tr>`;
    }
  }

  // game loop (single + multi share this)
  const editor = document.getElementById("code-editor");
  const lineNums = document.getElementById("line-numbers");
  const rulesList = document.getElementById("rules-list");
  const progressEl = document.getElementById("rules-progress");
  const timerEl = document.getElementById("timer-display");
  const saveBtn = document.getElementById("save-btn");
  const modeLabel = document.getElementById("game-mode-label");

  let task = null, mode = "singleplayer", difficulty = "easy", raceDone = false;
  let secs = 45, dead = false, hadShred = false, tick = null, shred = null, startedAt = 0;

  function buildRulesUI() {
    let html = "";
    for (let i = 0; i < task.rules.length; i++) {
      html += `
        <li class="rule-item visible" id="rule-${i}">
          <div class="rule-num">${i + 1}</div>
          <div class="rule-body"><div class="rule-text">${task.rules[i].text}</div><div class="rule-status">✗ NOT MET</div></div>
        </li>`;
    }
    rulesList.innerHTML = html;
    progressEl.textContent = `TASK · 0 / ${task.rules.length}`;
  }

  function updateLines() {
    const n = editor.value.split("\n").length;
    let out = "";
    for (let i = 1; i <= n; i++) out += (i > 1 ? "\n" : "") + i;
    lineNums.textContent = out;
  }

  function run() {
    if (dead) return;
    const vars = CodeParser.parseCode(editor.value);
    let ok = 0;
    for (let i = 0; i < task.rules.length; i++) {
      const rule = task.rules[i];
      const el = document.getElementById(`rule-${i}`);
      let pass;
      try { pass = rule.validate(vars); } catch { pass = false; }
      el.classList.toggle("passed", pass);
      el.classList.toggle("failed", !pass);
      el.querySelector(".rule-status").textContent = pass ? "✓ SATISFIED" : "✗ NOT MET";
      if (pass) ok++;
    }
    progressEl.textContent = `TASK · ${ok} / ${task.rules.length}`;
    if (ok === task.rules.length) win(vars);
  }

  function win(vars) {
    dead = true;
    clearInterval(tick); clearInterval(shred); shred = null;
    editor.classList.remove("destroying");
    const elapsedMs = Date.now() - startedAt;

    if (mode === "multiplayer") {
      FirebaseClient.submitRaceSolution(currentRoomCode, PlayerState.getNickname(), elapsedMs);
      // room listener's winnerUid callback (see subscribeToRoom) shows the
      // success/defeat screen once the Firestore transaction settles
    } else if (mode === "daily") {
      bumpDailyStreak();
      document.dispatchEvent(new CustomEvent("debugr:daily-win", { detail: { elapsedMs, difficulty } }));
      showSuccess({ won: true, elapsedMs, isMultiplayer: false });
    } else {
      bumpDailyStreak();
      PlayerState.bumpStat("wins");
      Rewards.check();
      document.dispatchEvent(new CustomEvent("debugr:progress"));
      const streak = PlayerState.getStreakCache();
      streak.win = hadShred ? 0 : streak.win + 1;
      PlayerState.setStreakCache(streak);
      FirebaseClient.submitScore({ difficulty, elapsedMs, nickname: PlayerState.getNickname() }).catch(() => { });
      FirebaseClient.updateStreaks({ nickname: PlayerState.getNickname(), daily: streak.daily, win: streak.win }).catch(() => { });
      showSuccess({ won: true, elapsedMs, isMultiplayer: false });
    }
  }

  function showSuccess({ won, elapsedMs, isMultiplayer, opponentName }) {
    const screen = document.getElementById("success-screen");
    const title = screen.querySelector(".success-title");
    const label = screen.querySelector(".success-label");
    const msg = document.getElementById("success-msg");
    title.textContent = won ? "TASK CLEARED" : "TOO SLOW";
    label.textContent = won ? "SUCCESS" : "DEFEAT";
    label.style.color = won ? "var(--green)" : "var(--red)";
    msg.textContent = won
      ? "Rules satisfied. The script compiles."
      : `${opponentName || "An opponent"} synced first this round.`;
    document.getElementById("stat-time").textContent = (elapsedMs / 1000).toFixed(1) + "s";
    document.getElementById("stat-streak").textContent = PlayerState.getStreakCache().win;
    document.getElementById("stat-diff").textContent = difficulty.toUpperCase();
    document.getElementById("next-task-btn").classList.toggle("hidden", isMultiplayer || mode === "daily");
    document.getElementById("daily-share-btn").classList.toggle("hidden", mode !== "daily" || !won);
    screen.classList.remove("hidden");
  }

  function drawTimer() {
    timerEl.textContent = secs;
    timerEl.classList.toggle("urgent", secs <= 15);
  }
  function startShredding() {
    if (shred || dead) return;
    hadShred = true;
    editor.classList.add("destroying");
    shred = setInterval(() => {
      const lines = editor.value.split("\n");
      editor.value = lines.length > 1 ? lines.slice(0, -1).join("\n") : "";
      updateLines(); run();
    }, 1000);
  }
  function save() {
    if (dead) return;
    secs = 45;
    clearInterval(shred); shred = null;
    editor.classList.remove("destroying");
    saveBtn.classList.add("flash");
    setTimeout(() => saveBtn.classList.remove("flash"), 300);
    drawTimer();
  }

  function startGame(diff, gameMode, presetTask) {
    difficulty = diff; mode = gameMode;
    task = presetTask || TaskEngine.generateTask(diff);
    dead = false; hadShred = false; raceDone = false; secs = 45; startedAt = Date.now();
    editor.value = "";
    modeLabel.textContent = `${{ singleplayer: "SINGLEPLAYER", daily: "DAILY", multiplayer: "RACE" }[gameMode]} · ${diff.toUpperCase()}`;
    document.getElementById("opponents-strip").classList.toggle("hidden", gameMode !== "multiplayer");
    buildRulesUI(); updateLines(); drawTimer();
    clearInterval(tick);
    tick = setInterval(() => {
      if (dead) return;
      if (--secs <= 0) { secs = 0; startShredding(); }
      drawTimer();
    }, 1000);
    showScreen("game");
  }
  function teardownGame() {
    clearInterval(tick); clearInterval(shred); tick = shred = null;
    if (currentRoomCode) FirebaseClient.leaveRoom(currentRoomCode);
    roomUnsubscribers.forEach((u) => u());
    roomUnsubscribers = [];
    currentRoomCode = null;
    task = null;
    // put the host / join screens back to how they start, otherwise they show the old room
    document.getElementById("host-pre-code").classList.remove("hidden");
    document.getElementById("host-post-code").classList.add("hidden");
    document.getElementById("host-player-list").innerHTML = "";
    document.getElementById("join-waiting").classList.add("hidden");
    document.getElementById("join-player-list").innerHTML = "";
    document.getElementById("join-code-input").value = "";
    document.getElementById("join-error").textContent = "";
  }

  editor.addEventListener("input", () => { updateLines(); run(); });
  editor.addEventListener("scroll", () => { lineNums.scrollTop = editor.scrollTop; });
  editor.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const s = editor.selectionStart;
    editor.value = editor.value.slice(0, s) + "    " + editor.value.slice(editor.selectionEnd);
    editor.selectionStart = editor.selectionEnd = s + 4;
    updateLines(); run();
  });
  saveBtn.addEventListener("click", save);
  document.getElementById("next-task-btn").addEventListener("click", () => startGame(difficulty, mode));

  init();
})();