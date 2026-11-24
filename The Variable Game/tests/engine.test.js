// run with: node tests/engine.test.js   (no dependencies)
"use strict";
const assert = require("assert");
const path = require("path");
const TE = require(path.join(__dirname, "..", "taskEngine.js"));
const P = require(path.join(__dirname, "..", "parser.js"));

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("FAIL  " + name + "\n      " + (e && e.stack || e)); process.exitCode = 1; }
}

// ---------- parser ----------
test("parser reads numbers, strings and lists", () => {
  const r = P.parseProgram(`age = 6\nname = "quartz"\nscores = [3, 8, 11]\nneg = -2.5`);
  assert.strictEqual(r.vars.age.value, 6);
  assert.strictEqual(r.vars.name.value, "quartz");
  assert.deepStrictEqual(r.vars.scores.value, [3, 8, 11]);
  assert.strictEqual(r.vars.neg.value, -2.5);
  assert.strictEqual(r.lines, 4);
  assert.strictEqual(r.errors, 0);
});
test("parser ignores comments and blank lines when counting", () => {
  const r = P.parseProgram(`# hi\n\nage = 6   # trailing\n\nname = "a#b"`);
  assert.strictEqual(r.lines, 2);
  assert.strictEqual(r.vars.name.value, "a#b");
});
test("parser handles multi-line lists and counts each line", () => {
  const r = P.parseProgram(`scores = [1,\n  2,\n  3]`);
  assert.deepStrictEqual(r.vars.scores.value, [1, 2, 3]);
  assert.strictEqual(r.lines, 3);
});
test("parser: last assignment wins, == is not an assignment", () => {
  const r = P.parseProgram(`a = 1\na = 2\nb == 3`);
  assert.strictEqual(r.vars.a.value, 2);
  assert.strictEqual(r.vars.b, undefined);
  assert.strictEqual(r.errors, 1);
});
test("parser is safe with weird names (no prototype pollution)", () => {
  const r = P.parseProgram(`constructor = 1\n__proto__ = 2`);
  assert.strictEqual(Object.getPrototypeOf(r.vars), null);
  assert.strictEqual({}.polluted, undefined);
});
test("parser keeps going after a bad line", () => {
  const r = P.parseProgram(`x = = 3\nage = 6`);
  assert.strictEqual(r.vars.age.value, 6);
  assert.strictEqual(r.errors, 1);
});

// ---------- engine ----------
const N = 4000;
for (const d of TE.DIFFICULTY) {
  test(`${d}: the reference solution always passes every rule (${N} tasks)`, () => {
    for (let i = 0; i < N; i++) {
      const t = TE.generateTask(d);
      const env = P.parseProgram(t.solution);
      const ev = t.evaluate(env);
      assert.ok(t.checkAll(env), `solution failed:\n${t.solution}\n${JSON.stringify(ev.results)}\n${t.rules.map((r) => r.html).join("\n")}`);
    }
  });
  test(`${d}: an empty program never wins`, () => {
    for (let i = 0; i < 500; i++) assert.ok(!TE.generateTask(d).checkAll(P.parseProgram("")));
  });
  test(`${d}: every variable is used by a rule and has to be defined`, () => {
    for (let i = 0; i < 1000; i++) {
      const t = TE.generateTask(d);
      const env = P.parseProgram(t.solution);
      for (const v of t.vars) {
        const copy = P.parseProgram(t.solution.split("\n").filter((l) => !l.startsWith(v + " ")).join("\n"));
        assert.ok(!t.checkAll(copy), `removing ${v} still won:\n${t.solution}`);
      }
      assert.deepStrictEqual(Object.keys(env.vars).sort(), t.vars.slice().sort());
    }
  });
  test(`${d}: serialize -> rebuild keeps the same rules and still accepts the solution`, () => {
    for (let i = 0; i < 500; i++) {
      const t = TE.generateTask(d);
      const back = TE.rebuildTask(JSON.parse(JSON.stringify(TE.serializeTask(t))));
      assert.deepStrictEqual(back.rules.map((r) => r.html), t.rules.map((r) => r.html));
      assert.ok(back.checkAll(P.parseProgram(t.solution)));
    }
  });
}

test("rules link variables: no single line wins on medium or hard", () => {
  for (const d of ["medium", "hard"]) {
    for (let i = 0; i < 500; i++) {
      const t = TE.generateTask(d);
      for (const line of t.solution.split("\n")) assert.ok(!t.checkAll(P.parseProgram(line)));
    }
  }
});
test("tasks have the right number of rules and linking rules", () => {
  const want = { easy: [2, 1], medium: [4, 2], hard: [5, 3] }; // total rules (with the line limit), minimum linking
  for (const d of TE.DIFFICULTY) {
    for (let i = 0; i < 300; i++) {
      const t = TE.generateTask(d);
      // + 1 when a True/False variable joined, + 1 when a twist rule did
      const extra = (/= (True|False)/.test(t.solution) ? 1 : 0) + t.rules.filter((r) => TE._internal.RULES[r.key].twist).length;
      assert.strictEqual(t.rules.length, want[d][0] + extra);
      const cross = t.rules.filter((r) => TE._internal.RULES[r.key].cross).length;
      assert.ok(cross >= want[d][1], `${d} had ${cross} linking rules`);
    }
  }
});
test("the line limit really limits", () => {
  for (let i = 0; i < 300; i++) {
    const t = TE.generateTask("hard");
    const env = P.parseProgram(t.solution + "\nextra = 1");
    assert.ok(!t.checkAll(env), "an extra line should break the hard limit");
  }
});
test("seeded generation is repeatable (the daily)", () => {
  function seeded(seed) {
    let a = seed;
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const real = Math.random;
  const make = (seed) => { Math.random = seeded(seed); try { return TE.generateTask("hard", true); } finally { Math.random = real; } };
  for (let s = 1; s < 50; s++) {
    const a = make(s), b = make(s);
    assert.deepStrictEqual(a.rules.map((r) => r.html), b.rules.map((r) => r.html));
    assert.strictEqual(a.solution, b.solution);
  }
});

// ---------- security ----------
test("rebuildTask rejects tampered tasks (XSS, unknown rules, bad types)", () => {
  const evil = [
    { id: "x", difficulty: "easy", rules: [{ key: "numBetween", params: { a: "age", lo: "<img src=x onerror=alert(1)>", hi: 9 } }] },
    { id: "x", difficulty: "easy", rules: [{ key: "numBetween", params: { a: "<script>", lo: 1, hi: 9 } }] },
    { id: "x", difficulty: "easy", rules: [{ key: "constructor", params: {} }] },
    { id: "x", difficulty: "easy", rules: [{ key: "__proto__", params: {} }] },
    { id: "x", difficulty: "nope", rules: [{ key: "numPrime", params: { a: "age" } }] },
    { id: "x", difficulty: "easy", rules: [] },
    { id: "x", difficulty: "easy", rules: new Array(50).fill({ key: "numPrime", params: { a: "age" } }) },
    { id: "x", difficulty: "easy", rules: [{ key: "numBetween", params: { a: "age", lo: 1e9, hi: 2 } }] },
    null, "string", 42,
  ];
  for (const bad of evil) assert.throws(() => TE.rebuildTask(bad), `should have rejected ${JSON.stringify(bad)}`);
});
test("rule html never contains raw markup from params", () => {
  for (let i = 0; i < 2000; i++) {
    const t = TE.generateTask(TE.DIFFICULTY[i % 3]);
    for (const r of t.rules) {
      const stripped = r.html.replace(/<\/?code>/g, "");
      assert.ok(!/[<>]/.test(stripped), r.html);
    }
  }
});
test("a hostile id is replaced", () => {
  const t = TE.rebuildTask({ id: "<img onerror=1>", difficulty: "easy", rules: [{ key: "numPrime", params: { a: "age" } }] });
  assert.ok(/^[A-Za-z0-9_-]+$/.test(t.id));
});

test("parser reads True / False, and nothing else counts as a boolean", () => {
  const e = P.parseProgram('ok = True\nno = False\nbad = true\nx = None');
  assert.deepStrictEqual([e.vars.ok.type, e.vars.ok.value, e.vars.no.value], ["bool", true, false]);
  assert.ok(!e.vars.bad && !e.vars.x && e.errors === 2);
});
test("every rule type shows up, and twist rules never need a variable", () => {
  const seen = new Set();
  for (const d of TE.DIFFICULTY) for (let i = 0; i < 3000; i++) TE.generateTask(d).rules.forEach((r) => seen.add(r.key));
  const missing = Object.keys(TE._internal.RULES).filter((k) => !seen.has(k));
  assert.deepStrictEqual(missing, []);
});

// ---------- variety (for the curious) ----------
test("variety report", () => {
  for (const d of TE.DIFFICULTY) {
    const sentences = new Set();
    for (let i = 0; i < 5000; i++) TE.generateTask(d).rules.forEach((r) => sentences.add(r.html));
    console.log(`        ${d}: ${sentences.size} distinct rule sentences over 5000 tasks (the old engine had ${{ easy: 63, medium: 110, hard: 115 }[d]})`);
    assert.ok(sentences.size > 100);
  }
});

console.log(`\n${passed} tests passed` + (process.exitCode ? " (with failures)" : ""));
