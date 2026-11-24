const Tutorial = (() => {
  // the short "where is everything" tour that runs after the missions
  const steps = [
    {
      screen: "menu", selector: '[data-action="learn"]', title: "LEARN IS OPEN",
      body: "New to code? Short Python lessons from zero, with a little bug giving tips. It is open now, no rush."
    },
    {
      screen: "menu", selector: "#getting-started", title: "YOUR GOAL LIST",
      body: "Everything else starts locked. Each part opens when you use the one before it, and a short guide plays when it does. This list shows what is next."
    },
    {
      screen: "menu", selector: "#settings-btn", title: "SETTINGS",
      body: "Themes and your own colors, bug speed, accessibility options, cloud save and a feedback form. Press S to open it any time."
    },
  ];

  let idx = 0;
  const overlay = document.getElementById("tutorial-overlay");

  function render() {
    const step = steps[idx];
    if (typeof Unlocks !== "undefined" && Unlocks.endTour) Unlocks.endTour(); // never show the menu guide on top of this one
    window.App.showScreen(step.screen, { forTutorial: true });
    if (step.before) step.before();

    requestAnimationFrame(() => {
      const target = document.querySelector(step.selector);
      // not on screen (missing, or hidden like the streak chip on phones): skip it
      if (!target || target.offsetWidth === 0) return next();

      target.scrollIntoView({ block: "center" });
      overlay.innerHTML = "";
      overlay.classList.remove("hidden");


      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;width:100px;height:1px;visibility:hidden";
      overlay.appendChild(probe);
      const z = probe.getBoundingClientRect().width / 100 || 1;
      probe.remove();
      const vw = window.innerWidth / z, vh = window.innerHeight / z;

      const b = target.getBoundingClientRect();
      const r = { left: b.left / z, top: b.top / z, right: b.right / z, bottom: b.bottom / z, width: b.width / z, height: b.height / z };
      const pad = 8;

      const ring = document.createElement("div");
      ring.className = "tutorial-highlight-ring";
      ring.style.left = `${r.left - pad}px`;
      ring.style.top = `${r.top - pad}px`;
      ring.style.width = `${r.width + pad * 2}px`;
      ring.style.height = `${r.height + pad * 2}px`;
      overlay.appendChild(ring);

      const tooltip = document.createElement("div");
      tooltip.className = "tutorial-tooltip";
      tooltip.innerHTML = `
        <div class="tt-step">STEP ${idx + 1} / ${steps.length}</div>
        <div class="tt-title">${step.title}</div>
        <div class="tt-body">${step.body}</div>
        <div class="tt-actions">
          <span class="tt-skip" id="tt-skip">SKIP TUTORIAL</span>
          <button class="btn small primary" id="tt-next">${idx === steps.length - 1 ? "FINISH" : "NEXT"}</button>
        </div>`;
      overlay.appendChild(tooltip);
      // put the card where it never covers what it points at: below, above, right, left, else the roomiest side
      const tw = tooltip.offsetWidth, th = tooltip.offsetHeight, gap = pad + 12, m = 12;
      const clampX = (x) => Math.max(m, Math.min(vw - tw - m, x)), clampY = (y) => Math.max(m, Math.min(vh - th - m, y));
      const spots = [
        { ok: r.bottom + gap + th <= vh - m, x: clampX(r.left), y: r.bottom + gap },
        { ok: r.top - gap - th >= m, x: clampX(r.left), y: r.top - gap - th },
        { ok: r.right + gap + tw <= vw - m, x: r.right + gap, y: clampY(r.top) },
        { ok: r.left - gap - tw >= m, x: r.left - gap - tw, y: clampY(r.top) },
      ];
      const pick = spots.find((s) => s.ok) || { x: clampX(r.left), y: vh - r.bottom > r.top ? clampY(r.bottom + gap) : clampY(r.top - gap - th) };
      tooltip.style.left = `${pick.x}px`; tooltip.style.top = `${pick.y}px`;

      document.getElementById("tt-next").onclick = next;
      document.getElementById("tt-skip").onclick = finish;
    });
  }

  function next() {
    idx++;
    if (idx >= steps.length) return finish();
    render();
  }

  function finish() {
    overlay.classList.add("hidden");
    overlay.innerHTML = "";
    PlayerState.markTutorialDone();
    window.App.showScreen("menu");
  }

  // ---------- playable missions ----------
  // each mission is a real (tiny) task on the real game screen. rules are built with the same whitelist as rooms.
  const MISSIONS = [
    { title: "MEET THE BUG", scale: 60, rules: [{ key: "numDouble", params: { a: "age", n: 12 } }], solution: "age = 6",
      text: 'Rule 1 says "twice age equals 12". Type a variable that makes it true. The bug is asleep for now.',
      tip: "Type  age = 6  in the editor." },
    { title: "IT WAKES UP", scale: 0.2, hold: true, rules: [{ key: "strLen", params: { a: "name", n: 4 } }, { key: "strStarts", params: { a: "name", ch: "e" } }], solution: 'name = "echo"',
      text: "Solve both rules about name. When the bug gets hungry, press SYNC (or Ctrl+S) to push it back. You need to SYNC once to pass.",
      tip: 'Try  name = "echo"  then press SYNC.' },
    { title: "RULES TALK", scale: 40, rules: [{ key: "numDouble", params: { a: "age", n: 12 } }, { key: "numPlusNum", params: { a: "limit", b: "age", k: 9 } }], solution: "age = 6\nlimit = 15",
      text: "Rules can use each other. limit depends on age, so work out age first.",
      tip: "age is 6, so limit is 15." },
    { title: "READ THE CLUE", scale: 40, rules: [{ key: "numDouble", params: { a: "age", n: 12 } }, { key: "listMaxIsNum", params: { a: "items", b: "age", k: 6 } }], solution: "age = 6\nitems = [3, 9, 12]",
      text: "Amber text under a rule says what is missing. Define age, then read what it says about items.",
      tip: "items is a list: items = [3, 9, 12] has a biggest number of 12 = age + 6." },
    { title: "BEAT THE CLOCK", scale: 1.5, real: true,
      text: "A real easy task. The bug wakes up when you start typing. Finish before it gets hungry too often." },
  ];

  const card = document.getElementById("tutorial-mission");
  document.querySelector(".app-wrapper").appendChild(card); // inside the app box, so it moves with the phone keyboard
  let mi = 0, mActive = false, mTimers = [], mSynced = false, mTask = null;

  function clearTimers() { mTimers.forEach(clearTimeout); mTimers = []; }
  const q = (sel) => card.querySelector(sel);
  const editorEl = () => document.getElementById("code-editor");

  function missionCard(extra) {
    const m = MISSIONS[mi];
    card.classList.remove("hidden");
    card.innerHTML = `
      <div class="tm-top"><span class="tm-step">MISSION ${mi + 1} / ${MISSIONS.length}</span>
        <span class="tm-dots">${MISSIONS.map((_, i) => `<i class="${i < mi ? "done" : i === mi ? "now" : ""}"></i>`).join("")}</span></div>
      <div class="tm-title">${m.title}</div>
      <div class="tm-text">${m.text}</div>
      <div class="tm-tip hidden" id="tm-tip"></div>
      <div class="tm-actions"><span class="tt-skip" id="tm-skip">SKIP TUTORIAL</span><button class="btn small hidden" id="tm-show" type="button">SHOW ME</button></div>
      ${extra || ""}`;
    q("#tm-skip").onclick = () => quit(false);
    q("#tm-show").onclick = () => {
      const ed = editorEl(), sol = (mTask && mTask.solution) || m.solution;
      if (!ed || !sol) return;
      ed.value = sol; ed.dispatchEvent(new Event("input", { bubbles: true }));
    };
  }

  function armHints() {
    clearTimers();
    const m = MISSIONS[mi];
    // a gentle tip after 8 seconds without a finished mission, a SHOW ME button after 20
    mTimers.push(setTimeout(() => {
      const tip = card.querySelector("#tm-tip");
      if (tip && m.tip) { tip.textContent = m.tip; tip.classList.remove("hidden"); }
    }, 8000));
    mTimers.push(setTimeout(() => { const b = card.querySelector("#tm-show"); if (b) b.classList.remove("hidden"); }, 20000));
  }

  function runMission() {
    const m = MISSIONS[mi];
    mSynced = false; mActive = true;
    mTask = m.real ? TaskEngine.generateTask("easy") : TaskEngine.rebuildTask({ id: "tutorial-" + (mi + 1), difficulty: "easy", rules: m.rules });
    window.App.startGame("easy", "tutorial", mTask, { bugScale: m.scale });
    if (m.hold) window.App.holdWin(true);
    missionCard();
    armHints();
  }

  document.addEventListener("debugr:sync", () => {
    if (!mActive || !MISSIONS[mi].hold || mSynced) return;
    mSynced = true;
    window.App.holdWin(false); // wins right away if the rules are already met
    const t = card.querySelector("#tm-tip");
    if (t) { t.textContent = "Synced! The bug backs off."; t.classList.remove("hidden"); }
  });
  document.addEventListener("debugr:rules", (e) => {
    if (!mActive || !MISSIONS[mi].hold || mSynced) return;
    const t = card.querySelector("#tm-tip");
    if (t && e.detail.passed === e.detail.total) { t.textContent = "Rules met. Now press SYNC to finish."; t.classList.remove("hidden"); }
  });
  document.addEventListener("debugr:tutorial-win", () => {
    if (!mActive) return;
    clearTimers();
    missionCard(`<div class="tm-done">MISSION COMPLETE</div>`);
    mTimers.push(setTimeout(() => {
      mi++;
      if (mi >= MISSIONS.length) return finishMissions();
      runMission();
    }, 1400));
  });
  // leaving the game screen (Esc, the logo...) ends the tutorial missions quietly
  document.addEventListener("debugr:screen", (e) => { if (mActive && e.detail.name !== "game") quit(true); });

  function stopMissions() {
    clearTimers(); mActive = false;
    card.classList.add("hidden"); card.innerHTML = "";
  }
  function quit(already) {
    stopMissions();
    if (!already) { try { window.App.stopRun(); } catch { /* no run */ } }
    PlayerState.markTutorialDone();
    if (!already) window.App.showScreen("menu");
  }
  function finishMissions() {
    stopMissions();
    try { window.App.stopRun(); } catch { /* no run */ }
    document.dispatchEvent(new CustomEvent("debugr:tutorial-complete"));
    if (typeof Rewards !== "undefined") Rewards.toast("Tutorial complete. Welcome, debugger.", 3600);
    idx = 0; render(); // short tour of the menu
  }

  function start() {
    stopMissions();
    mi = 0;
    runMission();
  }

  window.addEventListener("resize", () => { if (!overlay.classList.contains("hidden")) render(); });

  return { start, tour: () => { idx = 0; render(); } };
})();