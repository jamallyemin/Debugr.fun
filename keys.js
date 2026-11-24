// SiteKeys: one switch for all of the site's own keyboard shortcuts (letters, numbers, Ctrl+S in games...).
// Off = the browser's own shortcuts are never taken over. Esc and the mouse/touch buttons always work.
const SiteKeys = (() => {
  "use strict";
  const KEY = "debugr_shortcuts";
  const on = () => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } };
  function apply() { document.documentElement.classList.toggle("no-site-keys", !on()); }
  function set(v) { try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { } apply(); document.dispatchEvent(new CustomEvent("debugr:sitekeys")); }
  apply();
  return { on, set, toggle: () => set(!on()) };
})();
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const shown = (el) => !!el && !el.classList.contains("hidden");
    const isTyping = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

    const chip = $("key-chip");
    const sheet = $("keys-prompt");
    const confirmBox = $("confirm-prompt");

    // popups
    function openPopups() {
        return [...document.querySelectorAll(".modal-backdrop:not(.hidden)")];
    }
    function openSheet() { sheet.classList.remove("hidden"); $("keys-close-btn").focus(); }
    function closeSheet() { sheet.classList.add("hidden"); }

    function askToLeave() {
        confirmBox.classList.remove("hidden");
        $("confirm-no").focus();
    }

    function closeConfirm() { confirmBox.classList.add("hidden"); }

    // close the topmost thing cthat can be closed

    function closeTopLayer() {
        const overlay = $("tutorial-overlay");
        if (shown(overlay)) { const skip = $("tt-skip"); if (skip) skip.click(); return true; }
        if (shown(confirmBox)) { closeConfirm(); return true; }
        if (shown(sheet)) { closeSheet(); return true; }
        for (const [id, btn] of [["settings-prompt", "settings-close-btn"], ["profile-prompt", "profile-close-btn"]]) {
            if (shown($(id))) { $(btn).click(); return true; }
        }
        if (shown($("tutorial-prompt"))) { $("skip-tutorial-btn").click(); return true; }
        // nickname popup can only be dismissed once a nickname exists 
        if (shown($("nickname-prompt")) && PlayerState.getNickname()) { $("nickname-prompt").classList.add("hidden"); return true; }
        if (shown($("countdown"))) return true; // a round is about to start: nothing to close
        if (shown($("room-results"))) { $("rr-leave-btn").click(); return true; }
        const success = $("success-screen");
        if (shown(success)) { success.querySelector('[data-action="back-to-menu"]').click(); return true; }
        for (const id of ["keys-warn-modal", "privacy-modal", "cert-modal", "fr-modal", "lo-modal"]) {
            if (shown($(id))) { $(id).classList.add("hidden"); return true; }
        }
        return false;

    }

    // going back
    function goBack() {
        if (closeTopLayer()) return;
        const screen = App.current();
        if (screen === "menu") return;
        if (screen === "puzzles") {$("puzzles-back-btn").click(); return;}
        if (screen === "lesson") { Learn.back(); return; }
        if (screen === "game" && App.inRun()) {askToLeave(); return; }
        App.goHome(); // difficulty, lobby/join, leaderboard, daily, puzzle path - back to menu (leaving a room too)
    }

    $("key-chip").addEventListener("click", goBack);
    document.addEventListener("debugr:open-keys", openSheet); // show btn in settings
    $("keys-close-btn").addEventListener("click", closeSheet);
    $("confirm-no").addEventListener("click", closeConfirm);
    $("confirm-yes").addEventListener("click", () => { closeConfirm() ; App.goHome();});

    document.addEventListener("debugr:screen", (e) => {
        chip.classList.toggle("hidden", e.detail.name === "menu");
    });

    document.querySelectorAll(".diff-card, .lb-tab").forEach((el) => {
        el.tabIndex = 0;
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {e.preventDefault(); el.click(); }
        });
    });

    function menuButtons() {
        return [...document.querySelectorAll("#screen-menu [data-action], #screen-menu #dh-play-btn")];
    }

    document.addEventListener("keydown", (e) => {
        if (e.defaultPrevented) return;
        const screen = App.current();
        const popup = openPopups().length > 0 || shown($("tutorial-overlay"));

        // esc always works
        if (e.key === "Escape") {e.preventDefault(); goBack(); return; }
        // the player turned the site's shortcuts off (Settings, or the yellow ! on the menu): leave every other key alone
        if (!SiteKeys.on()) return;

    // while a game is on screen, keep browser shortcuts that would pop a dialog or leave the page from interrupting the run:
    // print, bookmark, find-next, history, downloads, and Alt+arrows (back / forward). Reload, find, tabs and windows are untouched.
    if (screen === "game" && !popup) {
      const cm = e.ctrlKey || e.metaKey, ky = String(e.key).toLowerCase();
      if ((cm && !e.altKey && ["p", "d", "g", "h", "j"].includes(ky)) || (e.altKey && !cm && (e.key === "ArrowLeft" || e.key === "ArrowRight"))) { e.preventDefault(); return; }
    }
    // ctrl+s never open the browser's "save page" dialog while playing
    // in a timed game it syncs memory nd in puzzle it js ignores
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S") && (screen === "game" || screen === "puzzles")) {
      e.preventDefault();
      if (screen === "game" && !popup) $("save-btn").click();
      return;
    }
    // ctrl+enter also syncs memory in a game
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && screen === "game" && !popup) {
      e.preventDefault();
      $("save-btn").click();
      return;
    }
    
    // popups Y confirms leaving
    if (shown(confirmBox)) {
      if (e.key === "y" || e.key === "Y") { e.preventDefault(); $("confirm-yes").click(); }
      return;
    }
    if (shown(sheet) && e.key === "?") { e.preventDefault(); closeSheet(); return; }
    if (popup) return;
 
    // alt+h works even while typing in a puzzle
    if (e.altKey && (e.key === "h" || e.key === "H") && screen === "puzzles") {
      e.preventDefault();
      const b = $("puzzles-hint-btn");
      if (!b.disabled) b.click();
      return;
    }
    if (e.altKey && (e.key === "h" || e.key === "H") && screen === "game") { e.preventDefault(); if (window.App && App.hint) App.hint(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
 
    // enter on the result bars
    if (e.key === "Enter") {
      if (screen === "daily" && document.activeElement.tagName !== "BUTTON") { e.preventDefault(); $("daily-start-btn").click(); return; }
      if (screen === "puzzles" && shown($("puzzle-solved"))) { e.preventDefault(); $("puzzle-next-btn").click(); return; }
      const success = $("success-screen");
      if (shown(success)) {
        e.preventDefault();
        const next = $("next-task-btn");
        (shown(next) ? next : success.querySelector('[data-action="back-to-menu"]')).click();
        return;
      }
    }
 
    if (isTyping(e)) return;
 
    if (e.key === "?") { e.preventDefault(); openSheet(); return; }
    if ((e.key === "s" || e.key === "S") && typeof Settings !== "undefined") { e.preventDefault(); Settings.open(); return; }
    if ((e.key === "m" || e.key === "M") && typeof Sound !== "undefined") { Sound.toggle(); return; }
 
    if (screen === "menu") {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = menuButtons();
        const i = list.indexOf(document.activeElement);
        const step = e.key === "ArrowDown" ? 1 : -1;
        list[(i + step + list.length) % list.length].focus();
      }
      return;
    }
 
    if (screen === "difficulty") {
      const diff = { 1: "easy", 2: "medium", 3: "hard" }[e.key];
      if (diff) document.querySelector(`#screen-difficulty .diff-card[data-diff="${diff}"]`).click();
      return;
    }
 
    if (screen === "leaderboard" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      const tabs = [...document.querySelectorAll(".lb-tab:not(.hidden)")];
      const i = tabs.findIndex((t) => t.classList.contains("active"));
      tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length].click();
      return;
    }
 
    if (screen === "puzzles" && (e.key === "h" || e.key === "H")) {
      const b = $("puzzles-hint-btn");
      if (!b.disabled) b.click();
    }
  });
})();
    

// the yellow ! on the menu, and the matching switch in Settings
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  function paint() {
    const on = SiteKeys.on();
    const sb = $("settings-sitekeys-btn"); if (sb) { sb.textContent = on ? "ON" : "OFF"; sb.setAttribute("aria-pressed", on ? "true" : "false"); }
    const tb = $("keys-warn-toggle"); if (tb) tb.textContent = on ? "TURN OFF SHORTCUTS" : "TURN SHORTCUTS BACK ON";
  }
  document.addEventListener("click", (e) => {
    const t = e.target; if (!t.closest) return;
    if (t.closest("#keys-warn")) { paint(); $("keys-warn-modal").classList.remove("hidden"); return; }
    if (t.closest("#keys-warn-close") || t === $("keys-warn-modal")) { $("keys-warn-modal").classList.add("hidden"); return; }
    if (t.closest("#keys-warn-toggle") || t.closest("#settings-sitekeys-btn")) {
      SiteKeys.toggle(); paint();
      try { Rewards.toast(SiteKeys.on() ? "Site shortcuts are on" : "Site shortcuts are off. Your browser's own shortcuts are left alone.", 3200); } catch { }
    }
  });
  document.addEventListener("DOMContentLoaded", paint);
  document.addEventListener("debugr:sitekeys", paint);
})();

// privacy note
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const open = (e) => { if (e) e.preventDefault(); $("privacy-modal").classList.remove("hidden"); };
  document.addEventListener("click", (e) => {
    const t = e.target; if (!t.closest) return;
    if (t.closest("#menu-privacy-link") || t.closest("#settings-privacy-btn")) return open(e);
    if (t.closest("#privacy-x") || t.closest("#privacy-close") || t === $("privacy-modal")) $("privacy-modal").classList.add("hidden");
  });
})();
