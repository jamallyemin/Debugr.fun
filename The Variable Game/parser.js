// Reads the player's code. Understands:
//   name = 42        name = -3.5      name = "hi"      name = 'hi'
//   name = [1, 2, 3] (multi-line lists too)   name = True / False   # comments
// Anything else is skipped. Returns { vars, lines, errors }:
//   vars:   { name: { type: "num" | "str" | "list" | "bool", value, line } }, the last assignment wins
//   lines:  how many non-empty, non-comment lines there are (the line limit counts these)
//   errors: statements it could not read
(function (root) {
  "use strict";

  const NUM = /^-?\d+(\.\d+)?$/;

  // cuts a "# comment" off the end of a line, but not a # inside quotes
  function stripComment(line) {
    let q = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === "\\") i++; else if (c === q) q = null; }
      else if (c === '"' || c === "'") q = c;
      else if (c === "#") return line.slice(0, i);
    }
    return line;
  }

  // how many [ are still open at the end of the text (ignoring quoted ones)
  function openBrackets(text) {
    let q = null, depth = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === "\\") i++; else if (c === q) q = null; }
      else if (c === '"' || c === "'") q = c;
      else if (c === "[") depth++;
      else if (c === "]") depth--;
    }
    return depth;
  }

  function splitTopLevel(text) {
    const parts = [];
    let q = null, cur = "";
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { cur += c; if (c === "\\") { cur += text[++i] || ""; } else if (c === q) q = null; }
      else if (c === '"' || c === "'") { q = c; cur += c; }
      else if (c === ",") { parts.push(cur); cur = ""; }
      else cur += c;
    }
    parts.push(cur);
    return parts;
  }

  function parseScalar(raw) {
    const t = raw.trim();
    if (NUM.test(t)) return { type: "num", value: parseFloat(t) };
    if (t === "True" || t === "False") return { type: "bool", value: t === "True" };
    const m = t.match(/^"((?:[^"\\]|\\.)*)"$/) || t.match(/^'((?:[^'\\]|\\.)*)'$/);
    if (m) return { type: "str", value: m[1].replace(/\\(.)/g, "$1") };
    return null;
  }

  function parseValue(raw) {
    const t = raw.trim();
    if (t.startsWith("[")) {
      if (!t.endsWith("]") || openBrackets(t) !== 0) return null;
      const inner = t.slice(1, -1).trim();
      if (!inner) return { type: "list", value: [] };
      const items = [];
      for (const part of splitTopLevel(inner)) {
        if (!part.trim()) continue; // allows a trailing comma
        const item = parseScalar(part);
        if (!item) return null;
        items.push(item.value);
      }
      return { type: "list", value: items };
    }
    return parseScalar(t);
  }

  function parseProgram(code) {
    const vars = Object.create(null);
    let lines = 0, errors = 0;
    let pending = null; // a list that continues on the next line

    for (const raw of String(code).split("\n")) {
      const text = stripComment(raw).trim();
      if (!text) continue;
      lines++;

      if (pending) {
        pending.text += " " + text;
        if (openBrackets(pending.text) > 0) continue;
        const done = pending; pending = null;
        commit(done.text, done.line);
        continue;
      }
      const eq = text.match(/^[A-Za-z_][A-Za-z0-9_]*\s*=(?!=)\s*(.*)$/);
      if (eq && eq[1].trim().startsWith("[") && openBrackets(eq[1]) > 0) { pending = { text, line: lines }; continue; }
      commit(text, lines);
    }
    if (pending) errors++; // a list that never closed

    function commit(text, line) {
      const m = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)\s*(.+)$/);
      if (!m) { errors++; return; }
      const v = parseValue(m[2]);
      if (!v) { errors++; return; }
      vars[m[1]] = { type: v.type, value: v.value, line };
    }
    return { vars, lines, errors };
  }

  const api = { parseProgram };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CodeParser = api;
})(typeof window !== "undefined" ? window : globalThis);
