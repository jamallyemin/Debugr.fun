# changelog

newest first-ish: v28 is at the top, older notes below in the order they were written.

## v29: tutorial spotlight fix
- the menu guide ("This is your timer") could pop up on top of the tutorial tour at the same time. The tutorial now closes any open menu guide, and the menu guide waits while the tutorial is showing.

## v28: more Learn, privacy note, installable app, tidy
- **3 new Learn chapters** (84 lessons, 325 exercises): *Classes, deeper* (property, class/static methods, dataclasses, Enum, namedtuple, `__len__`/`__iter__`, `with`, ABC, type hints), *The standard library* (re, itertools, functools, deque/defaultdict/heapq/bisect, Decimal/Fraction/statistics, pathlib, async driven by hand because the browser version can't run `asyncio.run`) and *Under the hood* (copies and `is`, global/nonlocal, bit tricks, bytes, frozenset/slices). Everything is checked in real python3 by `node tests/lessons.test.js`. The certificate now needs all 13 chapters.
- **Learn progress is in cloud save** (new `learn` field, merged by union, so two devices never lose lessons).
- **Privacy note**: Settings > About, and a link in the menu footer. Says what is stored, where, and how to ask for deletion.
- **Install as an app**: `manifest.webmanifest` + icons + the service worker. Works as a PWA and is ready for Bubblewrap/PWABuilder (android) or Capacitor.
- **Error details in feedback**: a ticked-by-default box adds the last few script errors and the screen name (`tech` field).
- **Tests on every push**: `.github/workflows/tests.yml` runs all test files on GitHub. It never blocks the live site, it just shows a red x on a commit if something broke.
- **Tidy**: removed the unused skin PNG probe and the `skins/` folder, server-mode rules now live in `functions/firestore.rules.server`, how-to for Blaze is `functions/BLAZE.md`, version notes moved here from the README.
- **After updating**: re-publish `firestore.rules` (new `learn` and `tech` fields).

## v3: rules, themes, settings, tutorial
- **69 rule types** (taskEngine.js), all generated from a hidden reference solution so every puzzle is solvable. Tasks can also use `True`/`False` variables and occasional twist rules (a forbidden name, an exact variable count, "first line defines X").
- **Themes** (theme.js): 11 presets, three unlockable (Synthwave, Gameboy, Matrix), plus a custom editor. Colours only; fonts are locked so a theme can't break layout, and a contrast guard keeps text readable. Share codes look like `DBG1:...`.
- **Settings** (prefs.js): new PLAY and ACCESS tabs (bug speed, forgiving mode, hints, auto-close brackets, line numbers, reduced motion, colour-blind patterns), plus save export/import.
- **Tutorial** (tutorial.js): five playable missions on the real game screen.
- Tests: `node tests/engine.test.js` and `node tests/rooms.test.js`.

## v4: ratings and the new leaderboard
- **Two Elo ratings** (`rating.js`, unit tested: `node tests/rating.test.js`): one for the solo bug game, one for the puzzle path. Everyone starts at 1000 with 10 placement games (bigger steps, shown as `1000?`). Tiers: Larva, Grub (800), Beetle (1100), Mantis (1400), Hornet (1700), Apex (2000).
- **Bug game**: the "opponent" is the task's rating (from difficulty and rule count). Wins score by bites (clean = full score), and leaving a run after the bug woke up counts as a loss. Daily, rooms and tutorial runs are not rated.
- **Puzzle path**: only the first clear of a level is rated, against that level's fixed rating (shown beside each level). Hints lower the score, but a solved level never scores below 0.3.
- **Fairness**: ratings come only from your own solo play, so nobody can trade wins. `firestore.rules` allows one game per write, a rating step of at most 70, best times that only go down, and a daily gain cap of 150. The rating boards (`boardBug`/`boardPuz` fields) only list linked Google accounts that finished placement. This stops casual tampering, but it cannot prove a result really happened: that would need a Cloud Function.
- **Leaderboard**: one `ratings/{uid}` document per player, so every tab (Rating, Best times, Wins, Streaks) is one sorted query. Wins are real totals (the old board counted wins inside the fastest 300 scores), streaks show your best ever, and your own row is pinned when you are outside the top. On first sync, wins and best times are carried over from your old `scores` entries.
- **After updating**: re-publish `firestore.rules`.

## v5: skins, accent colour, server-verified ratings, quick match
- **Bug skins** (`skins.js`): pixel-art bugs for each tier (Larva, Grub, Beetle, Mantis, Hornet, Apex), unlocked by the *peak* rating you reached, plus **Rookie** for finishing the tutorial. Pick one in Settings; it changes every bug in the game. Rookie is stored in this browser only (not in cloud save).
- **Accent colour**: Settings > Theme has an accent picker (the amber highlight). The contrast guard still applies.
- **Server mode (optional)**. `config.js` has `USE_CLOUD_FUNCTIONS = false`. In that default mode everything works as in v4 and quick match / the RACE tab stay hidden. To turn it on:
  1. Upgrade the Firebase project to the **Blaze** plan (functions need it; a small game stays well inside the free quota).
  2. `cd functions && npm install`, then from the project root `firebase deploy --only functions,firestore:rules`.
  3. Before deploying run `node functions/sync-shared.js` (copies the shared game code into `functions/shared`) and `node functions/make-rules.js` (regenerates `functions/firestore.rules.server`). Publish **`functions/firestore.rules.server`** as your rules; it stops browsers writing ratings at all.
  4. Firestore > TTL: add policies on `queue.expireAt` and `pairs.expireAt`.
  5. Set `USE_CLOUD_FUNCTIONS = true` in `config.js`.
  Going back: set the flag to false and publish `firestore.rules` again.
- **What the server checks**: it rebuilds the task from its seed, re-runs your submitted code, and applies the Elo change itself (placement, step cap, daily cap, minimum time between games). Time and bites are still reported by the browser, so a scripted solver can still farm slowly; it just can't invent wins.
- **Quick match**: rated 1v1 race for linked Google accounts. Pairs by rating (window widens while you wait), max 3 rated games against the same opponent per day, leaving after the start counts as a loss. A third rating (RACE) appears on the leaderboard.
- Tests: `node tests/functions.test.js` runs the server logic against an in-memory fake Firestore. **Not tested against real Firebase, the emulator or deployed functions.**

## v6: puzzle screen and settings redesign
- **Puzzles**: two columns on desktop (rating card with tier ladder, last-30 rating curve, solved / average time / weakest tiles, NEXT PUZZLE button; track tabs and a round-node roadmap on the right). One column on phones. The chart and tiles come from a small local history (`debugr_puz_stats`, this browser only), so they start filling after your first clears. "Weakest" needs 3+ clears in a track and picks the one where you use the most hints.
- **Settings**: wider window with a side menu on desktop, scrolling tab chips and a full-screen sheet on phones, more space between rows, short descriptions under labels.

## v7: bug skins you draw yourself
Skins are now colour variants of the classic bug. To use your own art, put a PNG named after the skin in `skins/` (`larva.png`, `rookie.png`, `grub.png`, `beetle.png`, `mantis.png`, `hornet.png`, `apex.png`; square, transparent background, 256x256). A skin with a picture uses it automatically; no code change. Picture skins keep their own colours, so they don't turn amber/red in the solo lane.

## v8: music, streak skins, share picture
- **Music** (`music.js`): a quiet chiptune loop generated in the browser, so there are no audio files. Calm on menus and puzzles, faster in a solo game or race. It starts after your first click and pauses when the tab is hidden. Settings > General has an on/off button and its own volume slider.
- **Streak skins**: Ember (7 day daily streak), Gold (30), Ghost (100). They unlock by your longest streak ever.
- **Share picture** (`sharecard.js`): SHARE on the puzzle rating card makes a 1080x1350 image (bug, rating, tier, streak) and opens the phone share sheet, or downloads a PNG on desktop.
- `robots.txt` added; it points search engines at `sitemap.xml`.

## v10 (+ spotlight fix): unlocks are a chain, with a guide for each step
Each unlock is earned by using the one before it, so every new feature gets tried:
1. Tutorial (the 5 missions, unchanged).
2. Win 5 solo games opens **Puzzles + Daily**.
3. Clear 5 puzzles or dailies (any mix) opens **Rooms**. Rooms need Puzzles open first.
4. Finish a room race opens **Leaderboard + Quick match**. (Finishing 10 rated games also works, for people with nobody to race.)
Each time something opens, a short guided tutorial part for it starts by itself (puzzles + daily, rooms, leaderboard + quick match). The checklist on the home page only lights up the current goal. Existing players skip every step their saved progress already covers; "I already know how to play" opens everything. Invite links always work.
All the goals are the `FEATURES` table at the top of `unlocks.js` (change a `goal` number there to retune it); the guide texts are `CHAPTERS`. A menu element becomes lockable with `data-unlock="<id>"` and `data-unlock-name="<label>"`.
Not built yet: friends/profiles, and the cleaned-up menu from mockup boards 6 and 7.

## v13: tidier menu, profile and friends
- Menu spacing tightened; a Friends row was added (key 6). Click your PLAYER card to open your profile.
- Profile: ratings, stats, and your friend code. Friends panel (opens together with Rooms): FRIENDS / REQUESTS / ADD,
  CHALLENGE hosts a room and sends your friend an invite banner.
- New file friends.js; new Firestore collections friendCodes, friendReqs, friendships, invites.
  **Publish the new rules**: copy firestore.rules (or functions/firestore.rules.server in server mode) into Firebase Console > Firestore > Rules.

## v14: profile edit, log out, leave notices
- Top bar: the EDIT button is now LOG OUT (in-game confirm; warns if nothing is linked to Google). Click your name or picture to open the profile.
- Profile: banner, EDIT NAME and picture editing (both dialogs have an X), badges.
- Rooms: everyone is told when a player leaves, and when the host leaves and you take over.

## v15
- Header: the ESC BACK chip is now an X button (red on hover, Esc still works); log out is a door icon; bottom BACK buttons removed.
- Friends row removed from the menu: friends live in your profile (click the PLAYER card; an amber dot shows waiting requests).

## v16
- The close X sits in the top-left corner of every opened screen (red on hover, Esc still works); the header no longer has a back chip.
- Menu is vertically centred with the footer pinned to the bottom; the PLAYER card is gone (click your name or picture in the top bar for your profile; an amber dot shows friend requests).

## v17
- X button no longer overlaps screen headers (game, puzzles, phone layouts).
- Leaderboard: one row of choices (SOLO / PUZZLES, sort by rating / best time / win streak, FRIENDS ONLY). WINS moved to your profile.
- Rooms: players send a heartbeat every 20 s; anyone silent for 100 s is removed (closed tab, lost connection).
  **Publish the updated firestore.rules** (it adds a `seen` field and the timeout delete rule).

## v18
- Menu rows reordered to match their shortcut keys: 1 Play Solo, 2 Puzzles, 3 Host, 4 Join, 5 Leaderboard (D = Daily).

## v19: batch 2
- Combo (solo and daily): every rule satisfied for the first time since your last bite adds 1; a bite resets it. Cosmetic only, it never changes the bug speed or your rating. Best combo >= 3 is mentioned on the result screen.
- HINT button (solo only, Alt+H, 2 per run): shows one line of the answer, makes the bug hungrier, and counts as a bite for rating.
- Result screen: a collapsed WHAT BIT YOU section lists each eaten line, when, and which rule was still open.

## v20: Learn (Python basics)
- New **LEARN** row in the menu (graduation-cap icon, key 2). It opens right after the tutorial; Puzzles still open after 5 solo wins. Menu keys are now 1-6 in the order shown.
- 10 lessons in 2 chapters (`lessons.js`, plain data); chapters 3-6 come next. Each lesson: read, try, 3-4 exercises (fill, predict, fix, write). Code runs in the game's own mini Python (`pyeval.js`, now with `**`, f-strings, `round`, `.title/.strip/.replace/.capitalize`), so it works offline.
- The bug gives a tip per lesson. HIDE squashes it and it falls off screen; the small "?" brings it back.
- Tutorial / guide spotlights: the card now sits below, above or beside what it points at (never on top of it), and the target is scrolled to the middle first.
- Profile picture frame no longer has the banner line cutting through it.
- `tests/lessons.test.js` checks every exercise is solvable and not already solved.

## v21: full Learn course, real Python, reorderable menu
- **Learn now runs real Python** (Pyodide, loaded once from the jsDelivr CDN in a Web Worker, about 10 MB, cached by the browser). A cute full-screen loading screen with the bug shows on first use. Runaway loops are stopped after 5 seconds.
- **10 chapters, 63 lessons, 243 exercises** (`lessons.js`, `lessons3-7.js`): basics, decisions, loops, collections, functions, input and errors, modules and files, classes, and Pythonic Python (comprehensions, lambda, *args, generators, decorators, match). `node tests/lessons.test.js` checks every model answer in real python3.
- **Finished lessons** show the bug sprite in a green circle; the current lesson shows its number, highlighted in green.
- **Menu bars can be dragged** by the 6-dot grip (or Alt+Arrow on the focused grip). Number keys follow the order on screen. The order is saved; Settings has a reset button.

## v22: chapter skins, reactions, friend activity, friends leaderboard
- **Learn rewards:** finishing every lesson of a chapter unlocks one colour bug skin (Print, Variable, Branch, Loop, List, Function, Exception, Module, Class, Pythonic). Each chapter shows its skin chip.
- **Reactions:** five emoji buttons on the room results screen float up on everyone's screen. Stored as `react` / `reactAt` on the player document.
- **Friend activity:** the Friends panel shows a green dot and what each friend is doing (`activity.js`, `presence/{uid}`). Only friends can read it. Settings > Privacy turns it off and deletes the note.
- **Leaderboard:** ALL / FRIENDS toggle. FRIENDS reads each friend's rating document, so friends outside the top 100 still show.
- **Publish `firestore.rules` again** (new `presence` collection, `react` fields). `functions/firestore.rules.server` has the same changes.

## v23: review mode, chat presets, mistake review, offline mode, accessibility
- **Learn review:** wrong exercises are remembered; the REVIEW button on the Learn screen replays up to 8 of them. Right answers clear them.
- **Chat presets:** six quick phrases (gg, well played, again?, ready!, one sec, so close) in the lobby and on the results screen, shown as bubbles. `say` / `sayAt` on the player document; same rules file as reactions.
- **Mistake review:** "WHAT BIT YOU" opens by default after a solo run with bites, with the line that would have fixed each rule and a full-solution reveal.
- **Offline mode:** `sw.js` saves the site, Google Fonts and Python (Pyodide) after the first visit. Solo, puzzles, daily and Learn work with no connection; host, join, quick match and the leaderboard show a message. When you add files, add them to CORE in `sw.js` and bump VERSION.
- **Accessibility:** `a11y.js` (dialog role, focus kept inside pop-ups and returned after, screen-change announcements), a fallback focus ring everywhere, forced-colors support. Reduce motion and pattern colours were already in Settings.
- **Publish `firestore.rules` again** (adds `say` / `sayAt`).

## v24: playground, certificate, profile extras
- **Playground** (Learn screen > PLAYGROUND): run any Python with optional typed input, seven examples, code kept between visits. Nothing is checked or counted.
- **Certificate** (appears on the Learn screen after all 10 chapters): `certificate.js` draws a picture in the browser with name, date and the bug; DOWNLOAD or SHARE.
- **Profile extras:** Learn progress bar, a 21-colour bug skin collection, and SHOW OFF TO FRIENDS (one badge or skin, stored as `showcase` on the player document, shown in friends' lists). `firestore.rules` caps it at 40 characters, so **publish the rules again**.

## v25: shortcut warning, Learn links in mistake review
- **Yellow ! next to "Shortcuts ?"** on the menu opens a heads-up: the site's shortcuts (letters, 1-6, Ctrl+S / Ctrl+Enter / Alt+H in games) can clash with the browser, extensions or screen readers. It has a switch, also in Settings ("Use the site's keyboard shortcuts"). Off = no site shortcut is taken over (Ctrl+S saves the page again, number hints are hidden); Esc and mouse/touch still work. `SiteKeys` in `keys.js`.
- **Mistake review links to Learn:** each bitten rule shows a LEARN button with the matching lesson (numbers, comparisons, text, lists...). Lessons you have not reached on the path show as LOCKED and cannot be opened.
- With shortcuts on, a game on screen also blocks Ctrl+P, Ctrl+D, Ctrl+G, Ctrl+H, Ctrl+J and Alt+Left/Right so a run is not interrupted; off = nothing is blocked anywhere.
- Esc now also closes the heads-up, certificate and friends pop-ups.
