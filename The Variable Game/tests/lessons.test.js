// Every lesson exercise is run through real Python (python3 with the same harness the browser uses).
// The model answer must pass, and the starting code must not already pass.
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { PY_HARNESS } = require("../pyharness.js");
const L = require("../lessons.js");
for (const f of ["lessons3.js", "lessons4.js", "lessons5.js", "lessons6.js", "lessons7.js", "lessons8.js", "lessons9.js", "lessons10.js"]) if (fs.existsSync(path.join(__dirname, "..", f))) require("../" + f);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lessons-"));
const driver = path.join(dir, "d.py");
fs.writeFileSync(driver, PY_HARNESS + `\nimport sys\nprint(run_lesson(sys.stdin.read()))\n`);
function run(code, stdin, tests) {
  const p = spawnSync("python3", ["-I", driver], { input: JSON.stringify({ code, stdin: stdin || [], tests: tests || [] }), encoding: "utf8", timeout: 8000, cwd: dir });
  if (p.status !== 0) throw new Error("python failed: " + p.stderr);
  return JSON.parse(p.stdout);
}
const norm = (t) => String(t).replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").trim();
const passes = (r, e, code) => r.ok && (e.expect === undefined || norm(r.output) === norm(e.expect)) && (r.tests || []).every((t) => t.ok) && (!e.must || e.must.test(code));

let n = 0, lessons = 0;
for (const ch of L.CHAPTERS) {
  assert(ch.lessons.length, `chapter ${ch.id} is empty`);
  for (const l of ch.lessons) {
    lessons++;
    assert(l.read && l.read.length && l.try && l.bug && l.ex.length >= 3, `${l.id} incomplete`);
    assert(l.id.startsWith(ch.id + "."), `${l.id} is in chapter ${ch.id}`);
    const t = run(l.try.code, l.try.stdin);
    assert(l.try.expectError ? !t.ok : t.ok, `${l.id} try code ${l.try.expectError ? "should fail" : "fails"}: ${JSON.stringify(t.error)}`);
    l.ex.forEach((e, i) => {
      const tag = `${l.id} ex${i + 1}`; n++;
      assert(e.why && e.prompt, tag + " needs prompt and why");
      if (e.type === "choice") { assert(e.options.length >= 2 && Number.isInteger(e.answer) && e.answer < e.options.length, tag + " bad choice"); return; }
      if (e.type === "predict") { const r = run(e.code, e.stdin); assert(r.ok, `${tag} predict code fails: ${JSON.stringify(r.error)}`); assert(r.output.trim(), tag + " predict prints nothing"); if (e.expect !== undefined) assert.strictEqual(norm(r.output), norm(e.expect), tag + " predict expect"); return; }
      assert(["fill", "fix", "write"].includes(e.type), tag + " unknown type");
      assert(e.expect !== undefined || (e.tests && e.tests.length), tag + " needs expect or tests");
      const code = e.type === "fill" ? e.code.replace("___", e.answer) : e.solution;
      assert(code, tag + " has no solution");
      const r = run(code, e.stdin, e.tests);
      assert(passes(r, e, code), `${tag}: model answer fails -> ${JSON.stringify(r).slice(0, 300)}`);
      const start = e.type === "fill" ? e.code.replace("___", "0") : e.type === "fix" ? e.code : (e.start || "");
      const s = run(start, e.stdin, e.tests);
      assert(!passes(s, e, start), `${tag}: starting code already passes`);
    });
  }
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(`lessons ok (${lessons} lessons, ${n} exercises, checked in real Python)`);
