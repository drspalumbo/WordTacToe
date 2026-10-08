/**
 * Danagram anonymous play stats → this Google Sheet.
 *
 * Setup (once): in the Sheet, Extensions → Apps Script, paste this whole file,
 * Save, then Deploy → New deployment → Web app, Execute as: Me, Who has access:
 * Anyone. Copy the Web app URL (ends in /exec) into STATS_URL in game.js.
 *
 * The game sends two events per puzzle per device, each at most once:
 *   start  — first move on a puzzle
 *   finish — first real solve, with time, moves, words, crossings, Grid Checks
 * No IDs, cookies or personal data: only the fields in COLS below. Anything
 * malformed is dropped, and text fields are restricted to safe characters so a
 * junk request can't inject a formula into the sheet.
 */
const SHEET = 'events';
const COLS = ['received', 'event', 'test', 'puzzle', 'day', 'yesterday', 'seconds',
              'moves', 'shuffles', 'words', 'crossings', 'grid_checks', 'home_screen_app',
              'dark_mode', 'version'];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.event !== 'start' && d.event !== 'finish') return reply('ignored');
    const num = (x, max) =>
      (typeof x === 'number' && isFinite(x) && x >= 0 && x <= max) ? Math.round(x) : '';
    const text = (x, re, len) =>
      (typeof x === 'string' && re.test(x)) ? x.slice(0, len) : '';
    const row = [
      new Date(),
      d.event,
      num(d.test, 100000),
      text(d.puzzle, /^[0-9a-f]+$/, 12),
      text(d.day, /^\d{4}-\d{2}-\d{2}$/, 10),
      d.yesterday === true,
      d.event === 'finish' ? num(d.seconds, 86400 * 7) : '',
      num(d.moves, 100000),
      num(d.shuffles, 100000),
      num(d.words, 10000),
      num(d.crossings, 10000),
      num(d.grid_checks, 1000),
      d.app === true,
      d.dark === true,
      text(d.version, /^[\w.]+$/, 12),
    ];
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sh = ss.getSheetByName(SHEET);
      if (!sh) {
        sh = ss.insertSheet(SHEET);
        sh.appendRow(COLS);
        sh.setFrozenRows(1);
      }
      sh.appendRow(row);
    } finally {
      lock.releaseLock();
    }
    return reply('ok');
  } catch (err) {
    return reply('error');
  }
}

// Opening the Web app URL in a browser shows this, to confirm the deployment works.
function doGet() {
  return reply('Danagram stats endpoint is up.');
}

function reply(s) {
  return ContentService.createTextOutput(s);
}
