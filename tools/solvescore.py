#!/usr/bin/env python3
"""The Nov 21 2026 score: a predicted solve time, from a simulated solve.

    R       = effort + 0.5 * search_info
              effort       solvesim.py: log10 of the guessing a solve takes (forced
                           moves are free; a word to think of costs more if it's odd)
              search_info  score.py: -log10 P(a random legal arrangement is the answer),
                           how hard a first foothold is
    minutes = 10 ** (A + B * R) / 60      fitted to the median finish times of #1-#45
                                          (weighted by plays; #24 left out, Dave's own)
    score   = minutes on a log scale, laid onto the star bands so that every star
              doubles the time:
                1*  under 1.5 min   16-30        4*   6-12 min   71-85
                2*  1.5-3 min       31-50        5*  12-24 min   86-100
                3*  3-6 min         51-70        over 24 min: over 100 (special)

Both parts are logs of tries, so they add; the old score added flat word points to a
log, and dropping them alone ranked the days better. Against #1-#45 this ranks the days
by median solve time at 0.91 (Spearman); the old score 0.75, the piece score 0.75.
Word difficulty only counts where the simulated solver has to come up with the word.
"""
import json, math, os
import solvesim, wordpoints

HERE = os.path.dirname(os.path.abspath(__file__))
A, B = 1.473, 0.253                       # log10(seconds) = A + B * R
SEARCH_W = 0.5
KNOTS = [(0.75, 15.5), (1.5, 30.5), (3, 50.5), (6, 70.5), (12, 85.5), (24, 100.5)]
CACHE = os.path.join(HERE, 'solve_cache.json')
_C = None

def _cache():
    global _C
    if _C is None:
        try:
            _C = json.load(open(CACHE))
        except FileNotFoundError:
            _C = {}
    return _C

def save_cache():
    if _C is not None:
        json.dump(_C, open(CACHE, 'w'))

def effort(p):
    key = ' '.join(p['solution']) + '|' + ';'.join(pc['letters'] + ':' + ','.join(f'{r}{c}' for r, c in pc['cells']) for pc in p['pieces'])
    c = _cache()
    if key not in c:
        r = solvesim.simulate(p['solution'], p['pieces'])
        c[key] = [r['effort'], r['stuck']]
    return c[key]

def minutes(R):
    return 10 ** (A + B * R) / 60

def score_for(mins):
    x = math.log2(mins)
    pts = [(math.log2(t), s) for t, s in KNOTS]
    if x <= pts[0][0]:
        (x0, s0), (x1, s1) = pts[0], pts[1]
    elif x >= pts[-1][0]:
        (x0, s0), (x1, s1) = pts[-2], pts[-1]
    else:
        (x0, s0), (x1, s1) = next((a, b) for a, b in zip(pts, pts[1:]) if a[0] <= x <= b[0])
    return round(s0 + (s1 - s0) * (x - x0) / (x1 - x0))

def rescore(p):
    raw = dict(p.get('difficulty_raw', {}))
    eff, stuck = effort(p)
    R = eff + SEARCH_W * raw['search_info']
    m = minutes(R)
    q = dict(p)
    q['difficulty'] = score_for(m)
    q['stars'] = wordpoints.stars(q['difficulty'])
    for k in ('piece_log', 'piece_norm', 'spatial', 'word_points', 'lex_norm'):
        raw.pop(k, None)
    q['difficulty_raw'] = {**raw, 'effort': eff, 'stuck': stuck, 'R': round(R, 3),
                           'minutes': round(m, 1), 'score': 'solve-2026-11'}
    return q
