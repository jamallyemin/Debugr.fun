const Sound = (() => {
    const KEY = "debugr_sound";
    const MAX_GAIN = 0.4;
    const VOL_KEY= "debugr_volume";

    let ctx = null, master = null;
    let muted = false, level = 0.5;
    try { 
        muted = localStorage.getItem(KEY) === "off";
        const saved = parseFloat(localStorage.getItem(VOL_KEY));
        if (Number.isFinite(saved)) level = Math.min(1, Math.max(0, saved));
    } catch {}

    function engine() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ctx = new AC();
            master = ctx.createGain();
            master.gain.value = level * MAX_GAIN;
            master.connect(ctx.destination);
        }
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        return ctx;
    }

  function tone(t0, freq, at, dur, { type = "square", vol = 0.5, to = 0 } = {}) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0 + at);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + at + dur);
    g.gain.setValueAtTime(0.0001, t0 + at);
    g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    osc.connect(g).connect(master);
    osc.start(t0 + at);
    osc.stop(t0 + at + dur + 0.02);
  }
 
  // short burst of filtered noise (used 4 shredding)
  function noise(t0, at, dur, vol, freq) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = buf;
    filter.type = "bandpass";
    filter.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0 + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t0 + at);
  }
 
  const arp = (t, notes, step, opts) => notes.forEach((f, i) => tone(t, f, i * step, step * 1.6, opts));
 
  const SOUNDS = {
    click: (t) => tone(t, 520, 0, 0.05, { vol: 0.25 }),
    back: (t) => { tone(t, 400, 0, 0.05, { vol: 0.25 }); tone(t, 280, 0.05, 0.07, { vol: 0.25 }); },
    key: (t) => tone(t, 900 + Math.random() * 250, 0, 0.018, { vol: 0.07 }),
    rule: (t) => { tone(t, 660, 0, 0.07, { vol: 0.3 }); tone(t, 990, 0.07, 0.11, { vol: 0.3 }); },
    clear: (t) => arp(t, [523, 659, 784], 0.08, { vol: 0.35 }),
    win: (t) => arp(t, [523, 659, 784, 1047], 0.09, { vol: 0.4 }),
    lose: (t) => arp(t, [330, 262, 196], 0.14, { type: "sawtooth", vol: 0.3 }),
    tick: (t) => tone(t, 1300, 0, 0.03, { vol: 0.16 }),
    shred: (t) => noise(t, 0, 0.14, 0.5, 900),
    unlock: (t) => { arp(t, [392, 523, 659, 784], 0.1, { vol: 0.35 }); tone(t, 1047, 0.45, 0.4, { type: "triangle", vol: 0.4 }); },
    error: (t) => tone(t, 180, 0, 0.14, { type: "sawtooth", vol: 0.3, to: 120 }),
  };

  let lastKey = 0;
  function play(name) {
    if (muted || !SOUNDS[name]) return;
    if (name === "key") {
        const now = performance.now();
        if (now - lastKey < 45) return;
        lastKey = now;
    }
    if (!engine()) return;
    try { SOUNDS[name](ctx.currentTime); } catch{}
    }
  
    const btn = document.getElementById("sound-btn");
    function paint() {
        if (!btn) return;
        btn.textContent = muted ? "SND OFF" : "SND ON";
        btn.classList.toggle("muted", muted);
        btn.setAttribute("aria-pressed", String(!muted));
    }
    function toggle() {
        muted = !muted;
        try { localStorage.setItem(KEY, muted ? "off" : "on"); } catch{}
        paint();
        document.dispatchEvent(new CustomEvent("debugr:sound"));
        play("click");
    }
    if (btn) btn.addEventListener("click", toggle);
    paint();

  function setVolume(v) {
    level = Math.min(1, Math.max(0, v));
    if (master) master.gain.value = level * MAX_GAIN;
    try { localStorage.setItem(VOL_KEY, String(level)); } catch {}
    document.dispatchEvent(new CustomEvent("debugr:sound"));
  }
 
  document.addEventListener("click", (e) => {
    if (!e.target.closest) return;
    if (e.target.closest("#sound-btn, #settings-sound-btn")) return; 
    if (e.target.closest('[data-action="back-to-menu"], #puzzles-back-btn, #puzzle-path-btn, #key-chip, #logo-home-btn')) return play("back");
    if (e.target.closest(".btn, .diff-card, .lb-tab, .puzzle-node:not(:disabled), .puzzle-tab, .av-card:not(:disabled), .menu-footer-links span")) play("click");
  }, true);
 
  return { play, toggle, setVolume, getVolume: () => level, isMuted: () => muted };
})();
