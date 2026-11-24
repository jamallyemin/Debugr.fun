// Progressive unlocks, the "getting started" checklist, the first-visit tour and the "how it works" page.
//
// New players only get PLAY and HOW TO PLAY. Everything else shows up locked (stars like a password prompt, a pixel
// padlock, a cobweb in the corner, and the exact goal). It is a chain: each unlock is earned by USING the one before
// it, so every new thing gets tried, and each one starts a short guided tutorial part by itself:
//   tutorial -> Learn (Python lessons); separately: win 5 solo games -> Puzzles + Daily -> clear 5 puzzles/dailies (any mix) -> Rooms
//   -> finish a room race (or 10 rated games, for people with nobody to race) -> Leaderboard + Quick match
// Any difficulty counts. Unlocks never go back. Each goal is also checked against what is already saved on this device
// (and in the cloud save), so an existing player skips every step they have effectively done already, and
// "I already know how to play" opens everything at once. Invite links still work for everyone (they do not use the menu).
const Unlocks = (() => {
  "use strict";
  const KEY = "debugr_unlocks", SKIP = "debugr_unlock_skip";
  const PLACEMENT = 10;

  // ---------- what counts as progress ----------
  const stats = () => { try { return PlayerState.getStats(); } catch { return {}; } };
  const wins = () => stats().wins | 0;
  const ratingOf = () => { try { return Ratings.get(); } catch { return null; } };
  const ratedGames = () => { const r = ratingOf(); return r ? Math.max(r.bug.g | 0, r.puz.g | 0) : 0; };
  const puzzlesCleared = () => { try { const p = PuzzleState.load(); return (p.syntax | 0) + (p.complete | 0) + (p.typefix | 0); } catch { return 0; } };
  const raceGames = () => { const r = ratingOf(); return r && r.race ? r.race.g | 0 : 0; };
  const dailyPlayed = () => (stats().dailies | 0) > 0 || (() => { try { return localStorage.getItem("debugr_daily") !== null; } catch { return false; } })();

  // puzzle levels cleared (saved progress) or puzzle wins counted, whichever is higher, plus finished dailies
  const puzDaily = () => Math.max(puzzlesCleared(), stats().puzzles | 0) + (stats().dailies | 0);
  const roomsPlayed = () => Math.max(stats().rooms | 0, raceGames());
  // have = how far you are, goal = what is needed, done = counts as met (including "you clearly did this before"),
  // after = must be open first (keeps the chain in order, even for someone with lots of saved progress)
  const FEATURES = {
    learn: { name: "LEARN", need: "Finish the tutorial", goal: 1, have: () => (tutorialDone() ? 1 : 0), done: () => tutorialDone() || wins() > 0 || puzDaily() > 0 || roomsPlayed() > 0 || ratedGames() > 0, chapter: "learn" },
    puzzles: { name: "PUZZLES", need: "Win 5 solo games", goal: 5, have: () => wins(), done: () => wins() >= 5 || puzDaily() > 0 || roomsPlayed() > 0 || ratedGames() >= 10, chapter: "puzzles" },
    daily: { name: "DAILY", need: "Win 5 solo games", goal: 5, have: () => wins(), done: () => wins() >= 5 || puzDaily() > 0 || roomsPlayed() > 0 || ratedGames() >= 10, chapter: "puzzles" },
    rooms: { name: "ROOMS", need: "Clear 5 puzzles or dailies", goal: 5, have: () => puzDaily(), after: "puzzles", done: () => puzDaily() >= 5 || roomsPlayed() > 0 || ratedGames() >= 10, chapter: "rooms" },
    friends: { name: "FRIENDS", need: "Clear 5 puzzles or dailies", goal: 5, have: () => puzDaily(), after: "puzzles", done: () => puzDaily() >= 5 || roomsPlayed() > 0 || ratedGames() >= 10, chapter: "rooms" },
    leaderboard: { name: "LEADERBOARD", need: "Finish a room race", goal: 1, have: () => roomsPlayed(), after: "rooms", done: () => roomsPlayed() >= 1 || ratedGames() >= 10, chapter: "ranks" },
    quickmatch: { name: "QUICK MATCH", need: "Finish a room race", goal: 1, have: () => roomsPlayed(), after: "rooms", done: () => roomsPlayed() >= 1 || ratedGames() >= 10, chapter: "ranks" },
  };
  const IDS = Object.keys(FEATURES);

  // ---------- saved state ----------
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } };
  const skipped = () => { try { return localStorage.getItem(SKIP) === "1"; } catch { return false; } };
  let map = read(KEY, {});

  function isUnlocked(id) {
    if (!FEATURES[id]) return true;
    if (skipped() || map[id]) return true;
    const f = FEATURES[id];
    if (f.after && !isUnlocked(f.after)) return false;
    return f.done();
  }
  const progress = (id) => ({ have: Math.min(FEATURES[id].have(), FEATURES[id].goal), goal: FEATURES[id].goal });

  // ---------- locked look (stars + pixel padlock + cobweb) ----------
  const LOCK_PATH = (() => {
    const rows = ["..####..", ".##..##.", ".#....#.", ".#....#.", "########", "########", "###..###", "###..###", "########", "########"];
    let d = "";
    rows.forEach((r, y) => { let x = 0; while (x < r.length) { if (r[x] === "#") { let n = 1; while (r[x + n] === "#") n++; d += `M${x} ${y}h${n}v1h-${n}z`; x += n; } else x++; } });
    return d;
  })();
  const LOCK_SVG = `<svg class="lk-ico" width="18" height="22" viewBox="0 0 8 10" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="${LOCK_PATH}"/></svg>`;
  const WEB_SVG = `<svg class="lk-web" width="84" height="84" viewBox="0 0 92 92" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><path d="M0 0L92 0M0 0L86 30M0 0L66 66M0 0L30 86M0 0L0 92"/><path d="M26 0Q22 20 0 26M50 0Q42 38 0 50M74 0Q60 58 0 74"/></svg>`;

  function ensureOverlay(el) {
    const id = el.dataset.unlock, f = FEATURES[id];
    if (!f) return null;
    let ov = el.querySelector(":scope > .lk-ov");
    if (!ov) {
      ov = document.createElement("div");
      ov.className = "lk-ov";
      ov.setAttribute("role", "img");
      el.appendChild(ov);
    }
    const label = el.dataset.unlockName || f.name, p = progress(id);
    const pre = f.after && !isUnlocked(f.after);
    const needText = pre ? `After ${FEATURES[f.after].name[0] + FEATURES[f.after].name.slice(1).toLowerCase()}: ${f.need[0].toLowerCase() + f.need.slice(1)}` : f.need;
    ov.setAttribute("aria-label", `${label} is locked. ${f.need}.`);
    ov.innerHTML = `${WEB_SVG}<div class="lk-name">${LOCK_SVG}<span class="lk-stars">${"*".repeat(label.length)}</span><i class="lk-caret"></i></div>
      <div class="lk-need"><span>${needText}${!pre && f.goal > 1 ? ` · ${p.have} / ${p.goal}` : ""}</span><div class="lk-bar"><i style="width:${pre ? 0 : Math.round(p.have / p.goal * 100)}%"></i></div></div>`;
    return ov;
  }

  function paintLocks() {
    document.querySelectorAll("[data-unlock]").forEach((el) => {
      const id = el.dataset.unlock;
      if (isUnlocked(id)) {
        const ov = el.querySelector(":scope > .lk-ov");
        if (ov && ov.classList.contains("decoding")) return; // let the unlock animation finish first
        el.classList.remove("is-locked"); if (ov) ov.remove(); return;
      }
      el.classList.add("is-locked");
      ensureOverlay(el);
    });
  }

  // stars flip into the real name letter by letter, then the card flashes green
  function decode(el) {
    const ov = el.querySelector(":scope > .lk-ov");
    const label = el.dataset.unlockName || FEATURES[el.dataset.unlock].name;
    if (!ov) return;
    ov.classList.add("decoding");
    const stars = ov.querySelector(".lk-stars"), glyphs = "#%&*@$01";
    let i = 0;
    const tick = setInterval(() => {
      i++;
      stars.textContent = label.slice(0, i) + Array.from({ length: Math.max(0, label.length - i) }, () => glyphs[Math.floor(Math.random() * glyphs.length)]).join("");
      if (i >= label.length) {
        clearInterval(tick);
        stars.classList.add("done");
        setTimeout(() => { el.classList.remove("is-locked"); el.classList.add("unlock-flash"); ov.classList.add("tear"); setTimeout(() => { ov.remove(); el.classList.remove("unlock-flash"); }, 900); }, 350);
      }
    }, 70);
  }

  const toast = (m, ms) => { if (typeof Rewards !== "undefined" && Rewards.toast) Rewards.toast(m, ms); };

  // ---------- guided tutorial parts ("chapters"): each one starts by itself when its feature opens ----------
  const CHAPTERS = {
    intro: [
      { sel: ".hero-lane", title: "This is your timer", text: "The bug runs toward your cursor. If it catches your code, it eats it. Keep solving to push it back." },
      { sel: "#menu-play-btn", title: "Start here", text: "Write variables that satisfy the rules, then hit sync before the bug arrives." },
      { sel: "#getting-started", title: "The rest opens as you play", text: "Each goal here opens something new, and each new thing gets its own short guide. No rush." },
    ],
    puzzles: [
      { sel: '[data-action="puzzles"]', title: "Puzzles are open", text: "Fix broken code, fill in blanks or fix type errors. Every level has a rating, and your puzzle rating works like chess." },
      { sel: "#daily-hero", title: "Daily challenge is open", text: "One task a day, the same for everyone. Clear it for the day's ranking and to keep your streak. Press D to start it." },
      { sel: "#getting-started", title: "Your next goal", text: "Clear 5 puzzles or dailies, in any mix, to open Rooms. Try one now." },
    ],
    rooms: [
      { sel: '[data-action="host"]', title: "Host a room", text: "You get a 4-letter code and an invite link. Send it to friends and everyone races the same task. Rooms never change ratings." },
      { sel: '[data-action="join"]', title: "Join a room", text: "Type a friend's code, or just open their invite link." },
      { sel: ".identity-badge", title: "Friends are open", text: "Click your name at the top to open your profile. Your friend code and friends list live there, and you can challenge a friend to a race in one tap." },
      { sel: "#getting-started", title: "Your next goal", text: "Finish one room race (with a friend, or by joining anyone\u2019s invite) to open the Leaderboard and Quick match. No friends yet? Finishing 10 rated games works too." },
    ],
    ranks: [
      { sel: '[data-action="leaderboard"]', title: "Leaderboard is open", text: "See where your rating, best times and streaks rank. Players show up after their 10 placement games." },
      { sel: "#qm-row", title: "Quick match", text: "A rated 1v1 race against someone near your rating. It needs a linked Google account." },
    ],
  };
  const FEATURE_CHAPTER = { learn: "learn", puzzles: "puzzles", daily: "puzzles", rooms: "rooms", friends: "rooms", leaderboard: "ranks", quickmatch: "ranks" };
  const seen = () => read("debugr_chapters", {});
  const markSeen = (n) => { const s = seen(); s[n] = true; write("debugr_chapters", s); };
  let queue = [];

  // ---------- evaluate ----------
  let firstRun = true;
  function evaluate() {
    const fresh = [];
    IDS.forEach((id) => { if (!map[id] && isUnlocked(id)) { map[id] = true; fresh.push(id); } });
    if (fresh.length) write(KEY, map);
    if (fresh.length) {
      fresh.forEach((id) => {
        const ch = FEATURE_CHAPTER[id];
        if (ch === "learn") { markSeen(ch); return; }   // the tutorial's own tour points at LEARN, no second guide
        if (firstRun || skipped()) markSeen(ch);        // someone who already did this does not need the guide
        else if (!seen()[ch] && !queue.includes(ch)) queue.push(ch);
      });
    }
    if (fresh.length && !firstRun && !skipped()) {
      const names = fresh.map((id) => FEATURES[id].name);
      document.querySelectorAll("[data-unlock]").forEach((el) => { if (fresh.includes(el.dataset.unlock) && el.classList.contains("is-locked")) decode(el); });
      toast("Unlocked: " + names.filter((n, i) => names.indexOf(n) === i).join(" + "), 3800);
      try { if (typeof Sound !== "undefined") Sound.play("unlock"); } catch { }
      setTimeout(runQueue, 2600);
    }
    firstRun = false;
    paintLocks();
    paintChecklist();
  }

  // ---------- blocked clicks / keys ----------
  function nudge(el, id) {
    el.classList.remove("lk-shake"); void el.offsetWidth; el.classList.add("lk-shake");
    const f = FEATURES[id];
    toast(f.after && !isUnlocked(f.after) ? `Locked: open ${FEATURES[f.after].name.toLowerCase()} first` : `Locked: ${f.need.toLowerCase()}`, 2400);
  }
  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest("[data-unlock]");
    if (!el || !el.classList.contains("is-locked") || e.target.closest(".grip")) return;
    if (isUnlocked(el.dataset.unlock)) { setTimeout(evaluate, 0); return; } // stale overlay: let the click through
    e.preventDefault(); e.stopImmediatePropagation();
    nudge(el, el.dataset.unlock);
  }, true);
  document.addEventListener("keydown", (e) => {
    if (typeof SiteKeys !== "undefined" && !SiteKeys.on()) return;
    if ((e.key === "d" || e.key === "D") && !e.ctrlKey && !e.metaKey && !e.altKey && !isUnlocked("daily") && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
      && typeof App !== "undefined" && App.current && App.current() === "menu") {
      e.preventDefault(); e.stopImmediatePropagation();
      const el = document.querySelector('[data-unlock="daily"]'); if (el) nudge(el, "daily");
    }
  }, true);

  // ---------- getting started checklist (a chain: only the current goal is bright) ----------
  const tutorialDone = () => { try { return PlayerState.tutorialDone(); } catch { return false; } };
  const STEPS = [
    { label: "Finish the tutorial", sub: "opens Learn, and unlocks the Rookie skin", done: () => tutorialDone() },
    { label: "Win 5 solo games", sub: "opens Puzzles and Daily", done: () => isUnlocked("puzzles"), f: "puzzles" },
    { label: "Clear 5 puzzles or dailies", sub: "any mix. Opens Rooms", done: () => isUnlocked("rooms"), f: "rooms" },
    { label: "Finish a room race", sub: "opens Leaderboard and Quick match", done: () => isUnlocked("leaderboard"), f: "leaderboard" },
  ];
  const checklistActive = () => !skipped() && !STEPS.every((s) => s.done());
  function paintChecklist() {
    const box = document.getElementById("getting-started"), stat = document.getElementById("menu-status");
    if (!box) return;
    const on = checklistActive();
    box.classList.toggle("hidden", !on);
    if (stat) stat.classList.toggle("hidden", on);
    if (!on) return;
    const n = STEPS.filter((s) => s.done()).length;
    // the "current" goal is the first unfinished one that has a counter (the tutorial can stay unticked without blocking)
    const cur = STEPS.findIndex((s) => !s.done() && s.f);
    box.innerHTML = `<div class="gs-top"><span class="gs-title">GETTING STARTED</span><span class="gs-count">${n} / ${STEPS.length}</span></div>
      <ul class="gs-list">${STEPS.map((s, i) => {
        const ok = s.done(), f = s.f && FEATURES[s.f];
        const now = !ok && (s.f ? i === cur : true), later = !ok && s.f && i !== cur;
        const extra = now && f ? ` · ${Math.min(f.have(), f.goal)} / ${f.goal}` : "";
        return `<li class="${ok ? "ok" : now ? "now" : later ? "later" : ""}"><span class="gs-box" aria-hidden="true">${ok ? "✓" : ""}</span><span class="gs-t"><b>${s.label}${extra}</b><small>${s.sub}</small></span></li>`;
      }).join("")}</ul>
      <div class="gs-actions"><button type="button" class="btn small" id="gs-how">HOW IT WORKS</button><button type="button" class="gs-skip" id="gs-skip">I already know how to play</button></div>`;
  }

  function skipAll() {
    try { localStorage.setItem(SKIP, "1"); } catch { }
    try { PlayerState.markTutorialDone(); } catch { }
    Object.keys(CHAPTERS).forEach(markSeen);
    queue = []; endTour();
    IDS.forEach((id) => { if (!map[id]) map[id] = true; });
    write(KEY, map);
    document.querySelectorAll("[data-unlock].is-locked").forEach((el) => decode(el));
    toast("Everything is unlocked. Have fun!", 3200);
    paintChecklist(); setTimeout(paintLocks, 1800);
  }
  function confirmSkip() {
    let m = document.getElementById("skip-modal");
    if (!m) {
      m = document.createElement("div");
      m.id = "skip-modal"; m.className = "modal-backdrop hidden";
      m.innerHTML = `<div class="modal-box"><h2>UNLOCK EVERYTHING?</h2>
        <p style="margin:0 0 14px;line-height:1.5">Every feature opens right now. You can replay the tutorial any time from HOW TO PLAY.</p>
        <div class="modal-actions"><button class="btn" id="skip-no">CANCEL</button><button class="btn primary" id="skip-yes">UNLOCK ALL</button></div></div>`;
      document.body.appendChild(m);
    }
    m.classList.remove("hidden");
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("#gs-skip")) confirmSkip();
    if (e.target.closest && e.target.closest("#skip-yes")) { const m = document.getElementById("skip-modal"); if (m) m.classList.add("hidden"); skipAll(); }
    if (e.target.closest && e.target.closest("#skip-no")) { const m = document.getElementById("skip-modal"); if (m) m.classList.add("hidden"); }
    if (e.target.closest && e.target.closest("#gs-how")) openHow();
  });

  // ---------- how it works ----------
  function openHow() {
    let m = document.getElementById("how-modal");
    if (!m) {
      m = document.createElement("div");
      m.id = "how-modal"; m.className = "modal-backdrop hidden";
      m.innerHTML = `<div class="modal-box how-box"><h2>HOW IT WORKS</h2><div class="how-body" id="how-body"></div>
        <div class="modal-actions"><button class="btn primary" id="how-close">GOT IT</button></div></div>`;
      document.body.appendChild(m);
      m.addEventListener("click", (e) => { if (e.target === m || e.target.closest("#how-close")) m.classList.add("hidden"); });
    }
    const row = (id) => `<li class="${isUnlocked(id) ? "ok" : ""}"><b>${FEATURES[id].name}</b><span>${FEATURES[id].need}</span><em>${isUnlocked(id) ? "OPEN" : "LOCKED"}</em></li>`;
    document.getElementById("how-body").innerHTML = `
      <h3>THE GAME</h3><p>A task shows rules like <code>x is even</code> and <code>y &gt; x</code>. Write Python-style assignments that satisfy every rule and press sync. A bug runs toward your cursor, and if it catches you it eats your code. Green rules are done, red ones are not.</p>
      <h3>RATINGS</h3><p>Solo games and puzzles give you a rating that starts at 1000, like chess. Beat harder tasks to climb through Larva, Grub, Beetle, Mantis, Hornet and Apex. Your first 10 games are placement games and move your rating faster.</p>
      <h3>WHAT OPENS WHEN</h3><ul class="how-list">${row("learn")}${row("puzzles")}${row("daily")}${row("rooms")}${row("leaderboard")}${row("quickmatch")}</ul>
      <p class="how-note">Each step uses what the one before it opened, and every new part comes with a short guide. Any difficulty counts. Friends can always join your room with an invite link, even before rooms are open for you.</p>`;
    m.classList.remove("hidden");
  }

  // ---------- tour popovers ----------
  let tour = null;
  function endTour() {
    if (!tour) return;
    tour.el.remove(); tour.ring.remove();
    markSeen(tour.name); tour = null;
  }
  function showStep(i) {
    const s = tour.steps[i], target = document.querySelector(s.sel);
    if (!target || target.offsetParent === null) { if (i + 1 < tour.steps.length) return showStep(i + 1); return endTour(); }
    tour.i = i;
    target.scrollIntoView({ block: "center" });
    // desktop is zoomed 1.2x (html {zoom} in style.css): measure the zoom, then work in the page's own units
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;width:100px;height:1px;visibility:hidden";
    document.body.appendChild(probe);
    const z = probe.getBoundingClientRect().width / 100 || 1;
    probe.remove();
    const bb = target.getBoundingClientRect(), pad = 8;
    const r = { left: bb.left / z, top: bb.top / z, right: bb.right / z, bottom: bb.bottom / z, width: bb.width / z, height: bb.height / z };
    const vw = window.innerWidth / z, vh = window.innerHeight / z;
    Object.assign(tour.ring.style, { top: r.top - pad + "px", left: r.left - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
    const last = i + 1 === tour.steps.length;
    tour.el.innerHTML = `<div class="tour-step">${i + 1} / ${tour.steps.length}</div><b>${s.title}</b><p>${s.text}</p>
      <div class="tour-actions"><button type="button" class="gs-skip" id="tour-skip">skip</button><button type="button" class="btn small primary" id="tour-next">${last ? "GOT IT" : "NEXT"}</button></div>`;
    const w = Math.min(320, vw - 24);
    tour.el.style.width = w + "px";
    const h = tour.el.offsetHeight, gap = pad + 12;
    const cx = (x) => Math.max(12, Math.min(vw - w - 12, x)), cy = (y) => Math.max(12, Math.min(vh - h - 12, y));
    const spots = [
      { ok: r.bottom + gap + h <= vh - 8, x: cx(r.left), y: r.bottom + gap },
      { ok: r.top - gap - h >= 12, x: cx(r.left), y: r.top - gap - h },
      { ok: r.right + gap + w <= vw - 12, x: r.right + gap, y: cy(r.top) },
      { ok: r.left - gap - w >= 12, x: r.left - gap - w, y: cy(r.top) },
    ];
    const pick = spots.find((s) => s.ok) || { x: cx(r.left), y: vh - r.bottom > r.top ? cy(r.bottom + gap) : cy(r.top - gap - h) };
    tour.el.style.left = pick.x + "px"; tour.el.style.top = pick.y + "px";
  }
  function startChapter(name) {
    if (tour || tutorialOpen() || !CHAPTERS[name] || seen()[name]) return false;
    const ring = document.createElement("div"), el = document.createElement("div");
    ring.className = "tour-ring"; el.className = "tour-pop"; el.setAttribute("role", "dialog");
    document.body.append(ring, el);
    ring.style.transition = "none";
    tour = { ring, el, i: 0, name, steps: CHAPTERS[name] };
    showStep(0);
    requestAnimationFrame(() => requestAnimationFrame(() => { if (tour) tour.ring.style.transition = ""; }));
    return true;
  }
  const tutorialOpen = () => { const o = document.getElementById("tutorial-overlay"); return !!o && !o.classList.contains("hidden"); };
  const menuReady = () => typeof App !== "undefined" && App.current && App.current() === "menu" && !document.querySelector(".modal-backdrop:not(.hidden)") && !tour && !tutorialOpen();
  function runQueue() {
    if (!menuReady() || !queue.length) return;
    const n = queue.shift();
    if (!startChapter(n)) runQueue();
  }
  function introWanted() {
    return !skipped() && !seen().intro && wins() === 0 && !tutorialDone() && ratedGames() === 0 && puzDaily() === 0;
  }
  document.addEventListener("click", (e) => {
    if (!tour || !e.target.closest) return;
    if (e.target.closest("#tour-skip")) endTour();
    else if (e.target.closest("#tour-next")) { if (tour.i + 1 < tour.steps.length) showStep(tour.i + 1); else endTour(); }
  });
  window.addEventListener("resize", () => { if (tour) showStep(tour.i); });
  document.addEventListener("debugr:screen", (e) => {
    if (e.detail && e.detail.name === "menu") {
      evaluate();
      setTimeout(() => { if (!menuReady()) return; if (queue.length) runQueue(); else if (introWanted()) startChapter("intro"); }, 700);
    } else if (tour) endTour();
  });

  // ---------- wiring ----------
  ["debugr:progress", "debugr:rating", "debugr:tutorial-complete", "debugr:daily-win", "debugr:race-finish", "debugr:ready"].forEach((n) => document.addEventListener(n, () => setTimeout(evaluate, 60)));
  const boot = () => { evaluate(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.addEventListener("load", boot);
  return { endTour: () => { if (tour) { tour.el.remove(); tour.ring.remove(); tour = null; } }, paint: () => paintLocks(), isUnlocked, progress, evaluate, skipAll, openHow, startChapter, FEATURES };
})();
