#!/usr/bin/env python3
"""Merge a curator review export (Settings -> Export review decisions) into
wordsort/progress.json, touching only the words in the export. Then rebuild the
word lists with build_wordlists.py.

    python merge_review.py ../wordsort/review_r2_export.json [--dry-run]
"""
import json, sys
from collections import defaultdict

path = sys.argv[1]
DRY = '--dry-run' in sys.argv
PROG = '../wordsort/progress.json'
P = json.load(open(PROG, encoding='utf-8'))
E = json.load(open(path, encoding='utf-8'))
state = lambda d: ('puzzle+valid' if d and d['check'] and d['gen'] else
                   'valid only' if d and d['check'] else 'not accepted')
moves = defaultdict(list)
for w, d in E['decisions'].items():
    moves[(state(P.get(w)), state(d))].append(w)
    P[w] = {'check': bool(d['check']), 'gen': bool(d['gen'] and d['check']),
            'note': d.get('note'), 'rev': E.get('round')}
for (a, b), ws in sorted(moves.items()):
    tag = '' if a != b else '  (no change)'
    print(f'{a:13s} -> {b:13s} {len(ws):3d}{tag}: {" ".join(sorted(ws))}')
print(f'{len(E["decisions"])} decisions from round {E.get("round")}')
if not DRY:
    json.dump(P, open(PROG, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('merged into progress.json')
