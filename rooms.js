// Rooms: host / join / lobby / live race / round results.
// Firestore plumbing lives in firebaseclient.js, pure rules of the match in roomlogic.js.
const Rooms = (() => {
  "use strict";
  const RL = RoomLogic;
  const $ = (id) => document.getElementById(id);
  const sfx = (n) => { try { if (typeof Sound !== "undefined") Sound.play(n); } catch (_) { /* sound is optional */ } };
  const toast = (m, ms) => { if (typeof Rewards !== "undefined") Rewards.toast(m, ms); };
  const SPEED_LABEL = { normal: "NORMAL", hungry: "HUNGRY", feral: "FERAL" };
  const NEXT_ROUND_SECONDS = 10;

  // ---- session state (all reset by cleanup) ----
  let code = null, myUid = null, myName = "";
  let room = RL.normalizeRoom(null), roomLoaded = false;
  let players = [], playersLoaded = false, seenSelf = false, reactSeen = {}, saySeen = {}, lastReact = 0, lastSay = 0;
  let unsubs = [];
  let phaseKey = "", prevPhase = "";
  let localRound = -1, racing = false, myTotal = 0;
  let my = { passed: 0, bites: 0 };
  let cdTimers = [], resultsTimer = null, resultsEndsAt = 0, resultsRound = -1, startingRound = -1;
  let progressTimer = null, pendingProgress = null;
  let tracker = RL.createSabotageTracker();
  let lastBites = Object.create(null);
  let laneEls = new Map();
  let feedEl = null;
  let pendingInvite = "", ratedSynced = false;
  let joinPeek = null, joinSeq = 0, joinTimer = null;

  const isHost = () => !!code && room.hostUid === myUid;
  const nameOf = (uid) => { const p = players.find((x) => x.token === uid); return p ? p.nickname : (uid === room.winnerUid ? room.winnerNickname : "someone"); };
  const fmt = (ms) => (ms / 1000).toFixed(1) + "s";
  const pfp = (id) => { try { return Rewards.pfp(id); } catch (_) { return '<span class="pfp"></span>'; } };
  const inviteUrl = (c) => (/^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname) ? location.origin : "https://debugr.fun") + "/?room=" + c;

  // ---------------------------------------------------------------- entering / leaving
  async function host(inviteUid) {
    const nick = PlayerState.getNickname();
    if (!nick) return toast("Pick a nickname first.");
    try {
      const c = await FirebaseClient.hostRoom({ difficulty: "easy", rounds: 1, speed: "normal", sabotage: false }, nick);
      enter(c);
      if (typeof inviteUid === "string") FirebaseClient.friends.sendInvite(inviteUid, c, nick).then(() => toast("Invite sent. Waiting for your friend."), () => toast("Room is open, but the invite didn't send. Share the code."));
    } catch (err) {
      console.error(err);
      toast("Could not create a room. Check your connection.");
    }
  }

  function enter(c) {
    cleanup(false);
    code = c; myUid = FirebaseClient.getUid(); myName = PlayerState.getNickname() || "player";
    room = RL.normalizeRoom(null); roomLoaded = false; players = []; playersLoaded = false; seenSelf = false; reactSeen = {}; saySeen = {};
    phaseKey = ""; prevPhase = ""; localRound = -1; racing = false; resultsRound = -1; startingRound = -1; ratedSynced = false;
    tracker.reset(); lastBites = Object.create(null);
    unsubs.push(FirebaseClient.listenRoomState(c, onRoom, onGone));
    unsubs.push(FirebaseClient.listenRoomPlayers(c, onPlayers));
    // heartbeat: tell the room we are still here; and drop players who have been silent for 100 seconds
    const beat = () => { try { if (code) FirebaseClient.heartbeat(code).catch(() => { }); } catch (_) { /* offline */ } };
    const sweep = () => {
      if (!code) return;
      players.forEach((p) => {
        const t = p.seen && p.seen.toMillis ? p.seen.toMillis() : 0;
        if (p.token !== myUid && t && Date.now() - t > 100000) FirebaseClient.kickPlayer(code, p.token).catch(() => { });
      });
    };
    beat();
    const hb = setInterval(() => { beat(); sweep(); }, 20000);
    unsubs.push(() => clearInterval(hb));
    App.showScreen("lobby");
  }

  // called by script.js teardownGame (home, logo, etc.) and by the leave buttons
  function leave() {
    if (!code) return;
    const c = code;
    cleanup(true);
    FirebaseClient.leaveRoom(c);
  }

  // closing the tab: try to leave properly so the others are told (best effort, a closed tab can't always finish the write)
  window.addEventListener("pagehide", () => { if (code) { try { FirebaseClient.leaveRoom(code); } catch (_) { /* ignore */ } } });

  function cleanup(hideOverlays) {
    unsubs.forEach((u) => { try { u(); } catch (_) { /* already gone */ } });
    unsubs = [];
    cdTimers.forEach(clearTimeout); cdTimers = [];
    clearInterval(resultsTimer); resultsTimer = null;
    clearTimeout(progressTimer); progressTimer = null; pendingProgress = null;
    if (racing) { try { App.stopRun(); } catch (_) { /* no run */ } }
    racing = false; code = null;
    laneEls = new Map();
    const lanes = $("race-lanes"); if (lanes) lanes.innerHTML = "";
    if (feedEl) feedEl.innerHTML = "";
    if (hideOverlays) { $("countdown").classList.add("hidden"); $("room-results").classList.add("hidden"); }
  }

  function exitToMenu(msg) {
    cleanup(true);
    if (msg) toast(msg, 3400);
    App.goHome();
  }
  const onGone = () => { if (code) exitToMenu("The room was closed."); };

  // ---------------------------------------------------------------- snapshots
  function onRoom(data) {
    if (!code) return;
    room = RL.normalizeRoom(data); roomLoaded = true;
    handlePhase();
    renderLobby(); renderRaceBar(); renderResults(false); maybeAutoStart();
  }

  function onPlayers(list) {
    if (!code) return;
    // tell the rest of the room when somebody leaves
    if (playersLoaded && seenSelf) {
      const now = new Set(list.map((p) => p.token));
      players.forEach((p) => { if (p.token !== myUid && !now.has(p.token)) toast(`${p.nickname || "A player"} left the room.`, 3000); });
    }
    const prevHost = room.hostUid;
    checkReactions(list); checkSays(list);
    players = list; playersLoaded = true;
    const me = players.find((p) => p.token === myUid);
    if (me) seenSelf = true;
    else if (seenSelf) return exitToMenu("You were removed from the room.");

    // host left: the smallest uid takes over (every client computes the same one)
    if (roomLoaded && RL.nextHost(players, room.hostUid) === myUid) {
      if (prevHost && prevHost !== myUid) toast("The host left. You are the host now.", 3400);
      FirebaseClient.claimHost(code, myName).catch(() => {});
    }
    handlePhase();
    renderLobby(); renderRaceBar(); renderLanes(); watchRivals(); renderResults(false); maybeAutoStart();
  }

  // ---------------------------------------------------------------- reactions (results screen only)
  const REACT = { clap: "👏", fire: "🔥", sweat: "😅", skull: "💀", bug: "🐛" };
  function floatReaction(name, id) {
    const box = $("rr-float"); if (!box || !REACT[id]) return;
    const el = document.createElement("div");
    el.className = "rr-pop";
    el.style.left = (8 + Math.random() * 70) + "%";
    el.innerHTML = `<span class="e">${REACT[id]}</span><span class="n"></span>`;
    el.querySelector(".n").textContent = name;
    box.appendChild(el);
    setTimeout(() => el.remove(), 2600);
    while (box.children.length > 14) box.firstChild.remove();
  }
  // a reaction is a change of react/reactAt on someone else's player document
  function checkReactions(list) {
    list.forEach((p) => {
      const at = p.reactAt && p.reactAt.toMillis ? p.reactAt.toMillis() : 0;
      const key = p.react ? p.react + ":" + at : "";
      const prev = reactSeen[p.token];
      reactSeen[p.token] = key;
      if (!playersLoaded || !key || key === prev || p.token === myUid) return;
      if (room.phase === "results") floatReaction(p.nickname || "player", p.react);
    });
  }
  // quick messages (lobby and results): a preset phrase, shown as a bubble on everyone's screen
  const SAY = { gg: "gg", wp: "well played", again: "again?", ready: "ready!", wait: "one sec", close: "so close" };
  function floatSay(name, id) {
    const box = $("say-float"); if (!box || !SAY[id]) return;
    const el = document.createElement("div");
    el.className = "say-pop";
    const n = document.createElement("b"); n.textContent = name;
    el.append(n, document.createTextNode(" " + SAY[id]));
    box.appendChild(el);
    setTimeout(() => el.remove(), 4200);
    while (box.children.length > 5) box.firstChild.remove();
  }
  function checkSays(list) {
    list.forEach((p) => {
      const at = p.sayAt && p.sayAt.toMillis ? p.sayAt.toMillis() : 0;
      const key = p.say ? p.say + ":" + at : "";
      const prev = saySeen[p.token];
      saySeen[p.token] = key;
      if (!playersLoaded || !key || key === prev || p.token === myUid) return;
      if (room.phase === "lobby" || room.phase === "results") floatSay(p.nickname || "player", p.say);
    });
  }
  function onSay(e) {
    const b = e.target.closest("[data-say]");
    if (!b || !code || (room.phase !== "lobby" && room.phase !== "results")) return;
    if (Date.now() - lastSay < 1500) return; // no spamming
    lastSay = Date.now();
    floatSay("you", b.dataset.say);
    FirebaseClient.sendSay(code, b.dataset.say).catch(() => { });
  }
  $("say-lobby").addEventListener("click", onSay);
  $("say-results").addEventListener("click", onSay);
  $("rr-react").addEventListener("click", (e) => {
    const b = e.target.closest("[data-react]");
    if (!b || !code || room.phase !== "results") return;
    if (Date.now() - lastReact < 1200) return; // no spamming
    lastReact = Date.now();
    floatReaction("you", b.dataset.react);
    FirebaseClient.sendReaction(code, b.dataset.react).catch(() => { });
  });

  // ---------------------------------------------------------------- phase changes
  function handlePhase() {
    if (!roomLoaded) return;
    const key = room.phase + ":" + room.round;
    if (key === phaseKey) return;
    phaseKey = key;
    const was = prevPhase; prevPhase = room.phase;

    if (room.phase === "lobby") {
      cdTimers.forEach(clearTimeout); cdTimers = [];
      clearInterval(resultsTimer); resultsTimer = null;
      if (racing) { App.stopRun(); racing = false; }
      $("countdown").classList.add("hidden");
      localRound = -1; resultsRound = -1;
      App.showScreen("lobby");
      if (was && was !== "lobby" && !isHost()) FirebaseClient.setReady(code, false).catch(() => {});
    } else if (room.phase === "race") {
      if (room.round !== localRound) startCountdown(room.round);
    } else if (room.phase === "results") {
      cdTimers.forEach(clearTimeout); cdTimers = [];
      $("countdown").classList.add("hidden");
      if (racing) { App.stopRun(); racing = false; }
      startResults();
    }
  }

  // ---------------------------------------------------------------- countdown + race
  function startCountdown(round) {
    localRound = round;
    let task = null;
    try { task = TaskEngine.rebuildTask(room.task); } catch (_) { task = null; }
    if (!task) return exitToMenu("That round had a broken task, so the room was left.");
    myTotal = task.rules.length; my = { passed: 0, bites: 0 };
    tracker.reset(); lastBites = Object.create(null);
    $("room-results").classList.add("hidden");
    FirebaseClient.writeProgress(code, { done: false, passed: 0, total: myTotal, bites: 0, elapsedMs: 0, grid: "", ready: false, round }).catch(() => {});

    const cd = $("countdown");
    $("cd-round").textContent = "ROUND " + round + (room.rounds > 1 ? " OF " + room.rounds : "");
    $("cd-sub").textContent = "first to satisfy the spec wins";
    cd.classList.remove("hidden");
    const step = (n) => {
      $("cd-num").textContent = n > 0 ? String(n) : "GO";
      sfx(n > 0 ? "tick" : "click");
    };
    step(3);
    cdTimers = [
      setTimeout(() => step(2), 1000),
      setTimeout(() => step(1), 2000),
      setTimeout(() => step(0), 3000),
      setTimeout(() => {
        cd.classList.add("hidden");
        if (!code || room.phase !== "race" || room.round !== round) return;
        racing = true;
        App.startGame(room.difficulty, "multiplayer", task, { bugScale: RL.SPEEDS[room.speed] || 1 });
        renderRaceBar(); renderLanes();
      }, 3500),
    ];
    // lanes need to exist behind the countdown too
    App.showScreen("game");
    renderRaceBar(); renderLanes();
  }

  // push my progress (debounced so typing doesn't hammer Firestore)
  function queueProgress(patch) {
    if (!code || !racing || room.phase !== "race") return;
    pendingProgress = Object.assign(pendingProgress || {}, patch);
    if (progressTimer) return;
    progressTimer = setTimeout(() => {
      progressTimer = null;
      const p = pendingProgress; pendingProgress = null;
      if (p && code && racing) FirebaseClient.writeProgress(code, Object.assign({ round: localRound }, p)).catch(() => {});
    }, 400);
  }
  document.addEventListener("debugr:rules", (e) => {
    if (!code || !racing) return;
    my.passed = e.detail.passed; myTotal = e.detail.total;
    queueProgress({ passed: e.detail.passed, total: e.detail.total });
    renderLanes();
  });
  document.addEventListener("debugr:bite", (e) => {
    if (!code || !racing) return;
    my.bites = e.detail.bites;
    queueProgress({ bites: e.detail.bites });
    renderLanes();
  });
  document.addEventListener("debugr:race-finish", (e) => {
    try { PlayerState.bumpStat("rooms"); document.dispatchEvent(new CustomEvent("debugr:progress")); } catch (_) { }
    if (!code) return;
    const d = e.detail;
    racing = false;
    clearTimeout(progressTimer); progressTimer = null; pendingProgress = null;
    my.passed = myTotal;
    FirebaseClient.finishRound(code, localRound, myName, { elapsedMs: d.elapsedMs, bites: d.bites, grid: String(d.grid).slice(0, 16), total: myTotal });
    // results appear when the room doc flips to "results" (usually instantly)
  });

  // sabotage: only counts rules a rival newly met this round
  function watchRivals() {
    if (!racing || room.phase !== "race") return;
    for (const p of players) {
      if (p.token === myUid || p.round !== room.round) continue;
      if (room.sabotage) {
        const gain = tracker.update(p.token, p.passed || 0);
        if (gain > 0) {
          App.boostAppetite(RL.SABOTAGE_BOOST * gain);
          feed(`<b>SABOTAGE</b> ${esc(p.nickname)} met a rule. your bug got ${Math.round(RL.SABOTAGE_BOOST * gain * 100)}% hungrier.`, true);
        }
      }
      const prev = lastBites[p.token] || 0;
      if ((p.bites || 0) > prev) feed(`${esc(p.nickname)} got bitten.`, false);
      lastBites[p.token] = p.bites || 0;
    }
  }

  function feed(html, hot) {
    if (!feedEl) {
      feedEl = document.createElement("div");
      feedEl.className = "sabotage-feed";
      const host = $("editor-container");
      if (!host) return;
      host.appendChild(feedEl);
    }
    const d = document.createElement("div");
    if (hot) d.className = "hot";
    d.innerHTML = html;
    feedEl.appendChild(d);
    while (feedEl.children.length > 3) feedEl.removeChild(feedEl.firstChild);
    setTimeout(() => d.remove(), 4800);
  }

  // ---------------------------------------------------------------- race bar
  function winsText() {
    const wins = RL.winsByUid(room.roundWinners);
    const mine = wins[myUid] || 0;
    let topUid = null, top = 0;
    for (const u in wins) if (u !== myUid && wins[u] > top) { top = wins[u]; topUid = u; }
    if (mine === 0 && top === 0) return "";
    if (mine > top) return `you lead ${mine} – ${top}`;
    if (mine < top) return `${nameOf(topUid)} leads ${top} – ${mine}`;
    return `all square ${mine} – ${top}`;
  }

  function renderRaceBar() {
    if (!code || !roomLoaded) return;
    $("race-round").textContent = `${Math.max(1, room.round)} / ${room.rounds}`;
    const mine = RL.winsByUid(room.roundWinners)[myUid] || 0;
    const pips = $("race-pips");
    pips.innerHTML = Array.from({ length: room.rounds }, (_, i) => `<i class="${i < mine ? "on" : ""}"></i>`).join("");
    $("race-lead").textContent = winsText();
  }

  function laneStatus(p, isMe) {
    const passed = isMe ? my.passed : p.passed || 0;
    const total = isMe ? myTotal : p.total || 0;
    const bites = isMe ? my.bites : p.bites || 0;
    if (p.done) return { t: `finished ${fmt(p.elapsedMs || 0)}`, cls: "", bug: "done" };
    if (bites > 0) return { t: `bitten ${bites}x`, cls: "bad", bug: "bad" };
    if (total && total - passed === 1) return { t: "one rule left", cls: "warn", bug: "warn" };
    if (!passed) return { t: "reading the spec", cls: "", bug: "" };
    return { t: `${passed} rule${passed === 1 ? "" : "s"} met`, cls: "", bug: "" };
  }

  function renderLanes() {
    const wrap = $("race-lanes");
    if (!code || !wrap) return;
    const list = players.filter((p) => p.round === room.round || p.token === myUid)
      .sort((a, b) => (a.token === myUid ? -1 : b.token === myUid ? 1 : a.nickname.localeCompare(b.nickname)));
    const keep = new Set(list.map((p) => p.token));
    for (const [id, el] of laneEls) if (!keep.has(id)) { el.remove(); laneEls.delete(id); }
    for (const p of list) {
      const me = p.token === myUid;
      let el = laneEls.get(p.token);
      if (!el) {
        el = document.createElement("div");
        el.className = "lane" + (me ? " me" : "");
        el.innerHTML = `<span class="lane-name"></span><div class="track"><span class="tick" style="left:25%"></span><span class="tick" style="left:50%"></span><span class="tick" style="left:75%"></span><svg class="bug" aria-hidden="true"><use href="#bug-sprite"/></svg></div><span class="lane-count"></span><span class="lane-status"></span>`;
        wrap.appendChild(el);
        laneEls.set(p.token, el);
      }
      const st = laneStatus(p, me);
      const passed = me ? my.passed : p.passed || 0, total = me ? myTotal : p.total || 0;
      el.querySelector(".lane-name").textContent = p.nickname + (me ? " (you)" : "");
      el.querySelector(".bug").setAttribute("class", "bug" + (st.bug ? " " + st.bug : ""));
      el.querySelector(".bug").style.left = (3 + RL.lanePosition(passed, total) * 94) + "%";
      el.querySelector(".lane-count").textContent = total ? `${passed} / ${total}` : "–";
      const s = el.querySelector(".lane-status");
      s.textContent = st.t; s.className = "lane-status" + (st.cls ? " " + st.cls : "");
    }
  }

  // ---------------------------------------------------------------- lobby
  function renderLobby() {
    if (!code || !roomLoaded) return;
    const hostMe = isHost();
    $("room-code-boxes").innerHTML = code.split("").map((ch) => `<span class="filled">${esc(ch)}</span>`).join("");
    $("invite-link").textContent = inviteUrl(code).replace(/^https?:\/\//, "");
    $("lobby-seats").textContent = room.quick ? "RATED QUICK MATCH · starting…" : `${players.length} of ${RL.MAX_PLAYERS} seats taken`;
    $("lobby-players-head").textContent = `PLAYERS · ${players.length}`;
    $("lobby-kick-hint").textContent = hostMe && players.length > 1 ? "click × to kick someone" : "";

    const ordered = players.slice().sort((a, b) => (a.token === room.hostUid ? -1 : b.token === room.hostUid ? 1 : a.nickname.localeCompare(b.nickname)));
    const cards = ordered.map((p) => {
      const me = p.token === myUid, isH = p.token === room.hostUid;
      const ready = p.ready || isH;
      const sub = [me ? "you" : "", isH ? "host" : ""].filter(Boolean).join(" · ") || "player";
      const kick = hostMe && !me ? `<button class="kick" data-kick="${esc(p.token)}" aria-label="Kick ${esc(p.nickname)}">×</button>` : "";
      return `<div class="pcard${me ? " me" : ""}">${pfp(p.avatar)}<div class="pwho"><b>${esc(p.nickname)}</b><span>${sub}</span></div><span class="tag${ready ? " ready" : ""}">${ready ? "READY" : "NOT READY"}</span>${kick}</div>`;
    });
    if (players.length < RL.MAX_PLAYERS) cards.push(`<div class="pcard empty">waiting for someone…</div>`);
    $("room-player-grid").innerHTML = cards.join("");

    // settings: editable by the host only
    for (const seg of document.querySelectorAll("#room-settings .seg")) {
      const key = seg.dataset.set;
      for (const b of seg.querySelectorAll("button")) {
        b.classList.toggle("on", String(room[key]) === b.dataset.val);
        b.disabled = !hostMe;
      }
    }
    const sw = $("sabotage-toggle");
    sw.setAttribute("aria-checked", String(room.sabotage)); sw.classList.toggle("on", room.sabotage); sw.disabled = !hostMe;
    $("settings-note").classList.toggle("hidden", hostMe);

    const info = RL.readyInfo(players, room.hostUid);
    const start = $("start-race-btn"), ready = $("ready-btn");
    start.classList.toggle("hidden", !hostMe);
    ready.classList.toggle("hidden", hostMe);
    start.disabled = !info.canStart || room.phase !== "lobby";
    start.textContent = `START RACE · ${info.ready} / ${info.total} READY`;
    const mine = players.find((p) => p.token === myUid);
    ready.textContent = mine && mine.ready ? "READY ✓ (tap to undo)" : "I'M READY";
    ready.classList.toggle("on", !!(mine && mine.ready));
    $("start-hint").textContent = hostMe
      ? (info.total < 2 ? "Waiting for at least one more player." : info.canStart ? "Everyone gets a 3-2-1 countdown." : "Waiting for players to ready up.")
      : `Waiting for ${room.hostName || "the host"} to start.`;
  }

  // lobby clicks
  $("room-player-grid").addEventListener("click", (e) => {
    const k = e.target.closest("[data-kick]");
    if (k && isHost()) FirebaseClient.kickPlayer(code, k.dataset.kick).catch(() => toast("Could not kick that player."));
  });
  $("room-settings").addEventListener("click", (e) => {
    if (!isHost() || room.phase !== "lobby") return;
    const b = e.target.closest(".seg button");
    if (b) {
      const key = b.parentElement.dataset.set;
      let val = b.dataset.val;
      if (key === "rounds") val = parseInt(val, 10);
      FirebaseClient.updateRoomSettings(code, { [key]: val }).catch(() => toast("Could not change that setting."));
      return;
    }
    if (e.target.closest("#sabotage-toggle")) FirebaseClient.updateRoomSettings(code, { sabotage: !room.sabotage }).catch(() => {});
  });
  $("ready-btn").addEventListener("click", () => {
    const mine = players.find((p) => p.token === myUid);
    FirebaseClient.setReady(code, !(mine && mine.ready)).catch(() => {});
  });
  $("start-race-btn").addEventListener("click", () => {
    if (!isHost() || room.phase !== "lobby") return;
    if (!RL.readyInfo(players, room.hostUid).canStart) return;
    startNext(1);
  });
  $("copy-invite-btn").addEventListener("click", () => { if (code) copy(inviteUrl(code), "Invite link copied."); });
  $("leave-room-btn").addEventListener("click", () => { leave(); App.goHome(); });

  function startNext(round) {
    if (startingRound === round) return;
    startingRound = round;
    FirebaseClient.startRound(code, round, room.difficulty).catch((err) => {
      console.error(err); startingRound = -1; toast("Could not start the round.");
    });
  }

  function copy(text, msg) {
    const done = () => toast(msg);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => App.copyText(text));
    else App.copyText(text);
  }

  // ---------------------------------------------------------------- results
  function startResults() {
    if (resultsRound === room.round) return;
    resultsRound = room.round;
    clearInterval(resultsTimer);
    $("room-results").classList.remove("hidden");
    sfx(room.winnerUid === myUid ? "win" : "lose");
    const over = RL.matchState(room).over;
    if (!over) {
      resultsEndsAt = Date.now() + NEXT_ROUND_SECONDS * 1000;
      resultsTimer = setInterval(tickResults, 250);
    }
    renderResults(true);
  }

  function tickResults() {
    if (!code || room.phase !== "results") return clearInterval(resultsTimer);
    const left = Math.max(0, Math.ceil((resultsEndsAt - Date.now()) / 1000));
    $("rr-clock").textContent = `0:${String(left).padStart(2, "0")}`;
    if (left === 0) { clearInterval(resultsTimer); resultsTimer = null; maybeAutoStart(true); }
  }

  // the host starts the next round when everyone is ready, or when the timer runs out
  function maybeAutoStart(timeUp) {
    // a rated quick match starts by itself: both players were put in the room already marked ready
    if (code && room.quick && isHost() && room.phase === "lobby" && playersLoaded && players.length === 2 && room.round === 0) return startNext(1);
    if (!code || !isHost() || room.phase !== "results" || !playersLoaded) return;
    const ms = RL.matchState(room);
    if (ms.over) return;
    const info = RL.readyInfo(players, room.hostUid);
    if (info.total < 2) return;
    if (info.all || timeUp) startNext(room.round + 1);
  }

  function renderResults(first) {
    if (!code || room.phase !== "results" || resultsRound !== room.round) return;
    const ms = RL.matchState(room);
    const winner = room.winnerUid;
    const rows = RL.sortResults(players.map((p) => p.round === room.round ? p : Object.assign({}, p, { done: false, passed: 0, bites: 0, grid: "" })));
    const wi = rows.findIndex((p) => p.token === winner);
    if (wi > 0) rows.unshift(rows.splice(wi, 1)[0]);

    $("rr-bug").style.transform = "rotate(180deg)";
    $("rr-eyebrow").textContent = ms.over ? `FINAL · ROUND ${room.round} OF ${room.rounds}` : `ROUND ${room.round} OF ${room.rounds} · SYNCED`;
    const wname = winner === myUid ? "you" : nameOf(winner);
    $("rr-title").textContent = ms.over
      ? (ms.champion ? `${ms.champion === myUid ? "you" : nameOf(ms.champion)} ${ms.champion === myUid ? "win" : "wins"} the match` : "the match is a draw")
      : `${wname} took the round`;

    $("rr-table").innerHTML = `<div class="rr-row head"><span>#</span><span>PLAYER</span><span>TIME</span><span>BITES</span><span class="rr-cells-h">HOW CLOSE THE BUG GOT</span></div>` +
      rows.map((p, i) => {
        const me = p.token === myUid;
        const cells = String(p.grid || "").split("").map((c) => `<i class="${c === "a" ? "a" : c === "r" ? "r" : ""}"></i>`).join("");
        return `<div class="rr-row${me ? " me" : ""}"><span class="rk${i === 0 && p.done ? " first" : ""}">${i + 1}</span><span class="nm">${esc(p.nickname)}${me ? " (you)" : ""}</span>` +
          `<span>${p.done ? fmt(p.elapsedMs) : '<span class="dnf">did not finish</span>'}</span><span>${p.bites || 0}</span><div class="rr-cells">${cells}</div></div>`;
      }).join("");

    // score
    $("rr-score-title").textContent = room.rounds === 1 ? "SCORE · SINGLE ROUND" : `SCORE · BEST OF ${room.rounds}`;
    const pipsN = Math.max(1, ms.need);
    const byWins = players.slice().sort((a, b) => (ms.wins[b.token] || 0) - (ms.wins[a.token] || 0) || a.nickname.localeCompare(b.nickname));
    $("rr-score").innerHTML = byWins.map((p) => {
      const w = ms.wins[p.token] || 0;
      return `<div class="sc-row${p.token === myUid ? " me" : ""}"><span class="nm">${esc(p.nickname)}</span><span class="pp">${Array.from({ length: pipsN }, (_, i) => `<i class="${i < w ? "on" : ""}"></i>`).join("")}</span><span class="n">${w}</span></div>`;
    }).join("");

    // next up
    const btn = $("rr-ready-btn"), mine = players.find((p) => p.token === myUid);
    if (ms.over && room.quick) {
      // rated quick match: no rematch. the server writes room.rated a moment after the result
      const r = room.rated && room.rated[myUid];
      $("rr-next-label").textContent = "RATED MATCH";
      $("rr-clock").textContent = "";
      $("rr-next-text").textContent = r
        ? (r.repeat ? "You have met this player too often today, so your rating did not change."
          : `Race rating ${r.before} → ${r.after} (${r.delta > 0 ? "+" : r.delta < 0 ? "−" : "±"}${Math.abs(r.delta)})${r.tierUp ? " · new tier: " + r.tierUp : ""}`)
        : "Working out your rating…";
      if (r && !ratedSynced) { ratedSynced = true; Ratings.sync().catch(() => {}); }
      btn.classList.add("hidden");
    } else if (ms.over) {
      $("rr-next-label").textContent = "MATCH OVER";
      $("rr-clock").textContent = "";
      $("rr-next-text").textContent = isHost() ? "The room stays open. Rematch keeps the same players and resets the score." : `Waiting for ${room.hostName || "the host"} to start a rematch.`;
      btn.textContent = "REMATCH"; btn.classList.toggle("hidden", !isHost()); btn.disabled = false;
    } else {
      $("rr-next-label").textContent = "NEXT UP";
      $("rr-next-text").textContent = `Round ${room.round + 1} starts when everyone is ready, or when the timer runs out.`;
      const rd = isHost() || (mine && mine.ready);
      btn.classList.remove("hidden");
      btn.textContent = isHost() ? `START ROUND ${room.round + 1} NOW` : rd ? "READY ✓" : `READY FOR ROUND ${room.round + 1}`;
      btn.disabled = false;
    }
  }

  $("rr-ready-btn").addEventListener("click", () => {
    if (!code || room.phase !== "results") return;
    const ms = RL.matchState(room);
    if (ms.over) { if (isHost()) FirebaseClient.rematch(code).catch(() => toast("Could not start a rematch.")); return; }
    if (isHost()) { if (players.length >= 2) startNext(room.round + 1); return; }
    const mine = players.find((p) => p.token === myUid);
    FirebaseClient.setReady(code, !(mine && mine.ready)).catch(() => {});
  });
  $("rr-copy-btn").addEventListener("click", () => {
    const me = players.find((p) => p.token === myUid);
    if (!me) return;
    const g = String(me.round === room.round ? me.grid : "").split("").map((c) => (c === "r" ? "🟥" : c === "a" ? "🟨" : "🟩")).join("");
    const head = `debugr.fun · room ${code} · round ${room.round}`;
    const line = me.done && me.round === room.round ? `${fmt(me.elapsedMs)} · ${me.bites} bite${me.bites === 1 ? "" : "s"}` : "did not finish";
    copy(`${head}\n${line}\n${g}\nhttps://debugr.fun`, "Grid copied.");
  });
  $("rr-leave-btn").addEventListener("click", () => { leave(); App.goHome(); });

  // ---------------------------------------------------------------- join screen
  function openJoin(prefill) {
    cleanup(false);
    const input = $("join-code-input");
    input.value = ""; joinPeek = null;
    App.showScreen("join");
    setJoinUi("", "");
    renderJoinBoxes();
    if (prefill) { input.value = prefill; onJoinInput(); }
    if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches || prefill) input.focus();
  }

  const cleanCode = (s) => String(s || "").toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 4);

  function renderJoinBoxes() {
    const v = $("join-code-input").value;
    const focused = document.activeElement === $("join-code-input");
    document.querySelectorAll("#join-code-wrap .code-boxes span").forEach((s, i) => {
      s.textContent = v[i] || "";
      s.classList.toggle("filled", !!v[i]);
      s.classList.toggle("cursor", focused && i === Math.min(v.length, 3) && v.length < 4);
    });
  }

  function setJoinUi(status, error, warn) {
    const st = $("join-status");
    st.textContent = status; st.classList.toggle("warn", !!warn);
    $("join-error").textContent = error || "";
  }

  function onJoinInput() {
    const input = $("join-code-input");
    const parsed = RL.parseRoomCode(input.value);
    input.value = cleanCode(parsed || input.value);
    renderJoinBoxes();
    joinPeek = null;
    $("join-submit-btn").disabled = true;
    clearTimeout(joinTimer);
    const c = input.value;
    if (c.length < 4) {
      setJoinUi("", "");
      $("join-preview").innerHTML = `<div class="preview-empty">Fill in a code to see who is hosting.</div>`;
      return;
    }
    setJoinUi("looking for room…", "", true);
    const seq = ++joinSeq;
    joinTimer = setTimeout(async () => {
      let res = null, failed = false;
      try { res = await FirebaseClient.peekRoom(c); } catch (err) { console.error(err); failed = true; }
      if (seq !== joinSeq) return;
      if (failed) return setJoinUi("", "Could not reach the server. Try again.");
      if (!res) {
        $("join-preview").innerHTML = `<div class="preview-empty">No room called ${esc(c)}.</div>`;
        return setJoinUi("", `No room called ${c}.`);
      }
      joinPeek = { code: c, data: res };
      renderPreview(res);
      const room_ = RL.normalizeRoom(res.room);
      if (room_.phase !== "lobby") return setJoinUi("", "That match already started.");
      if (res.players.length >= RL.MAX_PLAYERS) return setJoinUi("", "That room is full.");
      setJoinUi("room found", "");
      $("join-submit-btn").disabled = false;
    }, 200);
  }

  function renderPreview(res) {
    const r = RL.normalizeRoom(res.room);
    const h = res.players.find((p) => p.token === r.hostUid);
    const faces = res.players.slice(0, 6).map((p) => pfp(p.avatar)).join("");
    $("join-preview").innerHTML =
      `<div class="pv-host">${pfp(h ? h.avatar : "bug")}<div class="pwho">${esc(r.hostName || "host")}<span>hosting</span></div></div>` +
      `<div class="pv-chips"><div class="pv-chip"><span class="k">LEVEL</span><b>${r.difficulty.toUpperCase()}</b></div>` +
      `<div class="pv-chip"><span class="k">ROUNDS</span><b>${r.rounds === 1 ? "1" : "BEST OF " + r.rounds}</b></div>` +
      `<div class="pv-chip"><span class="k">BUG SPEED</span><b>${SPEED_LABEL[r.speed]}</b></div></div>` +
      `<div class="pv-faces">${faces}<span>${res.players.length} of ${RL.MAX_PLAYERS} inside</span></div>`;
  }

  async function submitJoin() {
    if (!joinPeek || $("join-submit-btn").disabled) return;
    const nick = PlayerState.getNickname();
    if (!nick) return setJoinUi("", "Pick a nickname first.");
    const c = joinPeek.code;
    $("join-submit-btn").disabled = true;
    try {
      await FirebaseClient.joinRoom(c, nick);
      enter(c);
    } catch (err) {
      setJoinUi("", err && err.message ? err.message : "Could not join that room.");
      $("join-submit-btn").disabled = false;
    }
  }

  $("join-code-input").addEventListener("input", onJoinInput);
  $("join-code-input").addEventListener("focus", renderJoinBoxes);
  $("join-code-input").addEventListener("blur", renderJoinBoxes);
  $("join-code-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submitJoin(); } });
  $("join-code-wrap").addEventListener("click", () => $("join-code-input").focus());
  $("join-submit-btn").addEventListener("click", submitJoin);
  $("join-paste-btn").addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      const c = RL.parseRoomCode(text);
      if (!c) return setJoinUi("", "No room code in the clipboard.");
      $("join-code-input").value = c; onJoinInput();
    } catch (_) {
      setJoinUi("", "Paste isn't allowed here. Type the code or press Ctrl+V in the box.");
      $("join-code-input").focus();
    }
  });

  // ---------------------------------------------------------------- invite links: debugr.fun/?room=KQ7M
  let inviteHandled = false;
  function handleInvite() {
    if (inviteHandled) return;
    inviteHandled = true;
    const c = RL.parseRoomCode(location.search);
    if (!c) return;
    try { history.replaceState(null, "", location.pathname); } catch (_) { /* not critical */ }
    if (PlayerState.getNickname()) openJoin(c);
    else pendingInvite = c; // they are still picking a nickname; continue once they reach the menu
  }
  document.addEventListener("debugr:ready", handleInvite);
  if (window.__debugrReady) handleInvite();
  document.addEventListener("debugr:screen", (e) => {
    if (pendingInvite && e.detail.name === "menu") { const c = pendingInvite; pendingInvite = ""; openJoin(c); }
  });

  return { active: () => !!code, host, hostFor: (u) => host(u), openJoin: (c) => openJoin(typeof c === "string" ? c : ""), leave, enter };
})();
