// Player preferences: gameplay, editor, accessibility, and save export/import.
// Loaded before script.js so the game can read Prefs.get(...) at any time.
const Prefs = (() => {
  "use strict";
  const KEY = "debugr_prefs";
  const BUG_MULT = { relaxed: 1.35, normal: 1, fast: 0.8 }; // multiplies how long the bug takes to get hungry (solo only)
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DEFAULTS = { bugSpeed: "normal", forgiving: false, hints: true, autoClose: true, lineNums: true, reduceMotion: reduced, patterns: false };
  let state = Object.assign({}, DEFAULTS);

  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && typeof raw === "object") {
      for (const k of Object.keys(DEFAULTS)) {
        if (k === "bugSpeed") { if (raw[k] in BUG_MULT) state[k] = raw[k]; }
        else if (typeof raw[k] === "boolean") state[k] = raw[k];
      }
    }
  } catch { /* broken saved data: defaults */ }

  const get = (k) => state[k];
  const bugMult = () => BUG_MULT[state.bugSpeed] || 1;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked */ } }
  function set(k, v) { if (k in DEFAULTS) { state[k] = v; save(); apply(); paint(); } }

  function apply() {
    const d = document.documentElement.dataset;
    d.hints = state.hints ? "on" : "off";
    d.linenums = state.lineNums ? "on" : "off";
    d.motion = state.reduceMotion ? "reduced" : "full";
    d.patterns = state.patterns ? "on" : "off";
  }

  // ---------- settings UI ----------
  const $ = (id) => document.getElementById(id);
  function paint() {
    document.querySelectorAll("[data-pref]").forEach((b) => {
      const on = !!state[b.dataset.pref];
      b.textContent = on ? "ON" : "OFF";
      b.setAttribute("aria-pressed", String(on));
      b.classList.toggle("muted", !on);
    });
    document.querySelectorAll("#prefs-bugspeed button").forEach((b) => {
      const on = b.dataset.val === state.bugSpeed;
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on));
    });
  }
  function bind() {
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-pref]");
      if (t) return set(t.dataset.pref, !state[t.dataset.pref]);
      const s = e.target.closest("#prefs-bugspeed button");
      if (s) set("bugSpeed", s.dataset.val);
    });
    const exp = $("prefs-export-btn"), imp = $("prefs-import-input");
    if (exp) exp.addEventListener("click", exportSave);
    if (imp) imp.addEventListener("change", () => { if (imp.files[0]) importSave(imp.files[0]); imp.value = ""; });
    const tut = $("prefs-tutorial-btn");
    if (tut) tut.addEventListener("click", () => { if (window.Settings) Settings.close(); if (window.Tutorial) Tutorial.start(); });
    paint();
  }

  // ---------- save file: only our own debugr_* keys, small, plain strings ----------
  function exportSave() {
    const out = { app: "debugr", v: 1, data: {} };
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("debugr_")) out.data[k] = localStorage.getItem(k);
    }
    const blob = new Blob([JSON.stringify(out, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "debugr-save.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importSave(file) {
    const toast = (m) => { if (window.Rewards) Rewards.toast(m, 3400); };
    if (file.size > 500000) return toast("That file is too big to be a Debugr save.");
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(String(rd.result));
        if (!o || o.app !== "debugr" || !o.data || typeof o.data !== "object") throw new Error("not a save");
        const entries = Object.entries(o.data).filter(([k, v]) => /^debugr_[a-z0-9_]{1,60}$/i.test(k) && typeof v === "string" && v.length < 100000);
        if (!entries.length || entries.length > 200) throw new Error("empty");
        for (const [k, v] of entries) localStorage.setItem(k, v);
        toast("Save loaded. Reloading...");
        setTimeout(() => location.reload(), 700);
      } catch { toast("That doesn't look like a Debugr save file."); }
    };
    rd.readAsText(file);
  }

  apply();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
  return { get, set, bugMult, exportSave, DEFAULTS };
})();
