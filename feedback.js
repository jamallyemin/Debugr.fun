(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const LAST_KEY = "debugr_feedback_last";
    const COOLDOWN_MS = 30000;
    let kind = "idea", sending = false;

    function status(text, cls) {
        const el = $("fb-status");
        el.textContent = text;
        el.className = "fb-status" + (cls ? " " + cls : "");
    }

    $("fb-kinds").addEventListener("click", (e) => {
        const b = e.target.closest("[data-kind]");
        if (!b) return;
        kind = b.dataset.kind;
        document.querySelectorAll("#fb-kinds .btn").forEach((x) => x.classList.toggle("active", x === b));
    });

    $("fb-message").addEventListener("input", () => { $("fb-count").textContent = `${$("fb-message").value.length} / 1000`; });

    async function emailCopy(message, contact) {
        if (typeof FEEDBACK_ACCESS_KEY === "undefined" || !FEEDBACK_ACCESS_KEY) return false;
        try {
            const res = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({
                    access_key: FEEDBACK_ACCESS_KEY,
                    subject: `Debugr.fun feedback (${kind})`,
                    from_name: PlayerState.getNickname() || "guest",
                    message, contact: contact || "(none)", version: Settings.version,
                }),
            });
            return res.ok;
        } catch { return false; }
    }

    async function send() {
        if (sending) return;
        if ($("fb-website").value) return status("Thanks! Sent.", "ok"); // honeypot, bots fill this in

        const message = $("fb-message").value.trim();
        const contact = $("fb-contact").value.trim();
        if (message.length < 5) return status("Write at least a few words first.", "bad");

        let last = 0;
        try { last = parseInt(localStorage.getItem(LAST_KEY), 10) || 0; } catch { }
        const wait = COOLDOWN_MS - (Date.now() - last);
        if (wait > 0) return status(`Please wait ${Math.ceil(wait / 1000)}s before sending another one.`, "bad");

        sending = true;
        $("fb-send-btn").disabled = true;
        status("Sending...");

        const data = { kind, message, version: Settings.version, screen: App.current().slice(0, 20) };
        if (contact) data.contact = contact;
        const nick = PlayerState.getNickname();
        if (nick) data.nickname = nick;

        let saved = false;
        try { await FirebaseClient.submitFeedback(data); saved = true; }
        catch (err) { console.warn("feedback not saved to firestore:", err); }
        const mailed = await emailCopy(message, contact);

        sending = false;
        $("fb-send-btn").disabled = false;
        if (saved || mailed) {
            try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { }
            $("fb-message").value = "";
            $("fb-count").textContent = "0 / 1000";
            status("Thanks! Your feedback was sent.", "ok");
        } else {
            status("Couldn't send it. Check your connection and try again.", "bad");
        }
    }

    $("fb-send-btn").addEventListener("click", send);
})();