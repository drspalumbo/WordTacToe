// Headless smoke test for the Danagram prototype's game logic.
function makeEl() {
  const el = {
    style: { setProperty() {}, removeProperty() {} }, dataset: {}, children: [],
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => el.classList._s.add(x)); },
      remove(...c) { c.forEach(x => el.classList._s.delete(x)); },
      toggle(c, on) { on ? el.classList._s.add(c) : el.classList._s.delete(c); },
      contains(c) { return el.classList._s.has(c); },
    },
    setAttribute() {}, appendChild(ch) { el.children.push(ch); return ch; },
    remove() {}, addEventListener() {}, setPointerCapture() {}, releasePointerCapture() {},
    querySelector(sel) {
      const cls = sel.replace('.', '');
      const find = n => {
        for (const ch of n.children || []) {
          if (ch.className && ch.className.includes(cls)) return ch;
          const d = find(ch); if (d) return d;
        }
        return null;
      };
      return find(el) || makeEl();
    },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0 }; },
    get offsetWidth() { return 0; },
    textContent: '', innerHTML: '', className: '', tabIndex: 0, disabled: false,
  };
  return el;
}
const els = {};
global.document = {
  body: makeEl(),
  getElementById(id) { return els[id] || (els[id] = makeEl()); },
  createElement() { return makeEl(); },
  querySelectorAll() { return []; },
  querySelector() { return null; },
};
global.window = { addEventListener() {} };
els.boardWrap = makeEl();
Object.defineProperty(els.boardWrap, 'clientWidth', { value: 400 });
global.setTimeout = (fn) => { fn(); return 0; };

// Load the real source files, in the same order index.html loads them.
// No build step involved — this is exactly what the browser runs.
const fs = require('fs');
const SRC = ['../data/words.js', '../data/puzzles.js', '../game.js']
  .map(f => fs.readFileSync(require('path').join(__dirname, f), 'utf8')).join('\n');
eval(SRC + `
;globalThis.T = { state, PUZZLES, WORDSET, planMove, tryMove, occupancy, scramble,
                  gridIsValidCrossword, currentGrid, loadPuzzle, setMode, shiftAll, key,
                  commit, doUndo, doRedo, snapshot, tapAt, setSelected,
                  doShuffle, doSpread, restore };
`);

const { T } = globalThis;
let failures = 0;
const check = (cond, name) => { if (!cond) { failures++; console.log('FAIL:', name); } };
const norm = cells => {
  const r0 = Math.min(...cells.map(c => c[0])), c0 = Math.min(...cells.map(c => c[1]));
  return cells.map(([r, c]) => `${r - r0},${c - c0}`).sort().join(';');
};
function noOverlap(n) {
  const seen = new Set(); let count = 0;
  T.state.pieces.forEach(p => p.cells.forEach(([r, c]) => {
    seen.add(r + ',' + c); count++;
    check(r >= 0 && c >= 0 && r < n && c < n, `cell in bounds (${r},${c}) n=${n}`);
  }));
  check(count === 16, 'sixteen tiles exist');
  check(seen.size === 16, 'no overlapping tiles');
}

console.log('--- per-puzzle checks (Free board default = 6x6) ---');
for (let i = 0; i < T.PUZZLES.length; i++) {
  T.loadPuzzle(i);
  const P = T.PUZZLES[i];
  check(T.state.mode === 'free', `p${i} loads in free mode`);

  const g = P.solution;
  for (let k = 0; k < 4; k++) {
    check(T.WORDSET.has(g[k]), `p${i} row word ${g[k]}`);
    const col = g[0][k] + g[1][k] + g[2][k] + g[3][k];
    check(T.WORDSET.has(col), `p${i} col word ${col}`);
  }
  noOverlap(6);
  check(!T.gridIsValidCrossword(), `p${i} scramble is not already solved`);
  T.state.pieces.forEach((p, j) =>
    check(norm(p.cells) === norm(P.pieces[j].cells), `p${i} piece ${j} shape preserved`));

  for (let m = 0; m < 400; m++) {
    const pi = Math.floor(Math.random() * T.state.pieces.length);
    const a = Math.floor(Math.random() * T.state.pieces[pi].cells.length);
    const res = T.planMove(pi, a, Math.floor(Math.random() * 6), Math.floor(Math.random() * 6), 'free');
    if (res.ok) res.apply();
  }
  noOverlap(6);
  T.state.pieces.forEach((p, j) =>
    check(norm(p.cells) === norm(P.pieces[j].cells), `p${i} shape preserved after free moves`));

  // strict mode: pack solution into inner zone, switch, hammer
  T.loadPuzzle(i);
  T.state.pieces.forEach((p, j) => { p.cells = P.pieces[j].cells.map(([r, c]) => [r + 1, c + 1]); });
  check(T.currentGrid().join('') === P.solution.join(''), `p${i} solution reads in free inner zone`);
  check(T.gridIsValidCrossword(), `p${i} solution validates (free)`);
  T.setMode('strict');
  check(T.state.mode === 'strict', `p${i} setMode strict succeeds when packed`);
  check(T.gridIsValidCrossword(), `p${i} solution validates (strict)`);
  check(T.currentGrid().join('') === P.solution.join(''), `p${i} strict solution lines up`);

  for (let m = 0; m < 400; m++) {
    const pi = Math.floor(Math.random() * T.state.pieces.length);
    const a = Math.floor(Math.random() * T.state.pieces[pi].cells.length);
    const res = T.planMove(pi, a, Math.floor(Math.random() * 4), Math.floor(Math.random() * 4), 'strict');
    if (res.ok) res.apply();
  }
  noOverlap(4);
  T.state.pieces.forEach((p, j) =>
    check(norm(p.cells) === norm(P.pieces[j].cells), `p${i} shape preserved after strict moves`));
}

console.log('--- nudge / swap engine cases ---');
T.loadPuzzle(0);
T.state.pieces.forEach((p, j) => { p.cells = T.PUZZLES[0].pieces[j].cells.map(([r, c]) => [r + 1, c + 1]); });
T.setMode('strict');
const singles = T.state.pieces.map((p, i) => [p, i]).filter(([p]) => p.cells.length === 1);
const ominos  = T.state.pieces.map((p, i) => [p, i]).filter(([p]) => p.cells.length > 1);
check(singles.length >= 2 && ominos.length >= 1, 'pieces of both kinds exist');
{
  const [s1, i1] = singles[0], [s2] = singles[1];
  const b1 = s1.cells[0].slice(), b2 = s2.cells[0].slice();
  const res = T.planMove(i1, 0, b2[0], b2[1], 'strict');
  check(res.ok, 'single onto single is legal');
  if (res.ok) {
    res.apply();
    check(s1.cells[0].join() === b2.join() && s2.cells[0].join() === b1.join(),
          'single swap exchanges positions');
  }
}
{
  T.loadPuzzle(0);
  T.state.pieces.forEach((p, j) => { p.cells = T.PUZZLES[0].pieces[j].cells.map(([r, c]) => [r + 1, c + 1]); });
  T.setMode('strict');
  const [, oi] = T.state.pieces.map((p, i) => [p, i]).filter(([p]) => p.cells.length > 1)[0];
  for (let m = 0; m < 30; m++) {
    const res = T.planMove(oi, 0, Math.floor(Math.random() * 4), Math.floor(Math.random() * 4), 'strict');
    if (res.ok) { res.apply(); break; }
  }
  const seen = new Set(); let cnt = 0;
  T.state.pieces.forEach(p => p.cells.forEach(([r, c]) => { seen.add(r + ',' + c); cnt++; }));
  check(cnt === 16 && seen.size === 16, 'nudge keeps the strict board full and legal');
}
{
  T.loadPuzzle(0);
  const [o, oi] = T.state.pieces.map((p, i) => [p, i]).filter(([p]) => p.cells.length > 1)[0];
  const res = T.planMove(oi, o.cells.length - 1, 5, 5, 'free');
  check(!res.ok ? (res.reason && res.reason.length > 0) : true, 'oob rejection is well-formed');
}

console.log('--- undo / redo ---');
{
  T.loadPuzzle(0);
  const before = JSON.stringify(T.state.pieces.map(p => p.cells));
  let done = false;
  for (let m = 0; m < 60 && !done; m++) {
    const pi = Math.floor(Math.random() * T.state.pieces.length);
    const a = Math.floor(Math.random() * T.state.pieces[pi].cells.length);
    const res = T.planMove(pi, a, Math.floor(Math.random() * 6), Math.floor(Math.random() * 6), 'free');
    if (res.ok) {
      const b4 = JSON.stringify(T.state.pieces.map(p => p.cells));
      T.commit(res.moves);
      if (JSON.stringify(T.state.pieces.map(p => p.cells)) !== b4) done = true;
    }
  }
  check(done, 'a move was committed');
  const afterMove = JSON.stringify(T.state.pieces.map(p => p.cells));
  check(afterMove !== before, 'commit changed the board');
  T.doUndo();
  check(JSON.stringify(T.state.pieces.map(p => p.cells)) === before, 'undo restores prior state');
  T.doRedo();
  check(JSON.stringify(T.state.pieces.map(p => p.cells)) === afterMove, 'redo reapplies the move');
  T.doUndo();
  check(els.undoBtn.disabled === true, 'undo button disables when stack empty');
}

console.log('--- tap-to-move flow ---');
{
  T.loadPuzzle(0);                              // free mode, 6x6
  // find a single tile and an empty cell to move it to
  const occ = T.occupancy();
  let single = null;
  T.state.pieces.forEach((p, i) => { if (p.cells.length === 1) single = { p, i }; });
  check(!!single, 'found a single tile to tap-move');
  const [sr, sc] = single.p.cells[0];
  // an empty in-bounds cell
  let empty = null;
  for (let r = 0; r < 6 && !empty; r++)
    for (let c = 0; c < 6 && !empty; c++)
      if (!occ.get(T.key(r, c))) empty = [r, c];
  check(!!empty, 'found an empty destination cell');

  // tap 1: select the single
  T.setSelected(null);
  T.tapAt(sr, sc);
  check(T.state.sel && T.state.sel.pi === single.i, 'tap selects the piece');
  // tap 2: empty cell → piece should move there
  T.tapAt(empty[0], empty[1]);
  check(!T.state.sel, 'tap-move clears selection');
  check(single.p.cells[0][0] === empty[0] && single.p.cells[0][1] === empty[1],
        'tap-to-empty moved the tile to the destination');
}
{
  // tap-to-swap: two congruent singles swap when tapped
  T.loadPuzzle(0);
  const singlesF = T.state.pieces.map((p, i) => [p, i]).filter(([p]) => p.cells.length === 1);
  const [a, ai] = singlesF[0], [b, bi] = singlesF[1];
  const ap = a.cells[0].slice(), bp = b.cells[0].slice();
  T.setSelected(null);
  T.tapAt(ap[0], ap[1]);                         // select A
  T.tapAt(bp[0], bp[1]);                         // tap B → swap
  check(a.cells[0].join() === bp.join() && b.cells[0].join() === ap.join(),
        'tap-to-swap exchanges two singles');
}
{
  // tapping the selected piece again deselects it
  T.loadPuzzle(0);
  const [p, i] = T.state.pieces.map((pp, ii) => [pp, ii])[0];
  const [r, c] = p.cells[0];
  T.setSelected(null);
  T.tapAt(r, c);
  check(!!T.state.sel, 'piece selected');
  T.tapAt(...p.cells[0]);
  check(!T.state.sel, 'tapping selected piece again deselects');
}

console.log('--- swap-like backfill (both directions) ---');
function setPieces(defs) {   // defs: [{letters, cells}]
  T.state.pieces = defs.map(d => ({ letters: d.letters, cells: d.cells.map(c => c.slice()), color: 'x', tiles: null }));
  T.setSelected(null);
}
const inSet = (cells, set) => cells.every(c => set.has(c.join(',')));
{
  // Direction A: domino slides onto two singles → singles backfill the domino's hole
  T.state.mode = 'free';
  setPieces([
    { letters: 'AB', cells: [[1, 1], [1, 2]] },  // domino D (idx 0)
    { letters: 'C',  cells: [[1, 3]] },          // single  (idx 1)
    { letters: 'D',  cells: [[1, 4]] },          // single  (idx 2)
  ]);
  // move D so its anchor cell [1,1] lands on [1,3] → D occupies [1,3],[1,4]
  const res = T.planMove(0, 0, 1, 3, 'free');
  check(res.ok, 'A: domino-onto-singles is legal');
  res.apply();
  const holeA = new Set(['1,1', '1,2']);
  const singleCells = [T.state.pieces[1].cells[0], T.state.pieces[2].cells[0]];
  check(inSet(singleCells, holeA), 'A: displaced singles backfilled the domino hole');
  check(T.state.pieces[0].cells.map(c => c.join()).sort().join('|') === '1,3|1,4',
        'A: domino landed on the singles');
}
{
  // Direction B (the reverse): a single moves onto the domino → domino shifts into
  // the single's neighborhood, not off to a far corner
  T.state.mode = 'free';
  setPieces([
    { letters: 'AB', cells: [[1, 1], [1, 2]] },  // domino D (idx 0)
    { letters: 'C',  cells: [[1, 3]] },          // single  (idx 1)
    { letters: 'D',  cells: [[1, 4]] },          // single  (idx 2)
  ]);
  // move single C from [1,3] onto [1,1] (a domino cell)
  const res = T.planMove(1, 0, 1, 1, 'free');
  check(res.ok, 'B: single-onto-domino is legal');
  res.apply();
  check(T.state.pieces[1].cells[0].join() === '1,1', 'B: single took the target cell');
  // domino should now cover the vacated [1,3] and stay adjacent (i.e. [1,2],[1,3])
  const dCells = T.state.pieces[0].cells.map(c => c.join()).sort().join('|');
  check(dCells === '1,2|1,3', 'B: domino backfilled into the single’s vacated space');
  // total footprint unchanged (pure permutation, nothing flung away)
  const allCells = new Set(T.state.pieces.flatMap(p => p.cells.map(c => c.join())));
  check([...allCells].sort().join('|') === '1,1|1,2|1,3|1,4', 'B: no tile was flung to a far cell');
}

console.log('--- anchor highlight on selection ---');
{
  T.loadPuzzle(0);
  const omino = T.state.pieces.findIndex(p => p.cells.length > 1);
  check(omino >= 0, 'puzzle has an omino to select');
  T.setSelected({ pi: omino, anchor: 1 });
  const tiles = T.state.pieces[omino].tiles;
  check(tiles[1].classList.contains('anchorsel'), 'anchor tile is flagged');
  check(!tiles[0].classList.contains('anchorsel'), 'non-anchor tile is not flagged');
  check(tiles[0].classList.contains('sel'), 'whole omino still shows as selected');
  // singles now get the anchor marker too
  const single = T.state.pieces.findIndex(p => p.cells.length === 1);
  T.setSelected({ pi: single, anchor: 0 });
  check(T.state.pieces[single].tiles[0].classList.contains('anchorsel'),
        'single tile also gets the anchor marker');
}

console.log('--- multi-tap undo/redo gesture ---');
{
  // use a manually-fired timer so we can simulate the tap window
  const realST = global.setTimeout, realCT = global.clearTimeout;
  let pending = null;
  global.setTimeout = (fn) => { pending = fn; return 1; };
  global.clearTimeout = () => { pending = null; };

  T.loadPuzzle(0);
  const before = JSON.stringify(T.state.pieces.map(p => p.cells));
  // commit a real move so there's history
  let moved = false;
  for (let m = 0; m < 60 && !moved; m++) {
    const pi = Math.floor(Math.random() * T.state.pieces.length);
    const a = Math.floor(Math.random() * T.state.pieces[pi].cells.length);
    const res = T.planMove(pi, a, Math.floor(Math.random() * 6), Math.floor(Math.random() * 6), 'free');
    if (res.ok) {
      const b4 = JSON.stringify(T.state.pieces.map(p => p.cells));
      T.commit(res.moves);
      if (JSON.stringify(T.state.pieces.map(p => p.cells)) !== b4) moved = true;
    }
  }
  const afterMove = JSON.stringify(T.state.pieces.map(p => p.cells));
  check(moved && afterMove !== before, 'gesture: a move was committed');

  // find an empty cell in the 6x6
  const occ = T.occupancy();
  let empty = null;
  for (let r = 0; r < 6 && !empty; r++)
    for (let c = 0; c < 6 && !empty; c++) if (!occ.get(T.key(r, c))) empty = [r, c];

  T.setSelected(null);
  T.tapAt(empty[0], empty[1]);         // tap 1
  T.tapAt(empty[0], empty[1]);         // tap 2 → double
  pending && pending();                // window elapses → undo
  check(JSON.stringify(T.state.pieces.map(p => p.cells)) === before, 'double-tap empty → undo');

  T.setSelected(null);
  T.tapAt(empty[0], empty[1]);         // tap 1
  T.tapAt(empty[0], empty[1]);         // tap 2
  T.tapAt(empty[0], empty[1]);         // tap 3 → triple
  pending && pending();                // window elapses → redo
  check(JSON.stringify(T.state.pieces.map(p => p.cells)) === afterMove, 'triple-tap empty → redo');

  // a single empty tap does nothing
  T.setSelected(null);
  const snap = JSON.stringify(T.state.pieces.map(p => p.cells));
  T.tapAt(empty[0], empty[1]);
  pending && pending();
  check(JSON.stringify(T.state.pieces.map(p => p.cells)) === snap, 'single empty tap is a no-op');

  global.setTimeout = realST; global.clearTimeout = realCT;
}

console.log('--- session preservation across puzzle switches ---');
{
  T.state.sessions = {};
  T.loadPuzzle(0);
  // make a committed move on puzzle 0
  let moved = false;
  for (let m = 0; m < 60 && !moved; m++) {
    const pi = Math.floor(Math.random() * T.state.pieces.length);
    const a = Math.floor(Math.random() * T.state.pieces[pi].cells.length);
    const res = T.planMove(pi, a, Math.floor(Math.random() * 6), Math.floor(Math.random() * 6), 'free');
    if (res.ok) { const b4 = JSON.stringify(T.state.pieces.map(p => p.cells)); T.commit(res.moves);
      if (JSON.stringify(T.state.pieces.map(p => p.cells)) !== b4) moved = true; }
  }
  const board0 = JSON.stringify(T.state.pieces.map(p => p.cells));
  const undoLen0 = T.state.undo.length;
  T.loadPuzzle(1);                                   // switch away
  check(JSON.stringify(T.state.pieces.map(p => p.cells)) !== board0, 'puzzle 1 has its own board');
  T.loadPuzzle(0);                                   // switch back
  check(JSON.stringify(T.state.pieces.map(p => p.cells)) === board0, 'returning restores puzzle 0 board');
  check(T.state.undo.length === undoLen0, 'returning restores undo history');
}

console.log('--- spread singles to the edges ---');
{
  T.state.sessions = {};
  T.loadPuzzle(0);
  const before = JSON.stringify(T.state.pieces.map(p => p.cells));
  T.doSpread();
  const isPerim = (r, c) => r === 0 || c === 0 || r === 5 || c === 5;
  let singlesInside = 0, ominoMoved = 0;
  T.state.pieces.forEach(p => {
    if (p.cells.length === 1) { const [r, c] = p.cells[0]; if (!isPerim(r, c)) singlesInside++; }
  });
  check(singlesInside === 0, 'all singles ended up on the perimeter');
  // no overlaps after spread
  const seen = new Set(); let cnt = 0;
  T.state.pieces.forEach(p => p.cells.forEach(([r, c]) => { seen.add(r + ',' + c); cnt++; }));
  check(cnt === 16 && seen.size === 16, 'spread leaves no overlaps');
  // undoable in one step
  T.doUndo();
  check(JSON.stringify(T.state.pieces.map(p => p.cells)) === before, 'spread is undoable in one step');
}

console.log('--- shuffle is undoable ---');
{
  T.state.sessions = {};
  T.loadPuzzle(0);
  const before = JSON.stringify(T.state.pieces.map(p => p.cells));
  T.doShuffle();
  const after = JSON.stringify(T.state.pieces.map(p => p.cells));
  check(after !== before, 'shuffle changes the board');
  // shapes preserved
  const norm2 = cells => { const r0 = Math.min(...cells.map(c => c[0])), c0 = Math.min(...cells.map(c => c[1]));
    return cells.map(([r, c]) => `${r - r0},${c - c0}`).sort().join(';'); };
  T.state.pieces.forEach((p, j) => check(norm2(p.cells) === norm2(T.PUZZLES[0].pieces[j].cells),
    `shuffle preserves piece ${j} shape`));
  // every tile lands inside the 4x4 inner zone (offset 1..4), no strays in the 6x6 scratch area
  T.state.pieces.forEach(p => p.cells.forEach(([r, c]) => {
    check(r >= 1 && c >= 1 && r <= 4 && c <= 4, `shuffle keeps tile in the 4x4 window (${r},${c})`);
  }));
  T.doUndo();
  check(JSON.stringify(T.state.pieces.map(p => p.cells)) === before, 'shuffle is undoable in one step');
}

console.log(failures === 0 ? 'ALL CHECKS PASSED' : failures + ' FAILURES');
process.exit(failures ? 1 : 0);
