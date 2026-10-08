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

  // Extra words that count as words for solving and scoring (not for lineStatus):
  // a creator may use a name like MARY in their own puzzle.
  let extra = new Set();
  function allowWords(list) {
    const next = new Set(list.filter(w => !WORDSET.has(w)));
    if ([...next].join() !== [...extra].join()) { extra = next; solutions.prefixes = null; }
  }
  const isWord = w => WORDSET.has(w) || extra.has(w);

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

  // Fill the empty cells so every line is a word. A line the player typed in full
  // stays as typed, even if it isn't a word (the page warns about that); any line
  // with a gap is filled from PUZZLE_WORDS, or failing that any valid word.
  // All 8 words are distinct. random=true varies the result from call to call.
  // Returns the 16-letter grid, null if impossible, or 'timeout' if it gave up.
  function fill(grid, { random = true, nodeLimit = 400000 } = {}) {
    const pats = LINES.map(cells => cells.map(i => grid[i] || ''));
    const cands = pats.map(pat => {
      if (pat.every(Boolean)) return [pat.join('')];
      const nice = matching(PUZZLE_WORDS, pat, 'p');
      return nice.length ? nice : matching(WORDS, pat, 'v');
    });
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
      [...WORDS, ...extra].forEach(w => { for (let k = 1; k <= 4; k++) s.add(w.slice(0, k)); });
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
      return s.length === 4 ? isWord(s) : prefixes.has(s);
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

  // ---- difficulty: a port of tools/score.py, so stars mean the same as the daily's.
  // search    = -log10 P(a random legal arrangement is a solution): ominos placed as
  //             rigid pieces, singles dropped into the holes
  // branching = sum over lines of log10(# words fitting the omino-locked letters)
  // Blended 60/40 against fixed anchors → 0–100 and 1–5 stars.
  function difficulty(rows, pieces, numSolutions = 1, { samples = 120000 } = {}) {
    const g = rows.join('');
    const omino = new Set();
    pieces.forEach(p => { if (p.cells.length > 1) p.cells.forEach(([r, c]) => omino.add(r * 4 + c)); });
    let branching = 0;
    LINES.forEach(cells => {
      const n = matching(WORDS, cells.map(i => omino.has(i) ? g[i] : ''), 'v').length;
      if (n > 0) branching += Math.log10(n);
    });

    const ominos = [], singles = [];
    pieces.forEach(p => {
      if (p.cells.length === 1) { singles.push(p.letters); return; }
      const r0 = Math.min(...p.cells.map(c => c[0])), c0 = Math.min(...p.cells.map(c => c[1]));
      ominos.push({ shape: p.cells.map(([r, c]) => [r - r0, c - c0]), letters: p.letters });
    });
    // every way to place the ominos (fixed letters by cell, and the holes left over)
    const tilings = [], fixed = Array(16).fill('');
    (function rec(k) {
      if (k === ominos.length) {
        tilings.push({ fixed: fixed.slice(), holes: [...Array(16).keys()].filter(i => !fixed[i]) });
        return;
      }
      const { shape, letters } = ominos[k];
      const rmax = Math.max(...shape.map(c => c[0])), cmax = Math.max(...shape.map(c => c[1]));
      for (let R = 0; R < 4 - rmax; R++) for (let C = 0; C < 4 - cmax; C++) {
        const cells = shape.map(([r, c]) => (r + R) * 4 + c + C);
        if (cells.some(i => fixed[i])) continue;
        cells.forEach((i, j) => { fixed[i] = letters[j]; });
        rec(k + 1);
        cells.forEach(i => { fixed[i] = ''; });
      }
    })(0);
    const fact = n => n <= 1 ? 1 : n * fact(n - 1);
    const counts = {};
    singles.forEach(ch => { counts[ch] = (counts[ch] || 0) + 1; });
    const perms = Object.values(counts).reduce((x, k) => x / fact(k), fact(singles.length));
    const space = tilings.length * perms;

    const cell = Array(16);
    const solved = () => {
      for (let i = 0; i < 4; i++) {
        if (!isWord(cell[i * 4] + cell[i * 4 + 1] + cell[i * 4 + 2] + cell[i * 4 + 3])) return false;
        if (!isWord(cell[i] + cell[4 + i] + cell[8 + i] + cell[12 + i])) return false;
      }
      return true;
    };
    let pSol = 0;
    if (space && space <= 300000) {                  // small: count exactly
      let sol = 0, seen = 0;
      const letters = Object.keys(counts);
      tilings.forEach(t => {
        t.fixed.forEach((ch, i) => { cell[i] = ch; });
        (function perm(k) {                          // distinct orderings of the singles
          if (k === t.holes.length) { seen++; if (solved()) sol++; return; }
          for (const ch of letters) {
            if (!counts[ch]) continue;
            counts[ch]--; cell[t.holes[k]] = ch;
            perm(k + 1);
            counts[ch]++;
          }
        })(0);
      });
      pSol = seen ? sol / seen : 0;
    } else if (space) {                              // large: sample
      let sol = 0, seed = 20260707;                // seeded: same puzzle, same score every time
      const rand = () => {                           // mulberry32
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const sl = singles.slice();
      for (let s = 0; s < samples; s++) {
        const t = tilings[Math.floor(rand() * tilings.length)];
        for (let i = sl.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1)); [sl[i], sl[j]] = [sl[j], sl[i]];
        }
        t.fixed.forEach((ch, i) => { cell[i] = ch; });
        t.holes.forEach((i, k) => { cell[i] = sl[k]; });
        if (solved()) sol++;
      }
      pSol = sol / samples;
    }
    pSol = space ? Math.max(pSol, numSolutions / space) : 1;
    const search = pSol > 0 ? -Math.log10(pSol) : 12;
    const clamp = x => Math.max(0, Math.min(1, x));
    const score = Math.round(100 * (0.6 * clamp((search - 1.5) / 7) + 0.4 * clamp((branching - 2.5) / 8.5)));
    return { score, stars: 1 + Math.min(4, Math.floor(score / 20)), search, branching };
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

  return { LINES, allowWords, lineStatus, fill, piecesFrom, solutions, difficulty, wordsOf, encode, decode };
})();
