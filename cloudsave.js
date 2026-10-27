const CloudSave = (() => {
    const $ = (id) => document.getElementById(id);
    let lastPushed = "", timer = null, busy = false;

    function setStatus(text, cls) {
        const el = $("save-status");
        el.textContent = text;
        el.className = "save-text" + (cls ? " " + cls : "");
    }

    // only these keys are allowed by validSave in firestore.rules
    function snapshot() {
        const snap = {
            puzzle: PuzzleState.load(),
            stats: PlayerState.getStats(),
            avatar: PlayerState.getAvatar(),
            puzzleStreak: readJSON(PlayerState.KEY_PUZZLE_STREAK, { count: 0, last: null }),
        };
        const nick = PlayerState.getNickname();
        if (nick) snap.nickname = nick;
        return snap;
    }

    // mixes a cloud save into this device, keeps the higher value of everything
    // identity = true right after switching accounts (cloud nickname/picture win)
    function merge(cloud, identity) {
        if (!cloud) return;
        const puzzle = PuzzleState.load();
        for (const [k, v] of Object.entries(cloud.puzzle || {})) puzzle[k] = Math.max(puzzle[k] || 0, Number(v) || 0);
        PuzzleState.save(puzzle);

        const stats = PlayerState.getStats();
        for (const [k, v] of Object.entries(cloud.stats || {})) stats[k] = Math.max(stats[k] || 0, Number(v) || 0);
        localStorage.setItem(PlayerState.KEY_STATS, JSON.stringify(stats));

        const a = readJSON(PlayerState.KEY_PUZZLE_STREAK, { count: 0, last: null });
        const b = cloud.puzzleStreak || { count: 0, last: null };
        const pick = (a.last || "") !== (b.last || "") ? ((a.last || "") > (b.last || "") ? a : b) : (a.count >= b.count ? a : b);
        localStorage.setItem(PlayerState.KEY_PUZZLE_STREAK, JSON.stringify(pick));

        if (cloud.avatar && Rewards.LIST.some((a) => a.id === cloud.avatar) && (identity || PlayerState.getAvatar() === "bug")) PlayerState.setAvatar(cloud.avatar);
        if (cloud.nickname && (identity || !PlayerState.getNickname())) PlayerState.setNickname(cloud.nickname);

        // dont keep a picture we havent unlocked
        if (typeof Rewards !== "undefined" && !Rewards.isUnlocked(PlayerState.getAvatar())) PlayerState.setAvatar("bug");
    }

    async function push(force) {
        const user = FirebaseClient.getUser();
        if (!user || user.isAnonymous || !FirebaseClient.getUid()) return;
        const data = snapshot();
        const json = JSON.stringify(data);
        if (!force && json === lastPushed) return;
        try { await FirebaseClient.writeSave(data); lastPushed = json; }
        catch (err) { console.warn("cloud save failed:", err); }
    }

    function pushSoon() { clearTimeout(timer); timer = setTimeout(() => push(false), 3000); }

    // pull, merge, then push the merged result back
    async function sync(identity) {
        const cloud = await FirebaseClient.loadSave();
        merge(cloud, identity);
        if (typeof Rewards !== "undefined") { Rewards.check(); Rewards.refresh(); }
        $("nickname-display").textContent = PlayerState.getNickname() || "GUEST";
        await push(true);
    }

    function paint() {
        const user = FirebaseClient.getUser();
        const btn = $("save-link-btn");
        if (!user) {
            setStatus("Offline: progress is saved on this device only.", "bad");
            btn.classList.add("hidden");
        } else if (user.isAnonymous) {
            setStatus("Progress is saved on this device only. Link a Google account to back it up and pick it up on other devices.");
            btn.classList.remove("hidden");
            btn.disabled = false;
        } else {
            setStatus(`Cloud save is on${user.email ? " (" + user.email + ")" : ""}. Progress syncs automatically.`, "ok");
            btn.classList.add("hidden");
        }
    }

    // null = user just closed the popup, say nothing
    const ERRORS = {
        "auth/popup-closed-by-user": null,
        "auth/cancelled-popup-request": null,
        "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups for this site and try again.",
        "auth/unauthorized-domain": "Google sign-in isn't enabled for this domain yet (Firebase > Authentication > Settings > Authorized domains).",
        "auth/operation-not-allowed": "Google sign-in isn't turned on in the Firebase console yet.",
    };

    $("save-link-btn").addEventListener("click", async () => {
        if (busy) return;
        busy = true;
        $("save-link-btn").disabled = true;
        setStatus("Waiting for Google...");
        try {
            const res = await FirebaseClient.linkGoogle();
            if (res.mode === "switched") {
                // this google account already had a save: load it and restart so everything uses the right uid
                setStatus("Found your save. Loading it...");
                await sync(true);
                Rewards.toast("Save restored. Reloading...");
                setTimeout(() => location.reload(), 900);
                return;
            }
            await push(true);
            paint();
            Rewards.toast("Google account linked");
        } catch (err) {
            const known = err && err.code in ERRORS;
            if (known && ERRORS[err.code] === null) paint();
            else setStatus(known ? ERRORS[err.code] : "Couldn't link the account. Try again in a bit.", "bad");
            if (!known) console.error(err);
            $("save-link-btn").disabled = false;
        } finally { busy = false; }
    });

    document.addEventListener("debugr:progress", pushSoon);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") push(false); });
    setInterval(() => push(false), 60000);

    // wait for firebase, then show the state (and sync if already linked)
    (function waitForFirebase() {
        let tries = 0;
        const t = setInterval(async () => {
            tries++;
            if (!FirebaseClient.getUid()) {
                if (tries > 40) { clearInterval(t); paint(); }
                return;
            }
            clearInterval(t);
            paint();
            const user = FirebaseClient.getUser();
            if (user && !user.isAnonymous) {
                try { await sync(false); } catch (err) { console.warn("cloud sync failed:", err); }
            }
        }, 500);
    })();

    return { push, sync };
})();