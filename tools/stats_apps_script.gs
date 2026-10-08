/**
 * Danagram anonymous play stats → this Google Sheet, one row per play.
 *
 * Setup: in the Sheet, Extensions → Apps Script, paste this whole file over the
 * old one, Save, then Deploy → Manage deployments → (pencil) Edit → Version:
 * New version → Deploy. Editing the existing deployment keeps the same URL.
 *
 * Each time someone plays a puzzle, their browser makes up a random play id
 * (fresh for every puzzle, so plays can't be linked to each other or a person).
 * The row for that id is created on the first move and updated whenever the
 * player leaves the page, switches puzzle, or finishes, so a give-up still
 * shows how far it got. No accounts, cookies or personal data: only COLS.
 * Anything malformed is dropped, and text is limited to safe characters so a
 * junk request can't inject a formula into the sheet.
 */
const SHEET = 'plays';
const COLS = ['play', 'started', 'updated', 'status', 'test', 'puzzle', 'day', 'yesterday',
              'seconds', 'moves', 'shuffles', 'words', 'crossings', 'grid_checks',
              'home_screen_app', 'dark_mode', 'version', 'updates'];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const play = (typeof d.play === 'string' && /^[0-9a-f]{8,32}$/.test(d.play)) ? d.play : '';
    if (!play || (d.status !== 'playing' && d.status !== 'finished')) return reply('ignored');
    const num = (x, max) =>
      (typeof x === 'number' && isFinite(x) && x >= 0 && x <= max) ? Math.round(x) : '';
    const text = (x, re, len) =>
      (typeof x === 'string' && re.test(x)) ? x.slice(0, len) : '';
    const now = new Date();
    // everything after 'updated', in COLS order (status .. version)
    const fields = [
      d.status,
      num(d.test, 100000),
      text(d.puzzle, /^[0-9a-f]+$/, 12),
      text(d.day, /^\d{4}-\d{2}-\d{2}$/, 10),
      d.yesterday === true,
      num(d.seconds, 86400 * 7),
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
    lock.waitLock(10000);
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sh = ss.getSheetByName(SHEET);
      if (!sh) {
        sh = ss.insertSheet(SHEET);
        sh.appendRow(COLS);
        sh.setFrozenRows(1);
      }
      const hit = sh.getRange('A:A').createTextFinder(play).matchEntireCell(true).findNext();
      if (!hit) {
        sh.appendRow([play, now, now].concat(fields, [1]));
      } else {
        const row = hit.getRow();
        const status = sh.getRange(row, 4).getValue();
        if (status === 'finished' && d.status !== 'finished') return reply('kept');  // never un-finish
        sh.getRange(row, 3, 1, 1 + fields.length).setValues([[now].concat(fields)]);
        const updates = sh.getRange(row, COLS.length);
        updates.setValue((Number(updates.getValue()) || 0) + 1);
      }
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
  return reply('Danagram stats endpoint is up (one row per play).');
}

function reply(s) {
  return ContentService.createTextOutput(s);
}
