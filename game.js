const OCOLORS = ['var(--o1)','var(--o2)','var(--o3)','var(--o4)','var(--o5)','var(--o6)'];

const S_MAX = 84;
let state = {
  idx: 0,
  mode: 'free',              // 'strict' | 'free'
  pieces: [],                // {letters, cells:[[r,c],...], color, tiles:[el], shape info}
  sel: null,                 // {pi, anchor}
  busy: false,
  revealed: false,
  found: PUZZLES.map(() => new Set()),
  drag: null,                // {pi, anchor, startX, startY, moved}
  tap: { count: 0, timer: null },
  undo: [],
  redo: [],
  sessions: {},              // per-puzzle saved state (cells + undo/redo)
  // Super Check: forming new words and new crossings charges a meter; spending it
  // sorts the words currently on the board into "appears in a solution" / "doesn't".
  // seen = words already scored, crossings = word pairs already scored (see scoreBoard)
  // found = words made but not yet sorted by a grid check (shown gray in the bank)
  hints: PUZZLES.map(() => ({ seen: [], crossings: [], charge: 0, spent: 0,
                              found: [], inList: [], outList: [], history: [] })),
};
const HINT_THRESHOLD = 5;      // charge points needed per Super Check
let S = 72, GAP = 3;

const board = document.getElementById('board');
const zone = document.getElementById('zone');
const msg = document.getElementById('msg');

// ---------------------------------------------------------------- helpers
const cols = () => state.mode === 'free' ? 6 : 4;
const innerOff = () => state.mode === 'free' ? 1 : 0;
const key = (r, c) => r * 8 + c;

function occupancy() {
  const map = new Map();
  state.pieces.forEach((p, pi) =>
    p.cells.forEach(([r, c], ci) => map.set(key(r, c), { pi, ci })));
  return map;
}

function normShape(cells) {
  const r0 = Math.min(...cells.map(c => c[0]));
  const c0 = Math.min(...cells.map(c => c[1]));
  return cells.map(([r, c]) => [r - r0, c - c0])
              .sort((a, b) => a[0] - b[0] || a[1] - b[1])
              .map(c => c.join(',')).join(';');
}

function setMsg(text, tone) {
  msg.textContent = text;
  msg.className = tone || '';
}

// ------------------------------------------------------- the move engine
// Plans a translation of piece `pi` so its `anchor` cell lands on (tr,tc).
// Displaced pieces are gently nudged to their nearest open, shape-preserving
// spot. A congruent piece sitting exactly on the target is a clean swap.
// Returns {ok:true, moves:{pi:[cells]}, kind, apply} or {ok:false, reason, blockers}.
function planMove(pi, anchor, tr, tc, mode) {
  const P = state.pieces[pi];
  const [ar, ac] = P.cells[anchor];
  const dr = tr - ar, dc = tc - ac;
  if (dr === 0 && dc === 0) return { ok: false, reason: null };

  const n = mode === 'free' ? 6 : 4;
  const nc = P.cells.map(([r, c]) => [r + dr, c + dc]);
  if (nc.some(([r, c]) => r < 0 || c < 0 || r >= n || c >= n))
    return { ok: false, blockers: [], reason: 'That would leave the board.' };

  const occ = occupancy();
  const newSet = new Set(nc.map(([r, c]) => key(r, c)));
  const displaced = new Set();
  nc.forEach(([r, c]) => {
    const hit = occ.get(key(r, c));
    if (hit && hit.pi !== pi) displaced.add(hit.pi);
  });

  const moves = { [pi]: nc };
  if (displaced.size === 0)
    return { ok: true, moves, kind: 'move', apply: applier(moves) };

  // clean congruent swap: one displaced piece sitting exactly on the target
  if (displaced.size === 1) {
    const qi = [...displaced][0], Q = state.pieces[qi];
    const exact = Q.cells.length === nc.length &&
                  Q.cells.every(([r, c]) => newSet.has(key(r, c)));
    if (exact) {
      const qNew = Q.cells.map(([r, c]) => [r - dr, c - dc]);
      if (qNew.every(([r, c]) => r >= 0 && c >= 0 && r < n && c < n)) {
        moves[qi] = qNew;
        return { ok: true, moves, kind: 'swap', apply: applier(moves) };
      }
    }
  }

  // nudge: relocate displaced pieces, preferring the cells the mover vacated
  // (so the whole thing reads like a swap even when several tiles shift).
  const oldSet = new Set(P.cells.map(([r, c]) => key(r, c)));
  const hole = new Set([...oldSet].filter(k => !newSet.has(k)));   // cells P left behind

  const used = new Set();
  state.pieces.forEach((p, idx) => {
    if (idx === pi || displaced.has(idx)) return;
    p.cells.forEach(([r, c]) => used.add(key(r, c)));
  });
  nc.forEach(([r, c]) => used.add(key(r, c)));

  // harder (larger) pieces first
  const order = [...displaced].sort((a, b) =>
    state.pieces[b].cells.length - state.pieces[a].cells.length);
  for (const qi of order) {
    const spot = bestPlacement(state.pieces[qi], used, hole, n);
    if (!spot) return { ok: false, blockers: [...displaced],
                        reason: 'No room to shift that piece.' };
    spot.forEach(([r, c]) => { used.add(key(r, c)); hole.delete(key(r, c)); });
    moves[qi] = spot;
  }
  return { ok: true, moves, kind: 'nudge', apply: applier(moves) };
}

// Best shape-preserving translation of `piece` into free cells, preferring
// placements that fill the vacated `hole` (swap-like), then least movement.
function bestPlacement(piece, used, hole, n) {
  const base = piece.cells;
  const r0 = Math.min(...base.map(c => c[0])), c0 = Math.min(...base.map(c => c[1]));
  const h = Math.max(...base.map(c => c[0])) - r0;
  const w = Math.max(...base.map(c => c[1])) - c0;
  let best = null, bestFill = -1, bestDist = Infinity;
  for (let R = 0; R <= n - 1 - h; R++) {
    for (let C = 0; C <= n - 1 - w; C++) {
      const cells = base.map(([r, c]) => [r - r0 + R, c - c0 + C]);
      if (cells.some(([r, c]) => used.has(key(r, c)))) continue;
      const fill = cells.reduce((a, [r, c]) => a + (hole.has(key(r, c)) ? 1 : 0), 0);
      const dist = Math.abs(R - r0) + Math.abs(C - c0);
      // maximize overlap with the vacated hole, then minimize distance moved
      if (fill > bestFill || (fill === bestFill && dist < bestDist)) {
        bestFill = fill; bestDist = dist; best = cells;
      }
    }
  }
  return best;
}

function applier(moves) {
  return () => {
    for (const idx in moves) state.pieces[idx].cells = moves[idx].map(c => c.slice());
  };
}

// back-compat shim for scramble/tests
function tryMove(pi, anchor, tr, tc, mode) {
  return planMove(pi, anchor, tr, tc, mode);
}

// -------------------------------------------------------------- scramble
function scramble() {
  const P = PUZZLES[state.idx];
  state.pieces.forEach((p, i) => {
    p.cells = P.pieces[i].cells.map(c => c.slice());
  });
  // validity check in the 0-indexed frame the scramble works in (before the
  // free-board shift), so the "not already solved" guard actually fires
  const solvedAt0 = () => {
    const occ = occupancy();
    const g = [];
    for (let r = 0; r < 4; r++) {
      let row = '';
      for (let c = 0; c < 4; c++) {
        const h = occ.get(key(r, c));
        if (!h) return false;
        row += state.pieces[h.pi].letters[h.ci];
      }
      g.push(row);
    }
    for (let i = 0; i < 4; i++) {
      if (!WORDSET.has(g[i])) return false;
      if (!WORDSET.has(g[0][i] + g[1][i] + g[2][i] + g[3][i])) return false;
    }
    return true;
  };
  let applied = 0, guard = 0;
  while ((applied < 45 || solvedAt0()) && guard < 6000) {
    guard++;
    const pi = Math.floor(Math.random() * state.pieces.length);
    const anchor = Math.floor(Math.random() * state.pieces[pi].cells.length);
    const tr = Math.floor(Math.random() * 4), tc = Math.floor(Math.random() * 4);
    const res = tryMove(pi, anchor, tr, tc, 'strict');
    if (res.ok) { res.apply(); applied++; }
  }
  if (state.mode === 'free') shiftAll(1);
  state.revealed = false;
}

function shiftAll(d) {
  state.pieces.forEach(p => { p.cells = p.cells.map(([r, c]) => [r + d, c + d]); });
}

// ------------------------------------------------------------ validation
function currentGrid() {
  // returns 4x4 letter grid (from inner zone in free mode) or null if incomplete
  const off = innerOff();
  const occ = occupancy();
  const g = [];
  for (let r = 0; r < 4; r++) {
    let row = '';
    for (let c = 0; c < 4; c++) {
      const hit = occ.get(key(r + off, c + off));
      if (!hit) return null;
      row += state.pieces[hit.pi].letters[hit.ci];
    }
    g.push(row);
  }
  return g;
}

function gridIsValidCrossword() {
  const g = currentGrid();
  if (!g) return false;
  for (let i = 0; i < 4; i++) {
    if (!WORDSET.has(g[i])) return false;
    const col = g[0][i] + g[1][i] + g[2][i] + g[3][i];
    if (!WORDSET.has(col)) return false;
  }
  return true;
}

// ------------------------------------------------------------- rendering
function metrics() {
  const avail = Math.min(560, document.getElementById('boardWrap').clientWidth);
  S = Math.min(S_MAX, Math.floor((avail - 8) / cols()));
  GAP = Math.max(2, Math.round(S * 0.045));
  const size = S * cols();
  board.style.width = size + 'px';
  board.style.height = size + 'px';
  board.style.backgroundImage = 'none';        // outer scratch area is plain
  // grid lines live only in the inner 4×4 target zone
  zone.style.left = S + 'px'; zone.style.top = S + 'px';
  zone.style.width = (S * 4) + 'px'; zone.style.height = (S * 4) + 'px';
  zone.style.backgroundImage =
    'linear-gradient(rgba(90,110,130,.16) 1px, transparent 1px),' +
    'linear-gradient(90deg, rgba(90,110,130,.16) 1px, transparent 1px)';
  zone.style.backgroundSize = S + 'px ' + S + 'px';
  // nest the zone's corner concentrically inside the corner tiles (inset by GAP)
  zone.style.borderRadius = (Math.round(S * 0.17) + GAP) + 'px';
  board.classList.add('free');
  state.pieces.forEach(styleTiles);
}

function buildTiles() {
  board.querySelectorAll('.tile').forEach(t => t.remove());
  state.pieces.forEach((p, pi) => {
    p.tiles = p.cells.map((cell, ci) => {
      const t = document.createElement('div');
      t.className = 'tile';
      t.dataset.pi = pi; t.dataset.ci = ci;
      t.setAttribute('role', 'button');
      t.tabIndex = 0;
      const span = document.createElement('span');
      span.className = 'letter';
      span.textContent = p.letters[ci];
      t.appendChild(span);
      board.appendChild(t);
      return t;
    });
    styleTiles(p);
  });
  positionTiles();
}

// Static chrome per tile: fused-neighbor bridging, corner radii, seams, edges.
function styleTiles(p) {
  if (!p.tiles) return;
  const rel = normShape2(p.cells);        // relative shape cells as [r,c]
  const has = (r, c) => rel.some(([rr, cc]) => rr === r && cc === c);
  const pi = state.pieces.indexOf(p);
  p.cells.forEach((cell, ci) => {
    const [R, C] = rel[ci];
    const t = p.tiles[ci];
    const up = has(R - 1, C), dn = has(R + 1, C), lf = has(R, C - 1), rt = has(R, C + 1);
    let w = S - 2 * GAP, h = S - 2 * GAP;
    if (rt) w += 2 * GAP;
    if (dn) h += 2 * GAP;
    t.style.width = w + 'px'; t.style.height = h + 'px';
    const rad = Math.round(S * 0.17);
    t.style.borderRadius = [
      (!up && !lf) ? rad : 0, (!up && !rt) ? rad : 0,
      (!dn && !rt) ? rad : 0, (!dn && !lf) ? rad : 0,
    ].map(v => v + 'px').join(' ');
    t.style.background = p.cells.length > 1 ? p.color : 'var(--tile)';
    // a fused tile is stretched toward its neighbor; re-center the glyph over
    // the true cell center with a compensating margin (leaves seams untouched)
    const letter = t.querySelector('.letter');
    letter.style.fontSize = Math.round(S * 0.42) + 'px';
    letter.style.marginRight = rt ? (2 * GAP) + 'px' : '0';
    letter.style.marginBottom = dn ? (2 * GAP) + 'px' : '0';
    t.dataset.edges = [!up, !rt, !dn, !lf].map(v => v ? 1 : 0).join('');
    chrome(t, false);
    // anchor-highlight geometry: a true square centered on the cell center,
    // which sits at (S/2 - GAP) from the tile origin on both axes regardless
    // of how the tile is stretched to fuse with neighbors.
    const sq = Math.round((S - 2 * GAP) * 0.82);
    t.style.setProperty('--sq', sq + 'px');
    t.style.setProperty('--sqoff', ((S / 2 - GAP) - sq / 2) + 'px');
    // seams between fused cells, centered exactly on the shared boundary
    t.querySelectorAll('.seam').forEach(s => s.remove());
    const bnd = (S - GAP - 0.75);           // boundary offset from tile origin, minus half seam
    if (rt) { const s = document.createElement('i'); s.className = 'seam';
      s.style.cssText = `top:16%;bottom:16%;width:1.5px;left:${bnd}px`; t.appendChild(s); }
    if (dn) { const s = document.createElement('i'); s.className = 'seam';
      s.style.cssText = `left:16%;right:16%;height:1.5px;top:${bnd}px`; t.appendChild(s); }
  });
}

function normShape2(cells) {
  const r0 = Math.min(...cells.map(c => c[0]));
  const c0 = Math.min(...cells.map(c => c[1]));
  return cells.map(([r, c]) => [r - r0, c - c0]);
}

// edge-only borders via inset shadows (so fused pieces read as one silhouette)
function chrome(t, selected) {
  const [up, rt, dn, lf] = t.dataset.edges.split('').map(Number);
  const w = selected ? 2 : 1.25;
  const col = selected
    ? 'color-mix(in srgb, var(--ink) 45%, transparent)'
    : 'var(--tile-line)';
  const sh = [];
  if (up) sh.push(`inset 0 ${w}px 0 ${col}`);
  if (dn) sh.push(`inset 0 -${w}px 0 ${col}`);
  if (lf) sh.push(`inset ${w}px 0 0 ${col}`);
  if (rt) sh.push(`inset -${w}px 0 0 ${col}`);
  t.style.boxShadow = sh.join(',');
}

function positionTiles() {
  state.pieces.forEach(p => {
    p.cells.forEach(([r, c], ci) => {
      p.tiles[ci].style.transform =
        `translate(${c * S + GAP}px, ${r * S + GAP}px)`;
    });
  });
}

function setSelected(sel) {
  state.pieces.forEach((p, pi) => p.tiles && p.tiles.forEach((t, ci) => {
    const on = sel && sel.pi === pi;
    t.classList.toggle('sel', !!on);
    // flag the anchor cell (the one that lands on your tap), including singles
    t.classList.toggle('anchorsel', !!on && sel.anchor === ci);
    chrome(t, !!on);
  }));
  state.sel = sel;
}

// --------------------------------------------------------- undo / redo
function snapshot() {
  return state.pieces.map(p => p.cells.map(c => c.slice()));
}
function restore(snap) {
  state.pieces.forEach((p, i) => { p.cells = snap[i].map(c => c.slice()); });
}
function commit(moves, scoreDelay) {   // push history, apply a planned move
  state.undo.push(snapshot());
  if (state.undo.length > 100) state.undo.shift();
  state.redo.length = 0;
  for (const idx in moves) state.pieces[idx].cells = moves[idx].map(c => c.slice());
  positionTiles();
  updateUndoButtons();
  clearBadges(); clearScribbles();
  scheduleScore(scoreDelay);
}
function clearHistory() { state.undo.length = 0; state.redo.length = 0; updateUndoButtons(); }
function updateUndoButtons() {
  document.getElementById('undoBtn').disabled = state.undo.length === 0;
  document.getElementById('redoBtn').disabled = state.redo.length === 0;
}
function doUndo() {
  if (!state.undo.length || state.busy) return;
  state.redo.push(snapshot());
  restore(state.undo.pop());
  setSelected(null); clearGhost(); clearBadges(); clearScribbles(); positionTiles(); updateUndoButtons();
  setMsg('');
  scheduleScore();
}
function doRedo() {
  if (!state.redo.length || state.busy) return;
  state.undo.push(snapshot());
  restore(state.redo.pop());
  setSelected(null); clearGhost(); clearBadges(); clearScribbles(); positionTiles(); updateUndoButtons();
  setMsg('');
  scheduleScore();
}
document.getElementById('undoBtn').addEventListener('click', doUndo);
document.getElementById('redoBtn').addEventListener('click', doRedo);
window.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? doRedo() : doUndo();
  }
});

// ------------------------------------------------------------- ghost layer
let ghostPool = [];
function clearGhost() { ghostPool.forEach(g => g.style.opacity = '0'); }

// ✓/✗ verdict badges, shown just past the end of each checked word. Shape-based
// so they read clearly for everyone, including reduced-motion & colorblind players.
let badgePool = [];
function clearBadges() { badgePool.forEach(b => { b.style.opacity = '0'; }); }

// hand-drawn scribble struck through a word that's valid but not in the puzzle
let scribblePool = [];
function clearScribbles() { scribblePool.forEach(s => s.remove()); scribblePool = []; }
function scribblePath(x0, y0, x1, y1) {
  const horiz = Math.abs(x1 - x0) > Math.abs(y1 - y0);
  const segs = 6;
  let d = `M ${x0.toFixed(1)} ${y0.toFixed(1)}`;
  for (let k = 1; k <= segs; k++) {
    const t = k / segs, pt = (k - 0.5) / segs;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    const mx = x0 + (x1 - x0) * pt, my = y0 + (y1 - y0) * pt;
    const w = (k % 2 ? -1 : 1) * (S * 0.055);
    d += ` Q ${(horiz ? mx : mx + w).toFixed(1)} ${(horiz ? my + w : my).toFixed(1)} ` +
         `${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}
function showScribble(i, off) {
  const NS = 'http://www.w3.org/2000/svg';
  const size = S * cols();
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'scribble');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.style.width = size + 'px'; svg.style.height = size + 'px';
  let x0, y0, x1, y1;
  if (i < 4) {                                   // row
    y0 = y1 = (i + off) * S + S / 2;
    x0 = off * S + GAP * 2; x1 = (off + 4) * S - GAP * 2;
  } else {                                       // column
    x0 = x1 = ((i - 4) + off) * S + S / 2;
    y0 = off * S + GAP * 2; y1 = (off + 4) * S - GAP * 2;
  }
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('class', 'scribble-path');
  path.setAttribute('d', scribblePath(x0, y0, x1, y1));
  svg.appendChild(path);
  board.appendChild(svg);
  scribblePool.push(svg);
  drawStroke(path, 420);
}

// a loose, hand-drawn ellipse lassoing a word that IS in the puzzle.
// Smooth cubic segments from real ellipse tangents; the "hand-drawn" quality comes
// from a slight tilt, a low-frequency radius drift, and a small overshoot — not jitter.
function sketchEllipsePath(cx, cy, rx, ry) {
  const tilt = -0.045;                      // a few degrees off-axis
  const start = -0.5, sweep = Math.PI * 2 + 0.42;
  const segs = 8, dt = sweep / segs;
  const drift = t => 1 + Math.sin(t * 0.85 + 0.7) * 0.022;   // gentle, not lumpy
  const rot = (x, y) => [cx + x * Math.cos(tilt) - y * Math.sin(tilt),
                         cy + x * Math.sin(tilt) + y * Math.cos(tilt)];
  const pt = t => rot(Math.cos(t) * rx * drift(t), Math.sin(t) * ry * drift(t));
  const tan = t => {
    const a = drift(t);
    const dx = -Math.sin(t) * rx * a, dy = Math.cos(t) * ry * a;
    return [dx * Math.cos(tilt) - dy * Math.sin(tilt),
            dx * Math.sin(tilt) + dy * Math.cos(tilt)];
  };
  const p0 = pt(start);
  let d = `M ${p0[0].toFixed(1)} ${p0[1].toFixed(1)}`;
  for (let k = 1; k <= segs; k++) {
    const t0 = start + (k - 1) * dt, t1 = start + k * dt;
    const [x0, y0] = pt(t0), [x1, y1] = pt(t1);
    const [dx0, dy0] = tan(t0), [dx1, dy1] = tan(t1);
    const c = dt / 3;
    d += ` C ${(x0 + dx0 * c).toFixed(1)} ${(y0 + dy0 * c).toFixed(1)},` +
         ` ${(x1 - dx1 * c).toFixed(1)} ${(y1 - dy1 * c).toFixed(1)},` +
         ` ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}
function showCircle(i, off) {
  const NS = 'http://www.w3.org/2000/svg';
  const size = S * cols();
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'scribble');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.style.width = size + 'px'; svg.style.height = size + 'px';
  let cx, cy, rx, ry;
  if (i < 4) {                                   // row
    cx = (off + 2) * S; cy = (i + off) * S + S / 2;
    rx = 2 * S - GAP * 1.5; ry = S / 2 - GAP * 1.2;
  } else {                                       // column
    cx = ((i - 4) + off) * S + S / 2; cy = (off + 2) * S;
    rx = S / 2 - GAP * 1.2; ry = 2 * S - GAP * 1.5;
  }
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('class', 'scribble-path circle-path');
  path.setAttribute('d', sketchEllipsePath(cx, cy, rx, ry));
  svg.appendChild(path);
  board.appendChild(svg);
  scribblePool.push(svg);
  drawStroke(path, 560);
}

// shared: animate a path drawing itself
function drawStroke(path, ms) {
  const len = path.getTotalLength ? path.getTotalLength() : 400;
  path.style.strokeDasharray = len;
  path.style.strokeDashoffset = len;
  if (path.animate) path.animate(
    [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
    { duration: ms, easing: 'ease-out', fill: 'forwards' });
  else path.style.strokeDashoffset = 0;
}

function showBadge(i, kind, off, unique) {
  let b = badgePool[i];
  if (!b) { b = document.createElement('div'); board.appendChild(b); badgePool[i] = b; }
  const size = Math.round(S * 0.5);
  const r = i < 4 ? i + off : off + 4;          // rows → right margin; cols → bottom margin
  const c = i < 4 ? off + 4 : (i - 4) + off;
  b.className = 'verdict-badge ' + kind + (unique ? ' unique' : '');
  b.textContent = kind === 'star' ? '★' : (kind === 'good' ? '✓' : '✗');
  b.style.width = size + 'px'; b.style.height = size + 'px';
  b.style.fontSize = Math.round(size * 0.6) + 'px';
  b.style.left = (c * S + (S - size) / 2) + 'px';
  b.style.top = (r * S + (S - size) / 2) + 'px';
  b.style.opacity = '1';
  if (b.animate) {
    const reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    else b.animate([
      { opacity: 0, transform: 'scale(.4)' },
      { opacity: 1, transform: 'scale(1.15)', offset: 0.7 },
      { opacity: 1, transform: 'scale(1)' },
    ], { duration: 320, easing: 'ease-out' });
  }
}
function drawGhost(moves, movedPi, ok) {
  const PAL = {
    ok:    { fill: 'color-mix(in srgb, var(--accent) 17%, transparent)',    edge: 'color-mix(in srgb, var(--accent) 68%, transparent)' },
    nudge: { fill: 'color-mix(in srgb, var(--ink-soft) 15%, transparent)',  edge: 'color-mix(in srgb, var(--ink-soft) 52%, transparent)' },
    bad:   { fill: 'color-mix(in srgb, var(--bad) 16%, transparent)',       edge: 'color-mix(in srgb, var(--bad) 68%, transparent)' },
  };
  let gi = 0;
  const paint = (cells, kind) => {
    const set = new Set(cells.map(([r, c]) => r + ',' + c));
    const has = (r, c) => set.has(r + ',' + c);
    const { fill, edge } = PAL[kind];
    const rad = Math.round(S * 0.17);
    cells.forEach(([r, c]) => {
      let g = ghostPool[gi];
      if (!g) { g = document.createElement('div'); board.appendChild(g); ghostPool.push(g); }
      g.className = 'move-ghost';
      const up = has(r - 1, c), dn = has(r + 1, c), lf = has(r, c - 1), rt = has(r, c + 1);
      // full-cell size so adjacent cells touch → contiguous silhouette
      g.style.width = S + 'px'; g.style.height = S + 'px';
      g.style.transform = `translate(${c * S}px, ${r * S}px)`;
      g.style.background = fill;
      g.style.borderRadius = [
        (!up && !lf) ? rad : 0, (!up && !rt) ? rad : 0,
        (!dn && !rt) ? rad : 0, (!dn && !lf) ? rad : 0,
      ].map(v => v + 'px').join(' ');
      // draw a 2px border only on outer edges (interior seams stay open)
      const w = 2, sh = [];
      if (!up) sh.push(`inset 0 ${w}px 0 ${edge}`);
      if (!dn) sh.push(`inset 0 -${w}px 0 ${edge}`);
      if (!lf) sh.push(`inset ${w}px 0 0 ${edge}`);
      if (!rt) sh.push(`inset -${w}px 0 0 ${edge}`);
      g.style.boxShadow = sh.join(',');
      g.style.opacity = '1';
      gi++;
    });
  };
  if (ok) {
    for (const idx in moves) paint(moves[idx], +idx === movedPi ? 'ok' : 'nudge');
  } else {
    paint(moves[movedPi] || [], 'bad');
  }
  for (; gi < ghostPool.length; gi++) ghostPool[gi].style.opacity = '0';
}

// ------------------------------------------------------------ interaction
// Shared: convert a client point to a board cell (may be outside the grid).
function pointToCell(clientX, clientY) {
  const rect = board.getBoundingClientRect();
  return [Math.floor((clientY - rect.top) / S), Math.floor((clientX - rect.left) / S)];
}

// preview a move for the currently-selected/dragged piece landing at (tr,tc)
function preview(pi, anchor, tr, tc) {
  const res = planMove(pi, anchor, tr, tc, state.mode);
  if (res.reason === null && !res.ok) { clearGhost(); return; }  // no-op (same spot)
  drawGhost(res.moves || {}, pi, res.ok);
}

const DRAG_THRESHOLD = 4;
const SWIPE_MIN = 30;            // px: a press on empty space that travels this far is a swipe

board.addEventListener('pointerdown', e => {
  if (state.busy) return;
  e.preventDefault();
  board.setPointerCapture(e.pointerId);
  const [r, c] = pointToCell(e.clientX, e.clientY);
  const inside = r >= 0 && c >= 0 && r < cols() && c < cols();
  const hit = inside ? occupancy().get(key(r, c)) : null;
  // remember the gesture; DON'T change selection yet (a tap may be a move)
  state.drag = {
    pi: hit ? hit.pi : null,
    anchor: hit ? hit.ci : null,
    downR: r, downC: c,
    startX: e.clientX, startY: e.clientY,
    moved: false, dragging: false,
  };
});

board.addEventListener('pointermove', e => {
  const d = state.drag;
  if (!d) {                                   // hover preview when something's selected
    if (state.sel && !state.busy) {
      const [r, c] = pointToCell(e.clientX, e.clientY);
      if (r >= 0 && c >= 0 && r < cols() && c < cols())
        preview(state.sel.pi, state.sel.anchor, r, c);
      else clearGhost();
    }
    return;
  }
  if (d.pi === null) return;                   // press began on empty space: no drag
  const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
  if (!d.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  if (!d.dragging) {                            // drag begins → now select the grabbed piece
    d.dragging = true;
    setSelected({ pi: d.pi, anchor: d.anchor });
    board.classList.add('dragging');
  }
  const P = state.pieces[d.pi];
  P.tiles.forEach((tile, ci) => {
    const [r, c] = P.cells[ci];
    tile.classList.add('dragging');
    tile.style.transform = `translate(${c * S + GAP + dx}px, ${r * S + GAP + dy}px)`;
  });
  const [ar, ac] = P.cells[d.anchor];
  const tr = Math.floor((ar * S + S / 2 + dy) / S);
  const tc = Math.floor((ac * S + S / 2 + dx) / S);
  preview(d.pi, d.anchor, tr, tc);
});

function endDrag(e) {
  const d = state.drag;
  if (!d) return;
  state.drag = null;
  try { board.releasePointerCapture(e.pointerId); } catch (err) {}

  if (d.dragging) {                             // a real drag → commit or snap back
    board.classList.remove('dragging');
    const P = state.pieces[d.pi];
    P.tiles.forEach(t => t.classList.remove('dragging'));
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    const [ar, ac] = P.cells[d.anchor];
    const tr = Math.floor((ar * S + S / 2 + dy) / S);
    const tc = Math.floor((ac * S + S / 2 + dx) / S);
    clearGhost();
    const res = planMove(d.pi, d.anchor, tr, tc, state.mode);
    if (res.ok) { commit(res.moves); setSelected(null); setMsg(''); }
    else { positionTiles(); if (res.reason) setMsg(res.reason, 'bad'); setSelected(null); }
    return;
  }
  if (d.pi === null) {                           // swipe on empty space → shift that way
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_MIN) {
      resetTap();
      if (Math.abs(dx) > Math.abs(dy)) doShiftAll(0, Math.sign(dx));
      else doShiftAll(Math.sign(dy), 0);
      return;
    }
  }
  tapAt(d.downR, d.downC);                       // it was a tap
}
board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', e => {
  if (!state.drag) return;
  if (state.drag.dragging) { positionTiles(); setSelected(null); clearGhost(); board.classList.remove('dragging'); }
  state.drag = null;
  try { board.releasePointerCapture(e.pointerId); } catch (err) {}
});

board.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const t = e.target.closest('.tile');
  if (!t) return;
  e.preventDefault();
  const [r, c] = state.pieces[+t.dataset.pi].cells[+t.dataset.ci];
  tapAt(r, c);
});

// One tap resolves against the current selection:
//  • no selection  → select the piece under the tap
//  • tapping the selected piece again → deselect
//  • otherwise      → move the selected piece so its anchor lands on this cell
//                     (works for empty cells and for swapping onto another piece)
function resetTap() {
  if (state.tap.timer) { clearTimeout(state.tap.timer); state.tap.timer = null; }
  state.tap.count = 0;
}
// Double-tap empty space → undo, triple-tap → redo. Only fires on empty cells
// with nothing selected, so it never interferes with selecting or moving pieces.
function registerEmptyTap() {
  state.tap.count++;
  if (state.tap.timer) clearTimeout(state.tap.timer);
  const n = state.tap.count;
  state.tap.timer = setTimeout(() => {
    state.tap.timer = null; state.tap.count = 0;
    if (n === 2) { doUndo(); setMsg('Undo', ''); }
    else if (n >= 3) { doRedo(); setMsg('Redo', ''); }
  }, 300);
}

function tapAt(r, c) {
  const hit = occupancy().get(key(r, c));

  if (state.sel) {
    resetTap();
    if (hit && hit.pi === state.sel.pi) {       // tapped selected piece → toggle off
      setSelected(null); clearGhost(); setMsg('');
      return;
    }
    const res = planMove(state.sel.pi, state.sel.anchor, r, c, state.mode);
    clearGhost();
    if (res.ok) { commit(res.moves); setSelected(null); setMsg(''); }
    else { if (res.reason) setMsg(res.reason, 'bad'); setSelected(null); }
    return;
  }

  if (hit) {
    resetTap();
    setSelected({ pi: hit.pi, anchor: hit.ci });
    setMsg(state.pieces[hit.pi].cells.length > 1
      ? 'Piece selected — drag it, or tap where it should go.'
      : 'Tile selected — drag it, or tap where it should go.');
    return;
  }

  registerEmptyTap();                            // empty space, nothing selected
}

// ------------------------------------------------------------ Super Check
// Forming new valid words charges a meter. Spending it sorts the words currently
// on the board into "appears in a solution" / "doesn't" — judged against every
// solution, so a confirmed word is never contradicted by a later win.
function boardWords() {
  const g = currentGrid();
  if (!g) return [];
  const out = [];
  for (let i = 0; i < 4; i++) out.push(g[i]);
  for (let i = 0; i < 4; i++) out.push(g[0][i] + g[1][i] + g[2][i] + g[3][i]);
  return out;
}
function meterValue() { return state.hints[state.idx].charge; }
function isSolved(idx = state.idx) { return state.found[idx].size > 0; }

function bumpMeter(points, idx = state.idx) {
  const h = state.hints[idx];
  const before = h.charge;
  h.charge += points;
  updateSuper();
  // just earned a Grid Check on the puzzle being played → show it off
  if (idx === state.idx && !isSolved(idx) &&
      Math.floor(h.charge / HINT_THRESHOLD) > Math.floor(before / HINT_THRESHOLD))
    celebrateCharge(before < HINT_THRESHOLD ? (before % HINT_THRESHOLD) / HINT_THRESHOLD : 1);
}

// A Grid Check was just earned: peek the drawer up to the button, let it fill the
// last stretch of gold, then give it a small pop so players know it's there.
function celebrateCharge(fromFrac) {
  const d = document.getElementById('drawer');
  const btn = document.getElementById('bankCheckBtn');
  if (!d.classList.contains('open')) {
    clearTimeout(peekTimer);
    d.classList.add('peek');
    document.getElementById('drawerPanel').scrollTop = 0;     // the button is at the top
    peekTimer = setTimeout(() => { if (!state.busy) d.classList.remove('peek'); }, 2400);
  }
  btn.classList.add('no-anim');
  btn.style.setProperty('--fill', (fromFrac * 100).toFixed(0) + '%');
  void btn.offsetWidth;
  btn.classList.remove('no-anim');
  setTimeout(() => {
    btn.style.setProperty('--fill', '100%');
    if (!btn.animate) return;
    btn.animate([{ transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(0,0,0,0)' },
                 { transform: 'scale(1.09)', offset: 0.45,
                   boxShadow: '0 0 0 6px color-mix(in srgb, var(--gold) 45%, transparent)' },
                 { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(0,0,0,0)' }],
                { duration: 520, delay: 380, easing: 'cubic-bezier(.3,1.5,.5,1)' });
  }, 320);
}

function pulseSuper() {
  const btn = document.getElementById('bankBar');
  if (btn && btn.animate) btn.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }],
    { duration: 300, easing: 'cubic-bezier(.3,1.7,.5,1)' });
}

// a dot flies from where it was earned to the word bank's charge meter (1 per point)
function flyDot(fromEl, delay) {
  if (!fromEl) return;
  const idx = state.idx;             // the point belongs to this puzzle even if you switch mid-flight
  setTimeout(() => {
    const target = document.getElementById('bankBar');
    if (!target) return;
    const f = fromEl.getBoundingClientRect(), t = target.getBoundingClientRect();
    const cx = f.left + f.width / 2, cy = f.top + f.height / 2;
    const tx = t.left + t.width / 2, ty = t.top + t.height / 2;
    const el = document.createElement('div');
    el.className = 'fly-dot';
    // start at the size of the badge it came from, then shrink as it travels
    const startSize = Math.max(20, f.width || 24);
    el.style.width = startSize + 'px'; el.style.height = startSize + 'px';
    el.style.left = cx + 'px'; el.style.top = cy + 'px';
    document.body.appendChild(el);
    const dx = tx - cx, dy = ty - cy;
    const endScale = 12 / startSize;
    const done = () => { el.remove(); bumpMeter(1, idx); pulseSuper(); };
    if (!el.animate) return done();
    const a = el.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5}px - 30px)) scale(${((1 + endScale) / 2).toFixed(3)})`,
        opacity: 1, offset: 0.55 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${endScale.toFixed(3)})`,
        opacity: 0.95 },
    ], { duration: 780, easing: 'cubic-bezier(.32,0,.36,1)' });
    a.onfinish = done; a.oncancel = done;
  }, delay);
}

// Charging happens the moment any board change lands (a move, Shuffle, Scatter,
// undo, redo), not on Check. +1 for each valid word on a row or column of the
// target 4×4 never formed on this puzzle before, and +1 for each new crossing of
// two valid words. A word doesn't count if its end piece runs on past the edge
// of the 4×4 in the same line. A crossing is the two words plus the letter each one shares,
// so EXIT×AXIS at the X scores once, whichever way round it's laid. Words in the
// opening scramble aren't scored up front; they count on the first move if they
// survive it.
// How long a new arrangement has to stay put before it scores. Any move restarts
// the wait. Shuffle waits longer, so mashing it can't farm words you never saw.
const SCORE_DELAY = 300;           // deliberate moves (also lets the .18s tile slide finish)
const SHUFFLE_SCORE_DELAY = 1000;
let scoreTimer = null;
function scheduleScore(delay = SCORE_DELAY) {
  clearTimeout(scoreTimer);
  scoreTimer = setTimeout(scoreBoard, delay);
}
function cancelScore() { clearTimeout(scoreTimer); scoreTimer = null; }

// a 24px stand-in at a board cell for flyDot to launch from
function cellSpot(r, c, off) {
  const b = board.getBoundingClientRect();
  const x = b.left + (c + off) * S + GAP + (S - GAP) / 2;
  const y = b.top + (r + off) * S + GAP + (S - GAP) / 2;
  return { getBoundingClientRect: () => ({ left: x - 12, top: y - 12, width: 24, height: 24 }) };
}

function scoreBoard() {
  scoreTimer = null;
  if (state.quietSolve) { state.quietSolve = false; return; }   // Show solution
  const h = state.hints[state.idx];
  const off = innerOff();
  const occ = occupancy();
  const lineCells = i => [0, 1, 2, 3].map(j => i < 4 ? [i, j] : [j, i - 4]);
  // A line is broken if the piece at either end carries on past the grid edge in
  // the same direction: SOLE whose E is fused to a Y below really reads SOLEY.
  // Pieces sticking out sideways, and loose tiles beyond the edge, don't matter.
  const runsOn = (end, beyond) => {
    const a = occ.get(key(end[0] + off, end[1] + off));
    const b = occ.get(key(beyond[0] + off, beyond[1] + off));
    return !!(a && b && a.pi === b.pi);
  };
  // the 8 lines of the target 4×4; null where a line isn't filled or runs on
  const words = [];
  for (let i = 0; i < 8; i++) {
    const cells = lineCells(i);
    let w = '';
    for (const [r, c] of cells) {
      const hit = occ.get(key(r + off, c + off));
      if (!hit) { w = null; break; }
      w += state.pieces[hit.pi].letters[hit.ci];
    }
    const [dr, dc] = i < 4 ? [0, 1] : [1, 0];
    const first = cells[0], last = cells[3];
    if (w && (runsOn(first, [first[0] - dr, first[1] - dc]) ||
              runsOn(last, [last[0] + dr, last[1] + dc]))) w = null;
    words.push(w);
  }
  const valid = words.map(w => !!w && WORDSET.has(w));

  const sources = [], newWords = [];
  words.forEach((w, i) => {
    if (!valid[i] || h.seen.indexOf(w) !== -1) return;
    h.seen.push(w);
    newWords.push(w);
    const cells = lineCells(i);
    // launch from the middle of the word
    const a = cellSpot(...cells[1], off).getBoundingClientRect();
    const b = cellSpot(...cells[2], off).getBoundingClientRect();
    sources.push({ getBoundingClientRect: () => ({
      left: (a.left + b.left) / 2, top: (a.top + b.top) / 2, width: 24, height: 24 }) });
    playVerdict(cells.map(([r, c]) => {
      const hit = occ.get(key(r + off, c + off));
      return state.pieces[hit.pi].tiles[hit.ci].querySelector('.letter');
    }), true);
  });

  let newCrossings = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (!valid[r] || !valid[4 + c]) continue;
      // row word crosses at its letter c, column word at its letter r
      const k = [words[r] + ':' + c, words[4 + c] + ':' + r].sort().join('|');
      if (h.crossings.indexOf(k) !== -1) continue;
      h.crossings.push(k);
      newCrossings++;
      sources.push(cellSpot(r, c, off));
    }
  }

  sources.forEach((s, k) => flyDot(s, k * 70));    // each dot adds 1 when it lands
  if (newWords.length) {
    // new words go in the bank quietly (gray, unsorted); the drawer peeks so you see them land
    newWords.forEach(w => h.found.unshift(w));
    peekDrawer();
    renderWordLists(newWords[newWords.length - 1], true);
  }
  if (sources.length) {
    const parts = [];
    if (newWords.length) parts.push((newWords.length === 1 ? 'New word: ' : 'New words: ') +
                                    newWords.map(w => w.toUpperCase()).join(', '));
    if (newCrossings) parts.push(newCrossings === 1 ? 'new crossing'
                                                    : newCrossings + ' new crossings');
    setMsg(parts.join(' · ') + ` — +${sources.length} charge.`, '');
  }

  // solved: finish without needing Check, once the dots have landed
  if (valid.every(Boolean)) {
    const g = words.slice(0, 4);
    h.history.push({ mode: 'solve', marks: words.map(() => '✔️') });
    state.busy = true;
    setTimeout(() => { state.busy = false; updateSuper(); onWin(g); },
               sources.length ? 780 + sources.length * 70 + 200 : 250);
  }
}

// The drawer's whole top edge is one continuous line: flat, then it flares out
// (concave) into slanted sides that rise to a convex-cornered tab, then back down.
// Every blend is a cubic matched to its neighbours' tangents, so the corners and
// the slants flow into each other with no kinks.
function drawerTopPath(W, H) {
  const btn = document.getElementById('drawerTab');
  const tabW = Math.min(W - 60, Math.max(150, btn.offsetWidth || 190));
  const slant = 15;                 // sides splay outward toward the base
  const cx = W / 2;
  const tL = cx - tabW / 2, tR = cx + tabW / 2;      // tab top edge
  const bL = tL - slant, bR = tR + slant;           // tab base (wider)

  const len = Math.hypot(slant, H);
  const uL = [slant / len, -H / len];               // up the left slant
  const uR = [slant / len,  H / len];               // down the right slant
  const flat = [1, 0];
  const RC = 13, RV = 13, DS = 11;                  // concave / convex / along-slant blends

  const f = n => n.toFixed(1);
  const pt = p => `${f(p[0])} ${f(p[1])}`;
  // cubic from p0 leaving along t0, arriving at p1 along t1
  const blend = (p0, t0, p1, t1, k0, k1) =>
    ` C ${pt([p0[0] + t0[0] * k0, p0[1] + t0[1] * k0])},` +
    ` ${pt([p1[0] - t1[0] * k1, p1[1] - t1[1] * k1])}, ${pt(p1)}`;

  const A  = [bL - RC, H];                                   // leave the flat line
  const B  = [bL + uL[0] * DS, H + uL[1] * DS];              // land on the left slant
  const C  = [tL - uL[0] * DS, -uL[1] * DS];                 // leave the slant near the top
  const D  = [tL + RV, 0];                                   // land on the tab's top edge
  const D2 = [tR - RV, 0];                                   // leave the top edge
  const E  = [tR + uR[0] * DS, uR[1] * DS];                  // land on the right slant
  const F  = [bR - uR[0] * DS, H - uR[1] * DS];              // leave the right slant
  const G  = [bR + RC, H];                                   // rejoin the flat line

  let d = `M 0 ${f(H)} L ${pt(A)}`;
  d += blend(A, flat, B, uL, RC * 0.62, DS * 0.62);          // concave flare up
  d += ` L ${pt(C)}`;                                        // straight up the slant
  d += blend(C, uL, D, flat, DS * 0.62, RV * 0.62);          // convex top-left corner
  d += ` L ${pt(D2)}`;                                       // across the tab top
  d += blend(D2, flat, E, uR, RV * 0.62, DS * 0.62);         // convex top-right corner
  d += ` L ${pt(F)}`;                                        // straight down the slant
  d += blend(F, uR, G, flat, DS * 0.62, RC * 0.62);          // concave flare back down
  d += ` L ${f(W)} ${f(H)}`;
  return d;
}
function layoutDrawer() {
  const top = document.getElementById('drawerTop');
  if (!top || !top.clientWidth) return;
  const W = top.clientWidth, H = 42;
  const svg = document.getElementById('drawerTopSvg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const d = drawerTopPath(W, H);
  document.getElementById('drawerFillPath').setAttribute('d', d + ' Z');
  document.getElementById('drawerEdgePath').setAttribute('d', d);
}

function renderWordLists(justAdded, newestFirst) {
  const h = state.hints[state.idx];
  const el = document.getElementById('wordLists');
  const order = arr => newestFirst ? arr.slice().reverse() : arr;
  const mk = (cls, title, arr, id) => arr.length
    ? `<div class="wl ${cls}" ${id ? 'id="' + id + '"' : ''}><h4>${title}</h4><ul>` +
      order(arr).map(w => `<li${w === justAdded ? ' data-new="1"' : ''}>${w.toUpperCase()}</li>`).join('') +
      '</ul></div>'
    : '';
  const total = h.inList.length + h.outList.length;
  // found is already newest-first (scoreBoard unshifts), so it skips order()
  const found = h.found.length
    ? `<div class="wl found"><h4>Found</h4><ul>` +
      h.found.map(w => `<li${w === justAdded ? ' data-new="1"' : ''}>${w.toUpperCase()}</li>`).join('') +
      '</ul></div>'
    : '';
  el.innerHTML = total || h.found.length
    ? found + mk('in', 'In the puzzle', h.inList, 'wlIn') + mk('out', 'Not in the puzzle', h.outList, 'wlOut')
    : '<p class="wl-empty">Find new words to charge up a Grid Check. Use it to see ' +
      'if any of the words on your board are in today’s puzzle, and if you’re on the right track.</p>';
  const fresh = el.querySelector('[data-new]');
  if (fresh && fresh.animate) {
    if (fresh.closest('.found')) {
      // a word you just made: slips in quietly
      fresh.animate([{ transform: 'translateY(-8px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
                    { duration: 450, easing: 'ease-out' });
    } else {
      // a word a grid check just sorted: drops in with a gold flash
      fresh.animate([
        { transform: 'translateY(-18px)', opacity: 0,
          backgroundColor: 'color-mix(in srgb, var(--gold) 60%, transparent)' },
        { transform: 'translateY(0)', opacity: 1,
          backgroundColor: 'color-mix(in srgb, var(--gold) 60%, transparent)', offset: 0.45 },
        { transform: 'translateY(0)', opacity: 1, backgroundColor: 'transparent' },
      ], { duration: 950, easing: 'cubic-bezier(.3,1.2,.5,1)' });
    }
    // while peeking, the window scrolls to wherever the word landed
    const panel = document.getElementById('drawerPanel');
    if (document.getElementById('drawer').classList.contains('peek'))
      panel.scrollTop += fresh.getBoundingClientRect().top - panel.getBoundingClientRect().top - 24;
  }

  // the drawer is always there; empty, it explains how to fill it
  document.getElementById('drawer').classList.toggle('has-words', total > 0);
  document.body.classList.add('has-drawer');
  document.getElementById('drawerTabLabel').textContent = total
    ? `Word bank · ${h.inList.length} in, ${h.outList.length} out` : 'Word bank';
  layoutDrawer();
}
// ------------------------------------------ Check / grid check button states
// Button labels are split into letters so they can ripple while they work.
function splitLetters(el) {
  if (!el) return [];
  const t = el.textContent;
  el.textContent = '';
  [...t].forEach(ch => {
    const s = document.createElement('span');
    s.className = 'ltr';
    s.textContent = ch === ' ' ? ' ' : ch;     // inline-block would swallow a plain space
    el.appendChild(s);
  });
  return [...el.querySelectorAll('.ltr')];
}
const BANK_LTRS = splitLetters(document.getElementById('bankCheckLabel'));
const CHECK_LTRS = splitLetters(document.getElementById('checkLabel'));

let btnAnims = [];

// iOS Safari won't reliably apply :active, so drive the pressed look from pointer
// events.
function wirePress(btn, target) {
  if (!btn || !target || !btn.addEventListener) return;
  const on = () => { if (!btn.disabled) target.classList.add('pressed'); };
  const off = () => target.classList.remove('pressed');
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointercancel', off);
  btn.addEventListener('pointerleave', off);
  btn.addEventListener('blur', off);
}
wirePress(document.getElementById('submitBtn'), document.getElementById('submitBtn'));
wirePress(document.getElementById('bankCheckBtn'), document.getElementById('bankCheckBtn'));

function stopBtnAnims() {
  btnAnims.forEach(a => { try { a.cancel(); } catch (e) {} });
  btnAnims = [];
  [...BANK_LTRS, ...CHECK_LTRS].forEach(el => { el.style.transform = ''; });
  const lbl = document.getElementById('checkLabel');
  if (lbl) lbl.style.transform = '';
}
// Height over time for a real jump is a parabola: y = -4h·t(1-t). Sampling it and
// interpolating linearly gives the true curve, rather than approximating with easing.
function jumpFrames(h, steps) {
  const out = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    out.push({ t, y: -4 * h * t * (1 - t) });
  }
  return out;
}

function setBtnState(mode) {              // '' | 'checking' | 'supering'
  const g = document.getElementById('checkGroup');
  g.classList.toggle('checking', mode === 'checking');
  g.classList.toggle('supering', mode === 'supering');
  stopBtnAnims();
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  if (mode === 'checking') {
    // Check alone is working: the word jumps on a parabolic arc, then lands and rests
    const lbl = document.getElementById('checkLabel');
    if (lbl && lbl.animate) {
      const JUMP = 470, REST = 150, CYCLE = JUMP + REST;
      const kf = jumpFrames(5, 14).map(f => ({
        transform: `translateY(${f.y.toFixed(2)}px)`,
        offset: +((f.t * JUMP) / CYCLE).toFixed(4),
        easing: 'linear',
      }));
      kf.push({ transform: 'translateY(0)', offset: 1, easing: 'linear' });
      btnAnims.push(lbl.animate(kf, { duration: CYCLE, iterations: Infinity }));
    }
  } else if (mode === 'supering') {
    // ripple every letter of "Grid Check" in sequence, then pause briefly and repeat
    const all = BANK_LTRS;
    const LIFT = 400, STAGGER = 81, PAUSE = 100;      // 80% of the old speed
    const wave = (all.length - 1) * STAGGER + LIFT;
    const CYCLE = wave + PAUSE;
    all.forEach((el, i) => {
      if (!el.animate) return;
      const s = i * STAGGER;
      const kf = [];
      if (s > 0) kf.push({ transform: 'translateY(0)', offset: 0, easing: 'linear' });
      jumpFrames(6, 10).forEach(f => kf.push({
        transform: `translateY(${f.y.toFixed(2)}px)`,
        offset: +((s + f.t * LIFT) / CYCLE).toFixed(4),
        easing: 'linear',
      }));
      kf.push({ transform: 'translateY(0)', offset: 1, easing: 'linear' });
      btnAnims.push(el.animate(kf, { duration: CYCLE, iterations: Infinity }));
    });
  }
}

// The bar under the word bank label fills toward the next Grid Check and is full
// gold once one is ready. The Grid Check button in the drawer shows the same fill,
// plus ×N when several are banked.
function updateSuper() {
  const v = meterValue();
  const solved = isSolved();
  const stacks = Math.floor(v / HINT_THRESHOLD);
  const ready = stacks >= 1;
  // solved: the bar and button turn purple and the button becomes Show solution
  const pct = ((ready || solved ? 1 : (v % HINT_THRESHOLD) / HINT_THRESHOLD) * 100).toFixed(0) + '%';
  document.getElementById('bankBarFill').style.width = pct;
  document.getElementById('drawerTab').classList.toggle('charged', ready && !solved);
  document.getElementById('drawerTab').classList.toggle('solved', solved);
  const badge = document.getElementById('bankCheckBadge');   // ×N lives on the button only
  badge.textContent = '×' + stacks;
  badge.classList.toggle('show', stacks >= 2 && !solved);
  const btn = document.getElementById('bankCheckBtn');
  btn.classList.toggle('solution', solved);
  btn.disabled = (!ready && !solved) || state.busy;
  btn.style.setProperty('--fill', pct);
  document.getElementById('bankHint').textContent = solved
    ? 'Puts every piece back where it belongs.'
    : ready ? 'Sorts the words on your board into in / not in the puzzle.'
    : `Make new words to charge it (${v % HINT_THRESHOLD} of ${HINT_THRESHOLD}).`;
  renderWordLists();
}
// Grid Check (was Super Check). Its feedback goes in the drawer, since
// the open drawer covers the message line.
function doSuperCheck() {
  if (isSolved()) { showSolution(); return; }
  if (state.busy || meterValue() < HINT_THRESHOLD) return;
  const say = t => { document.getElementById('bankHint').textContent = t; };
  if (!currentGrid()) {                       // gaps in the 4×4: show where
    say('Fill the 4×4 first.');
    flashEmptySquares();
    return;
  }
  const words = boardWords().filter(w => WORDSET.has(w));
  if (!words.length) { say('Make some words in the 4×4 first.'); return; }
  const h = state.hints[state.idx];
  const unsorted = words.filter(w =>
    h.inList.indexOf(w) === -1 && h.outList.indexOf(w) === -1);
  if (!unsorted.length) { say('Those are already sorted — try some new words.'); return; }
  runCheck(true);
}
document.getElementById('bankCheckBtn').addEventListener('click', doSuperCheck);

// Lower the drawer so the board shows, then blink the empty squares of the 4×4.
function flashEmptySquares() {
  const d = document.getElementById('drawer');
  d.classList.remove('open', 'peek');
  document.getElementById('drawerTab').setAttribute('aria-expanded', 'false');
  const off = innerOff(), occ = occupancy();
  const size = S - 2 * GAP;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    if (occ.has(key(r + off, c + off))) continue;
    const el = document.createElement('div');
    el.className = 'empty-flash';
    Object.assign(el.style, { left: ((c + off) * S + GAP) + 'px', top: ((r + off) * S + GAP) + 'px',
      width: size + 'px', height: size + 'px', borderRadius: Math.round(S * 0.17) + 'px', opacity: 0 });
    board.appendChild(el);
    if (!el.animate) { setTimeout(() => el.remove(), 900); continue; }
    const a = el.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }, { opacity: 1 }, { opacity: 0 }],
                         { duration: 1100, delay: 250, easing: 'ease-in-out' });
    a.onfinish = a.oncancel = () => el.remove();
  }
}

// After solving, the drawer button puts the pieces back into the solution. It's
// an ordinary undoable move, but it doesn't score or replay the win.
function showSolution() {
  if (state.busy) return;
  const P = PUZZLES[state.idx], off = innerOff();
  const moves = {};
  P.pieces.forEach((p, i) => { moves[i] = p.cells.map(([r, c]) => [r + off, c + off]); });
  const d = document.getElementById('drawer');
  d.classList.remove('open', 'peek');
  document.getElementById('drawerTab').setAttribute('aria-expanded', 'false');
  if (JSON.stringify(moves) === JSON.stringify(state.pieces.map(p => p.cells))) return;
  setSelected(null); clearGhost();
  state.quietSolve = true;
  commit(moves);
  setMsg('Here’s the solution.', '');
}

document.getElementById('drawerTab').addEventListener('click', () => {
  const d = document.getElementById('drawer');
  clearTimeout(peekTimer);
  const wasPeeking = d.classList.contains('peek');
  const barRect = document.getElementById('bankBar').getBoundingClientRect();
  d.classList.remove('peek');
  const open = d.classList.toggle('open');
  if (open) {
    document.getElementById('drawerPanel').scrollTop = 0;     // start at the Grid Check
    if (!wasPeeking) morphBarIntoButton(barRect);
  }
  document.getElementById('drawerTab').setAttribute('aria-expanded', open ? 'true' : 'false');
});

// Opening the drawer: the tab's charge bar grows into the Grid Check button.
// A stand-in flies from the bar's spot to where the button will settle once the
// drawer has finished opening, and the real button appears as it arrives.
function morphBarIntoButton(from) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const panel = document.getElementById('drawerPanel');
  const btn = document.getElementById('bankCheckBtn');
  if (!btn.animate || !from.width) return;
  // measure the button's final spot with the drawer fully open, then let it open
  panel.style.transition = 'none';
  const to = btn.getBoundingClientRect();
  panel.style.maxHeight = '0px';
  void panel.offsetHeight;
  panel.style.transition = ''; panel.style.maxHeight = '';

  const ghost = document.createElement('div');
  ghost.className = 'bar-morph';
  const fill = document.createElement('i');
  const barFill = document.getElementById('bankBarFill');
  fill.style.width = barFill.style.width || '0%';
  fill.style.background = getComputedStyle(barFill).backgroundColor;
  ghost.appendChild(fill);
  document.body.appendChild(ghost);
  const box = r => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  btn.style.opacity = '0';
  const a = ghost.animate([Object.assign(box(from), { borderRadius: '2px' }),
                           Object.assign(box(to), { borderRadius: '12px' })],
                          { duration: 380, easing: 'cubic-bezier(.3,.9,.4,1)', fill: 'forwards' });
  // show the real button underneath first, then fade the stand-in off it, so
  // nothing shows through in between
  const done = () => {
    btn.style.opacity = '';
    const out = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
    out.onfinish = out.oncancel = () => ghost.remove();
  };
  a.onfinish = done; a.oncancel = done;
}

// Crack the closed drawer open for a moment so a newly found word can be seen landing.
let peekTimer = null;
function peekDrawer() {
  const d = document.getElementById('drawer');
  if (d.classList.contains('open')) return;
  d.classList.add('peek');
  clearTimeout(peekTimer);
  peekTimer = setTimeout(() => { if (!state.busy) d.classList.remove('peek'); }, 1600);
}

// ---------------------------------------------------------------- submit
// Verdict animation driven by the Web Animations API, so it replays reliably on
// every Check (the CSS class + reflow-restart trick silently fails on iOS/WebKit).
// Reduced-motion users get a gentle opacity pulse instead of a translate.
function playVerdict(letters, ok) {
  const reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  letters.forEach(el => {
    if (!el || !el.animate) return;
    if (reduce) {
      el.animate([{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }],
                 { duration: 440, easing: 'ease-in-out' });
    } else if (ok) {
      el.animate([
        { transform: 'translateY(0)' },
        { transform: 'translateY(-11px)', offset: 0.3 },
        { transform: 'translateY(3px)', offset: 0.6 },
        { transform: 'translateY(0)' },
      ], { duration: 400, easing: 'ease-in-out' });
    } else {
      el.animate([
        { transform: 'translateX(0)' },
        { transform: 'translateX(-7px)', offset: 0.2 },
        { transform: 'translateX(7px)', offset: 0.4 },
        { transform: 'translateX(-5px)', offset: 0.6 },
        { transform: 'translateX(5px)', offset: 0.8 },
        { transform: 'translateX(0)' },
      ], { duration: 360, easing: 'ease-in-out' });
    }
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Shared verdict sequence. Normal Check: words nod/shake with a ✓/✗ (it no longer
// charges the meter — scoreBoard does that as words are made).
// Super Check: same animation, but words are starred and fly into the word lists.
async function runCheck(superMode) {
  if (state.busy) return;
  setSelected(null); clearGhost(); clearBadges(); clearScribbles();

  if (state.mode === 'free') {
    const off0 = innerOff();
    const stray = [];
    state.pieces.forEach(p => p.cells.forEach(([r, c], ci) => {
      if (r < off0 || c < off0 || r >= off0 + 4 || c >= off0 + 4) stray.push(p.tiles[ci]);
    }));
    if (stray.length) {
      stray.forEach(t => {
        t.classList.remove('jolt'); void t.offsetWidth; t.classList.add('jolt');
        const old = t.style.boxShadow;
        t.style.boxShadow = 'inset 0 0 0 3px color-mix(in srgb, var(--ink) 55%, transparent)';
        setTimeout(() => { t.style.boxShadow = old; }, 900);
      });
      setMsg(stray.length + (stray.length === 1 ? ' letter is' : ' letters are') +
             ' outside the grid.', '');
      return;
    }
  }

  const g = currentGrid();
  if (!g) return;
  const off = innerOff();
  const occ = occupancy();
  const lineLetters = i => {
    const cells = [];
    for (let j = 0; j < 4; j++)
      cells.push(i < 4 ? [i + off, j + off] : [j + off, (i - 4) + off]);
    return cells.map(([r, c]) => {
      const h = occ.get(key(r, c));
      return state.pieces[h.pi].tiles[h.ci].querySelector('.letter');
    });
  };

  const h = state.hints[state.idx];
  const solWords = new Set(PUZZLES[state.idx].solutionWords || []);
  const words = [];
  for (let i = 0; i < 8; i++)
    words.push(i < 4 ? g[i] : g[0][i-4] + g[1][i-4] + g[2][i-4] + g[3][i-4]);

  // record what happened this check, for the win summary / share text
  // (new words charge the meter as they're made — see scoreBoard — not here)
  h.history.push({
    mode: superMode ? 'super' : 'check',
    marks: words.map(w => {
      const okw = WORDSET.has(w), inS = solWords.has(w);
      if (superMode) return inS ? '⭐' : (okw ? '〰️' : '✖️');
      return okw ? '✔️' : '✖️';
    }),
  });

  state.busy = true;
  updateSuper();
  setBtnState(superMode ? 'supering' : 'checking');

  let good = 0;
  const ANIM = 385, PAUSE = 150, STEP = ANIM + PAUSE;
  // Super Check paces each word out in three beats so nothing lands on top of anything else
  const NOD_BEAT = 430, MARK_BEAT = 480, BANK_BEAT = 400;
  const flown = new Set();

  for (let i = 0; i < 8; i++) {
    const word = words[i];
    const ok = WORDSET.has(word);
    const inSol = solWords.has(word);
    if (ok) good++;
    const letters = lineLetters(i);
    playVerdict(letters, ok);

    showBadge(i, superMode ? (inSol ? 'star' : (ok ? 'good' : 'bad')) : (ok ? 'good' : 'bad'), off, false);
    setMsg((i < 4 ? 'Row ' + (i + 1) : 'Column ' + (i - 3)) + ': ' + word.toUpperCase() +
           (superMode ? (inSol ? ' ★ in the puzzle' : (ok ? ' ✓ not in the puzzle' : ' — not a word'))
                      : (ok ? ' ✓' : '')), '');

    if (superMode) {
      // three distinct beats so each moment lands on its own: nod → mark → bank
      await sleep(NOD_BEAT);
      if (ok) {
        inSol ? showCircle(i, off) : showScribble(i, off);
        await sleep(MARK_BEAT);
      }
      if (ok && !flown.has(word) &&
          h.inList.indexOf(word) === -1 && h.outList.indexOf(word) === -1) {
        flown.add(word);
        (inSol ? h.inList : h.outList).push(word);
        const f = h.found.indexOf(word);
        if (f !== -1) h.found.splice(f, 1);      // sorted now, so it leaves Found
        renderWordLists(word, true);             // newest on top, ticker-style
        const d = document.getElementById('drawer');
        d.classList.remove('open');
        clearTimeout(peekTimer);
        d.classList.add('peek');                 // crack it open just enough to see it land
        await sleep(BANK_BEAT);
      }
      if (!ok) await sleep(PAUSE);
      continue;
    }

    await sleep(STEP);
  }

  await sleep(450);
  state.busy = false;
  setBtnState('');
  document.querySelectorAll('.letter').forEach(el => el.classList.remove('nod', 'shake'));

  if (superMode) {
    h.charge = Math.max(0, h.charge - HINT_THRESHOLD);
    h.spent++;
    h.inList.sort(); h.outList.sort();
    updateSuper();
    const d = document.getElementById('drawer');
    d.classList.remove('peek');
    d.classList.add('open');                     // settle into the full list
    document.getElementById('drawerTab').setAttribute('aria-expanded', 'true');
    document.getElementById('drawerPanel').scrollTop = 0;
    setMsg('Grid checked — ★ words appear in a solution.', '');
  } else {
    updateSuper();
    if (good === 8) onWin(g);
    else setMsg(good + ' of 8 words check out. Keep going!', '');
  }
}
document.getElementById('submitBtn').addEventListener('click', () => runCheck(false));

// ------------------------------------------------- win summary / share text
// One line per Grid Check used, then the solving line: ➡️ four row marks, ⬇️ four
// column marks. Grid Check marks: ⭐ in the puzzle, 〰️ a word but not in the
// puzzle, ✖️ not a word; the solving line is all ⭐, with 🎉 on its own line.
// Then the count of Grid Checks and of words found. The summary is made once, at
// the first solve, and stays as it was however the puzzle is played after that.
function buildSummary() {
  const h = state.hints[state.idx];
  const line = e => '➡️' + e.marks.slice(0, 4).join('') + '⬇️' + e.marks.slice(4).join('');
  const lines = h.history.filter(e => e.mode === 'super').map(line);
  const last = h.history[h.history.length - 1];
  if (last && last.marks.every(m => m === '✔️'))     // the solve: every word is in the puzzle
    lines.push(line({ marks: last.marks.map(() => '⭐') }), '🎉');
  const s = h.history.filter(e => e.mode === 'super').length;
  const n = h.seen.length;                 // every distinct word made on this puzzle
  return { lines, count: `${s} Grid Check${s === 1 ? '' : 's'} · ${n} word${n === 1 ? '' : 's'} found` };
}
function summary() {
  const h = state.hints[state.idx];
  return h.summary || buildSummary();
}
function shareText() {
  const s = summary();
  return `${LABEL} #${state.idx + 1}\n` + s.lines.join('\n') + '\n' + s.count;
}
function renderShare() {
  const el = document.getElementById('shareBlock');
  const s = summary();
  if (!s.lines.length) { el.className = ''; el.innerHTML = ''; return; }
  el.innerHTML =
    `<div class="share-title">${LABEL} #${state.idx + 1}</div>` +
    s.lines.map(l => `<div class="share-line">${l}</div>`).join('') +
    `<div class="share-count">${s.count}</div>`;
  el.className = 'show';
  el.querySelectorAll('.share-title, .share-line, .share-count').forEach((n, k) => {
    if (!n.animate) return;
    n.style.opacity = '0';
    n.animate([{ opacity: 0, transform: 'translateY(-7px)' },
               { opacity: 1, transform: 'translateY(0)' }],
              { duration: 320, delay: 120 + k * 150, easing: 'cubic-bezier(.3,1.3,.5,1)',
                fill: 'forwards' });
  });
}
// iPadOS Safari reports itself as "Macintosh", so UA alone isn't enough.
const IS_TOUCH = (navigator.maxTouchPoints || 0) > 1;
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') ||
                  (IS_TOUCH && /Macintosh/i.test(navigator.userAgent || ''));
const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || '') ||
               (IS_TOUCH && /Macintosh/i.test(navigator.userAgent || ''));

// Clipboard with a fallback: navigator.clipboard needs a secure context and is
// blocked in some webviews/iframes, so fall back to a hidden textarea + execCommand.
// Returns whether the copy actually succeeded (so we never claim a false "Copied!").
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall through */ }
  // execCommand is unreliable on iOS — it can return true without copying — so
  // callers on iOS should not rely on this path.
  if (IS_IOS) return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:50%;width:200px;height:60px;' +
                       'font-size:16px;opacity:0.01;border:0;padding:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) { return false; }
}

function flashBtn(btn, msg) {
  const old = btn.dataset.label || btn.textContent;
  btn.dataset.label = old;
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = btn.dataset.label; }, 1500);
}

// Last resort when both the share sheet and clipboard are unavailable (common in
// embedded webviews): show the text selected, so it can be copied by hand.
function revealForManualCopy(text, why) {
  const ta = document.getElementById('shareFallback');
  ta.value = text;
  ta.classList.add('show');
  const note = document.getElementById('shareNote');
  note.textContent = why || '';
  note.classList.toggle('show', !!why);
  ta.focus();
  try { ta.setSelectionRange(0, text.length); } catch (e) {}
}

async function shareOrCopy(text, btn) {
  if (IS_MOBILE) {
    // 1. Native share sheet
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;      // user dismissed
        revealForManualCopy(text, 'share blocked: ' + ((e && e.name) || 'error'));
        flashBtn(btn, 'Select the text above');
        return;
      }
    }
    // 2. Clipboard API only — execCommand lies on iOS (returns true, copies nothing)
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        flashBtn(btn, 'Copied!');
        return;
      }
    } catch (e) { /* fall through */ }
    // 3. Always leave a way out
    revealForManualCopy(text, window.isSecureContext
      ? 'sharing unavailable in this browser'
      : 'needs https — open danagram.fun, not a local file');
    flashBtn(btn, 'Select the text above');
    return;
  }
  // Desktop: clipboard (with execCommand fallback), then manual
  if (await copyText(text)) { flashBtn(btn, 'Copied!'); return; }
  revealForManualCopy(text, 'clipboard blocked here');
  flashBtn(btn, 'Select the text above');
}

document.getElementById('shareBtn').addEventListener('click', () => {
  shareOrCopy(shareText(), document.getElementById('shareBtn'));
});

// a burst of confetti on a genuine solve
function confetti() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const COLORS = ['var(--gold)', 'var(--accent)', 'var(--good)',
                  'var(--o1)', 'var(--o2)', 'var(--o4)', 'var(--o6)'];
  const N = 70;
  const originX = window.innerWidth / 2;
  const originY = window.innerHeight * 0.38;
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.background = COLORS[i % COLORS.length];
    const w = (6 + Math.random() * 6) * 0.8;             // 80% of original size
    el.style.width = w.toFixed(1) + 'px';
    el.style.height = ((w * 0.45 + Math.random() * 7) * 0.8).toFixed(1) + 'px';
    if (Math.random() < 0.28) el.style.borderRadius = '50%';
    el.style.left = (originX + (Math.random() - 0.5) * 90) + 'px';
    el.style.top = originY + 'px';
    document.body.appendChild(el);
    if (!el.animate) { el.remove(); continue; }
    const ang = Math.random() * Math.PI * 2;
    const dist = (80 + Math.random() * 240) * 0.8;       // 80% initial velocity
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist - 112;               // biased upward on the burst
    const fall = window.innerHeight * 0.72 + Math.random() * 220;
    const rot = (Math.random() - 0.5) * 760;
    const T = (x, y, r) =>
      `translate(-50%,-50%) translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) rotate(${r.toFixed(0)}deg)`;
    const a = el.animate([
      // burst outward, decelerating hard
      { transform: T(0, 0, 0), opacity: 1, offset: 0,
        easing: 'cubic-bezier(.12,.75,.35,1)' },
      // long, slow drift down — decelerating rather than accelerating
      { transform: T(dx, dy, rot * 0.4), opacity: 1, offset: 0.2,
        easing: 'cubic-bezier(.25,.5,.35,1)' },
      { transform: T(dx * 1.15, dy + fall * 0.86, rot * 0.85), opacity: 1, offset: 0.86 },
      { transform: T(dx * 1.25, dy + fall, rot), opacity: 0, offset: 1 },
    ], { duration: 3400 + Math.random() * 1900 });
    const done = () => el.remove();
    a.onfinish = done; a.oncancel = done;
  }
}

function onWin(g) {
  const gs = g.join('');
  const found = state.found[state.idx];
  const cardT = document.getElementById('cardTitle');
  const cardB = document.getElementById('cardBody');
  document.getElementById('cardWords').textContent = '';
  let celebrate = false;

  if (state.revealed) {
    cardT.textContent = 'Revealed';
    cardB.textContent = 'Shuffle and solve it yourself to make it count.';
  } else if (found.has(gs)) {
    cardT.textContent = 'Déjà vu!';
    cardB.textContent = 'You already solved this one.';
  } else {
    found.add(gs);
    cardT.textContent = 'Congratulations!';
    cardB.textContent = '';
    celebrate = true;
  }
  // freeze the success summary at the first real solve
  const h = state.hints[state.idx];
  if (!h.summary && !state.revealed) h.summary = buildSummary();
  updateMeta();
  updateSuper();                       // Grid Check → Show solution
  openWinCard();
  if (celebrate) confetti();
}

// -------------------------------------------------------------- storage
const store = {
  mem: {},
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }
           catch (e) { return this.mem[k] || null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); }
              catch (e) { this.mem[k] = v; } },
};

// ------------------------------------------------------------ success card
function openWinCard() {
  state.drag = null;
  try { board.releasePointerCapture && board.releasePointerCapture(); } catch (err) {}
  const fb = document.getElementById('shareFallback');
  fb.classList.remove('show'); fb.value = '';
  document.getElementById('shareNote').classList.remove('show');
  renderShare();
  startCountdown();
  document.getElementById('overlay').classList.add('show');
}

document.getElementById('closeCard').addEventListener('click', () => {
  document.getElementById('overlay').classList.remove('show');
  stopCountdown();
});

// --------------------------------------------------------------- controls
function updateMeta() {
  const solved = state.found[state.idx].size > 0;
  document.getElementById('puzzleLabel').innerHTML =
    `Puzzle ${state.idx + 1} of ${PUZZLES.length}` + (solved ? ' <span class="solved">✓</span>' : '');
}

function deepCells(cellsPerPiece) {
  return cellsPerPiece.map(pc => pc.map(c => c.slice()));
}
function saveSession() {
  if (!state.pieces.length) return;
  state.sessions[state.idx] = {
    cells: state.pieces.map(p => p.cells.map(c => c.slice())),
    undo: state.undo.map(deepCells),
    redo: state.redo.map(deepCells),
  };
}

function loadPuzzle(idx) {
  saveSession();                                 // preserve the puzzle we're leaving
  cancelScore();                                 // a pending score belongs to that puzzle
  state.idx = (idx + PUZZLES.length) % PUZZLES.length;
  state.mode = 'free';
  const P = PUZZLES[state.idx];
  state.pieces = P.pieces.map((p, i) => ({
    letters: p.letters,
    cells: p.cells.map(c => c.slice()),
    color: OCOLORS[
      P.pieces.filter((q, j) => j < i && q.letters.length > 1).length % OCOLORS.length],
  }));
  setSelected(null); clearGhost(); clearBadges(); clearScribbles();

  const sess = state.sessions[state.idx];
  if (sess && sess.cells.length === state.pieces.length) {   // returning → restore progress
    state.pieces.forEach((p, i) => { p.cells = sess.cells[i].map(c => c.slice()); });
    state.undo = sess.undo.map(deepCells);
    state.redo = sess.redo.map(deepCells);
  } else {                                       // first visit → fresh scramble
    state.undo = []; state.redo = [];
    scramble();
  }

  buildTiles();
  metrics();
  positionTiles();
  updateUndoButtons();
  updateMeta();
  updateSuper();
  setMsg('Drag a piece, or tap it then tap a destination. Double-tap empty space to undo.');
}

document.getElementById('prevBtn').addEventListener('click', () => !state.busy && loadPuzzle(state.idx - 1));
document.getElementById('nextBtn').addEventListener('click', () => !state.busy && loadPuzzle(state.idx + 1));
// Shuffle the current arrangement with random legal moves — one undo reverts it.
function doShuffle() {
  if (state.busy) return;
  setSelected(null); clearGhost();
  const orig = snapshot();
  scramble();                                    // same packed-into-the-4×4 randomization
                                                   // used to set up a fresh puzzle
  const moves = {};
  state.pieces.forEach((p, i) => { moves[i] = p.cells.map(c => c.slice()); });
  restore(orig);                                 // rewind, then commit as a single undo step
  commit(moves, SHUFFLE_SCORE_DELAY);
  setMsg('Shuffled.');
}
document.getElementById('shuffleBtn').addEventListener('click', doShuffle);

// Spread single tiles out to the perimeter, leaving the ominos in the middle.
function doSpread() {
  if (state.busy) return;
  setSelected(null); clearGhost();
  const N = 6;
  const isPerim = (r, c) => r === 0 || c === 0 || r === N - 1 || c === N - 1;
  const perim = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (isPerim(r, c)) perim.push([r, c]);

  const used = new Set();
  state.pieces.forEach(p => { if (p.cells.length > 1) p.cells.forEach(([r, c]) => used.add(key(r, c))); });

  const moves = {};
  // singles already on the perimeter claim their spot first (they tend to stay),
  // then inner singles fill the nearest remaining edge cells
  const order = state.pieces
    .map((p, i) => ({ p, i }))
    .filter(o => o.p.cells.length === 1)
    .sort((a, b) => (isPerim(b.p.cells[0][0], b.p.cells[0][1]) ? 1 : 0) -
                    (isPerim(a.p.cells[0][0], a.p.cells[0][1]) ? 1 : 0));
  order.forEach(({ p, i }) => {
    const [sr, sc] = p.cells[0];
    let best = null, bd = Infinity;
    for (const [r, c] of perim) {
      if (used.has(key(r, c))) continue;
      const d = Math.abs(r - sr) + Math.abs(c - sc);
      if (d < bd) { bd = d; best = [r, c]; }
    }
    if (!best) best = [sr, sc];
    used.add(key(best[0], best[1]));
    moves[i] = [best.slice()];
  });
  state.pieces.forEach((p, i) => { if (!(i in moves)) moves[i] = p.cells.map(c => c.slice()); });
  commit(moves);                                 // current state unchanged → single undo reverts
  setMsg('Singles pushed to the edges — try placing the ominos first.');
}
document.getElementById('spreadBtn').addEventListener('click', doSpread);

// Shift toward an edge of the 6×6 board, 2048-style. Each press does the first
// of these that applies:
//   1. nothing touches that edge → everything steps one space;
//   2. there are gaps → every piece slides until it hits the edge or another
//      tile (pieces are rigid, so a piece stops as soon as any tile is blocked);
//   3. already packed → the pieces touching the edge wrap (dropEdgePieces).
// One shift = one undo step.
function doShiftAll(dr, dc) {
  if (state.busy) return;
  setSelected(null); clearGhost();
  const N = 6;
  const horiz = dc !== 0, s = horiz ? dc : dr;
  // positions along the shift axis, counted so the target edge is N-1
  const pos = ([r, c]) => { const a = horiz ? c : r; return s > 0 ? a : N - 1 - a; };
  const step = ([r, c], d) => horiz ? [r, c + d * s] : [r + d * s, c];  // d steps toward the edge
  const lines = state.pieces.map(p => p.cells.map(pos));
  const moves = {};

  if (Math.max(...lines.flat()) < N - 1) {
    state.pieces.forEach((p, i) => { moves[i] = p.cells.map(c => step(c, 1)); });
  } else if (!slideToEdge(pos, step, moves) &&
             !dropEdgePieces(lines, pos, step, horiz, moves)) {
    playVerdict(state.pieces.flatMap(p => p.tiles.map(t => t.querySelector('.letter'))), false);
    setMsg('No room to wrap that way.', '');
    return;
  }
  commit(moves);
  setMsg('');
}

// doShiftAll step 2: let every piece fall toward the edge one space at a time
// until nothing can move. Fills `moves`; false if nothing moved (already packed).
function slideToEdge(pos, step, moves) {
  const N = 6;
  const cur = state.pieces.map(p => p.cells.map(c => c.slice()));
  const occ = new Map();
  cur.forEach((cells, i) => cells.forEach(([r, c]) => occ.set(key(r, c), i)));
  let moved = false, again = true;
  while (again) {
    again = false;
    cur.forEach((cells, i) => {
      const next = cells.map(c => step(c, 1));
      const free = next.every(c => {
        const o = occ.get(key(c[0], c[1]));
        return pos(c) <= N - 1 && (o === undefined || o === i);
      });
      if (!free) return;
      cells.forEach(([r, c]) => occ.delete(key(r, c)));
      next.forEach(([r, c]) => occ.set(key(r, c), i));
      cur[i] = next;
      again = moved = true;
    });
  }
  if (moved) cur.forEach((cells, i) => { moves[i] = cells; });
  return moved;
}

// doShiftAll step 3, once everything is packed against the edge: only the pieces
// touching the edge wrap. Each drops in from the far side until it sits snug
// against the tiles already in its own rows or columns; everything else stays
// put. Fills `moves`; false if a piece won't fit.
function dropEdgePieces(lines, pos, step, horiz, moves) {
  const N = 6;
  const lane = ([r, c]) => horiz ? r : c;      // the row/column a tile travels along
  const wraps = lines.map(ls => Math.max(...ls) === N - 1);
  const stay = {};                             // lane -> nearest far-side tile that stays
  const settle = (floor, cells) => cells.forEach(cell => {
    const l = lane(cell);
    floor[l] = Math.min(floor[l] === undefined ? Infinity : floor[l], pos(cell));
  });
  state.pieces.forEach((p, i) => {
    if (wraps[i]) return;
    settle(stay, p.cells);
    moves[i] = p.cells.map(c => c.slice());
  });
  const ends = Object.values(stay);
  if (!ends.length) return false;
  const farEnd = Math.min(...ends);            // for lanes with nothing else in them

  // Pieces land one at a time, so order matters: a tall piece placed first can
  // take the spot a short one needed. Try pieces nearest the edge first, then
  // deepest-reaching first, then any other order, and use the first that fits.
  const wrapping = state.pieces.map((p, i) => i).filter(i => wraps[i]);
  const reach = i => Math.min(...lines[i]);
  const tryOrder = order => {
    const floor = Object.assign({}, stay), placed = {};
    for (const i of order) {
      const cells = state.pieces[i].cells;
      const d = Math.max(...cells.map(cell => {
        const f = floor[lane(cell)];
        return pos(cell) - (f === undefined ? farEnd : f) + 1;
      }));
      const moved = cells.map(c => step(c, -d));
      if (moved.some(c => pos(c) < 0)) return null;
      placed[i] = moved;
      settle(floor, moved);
    }
    return placed;
  };
  const orders = [wrapping.slice().sort((a, b) => reach(b) - reach(a)),
                  wrapping.slice().sort((a, b) => reach(a) - reach(b))];
  const perms = arr => arr.length <= 1 ? [arr] :
    arr.flatMap((x, k) => perms(arr.filter((_, j) => j !== k)).map(rest => [x, ...rest]));
  if (wrapping.length <= 6) orders.push(...perms(wrapping));
  for (const order of orders) {
    const placed = tryOrder(order);
    if (placed) { Object.assign(moves, placed); return true; }
  }
  return false;
}

// Internal only (no UI): kept so tooling/tests can view the packed 4×4 window.
function setMode(mode) {
  if (state.busy || mode === state.mode) return;
  if (mode === 'strict') {
    const off = 1;
    const outside = state.pieces.some(p =>
      p.cells.some(([r, c]) => r < off || c < off || r >= off + 4 || c >= off + 4));
    if (outside) return;
    shiftAll(-1);
  } else {
    shiftAll(1);
  }
  state.mode = mode;
  setSelected(null); clearGhost(); clearHistory();
  metrics(); positionTiles();
}

window.addEventListener('resize', () => { metrics(); positionTiles(); clearBadges(); clearScribbles(); layoutDrawer(); });

// ------------------------------------------------------------------ the daily
// Danagram #1. PERMANENT once launched — it defines what "#47" means in every
// shared result forever. Soft launch as "Danagram Test" (see LABEL) from Oct 8 2026.
const EPOCH = '2026-10-08';
const LABEL = 'Danagram Test';   // shown in the header and share text; drop "Test" at full launch

const localMidnight = d =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
function epochMs() {
  const [y, m, d] = EPOCH.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}
// Local midnight only: no timezone math, no DST. The device's own date is the input.
function dayIndex() {
  return Math.max(0, Math.round((localMidnight(new Date()) - epochMs()) / 86400000));
}
function dailyIdx() { return Math.min(dayIndex(), PUZZLES.length - 1); }
function seasonOver() { return dayIndex() >= PUZZLES.length; }

// Today's puzzle, or yesterday's: the chevrons step one day back and return.
function shownDayIdx() { return dailyIdx() - (state.dayBack && dailyIdx() > 0 ? 1 : 0); }
function renderDaily() {
  const back = state.dayBack && dailyIdx() > 0;
  const day = new Date();
  if (back) day.setDate(day.getDate() - 1);
  const date = day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('dailyLine').innerHTML =
    (!back && dailyIdx() > 0
      ? '<button class="day-nav" id="dayPrev" aria-label="Play yesterday’s puzzle">‹</button>' : '') +
    `<b>Test #${shownDayIdx() + 1}</b> · ${date}` +
    (!back && seasonOver() ? ' · last one for now' : '') +
    (back ? '<button class="day-nav" id="dayNext" aria-label="Back to today’s puzzle">›</button>' : '');
}
document.getElementById('dailyLine').addEventListener('click', e => {
  const b = e.target.closest('.day-nav');
  if (!b || state.busy) return;
  state.dayBack = b.id === 'dayPrev';
  renderDaily();
  loadPuzzle(shownDayIdx());
});

function msToMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next - now;
}
function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` +
         `:${String(s % 60).padStart(2, '0')}`;
}
let countdownTimer = null;
function startCountdown() {
  stopCountdown();
  const el = document.getElementById('nextIn');
  if (!el) return;
  const tick = () => {
    if (seasonOver()) { el.textContent = 'That’s the last puzzle of the season — more soon.'; return; }
    el.textContent = 'Next Danagram in ' + fmtCountdown(msToMidnight());
  };
  tick();
  el.classList.add('show');
  countdownTimer = setInterval(tick, 1000);
}
function stopCountdown() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  const el = document.getElementById('nextIn');
  if (el) el.classList.remove('show');
}

// ------------------------------------------------------------- how to play
const HELP_SEEN = 'danagram_help_seen';
function showHelp() {
  document.getElementById('helpOverlay').classList.add('show');
  document.getElementById('helpPage1').classList.add('active');
  document.getElementById('helpPage2').classList.remove('active');
}
function hideHelp() {
  document.getElementById('helpOverlay').classList.remove('show');
  store.set(HELP_SEEN, 1);
}
document.getElementById('helpBtn').addEventListener('click', showHelp);
document.getElementById('closeHelp').addEventListener('click', hideHelp);
document.getElementById('closeHelp2').addEventListener('click', hideHelp);
document.getElementById('helpClose').addEventListener('click', hideHelp);
document.getElementById('toTipsBtn').addEventListener('click', () => {
  document.getElementById('helpPage1').classList.remove('active');
  document.getElementById('helpPage2').classList.add('active');
});
document.getElementById('toPage1Btn').addEventListener('click', () => {
  document.getElementById('helpPage2').classList.remove('active');
  document.getElementById('helpPage1').classList.add('active');
});
document.getElementById('helpOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'helpOverlay') hideHelp();
});

// --------------------------------------------------------------------- init
// ?dev=1 keeps the puzzle nav visible for playtesting the whole bank
const DEV = typeof location !== 'undefined' && /[?&]dev=1/.test(location.search || '');
if (!DEV) {
  const nav = document.querySelector('.nav');
  if (nav) nav.style.display = 'none';
}
renderDaily();
loadPuzzle(DEV ? 0 : dailyIdx());
if (!store.get(HELP_SEEN)) showHelp();
