const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBOuLlFGbxi67Re84MguESalTT-O-IsGJs",

  authDomain: "thevariablegame.firebaseapp.com",

  databaseURL: "https://thevariablegame-default-rtdb.firebaseio.com",

  projectId: "thevariablegame",

  storageBucket: "thevariablegame.firebasestorage.app",

  messagingSenderId: "646873118503",

  appId: "1:646873118503:web:38cd1be48bd351443a5b02",

  measurementId: "G-0Q605WKXHH"

};

(function migrateOldKeys() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith("vg_")) continue;
      const nk = "debugr_" + k.slice(3);
      if (localStorage.getItem(nk) === null) localStorage.setItem(nk, localStorage.getItem(k));
      localStorage.removeItem(k)
    }
  } catch { }
})();

const FEEDBACK_ACCESS_KEY = "1405baa1-e9ca-476c-9d71-0c4bdbd327d9";

const PlayerState = {
  KEY_NICKNAME: "debugr_nickname",
  KEY_STREAK: "debugr_streak_cache",
  KEY_VISITED: "debugr_has_visited",
  KEY_TUTORIAL_DONE: "debugr_tutorial_done",

  getNickname() { return localStorage.getItem(this.KEY_NICKNAME); },
  setNickname(n) { localStorage.setItem(this.KEY_NICKNAME, n); },
  hasVisited() { return localStorage.getItem(this.KEY_VISITED) === "1"; },
  markVisited() { localStorage.setItem(this.KEY_VISITED, "1"); },
  tutorialDone() { return localStorage.getItem(this.KEY_TUTORIAL_DONE) === "1"; },
  markTutorialDone() { localStorage.setItem(this.KEY_TUTORIAL_DONE, "1"); },
  getStreakCache() {
    const raw = localStorage.getItem(this.KEY_STREAK);
    if (!raw) return { daily: 0, win: 0, lastPlayDate: null };
    return JSON.parse(raw);
  },
  setStreakCache(s) { localStorage.setItem(this.KEY_STREAK, JSON.stringify(s)); },
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function todayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return t.toISOString().slice(0, 10);
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

Object.assign(PlayerState, {
  KEY_STATS: "debugr_stats",
  KEY_AVATAR: "debugr_avatar",
  KEY_SEEN_REWARDS: "debugr_seen_rewards",
  KEY_PUZZLE_STREAK: "debugr_puzzle_streak",

  getStats() { return readJSON(this.KEY_STATS, {}); },
  bumpStat(k) {
    const s = this.getStats();
    s[k] = (s[k] || 0) + 1;
    localStorage.setItem(this.KEY_STATS, JSON.stringify(s));
  },
  getAvatar() { return localStorage.getItem(this.KEY_AVATAR) || "bug"; },
  setAvatar(id) { localStorage.setItem(this.KEY_AVATAR, id); },
  getSeenRewards() { return readJSON(this.KEY_SEEN_REWARDS, null); },
  setSeenRewards(list) { localStorage.setItem(this.KEY_SEEN_REWARDS, JSON.stringify(list)); },

  currentPuzzleStreak() {
    const s = readJSON(this.KEY_PUZZLE_STREAK, { count: 0, last: null });
    const yesterday = todayKey(new Date(Date.now() - 86400000));
    return s.last === todayKey() || s.last === yesterday ? s.count : 0;
  },
  bumpPuzzleStreak() {
    const s = readJSON(this.KEY_PUZZLE_STREAK, { count: 0, last: null });
    const today = todayKey();
    if (s.last !== today) {
      const yesterday = todayKey(new Date(Date.now() - 86400000));
      s.count = s.last === yesterday ? s.count + 1 : 1;
      s.last = today;
      localStorage.setItem(this.KEY_PUZZLE_STREAK, JSON.stringify(s));
    }
    return s.count;
  },
});

const PuzzleState = {
  KEY: "debugr_puzzle_progress",
  load() {
    const raw = localStorage.getItem(this.KEY);
    if (!raw) return { syntax: 0, complete: 0, typefix: 0 };
    try { return JSON.parse(raw); } catch { return { syntax: 0, complete: 0, typefix: 0 }; }
  },
  save(state) { localStorage.setItem(this.KEY, JSON.stringify(state)); },
  completedCount(track) { return this.load()[track] || 0; },
  markSolved(track, levelIndex) {
    const state = this.load();
    if (levelIndex + 1 > (state[track] || 0)) state[track] = levelIndex + 1;
    this.save(state);
  },
};

const BASIC_BLOCKLIST = atob("ZnVjayxzaGl0LGJpdGNoLG5pZ2dlcixuaWdnYSxmYWdnb3QsY3VudCxyZXRhcmQscmFwZSxzbHV0LHdob3Jl").split(",");
function looksCleanClientSide(name) {
  if (!name || typeof name !== "string") return false;
  if (name.trim().length < 3 || name.trim().length > 15) return false;
  const lower = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return !BASIC_BLOCKLIST.some((bad) => lower.includes(bad));
}