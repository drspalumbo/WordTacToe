// Create page: 1. type letters (Fill in does the rest) → 2. join tiles into
// pieces → 3. share a link that opens the puzzle in the game. Everything runs
// here in the browser via Solver (../solver.js); the draft is kept in
// localStorage so a refresh doesn't lose work.

const OCOLORS = ['var(--o1)', 'var(--o2)', 'var(--o3)', 'var(--o4)', 'var(--o5)', 'var(--o6)'];
const DRAFT_KEY = 'danagram_create_draft';
// Colours a creator can paint a piece (or single tile) with. Codes go in the link
// one per piece (&c=): 0 = automatic, 1–9 = these, a = plain tile. The game has the same list.
const PALETTE = { 1: 'var(--o1)', 2: 'var(--o2)', 3: 'var(--o3)', 4: 'var(--o4)', 5: 'var(--o5)',
                  6: 'var(--o6)', 7: 'var(--o7)', 8: 'var(--o8)', 9: 'var(--o9)', a: 'var(--tile)' };
// each piece's colour: painted, or the automatic one (null = a plain single tile)
function pieceColours(groups, paints = {}) {
  let auto = 0;
  return groups.map(g => {
    const own = g.length > 1 ? OCOLORS[auto++ % OCOLORS.length] : null;
    const code = (paints || {})[g[0]];
    return code && PALETTE[code] ? PALETTE[code] : own;
  });
}
const $ = id => document.getElementById(id);
const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (d && Array.isArray(d.letters) && d.letters.length === 16) return d;
  } catch (e) {}
  return null;
}
// typed[i]: the player entered it (Fill in keeps it); otherwise Fill in chose it
const draft = loadDraft() ||
  { letters: Array(16).fill(''), typed: Array(16).fill(false), joins: [], step: 'letters' };
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
if (!draft.id) draft.id = newId();                // which My puzzles entry this draft is
const saveDraft = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) {} };
const joins = () => new Set(draft.joins);

// ------------------------------------------------------------------ steps
function showStep(step) {
  if (step !== 'letters' && step !== 'mine' && !lettersReady()) step = 'letters';
  if (step !== 'mine') { draft.step = step; saveDraft(); }
  $('myBtn').hidden = step === 'mine';
  ['letters', 'pieces', 'start', 'share', 'mine'].forEach(s => {
    $('step' + s[0].toUpperCase() + s.slice(1)).hidden = s !== step;
  });
  const order = ['letters', 'pieces', 'start', 'share'];
  document.querySelectorAll('.steps li').forEach(li => {
    const k = order.indexOf(li.dataset.step), at = order.indexOf(step);
    li.classList.toggle('on', k === at);
    li.classList.toggle('done', k < at);
  });
  if (step === 'letters') renderLetters();
  if (step === 'pieces') renderPieces();
  if (step === 'start') renderStart();
  if (step === 'share') renderShare();
  if (step === 'mine') renderMine();
  window.scrollTo(0, 0);
}

// ------------------------------------------------------------ 1. letters
// Plain tiles and our own letter keyboard (no text fields, so iOS shows no
// selection handles or editing menus). Like a crossword app: tap a tile to put
// the cursor there, tap it again to switch between across and down.
const tiles = [];
const marks = [];
let cursor = 0, across = true;
(function buildLetterGrid() {
  const grid = $('letterGrid');
  for (let i = 0; i < 16; i++) {
    const t = document.createElement('div');
    t.className = 'ccell';
    t.setAttribute('role', 'button');
    t.setAttribute('aria-label', `Row ${Math.floor(i / 4) + 1}, column ${i % 4 + 1}`);
    t.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (cursor === i) across = !across; else cursor = i;
      renderCursor();
    });
    grid.appendChild(t);
    tiles.push(t);
  }
  for (let k = 0; k < 8; k++) {
    const m = document.createElement('span');
    m.className = 'lmark'; m.hidden = true;
    grid.appendChild(m);
    marks.push(m);
  }
})();
(function buildKeyboard() {
  const kb = $('keyboard');
  ['qwertyuiop', 'asdfghjkl', 'zxcvbnm⌫'].forEach(row => {
    const r = document.createElement('div');
    r.className = 'krow';
    [...row].forEach(ch => {
      const k = document.createElement('button');
      k.className = 'key' + (ch === '⌫' ? ' wide' : '');
      k.textContent = ch === '⌫' ? '⌫' : ch.toUpperCase();
      k.setAttribute('aria-label', ch === '⌫' ? 'Delete' : ch.toUpperCase());
      // act on press, not release: quick typing shouldn't drop letters
      k.addEventListener('pointerdown', e => {
        e.preventDefault();
        k.classList.add('pressed');
        ch === '⌫' ? backspace() : typeLetter(ch);
      });
      const up = () => k.classList.remove('pressed');
      k.addEventListener('pointerup', up); k.addEventListener('pointerleave', up);
      k.addEventListener('pointercancel', up);
      r.appendChild(k);
    });
    kb.appendChild(r);
  });
})();
// a physical keyboard works too
document.addEventListener('keydown', e => {
  if (draft.step !== 'letters' || e.metaKey || e.ctrlKey || e.altKey) return;
  const move = { ArrowRight: [1, true], ArrowLeft: [-1, true], ArrowDown: [4, false], ArrowUp: [-4, false] }[e.key];
  if (/^[a-z]$/i.test(e.key)) typeLetter(e.key.toLowerCase());
  else if (e.key === 'Backspace') backspace();
  else if (move) {
    const j = cursor + move[0];
    if (j >= 0 && j < 16 && (!move[1] || Math.floor(j / 4) === Math.floor(cursor / 4))) cursor = j;
    across = move[1];
    renderCursor();
  }
  else return;
  e.preventDefault();
});

const step = d => across ? (cursor % 4 + d >= 0 && cursor % 4 + d < 4 ? cursor + d : -1)
                         : (cursor + 4 * d >= 0 && cursor + 4 * d < 16 ? cursor + 4 * d : -1);
function setCell(i, ch) {
  draft.letters[i] = ch; draft.typed[i] = !!ch;
  saveDraft(); renderLetters();
}
function typeLetter(ch) {
  setCell(cursor, ch);
  const next = step(1);
  if (next >= 0) cursor = next;
  renderCursor();
}
function backspace() {
  if (!draft.letters[cursor]) {                // empty: step back, then clear that one
    const prev = step(-1);
    if (prev >= 0) cursor = prev;
  }
  setCell(cursor, '');
  renderCursor();
}
function renderCursor() {
  const line = across ? Solver.LINES[Math.floor(cursor / 4)] : Solver.LINES[4 + cursor % 4];
  tiles.forEach((t, i) => {
    t.classList.toggle('cur', i === cursor);
    t.classList.toggle('inline', i !== cursor && line.includes(i));
  });
}

function gridWords() {
  const rows = [0, 1, 2, 3].map(r => draft.letters.slice(r * 4, r * 4 + 4).join(''));
  return Solver.wordsOf(rows);
}
function lettersReady() {
  if (draft.letters.some(ch => !ch)) return false;
  return new Set(gridWords()).size === 8;          // non-words are allowed (with a warning)
}

const LINE_NAME = k => k < 4 ? `Row ${k + 1}` : `Column ${k - 3}`;
function renderLetters() {
  const status = Solver.lineStatus(draft.letters);
  const bad = new Set(), warn = new Set();
  tiles.forEach((t, i) => {
    t.textContent = draft.letters[i] ? draft.letters[i].toUpperCase() : '';
    t.classList.toggle('filled', !!draft.letters[i] && !draft.typed[i]);
  });
  status.forEach((s, k) => {
    if (s === 'nofit') Solver.LINES[k].forEach(i => bad.add(i));
    if (s === 'notword') Solver.LINES[k].forEach(i => warn.add(i));
  });
  tiles.forEach((t, i) => {
    t.classList.toggle('bad', bad.has(i));
    t.classList.toggle('warn', !bad.has(i) && warn.has(i));
  });
  placeMarks(status);

  const issues = [];
  status.forEach((s, k) => {
    const word = Solver.LINES[k].map(i => draft.letters[i]).join('').toUpperCase();
    if (s === 'notword') issues.push(['warn', `${LINE_NAME(k)}: “${word}” isn’t in the word list, but it will still count in your puzzle.`]);
    if (s === 'nofit') issues.push(['bad', `${LINE_NAME(k)}: no word fits these letters.`]);
  });
  const full = draft.letters.every(Boolean);
  const onlyWarnings = issues.every(([cls]) => cls === 'warn');
  if (onlyWarnings && full) {
    if (new Set(gridWords()).size < 8) issues.push(['bad', 'Each row and column needs a different word.']);
    else if (!issues.length) issues.push(['good', 'All 8 are words. Nice!']);
  }
  // (a typed non-word line doesn't stop this: Fill in keeps it and fills around it)
  if (onlyWarnings && !full && draft.letters.some(Boolean)) {
    // can what's here still become a full grid? (quick, and only a hint)
    const base = draft.letters.map((ch, i) => draft.typed[i] ? ch : '');
    const res = Solver.fill(base, { random: false, nodeLimit: 120000 });
    if (res === null) issues.push(['bad', 'These letters can’t all be completed into words.']);
  }
  // nothing to flag: say what to do (this step has no hint paragraph, to fit the keyboard)
  if (!issues.length) issues.push(['info', draft.letters.some(Boolean)
    ? 'Keep typing, or Fill in the rest.' : 'Type any letters you like, then Fill in the rest.']);
  $('issues').innerHTML = issues.map(([cls, t]) => `<li class="${cls}">${t}</li>`).join('');
  const anyFilled = draft.letters.some((ch, i) => ch && !draft.typed[i]);
  $('fillBtn').textContent = anyFilled ? 'Fill again' : 'Fill in';
  $('clearFilledBtn').disabled = !anyFilled;
  $('clearBtn').disabled = !draft.letters.some(Boolean);
  $('toPieces').disabled = !lettersReady();
}

// ✓ / ✗ at the end of each row and the foot of each column
function placeMarks(status) {
  const cells = tiles.map(t => ({ x: t.offsetLeft, y: t.offsetTop, w: t.offsetWidth }));
  status.forEach((s, k) => {
    const m = marks[k];
    const show = s === 'ok' || s === 'notword' || s === 'nofit';
    m.hidden = !show;
    if (!show) return;
    m.className = 'lmark ' + { ok: 'ok', notword: 'warn', nofit: 'bad' }[s];
    m.textContent = { ok: '✓', notword: '!', nofit: '✗' }[s];
    const end = cells[Solver.LINES[k][3]];
    if (k < 4) { m.style.left = (end.x + end.w - 9) + 'px'; m.style.top = (end.y + end.w / 2 - 9) + 'px'; }
    else { m.style.left = (end.x + end.w / 2 - 9) + 'px'; m.style.top = (end.y + end.w - 9) + 'px'; }
  });
}

$('fillBtn').addEventListener('click', () => {
  const base = draft.letters.map((ch, i) => draft.typed[i] ? ch : '');
  const res = Solver.fill(base);
  if (Array.isArray(res)) {
    draft.letters = res;
    saveDraft(); renderLetters();
    return;
  }
  $('issues').innerHTML = res === 'timeout'
    ? '<li class="bad">That one’s tricky. <button class="mlink" id="keepTrying">Keep trying</button> (may take a few seconds), or change a letter.</li>'
    : '<li class="bad">There’s no way to fill these in with words. Try changing a letter.</li>';
});
// opt-in: a search 10× longer. A beat first so "Thinking…" shows before the page is busy.
document.addEventListener('click', e => {
  if (!e.target.closest('#keepTrying')) return;
  $('issues').innerHTML = '<li class="info">Thinking…</li>';
  setTimeout(() => {
    const base = draft.letters.map((ch, i) => draft.typed[i] ? ch : '');
    const res = Solver.fill(base, { nodeLimit: 20000000 });
    if (Array.isArray(res)) { draft.letters = res; saveDraft(); renderLetters(); return; }
    $('issues').innerHTML = res === 'timeout'
      ? '<li class="bad">Still couldn’t find one. Try changing a letter.</li>'
      : '<li class="bad">There’s no way to fill these in with words. Try changing a letter.</li>';
  }, 60);
});

// two taps to clear everything, so a stray tap doesn't wipe the grid
function confirmTap(btn, label, action) {
  if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = label; action(); return; }
  btn.dataset.armed = '1'; btn.textContent = 'Tap again';
  setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = label; } }, 2500);
}
$('clearBtn').addEventListener('click', e => confirmTap(e.currentTarget, 'Clear all', () => {
  draft.letters = Array(16).fill(''); draft.typed = Array(16).fill(false); draft.joins = [];
  cursor = 0; across = true;
  saveDraft(); renderLetters(); renderCursor();
}));
// keep what you typed, drop what Fill in chose
$('clearFilledBtn').addEventListener('click', () => {
  draft.letters = draft.letters.map((ch, i) => draft.typed[i] ? ch : '');
  saveDraft(); renderLetters();
});
$('toPieces').addEventListener('click', () => showStep('pieces'));

// ------------------------------------------------------------- 2. pieces
const pcells = [];
let selected = -1;
(function buildPieceGrid() {
  const grid = $('pieceGrid');
  for (let i = 0; i < 16; i++) {
    const d = document.createElement('div');
    d.className = 'ccell';
    d.addEventListener('click', () => tapTile(i));
    grid.appendChild(d);
    pcells.push(d);
  }
})();
const adjacent = (a, b) => (Math.abs(a - b) === 1 && Math.floor(a / 4) === Math.floor(b / 4)) || Math.abs(a - b) === 4;
const jkey = (a, b) => Math.min(a, b) + '-' + Math.max(a, b);
function toggleJoin(a, b) {
  const j = joins(), k = jkey(a, b);
  j.has(k) ? j.delete(k) : j.add(k);
  draft.joins = [...j]; saveDraft(); renderPieces();
}
function tapTile(i) {
  if (painting()) {                              // Colors open: tapping paints the whole piece
    const g = Solver.piecesFrom(joins()).find(g => g.includes(i));
    draft.colors = Object.assign({}, draft.colors);
    if (brush === '0') delete draft.colors[g[0]]; else draft.colors[g[0]] = brush;
    saveDraft(); renderPieces();
    return;
  }
  if (selected === -1) selected = i;
  else if (selected === i) selected = -1;
  else if (adjacent(selected, i)) { toggleJoin(selected, i); selected = -1; }
  else selected = i;
  renderPieces();
}

function renderPieces() {
  const grid = $('pieceGrid');
  grid.querySelectorAll('.joint, .bridge').forEach(e => e.remove());
  const j = joins();
  const groups = Solver.piecesFrom(j);
  const pieceOf = Array(16);
  const colours = pieceColours(groups, draft.colors);
  groups.forEach((g, p) => g.forEach(i => { pieceOf[i] = p; }));
  grid.classList.toggle('painting', painting());

  const R = 12;
  pcells.forEach((d, i) => {
    d.textContent = (draft.letters[i] || '').toUpperCase();
    const col = colours[pieceOf[i]];
    d.style.background = col || 'var(--tile)';
    d.style.boxShadow = col ? 'none' : '';
    d.classList.toggle('sel', i === selected);
    // square off corners where the tile joins a neighbour, like the game's pieces
    const up = i > 3 && j.has(jkey(i - 4, i)), dn = i < 12 && j.has(jkey(i, i + 4));
    const lf = i % 4 > 0 && j.has(jkey(i - 1, i)), rt = i % 4 < 3 && j.has(jkey(i, i + 1));
    d.style.borderRadius = [(!up && !lf) ? R : 0, (!up && !rt) ? R : 0,
                            (!dn && !rt) ? R : 0, (!dn && !lf) ? R : 0].map(v => v + 'px').join(' ');
  });

  // joints in the gaps (bigger than they look, for fingers) and bridges across joins
  const box = i => ({ x: pcells[i].offsetLeft, y: pcells[i].offsetTop, s: pcells[i].offsetWidth });
  const gap = box(1).x - box(0).x - box(0).s;
  for (let i = 0; i < 16; i++) {
    [[i, i + 1, i % 4 < 3], [i, i + 4, i < 12]].forEach(([a, b, ok]) => {
      if (!ok) return;
      const A = box(a), horiz = b === a + 1, on = j.has(jkey(a, b));
      if (on) {
        const br = document.createElement('div');
        br.className = 'bridge';
        br.style.background = colours[pieceOf[a]];
        Object.assign(br.style, horiz
          ? { left: (A.x + A.s - 1) + 'px', top: A.y + 'px', width: (gap + 2) + 'px', height: A.s + 'px' }
          : { left: A.x + 'px', top: (A.y + A.s - 1) + 'px', width: A.s + 'px', height: (gap + 2) + 'px' });
        grid.appendChild(br);
      }
      const jt = document.createElement('button');
      jt.className = 'joint' + (on ? ' on' : '');
      jt.setAttribute('aria-label', `${on ? 'Split' : 'Join'} ${(draft.letters[a] || '').toUpperCase()} and ${(draft.letters[b] || '').toUpperCase()}`);
      Object.assign(jt.style, horiz
        ? { left: (A.x + A.s - 10) + 'px', top: (A.y + A.s * .25) + 'px', width: (gap + 20) + 'px', height: (A.s * .5) + 'px' }
        : { left: (A.x + A.s * .25) + 'px', top: (A.y + A.s - 10) + 'px', width: (A.s * .5) + 'px', height: (gap + 20) + 'px' });
      jt.addEventListener('click', e => { e.stopPropagation(); selected = -1; toggleJoin(a, b); });
      grid.appendChild(jt);
    });
  }
  // fill the middle of a fully joined 2×2 block
  for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) {
    if ([jkey(i, i + 1), jkey(i + 4, i + 5), jkey(i, i + 4), jkey(i + 1, i + 5)].every(k => j.has(k))) {
      const A = box(i), br = document.createElement('div');
      br.className = 'bridge';
      br.style.background = colours[pieceOf[i]];
      Object.assign(br.style, { left: (A.x + A.s - 1) + 'px', top: (A.y + A.s - 1) + 'px',
                                width: (gap + 2) + 'px', height: (gap + 2) + 'px' });
      grid.appendChild(br);
    }
  }
  renderPieceInfo(groups);
}

function puzzlePieces(groups) {
  return groups.map(g => ({ cells: g.map(i => [Math.floor(i / 4), i % 4]),
                            letters: g.map(i => draft.letters[i]).join('') }));
}
let lastSolve = null;
function renderPieceInfo(groups) {
  const multi = groups.filter(g => g.length > 1).length, singles = groups.length - multi;
  Solver.allowWords(gridWords());                // a name like MARY counts in this puzzle
  const res = Solver.solutions(puzzlePieces(groups), { limit: 20 });
  lastSolve = res;
  const n = res.grids.length;
  let verdict;
  if (res.timedOut) verdict = '<span class="warn">⚠ Lots of possible solutions — join more tiles to narrow it down.</span>';
  else if (n === 1) verdict = '<span class="good">✓ Exactly one solution.</span>';
  else verdict = `<span class="warn">⚠ ${res.capped ? '20+' : n} possible solutions. Fine to share, but joining more tiles narrows it down.</span>`;
  lastDiff = difficultyOf(groups, n);
  $('pieceInfo').innerHTML =
    `${multi} piece${multi === 1 ? '' : 's'} + ${singles} single tile${singles === 1 ? '' : 's'}<br>${verdict}` +
    `<br><span class="diff">Difficulty ${starRow(lastDiff.stars)} <small>${lastDiff.score}/100</small></span>`;
  renderDiffDetail(lastDiff);
}
// The fold-out: the same two measures the daily puzzles are scored with, with the
// working shown, so the number can be understood (and the model tuned).
function fmtBig(n) {
  if (!isFinite(n)) return 'a huge number';
  if (n < 1e6) return Math.round(n).toLocaleString();
  const units = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];
  const [v, name] = units.find(([v]) => n >= v);
  return (n / v >= 100 ? Math.round(n / v) : +(n / v).toPrecision(2)) + ' ' + name;
}
function renderDiffDetail(d) {
  const pct = x => Math.round(x * 100);
  const lineName = k => k < 4 ? `Row ${k + 1}` : `Col ${k - 3}`;
  const oneIn = d.pSol > 0 ? fmtBig(1 / d.pSol) : 'a huge number';
  $('diffBody').innerHTML = `
    <p class="dd-sum"><b>${d.score}</b> = 60% × search <b>${pct(d.searchNorm)}</b>
       + 40% × word choice <b>${pct(d.wordNorm)}</b>. Every 20 points is a star.</p>
    <h4>Search: ${pct(d.searchNorm)}/100</h4>
    <p>How unlikely a random arrangement is to be a solution. With
       ${d.ominos} piece${d.ominos === 1 ? '' : 's'} and ${d.singles} single tile${d.singles === 1 ? '' : 's'}
       there are ${fmtBig(d.space)} ways to fill the grid, and ${
         Math.round(d.pSol * d.space) <= d.solutions
           ? `only <b>${d.solutions} of them</b> solve${d.solutions === 1 ? 's' : ''} it`
           : `about <b>1 in ${oneIn}</b> of them solves it${d.exact ? '' : ' (estimated by sampling)'}`}.
       That’s ${d.search.toFixed(1)} on a scale where 1.5 scores 0 and 8.5 scores 100.
       Single tiles make this climb fast.</p>
    <h4>Word choice: ${pct(d.wordNorm)}/100</h4>
    <p>How many words could go in each line, given only the letters the pieces lock
       together. Lots of options means lots to try; a rare locked pair gives a word away.</p>
    <div class="dd-lines">${d.perLine.map((n, k) =>
      `<span>${lineName(k)}</span><b>${n.toLocaleString()}</b>`).join('')}</div>
    <p>Multiplied together, that’s about 10<sup>${d.branching.toFixed(1)}</sup>, scored on a
       scale where 10<sup>2.5</sup> is 0 and 10<sup>11</sup> is 100.</p>`;
}
// same scale as the daily puzzles (tools/score.py): 1–5 stars, 0–100
let lastDiff = null;
function difficultyOf(groups, nSolutions) {
  const rows = [0, 1, 2, 3].map(r => draft.letters.slice(r * 4, r * 4 + 4).join(''));
  return Solver.difficulty(rows, puzzlePieces(groups), Math.max(1, nSolutions));
}
const starRow = n => `<span class="stars" aria-label="${n} of 5 stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`;
$('backToLetters').addEventListener('click', () => showStep('letters'));
$('toStart').addEventListener('click', () => showStep('start'));

// ---- Colors fold-out: while it's open, tapping a piece paints it with the brush
let brush = '1';
const painting = () => $('colorDetail').open;
(function buildSwatches() {
  const box = $('swatches');
  [['0', null, 'Auto'], ...Object.entries(PALETTE).map(([k, v]) => [k, v, null])].forEach(([code, css, label]) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (code === '0' ? ' auto' : '');
    b.dataset.code = code;
    b.setAttribute('aria-label', label || (code === 'a' ? 'Plain' : 'Colour ' + code));
    if (css) b.style.background = css;
    if (label) b.textContent = label;
    b.addEventListener('click', () => { brush = code; renderSwatches(); });
    box.appendChild(b);
  });
})();
function renderSwatches() {
  document.querySelectorAll('.swatch').forEach(b => b.classList.toggle('on', b.dataset.code === brush));
}
$('colorDetail').addEventListener('toggle', () => { selected = -1; renderSwatches(); renderPieces(); });
$('resetColors').addEventListener('click', () => { draft.colors = {}; saveDraft(); renderPieces(); });
// for the link: one code per piece, or nothing if every piece is automatic
function paintParam(groups = Solver.piecesFrom(joins()), paints = draft.colors || {}) {
  const c = groups.map(g => PALETTE[paints[g[0]]] ? paints[g[0]] : '0').join('');
  return /[^0]/.test(c) ? c : '';
}
// and back: a code string (one per piece) → paints keyed by each piece's first cell
function paintsFrom(groups, c) {
  if (c && typeof c === 'object') return c;
  if (!c || typeof c !== 'string' || c.length !== groups.length) return {};
  const out = {};
  groups.forEach((g, p) => { if (PALETTE[c[p]]) out[g[0]] = c[p]; });
  return out;
}

// -------------------------------------------------------------- 3. start
// Where the pieces sit when a player opens the puzzle, on the game's 6×6 board
// (the answer goes in the middle 4×4). draft.start: per piece (in piecesFrom
// order), the board square (0–35) of its first cell; null = the game's own
// random start. It's tied to the pieces it was made for (draft.startFor).
const N6 = 6;
let sel6 = null;                                   // {p, k}: piece and which of its cells was grabbed
function startGroups() {
  const groups = Solver.piecesFrom(joins());
  const pieces = puzzlePieces(groups);
  const colours = pieceColours(groups, draft.colors);
  return groups.map((g, p) => ({
    g, letters: pieces[p].letters,
    rel: g.map(i => [Math.floor(i / 4) - Math.floor(g[0] / 4), i % 4 - g[0] % 4]),
    colour: colours[p],
  }));
}
function startValid() {
  if (!draft.start || draft.startFor !== shareCode()) { draft.start = null; return false; }
  return true;
}
// squares each piece covers for a start (null if off the board)
function covered(ps, start) {
  return ps.map((P, p) => {
    const R = Math.floor(start[p] / N6), C = start[p] % N6;
    const sq = P.rel.map(([r, c]) => [R + r, C + c]);
    return sq.every(([r, c]) => r >= 0 && r < N6 && c >= 0 && c < N6) ? sq : null;
  });
}
function fits(ps, start) {
  const cov = covered(ps, start), seen = new Set();
  for (const sq of cov) {
    if (!sq) return false;
    for (const [r, c] of sq) { const k = r * N6 + c; if (seen.has(k)) return false; seen.add(k); }
  }
  return true;
}
// is this start already the answer (every piece home in the 4×4, all lines words)?
function startSolved(ps, start) {
  const cell = Array(16).fill('');
  for (const [p, sq] of covered(ps, start).entries()) for (const [k, [r, c]] of sq.entries()) {
    if (r < 1 || r > 4 || c < 1 || c > 4) return false;
    cell[(r - 1) * 4 + c - 1] = ps[p].letters[k];
  }
  Solver.allowWords(gridWords());
  const rows = [0, 1, 2, 3].map(r => cell.slice(r * 4, r * 4 + 4).join(''));
  return Solver.wordsOf(rows).every(w => WORDSET.has(w) || gridWords().includes(w));
}
// a random spot for every piece, biggest first (not the game's scramble, just a start)
function scrambleStart(ps) {
  for (let tries = 0; tries < 200; tries++) {
    const start = Array(ps.length), taken = new Set();
    const order = ps.map((P, p) => p).sort((a, b) => ps[b].g.length - ps[a].g.length);
    let ok = true;
    for (const p of order) {
      const spots = [];
      for (let s = 0; s < N6 * N6; s++) {
        const R = Math.floor(s / N6), C = s % N6;
        const sq = ps[p].rel.map(([r, c]) => [R + r, C + c]);
        if (sq.every(([r, c]) => r >= 0 && r < N6 && c >= 0 && c < N6 && !taken.has(r * N6 + c))) spots.push([s, sq]);
      }
      if (!spots.length) { ok = false; break; }
      const [s, sq] = spots[Math.floor(Math.random() * spots.length)];
      start[p] = s; sq.forEach(([r, c]) => taken.add(r * N6 + c));
    }
    if (ok && !startSolved(ps, start)) return start;
  }
  return null;
}
function setStart(start) {
  draft.start = start; draft.startFor = start ? shareCode() : null;
  saveDraft();
}

function renderStart() {
  const ps = startGroups(), custom = startValid();
  const board = $('startBoard');
  board.innerHTML = '';
  board.classList.toggle('off', !custom);
  const W = board.clientWidth, pad = 8, gap = 4;
  const S = (W - 2 * pad - (N6 - 1) * gap) / N6, step = S + gap;
  const at = (r, c) => [pad + c * step, pad + r * step];
  // the squares, with the 4×4 the answer goes in marked
  for (let r = 0; r < N6; r++) for (let c = 0; c < N6; c++) {
    const q = document.createElement('div');
    q.className = 'sq' + (r >= 1 && r <= 4 && c >= 1 && c <= 4 ? ' zone' : '');
    const [x, y] = at(r, c);
    Object.assign(q.style, { left: x + 'px', top: y + 'px', width: S + 'px', height: S + 'px' });
    q.dataset.sq = r * N6 + c;
    board.appendChild(q);
  }
  if (!custom) {
    $('startHint').textContent = 'Players start from a random arrangement (the same one for everyone). ' +
      'To set it yourself — tee up a red herring, or spell a message — arrange it here.';
    const b = document.createElement('button');
    b.className = 'btn primary sboard-go'; b.textContent = 'Arrange the start';
    b.addEventListener('click', () => { setStart(scrambleStart(ps)); sel6 = null; renderStart(); });
    board.appendChild(b);
    $('startInfo').textContent = '';
    $('startRandom').hidden = true; $('startScramble').hidden = true;
    return;
  }
  $('startHint').textContent = 'Drag pieces to where players will find them, or tap a piece and then a square.';
  $('startRandom').hidden = false; $('startScramble').hidden = false;
  const cov = covered(ps, draft.start);
  ps.forEach((P, p) => {
    const el = document.createElement('div');
    el.className = 'spiece' + (sel6 && sel6.p === p ? ' sel' : '');
    el.dataset.p = p;
    const minR = Math.min(...cov[p].map(x => x[0])), minC = Math.min(...cov[p].map(x => x[1]));
    const [ox, oy] = at(minR, minC);
    Object.assign(el.style, { left: ox + 'px', top: oy + 'px' });
    const has = (r, c) => cov[p].some(x => x[0] === r && x[1] === c);
    cov[p].forEach(([r, c], k) => {
      const t = document.createElement('div');
      t.className = 'stile';
      t.textContent = P.letters[k].toUpperCase();
      t.dataset.k = k;
      Object.assign(t.style, { left: (c - minC) * step + 'px', top: (r - minR) * step + 'px',
                               width: S + 'px', height: S + 'px', fontSize: S * .46 + 'px',
                               background: P.colour || 'var(--tile)' });
      if (P.colour) t.style.boxShadow = 'none';
      // square off corners where it joins the rest of its piece
      const up = has(r - 1, c), dn = has(r + 1, c), lf = has(r, c - 1), rt = has(r, c + 1), R = 10;
      t.style.borderRadius = [(!up && !lf) ? R : 0, (!up && !rt) ? R : 0,
                              (!dn && !rt) ? R : 0, (!dn && !lf) ? R : 0].map(v => v + 'px').join(' ');
      el.appendChild(t);
      // bridges to the right and below, so a piece reads as one shape
      [[0, 1], [1, 0]].forEach(([dr, dc]) => {
        if (!has(r + dr, c + dc)) return;
        const b = document.createElement('div');
        b.className = 'sbridge';
        Object.assign(b.style, dc
          ? { left: ((c - minC) * step + S - 1) + 'px', top: (r - minR) * step + 'px', width: gap + 2 + 'px', height: S + 'px' }
          : { left: (c - minC) * step + 'px', top: ((r - minR) * step + S - 1) + 'px', width: S + 'px', height: gap + 2 + 'px' });
        b.style.background = P.colour;
        el.appendChild(b);
      });
    });
    board.appendChild(el);
  });
  const inZone = cov.flat().filter(([r, c]) => r >= 1 && r <= 4 && c >= 1 && c <= 4).length;
  // words the start already shows (a free point for the player); stronger if it's
  // a word from the answer. Warnings only: a creator may want either on purpose.
  const shown = startWords(ps, draft.start);
  const answer = answerWords();
  const fmt = list => list.map(([name, w]) => `${name}: ${w.toUpperCase()}`).join(', ');
  const inAnswer = shown.filter(([, w]) => answer.has(w)), other = shown.filter(([, w]) => !answer.has(w));
  $('startInfo').innerHTML = `${inZone} of 16 squares in the middle are filled.` +
    (inAnswer.length ? `<br><span class="bad">⚠ The start shows ${inAnswer.length === 1 ? 'an answer word' : 'answer words'}
       (${fmt(inAnswer)}). That gives part of the solution away.</span>` : '') +
    (other.length ? `<br><span class="warn">Heads up: the start already spells ${fmt(other)}.
       Players get ${other.length === 1 ? 'it' : 'them'} for free.</span>` : '');
  startBoardGeom = { pad, step, S };
}
// the words a start shows, by the game's rule: a full row or column of the middle
// 4×4 that's a word, and doesn't run on (a piece at either end carrying on past it)
function startWords(ps, start) {
  const at = new Map();                          // square → [piece, letter]
  covered(ps, start).forEach((sq, p) => sq.forEach(([r, c], k) => at.set(r * N6 + c, [p, ps[p].letters[k]])));
  const extra = new Set(gridWords());
  const out = [];
  for (let i = 0; i < 8; i++) {
    const cells = [0, 1, 2, 3].map(j => i < 4 ? [1 + i, 1 + j] : [1 + j, 1 + i - 4]);
    const hits = cells.map(([r, c]) => at.get(r * N6 + c));
    if (hits.some(h => !h)) continue;
    const [dr, dc] = i < 4 ? [0, 1] : [1, 0];
    const runsOn = ([r, c], [br, bc], h) => { const b = at.get(br * N6 + bc); return br >= 0 && bc >= 0 && br < N6 && bc < N6 && b && b[0] === h[0]; };
    const [f, l] = [cells[0], cells[3]];
    if (runsOn(f, [f[0] - dr, f[1] - dc], hits[0]) || runsOn(l, [l[0] + dr, l[1] + dc], hits[3])) continue;
    const w = hits.map(h => h[1]).join('');
    if (WORDSET.has(w) || extra.has(w)) out.push([i < 4 ? `row ${i + 1}` : `column ${i - 3}`, w]);
  }
  return out;
}
// every word in any solution (the puzzle's own, plus any other way to solve it)
function answerWords() {
  const set = new Set(gridWords());
  if (lastSolve) lastSolve.grids.forEach(g => Solver.wordsOf(g).forEach(w => set.add(w)));
  return set;
}
let startBoardGeom = null;

// drag: the grabbed piece follows the finger and snaps to the nearest squares on
// release; a drop that's off the board or on another piece goes back. A tap
// (no movement) selects the piece; then tapping a square moves the grabbed cell there.
let drag6 = null;
$('startBoard').addEventListener('pointerdown', e => {
  const t = e.target.closest('.stile');
  if (!t) return;
  e.preventDefault();
  const el = t.parentElement;
  drag6 = { p: +el.dataset.p, k: +t.dataset.k, el, x: e.clientX, y: e.clientY, moved: false,
            left: parseFloat(el.style.left), top: parseFloat(el.style.top) };
  el.setPointerCapture(e.pointerId);
  el.classList.add('lift');
});
$('startBoard').addEventListener('pointermove', e => {
  if (!drag6) return;
  const dx = e.clientX - drag6.x, dy = e.clientY - drag6.y;
  if (Math.abs(dx) + Math.abs(dy) > 6) drag6.moved = true;
  if (drag6.moved) {
    drag6.el.style.left = drag6.left + dx + 'px';
    drag6.el.style.top = drag6.top + dy + 'px';
  }
});
function moveGrabbed(p, k, R, C) {               // put piece p's cell k on square (R, C)
  const ps = startGroups();
  const [kr, kc] = ps[p].rel[k];
  const start = draft.start.slice();
  start[p] = (R - kr) * N6 + (C - kc);
  const r0 = R - kr, c0 = C - kc;
  if (r0 < 0 || c0 < 0 || r0 >= N6 || c0 >= N6 || !fits(ps, start)) return 'blocked';
  if (startSolved(ps, start)) return 'solved';
  setStart(start);
  return 'ok';
}
$('startBoard').addEventListener('pointerup', e => {
  if (!drag6) return;
  const d = drag6; drag6 = null;
  d.el.classList.remove('lift');
  if (!d.moved) {                                // a tap: select, or deselect
    sel6 = sel6 && sel6.p === d.p ? null : { p: d.p, k: d.k };
    renderStart();
    return;
  }
  const { pad, step } = startBoardGeom;
  const t = d.el.querySelector(`.stile[data-k="${d.k}"]`);
  const R = Math.round((parseFloat(d.el.style.top) + parseFloat(t.style.top) - pad) / step);
  const C = Math.round((parseFloat(d.el.style.left) + parseFloat(t.style.left) - pad) / step);
  const res = moveGrabbed(d.p, d.k, R, C);
  sel6 = null;
  renderStart();
  if (res !== 'ok') $('startInfo').textContent = res === 'solved'
    ? 'That would start the puzzle solved!' : 'It doesn’t fit there.';
});
$('startBoard').addEventListener('pointercancel', () => { drag6 = null; renderStart(); });
$('startBoard').addEventListener('click', e => {
  const q = e.target.closest('.sq');
  if (!q || !sel6) return;
  const s = +q.dataset.sq;
  const res = moveGrabbed(sel6.p, sel6.k, Math.floor(s / N6), s % N6);
  if (res === 'ok') sel6 = null;
  renderStart();
  if (res !== 'ok') $('startInfo').textContent = res === 'solved'
    ? 'That would start the puzzle solved!' : 'It doesn’t fit there.';
});
$('startScramble').addEventListener('click', () => { setStart(scrambleStart(startGroups())); sel6 = null; renderStart(); });
$('startRandom').addEventListener('click', () => { setStart(null); sel6 = null; renderStart(); });
$('backToPieces2').addEventListener('click', () => showStep('pieces'));
$('toShare').addEventListener('click', () => showStep('share'));
// for the link: one base-36 character per piece
const startParam = () => startValid() ? draft.start.map(s => s.toString(36)).join('') : '';

// -------------------------------------------------------------- 3. share
function shareCode() {
  const groups = Solver.piecesFrom(joins());
  const pieceOf = Array(16);
  groups.forEach((g, p) => g.forEach(i => { pieceOf[i] = p; }));
  return Solver.encode(draft.letters, pieceOf);
}
// the game link: the puzzle, plus the title and note when there are any
function linkFor(code, title, note, start, colors) {
  return new URL('../?p=' + code + (start ? '&s=' + start : '') + (colors ? '&c=' + colors : '') +
    (title ? '&t=' + encodeURIComponent(title) : '') +
    (note ? '&n=' + encodeURIComponent(note) : ''), location.href).href;
}
// share text: "I made a Danagram!", the title, then the link (the share sheet adds
// the link after the text; a copied version spells it out)
const shareMsg = title => 'I made a Danagram!' + (title ? '\n' + title : '');
const shareFull = (title, url) => shareMsg(title) + '\n' + url;
let shareMeta = null;
function updateLink() {
  const url = linkFor(shareCode(), draft.title, draft.note, startParam(), paintParam());
  $('shareUrl').value = url;
  $('playLink').href = url;
  if (shareMeta) remember(...shareMeta);
}
['titleIn', 'noteIn'].forEach(id => $(id).addEventListener('input', () => {
  draft.title = $('titleIn').value.replace(/\s+/g, ' ').trim();
  draft.note = $('noteIn').value.trim();
  saveDraft(); updateLink();
}));
function renderShare() {
  $('titleIn').value = draft.title || '';
  $('noteIn').value = draft.note || '';
  $('shareNote').textContent = '';
  const groups = Solver.piecesFrom(joins());
  const multi = groups.filter(g => g.length > 1).length;
  Solver.allowWords(gridWords());
  const res = lastSolve || Solver.solutions(puzzlePieces(groups), { limit: 20 });
  const n = res.grids.length;
  $('shareSummary').textContent = `Your Danagram: ${multi} piece${multi === 1 ? '' : 's'} and ` +
    `${16 - groups.filter(g => g.length > 1).reduce((s, g) => s + g.length, 0)} single tiles, ` +
    (n === 1 && !res.timedOut ? 'with exactly one solution.' : 'with more than one possible solution.') +
    ' Anyone with the link can play it. It’s saved in My puzzles.';
  const diff = lastDiff || difficultyOf(groups, n);
  $('shareDiff').innerHTML = `Difficulty ${starRow(diff.stars)} <small>${diff.score}/100</small>`;
  shareMeta = [n, res.capped || res.timedOut, multi, diff];
  updateLink();
}
$('shareBtn').addEventListener('click', async () => {
  const url = $('shareUrl').value;
  if (navigator.share) {
    try { await navigator.share({ title: 'Danagram', text: shareMsg(draft.title), url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareFull(draft.title, url));
      $('shareNote').textContent = 'Copied!';
      return;
    }
  } catch (e) {}
  $('shareUrl').focus(); $('shareUrl').select();
  $('shareNote').textContent = 'Copy the link above.';
});
$('backToPieces').addEventListener('click', () => showStep('start'));
function newPuzzle() {
  Object.assign(draft, { id: newId(), letters: Array(16).fill(''), typed: Array(16).fill(false), joins: [],
                         title: '', note: '', start: null, startFor: null, colors: {} });
  shareMeta = null;
  cursor = 0; across = true; showStep('letters');
}
// it's saved in My puzzles by now, so no need to confirm
$('startOver').addEventListener('click', newPuzzle);

// ------------------------------------------------------------ My puzzles
// Every puzzle that reaches the Share step is kept here, on this device only
// (newest first). Editing one and sharing again updates the same entry.
const MINE_KEY = 'danagram_my_puzzles';
function loadMine() {
  try { const a = JSON.parse(localStorage.getItem(MINE_KEY)); if (Array.isArray(a)) return a; } catch (e) {}
  return [];
}
const saveMine = list => { try { localStorage.setItem(MINE_KEY, JSON.stringify(list)); } catch (e) {} };
function remember(nSolutions, more, pieces, diff) {
  const list = loadMine(), code = shareCode(), now = Date.now();
  const old = list.find(e => e.id === draft.id);
  const title = draft.title || '', note = draft.note || '';
  const start = startParam(), colors = paintParam();
  if (old && old.code === code && (old.title || '') === title && (old.note || '') === note &&
      (old.start || '') === start && (old.colors || '') === colors) return;
  const entry = { id: draft.id, code, title, note, start, colors, letters: draft.letters.slice(), typed: draft.typed.slice(),
                  joins: draft.joins.slice(), solutions: nSolutions, more, pieces, stars: diff.stars, score: diff.score,
                  created: old ? old.created : now, updated: now };
  saveMine([entry, ...list.filter(e => e.id !== draft.id)]);
  renderMyCount();
}
function renderMyCount() {
  const n = loadMine().length;
  $('myBtn').textContent = n ? `My puzzles (${n})` : 'My puzzles';
}
let returnStep = 'letters';
$('myBtn').addEventListener('click', () => { returnStep = draft.step; showStep('mine'); });
$('mineBack').addEventListener('click', () => showStep(returnStep));
$('mineNew').addEventListener('click', newPuzzle);

const fmtDate = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
function miniGrid(e) {
  const groups = Solver.piecesFrom(new Set(e.joins));
  const colours = pieceColours(groups, paintsFrom(groups, e.colors)).map(c => c || 'var(--tile)');
  const bg = Array(16);
  groups.forEach((g, p) => g.forEach(i => { bg[i] = colours[p]; }));
  return '<div class="mini" aria-hidden="true">' +
    e.letters.map((ch, i) => `<span style="background:${bg[i]}">${ch.toUpperCase()}</span>`).join('') + '</div>';
}
function renderMine() {
  const list = loadMine();
  renderMyCount();
  $('mineEmpty').hidden = list.length > 0;
  $('exportBtn').hidden = !list.length;
  renderImport();
  $('mineList').innerHTML = list.map(e => {
    const sol = e.solutions === 1 && !e.more ? 'one solution'
              : `${e.more ? e.solutions + '+' : e.solutions} solutions`;
    return `<li data-id="${e.id}">${miniGrid(e)}<div class="mine-body">` +
      `<div class="mine-meta">${e.title ? `<span class="mine-name">${escHtml(e.title)}</span> · ` : ''}` +
      `${fmtDate(e.updated)}${e.id === draft.id ? ' · <b>editing</b>' : ''}</div>` +
      `<div class="mine-sub">${e.stars ? starRow(e.stars) + ' · ' : ''}${e.pieces} piece${e.pieces === 1 ? '' : 's'} · ${sol}</div>` +
      `<div class="mine-acts">` +
      `<a class="mlink" href="${escHtml(linkFor(e.code, e.title, e.note, e.start, e.colors))}">Play</a>` +
      `<button class="mlink" data-act="share">Share</button>` +
      `<button class="mlink" data-act="edit">Edit</button>` +
      `<button class="mlink del" data-act="delete">Delete</button>` +
      `</div></div></li>`;
  }).join('');
}
// ---- Export all / import: one link, #import=<entry>.<entry>…, each entry the
// share code + 4 hex digits of which letters were typed + the date in base 36
function exportLink() {
  const parts = loadMine().map(e => e.code +
    parseInt(e.typed.map(t => t ? 1 : 0).join(''), 2).toString(16).padStart(4, '0') +
    Math.floor(e.created / 1000).toString(36) +
    (e.title || e.note || e.start || e.colors
      ? '~' + b64url(JSON.stringify([e.title || '', e.note || '', e.start || '', e.colors || ''])) : ''));
  return location.origin + location.pathname + '#import=' + parts.join('.');
}
const b64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
function parseImport(hash) {
  const m = /#import=([0-9A-Za-z.~_-]+)/.exec(hash || '');
  if (!m) return [];
  return m[1].split('.').map(whole => {
    const [part, text] = whole.split('~');
    let title = '', note = '';
    let start = '', colors = '';
    if (text) try { [title, note, start = '', colors = ''] = JSON.parse(unb64url(text)).map(String); } catch (e) {}
    const d = Solver.decode(part.slice(0, 33));
    if (!d || !/^[0-9a-f]{4}[0-9a-z]+$/.test(part.slice(33))) return null;
    const bits = parseInt(part.slice(33, 37), 16).toString(2).padStart(16, '0');
    const created = parseInt(part.slice(37), 36) * 1000;
    // joins: every pair of neighbours in the same piece
    const joins = [];
    for (let i = 0; i < 16; i++) {
      if (i % 4 < 3 && d.pieceOf[i] === d.pieceOf[i + 1]) joins.push(i + '-' + (i + 1));
      if (i < 12 && d.pieceOf[i] === d.pieceOf[i + 4]) joins.push(i + '-' + (i + 4));
    }
    const groups = Solver.piecesFrom(new Set(joins));
    const pieces = groups.map(g => ({ cells: g.map(i => [Math.floor(i / 4), i % 4]),
                                      letters: g.map(i => d.letters[i]).join('') }));
    const rows = [0, 1, 2, 3].map(r => d.letters.slice(r * 4, r * 4 + 4).join(''));
    Solver.allowWords(Solver.wordsOf(rows));
    const res = Solver.solutions(pieces, { limit: 20 });
    const diff = Solver.difficulty(rows, pieces, Math.max(1, res.grids.length));
    return { id: newId() + Math.random().toString(36).slice(2, 5), code: part.slice(0, 33),
             letters: d.letters, typed: [...bits].map(b => b === '1'), joins,
             solutions: res.grids.length, more: res.capped || res.timedOut,
             pieces: groups.filter(g => g.length > 1).length,
             stars: diff.stars, score: diff.score, created, updated: created,
             title: title.slice(0, 40), note: note.slice(0, 240),
             start: /^[0-9a-z]+$/.test(start) && start.length === groups.length ? start : '',
             colors: /^[0-9a]+$/.test(colors) && colors.length === groups.length ? colors : '' };
  }).filter(Boolean);
}
let pendingImport = parseImport(location.hash).filter(e => !loadMine().some(x => x.code === e.code));
function renderImport() {
  $('importBox').hidden = !pendingImport.length;
  const n = pendingImport.length;
  $('importText').textContent = `This link has ${n} puzzle${n === 1 ? '' : 's'} you don’t have here yet.`;
}
function endImport() {
  pendingImport = [];
  history.replaceState(null, '', location.pathname + location.search);
  renderMine();
}
$('importYes').addEventListener('click', () => {
  const all = [...pendingImport, ...loadMine()].sort((a, b) => b.updated - a.updated);
  saveMine(all);
  endImport();
});
$('importNo').addEventListener('click', endImport);
$('exportBtn').addEventListener('click', async () => {
  const url = exportLink(), n = loadMine().length, b = $('exportBtn');
  const text = `My ${n} Danagram puzzle${n === 1 ? '' : 's'} (open to restore them)`;
  if (navigator.share) {
    try { await navigator.share({ title: 'My Danagram puzzles', text, url }); return; }
    catch (err) { if (err && err.name === 'AbortError') return; }
  }
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url); b.textContent = 'Link copied!';
      setTimeout(() => { b.textContent = 'Export all'; }, 2500);
      return;
    }
  } catch (err) {}
  window.prompt('Copy this link and keep it somewhere safe:', url);
});

// two taps for anything that throws work away
function armed(b, label, prompt) {
  if (b.dataset.armed) return true;
  b.dataset.armed = '1'; b.textContent = prompt;
  setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = label; } }, 2500);
  return false;
}
$('mineList').addEventListener('click', async ev => {
  const b = ev.target.closest('button[data-act]');
  if (!b) return;
  const id = b.closest('li').dataset.id, e = loadMine().find(x => x.id === id);
  if (!e) return;
  const act = b.dataset.act;
  if (act === 'delete') {
    if (!armed(b, 'Delete', 'Tap again')) return;
    saveMine(loadMine().filter(x => x.id !== id));
    if (draft.id === id) { draft.id = newId(); saveDraft(); }   // the draft lives on as a new puzzle
    renderMine();
  }
  if (act === 'edit') {
    // a draft that never reached Share isn't in the list: confirm before replacing it
    const unsaved = draft.id !== id && draft.letters.some(Boolean) &&
                    !loadMine().some(x => x.id === draft.id);
    if (unsaved && !armed(b, 'Edit', 'Replace draft?')) return;
    Object.assign(draft, { id: e.id, letters: e.letters.slice(), typed: e.typed.slice(), joins: e.joins.slice(),
                           title: e.title || '', note: e.note || '',
                           start: e.start ? [...e.start].map(ch => parseInt(ch, 36)) : null,
                           startFor: e.start ? e.code : null,
                           colors: paintsFrom(Solver.piecesFrom(new Set(e.joins)), e.colors) });
    shareMeta = null;
    cursor = 0; across = true; lastSolve = null; lastDiff = null;
    showStep('pieces');
  }
  if (act === 'share') {
    const url = linkFor(e.code, e.title, e.note, e.start, e.colors);
    if (navigator.share) {
      try { await navigator.share({ title: 'Danagram', text: shareMsg(e.title), url }); return; }
      catch (err) { if (err && err.name === 'AbortError') return; }
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareFull(e.title, url)); b.textContent = 'Copied!'; return;
      }
    } catch (err) {}
    window.prompt('Copy this link:', url);
  }
});

window.addEventListener('resize', () => {
  if (draft.step === 'letters') placeMarks(Solver.lineStatus(draft.letters));
  if (draft.step === 'pieces') renderPieces();
});
if (pendingImport.length) { returnStep = draft.step || 'letters'; showStep('mine'); }
else showStep(draft.step || 'letters');
renderCursor();
renderMyCount();
