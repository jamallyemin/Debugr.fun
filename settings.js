const Settings = (() => {
    const VERSION = "1.1.0";
    const FX_KEY = "debugr_effects";

    const $ = (id) => document.getElementById(id);
    const popup = $("settings-prompt");

    // tabs

    function showTab(name) {
        document.querySelectorAll("#set-tabs .set-tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
        document.querySelectorAll(".set-pane").forEach((p) => p.classList.toggle("hidden", p.dataset.pane !== name));
        if (name === "theme") Theme.render();
        if (name === "feedback") $("fb-message").focus();
    }
    $("set-tabs").addEventListener("click", (e) => {
        const tab = e.target.closest(".set-tab");
        if (tab) showTab(tab.dataset.tab);
    });

    // sound
  function paintSound() {
    const off = typeof Sound === "undefined" || Sound.isMuted();
    const btn = $("settings-sound-btn");
    btn.textContent = off ? "OFF" : "ON";
    btn.setAttribute("aria-pressed", String(!off));
    btn.classList.toggle("muted", off);
    if (typeof Sound !== "undefined") $("settings-volume").value = Math.round(Sound.getVolume() * 100);
    $("settings-volume").disabled = off;
  }
  $("settings-sound-btn").addEventListener("click", () => { if (typeof Sound !== "undefined") Sound.toggle(); });
  $("settings-volume").addEventListener("input", (e) => { if (typeof Sound !== "undefined") Sound.setVolume(e.target.value / 100); });
  $("settings-volume").addEventListener("change", () => { if (typeof Sound !== "undefined") Sound.play("rule"); }); // preview
  document.addEventListener("debugr:sound", paintSound);

  // crt scanlines + grain
    function effectsOn() {
    let saved = null;
    try { saved = localStorage.getItem(FX_KEY); } catch {}
    if (saved === "on") return true;
    if (saved === "off") return false;
    return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function applyEffects(on) {
    document.documentElement.dataset.effects = on ? "on" : "off";
    const btn = $("settings-fx-btn");
    btn.textContent = on ? "ON" : "OFF";
    btn.setAttribute("aria-pressed", String(on));
    btn.classList.toggle("muted", !on);
  }
  $("settings-fx-btn").addEventListener("click", () => {
    const on = !effectsOn();
    try { localStorage.setItem(FX_KEY, on ? "on" : "off"); } catch {}
    applyEffects(on);
  });
  applyEffects(effectsOn());

  // keyboard sheet
  $("settings-keys-btn").addEventListener("click", () => {
    close();
    document.dispatchEvent(new CustomEvent("debugr:open-keys"));
  });

  // open/close
  function open(tab = "general") {
    popup.classList.remove("hidden");
    paintSound();
    showTab(tab);
    document.dispatchEvent(new CustomEvent("debugr:settings-open")); 
  }
  function close() {popup.classList.add("hidden");}

  $("settings-btn").addEventListener("click", () => open());
  $("settings-close-btn").addEventListener("click", close);
  popup.addEventListener("click", (e) => { if(e.target === popup) close(); }); //click outside the box

    $("settings-about").textContent = `Debugr.fun v${VERSION}. A debugging game with endless puzzles, daily challenges and live races. Thanks for playing!`;
 
  return { open, close, version: VERSION };
})();
