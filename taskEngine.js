// Task engine v2: every task is a SPEC. It names the variables you must define
// and the rules link those variables to each other (len(name) == age, ...).
//
// A hidden reference solution is built first and every rule is derived from it,
// so a task can never contradict itself. The reference solution is kept on the
// task as `solution` (for tests) and is never sent over the network.
(function (root) {
  "use strict";

  // ---------- small helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const code = (s) => `<code>${esc(s)}</code>`;
  function rngInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[rngInt(0, arr.length - 1)]; }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rngInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function uniqueSample(arr, n) { return shuffle(arr.slice()).slice(0, n); }
  function isPrime(n) {
    if (!Number.isInteger(n) || n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  }
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const isSquare = (n) => Number.isInteger(n) && n >= 1 && Number.isInteger(Math.sqrt(n));
  const vowelCount = (s) => (s.toLowerCase().match(/[aeiou]/g) || []).length;
  const digitSum = (n) => String(Math.abs(n)).split("").reduce((a, d) => a + Number(d), 0);

  // ---------- names and words ----------
  const NUM_NAMES = ["age", "price", "score", "level", "width", "height", "speed", "coins", "lives", "limit", "size", "damage"];
  const STR_NAMES = ["name", "word", "title", "label", "city", "tag", "user", "msg"];
  const LIST_NAMES = ["scores", "nums", "ages", "values", "prices", "items"];
  const BOOL_NAMES = ["active", "alive", "hidden", "locked", "ready", "muted"];
  const ALL_NAMES = new Set([...NUM_NAMES, ...STR_NAMES, ...LIST_NAMES, ...BOOL_NAMES]);
  const WORDS = [
    "echo", "delta", "orbit", "cipher", "quartz", "vector", "flux", "nova", "prism", "raven", "shard",
    "onyx", "tundra", "ember", "glyph", "haze", "lumen", "gale", "krypt", "mirth", "nexus", "oxide",
    "pylon", "quill", "riptide", "sable", "trace", "umbra", "vex", "wisp", "yarrow", "zenith",
  ];
  const PALINDROMES = ["level", "radar", "civic", "kayak", "rotor", "deed", "noon", "refer", "racecar"];

  // ---------- reading the player's program ----------
  // env = { vars: { name: { type: "num" | "str" | "list", value } }, lines: n }
  function varOf(env, name) { return env && env.vars ? env.vars[name] : undefined; }
  const TYPE_WORD = { num: "a number", str: "a string", list: "a list", bool: "True or False" };
  // returns a hint when `name` is missing or has the wrong type, otherwise null
  function problem(env, name, type) {
    const v = varOf(env, name);
    if (!v) return `${name} isn't defined yet`;
    if (v.type !== type) return `${name} should be ${TYPE_WORD[type]}`;
    if (type === "list" && !v.value.every((x) => typeof x === "number")) return `${name} should only hold numbers`;
    return null;
  }
  const ok = (hint) => ({ ok: true, hint: hint || null });
  const bad = (hint) => ({ ok: false, hint: hint || null });
  const expr = (b, k) => (k === 0 ? b : k > 0 ? `${b} + ${k}` : `${b} - ${-k}`);

  // ---------- rule library ----------
  // roles: which kinds of variable the rule binds, in order.
  // schema: how every param is validated when a task comes back from the network.
  // cross: the rule links two or more variables.
  const RULES = {
    numBetween: {
      roles: ["num"], schema: { a: "name", lo: "int", hi: "int" },
      make: (s, [a]) => ({ a, lo: Math.max(1, s.num[a] - rngInt(2, 8)), hi: s.num[a] + rngInt(2, 8) }),
      html: (p) => `${code(p.a)} is a number between ${p.lo} and ${p.hi}`,
      eval: (p, env) => {
        const h = problem(env, p.a, "num"); if (h) return bad(h);
        const v = varOf(env, p.a).value;
        return v >= p.lo && v <= p.hi ? ok() : bad(`${v} is outside ${p.lo} to ${p.hi}`);
      },
    },
    numParity: {
      roles: ["num"], schema: { a: "name", even: "bool" },
      make: (s, [a]) => ({ a, even: s.num[a] % 2 === 0 ? 1 : 0 }),
      html: (p) => `${code(p.a)} is an ${p.even ? "even" : "odd"} number`,
      eval: (p, env) => {
        const h = problem(env, p.a, "num"); if (h) return bad(h);
        const v = varOf(env, p.a).value;
        return Number.isInteger(v) && (v % 2 === 0) === !!p.even ? ok() : bad(`${v} is not ${p.even ? "even" : "odd"}`);
      },
    },
    numPrime: {
      roles: ["num"], schema: { a: "name" },
      applicable: (s, [a]) => isPrime(s.num[a]),
      make: (s, [a]) => ({ a }),
      html: (p) => `${code(p.a)} is a prime number`,
      eval: (p, env) => {
        const h = problem(env, p.a, "num"); if (h) return bad(h);
        const v = varOf(env, p.a).value;
        return isPrime(v) ? ok() : bad(`${v} is not prime`);
      },
    },
    numMultiple: {
      roles: ["num"], schema: { a: "name", k: "int" },
      applicable: (s, [a]) => [2, 3, 4, 5, 6, 7, 9].some((k) => s.num[a] % k === 0),
      make: (s, [a]) => ({ a, k: pick([2, 3, 4, 5, 6, 7, 9].filter((k) => s.num[a] % k === 0)) }),
      html: (p) => `${code(p.a)} is a positive multiple of ${p.k}`,
      eval: (p, env) => {
        const h = problem(env, p.a, "num"); if (h) return bad(h);
        const v = varOf(env, p.a).value;
        return p.k !== 0 && v > 0 && v % p.k === 0 ? ok() : bad(`${v} is not a multiple of ${p.k}`);
      },
    },
    strLen: {
      roles: ["str"], schema: { a: "name", n: "int" },
      make: (s, [a]) => ({ a, n: s.str[a].length }),
      html: (p) => `${code(p.a)} is a string with exactly ${p.n} characters`,
      eval: (p, env) => {
        const h = problem(env, p.a, "str"); if (h) return bad(h);
        const len = varOf(env, p.a).value.length;
        return len === p.n ? ok() : bad(`it has ${len} characters, needs ${p.n}`);
      },
    },
    strPalin: {
      roles: ["str"], schema: { a: "name" },
      applicable: (s, [a]) => s.str[a].length >= 3 && s.str[a] === [...s.str[a]].reverse().join(""),
      make: (s, [a]) => ({ a }),
      html: (p) => `${code(p.a)} is a palindrome of at least 3 characters`,
      eval: (p, env) => {
        const h = problem(env, p.a, "str"); if (h) return bad(h);
        const v = varOf(env, p.a).value.toLowerCase();
        return v.length >= 3 && v === [...v].reverse().join("") ? ok() : bad("it doesn't read the same backwards");
      },
    },
    strStarts: {
      roles: ["str"], schema: { a: "name", ch: "ch" },
      make: (s, [a]) => ({ a, ch: s.str[a][0] }),
      html: (p) => `${code(p.a)} is a string that starts with ${code('"' + p.ch + '"')}`,
      eval: (p, env) => {
        const h = problem(env, p.a, "str"); if (h) return bad(h);
        const v = varOf(env, p.a).value;
        return v.length > 0 && v[0].toLowerCase() === p.ch ? ok() : bad("wrong first letter");
      },
    },
    listLen: {
      roles: ["list"], schema: { a: "name", n: "int" },
      make: (s, [a]) => ({ a, n: s.list[a].length }),
      html: (p) => `${code(p.a)} is a list of exactly ${p.n} numbers`,
      eval: (p, env) => {
        const h = problem(env, p.a, "list"); if (h) return bad(h);
        const len = varOf(env, p.a).value.length;
        return len === p.n ? ok() : bad(`needs ${p.n} items, you have ${len}`);
      },
    },
    listIncreasing: {
      roles: ["list"], schema: { a: "name" },
      applicable: (s, [a]) => s.list[a].every((x, i, l) => i === 0 || l[i - 1] < x),
      make: (s, [a]) => ({ a }),
      html: (p) => `numbers in ${code(p.a)} go strictly up, each bigger than the one before`,
      eval: (p, env) => {
        const h = problem(env, p.a, "list"); if (h) return bad(h);
        const l = varOf(env, p.a).value;
        return l.length >= 2 && l.every((x, i) => i === 0 || l[i - 1] < x) ? ok() : bad("not strictly increasing yet");
      },
    },

    // ----- rules that link variables together -----
    strLenIsNum: {
      cross: true, roles: ["str", "num"], schema: { a: "name", b: "name" },
      applicable: (s, [a, b]) => s.str[a].length === s.num[b],
      make: (s, [a, b]) => ({ a, b }),
      html: (p) => `${code(p.a)} is a string and ${code(`len(${p.a}) == ${p.b}`)}`,
      eval: (p, env) => {
        let h = problem(env, p.a, "str"); if (h) return bad(h);
        h = problem(env, p.b, "num"); if (h) return bad(h);
        const len = varOf(env, p.a).value.length, n = varOf(env, p.b).value;
        return len === n ? ok() : bad(`len is ${len} but ${p.b} is ${n}`);
      },
    },
    listSumIsNum: {
      cross: true, roles: ["list", "num"], schema: { a: "name", b: "name", n: "int", k: "int" },
      make: (s, [a, b]) => ({ a, b, n: s.list[a].length, k: sum(s.list[a]) - s.num[b] }),
      html: (p) => `${code(p.a)} is a list of ${p.n} numbers that add up to ${code(expr(p.b, p.k))}`,
      eval: (p, env) => {
        let h = problem(env, p.a, "list"); if (h) return bad(h);
        h = problem(env, p.b, "num"); if (h) return bad(h);
        const l = varOf(env, p.a).value, target = varOf(env, p.b).value + p.k;
        if (l.length !== p.n) return bad(`needs ${p.n} items, you have ${l.length}`);
        const total = sum(l);
        return total === target ? ok() : bad(`adds up to ${total}, needs ${target}`);
      },
    },
    listMaxIsNum: {
      cross: true, roles: ["list", "num"], schema: { a: "name", b: "name", k: "int" },
      make: (s, [a, b]) => ({ a, b, k: Math.max(...s.list[a]) - s.num[b] }),
      html: (p) => `the biggest number in ${code(p.a)} equals ${code(expr(p.b, p.k))}`,
      eval: (p, env) => {
        let h = problem(env, p.a, "list"); if (h) return bad(h);
        h = problem(env, p.b, "num"); if (h) return bad(h);
        const l = varOf(env, p.a).value, target = varOf(env, p.b).value + p.k;
        if (!l.length) return bad("the list is empty");
        const max = Math.max(...l);
        return max === target ? ok() : bad(`biggest is ${max}, needs ${target}`);
      },
    },
    numAboveNum: {
      cross: true, roles: ["num", "num"], schema: { a: "name", b: "name" },
      applicable: (s, [a, b]) => s.num[a] > s.num[b],
      make: (s, [a, b]) => ({ a, b }),
      html: (p) => `${code(p.a)} is bigger than ${code(p.b)}`,
      eval: (p, env) => {
        let h = problem(env, p.a, "num"); if (h) return bad(h);
        h = problem(env, p.b, "num"); if (h) return bad(h);
        const x = varOf(env, p.a).value, y = varOf(env, p.b).value;
        return x > y ? ok() : bad(`${x} is not bigger than ${y}`);
      },
    },
    numPlusNum: {
      cross: true, roles: ["num", "num"], schema: { a: "name", b: "name", k: "int" },
      applicable: (s, [a, b]) => s.num[a] !== s.num[b] && Math.abs(s.num[a] - s.num[b]) <= 20,
      make: (s, [a, b]) => ({ a, b, k: s.num[a] - s.num[b] }),
      html: (p) => `${code(p.a)} equals ${code(expr(p.b, p.k))}`,
      eval: (p, env) => {
        let h = problem(env, p.a, "num"); if (h) return bad(h);
        h = problem(env, p.b, "num"); if (h) return bad(h);
        const x = varOf(env, p.a).value, y = varOf(env, p.b).value;
        return x === y + p.k ? ok() : bad(`${p.a} is ${x}, needs ${y + p.k}`);
      },
    },

    // ----- global -----
    lineLimit: {
      roles: [], schema: { n: "int" },
      make: () => ({}),
      html: (p) => `Use at most ${code(p.n + " lines")}`,
      eval: (p, env) => {
        const used = env && typeof env.lines === "number" ? env.lines : 0;
        return used <= p.n ? ok(`${used} / ${p.n} lines used`) : bad(`${used} / ${p.n} lines used, too many`);
      },
    },
  };


  // ---------- rule factories + the bigger rule library ----------
  const V = (s, role, a) => s[role][a];
  // one variable of one type
  function un(role, schema, o) {
    return {
      roles: [role], schema, twist: false,
      applicable: o.applicable ? (s, [a]) => o.applicable(V(s, role, a), s) : undefined,
      make: (s, [a]) => Object.assign({ a }, o.make ? o.make(V(s, role, a), s) : {}),
      html: o.html,
      eval: (p, env) => {
        const h = problem(env, p.a, role); if (h) return bad(h);
        const r = o.test(varOf(env, p.a).value, p);
        return r === true ? ok() : bad(r || "not yet");
      },
    };
  }
  // two variables
  function bi(r1, r2, schema, o) {
    return {
      cross: true, roles: [r1, r2], schema,
      applicable: o.applicable ? (s, [a, b]) => o.applicable(V(s, r1, a), V(s, r2, b), s) : undefined,
      make: (s, [a, b]) => Object.assign({ a, b }, o.make ? o.make(V(s, r1, a), V(s, r2, b), s) : {}),
      html: o.html,
      eval: (p, env) => {
        let h = problem(env, p.a, r1); if (h) return bad(h);
        h = problem(env, p.b, r2); if (h) return bad(h);
        const r = o.test(varOf(env, p.a).value, varOf(env, p.b).value, p);
        return r === true ? ok() : bad(r || "not yet");
      },
    };
  }
  const N = { a: "name" };
  const withN = (extra) => Object.assign({}, N, extra);
  const NN = { a: "name", b: "name" };
  const withNN = (extra) => Object.assign({}, NN, extra);
  const TRUE_WORD = (t) => (t ? "True" : "False");
  const divPairs = (v) => { const out = []; if (v <= 0) return out; for (const k of [2, 3, 4, 5, 6, 7]) for (const m of [2, 3, 4, 5, 6, 7]) if (k < m && v % k === 0 && v % m === 0) out.push([k, m]); return out; };

  Object.assign(RULES, {
    // ----- numbers -----
    numSquare: un("num", N, { applicable: (v) => isSquare(v) && v >= 4, html: (p) => `${code(p.a)} is a perfect square (like 4, 9, 16)`, test: (v) => isSquare(v) || `${v} is not a perfect square` }),
    numTwoDivs: un("num", withN({ k: "int", m: "int" }), {
      applicable: (v) => divPairs(v).length > 0,
      make: (v) => { const [k, m] = pick(divPairs(v)); return { k, m }; },
      html: (p) => `${code(p.a)} is divisible by both ${p.k} and ${p.m}`,
      test: (v, p) => (v > 0 && v % p.k === 0 && v % p.m === 0) || `${v} is not divisible by both ${p.k} and ${p.m}`,
    }),
    numDigits: un("num", withN({ n: "int" }), { applicable: (v) => v >= 10, make: (v) => ({ n: String(v).length }), html: (p) => `${code(p.a)} has exactly ${p.n} digits`, test: (v, p) => (Number.isInteger(v) && String(Math.abs(v)).length === p.n) || `${v} doesn't have ${p.n} digits` }),
    numDigitSum: un("num", withN({ n: "int" }), { applicable: (v) => v >= 10, make: (v) => ({ n: digitSum(v) }), html: (p) => `the digits of ${code(p.a)} add up to ${p.n}`, test: (v, p) => (Number.isInteger(v) && digitSum(v) === p.n) || `the digits of ${v} add up to ${digitSum(v)}` }),
    numMod: un("num", withN({ m: "int", r: "int" }), {
      make: (v) => { const m = pick([3, 4, 5, 6, 7]); return { m, r: v % m }; },
      html: (p) => `dividing ${code(p.a)} by ${p.m} leaves a remainder of ${p.r}`,
      test: (v, p) => (Number.isInteger(v) && v % p.m === p.r) || `${v} leaves ${v % p.m} when divided by ${p.m}`,
    }),
    numAtLeast: un("num", withN({ n: "int" }), { make: (v) => ({ n: v - rngInt(0, 4) }), html: (p) => `${code(p.a)} is at least ${p.n}`, test: (v, p) => v >= p.n || `${v} is below ${p.n}` }),
    numAtMost: un("num", withN({ n: "int" }), { make: (v) => ({ n: v + rngInt(0, 4) }), html: (p) => `${code(p.a)} is at most ${p.n}`, test: (v, p) => v <= p.n || `${v} is above ${p.n}` }),
    numNotMultiple: un("num", withN({ k: "int" }), {
      applicable: (v) => v > 1 && [2, 3, 4, 5, 6, 7].some((k) => v % k !== 0),
      make: (v) => ({ k: pick([2, 3, 4, 5, 6, 7].filter((k) => v % k !== 0)) }),
      html: (p) => `${code(p.a)} is not divisible by ${p.k}`,
      test: (v, p) => v % p.k !== 0 || `${v} is divisible by ${p.k}`,
    }),
    numEvenAbove: un("num", withN({ n: "int" }), { applicable: (v) => v % 2 === 0 && v > 2, make: (v) => ({ n: v - rngInt(1, 5) }), html: (p) => `${code(p.a)} is an even number above ${p.n}`, test: (v, p) => (v % 2 === 0 && v > p.n) || `${v} must be even and above ${p.n}` }),
    numCloser: un("num", withN({ x: "int", y: "int" }), {
      make: (v) => { const x = v + rngInt(-2, 2); const y = x + (rngInt(0, 1) ? 1 : -1) * rngInt(6, 10); return { x, y }; },
      applicable: () => true,
      html: (p) => `${code(p.a)} is closer to ${p.x} than to ${p.y}`,
      test: (v, p) => Math.abs(v - p.x) < Math.abs(v - p.y) || `${v} is not closer to ${p.x} than to ${p.y}`,
    }),
    numDouble: un("num", withN({ n: "int" }), { applicable: (v) => v <= 40, make: (v) => ({ n: v * 2 }), html: (p) => `twice ${code(p.a)} equals ${p.n}`, test: (v, p) => v * 2 === p.n || `twice ${v} is ${v * 2}` }),
    numSquared: un("num", withN({ n: "int" }), { applicable: (v) => v <= 20, make: (v) => ({ n: v * v }), html: (p) => `${code(p.a)} times itself equals ${p.n}`, test: (v, p) => v * v === p.n || `${v} times itself is ${v * v}` }),

    // ----- strings -----
    strEnds: un("str", withN({ ch: "ch" }), { make: (v) => ({ ch: v[v.length - 1] }), html: (p) => `${code(p.a)} is a string that ends with ${code('"' + p.ch + '"')}`, test: (v, p) => (v.length > 0 && v[v.length - 1].toLowerCase() === p.ch) || "wrong last letter" }),
    strContains: un("str", withN({ ch: "ch" }), { make: (v) => ({ ch: pick([...v]) }), html: (p) => `${code(p.a)} contains the letter ${code('"' + p.ch + '"')}`, test: (v, p) => v.toLowerCase().includes(p.ch) || `no ${p.ch} in it yet` }),
    strVowels: un("str", withN({ n: "int" }), { make: (v) => ({ n: vowelCount(v) }), html: (p) => `${code(p.a)} has exactly ${p.n} vowels (a, e, i, o, u)`, test: (v, p) => vowelCount(v) === p.n || `it has ${vowelCount(v)} vowels, needs ${p.n}` }),
    strConsonants: un("str", withN({ n: "int" }), { make: (v) => ({ n: v.length - vowelCount(v) }), html: (p) => `${code(p.a)} has exactly ${p.n} consonants`, test: (v, p) => (/^[a-z]+$/i.test(v) && v.length - vowelCount(v) === p.n) || `it has ${v.length - vowelCount(v)} consonants, needs ${p.n}` }),
    strNoRepeat: un("str", N, { applicable: (v) => new Set(v).size === v.length, html: (p) => `no letter appears twice in ${code(p.a)}`, test: (v) => (v.length > 0 && new Set(v.toLowerCase()).size === v.length) || "a letter repeats" }),
    strSameEnds: un("str", N, { applicable: (v) => v.length >= 3 && v[0] === v[v.length - 1], html: (p) => `${code(p.a)} starts and ends with the same letter`, test: (v) => (v.length >= 3 && v[0].toLowerCase() === v[v.length - 1].toLowerCase()) || "first and last letters differ" }),
    strAtLeast: un("str", withN({ n: "int" }), { make: (v) => ({ n: v.length - rngInt(0, 2) }), html: (p) => `${code(p.a)} is a string with at least ${p.n} characters`, test: (v, p) => v.length >= p.n || `${v.length} characters is too short` }),
    strAtMost: un("str", withN({ n: "int" }), { make: (v) => ({ n: v.length + rngInt(0, 2) }), html: (p) => `${code(p.a)} is a string with at most ${p.n} characters`, test: (v, p) => v.length <= p.n || `${v.length} characters is too long` }),
    strNth: un("str", withN({ ch: "ch", i: "int" }), {
      make: (v) => { const i = rngInt(1, v.length); return { ch: v[i - 1], i }; },
      html: (p) => `character number ${p.i} of ${code(p.a)} is ${code('"' + p.ch + '"')}`,
      test: (v, p) => (v.length >= p.i && v[p.i - 1].toLowerCase() === p.ch) || `character ${p.i} is wrong`,
    }),
    strBefore: un("str", withN({ ch: "ch" }), {
      applicable: (v) => v.charCodeAt(0) <= 119,
      make: (v) => ({ ch: String.fromCharCode(v.charCodeAt(0) + rngInt(1, 3)) }),
      html: (p) => `${code(p.a)} comes before ${code('"' + p.ch + '"')} in alphabetical order`,
      test: (v, p) => (v.length > 0 && v.toLowerCase() < p.ch) || "it doesn't come before that letter",
    }),

    // ----- lists -----
    listAllEven: un("list", N, { applicable: (v) => v.every((x) => x % 2 === 0), html: (p) => `every number in ${code(p.a)} is even`, test: (v) => (v.length > 0 && v.every((x) => x % 2 === 0)) || "an odd number is in there" }),
    listAllOdd: un("list", N, { applicable: (v) => v.every((x) => x % 2 !== 0), html: (p) => `every number in ${code(p.a)} is odd`, test: (v) => (v.length > 0 && v.every((x) => x % 2 !== 0)) || "an even number is in there" }),
    listHas: un("list", withN({ n: "int" }), { make: (v) => ({ n: pick(v) }), html: (p) => `${code(p.a)} contains the number ${p.n}`, test: (v, p) => v.includes(p.n) || `${p.n} isn't in it yet` }),
    listMin: un("list", withN({ n: "int" }), { make: (v) => ({ n: Math.min(...v) }), html: (p) => `the smallest number in ${code(p.a)} is ${p.n}`, test: (v, p) => (v.length > 0 && Math.min(...v) === p.n) || "the smallest number is wrong" }),
    listFirstLast: un("list", withN({ n: "int" }), { make: (v) => ({ n: v[0] + v[v.length - 1] }), html: (p) => `the first and last numbers of ${code(p.a)} add up to ${p.n}`, test: (v, p) => (v.length >= 2 && v[0] + v[v.length - 1] === p.n) || "first + last doesn't match" }),
    listSumIs: un("list", withN({ n: "int", c: "int" }), { make: (v) => ({ n: sum(v), c: v.length }), html: (p) => `${code(p.a)} is a list of ${p.c} numbers that add up to ${p.n}`, test: (v, p) => (v.length === p.c && sum(v) === p.n) || `needs ${p.c} numbers adding up to ${p.n}` }),
    listDecreasing: un("list", N, { applicable: (v) => v.length >= 2 && v.every((x, i) => i === 0 || v[i - 1] > x), html: (p) => `numbers in ${code(p.a)} go strictly down, each smaller than the one before`, test: (v) => (v.length >= 2 && v.every((x, i) => i === 0 || v[i - 1] > x)) || "not strictly decreasing yet" }),
    listUnique: un("list", N, { html: (p) => `no number is repeated in ${code(p.a)}`, test: (v) => (v.length >= 2 && new Set(v).size === v.length) || "a number repeats" }),
    listBelow: un("list", withN({ n: "int" }), { make: (v) => ({ n: Math.max(...v) + rngInt(1, 3) }), html: (p) => `every number in ${code(p.a)} is below ${p.n}`, test: (v, p) => (v.length > 0 && v.every((x) => x < p.n)) || `a number is ${p.n} or more` }),
    listSpread: un("list", withN({ n: "int" }), { make: (v) => ({ n: Math.max(...v) - Math.min(...v) }), html: (p) => `the biggest number in ${code(p.a)} minus the smallest is ${p.n}`, test: (v, p) => (v.length > 0 && Math.max(...v) - Math.min(...v) === p.n) || "the gap between biggest and smallest is off" }),
    listSecond: un("list", withN({ n: "int" }), { make: (v) => ({ n: v[1] }), html: (p) => `the second number in ${code(p.a)} is ${p.n}`, test: (v, p) => (v.length >= 2 && v[1] === p.n) || "the second number is wrong" }),
    listEvens: un("list", withN({ n: "int" }), { make: (v) => ({ n: v.filter((x) => x % 2 === 0).length }), html: (p) => `${code(p.a)} has exactly ${p.n} even numbers`, test: (v, p) => v.filter((x) => x % 2 === 0).length === p.n || `it has ${v.filter((x) => x % 2 === 0).length} even numbers, needs ${p.n}` }),

    // ----- True / False -----
    boolIs: un("bool", withN({ t: "bool" }), { make: (v) => ({ t: v ? 1 : 0 }), html: (p) => `${code(p.a)} is ${code(TRUE_WORD(p.t))}`, test: (v, p) => v === !!p.t || `${p.a} should be ${TRUE_WORD(p.t)}` }),

    // ----- linking rules -----
    strLenOffset: bi("str", "num", withNN({ k: "int" }), {
      applicable: (a, b) => a.length !== b && Math.abs(a.length - b) <= 6,
      make: (a, b) => ({ k: a.length - b }),
      html: (p) => `the length of ${code(p.a)} equals ${code(expr(p.b, p.k))}`,
      test: (x, y, p) => x.length === y + p.k || `length is ${x.length}, needs ${y + p.k}`,
    }),
    numAtMostLen: bi("num", "str", NN, { applicable: (a, b) => a <= b.length, html: (p) => `${code(p.a)} is at most the length of ${code(p.b)}`, test: (x, y) => x <= y.length || `${x} is longer than the string` }),
    numDiff: bi("num", "num", withNN({ n: "int" }), { applicable: (a, b) => a !== b, make: (a, b) => ({ n: Math.abs(a - b) }), html: (p) => `the difference between ${code(p.a)} and ${code(p.b)} is exactly ${p.n}`, test: (x, y, p) => Math.abs(x - y) === p.n || `the difference is ${Math.abs(x - y)}` }),
    numSumIs: bi("num", "num", withNN({ n: "int" }), { applicable: (a, b) => a !== b, make: (a, b) => ({ n: a + b }), html: (p) => `${code(p.a)} + ${code(p.b)} equals ${p.n}`, test: (x, y, p) => x + y === p.n || `they add up to ${x + y}` }),
    numProd: bi("num", "num", withNN({ n: "int" }), { applicable: (a, b) => a !== b && a * b <= 500, make: (a, b) => ({ n: a * b }), html: (p) => `${code(p.a)} times ${code(p.b)} equals ${p.n}`, test: (x, y, p) => x * y === p.n || `they multiply to ${x * y}` }),
    numTwice: bi("num", "num", NN, { applicable: (a, b) => a === 2 * b, html: (p) => `${code(p.a)} is exactly twice ${code(p.b)}`, test: (x, y) => x === 2 * y || `${x} is not twice ${y}` }),
    numSameParity: bi("num", "num", NN, { applicable: (a, b) => a !== b && a % 2 === b % 2, html: (p) => `${code(p.a)} and ${code(p.b)} are both even or both odd`, test: (x, y) => x % 2 === y % 2 || "one is even, one is odd" }),
    numDiffParity: bi("num", "num", NN, { applicable: (a, b) => a % 2 !== b % 2, html: (p) => `one of ${code(p.a)} and ${code(p.b)} is even and the other is odd`, test: (x, y) => x % 2 !== y % 2 || "they are both even or both odd" }),
    numBigger: bi("num", "num", withNN({ n: "int" }), { applicable: (a, b) => a !== b, make: (a, b) => ({ n: Math.max(a, b) }), html: (p) => `the bigger of ${code(p.a)} and ${code(p.b)} is ${p.n}`, test: (x, y, p) => Math.max(x, y) === p.n || `the bigger one is ${Math.max(x, y)}` }),
    numMultipleOfNum: bi("num", "num", NN, { applicable: (a, b) => b > 1 && a !== b && a % b === 0, html: (p) => `${code(p.a)} is a multiple of ${code(p.b)}`, test: (x, y) => (y > 0 && x % y === 0) || `${x} is not a multiple of ${y}` }),
    listLenIsNum: bi("list", "num", NN, { applicable: (a, b) => a.length === b, html: (p) => `${code(p.a)} is a list with exactly ${code(p.b)} numbers`, test: (x, y) => x.length === y || `it has ${x.length} numbers, needs ${y}` }),
    listHasNum: bi("list", "num", NN, { applicable: (a, b) => a.includes(b), html: (p) => `the number ${code(p.b)} is one of the numbers in ${code(p.a)}`, test: (x, y) => x.includes(y) || `${y} isn't in the list` }),
    listMinIsNum: bi("list", "num", withNN({ k: "int" }), { make: (a, b) => ({ k: Math.min(...a) - b }), html: (p) => `the smallest number in ${code(p.a)} equals ${code(expr(p.b, p.k))}`, test: (x, y, p) => (x.length > 0 && Math.min(...x) === y + p.k) || `smallest is ${x.length ? Math.min(...x) : "missing"}, needs ${y + p.k}` }),
    boolFromNum: bi("bool", "num", withNN({ k: "int" }), {
      make: (a, b) => ({ k: a ? b - rngInt(1, 3) : b + rngInt(0, 3) }),
      html: (p) => `${code(p.a)} equals ${code(`${p.b} > ${p.k}`)}, so it is True only when ${code(p.b)} is bigger than ${p.k}`,
      test: (x, y, p) => x === y > p.k || `${p.a} should be ${TRUE_WORD(y > p.k)}`,
    }),
    boolFromStr: bi("bool", "str", withNN({ k: "int" }), {
      make: (a, b) => ({ k: a ? b.length - rngInt(1, 2) : b.length + rngInt(0, 2) }),
      html: (p) => `${code(p.a)} is True exactly when ${code(p.b)} has more than ${p.k} characters`,
      test: (x, y, p) => x === y.length > p.k || `${p.a} should be ${TRUE_WORD(y.length > p.k)}`,
    }),
    boolFromList: bi("bool", "list", withNN({ k: "int" }), {
      make: (a, b) => ({ k: a ? sum(b) - rngInt(1, 5) : sum(b) + rngInt(0, 5) }),
      html: (p) => `${code(p.a)} is True exactly when the numbers in ${code(p.b)} add up to more than ${p.k}`,
      test: (x, y, p) => x === sum(y) > p.k || `${p.a} should be ${TRUE_WORD(sum(y) > p.k)}`,
    }),

    // ----- twists: extra constraints that change how you write the code, not what it holds -----
    forbidName: {
      roles: [], twist: true, schema: { n: "fname" },
      make: (s) => ({ n: pick([...ALL_NAMES].filter((n) => !s.order.includes(n))) }),
      html: (p) => `Never use the variable name ${code(p.n)}`,
      eval: (p, env) => (varOf(env, p.n) ? bad(`${p.n} is not allowed`) : ok()),
    },
    exactVars: {
      roles: [], twist: true, schema: { n: "int" },
      make: (s) => ({ n: s.order.length }),
      html: (p) => `Define exactly ${code(p.n + " variables")}`,
      eval: (p, env) => {
        const have = env && env.vars ? Object.keys(env.vars).length : 0;
        return have === p.n ? ok() : bad(`${have} variables so far, needs ${p.n}`);
      },
    },
  });

  RULES.firstLine = {
    roles: [], twist: true, schema: { n: "name" },
    make: (s) => ({ n: s.order[0] }),
    html: (p) => `The first line of your code defines ${code(p.n)}`,
    eval: (p, env) => {
      const v = varOf(env, p.n);
      if (!v) return bad(`${p.n} isn't defined yet`);
      return v.line === 1 ? ok() : bad(`${p.n} should be on the first line`);
    },
  };

  const FIELD_CHECK = {
    fname: (v) => typeof v === "string" && ALL_NAMES.has(v),
    name: (v) => typeof v === "string" && ALL_NAMES.has(v),
    int: (v) => Number.isInteger(v) && Math.abs(v) <= 1000,
    bool: (v) => v === 0 || v === 1,
    ch: (v) => typeof v === "string" && /^[a-z]$/.test(v),
  };
  // only known keys, only whitelisted values. Anything else is dropped (or rejected).
  function cleanParams(key, raw) {
    const def = RULES[key];
    if (!def || !raw || typeof raw !== "object") return null;
    const out = {};
    for (const [field, kind] of Object.entries(def.schema)) {
      const v = raw[field];
      if (!FIELD_CHECK[kind](v)) return null;
      out[field] = v;
    }
    return out;
  }
  function varsOfParams(key, p) {
    return Object.entries(RULES[key].schema).filter(([, kind]) => kind === "name").map(([f]) => p[f]);
  }

  // ---------- difficulty ----------
  // rules: how many rules besides the line limit; cross: at least this many linking rules
  // lineSlack: line limit = number of variables + slack (null = no limit)
  const DIFFICULTY = {
    // boolChance: how often a True/False variable joins the task (it adds one extra rule)
    easy: { nums: 1, strs: 1, lists: 0, rules: 2, cross: 1, lineSlack: null, boolChance: 0, twistChance: 0 },
    medium: { nums: 1, strs: 1, lists: 1, rules: 3, cross: 2, lineSlack: 1, boolChance: 0.35, twistChance: 0.3 },
    hard: { nums: 2, strs: 1, lists: 1, rules: 4, cross: 3, lineSlack: 0, boolChance: 0.6, twistChance: 0.45 },
    // bite speed for the bug: how long the appetite meter takes to fill (ms)
  };
  const BUG_MS = { easy: 18000, medium: 13000, hard: 9500 };

  // ---------- building a task ----------
  function buildReference(cfg) {
    const strNames = uniqueSample(STR_NAMES, cfg.strs);
    const numNames = uniqueSample(NUM_NAMES, cfg.nums);
    const listNames = uniqueSample(LIST_NAMES, cfg.lists);
    const s = { num: {}, str: {}, list: {}, bool: {}, order: [] };
    strNames.forEach((n, i) => { s.str[n] = i === 0 && rngInt(0, 2) === 0 ? pick(PALINDROMES) : pick(WORDS); });
    numNames.forEach((n, i) => {
      // the first number matches the first string's length, so len(str) == num is available as a rule
      s.num[n] = i === 0 && strNames.length ? s.str[strNames[0]].length : rngInt(2, 20);
    });
    if (numNames.length > 1) while (s.num[numNames[1]] === s.num[numNames[0]]) s.num[numNames[1]] = rngInt(2, 20);
    listNames.forEach((n) => {
      const len = rngInt(3, 4), set = new Set();
      while (set.size < len) set.add(rngInt(1, 12));
      const asc = [...set].sort((x, y) => x - y);
      s.list[n] = rngInt(0, 3) === 0 ? asc.reverse() : asc; // one in four lists is written biggest-first
    });
    if (cfg.boolChance && Math.random() < cfg.boolChance) {
      const b = pick(BOOL_NAMES);
      s.bool[b] = rngInt(0, 1) === 1;
    }
    s.order = [...numNames, ...strNames, ...listNames, ...Object.keys(s.bool)];
    return s;
  }

  function solutionCode(s) {
    return s.order.map((n) => {
      if (n in s.num) return `${n} = ${s.num[n]}`;
      if (n in s.str) return `${n} = "${s.str[n]}"`;
      if (n in s.bool) return `${n} = ${s.bool[n] ? "True" : "False"}`;
      return `${n} = [${s.list[n].join(", ")}]`;
    }).join("\n");
  }

  function candidates(s) {
    const pools = { num: Object.keys(s.num), str: Object.keys(s.str), list: Object.keys(s.list), bool: Object.keys(s.bool) };
    const out = [];
    for (const [key, def] of Object.entries(RULES)) {
      if (!def.roles.length) continue;
      const bind = (i, acc) => {
        if (i === def.roles.length) {
          if (!def.applicable || def.applicable(s, acc)) out.push({ key, params: def.make(s, acc), vars: acc.slice() });
          return;
        }
        for (const name of pools[def.roles[i]]) if (!acc.includes(name)) bind(i + 1, [...acc, name]);
      };
      bind(0, []);
    }
    return out;
  }

  function choose(cands, cfg, allVars, want) {
    for (let attempt = 0; attempt < 250; attempt++) {
      const picked = shuffle(cands.slice()).slice(0, want);
      if (picked.length < want) return null;
      const keys = new Set(picked.map((c) => c.key + ":" + c.vars.join(",")));
      if (keys.size !== picked.length) continue;
      if (picked.filter((c) => RULES[c.key].cross).length < Math.min(cfg.cross, cfg.rules)) continue;
      const covered = new Set(picked.flatMap((c) => c.vars));
      if (!allVars.every((v) => covered.has(v))) continue;
      return picked;
    }
    return null;
  }

  function makeRule(key, params) {
    const def = RULES[key];
    return {
      key, params,
      html: def.html(params),
      vars: varsOfParams(key, params),
      evaluate: (env) => def.eval(params, env),
      validate: (env) => def.eval(params, env).ok,
    };
  }

  function assemble(id, difficulty, rules, extra) {
    const task = {
      id, difficulty, rules,
      vars: [...new Set(rules.flatMap((r) => r.vars))],
      checkAll(env) { return this.rules.every((r) => r.validate(env)); },
      evaluate(env) {
        const results = this.rules.map((r) => r.evaluate(env));
        return { results, passed: results.filter((r) => r.ok).length, total: results.length };
      },
    };
    return Object.assign(task, extra || {});
  }

  let lastSignature = "";
  // seeded = true: the daily challenge (Math.random is replaced by a seeded one)
  function generateTask(difficulty, seeded) {
    const diff = DIFFICULTY[difficulty] ? difficulty : "easy";
    const cfg = DIFFICULTY[diff];
    let s, picked, tries = 0;
    do {
      s = buildReference(cfg);
      picked = choose(candidates(s), cfg, s.order, cfg.rules + Object.keys(s.bool).length);
      tries++;
      if (picked && !seeded && tries < 20) {
        const sig = picked.map((c) => c.key + c.vars.join("")).sort().join("|");
        if (sig === lastSignature) picked = null;
        else lastSignature = sig;
      }
    } while (!picked && tries < 200);
    if (!picked) throw new Error("couldn't build a task");

    const rules = picked.map((c) => makeRule(c.key, c.params));
    if (cfg.lineSlack !== null) rules.push(makeRule("lineLimit", { n: s.order.length + cfg.lineSlack }));
    // sometimes a twist: a rule about HOW you write the code (a banned name, a variable count, what goes first)
    if (cfg.twistChance && Math.random() < cfg.twistChance) {
      const key = pick(Object.keys(RULES).filter((k) => RULES[k].twist));
      rules.push(makeRule(key, RULES[key].make(s)));
    }
    return assemble(`${diff}-${Date.now()}-${rngInt(1000, 9999)}`, diff, rules, { solution: solutionCode(s) });
  }

  // a task that came from the network (multiplayer room): never trust it
  function rebuildTask(plain) {
    if (!plain || typeof plain !== "object") throw new Error("bad task");
    const diff = DIFFICULTY[plain.difficulty] ? plain.difficulty : null;
    if (!diff || !Array.isArray(plain.rules) || plain.rules.length === 0 || plain.rules.length > 8) throw new Error("bad task");
    const id = typeof plain.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(plain.id) ? plain.id : `${diff}-${Date.now()}`;
    const rules = plain.rules.map((r) => {
      const key = r && typeof r.key === "string" && Object.prototype.hasOwnProperty.call(RULES, r.key) ? r.key : null;
      const params = key && cleanParams(key, r.params);
      if (!params) throw new Error("bad rule");
      return makeRule(key, params);
    });
    return assemble(id, diff, rules);
  }

  // what goes over the network: keys and params only, no text, no solution
  function serializeTask(task) {
    return { id: task.id, difficulty: task.difficulty, rules: task.rules.map((r) => ({ key: r.key, params: r.params })) };
  }

  const api = {
    generateTask, rebuildTask, serializeTask,
    DIFFICULTY: Object.keys(DIFFICULTY), BUG_MS,
    _internal: { RULES, solutionCode, esc },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TaskEngine = api;
})(typeof window !== "undefined" ? window : globalThis);
