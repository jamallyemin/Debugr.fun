// Themes. A theme only ever changes COLORS (plus the two optional text settings below), never layout,
// so a custom theme can't break the page. The text settings (font, size) are separate from colors.
const Theme = (() => {
  const STORAGE_KEY = "debugr_theme_v2";
  const OLD_KEY = "debugr_theme_overrides";
  const VARS = ["--bg", "--bg2", "--bg3", "--border", "--text", "--text-dim", "--text-muted",
    "--green", "--red", "--amber", "--on-accent", "--border2", "--orange", "--seg-off", "--scanline", "--grain"];
  const SIZE_MIN = 90, SIZE_MAX = 125;

  const $ = (id) => document.getElementById(id);
  const HEX = /^#[0-9a-f]{6}$/i;

  // ---------- colour maths ----------
  function toHex(color) {
    if (!color) return "#000000";
    color = color.trim();
    if (color.startsWith("#")) return color.length === 4 ? "#" + [...color.slice(1)].map((c) => c + c).join("") : color.slice(0, 7);
    const m = color.match(/\d+/g);
    return m ? "#" + m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, "0")).join("") : "#000000";
  }
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(toHex(h).slice(i, i + 2), 16));
  const hex = (a) => "#" + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A.map((v, i) => v + (B[i] - v) * t)); };
  function luminance(h) {
    const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  // nudge `fg` toward white or black (whichever is further from bg) until it reads on bg
  function ensureContrast(fg, bg, min) {
    if (contrast(fg, bg) >= min) return { color: fg, changed: false };
    const target = luminance(bg) > 0.4 ? "#000000" : "#ffffff";
    let c = fg;
    for (let i = 1; i <= 20 && contrast(c, bg) < min; i++) c = mix(fg, target, i / 20);
    return { color: c, changed: true };
  }

  // ---------- presets ----------
  // mode = which built-in stylesheet block to start from (dark or light), vars = the colors that differ
  const mk = (bg, bg2, text, dim, accent, pass, fail, border, mode, extra) => ({
    mode: mode || "dark",
    vars: Object.assign({
      "--bg": bg, "--bg2": bg2, "--bg3": mix(bg2, text, 0.04), "--border": border, "--border2": mix(border, text, 0.16),
      "--text": text, "--text-dim": dim, "--text-muted": mix(dim, bg, 0.2),
      "--amber": accent, "--green": pass, "--red": fail, "--orange": mix(accent, fail, 0.45),
      "--seg-off": mix(bg, text, 0.16), "--on-accent": luminance(pass) > 0.4 ? "#0d0d0d" : "#ffffff",
    }, extra || {}),
  });
  const PRESETS = [
    { id: "dark", name: "TERMINAL", mode: "dark", vars: null, sw: ["#0b0b0b", "#e6ebe6", "#cd9d3c", "#4daa6e", "#ec6a5e"] },
    { id: "light", name: "LIGHT", mode: "light", vars: null, sw: ["#f4f1ea", "#22201a", "#8a5f00", "#1f7a45", "#b3352b"] },
    Object.assign({ id: "amber", name: "AMBER CRT" }, mk("#120c04", "#1a1208", "#f2d9a6", "#b39560", "#ffb000", "#c8d65a", "#ff6b4a", "#3a2a10")),
    Object.assign({ id: "paper", name: "PAPER" }, mk("#f6f1e7", "#fffdf7", "#1f1d1a", "#5f5a50", "#a8460f", "#2f7d4f", "#b8392b", "#d9d0bd", "light", { "--scanline": "rgba(0,0,0,0.02)", "--grain": "0.02" })),
    Object.assign({ id: "midnight", name: "MIDNIGHT" }, mk("#0a1020", "#0f1830", "#e4ebff", "#8d9bc4", "#f2b84b", "#4fc4a0", "#ff7a85", "#1f2b4d")),
    Object.assign({ id: "solar", name: "SOLARIZED" }, mk("#002b36", "#073642", "#eee8d5", "#93a1a1", "#d9a300", "#9aae00", "#ef5350", "#0f4a58")),
    Object.assign({ id: "dracula", name: "DRACULA" }, mk("#1e1f29", "#282a36", "#f8f8f2", "#9aa0c0", "#ffb86c", "#50fa7b", "#ff5555", "#3a3d52")),
    Object.assign({ id: "contrast", name: "HIGH CONTRAST" }, mk("#000000", "#0a0a0a", "#ffffff", "#d0d0d0", "#ffd400", "#00e676", "#ff5252", "#8a8a8a", "dark", { "--scanline": "rgba(0,0,0,0)", "--grain": "0" })),
    Object.assign({ id: "synth", name: "SYNTHWAVE", unlock: { stat: "dailies", n: 3, text: "Clear 3 daily challenges" } }, mk("#140a26", "#1d1040", "#f3e9ff", "#ad99dc", "#ff4fd8", "#3ff2c8", "#ff5c7a", "#3a2470")),
    Object.assign({ id: "gameboy", name: "GAMEBOY", unlock: { stat: "wins", n: 10, text: "Clear 10 tasks" } }, mk("#0f380f", "#1c4a1c", "#e0f8d0", "#a9c97a", "#9bbc0f", "#8bd450", "#e8b56a", "#306230")),
    Object.assign({ id: "matrix", name: "MATRIX", unlock: { stat: "puzzles", n: 30, text: "Clear 30 puzzle levels" } }, mk("#000a00", "#001400", "#b6ffb6", "#6fbf6f", "#e6ff00", "#2bff88", "#ff5c5c", "#0b3a0b")),
  ];
  const byId = (id) => PRESETS.find((p) => p.id === id);
  const swOf = (p) => p.sw || [p.vars["--bg"], p.vars["--text"], p.vars["--amber"], p.vars["--green"], p.vars["--red"]];
  function progress(p) {
    if (!p.unlock) return { met: true, have: 1, need: 1 };
    let have = 0;
    try { have = PlayerState.getStats()[p.unlock.stat] || 0; } catch { /* stats unavailable */ }
    return { met: have >= p.unlock.n, have, need: p.unlock.n };
  }

  // the five colors a player edits; everything else is calculated
  const SWATCHES = [
    { key: "--bg", label: "Background", min: 0 },
    { key: "--text", label: "Text", min: 4.5 },
    { key: "--amber", label: "Accent", min: 4 },
    { key: "--green", label: "Pass (true)", min: 3.5 },
    { key: "--red", label: "Fail (false)", min: 3.5 },
  ];

  let state = { base: "dark", custom: {}, font: "pixel", size: 100 };
  let notice = "";

  // ---------- storage ----------
  function sanitize(raw) {
    const s = { base: "dark", custom: {}, font: "pixel", size: 100 };
    if (!raw || typeof raw !== "object") return s;
    if (byId(raw.base)) s.base = raw.base;
    if (raw.custom && typeof raw.custom === "object") {
      for (const k of SWATCHES.map((x) => x.key)) if (HEX.test(raw.custom[k] || "")) s.custom[k] = raw.custom[k].toLowerCase();
    }
    if (raw.font === "mono") s.font = "mono";
    const n = Number(raw.size);
    if (Number.isFinite(n)) s.size = Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round(n / 5) * 5));
    return s;
  }
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (raw) { state = sanitize(raw); return; }
      // older versions kept loose color overrides: keep only what we still understand
      const old = JSON.parse(localStorage.getItem(OLD_KEY) || "null");
      if (old && typeof old === "object") state = sanitize({ base: old.base, custom: old.custom || old });
    } catch { /* broken saved data: start clean */ }
  }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage blocked */ } }

  // ---------- turn the five colors into a full, readable palette ----------
  function palette(base, custom) {
    const p = byId(base) || PRESETS[0];
    const root = document.documentElement;
    // start from the preset (or the built-in dark/light block), then lay the player's colors on top
    const start = Object.create(null);
    if (p.vars) Object.assign(start, p.vars);
    else {
      const cs = getComputedStyle(root);
      for (const k of VARS) { const v = cs.getPropertyValue(k).trim(); if (v) start[k] = v; }
    }
    const c = {};
    for (const s of SWATCHES) c[s.key] = custom[s.key] || toHex(start[s.key]);
    const fixes = [];
    if (Object.keys(custom).length) {
      for (const s of SWATCHES) {
        if (!s.min) continue;
        const r = ensureContrast(c[s.key], c["--bg"], s.min);
        if (r.changed) { fixes.push(s.label); c[s.key] = r.color; }
      }
    }
    const out = Object.assign({}, start);
    for (const s of SWATCHES) out[s.key] = c[s.key];
    if (custom["--bg"] || custom["--text"]) {
      out["--bg2"] = mix(c["--bg"], c["--text"], 0.05);
      out["--bg3"] = mix(c["--bg"], c["--text"], 0.09);
      out["--border"] = mix(c["--bg"], c["--text"], 0.2);
      out["--border2"] = mix(c["--bg"], c["--text"], 0.3);
      out["--seg-off"] = mix(c["--bg"], c["--text"], 0.16);
      out["--text-dim"] = ensureContrast(mix(c["--text"], c["--bg"], 0.35), c["--bg"], 4.5).color;
      out["--text-muted"] = ensureContrast(mix(c["--text"], c["--bg"], 0.5), c["--bg"], 3.6).color;
    }
    if (custom["--amber"] || custom["--red"]) out["--orange"] = mix(c["--amber"], c["--red"], 0.45);
    out["--on-accent"] = contrast(c["--green"], "#0d0d0d") >= contrast(c["--green"], "#ffffff") ? "#0d0d0d" : "#ffffff";
    return { vars: out, fixes };
  }

  function apply() {
    const root = document.documentElement;
    const p = byId(state.base) || PRESETS[0];
    root.setAttribute("data-theme", p.mode);
    for (const k of VARS) root.style.removeProperty(k);
    // measure the built-in block first (no inline overrides), then paint the result
    const needsPalette = p.vars || Object.keys(state.custom).length;
    notice = "";
    if (needsPalette) {
      const { vars, fixes } = palette(state.base, state.custom);
      for (const k of VARS) if (vars[k]) root.style.setProperty(k, vars[k]);
      if (fixes.length) notice = `We nudged ${fixes.join(", ").toLowerCase()} so it stays readable on your background.`;
    }
    // text settings are separate from colors, so they can never be broken by a theme
    root.style.setProperty("--font-vt", state.font === "mono" ? "var(--font-mono)" : "'Silkscreen', 'JetBrains Mono', ui-monospace, monospace");
    root.style.setProperty("--code-size", Math.round(15 * state.size / 100 * 10) / 10 + "px");
    root.style.setProperty("--code-lh", Math.round(30 * state.size / 100) + "px");
  }
  function currentVars() {
    const cs = getComputedStyle(document.documentElement);
    const out = {};
    for (const k of VARS) out[k] = cs.getPropertyValue(k).trim();
    return out;
  }

  // ---------- share codes: DBG1:<base64 json> ----------
  function exportCode() {
    const o = { base: state.base, custom: state.custom, font: state.font, size: state.size };
    return "DBG1:" + btoa(JSON.stringify(o));
  }
  function importCode(text) {
    const m = String(text || "").trim().match(/^DBG1:([A-Za-z0-9+/=]{4,2000})$/);
    if (!m) return false;
    try {
      const s = sanitize(JSON.parse(atob(m[1])));
      const p = byId(s.base);
      if (!progress(p).met) return "locked";
      state = s; apply(); save(); render();
      return true;
    } catch { return false; }
  }

  // ---------- settings UI ----------
  const toast = (m) => { if (typeof Rewards !== "undefined") Rewards.toast(m); };

  function renderPresets() {
    const wrap = $("theme-presets");
    if (!wrap) return;
    wrap.innerHTML = PRESETS.map((p) => {
      const pr = progress(p), sw = swOf(p), on = p.id === state.base;
      return `<button type="button" class="theme-card${on ? " on" : ""}${pr.met ? "" : " locked"}" data-preset="${p.id}" ${pr.met ? "" : "disabled"} aria-pressed="${on}">
        <span class="tc-prev" style="background:${sw[0]};border-color:${mix(sw[0], sw[1], 0.2)}">
          <i style="background:${sw[3]}"></i><i style="background:${sw[4]}"></i><b style="background:${sw[1]}"></b><em style="background:${sw[2]}"></em>
        </span>
        <span class="tc-name">${p.name}</span>
        <span class="tc-tag">${on ? "ACTIVE" : pr.met ? "" : `LOCKED · ${pr.have}/${pr.need}`}</span>
      </button>`;
    }).join("");
    wrap.querySelectorAll(".theme-card").forEach((btn) => btn.addEventListener("click", () => {
      state.base = btn.dataset.preset; state.custom = {};
      apply(); save(); render();
    }));
  }

  function renderSwatches() {
    const wrap = $("theme-swatches");
    if (!wrap) return;
    const cur = currentVars();
    wrap.innerHTML = SWATCHES.map((s) => {
      const v = toHex(cur[s.key]);
      const ratio = s.min ? contrast(v, toHex(cur["--bg"])) : 0;
      return `<label class="theme-swatch"><span>${s.label}</span>
        <input type="color" data-var="${s.key}" value="${v}" aria-label="${s.label} color" />
        <span class="tw-ratio${s.min && ratio < s.min ? " low" : ""}">${s.min ? ratio.toFixed(1) + " : 1" : "&nbsp;"}</span></label>`;
    }).join("");
    wrap.querySelectorAll("input[type=color]").forEach((input) => {
      input.addEventListener("input", () => {
        state.custom[input.dataset.var] = input.value.toLowerCase();
        apply(); save();
        paintGuard(); paintRatios();
      });
      input.addEventListener("change", renderSwatches); // re-sync swatches with any nudged values once the picker closes
    });
    paintGuard();
  }
  function paintRatios() {
    const cur = currentVars();
    document.querySelectorAll("#theme-swatches .theme-swatch").forEach((el, i) => {
      const s = SWATCHES[i]; if (!s.min) return;
      const r = contrast(toHex(cur[s.key]), toHex(cur["--bg"]));
      const t = el.querySelector(".tw-ratio");
      t.textContent = r.toFixed(1) + " : 1"; t.classList.toggle("low", r < s.min);
    });
  }
  function paintGuard() {
    const g = $("theme-guard");
    if (!g) return;
    g.textContent = notice;
    g.classList.toggle("hidden", !notice);
  }

  function renderText() {
    const seg = $("theme-font");
    if (seg) seg.querySelectorAll("button").forEach((b) => { const on = b.dataset.val === state.font; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    const r = $("theme-size");
    if (r) { r.value = state.size; $("theme-size-val").textContent = state.size + "%"; }
  }

  // quick accent colors: they only set the accent (--amber), so every theme keeps its own look
  const ACCENTS = ["#cd9d3c", "#5ec2e8", "#e86db5", "#9b8cff", "#ff8a4c", "#4dd6a0"];
  function renderAccent() {
    const wrap = $("theme-accent");
    if (!wrap) return;
    const mine = state.custom["--amber"];
    wrap.innerHTML = `<button type="button" class="accent-chip auto${mine ? "" : " on"}" data-accent="" aria-pressed="${!mine}">THEME</button>`
      + ACCENTS.map((c) => `<button type="button" class="accent-dot${mine === c ? " on" : ""}" data-accent="${c}" style="background:${c}" aria-label="Accent ${c}" aria-pressed="${mine === c}"></button>`).join("");
    wrap.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.accent) state.custom["--amber"] = b.dataset.accent; else delete state.custom["--amber"];
      apply(); save(); render();
    }));
  }

  function render() { renderPresets(); renderAccent(); renderSwatches(); renderText(); }

  function reset() { state = { base: state.base, custom: {}, font: "pixel", size: 100 }; apply(); save(); render(); }

  function bind() {
    const seg = $("theme-font");
    if (!seg) return;
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      state.font = b.dataset.val === "mono" ? "mono" : "pixel"; apply(); save(); renderText();
    });
    $("theme-size").addEventListener("input", (e) => {
      state.size = Math.max(SIZE_MIN, Math.min(SIZE_MAX, Number(e.target.value) || 100)); apply(); save(); renderText();
    });
    $("theme-reset-btn").addEventListener("click", reset);
    $("theme-copy-btn").addEventListener("click", () => {
      const code = exportCode();
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => toast("Theme code copied."), () => { $("theme-code").value = code; $("theme-code").select(); });
      else { $("theme-code").value = code; $("theme-code").select(); }
    });
    $("theme-load-btn").addEventListener("click", () => {
      const r = importCode($("theme-code").value);
      if (r === true) { $("theme-code").value = ""; toast("Theme loaded."); }
      else toast(r === "locked" ? "That theme is still locked for you." : "That doesn't look like a theme code.");
    });
  }

  load();
  apply();
  bind();
  // some presets are measured from the live stylesheet, so repaint once everything has loaded
  window.addEventListener("load", apply);
  return { render, apply, exportCode, importCode, contrast, ensureContrast, _palette: palette, PRESETS };
})();
