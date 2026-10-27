# Debugr.fun

a browser puzzle game where you write python-like code before a timer starts eating it. play it at **https://debugr.fun**

## what is this

you get a list of rules (like "your numbers must sum to exactly 37" or "one of your strings has to be a palindrome") and you type variable assignments to satisfy all of them at once:

```python
age = 42
name = "echo"
scores = [3, 8, 15]
```

there's a 45 second timer. hit **sync memory** (or ctrl+s) before it runs out, otherwise a red caret shows up and the editor deletes your code from the bottom, one line a second. it's stressful on purpose lol

easy has 1 rule, medium has 3, hard has 5.

## modes

- **singleplayer**: pick a difficulty and go
- **host / join**: make a room, send your friends the 4 letter code and race on the same task
- **daily challenge**: one task a day, same for everyone, ranked by time. new one at 00:00 UTC (press D on the menu)
- **puzzles**: a roadmap of endless levels, kinda like chess.com's. three tracks: fix the broken code, fill in the blanks, fix the type errors
- **leaderboard**: wins, best times and win streaks

esc goes back everywhere and ? shows all the shortcuts.

## how it works (the fun parts)

**taskEngine.js** builds a task backwards. it makes a hidden random solution first, then makes every rule from a real fact about it (its actual sum, its actual length..). so the rules can never contradict each other, no matter how many you stack.

**pyeval.js** is a tiny python interpreter I wrote so puzzles can be checked without loading pyodide. it only knows the basic stuff (variables, print, if/for, lists, a few builtins) but that's enough for the puzzles.

the daily challenge seeds math.random from the date while the task gets generated, so everybody gets the same one.

## run it yourself

it's just static files, no build step. serve the folder with anything (live server in vscode, `python -m http.server`) and open it.

the multiplayer stuff needs firebase though. put your own config in `config.js`, turn on anonymous sign in, create a firestore database and paste `firestore.rules` in. the leaderboard needs one composite index, firebase prints a link for it in the console the first time.

## notes

I used claude for debugging. the profile pics are ai generated with chatgpt, I can't draw T-T

found a bug or have an idea? there's a feedback button in settings, I read all of them 