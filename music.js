// Background music, made live with WebAudio (no audio files to download or license).
// A quiet chiptune loop: bass + arpeggio + a little percussion. It is calm on menus and puzzles, faster in a solo
// game or race. Starts after your first click (browsers block sound before that), pauses when the tab is hidden.
const Music = (() => {
  "use strict";
  const KEY = "debugr_music", VKEY = "debugr_music_vol";
  const MAX = 0.22;
  let on = true, vol = 0.45;
  try {
    on = localStorage.getItem(KEY) !== "off";
    const v = parseFloat(localStorage.getItem(VKEY));
    if (Number.isFinite(v)) vol = Math.min(1, Math.max(0, v));
  } catch { }

  const MOODS = {
    chill: { bpm: 88, arp: 0.5, drums: false },
    tense: { bpm: 124, arp: 0.75, drums: true },
  };
  // A minor: Am - F - C - G, one chord per bar of 16 steps
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  let ctx = null, master = null, timer = null, mood = "chill", step = 0, next = 0, started = false;

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = vol * MAX;
    master.connect(ctx.destination);
    return true;
  }
  function tone(t, f, dur, type, g) {
    const o = ctx.createOscillator(), a = ctx.createGain();
    o.type = type; o.frequency.value = f;
    a.gain.setValueAtTime(0.0001, t);
    a.gain.exponentialRampToValueAtTime(g, t + 0.01);
    a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(a).connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function hat(t, g) {
    const len = Math.floor(ctx.sampleRate * 0.04), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), a = ctx.createGain();
    s.buffer = buf; f.type = "highpass"; f.frequency.value = 6500;
    a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(f).connect(a).connect(master); s.start(t);
  }
  function kick(t, g) {
    const o = ctx.createOscillator(), a = ctx.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(a).connect(master); o.start(t); o.stop(t + 0.16);
  }

  function playStep(t, i) {
    const m = MOODS[mood], bar = Math.floor(i / 16) % CHORDS.length, s = i % 16, ch = CHORDS[bar], spb = 60 / m.bpm / 4;
    if (s % 8 === 0) tone(t, hz(ch[0] - 24), spb * 7, "triangle", 0.5);          // bass on the 1 and the 3
    if (s % 8 === 4 && m.drums) tone(t, hz(ch[0] - 12), spb * 2, "triangle", 0.3); // offbeat bass push
    // arpeggio: a fixed pattern over the chord, with some steps left out
    const pat = [0, 1, 2, 1, 2, 1, 0, 1, 2, 0, 1, 2, 1, 0, 2, 1];
    const hit = m.drums || s % 2 === 0;
    if (hit && (s * 7 + bar * 3) % 8 / 8 < m.arp + 0.25) {
      const oct = s % 8 === 6 ? 12 : 0;
      tone(t, hz(ch[pat[s]] + 12 + oct), spb * 1.8, "square", 0.11);
    }
    if (m.drums) {
      if (s % 4 === 0) kick(t, 0.5);
      if (s % 2 === 1) hat(t, 0.12);
    } else if (s % 4 === 2) hat(t, 0.05);
  }
  function tick() {
    if (!ctx || ctx.state !== "running") return;
    const spb = 60 / MOODS[mood].bpm / 4;
    while (next < ctx.currentTime + 0.4) { playStep(Math.max(next, ctx.currentTime), step); next += spb; step++; }
  }

  function start() {
    if (!on || timer || !ensure()) return;
    ctx.resume().catch(() => { });
    next = ctx.currentTime + 0.1;
    timer = setInterval(tick, 100);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } if (ctx) ctx.suspend().catch(() => { }); }
  function setMood(m) { if (MOODS[m]) mood = m; }

  // ---------- controls ----------
  const $ = (id) => document.getElementById(id);
  function paint() {
    const b = $("settings-music-btn"), r = $("settings-music-vol");
    if (b) { b.textContent = on ? "ON" : "OFF"; b.classList.toggle("muted", !on); b.setAttribute("aria-pressed", String(on)); }
    if (r) { r.value = Math.round(vol * 100); r.disabled = !on; }
  }
  function toggle() {
    on = !on;
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { }
    if (on) { started = true; start(); } else stop();
    paint();
  }
  function setVolume(v) {
    vol = Math.min(1, Math.max(0, v));
    if (master) master.gain.value = vol * MAX;
    try { localStorage.setItem(VKEY, String(vol)); } catch { }
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("#settings-music-btn")) toggle();
  });
  document.addEventListener("input", (e) => { if (e.target && e.target.id === "settings-music-vol") setVolume(e.target.value / 100); });
  document.addEventListener("debugr:screen", (e) => setMood(e.detail && e.detail.name === "game" ? "tense" : "chill"));
  document.addEventListener("visibilitychange", () => { if (document.hidden) { if (timer) stop(); } else if (on && started) start(); });
  // browsers only allow sound after a gesture: begin on the first click or key press
  const first = () => { if (started) return; started = true; start(); document.removeEventListener("pointerdown", first, true); document.removeEventListener("keydown", first, true); };
  document.addEventListener("pointerdown", first, true);
  document.addEventListener("keydown", first, true);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paint); else paint();

  return { toggle, setVolume, setMood, isOn: () => on, getVolume: () => vol };
})();
