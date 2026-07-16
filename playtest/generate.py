#!/usr/bin/env python3
"""
Danagram 4x4 generator pipeline.

1. Enumerate ALL valid 4x4 "double word squares" (every row L->R and column
   T->B is a word) from words4.txt, using prefix-set pruning.
2. Fuse a solved grid into ominos (random partition from a size template).
3. Count "achievable solutions": distinct valid grids sharing the puzzle's
   letter multiset into which the ominos embed (translation only, no rotation).
4. Emit a JSON puzzle set for the prototype.

Usage: python3 generate.py [--sample N]
"""
import json, random, sys, time
from collections import defaultdict, Counter

random.seed(20260707)

# ---------------------------------------------------------------- word list
WORDS = sorted({w for w in open('words4.txt').read().split()
                if len(w) == 4 and w.isalpha()})
WORDSET = set(WORDS)
print(f"word list: {len(WORDS)} words")

# NEXT[p] = set of letters that can extend prefix p toward some word
NEXT = defaultdict(set)
for w in WORDS:
    for i in range(4):
        NEXT[w[:i]].add(w[i])

BY_FIRST = defaultdict(list)
for w in WORDS:
    BY_FIRST[w[0]].append(w)

# ------------------------------------------------------------ grid generation
def generate_all_grids():
    grids = []
    rows = []

    def rec(cp0, cp1, cp2, cp3):
        k = len(rows)
        n0, n1, n2, n3 = NEXT[cp0], NEXT[cp1], NEXT[cp2], NEXT[cp3]
        # candidate rows must start with a letter that keeps column 0 alive
        for first in n0:
            for w in BY_FIRST[first]:
                if w[1] in n1 and w[2] in n2 and w[3] in n3:
                    if k == 3:
                        grids.append((*rows, w))
                    else:
                        rows.append(w)
                        rec(cp0 + w[0], cp1 + w[1], cp2 + w[2], cp3 + w[3])
                        rows.pop()

    rec('', '', '', '')
    return grids

import os, pickle
t0 = time.time()
if os.path.exists('grids.pkl'):
    GRIDS = pickle.load(open('grids.pkl', 'rb'))
    print(f"loaded {len(GRIDS)} cached grids")
else:
    GRIDS = generate_all_grids()
    pickle.dump(GRIDS, open('grids.pkl', 'wb'))
    print(f"generated {len(GRIDS)} valid grids in {time.time()-t0:.2f}s")

# Index by letter multiset (for solution counting)
BY_MULTISET = defaultdict(list)
for g in GRIDS:
    BY_MULTISET[''.join(sorted(''.join(g)))].append(g)

# --------------------------------------------------------------- omino fusing
NBRS = lambda r, c: [(r-1, c), (r+1, c), (r, c-1), (r, c+1)]

TEMPLATES = [
    [4, 3, 2, 1, 1, 1, 1, 1, 1, 1],
    [3, 3, 2, 2, 1, 1, 1, 1, 1, 1],
    [4, 2, 2, 2, 1, 1, 1, 1, 1, 1],
    [2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1],
    [4, 4, 3, 2, 1, 1, 1],
    [3, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1],
]
assert all(sum(t) == 16 for t in TEMPLATES), "every template must tile 16 cells"

def fuse(sizes):
    """Randomly partition the 4x4 into connected regions of the given sizes."""
    for _ in range(400):
        unassigned = {(r, c) for r in range(4) for c in range(4)}
        pieces, ok = [], True
        for s in sorted(sizes, reverse=True):
            start = random.choice(sorted(unassigned))
            region = {start}
            unassigned.discard(start)
            while len(region) < s:
                frontier = [n for cell in region for n in NBRS(*cell)
                            if n in unassigned]
                if not frontier:
                    ok = False
                    break
                pick = random.choice(frontier)
                region.add(pick)
                unassigned.discard(pick)
            if not ok:
                break
            pieces.append(sorted(region))
        if ok and not unassigned:
            return pieces
    return None

# ------------------------------------------------------- solution counting
def normalize(cells):
    r0 = min(r for r, _ in cells)
    c0 = min(c for _, c in cells)
    return tuple(sorted((r - r0, c - c0) for r, c in cells))

def count_solutions(grid, pieces):
    """Distinct valid grids (same multiset) into which every omino embeds
    (translation only) with leftover letters matching the single tiles."""
    letters = lambda cells: ''.join(grid[r][c] for r, c in cells)
    multis = [(normalize(p), letters(p)) for p in pieces if len(p) > 1]
    singles = Counter(letters([p[0]]) for p in pieces if len(p) == 1)
    key = ''.join(sorted(''.join(grid)))
    achievable = []

    for cand in BY_MULTISET[key]:
        # all translations of each omino whose letters match cand
        opts = []
        feasible = True
        for shape, lets in multis:
            maxr = max(r for r, _ in shape)
            maxc = max(c for _, c in shape)
            plc = [frozenset((r + dr, c + dc) for r, c in shape)
                   for dr in range(4 - maxr) for dc in range(4 - maxc)
                   if all(cand[r + dr][c + dc] == lets[i]
                          for i, (r, c) in enumerate(shape))]
            if not plc:
                feasible = False
                break
            opts.append(plc)
        if not feasible:
            continue

        def place(i, used):
            if i == len(opts):
                left = Counter(cand[r][c] for r in range(4) for c in range(4)
                               if (r, c) not in used)
                return left == singles
            return any(place(i + 1, used | p) for p in opts[i]
                       if not (p & used))

        if place(0, frozenset()):
            achievable.append(cand)
    return achievable

# ---------------------------------------------------------------- puzzle picks
def distinct8(g):
    ws = list(g) + [''.join(g[r][c] for r in range(4)) for c in range(4)]
    return len(set(ws)) == 8

def make_puzzle(grid, template):
    pieces = fuse(template)
    if pieces is None:
        return None
    sols = count_solutions(grid, pieces)
    # every word appearing in ANY solution — powers the Super Check hint system
    sol_words = set()
    for s in sols:
        sol_words.update(s)
        sol_words.update(''.join(s[r][c] for r in range(4)) for c in range(4))
    return {
        "solution": list(grid),
        "pieces": [{"cells": [list(c) for c in p],
                    "letters": ''.join(grid[r][c] for r, c in p)}
                   for p in pieces],
        "numSolutions": len(sols),
        "solutionWords": sorted(sol_words),
    }

def main():
    candidates = [g for g in GRIDS if distinct8(g)]
    print(f"{len(candidates)} grids with 8 distinct words")
    random.shuffle(candidates)

    puzzles, seen_multiset = [], set()
    # try to include the user's example grid first if it exists
    example = ('step', 'time', 'edit', 'wets')
    if example in set(GRIDS):
        candidates.insert(0, example)
        print("example grid STEP/TIME/EDIT/WETS is in the database ✓")

    for grid in candidates:
        if len(puzzles) >= 8:
            break
        key = ''.join(sorted(''.join(grid)))
        if key in seen_multiset:
            continue
        template = TEMPLATES[len(puzzles) % len(TEMPLATES)]
        p = make_puzzle(grid, template)
        # keep puzzles with a small, satisfying solution space
        if p and 1 <= p["numSolutions"] <= 6:
            seen_multiset.add(key)
            puzzles.append(p)
            print(f"puzzle {len(puzzles)}: {'/'.join(grid).upper()}  "
                  f"template={template}  solutions={p['numSolutions']}")

    import score as _score
    for p in puzzles:
        p.update(_score.score_puzzle(p))
        print(f"  scored {'/'.join(p['solution']).upper()}: "
              f"difficulty={p['difficulty']} {'★'*p['stars']}")

    with open('puzzles.json', 'w') as f:
        json.dump(puzzles, f, indent=1)
    print(f"wrote puzzles.json with {len(puzzles)} puzzles")

if __name__ == '__main__':
    main()
