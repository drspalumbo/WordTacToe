// Create page: 1. type letters (Fill in does the rest) → 2. join tiles into
// pieces → 3. share a link that opens the puzzle in the game. Everything runs
// here in the browser via Solver (../solver.js); the draft is kept in
// localStorage so a refresh doesn't lose work.

const OCOLORS = ['var(--o1)', 'var(--o2)', 'var(--o3)', 'var(--o4)', 'var(--o5)', 'var(--o6)'];
const DRAFT_KEY = 'danagram_create_draft';
const $ = id => document.getElementById(id);

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
const saveDraft = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) {} };
const joins = () => new Set(draft.joins);

// ------------------------------------------------------------------ steps
function showStep(step) {
  if (step !== 'letters' && !lettersReady()) step = 'letters';
  draft.step = step; saveDraft();
  ['letters', 'pieces', 'share'].forEach(s => {
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
}

// ------------------------------------------------------------ 1. letters
const inputs = [];
const marks = [];
(function buildLetterGrid() {
  const grid = $('letterGrid');
  for (let i = 0; i < 16; i++) {
    const inp = document.createElement('input');
    inp.className = 'ccell';
    Object.assign(inp, { maxLength: 2, autocomplete: 'off', spellcheck: false });
    inp.setAttribute('autocapitalize', 'characters');
    inp.setAttribute('aria-label', `Row ${Math.floor(i / 4) + 1}, column ${i % 4 + 1}`);
    inp.addEventListener('input', () => onType(i));
    inp.addEventListener('keydown', e => onKey(i, e));
    inp.addEventListener('focus', () => inp.select());
    grid.appendChild(inp);
    inputs.push(inp);
  }
  for (let k = 0; k < 8; k++) {
    const m = document.createElement('span');
    m.className = 'lmark'; m.hidden = true;
    grid.appendChild(m);
    marks.push(m);
  }
})();

function onType(i) {
  const v = (inputs[i].value.match(/[a-z]/gi) || []).pop();   // last letter typed wins
  draft.letters[i] = v ? v.toLowerCase() : '';
  draft.typed[i] = !!v;
  saveDraft();
  renderLetters();
  if (v && i < 15) inputs[i + 1].focus();
}
function onKey(i, e) {
  const go = j => { e.preventDefault(); inputs[j].focus(); };
  if (e.key === 'Backspace' && !inputs[i].value && i > 0) {
    e.preventDefault();
    draft.letters[i - 1] = ''; draft.typed[i - 1] = false;
    saveDraft(); renderLetters(); inputs[i - 1].focus();
  }
  else if (e.key === 'ArrowRight' && i % 4 < 3) go(i + 1);
  else if (e.key === 'ArrowLeft' && i % 4 > 0) go(i - 1);
  else if (e.key === 'ArrowDown' && i < 12) go(i + 4);
  else if (e.key === 'ArrowUp' && i > 3) go(i - 4);
}

function gridWords() {
  const rows = [0, 1, 2, 3].map(r => draft.letters.slice(r * 4, r * 4 + 4).join(''));
  return Solver.wordsOf(rows);
}
function lettersReady() {
  if (draft.letters.some(ch => !ch)) return false;
  const ws = gridWords();
  return ws.every(w => WORDSET.has(w)) && new Set(ws).size === 8;
}

const LINE_NAME = k => k < 4 ? `Row ${k + 1}` : `Column ${k - 3}`;
function renderLetters() {
  const status = Solver.lineStatus(draft.letters);
  const bad = new Set();
  inputs.forEach((inp, i) => {
    const ch = draft.letters[i] ? draft.letters[i].toUpperCase() : '';
    if (inp.value !== ch) inp.value = ch;
    inp.classList.toggle('filled', !!ch && !draft.typed[i]);
  });
  status.forEach((s, k) => { if (s === 'notword' || s === 'nofit') Solver.LINES[k].forEach(i => bad.add(i)); });
  inputs.forEach((inp, i) => inp.classList.toggle('bad', bad.has(i)));
  placeMarks(status);

  const issues = [];
  status.forEach((s, k) => {
    const word = Solver.LINES[k].map(i => draft.letters[i]).join('').toUpperCase();
    if (s === 'notword') issues.push(['bad', `${LINE_NAME(k)}: “${word}” isn’t in the word list.`]);
    if (s === 'nofit') issues.push(['bad', `${LINE_NAME(k)}: no word fits these letters.`]);
  });
  const full = draft.letters.every(Boolean);
  if (!issues.length && full) {
    const ws = gridWords();
    if (new Set(ws).size < 8) issues.push(['bad', 'Each row and column needs a different word.']);
    else issues.push(['good', 'All 8 are words. Nice!']);
  }
  if (!issues.length && draft.letters.some(Boolean)) {
    // can what's here still become a full grid? (quick, and only a hint)
    const base = draft.letters.map((ch, i) => draft.typed[i] ? ch : '');
    const res = Solver.fill(base, { random: false, nodeLimit: 120000 });
    if (res === null) issues.push(['bad', 'These letters can’t all be completed into words.']);
  }
  $('issues').innerHTML = issues.map(([cls, t]) => `<li class="${cls}">${t}</li>`).join('');
  const anyFilled = draft.letters.some((ch, i) => ch && !draft.typed[i]);
  $('fillBtn').textContent = anyFilled ? 'Fill again' : 'Fill in';
  $('toPieces').disabled = !lettersReady();
}

// ✓ / ✗ at the end of each row and the foot of each column
function placeMarks(status) {
  const cells = inputs.map(inp => ({ x: inp.offsetLeft, y: inp.offsetTop, w: inp.offsetWidth }));
  status.forEach((s, k) => {
    const m = marks[k];
    const show = s === 'ok' || s === 'notword' || s === 'nofit';
    m.hidden = !show;
    if (!show) return;
    m.className = 'lmark ' + (s === 'ok' ? 'ok' : 'bad');
    m.textContent = s === 'ok' ? '✓' : '✗';
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

// two taps to clear, so a stray tap doesn't wipe the grid
function confirmTap(btn, label, action) {
  if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = label; action(); return; }
  btn.dataset.armed = '1'; btn.textContent = 'Tap again to clear';
  setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = label; } }, 2500);
}
$('clearBtn').addEventListener('click', e => confirmTap(e.currentTarget, 'Clear', () => {
  draft.letters = Array(16).fill(''); draft.typed = Array(16).fill(false); draft.joins = [];
  saveDraft(); renderLetters(); inputs[0].focus();
}));
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
  const res = Solver.solutions(puzzlePieces(groups), { limit: 20 });
  lastSolve = res;
  const n = res.grids.length;
  let verdict;
  if (res.timedOut) verdict = '<span class="warn">⚠ Lots of possible solutions — join more tiles to narrow it down.</span>';
  else if (n === 1) verdict = '<span class="good">✓ Exactly one solution.</span>';
  else verdict = `<span class="warn">⚠ ${res.capped ? '20+' : n} possible solutions. Fine to share, but joining more tiles narrows it down.</span>`;
  $('pieceInfo').innerHTML =
    `${multi} piece${multi === 1 ? '' : 's'} + ${singles} single tile${singles === 1 ? '' : 's'}<br>${verdict}`;
}
$('backToLetters').addEventListener('click', () => showStep('letters'));
$('toShare').addEventListener('click', () => showStep('share'));

// -------------------------------------------------------------- 3. share
function shareCode() {
  const groups = Solver.piecesFrom(joins());
  const pieceOf = Array(16);
  groups.forEach((g, p) => g.forEach(i => { pieceOf[i] = p; }));
  return Solver.encode(draft.letters, pieceOf);
}
function renderShare() {
  const url = new URL('../?p=' + shareCode(), location.href).href;
  $('shareUrl').value = url;
  $('playLink').href = url;
  $('shareNote').textContent = '';
  const groups = Solver.piecesFrom(joins());
  const multi = groups.filter(g => g.length > 1).length;
  const res = lastSolve || Solver.solutions(puzzlePieces(groups), { limit: 20 });
  const n = res.grids.length;
  $('shareSummary').textContent = `Your Danagram: ${multi} piece${multi === 1 ? '' : 's'} and ` +
    `${16 - groups.filter(g => g.length > 1).reduce((s, g) => s + g.length, 0)} single tiles, ` +
    (n === 1 && !res.timedOut ? 'with exactly one solution.' : 'with more than one possible solution.') +
    ' Anyone with the link can play it.';
}
$('shareBtn').addEventListener('click', async () => {
  const url = $('shareUrl').value;
  if (navigator.share) {
    try { await navigator.share({ title: 'Danagram', text: 'Try the Danagram I made!', url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      $('shareNote').textContent = 'Link copied!';
      return;
    }
  } catch (e) {}
  $('shareUrl').focus(); $('shareUrl').select();
  $('shareNote').textContent = 'Copy the link above.';
});
$('backToPieces').addEventListener('click', () => showStep('pieces'));
$('startOver').addEventListener('click', e => confirmTap(e.currentTarget, 'Start a new one', () => {
  draft.letters = Array(16).fill(''); draft.typed = Array(16).fill(false); draft.joins = [];
  showStep('letters'); inputs[0].focus();
}));

window.addEventListener('resize', () => {
  if (draft.step === 'letters') placeMarks(Solver.lineStatus(draft.letters));
  if (draft.step === 'pieces') renderPieces();
});
showStep(draft.step || 'letters');
