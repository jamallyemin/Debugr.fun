// Service worker: lets Debugr open and run with no connection (solo, puzzles, daily, Learn).
// - this site's own files: network first (always fresh when online), the saved copy when offline
// - Google Fonts and Python (Pyodide): saved on first use, then served from the saved copy
// - Firebase and everything else is left alone, so rooms, friends and leaderboards simply need a connection.
// Bump VERSION when you add files, and add them to CORE so they are saved on the first visit.
const VERSION = "v29";
const CACHE = "debugr-" + VERSION;
const CORE = ["./", "index.html", "style.css", "favicon.svg", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "apple-touch-icon.png", "og.png", "taskEngine.js", "parser.js", "roomlogic.js", "config.js", "firebaseclient.js", "tutorial.js", "pyeval.js", "puzzles.js", "lessons.js", "lessons3.js", "lessons4.js", "lessons5.js", "lessons6.js", "lessons7.js", "lessons8.js", "lessons9.js", "lessons10.js", "pyharness.js", "pyrun.js", "certificate.js", "learn.js", "rewards.js", "theme.js", "sounds.js", "music.js", "prefs.js", "rating.js", "skins.js", "sharecard.js", "quickmatch.js", "menuorder.js", "errlog.js", "a11y.js", "offline.js", "friends.js", "activity.js", "unlocks.js", "script.js", "rooms.js", "keys.js", "settings.js", "feedback.js", "cloudsave.js", "daily.js", "keycaps.js", "avatars/bug.png", "avatars/cat.png", "avatars/fox.png", "avatars/owl.png", "avatars/snake.png"];
const LONG = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net\/pyodide\/)/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => { })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("debugr-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) c.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") { const home = await c.match("index.html"); if (home) return home; }
    throw err;
  }
}
async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
  return res;
}
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) return void e.respondWith(networkFirst(req));
  if (LONG.test(req.url)) return void e.respondWith(cacheFirst(req));
});
