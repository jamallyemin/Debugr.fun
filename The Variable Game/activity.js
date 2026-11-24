// Friend activity: a tiny "what am I doing" note (presence/{uid}) that only your friends can read.
// It holds one word (menu, solo, puzzles, daily, room, ranks, learn) and a time, never anything else.
// Written when you change screen (at most every 15 s) and every 90 s while the tab is visible.
// Turn it off in Settings and the note is deleted.
const Activity = (() => {
  "use strict";
  const KEY = "debugr_share_activity", FRESH = 4 * 60 * 1000;
  const enabled = () => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } };
  const F = () => (typeof FirebaseClient !== "undefined" && FirebaseClient.presence && FirebaseClient.getUid() ? FirebaseClient : null);
  const WORDS = { menu: "in the menu", solo: "playing solo", puzzles: "solving puzzles", daily: "on the daily challenge", room: "in a room", ranks: "checking the leaderboard", learn: "learning Python" };

  function kindOf(screen) {
    if (screen === "lobby" || screen === "join" || screen === "quick") return "room";
    if (screen === "game") return typeof Rooms !== "undefined" && Rooms.active && Rooms.active() ? "room" : "solo";
    if (screen === "difficulty") return "solo";
    if (screen === "puzzles" || screen === "puzzleSelect") return "puzzles";
    if (screen === "daily") return "daily";
    if (screen === "leaderboard") return "ranks";
    if (screen === "learn" || screen === "lesson") return "learn";
    return "menu";
  }

  let screen = "menu", lastKind = "", lastAt = 0, timer = null;
  const hasFriends = () => { try { return typeof Friends !== "undefined" && Friends.ids().length > 0; } catch { return false; } };

  function push(force) {
    const f = F(); if (!f || !enabled() || !hasFriends() || document.hidden) return;
    const kind = kindOf(screen), now = Date.now();
    if (!force && kind === lastKind && now - lastAt < 80 * 1000) return;
    if (now - lastAt < 15 * 1000) { clearTimeout(timer); timer = setTimeout(() => push(true), 15 * 1000 - (now - lastAt) + 50); return; }
    lastKind = kind; lastAt = now;
    f.presence.set(kind).catch(() => { });
  }

  document.addEventListener("debugr:screen", (e) => { screen = (e.detail && e.detail.name) || "menu"; push(false); });
  document.addEventListener("debugr:ready", () => push(true));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) push(true); });
  setInterval(() => push(true), 90 * 1000);

  // how a friend's note reads: [css class, text]
  function describe(p) {
    if (!p || !p.at) return null;
    const at = p.at.toMillis ? p.at.toMillis() : 0, age = Date.now() - at;
    if (age < FRESH && WORDS[p.kind]) return { on: true, text: WORDS[p.kind] };
    if (age < 60 * 60 * 1000) return { on: false, text: `seen ${Math.max(1, Math.round(age / 60000))} min ago` };
    if (age < 24 * 60 * 60 * 1000) return { on: false, text: `seen ${Math.round(age / 3600000)} h ago` };
    return { on: false, text: "offline" };
  }
  async function read(uids) {
    const f = F(); const out = {};
    if (!f) return out;
    await Promise.all(uids.slice(0, 40).map(async (u) => { try { out[u] = await f.presence.get(u); } catch { out[u] = null; } }));
    return out;
  }

  // settings switch
  function paintSwitch() {
    const b = document.getElementById("settings-activity-btn"); if (!b) return;
    b.textContent = enabled() ? "ON" : "OFF"; b.setAttribute("aria-pressed", enabled() ? "true" : "false");
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest || !e.target.closest("#settings-activity-btn")) return;
    const on = !enabled();
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { }
    paintSwitch();
    const f = F();
    if (on) push(true); else if (f) f.presence.clear().catch(() => { });
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paintSwitch); else paintSwitch();

  return { describe, read, enabled };
})();
