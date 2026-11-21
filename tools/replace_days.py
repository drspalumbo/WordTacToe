#!/usr/bin/env python3
"""Replace specific days of the season, leaving every other day exactly as it is.
Prints counts only — never answers (Dave plays blind).

    python replace_days.py 56,116,169,285            # days by number (#N)
    python replace_days.py 56,116 --dry-run
    python replace_days.py 34,36 --pieces             # score with piecescore.py (Nov 2026)
    python replace_days.py 54-308 --solve             # score with solvescore.py (Nov 21 2026)
    python replace_days.py 34,36 --pieces --rescore 33,35   # also restamp kept days' scores

Each replacement fits its weekday's band (extend.py's BANDS), is single-solution
with today's word lists, blocklist-clean, not shipped/retired/already in the
season, no repeated letter set, and keeps every answer word within the repeat
rules counting the days on BOTH sides (no more than 2 in any 30 days, 8 a season, and
a minimum gap that grows with how odd the word is: 14 days for an everyday word, up
to 120 for the oddest; GAP below). A word coming back in the same spot (same row or
same column) is avoided too, more so the odder the word (SAME_SPOT). Among the puzzles that fit, words used in the 60 days
either side are avoided, the closer the more (Nov 2026: UPDO twice in a few days).
With --pieces, scores come from piecescore.py, and only Sundays may have 8+ single
tiles (8 singles is the Sunday shape; on Nov 5 it made a Thursday play like one),
and fewer dominoes are preferred: each domino past the first counts like two more
repeated answer words when choosing among the puzzles that fit (a preference, not a
rule; any bigger piece, tromino or tetromino, is as good as another).
With --solve, scores come from solvescore.py (a predicted solve time), there's no
domino preference, and a puzzle with fewer than 6 single tiles counts one repeated
word per missing single (Dave, Nov 21: too much of the board was locked in ominos);
only Sundays may have 8+ singles.
"""
import datetime, glob, json, pickle, re, sys
from collections import Counter

def _days(arg):                                  # '56,116' or '54-308'
    out = []
    for part in arg.split(','):
        a, _, b = part.partition('-')
        out += list(range(int(a), int(b) + 1)) if b else [int(a)]
    return out
DAYS = _days(sys.argv[1]) if len(sys.argv) > 1 else []
DRY = '--dry-run' in sys.argv
PIECES = '--pieces' in sys.argv
SOLVE = '--solve' in sys.argv
RESCORE = _days(sys.argv[sys.argv.index('--rescore') + 1]) if '--rescore' in sys.argv else []
src = open('extend.py', encoding='utf-8').read()
EPOCH = datetime.date(2026, 10, 8)
BANDS = eval(re.search(r'^BANDS = (\{.*\})$', src, re.M).group(1))      # the same bands as extend.py
WINDOW, WINDOW_MAX, MAX_USES = 30, 2, 8
GAP = {0: 14, 4: 30, 8: 60, 16: 120}             # word points -> fewest days between uses
NEAR = 60                                        # and a softer preference beyond that
SAME_SPOT = {0: 1, 4: 2, 8: 4, 16: 8}            # word points -> cost of reusing a word's spot

import generate, wordpoints, piecescore, solvescore
words_of = wordpoints.words_of
multiset = lambda g: ''.join(sorted(''.join(g)))
singles = lambda p: sum(1 for pc in p['pieces'] if len(pc['cells']) == 1)
dominoes = lambda p: sum(1 for pc in p['pieces'] if len(pc['cells']) == 2)

S = json.load(open('puzzles.json'))
retired = []
try:
    retired = [l.split() for l in open('retired.txt') if l.strip() and not l.startswith('#')]
except FileNotFoundError:
    pass
SPECIAL = generate.scheduled_days()             # slots a special puzzle took: their puzzle is free again
taken = {tuple(p['solution']) for d, p in enumerate(S) if d not in SPECIAL} | {tuple(g) for g in retired}
ms_taken = {multiset(g) for g in taken}

pool, seen = [], set()
for path in sorted(glob.glob('pool*.pkl')):
    for p in pickle.load(open(path, 'rb')):
        g = tuple(p['solution'])
        if g in seen or g in taken or multiset(g) in ms_taken or p.get('numSolutions') != 1:
            continue
        if not generate.distinct8(list(g)) or not generate.pieces_are_clean(p['solution'], [c['cells'] for c in p['pieces']]):
            continue
        if not all(w in generate.WORDSET for w in words_of(list(g))):
            continue
        if len(generate.count_solutions(list(g), [[tuple(c) for c in pc['cells']] for pc in p['pieces']])) != 1:
            continue
        seen.add(g); pool.append(wordpoints.rescore(p))
if SOLVE:                                        # ~80 ms each the first time; cached after
    pool = [solvescore.rescore(p) for p in pool]
    solvescore.save_cache()

def spots_map(exclude):                          # word -> every spot it's been an answer in
    m = {}
    for d, p in enumerate(S):
        if d in exclude or d in SPECIAL: continue
        for w, sp in wordpoints.spots(p['solution']).items(): m.setdefault(w, set()).update(sp)
    return m

def uses_map(exclude):                           # word -> days it's an answer, leaving some days out
    m = {}
    for d, p in enumerate(S):
        if d in exclude or d in SPECIAL: continue
        for w in words_of(p['solution']): m.setdefault(w, []).append(d)
    return m

targets = [n - 1 for n in DAYS]
for k, d in enumerate(targets):
    todo = set(targets[k:])                      # days already replaced count; the rest don't yet
    used = uses_map(todo)
    spot = spots_map(todo)
    wd = (EPOCH + datetime.timedelta(days=d)).weekday()
    lo, hi = BANDS[wd]
    def ok(p):
        if multiset(p['solution']) in ms_taken: return False
        for w in words_of(p['solution']):
            ds = used.get(w, [])
            if len(ds) + 1 > MAX_USES: return False
            if any(abs(e - d) < GAP[wordpoints.points(w)] for e in ds): return False
            for s in range(d - WINDOW + 1, d + 1):          # every 30-day window holding day d
                if sum(1 for e in ds if s <= e < s + WINDOW) + 1 > WINDOW_MAX: return False
        return True
    if SOLVE:
        near_band = [p for p in pool if (wd == 6 or singles(p) < 8) and ok(p)]
    elif PIECES:                                # the piece score is slow: only near the band
        near_band = []
        for i, p in enumerate(pool):
            if lo - 25 <= p['difficulty'] <= hi + 25 and (wd == 6 or singles(p) < 8) and ok(p):
                if 'piece_log' not in p['difficulty_raw']:
                    pool[i] = p = piecescore.rescore(p)
                near_band.append(p)
    else:
        near_band = [p for p in pool if ok(p)]
    for slack in (0, 4, 8, 14):                 # widen the band only if nothing fits (as extend.py)
        a, b = max(16, lo - slack), min(100, hi + slack)
        cands = [p for p in near_band if a <= p['difficulty'] <= b]
        if cands: break
    if wd == 6: cands = [p for p in cands if singles(p) >= 8] or cands
    mid = (lo + hi) / 2
    reuse = lambda p: sum(len(used.get(w, [])) for w in words_of(p['solution']))
    extra = (lambda p: max(0, 6 - singles(p))) if SOLVE else             (lambda p: 2 * max(0, dominoes(p) - 1)) if PIECES else (lambda p: 0)
    # a use 1 day away counts nearly 2 more repeats; 59 days away, next to nothing
    near = lambda p: sum(2 * (NEAR - abs(e - d)) / NEAR for w in words_of(p['solution'])
                         for e in used.get(w, []) if abs(e - d) < NEAR)
    same = lambda p: sum(SAME_SPOT[wordpoints.points(w)] for w, sp in wordpoints.spots(p['solution']).items()
                         if sp & spot.get(w, set()))
    best = min(cands, key=lambda p: (reuse(p) + extra(p) + near(p) + same(p), abs(p['difficulty'] - mid)))
    pool.remove(best); ms_taken.add(multiset(best['solution']))
    S[d] = best
    print(f"#{d + 1} ({EPOCH + datetime.timedelta(days=d):%a %b %d}): replaced; score {best['difficulty']} ({best['stars']} star)"
          f", {dominoes(best)} dominoes, {singles(best)} singles, {len(cands)} fitted"
          + (f" (band widened by {slack})" if slack else ''))
for n in RESCORE:                                # kept puzzles, restamped with the piece score
    S[n - 1] = (solvescore if SOLVE else piecescore).rescore(S[n - 1])
    print(f"#{n} ({EPOCH + datetime.timedelta(days=n - 1):%a %b %d}): kept; score {S[n - 1]['difficulty']} ({S[n - 1]['stars']} star)")
if DRY:
    print('dry run: nothing written')
else:
    json.dump(S, open('puzzles.json', 'w'), indent=1)
    generate.emit_site_data(S)
    print(f'wrote puzzles.json ({len(S)} days) and data/puzzles.js')
