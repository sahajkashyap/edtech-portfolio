#!/usr/bin/env node
//
// Math Assessment Tracker — regression tests.
//
// WHAT THIS IS
// ------------
// "Regression" means sliding backward. Every check in this file exists because
// something here was once actually broken. The point is not to prove the tool
// works today — it is so that a bug fixed in August cannot quietly come back in
// November without anybody noticing.
//
// Each check is named for what a PERSON would notice, not for the function
// involved. If you fix a new bug, add its check here the same day, while you
// still remember what went wrong.
//
// HOW TO RUN IT
// -------------
//     cd ~/Documents/GitHub/edtech-portfolio/math-assessment-tool/tests
//     npm test
//
// It opens a real Google Chrome in the background, serves the tool over a local
// http server (Chrome refuses localStorage on file:// URLs and half of what is
// checked here is what gets saved), drives it with real clicks and real
// keypresses, and prints a line per check. Nothing on the internet is needed:
// the one CDN script the tool uses is only exercised in the check that
// deliberately blocks it.
//
// node_modules here is a SYMLINK to running-record-tool/tests/node_modules —
// no npm install was run for this folder.
//
// WHAT YOU SHOULD SEE
// -------------------
// A list of green PASS lines and, at the end, "ALL n CHECKS PASSED".
// If anything fails you get a red FAIL line saying what was expected and what
// actually happened, and the script exits non-zero.
//
const puppeteer = require('puppeteer-core');
const http      = require('http');
const fs        = require('fs');
const path      = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT   = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Tiny local web server.
// ---------------------------------------------------------------------------
const TYPES = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
                '.json':'application/json', '.md':'text/markdown' };

function serve(){
  return new Promise(resolve => {
    // Chrome holds its connections open, and a plain srv.close() waits for
    // every one of them — which is how a suite that has printed ALL CHECKS
    // PASSED can still sit there forever instead of exiting.
    const sockets = new Set();
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      // Never serve outside the tool directory.
      if (!file.startsWith(ROOT)){ res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, buf) => {
        if (err){ res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'text/plain' });
        res.end(buf);
      });
    });
    srv.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
    srv.listen(0, '127.0.0.1', () => resolve({
      port: srv.address().port,
      stop: () => { sockets.forEach(s => s.destroy()); srv.close(); }
    }));
  });
}

// ---------------------------------------------------------------------------
// Test bookkeeping
// ---------------------------------------------------------------------------
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', DIM = '\x1b[2m', X = '\x1b[0m';
let passed = 0;
const failures = [];

function check(name, condition, detail){
  if (condition){ passed++; console.log(`${G}  PASS${X} ${name}`); }
  else {
    failures.push({ name, detail });
    console.log(`${R}  FAIL${X} ${name}`);
    if (detail) console.log(`${R}       ${detail}${X}`);
  }
}
function eq(name, actual, expected){
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(name, ok, ok ? '' : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function group(title){ console.log(`\n${Y}${title}${X}`); }

// ---------------------------------------------------------------------------
// Driving the page
// ---------------------------------------------------------------------------
// `load`, not `domcontentloaded`: a stylesheet still in flight when the first
// assertion runs lands in the console-error list a fraction of the time, and a
// test that is right nine times out of ten teaches you to ignore red.
async function fresh(page, base){
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

// The tool as a stranger would read it off the screen.
const state = page => page.evaluate(() => ({
  initials: document.getElementById('initials').value,
  date: document.getElementById('adate').value,
  unit: document.getElementById('unitSelect').value,
  strengths: document.getElementById('strengthsComment').value,
  stretches: document.getElementById('stretchesComment').value,
  e: +document.getElementById('count-e').textContent,
  d: +document.getElementById('count-d').textContent,
  m: +document.getElementById('count-m').textContent,
  scored: Object.values(scores).filter(Boolean).length,
  rows: document.querySelectorAll('.lesson').length,
  sampleText: document.getElementById('sampleText').textContent,
  sampleBtn: document.getElementById('sampleBtn').textContent.trim(),
  msg: document.getElementById('msg').textContent,
  warn: document.getElementById('storageWarn').textContent,
  warnShown: document.getElementById('storageWarn').classList.contains('show'),
  undoHidden: document.getElementById('undoClearBtn').hidden,
  confirms: window.__confirms.length,
  slices: document.querySelectorAll('#pieChart path, #pieChart circle[fill]:not([fill="none"])').length,
  legend: Array.from(document.querySelectorAll('#pieChart text')).map(t => t.textContent).join(' | '),
  saved: (() => { try { return JSON.parse(localStorage.getItem('math-assessment-tracker')); }
                  catch (e) { return null; } })()
}));

// Score the first lesson row at a level, the way a teacher does: a real click
// on the E, D or M button in the row.
async function clickScore(page, rowIndex, letter){
  const handle = await page.evaluateHandle((i, l) => {
    const row = document.querySelectorAll('.lesson')[i];
    return Array.from(row.querySelectorAll('.btn-score')).find(b => b.textContent === l);
  }, rowIndex, letter);
  await handle.asElement().click();
}

const lastDownload = page => page.evaluate(() => window.__downloads[window.__downloads.length - 1] || null);

async function main(){
  if (!fs.existsSync(CHROME)){
    console.error(`${R}Google Chrome was not found at:${X}\n  ${CHROME}\n` +
                  `Install Chrome, or edit the CHROME path at the top of this file.`);
    process.exit(2);
  }

  const { stop, port } = await serve();
  const base = `http://127.0.0.1:${port}`;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Anything that would open a window, block on a dialog or write to disk is
  // stubbed, so the handlers still run all the way through and can be read back.
  let pageErrors = [], consoleErrors = [];
  const requested = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('request', r => requested.push(r.url()));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // Chrome's message for a failed request is the same generic sentence
    // whatever the file was — the URL lives in location(), not in the text.
    const url = (m.location() && m.location().url) || '';
    if (/favicon/i.test(url)) return;
    consoleErrors.push(m.text() + (url ? '  [' + url + ']' : ''));
  });
  await page.evaluateOnNewDocument(() => {
    window.__printed = 0;
    window.print = () => { window.__printed++; };
    window.__confirms = [];
    window.__confirmAnswer = true;
    window.confirm = m => { window.__confirms.push(String(m)); return window.__confirmAnswer; };
    window.__alerts = [];
    window.alert = m => { window.__alerts.push(String(m)); };

    // Catch the exports instead of writing files: remember the text of the last
    // Blob made, and swallow the click on the download link.
    const RealBlob = window.Blob;
    window.__downloads = [];
    window.Blob = function(parts, opts){
      const b = new RealBlob(parts, opts);
      b.__text = (parts || []).map(String).join('');
      window.__lastBlob = b;
      return b;
    };
    window.Blob.prototype = RealBlob.prototype;
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function(){
      if (this.hasAttribute('download')){
        window.__downloads.push({ name: this.getAttribute('download'),
                                  text: window.__lastBlob ? window.__lastBlob.__text : '' });
        return;
      }
      return realClick.call(this);
    };
  });

  // =========================================================================
  group('Opening the tool');
  // =========================================================================
  await fresh(page, base);

  check('the page opens with no JavaScript errors',
        pageErrors.length === 0, pageErrors.join(' | '));
  check('the page opens with no console errors',
        consoleErrors.length === 0, consoleErrors.join(' | '));

  // data: URIs are Chrome drawing its own date-picker icon, not a trip out.
  const net = requested.filter(u => !u.startsWith(base) && !u.startsWith('data:'));
  check('the tool asks the internet for nothing except the PDF library',
        net.every(u => /cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf/.test(u)),
        net.join(' | '));

  // =========================================================================
  group('A stranger arrives and sees a student, clearly marked as made up');
  // =========================================================================
  const first = await state(page);
  check('the tool is already filled in when you arrive, not empty',
        first.scored > 20 && first.rows > 0, JSON.stringify({ scored: first.scored, rows: first.rows }));
  eq('the child on screen is the sample student\'s initials', first.initials, 'M.T.');
  check('the screen says out loud that this is a sample student called Maya Torres',
        /Sample student/i.test(first.sampleText) && /Maya Torres/.test(first.sampleText),
        first.sampleText);
  check('the screen says the sample scores are made up and not a real child',
        /made-up/i.test(first.sampleText) && /not a real child/i.test(first.sampleText),
        first.sampleText);
  check('the sample student is not perfect — she has some of every level',
        first.e > 0 && first.d > 0 && first.m > 0, JSON.stringify(first));
  const spread = await page.evaluate(() => {
    const all = Object.values(curriculum).reduce((a, l) => a.concat(l), []);
    return { total: all.length, unscored: all.filter(l => !scores[l]).length };
  });
  check('some lessons are left unassessed, the way a real half-term looks',
        spread.unscored > 0 && spread.unscored < spread.total, JSON.stringify(spread));
  check('both comment boxes are filled in for the sample student',
        first.strengths.length > 40 && first.stretches.length > 40,
        JSON.stringify({ s: first.strengths.length, t: first.stretches.length }));

  // =========================================================================
  group('Clearing the sample takes one click, and she does not come back');
  // =========================================================================
  await page.click('#sampleBtn');
  const cleared = await state(page);
  eq('one click on "Clear the sample" empties the tool',
     { scored: cleared.scored, initials: cleared.initials, strengths: cleared.strengths },
     { scored: 0, initials: '', strengths: '' });
  // Untouched, she is nobody's work: clearing her must not stop to ask, or the
  // question that DOES matter — below, once real work is on top of her — is one
  // a teacher has already been trained to click straight through.
  eq('clearing the untouched sample does not stop to ask, because nothing is lost',
     cleared.confirms, 0);
  eq('the counters go back to zero', [cleared.e, cleared.d, cleared.m], [0, 0, 0]);
  check('the button offers the sample again once she is gone',
        /Try it with a sample student/i.test(cleared.sampleBtn), cleared.sampleBtn);

  await page.reload({ waitUntil: 'load' });
  const afterReload = await state(page);
  eq('the sample student does not reappear after a refresh', afterReload.scored, 0);

  await page.click('#sampleBtn');
  const backAgain = await state(page);
  check('the sample student can be brought back with one click',
        backAgain.scored > 20 && backAgain.initials === 'M.T.', JSON.stringify(backAgain.scored));
  // This check used to be the ONLY one that ever pressed "Try it with a sample
  // student", and it pressed it on an empty tool — the one moment where that
  // button has nothing to destroy. The moment that mattered is its own group
  // further down.
  eq('bringing her back onto an empty tool does not stop to ask either',
     backAgain.confirms, 0);
  await page.click('#sampleBtn');

  // =========================================================================
  group('The chart');
  // =========================================================================
  const emptyChart = await page.evaluate(() => {
    const svg = document.getElementById('pieChart');
    return { rings: svg.querySelectorAll('circle').length,
             text: Array.from(svg.querySelectorAll('text')).map(t => t.textContent).join(' '),
             box: svg.getBBox().width };
  });
  check('before anything is scored the chart shows a waiting ring, not a blank white box',
        emptyChart.rings === 1 && emptyChart.box > 50 && /No scores yet/i.test(emptyChart.text),
        JSON.stringify(emptyChart));

  await page.select('#unitSelect', 'Measurement & Shapes');
  await clickScore(page, 0, 'M');
  const oneClick = await page.evaluate(() => {
    const svg = document.getElementById('pieChart');
    const drawn = Array.from(svg.querySelectorAll('circle, path'))
                       .filter(n => n.getAttribute('fill') && n.getAttribute('fill') !== 'none');
    return { drawn: drawn.length, fill: drawn[0] && drawn[0].getAttribute('fill'),
             width: drawn[0] ? drawn[0].getBBox().width : 0 };
  });
  check('the chart still draws when every scored skill is at the same level',
        oneClick.drawn === 1 && oneClick.fill === '#639922' && oneClick.width > 50,
        JSON.stringify(oneClick));

  await clickScore(page, 1, 'M');
  await clickScore(page, 2, 'M');
  const allSame = await page.evaluate(() => {
    const svg = document.getElementById('pieChart');
    const drawn = Array.from(svg.querySelectorAll('circle, path'))
                       .filter(n => n.getAttribute('fill') && n.getAttribute('fill') !== 'none');
    return { drawn: drawn.length, width: drawn[0] ? drawn[0].getBBox().width : 0 };
  });
  check('three lessons all at the same level still draw a full circle',
        allSame.drawn === 1 && allSame.width > 50, JSON.stringify(allSame));

  await clickScore(page, 3, 'E');
  const twoBands = await page.evaluate(() =>
    document.querySelectorAll('#pieChart path').length);
  eq('two different levels draw two wedges', twoBands, 2);

  const legend = await state(page);
  check('the chart says which colour means what, with counts and percentages',
        /Emerging/.test(legend.legend) && /Mastered/.test(legend.legend) && /%/.test(legend.legend),
        legend.legend);

  // =========================================================================
  group('Scoring');
  // =========================================================================
  const before = await state(page);
  await clickScore(page, 0, 'M');   // the same button again, on a lesson already Mastered
  const after = await state(page);
  eq('clicking a score a second time takes a mis-click back off',
     { m: after.m, scored: after.scored }, { m: before.m - 1, scored: before.scored - 1 });

  await clickScore(page, 0, 'E');
  await clickScore(page, 0, 'D');
  const changed = await page.evaluate(() => scores['Measuring with Non-Standard Units']);
  eq('changing your mind about a score still works', changed, 'Developing');

  const scrollKept = await page.evaluate(async () => {
    document.getElementById('unitSelect').value = 'all';
    updateLessons();
    const list = document.getElementById('lessonsList');
    list.scrollTop = 120;
    const row = document.querySelectorAll('.lesson')[6];
    Array.from(row.querySelectorAll('.btn-score')).find(b => b.textContent === 'D').click();
    return list.scrollTop;
  });
  check('scoring half way down a long list does not throw you back to the top',
        scrollKept === 120, 'scrollTop is ' + scrollKept);

  // =========================================================================
  group('The child, the date, and nothing more');
  // =========================================================================
  const fields = await page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll('input[type="text"]'));
    return {
      textFields: texts.length,
      maxlen: texts.map(t => t.maxLength),
      ids: texts.map(t => t.id),
      dates: document.querySelectorAll('input[type="date"]').length,
      privacy: (document.querySelector('.privacy') || {}).textContent || ''
    };
  });
  eq('the only free-text field about the child is a 4-character initials box',
     { textFields: fields.textFields, maxlen: fields.maxlen, ids: fields.ids },
     { textFields: 1, maxlen: [4], ids: ['initials'] });
  eq('there is a date field', fields.dates, 1);
  check('the page promises the work stays on this laptop',
        /Stays on this laptop/i.test(fields.privacy), fields.privacy);

  // =========================================================================
  group('Nothing is lost on a refresh');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');                       // start from empty
  await page.type('#initials', 'k.p.');
  await page.select('#unitSelect', 'Graphing & Data');
  await clickScore(page, 0, 'E');
  await clickScore(page, 1, 'M');
  await page.type('#strengthsComment', 'Reads a graph carefully, and checks the question first.');
  await page.type('#stretchesComment', 'Tally marks in fives.');

  const typed = await state(page);
  await page.reload({ waitUntil: 'load' });
  const survived = await state(page);
  eq('an assessment is still there after a refresh',
     { initials: survived.initials, unit: survived.unit, e: survived.e, m: survived.m,
       strengths: survived.strengths, stretches: survived.stretches },
     { initials: typed.initials, unit: typed.unit, e: typed.e, m: typed.m,
       strengths: typed.strengths, stretches: typed.stretches });

  // A comment is written to storage as it is typed. It used to be read only
  // when the box lost focus, so typing and exporting straight away lost it.
  await page.click('#stretchesComment');
  await page.keyboard.type(' Counting up with coins.');
  const withoutBlurring = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('math-assessment-tracker')).stretches);
  check('a comment is kept as you type it, without clicking away first',
        /Counting up with coins/.test(withoutBlurring), withoutBlurring);

  // =========================================================================
  group('When the browser refuses to save');
  // =========================================================================
  await page.evaluate(() => {
    // Safari's private window and a full disk both do exactly this.
    localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  });
  await clickScore(page, 2, 'D');
  const warned = await state(page);
  check('a teacher is told when this browser will not save their work',
        /NOT BEING SAVED/i.test(warned.warn) && /private window/i.test(warned.warn) && warned.warnShown,
        JSON.stringify({ warn: warned.warn, shown: warned.warnShown }));
  check('scoring keeps working even when saving is refused',
        warned.scored === 3, 'scored ' + warned.scored);
  check('no JavaScript error escapes when saving is refused',
        pageErrors.length === 0, pageErrors.join(' | '));

  // -------------------------------------------------------------------------
  // THE DEFECT, and the wrong moment. The check above used to read #msg — the
  // one line every message in this tool shares — immediately after the first
  // refused save, which is the single moment the warning was still on it. The
  // tool warned once and once only, so a click of Export CSV painted "CSV saved
  // to your Downloads folder." over it, that faded after five seconds, and the
  // line then sat empty while the teacher went on scoring into nothing. The
  // warning has its own bar now, it stays, and every refused save puts it back.
  // -------------------------------------------------------------------------
  await page.click('button[onclick="exportCSV()"]');
  const afterExport = await state(page);
  check('an export does not paint over the "not being saved" warning',
        afterExport.warnShown && /NOT BEING SAVED/i.test(afterExport.warn) &&
        /CSV saved/.test(afterExport.msg),
        JSON.stringify({ warn: afterExport.warn.slice(0, 40), msg: afterExport.msg }));
  check('the warning never shared a line with the ordinary messages in the first place',
        !/NOT BEING SAVED/i.test(afterExport.msg), afterExport.msg);

  await clickScore(page, 3, 'M');
  await page.evaluate(() => new Promise(r => setTimeout(r, 5400)));   // past the fade
  const stillWarned = await state(page);
  check('the warning is still on screen after the export message has faded away',
        stillWarned.warnShown && /NOT BEING SAVED/i.test(stillWarned.warn) && stillWarned.msg === '',
        JSON.stringify({ shown: stillWarned.warnShown, msg: stillWarned.msg }));

  // If anything ever hides the bar, the next score puts it straight back —
  // rather than the old latch, which made sure it could never return.
  await page.evaluate(() => document.getElementById('storageWarn').classList.remove('show'));
  await clickScore(page, 4, 'E');
  const rewarned = await state(page);
  check('a score after the warning is dismissed brings the warning straight back',
        rewarned.warnShown && /NOT BEING SAVED/i.test(rewarned.warn),
        JSON.stringify({ shown: rewarned.warnShown }));

  // =========================================================================
  group('Export CSV');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');
  await page.type('#initials', 'r.o.');
  await page.select('#unitSelect', 'Number Sense & Place Value');
  await clickScore(page, 17, 'M');           // What's My Rule — the apostrophe row
  await clickScore(page, 0, 'E');
  await page.type('#strengthsComment', 'Ravi explains his thinking, "regrouping" is solid, and he checks his work.');
  await page.click('#stretchesComment');
  await page.keyboard.type('Money, and two-step stories.\nNeeds a second pass on tally marks.');
  await page.click('button[onclick="exportCSV()"]');

  const csv = await lastDownload(page);
  check('the CSV carries the Strengths comment the teacher just typed',
        /Ravi explains his thinking/.test(csv.text), csv.text.slice(0, 200));
  check('the CSV carries the Stretches comment too',
        /two-step stories/.test(csv.text) && /tally marks/.test(csv.text), csv.text.slice(0, 400));
  check('a comment typed and exported straight away is not lost',
        /Needs a second pass/.test(csv.text), csv.text.slice(0, 400));
  check('quotation marks inside a comment come out as a spreadsheet expects',
        /""regrouping""/.test(csv.text), csv.text.slice(0, 300));
  check('a line break inside a comment stays inside its cell',
        /"Money, and two-step stories\.\nNeeds a second pass on tally marks\."/.test(csv.text),
        csv.text.slice(0, 400));
  check('the child and the date are in the CSV',
        /"Child \(initials\)","R\.O\."/.test(csv.text) && /"Date","\d{4}-\d{2}-\d{2}"/.test(csv.text),
        csv.text.slice(0, 200));
  check('every scored lesson comes out with its unit beside it',
        /"Number Sense & Place Value","What's My Rule","Mastered"/.test(csv.text),
        csv.text.slice(-400));
  const csvRows = csv.text.trim().split('\n').filter(l => /,"(Emerging|Developing|Mastered)"$/.test(l));
  eq('the CSV has a row for each lesson scored and no empty ones', csvRows.length, 2);

  // =========================================================================
  group('Export JSON and the file names');
  // =========================================================================
  await page.click('button[onclick="exportJSON()"]');
  const json = await lastDownload(page);
  const parsed = JSON.parse(json.text);
  eq('the JSON names the child by initials', parsed.child, 'R.O.');
  check('the JSON has a date', /^\d{4}-\d{2}-\d{2}$/.test(parsed.date), parsed.date);
  check('the JSON carries both comments',
        /Ravi explains/.test(parsed.strengths) && /two-step/.test(parsed.stretches), '');
  eq('the JSON only lists lessons that were actually scored',
     Object.keys(parsed.scores).length, 2);
  eq('a cleared tool does not claim a sample student', parsed.sampleStudent, null);

  const today = new Date();
  const iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') +
              '-' + String(today.getDate()).padStart(2, '0');
  eq('the CSV file is named after the child and the date', csv.name, `math-assessment-RO-${iso}.csv`);
  eq('the JSON file is named after the child and the date', json.name, `math-assessment-RO-${iso}.json`);

  // Two children in a row must not overwrite each other in Downloads.
  await page.evaluate(() => { document.getElementById('initials').value = 'B.L.'; });
  await page.click('button[onclick="exportCSV()"]');
  const second = await lastDownload(page);
  check('a second child gets a different file name, so nothing is overwritten',
        second.name !== csv.name, second.name + ' vs ' + csv.name);

  // =========================================================================
  group('The sample student is labelled in the exports too');
  // =========================================================================
  await fresh(page, base);                   // arrives with the sample loaded
  await page.click('button[onclick="exportCSV()"]');
  const sampleCsv = await lastDownload(page);
  check('a printed CSV of the sample says it is Maya Torres and made up',
        /Maya Torres/.test(sampleCsv.text) && /made-up/.test(sampleCsv.text),
        sampleCsv.text.slice(0, 300));
  check('the sample file name says SAMPLE',
        /SAMPLE/.test(sampleCsv.name), sampleCsv.name);
  await page.click('button[onclick="exportJSON()"]');
  const sampleJson = JSON.parse((await lastDownload(page)).text);
  check('the sample JSON says it is a sample',
        /Maya Torres/.test(sampleJson.sampleStudent || ''), String(sampleJson.sampleStudent));

  // -------------------------------------------------------------------------
  // The label used to come off the moment ANYTHING was typed in the initials,
  // the date or either comment box. Because the page loads Maya by itself,
  // arriving cold and changing ONLY the date — touching nothing else — was
  // enough: her initials and all 44 invented scores stayed exactly where they
  // were, the "not a real child" banner vanished, and the CSV, the JSON and
  // the file names all read as a genuine record for a child called "M.T.".
  //
  // Typing in a box does not turn made-up scores into real ones. The label now
  // stays until her scores are actually gone, which is what "Clear the sample"
  // and Clear are for. Every one of the checks below is that one bug.
  // -------------------------------------------------------------------------
  await fresh(page, base);                   // arrives with the sample loaded
  // Click the left-hand end of the date box so the caret lands on the first
  // segment, then type it the way a teacher does. Clicking the middle of the
  // box lands on whichever segment happens to be under the pointer, and the
  // digits go into the year.
  const dateBox = await page.$eval('#adate', n => {
    const r = n.getBoundingClientRect();
    return { x: r.left + 8, y: r.top + r.height / 2 };
  });
  await page.mouse.click(dateBox.x, dateBox.y);
  await page.keyboard.type('09012026');
  const dateOnly = await state(page);
  eq('the date really did change', dateOnly.date, '2026-09-01');
  eq('changing only the date does not touch her made-up scores', dateOnly.scored, first.scored);
  eq('changing only the date does not touch her initials', dateOnly.initials, 'M.T.');
  check('after changing only the date the screen still says "not a real child"',
        /Sample student/i.test(dateOnly.sampleText) && /not a real child/i.test(dateOnly.sampleText),
        dateOnly.sampleText);
  check('after changing only the date the button still offers to clear the sample',
        /Clear the sample/i.test(dateOnly.sampleBtn), dateOnly.sampleBtn);
  check('the tool says plainly why it is still marked as the sample',
        /made-up scores/i.test(dateOnly.msg) && /Clear the sample/i.test(dateOnly.msg),
        dateOnly.msg);
  eq('what is saved to this laptop still says sample', dateOnly.saved.sample, true);

  await page.click('button[onclick="exportCSV()"]');
  const dateCsv = await lastDownload(page);
  check('a CSV after a date change still says Maya Torres and made up',
        /Maya Torres/.test(dateCsv.text) && /made-up/.test(dateCsv.text),
        dateCsv.text.slice(0, 300));
  check('the file name after a date change still says SAMPLE',
        /SAMPLE/.test(dateCsv.name), dateCsv.name);
  await page.click('button[onclick="exportJSON()"]');
  const dateJson = JSON.parse((await lastDownload(page)).text);
  check('the JSON after a date change still names her as the sample student',
        /Maya Torres/.test(dateJson.sampleStudent || ''), String(dateJson.sampleStudent));

  // The same thing through the comment boxes: editing her write-up is still
  // her write-up, on her invented scores.
  await page.click('#strengthsComment');
  await page.keyboard.type(' She is doing well.');
  const afterComment = await state(page);
  check('editing the comment does not quietly unlabel her either',
        /not a real child/i.test(afterComment.sampleText) && afterComment.saved.sample === true,
        afterComment.sampleText);

  // And through the initials, which is the one the old code was written for.
  // Backspace over the sample initials first, the way a teacher does. The box
  // holds four characters at most, so typing on top of a full box does nothing
  // — and a check that types into a full box is checking nothing.
  await page.click('#initials');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type('T.W.');
  const typedOver = await state(page);
  eq('the initials really were typed over', typedOver.initials, 'T.W.');
  eq('her 44 made-up scores are still sitting there', typedOver.scored, first.scored);
  check('made-up scores under someone else\'s initials are still marked made up',
        /not a real child/i.test(typedOver.sampleText), typedOver.sampleText);
  await page.click('button[onclick="exportCSV()"]');
  const mine = await lastDownload(page);
  check('an export of her scores under other initials still says SAMPLE',
        /SAMPLE/.test(mine.name) && /Maya Torres/.test(mine.text), mine.name);

  // The way out is the one click Sahaj asked for, and it really does empty it.
  //
  // THE WRONG MOMENT: this check used to press "Clear the sample" here — with
  // typed-over initials and an edited comment sitting on the sample — and
  // assert that everything went. It drove the exact path that destroyed a
  // teacher's work and called the destruction a pass. Clearing on top of real
  // work now asks first, so the check has to prove it asked, not just that it
  // emptied.
  const confirmsBeforeOut = await page.evaluate(() => window.__confirms.length);
  await page.click('#sampleBtn');
  const outOfSample = await state(page);
  eq('"Clear the sample" is the way out, and it takes the scores with it',
     { scored: outOfSample.scored, initials: outOfSample.initials, sample: outOfSample.saved.sample },
     { scored: 0, initials: '', sample: false });
  eq('and it asked first, because there was typed-over work on top of her',
     outOfSample.confirms, confirmsBeforeOut + 1);
  check('and the way back is offered on screen',
        !outOfSample.undoHidden && /Undo the clear/i.test(outOfSample.msg), outOfSample.msg);
  await page.click('#initials');
  await page.keyboard.type('T.W.');
  await page.select('#unitSelect', 'Measurement & Shapes');
  await clickScore(page, 0, 'M');
  await page.click('button[onclick="exportCSV()"]');
  const real = await lastDownload(page);
  check('a real assessment started after clearing her is not called a sample',
        !/Maya Torres/.test(real.text) && !/SAMPLE/.test(real.name), real.name);

  // =========================================================================
  group('"Try it with a sample student" cannot eat a real assessment');
  // =========================================================================
  // THE DEFECT: this button sits at the top of the page next to the child's
  // initials, and it is the friendliest thing on the screen. Pressed half way
  // through a real assessment it asked nothing, kept nothing and offered no
  // Undo: the teacher's initials, scores and comments were replaced by Maya's
  // 44 made-up ones and written over the saved copy on the laptop. The plain
  // Clear button had asked first and offered an Undo for months.
  await fresh(page, base);
  await page.click('#sampleBtn');                       // clear her, start empty
  await page.click('#initials');
  await page.keyboard.type('R.K.');
  await page.select('#unitSelect', 'Number Sense & Place Value');
  for (let i = 0; i < 8; i++) await clickScore(page, i, 'M');
  await page.click('#strengthsComment');
  await page.keyboard.type('REALNOTE Rohan counts on and explains how he got there.');
  const realWork = await state(page);
  eq('a real assessment is under way', { scored: realWork.scored, initials: realWork.initials },
     { scored: 8, initials: 'R.K.' });

  await page.evaluate(() => { window.__confirms = []; window.__confirmAnswer = false; });
  await page.click('#sampleBtn');                       // "Try it with a sample student"
  const refused = await state(page);
  eq('it asks before it puts the sample over a real assessment',
     await page.evaluate(() => window.__confirms.length), 1);
  check('the question says what is about to be lost',
        /scores/i.test(await page.evaluate(() => window.__confirms[0])) &&
        /Undo the clear/i.test(await page.evaluate(() => window.__confirms[0])),
        await page.evaluate(() => window.__confirms[0]));
  eq('saying no leaves the real assessment exactly where it was',
     { scored: refused.scored, initials: refused.initials, strengths: refused.strengths },
     { scored: realWork.scored, initials: realWork.initials, strengths: realWork.strengths });
  eq('and saying no does not write the sample over the saved copy either',
     refused.saved.sample, false);

  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#sampleBtn');
  const swapped = await state(page);
  check('saying yes really does bring the sample in',
        swapped.scored > 20 && swapped.initials === 'M.T.' && /Maya counts on/.test(swapped.strengths),
        JSON.stringify({ scored: swapped.scored, initials: swapped.initials }));
  check('the way back is on screen, not gone for good',
        !swapped.undoHidden && /Undo the clear/i.test(swapped.msg), swapped.msg);

  await page.click('#undoClearBtn');
  const putBack = await state(page);
  eq('Undo puts the whole real assessment back',
     { scored: putBack.scored, initials: putBack.initials, strengths: putBack.strengths,
       sample: putBack.saved.sample },
     { scored: realWork.scored, initials: realWork.initials, strengths: realWork.strengths,
       sample: false });
  await page.reload({ waitUntil: 'load' });
  const putBackKept = await state(page);
  eq('and what Undo put back survives a refresh',
     { scored: putBackKept.scored, initials: putBackKept.initials }, { scored: 8, initials: 'R.K.' });

  // =========================================================================
  group('"Clear the sample" cannot eat work typed on top of the sample');
  // =========================================================================
  // THE DEFECT: the page loads Maya by herself, and typing no longer takes her
  // label off — so the sample state is the state a teacher does real work in.
  // The tool's own nudge line sends them to this button, and it wiped their
  // initials, both comments and every score they had entered, with no question
  // and nothing kept.
  await fresh(page, base);                              // Maya auto-loads
  await page.click('#initials');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type('R.K.');
  await page.evaluate(() => {
    const s = document.getElementById('strengthsComment');
    s.value = 'REALSTRENGTH Rohan checks the question before he answers.';
    s.dispatchEvent(new Event('input', { bubbles: true }));
    const t = document.getElementById('stretchesComment');
    t.value = 'REALSTRETCH Counting up with coins.';
    t.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.select('#unitSelect', 'Graphing & Data');
  await clickScore(page, 0, 'E');
  const onTop = await state(page);
  check('the nudge sends the teacher to that button, so it had better be safe',
        /Clear the sample/i.test(onTop.msg) && /asks first/i.test(onTop.msg), onTop.msg);

  await page.evaluate(() => { window.__confirms = []; window.__confirmAnswer = false; });
  await page.click('#sampleBtn');                       // "Clear the sample"
  const keptIt = await state(page);
  eq('it asks before it wipes work typed on top of the sample',
     await page.evaluate(() => window.__confirms.length), 1);
  eq('saying no leaves every word and every score alone',
     { initials: keptIt.initials, strengths: keptIt.strengths, stretches: keptIt.stretches },
     { initials: onTop.initials, strengths: onTop.strengths, stretches: onTop.stretches });

  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#sampleBtn');
  const wiped = await state(page);
  eq('saying yes does empty it, ready for a real assessment',
     { scored: wiped.scored, initials: wiped.initials, strengths: wiped.strengths,
       sample: wiped.saved.sample },
     { scored: 0, initials: '', strengths: '', sample: false });
  check('and "Undo the clear" is offered, the way the plain Clear button offers it',
        !wiped.undoHidden && /Undo the clear/i.test(wiped.msg), wiped.msg);

  await page.click('#undoClearBtn');
  const backOnTop = await state(page);
  eq('Undo puts back the initials, both comments and the scores',
     { initials: backOnTop.initials, strengths: backOnTop.strengths,
       stretches: backOnTop.stretches, scored: backOnTop.scored },
     { initials: onTop.initials, strengths: onTop.strengths,
       stretches: onTop.stretches, scored: onTop.scored });

  // =========================================================================
  group('Scoring with the keyboard');
  // =========================================================================
  // THE DEFECT: setScore() rebuilds every row, which threw focus back to the
  // body. Enter scored the lesson and then the keyboard was nowhere — a second
  // Enter did nothing, un-scoring a mis-click was mouse-only, and getting back
  // to the same button took eight tab stops after every single score.
  await fresh(page, base);
  await page.click('#sampleBtn');
  await page.select('#unitSelect', 'Graphing & Data');
  await page.evaluate(() => Array.from(document.querySelectorAll('.btn-score'))
    .find(b => b.getAttribute('aria-label') === 'Reading a Bar Graph: Emerging').focus());
  await page.keyboard.press('Enter');
  const afterEnter = await page.evaluate(() => ({
    score: scores['Reading a Bar Graph'],
    focus: document.activeElement.getAttribute('aria-label'),
    pressed: document.activeElement.getAttribute('aria-pressed')
  }));
  eq('Enter scores the lesson', afterEnter.score, 'Emerging');
  eq('and the keyboard stays on the button that was just pressed',
     { focus: afterEnter.focus, pressed: afterEnter.pressed },
     { focus: 'Reading a Bar Graph: Emerging', pressed: 'true' });
  await page.keyboard.press('Enter');
  const secondEnter = await page.evaluate(() => ({
    score: scores['Reading a Bar Graph'],
    focus: document.activeElement.getAttribute('aria-label')
  }));
  eq('a second Enter takes a mis-click back off, without touching the mouse',
     { score: secondEnter.score, focus: secondEnter.focus },
     { score: null, focus: 'Reading a Bar Graph: Emerging' });

  // Tab still moves on normally afterwards: focus is restored, not nailed down.
  await page.keyboard.press('Tab');
  const nextStop = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));
  eq('Tab still moves to the next score button', nextStop, 'Reading a Bar Graph: Developing');

  // A mouse click leaves you on the button you clicked, exactly as the keyboard
  // does — not on the body, which is where the rebuild used to dump everybody.
  await clickScore(page, 1, 'M');
  const mouseFocus = await page.evaluate(() => ({
    tag: document.activeElement.tagName,
    label: document.activeElement.getAttribute && document.activeElement.getAttribute('aria-label')
  }));
  eq('scoring with the mouse leaves you on the button you clicked, not on the body',
     mouseFocus, { tag: 'BUTTON', label: 'Making a Bar Graph: Mastered' });

  // =========================================================================
  group('Getting out of the breakdown with the keyboard');
  // =========================================================================
  // THE DEFECT: the × was a <span> — no Tab ever reached it — there was no key
  // handler in the file at all, so Escape did nothing, and Tab walked through
  // the unit picker and the score buttons hidden behind the full-screen
  // overlay. A keyboard-only teacher who opened this list could not close it.
  await fresh(page, base);
  const closeEl = await page.evaluate(() => {
    const c = document.querySelector('.close-modal');
    return { tag: c.tagName, label: c.getAttribute('aria-label') };
  });
  eq('the × is a real button with a name', closeEl, { tag: 'BUTTON', label: 'Close this list' });

  await page.evaluate(() => document.querySelectorAll('.count-item')[2].focus());
  await page.keyboard.press('Enter');
  const opened = await page.evaluate(() => ({
    open: document.getElementById('lessonsModal').classList.contains('show'),
    focus: document.activeElement.className
  }));
  check('opening the list puts the keyboard inside it',
        opened.open && /close-modal/.test(opened.focus), JSON.stringify(opened));

  const walk = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    walk.push(await page.evaluate(() => document.activeElement.className || document.activeElement.tagName));
  }
  check('Tab stays inside the list instead of walking off behind the overlay',
        walk.every(c => /close-modal/.test(c)), Array.from(new Set(walk)).join(' | '));

  await page.keyboard.press('Escape');
  const escaped = await page.evaluate(() => ({
    open: document.getElementById('lessonsModal').classList.contains('show'),
    focus: document.activeElement.className
  }));
  check('Escape closes the list', !escaped.open, JSON.stringify(escaped));
  check('and the keyboard is handed back to the tile it was opened from',
        /count-item/.test(escaped.focus), escaped.focus);

  // The × itself must work from the keyboard too, not only from a mouse.
  await page.evaluate(() => document.querySelectorAll('.count-item')[0].focus());
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');            // Enter on the close button
  const closedByKey = await page.evaluate(() => ({
    open: document.getElementById('lessonsModal').classList.contains('show'),
    focus: document.activeElement.className
  }));
  check('pressing Enter on the × closes the list and hands the keyboard back',
        !closedByKey.open && /count-item/.test(closedByKey.focus), JSON.stringify(closedByKey));

  // =========================================================================
  group('Export PDF');
  // =========================================================================
  await fresh(page, base);
  await page.evaluate(() => {
    // Capture the real PDF instead of writing it to disk: every text() call
    // with the page it landed on, and the filename save() was given.
    const Real = window.jspdf.jsPDF;
    window.__pdfText = []; window.__pdfName = null; window.__pdfPages = 0;
    window.jspdf = { jsPDF: function(opts){
      const p = new Real(opts);
      const realText = p.text.bind(p);
      p.text = function(txt, x, y, o){
        [].concat(txt).forEach(t => window.__pdfText.push(
          { t: String(t), y: y, page: p.internal.getCurrentPageInfo().pageNumber }));
        return realText(txt, x, y, o);
      };
      p.save = function(name){ window.__pdfName = name;
                               window.__pdfPages = p.internal.getNumberOfPages(); };
      return p;
    } };
  });
  await page.click('button[onclick="exportPDF()"]');
  const pdf = await page.evaluate(() => ({ text: window.__pdfText.map(r => r.t).join('\n'),
                                           name: window.__pdfName, pages: window.__pdfPages }));
  check('the printed report says who it is about',
        /Maya Torres/.test(pdf.text), pdf.text.split('\n').slice(0, 3).join(' / '));
  check('the printed sample report says the scores are made up',
        /made-up scores/.test(pdf.text), '');
  check('the PDF file is named after the child and the date',
        /^math-assessment-SAMPLE-MT-\d{4}-\d{2}-\d{2}\.pdf$/.test(pdf.name || ''), String(pdf.name));

  // A very long Strengths comment used to push the whole Stretches section off
  // the bottom of page one, where nobody would ever see it.
  await fresh(page, base);
  await page.evaluate(() => {
    const Real = window.jspdf.jsPDF;
    window.__pdfText = []; window.__pdfPages = 0;
    window.jspdf = { jsPDF: function(opts){
      const p = new Real(opts);
      const realText = p.text.bind(p);
      p.text = function(txt, x, y, o){
        [].concat(txt).forEach(t => window.__pdfText.push(
          { t: String(t), y: y, page: p.internal.getCurrentPageInfo().pageNumber }));
        return realText(txt, x, y, o);
      };
      p.save = function(){ window.__pdfPages = p.internal.getNumberOfPages(); };
      return p;
    } };
    const long = 'She counts on, she checks her work and she explains it out loud. '.repeat(95);
    const s = document.getElementById('strengthsComment');
    s.value = long + 'ENDSTRENGTH';
    s.dispatchEvent(new Event('input', { bubbles: true }));
    const t = document.getElementById('stretchesComment');
    t.value = 'STRETCHSENTINEL two-step stories.';
    t.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('button[onclick="exportPDF()"]');
  const longPdf = await page.evaluate(() => ({
    pages: window.__pdfPages,
    stretch: window.__pdfText.find(r => /STRETCHSENTINEL/.test(r.t)) || null,
    tallest: Math.max.apply(null, window.__pdfText.map(r => r.y))
  }));
  check('a very long comment runs onto a second page instead of off the bottom',
        longPdf.pages > 1, 'pages: ' + longPdf.pages);
  check('nothing is drawn past the bottom edge of the paper',
        longPdf.tallest <= 297, 'lowest line at ' + longPdf.tallest + 'mm on a 297mm page');
  check('the Stretches comment is still on the paper after a very long Strengths comment',
        !!longPdf.stretch, 'not found in the PDF at all');

  // =========================================================================
  group('Clear asks first, and can be undone');
  // =========================================================================
  await fresh(page, base);
  await page.evaluate(() => { window.__confirmAnswer = false; });
  const beforeClear = await state(page);
  await page.click('button[onclick="clearForm()"]');
  const saidNo = await state(page);
  check('Clear asks before it wipes anything',
        (await page.evaluate(() => window.__confirms.length)) === 1, '');
  eq('saying no to Clear leaves the assessment alone', saidNo.scored, beforeClear.scored);

  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('button[onclick="clearForm()"]');
  const afterClear = await state(page);
  eq('saying yes to Clear does empty the tool', afterClear.scored, 0);
  check('the screen tells you how to get it back',
        /Undo the clear/i.test(afterClear.msg), afterClear.msg);
  check('the Undo button is actually there to press',
        !(await page.$eval('#undoClearBtn', b => b.hidden)), '');

  await page.click('#undoClearBtn');
  const undone = await state(page);
  eq('Undo puts the whole assessment back',
     { scored: undone.scored, initials: undone.initials, strengths: undone.strengths },
     { scored: beforeClear.scored, initials: beforeClear.initials, strengths: beforeClear.strengths });
  await page.reload({ waitUntil: 'load' });
  const undoneKept = await state(page);
  eq('what Undo put back is still there after a refresh', undoneKept.scored, beforeClear.scored);

  // =========================================================================
  group('Reaching the breakdown with the keyboard');
  // =========================================================================
  const tiles = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.count-item')).map(t => t.tagName));
  eq('the three level tiles are real buttons', tiles, ['BUTTON', 'BUTTON', 'BUTTON']);
  await page.evaluate(() => document.querySelectorAll('.count-item')[2].focus());
  await page.keyboard.press('Enter');
  const modal = await page.evaluate(() => ({
    open: document.getElementById('lessonsModal').classList.contains('show'),
    title: document.getElementById('modalTitle').textContent,
    items: document.querySelectorAll('#modalLessonsList .lesson-item').length
  }));
  check('Enter on a tile opens that level\'s list of lessons',
        modal.open && /Mastered/.test(modal.title) && modal.items > 0, JSON.stringify(modal));
  // THE WRONG MOMENT: this group is about the keyboard, and the check that the
  // list closes again used to reach for the mouse — so it passed for months
  // while the × was an unfocusable <span>, Escape did nothing, and a
  // keyboard-only teacher who opened this list was stuck with it. It closes it
  // with a key now; "Getting out of the breakdown with the keyboard" above is
  // the full check.
  await page.keyboard.press('Escape');
  check('the list closes again, from the keyboard it was opened with',
        !(await page.evaluate(() => document.getElementById('lessonsModal').classList.contains('show'))), '');
  await page.evaluate(() => document.querySelectorAll('.count-item')[2].click());
  await page.click('.close-modal');
  check('and the × still closes it with a mouse',
        !(await page.evaluate(() => document.getElementById('lessonsModal').classList.contains('show'))), '');

  // =========================================================================
  group('The curriculum a stranger reads');
  // =========================================================================
  const names = await page.evaluate(() => {
    const all = [];
    Object.entries(curriculum).forEach(([u, ls]) => ls.forEach(l => all.push({ u, l })));
    const lower = all.map(x => x.l.toLowerCase());
    return {
      total: all.length,
      duplicates: lower.filter((n, i) => lower.indexOf(n) !== i),
      shorthand: all.filter(x => /^\d+[-–]\d+|Math Journal|\bcont\b|^\d/.test(x.l)).map(x => x.l)
    };
  });
  eq('no skill is listed twice, so a child cannot be two levels at once', names.duplicates, []);
  eq('no lesson is still raw planning shorthand', names.shorthand, []);
  check('the curriculum is still all there', names.total === 56, 'lessons: ' + names.total);

  // =========================================================================
  group('On a phone');
  // =========================================================================
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: 'load' });
  await page.select('#unitSelect', 'Graphing & Data');
  const phone = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const rects = Array.from(document.querySelectorAll('#unitSelect, .lesson, .btn-score'))
                       .map(n => n.getBoundingClientRect());
    return {
      clientWidth: w,
      scrollWidth: document.documentElement.scrollWidth,
      offscreen: rects.filter(r => r.right > w + 1).length,
      counted: rects.length,
      pickerVisible: document.getElementById('unitSelect').getBoundingClientRect().width > 100
    };
  });
  check('on a phone the page does not scroll sideways',
        phone.scrollWidth <= phone.clientWidth + 1,
        `clientWidth ${phone.clientWidth}, scrollWidth ${phone.scrollWidth}`);
  eq('on a phone every lesson row and score button is on the screen', phone.offscreen, 0);
  check('on a phone the unit picker is visible', phone.pickerVisible, '');
  check('there are lesson rows to see on a phone', phone.counted > 5, 'counted ' + phone.counted);

  const legendOnPhone = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('#pieChart text'));
    return { lines: t.length,
             // Anything past the 280-wide viewBox is cut off on a narrow screen.
             cut: t.map(n => { const b = n.getBBox();
                               return { text: n.textContent, right: Math.round(b.x + b.width) }; })
                   .filter(r => r.right > 280) };
  });
  check('the chart on a phone still has all three levels in its legend',
        legendOnPhone.lines === 3, 'legend lines: ' + legendOnPhone.lines);
  eq('on a phone the chart legend is not cut off at the edge', legendOnPhone.cut, []);
  await page.setViewport({ width: 1280, height: 900 });

  // =========================================================================
  group('When the PDF library cannot be reached');
  // =========================================================================
  // Without this the blocked script is served straight out of Chrome's cache
  // from the earlier page loads, and the "no internet" check silently tests
  // nothing at all.
  await page.setCacheEnabled(false);
  await page.setRequestInterception(true);
  const block = req => {
    if (/cdnjs\.cloudflare\.com/.test(req.url())) req.abort().catch(() => {});
    else req.continue().catch(() => {});
  };
  page.on('request', block);
  pageErrors = []; consoleErrors = [];      // the blocked script logs one, on purpose
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  const offlineOnLoad = await state(page);
  check('a firewalled school laptop is told on arrival that Export PDF will not work',
        /Export PDF is not available/i.test(offlineOnLoad.msg), offlineOnLoad.msg);
  check('it also says what still works',
        /CSV/.test(offlineOnLoad.msg) && /JSON/.test(offlineOnLoad.msg), offlineOnLoad.msg);

  await page.click('button[onclick="exportPDF()"]');
  const offlineClick = await state(page);
  check('clicking Export PDF offline explains it plainly instead of dying quietly',
        /needs the internet/i.test(offlineClick.msg), offlineClick.msg);
  check('the teacher is never shown raw JavaScript error text',
        !/Error:/.test(offlineClick.msg) && !/undefined/.test(offlineClick.msg), offlineClick.msg);
  eq('no browser alert box is thrown at the teacher',
     await page.evaluate(() => window.__alerts.length), 0);
  const stillWorks = await page.evaluate(() => {
    document.getElementById('unitSelect').value = 'Graphing & Data';
    updateLessons();
    const row = document.querySelectorAll('.lesson')[0];
    Array.from(row.querySelectorAll('.btn-score')).find(b => b.textContent === 'M').click();
    return +document.getElementById('count-m').textContent;
  });
  check('scoring still works with the internet gone', stillWorks > 0, 'mastered: ' + stillWorks);
  await page.click('button[onclick="exportCSV()"]');
  const offlineCsv = await lastDownload(page);
  check('Export CSV still works with the internet gone',
        /Mastered/.test(offlineCsv.text), offlineCsv.text.slice(0, 120));
  check('no JavaScript error escapes when the PDF library is missing',
        pageErrors.length === 0, pageErrors.join(' | '));
  page.off('request', block);
  await page.setRequestInterception(false);

  await browser.close();
  stop();

  // -------------------------------------------------------------------------
  console.log('');
  if (failures.length){
    console.log(`${R}${failures.length} CHECK(S) FAILED${X}  (${passed} passed)`);
    failures.forEach(f => console.log(`${R}  · ${f.name}${X}${f.detail ? DIM + ' — ' + f.detail + X : ''}`));
    process.exit(1);
  }
  console.log(`${G}ALL ${passed} CHECKS PASSED${X}`);
}

main().catch(e => { console.error(`${R}The test run itself crashed:${X}\n`, e); process.exit(2); });
