(function (root) {
    "use strict";

    const MAX_STEPS = 50000;
    const MAX_SEQ = 100000;
    const state = { line: null };

    class PyError extends Error {
        constructor(type, message, line) {
            super(message);
            this.pyType = type;
            this.pyLine = line !== undefined && line !== null ? line : state.line;
        }
    }
    const E = (type, msg, line) => new PyError(type, msg, line);

    const KEYWORDS = new Set(["if", "elif", "else", "for", "in", "and", "or", "not", "True", "False", "None"]);

    // values

    const mkInt = (v) => ({ k: "int", v });
    const mkFloat = (v) => ({ k: "float", v });
    const mkStr = (v) => ({ k: "str", v });
    const mkBool = (v) => ({ k: "bool", v: !!v });
    const mkList = (v) => ({ k: "list", v });
    const NONE = { k: "none" };

    const isNum = (x) => x.k === "int" || x.k === "float" || x.k === "bool";
    const isIntLike = (x) => x.k === "int" || x.k === "bool";
    const numVal = (x) => (x.k === "bool" ? (x.v ? 1 : 0) : x.v);
    const TYPE_NAMES = { int: "int", float: "float", str: "str", bool: "bool", list: "list", none: "NoneType", builtin: "builtin_function_or_method" };
    const typeName = (x) => TYPE_NAMES[x.k];

    function formatFloat(n) {
        if (Number.isNaN(n)) return "nan";
        if (!Number.isFinite(n)) return n < 0 ? "-inf" : "inf";
        if (Number.isInteger(n) && Math.abs(n) < 1e16) return n.toFixed(1);
        return String(n);
    }

    function pyRepr(x) {
        if (x.k === "str") {
            const q = x.v.includes("'") && !x.v.includes('"') ? '"' : "'";
            let s = x.v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
            if (q === "'") s = s.replace(/'/g, "\\'");
            return q + s + q;
        }
        return pyStr(x);
    }

    function pyStr(x) {
        switch (x.k) {
            case "int": return String(x.v);
            case "float": return formatFloat(x.v);
            case "str": return x.v;
            case "bool": return x.v ? "True" : "False";
            case "none": return "None";
            case "list": return "[" + x.v.map(pyRepr).join(", ") + "]";
            case "builtin": return `<built-in function ${x.name}>`;
            default: return "?";
        }
    }

    function truthy(x) {
        switch (x.k) {
            case "int": case "float": case "bool": return x.v !== 0 && x.v !== false;
            case "str": case "list": return x.v.length > 0;
            case "none": return false;
            default: return true;
        }
    }

    function eqVals(a, b) {
        if (isNum(a) && isNum(b)) return numVal(a) === numVal(b);
        if (a.k !== b.k) return false;
        if (a.k === "str") return a.v === b.v;
        if (a.k === "none") return true;
        if (a.k === "list") return a.v.length === b.v.length && a.v.every((e, i) => eqVals(e, b.v[i]));
        return a === b;
    }

    // tokenizer
    const TWO_CHAR_OPS = ["==", "!=", "<=", ">=", "//", "+=", "-=", "*="];
    const ONE_CHAR_OPS = "+-*/%<>=()[],:.";

    function tokenize(code) {
        const rawLines = code.replace(/\r\n?/g, "\n").split("\n");
        const lines = [];
        let cur = null;
        let depth = 0;

        for (let ln = 0; ln < rawLines.length; ln++) {
            const text = rawLines[ln];
            const lineNo = ln + 1;
            let i = 0;

            if (depth === 0) {
                let indent = 0;
                while (i < text.length && (text[i] === " " || text[i] === "\t")) {
                    indent += text[i] === "\t" ? 4 : 1;
                    i++;
                }
                if (i >= text.length || text[i] === "#") continue;
                cur = { indent, tokens: [], line: lineNo };
            }

            while (i < text.length) {
                const c = text[i];
                if (c === " " || c === "\t") { i++; continue; }
                if (c === "#") break;

                if (c >= "0" && c <= "9") {
                    let j = i;
                    while (j < text.length && text[j] >= "0" && text[j] <= "9") j++;
                    let isFloat = false;
                    if (text[j] === "." && text[j + 1] >= "0" && text[j + 1] <= "9") {
                        isFloat = true;
                        j++;
                        while (j < text.length && text[j] >= "0" && text[j] <= "9") j++;
                    }
                    cur.tokens.push({ t: "num", v: parseFloat(text.slice(i, j)), float: isFloat });
                    i = j;
                    continue;
                }

                if (/[A-Za-z_]/.test(c)) {
                    let j = i;
                    while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j++;
                    cur.tokens.push({ t: "name", v: text.slice(i, j) });
                    i = j;
                    continue;
                }

                if (c === '"' || c === "'") {
                    let j = i + 1;
                    let buf = "";
                    let closed = false;
                    while (j < text.length) {
                        const d = text[j];
                        if (d === "\\" && j + 1 < text.length) {
                            const nx = text[j + 1];
                            buf += nx === "n" ? "\n" : nx === "t" ? "\t" : nx;
                            j += 2;
                            continue;
                        }
                        if (d === c) { closed = true; j++; break; }
                        buf += d;
                        j++;
                    }
                    if (!closed) throw E("SyntaxError", "unterminated string literal", lineNo);
                    cur.tokens.push({ t: "str", v: buf });
                    i = j;
                    continue;
                }

                const two = text.slice(i, i + 2);
                if (TWO_CHAR_OPS.includes(two)) {
                    cur.tokens.push({ t: "op", v: two });
                    i += 2;
                    continue;
                }
                if (ONE_CHAR_OPS.includes(c)) {
                    if (c === "(" || c === "[") depth++;
                    if (c === ")" || c === "]") {
                        depth--;
                        if (depth < 0) throw E("SyntaxError", `unmatched '${c}'`, lineNo);
                    }
                    cur.tokens.push({ t: "op", v: c });
                    i++;
                    continue;
                }

                throw E("SyntaxError", `invalid character '${c}'`, lineNo);
            }

            if (depth === 0) lines.push(cur);
        }

        if (depth > 0) throw E("SyntaxError", "'(' or '[' was never closed", cur.line);
        return lines;
    }

    // expression parser
    const CMP_OPS = ["==", "!=", "<", ">", "<=", ">="];

    class ExprParser {
        constructor(tokens, line) { this.t = tokens; this.p = 0; this.line = line; }
        err(msg) { return E("SyntaxError", msg || "invalid syntax", this.line); }
        peek() { return this.t[this.p]; }
        isOp(v) { const k = this.t[this.p]; return !!k && k.t === "op" && k.v === v; }
        isName(v) { const k = this.t[this.p]; return !!k && k.t === "name" && k.v === v; }
        expectOp(v) {
            if (!this.isOp(v)) throw this.err(`expected '${v}'`);
            this.p++;
        }

        parseTop() {
            if (!this.t.length) throw this.err();
            const n = this.parseOr();
            if (this.p < this.t.length) throw this.err();
            return n;
        }
        parseOr() {
            let l = this.parseAnd();
            while (this.isName("or")) { this.p++; l = { t: "or", l, r: this.parseAnd() }; }
            return l;
        }
        parseAnd() {
            let l = this.parseNot();
            while (this.isName("and")) { this.p++; l = { t: "and", l, r: this.parseNot() }; }
            return l;
        }
        parseNot() {
            if (this.isName("not")) { this.p++; return { t: "not", e: this.parseNot() }; }
            return this.parseCmp();
        }
        parseCmp() {
            const l = this.parseAdd();
            const k = this.peek();
            let op = null;
            if (k && k.t === "op" && CMP_OPS.includes(k.v)) { op = k.v; this.p++; }
            else if (this.isName("in")) { op = "in"; this.p++; }
            else if (this.isName("not") && this.t[this.p + 1] && this.t[this.p + 1].t === "name" && this.t[this.p + 1].v === "in") {
                op = "not in"; this.p += 2;
            }
            if (!op) return l;
            return { t: "cmp", op, l, r: this.parseAdd() };
        }
        parseAdd() {
            let l = this.parseMul();
            while (this.isOp("+") || this.isOp("-")) {
                const op = this.peek().v; this.p++;
                l = { t: "bin", op, l, r: this.parseMul() };
            }
            return l;
        }
        parseMul() {
            let l = this.parseUnary();
            while (this.isOp("*") || this.isOp("/") || this.isOp("//") || this.isOp("%")) {
                const op = this.peek().v; this.p++;
                l = { t: "bin", op, l, r: this.parseUnary() };
            }
            return l;
        }
        parseUnary() {
            if (this.isOp("-")) { this.p++; return { t: "neg", e: this.parseUnary() }; }
            if (this.isOp("+")) { this.p++; return this.parseUnary(); }
            return this.parsePostfix();
        }
        parsePostfix() {
            let n = this.parseAtom();
            for (; ;) {
                if (this.isOp("(")) {
                    this.p++;
                    const args = [];
                    while (!this.isOp(")")) {
                        if (this.p >= this.t.length) throw this.err("'(' was never closed");
                        args.push(this.parseOr());
                        if (this.isOp(",")) this.p++;
                        else if (!this.isOp(")")) throw this.err();
                    }
                    this.p++;
                    n = { t: "call", fn: n, args };
                } else if (this.isOp("[")) {
                    this.p++;
                    const idx = this.parseOr();
                    this.expectOp("]");
                    n = { t: "index", obj: n, idx };
                } else if (this.isOp(".")) {
                    this.p++;
                    const k = this.peek();
                    if (!k || k.t !== "name" || KEYWORDS.has(k.v)) throw this.err();
                    this.p++;
                    n = { t: "attr", obj: n, name: k.v };
                } else break;
            }
            return n;
        }
        parseAtom() {
            const k = this.peek();
            if (!k) throw this.err();
            if (k.t === "num") { this.p++; return { t: "num", v: k.v, float: k.float }; }
            if (k.t === "str") { this.p++; return { t: "str", v: k.v }; }
            if (k.t === "name") {
                if (k.v === "True" || k.v === "False" || k.v === "None") { this.p++; return { t: "const", v: k.v }; }
                if (KEYWORDS.has(k.v)) throw this.err();
                this.p++;
                return { t: "name", v: k.v };
            }
            if (k.t === "op" && k.v === "(") {
                this.p++;
                const e = this.parseOr();
                this.expectOp(")");
                return e;
            }
            if (k.t === "op" && k.v === "[") {
                this.p++;
                const items = [];
                while (!this.isOp("]")) {
                    if (this.p >= this.t.length) throw this.err("'[' was never closed");
                    items.push(this.parseOr());
                    if (this.isOp(",")) this.p++;
                    else if (!this.isOp("]")) throw this.err();
                }
                this.p++;
                return { t: "list", items };
            }
            throw this.err();
        }
    }

const parseExprTokens = (tokens, line) => new ExprParser(tokens, line).parseTop();

function parseHeaderExpr(tokens, start, line) {
    const last = tokens[tokens.length - 1];
    if (tokens.length <= start || last.t !== "op" || last.v !== ":") throw E("SyntaxError", "expected ':'", line);
    return parseExprTokens(tokens.slice(start, tokens.length - 1), line);
}

function parse(code) {
    const lines = tokenize(code);
    let i = 0;

    function block(indent) {
        const stmts = [];
        while (i < lines.length) {
            const L = lines[i];
            if (L.indent < indent) break;
            if (L.indent > indent) throw E("IndentationError", "unexpected indent", L.line);
            stmts.push(statement(indent));
        }
        return stmts;
    }

    function body(parentIndent, headerLine) {
        if (i >= lines.length || lines[i].indent <= parentIndent) {
            throw E("IndentationError", "expected an indented block", headerLine);
        }
        return block(lines[i].indent);
    }

    function isKw(L, kw) { return L.tokens[0].t === "name" && L.tokens[0].v === kw; }

    function statement(indent) {
        const L = lines[i];
        const t = L.tokens;
        const first = t[0];
        i++;

        if (first.t === "name" && first.v === "if") {
            const node = { t: "if", branches: [], orelse: null, line: L.line };
            node.branches.push({ cond: parseHeaderExpr(t, 1, L.line), line: L.line, body: body(indent, L.line) });
            while (i < lines.length && lines[i].indent === indent && (isKw(lines[i], "elif") || isKw(lines[i], "else"))) {
                const N = lines[i];
                i++;
                if (N.tokens[0].v === "elif") {
                    node.branches.push({ cond: parseHeaderExpr(N.tokens, 1, N.line), line: N.line, body: body(indent, N.line) });
                } else {
                    if (N.tokens.length !== 2 || !(N.tokens[1].t === "op" && N.tokens[1].v === ":")) {
                        throw E("SyntaxError", "expected ':'", N.line);
                    }
                    node.orelse = body(indent, N.line);
                    break;
                }
            }
            return node;
        }

        if (first.t === "name" && (first.v === "elif" || first.v === "else")) {
            throw E("SyntaxError", "invalid syntax", L.line);
        }

        if (first.t === "name" && first.v === "for") {
            const v = t[1];
            const inTok = t[2];
            if (!v || v.t !== "name" || KEYWORDS.has(v.v) || !inTok || !(inTok.t === "name" && inTok.v === "in")) {
                throw E("SyntaxError", "invalid syntax", L.line);
            }
            const iter = parseHeaderExpr(t, 3, L.line);
            return { t: "for", name: v.v, iter, body: body(indent, L.line), line: L.line };
        }

        if (t.length >= 2 && first.t === "name" && !KEYWORDS.has(first.v) &&
            t[1].t === "op" && (t[1].v === "=" || t[1].v === "+=" || t[1].v === "-=" || t[1].v === "*=")) {
            return { t: "assign", name: first.v, op: t[1].v, value: parseExprTokens(t.slice(2), L.line), line: L.line };
        }

        return { t: "expr", expr: parseExprTokens(t, L.line), line: L.line };
    }

    return block(0);
}

// operators

function numResult(a, b, v) {
    return a.k === "float" || b.k === "float" ? mkFloat(v) : mkInt(v);
}

function binop(op, a, b) {
    if (op === "+") {
        if (isNum(a) && isNum(b)) return numResult(a, b, numVal(a) + numVal(b));
        if (a.k === "str" && b.k === "str") return mkStr(a.v + b.v);
        if (a.k === "list" && b.k === "list") return mkList(a.v.concat(b.v));
        if (a.k === "str") throw E("TypeError", `can only concatenate str (not "${typeName(b)}") to str`);
        if (a.k === "list") throw E("TypeError", `can only concatenate list (not "${typeName(b)}") to list`);
        throw E("TypeError", `unsupported operand type(s) for +: '${typeName(a)}' and '${typeName(b)}'`);
    }
    if (op === "*") {
        if (isNum(a) && isNum(b)) return numResult(a, b, numVal(a) * numVal(b));
        const rep = (seq, n, wrap, len) => {
            const times = Math.max(0, numVal(n));
            if (times * len > MAX_SEQ) throw E("MemoryError", "result is too large");
            return wrap(times);
        };
        if (a.k === "str" && isIntLike(b)) return rep(a, b, (n) => mkStr(a.v.repeat(n)), a.v.length);
        if (isIntLike(a) && b.k === "str") return rep(b, a, (n) => mkStr(b.v.repeat(n)), b.v.length);
        if (a.k === "list" && isIntLike(b)) return rep(a, b, (n) => { let out = []; for (let i = 0; i < n; i++) out = out.concat(a.v); return mkList(out); }, a.v.length);
        if (isIntLike(a) && b.k === "list") return rep(b, a, (n) => { let out = []; for (let i = 0; i < n; i++) out = out.concat(b.v); return mkList(out); }, b.v.length);
        if (a.k === "str" || a.k === "list") throw E("TypeError", `can't multiply sequence by non-int of type '${typeName(b)}'`);
        throw E("TypeError", `unsupported operand type(s) for *: '${typeName(a)}' and '${typeName(b)}'`);
    }
    if (!(isNum(a) && isNum(b))) {
        throw E("TypeError", `unsupported operand type(s) for ${op}: '${typeName(a)}' and '${typeName(b)}'`);
    }
    const x = numVal(a);
    const y = numVal(b);
    if (op === "-") return numResult(a, b, x - y);
    if (op === "/") {
        if (y === 0) throw E("ZeroDivisionError", "division by zero");
        return mkFloat(x / y);
    }
    if (op === "//") {
        if (y === 0) throw E("ZeroDivisionError", "integer division or modulo by zero");
        return numResult(a, b, Math.floor(x / y));
    }
    if (op === "%") {
        if (y === 0) throw E("ZeroDivisionError", "integer division or modulo by zero");
        return numResult(a, b, x - Math.floor(x / y) * y);
    }
    throw E("SyntaxError", "invalid syntax");
}

function compare(op, a, b) {
    if (op === "==") return eqVals(a, b);
    if (op === "!=") return !eqVals(a, b);
    if (op === "in" || op === "not in") {
        let r;
        if (b.k === "list") r = b.v.some((e) => eqVals(e, a));
        else if (b.k === "str") {
            if (a.k !== "str") throw E("TypeError", `'in <string>' requires string as left operand, not ${typeName(a)}`);
            r = b.v.includes(a.v);
        } else throw E("TypeError", `argument of type '${typeName(b)}' is not iterable`);
        return op === "in" ? r : !r;
    }
    let x, y;
    if (isNum(a) && isNum(b)) { x = numVal(a); y = numVal(b); }
    else if (a.k === "str" && b.k === "str") { x = a.v; y = b.v; }
    else throw E("TypeError", `'${op}' not supported between instances of '${typeName(a)}' and '${typeName(b)}'`);
    switch (op) {
        case "<": return x < y;
        case ">": return x > y;
        case "<=": return x <= y;
        default: return x >= y;
    }
}

// builtins nd methods
function argc(args, n, name) {
    if (args.length !== n) {
      throw E("TypeError", `${name}() takes exactly ${n} argument${n === 1 ? "" : "s"} (${args.length} given)`);
    }
  }
  function seqItems(x, what) {
    if (x.k === "list") return x.v;
    if (x.k === "str") return x.v.split("").map(mkStr);
    throw E("TypeError", `'${typeName(x)}' object is not iterable`);
  }
 
  const BUILTINS = {
    print(args, ctx) { ctx.output.push(args.map(pyStr).join(" ")); return NONE; },
    len(args) {
      argc(args, 1, "len");
      const x = args[0];
      if (x.k === "str" || x.k === "list") return mkInt(x.v.length);
      throw E("TypeError", `object of type '${typeName(x)}' has no len()`);
    },
    int(args) {
      argc(args, 1, "int");
      const x = args[0];
      if (x.k === "int") return x;
      if (x.k === "bool") return mkInt(numVal(x));
      if (x.k === "float") return mkInt(Math.trunc(x.v));
      if (x.k === "str") {
        if (/^\s*[+-]?\d+\s*$/.test(x.v)) return mkInt(parseInt(x.v, 10));
        throw E("ValueError", `invalid literal for int() with base 10: ${pyRepr(x)}`);
      }
      throw E("TypeError", `int() argument must be a string or a real number, not '${typeName(x)}'`);
    },
    float(args) {
      argc(args, 1, "float");
      const x = args[0];
      if (x.k === "float") return x;
      if (x.k === "int" || x.k === "bool") return mkFloat(numVal(x));
      if (x.k === "str") {
        if (/^\s*[+-]?(\d+(\.\d*)?|\.\d+)\s*$/.test(x.v)) return mkFloat(parseFloat(x.v));
        throw E("ValueError", `could not convert string to float: ${pyRepr(x)}`);
      }
      throw E("TypeError", `float() argument must be a string or a real number, not '${typeName(x)}'`);
    },
    str(args) { argc(args, 1, "str"); return mkStr(pyStr(args[0])); },
    sum(args) {
      argc(args, 1, "sum");
      if (args[0].k !== "list") throw E("TypeError", `'${typeName(args[0])}' object is not iterable`);
      let acc = mkInt(0);
      for (const e of args[0].v) acc = binop("+", acc, e);
      return acc;
    },
    max(args) { return extreme(args, "max", ">"); },
    min(args) { return extreme(args, "min", "<"); },
    abs(args) {
      argc(args, 1, "abs");
      const x = args[0];
      if (!isNum(x)) throw E("TypeError", `bad operand type for abs(): '${typeName(x)}'`);
      return x.k === "float" ? mkFloat(Math.abs(x.v)) : mkInt(Math.abs(numVal(x)));
    },
    sorted(args) {
      argc(args, 1, "sorted");
      const items = seqItems(args[0]).slice();
      items.sort((a, b) => (compare("<", a, b) ? -1 : compare("<", b, a) ? 1 : 0));
      return mkList(items);
    },
    range(args) {
      if (args.length < 1 || args.length > 3) throw E("TypeError", `range expected 1 to 3 arguments, got ${args.length}`);
      for (const a of args) {
        if (!isIntLike(a)) throw E("TypeError", `'${typeName(a)}' object cannot be interpreted as an integer`);
      }
      const nums = args.map(numVal);
      const start = nums.length >= 2 ? nums[0] : 0;
      const stop = nums.length >= 2 ? nums[1] : nums[0];
      const step = nums.length === 3 ? nums[2] : 1;
      if (step === 0) throw E("ValueError", "range() arg 3 must not be zero");
      const out = [];
      for (let v = start; step > 0 ? v < stop : v > stop; v += step) {
        out.push(mkInt(v));
        if (out.length > 10000) throw E("MemoryError", "range is too large");
      }
      return mkList(out);
    },
  };
 
  function extreme(args, name, op) {
    if (args.length === 0) throw E("TypeError", `${name} expected at least 1 argument, got 0`);
    const items = args.length === 1 ? seqItems(args[0]) : args;
    if (!items.length) throw E("ValueError", `${name}() arg is an empty sequence`);
    let best = items[0];
    for (let i = 1; i < items.length; i++) if (compare(op, items[i], best)) best = items[i];
    return best;
  }
 
  function callMethod(obj, name, args) {
    if (obj.k === "str" && (name === "upper" || name === "lower")) {
      argc(args, 0, name);
      return mkStr(name === "upper" ? obj.v.toUpperCase() : obj.v.toLowerCase());
    }
    if (obj.k === "list" && name === "append") {
      argc(args, 1, "append");
      obj.v.push(args[0]);
      return NONE;
    }
    throw E("AttributeError", `'${typeName(obj)}' object has no attribute '${name}'`);
  }


  // evulautor
  function evalExpr(n, ctx) {
    switch (n.t) {
      case "num": return n.float ? mkFloat(n.v) : mkInt(n.v);
      case "str": return mkStr(n.v);
      case "const": return n.v === "True" ? mkBool(true) : n.v === "False" ? mkBool(false) : NONE;
      case "name": {
        if (ctx.env.has(n.v)) return ctx.env.get(n.v);
        if (Object.prototype.hasOwnProperty.call(BUILTINS, n.v)) return { k: "builtin", name: n.v };
        throw E("NameError", `name '${n.v}' is not defined`);
      }
      case "list": return mkList(n.items.map((e) => evalExpr(e, ctx)));
      case "neg": {
        const x = evalExpr(n.e, ctx);
        if (!isNum(x)) throw E("TypeError", `bad operand type for unary -: '${typeName(x)}'`);
        return x.k === "float" ? mkFloat(-x.v) : mkInt(-numVal(x));
      }
      case "not": return mkBool(!truthy(evalExpr(n.e, ctx)));
      case "bin": return binop(n.op, evalExpr(n.l, ctx), evalExpr(n.r, ctx));
      case "cmp": return mkBool(compare(n.op, evalExpr(n.l, ctx), evalExpr(n.r, ctx)));
      case "and": { const l = evalExpr(n.l, ctx); return truthy(l) ? evalExpr(n.r, ctx) : l; }
      case "or": { const l = evalExpr(n.l, ctx); return truthy(l) ? l : evalExpr(n.r, ctx); }
      case "index": {
        const o = evalExpr(n.obj, ctx);
        const ix = evalExpr(n.idx, ctx);
        if (o.k !== "list" && o.k !== "str") throw E("TypeError", `'${typeName(o)}' object is not subscriptable`);
        if (!isIntLike(ix)) throw E("TypeError", `${o.k} indices must be integers, not '${typeName(ix)}'`);
        let idx = numVal(ix);
        const len = o.v.length;
        if (idx < 0) idx += len;
        if (idx < 0 || idx >= len) throw E("IndexError", `${o.k} index out of range`);
        return o.k === "str" ? mkStr(o.v[idx]) : o.v[idx];
      }
      case "attr": throw E("AttributeError", "attributes can only be used in method calls");
      case "call": {
        if (n.fn.t === "attr") {
          const obj = evalExpr(n.fn.obj, ctx);
          const args = n.args.map((a) => evalExpr(a, ctx));
          return callMethod(obj, n.fn.name, args);
        }
        const fn = evalExpr(n.fn, ctx);
        const args = n.args.map((a) => evalExpr(a, ctx));
        if (fn.k !== "builtin") throw E("TypeError", `'${typeName(fn)}' object is not callable`);
        return BUILTINS[fn.name](args, ctx);
      }
      default: throw E("SyntaxError", "invalid syntax");
    }
  }
 
  function tick(ctx, line) {
    if (++ctx.steps > MAX_STEPS) throw E("RuntimeError", "program ran for too long", line);
  }
 
  function execBlock(stmts, ctx) {
    for (const s of stmts) exec(s, ctx);
  }
 
  function exec(s, ctx) {
    tick(ctx, s.line);
    state.line = s.line;
    switch (s.t) {
      case "assign": {
        const val = evalExpr(s.value, ctx);
        if (s.op === "=") { ctx.env.set(s.name, val); return; }
        if (!ctx.env.has(s.name)) throw E("NameError", `name '${s.name}' is not defined`, s.line);
        ctx.env.set(s.name, binop(s.op[0], ctx.env.get(s.name), val));
        return;
      }
      case "expr": evalExpr(s.expr, ctx); return;
      case "if": {
        for (const b of s.branches) {
          state.line = b.line;
          if (truthy(evalExpr(b.cond, ctx))) { execBlock(b.body, ctx); return; }
        }
        if (s.orelse) execBlock(s.orelse, ctx);
        return;
      }
      case "for": {
        const it = evalExpr(s.iter, ctx);
        let items;
        if (it.k === "list") items = it.v.slice();
        else if (it.k === "str") items = it.v.split("").map(mkStr);
        else throw E("TypeError", `'${typeName(it)}' object is not iterable`, s.line);
        for (const item of items) {
          tick(ctx, s.line);
          ctx.env.set(s.name, item);
          execBlock(s.body, ctx);
        }
        return;
      }
      default: throw E("SyntaxError", "invalid syntax", s.line);
    }
  }
 

  function run(code) {
    const ctx = { env: new Map(), output: [], steps: 0 };
    state.line = null;
    let error = null;
    try {
      const program = parse(String(code));
      execBlock(program, ctx);
    } catch (e) {
      if (e instanceof PyError) error = { type: e.pyType, message: e.message, line: e.pyLine };
      else if (e instanceof RangeError) error = { type: "RuntimeError", message: "program is too complex", line: state.line };
      else throw e;
    }
    const vars = {};
    for (const [k, v] of ctx.env) vars[k] = v;
    return { ok: !error, output: ctx.output, vars, error };
  }
 
  function formatError(err) {
    if (!err) return "";
    return `${err.type}: ${err.message}` + (err.line ? ` (line ${err.line})` : "");
  }
 
  const api = { run, formatError, pyStr, pyRepr, valuesEqual: eqVals };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PyEval = api;
})(typeof window !== "undefined" ? window : globalThis);


