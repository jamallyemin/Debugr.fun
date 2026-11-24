// Accessibility helpers: dialogs keep keyboard focus inside and give it back, screen changes are announced,
// and every pop-up gets the dialog role. (Reduce motion, key hints and pattern colours live in prefs.js.)
(function () {
  "use strict";
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

  // ---- screen change announcements for screen readers ----
  const live = document.createElement("div");
  live.className = "sr-only"; live.setAttribute("role", "status"); live.setAttribute("aria-live", "polite");
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(live));
  const TITLES = { menu: "Main menu", difficulty: "Choose a difficulty", lobby: "Room lobby", join: "Join a room", quick: "Quick match", leaderboard: "Leaderboard", game: "Game", puzzleSelect: "Puzzles", puzzles: "Puzzle path", profile: "Profile and friends", daily: "Daily challenge", lesson: "Lesson", learn: "Learn Python" };
  document.addEventListener("debugr:screen", (e) => {
    const n = e.detail && e.detail.name;
    live.textContent = "";
    setTimeout(() => { live.textContent = TITLES[n] || ""; }, 60);
  });

  // ---- dialogs ----
  let opener = null, current = null;
  function tag(box) { if (box && !box.getAttribute("role")) { box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); } }
  function scan() {
    document.querySelectorAll(".modal-box").forEach(tag);
    const open = [...document.querySelectorAll(".modal-backdrop:not(.hidden)")].filter(visible).pop() || null;
    if (open === current) return;
    if (open) {
      if (!current) opener = document.activeElement;
      current = open;
      const box = open.querySelector(".modal-box") || open;
      const first = box.querySelector(FOCUSABLE);
      if (!box.contains(document.activeElement)) setTimeout(() => { try { (first || box).focus({ preventScroll: true }); } catch { } }, 30);
    } else {
      current = null;
      const o = opener; opener = null;
      if (o && o.focus && document.contains(o)) { try { o.focus({ preventScroll: true }); } catch { } }
    }
  }
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; scan(); }); }).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "hidden"], subtree: true, childList: true });
  document.addEventListener("DOMContentLoaded", scan);

  // Tab stays inside the open dialog
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !current) return;
    const items = [...current.querySelectorAll(FOCUSABLE)].filter(visible);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !current.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !current.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  });
})();
