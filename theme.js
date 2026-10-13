const Theme = (() => {
  const STORAGE_KEY = "debugr_theme_overrides";
  const VARS = ["--bg", "--bg2", "--bg3", "--border", "--text", "--text-dim", "--text-muted",
    "--green", "--red", "--amber", "--on-accent"];

  const PRESETS = [
    { id: "dark", name: "CLASSIC" },
    { id: "light", name: "LIGHT" },
  ];

  const SWATCHES = [
    { key: "--bg", label: "Background" },
    { key: "--text", label: "Text" },
    { key: "--amber", label: "Accent" },
    { key: "--green", label: "Pass (true)" },
    { key: "--red", label: "Fail (false)" },
  ];

  let state = { base: "dark", custom: {} };

  // storage
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!raw || typeof raw !== "object") return;
      if (raw.base) {
        state.base = PRESETS.some((p) => p.id === raw.base) ? raw.base : "dark";
        state.custom = raw.custom && typeof raw.custom === "object" ? raw.custom : {};
      } else {
        state.custom = Object.fromEntries(Object.entries(raw).filter(([k]) => VARS.includes(k)));
      }
    } catch { /* ignore broken saved data */ }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
  }

  function apply() {
    const root = document.documentElement;
    root.setAttribute("data-theme", state.base);
    for (const k of VARS) root.style.removeProperty(k);
    for (const [k, v] of Object.entries(state.custom)) {
      if (VARS.includes(k) && /^#[0-9a-f]{6}$/i.test(v)) root.style.setProperty(k, v);
    }
  }
  function currentVars() {
    const cs = getComputedStyle(document.documentElement);
    const out = {};
    for (const k of VARS) out[k] = cs.getPropertyValue(k).trim();
    return out;
  }
  function toHex(color) {
    if (!color) return "#000000";
    if (color.startsWith("#")) {
      return color.length === 4 ? "#" + [...color.slice(1)].map((c) => c + c).join("") : color.slice(0, 7);
    }
    const m = color.match(/\d+/g);
    if (!m) return "#000000";
    return "#" + m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, "0")).join("");
  }
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(toHex(h).slice(i, i + 2), 16));
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
  }
  function luminance(h) {
    const [r, g, b] = rgb(h).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function setColor(key, value) {
    state.custom[key] = value;
    const cur = { ...currentVars(), ...state.custom };
    if (key === "--bg" || key === "--text") {
      state.custom["--bg2"] = mix(cur["--bg"], cur["--text"], 0.05);
      state.custom["--bg3"] = mix(cur["--bg"], cur["--text"], 0.09);
      state.custom["--border"] = mix(cur["--bg"], cur["--text"], 0.2);
      state.custom["--text-dim"] = mix(cur["--text"], cur["--bg"], 0.45);
      state.custom["--text-muted"] = mix(cur["--text"], cur["--bg"], 0.7);
    }
    if (key === "--green" || key === "--red") {
      // text drawn on top of a filled green/red button
      state.custom["--on-accent"] = luminance(cur["--green"]) > 0.45 ? "#0d0d0d" : "#ffffff";
    }
    apply();
    save();
  }


  function renderPresets() {
    const wrap = document.getElementById("theme-presets");
    wrap.innerHTML = PRESETS.map((p) =>
      `<button class="btn small theme-preset-btn ${p.id === state.base ? "active" : ""}" data-preset="${p.id}">${p.name}</button>`).join("");
    wrap.querySelectorAll(".theme-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state = { base: btn.dataset.preset, custom: {} };
        apply(); save();
        renderPresets(); renderSwatches();
      });
    });
  }
  function renderSwatches() {
    const wrap = document.getElementById("theme-swatches");
    const cur = currentVars();
    wrap.innerHTML = SWATCHES.map((s) => `
      <label class="theme-swatch">
        <span>${s.label}</span>
        <input type="color" data-var="${s.key}" value="${toHex(cur[s.key])}" />
      </label>`).join("");
    wrap.querySelectorAll("input[type=color]").forEach((input) => {
      input.addEventListener("input", () => setColor(input.dataset.var, input.value));
    });
  }
  function reset() {
    state.custom = {};
    apply(); save();
    renderSwatches();
  }

  document.getElementById("theme-btn").addEventListener("click", () => {
    renderPresets();
    renderSwatches();
    document.getElementById("theme-prompt").classList.remove("hidden");
  });
  document.getElementById("theme-close-btn").addEventListener("click", () => {
    document.getElementById("theme-prompt").classList.add("hidden");
  });
  document.getElementById("theme-reset-btn").addEventListener("click", reset);

  load();
  apply();
  return {};
})();
