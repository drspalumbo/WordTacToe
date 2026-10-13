#!/usr/bin/env python3
"""Add puzzles to the END of the season, one day at a time, without touching the
days already scheduled. Prints counts only — never answers (Dave plays blind).

Usage:
    python extend.py 300            # append 300 days
    python extend.py 300 --dry-run  # report what it would do, write nothing

Each new day gets a puzzle in its weekday's difficulty band (DAILY_SPEC.md §2;
Sunday prefers 8+ single tiles), from every pool*.pkl here, with:
  - exactly one solution, and pieces that pass the omino blocklist
  - nothing already shipped or retired, and no repeated 16-letter multiset
  - no answer word more than WINDOW_MAX times in any WINDOW days (a rolling window)
Writes puzzles.json and the scrambled ../data/puzzles.js.
"""
import datetime, glob, json, pickle, sys
from collections import Counter

N = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 300
DRY = '--dry-run' in sys.argv
EPOCH = datetime.date(2026, 10, 8)              # Danagram #1 (game.js EPOCH)
WINDOW, WINDOW_MAX = 30, 2                      # an answer word: at most twice in any 30 days
# and at most MAX_USES times in the whole season (--max-uses K to change; 8 fills 300 days)
MAX_USES = int(sys.argv[sys.argv.index('--max-uses') + 1]) if '--max-uses' in sys.argv else 8
# weekday (Mon=0) -> difficulty band (DAILY_SPEC.md §2)
BANDS = {0: (30, 42), 1: (40, 52), 2: (50, 62), 3: (55, 72), 4: (70, 82), 5: (78, 92), 6: (62, 76)}

import generate                                 # word lists, blocklist, emit_site_data

words_of = lambda g: set(g) | {''.join(g[r][c] for r in range(4)) for c in range(4)}
multiset = lambda g: ''.join(sorted(''.join(g)))
singles = lambda p: sum(1 for pc in p['pieces'] if len(pc['cells']) == 1)

season = json.load(open('puzzles.json'))
retired = []
try:
    retired = [l.split() for l in open('retired.txt') if l.strip() and not l.startswith('#')]
except FileNotFoundError:
    pass
used_grids = {tuple(p['solution']) for p in season} | {tuple(g) for g in retired}
used_ms = {multiset(g) for g in used_grids}

# every pool, deduplicated, filtered
pool, seen = [], set()
for path in sorted(glob.glob('pool*.pkl')):
    for p in pickle.load(open(path, 'rb')):
        g = tuple(p['solution'])
        if g in seen or g in used_grids or multiset(g) in used_ms:
            continue
        if p.get('numSolutions') != 1 or not generate.distinct8(list(g)):
            continue
        if not generate.pieces_are_clean(p['solution'], [pc['cells'] for pc in p['pieces']]):
            continue
        seen.add(g)
        pool.append(p)
print(f'pool: {len(pool)} usable puzzles (from {len(glob.glob("pool*.pkl"))} pool files)')

# word history so far (the season's existing days count toward spacing and uses)
days_used, uses = {}, Counter()                # word -> the days it's an answer
for day, p in enumerate(season):
    for w in words_of(p['solution']):
        days_used.setdefault(w, []).append(day); uses[w] += 1

added, widened, ms_taken = [], 0, set(used_ms)
start = len(season)
for day in range(start, start + N):
    wd = (EPOCH + datetime.timedelta(days=day)).weekday()
    lo, hi = BANDS[wd]
    def ok(p):
        if multiset(p['solution']) in ms_taken:
            return False
        for w in words_of(p['solution']):
            recent = sum(1 for d in days_used.get(w, ()) if day - d < WINDOW)
            if recent + 1 > WINDOW_MAX or uses[w] + 1 > MAX_USES:
                return False
        return True
    best = None
    for slack in (0, 4, 8, 14, 24, 100):        # widen the band only if nothing fits
        cands = [p for p in pool if lo - slack <= p['difficulty'] <= hi + slack and ok(p)]
        if wd == 6 and slack < 100:             # Sunday: the showcase, lots of single tiles
            cands = [p for p in cands if singles(p) >= 8] or cands
        if cands:
            mid = (lo + hi) / 2
            # within the band, fresh words matter more than hitting the exact middle:
            # fewest earlier uses of its 8 words first, then nearest the middle
            best = min(cands, key=lambda p: (sum(uses[w] for w in words_of(p['solution'])),
                                             abs(p['difficulty'] - mid)))
            widened += slack > 0
            break
    if best is None:
        print(f'  ran out of puzzles at day #{day + 1}')
        break
    pool.remove(best)
    added.append(best)
    ms_taken.add(multiset(best['solution']))
    for w in words_of(best['solution']):
        days_used.setdefault(w, []).append(day); uses[w] += 1

# report: counts only
first = EPOCH + datetime.timedelta(days=start)
last = EPOCH + datetime.timedelta(days=start + len(added) - 1)
print(f'added {len(added)} days: #{start + 1} ({first:%a %b %d}) to #{start + len(added)} ({last:%a %b %d %Y})')
print(f'days whose band had to widen: {widened}')
names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
for wd in range(7):
    ds = [p['difficulty'] for i, p in enumerate(added)
          if (EPOCH + datetime.timedelta(days=start + i)).weekday() == wd]
    if ds:
        print(f'  {names[wd]}: {len(ds):3d} puzzles, difficulty {min(ds)}-{max(ds)} '
              f'(band {BANDS[wd][0]}-{BANDS[wd][1]}), median {sorted(ds)[len(ds) // 2]}')
stars = Counter(p['stars'] for p in added)
print('  stars:', ', '.join(f'{s}★ {stars[s]}' for s in sorted(stars)))
total = season + added
words_all = Counter(w for p in total for w in words_of(p['solution']))
reuse = Counter(words_all.values())
print(f'  distinct answer words: {len(words_all)}; times used: ' +
      ', '.join(f'{k}x {reuse[k]}' for k in sorted(reuse)))
print(f'  puzzles left in the pool: {len(pool)}')

if DRY:
    print('dry run: nothing written')
else:
    json.dump(total, open('puzzles.json', 'w'), indent=1)
    generate.emit_site_data(total)
    import os
    print(f'wrote puzzles.json ({len(total)} days) and data/puzzles.js '
          f'({os.path.getsize("../data/puzzles.js") // 1024} KB)')
