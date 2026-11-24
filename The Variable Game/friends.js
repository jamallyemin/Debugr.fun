// Profile screen + friends. Your profile is always open; the friends panel opens together with Rooms (see unlocks.js).
// Data lives in Firestore (friendCodes, friendReqs, friendships, invites - rules in firestore.rules).
const Friends = (() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const F = () => (typeof FirebaseClient !== "undefined" && FirebaseClient.friends && FirebaseClient.getUid() ? FirebaseClient : null);
  const pfp = (a) => { try { return Rewards.pfp(a); } catch { return '<span class="pfp"></span>'; } };
  const toast = (m, ms) => { try { Rewards.toast(m, ms); } catch { } };
  const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

  let tab = "friends", code = null, friends = null, incoming = null, outgoing = [], infos = {}, subs = [], pres = {}, presTimer = null, found = null, msg = "", autoTab = false;

  const peak = (k) => { try { const s = Ratings.get()[k]; return { r: s.r, tier: Rating.tierFor(s.r) }; } catch { return null; } };
  const stat = (k) => { try { return PlayerState.getStats()[k] | 0; } catch { return 0; } };

  async function info(u) {
    if (infos[u]) return infos[u];
    try { infos[u] = await F().friends.playerInfo(u); } catch { infos[u] = { uid: u, nickname: "player", avatar: "bug" }; }
    return infos[u];
  }
  async function loadInfos(list) { await Promise.all((list || []).map(info)); }

  // ---------- profile card ----------
  const BADGES = [
    ["FIRST WIN", () => stat("wins") >= 1], ["10 WINS", () => stat("wins") >= 10], ["PUZZLER", () => stat("puzzles") >= 5],
    ["DAILY HABIT", () => stat("dailies") >= 3], ["ROOM RACER", () => stat("rooms") >= 1], ["7 DAY STREAK", () => { try { return (+localStorage.getItem("debugr_best_streak") || 0) >= 7; } catch { return false; } }],
  ];
  // "show off": one badge or skin shown next to your name for friends. Stored as "badge:NAME" or "skin:id".
  const SHOW_KEY = "debugr_showcase";
  const getShow = () => { try { return localStorage.getItem(SHOW_KEY) || ""; } catch { return ""; } };
  function showcaseHtml(v) {
    if (typeof v !== "string") return "";
    if (v.startsWith("badge:")) { const n = v.slice(6); return BADGES.some((b) => b[0] === n) ? `<em class="fr-show">${esc(n)}</em>` : ""; }
    if (v.startsWith("skin:")) {
      const s = typeof Skins !== "undefined" && Skins.SKINS.find((x) => x.id === v.slice(5));
      return s ? `<em class="fr-show"><i style="background:${s.color}"></i>${esc(s.name.toUpperCase())} BUG</em>` : "";
    }
    return "";
  }
  function showOptions() {
    const cur = getShow(), opts = [`<option value="">Nothing</option>`];
    BADGES.filter(([, f]) => f()).forEach(([n]) => opts.push(`<option value="badge:${esc(n)}"${cur === "badge:" + n ? " selected" : ""}>Badge: ${esc(n)}</option>`));
    try { Skins.SKINS.filter((s) => Skins.isUnlocked(s.id)).forEach((s) => opts.push(`<option value="skin:${s.id}"${cur === "skin:" + s.id ? " selected" : ""}>Bug skin: ${esc(s.name)}</option>`)); } catch { }
    return opts.join("");
  }
  function learnBlock() {
    let ln = null, ch = null; try { ln = Learn.progress(); ch = Learn.chapters(); } catch { }
    if (!ln) return "";
    const pct = ln.total ? Math.round((ln.done / ln.total) * 100) : 0;
    return `<div class="pf-learn"><div class="k">LEARN PYTHON</div>
      <div class="pf-learn-row"><b>${ln.done}<span> / ${ln.total} lessons</span></b><span>${ch ? ch.done + " of " + ch.total + " chapters cleared" : ""}</span></div>
      <div class="pf-bar"><i style="width:${pct}%"></i></div></div>`;
  }
  function skinsBlock() {
    let list = []; try { list = Skins.SKINS; } catch { }
    if (!list.length) return "";
    const got = list.filter((s) => Skins.isUnlocked(s.id)).length;
    return `<div class="pf-skins"><div class="k">BUG SKINS <span class="pf-count">${got} / ${list.length}</span></div>
      <div class="pf-skin-row">${list.map((s) => { const on = Skins.isUnlocked(s.id); return `<span class="pf-skin${on ? " on" : ""}" style="--c:${s.color}" title="${esc(s.name)}${on ? "" : " (locked)"}"></span>`; }).join("")}</div></div>`;
  }
  function paintMe() {
    const el = $("pf-me"); if (!el) return;
    const bug = peak("bug"), puz = peak("puz");
    const rr = (label, p) => `<div class="pf-rate"><span class="k">${label}</span><b style="color:${p ? p.tier.color : "var(--text-dim)"}">${p ? p.r : "-"}</b><i style="color:${p ? p.tier.color : ""}">${p ? p.tier.name : ""}</i></div>`;
    const linked = F() && FirebaseClient.isLinked();
    let skin = ""; try { skin = Skins.SKINS.find((s) => s.id === Skins.current()).name; } catch { }
    el.innerHTML = `
      <div class="pf-banner" aria-hidden="true"><div class="pf-ground"></div><svg class="bug"><use href="#bug-sprite" /></svg></div>
      <div class="pf-head"><button class="pf-av" id="pf-av" title="Change picture">${pfp(PlayerState.getAvatar())}<span class="pf-av-edit">EDIT</span></button>
        <div class="pf-id"><div class="pf-name">${esc(PlayerState.getNickname() || "GUEST")}</div>
        <div class="pf-sub">${skin ? esc(skin) + " bug · " : ""}${linked ? "Google linked" : "this device only"}</div></div>
        <button class="btn small" id="pf-edit-name">EDIT NAME</button></div>
      <div class="pf-rates">${rr("BUG RATING", bug)}${rr("PUZZLE RATING", puz)}</div>
      <div class="pf-tiles">
        <div class="stat-card"><div class="k">WINS</div><div class="v">${stat("wins")}</div></div>
        <div class="stat-card"><div class="k">PUZZLES</div><div class="v">${stat("puzzles")}</div></div>
        <div class="stat-card"><div class="k">DAILIES</div><div class="v">${stat("dailies")}</div></div>
        <div class="stat-card"><div class="k">ROOMS</div><div class="v">${stat("rooms")}</div></div>
      </div>
      ${learnBlock()}
      ${skinsBlock()}
      <div class="pf-badges"><div class="k">BADGES</div><div class="pf-badge-row">${BADGES.map(([n, f]) => `<span class="pf-badge${f() ? " on" : ""}">${n}</span>`).join("")}</div></div>
      <div class="pf-showoff"><label class="k" for="pf-show">SHOW OFF TO FRIENDS</label>
        <select id="pf-show" class="ls-sel">${showOptions()}</select>
        <p class="pf-note">Shown next to your name in your friends' lists.</p></div>
      <div class="pf-code"><div class="k">YOUR FRIEND CODE</div>
        <div class="pf-code-row"><span class="pf-code-v" id="pf-code-v">${code ? esc(code) : "······"}</span>
          <button class="btn small" id="pf-copy" ${code ? "" : "disabled"}>COPY</button></div>
        <p class="pf-note">${linked ? "Your code is saved to your Google account." : "Link Google in Settings to keep your code and friends if you switch devices."}</p></div>`;
  }

  // ---------- friend activity ----------
  function activityLine(u) {
    const d = typeof Activity !== "undefined" ? Activity.describe(pres[u]) : null;
    return d ? `<i class="fr-dot ${d.on ? "on" : ""}"></i>${esc(d.text)}` : "";
  }
  async function refreshActivity() {
    if (typeof Activity === "undefined" || !friends || !friends.length) return;
    pres = await Activity.read(friends);
    paintFriends();
  }
  const profileOpen = () => { const s = $("screen-profile"); return s && !s.classList.contains("hidden"); };

  // ---------- friends panel ----------
  const row = (i, actions, sub) => `<li class="fr-item" data-uid="${esc(i.uid)}">${pfp(i.avatar)}<div class="fr-who"><b>${esc(i.nickname)}</b>${showcaseHtml(i.showcase)}${sub ? `<span>${sub}</span>` : ""}</div><div class="fr-act">${actions}</div></li>`;

  function paintFriends() {
    const el = $("pf-friends"); if (!el) return;
    const nIn = (incoming || []).length;
    let body = "";
    if (!F()) body = `<p class="fr-empty">Connecting… friends need an internet connection.</p>`;
    else if (tab === "friends") {
      body = friends === null ? `<p class="fr-empty">Loading…</p>` : friends.length
        ? `<ul class="fr-list">${friends.map((u) => row(infos[u] || { uid: u, nickname: "…", avatar: "bug" },
          `<button class="btn small primary" data-fr="challenge">CHALLENGE</button><button class="btn small" data-fr="remove" title="Remove friend">✕</button>`, activityLine(u))).join("")}</ul>`
        : `<p class="fr-empty">No friends yet. Share your code, or add someone's code in the ADD tab.</p>`;
    } else if (tab === "requests") {
      body = !incoming ? `<p class="fr-empty">Loading…</p>` : incoming.length
        ? `<ul class="fr-list">${incoming.map((u) => row(infos[u] || { uid: u, nickname: "…", avatar: "bug" },
          `<button class="btn small primary" data-fr="accept">ACCEPT</button><button class="btn small" data-fr="decline">DECLINE</button>`, "wants to be friends")).join("")}</ul>`
        : `<p class="fr-empty">No requests right now.</p>`;
      if (outgoing.length) body += `<div class="k fr-sent">SENT</div><ul class="fr-list">${outgoing.map((u) => row(infos[u] || { uid: u, nickname: "…", avatar: "bug" }, `<button class="btn small" data-fr="cancel">CANCEL</button>`, "waiting")).join("")}</ul>`;
    } else {
      body = `<label class="k" for="fr-code-in">FRIEND'S CODE</label>
        <div class="fr-add"><input id="fr-code-in" maxlength="6" autocomplete="off" spellcheck="false" placeholder="ABC234"><button class="btn primary" id="fr-find">FIND</button></div>
        <p class="fr-msg" id="fr-msg">${esc(msg)}</p>
        ${found ? `<ul class="fr-list">${row(found, `<button class="btn small primary" data-fr="send">ADD</button>`)}</ul>` : ""}`;
    }
    el.innerHTML = `<div class="fr-tabs">
      <button class="fr-tab${tab === "friends" ? " on" : ""}" data-tab="friends">FRIENDS${friends && friends.length ? ` <i>${friends.length}</i>` : ""}</button>
      <button class="fr-tab${tab === "requests" ? " on" : ""}" data-tab="requests">REQUESTS${nIn ? ` <i class="hot">${nIn}</i>` : ""}</button>
      <button class="fr-tab${tab === "add" ? " on" : ""}" data-tab="add">ADD</button></div>
      <div class="fr-body">${body}</div>`;
    const dot = $("fr-dot"); if (dot) dot.classList.toggle("hidden", !nIn);
    if (typeof Unlocks !== "undefined" && Unlocks.paint) Unlocks.paint();
  }

  // ---------- live data ----------
  function stopSubs() { subs.forEach((u) => { try { u(); } catch { } }); subs = []; }
  async function listen() {
    const f = F(); if (!f || subs.length) return;
    try { code = await f.friends.myFriendCode(); } catch { code = null; }
    paintMe();
    try {
      subs.push(f.friends.listenFriends(async (l) => { friends = l; await loadInfos(l); paintFriends(); refreshActivity(); }));
      subs.push(f.friends.listenIncoming(async (l) => { incoming = l; await loadInfos(l); if (autoTab && l && l.length) tab = "requests"; autoTab = false; paintFriends(); }));
      subs.push(f.friends.listenOutgoing(async (l) => { outgoing = l || []; await loadInfos(l); paintFriends(); }));
      subs.push(f.friends.listenInvites(onInvite));
    } catch (e) { stopSubs(); }
  }

  // ---------- invites ----------
  let lastInvite = "";
  function onInvite(inv) {
    if (!inv || !inv.code) return hideBanner();
    const at = inv.at && inv.at.toMillis ? inv.at.toMillis() : Date.now();
    if (Date.now() - at > 15 * 60 * 1000) { F() && F().friends.clearInvite().catch(() => { }); return; }
    if (inv.code + inv.from === lastInvite) return;
    lastInvite = inv.code + inv.from;
    let b = $("invite-banner");
    if (!b) { b = document.createElement("div"); b.id = "invite-banner"; b.className = "invite-banner"; document.body.appendChild(b); }
    b.innerHTML = `<span><b>${esc(inv.fromName)}</b> wants to race you</span><button class="btn small primary" id="inv-join">JOIN</button><button class="btn small" id="inv-no">✕</button>`;
    b.dataset.code = inv.code; b.classList.remove("hidden");
  }
  function hideBanner() { const b = $("invite-banner"); if (b) b.classList.add("hidden"); lastInvite = ""; }

  // ---------- actions ----------
  async function find() {
    const f = F(); const v = ($("fr-code-in").value || "").toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "");
    found = null;
    if (!CODE_RE.test(v)) { msg = "A friend code has 6 letters and numbers."; return paintFriends(); }
    if (v === code) { msg = "That's your own code."; return paintFriends(); }
    msg = "Looking…"; paintFriends();
    try {
      const p = await f.friends.findByCode(v);
      if (!p) msg = "No player with that code.";
      else if (friends && friends.includes(p.uid)) msg = `You and ${p.nickname} are already friends.`;
      else { infos[p.uid] = p; found = p; msg = ""; }
    } catch { msg = "Couldn't look that up. Try again."; }
    paintFriends();
    const i = $("fr-code-in"); if (i) i.value = v;
  }
  async function act(kind, u) {
    const f = F(); if (!f) return;
    const n = (infos[u] || {}).nickname || "player";
    try {
      if (kind === "send") {
        if ((incoming || []).includes(u)) await f.friends.acceptRequest(u); else await f.friends.sendRequest(u);
        found = null; msg = `Request sent to ${n}.`; tab = "add"; toast(`Request sent to ${n}`);
      }
      if (kind === "accept") { await f.friends.acceptRequest(u); toast(`You and ${n} are friends`); }
      if (kind === "decline") await f.friends.declineRequest(u);
      if (kind === "cancel") await f.friends.cancelRequest(u);
      if (kind === "remove") { if (!confirmRemove(u)) return; await f.friends.removeFriend(u); }
      if (kind === "challenge") { if (typeof Rooms !== "undefined") Rooms.hostFor(u); }
    } catch (e) { console.error(e); toast("That didn't work. Try again."); }
    paintFriends();
  }
  // the same in-game dialog style as everything else (no native popups)
  let pendingRemove = null;
  function confirmRemove(u) {
    let m = $("fr-modal");
    if (!m) {
      m = document.createElement("div"); m.id = "fr-modal"; m.className = "modal-backdrop hidden";
      m.innerHTML = `<div class="modal-box"><h2>REMOVE FRIEND?</h2><p style="margin:0 0 14px;line-height:1.5" id="fr-modal-t"></p>
        <div class="modal-actions"><button class="btn" id="fr-no">CANCEL</button><button class="btn primary" id="fr-yes">REMOVE</button></div></div>`;
      document.body.appendChild(m);
    }
    $("fr-modal-t").textContent = `${(infos[u] || {}).nickname || "This player"} will be removed from your friends.`;
    pendingRemove = u; m.classList.remove("hidden");
    return false;
  }

  // ---------- log out ----------
  function askLogout() {
    let m = $("lo-modal");
    if (!m) { m = document.createElement("div"); m.id = "lo-modal"; m.className = "modal-backdrop hidden"; document.body.appendChild(m); }
    const linked = F() && FirebaseClient.isLinked();
    m.innerHTML = `<div class="modal-box"><button class="modal-x" id="lo-no" aria-label="Close">✕</button><h2>LOG OUT?</h2>
      <p style="margin:0 0 14px;line-height:1.5">${linked ? "You can get everything back by linking the same Google account in Settings." : "Your progress only lives on this device. Log out now and it is gone for good. Link Google in Settings first to keep it."}</p>
      <div class="modal-actions"><button class="btn" id="lo-no2">CANCEL</button><button class="btn primary" id="lo-yes">${linked ? "LOG OUT" : "LOG OUT ANYWAY"}</button></div></div>`;
    m.querySelector("#lo-no2").addEventListener("click", () => m.classList.add("hidden"));
    m.classList.remove("hidden");
  }
  async function doLogout() {
    stopSubs();
    try { await FirebaseClient.signOut(); } catch { }
    try { Object.keys(localStorage).filter((k) => k.startsWith("debugr") && !/music|theme|sound|key|pref/i.test(k)).forEach((k) => localStorage.removeItem(k)); } catch { }
    location.reload();
  }

  document.addEventListener("change", (e) => {
    if (!e.target || e.target.id !== "pf-show") return;
    try { localStorage.setItem(SHOW_KEY, e.target.value); } catch { }
    if (F() && FirebaseClient.setShowcase) FirebaseClient.setShowcase(e.target.value).catch(() => { });
    toast(e.target.value ? "Friends will see it next to your name" : "Nothing is shown now");
  });
  document.addEventListener("click", (e) => {
    const t = e.target; if (!t.closest) return;
    let b;
    if ((b = t.closest(".fr-tab"))) { tab = b.dataset.tab; msg = ""; found = null; return paintFriends(); }
    if (t.closest("#fr-find")) return find();
    if ((b = t.closest("[data-fr]"))) { const li = b.closest(".fr-item"); return act(b.dataset.fr, li && li.dataset.uid); }
    if (t.closest("#pf-edit-name") && window.openNicknameEdit) return window.openNicknameEdit();
    if (t.closest("#pf-av")) return Rewards.openAvatars();
    if (t.closest("#logout-btn") || t.closest("#pf-logout-link")) return askLogout();
    if (t.closest("#lo-no")) return $("lo-modal").classList.add("hidden");
    if (t.closest("#lo-yes")) return doLogout();
    if (t.closest("#pf-copy") && code) { try { navigator.clipboard.writeText(code); } catch { } return toast("Friend code copied"); }
    if (t.closest("#fr-yes")) { const u = pendingRemove; pendingRemove = null; $("fr-modal").classList.add("hidden"); if (u && F()) F().friends.removeFriend(u).then(paintFriends, () => toast("That didn't work.")); return; }
    if (t.closest("#fr-no")) { pendingRemove = null; $("fr-modal").classList.add("hidden"); return; }
    if (t.closest("#inv-join")) { const c = $("invite-banner").dataset.code; hideBanner(); F() && F().friends.clearInvite().catch(() => { }); if (typeof Rooms !== "undefined") Rooms.openJoin(c); return; }
    if (t.closest("#inv-no")) { hideBanner(); F() && F().friends.clearInvite().catch(() => { }); return; }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target && e.target.id === "fr-code-in") find();
  });

  function open() {
    clearInterval(presTimer); presTimer = setInterval(() => { if (profileOpen()) refreshActivity(); else clearInterval(presTimer); }, 45000);
    refreshActivity();
    paintMe(); listen();
    // land on REQUESTS when someone is waiting for an answer
    tab = incoming && incoming.length ? "requests" : "friends"; autoTab = incoming === null;
    paintFriends();
  }
  // start listening in the background once signed in, so invites and requests arrive anywhere in the game
  const boot = () => { if (F() && typeof Unlocks !== "undefined" && Unlocks.isUnlocked("friends")) listen(); };
  document.addEventListener("debugr:ready", boot);
  document.addEventListener("debugr:progress", boot);
  document.addEventListener("debugr:rating", () => { if (!$("screen-profile").classList.contains("hidden")) paintMe(); });
  document.addEventListener("debugr:screen", (e) => { if (e.detail && e.detail.name === "profile") open(); });

  return { open, paintMe, ids: () => friends || [] };
})();
