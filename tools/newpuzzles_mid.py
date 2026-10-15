#!/usr/bin/env python3
"""Like newpuzzles.py, but with piece templates that leave 4-5 single tiles, to fill
the gap between 1-star and 3-star puzzles (the default templates leave either ~3
singles or 6+). Writes pool_mid_<seed>.pkl, which extend.py reads with the rest.
Prints counts only.

    python newpuzzles_mid.py SEED SECONDS
"""
import json, random, sys, time, pickle
from collections import Counter
import generate
import score as SC

SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 1
BUDGET = float(sys.argv[2]) if len(sys.argv) > 2 else 240.0
random.seed(SEED)
MID_TEMPLATES = [
    [4, 4, 2, 2, 1, 1, 1, 1],        # 4 singles
    [4, 3, 3, 2, 1, 1, 1, 1],
    [3, 3, 3, 3, 1, 1, 1, 1],
    [4, 3, 2, 2, 1, 1, 1, 1, 1],     # 5 singles
    [3, 3, 3, 2, 1, 1, 1, 1, 1],
]
assert all(sum(t) == 16 for t in MID_TEMPLATES)

words8 = lambda g: set(g) | {''.join(g[r][c] for r in range(4)) for c in range(4)}
multiset = lambda g: ''.join(sorted(''.join(g)))
EXCLUDE = {tuple(p["solution"]) for p in json.load(open("puzzles.json"))}
try:
    EXCLUDE |= {tuple(l.split()) for l in open("retired.txt") if l.strip() and not l.startswith("#")}
except FileNotFoundError:
    pass
EX_MS = {multiset(g) for g in EXCLUDE}

candidates = [g for g in generate.GRIDS if generate.distinct8(g)]
random.shuffle(candidates)
pool, tried, t0 = [], 0, time.time()
for grid in candidates:
    if time.time() - t0 > BUDGET:
        break
    if grid in EXCLUDE or multiset(grid) in EX_MS:
        continue
    tried += 1
    pieces = generate.fuse(MID_TEMPLATES[tried % len(MID_TEMPLATES)])
    if pieces is None or not generate.pieces_are_clean(grid, pieces):
        continue
    sols = generate.count_solutions(grid, pieces)
    if len(sols) != 1:
        continue
    sol_words = set()
    for s in sols:
        sol_words |= words8(s)
    p = {"solution": list(grid),
         "pieces": [{"cells": [list(c) for c in pc], "letters": ''.join(grid[r][c] for r, c in pc)} for pc in pieces],
         "numSolutions": 1, "solutionWords": sorted(sol_words)}
    p.update(SC.score_puzzle(p))
    pool.append(p)
pickle.dump(pool, open(f"pool_mid_{SEED}.pkl", "wb"))
c = Counter(p["stars"] for p in pool)
print(f"tried {tried} grids in {time.time() - t0:.0f}s -> {len(pool)} single-solution puzzles; by stars: " +
      ', '.join(f'{s}* {c[s]}' for s in sorted(c)))
