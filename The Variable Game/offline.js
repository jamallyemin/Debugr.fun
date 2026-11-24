// Offline mode: registers the service worker (sw.js) and explains what needs a connection.
(function () {
  "use strict";
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => { }); });
  }
  // rows that cannot work without the internet
  const NEEDS_NET = { host: "Hosting", join: "Joining a room", quickmatch: "Quick match", leaderboard: "The leaderboard" };
  const toast = (m) => { try { Rewards.toast(m, 3200); } catch { } };

  const pill = document.createElement("div");
  pill.id = "offline-pill"; pill.className = "offline-pill hidden"; pill.setAttribute("role", "status");
  pill.textContent = "OFFLINE · solo, puzzles and Learn still work";
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(pill));
  const paint = () => pill.classList.toggle("hidden", navigator.onLine !== false);
  window.addEventListener("online", paint); window.addEventListener("offline", paint);
  document.addEventListener("DOMContentLoaded", paint);

  // capture phase: runs before the menu's own click handlers
  document.addEventListener("click", (e) => {
    if (navigator.onLine !== false || !e.target.closest) return;
    const row = e.target.closest(".menu-screen [data-action]");
    const need = row && NEEDS_NET[row.dataset.action];
    if (!need) return;
    e.stopImmediatePropagation(); e.preventDefault();
    toast(`${need} needs an internet connection. Solo, puzzles and Learn still work offline.`);
  }, true);
})();
