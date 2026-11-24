# debugr_

```
         ██        ██
           ██    ██
             ████
           ████████
     ██    ████████    ██
       ██  ████████  ██
         █████  █████
     █████████  █████████
   ██    █████  █████    ██
         █████  █████
       ██  ███  ███  ██
     ██      ████      ██
```

[![tests](https://github.com/jamallyemin/Debugr.fun/actions/workflows/tests.yml/badge.svg)](https://github.com/jamallyemin/Debugr.fun/actions)

a browser coding-puzzle game. play it at **https://debugr.fun**
no build step, no framework: vanilla js + a little firebase. it also installs as an app (PWA).

## what is this

a spec shows up on the left, a bug starts crawling along your code on the right. you type variable assignments that satisfy every rule before it eats your last line:

```python
age = 6
name = "quartz"
scores = [3, 8, 11]
```

the rules talk to each other ("`name` is as long as `age`", "the biggest number in `scores` is `age + 5`", "use at most 4 lines") so you have to work out what depends on what instead of just filling things in.

the bug has an **appetite bar**. when it fills up it deletes your last line and counts a bite. **sync** (or ctrl+s) shoves it back, but it has a short cooldown so you can't just spam it. it sleeps for the first few seconds so you can read the spec.

- easy: 2 linked rules, slow bug
- medium: 3 variables, linked rules and a line limit, hungrier bug
- hard: 4 variables, 5 rules, tight line limit, fast bug

when you win you get a share card, a row of green / amber / red squares showing how close the bug got each second:

```
DEBUGR DAILY #312 [HARD]
23.4s · 0 bites · 4 day streak
🟩🟩🟩🟩🟨🟨🟩🟩🟩🟩🟩🟩🟨🟩🟩🟩
https://debugr.fun
```

## modes

- **singleplayer**: pick a difficulty and go
- **host / join**: make a room and share the 4 letter code or the invite link (`debugr.fun/?room=CODE`). the lobby shows everyone, who is ready, and the host picks difficulty, rounds (1 / best of 3 / best of 5), bug speed (normal / hungry / feral) and sabotage (every rule a rival meets makes your bug hungrier). 2 to 6 players, 3-2-1 countdown, a lane per player with rules met, round results with everyone's bug grid, the room stays open for a rematch, and if the host leaves someone else takes over.
- **daily challenge**: one task a day, same for everyone, ranked by time. new one at 00:00 UTC (press D on the menu)
- **puzzles**: a roadmap of endless levels, kinda like chess.com's. three tracks: fix the broken code, fill in the blanks, fix the type errors
- **leaderboard**: wins, best times and win streaks

esc goes back everywhere and ? shows all the shortcuts. on phones there is a row of symbol keys above the keyboard (= " [ ] , ( )) and the spec collapses so the editor gets the room.

the crt scanlines and grain are off by default now, you can turn them on in settings.


## how it works (the fun parts)

**taskEngine.js** builds a task backwards. it makes a hidden random solution first, then makes every rule from a real fact about it (its actual sum, its actual length, how two of its variables relate..). so the rules can never contradict each other, no matter how many you stack. rules are stored as `{key, params}` and every param is checked against a schema, so a room can only ever carry known rule types. nobody can sneak html or the solution through firestore.

**parser.js** reads the player's code (numbers, strings, lists, comments, multi-line lists, last assignment wins).

`node tests/engine.test.js` runs the tests: thousands of generated tasks per difficulty must be solvable, every variable must matter, no single line may win a medium/hard task, and tampered tasks have to be rejected.

**pyeval.js** is a tiny python interpreter I wrote so puzzles can be checked without loading pyodide. it only knows the basic stuff (variables, print, if/for, lists, a few builtins) but that's enough for the puzzles.

the daily challenge seeds math.random from the date while the task gets generated, so everybody gets the same one.

## learn

a full python course that runs **real python in your browser** (pyodide, loaded the first time you open Learn, then cached for offline use).

- **13 chapters, 84 lessons, 325 exercises**: basics, decisions, loops, collections, functions, input and errors, modules and files, classes, pythonic python, classes deeper, the standard library, under the hood
- exercise types: choice, fill, predict, fix, write. write exercises run your code against tests
- review mode for missed exercises, a playground, a bug skin for each of the first 10 chapters, a certificate at the end
- progress is saved in the browser and in cloud save, so it follows you between devices

## more stuff

friends + activity + friends leaderboard, reactions and chat presets in rooms, offline mode, shortcuts you can turn off, accessibility options, share cards, a privacy note (Settings > About). full history: [CHANGELOG.md](CHANGELOG.md)

## tests

```
node tests/engine.test.js     # tasks are always solvable
node tests/rooms.test.js      # match rules
node tests/rating.test.js     # elo
node tests/functions.test.js  # server mode logic
node tests/lessons.test.js    # learn answers, needs python3
```

github runs all of them on every push (`.github/workflows/tests.yml`). a red x means something broke. it never blocks the site.

## deploy

plain static files on github pages (`CNAME` = debugr.fun). push to main and it's live. there is a service worker (`sw.js`): when you add files, add them to `CORE` there and bump `VERSION`.

### firebase (rooms, friends, leaderboards, cloud save)

1. make a firebase project, add a web app, paste its config into `config.js`
2. Authentication: turn on **Anonymous**, and **Google** for account linking
3. create a Firestore database, paste `firestore.rules` into Rules and Publish. **publish again whenever it changes**
4. Firestore > TTL: add a policy on collection group `rooms`, field `expireAt`

### server mode (optional, needs the paid Blaze plan)

cloud functions verify ratings so nobody can fake them. off by default (`USE_CLOUD_FUNCTIONS = false`). step by step: [functions/BLAZE.md](functions/BLAZE.md)

## make it an app

the manifest, icons and service worker already make it installable from the browser. for an android apk wrap it with [PWABuilder](https://www.pwabuilder.com) or Bubblewrap (trusted web activity), or Capacitor for a native shell.

## files

```
index.html style.css script.js    the game screen
taskEngine.js parser.js           puzzle generator + code reader
pyeval.js                         tiny python interpreter for puzzle checks
lessons*.js learn.js pyrun.js     the course + in-browser python runner
rooms.js roomlogic.js             multiplayer
firebaseclient.js cloudsave.js    firebase talk
functions/                        server mode (cloud functions)
tests/                            all tests
```

## notes

I used claude for debugging. the profile pics are ai generated with chatgpt, I can't draw T-T

found a bug or have an idea? there's a feedback button in settings, I read all of them
