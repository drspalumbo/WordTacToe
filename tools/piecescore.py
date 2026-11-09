#!/usr/bin/env python3
"""The Nov 2026 score: word options counted from the pieces, not the solved lines.

score.py's lexical axis read each line's locked letters from where the pieces sit in
the solution, so it scored the board after the hard part (placing the pieces) was
done. Here each multi-tile piece is tried in every spot it fits. At each spot, every
row or column the piece puts 2+ letters in must still be fillable by a word spelled
from the puzzle's own 16 letters; the spot's readings are the geometric mean of those
counts. A piece's fits = readings summed over its spots (1 = a giveaway).

    piece_log  = sum of log10(fits) over the pieces
    spatial    = round(100 * (0.6 * search_norm + 0.4 * clamp((piece_log - 2.5) / 5)))
    difficulty = spatial + word points (wordpoints.py)

The anchors 2.5 and 7.5 are about the easiest and hardest of the 308-day season.
Checked against solve times Nov 2-7 2026: it ranked the six days in the same order as
median solve time and finish rate (old score: Thursday 4*, played as a Sunday).
"""
import math, os
from collections import Counter
import wordpoints

HERE = os.path.dirname(os.path.abspath(__file__))
P_LO, P_HI = 2.5, 7.5
_W = None
def _words():
    global _W
    if _W is None:
        _W = open(os.path.join(HERE, 'valid4.txt')).read().split()
    return _W

def piece_fits(rows, pieces):
    bag = Counter(''.join(rows))
    words = [w for w in _words() if not (Counter(w) - bag)]     # spellable from this puzzle
    out = []
    for p in pieces:
        if len(p['cells']) == 1:
            continue
        r0 = min(r for r, c in p['cells']); c0 = min(c for r, c in p['cells'])
        shape = [(r - r0, c - c0, ch) for (r, c), ch in zip(p['cells'], p['letters'])]
        H = max(s[0] for s in shape) + 1; W = max(s[1] for s in shape) + 1
        total = 0.0
        for R in range(5 - H):
            for C in range(5 - W):
                fixed = {(R + r, C + c): ch for r, c, ch in shape}
                rs = Counter(r for r, c in fixed); cs = Counter(c for r, c in fixed)
                lines = [[(i, x) for x in range(4)] for i, n in rs.items() if n > 1] + \
                        [[(x, j) for x in range(4)] for j, n in cs.items() if n > 1]
                ways = 1
                for cells in lines:
                    pat = [fixed.get(cell) for cell in cells]
                    ways *= sum(1 for w in words if all(q is None or q == w[i] for i, q in enumerate(pat)))
                    if not ways:
                        break
                total += ways ** (1 / len(lines)) if ways else 0
        out.append(total)
    return out

def piece_log(rows, pieces):
    return sum(math.log10(f) for f in piece_fits(rows, pieces) if f > 0)

def rescore(p):
    """A puzzle with difficulty = the piece-based spatial score + word points."""
    raw = dict(p.get('difficulty_raw', {}))
    pl = piece_log(p['solution'], p['pieces'])
    pn = max(0.0, min(1.0, (pl - P_LO) / (P_HI - P_LO)))
    spatial = round(100 * (0.6 * raw['search_norm'] + 0.4 * pn))
    wp = sum(wordpoints.points(w) for w in wordpoints.words_of(p['solution']))
    q = dict(p)
    q['difficulty'] = spatial + wp
    q['stars'] = wordpoints.stars(q['difficulty'])
    q['difficulty_raw'] = {**raw, 'piece_log': round(pl, 3), 'piece_norm': round(pn, 3),
                           'spatial': spatial, 'word_points': wp, 'score': 'pieces-2026-11'}
    return q
