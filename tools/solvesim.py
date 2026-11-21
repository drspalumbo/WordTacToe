#!/usr/bin/env python3
"""A simulated solve: how much a player has to guess, not how hard the finished grid looks.

Nov 2026, from Dave on #45: the W/NEE piece left only NEED, NEED then forced DOWN,
FF could only be DOFF, and WREN filled itself in. The puzzle scored 4* for its odd
words, yet none of them had to be thought of. So this plays the puzzle forward:

  forced   a piece with one place it can go, or a row/column with one word that can
           still fit (its letters must match what's known and come from the tiles
           left), is filled in at no cost. Repeat until nothing is forced.
  stuck    otherwise take the most constrained choice and count what it costs:
             a piece: the number of places it could still go;
             a line:  the candidate words, each weighted by how well known it is,
                      divided by how well known the right one is (an odd word that
                      has to be come up with costs more; one that's forced costs nothing).
           Then take the right choice and carry on.

effort = sum of log10(cost) over the stuck points: everything in one unit, the log
of how many tries it takes, so a hard word multiplies the tries instead of adding
flat points on top of a log.

Prints counts and scores only, never answers (Dave plays blind).
"""
import math, os
from collections import Counter
import wordpoints

HERE = os.path.dirname(os.path.abspath(__file__))
LINES = [[(i, j) for j in range(4)] for i in range(4)] + [[(j, i) for j in range(4)] for i in range(4)]
_W = None
def _words():
    global _W
    if _W is None:
        _W = open(os.path.join(HERE, 'valid4.txt')).read().split()
    return _W

def _shape(piece):
    r0 = min(r for r, c in piece['cells']); c0 = min(c for r, c in piece['cells'])
    return [(r - r0, c - c0, ch) for (r, c), ch in zip(piece['cells'], piece['letters'])]

def simulate(rows, pieces, familiar=None):
    """-> dict(effort, stuck, forced, steps). familiar(w) -> 0..1 (default wordpoints.known)."""
    familiar = familiar or wordpoints.known
    total = Counter(''.join(rows))
    words = [w for w in _words() if not (Counter(w) - total)]
    known = {}                                   # (r, c) -> letter worked out so far
    todo = [i for i, p in enumerate(pieces) if len(p['cells']) > 1]
    shapes = {i: _shape(pieces[i]) for i in todo}
    truth = {i: (min(r for r, c in pieces[i]['cells']), min(c for r, c in pieces[i]['cells'])) for i in todo}

    def bag():                                   # letters not yet placed
        return total - Counter(known.values())

    def candidates(cells, extra=None):
        k = dict(known); k.update(extra or {})
        left = total - Counter(k.values())
        pat = [k.get(c) for c in cells]
        need = lambda w: Counter(ch for ch, q in zip(w, pat) if q is None)
        return [w for w in words if all(q is None or q == ch for ch, q in zip(w, pat)) and not (need(w) - left)]

    def spots(i):                                # where piece i can still go
        sh = shapes[i]; H = max(s[0] for s in sh) + 1; W = max(s[1] for s in sh) + 1
        out = []
        for R in range(5 - H):
            for C in range(5 - W):
                put = {(R + r, C + c): ch for r, c, ch in sh}
                if any(known.get(cell, ch) != ch for cell, ch in put.items()):
                    continue
                if any(cell in known for cell in put) and not all(cell in known for cell in put):
                    pass                         # overlapping known letters is fine if they match
                if Counter(ch for cell, ch in put.items() if cell not in known) - bag():
                    continue
                # every line the piece puts 2+ letters in must still take a word
                rs = Counter(r for r, c in put); cs = Counter(c for r, c in put)
                lines = [LINES[r] for r, n in rs.items() if n > 1] + [LINES[4 + c] for c, n in cs.items() if n > 1]
                if all(candidates(l, put) for l in lines):
                    out.append((R, C, put))
        return out

    effort, stuck, forced, steps = 0.0, 0, 0, []
    while len(known) < 16:
        moved = False
        for i in list(todo):                     # a piece with one place left
            s = spots(i)
            if len(s) == 1:
                known.update(s[0][2]); todo.remove(i); forced += 1; moved = True
                steps.append(('piece', 1))
        for li, cells in enumerate(LINES):       # a line with one word left
            if all(c in known for c in cells):
                continue
            cand = candidates(cells)
            if len(cand) == 1:
                known.update(zip(cells, cand[0])); forced += 1; moved = True
                steps.append(('line', 1))
        for i in list(todo):                     # pieces whose cells are all known now
            if all((truth[i][0] + r, truth[i][1] + c) in known for r, c, ch in shapes[i]):
                todo.remove(i)
        if moved:
            continue
        # stuck: the cheapest choice to make, then the right one
        best = None
        for i in todo:
            n = len(spots(i))
            if n and (best is None or n < best[0]):
                best = (n, 'piece', i)
        for li, cells in enumerate(LINES):
            if all(c in known for c in cells):
                continue
            cand = candidates(cells)
            right = ''.join(rows[r][c] for r, c in cells)
            cost = sum(min(1.0, familiar(w)) for w in cand) / max(.05, familiar(right))
            if best is None or cost < best[0]:
                best = (cost, 'line', li)
        cost, kind, x = best
        if kind == 'piece':
            R, C = truth[x]
            known.update({(R + r, C + c): ch for r, c, ch in shapes[x]}); todo.remove(x)
        else:
            known.update({cell: rows[cell[0]][cell[1]] for cell in LINES[x]})
        effort += math.log10(max(1.0, cost)); stuck += 1
        steps.append((kind, round(cost, 2)))
    return {'effort': round(effort, 3), 'stuck': stuck, 'forced': forced, 'steps': steps}

if __name__ == '__main__':
    import json, sys
    S = json.load(open('puzzles.json'))
    for n in [int(x) for x in sys.argv[1].split(',')]:
        r = simulate(S[n - 1]['solution'], S[n - 1]['pieces'])
        print(f"#{n}: effort {r['effort']}, stuck {r['stuck']}, forced {r['forced']}, "
              f"stored score {S[n - 1]['difficulty']}")
