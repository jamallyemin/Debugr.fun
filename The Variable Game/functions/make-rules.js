// Server mode: the same rules, except the browser can no longer write ratings (only the Cloud Functions can).
// Usage: node functions/make-rules.js   -> writes functions/firestore.rules.server  (publish THAT file once the functions are deployed)
"use strict";
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
const create = /(match \/ratings\/\{uid\} \{\s*allow read: if true;)[\s\S]*?allow delete: if false;/;
if (!create.test(src)) throw new Error("could not find the ratings block in firestore.rules");
const out = src.replace(create, "$1\n      // server mode: ratings are written by the Cloud Functions (ensureRating, submitSolo, settleQuickMatch), never by the browser\n      allow create, update, delete: if false;");
fs.writeFileSync(path.join(__dirname, "firestore.rules.server"), out);
console.log("wrote functions/firestore.rules.server");
