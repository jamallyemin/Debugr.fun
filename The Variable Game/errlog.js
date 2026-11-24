// Keeps the last few errors on this page in memory (never sent anywhere by itself). If the player ticks
// "include technical details" when sending a bug report, they are added to the message.
const ErrLog = (() => {
  "use strict";
  const list = [];
  const add = (t) => { list.push(String(t).replace(/\s+/g, " ").slice(0, 110)); if (list.length > 4) list.shift(); };
  window.addEventListener("error", (e) => add(`${e.message || "error"} @${String(e.filename || "").split("/").pop()}:${e.lineno || 0}`));
  window.addEventListener("unhandledrejection", (e) => add("promise: " + ((e.reason && e.reason.message) || e.reason || "rejected")));
  // short, readable summary: browser, size, connection, recent errors (max ~500 characters)
  function summary(screen) {
    const ua = navigator.userAgent.replace(/^Mozilla\/5\.0 /, "").slice(0, 90);
    const online = navigator.onLine === false ? "offline" : "online";
    const lines = [`ua: ${ua}`, `view: ${innerWidth}x${innerHeight} ${online}${screen ? " screen:" + screen : ""}`];
    if (list.length) lines.push("errors: " + list.join(" | "));
    return lines.join("\n").slice(0, 590);
  }
  return { summary, count: () => list.length };
})();
