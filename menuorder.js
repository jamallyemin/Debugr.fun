// Drag the menu rows (the 6-dot grip on the left) to put the ones you use most on top.
// The number keys follow the order on screen: PLAY SOLO is 1, the rows below are 2, 3, 4 ... as they appear.
// The order is saved on this device. Alt+Up / Alt+Down on a focused grip does the same without a mouse.
const MenuOrder = (() => {
  "use strict";
  const KEY = "debugr_menu_order";
  const list = document.querySelector(".mode-list");
  if (!list) return {};
  const all = () => [...list.querySelectorAll(":scope > .mode-row")];
  const shown = () => all().filter((r) => !r.classList.contains("hidden"));
  const ids = () => all().map((r) => r.dataset.action);

  function save() { try { localStorage.setItem(KEY, JSON.stringify(ids())); } catch { } }
  function restore() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { }
    if (!Array.isArray(saved)) return;
    const rows = all(), known = saved.map((a) => rows.find((r) => r.dataset.action === a)).filter(Boolean);
    known.forEach((r) => list.appendChild(r)); // rows that are new since the order was saved stay on top
  }

  // numbers on the rows follow the order shown
  function renumber() {
    shown().forEach((r, i) => {
      let h = r.querySelector(":scope > .key-hint");
      if (!h) { h = document.createElement("span"); h.className = "key-hint"; r.appendChild(h); }
      const t = String(i + 2);
      if (h.textContent !== t) h.textContent = t;
    });
  }
  // which action does number key n open? (1 is always PLAY SOLO)
  function actionForKey(n) { const r = shown()[n - 2]; return r ? r.dataset.action : null; }

  function zoomFactor() {
    const p = document.createElement("div");
    p.style.cssText = "position:fixed;width:100px;height:1px;visibility:hidden";
    document.body.appendChild(p);
    const z = p.getBoundingClientRect().width / 100 || 1;
    p.remove();
    return z;
  }
  // move a row in the DOM and slide the others into place
  function flip(change) {
    const rows = shown(), first = new Map(rows.map((r) => [r, r.getBoundingClientRect().top]));
    change();
    rows.forEach((r) => {
      const d = first.get(r) - r.getBoundingClientRect().top;
      if (!d || r.classList.contains("dragging")) return;
      const z = zoomFactor();
      r.style.transition = "none"; r.style.transform = `translateY(${d / z}px)`;
      requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transition = "transform .16s ease"; r.style.transform = ""; }));
    });
  }

  function addGrip(row) {
    if (row.querySelector(":scope > .grip")) return;
    const g = document.createElement("span");
    g.className = "grip"; g.setAttribute("role", "button"); g.tabIndex = 0;
    const name = (row.querySelector(".t b") || {}).textContent || "row";
    g.setAttribute("aria-label", `Move ${name}: drag, or press Alt and the up or down arrow`);
    g.title = "Drag to reorder";
    row.appendChild(g);
    let st = null;
    g.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); });
    g.addEventListener("pointerdown", (e) => {
      if (e.button > 0) return;
      e.preventDefault(); e.stopPropagation();
      st = { grab: e.clientY - row.getBoundingClientRect().top, z: zoomFactor() };
      row.classList.add("dragging"); list.classList.add("sorting");
      try { g.setPointerCapture(e.pointerId); } catch { }
    });
    g.addEventListener("pointermove", (e) => {
      if (!st) return;
      const place = () => { row.style.transition = "none"; row.style.transform = ""; const r = row.getBoundingClientRect(); row.style.transform = `translateY(${((e.clientY - st.grab) - r.top) / st.z}px)`; };
      place();
      const sibs = shown(), i = sibs.indexOf(row), r = row.getBoundingClientRect();
      const center = (e.clientY - st.grab) + r.height / 2, prev = sibs[i - 1], next = sibs[i + 1];
      const pm = prev && (prev.getBoundingClientRect().top + prev.getBoundingClientRect().height / 2);
      const nm = next && (next.getBoundingClientRect().top + next.getBoundingClientRect().height / 2);
      if (prev && center < pm) flip(() => list.insertBefore(row, prev));
      else if (next && center > nm) flip(() => list.insertBefore(next, row));
      place();
    });
    const end = () => {
      if (!st) return; st = null;
      row.style.transition = "transform .16s ease"; row.style.transform = "";
      setTimeout(() => { row.style.transition = ""; }, 200);
      row.classList.remove("dragging"); list.classList.remove("sorting");
      save(); renumber();
    };
    g.addEventListener("pointerup", end); g.addEventListener("pointercancel", end);
    g.addEventListener("keydown", (e) => {
      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault(); e.stopPropagation();
      const sibs = shown(), i = sibs.indexOf(row);
      if (e.key === "ArrowUp" && sibs[i - 1]) flip(() => list.insertBefore(row, sibs[i - 1]));
      if (e.key === "ArrowDown" && sibs[i + 1]) flip(() => list.insertBefore(sibs[i + 1], row));
      save(); renumber(); g.focus();
    });
  }

  function reset() { try { localStorage.removeItem(KEY); } catch { } location.reload(); }

  restore();
  all().forEach(addGrip);
  renumber();
  // rows can appear later (Quick match unlocks): keep numbers and grips right
  new MutationObserver(() => { all().forEach(addGrip); renumber(); }).observe(list, { attributes: true, attributeFilter: ["class"], subtree: true, childList: true });
  const rb = document.getElementById("settings-menuorder-btn");
  if (rb) rb.addEventListener("click", reset);
  return { actionForKey, reset };
})();
