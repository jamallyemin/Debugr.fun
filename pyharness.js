// The Python side of the lessons. It runs inside Pyodide (real Python in the browser) and, in the tests, inside python3.
// run_lesson(job_json) -> json: {ok, output, error:{type,message,line}|null, tests:[{expr,got,want,ok}]}
(function (root) {
  "use strict";
  const PY_HARNESS = String.raw`
import sys, io, json, builtins

def _err(e):
    line = 0
    if isinstance(e, SyntaxError):
        line = e.lineno or 0
        msg = e.msg
    else:
        tb = e.__traceback__
        while tb:
            if tb.tb_frame.f_code.co_filename == "<lesson>":
                line = tb.tb_lineno
            tb = tb.tb_next
        msg = str(e)
    return {"type": type(e).__name__, "message": msg, "line": line}

def run_lesson(job_json):
    job = json.loads(job_json)
    code = job["code"]
    lines = list(job.get("stdin") or [])
    tests = job.get("tests") or []
    buf = io.StringIO()
    ns = {"__name__": "__main__"}
    def _input(prompt=""):
        buf.write(str(prompt))
        if not lines:
            raise EOFError("EOF when reading a line")
        v = lines.pop(0)
        if prompt != "":
            buf.write(v + "\n")   # with a question shown, echo the answer like a terminal would
        return v
    b = dict(vars(builtins))
    b["input"] = _input
    ns["__builtins__"] = b
    real = sys.stdout
    err = None
    sys.stdout = buf
    try:
        exec(compile(code, "<lesson>", "exec"), ns)
    except SystemExit:
        pass
    except BaseException as e:
        err = _err(e)
    results = []
    if err is None:
        for t in tests:
            setup, expr, want = (t if len(t) == 3 else [None, t[0], t[1]])
            env = dict(ns)
            try:
                if setup:
                    exec(setup, env)
                got = repr(eval(expr, env))
            except BaseException as e:
                got = "error: " + type(e).__name__ + ": " + str(e)
            results.append({"expr": (setup.replace("\n", "; ") + "; " if setup else "") + expr, "got": got, "want": want, "ok": got == want})
    sys.stdout = real
    return json.dumps({"ok": err is None, "output": buf.getvalue(), "error": err, "tests": results})
`;
  const api = { PY_HARNESS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PyHarness = api;
})(typeof window !== "undefined" ? window : globalThis);
