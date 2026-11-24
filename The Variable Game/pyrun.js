// Real Python in the browser (Pyodide), run in a background worker so an endless loop can be stopped.
// PyRun.run({code, stdin, tests}) -> {ok, output, error, tests}. The first load is about 10 MB and then the browser keeps it.
const PyRun = (() => {
  "use strict";
  const BASE = window.PYODIDE_BASE || "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
  const TIMEOUT_MS = 5000;
  let worker = null, state = "idle", stage = 0, readyP = null, resolveReady, rejectReady, seq = 0, pending = null, lastError = "";
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => { try { f(state, stage); } catch { } });

  const WORKER_SRC = `
let py = null;
const post = (m) => self.postMessage(m);
self.onmessage = async (e) => {
  const m = e.data;
  if (m.t === "init") {
    try {
      post({ t: "stage", v: 1 });
      importScripts(m.base + "pyodide.js");
      post({ t: "stage", v: 2 });
      py = await loadPyodide({ indexURL: m.base });
      post({ t: "stage", v: 3 });
      py.runPython(m.harness);
      post({ t: "ready" });
    } catch (err) { post({ t: "fail", msg: String(err && err.message || err) }); }
  } else if (m.t === "run") {
    try {
      const fn = py.globals.get("run_lesson");
      const r = fn(JSON.stringify(m.job));
      post({ t: "done", id: m.id, res: JSON.parse(r) });
    } catch (err) {
      post({ t: "done", id: m.id, res: { ok: false, output: "", tests: [], error: { type: "InternalError", message: String(err && err.message || err), line: 0 } } });
    }
  }
};`;

  function spawn() {
    state = "loading"; stage = 0; lastError = "";
    readyP = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; });
    readyP.catch(() => { });
    try {
      worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" })));
    } catch (err) { fail(String(err)); return; }
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.t === "stage") { stage = m.v; emit(); }
      else if (m.t === "ready") { state = "ready"; stage = 4; emit(); resolveReady(); }
      else if (m.t === "fail") fail(m.msg);
      else if (m.t === "done" && pending && pending.id === m.id) { clearTimeout(pending.timer); const p = pending; pending = null; p.resolve(m.res); }
    };
    worker.onerror = (e) => { if (state === "loading") fail(e.message || "worker error"); };
    worker.postMessage({ t: "init", base: BASE, harness: PyHarness.PY_HARNESS });
    emit();
  }
  function fail(msg) {
    state = "failed"; lastError = msg; emit();
    if (worker) { worker.terminate(); worker = null; }
    if (rejectReady) rejectReady(new Error(msg));
  }
  const preload = () => { if (state === "idle" || state === "failed") spawn(); return readyP; };
  const retry = () => { if (worker) { worker.terminate(); worker = null; } spawn(); return readyP; };

  async function run(job) {
    if (state !== "ready") { try { await preload(); } catch { return { ok: false, output: "", tests: [], error: { type: "LoadError", message: "Python could not be loaded", line: 0 } }; } }
    if (pending) { clearTimeout(pending.timer); pending.resolve({ ok: false, output: "", tests: [], error: { type: "Cancelled", message: "replaced by a newer run", line: 0 } }); pending = null; }
    return new Promise((resolve) => {
      const id = ++seq;
      const timer = setTimeout(() => {
        // endless loop: stop the worker, start a fresh one in the background
        pending = null;
        if (worker) worker.terminate();
        worker = null; state = "idle"; preload();
        resolve({ ok: false, output: "", tests: [], error: { type: "TimeoutError", message: "the program ran for more than 5 seconds", line: 0 } });
      }, TIMEOUT_MS);
      pending = { id, resolve, timer };
      worker.postMessage({ t: "run", id, job });
    });
  }

  return { preload, retry, run, state: () => state, stage: () => stage, error: () => lastError, ready: () => readyP, onChange: (f) => { listeners.add(f); return () => listeners.delete(f); } };
})();
