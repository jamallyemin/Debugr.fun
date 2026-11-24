const Daily = (() => {
    const KEY = "debugr_daily";
    const $ = (id) => document.getElementById(id);

    // same task for everyone: seed math.random from the date while the task gets made
    function seedNum(str) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
        return h;
    }
    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const diffFor = (date) => (seedNum("diff:" + date) % 3 === 0 ? "hard" : "medium");
    function taskFor(date) {
        const real = Math.random;
        Math.random = mulberry32(seedNum("task:" + date));
        let task;
        try { task = TaskEngine.generateTask(diffFor(date), true); }
        finally { Math.random = real; }
        task.id = "daily-" + date;
        return task;
    }

    // todays result, kept on this device (and online too
    function loadDone(date) {
        try {
            const d = JSON.parse(localStorage.getItem(KEY) || "null");
            return d && d.date === date ? d : null;
        } catch { return null; }
    }
    function saveDone(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { } }

    let runDate = null, paintedDate = null;
    const secs = (ms) => (ms / 1000).toFixed(1) + "s";

    function paintHero() {
        const date = todayKey(), diff = diffFor(date), done = loadDone(date);
        const badge = $("dh-badge");
        badge.textContent = diff.toUpperCase();
        badge.classList.toggle("hard", diff === "hard");
        $("daily-hero").classList.toggle("done", !!done);
        $("dh-status").innerHTML = done ? `<b>${secs(done.elapsedMs)}</b> cleared today` : "one task, the same for everyone";
        $("dh-play-btn").innerHTML = done ? "PRACTICE" : `PLAY DAILY <span class="key-hint">D</span>`;
    }

    function tickTimer() {
        const now = new Date();
        if (todayKey(now) !== paintedDate) { paintedDate = todayKey(now); paintHero(); if (App.current() === "daily") paintScreen(); }
        const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
        const left = Math.max(0, Math.floor((next - now.getTime()) / 1000));
        const p = (n) => String(n).padStart(2, "0");
        $("dh-timer").textContent = `${p(Math.floor(left / 3600))}:${p(Math.floor(left / 60) % 60)}:${p(left % 60)}`;
    }

    // daily screen
    async function paintScreen() {
        const date = todayKey(), diff = diffFor(date), done = loadDone(date);
        $("daily-date").textContent = date;
        const badge = $("daily-badge");
        badge.textContent = diff.toUpperCase();
        badge.classList.toggle("hard", diff === "hard");
        $("daily-status").innerHTML = done
            ? `Cleared in <b>${secs(done.elapsedMs)}</b>. Replays are just practice, they don't change your rank. A new one arrives at 00:00 UTC.`
            : "One task, the same for everyone. Your first clear of the day counts. A new one arrives at 00:00 UTC.";
        $("daily-start-btn").textContent = done ? "PRACTICE" : "START";
        $("daily-copy-btn").classList.toggle("hidden", !done);

        const list = $("daily-list");
        list.innerHTML = `<li class="daily-empty">loading...</li>`;
        try {
            const rows = await FirebaseClient.fetchDaily(date);
            if (date !== todayKey() || App.current() !== "daily") return;
            if (!rows.length) return (list.innerHTML = `<li class="daily-empty">nobody yet. be the first</li>`);
            const me = FirebaseClient.getUid();
            list.innerHTML = rows.map((r, i) => `
                <li class="${r.uid === me ? "you" : ""}"><span class="dl-rank">${i + 1}</span>
                <span>${Rewards.pfp(r.avatar)}${esc(r.nickname)}</span><span class="dl-time">${secs(r.elapsedMs)}</span></li>`).join("");
        } catch {
            list.innerHTML = `<li class="daily-empty">couldn't load the ranking</li>`;
        }
    }

    function start() {
        runDate = todayKey();
        App.startGame(diffFor(runDate), "daily", taskFor(runDate));
    }

    document.addEventListener("debugr:daily-win", async (e) => {
        const { elapsedMs, difficulty, bites = 0, syncs = 0, grid = ["g"] } = e.detail;
        const date = runDate || todayKey();
        if (loadDone(date) || date !== todayKey()) return; // practice run or the day rolled over
        saveDone({ date, elapsedMs, difficulty, bites, syncs, grid });
        PlayerState.bumpStat("dailies");
        document.dispatchEvent(new CustomEvent("debugr:progress"));
        Rewards.check();
        paintHero();
        try {
            await FirebaseClient.submitDaily({ date, difficulty, elapsedMs, nickname: PlayerState.getNickname(), avatar: PlayerState.getAvatar() });
        } catch (err) { console.warn("daily score not saved online:", err); }
        paintSide(date, elapsedMs);
    });

    // top 5 next to the result screen
    async function paintSide(date, myMs) {
        const side = $("success-side"), list = $("side-list");
        try {
            const rows = await FirebaseClient.fetchDaily(date);
            if ($("success-screen").classList.contains("hidden")) return;
            const me = FirebaseClient.getUid();
            const top = rows.slice(0, 5);
            list.innerHTML = top.length ? top.map((r, i) => `<li class="${r.uid === me ? "you" : ""}"><span class="r">${i + 1}</span><span>${esc(r.nickname)}</span><span class="t">${secs(r.elapsedMs)}</span></li>`).join("") : `<li class="empty">nobody yet</li>`;
            const rank = rows.findIndex((r) => r.uid === me);
            $("side-rank").textContent = rank >= 0 ? `you: #${rank + 1} of ${rows.length}` : "";
            side.classList.remove("hidden");
        } catch { /* offline: the card just stays hidden */ }
    }

    function shareText() {
        const date = loadDone(todayKey()) ? todayKey() : (runDate || todayKey());
        const d = loadDone(date);
        if (!d) return "";
        return App.buildShare({ daily: true, date, difficulty: d.difficulty, elapsedMs: d.elapsedMs, bites: d.bites || 0, grid: d.grid, streak: PlayerState.getStreakCache().daily }).text;
    }
    async function copyResult() {
        const text = shareText();
        if (!text) return;
        let ok = false;
        try { await navigator.clipboard.writeText(text); ok = true; }
        catch {
            const ta = document.createElement("textarea");
            ta.value = text; document.body.appendChild(ta); ta.select();
            try { ok = document.execCommand("copy"); } catch { }
            ta.remove();
        }
        Rewards.toast(ok ? "Result copied" : "Couldn't copy it, sorry");
    }

    $("dh-play-btn").addEventListener("click", start);
    $("dh-rank-btn").addEventListener("click", () => App.showScreen("daily"));
    $("daily-start-btn").addEventListener("click", start);
    $("daily-copy-btn").addEventListener("click", copyResult);
    document.addEventListener("debugr:screen", (e) => { if (e.detail.name === "daily") paintScreen(); });

    // D on the menu starts the daily
    document.addEventListener("keydown", (e) => {
        if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || (window.SiteKeys && !SiteKeys.on())) return;
        if (e.key !== "d" && e.key !== "D") return;
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (App.current() !== "menu") return;
        if (document.querySelector(".modal-backdrop:not(.hidden)") || !$("tutorial-overlay").classList.contains("hidden")) return;
        e.preventDefault();
        start();
    });

    // grab a result saved from another device
    (function syncRemote() {
        let tries = 0;
        const t = setInterval(async () => {
            if (++tries > 40) return clearInterval(t);
            if (!FirebaseClient.getUid()) return;
            clearInterval(t);
            const date = todayKey();
            if (loadDone(date)) return;
            try {
                const r = await FirebaseClient.fetchMyDaily(date);
                if (r) { saveDone({ date, elapsedMs: r.elapsedMs, difficulty: r.difficulty, bites: 0, grid: ["g"] }); paintHero(); }
            } catch { }
        }, 500);
    })();

    paintedDate = todayKey();
    paintHero();
    tickTimer();
    setInterval(tickTimer, 1000);

    return { start, taskFor, diffFor };
})();