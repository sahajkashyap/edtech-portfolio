/**
 * Sorting: a document dropped into Arrivals goes to the right folder by what it says.
 *
 *   1. Someone drops a scan or a document into Arrivals, inside the big folder.
 *   2. Once sorting is turned on, the Sheet looks in Arrivals every 5 minutes.
 *   3. Google reads the words in each document (scans and photos too).
 *   4. The Rules tab is checked from the top: the first row whose words are in
 *      the document decides its folder. A row with "Then by name" ticked puts it in
 *      the named person's folder inside that folder (Live Scan > Marsh, Ada).
 *   5. If no row matches, a name from the Names tab decides (when that box is
 *      ticked): exactly one person named, and it goes to that person's folder.
 *   6. Anything else goes to "Unsorted - needs a person". It never guesses.
 *   7. The document is moved, whole, and a line is added to the Sorting log tab.
 *
 * Only what is dropped into Arrivals is ever moved. Nothing is renamed or deleted.
 */

const SORT = {
  rulesTab: 'Rules',
  logTab: 'Sorting log',
  arrivals: 'Arrivals',
  unsorted: 'Unsorted - needs a person',
  statusCell: 'B2',
  byNamesCell: 'B3',
  arrivalsCell: 'B4',
  firstRuleRow: 7,              // A = the words, B = where to look, C = the folder, D = then by name
  topLines: 5,                  // "Top of the page" = the first five lines with words on them
  everyMinutes: 5,
  secondsPerRun: 270,           // Google stops a run at 6 minutes; stop well before
  reading: '(reading) ',        // Google's reading copy of a scan; deleted straight away
};
const TOP_ = 'Top of the page', ANYWHERE_ = 'Anywhere';

function sortingMenu_() {
  SpreadsheetApp.getUi().createMenu('Sorting')
    .addItem('Set up sorting (Rules tab and Arrivals)', 'setUpSorting')
    .addItem('Sort Arrivals now', 'sortNow')
    .addSeparator()
    .addItem('Turn on sorting (every 5 minutes)', 'turnOnSorting')
    .addItem('Turn off sorting', 'turnOffSorting')
    .addToUi();
}

// ---- reading the rules and the names (no Google calls; checked on the Mac) ----

/** Lowercase words and numbers, accents and punctuation left out. */
const words_ = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** True when the words of `phrase` appear together, in order, in `w`. */
function hasPhrase_(w, phrase) {
  const p = words_(phrase);
  if (!p.length) return false;
  for (let i = 0; i + p.length <= w.length; i++) {
    let k = 0;
    while (k < p.length && w[i + k] === p[k]) k++;
    if (k === p.length) return true;
  }
  return false;
}

/** The first `n` lines that have words on them. */
const topText_ = (text, n) => String(text || '').split(/\r?\n/).filter(l => words_(l).length).slice(0, n).join('\n');

/** A ticked box, or yes / y / x typed in the cell. */
const ticked_ = v => v === true || /^(yes|y|x|true)$/i.test(tidy_(v));

/** Rows of [words, where to look, folder, then by name] -> {rules, problems}. Blank rows left out. */
function readRules_(values, firstRow) {
  const rules = [], problems = [];
  // A rule pasted into one cell (the cell was open for typing) arrives as one text with tabs
  // between the columns, as the Names tab's lists do: split it back into its columns.
  const rows = [];
  values.forEach((v, i) => {
    const a = String(v[0] == null ? '' : v[0]);
    if (/[\t\n]/.test(a)) a.split(/\r?\n/).forEach(l => {
      const parts = l.split('\t');                    // a column left out of the paste keeps the cell's own value
      rows.push({ v: [0, 1, 2, 3].map(k => parts[k] != null && tidy_(parts[k]) !== '' ? parts[k] : k ? v[k] : ''), i });
    });
    else rows.push({ v, i });
  });
  rows.forEach(({ v, i }) => {
    const phrase = tidy_(v[0]), where = tidy_(v[1]), folder = tidy_(v[2]), row = firstRow + i;
    if (!phrase && !folder) return;
    if (!words_(phrase).length) return problems.push('Rules row ' + row + ': no words to look for in column A');
    if (!folder) return problems.push('Rules row ' + row + ': no folder in column C');
    rules.push({ row, phrase, folder, top: where.toLowerCase() !== ANYWHERE_.toLowerCase(), byName: ticked_(v[3]) });
  });
  return { rules, problems };
}

/** People from the Names tab rows (readRows_), with the words that name them. */
function peopleFrom_(rows) {
  return rows.map(r => {
    let first = words_(r.name), last = words_(r.last);
    if (!last.length && r.name.indexOf(',') >= 0) {           // "Last, First" in one column
      last = words_(r.name.split(',')[0]);
      first = words_(r.name.split(',').slice(1).join(' '));
    }
    return { folder: r.folder, group: r.group, first, last };
  }).filter(p => p.first.length || p.last.length);
}

/**
 * The people named in the words. With a last name, the full name must be there,
 * either way round ("Ada Marsh" or "Marsh, Ada"); a first name alone is too common
 * to decide. A one-word name on the list must appear as that word.
 */
function whoIsNamed_(w, people) {
  return people.filter(p => {
    if (!p.first.length || !p.last.length) return hasPhrase_(w, p.first.concat(p.last).join(' '));
    return hasPhrase_(w, p.first.concat(p.last).join(' ')) || hasPhrase_(w, p.last.concat(p.first).join(' '));
  });
}

/**
 * Where one document goes. text = the words Google read; fileName counts as part of
 * the document, so a file called "Invoice 0412.pdf" matches an Invoice rule.
 * Returns {rule} or {person} with `how`, or {why} for Unsorted.
 */
function decide_(text, fileName, rules, people, byNames) {
  const name = String(fileName || '').replace(/\.[a-z0-9]{2,5}$/i, '');
  if (!words_(text).length && !words_(name).length) return { why: 'no words could be read' };
  const all = words_(text), top = words_(topText_(text, SORT.topLines)), fn = words_(name);
  const named = () => whoIsNamed_(all.concat(['|'], fn), people);
  const several = list => 'more than one name: ' + list.slice(0, 3).map(p => p.folder).join(', ') + (list.length > 3 ? ', ...' : '');
  for (const r of rules) {
    if (!hasPhrase_(r.top ? top : all, r.phrase) && !hasPhrase_(fn, r.phrase)) continue;
    const how = 'Rules row ' + r.row + ': "' + r.phrase + '"';
    if (!r.byName) return { rule: r, how };
    const who = named();                       // "Then by name": one person, or a person decides
    if (who.length === 1) return { rule: r, person: who[0], how: how + ', then the name' };
    return { why: how + ', but ' + (who.length ? several(who) : 'no name from the Names tab') };
  }
  if (!byNames) return { why: 'no rule matched' };
  const who = named();
  if (who.length === 1) return { person: who[0], how: 'name on the Names tab' };
  if (who.length > 1) return { why: several(who) };
  return { why: words_(text).length ? 'no rule or name matched' : 'no words could be read, and the file name matched nothing' };
}

// ---- the Rules and log tabs ----

function rulesSheet_() { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SORT.rulesTab); }

function layOutRules_(sh) {
  sh.getRange('A1').setValue('Sorting rules').setFontSize(16).setFontWeight('bold');
  sh.getRange('A2:A4').setValues([['Sorting is'], ['Also sort by the names on the Names tab'], ['Drop documents here']]).setFontWeight('bold');
  sh.getRange(SORT.statusCell).setValue('OFF');
  sh.getRange(SORT.byNamesCell).insertCheckboxes().setValue(true);
  sh.getRange('A5').setValue('Rows are checked from the top: the first row whose words are in the document decides. ' +
    'If no row matches, a full name from the Names tab decides. Anything else goes to "' + SORT.unsorted + '".')
    .setFontColor('#666666');
  sh.getRange(SORT.firstRuleRow - 1, 1, 1, 4).setValues([['If the document says (for example: Permission slip)',
    'Look at', 'Put it in this folder (inside the big folder)', 'Then by name (a folder per person inside it)']])
    .setFontWeight('bold').setBackground('#d9ead3');
  sh.getRange(SORT.firstRuleRow, 4, 200, 1).insertCheckboxes();
  sh.getRange(SORT.firstRuleRow, 2, 200, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList([TOP_, ANYWHERE_], true).setHelpText('Empty means ' + TOP_ + '.').build());
  sh.getRange(SORT.firstRuleRow, 1, 200, 1).setBackground('#fff2cc');
  sh.getRange(SORT.firstRuleRow, 3, 200, 1).setBackground('#fff2cc');
  sh.setFrozenRows(SORT.firstRuleRow - 1);
  sh.setColumnWidth(1, 380); sh.setColumnWidth(2, 150); sh.setColumnWidth(3, 340); sh.setColumnWidth(4, 300);
}

function logSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SORT.logTab);
  if (!sh) {
    sh = ss.insertSheet(SORT.logTab);
    sh.getRange(1, 1, 1, 4).setValues([['When', 'Document', 'Put in', 'Why']]).setFontWeight('bold').setBackground('#d9ead3');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 160); sh.setColumnWidth(2, 300); sh.setColumnWidth(3, 260); sh.setColumnWidth(4, 360);
  }
  return sh;
}

function setStatus_(text) {
  const sh = rulesSheet_();
  if (sh) sh.getRange(SORT.statusCell).setValue(text);
}

// ---- Drive ----

/** The big folder made by Make the folders (its link is on the Names tab). */
function bigFolder_() {
  const id = folderId_(namesSheet_().getRange(LAYOUT.linkCell).getValue());
  if (!id) throw new Error('First make the folders (Folders > Make the folders). Sorting uses the big folder they go in.');
  return DriveApp.getFolderById(id);
}

/** The words in a file, or null when it is not a kind Google can read. */
function readFile_(file, tempParentId) {
  const type = file.getMimeType();
  if (type === MimeType.GOOGLE_DOCS) return DocumentApp.openById(file.getId()).getBody().getText();
  if (type === MimeType.PLAIN_TEXT) return file.getBlob().getDataAsString();
  const scan = /^image\/(jpeg|png|gif|bmp|webp)$/.test(type) || type === MimeType.PDF;
  const word = type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || type === 'application/msword';
  if (!scan && !word) return null;
  const made = Drive.Files.create({ name: SORT.reading + file.getName(), mimeType: MimeType.GOOGLE_DOCS, parents: [tempParentId] },
    file.getBlob(), scan ? { ocrLanguage: 'en', fields: 'id' } : { fields: 'id' });
  try {
    for (let k = 0; k < 3; k++) {
      try { return DocumentApp.openById(made.id).getBody().getText(); } catch (e) { Utilities.sleep(1500); }
    }
    return '';
  } finally {
    try { Drive.Files.remove(made.id); } catch (e) { try { DriveApp.getFileById(made.id).setTrashed(true); } catch (e2) { /* left for a person */ } }
  }
}

/** The person's folder, where Make the folders put it (inside their group, if any). */
function personFolder_(big, p) {
  const where = p.group ? folderIn_(big, p.group).folder : big;
  return folderIn_(where, p.folder).folder;
}

/** Sorts what is in Arrivals until it is empty or time runs short. Returns {moved, unsorted, left}. */
function sortArrivals_(began) {
  const out = { moved: 0, unsorted: 0, left: 0, problems: [] };
  const big = bigFolder_();
  const arrivals = folderIn_(big, SORT.arrivals).folder;
  const files = [], it = arrivals.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (!f.isTrashed() && f.getName().indexOf(SORT.reading) !== 0) files.push(f);
  }
  if (!files.length) return out;

  const rs = rulesSheet_();
  const ruleValues = rs ? rs.getRange(SORT.firstRuleRow, 1, Math.max(rs.getLastRow() - SORT.firstRuleRow + 1, 1), 4).getValues() : [];
  const { rules, problems } = readRules_(ruleValues, SORT.firstRuleRow);
  out.problems = problems;
  const byNames = rs ? rs.getRange(SORT.byNamesCell).getValue() === true : true;
  const ns = namesSheet_(), last = ns.getLastRow();
  const people = (byNames || rules.some(r => r.byName)) && last >= LAYOUT.firstRow ?
    peopleFrom_(readRows_(ns.getRange(LAYOUT.firstRow, 1, last - LAYOUT.firstRow + 1, 3).getValues(), LAYOUT.firstRow)) : [];
  const log = logSheet_(), tried = PropertiesService.getScriptProperties();

  files.sort((a, b) => a.getName() < b.getName() ? -1 : 1);
  for (const f of files) {
    if (tried.getProperty('could not move ' + f.getId())) continue;     // logged once; a person moves it
    if (Date.now() - began > SORT.secondsPerRun * 1000) { out.left++; continue; }
    let d, text = null;
    try { text = readFile_(f, arrivals.getId()); } catch (e) { d = { why: 'Google could not read it: ' + e.message }; }
    if (!d) d = text === null ? { why: 'not a kind of file Google can read (' + f.getMimeType() + ')' } :
      decide_(text, f.getName(), rules, people, byNames);
    if (problems.length && d.why) d.why += ' (the Rules tab has a row to fix: ' + problems[0] + ')';
    const dest = d.rule && d.person ? folderIn_(folderIn_(big, d.rule.folder).folder, d.person.folder).folder :
      d.rule ? folderIn_(big, d.rule.folder).folder : d.person ? personFolder_(big, d.person) : folderIn_(big, SORT.unsorted).folder;
    try {
      f.moveTo(dest);
      d.why ? out.unsorted++ : out.moved++;
      log.appendRow([new Date(), f.getName(), dest.getName(), d.how || d.why]);
    } catch (e) {
      tried.setProperty('could not move ' + f.getId(), '1');
      log.appendRow([new Date(), f.getName(), '(left in Arrivals)', 'could not move it: ' + e.message +
        '. Only the file\'s owner may be able to move it.']);
    }
  }
  return out;
}

// ---- the menu items and the timer ----

function setUpSorting() {
  const ui = SpreadsheetApp.getUi();
  let big;
  try { big = bigFolder_(); } catch (e) { return ui.alert(e.message); }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = rulesSheet_();
  if (!sh) { sh = ss.insertSheet(SORT.rulesTab); layOutRules_(sh); }
  else if (!sh.getRange(SORT.firstRuleRow - 1, 4).getValue()) {     // a Rules tab from before "Then by name"
    sh.getRange(SORT.firstRuleRow - 1, 4).setValue('Then by name (a folder per person inside it)').setFontWeight('bold').setBackground('#d9ead3');
    sh.getRange(SORT.firstRuleRow, 4, 200, 1).insertCheckboxes();
    sh.setColumnWidth(4, 300);
  }
  logSheet_();
  const arrivals = folderIn_(big, SORT.arrivals).folder;
  folderIn_(big, SORT.unsorted);
  sh.getRange(SORT.arrivalsCell).setValue(arrivals.getUrl());
  ss.setActiveSheet(sh);
  ui.alert('Sorting is set up. "' + SORT.arrivals + '" and "' + SORT.unsorted + '" are in "' + big.getName() + '".\n\n' +
    'Type your rules from row ' + SORT.firstRuleRow + ', drop a document into Arrivals, then choose Sorting > Sort Arrivals now. ' +
    'When it works the way you want, choose Sorting > Turn on sorting.');
}

function report_(n) {
  return count_(n.moved, 'document', 'documents') + ' sorted, ' + n.unsorted + ' to Unsorted' +
    (n.left ? ', ' + n.left + ' still waiting (Google allows a few minutes a run; the rest go next time)' : '') + '.' +
    (n.problems.length ? '\n\nA rule was left out, because its row is not finished:\n' + n.problems.join('\n') : '');
}

function sortNow() {
  const ui = SpreadsheetApp.getUi(), lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return ui.alert('Sorting is already running. Try again in a few minutes.');
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('Google reads each document, so this takes a few seconds each.', 'Sorting…', 60);
    const n = sortArrivals_(Date.now());
    ui.alert(n.moved + n.unsorted + n.left ? report_(n) + ' Each one is on the Sorting log tab.' : 'Arrivals is empty. Nothing to sort.');
  } catch (e) {
    ui.alert(e.message);
  } finally {
    lock.releaseLock();
  }
}

/** The timer runs this. */
function sortOnTimer() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(500)) return;
  try {
    const n = sortArrivals_(Date.now());
    if (n.moved + n.unsorted + n.left) setStatus_('ON: last sorted ' + new Date().toLocaleString() + '. ' + report_(n));
  } catch (e) {
    setStatus_('ON, but there is a problem: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}

function turnOnSorting() {
  const ui = SpreadsheetApp.getUi();
  try { bigFolder_(); } catch (e) { return ui.alert(e.message); }
  if (!rulesSheet_()) return ui.alert('First choose Sorting > Set up sorting.');
  stopTimer_();
  ScriptApp.newTrigger('sortOnTimer').timeBased().everyMinutes(SORT.everyMinutes).create();
  setStatus_('ON: checks Arrivals every ' + SORT.everyMinutes + ' minutes');
  ui.alert('Sorting is on. Arrivals is checked every ' + SORT.everyMinutes + ' minutes, day and night, until you choose Sorting > Turn off sorting.');
}

function turnOffSorting() {
  stopTimer_();
  setStatus_('OFF');
  SpreadsheetApp.getUi().alert('Sorting is off. Documents dropped into Arrivals now stay there until you sort them or turn it on again.');
}

function stopTimer_() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'sortOnTimer') ScriptApp.deleteTrigger(t); });
}
