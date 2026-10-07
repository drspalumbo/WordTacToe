#!/usr/bin/env python3
"""
Standalone difficulty scorer for Danagram puzzles.

Blends two intrinsic axes into a 0-100 score (and 1-5 stars):
  SEARCH  — how rare a valid arrangement is among all legal ones (models the
            shuffle: pack ominos, drop singles in the holes).
  LEXICAL — candidate density / branching: how many words are plausibly in play
            given the letters the ominos lock in place. Tight runs (ISK->DISK)
            and rare letters (EX->few) collapse this -> easier.

Only needs the word list; no grid database. Import `score_puzzle` from the
generator, or run this file to (re)score an existing puzzles.json.
"""
import json, math, random
from collections import Counter
from itertools import permutations

# --- tunables ---------------------------------------------------------------
SEARCH_LO, SEARCH_HI = 1.5, 8.5      # absolute anchors for -log10 P(solution)
BRANCH_LO, BRANCH_HI = 2.5, 11.0     # absolute anchors for branching (log10)
W_SEARCH, W_LEX = 0.6, 0.4           # blend weights (validated ~4 gut-checks)
MC_SAMPLES = 120000
SEED = 20260707

_WORDS = None
_WORDSET = None
def _load_words(path="words4.txt"):
    global _WORDS, _WORDSET
    if _WORDS is None:
        _WORDS = sorted({w for w in open(path).read().split()
                         if len(w) == 4 and w.isalpha()})
        _WORDSET = set(_WORDS)
    return _WORDS, _WORDSET

# --- lexical: branching + formable -----------------------------------------
def _line_candidates(pattern, WORDS):
    n = 0
    for w in WORDS:
        if all(pattern[i] is None or pattern[i] == w[i] for i in range(4)):
            n += 1
    return n

def branching(puzzle, WORDS):
    grid = puzzle["solution"]
    omino = set()
    for p in puzzle["pieces"]:
        if len(p["cells"]) > 1:
            for r, c in p["cells"]:
                omino.add((r, c))
    lines = [[(r, c) for c in range(4)] for r in range(4)] + \
            [[(r, c) for r in range(4)] for c in range(4)]
    per, total = [], 0.0
    for cells in lines:
        pat = [grid[r][c] if (r, c) in omino else None for (r, c) in cells]
        cand = _line_candidates(pat, WORDS)
        per.append(cand)
        total += math.log10(cand) if cand > 0 else 0.0
    return total, per

def formable_words(puzzle, WORDS):
    bag = Counter()
    for p in puzzle["pieces"]:
        for ch in p["letters"]:
            bag[ch] += 1
    n = 0
    for w in WORDS:
        wc = Counter(w)
        if all(wc[ch] <= bag[ch] for ch in wc):
            n += 1
    return n

# --- search: P(random legal arrangement is a solution) ----------------------
def _normalize(cells):
    r0 = min(r for r, _ in cells); c0 = min(c for _, c in cells)
    return [(r - r0, c - c0) for r, c in cells]

def _placements(shape):
    rmax = max(r for r, _ in shape); cmax = max(c for _, c in shape)
    return [[(r + R, c + C) for r, c in shape]
            for R in range(4 - rmax) for C in range(4 - cmax)]

def _omino_tilings(ominos):
    plc = [_placements(sh) for sh, _ in ominos]
    results, used, assign = [], set(), []
    def rec(i):
        if i == len(ominos):
            results.append([a[:] for a in assign]); return
        for cells in plc[i]:
            if any(c in used for c in cells): continue
            for c in cells: used.add(c)
            assign.append((i, cells)); rec(i + 1); assign.pop()
            for c in cells: used.discard(c)
    rec(0)
    return results

def _multiset_perm_count(letters):
    denom = 1
    for k in Counter(letters).values(): denom *= math.factorial(k)
    return math.factorial(len(letters)) // denom

def search_metrics(pieces_cells, pieces_letters, WORDSET, samples=MC_SAMPLES):
    ominos, singles = [], []
    for cells, lets in zip(pieces_cells, pieces_letters):
        (ominos.append((_normalize(cells), lets)) if len(cells) > 1
         else singles.append(lets))
    tilings = _omino_tilings(ominos)
    if not tilings:
        return None
    prepared, space = [], 0
    for tiling in tilings:
        fixed = {}
        for (i, cells) in tiling:
            _, lets = ominos[i]
            for k, cell in enumerate(cells):
                fixed[cell] = lets[k]
        holes = [(r, c) for r in range(4) for c in range(4) if (r, c) not in fixed]
        prepared.append((fixed, holes))
        space += _multiset_perm_count(singles)

    def grid_from(fixed, holes, perm):
        g = [['?'] * 4 for _ in range(4)]
        for (r, c), ch in fixed.items(): g[r][c] = ch
        for (r, c), ch in zip(holes, perm): g[r][c] = ch
        return [''.join(row) for row in g]

    def valid_lines(g):
        v = 0
        for i in range(4):
            if g[i] in WORDSET: v += 1
            if (g[0][i] + g[1][i] + g[2][i] + g[3][i]) in WORDSET: v += 1
        return v

    sol = near = 0
    exact = space <= 300000
    if exact:
        seen = 0
        for fixed, holes in prepared:
            for perm in set(permutations(singles)):
                v = valid_lines(grid_from(fixed, holes, perm)); seen += 1
                if v == 8: sol += 1
                elif v == 7: near += 1
        p_sol = sol / seen if seen else 0.0
        p_near = near / seen if seen else 0.0
    else:
        sl = list(singles)
        for _ in range(samples):
            fixed, holes = random.choice(prepared)
            random.shuffle(sl)
            v = valid_lines(grid_from(fixed, holes, sl))
            if v == 8: sol += 1
            elif v == 7: near += 1
        p_sol = sol / samples
        p_near = near / samples
    return {"space": space, "tilings": len(tilings),
            "p_sol": p_sol, "p_near": p_near, "exact": exact}

# --- assemble ---------------------------------------------------------------
def _clamp01(x): return max(0.0, min(1.0, x))
def _stars(score): return 1 + min(4, int(score // 20))

def score_puzzle(puzzle, words_path=None):
    """Return difficulty fields for one puzzle dict (needs 'solution', 'pieces',
    'numSolutions'). Scores against the words a player can actually form, so
    valid4.txt when it exists."""
    if words_path is None:
        import os
        words_path = "valid4.txt" if os.path.exists("valid4.txt") else "words4.txt"
    random.seed(SEED)
    WORDS, WORDSET = _load_words(words_path)
    pieces_cells = [[tuple(c) for c in p["cells"]] for p in puzzle["pieces"]]
    pieces_letters = [p["letters"] for p in puzzle["pieces"]]
    N = puzzle.get("numSolutions", 1)

    br_total, br_per = branching(puzzle, WORDS)
    sm = search_metrics(pieces_cells, pieces_letters, WORDSET)
    p_sol = max(sm["p_sol"], N / sm["space"]) if sm and sm["space"] else 1.0
    search_info = -math.log10(p_sol) if p_sol > 0 else 12.0

    s = _clamp01((search_info - SEARCH_LO) / (SEARCH_HI - SEARCH_LO))
    l = _clamp01((br_total - BRANCH_LO) / (BRANCH_HI - BRANCH_LO))
    score = round(100 * (W_SEARCH * s + W_LEX * l))

    return {
        "difficulty": score,
        "stars": _stars(score),
        "difficulty_raw": {
            "search_info": round(search_info, 3),
            "p_sol": p_sol,
            "space": sm["space"] if sm else 0,
            "branching": round(br_total, 3),
            "formable": formable_words(puzzle, WORDS),
            "search_norm": round(s, 3),
            "lex_norm": round(l, 3),
            "exact": sm["exact"] if sm else True,
        },
    }

def score_file(path="puzzles.json"):
    puzzles = json.load(open(path))
    for p in puzzles:
        p.update(score_puzzle(p))
    json.dump(puzzles, open(path, "w"), indent=1)
    return puzzles

if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "puzzles.json"
    puzzles = score_file(path)
    print(f"scored {len(puzzles)} puzzles in {path}")
    for i, p in enumerate(puzzles):
        print(f"  P{i+1}  {'/'.join(w.upper() for w in p['solution'])}"
              f"  diff={p['difficulty']:>3}  {'★'*p['stars']}")
