// Copies the game's own pure modules next to the functions, so the server judges a run with the exact code the
// browser uses. Run before every deploy (firebase.json does it for you): node functions/sync-shared.js
"use strict";
const fs = require("fs"), path = require("path");
const FILES = ["rating.js", "taskEngine.js", "parser.js", "pyeval.js", "puzzles.js"];
const from = path.join(__dirname, ".."), to = path.join(__dirname, "shared");
fs.mkdirSync(to, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(from, f), path.join(to, f));
console.log("synced " + FILES.length + " files into functions/shared");
