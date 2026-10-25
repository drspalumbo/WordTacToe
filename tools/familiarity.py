#!/usr/bin/env python3
"""Word familiarity for every 4-letter word in the corpus -> freqdata/familiarity.json

  known_us  share of Americans who know the word (Brysbaert et al. 2019 word prevalence,
            US respondents; freqdata/English_Word_Prevalences.xlsx from osf.io/nbu9e —
            non-commercial terms, so it stays local, not in the repo)
  via       the word the prevalence came from (an inflected form takes its base word's:
            errs -> err, aped -> ape) or null if none was found
  zipf      wordfreq frequency, 0-8 (blends Wikipedia, subtitles, news, books, web)

Prevalence is a probit; Pknown = (Phi(prevalence) - 0.005) / 0.99 (the paper's formula, inverted).
"""
import json, math, os
import openpyxl
from wordfreq import zipf_frequency

HERE = os.path.dirname(os.path.abspath(__file__))
XLSX = os.path.join(HERE, 'freqdata', 'English_Word_Prevalences.xlsx')
corpus = [w['word'] for w in json.load(open(os.path.join(HERE, '..', 'wordsort', 'words.json'), encoding='utf-8'))]

wb = openpyxl.load_workbook(XLSX, read_only=True)
us, overall = {}, {}
rows = wb['UK vs US'].iter_rows(values_only=True); next(rows)
for word, uk, usp in rows:
    if isinstance(word, str) and usp is not None:
        us[word.lower()] = usp
rows = wb['Prevalence'].iter_rows(values_only=True); next(rows)
for word, pk, nobs, prev, z in rows:
    if isinstance(word, str) and pk is not None:
        overall[word.lower()] = pk

phi = lambda x: 0.5 * (1 + math.erf(x / math.sqrt(2)))
def known(w):
    if w in us:
        return max(0.0, min(1.0, (phi(us[w]) - 0.005) / 0.99))
    if w in overall:
        return overall[w]
    return None

def bases(w):                       # inflected 4-letter forms -> likely base words
    out = []
    if w.endswith('s'): out += [w[:-1]]                       # errs -> err, pigs -> pig
    if w.endswith('es'): out += [w[:-2]]                      # boxes-style (rare at 4)
    if w.endswith('ed'): out += [w[:-1], w[:-2]]              # aped -> ape, eked -> eke
    if w.endswith('ied'): out += [w[:-3] + 'y']
    return [b for b in out if len(b) >= 2]

table = {}
for w in corpus:
    k, via = known(w), w
    if k is None:
        via = None
        for b in bases(w):
            if known(b) is not None:
                k, via = known(b), b
                break
    table[w] = {'known_us': None if k is None else round(k, 3), 'via': via,
                'zipf': round(zipf_frequency(w, 'en'), 2)}
json.dump(table, open(os.path.join(HERE, 'freqdata', 'familiarity.json'), 'w'), indent=0)
have = sum(1 for v in table.values() if v['known_us'] is not None)
print(f'{len(table)} words; prevalence for {have} ({sum(1 for v in table.values() if v["via"] not in (None,) and v["via"] != None and v["via"] != "" and v["via"] != v.get("w"))} incl. via base forms)')
