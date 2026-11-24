// "Share my rating": draws a 1080x1350 picture (bug, both ratings, tier, streak) and either opens the phone's share
// sheet or downloads the PNG. Everything is drawn in the browser, nothing is uploaded.
const ShareCard = (() => {
  "use strict";
  const css = (n, d) => (getComputedStyle(document.documentElement).getPropertyValue(n) || "").trim() || d;

  // the shared bug symbol uses CSS variables, so bake the real colours in before drawing it
  function bugImage(color) {
    return new Promise((resolve) => {
      const sym = document.getElementById("bug-sprite");
      if (!sym) return resolve(null);
      const map = { "--bug-body": color, "--bug-eye": css("--bg", "#0b0b0b"), "--bug-spine": css("--bg", "#0b0b0b"), "--amber": css("--amber", "#cd9d3c") };
      const inner = sym.innerHTML.replace(/var\((--[\w-]+)[^)]*\)/g, (_, n) => map[n] || color);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 12 12" width="480" height="480" shape-rendering="crispEdges">${inner}</svg>`;
      const im = new Image();
      im.onload = () => resolve(im); im.onerror = () => resolve(null);
      im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }

  async function draw() {
    const W = 1080, H = 1350, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    const bg = css("--bg", "#0b0b0b"), bg2 = css("--bg2", "#0f110f"), border = css("--border", "#232823"), text = css("--text", "#e6ebe6"), dim = css("--text-dim", "#8a948a"), amber = css("--amber", "#cd9d3c");
    const st = Ratings.get(), tier = Rating.tierProgress(st.puz.r), btier = Rating.tierProgress(st.bug.r);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = border; g.lineWidth = 3; g.strokeRect(40, 40, W - 80, H - 80);
    const mono = "JetBrains Mono, ui-monospace, monospace", vt = "Silkscreen, JetBrains Mono, monospace";
    g.textBaseline = "alphabetic"; g.textAlign = "left";
    g.fillStyle = text; g.font = `700 54px ${vt}`; g.fillText("debugr", 90, 140);
    g.fillStyle = amber; g.fillText("_", 90 + g.measureText("debugr").width, 140);
    g.textAlign = "right"; g.fillStyle = dim; g.font = `28px ${mono}`; g.fillText((PlayerState.getNickname() || "guest").toUpperCase(), W - 90, 136);
    const bug = await bugImage(tier.tier.color);
    if (bug) g.drawImage(bug, W / 2 - 240, 190, 480, 480);
    g.textAlign = "center";
    g.fillStyle = text; g.font = `700 150px ${vt}`; g.fillText(String(st.puz.r) + (st.puz.g < Rating.PLACEMENT ? "?" : ""), W / 2, 820);
    g.fillStyle = tier.tier.color; g.font = `700 46px ${vt}`; g.fillText(tier.tier.name.toUpperCase(), W / 2, 890);
    g.fillStyle = dim; g.font = `26px ${mono}`; g.fillText("PUZZLE RATING", W / 2, 935);
    // progress to the next tier
    g.fillStyle = bg2; g.fillRect(190, 970, 700, 18); g.fillStyle = tier.tier.color; g.fillRect(190, 970, Math.round(700 * tier.pct), 18);
    g.fillStyle = dim; g.font = `24px ${mono}`;
    g.fillText(tier.next ? `${tier.toNext} to ${tier.next.name}` : "top tier", W / 2, 1030);
    // bottom stats
    const cells = [["BUG GAME", String(st.bug.r) + (st.bug.g < Rating.PLACEMENT ? "?" : "")], ["BEST STREAK", String(Math.max(parseInt(localStorage.getItem("debugr_best_streak"), 10) || 0, (PlayerState.getStreakCache() || {}).daily | 0)) + " days"], ["PUZZLES", String(["syntax", "complete", "typefix"].reduce((a, t) => a + PuzzleState.completedCount(t), 0))]];
    cells.forEach((cell, i) => {
      const x = 90 + i * 300;
      g.fillStyle = bg2; g.fillRect(x, 1090, 270, 120); g.strokeStyle = border; g.lineWidth = 2; g.strokeRect(x, 1090, 270, 120);
      g.fillStyle = dim; g.font = `20px ${mono}`; g.fillText(cell[0], x + 135, 1132);
      g.fillStyle = text; g.font = `700 36px ${vt}`; g.fillText(cell[1], x + 135, 1184);
    });
    g.fillStyle = dim; g.font = `26px ${mono}`; g.fillText("debugr.fun", W / 2, 1282);
    return c;
  }

  async function share() {
    const c = await draw();
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    if (!blob) return false;
    const file = new File([blob], "debugr-rating.png", { type: "image/png" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "my debugr rating", text: "can you beat my rating? https://debugr.fun" }); return true; }
    } catch (e) { if (e && e.name === "AbortError") return true; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "debugr-rating.png";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    if (typeof Rewards !== "undefined") Rewards.toast("Picture saved. Post it anywhere!", 3000);
    return true;
  }
  return { draw, share };
})();
