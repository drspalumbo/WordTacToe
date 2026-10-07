#!/usr/bin/env python3
"""Pick single-solution puzzles spread across difficulty.

Usage:
    python3 pick.py                    # 8 puzzles, floor 30, spread 36..94
    python3 pick.py --stars            # one per star category (1..5), ascending
    python3 pick.py --targets 40,60,80 # hit these difficulty scores
    python3 pick.py --floor 0          # allow trivial puzzles

Constraints applied to every pick: exactly one solution, no repeated letter
multiset, and no answer word reused more than MAX_WORD_REUSE times in the set.

Reads pool.pkl (built by newpuzzles.py). Writes puzzles.json.
"""
import json, pickle, sys
from collections import Counter

args = sys.argv[1:]
def flag(name, default=None):
    return args[args.index(name) + 1] if name in args else default

FLOOR = int(flag('--floor', 30))
MAX_WORD_REUSE = 2

if '--stars' in args:
    # Stars are 20-point bands: 1★=0-19, 2★=20-39, 3★=40-59, 4★=60-79, 5★=80-100.
    # Aim at the middle of each band so the pick is representative, not borderline.
    TARGETS = [10, 30, 50, 70, 90]
    FLOOR = int(flag('--floor', 0))     # a 1★ puzzle is below the usual floor
elif flag('--targets'):
    TARGETS = [int(x) for x in flag('--targets').split(',')]
else:
    TARGETS = [36, 46, 55, 63, 71, 79, 87, 94]

pool = [p for p in pickle.load(open("pool.pkl", "rb")) if p["difficulty"] >= FLOOR]
print(f"{len(pool)} puzzles at/above difficulty {FLOOR}")

def words_of(p):
    g = p["solution"]
    return set(g) | {''.join(g[r][c] for r in range(4)) for c in range(4)}

chosen, seen_ms, word_count = [], set(), Counter()
for target in TARGETS:
    best, best_d = None, 1e9
    for p in pool:
        if p in chosen:
            continue
        ms = ''.join(sorted(''.join(p["solution"])))
        if ms in seen_ms:
            continue
        ws = words_of(p)
        if any(word_count[w] + 1 > MAX_WORD_REUSE for w in ws):
            continue
        d = abs(p["difficulty"] - target)
        if d < best_d:
            best_d, best = d, p
    if best is None:
        print(f"  (no candidate near {target})")
        continue
    chosen.append(best)
    seen_ms.add(''.join(sorted(''.join(best["solution"]))))
    for w in words_of(best):
        word_count[w] += 1

chosen.sort(key=lambda p: p["difficulty"])
print(f"\npicked {len(chosen)} puzzles:\n")
print(f"{'#':<3}{'words':<22}{'diff':>5} {'stars':<7}{'sols':>5}  om/sg")
print("-" * 56)
for i, p in enumerate(chosen):
    r = p["difficulty_raw"]
    om = sum(1 for pc in p["pieces"] if len(pc["cells"]) > 1)
    sg = sum(1 for pc in p["pieces"] if len(pc["cells"]) == 1)
    print(f"{i+1:<3}{'/'.join(w.upper() for w in p['solution']):<22}"
          f"{p['difficulty']:>5} {'★'*p['stars']:<7}{p['numSolutions']:>5}  {om}/{sg}")

rep = [w for w, c in word_count.items() if c > 1]
print(f"\nwords used in 2 puzzles: {sorted(rep) if rep else 'none'}")
json.dump(chosen, open("puzzles.json", "w"), indent=1)
print(f"\nwrote puzzles.json with {len(chosen)} puzzles")

# emit the browser copy alongside it, so the two can never drift
import generate
generate.emit_site_data(chosen)
