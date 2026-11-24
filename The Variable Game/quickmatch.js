// Rated quick match, client side. The matching itself happens in the Cloud Functions (functions/index.js):
// joinQueue puts you in the queue and pairs you with the closest rating, then both players land in a normal room
// (rooms.js) that starts by itself. Needs server mode (USE_CLOUD_FUNCTIONS in config.js) and a linked Google account.
const QuickMatch = (() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let diff = "easy", searching = false, poll = null, clock = null, unsub = null, since = 0, busy = false;

  const enabled = () => FirebaseClient.useFunctions();
  const say = (t) => { $("qm-status").textContent = t; };

  function paintRating() {
    const r = Ratings.get().race, t = Rating.tierFor(r.r), placing = r.g < Rating.PLACEMENT;
    $("qm-rating").innerHTML = `<span class="k">RACE RATING</span><b class="rc-num">${r.r}${placing ? "?" : ""}</b><span class="rc-tier" style="color:${t.color}">${placing ? "PLACING " + r.g + "/" + Rating.PLACEMENT : t.name}</span>`;
  }
  function paint() {
    paintRating();
    const linked = FirebaseClient.isLinked();
    $("qm-go").classList.toggle("hidden", !linked || searching);
    $("qm-link").classList.toggle("hidden", linked);
    $("qm-cancel").textContent = searching ? "CANCEL" : "BACK";
    document.querySelectorAll("#qm-diff button").forEach((b) => { b.classList.toggle("on", b.dataset.val === diff); b.disabled = searching; });
    if (!searching) say(linked ? "" : "Rated matches need a linked Google account, so nobody can farm rating with throwaway accounts.");
  }

  function open() {
    if (!enabled()) return;
    if (!PlayerState.getNickname()) return Rewards.toast("Pick a nickname first.");
    App.showScreen("quick");
    paint();
  }

  function stop(silent) {
    clearInterval(poll); clearInterval(clock); poll = clock = null;
    if (unsub) { try { unsub(); } catch (_) { } unsub = null; }
    const was = searching; searching = false;
    if (was && !silent) FirebaseClient.callFn("leaveQueue").catch(() => { });
    paint();
  }

  function matched(code) {
    stop(true);
    Rewards.toast("Match found.", 1800);
    Rooms.enter(code);
  }

  // calling joinQueue again is also how a waiting player re-checks for an opponent (the allowed rating gap widens over time)
  async function tick() {
    if (!searching || busy) return;
    busy = true;
    try {
      const r = await FirebaseClient.callFn("joinQueue", { difficulty: diff });
      if (searching && r && r.room) matched(r.room);
    } catch (err) {
      if (searching) { stop(true); say(friendly(err)); }
    } finally { busy = false; }
  }
  function friendly(err) {
    const m = err && err.message ? String(err.message) : "";
    if (/Google/i.test(m)) return "Link a Google account first (the button below).";
    if (/solo game/i.test(m)) return "Play one rated solo game first, then come back.";
    return "Could not search right now. Try again in a moment.";
  }

  async function start() {
    if (searching) return;
    searching = true; since = Date.now(); paint();
    say("Looking for an opponent near your rating…");
    clock = setInterval(() => { if (searching) say(`Looking for an opponent near your rating… ${Math.floor((Date.now() - since) / 1000)}s`); }, 1000);
    unsub = FirebaseClient.listenQueue((q) => { if (searching && q && q.room) matched(q.room); });
    await tick();
    poll = setInterval(tick, 4000);
  }

  $("qm-go").addEventListener("click", start);
  $("qm-cancel").addEventListener("click", () => stop(false));
  $("qm-diff").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b && !searching) { diff = b.dataset.val; paint(); } });
  $("qm-link").addEventListener("click", async () => {
    try { const r = await FirebaseClient.linkGoogle(); Rewards.toast(r.mode === "switched" ? "Switched to your saved account." : "Google linked.", 2400); await Ratings.sync(); }
    catch (err) { Rewards.toast("Could not link Google.", 2400); }
    paint();
  });
  document.addEventListener("debugr:rating", () => { if (!$("screen-quick").classList.contains("hidden")) paintRating(); });
  // the menu row only exists in server mode
  document.addEventListener("debugr:ready", () => { $("qm-row").classList.toggle("hidden", !enabled()); });
  if (window.__debugrReady) $("qm-row").classList.toggle("hidden", !enabled());
  document.addEventListener("debugr:screen", (e) => { if (e.detail.name !== "quick" && searching) stop(false); });

  return { open, stop };
})();
