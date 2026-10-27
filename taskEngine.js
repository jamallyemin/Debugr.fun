(function (root) {
  const WORD_BANK = [
    "echo", "delta", "orbit", "cipher", "quartz", "vector", "flux", "nova",
    "prism", "raven", "shard", "onyx", "tundra", "ember", "glyph", "haze",
    "lumen", "gale", "krypt", "mirth", "nexus", "oxide", "pylon", "quill",
    "riptide", "sable", "trace", "umbra", "vex", "wisp", "yarrow", "zenith"
  ];
  const PALINDROME_WORDS = ["level", "radar", "civic", "kayak", "rotor", "deed", "noon", "refer"];

  function rngInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[rngInt(0, arr.length - 1)]; }
  function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  }
  function uniqueSample(arr, n) {
    const pool = [...arr];
    const out = [];
    while (out.length < n && pool.length) {
      out.push(pool.splice(rngInt(0, pool.length - 1), 1)[0]);
    }
    return out;
  }

  const DIFFICULTY = {
    easy: { varNames: 2, numbers: 1, strings: 1, list: 0, ruleCount: 1 },
    medium: { varNames: 3, numbers: 2, strings: 1, list: 1, ruleCount: 3 },
    hard: { varNames: 5, numbers: 2, strings: 2, list: 1, ruleCount: 5 },
  };

  function buildReferenceSolution(diff) {
    const cfg = DIFFICULTY[diff];

    const rawNames = uniqueSample(WORD_BANK, cfg.varNames);
    const names = [];
    for (let i = 0; i < rawNames.length; i++) {
      names.push(i === 0 ? rawNames[i] : rawNames[i] + (rngInt(0, 1) ? "x" : ""));
    }

    const numbers = [];
    for (let i = 0; i < cfg.numbers; i++) numbers.push(rngInt(1, 40));
    if (cfg.numbers >= 1 && rngInt(0, 2) === 0) {
      let p = rngInt(2, 40);
      while (!isPrime(p)) p++;
      numbers[0] = p;
    }

    const strings = [];
    for (let i = 0; i < cfg.strings; i++) {
      strings.push(i === 0 && rngInt(0, 1) === 0 ? pick(PALINDROME_WORDS) : pick(WORD_BANK));
    }

    let list = [];
    if (cfg.list > 0) {
      const len = rngInt(3, 5);
      const nums = new Set();
      while (nums.size < len) nums.add(rngInt(1, 50));
      list = [...nums].sort((a, b) => a - b);
    }

    return { names, numbers, strings, list };
  }
  const RULE_DEFS = {
    sumEquals: {
      applicable: (sol) => sol.numbers.length > 0,
      paramsFromSolution: (sol) => ({ target: sol.numbers.reduce((a, b) => a + b, 0) }),
      text: (p) => `Your numeric variables must sum to exactly ${p.target}.`,
      validate: (p) => (v) => v.numbers.reduce((a, b) => a + b, 0) === p.target,
    },
    oneIsPrime: {
      applicable: (sol) => sol.numbers.length > 0,
      paramsFromSolution: () => ({}),
      text: () => `At least one of your numbers must be prime.`,
      validate: () => (v) => v.numbers.some(isPrime),
    },
    stringLengthSum: {
      applicable: (sol) => sol.strings.length > 0,
      paramsFromSolution: (sol) => ({ target: sol.strings.reduce((a, s) => a + s.length, 0) }),
      text: (p) => `The combined length of your string variables must equal ${p.target}.`,
      validate: (p) => (v) => v.strings.reduce((a, s) => a + s.length, 0) === p.target,
    },
    hasPalindrome: {
      applicable: (sol) => sol.strings.length > 0,
      paramsFromSolution: () => ({}),
      text: () => `At least one string variable must be a palindrome.`,
      validate: () => (v) => v.strings.some((s) => s.toLowerCase() === s.toLowerCase().split("").reverse().join("")),
    },
    nameTotalLength: {
      applicable: (sol) => sol.names.length > 0,
      paramsFromSolution: (sol) => ({ target: sol.names.reduce((a, n) => a + n.length, 0) }),
      text: (p) => `The total length of all your variable names must equal ${p.target}.`,
      validate: (p) => (v) => v.names.reduce((a, n) => a + n.length, 0) === p.target,
    },
    uniqueStartLetters: {
      applicable: (sol) => sol.names.length > 0,
      paramsFromSolution: () => ({}),
      text: () => `Every variable name must start with a different letter.`,
      validate: () => (v) => new Set(v.names.map((n) => n[0]?.toLowerCase())).size === v.names.length,
    },
    exactNameLength: {
      applicable: (sol) => sol.names.length > 0,
      paramsFromSolution: (sol) => ({ target: sol.names[0].length }),
      text: (p) => `At least one variable name must be exactly ${p.target} characters long.`,
      validate: (p) => (v) => v.names.some((n) => n.length === p.target),
    },
    noVowelsInName: {
      applicable: (sol) => sol.names.length > 0,
      paramsFromSolution: () => ({}),
      text: () => `At least one variable name must contain no vowels (a, e, i, o, u).`,
      validate: () => (v) => v.names.some((n) => !/[aeiou]/i.test(n)),
    },
    listExactCount: {
      applicable: (sol) => sol.list.length > 0,
      paramsFromSolution: (sol) => ({ target: sol.list.length }),
      text: (p) => `At least one list must contain exactly ${p.target} items.`,
      validate: (p) => (v) => v.list.some((l) => Array.isArray(l) && l.length === p.target),
    },
    listSorted: {
      applicable: (sol) => sol.list.length > 0,
      paramsFromSolution: () => ({}),
      text: () => `At least one list must be sorted in ascending order.`,
      validate: () => (v) => v.list.some((l) => Array.isArray(l) && l.every((x, i) => i === 0 || l[i - 1] <= x)),
    },
    listUnique: {
      applicable: (sol) => sol.list.length > 0,
      paramsFromSolution: () => ({}),
      text: () => `At least one list must contain only unique values.`,
      validate: () => (v) => v.list.some((l) => Array.isArray(l) && new Set(l).size === l.length),
    },
  };

  function buildRule(key, params) {
    const def = RULE_DEFS[key];
    return { key, params, text: def.text(params), validate: def.validate(params) };
  }
  const history = { easy: new Set(), medium: new Set(), hard: new Set() };

  // seeded = true skips the history so the daily gets the same task for everyone
  function generateTask(difficulty, seeded) {
    const diff = DIFFICULTY[difficulty] ? difficulty : "easy";
    const cfg = DIFFICULTY[diff];

    let keys, signature, attempts = 0, sol;
    do {
      sol = buildReferenceSolution(diff);
      const pool = [];
      for (const k of Object.keys(RULE_DEFS)) {
        if (RULE_DEFS[k].applicable(sol)) pool.push(k);
      }
      keys = uniqueSample(pool, Math.min(cfg.ruleCount, pool.length));
      signature = keys.slice().sort().join("|");
      attempts++;
    } while (!seeded && history[diff].has(signature) && attempts < 25);

    if (!seeded) {
      history[diff].add(signature);
      if (history[diff].size > 500) history[diff].clear();
    }

    const rules = [];
    for (const k of keys) rules.push(buildRule(k, RULE_DEFS[k].paramsFromSolution(sol)));

    return {
      id: `${diff}-${Date.now()}-${rngInt(1000, 9999)}`,
      difficulty: diff,
      rules,
      checkAll(parsedVars) { return this.rules.every((r) => r.validate(parsedVars)); },
    };
  }
  function rebuildTask(plain) {
    const rules = [];
    for (const r of plain.rules) rules.push(buildRule(r.key, r.params));
    return {
      id: plain.id,
      difficulty: plain.difficulty,
      rules,
      checkAll(parsedVars) { return this.rules.every((r) => r.validate(parsedVars)); },
    };
  }

  function serializeTask(task) {
    const rules = [];
    for (const r of task.rules) rules.push({ key: r.key, params: r.params, text: r.text });
    return { id: task.id, difficulty: task.difficulty, rules };
  }

  const api = { generateTask, rebuildTask, serializeTask, DIFFICULTY: Object.keys(DIFFICULTY) };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TaskEngine = api;
})(typeof window !== "undefined" ? window : globalThis);