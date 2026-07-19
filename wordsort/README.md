# Danagram Curator

A phone-friendly swipe tool for curating your 4-letter word list. Works offline on
`localStorage`; syncs to GitHub and pulls Merriam-Webster definitions when configured.

## What's here
- `index.html` — the app (single self-contained file)
- `words.json` — the static corpus, frequency-ordered (source of truth for the word set)
- `progress.json` — your decisions: `word -> {check, gen, note}` (only decided words)
- `definitions.json` — cached MW definitions (fills in as you swipe)
- `meta.json` — counts snapshot
- `build_data.py` — rebuild the JSON from the original `.xlsx`
- `rebuild_xlsx.py` — recombine the JSON back into a spreadsheet

## Deploy (GitHub Pages)
1. Put every file in this folder into your Pages repo (root, or a subfolder).
2. Push. Visit the page on your phone; use **Share → Add to Home Screen** for a
   full-screen, app-like launch.
3. Serve over http(s). Opening `index.html` from disk (`file://`) blocks the data
   load — for local testing run `python -m http.server` in this folder instead.

## Controls
- Swipe **right** = Accept (Check ✓ / Gen ✓), **left** = Reject, **down** = Check-only.
  A short flick (~50px) is enough to confirm.
- The definition shows on the card and scrolls in place if it runs long.
- Buttons for each decision, plus **Skip** and **Undo**. On desktop: arrow keys, Space = skip,
  Backspace = undo.
- Reject and Check-only open a reason sheet; **?** is the default. For SUBTLEX-only words
  (in SUBTLEX but not ENABLE or Scrabble) the **SUBTLEX Only** reason is pre-suggested.

## Settings (⚙)
Stored only in your browser. All optional:
- **GitHub repo / branch / path / token** — enables sync. Make a *fine-grained* personal
  access token limited to this one repo with **Contents: read & write**. Decisions save to
  `localStorage` instantly and commit (debounced) to `progress.json`. Use **Pull latest**
  when switching devices. Single-writer: edit from one device at a time.
- **Merriam-Webster key** — free Collegiate key from dictionaryapi.com. Definitions are
  fetched once per word and cached back into `definitions.json`.

## Recombining with the spreadsheet
```bash
python rebuild_xlsx.py .           # -> Danagram_4_Letter_Word_List_rebuilt.xlsx
python build_data.py               # regenerate JSON if you edit the .xlsx instead
```
