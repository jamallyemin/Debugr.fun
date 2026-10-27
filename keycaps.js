// little key badges on the buttons (Esc, Enter, 1/2/3...) + the on/off switch in settings
(function () {
    "use strict";

    const KEY = "debugr_keyhints";
    const MAC = /Mac|iPhone|iPad/.test(navigator.platform || "");
    const CTRL = MAC ? "⌘" : "Ctrl+";

    // selector -> what to show. corner = sits in the top right of a card
    const CAPS = [
        ["#settings-btn", "S"],
        ["#save-btn", CTRL + "S"],
        ["#puzzles-hint-btn", "H"],
        ["#puzzles-back-btn", "Esc"],
        ["#puzzle-next-btn", "Enter"],
        ["#next-task-btn", "Enter"],
        ["#daily-start-btn", "Enter"],
        ['[data-action="back-to-menu"]', "Esc"],                       // Esc works on the result screen too
        ["#settings-close-btn", "Esc"],
        ["#profile-close-btn", "Esc"],
        ["#keys-close-btn", "Esc"],
        ["#confirm-no", "Esc"],
        ['.diff-card[data-diff="easy"]', "1", true],
        ['.diff-card[data-diff="medium"]', "2", true],
        ['.diff-card[data-diff="hard"]', "3", true],
    ];

    function inject() {
        for (const [sel, label, corner] of CAPS) {
            document.querySelectorAll(sel).forEach((el) => {
                if (el.querySelector(":scope > .kc")) return;
                const k = document.createElement("kbd");
                k.className = "kc" + (corner ? " corner" : "");
                k.textContent = label;
                k.setAttribute("aria-hidden", "true");
                el.appendChild(k);
            });
        }
        // the [1] [2] .. hints in the menu: same look as the other caps
        document.querySelectorAll(".menu-options .key-hint").forEach((el) => {
            const t = el.textContent.replace(/[\[\]\s]/g, "");
            if (!el.classList.contains("kc") || el.textContent !== t) { el.textContent = t; el.classList.add("kc"); }
        });
    }

    // other scripts replace button text (textContent = ...) which wipes the badge, so put it back
    let queued = false;
    new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; inject(); });
    }).observe(document.body, { childList: true, subtree: true });

    // on/off
    const btn = document.getElementById("settings-keyhints-btn");
    function hintsOn() {
        try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
    }
    function apply(on) {
        document.documentElement.dataset.keys = on ? "on" : "off";
        if (!btn) return;
        btn.textContent = on ? "ON" : "OFF";
        btn.setAttribute("aria-pressed", String(on));
        btn.classList.toggle("muted", !on);
    }
    if (btn) btn.addEventListener("click", () => {
        const on = !hintsOn();
        try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {}
        apply(on);
    });

    inject();
    apply(hintsOn());
})();