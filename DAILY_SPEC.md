# Daily Danagram — Spec

Status: draft for review. Everything below reflects decisions made so far; open
questions are flagged as **OPEN**.

---

## 1. Core model

| Decision | Choice | Why |
|---|---|---|
| Cadence | One puzzle per day | — |
| Rollover | **Local midnight** | Simplest correct impl (no DST, no tz library). Nobody sees a weird rollover hour. Wordle's model. |
| Numbering | `Danagram #N`, N = days since epoch + 1 | Maps to a calendar date, so shares line up across timezones. |
| Epoch | **OPEN** — pick a launch date; it's permanent | Baked into every shared result forever. |
| Bank | **90 puzzles** (a season) | Enough runway to watch real data before committing to more. |
| Day 91 | Freeze on the last puzzle + a note | Fails gracefully instead of 404ing or silently looping. |
| Backend | None. Static on GitHub Pages | Progress lives in `localStorage`. |
| Streaks | **Not in v1** | The reason to return is the puzzle, not a number you're afraid to lose. |
| Archive | Not in v1 | Planned later. |

### Rollover implementation
```
dayIndex = floor((localMidnightToday - localMidnightEpoch) / 86400000)
puzzle   = BANK[min(dayIndex, BANK.length - 1)]   // freeze at the end
```
No timezone math. The device's own calendar date is the only input.

---

## 2. The week (NYT model)

Each day has a **character**, not just a difficulty. This is the heart of it.

| Day | Feel | Character constraint | Difficulty band |
|---|---|---|---|
| Mon | Easiest | — | 30–42 |
| Tue | Easy | — | 40–52 |
| Wed | Medium | — | 50–62 |
| Thu | **Weird** | Strangest ominos; pentominoes allowed | 55–72 |
| Fri | Hard | — | 70–82 |
| Sat | **Hardest words** | Lowest word frequency (obscure but fair) | 78–92 |
| Sun | **Showcase** | Most single tiles (≥8) | 62–76 |

### ⚠️ The tension worth understanding

The day-characters are **partly orthogonal to the difficulty score**, and two of
them fight it:

- **Thursday** — fusing more cells into big/strange pieces means *fewer loose
  singles*, which **lowers** search difficulty. Thursday scores easy but feels tricky.
- **Saturday** — obscure words use rare letters, which **prune** the candidate space.
  Saturday scores lower but feels harder.
- **Sunday** — many singles **maximizes** search difficulty, so it naturally scores
  *hardest* when we want medium-hard.

**Therefore:** the selector filters by **character first**, then targets a difficulty
band *within* that bucket. A Thursday 60 and a Saturday 60 are hard in different
ways — which is the point, and is true of NYT crosswords too.

---

## 3. Metrics

### Existing (built, validated against Dave's gut-checks 4/4)
- **search_info** — `−log₁₀ P(random legal arrangement is a solution)`. Driven mostly
  by the number of loose single tiles.
- **branching** — `Σ log₁₀(candidate words per line)` given omino-locked letters.
  Measures how many words are plausibly in play.
- **difficulty** — `0.6·search + 0.4·branching`, normalised against absolute anchors
  → 0–100 and 1–5 stars.

### To build
- **strangeness** (Thursday) — how far pieces deviate from a rectangle:
  ```
  piece_strange  = (1 − boundingBoxFill) + 0.15·max(0, size − 3)
  strangeness    = Σ over ominos
  ```
  A 2×2 square or straight line fills its box (fill = 1.0 → tame). An S/Z/T/L
  tetromino fills 4 of 6 (0.67 → strange). A plus-shaped pentomino fills 5 of 9
  (0.56 → strangest). Since pieces never rotate, an awkwardly-oriented L is
  genuinely harder to place.
- **rarity** (Saturday) — mean word frequency across the solution.
  **Blocked on the word list's frequency column.**

### Pentominoes
New templates with a 5-cell piece, e.g. `[5,4,3,2,1,1]`, `[5,3,3,2,1,1,1]`,
`[5,5,3,1,1,1]`. The fuser, solution counter, scorer, and game engine already
handle arbitrary connected shapes — no engine work needed, just templates.

---

## 4. Page structure

```
┌─────────────────────────────┐
│  Daily Danagram        (?)  │   ← help button, top right
│  #47 · Thursday, Oct 5      │
├─────────────────────────────┤
│         [ board ]           │
│  Spread Shuffle ↶ ↷ ★Super Check │
│  Word bank drawer ▲         │
└─────────────────────────────┘
```

- **Onboarding** — modal on first visit, dismissible. Collapses into a `?` button in
  the top-right that reopens it any time. Stored in `localStorage`.
- **Solved state** — Congratulations + check-history summary + share. Since there are
  no streaks, this needs a clear *"come back tomorrow"* with a countdown to local
  midnight.
- **Share text** — already built:
  ```
  Danagram #47
  ➡️☑️☑️☑️✖️⬇️☑️☑️☑️✖️
  ➡️〰️⭐✖️⭐⬇️✖️✖️✖️✖️
  ➡️✔️✔️✔️✔️⬇️✔️✔️✔️✔️🎉
  2 Checks, 1 SuperCheck
  ```
- **Link preview** — OG tags + a static preview image so a shared `danagram.fun`
  looks like a product, not a bare URL.

---

## 5. Risks

1. **Word list is the critical path.** The current list is my hand-typed placeholder
   (~1,840 words). A public daily that rejects real words will get roasted. Nothing
   ships until the real list lands. *(In progress on Dave's side.)*
2. **Yield.** 90 puzzles ÷ 7 day-types ≈ 13 per bucket. Each must satisfy: character
   constraint + difficulty band + exactly one solution + no word reuse. Some buckets
   (esp. Sunday: many singles *but* medium difficulty) may be thin. **We won't know
   until we run it** — may need to relax a band or widen templates.
3. **Word repetition.** `AREA` showed up twice in a random draw of 8. Over 90 puzzles
   this needs a real usage budget, not just a per-set cap.
4. **Epoch is permanent.** Once shared, `#47` means a specific date forever.
5. **localStorage only.** Clearing the browser wipes progress. Acceptable with no
   streaks; would matter more later.

---

## 6. Build order

| Phase | Work | Blocked on |
|---|---|---|
| 1 | Swap in the real word list; regenerate the grid database | **Word list** |
| 2 | Build `strangeness` + `rarity` metrics; add pentomino templates | Word list (rarity) |
| 3 | Season selector: character buckets + difficulty bands + repetition budget → 90 puzzles | 1, 2 |
| 4 | Daily mechanism: local-midnight rollover, numbering, freeze-at-end | — (can start now) |
| 5 | Onboarding modal + `?` button; "come back tomorrow" countdown | — (can start now) |
| 6 | OG tags, preview image, favicon, polish pass | — |
| 7 | Ship | all |

Phases **4 and 5 are unblocked** and can proceed while the word list is finished.

---

## 7. Open questions

- **Epoch date** — when is Danagram #1?
- Should the header show the date, the number, or both?
- Does the help modal explain Super Check, or just the core rules?
- Ko-fi: post-launch (agreed), but where does it live when it arrives?
