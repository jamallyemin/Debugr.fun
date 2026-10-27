const Rewards = (() => {
    // ids have to match the avatar list in firestore.rules
    const LIST = [
        { id: "bug", img: "avatars/bug.png", name: "BUG", glyph: "x", req: null, reqText: "Unlocked from the start" },
        { id: "cat", img: "avatars/cat.png", name: "CAT", glyph: "=^.^=", req: { stat: "wins", n: 3 }, reqText: "Clear 3 tasks" },
        { id: "fox", img: "avatars/fox.png", name: "FOX", glyph: "^v^", req: { stat: "dailies", n: 1 }, reqText: "Clear a daily challenge" },
        { id: "owl", img: "avatars/owl.png", name: "OWL", glyph: "{o,o}", req: { stat: "puzzles", n: 10 }, reqText: "Clear 10 puzzle levels" },
        { id: "snake", img: "avatars/snake.png", name: "SNAKE", glyph: "~S~", req: { stat: "puzzles", n: 40 }, reqText: "Clear 40 puzzle levels" },
    ];

    const $ = (id) => document.getElementById(id);
    const byId = (id) => LIST.find((a) => a.id === id) || LIST[0];

    function progress(a) {
        if (!a.req) return { have: 1, need: 1, met: true };
        const have = PlayerState.getStats()[a.req.stat] || 0;
        return { have, need: a.req.n, met: have >= a.req.n };
    }
    const isUnlocked = (id) => progress(byId(id)).met;

    // real picture if the avatar has an img, otherwise the text glyph
    function pic(a) {
        if (a.img) return `<img src="${a.img}" alt="${esc(a.name)}" draggable="false">`;
        return `<span class="avatar-glyph">${esc(a.glyph)}</span>`;
    }

    // little avatar badge for lists
    function pfp(id) {
        const a = byId(id);
        return `<span class="pfp" title="${a.name}">${pic(a)}</span>`;
    }

    let toastTimer = null;
    function toast(msg, ms = 2800) {
        const el = $("toast");
        if (!el) return;
        el.textContent = msg;
        el.classList.remove("hidden");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.add("hidden"), ms);
    }

    // first run just remembers whats already open, after that it announces new ones
    function check() {
        const open = LIST.filter((a) => progress(a).met).map((a) => a.id);
        const seen = PlayerState.getSeenRewards();
        if (seen === null) { PlayerState.setSeenRewards(open); return []; }
        const fresh = open.filter((id) => !seen.includes(id));
        if (fresh.length) {
            PlayerState.setSeenRewards(open);
            for (const id of fresh) toast(`UNLOCKED: ${byId(id).name} profile picture`, 3600);
            if (typeof Sound !== "undefined") Sound.play("unlock");
            if (!$("profile-prompt").classList.contains("hidden")) renderGrid();
        }
        return fresh;
    }

    // profile picker
    function renderGrid() {
        const equipped = PlayerState.getAvatar();
        $("avatar-grid").innerHTML = LIST.map((a) => {
            const p = progress(a);
            const locked = !p.met;
            const on = a.id === equipped;
            const req = locked ? `${a.reqText} (${p.have}/${p.need})` : a.reqText;
            return `<button class="av-card ${on ? "equipped" : ""} ${locked ? "locked" : ""}" data-id="${a.id}" ${locked ? "disabled" : ""}>
                <span class="av-pic">${pic(a)}</span>
                <span class="av-name">${a.name}</span>
                <span class="av-req ${locked ? "" : "met"}">${esc(req)}</span>
                ${on ? `<span class="av-tag">EQUIPPED</span>` : ""}
            </button>`;
        }).join("");
    }

    function equip(id) {
        if (!isUnlocked(id)) return;
        PlayerState.setAvatar(id);
        renderGrid();
        refresh();
        document.dispatchEvent(new CustomEvent("debugr:progress"));
        if (typeof FirebaseClient !== "undefined") FirebaseClient.setAvatar(id).catch(() => { });
    }

    $("avatar-grid").addEventListener("click", (e) => {
        const card = e.target.closest(".av-card:not(:disabled)");
        if (card) equip(card.dataset.id);
    });
    $("avatar-btn").addEventListener("click", () => { renderGrid(); $("profile-prompt").classList.remove("hidden"); });
    $("profile-close-btn").addEventListener("click", () => $("profile-prompt").classList.add("hidden"));
    $("profile-prompt").addEventListener("click", (e) => { if (e.target === $("profile-prompt")) $("profile-prompt").classList.add("hidden"); });

    // header avatar + menu status card
    let topAt = 0;
    async function paintTopSolver() {
        const el = $("ms-top");
        if (Date.now() - topAt < 20000) return;
        if (typeof FirebaseClient === "undefined" || !FirebaseClient.getUid()) return;
        topAt = Date.now();
        try {
            const rows = await FirebaseClient.fetchPuzzleTop("daily");
            el.textContent = rows.length ? `${rows[0].nickname} (${rows[0].solved})` : "-";
        } catch { el.textContent = "-"; }
    }

    function refresh() {
        const av = PlayerState.getAvatar();
        $("avatar-btn").innerHTML = pic(byId(av));
        $("ms-pfp").innerHTML = pfp(av);
        $("ms-user").textContent = PlayerState.getNickname() || "GUEST";
        $("ms-daily").textContent = PlayerState.getStreakCache().daily;
        $("ms-puzzles").textContent = Object.values(PuzzleState.load()).reduce((a, b) => a + (Number(b) || 0), 0);
        paintTopSolver();
    }

    document.addEventListener("debugr:screen", (e) => { if (e.detail.name === "menu") refresh(); });
    document.addEventListener("debugr:progress", refresh);
    if (!LIST.some((a) => a.id === PlayerState.getAvatar())) PlayerState.setAvatar("bug");

    refresh();
    check();

    return { LIST, pfp, toast, check, refresh, isUnlocked };
})();