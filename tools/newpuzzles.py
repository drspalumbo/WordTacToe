#!/usr/bin/env python3
"""Build a pool of candidate puzzles that each have EXACTLY one solution,
score them, and save the pool for a difficulty-spread pick."""
import json, random, sys, time, pickle
from collections import Counter

import generate
import score as SC

SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 20260714
BUDGET = float(sys.argv[2]) if len(sys.argv) > 2 else 130.0
random.seed(SEED)

words8 = lambda g: set(g) | {''.join(g[r][c] for r in range(4)) for c in range(4)}
multiset = lambda g: ''.join(sorted(''.join(g)))

# Never repeat a puzzle players have seen: the current set plus retired.txt
# (everything ever shipped). Also skip grids with the same letters, or sharing
# more than 2 of their 8 words with one of those.
EXCLUDE = {tuple(p["solution"]) for p in json.load(open("puzzles.json"))}
try:
    EXCLUDE |= {tuple(l.split()) for l in open("retired.txt")
                if l.strip() and not l.startswith("#")}
except FileNotFoundError:
    pass
EX_MS = {multiset(g) for g in EXCLUDE}
EX_WORDS = [words8(g) for g in EXCLUDE]
print(f"excluding {len(EXCLUDE)} already-seen grids")

candidates = [g for g in generate.GRIDS if generate.distinct8(g)]
random.shuffle(candidates)
print(f"{len(candidates)} candidate grids with 8 distinct words")

pool = []
t0 = time.time()
tried = 0
for grid in candidates:
    if time.time() - t0 > BUDGET:
        break
    if grid in EXCLUDE or multiset(grid) in EX_MS:
        continue
    if any(len(words8(grid) & ws) > 2 for ws in EX_WORDS):
        continue
    tried += 1
    template = generate.TEMPLATES[tried % len(generate.TEMPLATES)]
    pieces = generate.fuse(template)
    if pieces is None:
        continue
    sols = generate.count_solutions(grid, pieces)
    if len(sols) != 1:                      # single-solution only
        continue
    sol_words = set()
    for s in sols:
        sol_words.update(s)
        sol_words.update(''.join(s[r][c] for r in range(4)) for c in range(4))
    p = {
        "solution": list(grid),
        "pieces": [{"cells": [list(c) for c in pc],
                    "letters": ''.join(grid[r][c] for r, c in pc)} for pc in pieces],
        "numSolutions": 1,
        "solutionWords": sorted(sol_words),
    }
    p.update(SC.score_puzzle(p))
    pool.append(p)

print(f"tried {tried} grids in {time.time()-t0:.0f}s -> {len(pool)} single-solution puzzles")
pickle.dump(pool, open("pool.pkl", "wb"))
diffs = sorted(x["difficulty"] for x in pool)
print("difficulty range:", diffs[:5], "...", diffs[-5:] if len(diffs) > 5 else "")
