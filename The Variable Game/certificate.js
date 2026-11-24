// "Certificate": a keepsake picture for finishing every Learn chapter. Drawn in the browser (nothing is uploaded),
// shown in a pop-up with a download / share button.
const Certificate = (() => {
  "use strict";
  const css = (n, d) => (getComputedStyle(document.documentElement).getPropertyValue(n) || "").trim() || d;
  const $ = (id) => document.getElementById(id);

  function bugImage(color, size) {
    return new Promise((resolve) => {
      const sym = document.getElementById("bug-sprite");
      if (!sym) return resolve(null);
      const bg = css("--bg", "#0b0b0b");
      const map = { "--bug-body": color, "--bug-eye": bg, "--bug-spine": bg, "--amber": css("--amber", "#cd9d3c") };
      const inner = sym.innerHTML.replace(/var\((--[\w-]+)[^)]*\)/g, (_, n) => map[n] || color);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 12 12" width="${size}" height="${size}" shape-rendering="crispEdges">${inner}</svg>`;
      const im = new Image();
      im.onload = () => resolve(im); im.onerror = () => resolve(null);
      im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }

  const complete = () => {
    try {
      const prog = JSON.parse(localStorage.getItem("debugr_learn")) || {};
      return Lessons.CHAPTERS.every((c) => c.lessons.every((l) => prog[l.id]));
    } catch { return false; }
  };

  async function draw() {
    const W = 1600, H = 1130, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const bg = css("--bg", "#0b0b0b"), bg2 = css("--bg2", "#0f110f"), text = css("--text", "#e6ebe6"), dim = css("--text-dim", "#8a948a"), amber = css("--amber", "#cd9d3c"), green = css("--green", "#4daa6e");
    const mono = "JetBrains Mono, ui-monospace, monospace", vt = "Silkscreen, JetBrains Mono, monospace";
    const lessons = Lessons.CHAPTERS.reduce((n, ch) => n + ch.lessons.length, 0), chapters = Lessons.CHAPTERS.length;
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = green; g.lineWidth = 4; g.strokeRect(36, 36, W - 72, H - 72);
    g.strokeStyle = amber; g.lineWidth = 2; g.strokeRect(54, 54, W - 108, H - 108);
    g.textBaseline = "alphabetic"; g.textAlign = "center";
    g.fillStyle = text; g.font = `700 44px ${vt}`;
    const w1 = g.measureText("debugr").width;
    g.fillText("debugr", W / 2 - 12, 150); g.fillStyle = amber; g.fillText("_", W / 2 - 12 + w1 / 2 + 14, 150);
    g.fillStyle = dim; g.font = `26px ${mono}`; g.fillText("CERTIFICATE OF COMPLETION", W / 2, 210);
    const bug = await bugImage(green, 230);
    if (bug) g.drawImage(bug, W / 2 - 115, 245, 230, 230);
    g.fillStyle = dim; g.font = `28px ${mono}`; g.fillText("this certifies that", W / 2, 545);
    const name = (PlayerState.getNickname() || "A Debugr player");
    let size = 110; g.font = `700 ${size}px ${vt}`;
    while (g.measureText(name).width > W - 300 && size > 40) { size -= 6; g.font = `700 ${size}px ${vt}`; }
    g.fillStyle = text; g.fillText(name, W / 2, 665);
    g.strokeStyle = amber; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2 - 330, 700); g.lineTo(W / 2 + 330, 700); g.stroke();
    g.fillStyle = dim; g.font = `30px ${mono}`;
    g.fillText(`finished all ${chapters} chapters and ${lessons} lessons of`, W / 2, 775);
    g.fillStyle = green; g.font = `700 52px ${vt}`; g.fillText("PYTHON FROM ZERO", W / 2, 850);
    g.fillStyle = dim; g.font = `22px ${mono}`;
    g.fillText("print · loops · functions · classes · generators · decorators", W / 2, 910);
    const d = new Date();
    g.fillStyle = text; g.font = `26px ${mono}`;
    g.fillText(d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }).toUpperCase(), W / 2, 1000);
    g.fillStyle = dim; g.font = `22px ${mono}`; g.fillText("debugr.fun", W / 2, 1050);
    return c;
  }

  // Escape closes the certificate first (before the screen's own Escape handling)
  document.addEventListener("keydown", (e) => {
    const m = $("cert-modal");
    if (e.key === "Escape" && m && !m.classList.contains("hidden")) { e.stopImmediatePropagation(); e.preventDefault(); m.classList.add("hidden"); }
  }, true);

  let canvasCache = null;
  async function open() {
    if (!complete()) return false;
    let m = $("cert-modal");
    if (!m) {
      m = document.createElement("div"); m.id = "cert-modal"; m.className = "modal-backdrop hidden";
      m.innerHTML = `<div class="modal-box cert-box"><button class="modal-x" id="cert-x" aria-label="Close">✕</button><h2>YOUR CERTIFICATE</h2>
        <img id="cert-img" class="cert-img" alt="Certificate of completion for Debugr Learn">
        <div class="modal-actions"><button class="btn" id="cert-share">SHARE</button><button class="btn primary" id="cert-dl">DOWNLOAD</button></div></div>`;
      document.body.appendChild(m);
      m.addEventListener("click", (e) => {
        if (e.target === m || e.target.closest("#cert-x")) return m.classList.add("hidden");
        if (e.target.closest("#cert-dl")) return save(false);
        if (e.target.closest("#cert-share")) return save(true);
      });
    }
    canvasCache = await draw();
    $("cert-img").src = canvasCache.toDataURL("image/png");
    $("cert-share").classList.toggle("hidden", !(navigator.canShare && navigator.share));
    m.classList.remove("hidden");
    return true;
  }
  async function save(share) {
    if (!canvasCache) return;
    const blob = await new Promise((r) => canvasCache.toBlob(r, "image/png"));
    if (!blob) return;
    const file = new File([blob], "debugr-certificate.png", { type: "image/png" });
    if (share) {
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "I finished Debugr Learn", text: "I learned Python from zero on https://debugr.fun" }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "debugr-certificate.png";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    try { Rewards.toast("Certificate saved", 2600); } catch { }
  }
  return { open, complete, draw };
})();
