// Pure helpers for rooms: no DOM, no Firebase, so they can be unit tested (node tests/rooms.test.js).
(function (root) {
  "use strict";

  const MAX_PLAYERS = 6;
  const ROUNDS = [1, 3, 5];
  const SPEEDS = { normal: 1, hungry: 0.75, feral: 0.55 }; // multiplies how long the bug takes to get hungry
  const DIFFS = ["easy", "medium", "hard"];
  const SABOTAGE_BOOST = 0.08;

  const clampChoice = (v, list, fallback) => (list.includes(v) ? v : fallback);

  // never trust a room document: anything out of range falls back to a default
  function normalizeRoom(r) {
    r = r || {};
    return {
      difficulty: clampChoice(r.difficulty, DIFFS, "easy"),
      rounds: clampChoice(r.rounds, ROUNDS, 1),
      speed: clampChoice(r.speed, Object.keys(SPEEDS), "normal"),
      sabotage: r.sabotage === true,
      phase: clampChoice(r.phase, ["lobby", "race", "results"], "lobby"),
      round: Number.isInteger(r.round) && r.round >= 0 && r.round <= 5 ? r.round : 0,
      roundWinners: Array.isArray(r.roundWinners) ? r.roundWinners.filter((x) => typeof x === "string").slice(0, 5) : [],
      hostUid: typeof r.hostUid === "string" ? r.hostUid : "",
      hostName: typeof r.hostName === "string" ? r.hostName.slice(0, 16) : "",
      winnerUid: typeof r.winnerUid === "string" ? r.winnerUid : null,
      winnerNickname: typeof r.winnerNickname === "string" ? r.winnerNickname.slice(0, 16) : "",
      winnerElapsedMs: Number.isFinite(r.winnerElapsedMs) ? r.winnerElapsedMs : 0,
      task: r.task || null,
    };
  }

  // how many rounds a player has won
  function winsByUid(roundWinners) {
    const wins = Object.create(null);
    for (const uid of roundWinners || []) wins[uid] = (wins[uid] || 0) + 1;
    return wins;
  }

  // the match is over when somebody has a majority, or the rounds ran out
  function matchState(room) {
    const wins = winsByUid(room.roundWinners);
    const need = Math.floor(room.rounds / 2) + 1;
    let leader = null, best = 0;
    for (const uid in wins) if (wins[uid] > best) { best = wins[uid]; leader = uid; }
    const tied = Object.values(wins).filter((w) => w === best).length > 1;
    const decided = best >= need;
    const outOfRounds = room.round >= room.rounds;
    return { wins, need, over: decided || outOfRounds, champion: (decided || outOfRounds) && !tied ? leader : null, tied: outOfRounds && !decided && tied };
  }

  // the host always counts as ready; everyone else has to tick it
  function readyInfo(players, hostUid) {
    const total = players.length;
    const ready = players.filter((p) => p.ready || p.token === hostUid).length;
    return { ready, total, all: total > 0 && ready === total, canStart: total >= 2 && ready >= 2 };
  }

  // if the host left, the player with the smallest uid takes over (every client picks the same one)
  function nextHost(players, hostUid) {
    if (!players.length || players.some((p) => p.token === hostUid)) return null;
    return players.map((p) => p.token).sort()[0];
  }

  // lane position 0..1 along the track; always visibly moves forward as rules get met
  function lanePosition(passed, total) {
    if (!total) return 0;
    return Math.max(0, Math.min(1, passed / total));
  }

  // remembers each player's best rule count this round so toggling a rule on and off can't spam sabotage
  function createSabotageTracker() {
    const best = Object.create(null);
    return {
      reset() { for (const k in best) delete best[k]; },
      // returns how many NEW rules this player has met since we last saw them
      update(uid, passed) {
        const prev = best[uid] || 0;
        if (passed > prev) { best[uid] = passed; return passed - prev; }
        return 0;
      },
    };
  }

  function sortResults(players) {
    // finished players by time, then unfinished by how many rules they met
    return players.slice().sort((a, b) => {
      if (a.done !== b.done) return a.done ? -1 : 1;
      if (a.done) return a.elapsedMs - b.elapsedMs;
      return (b.passed || 0) - (a.passed || 0);
    });
  }

  function parseRoomCode(text) {
    const s = String(text || "").toUpperCase();
    const m = s.match(/ROOM=([A-HJ-NP-Z2-9]{4})\b/) || s.trim().match(/^([A-HJ-NP-Z2-9]{4})$/);
    return m ? m[1] : "";
  }

  const api = { MAX_PLAYERS, ROUNDS, SPEEDS, DIFFS, SABOTAGE_BOOST, normalizeRoom, winsByUid, matchState, readyInfo, nextHost, lanePosition, createSabotageTracker, sortResults, parseRoomCode };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RoomLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
