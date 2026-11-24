// Bug skins. The bug is one shared <symbol id="bug-sprite">, so choosing a skin just changes what everything draws.
//
// A skin is a colour variant of the original bug: only the body colour changes (the lane still turns it amber/red).
// Unlocks: "start" = always, "tutorial" = finish the tutorial, a number = tier index (see Rating.TIERS).
// Tier skins unlock at the PEAK rating you reached in either rating, so a bad week never takes one away.
const Skins = (() => {
  "use strict";
  const KEY = "debugr_skin", KEY_EARNED = "debugr_skins_earned";

  const SKINS = [
    { id: "classic", name: "Classic", unlock: "start" },
    { id: "larva", name: "Larva", unlock: "start", color: "#b9c2b9" },
    { id: "rookie", name: "Rookie", unlock: "tutorial", color: "#e8b84a" },
    { id: "grub", name: "Grub", unlock: 1, color: "#8fd16b" },
    { id: "beetle", name: "Beetle", unlock: 2, color: "#5ec2e8" },
    { id: "mantis", name: "Mantis", unlock: 3, color: "#9b8cff" },
    { id: "hornet", name: "Hornet", unlock: 4, color: "#e8a53a" },
    { id: "apex", name: "Apex", unlock: 5, color: "#ec6a5e" },
    // daily-streak rewards: unlocked by the longest daily streak you have ever had
    { id: "ember", name: "Ember", unlock: "streak:7", color: "#ff7a45" },
    { id: "gold", name: "Gold", unlock: "streak:30", color: "#ffd24a" },
    { id: "ghost", name: "Ghost", unlock: "streak:100", color: "#e9f1ff" },
    // Learn rewards: one colour per chapter, unlocked when every lesson in that chapter is done
    { id: "lrn1", name: "Print", unlock: "learn:1", color: "#6ee7c8" },
    { id: "lrn2", name: "Variable", unlock: "learn:2", color: "#ff9ec4" },
    { id: "lrn3", name: "Branch", unlock: "learn:3", color: "#c9f26b" },
    { id: "lrn4", name: "Loop", unlock: "learn:4", color: "#4f8cff" },
    { id: "lrn5", name: "List", unlock: "learn:5", color: "#d48bff" },
    { id: "lrn6", name: "Function", unlock: "learn:6", color: "#3fd6d6" },
    { id: "lrn7", name: "Exception", unlock: "learn:7", color: "#c8743a" },
    { id: "lrn8", name: "Module", unlock: "learn:8", color: "#a0e0b0" },
    { id: "lrn9", name: "Class", unlock: "learn:9", color: "#f0e68c" },
    { id: "lrn10", name: "Pythonic", unlock: "learn:10", color: "#4b8bbe" },
  ];
  const byId = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

  // ---------- state ----------
  let original = null;
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
  const earned = () => read(KEY_EARNED, {});
  const peakTier = () => {
    if (typeof Ratings === "undefined" || typeof Rating === "undefined") return 0;
    const s = Ratings.get();
    return Rating.tierIndex(Math.max(s.bug.peak, s.puz.peak));
  };
  const BKEY = "debugr_best_streak";
  function bestStreak() {
    let cur = 0, best = 0;
    try { cur = (PlayerState.getStreakCache() || {}).daily | 0; } catch { }
    try { best = parseInt(localStorage.getItem(BKEY), 10) || 0; } catch { }
    if (cur > best) { best = cur; try { localStorage.setItem(BKEY, String(best)); } catch { } }
    return best;
  }
  const streakNeed = (s) => (typeof s.unlock === "string" && s.unlock.startsWith("streak:") ? parseInt(s.unlock.slice(7), 10) : 0);
  const learnNeed = (s) => (typeof s.unlock === "string" && s.unlock.startsWith("learn:") ? parseInt(s.unlock.slice(6), 10) : 0);
  function chapterDone(n) {
    try {
      const prog = JSON.parse(localStorage.getItem("debugr_learn")) || {};
      const c = Lessons.CHAPTERS.find((x) => x.id === n);
      return !!c && c.lessons.length > 0 && c.lessons.every((l) => prog[l.id]);
    } catch { return false; }
  }
  function isUnlocked(id) {
    const s = byId(id);
    if (s.unlock === "start") return true;
    if (learnNeed(s)) return chapterDone(learnNeed(s));
    if (streakNeed(s)) return bestStreak() >= streakNeed(s);
    if (s.unlock === "tutorial") return !!earned().rookie;
    return peakTier() >= s.unlock;
  }
  const lockText = (s) => (learnNeed(s) ? `FINISH LEARN CHAPTER ${learnNeed(s)}` : streakNeed(s) ? `${streakNeed(s)} DAY STREAK` : s.unlock === "tutorial" ? "FINISH THE TUTORIAL" : `REACH ${Rating.TIERS[s.unlock].name} ${Rating.TIERS[s.unlock].min}`);
  const current = () => { let id = "classic"; try { id = localStorage.getItem(KEY) || "classic"; } catch { } return isUnlocked(id) ? id : "classic"; };

  // ---------- applying ----------
  function apply() {
    const sym = document.getElementById("bug-sprite");
    if (!sym) return;
    if (original === null) original = sym.innerHTML;
    const s = byId(current()), root = document.documentElement.style;
    sym.innerHTML = original;
    if (s.color) root.setProperty("--skin-body", s.color); else root.removeProperty("--skin-body");
  }
  function choose(id) {
    if (!isUnlocked(id)) return false;
    try { localStorage.setItem(KEY, id); } catch { }
    apply(); render();
    return true;
  }
  function grant(id) {
    const e = earned();
    if (e[id]) return false;
    e[id] = true; write(KEY_EARNED, e);
    render();
    return true;
  }

  // ---------- settings UI ----------
  const preview = (s) => {
    const col = s.color || "var(--green)";
    return `<svg viewBox="0 0 12 12" width="44" height="44" shape-rendering="crispEdges" style="--bug-body:${col};--bug-eye:var(--bg);--bug-spine:var(--bg)" aria-hidden="true">${original || ""}</svg>`;
  };
  function render() {
    const wrap = document.getElementById("skin-grid");
    if (!wrap) return;
    const cur = current();
    wrap.innerHTML = SKINS.map((s) => {
      const ok = isUnlocked(s.id), on = s.id === cur;
      return `<button type="button" class="skin-card${on ? " on" : ""}${ok ? "" : " locked"}" data-skin="${s.id}" ${ok ? "" : "disabled"} aria-pressed="${on}">
        <span class="sk-prev">${preview(s)}</span><span class="tc-name">${s.name}</span>
        <span class="tc-tag">${on ? "ACTIVE" : ok ? "" : "LOCKED · " + lockText(s)}</span></button>`;
    }).join("");
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-skin]");
    if (b) choose(b.dataset.skin);
  });

  // a tier-up can unlock a skin: say so
  document.addEventListener("debugr:rating", (e) => {
    const c = e.detail && e.detail.change;
    if (c && c.tierUp) {
      const s = SKINS.find((x) => typeof x.unlock === "number" && Rating.TIERS[x.unlock].name === c.tierUp);
      if (s && typeof Rewards !== "undefined") Rewards.toast(`New bug skin unlocked: ${s.name}`, 3600);
    }
    apply(); render();
  });
  // a longer daily streak can unlock a skin: say so once
  document.addEventListener("debugr:streak", () => {
    const best = bestStreak(), seen = read("debugr_streak_seen", 0);
    if (best <= seen) return;
    write("debugr_streak_seen", best);
    const s = SKINS.find((x) => streakNeed(x) && streakNeed(x) > seen && streakNeed(x) <= best);
    if (s && typeof Rewards !== "undefined") Rewards.toast(`${streakNeed(s)}-day streak! New bug skin: ${s.name}`, 4200);
    render();
  });
  // finishing the last lesson of a chapter unlocks its colour: say so once
  document.addEventListener("debugr:lesson-done", () => {
    const seen = read("debugr_learn_skins_seen", {});
    SKINS.forEach((s) => {
      const n = learnNeed(s);
      if (!n || seen[s.id] || !chapterDone(n)) return;
      seen[s.id] = 1; write("debugr_learn_skins_seen", seen);
      if (typeof Rewards !== "undefined") Rewards.toast(`Chapter ${n} cleared! New bug skin: ${s.name}`, 4200);
    });
    render();
  });
  document.addEventListener("debugr:tutorial-complete", () => {
    if (grant("rookie") && typeof Rewards !== "undefined") Rewards.toast("New bug skin unlocked: Rookie", 3600);
  });

  const start = () => { apply(); render(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.addEventListener("load", start);
  return { SKINS, isUnlocked, choose, current, grant, render, apply };
})();
