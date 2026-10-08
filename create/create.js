// Create page: 1. type letters (Fill in does the rest) → 2. join tiles into
// pieces → 3. share a link that opens the puzzle in the game. Everything runs
// here in the browser via Solver (../solver.js); the draft is kept in
// localStorage so a refresh doesn't lose work.

const OCOLORS = ['var(--o1)', 'var(--o2)', 'var(--o3)', 'var(--o4)', 'var(--o5)', 'var(--o6)'];
const DRAFT_KEY = 'danagram_create_draft';
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
  ['letters', 'pieces', 'share', 'mine'].forEach(s => {
    $('step' + s[0].toUpperCase() + s.slice(1)).hidden = s !== step;
  });
  const order = ['letters', 'pieces', 'share'];
  document.querySelectorAll('.steps li').forEach(li => {
    const k = order.indexOf(li.dataset.step), at = order.indexOf(step);
    li.classList.toggle('on', k === at);
    li.classList.toggle('done', k < at);
  });
  if (step === 'letters') renderLetters();
  if (step === 'pieces') renderPieces();
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
    ? '<li class="bad">That took too long. Try adding or changing a letter.</li>'
    : '<li class="bad">There’s no way to fill these in with words. Try changing a letter.</li>';
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
  let colour = 0;
  const colours = groups.map(g => g.length > 1 ? OCOLORS[colour++ % OCOLORS.length] : null);
  groups.forEach((g, p) => g.forEach(i => { pieceOf[i] = p; }));

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
}
// same scale as the daily puzzles (tools/score.py): 1–5 stars, 0–100
let lastDiff = null;
function difficultyOf(groups, nSolutions) {
  const rows = [0, 1, 2, 3].map(r => draft.letters.slice(r * 4, r * 4 + 4).join(''));
  return Solver.difficulty(rows, puzzlePieces(groups), Math.max(1, nSolutions));
}
const starRow = n => `<span class="stars" aria-label="${n} of 5 stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`;
$('backToLetters').addEventListener('click', () => showStep('letters'));
$('toShare').addEventListener('click', () => showStep('share'));

// -------------------------------------------------------------- 3. share
function shareCode() {
  const groups = Solver.piecesFrom(joins());
  const pieceOf = Array(16);
  groups.forEach((g, p) => g.forEach(i => { pieceOf[i] = p; }));
  return Solver.encode(draft.letters, pieceOf);
}
// the game link: the puzzle, plus the title and note when there are any
function linkFor(code, title, note) {
  return new URL('../?p=' + code +
    (title ? '&t=' + encodeURIComponent(title) : '') +
    (note ? '&n=' + encodeURIComponent(note) : ''), location.href).href;
}
// share text: "I made a Danagram!", the title, then the link (the share sheet adds
// the link after the text; a copied version spells it out)
const shareMsg = title => 'I made a Danagram!' + (title ? '\n' + title : '');
const shareFull = (title, url) => shareMsg(title) + '\n' + url;
let shareMeta = null;
function updateLink() {
  const url = linkFor(shareCode(), draft.title, draft.note);
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
$('backToPieces').addEventListener('click', () => showStep('pieces'));
function newPuzzle() {
  Object.assign(draft, { id: newId(), letters: Array(16).fill(''), typed: Array(16).fill(false), joins: [],
                         title: '', note: '' });
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
  if (old && old.code === code && (old.title || '') === title && (old.note || '') === note) return;
  const entry = { id: draft.id, code, title, note, letters: draft.letters.slice(), typed: draft.typed.slice(),
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
  let colour = 0;
  const colours = groups.map(g => g.length > 1 ? OCOLORS[colour++ % OCOLORS.length] : 'var(--tile)');
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
      `<a class="mlink" href="${escHtml(linkFor(e.code, e.title, e.note))}">Play</a>` +
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
    (e.title || e.note ? '~' + b64url(JSON.stringify([e.title || '', e.note || ''])) : ''));
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
    if (text) try { [title, note] = JSON.parse(unb64url(text)).map(String); } catch (e) {}
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
             title: title.slice(0, 40), note: note.slice(0, 240) };
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
                           title: e.title || '', note: e.note || '' });
    shareMeta = null;
    cursor = 0; across = true; lastSolve = null; lastDiff = null;
    showStep('pieces');
  }
  if (act === 'share') {
    const url = linkFor(e.code, e.title, e.note);
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
