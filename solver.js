// Word-square tools shared by the Create page and the game (custom puzzles).
// A grid is 16 cells, row-major; '' (or a falsy value) is an empty cell. The 8
// "lines" are rows 0-3 then columns 0-3.
// Needs WORDS / WORDSET (data/words.js); fills use PUZZLE_WORDS (data/puzzle_words.js).

const Solver = (() => {
  const LINES = [];
  for (let r = 0; r < 4; r++) LINES.push([0, 1, 2, 3].map(c => r * 4 + c));
  for (let c = 0; c < 4; c++) LINES.push([0, 1, 2, 3].map(r => r * 4 + c));

  // words matching a pattern like ['b', '', 'd', ''] (memoised: patterns repeat a lot)
  const patternCache = new Map();
  function matching(words, pat, tag) {
    const k = tag + ':' + pat.map(x => x || '.').join('');
    let hit = patternCache.get(k);
    if (!hit) {
      hit = words.filter(w => pat.every((ch, i) => !ch || w[i] === ch));
      if (patternCache.size > 5000) patternCache.clear();
      patternCache.set(k, hit);
    }
    return hit;
  }

  // Per line: 'ok' (a word), 'empty', 'partial' (some word still fits),
  // 'notword' (full but not a word) or 'nofit' (no word fits what's typed).
  function lineStatus(grid) {
    return LINES.map(cells => {
      const pat = cells.map(i => grid[i] || '');
      const n = pat.filter(Boolean).length;
      if (n === 0) return 'empty';
      if (n === 4) return WORDSET.has(pat.join('')) ? 'ok' : 'notword';
      return matching(WORDS, pat, 'v').length ? 'partial' : 'nofit';
    });
  }

  // Fill the empty cells so every line is a word. Lines the player typed in full
  // only need to be valid words; any line with a gap is filled from PUZZLE_WORDS.
  // All 8 words are distinct. random=true varies the result from call to call.
  // Returns the 16-letter grid, null if impossible, or 'timeout' if it gave up.
  function fill(grid, { random = true, nodeLimit = 400000 } = {}) {
    const pats = LINES.map(cells => cells.map(i => grid[i] || ''));
    const cands = pats.map(pat => pat.every(Boolean)
      ? (WORDSET.has(pat.join('')) ? [pat.join('')] : [])
      : matching(PUZZLE_WORDS, pat, 'p'));
    if (cands.some(c => !c.length)) return null;
    // columns as prefix sets, so each row can be checked letter by letter
    const colPrefix = [4, 5, 6, 7].map(li => {
      const s = new Set(['']);
      cands[li].forEach(w => { for (let k = 1; k <= 4; k++) s.add(w.slice(0, k)); });
      return s;
    });
    const colWords = [4, 5, 6, 7].map(li => new Set(cands[li]));
    const order = cands.slice(0, 4).map(c => {
      const a = c.slice();
      if (random) for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });
    const rows = [];
    let nodes = 0, timedOut = false;
    function rec(r) {
      if (r === 4) {
        const cols = [0, 1, 2, 3].map(c => rows.map(w => w[c]).join(''));
        if (!cols.every((w, c) => colWords[c].has(w))) return false;
        return new Set([...rows, ...cols]).size === 8;
      }
      for (const w of order[r]) {
        if (++nodes > nodeLimit) { timedOut = true; return false; }
        if (rows.includes(w)) continue;
        let ok = true;
        for (let c = 0; c < 4 && ok; c++)
          ok = colPrefix[c].has(rows.map(x => x[c]).join('') + w[c]);
        if (!ok) continue;
        rows.push(w);
        if (rec(r + 1)) return true;
        rows.pop();
        if (timedOut) return false;
      }
      return false;
    }
    if (rec(0)) return rows.join('').split('');
    return timedOut ? 'timeout' : null;
  }

  // ---- pieces
  // Group cells into pieces from joins: joins is a Set of "a-b" (a<b, adjacent).
  function piecesFrom(joins) {
    const parent = [...Array(16).keys()];
    const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
    joins.forEach(k => { const [a, b] = k.split('-').map(Number); parent[find(a)] = find(b); });
    const groups = new Map();
    for (let i = 0; i < 16; i++) {
      const root = find(i);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(i);
    }
    return [...groups.values()];                 // each: cell indexes, ascending
  }

  // Every distinct grid the pieces can make (translation only, all 8 lines valid),
  // up to `limit`. pieces: [{cells: [[r,c],...], letters}] in any position.
  function solutions(pieces, { limit = 50, nodeLimit = 600000 } = {}) {
    const prefixes = solutions.prefixes || (solutions.prefixes = (() => {
      const s = new Set(['']);
      WORDS.forEach(w => { for (let k = 1; k <= 4; k++) s.add(w.slice(0, k)); });
      return s;
    })());
    // normalise each piece; its anchor is its top-most, then left-most cell
    const shapes = pieces.map(p => {
      const cells = p.cells.map(([r, c], i) => ({ r, c, ch: p.letters[i] }))
        .sort((a, b) => a.r - b.r || a.c - b.c);
      const r0 = cells[0].r, c0 = cells[0].c;
      const rel = cells.map(x => ({ dr: x.r - r0, dc: x.c - c0, ch: x.ch }));
      return { rel, key: rel.map(x => x.dr + ',' + x.dc + x.ch).join(' ') };
    });
    const grid = Array(16).fill('');
    const used = Array(shapes.length).fill(false);
    const found = new Set();
    let nodes = 0, timedOut = false;
    const lineOk = idx => {                      // a line's leading letters must start a word
      let s = '';
      for (const i of idx) { if (!grid[i]) break; s += grid[i]; }
      return s.length === 4 ? WORDSET.has(s) : prefixes.has(s);
    };
    function rec() {
      if (found.size >= limit || timedOut) return;
      const at = grid.indexOf('');
      if (at === -1) { found.add(grid.join('')); return; }
      const R = Math.floor(at / 4), C = at % 4;
      const tried = new Set();                   // identical pieces: try just one of them
      for (let p = 0; p < shapes.length; p++) {
        if (used[p] || tried.has(shapes[p].key)) continue;
        tried.add(shapes[p].key);
        if (++nodes > nodeLimit) { timedOut = true; return; }
        const spots = shapes[p].rel.map(x => [R + x.dr, C + x.dc, x.ch]);
        if (!spots.every(([r, c]) => r >= 0 && r < 4 && c >= 0 && c < 4 && !grid[r * 4 + c])) continue;
        spots.forEach(([r, c, ch]) => { grid[r * 4 + c] = ch; });
        used[p] = true;
        const touched = new Set();
        spots.forEach(([r, c]) => { touched.add(r); touched.add(4 + c); });
        if ([...touched].every(li => lineOk(LINES[li]))) rec();
        used[p] = false;
        spots.forEach(([r, c]) => { grid[r * 4 + c] = ''; });
        if (found.size >= limit || timedOut) return;
      }
    }
    rec();
    const grids = [...found].map(g => [0, 1, 2, 3].map(r => g.slice(r * 4, r * 4 + 4)));
    return { grids, capped: found.size >= limit, timedOut };
  }

  function wordsOf(rows) {
    return [...rows, ...[0, 1, 2, 3].map(c => rows.map(w => w[c]).join(''))];
  }

  // ---- share codes: 16 letters + a piece id per cell, lightly scrambled so the
  // answer isn't readable in the link. Version prefix "1".
  const shift = i => (7 * i + 3);
  function encode(letters, pieceOf) {          // letters: 16 chars; pieceOf: 16 ints (< 16)
    let out = '1';
    for (let i = 0; i < 16; i++)
      out += String.fromCharCode(97 + (letters[i].charCodeAt(0) - 97 + shift(i)) % 26);
    for (let i = 0; i < 16; i++) out += ((pieceOf[i] + shift(i)) % 16).toString(16);
    return out;
  }
  function decode(code) {
    if (typeof code !== 'string' || !/^1[a-z]{16}[0-9a-f]{16}$/.test(code)) return null;
    const letters = [], pieceOf = [];
    for (let i = 0; i < 16; i++)
      letters.push(String.fromCharCode(97 + ((code.charCodeAt(1 + i) - 97 - shift(i)) % 26 + 26) % 26));
    for (let i = 0; i < 16; i++)
      pieceOf.push(((parseInt(code[17 + i], 16) - shift(i)) % 16 + 16) % 16);
    return { letters, pieceOf };
  }

  return { LINES, lineStatus, fill, piecesFrom, solutions, wordsOf, encode, decode };
})();
