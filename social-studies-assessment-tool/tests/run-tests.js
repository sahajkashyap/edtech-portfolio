#!/usr/bin/env node
//
// Social Studies Assessment Tracker — regression tests.
//
// WHAT THIS IS
// ------------
// "Regression" means sliding backward. Every check in this file exists because
// something was once actually broken here. The point is not to prove the tool
// works today — it is so that a bug fixed in August cannot quietly come back in
// November without anybody noticing.
//
// Each test is named for what a PERSON would notice, not for the function
// involved. If you fix a new bug, add a check for it here the same day, while
// you still remember what went wrong.
//
// HOW TO RUN IT
// -------------
//     cd ~/Documents/GitHub/edtech-portfolio/social-studies-assessment-tool/tests
//     npm test
//
// It opens a real Google Chrome in the background, drives the tool with real
// clicks and real keypresses, and prints a line per check. It needs nothing on
// the internet — the one test that DOES involve the internet is the one that
// checks what happens when the internet is not there.
//
// node_modules is a symlink to ../../running-record-tool/tests/node_modules, so
// there is nothing to install. If that symlink is missing, recreate it with:
//     ln -s ../../running-record-tool/tests/node_modules node_modules
//
// WHAT YOU SHOULD SEE
// -------------------
// A list of green PASS lines and, at the end, "ALL n CHECKS PASSED".
//
const puppeteer = require('puppeteer-core');
const http      = require('http');
const fs        = require('fs');
const path      = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT   = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Tiny local web server. The tool is a single file and would open happily from
// the filesystem, but Chrome refuses localStorage on file:// URLs, and half of
// what is tested here is what gets saved. Serving over http reproduces
// GitHub Pages exactly.
// ---------------------------------------------------------------------------
const TYPES = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
                '.json':'application/json', '.md':'text/markdown' };

function serve(){
  return new Promise(resolve => {
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
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
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
// `load`, not `domcontentloaded`: a stylesheet or favicon still in flight when
// the first assertion runs lands in the console-error list a fraction of the
// time, and a test that is right nine times in ten just teaches you to ignore
// red. Wait for the page to be genuinely finished.
async function fresh(page, base){
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

// The tool arrives with the sample student in it on purpose. Most checks want
// an empty form, which is one click on the same button.
async function emptyForm(page){
  await page.click('#sampleBtn');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

// Click the E / D / M button on the nth category row.
async function score(page, row, letter){
  const idx = { E: 0, D: 1, M: 2 }[letter];
  const handles = await page.$$(`.categories .category:nth-child(${row + 1}) .btn-score`);
  await handles[idx].click();
}

const state = page => page.evaluate(() => ({
  scores: { ...scores },
  sample: sampleMode,
  initials: document.getElementById('initials').value,
  date: document.getElementById('adate').value,
  strengths: document.getElementById('strengthsComment').value,
  stretches: document.getElementById('stretchesComment').value,
  countE: document.getElementById('count-e').textContent,
  countD: document.getElementById('count-d').textContent,
  countM: document.getElementById('count-m').textContent,
  notYet: document.getElementById('notYet').textContent,
  msg: document.getElementById('msg').textContent,
  circles: document.querySelectorAll('#pieChart circle').length,
  paths: document.querySelectorAll('#pieChart path').length
}));

// The storage key is read from the page itself, so a rename cannot silently
// make these checks pass against nothing.
const storeKey = page => page.evaluate(() => STORE_KEY);

// What the pie chart actually PAINTS, in pixels. Counting <path> elements is
// how the original blank-chart bug survived a review: the element was there,
// it just enclosed no area.
const chartInk = page => page.evaluate(() => {
  const svg = document.getElementById('pieChart');
  let area = 0;
  svg.querySelectorAll('path, circle').forEach(el => {
    const b = el.getBBox();
    area += b.width * b.height;
  });
  return Math.round(area);
});

const lastDownload = page => page.evaluate(async () => {
  const d = window.__downloads[window.__downloads.length - 1];
  if (!d) return null;
  return { name: d.name, text: await window.__blobs[d.url].text() };
});

async function main(){
  if (!fs.existsSync(CHROME)){
    console.error(`${R}Google Chrome was not found at:${X}\n  ${CHROME}\n` +
                  `Install Chrome, or edit the CHROME path at the top of this file.`);
    process.exit(2);
  }

  const { srv, port } = await serve();
  const base = `http://127.0.0.1:${port}`;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  // Anything that would open a window, block on a dialog or write to the
  // Downloads folder is stubbed, so the handlers still run and can be read.
  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // Chrome's message for a failed request is the same generic sentence
    // whatever the file was — the URL lives in location(), not in the text.
    // Always report the URL, so a future 404 names itself.
    const url = (m.location() && m.location().url) || '';
    if (/favicon/i.test(url)) return;
    consoleErrors.push(m.text() + (url ? '  [' + url + ']' : ''));
  });
  await page.evaluateOnNewDocument(() => {
    window.__printed = 0;
    window.print = () => { window.__printed++; };
    window.__confirms = [];
    window.__confirmReturn = true;
    window.confirm = m => { window.__confirms.push(String(m)); return window.__confirmReturn; };
    window.__alert = null;
    window.alert = m => { window.__alert = String(m); };
    // Catch downloads instead of writing files. The tool builds a detached
    // <a> and clicks it, which never reaches a document listener, so the
    // anchor's own click() is what has to be intercepted.
    window.__blobs = {};
    window.__downloads = [];
    URL.createObjectURL = function(b){
      const u = 'blob:stub-' + Object.keys(window.__blobs).length;
      window.__blobs[u] = b;
      return u;
    };
    URL.revokeObjectURL = function(){};
    HTMLAnchorElement.prototype.click = function(){
      if (this.hasAttribute('download')){
        window.__downloads.push({ name: this.getAttribute('download'),
                                  url: this.getAttribute('href') });
      }
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

  eq('the page is not stuck in quirks mode',
     await page.evaluate(() => document.compatMode), 'CSS1Compat');

  const bodyBg = await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor);
  check('the page paints the background it was designed with, not white',
        bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent', `got ${bodyBg}`);

  // =========================================================================
  group('The sample student');
  // =========================================================================
  let s = await state(page);
  check('a visitor arrives to a filled-in tool, not six blank rows',
        Object.values(s.scores).filter(Boolean).length === 6,
        JSON.stringify(s.scores));
  eq('the sample student is the same Maya Torres as every other tool in the suite',
     s.initials, 'M.T.');
  check('the sample is labelled on screen so it cannot be taken for a real child',
        await page.evaluate(() => {
          const n = document.getElementById('sampleNote');
          return !n.hidden && /Sample student/.test(n.textContent) &&
                 /Maya Torres/.test(n.textContent);
        }));
  check('the sample child has a mixed profile, not the same score everywhere',
        new Set(Object.values(s.scores)).size === 3, JSON.stringify(s.scores));
  check('both comment boxes are filled in, so the report is populated too',
        s.strengths.length > 40 && s.stretches.length > 40);
  check('the chart is drawn on arrival', await chartInk(page) > 1000);

  await emptyForm(page);
  s = await state(page);
  check('one click clears the sample and leaves the tool completely empty',
        Object.values(s.scores).every(v => v === null) && s.initials === '' &&
        s.strengths === '' && s.stretches === '', JSON.stringify(s));
  check('the button now offers to bring the sample back',
        await page.evaluate(() => document.getElementById('sampleBtn').textContent)
          === 'Try it with a sample student');

  // =========================================================================
  group('The distribution chart');
  // =========================================================================
  eq('an empty chart says what to do instead of being a blank white box',
     await page.evaluate(() => {
       const t = document.querySelector('#pieChart text');
       return t ? t.textContent : null;
     }),
     'Score a category to see the distribution.');

  // THE BUG: one full-circle slice was drawn as an arc from a point back to
  // the same point, which SVG paints as nothing. Every visitor hit it on their
  // very first click.
  await score(page, 0, 'E');
  s = await state(page);
  eq('one score gives a count of one', s.countE, '1');
  check('the chart still draws after the very first click',
        await chartInk(page) > 1000, `ink was ${await chartInk(page)}`);

  for (let r = 1; r < 6; r++) await score(page, r, 'E');
  check('the chart still draws when every category is at the same level',
        await chartInk(page) > 1000, `ink was ${await chartInk(page)}`);
  s = await state(page);
  eq('...and it is a whole circle, not a zero-width wedge',
     { circles: s.circles, paths: s.paths }, { circles: 1, paths: 0 });

  await score(page, 5, 'M');
  await score(page, 4, 'D');
  check('two and three levels still draw as separate wedges',
        await chartInk(page) > 1000 &&
        (await state(page)).paths === 3, JSON.stringify(await state(page)));

  // =========================================================================
  group('Taking a score back');
  // =========================================================================
  await fresh(page, base);
  await emptyForm(page);
  await score(page, 0, 'E');
  eq('a tapped level is recorded',
     (await state(page)).scores['Participates in Discussions'], 'Emerging');
  await score(page, 0, 'E');
  eq('tapping the same level again takes a mis-clicked score back off',
     (await state(page)).scores['Participates in Discussions'], null);
  s = await state(page);
  check('and the row really is unscored again, not just uncoloured',
        s.countE === '0' && /6 categories not yet assessed/.test(s.notYet),
        s.notYet);

  // =========================================================================
  group('Who was assessed');
  // =========================================================================
  const fields = await page.evaluate(() => ({
    initialsMax: document.getElementById('initials').getAttribute('maxlength'),
    hasDate: !!document.querySelector('input[type=date]'),
    nameLike: [...document.querySelectorAll('input')]
      .filter(i => /name/i.test(i.id + ' ' + (i.placeholder || ''))).length,
    privacy: (document.querySelector('.privacy') || {}).textContent || ''
  }));
  eq('there is a short initials box, not a place to type a full name',
     fields.initialsMax, '4');
  check('there is a date', fields.hasDate);
  eq('no field asks for a child\'s name', fields.nameLike, 0);
  check('the page promises the work stays on this laptop',
        /Stays on this laptop/.test(fields.privacy), fields.privacy);

  // =========================================================================
  group('The spreadsheet a teacher opens in Excel');
  // =========================================================================
  await fresh(page, base);
  await emptyForm(page);
  await page.type('#initials', 'A.B.');
  await page.evaluate(() => {
    const d = document.getElementById('adate');
    d.value = '2026-03-04';
    d.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await score(page, 0, 'M');
  await score(page, 1, 'D');
  // A comma, a quote and a newline: what teachers actually type.
  await page.type('#strengthsComment', 'Ada leads her group, listens well, and says "I wonder" a lot.');
  await page.type('#stretchesComment', 'Map keys need work.\nSo do timelines.');
  await page.click('button[onclick="exportCSV()"]');
  const csv = await lastDownload(page);

  check('the teacher\'s own comments are in the spreadsheet',
        /Ada leads her group/.test(csv.text) && /Map keys need work/.test(csv.text),
        csv.text);
  check('a comma and a quote inside a comment do not break the row',
        csv.text.includes('"Ada leads her group, listens well, and says ""I wonder"" a lot."'),
        csv.text);
  check('a category nobody scored says so instead of vanishing',
        (csv.text.match(/Not yet assessed/g) || []).length === 4, csv.text);
  check('all six categories are in the file',
        (csv.text.match(/Uses Maps, Globes, and Geographic Tools/g) || []).length === 1,
        csv.text);
  check('the initials and the date are in the file',
        /Child,A\.B\./.test(csv.text) && /Date,2026-03-04/.test(csv.text), csv.text);
  eq('the file is named for the child and the date, so a second child cannot overwrite the first',
     csv.name, 'social_studies_AB_2026-03-04.csv');

  await page.click('button[onclick="exportJSON()"]');
  const json = await lastDownload(page);
  const parsed = JSON.parse(json.text);
  check('the JSON carries the same initials, date and comments',
        parsed.initials === 'A.B.' && parsed.date === '2026-03-04' &&
        /Ada leads/.test(parsed.strengths) && /Map keys/.test(parsed.stretches),
        json.text.slice(0, 300));
  eq('the JSON file is named for the child too', json.name,
     'social_studies_AB_2026-03-04.json');

  // The sample must never be mistakeable for a real record once printed.
  await fresh(page, base);
  await page.click('button[onclick="exportCSV()"]');
  const sampleCsv = await lastDownload(page);
  check('an export of the sample says on its face that it is a sample',
        /Sample student - Maya Torres/.test(sampleCsv.text), sampleCsv.text.slice(0, 200));
  check('and the sample\'s filename is marked SAMPLE',
        /^SAMPLE_social_studies_MT_/.test(sampleCsv.name), sampleCsv.name);

  // =========================================================================
  group('Nothing is lost');
  // =========================================================================
  await fresh(page, base);
  await emptyForm(page);
  await page.type('#initials', 'C.D.');
  await score(page, 2, 'M');
  await score(page, 3, 'E');
  await page.type('#strengthsComment', 'Loves the globe.');

  // Typed, never blurred — a comment used to be read only at export time, so
  // closing the laptop mid-sentence threw it away.
  const key = await storeKey(page);
  const savedWhileTyping = await page.evaluate(k =>
    JSON.parse(localStorage.getItem(k) || '{}'), key);
  eq('a comment is saved as it is typed, without clicking away from the box',
     savedWhileTyping.strengths, 'Loves the globe.');

  await page.reload({ waitUntil: 'load' });
  s = await state(page);
  check('a refresh does not wipe the assessment',
        s.initials === 'C.D.' && s.strengths === 'Loves the globe.' &&
        s.scores['Demonstrates Curiosity and Engagement'] === 'Mastered' &&
        s.scores['Participates in Shared Research Projects'] === 'Emerging',
        JSON.stringify(s));
  check('and the chart comes back with it', await chartInk(page) > 1000);

  // =========================================================================
  group('When the browser refuses to save');
  // =========================================================================
  // WHAT WENT WRONG WITH THIS GROUP ITSELF, August 2026.
  //
  // It used to open one page, type one character and read #msg — and it passed
  // while the tool was badly broken. It passed for the wrong reason: forty
  // checks above it had already left a record in this browser's localStorage,
  // so restore() SUCCEEDED, the startup path never called save(), and the
  // warning came from the keystroke instead. It was testing a teacher coming
  // BACK to saved work.
  //
  // The bug lived on the other path — a FIRST visit, with nothing stored. There
  // the startup path calls save(), the warning fires, and the sample-student
  // intro message overwrote it on the same tick. Both paths are checked now,
  // and the first-visit one clears the store and asserts it is genuinely empty
  // at the moment the page loads, so this group cannot drift back to testing
  // the wrong moment just because something above it moved.
  //
  // Safari's private window, blocked cookies and a full disk all throw here.

  // Wipe the store, then prove to ourselves it is really wiped: the stub below
  // runs before the tool's own script, so it sees exactly what a first-time
  // visitor sees.
  await page.evaluate(() => localStorage.clear());

  const firstVisit = await browser.newPage();
  await firstVisit.setViewport({ width: 1280, height: 1000 });
  await firstVisit.evaluateOnNewDocument(() => {
    window.__storeAtLoad = 'unread';
    try { window.__storeAtLoad = localStorage.getItem('social-studies-assessment'); }
    catch (e) { window.__storeAtLoad = null; }
    Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); };
    window.confirm = () => true;
  });
  await firstVisit.goto(base + '/index.html', { waitUntil: 'load' });

  eq('this really is a first visit, with nothing saved on the laptop',
     await firstVisit.evaluate(() => window.__storeAtLoad), null);

  // Null-safe on purpose: if the warning element is ever deleted, these checks
  // must go red with a readable reason, not blow the whole suite up.
  const warn = p => p.evaluate(() => {
    const w = document.getElementById('storageWarning');
    if (!w) return { text: '(no #storageWarning element on the page)', onScreen: false };
    return { text: w.textContent, onScreen: !w.hidden && w.getBoundingClientRect().height > 0 };
  });

  let wv = await warn(firstVisit);
  check('a first-time visitor is told out loud that nothing is being saved',
        wv.onScreen && /NOT BEING SAVED/.test(wv.text) && /export/i.test(wv.text),
        JSON.stringify(wv));
  check('and the sample-student intro does not wipe the warning off the screen',
        wv.onScreen &&
        /sample student/i.test(await firstVisit.evaluate(() =>
          document.getElementById('msg').textContent)),
        JSON.stringify(wv));

  // Now do what a teacher does: clear the sample and fill in a real child.
  await firstVisit.click('#sampleBtn');
  await firstVisit.type('#initials', 'R.L.');
  await firstVisit.type('#strengthsComment', 'Real work typed by a teacher.');
  wv = await warn(firstVisit);
  check('the warning is still there while a real assessment is being typed',
        wv.onScreen && /NOT BEING SAVED/.test(wv.text), JSON.stringify(wv));
  check('and it does not throw the assessment away while saying so',
        await firstVisit.evaluate(() =>
          document.getElementById('strengthsComment').value) !== '');

  // The transient message line clears itself after 12 seconds. The warning used
  // to live on that same line, so the screen went blank and never said it
  // again. Wait the timer out for real and check the warning outlives it.
  await firstVisit.evaluate(() => new Promise(r => setTimeout(r, 13000)));
  wv = await warn(firstVisit);
  check('and it is still there after every passing message has faded',
        wv.onScreen && /NOT BEING SAVED/.test(wv.text), JSON.stringify(wv));
  eq('the passing message line has indeed cleared itself by then',
     await firstVisit.evaluate(() => document.getElementById('msg').textContent), '');
  await firstVisit.close();

  // Storage blocked outright, so even READING throws. Same silent loss.
  const blocked = await browser.newPage();
  await blocked.evaluateOnNewDocument(() => {
    Storage.prototype.setItem = function(){ throw new Error('SecurityError'); };
    Storage.prototype.getItem = function(){ throw new Error('SecurityError'); };
  });
  await blocked.goto(base + '/index.html', { waitUntil: 'load' });
  wv = await warn(blocked);
  check('a browser that blocks storage completely gets the warning too',
        wv.onScreen && /NOT BEING SAVED/.test(wv.text), JSON.stringify(wv));
  await blocked.close();

  // Same bug class, one layer down: a save that succeeds used to take the
  // warning down even when the warning was about READING being blocked — which
  // a successful write says nothing about. The tool still will not remember
  // this between visits, so that warning has to stay up.
  const readOnly = await browser.newPage();
  await readOnly.evaluateOnNewDocument(() => {
    Storage.prototype.getItem = function(){ throw new Error('SecurityError'); };
  });
  await readOnly.goto(base + '/index.html', { waitUntil: 'load' });
  wv = await warn(readOnly);
  check('a browser that cannot be read back still says it will not remember',
        wv.onScreen && /will not let the tool remember/.test(wv.text), JSON.stringify(wv));
  await readOnly.close();

  // The path the old check was accidentally testing. Keep it — it is a real
  // path, it just is not the one that was broken.
  await page.evaluate(() => localStorage.setItem('social-studies-assessment',
    JSON.stringify({ initials: 'C.D.', date: '2026-08-07', scores: {},
                     strengths: 'earlier work', stretches: '', sample: false })));
  const returning = await browser.newPage();
  await returning.evaluateOnNewDocument(() => {
    Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); };
  });
  await returning.goto(base + '/index.html', { waitUntil: 'load' });
  await returning.type('#strengthsComment', 'x');
  wv = await warn(returning);
  check('a teacher coming back to saved work is warned as soon as they type',
        wv.onScreen && /NOT BEING SAVED/.test(wv.text), JSON.stringify(wv));
  await returning.close();

  // And the warning is not just always on: a working browser never sees it,
  // and a browser that recovers gets it taken away again.
  await fresh(page, base);
  wv = await warn(page);
  check('a browser that saves fine never shows the warning at all',
        !wv.onScreen && wv.text === '', JSON.stringify(wv));

  const recovers = await browser.newPage();
  await recovers.evaluateOnNewDocument(() => {
    window.__blocked = true;
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v){
      if (window.__blocked) throw new Error('QuotaExceededError');
      return real.call(this, k, v);
    };
  });
  await page.evaluate(() => localStorage.clear());
  await recovers.goto(base + '/index.html', { waitUntil: 'load' });
  check('the warning is up while the browser is refusing',
        (await warn(recovers)).onScreen);
  await recovers.evaluate(() => { window.__blocked = false; });
  await recovers.type('#strengthsComment', ' and now it works');
  wv = await warn(recovers);
  check('and it goes away by itself once a save actually succeeds',
        !wv.onScreen && (await recovers.evaluate(() =>
          !!localStorage.getItem('social-studies-assessment'))), JSON.stringify(wv));
  await recovers.close();

  // =========================================================================
  group('Clearing, and getting it back');
  // =========================================================================
  await fresh(page, base);
  await emptyForm(page);
  await page.type('#initials', 'E.F.');
  await score(page, 0, 'M');
  await page.type('#strengthsComment', 'typed work');

  await page.evaluate(() => { window.__confirms = []; window.__confirmReturn = false; });
  await page.click('button[onclick="clearForm()"]');
  s = await state(page);
  check('Clear asks before it destroys anything',
        (await page.evaluate(() => window.__confirms.length)) === 1,
        JSON.stringify(await page.evaluate(() => window.__confirms)));
  check('saying no to that question keeps the work',
        s.strengths === 'typed work' && s.scores['Participates in Discussions'] === 'Mastered',
        JSON.stringify(s));

  await page.evaluate(() => { window.__confirmReturn = true; });
  await page.click('button[onclick="clearForm()"]');
  s = await state(page);
  check('saying yes really does clear it',
        s.strengths === '' && s.initials === '' &&
        Object.values(s.scores).every(v => v === null), JSON.stringify(s));
  check('and the screen tells the teacher how to get it back',
        /Undo/.test(s.msg), s.msg);

  await page.click('#undoBtn');
  s = await state(page);
  check('Undo puts the whole assessment back',
        s.strengths === 'typed work' && s.initials === 'E.F.' &&
        s.scores['Participates in Discussions'] === 'Mastered', JSON.stringify(s));
  check('and the restored work survives a refresh too',
        await page.reload({ waitUntil: 'load' }).then(() => state(page))
          .then(x => x.strengths === 'typed work'));

  // =========================================================================
  group('The PDF');
  // =========================================================================
  await fresh(page, base);
  // Wrap jsPDF so the real handler runs end to end and every line it writes
  // can be read back with the y-coordinate it landed on.
  await page.evaluate(() => {
    window.__pdf = { texts: [], pages: 1, saved: null, height: 0 };
    const Real = window.jspdf.jsPDF;
    window.jspdf.jsPDF = function(opts){
      const inst = new Real(opts);
      window.__pdf.height = inst.internal.pageSize.getHeight();
      const realText = inst.text.bind(inst);
      inst.text = function(txt, x, y, o){
        (Array.isArray(txt) ? txt : [txt]).forEach(t =>
          window.__pdf.texts.push({ t: String(t), y: y }));
        return realText(txt, x, y, o);
      };
      const realAdd = inst.addPage.bind(inst);
      inst.addPage = function(){ window.__pdf.pages++; return realAdd(); };
      inst.save = function(n){ window.__pdf.saved = n; };
      return inst;
    };
  });

  // A very long strengths comment used to shove the growth-areas section down
  // to y=352mm on a 297mm page, where it was silently thrown away.
  await page.evaluate(() => {
    const long = 'She is doing well with this and keeps going. '.repeat(160);
    const st = document.getElementById('strengthsComment');
    st.value = long;
    st.dispatchEvent(new Event('input', { bubbles: true }));
    const sr = document.getElementById('stretchesComment');
    sr.value = 'ZZSTRETCHMARKER she still needs practice reading a map key.';
    sr.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#pdfBtn');
  const pdf = await page.evaluate(() => window.__pdf);

  const overflow = pdf.texts.filter(t => t.y > pdf.height);
  eq('nothing is written past the bottom edge of the paper', overflow.length, 0);
  check('a long strengths comment does not push the growth areas off the page',
        pdf.texts.some(t => /Stretches: Areas of Growth/.test(t.t)) &&
        pdf.texts.some(t => /ZZSTRETCHMARKER/.test(t.t)),
        JSON.stringify(pdf.texts.map(t => t.t).slice(-6)));
  check('the report carries a page break instead', pdf.pages > 1, `pages ${pdf.pages}`);
  check('the report says who it is about and when',
        pdf.texts.some(t => /Child: M\.T\./.test(t.t)),
        JSON.stringify(pdf.texts.slice(0, 5)));
  check('the sample student is labelled as a sample on the printed report',
        pdf.texts.some(t => /Sample student - Maya Torres/.test(t.t)),
        JSON.stringify(pdf.texts.slice(0, 5)));
  check('the PDF file is named for the child and the date',
        /^SAMPLE_social_studies_MT_\d{4}-\d{2}-\d{2}\.pdf$/.test(pdf.saved), pdf.saved);
  check('every category is on the report, including the unscored ones',
        pdf.texts.some(t => /Not yet assessed: /.test(t.t)));

  // =========================================================================
  group('When the PDF library cannot be downloaded');
  // =========================================================================
  const page3 = await browser.newPage();
  await page3.setViewport({ width: 1280, height: 1000 });
  await page3.setRequestInterception(true);
  page3.on('request', r => {
    if (/cdnjs\.cloudflare\.com/.test(r.url())) r.abort();
    else r.continue();
  });
  await page3.evaluateOnNewDocument(() => {
    window.__alert = null;
    window.alert = m => { window.__alert = String(m); };
  });
  await page3.goto(base + '/index.html', { waitUntil: 'load' });
  const offlineMsg = await page3.evaluate(() => document.getElementById('msg').textContent);
  check('a locked-down school network is explained on arrival, not on a dead click',
        /PDF library did not load/.test(offlineMsg), offlineMsg);
  await page3.click('#pdfBtn');
  const afterClick = await page3.evaluate(() => ({
    msg: document.getElementById('msg').textContent,
    alert: window.__alert
  }));
  check('clicking Export PDF says what still works instead of "please try again"',
        /Print, Export CSV and Export JSON all still work/.test(afterClick.msg) &&
        !/try again/i.test(afterClick.msg), afterClick.msg);
  eq('and it does not throw a browser alert at the teacher', afterClick.alert, null);
  check('Export CSV still works with the CDN blocked',
        await page3.evaluate(() => {
          try { exportCSV(); return true; } catch (e) { return String(e); }
        }) === true);
  await page3.close();

  // =========================================================================
  group('On a phone');
  // =========================================================================
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  const phone = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scoreButtonsOnScreen: [...document.querySelectorAll('.btn-score')]
      .filter(b => { const r = b.getBoundingClientRect();
                     return r.left >= 0 && r.right <= document.documentElement.clientWidth; }).length,
    totalScoreButtons: document.querySelectorAll('.btn-score').length
  }));
  check('the page does not run off the side of a phone screen',
        phone.scrollWidth <= phone.clientWidth + 1,
        `scrollWidth ${phone.scrollWidth} vs clientWidth ${phone.clientWidth}`);
  eq('every scoring button is reachable without scrolling sideways',
     phone.scoreButtonsOnScreen, phone.totalScoreButtons);
  await page.setViewport({ width: 1280, height: 1000 });

  // =========================================================================
  group('Keyboard and screen reader');
  // =========================================================================
  await fresh(page, base);
  const tiles = await page.evaluate(() =>
    [...document.querySelectorAll('.count-item')].map(el => el.tagName));
  eq('the three distribution tiles are real buttons, so Tab reaches them',
     tiles, ['BUTTON', 'BUTTON', 'BUTTON']);

  await page.click('.count-item.e');
  check('clicking a tile opens the list of categories at that level',
        await page.evaluate(() => document.getElementById('categoriesModal').classList.contains('show')));
  check('and focus moves into the dialog',
        await page.evaluate(() => document.activeElement.id) === 'modalContent',
        await page.evaluate(() => document.activeElement.id));
  await page.keyboard.press('Escape');
  check('Escape closes the dialog',
        await page.evaluate(() => !document.getElementById('categoriesModal').classList.contains('show')));

  check('no JavaScript errors after all of that',
        pageErrors.length === 0, pageErrors.join(' | '));
  check('no console errors after all of that',
        consoleErrors.length === 0, consoleErrors.join(' | '));

  await browser.close();
  srv.close();

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
