# Notes for whoever works on this next

Read `README.md` first for the architecture. This file is the stuff that isn't
obvious from the code — decisions, landmines, and how to verify things.

---

## 1. Verify by measuring, not by looking

Almost every real bug in this project was found by **rendering the page and
measuring the DOM**, and several were *missed* by reading the code carefully.

There's a headless Chromium available:

```python
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    pg = b.new_page(viewport={"width":390,"height":844})
    pg.goto("file:///path/to/index.html")
    pg.wait_for_timeout(500)
    print(pg.evaluate("() => getComputedStyle(document.getElementById('x')).position"))
```

Useful patterns that actually caught things:

- **Computed styles**, not source CSS — this is how the `.ghost` collision below was found.
- **`getBoundingClientRect()`** to check alignment/centering, rather than eyeballing.
- **Scrubbing an animation's timeline** (`anim.currentTime = t`) to sample motion —
  this proved the jump arc was a real parabola and that the letter ripple was
  staggered rather than firing in unison.
- **Overflow checks** at 390×844, 375×667 (iPhone SE), and 360×740. The SE is the
  binding constraint; things fit at 390 and clip at 375 constantly.
- **Stubbing APIs to force failure paths** — e.g. deleting `navigator.share` and making
  `execCommand` return `true` to reproduce the iOS clipboard lie.

## 2. Landmines

**CSS class collisions are invisible in code review.** `.ghost` was the board's
move-preview silhouette *and* `.btn.ghost` was a secondary button style. CSS
cascades per-property, so buttons silently inherited `position:absolute` and
`pointer-events:none` from the preview rule — they stacked in the corner and were
unclickable. Three different layout rewrites failed before rendering the page and
querying the CSSOM found it in a minute. The preview class is now `.move-ghost`.

**iOS lies about clipboard.** `document.execCommand('copy')` returns `true` without
copying, especially from an offscreen element. `navigator.clipboard` needs a secure
context and is often blocked in webviews. The share flow is therefore: native share
sheet → Clipboard API → a visible pre-selected textarea. Never claim "Copied!"
without confirming.

**`navigator.share` requires HTTPS.** On `file://` or `http://` it's simply undefined.
This looked like a code bug for two rounds; it wasn't.

**WebKit kills the CSS-animation restart trick.** `el.classList.remove(); void
el.offsetWidth; el.classList.add()` silently no-ops — Chrome-on-iPhone is WebKit too.
Use the Web Animations API (`el.animate()`), which always starts fresh.

**iOS won't fire `:active`** without a touch listener on the element. Pressed states
are driven by real `pointerdown`/`pointerup` handlers toggling a `.pressed` class.

**`:disabled { opacity: .35 }` leaks.** It was greying out the Super button in states
where that read as "broken" rather than "unavailable." Super overrides `:disabled`
and styles its states explicitly.

**iPadOS Safari reports its UA as `Macintosh`.** `/iPad/` tests fail on every iPad.
Detect via `navigator.maxTouchPoints`.

**`touch-action: manipulation`** on every tappable control, or rapid taps trigger
double-tap zoom. `user-scalable=no` in the viewport meta does *not* work on iOS.

**Absolute positioning is relative to the padding box.** A 44px ring pinned at
`top:0;left:0` inside a 44px button with a 1px border sits 1px off. Center with
`translate(-50%,-50%)`.

## 3. Design decisions (and why)

- **Flat.** No drop shadows. Pressed states are colour shifts.
- **Never rely on colour alone.** ✓/✗/★ are shape-distinct so they read for
  colourblind players and under reduced motion. Red/green was removed deliberately.
- **Gold = Super Check.** Blue = Check/accent. Green = valid. Ink = neutral.
- **Never scroll on mobile.** Explicit goal. Check overflow at 375×667 after any
  layout change.
- **Respect `prefers-reduced-motion`,** but never let it remove *information* — that's
  why the ✓/✗ badges exist alongside the nod/shake.
- **Motion should be physical.** The jump arc samples a real parabola
  (`y = -4h·t(1-t)`) rather than approximating with easing.
- **The board is "Free Board".** A 6×6 space with the target 4×4 marked. Pieces nudge
  each other aside; displaced pieces prefer to backfill the hole the mover left, so
  it reads as a swap. Strict mode was removed (it confused testers) but `setMode()`
  survives, unwired, because tests use it to inspect the packed 4×4.

## 4. Puzzle schema — the contract between streams

`data/puzzles.js` is `const PUZZLES = [...]` where each entry is:

```jsonc
{
  "solution": ["coda","apex","face","elks"],   // 4 rows; columns must also be words
  "pieces": [                                   // tiles 16 cells, no overlaps
    { "cells": [[0,0],[0,1]], "letters": "co" } // cells are [row,col]; >1 cell = omino
  ],
  "numSolutions": 1,
  "solutionWords": ["apex","aces", "..."],      // union of words across ALL solutions
                                                //   → powers Super Check
  "difficulty": 34,                             // 0–100, absolute anchors
  "stars": 2,                                   // 1–5
  "difficulty_raw": { "search_info": 4.9, "branching": 6.1, "...": 0 }
}
```

If the page needs a new field, the pipeline adds it — don't hand-edit `data/`.

## 5. Difficulty model

Two axes, blended 60/40, validated against Dave's gut-ranking (4/4 agreement):

- **search_info** — `−log₁₀ P(a random legal arrangement is a solution)`. Driven mostly
  by how many loose single tiles there are.
- **branching** — `Σ log₁₀(candidate words per line)` given the letters ominos lock in
  place. How many words are plausibly in play.

**The counter-intuitive finding that matters:** *rare letters make puzzles easier.*
They prune the candidate space hard. An early model scored obscurity and got this
backwards. Difficulty is about **ambiguity**, not obscurity — a puzzle where "ISK"
is locked into an omino is trivial because only DISK fits.

Anchors are absolute (not normalised against the current set) so a score means the
same thing forever as the library grows.

## 6. Known-open

- The word list (`tools/words4.txt`) is a **hand-typed placeholder** (~1,840 words).
  It is incomplete. A public daily that rejects real words will get roasted. The real
  list — curated, with a frequency column — is the critical path. Nothing ships on this one.
- `strangeness` (Thursday) and `rarity` (Saturday) metrics are specced but unbuilt.
  See `DAILY_SPEC.md`.
- Pentominoes need only new templates in `generate.py` — the fuser, solution counter,
  scorer, and move engine already handle arbitrary connected shapes.
- Word repetition needs a real usage budget: `AREA` appeared twice in a random draw
  of 8 puzzles.
- No OG tags / favicon / preview image yet.
