/**
 * Make folders from a list of names.
 *
 * A Google Sheet for anyone, on any computer: paste a list of
 * names, choose Folders > Make the folders, and a folder for each name
 * appears in Google Drive.
 *
 * Making folders never renames, moves or deletes anything, and running it
 * again makes only the folders that are still missing. Sorting (Sorter.js) is
 * optional: it moves only what is dropped into Arrivals.
 */

const LAYOUT = {
  bigFolderCell: 'B3',          // the name of the folder that holds them all
  insideCell: 'B4',             // optional: a folder link; empty = My Drive
  linkCell: 'B5',               // where the link to the finished folder goes
  firstRow: 8,                  // names start here: A = name, B = last name, C = group
};
const TIME_LIMIT_MS = 4.5 * 60 * 1000;   // Google stops a script at 6 minutes
const HEADER_WORDS = ['name', 'names', 'first', 'first name', 'last', 'last name', 'student',
  'student name', 'child', 'child name', 'full name', 'class', 'grade', 'group'];

function onOpen() {
  if (!namesSheet_().getRange('A1').getValue()) setUpThisSheet();   // a brand-new copy lays itself out
  SpreadsheetApp.getUi().createMenu('Folders')
    .addItem('Make the folders', 'makeTheFolders')
    .addSeparator()
    .addItem('Clear everything (to start a new list)', 'clearTheNames')
    .addToUi();
  if (typeof sortingMenu_ === 'function') sortingMenu_();         // Sorter.js, when it is in the project
}

/** The tab with the list. Other tabs (Rules, Sorting log) never take its place. */
function namesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName('Names') || ss.getActiveSheet();
}

// ---- reading and checking the list (no Google calls; checked on the Mac) ----

const tidy_ = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

/** "1. Name", "1) Name", "• Name" (lists copied from Word or Docs) -> "Name". */
const noBullet_ = s => s.replace(/^(\d{1,3}[.)]|[\u2022\u00b7\u25e6\u25aa\u2013*-])\s*/, '');

/** Rows of [name, last name, group] -> [{row, folder, group}]; blank rows left out. */
function readRows_(values, firstRow) {
  const out = [];
  values.forEach((v, i) => {
    // A whole list pasted into one cell (the cell was open for typing): split it back
    // into lines, and each line into columns at its tabs.
    const lines = /[\n\t]/.test(String(v[0] == null ? '' : v[0])) ? String(v[0]).split(/\r?\n/).map(l => l.split('\t')) : [v];
    lines.forEach(l => {
      const name = noBullet_(tidy_(l[0])), last = tidy_(l[1]), group = tidy_(l[2]);
      if (!name && !last && !group) return;
      out.push({ row: firstRow + i, name, last, group, folder: last && name ? last + ', ' + name : name || last });
    });
  });
  return out;
}

/** What must be fixed first (problems) and what to look at (warnings). */
function checkRows_(rows) {
  const problems = [], warnings = [], seen = {};
  rows.forEach(r => {
    if (!r.name) warnings.push('Row ' + r.row + ': no name in column A');
    if (HEADER_WORDS.indexOf(r.folder.toLowerCase()) >= 0 || HEADER_WORDS.indexOf(r.name.toLowerCase()) >= 0)
      problems.push('Row ' + r.row + ': "' + r.folder + '" looks like a column heading, not a name. Delete that row.');
    else if (r.name && !r.last && r.name.indexOf(' ') < 0 && r.name.indexOf(',') < 0)
      warnings.push('Row ' + r.row + ': one word only ("' + r.folder + '")');
    const key = (r.group + '|' + r.folder).toLowerCase();
    (seen[key] = seen[key] || []).push(r.row);
  });
  Object.keys(seen).forEach(k => {
    if (seen[k].length > 1) problems.push('Rows ' + seen[k].join(', ') + ': the same name more than once. ' +
      'Delete the extra row, or add a middle initial so each folder has its own name.');
  });
  const groups = rows.map(r => r.group).filter((g, i, a) => g && a.indexOf(g) === i);
  return { problems, warnings, names: rows.length, groups };
}

/** A Drive folder link (or a bare ID) -> the folder's ID. */
function folderId_(text) {
  const s = tidy_(text);
  const m = s.match(/folders\/([\w-]+)/) || s.match(/[?&]id=([\w-]+)/);
  return m ? m[1] : (/^[\w-]{10,}$/.test(s) ? s : '');
}

// ---- making folders ----

/** Folders inside `parent` by name, leaving out anything in the trash. */
function foldersByName_(parent) {
  const map = {}, it = parent.getFolders();
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) map[f.getName()] = map[f.getName()] || f; }
  return map;
}

function folderIn_(parent, name, known) {
  if (known && known[name]) return { folder: known[name], made: false };
  const it = parent.getFoldersByName(name);
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) return { folder: f, made: false }; }
  const f = parent.createFolder(name);
  if (known) known[name] = f;
  return { folder: f, made: true };
}

/** Makes what is missing. Stops early (finished: false) when time runs short. */
function makeTree_(parent, bigName, rows, now) {
  const start = now(), n = { bigMade: false, made: 0, there: 0, groupsMade: 0, finished: true };
  const big = folderIn_(parent, bigName);
  n.bigMade = big.made; n.big = big.folder;
  const inBig = foldersByName_(big.folder), inGroup = {};
  for (const r of rows) {
    if (now() - start > TIME_LIMIT_MS) { n.finished = false; break; }
    let where = big.folder, known = inBig;
    if (r.group) {
      const g = folderIn_(big.folder, r.group, inBig);
      if (g.made) n.groupsMade++;
      where = g.folder;
      known = inGroup[r.group] = inGroup[r.group] || (g.made ? {} : foldersByName_(g.folder));
    }
    if (folderIn_(where, r.folder, known).made) n.made++; else n.there++;
  }
  return n;
}

const count_ = (k, one, many) => k + ' ' + (k === 1 ? one : many);

function summary_(n, bigName) {
  if (!n.finished) return 'Google only lets a sheet run for a few minutes, so it stopped part way. ' +
    count_(n.made, 'folder', 'folders') + ' made so far.\n\nChoose Folders > Make the folders again to finish. ' +
    'It skips the folders already made.';
  return 'Done. ' + (n.bigMade ? '"' + bigName + '" was made. ' : '') +
    count_(n.made, 'name folder', 'name folders') + ' made' +
    (n.groupsMade ? ', in ' + count_(n.groupsMade, 'new group folder', 'new group folders') : '') + '.' +
    (n.there ? ' ' + n.there + (n.there === 1 ? ' was' : ' were') + ' already there and left as is.' : '') +
    '\n\nNothing was renamed, moved or deleted. The link to the folder is in ' + LAYOUT.linkCell + '.';
}

// ---- the menu items ----

function makeTheFolders() {
  const ui = SpreadsheetApp.getUi(), sh = namesSheet_();
  const bigName = tidy_(sh.getRange(LAYOUT.bigFolderCell).getValue());
  if (!bigName) return ui.alert('First type a name for the big folder in ' + LAYOUT.bigFolderCell +
    ', for example "Emergency forms 2026-27".');
  const last = sh.getLastRow();
  if (last < LAYOUT.firstRow) return ui.alert('Paste the names into column A, starting in row ' + LAYOUT.firstRow + '.');
  const rows = readRows_(sh.getRange(LAYOUT.firstRow, 1, last - LAYOUT.firstRow + 1, 3).getValues(), LAYOUT.firstRow);
  if (!rows.length) return ui.alert('Paste the names into column A, starting in row ' + LAYOUT.firstRow + '.');

  const c = checkRows_(rows);
  if (c.problems.length) return ui.alert('Please fix these first. Nothing was made.\n\n' + c.problems.slice(0, 15).join('\n') +
    (c.problems.length > 15 ? '\n...and ' + (c.problems.length - 15) + ' more' : ''));

  let parent;
  const id = folderId_(sh.getRange(LAYOUT.insideCell).getValue());
  if (tidy_(sh.getRange(LAYOUT.insideCell).getValue()) && !id)
    return ui.alert('The link in ' + LAYOUT.insideCell + ' is not a folder link. Paste a folder link there, or leave it empty for My Drive.');
  try { parent = id ? DriveApp.getFolderById(id) : DriveApp.getRootFolder(); } catch (e) {
    return ui.alert('That folder could not be opened. Check the link in ' + LAYOUT.insideCell + ', or leave it empty for My Drive.');
  }
  const where = id ? '"' + parent.getName() + '"' : 'your My Drive';
  const ask = 'Make ' + count_(c.names, 'folder', 'folders') + ' inside "' + bigName + '" in ' + where +
    (c.groups.length ? ', sorted into ' + count_(c.groups.length, 'group', 'groups') + ' (' + c.groups.slice(0, 5).join(', ') + (c.groups.length > 5 ? ', ...' : '') + ')' : '') +
    '?\n\nThe first folders will be called:\n' + rows.slice(0, 3).map(r => '   ' + r.folder).join('\n') +
    (c.warnings.length ? '\n\nTo look at (you can still go ahead):\n' + c.warnings.slice(0, 10).join('\n') : '');
  if (ui.alert('Check before making', ask, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  const n = makeTree_(parent, bigName, rows, () => Date.now());
  sh.getRange(LAYOUT.linkCell).setValue(n.big.getUrl());
  ui.alert(summary_(n, bigName));
}

function clearTheNames() {
  const ui = SpreadsheetApp.getUi(), sh = namesSheet_();
  if (ui.alert('Clear the big folder name and all the names, to start a new list? Folders already made stay as they are.',
    ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const last = Math.max(sh.getLastRow(), LAYOUT.firstRow);
  sh.getRange(LAYOUT.firstRow, 1, last - LAYOUT.firstRow + 1, 3).clearContent();
  sh.getRange(LAYOUT.bigFolderCell).clearContent();
  sh.getRange(LAYOUT.linkCell).clearContent();
}

/** Lays out the sheet (done by itself the first time an empty copy opens). */
function setUpThisSheet() {
  const sh = namesSheet_();
  sh.setName('Names');
  sh.getRange('A1').setValue('Make folders from a list of names').setFontSize(16).setFontWeight('bold');
  sh.getRange('A2').setValue('Fill in the yellow boxes, paste the names from row ' + LAYOUT.firstRow + ', then choose Folders > Make the folders.');
  sh.getRange('A3:A5').setValues([['Name for the big folder'], ['Put it inside (optional: a folder link)'], ['Your finished folder']]).setFontWeight('bold');
  sh.getRange('C3:C5').setValues([['for example: Emergency forms 2026-27'], ['leave empty to put it in My Drive'], ['the link appears here when it is done']]).setFontColor('#666666');
  sh.getRange('B3:B4').setBackground('#fff2cc');
  sh.getRange(LAYOUT.firstRow - 1, 1, 1, 3).setValues([['Name (or first name)', 'Last name (only if in its own column)', 'Class or group (optional)']])
    .setFontWeight('bold').setBackground('#d9ead3');
  sh.setFrozenRows(LAYOUT.firstRow - 1);
  sh.setColumnWidth(1, 280); sh.setColumnWidth(2, 260); sh.setColumnWidth(3, 260);
}
