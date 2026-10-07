#!/usr/bin/env python3
"""
Intrinsic difficulty scoring for Danagram puzzles.

Blends two axes, both computed from the puzzle's structure (independent of any
particular scramble):

  SEARCH  — how rare a valid arrangement is among all legal ones. We model the
            exact thing the shuffle does: place the ominos as rigid translated
            pieces, drop the singles into the holes. P(solution) is the chance a
            uniformly-random legal arrangement is an all-words grid. Rarer =
            harder. We also track the "trap rate": arrangements that are 7/8
            correct (local optima that feel like progress).

  LEXICAL — how hard the words are to recognize. No frequency corpus is available
            offline, so we use a bigram-typicality proxy trained on the word list:
            unusual letter patterns (EWES, AGUE) score higher than prototypical
            ones (TIME, STEP). Since a player wins on ANY solution, a puzzle's
            lexical floor is set by its *friendliest* solution — so we take, over
            all solutions, the minimum of (hardest word in that grid).

Outputs raw metrics plus a 0-100 blended score (min-max normalised across the
set). Swap `word_obscurity` for a real frequency lookup later without touching
the rest.
"""
import json, math, random, sys, time
from collections import Counter, defaultdict
from itertools import permutations
from functools import lru_cache

import generate  # gives WORDS, WORDSET, count_solutions, BY_MULTISET

random.seed(20260707)
WORDS, WORDSET = generate.WORDS, generate.WORDSET

# ----------------------------------------------------------- lexical: branching
# The real lexical difficulty is candidate density: how many words you'd
# plausibly try. Ominos that lock a tight run (ISK -> DISK) or a rare letter
# (EX -> few words) collapse the candidate list -> easy, even if the answer word
# is obscure. Loose singles leave a line wide open -> many candidates -> hard.

def line_candidates(pattern):
    """# of valid words matching a 4-slot pattern (None = wildcard)."""
    n = 0
    for w in WORDS:
        if all(pattern[i] is None or pattern[i] == w[i] for i in range(4)):
            n += 1
    return n

def branching(puzzle):
    """Sum of log10(candidate words) across the 8 lines, using the omino-locked
    letters of the canonical solution as the only fixed constraints. Higher =
    more words in play = harder. Lower = the ominos give the words away."""
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
        cand = line_candidates(pat)
        per.append(cand)
        total += math.log10(cand) if cand > 0 else 0.0
    return total, per

def formable_words(puzzle):
    """# of valid words spellable from the puzzle's 16-letter bag. Rare letters
    (X/Z/Q/J/K) prune this sharply -> fewer things to try -> easier."""
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

# ----------------------------------------------------------- piece geometry
def normalize(cells):
    r0 = min(r for r, _ in cells); c0 = min(c for _, c in cells)
    return [(r - r0, c - c0) for r, c in cells]

def placements(shape):
    rmax = max(r for r, _ in shape); cmax = max(c for _, c in shape)
    out = []
    for R in range(4 - rmax):
        for C in range(4 - cmax):
            out.append([(r + R, c + C) for r, c in shape])
    return out

def omino_tilings(ominos):
    """All ways to place the ominos (rigid translations, no overlap)."""
    plc = [placements(sh) for sh, _ in ominos]
    results, used, assign = [], set(), []
    def rec(i):
        if i == len(ominos):
            results.append([a[:] for a in assign]); return
        for cells in plc[i]:
            if any(c in used for c in cells): continue
            for c in cells: used.add(c)
            assign.append((i, cells))
            rec(i + 1)
            assign.pop()
            for c in cells: used.discard(c)
    rec(0)
    return results

def multiset_perm_count(letters):
    n = len(letters); denom = 1
    for k in Counter(letters).values(): denom *= math.factorial(k)
    return math.factorial(n) // denom

# ----------------------------------------------------------- search metrics
def search_metrics(pieces_cells, pieces_letters, samples=120000):
    """Estimate P(random legal arrangement is a solution) and the 7/8 trap rate,
    plus the size of the legal-arrangement space."""
    ominos, single_letters = [], []
    for cells, lets in zip(pieces_cells, pieces_letters):
        if len(cells) > 1:
            ominos.append((normalize(cells), lets))
        else:
            single_letters.append(lets)

    tilings = omino_tilings(ominos)
    if not tilings:
        return None

    # precompute, per tiling: fixed omino letters by cell, and the hole cells
    prepared = []
    space = 0
    for tiling in tilings:
        fixed = {}
        for (i, cells) in tiling:
            _, lets = ominos[i]
            for k, cell in enumerate(cells):
                fixed[cell] = lets[k]
        holes = [(r, c) for r in range(4) for c in range(4) if (r, c) not in fixed]
        prepared.append((fixed, holes))
        space += multiset_perm_count(single_letters)

    def grid_from(fixed, holes, perm):
        g = [['?'] * 4 for _ in range(4)]
        for (r, c), ch in fixed.items(): g[r][c] = ch
        for (r, c), ch in zip(holes, perm): g[r][c] = ch
        return [''.join(row) for row in g]

    def lines_valid(g):
        v = 0
        for i in range(4):
            if g[i] in WORDSET: v += 1
            if (g[0][i] + g[1][i] + g[2][i] + g[3][i]) in WORDSET: v += 1
        return v

    total_perm = space  # arrangements with multiplicity across tilings
    # exact enumeration when small; else Monte Carlo
    sol = near = seen = 0
    exact = total_perm <= 300000
    if exact:
        for fixed, holes in prepared:
            for perm in set(permutations(single_letters)):
                g = grid_from(fixed, holes, perm)
                v = lines_valid(g)
                seen += 1
                if v == 8: sol += 1
                elif v == 7: near += 1
        p_sol = sol / seen if seen else 0.0
        p_near = near / seen if seen else 0.0
    else:
        sl = list(single_letters)
        for _ in range(samples):
            fixed, holes = random.choice(prepared)
            random.shuffle(sl)
            g = grid_from(fixed, holes, sl)
            v = lines_valid(g)
            if v == 8: sol += 1
            elif v == 7: near += 1
        p_sol = sol / samples
        p_near = near / samples

    return {
        "space": space, "tilings": len(tilings),
        "p_sol": p_sol, "p_near": p_near, "exact": exact,
    }

# ----------------------------------------------------------- per puzzle
def analyze(puzzle):
    grid = tuple(puzzle["solution"])
    pieces_cells = [[tuple(c) for c in p["cells"]] for p in puzzle["pieces"]]
    pieces_letters = [p["letters"] for p in puzzle["pieces"]]

    sols = generate.count_solutions(grid, pieces_cells)
    N = len(sols)

    # lexical branching: candidate density given the omino-locked letters
    branch_total, branch_per = branching(puzzle)
    formable = formable_words(puzzle)

    sm = search_metrics(pieces_cells, pieces_letters)
    p_sol = max(sm["p_sol"], N / sm["space"]) if sm and sm["space"] else 1.0
    search_info = -math.log10(p_sol) if p_sol > 0 else 12.0

    ominos = [p for p in pieces_cells if len(p) > 1]
    singles = [p for p in pieces_cells if len(p) == 1]
    fused_cells = sum(len(p) for p in ominos)

    return {
        "words": "/".join(w.upper() for w in grid),
        "N": N,
        "space": sm["space"] if sm else 0,
        "search_info": search_info,
        "p_sol": p_sol,
        "exact": sm["exact"] if sm else True,
        "branching": branch_total,
        "branch_per": branch_per,
        "formable": formable,
        "pieces": len(pieces_cells),
        "ominos": len(ominos),
        "singles": len(singles),
        "max_omino": max((len(p) for p in ominos), default=0),
        "fused_frac": fused_cells / 16,
    }

def main():
    puzzles = json.load(open("puzzles.json"))
    t0 = time.time()
    rows = [analyze(p) for p in puzzles]

    # Absolute anchors (tuned to the observed range + headroom) so a score means
    # the same thing regardless of what else is in the library. Adjust as the
    # corpus grows / playtest data arrives.
    SEARCH_LO, SEARCH_HI = 1.5, 8.5
    BRANCH_LO, BRANCH_HI = 2.5, 11.0
    W_SEARCH, W_LEX = 0.6, 0.4
    clamp01 = lambda x: max(0.0, min(1.0, x))
    def stars(score):
        return 1 + min(4, int(score // 20))     # 0-19->1 ... 80-100->5

    for r in rows:
        s = clamp01((r["search_info"] - SEARCH_LO) / (SEARCH_HI - SEARCH_LO))
        l = clamp01((r["branching"]  - BRANCH_LO) / (BRANCH_HI - BRANCH_LO))
        r["search_norm"] = round(s, 3); r["lex_norm"] = round(l, 3)
        r["score"] = round(100 * (W_SEARCH * s + W_LEX * l))
        r["stars"] = stars(r["score"])

    print(f"\nanalysed {len(rows)} puzzles in {time.time()-t0:.1f}s  "
          f"(blend {int(W_SEARCH*100)}/{int(W_LEX*100)}, absolute anchors)\n")
    hdr = ("#  words                score star | search_info  P(sol)   space    | "
           "branch | om/sg")
    print(hdr); print("-" * len(hdr))
    for i, r in enumerate(rows):
        print(f"{i+1}  {r['words']:<18} {r['score']:>5}  {'★'*r['stars']:<5} | "
              f"     {r['search_info']:>4.2f}  {r['p_sol']:.1e}  {r['space']:>8} | "
              f"{r['branching']:>5.2f}  |  {r['ominos']}/{r['singles']}"
              + ("" if r["exact"] else "  ~mc"))
    print()
    order = sorted(range(len(rows)), key=lambda i: rows[i]["score"])
    print("easiest -> hardest:",
          " < ".join(f"P{i+1}({rows[i]['score']})" for i in order))
    json.dump(rows, open("difficulty.json", "w"), indent=1)

if __name__ == "__main__":
    main()
