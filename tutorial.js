const Tutorial = (() => {
  const steps = [
    {
      screen: "menu", selector: "#screen-menu .menu-options", title: "PICK A MODE",
      body: "Singleplayer plays solo. Host or Join puts you in a live room with friends. All three feed the same leaderboard."
    },
    {
      screen: "menu", selector: "#daily-hero", title: "DAILY CHALLENGE",
      body: "One task a day, the same for everyone. Clear it to get on today's ranking. Press D to start it. A new one arrives at 00:00 UTC."
    },
    {
      screen: "menu", selector: ".identity-badge", title: "YOUR CALLSIGN",
      body: "This nickname is what shows up on the leaderboard. No login needed. It's remembered on this device."
    },
    {
      screen: "menu", selector: "#streak-chip", title: "STREAKS",
      body: "Play once a day to build a daily streak. Win in a row to build a win streak. Both are ranked on the leaderboard."
    },
    {
      screen: "puzzleSelect", selector: "#puzzle-tabs", title: "PUZZLES",
      before: () => { if (typeof PuzzleUI !== "undefined") PuzzleUI.renderPath(); },
      body: "Three tracks: fix broken code (SYNTAX), fill in the blanks (COMPLETE) and fix type errors (TYPEFIX). Clear a level to unlock the next one. They never run out."
    },
    {
      screen: "difficulty", selector: "#screen-difficulty .difficulty-cards", title: "DIFFICULTY",
      body: "Easy = 1 rule per task. Medium = 3. Hard = 5. Every task is freshly generated: nothing repeats, nothing contradicts itself."
    },
    {
      screen: "difficulty", selector: "#key-chip", title: "GOING BACK",
      body: "Press ESC on any screen to go back (or click this button). Press ? to see every keyboard shortcut."
    },
    {
      screen: "game", selector: "#rules-list", title: "THE RULES PANEL",
      body: "Your current task's rules appear here. Satisfy every rule at once to clear it."
    },
    {
      screen: "game", selector: ".code-editor", title: "THE EDITOR",
      body: 'Write assignments like name = 42, name = "hi", or name = ["a","b"]. Anything else is ignored.'
    },
    {
      screen: "game", selector: "#save-btn", title: "SYNC MEMORY",
      body: "Click this or press Ctrl+S before the timer hits zero, or the editor starts deleting your code from the bottom, one line per second."
    },
    {
      screen: "menu", selector: "#settings-btn", title: "SETTINGS",
      body: "Sound and volume, light or dark theme with your own colors, screen effects, cloud save and a feedback form. Press S to open it any time."
    },
  ];

  let idx = 0;
  const overlay = document.getElementById("tutorial-overlay");

  function render() {
    const step = steps[idx];
    window.App.showScreen(step.screen, { forTutorial: true });
    if (step.before) step.before();

    requestAnimationFrame(() => {
      const target = document.querySelector(step.selector);
      // not on screen (missing, or hidden like the streak chip on phones): skip it
      if (!target || target.offsetWidth === 0) return next();

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
      const tipTop = r.bottom + 16 + 200 < vh ? r.bottom + 16 : Math.max(16, r.top - 190);
      let tipLeft = r.left;
      if (tipLeft + 260 > vw) tipLeft = vw - 276;
      tooltip.style.top = `${tipTop}px`;
      tooltip.style.left = `${Math.max(16, tipLeft)}px`;
      tooltip.innerHTML = `
        <div class="tt-step">STEP ${idx + 1} / ${steps.length}</div>
        <div class="tt-title">${step.title}</div>
        <div class="tt-body">${step.body}</div>
        <div class="tt-actions">
          <span class="tt-skip" id="tt-skip">SKIP TUTORIAL</span>
          <button class="btn small primary" id="tt-next">${idx === steps.length - 1 ? "[ FINISH ]" : "[ NEXT ]"}</button>
        </div>`;
      overlay.appendChild(tooltip);

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

  function start() {
    idx = 0;
    render();
  }

  window.addEventListener("resize", () => { if (!overlay.classList.contains("hidden")) render(); });

  return { start };
})();