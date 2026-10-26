#!/usr/bin/env python3
"""Replace specific days of the season, leaving every other day exactly as it is.
Prints counts only — never answers (Dave plays blind).

    python replace_days.py 56,116,169,285            # days by number (#N)
    python replace_days.py 56,116 --dry-run

Each replacement fits its weekday's band (extend.py's BANDS), is single-solution
with today's word lists, blocklist-clean, not shipped/retired/already in the
season, no repeated letter set, and keeps every answer word within the repeat
rules counting the days on BOTH sides (no more than 2 in any 30 days, 8 a season).
"""
import datetime, glob, json, pickle, re, sys
from collections import Counter

DAYS = [int(x) for x in sys.argv[1].split(',')] if len(sys.argv) > 1 else []
DRY = '--dry-run' in sys.argv
src = open('extend.py', encoding='utf-8').read()
EPOCH = datetime.date(2026, 10, 8)
BANDS = eval(re.search(r'^BANDS = (\{.*\})$', src, re.M).group(1))      # the same bands as extend.py
WINDOW, WINDOW_MAX, MAX_USES = 30, 2, 8

import generate, wordpoints
words_of = wordpoints.words_of
multiset = lambda g: ''.join(sorted(''.join(g)))
singles = lambda p: sum(1 for pc in p['pieces'] if len(pc['cells']) == 1)

S = json.load(open('puzzles.json'))
retired = []
try:
    retired = [l.split() for l in open('retired.txt') if l.strip() and not l.startswith('#')]
except FileNotFoundError:
    pass
taken = {tuple(p['solution']) for p in S} | {tuple(g) for g in retired}
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

def uses_map(exclude):                           # word -> days it's an answer, leaving some days out
    m = {}
    for d, p in enumerate(S):
        if d in exclude: continue
        for w in words_of(p['solution']): m.setdefault(w, []).append(d)
    return m

targets = [n - 1 for n in DAYS]
for d in targets:
    used = uses_map(set(targets) - {d} | {d})
    wd = (EPOCH + datetime.timedelta(days=d)).weekday()
    lo, hi = BANDS[wd]
    def ok(p):
        if multiset(p['solution']) in ms_taken: return False
        for w in words_of(p['solution']):
            ds = used.get(w, [])
            if len(ds) + 1 > MAX_USES: return False
            for s in range(d - WINDOW + 1, d + 1):          # every 30-day window holding day d
                if sum(1 for e in ds if s <= e < s + WINDOW) + 1 > WINDOW_MAX: return False
        return True
    cands = [p for p in pool if lo <= p['difficulty'] <= hi and ok(p)]
    if wd == 6: cands = [p for p in cands if singles(p) >= 8] or cands
    mid = (lo + hi) / 2
    best = min(cands, key=lambda p: (sum(len(used.get(w, [])) for w in words_of(p['solution'])), abs(p['difficulty'] - mid)))
    pool.remove(best); ms_taken.add(multiset(best['solution']))
    S[d] = best
    print(f"#{d + 1} ({EPOCH + datetime.timedelta(days=d):%a %b %d}): replaced; score {best['difficulty']} ({best['stars']} star)")
if DRY:
    print('dry run: nothing written')
else:
    json.dump(S, open('puzzles.json', 'w'), indent=1)
    generate.emit_site_data(S)
    print(f'wrote puzzles.json ({len(S)} days) and data/puzzles.js')
