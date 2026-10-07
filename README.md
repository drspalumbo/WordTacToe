# Danagram

A daily 4×4 double word square. Every row and column must spell a word. Some tiles
are fused into **ominos** that move as one rigid piece and never rotate.

Live: **danagram.fun** · Playtest build: **danagram.fun/playtest**

---

## There is no build step

This is the most important thing to know. The site is plain files served straight
from the repo by GitHub Pages. You edit a file, push, and it's live.

```
index.html      the daily page — structure only
styles.css      all CSS
game.js         all game logic
data/words.js   const WORDS / WORDSET   ← GENERATED, do not hand-edit
data/puzzles.js const PUZZLES           ← GENERATED, do not hand-edit
playtest/       the playtest build (single self-contained file, frozen)
classic/        the original 2023 3×3 Danagram, served at danagram.fun/classic
wordsort/       the word-list curator (swipe app); progress.json holds the decisions
tools/          Python pipeline + tests — NOT part of the site
```

`index.html` loads `data/words.js`, `data/puzzles.js`, then `game.js` as ordinary
`<script>` tags, so they execute in order and `game.js` can just use `WORDS` and
`PUZZLES` as globals. No bundler, no fetch, no async init.

Opening `index.html` directly off disk works too (`file://`) — handy for previewing.

---

## Two streams, one interface

Work splits cleanly in two. They meet at exactly one file.

| Stream | Owns | Produces / consumes |
|---|---|---|
| **Pipeline** | `tools/*.py`, `tools/words4.txt` | **produces** `tools/puzzles.json` + `data/puzzles.js` |
| **Page** | `index.html`, `styles.css`, `game.js` | **consumes** `data/puzzles.js` |

Because the seam is a data file, the two streams never edit the same thing.
See `AGENTS.md` for the puzzle schema (the contract) and the gotchas, and
`RECIPES.md` for exactly which files to hand an agent for a given task — it's
usually 6 files, not the repo.

---

## Working on the page (no tools needed)

Edit `index.html`, `styles.css`, or `game.js`. That's it. Push and it's live.

**Never edit `data/*.js` by hand** — they're regenerated and your changes will be
silently overwritten.

## Working on the pipeline (needs Python)

```bash
cd tools
python3 generate.py        # enumerate grids → fuse ominos → score → puzzles.json
                           #   ALSO writes ../data/puzzles.js and ../data/words.js
python3 score.py           # re-score an existing puzzles.json
python3 difficulty.py      # print the difficulty breakdown table
```

`generate.py` writes `puzzles.json` **and** the browser copies together, so they
can't drift. If you change `words4.txt`, re-run `generate.py`.

First run takes ~9s to enumerate all 428k valid grids; it caches to `grids.pkl`
(regenerable, don't commit it).

## Tests

```bash
cd tools && node test.js
```

Runs the real engine headlessly against a DOM stub — `test.js` loads
`data/words.js`, `data/puzzles.js`, and `game.js` in the same order the browser
does, so it tests exactly what ships. No build artifact in between.

Some checks are randomised (they hammer the move engine with 400 random moves),
so run it a few times when changing the engine.

---

## The daily

`game.js` has one constant that matters:

```js
const EPOCH = '2026-07-16';   // Danagram #1
```

**This is permanent once you launch.** It defines what `#47` means in every shared
result forever. Set it to the real launch date before going live.

Rollover is **local midnight** — the device's own calendar date is the only input.
No timezone math, no DST. When the bank runs out, it freezes on the last puzzle
rather than breaking.

`?dev=1` shows the puzzle nav so you can page through the whole bank while testing.

---

## Deploying

Push to the default branch. GitHub Pages serves the repo root.
Make sure **Settings → Pages → Enforce HTTPS** is on — the native share sheet
(`navigator.share`) requires a secure context and silently disappears without it.
