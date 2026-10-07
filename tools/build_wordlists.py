#!/usr/bin/env python3
"""Build the pipeline's two word lists from the curator's decisions.

    words4.txt  puzzle words: curator "gen" ticks, minus anything in hold.txt
    valid4.txt  every word the game accepts: curator "check" ticks, minus
                anything in hold.txt marked with a trailing '!'

hold.txt is one word per line: words under review that must not appear in a
puzzle yet. A trailing '!' (e.g. "spic!") also removes the word from the
valid list. Lines starting with # are comments.

Usage: python build_wordlists.py      (then run newpuzzles.py / pick.py)
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
progress = json.load(open(os.path.join(HERE, '..', 'wordsort', 'progress.json'), encoding='utf-8'))

hold, banned = set(), set()
hold_path = os.path.join(HERE, 'hold.txt')
if os.path.exists(hold_path):
    for line in open(hold_path, encoding='utf-8'):
        w = line.strip().lower()
        if not w or w.startswith('#'):
            continue
        if w.endswith('!'):
            w = w[:-1]
            banned.add(w)
        hold.add(w)

ok = lambda w: len(w) == 4 and w.isalpha()
gen = sorted(w for w, d in progress.items() if ok(w) and d['gen'] and d['check'] and w not in hold)
valid = sorted(w for w, d in progress.items() if ok(w) and d['check'] and w not in banned)
assert set(gen) <= set(valid)

for name, words in (('words4.txt', gen), ('valid4.txt', valid)):
    with open(os.path.join(HERE, name), 'w', newline='\n') as f:
        f.write('\n'.join(words) + '\n')
print(f"words4.txt: {len(gen)} puzzle words   valid4.txt: {len(valid)} valid words   "
      f"(held {len(hold)}, banned {len(banned)})")
