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
// Each check is named for what a PERSON would notice, not for the function
// involved. If you fix a new bug, add a check for it here the same day, while
// you still remember what went wrong.
//
// HOW TO RUN IT
// -------------
//     cd ~/Documents/GitHub/edtech-portfolio/social-studies-assessment-tool/tests
//     npm test
//
// It opens a real Google Chrome in the background, drives the tool with real
// clicks and real keypresses, and prints a line per check.
//
// It needs NOTHING on the internet. The one request the tool makes — the jsPDF
// library on cdnjs — is intercepted and blocked for every check, so the suite
// gives the same answer on a plane as it does at a desk. Where a check needs a
// working PDF library, a stand-in is installed inside the page that records
// what the tool asked it to draw; that is how the "measured at 9pt, printed at
// 10pt" bug is caught without opening a PDF reader.
//
// node_modules is NOT installed here. package.json runs node with NODE_PATH
// pointing at ../../running-record-tool/tests/node_modules, so puppeteer-core
// is shared with the running record tool and there is nothing to install.
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
// Chrome throws its coverage record away on every navigation and this suite
// reloads the page dozens of times. Left alone the report would describe only
// the LAST page load. Harvest before every navigation and start a new record.
const covRuns = [];
let COVERAGE = false;
async function harvest(page){
  if (!COVERAGE) return;
  try {
    covRuns.push(...await page.coverage.stopJSCoverage());
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
  } catch (e) { /* coverage not running yet */ }
}

// `load`, not `domcontentloaded`: a stylesheet or favicon still in flight when
// the first assertion runs lands in the console-error list a fraction of the
// time, and a test that is right nine times in ten just teaches you to ignore
// red. Wait for the page to be genuinely finished.
async function fresh(page, base){
  await harvest(page);
  await page.goto('about:blank');
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await harvest(page);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}
async function reload(page){
  await harvest(page);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

// The tool arrives with the sample student in it on purpose. Most checks want
// an empty form, which is one click on the same button.
async function emptyForm(page){
  await page.click('#sampleBtn');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

// Click the E / D / M button on the nth category row (0-based).
async function score(page, row, letter){
  const idx = { E: 0, D: 1, M: 2 }[letter];
  const handles = await page.$$(`.categories .category:nth-child(${row + 1}) .btn-score`);
  await handles[idx].click();
}

// Set a field the way a paste does — value plus the input event the tool listens
// for. Real keystrokes are used where the check is specifically about typing.
async function fill(page, id, text){
  await page.evaluate((id, text) => {
    const e = document.getElementById(id);
    e.value = text;
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }, id, text);
}

const answerConfirm = (page, yes) => page.evaluate(y => { window.__confirmAnswer = y; }, yes);

const state = page => page.evaluate(() => ({
  scores: { ...scores },
  sample: sampleMode,
  sampleBtn: document.getElementById('sampleBtn').textContent,
  sampleNote: document.getElementById('sampleNote').hidden
                ? '' : document.getElementById('sampleNote').textContent,
  initials: document.getElementById('initials').value,
  date: document.getElementById('adate').value,
  strengths: document.getElementById('strengthsComment').value,
  stretches: document.getElementById('stretchesComment').value,
  msg: document.getElementById('msg').textContent,
  notice: document.getElementById('notices').textContent,
  warning: document.getElementById('storageWarning').hidden
             ? '' : document.getElementById('storageWarning').textContent,
  undoShown: !document.getElementById('undoBtn').hidden,
  counts: { e: +document.getElementById('count-e').textContent,
            d: +document.getElementById('count-d').textContent,
            m: +document.getElementById('count-m').textContent },
  notYet: document.getElementById('notYet').textContent,
  stem: fileStem(),
  stored: localStorage.getItem(STORE_KEY),
  storedUndo: localStorage.getItem(UNDO_KEY)
}));

const chart = page => page.evaluate(() => {
  const svg = document.getElementById('pieChart');
  return {
    circles: svg.querySelectorAll('circle').length,
    wedges: svg.querySelectorAll('path').length + svg.querySelectorAll('circle').length,
    legendRows: svg.querySelectorAll('g').length,
    legendText: [...svg.querySelectorAll('g text')].map(t => t.textContent),
    text: [...svg.querySelectorAll('text')].map(t => t.textContent).join(' | '),
    circleR: svg.querySelector('circle') ? +svg.querySelector('circle').getAttribute('r') : 0
  };
});

// Read the last file the tool handed to the browser: its name and its contents.
const lastDownload = page => page.evaluate(async () => {
  const d = window.__downloads[window.__downloads.length - 1];
  if (!d) return null;
  return { name: d.name, text: d.blob ? await d.blob.text() : '' };
});

// A minimal CSV reader, so the escaping check is a real round-trip rather than
// a string comparison that a broken quote would still satisfy.
function parseCSV(text){
  const rows = [[]]; let cell = '', inQ = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (inQ){
      if (c === '"' && text[i+1] === '"'){ cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ','){ rows[rows.length-1].push(cell); cell = ''; }
    else if (c === '\n'){ rows[rows.length-1].push(cell); cell = ''; rows.push([]); }
    else if (c !== '\r') cell += c;
  }
  rows[rows.length-1].push(cell);
  return rows;
}

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
  await page.setViewport({ width: 1280, height: 900 });

  COVERAGE = process.argv.includes('--coverage');
  if (COVERAGE) await page.coverage.startJSCoverage({ resetOnNavigation: false });

  // --- the internet is not allowed in ------------------------------------
  // Every cdnjs request is blocked, so the tool behaves the same on this
  // machine as on a locked-down school network — and so the suite gives the
  // same answer with the wifi off. `cdnHangMs` holds the request open instead
  // of refusing it, which is the case that used to leave a white page.
  let cdnHangMs = 0;
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (/cdnjs\.cloudflare\.com/.test(req.url())){
      if (cdnHangMs) setTimeout(() => req.abort().catch(() => {}), cdnHangMs);
      else req.abort().catch(() => {});
      return;
    }
    req.continue().catch(() => {});
  });

  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // Chrome's message for a failed request is the same generic sentence
    // whatever the file was — the URL lives in location(), not in the text.
    const url = (m.location() && m.location().url) || '';
    if (/favicon/i.test(url)) return;
    if (/cdnjs\.cloudflare\.com/.test(url)) return;   // blocked on purpose
    consoleErrors.push(m.text() + (url ? '  [' + url + ']' : ''));
  });

  await page.evaluateOnNewDocument(() => {
    window.__printed = 0;
    window.__downloads = [];
    window.__confirmAnswer = true;
    window.__confirms = [];
    window.print = () => { window.__printed++; };

    // A browser that refuses to hand over storage at all — Safari's private
    // window. Switched on with ?nostorage so only the check that wants it gets
    // it, because every other check needs saving to work.
    if (location.search.indexOf('nostorage') !== -1){
      const real = window.localStorage;
      const stub = {
        getItem(){ throw new Error('storage is blocked in this browser'); },
        setItem(k, v){ return real.setItem(k, v); },
        removeItem(k){ return real.removeItem(k); },
        clear(){ return real.clear(); }
      };
      Object.defineProperty(window, 'localStorage', { get: () => stub, configurable: true });
    }
    window.confirm = m => { window.__confirms.push(String(m)); return window.__confirmAnswer; };
    window.alert = m => { window.__alert = String(m); };

    // Catch the download instead of writing to disk, and keep the Blob so the
    // check can read what was actually in the file.
    const realCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => { window.__lastBlob = blob; return realCreate(blob); };
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function(){
      if (this.hasAttribute('download')){
        window.__downloads.push({ name: this.getAttribute('download'), blob: window.__lastBlob });
        return;
      }
      return realClick.call(this);
    };

    // A stand-in for jsPDF. It records every call, and — this is the point —
    // its splitTextToSize wraps at a width that depends on the font size that
    // is set WHEN IT IS CALLED, exactly as the real one does. That is what
    // makes "measured at 9pt, printed at 10pt" visible to a test.
    window.__installFakePdf = () => {
      window.__pdfCalls = [];
      window.__pdfSaved = null;
      let fontSize = 16, pages = 1;
      function FakePDF(){
        this.internal = {
          pageSize: { getWidth: () => 210, getHeight: () => 297 },
          getNumberOfPages: () => pages
        };
      }
      FakePDF.prototype.setFontSize = function(n){ fontSize = n; };
      FakePDF.prototype.getFontSize = function(){ return fontSize; };
      FakePDF.prototype.setTextColor = function(){};
      FakePDF.prototype.text = function(t, x, y){
        window.__pdfCalls.push({ op: 'text', text: String(t), x, y, page: pages, fontSize });
      };
      FakePDF.prototype.splitTextToSize = function(t, w){
        window.__pdfCalls.push({ op: 'split', text: String(t), width: w, fontSize });
        const perLine = Math.max(4, Math.floor(w / (fontSize * 0.42)));
        const out = []; let cur = '';
        String(t).split(/\s+/).forEach(word => {
          if (cur && (cur + ' ' + word).length > perLine){ out.push(cur); cur = word; }
          else cur = cur ? cur + ' ' + word : word;
        });
        if (cur) out.push(cur);
        return out.length ? out : [''];
      };
      FakePDF.prototype.addPage = function(){
        pages++; window.__pdfCalls.push({ op: 'addPage', page: pages });
      };
      FakePDF.prototype.save = function(name){ window.__pdfSaved = name; };
      window.jspdf = { jsPDF: FakePDF };
    };

    // A PDF library that loaded but then fell over part way through. The tool
    // used to console.error this into a console nobody is looking at.
    window.__installBrokenPdf = () => {
      window.__installFakePdf();
      window.jspdf.jsPDF.prototype.splitTextToSize = function(){
        throw new Error('the font file is corrupt');
      };
    };
  });

  // =========================================================================
  group('Arriving  (was: an empty white rectangle and three zeroes)');
  // =========================================================================
  await fresh(page, base);

  check('page loads with no JavaScript errors',
        pageErrors.length === 0, pageErrors.join(' | '));
  check('page loads with no console errors',
        consoleErrors.length === 0, consoleErrors.join(' | '));

  {
    const s = await state(page);
    const c = await chart(page);
    check('a first-time visitor arrives at a filled-in sample, clearly named as one',
          s.sample === true && s.initials === 'M.T.' &&
          /Maya Torres/.test(s.sampleNote), JSON.stringify(s.sampleNote));
    check('the sample is mixed, not perfect — three different levels are on screen',
          s.counts.e === 2 && s.counts.d === 2 && s.counts.m === 2,
          JSON.stringify(s.counts));
    check('the chart on arrival is drawn, not an empty box',
          c.wedges === 3, JSON.stringify(c));
    check('one click clears the sample and empties the tool',
          true);
  }

  // -------------------------------------------------------------------------
  group('The sample student is never mistaken for a real record');
  // -------------------------------------------------------------------------
  {
    // WAS: the sample was written to localStorage on the very first visit, so
    // the second visit greeted the teacher with "Picked up where you left off"
    // over work she had never done.
    const s = await state(page);
    check('the sample student is not saved to this laptop as if it were your work',
          s.stored === null, String(s.stored).slice(0, 60));
    check('the tool explains the sample instead of claiming you left it here',
          /sample student/i.test(s.msg) && !/Picked up/.test(s.msg), s.msg);

    await reload(page);
    const s2 = await state(page);
    check('reloading still explains the sample rather than saying "picked up where you left off"',
          !/Picked up/.test(s2.msg) && s2.sample === true, s2.msg);
  }

  {
    // WAS: sample mode never switched off. A real child typed over Maya got a
    // report branded "Sample student - Maya Torres" and a SAMPLE_ filename.
    await fresh(page, base);
    await fill(page, 'initials', 'K.P.');
    let s = await state(page);
    check('typing a real child over the sample says which parts are still the sample',
          s.sample === true && /Part sample/.test(s.sampleNote) &&
          !/the initials/.test(s.sampleNote), s.sampleNote);
    check('the button admits it would now clear your own work too',
          /everything typed over it/.test(s.sampleBtn), s.sampleBtn);

    // FIXED CHECK: this used to paste straight over both comment boxes and then
    // assert that the label was gone. Replacing a box wholesale is the easy
    // moment — it passed just as happily while a box the teacher had only
    // EDITED was being handed over too (see the block below). The label going
    // has to be tied to Maya's words leaving, so her words are typed out here
    // rather than pasted over.
    await page.evaluate(() => {
      const t = document.getElementById('strengthsComment');
      t.focus(); t.select();
    });
    await page.keyboard.type('Kai explains his thinking to the group.');
    await fill(page, 'stretchesComment', 'Still learning to wait his turn.');
    for (let r = 0; r < 6; r++) await score(page, r, 'D');
    s = await state(page);
    check('once nothing of the sample is left, the record stops being labelled a sample',
          s.sample === false && s.sampleNote === '', s.sampleNote);
    check('and the button offers the sample again instead of offering to delete real work',
          s.sampleBtn === 'Try it with a sample student', s.sampleBtn);
    check('a real child\'s export filename is no longer prefixed SAMPLE_',
          !/^SAMPLE_/.test(s.stem), s.stem);
  }

  {
    // WAS: a box was handed over to the teacher on the FIRST keystroke, whatever
    // was left in it. A teacher who EDITS Maya's strengths note rather than
    // replacing it — clicks at the end, adds her own sentence — kept every one
    // of Maya's sentences on the sheet and lost the label entirely: no badge,
    // no SAMPLE_ prefix, and a real child's CSV going out with Maya's
    // grandmother's village in it as this child's strengths.
    await fresh(page, base);
    await fill(page, 'initials', 'P.Q.');
    // Click into the end of the strengths box and add a sentence, the way a
    // teacher who likes most of what is there does it.
    await page.evaluate(() => {
      const t = document.getElementById('strengthsComment');
      t.focus(); t.setSelectionRange(t.value.length, t.value.length);
    });
    await page.keyboard.type(' She also leads the line.');
    await fill(page, 'stretchesComment', 'Pia needs the map key explained again.');
    for (let r = 0; r < 6; r++) await score(page, r, 'D');
    let s = await state(page);
    check('a note the teacher edited rather than replaced is still named as the sample\'s',
          s.sample === true && /part of the strengths note/.test(s.sampleNote),
          s.sampleNote);
    check('and the sheet still carries the SAMPLE_ prefix while her words are in it',
          /^SAMPLE_/.test(s.stem), s.stem);
    check('and the one-click clear is not offered over a box with real typing in it',
          /everything typed over it/.test(s.sampleBtn), s.sampleBtn);

    await page.click('button[onclick="exportCSV()"]');
    const d = await lastDownload(page);
    check('the spreadsheet says the made-up paragraph in it is made up',
          /sample/i.test(d.text) && /^SAMPLE_/.test(d.name),
          d.name + ' | ' + (/sample/i.test(d.text) ? 'labelled' : 'NO LABEL ANYWHERE'));
    check('and Maya\'s sentences really are still in that file, which is the point',
          /grandmother’s village|grandmother's village/.test(d.text),
          d.text.slice(0, 80));

    // Take her words out for good and the labelling ends, exactly as before.
    await fill(page, 'strengthsComment', 'Pia explains her thinking to the group.');
    s = await state(page);
    check('and once her words are deleted the labelling stops',
          s.sample === false && s.sampleNote === '' && !/^SAMPLE_/.test(s.stem),
          s.sampleNote + ' | ' + s.stem);
  }

  {
    // WAS (the regression the first fix introduced): "is this still Maya's?"
    // was answered by comparing VALUES. A score is one of three buttons, so a
    // real child whose teacher genuinely meant Mastered on the two rows Maya
    // happened to be Mastered in kept the sample badge, kept "Still hers: 2
    // scores" in the CSV and the JSON, and kept SAMPLE_ on the filename — a
    // real child's report going out labelled as made up.
    await fresh(page, base);
    await fill(page, 'initials', 'R.K.');
    await fill(page, 'strengthsComment', 'Rae retells what the group decided and why.');
    await fill(page, 'stretchesComment', 'Maps are still guesswork for her.');
    // Every row scored by hand. Rows 0 and 2 land on Mastered — which is what
    // Maya had there — because that is genuinely what this teacher means.
    // (Tapping the level a row already holds takes it off, so it is tapped
    // twice: exactly what the teacher's hand does.)
    for (const row of [0, 2]) { await score(page, row, 'M'); await score(page, row, 'M'); }
    await score(page, 1, 'E');
    await score(page, 3, 'M');
    await score(page, 4, 'D');
    await score(page, 5, 'D');
    let s = await state(page);
    check('a real child who happens to score like Maya on a row is not called a sample',
          s.sample === false && s.sampleNote === '', s.sampleNote);
    check('and her filename carries no SAMPLE_ prefix',
          !/^SAMPLE_/.test(s.stem), s.stem);
    check('and the two rows she really did mean Mastered are still Mastered',
          s.counts.m === 3, JSON.stringify(s.counts));

    await page.click('button[onclick="exportCSV()"]');
    let d = await lastDownload(page);
    check('the spreadsheet does not tell the family part of this child is made up',
          !/sample/i.test(d.text) && !/Maya/.test(d.text) && !/^SAMPLE_/.test(d.name),
          d.name);
    await page.click('button[onclick="exportJSON()"]');
    d = await lastDownload(page);
    check('nor does the JSON file',
          !/Maya/.test(d.text) && !/^SAMPLE_/.test(d.name), d.name);
  }

  {
    // The other half of the same rule: a row the teacher has NOT touched still
    // holds Maya's score, and the badge has to keep saying so. Fixing the
    // false alarm above must not turn the label off while she is still here.
    await fresh(page, base);
    await fill(page, 'initials', 'R.K.');
    await fill(page, 'strengthsComment', 'Rae retells what the group decided.');
    await fill(page, 'stretchesComment', 'Maps are still guesswork.');
    for (const row of [0, 1, 2, 3]) { await score(page, row, 'D'); }
    const s = await state(page);
    check('rows the teacher never touched are still named as the sample\'s',
          s.sample === true && /Still hers: 2 scores/.test(s.sampleNote), s.sampleNote);
    check('and that half-and-half sheet keeps the SAMPLE_ prefix',
          /^SAMPLE_/.test(s.stem), s.stem);
  }

  {
    // A record saved by the version BEFORE the typed boxes were tracked has no
    // list of them in it. Left alone, reopening a saved sample would demote her
    // to "Part sample — still hers: 6 scores" and lose her name off the badge.
    await fresh(page, base);
    await page.evaluate(() => {
      const s = SAMPLE;
      localStorage.setItem('social-studies-assessment', JSON.stringify({
        initials: s.initials, date: '2026-08-11', scores: s.scores,
        strengths: s.strengths, stretches: s.stretches,
        sample: true, sampleScoreKeys: Object.keys(s.scores),
        updated: new Date().toISOString()
      }));
    });
    await reload(page);
    const s = await state(page);
    check('a sample saved by the previous version still opens as Maya Torres, named',
          s.sample === true && /Sample student — Maya Torres/.test(s.sampleNote),
          s.sampleNote);
    check('and the button offers to clear her in one click, as it did before',
          s.sampleBtn === 'Clear the sample student', s.sampleBtn);
  }

  {
    // WAS: the button four buttons from Clear still said "Clear the sample
    // student" over a real assessment, and wiped it with no confirm and no undo.
    await fresh(page, base);
    await fill(page, 'initials', 'R.L.');
    await answerConfirm(page, false);
    await page.click('#sampleBtn');
    let s = await state(page);
    check('clearing a part-typed-over sample asks first, and No keeps the work',
          s.initials === 'R.L.', s.initials);

    await answerConfirm(page, true);
    await page.click('#sampleBtn');
    s = await state(page);
    check('and when you say Yes it offers an Undo, exactly as Clear does',
          s.initials === '' && s.undoShown === true, JSON.stringify(s.initials));
  }

  // =========================================================================
  group('The chart  (was: one slice drew nothing at all)');
  // =========================================================================
  {
    await fresh(page, base);
    await emptyForm(page);
    let c = await chart(page);
    check('an empty tool says what to do instead of showing a blank white box',
          /Score a category/.test(c.text), c.text);

    await score(page, 0, 'E');
    c = await chart(page);
    check('the chart still draws after the very first click a visitor makes',
          c.wedges === 2, JSON.stringify(c));

    for (let r = 1; r < 6; r++) await score(page, r, 'E');
    c = await chart(page);
    check('the chart still draws when every category is the same level',
          c.circles === 1 && c.circleR === 50, JSON.stringify(c));
  }

  {
    // WAS: the pie was drawn over the SCORED categories only while the legend
    // added a grey "Not yet assessed" swatch for a wedge nobody drew — one
    // click produced a solid 100% circle for a child 1 of 6 assessed.
    await fresh(page, base);
    await emptyForm(page);
    await score(page, 0, 'M');
    const c = await chart(page);
    check('the pie and the labels beside it count the same six categories',
          c.wedges === c.legendRows && c.wedges === 2, JSON.stringify(c));
    check('one category scored out of six is not drawn as a whole circle',
          c.circles === 0, JSON.stringify(c));
    check('the labels say both what was scored and what was not',
          c.legendText.join(' ').includes('Mastered: 1') &&
          c.legendText.join(' ').includes('Not yet assessed: 5'),
          c.legendText.join(' | '));
  }

  {
    // WAS: clicking the wedge opened the drill-down; clicking the label beside
    // it did nothing, and nothing said any of it was clickable.
    await fresh(page, base);
    const opened = await page.evaluate(() => {
      const g = document.querySelector('#pieChart g');
      g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return document.getElementById('categoriesModal').classList.contains('show');
    });
    check('clicking the label beside a slice opens the same list the slice does', opened);
    const hint = await page.evaluate(() =>
      [...document.querySelectorAll('.hint')].map(h => h.textContent).join(' '));
    check('and the page says the chart can be clicked',
          /Click a slice/.test(hint), hint);
    await page.keyboard.press('Escape');
  }

  // =========================================================================
  group('Who it is, and when  (was: no name, no date, one filename for everyone)');
  // =========================================================================
  {
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'A.B.');
    await fill(page, 'adate', '2026-03-04');
    await score(page, 0, 'M');
    await page.click('button[onclick="exportCSV()"]');
    const d = await lastDownload(page);
    check('the export filename carries the initials and the date of the assessment',
          d.name === 'social_studies_AB_2026-03-04.csv', d.name);
    check('and the initials and the date are inside the file too',
          d.text.includes('A.B.') && d.text.includes('2026-03-04'), d.text.slice(0, 120));

    const maxlen = await page.evaluate(() => document.getElementById('initials').maxLength);
    eq('the child box takes initials only, never a full name', maxlen, 4);
  }

  {
    // WAS: every non-ASCII letter was deleted from the filename, so Á.É. and
    // Ø.Ø. both came out as the identical "no-initials" file.
    //
    // FIXED CHECK: this used to try Á.É. and stop there. Folding accents only
    // rescues the letters that fold to an A-Z one, so the check passed while
    // Ø.Ø., Đ.Đ., Ж.П. and 李.王. were ALL still exporting as
    // social_studies_no-initials_<date> — two of those children exported on the
    // same day still overwrote each other in Downloads, which is the whole
    // reason the filename carries the initials. One alphabet is not the test.
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'Á.É.');
    let s = await state(page);
    check('accented initials keep their letters in the filename instead of vanishing',
          /_AE_/.test(s.stem), s.stem);

    const stems = {};
    for (const ini of ['Á.É.', 'Ø.Ø.', 'Đ.Đ.', 'Ж.П.', '李.王.', 'A.B.']){
      await fill(page, 'initials', ini);
      stems[ini] = (await state(page)).stem;
    }
    const named = Object.keys(stems).filter(k => !/no-initials/.test(stems[k]));
    check('initials in any alphabet keep their letters, not just the accented Latin ones',
          named.length === 6, JSON.stringify(stems));
    check('so two children with different initials never get the same filename',
          new Set(Object.values(stems)).size === 6, JSON.stringify(stems));
  }

  {
    // WAS: a blank date was stored as "" and silently replaced with today on
    // every single open, so the record was re-dated every time it was reopened.
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'D.T.');
    await fill(page, 'adate', '');
    await reload(page);
    const s = await state(page);
    check('a record saved with no date is not silently re-dated to today on reopening',
          s.date === '', s.date);
    check('and its filename says the date is missing rather than claiming today',
          /_no-date$/.test(s.stem), s.stem);

    await page.click('button[onclick="exportCSV()"]');
    const d = await lastDownload(page);
    const rows = parseCSV(d.text);
    const dateRow = rows.find(r => r[0] === 'Date');
    check('the file and its name agree that the date is unknown',
          dateRow[1] === '' && /no-date/.test(d.name), JSON.stringify([dateRow, d.name]));
  }

  {
    // WAS: an impossible or half-typed date stayed visibly on screen while the
    // tool stored, exported and printed no date at all, saying nothing.
    await fresh(page, base);
    await emptyForm(page);
    // Empty the box first, so the keyboard lands on the month segment. Typing
    // 13 into a box that already holds a date edits whatever segment the click
    // happened to land on, which is not the case being tested.
    await fill(page, 'adate', '');
    await page.evaluate(() => document.getElementById('adate').focus());
    await page.keyboard.type('13');            // there is no thirteenth month
    await page.evaluate(() => new Promise(r => setTimeout(r, 50)));
    const bad = await page.evaluate(() => ({
      value: document.getElementById('adate').value,
      badInput: document.getElementById('adate').validity.badInput,
      notice: document.getElementById('notices').textContent
    }));
    check('the browser really does refuse that date rather than correcting it',
          bad.badInput === true && bad.value === '',
          JSON.stringify(bad.value) + ' badInput=' + bad.badInput);
    check('a date the browser cannot read says so instead of silently saving nothing',
          /not a date this browser can read/.test(bad.notice), bad.notice);

    // And it takes its own message down once the date is a real one again,
    // without disturbing the other standing notice sitting beside it.
    await fill(page, 'adate', '2026-06-09');
    const after = await state(page);
    check('and the warning goes when a real date is put in',
          !/not a date this browser can read/.test(after.notice) &&
          /PDF library did not load/.test(after.notice), after.notice);
  }

  {
    // WAS: the check above was the ONLY one, and it types into an empty box, so
    // the keyboard lands on the month segment and the browser refuses what it
    // gets — validity.badInput, which is the one thing checkDate() looked at.
    //
    // FIXED CHECK: that is the easy moment. Back-dating a sheet means clicking
    // into a box that ALREADY holds today, and a click a little right of the
    // middle lands on the YEAR. Type the date the ordinary way, 08112026, and
    // Chrome slid those digits through the year and kept six of them: the box
    // read 08/12/112026 and handed back "112026-08-12". That is not badInput —
    // the browser is perfectly happy with the year 112026 — so nothing warned,
    // the printed sheet and the PDF header both said "Date: —", and the CSV
    // cell, the JSON field and all three filenames carried the year 112026.
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'D.M.');
    const box = await page.$('#adate');
    const bb = await box.boundingBox();
    const tried = [];
    for (const frac of [0.35, 0.45, 0.55, 0.65, 0.75]){
      await fill(page, 'adate', '2026-08-12');
      await page.mouse.click(bb.x + bb.width * frac, bb.y + bb.height / 2);
      await page.keyboard.type('08112026');            // how anyone types a date
      await page.evaluate(() => new Promise(r => setTimeout(r, 40)));
      tried.push(await page.evaluate(() => document.getElementById('adate').value));
    }
    check('typing a date into the middle of the box cannot make a six-digit year',
          tried.every(v => /^\d{4}-\d{2}-\d{2}$/.test(v)), JSON.stringify(tried));

    const s = await state(page);
    check('and what the box shows is what the printed sheet says',
          /^Child: D\.M\. +Date: \d/.test(await page.evaluate(() => whoLine())),
          await page.evaluate(() => whoLine()));
    check('and the filename carries that same date',
          s.stem === 'social_studies_DM_' + s.date, s.stem + ' | ' + s.date);
  }

  {
    // The other half of the same defect, and the half a browser can still
    // produce: a record SAVED with a year the tool cannot print — by the
    // version that let one through, or by a hand-edited storage slot — used to
    // come back on screen, be greeted with "Picked up where you left off", and
    // print a blank date while the exports carried the year 112026.
    await fresh(page, base);
    await page.evaluate(() => localStorage.setItem('social-studies-assessment',
      JSON.stringify({ initials: 'D.M.', date: '112026-08-12',
        scores: { 'Participates in Discussions': 'Mastered' },
        strengths: '', stretches: '', sample: false,
        sampleScoreKeys: [], sampleTextKeys: [], updated: new Date().toISOString() })));
    await reload(page);
    let s = await state(page);
    check('a date the tool cannot print says so instead of blanking the sheet in silence',
          /not a year this tool can print/.test(s.notice), s.notice);
    check('and the printed date, the filename and the box no longer disagree',
          (await page.evaluate(() => document.getElementById('datePrint').textContent)) === '' &&
          /_no-date$/.test(s.stem), s.stem);

    await page.click('button[onclick="exportCSV()"]');
    let d = await lastDownload(page);
    const dateRow = parseCSV(d.text).find(r => r[0] === 'Date');
    check('the spreadsheet does not carry a year the report refuses to print',
          dateRow[1] === '' && /no-date/.test(d.name),
          JSON.stringify([dateRow, d.name]));
    await page.click('button[onclick="exportJSON()"]');
    d = await lastDownload(page);
    check('nor does the JSON file',
          JSON.parse(d.text).date === '' && /no-date/.test(d.name), d.name);

    await fill(page, 'adate', '2026-05-04');
    s = await state(page);
    check('and putting a real date in takes the warning down and re-dates everything',
          !/not a year this tool can print/.test(s.notice) &&
          s.stem === 'social_studies_DM_2026-05-04', s.stem);
  }

  // =========================================================================
  group('Nothing is lost  (was: a reload wiped a finished assessment)');
  // =========================================================================
  {
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'S.K.');
    await score(page, 0, 'M');
    await score(page, 3, 'E');
    await reload(page);
    const s = await state(page);
    check('scores and initials are still there after a refresh',
          s.initials === 'S.K.' &&
          s.scores['Participates in Discussions'] === 'Mastered' &&
          s.scores['Participates in Shared Research Projects'] === 'Emerging',
          JSON.stringify(s.scores));
    check('and the tool says it picked the work up, and when it was last saved',
          /Picked up where you left off/.test(s.msg) && /Last saved/.test(s.msg), s.msg);
  }

  {
    // WAS: a comment only reached storage when the box was blurred, so a
    // teacher who typed and shut the laptop lost every word of it.
    await fresh(page, base);
    await emptyForm(page);
    await page.click('#strengthsComment');
    await page.keyboard.type('She notices when a rule is unfair.');
    // Deliberately no blur, no click elsewhere, no Tab.
    await reload(page);
    const s = await state(page);
    check('a comment typed and never clicked out of is still there after a refresh',
          s.strengths === 'She notices when a rule is unfair.', s.strengths);
  }

  {
    // WAS: setItem throwing (Safari private window, full disk) died silently
    // and a whole assessment was typed into nothing.
    await fresh(page, base);
    await emptyForm(page);
    await page.evaluate(() => {
      localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    });
    await fill(page, 'initials', 'Q.Q.');
    let s = await state(page);
    check('a browser that refuses to save says so on screen, in words',
          /NOT BEING SAVED/.test(s.warning), s.warning);

    // And it takes the warning down again when saving genuinely starts working
    // — a disk that had filled up and was then cleared.
    await page.evaluate(() => {
      delete localStorage.setItem;
      localStorage.setItem = Storage.prototype.setItem.bind(localStorage);
    });
    await fill(page, 'initials', 'Q.R.');
    s = await state(page);
    check('and takes the warning down once saving works again',
          s.warning === '' && JSON.parse(s.stored).initials === 'Q.R.', s.warning);
  }

  {
    // WAS: when the browser blocks storage outright, reading throws too — and
    // the sentence the tool showed was about the wrong thing entirely.
    await harvest(page);   // or this page's coverage is thrown away on navigation
    await page.goto('about:blank');
    await page.goto(base + '/index.html?nostorage', { waitUntil: 'load' });
    // state() reads localStorage, which is exactly what is broken here, so this
    // one check reads the screen directly.
    const s = await page.evaluate(() => ({
      notice: document.getElementById('notices').textContent,
      sample: sampleMode,
      m: +document.getElementById('count-m').textContent
    }));
    check('a browser that will not hand over storage at all is explained, not ignored',
          /will not let the tool remember anything between visits/.test(s.notice),
          s.notice);
    check('and the tool still works — the sample is on screen',
          s.sample === true && s.m === 2, JSON.stringify(s));
  }

  {
    // WAS: two tabs shared one slot with no coordination — one keystroke in the
    // older tab destroyed the finished assessment in the newer one.
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'T.1');
    await page.evaluate(k => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: k, newValue: JSON.stringify({ initials: 'T.2', scores: {} })
      }));
    }, 'social-studies-assessment');
    let s = await state(page);
    check('when another tab saves, this tab says on screen that it is not the saved copy',
          /NOT THE SAVED COPY/.test(s.warning), s.warning);
    check('and explains what to do about it',
          /another tab/.test(s.notice) && /set aside/.test(s.notice), s.notice);

    // The teacher carries on in THIS tab, so this tab takes the saving back —
    // and the copy it replaces is set aside rather than destroyed.
    await fill(page, 'initials', 'T.3');
    s = await state(page);
    check('typing in this tab starts it saving again',
          JSON.parse(s.stored).initials === 'T.3', s.stored.slice(0, 60));
    check('and it says so, rather than leaving the red line up',
          /SAVING AGAIN/.test(s.warning), s.warning);
    const aside = await page.evaluate(() =>
      localStorage.getItem('social-studies-assessment-other-tab'));
    check('the other tab\'s copy is set aside on this laptop, not written over',
          /T\.2/.test(String(aside)), String(aside).slice(0, 90));
  }

  {
    // WAS: the guard hung entirely on the `storage` event. Driving two real
    // tabs in a real Chrome, that event reached the tab on top and did NOT
    // reach the one behind it within five seconds — so a teacher coming back
    // to the tab that never heard would write straight over the other tab's
    // finished assessment, silently. Here the event is never fired at all:
    // storage simply changes underneath this tab, the way it does when the
    // browser has not told it.
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'N.1');
    await page.evaluate(() => localStorage.setItem('social-studies-assessment',
      JSON.stringify({ initials: 'N.2', date: '2026-08-11',
        scores: { 'Asks On-Topic Questions': 'Mastered' },
        strengths: 'the other tab’s child', stretches: '', sample: false })));
    await fill(page, 'initials', 'N.3');
    const s = await state(page);
    check('a tab that was never told still checks before it writes',
          JSON.parse(s.stored).initials === 'N.3', s.stored.slice(0, 60));
    const aside = await page.evaluate(() =>
      localStorage.getItem('social-studies-assessment-other-tab'));
    check('and sets the other tab\'s assessment aside instead of destroying it',
          /N\.2/.test(String(aside)) && /other tab/.test(String(aside)),
          String(aside).slice(0, 90));
    check('and says on screen that it has taken the saving over',
          /SAVING AGAIN/.test(s.warning), s.warning);
  }

  {
    // WAS (this is the regression the first fix introduced): a `storage` event
    // reaches every tab EXCEPT the one that wrote, so "stop saving when another
    // tab saves" switched off the WRONG tab. Open tab A, open tab B, touch tab
    // A — and tab B, the newer one the teacher was about to carry on in, was
    // locked out for good. Everything typed in B after that went nowhere.
    //
    // Two real tabs here, not a hand-made StorageEvent: the whole defect was
    // about which tab the browser delivers that event to.
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'A.A.');

    const tabB = await browser.newPage();
    await tabB.setRequestInterception(true);
    tabB.on('request', req => {
      if (/cdnjs\.cloudflare\.com/.test(req.url())) return req.abort().catch(() => {});
      req.continue().catch(() => {});
    });
    await tabB.goto(base + '/index.html', { waitUntil: 'load' });
    check('the second tab opens on the assessment the first tab saved',
          (await tabB.evaluate(() => document.getElementById('initials').value)) === 'A.A.',
          await tabB.evaluate(() => document.getElementById('initials').value));

    // Back to tab A for one keystroke. Tab B is the one the browser tells.
    await fill(page, 'initials', 'A.B.');
    await tabB.waitForFunction(
      () => !document.getElementById('storageWarning').hidden, { timeout: 4000 });

    // Now the teacher goes back to tab B and carries on working there.
    await tabB.evaluate(() => {
      const e = document.getElementById('initials');
      e.value = 'B.B.';
      e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await tabB.evaluate(() => setScore(categories[0], 'Mastered'));
    const after = await tabB.evaluate(() => ({
      stored: localStorage.getItem('social-studies-assessment'),
      warning: document.getElementById('storageWarning').hidden
                 ? '' : document.getElementById('storageWarning').textContent,
      aside: localStorage.getItem('social-studies-assessment-other-tab')
    }));
    const rec = JSON.parse(after.stored);
    check('the tab the teacher is actually working in is still saving',
          rec.initials === 'B.B.' &&
          rec.scores['Participates in Discussions'] === 'Mastered',
          after.stored.slice(0, 80));
    check('it says it has taken the saving back rather than that it has stopped',
          /SAVING AGAIN/.test(after.warning) && !/STOPPED SAVING/.test(after.warning),
          after.warning);
    check('and what the other tab had saved is still on this laptop',
          /A\.B\./.test(String(after.aside)), String(after.aside).slice(0, 90));

    // And back to tab A, which in a real Chrome is not always told any of this.
    // It must not write over tab B's child on the strength of not having heard.
    await fill(page, 'initials', 'A.C.');
    const back = await page.evaluate(() => ({
      stored: localStorage.getItem('social-studies-assessment'),
      aside: localStorage.getItem('social-studies-assessment-other-tab'),
      warning: document.getElementById('storageWarning').hidden
                 ? '' : document.getElementById('storageWarning').textContent
    }));
    check('going back to the first tab and typing saves there, and says so',
          JSON.parse(back.stored).initials === 'A.C.' && /SAVING AGAIN/.test(back.warning),
          back.stored.slice(0, 60) + ' | ' + back.warning.slice(0, 40));
    check('and the child finished in the second tab is set aside, not lost',
          /B\.B\./.test(String(back.aside)), String(back.aside).slice(0, 90));

    // FIXED CHECK: the line above only ever looked at the copy set aside by the
    // LAST handover, so it passed while the set-aside was a single slot that
    // every handover wrote over. Two tabs hand the assessment back and forth
    // all afternoon; "set aside, not lost" was only true until the next one.
    check('and so is the copy the handover before it set aside',
          /A\.B\./.test(String(back.aside)), String(back.aside).slice(0, 200));

    // Two more ping-pongs on top, which is what an afternoon of this looks like.
    await tabB.evaluate(() => {
      const e = document.getElementById('initials');
      e.value = 'B.C.'; e.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await fill(page, 'initials', 'A.D.');
    const later = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('social-studies-assessment-other-tab')));
    const setAsideInitials = later.map(e =>
      e.record ? JSON.parse(e.record).initials : null);
    // A.A. is not in here and should not be: tab B opened ON A.A. and never
    // displaced it. Every handover after that displaced a copy, and all four
    // are still on this laptop.
    check('every handover keeps its own copy, so a later one does not cost an earlier one',
          ['A.B.', 'B.B.', 'A.C.', 'B.C.'].every(i => setAsideInitials.indexOf(i) >= 0) &&
          setAsideInitials.length === 4,
          JSON.stringify(setAsideInitials));
    await tabB.close();
  }

  {
    // Keeping every handover means the set-aside grows, and a laptop that is
    // out of room is exactly where a teacher does NOT want the tool to give up
    // and lose the copy it is holding right now. The oldest goes first and the
    // newest is never the one dropped. localStorage is made to refuse the write
    // from the test, the same way ?nostorage does for save().
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'Q.1');
    await page.evaluate(k => {
      localStorage.setItem(k, JSON.stringify([
        { record: '{"initials":"OLDEST"}', undo: null, setAside: '2026-08-01T00:00:00.000Z' },
        { record: '{"initials":"MIDDLE"}', undo: null, setAside: '2026-08-02T00:00:00.000Z' },
        { record: '{"initials":"NEWEST"}', undo: null, setAside: '2026-08-03T00:00:00.000Z' }
      ]));
      // Room for three entries and not one more.
      const real = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (key, value) => {
        if (key === k && JSON.parse(value).length > 3){
          const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e;
        }
        return real(key, value);
      };
    }, 'social-studies-assessment-other-tab');
    // Another tab saves underneath this one, then the teacher types here.
    await page.evaluate(() => localStorage.setItem('social-studies-assessment',
      JSON.stringify({ initials: 'Q.2', date: '2026-08-11', scores: {},
                       strengths: '', stretches: '', sample: false })));
    await fill(page, 'initials', 'Q.3');
    const tight = await page.evaluate(() => ({
      list: JSON.parse(localStorage.getItem('social-studies-assessment-other-tab')),
      stored: localStorage.getItem('social-studies-assessment')
    }));
    const kept = tight.list.map(e => JSON.parse(e.record).initials);
    check('when the laptop is out of room the oldest set-aside copy goes, not the newest',
          kept.length === 3 && kept.indexOf('OLDEST') < 0 &&
          kept[kept.length - 1] === 'Q.2', JSON.stringify(kept));
    check('and this tab still saves the child in front of the teacher',
          JSON.parse(tight.stored).initials === 'Q.3', tight.stored.slice(0, 60));

    // And when there is no room for even one, it stops rather than spinning.
    await page.evaluate(k => {
      const real = Storage.prototype.setItem.bind(localStorage);
      localStorage.setItem = (key, value) => {
        if (key === k) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
        return real(key, value);
      };
      localStorage.setItem('social-studies-assessment',
        JSON.stringify({ initials: 'Q.4', date: '2026-08-11', scores: {},
                         strengths: '', stretches: '', sample: false }));
    }, 'social-studies-assessment-other-tab');
    await fill(page, 'initials', 'Q.5');
    const full = await page.evaluate(() => ({
      stored: localStorage.getItem('social-studies-assessment'),
      list: localStorage.getItem('social-studies-assessment-other-tab')
    }));
    check('a laptop with no room at all still saves the child on screen, and says nothing false',
          JSON.parse(full.stored).initials === 'Q.5' &&
          JSON.parse(full.list).length === 3, full.stored.slice(0, 60));
  }

  {
    // WAS: an unreadable saved record was overwritten by the sample student on
    // the spot, destroying the only copy with nothing said.
    await fresh(page, base);
    await page.evaluate(() => localStorage.setItem('social-studies-assessment', 'not json at all'));
    await reload(page);
    const kept = await page.evaluate(() => ({
      kept: localStorage.getItem('social-studies-assessment-unreadable'),
      notice: document.getElementById('notices').textContent,
      initials: document.getElementById('initials').value,
      msg: document.getElementById('msg').textContent
    }));
    check('a saved record the tool cannot read is set aside, not written over',
          kept.kept === 'not json at all', String(kept.kept));
    check('and the teacher is told it was found and what happened to it',
          /could not read/.test(kept.notice), kept.notice);
    check('the sample student is not dropped on top of it',
          kept.initials === '', kept.initials);
  }

  {
    // WAS: valid JSON that was not a record at all — a number, a string, true —
    // counted as a successful restore and claimed "picked up where you left off"
    // over a completely blank form.
    await fresh(page, base);
    await page.evaluate(() => localStorage.setItem('social-studies-assessment', '12345'));
    await reload(page);
    const s = await state(page);
    check('a junk value in storage is not announced as your saved work',
          !/Picked up/.test(s.msg), s.msg);
  }

  {
    // WAS: a stored score that was not one of the three levels was copied
    // straight into the CSV, the JSON and the PDF as if it were a level.
    await fresh(page, base);
    await page.evaluate(() => localStorage.setItem('social-studies-assessment',
      JSON.stringify({ initials: 'Z.Z.', date: '2026-01-05',
        scores: { 'Participates in Discussions': 'Excellent!' },
        strengths: '', stretches: '', sample: false })));
    await reload(page);
    const s = await state(page);
    check('a score that is not one of the three levels is not treated as one',
          s.scores['Participates in Discussions'] === null,
          JSON.stringify(s.scores['Participates in Discussions']));
    await page.click('button[onclick="exportCSV()"]');
    const d = await lastDownload(page);
    check('and the export does not contradict the screen about it',
          !/Excellent!/.test(d.text) &&
          /Participates in Discussions,Not yet assessed/.test(d.text),
          d.text.split('\n').slice(5, 7).join(' | '));
  }

  // =========================================================================
  group('Clear, and getting it back  (was: one click destroyed everything)');
  // =========================================================================
  {
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'C.1');
    await score(page, 0, 'M');
    await answerConfirm(page, false);
    await page.click('button[onclick="clearForm()"]');
    let s = await state(page);
    check('Clear asks before it wipes anything, and No keeps the assessment',
          s.initials === 'C.1' && s.counts.m === 1, JSON.stringify(s.initials));

    await answerConfirm(page, true);
    await page.click('button[onclick="clearForm()"]');
    s = await state(page);
    check('saying Yes clears it and offers to put it back',
          s.initials === '' && s.counts.m === 0 && s.undoShown === true,
          JSON.stringify(s));
    check('and the message tells you how to get it back',
          /Undo the clear/.test(s.msg), s.msg);

    await page.click('#undoBtn');
    s = await state(page);
    check('Undo puts the whole assessment back',
          s.initials === 'C.1' && s.counts.m === 1 && s.undoShown === false,
          JSON.stringify(s.initials));
  }

  {
    // WAS: the Undo copy lived only in a page variable, so a refresh inside the
    // twenty-second window lost the work for good — while the message went on
    // promising it back.
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'F.5');
    await score(page, 1, 'D');
    await answerConfirm(page, true);
    await page.click('button[onclick="clearForm()"]');
    await reload(page);
    let s = await state(page);
    check('the Undo offer survives a refresh instead of dying with the tab',
          s.undoShown === true, JSON.stringify(s.undoShown));
    await page.click('#undoBtn');
    s = await state(page);
    check('and it still puts the work back after that refresh',
          s.initials === 'F.5' && s.counts.d === 1, JSON.stringify(s.initials));
  }

  {
    // WAS: the Undo button never went away and never asked. Clear child A,
    // assess child B, press Undo out of curiosity — child B was gone, screen
    // and storage both, with nothing left to press.
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'A.A.');
    await score(page, 0, 'M');
    await answerConfirm(page, true);
    await page.click('button[onclick="clearForm()"]');

    await fill(page, 'initials', 'B.B.');
    await score(page, 2, 'E');
    await answerConfirm(page, false);
    await page.click('#undoBtn');
    let s = await state(page);
    check('Undo asks before it replaces the child you are assessing now',
          s.initials === 'B.B.' && s.counts.e === 1, JSON.stringify(s.initials));

    await answerConfirm(page, true);
    await page.click('#undoBtn');
    s = await state(page);
    check('saying Yes brings the cleared child back',
          s.initials === 'A.A.' && s.counts.m === 1, JSON.stringify(s.initials));
    check('and the child who was on screen is now the thing Undo would put back',
          s.undoShown === true, JSON.stringify(s.undoShown));
    await page.click('#undoBtn');
    s = await state(page);
    check('so one more Undo brings that child back too — nobody is lost',
          s.initials === 'B.B.' && s.counts.e === 1, JSON.stringify(s.initials));
  }

  {
    // WAS: pressing Clear on an already-empty form asked nothing and silently
    // replaced the Undo copy with an empty record, while the button stayed lit
    // and the message kept promising the work back.
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'E.E.');
    await score(page, 0, 'M');
    await answerConfirm(page, true);
    await page.click('button[onclick="clearForm()"]');
    await page.click('button[onclick="clearForm()"]');   // second press, empty form
    let s = await state(page);
    check('pressing Clear on an empty form says so instead of quietly eating the Undo',
          /nothing to clear/.test(s.msg), s.msg);
    await page.click('#undoBtn');
    s = await state(page);
    check('and the Undo still holds the assessment, not an empty record',
          s.initials === 'E.E.' && s.counts.m === 1, JSON.stringify(s.initials));
  }

  {
    // WAS: the "is there anything on this form?" test did not look at the date
    // box at all. A teacher who back-dated the sheet to yesterday's lesson and
    // then pressed Clear was told "There is nothing to clear — the form is
    // already empty" about a form with a date typed into it.
    await fresh(page, base);
    await emptyForm(page);
    const yesterday = await page.evaluate(() => {
      const d = new Date(); d.setDate(d.getDate() - 1);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
             '-' + String(d.getDate()).padStart(2, '0');
    });
    await fill(page, 'adate', yesterday);
    check('a form holding a back-dated assessment does not report itself empty',
          (await page.evaluate(() => hasContent())) === true, '');

    await answerConfirm(page, true);
    await page.click('button[onclick="clearForm()"]');
    let s = await state(page);
    check('pressing Clear on it clears, instead of saying there is nothing to clear',
          !/nothing to clear/.test(s.msg) && /Undo/.test(s.msg), s.msg);
    check('and the date goes back to today',
          s.date === (await page.evaluate(() => todayISO())), s.date);
    const asked = await page.evaluate(() => window.__confirms[window.__confirms.length - 1]);
    check('and the question it asked said the date would go back',
          /date goes back to today/.test(asked), asked);

    // Today's date on its own is still not content: the box arrives filled in
    // and Clear puts today back, so an untouched form must still say so.
    await page.click('button[onclick="clearForm()"]');
    s = await state(page);
    check('but a form holding only today\'s date is still treated as empty',
          /nothing to clear/.test(s.msg), s.msg);
  }

  {
    // WAS: after a Clear, pressing "Try it with a sample student" threw the
    // pending Undo away with no confirm at all, because the emptied form made
    // the "is there work here?" test false.
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'U.N.');
    await score(page, 4, 'D');
    await answerConfirm(page, true);
    await page.click('button[onclick="clearForm()"]');
    await page.click('#sampleBtn');                       // loads Maya over the empty form
    let s = await state(page);
    check('loading the sample after a Clear does not quietly spend the Undo',
          s.undoShown === true, JSON.stringify(s.undoShown));
    await answerConfirm(page, true);
    await page.click('#undoBtn');
    s = await state(page);
    check('the cleared assessment is still what Undo puts back',
          s.initials === 'U.N.' && s.counts.d === 1, JSON.stringify(s.initials));
  }

  {
    // WAS: an overtaken tab went on writing the ONE shared Undo key, so the
    // Undo another tab had been promised came back as this tab's child.
    //
    // A tab is no longer locked out — the teacher working here takes the saving
    // back — so the guarantee is now that the other tab's Undo is SET ASIDE
    // before this tab writes its own, and can still be got at afterwards.
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'O.T.');
    await score(page, 0, 'M');
    await page.evaluate(k => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: k, newValue: JSON.stringify({ initials: 'other', scores: {} })
      }));
    }, 'social-studies-assessment');
    await page.evaluate(() => localStorage.setItem('social-studies-assessment-undo',
                                                   JSON.stringify({ marker: 'other tab' })));
    await answerConfirm(page, true);
    await page.click('button[onclick="clearForm()"]');
    const both = await page.evaluate(() => ({
      undo: localStorage.getItem('social-studies-assessment-undo'),
      aside: localStorage.getItem('social-studies-assessment-other-tab')
    }));
    check('this tab\'s own Undo is written, so Clear here really can be taken back',
          /O\.T\./.test(String(both.undo)), String(both.undo).slice(0, 60));
    check('and the other tab\'s Undo is set aside first, not simply written over',
          /other tab/.test(String(both.aside)), String(both.aside).slice(0, 90));
  }

  {
    // WAS: a mis-tapped score could be taken back in exactly one way — the
    // Clear button, which also wiped the other five rows and both comments.
    await fresh(page, base);
    await emptyForm(page);
    await score(page, 0, 'E');
    let s = await state(page);
    check('a score can be given', s.counts.e === 1, JSON.stringify(s.counts));
    await score(page, 0, 'E');
    s = await state(page);
    check('tapping the same level again takes a mis-clicked score back off',
          s.counts.e === 0 && s.scores['Participates in Discussions'] === null,
          JSON.stringify(s.counts));
  }

  // =========================================================================
  group('Exports  (was: a dead button, and a spreadsheet with no comments in it)');
  // =========================================================================
  {
    await fresh(page, base);
    let s = await state(page);
    check('when the PDF library is blocked, the tool says so in plain words',
          /PDF library did not load/.test(s.notice), s.notice);
    check('and names what still works',
          /Export CSV/.test(s.notice) && /Print/.test(s.notice), s.notice);

    // WAS: that warning shared the one message line with every timed toast, so
    // the tool's own recommended first click painted straight over it.
    await page.click('#sampleBtn');
    await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
    s = await state(page);
    check('and it is still on screen after the next ordinary message',
          /PDF library did not load/.test(s.notice), s.notice);

    await page.click('#pdfBtn');
    s = await state(page);
    check('pressing Export PDF while it is blocked explains, instead of doing nothing',
          /PDF library did not load/.test(s.notice), s.notice);
  }

  {
    // WAS: exportCSV() read both comment boxes into variables at the top of the
    // function and then never wrote them.
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'M.C.');
    await fill(page, 'adate', '2026-05-06');
    const tricky = 'He said "that is not fair", then, on the mat,\nhe explained why.';
    await fill(page, 'strengthsComment', tricky);
    await fill(page, 'stretchesComment', 'Needs the map key again, every time.');
    await score(page, 0, 'M');
    await page.click('button[onclick="exportCSV()"]');
    const d = await lastDownload(page);
    const rows = parseCSV(d.text);
    const row = k => (rows.find(r => r[0] === k) || []);
    check('the spreadsheet contains the strengths comment the teacher typed',
          row('Strengths')[1] === tricky, JSON.stringify(row('Strengths')[1]));
    check('quotes, commas and line breaks inside a comment survive the round trip',
          row('Strengths')[1] === tricky, '');
    check('the stretches comment is in there too',
          row('Stretches: Areas of Growth')[1] === 'Needs the map key again, every time.',
          JSON.stringify(row('Stretches: Areas of Growth')[1]));
    check('every category has a row, including the ones nobody scored',
          rows.filter(r => r.length === 2 &&
            ['Mastered','Developing','Emerging','Not yet assessed'].includes(r[1])).length === 6,
          String(rows.length));
  }

  {
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'J.S.');
    await fill(page, 'adate', '2026-05-06');
    await fill(page, 'strengthsComment', 'Asks about everything.');
    await page.click('button[onclick="exportJSON()"]');
    const d = await lastDownload(page);
    const j = JSON.parse(d.text);
    check('the JSON export carries the initials, the date and the comments',
          j.initials === 'J.S.' && j.date === '2026-05-06' &&
          j.strengths === 'Asks about everything.', JSON.stringify(j).slice(0, 120));
    check('and its filename says who and when',
          d.name === 'social_studies_JS_2026-05-06.json', d.name);
  }

  // =========================================================================
  group('The PDF report  (was: sentences that ran off the edge of the paper)');
  // =========================================================================
  {
    await fresh(page, base);                 // arrives as Maya: two Mastered rows
    await page.evaluate(() => window.__installFakePdf());
    await page.click('#pdfBtn');
    const calls = await page.evaluate(() => window.__pdfCalls);
    const splits = calls.filter(c => c.op === 'split');
    const stretchSplit = splits.find(c => /wander off the topic/.test(c.text));
    const strengthSplit = splits.find(c => /grandmother/.test(c.text));
    // WAS: the stretches paragraph was measured at 9pt — left over from the
    // "Mastered Categories" list — and then printed at 10pt, about 11% wider
    // than it had been measured, so every full line ran off the right edge.
    check('the stretches paragraph is measured at the size it is printed at',
          stretchSplit && stretchSplit.fontSize === 10,
          stretchSplit ? 'measured at ' + stretchSplit.fontSize : 'no split call found');
    check('so is the strengths paragraph',
          strengthSplit && strengthSplit.fontSize === 10,
          strengthSplit ? 'measured at ' + strengthSplit.fontSize : 'no split call found');
    const printedAt = calls.filter(c => c.op === 'text' && /wander off the topic/.test(c.text));
    check('and the lines of it are printed at that same size',
          printedAt.length > 0 && printedAt.every(c => c.fontSize === 10),
          JSON.stringify(printedAt.map(c => c.fontSize)));
    const saved = await page.evaluate(() => window.__pdfSaved);
    check('the sample student\'s PDF is named as a sample',
          /^SAMPLE_social_studies_MT_/.test(saved), String(saved));
  }

  {
    // WAS: one arrow, tick or CJK character anywhere in a comment turned that
    // whole comment into spaced-out glyphs on one unwrapped line that ran off
    // the paper — silently missing from the file a family receives.
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'strengthsComment', 'Maya → the map ✓ and 日本 too, and she keeps going.');
    await page.evaluate(() => window.__installFakePdf());
    await page.click('#pdfBtn');
    const calls = await page.evaluate(() => window.__pdfCalls);
    const bad = calls.filter(c => c.op === 'text' || c.op === 'split')
                     .filter(c => [...c.text].some(ch => ch.charCodeAt(0) > 0xFF))
                     .map(c => c.text);
    check('a symbol the PDF font cannot draw does not run the comment off the page',
          bad.length === 0, bad.join(' | ').slice(0, 120));
    const split = calls.find(c => c.op === 'split' && /Maya/.test(c.text));
    check('the arrow and the tick are turned into words the reader can read',
          split && /->/.test(split.text) && /yes/.test(split.text),
          split ? split.text.slice(0, 60) : 'no split');
  }

  {
    // WAS: when the report ran to two pages, page 2 carried no initials, no
    // date, no page number — and for the sample, no "made-up scores" label.
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'P.2');
    await fill(page, 'adate', '2026-02-02');
    await fill(page, 'strengthsComment', ('She explains her thinking clearly. ').repeat(120));
    await page.evaluate(() => window.__installFakePdf());
    await page.click('#pdfBtn');
    const calls = await page.evaluate(() => window.__pdfCalls);
    const pages = Math.max(...calls.map(c => c.page || 1));
    check('a long report really does run to more than one page', pages > 1, String(pages));
    const p2 = calls.filter(c => c.op === 'text' && c.page === 2).map(c => c.text);
    check('page two says who the report is for',
          p2.some(t => /P\.2/.test(t)) && p2.some(t => /2 Feb 2026/.test(t)),
          p2.slice(0, 3).join(' | '));
    check('and page two is numbered',
          p2.some(t => /^Page 2$/.test(t)), p2.slice(0, 3).join(' | '));
  }

  {
    // A detached second sheet of a SAMPLE report must still say it is made up.
    await fresh(page, base);
    await fill(page, 'strengthsComment',
      (await page.evaluate(() => SAMPLE.strengths)) + ' ' +
      ('She keeps asking about it for days afterwards. ').repeat(90));
    await page.evaluate(() => window.__installFakePdf());
    await page.click('#pdfBtn');
    const p2 = await page.evaluate(() =>
      window.__pdfCalls.filter(c => c.op === 'text' && c.page === 2).map(c => c.text));
    check('page two of a sample report still says the scores are made up',
          p2.some(t => /Maya Torres/.test(t)), p2.slice(0, 4).join(' | '));
  }

  {
    // WAS: a PDF library that loaded and then fell over half way through wrote
    // "PDF Export Error" to a console nobody is looking at, and the button
    // simply did nothing.
    await fresh(page, base);
    await page.evaluate(() => window.__installBrokenPdf());
    await page.click('#pdfBtn');
    const s = await state(page);
    check('a PDF that fails half way through says so, and names what still works',
          /could not be made/.test(s.notice) && /Export CSV/.test(s.notice), s.notice);
  }

  // =========================================================================
  group('On paper  (was: comments cut off and the child\'s level in white ink)');
  // =========================================================================
  {
    await fresh(page, base);
    const printed = await page.evaluate(() => ({
      strengths: document.getElementById('strengthsPrint').textContent,
      box: document.getElementById('strengthsComment').value
    }));
    check('the printed sheet carries the whole comment, not the slice that fits the box',
          printed.strengths === printed.box && printed.strengths.length > 100,
          String(printed.strengths.length));

    await page.emulateMediaType('print');
    const paper = await page.evaluate(() => {
      const cs = el => getComputedStyle(el);
      const scored = document.querySelector('.btn-score.m');
      const unscored = [...document.querySelectorAll('.btn-score')]
        .find(b => !b.classList.contains('e') && !b.classList.contains('d') && !b.classList.contains('m'));
      return {
        scoredColor: cs(scored).color,
        scoredBorder: cs(scored).borderTopWidth,
        unscoredColor: cs(unscored).color,
        textareaShown: cs(document.getElementById('strengthsComment')).display,
        copyShown: cs(document.getElementById('strengthsPrint')).display,
        dateBoxShown: cs(document.getElementById('adate')).display,
        datePrint: document.getElementById('datePrint').textContent,
        actionsShown: cs(document.querySelector('.actions')).display
      };
    });
    check('the level the child actually got prints in dark ink, not white on white',
          paper.scoredColor === 'rgb(0, 0, 0)', paper.scoredColor);
    check('and it is boxed, so it survives a printer with background colours off',
          parseFloat(paper.scoredBorder) >= 3, paper.scoredBorder);
    check('the comment boxes are replaced by plain text that cannot be cut off',
          paper.textareaShown === 'none' && paper.copyShown === 'block',
          paper.textareaShown + ' / ' + paper.copyShown);
    // WAS: the same date printed twice in two different formats, one of them
    // locale-ambiguous — 08/12/2026 from the date box and 2026-08-12 under it.
    check('the date appears once on paper, in one unambiguous format',
          paper.dateBoxShown === 'none' && /^\d{1,2} [A-Z][a-z]{2} \d{4}$/.test(paper.datePrint),
          paper.dateBoxShown + ' / ' + paper.datePrint);
    check('the buttons do not print',
          paper.actionsShown === 'none', paper.actionsShown);

    const sampleOnPaper = await page.evaluate(() =>
      document.getElementById('printSample').textContent);
    check('a sample student is labelled as one on the printed sheet',
          /Maya Torres/.test(sampleOnPaper), sampleOnPaper);
    await page.emulateMediaType(null);
  }

  // =========================================================================
  group('Reaching it  (was: a dialog that was not one, and 29px targets)');
  // =========================================================================
  {
    await fresh(page, base);
    await page.click('#tile-e');
    const openList = await page.evaluate(() =>
      document.querySelectorAll('#modalCategoriesList .category-item').length);
    eq('the drill-down lists the categories at that level', openList, 2);

    // WAS: the dialog said aria-modal="true" and Tab walked straight out of it
    // onto the buttons behind the overlay, including Clear.
    let inside = true;
    for (let i = 0; i < 6; i++){
      await page.keyboard.press('Tab');
      inside = inside && await page.evaluate(() =>
        document.getElementById('categoriesModal').contains(document.activeElement));
    }
    check('the keyboard cannot Tab out of the open dialog onto Clear behind it',
          inside === true, 'focus escaped the dialog');

    // WAS: scoring a row while it was open left the dialog listing categories
    // that had moved, contradicting the count tile underneath it.
    await page.evaluate(() => setScore('Asks On-Topic Questions', 'Emerging'));
    const afterScore = await page.evaluate(() =>
      document.querySelectorAll('#modalCategoriesList .category-item').length);
    eq('the open dialog keeps up when a score changes behind it', afterScore, 3);

    // WAS: closing left the keyboard parked on the × inside a display:none
    // element, and the next Tab jumped past the whole scoring panel.
    await page.keyboard.press('Escape');
    const back = await page.evaluate(() => document.activeElement.id);
    eq('Escape closes it and puts the keyboard back where it came from', back, 'tile-e');

    // WAS: the small × was the only way out. Clicking the dim area around the
    // dialog is what most people try first.
    await page.click('#tile-m');
    await page.evaluate(() => {
      const m = document.getElementById('categoriesModal');
      m.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const closed = await page.evaluate(() =>
      !document.getElementById('categoriesModal').classList.contains('show'));
    check('clicking the dim area around the dialog closes it', closed);
  }

  {
    // A level nobody has scored has to say so, not open an empty box.
    await fresh(page, base);
    await emptyForm(page);
    await score(page, 0, 'E');
    await page.click('#tile-m');
    const empty = await page.evaluate(() =>
      document.getElementById('modalCategoriesList').textContent);
    check('a level with nothing in it says so instead of opening an empty box',
          /No categories at this level/.test(empty), empty);
    await page.keyboard.press('Escape');
  }

  {
    // WAS: pressing "Try it with a sample student" over a real assessment
    // overwrote six scores and both comments with Maya's, without asking.
    await fresh(page, base);
    await emptyForm(page);
    await fill(page, 'initials', 'W.K.');
    await score(page, 0, 'M');
    await answerConfirm(page, false);
    await page.click('#sampleBtn');
    let s = await state(page);
    check('loading the sample over a real assessment asks first, and No keeps it',
          s.initials === 'W.K.' && s.sample === false, JSON.stringify(s.initials));

    await answerConfirm(page, true);
    await page.click('#sampleBtn');
    s = await state(page);
    check('saying Yes loads the sample and offers to put the real work back',
          s.initials === 'M.T.' && s.sample === true && s.undoShown === true,
          JSON.stringify(s.initials));
    await page.click('#undoBtn');
    s = await state(page);
    check('and that Undo really does put the real child back',
          s.initials === 'W.K.' && s.counts.m === 1, JSON.stringify(s.initials));
  }

  {
    // WAS: all eighteen scoring buttons announced themselves as just "E", "D"
    // or "M" — the same three letters six times over.
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll('.btn-score')].map(b => b.getAttribute('aria-label')));
    check('every scoring button says which category it belongs to',
          labels.length === 18 && labels.every(l => l && l.includes(':')) &&
          labels[0] === 'Participates in Discussions: Emerging',
          labels.slice(0, 2).join(' | '));
  }

  {
    // WAS: #msg was the tool's only channel for reporting a state change and it
    // had no role and no aria-live, so Clear / Undo / PDF-blocked were
    // announced to nobody using a screen reader.
    const live = await page.evaluate(() => {
      const m = document.getElementById('msg');
      return { role: m.getAttribute('role'), live: m.getAttribute('aria-live') };
    });
    check('the message line is announced to a screen reader',
          live.role === 'status' && live.live === 'polite', JSON.stringify(live));
  }

  {
    // WAS: the two comment boxes set outline:none on focus, leaving only a
    // low-contrast border change as the keyboard focus indicator.
    await page.click('#strengthsComment');
    const outline = await page.evaluate(() =>
      getComputedStyle(document.getElementById('strengthsComment')).outlineWidth);
    check('the comment box shows where the keyboard is',
          parseFloat(outline) > 0, outline);
  }

  {
    // WAS: the only breakpoint was 700px, so an iPad in portrait — the device a
    // teacher actually holds — got 29x27px E/D/M buttons 8px apart.
    await page.setViewport({ width: 768, height: 1024 });
    await reload(page);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('.btn-score, .count-item, .actions button, #sampleBtn')]
        .filter(b => b.offsetParent !== null)     // a hidden Undo has no size to measure
        .map(b => { const r = b.getBoundingClientRect();
                    return { what: b.textContent.trim().slice(0, 14),
                             w: Math.round(r.width), h: Math.round(r.height) }; })
        .filter(r => r.w < 44 || r.h < 44));
    check('on an iPad in portrait every button is big enough to hit with a thumb',
          small.length === 0, JSON.stringify(small.slice(0, 4)));
  }

  {
    // WAS: at 320px the page scrolled sideways by 33px.
    await page.setViewport({ width: 320, height: 720 });
    await reload(page);
    const over = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth
    }));
    check('a 320px phone does not have to scroll sideways',
          over.scroll <= over.client, JSON.stringify(over));
    await page.setViewport({ width: 1280, height: 900 });
  }

  // =========================================================================
  group('Reading it  (was: eight of nine text styles below the contrast floor)');
  // =========================================================================
  {
    await fresh(page, base);
    await page.evaluate(() => {
      // Put every surface on screen at once so all of them can be measured.
      notice('A notice a teacher has to read.', 'general');
      warnStorage('A warning a teacher has to read.');
      say('A message a teacher has to read.');
    });
    const contrast = await page.evaluate(() => {
      function lum(rgb){
        const v = rgb.map(c => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); });
        return 0.2126*v[0] + 0.7152*v[1] + 0.0722*v[2];
      }
      function parse(s){
        const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
        return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : [0,0,0,1];
      }
      function bgOf(el){
        // Composite every translucent layer down to the page, the way the eye
        // sees it — a colour tested against transparent is not a real reading.
        const stack = [];
        let n = el;
        while (n && n.nodeType === 1){
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c[3] > 0) stack.push(c);
          n = n.parentElement;
        }
        stack.push([255,255,255,1]);
        let out = stack[stack.length-1].slice(0,3);
        for (let i = stack.length-2; i >= 0; i--){
          const c = stack[i];
          out = [0,1,2].map(k => c[k]*c[3] + out[k]*(1-c[3]));
        }
        return out;
      }
      const targets = ['.header .what', '.privacy', '.privacy-note', '.hint', '.msg',
                       '.notyet', '.count-label', '.count-item.e .count-num',
                       '.count-item.d .count-num', '.count-item.m .count-num',
                       '.box-title', '.category-name', '.storage-warning',
                       '.notice', '.sample-note', 'label'];
      const out = [];
      targets.forEach(sel => {
        const el = document.querySelector(sel);
        if (!el || !el.offsetParent) return;
        const fg = parse(getComputedStyle(el).color).slice(0,3);
        const bg = bgOf(el);
        const l1 = lum(fg), l2 = lum(bg);
        const ratio = (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
        out.push({ sel, ratio: Math.round(ratio*100)/100 });
      });
      return out;
    });
    const fails = contrast.filter(c => c.ratio < 4.5);
    check('every explanatory line on the page is dark enough to read',
          fails.length === 0, JSON.stringify(fails));
    check('and enough of them were actually measured for that to mean something',
          contrast.length >= 12, String(contrast.length));
  }

  {
    // WAS: the badge promised "Stays on this laptop" while the page fetched a
    // script from cdnjs on every load, and the source claimed the file made
    // "no network calls of any kind and never has".
    const note = await page.evaluate(() =>
      document.querySelector('.privacy-note').textContent.replace(/\s+/g, ' '));
    check('the privacy claim on screen is accurate about the one file it fetches',
          /PDF export library/.test(note) && /Nothing you type is sent anywhere/.test(note),
          note.slice(0, 90));
  }

  {
    // WAS: the same message shown twice let the FIRST showing's timer wipe the
    // second one off the screen early.
    const survived = await page.evaluate(async () => {
      say('Saved.', 60);
      say('Saved.', 4000);
      await new Promise(r => setTimeout(r, 300));
      return document.getElementById('msg').textContent;
    });
    eq('saying the same thing twice does not cut the second one short', survived, 'Saved.');
  }

  {
    // WAS: the page produced 7 W3C validator errors — <style> as a direct child
    // of <body>, and six <p> elements inside <button> elements.
    const markup = await page.evaluate(() => ({
      styleInBody: document.querySelectorAll('body > style, body style').length,
      pInButton: document.querySelectorAll('button p').length,
      doctype: document.compatMode
    }));
    check('the stylesheet is in the head where it belongs',
          markup.styleInBody === 0, String(markup.styleInBody));
    check('no paragraph is nested inside a button',
          markup.pInButton === 0, String(markup.pInButton));
    check('the page is not in quirks mode',
          markup.doctype === 'CSS1Compat', markup.doctype);
  }

  // =========================================================================
  group('When the network hangs  (was: a totally blank white page)');
  // =========================================================================
  {
    // WAS: the jsPDF <script> in the head had no defer, so a school filter that
    // DROPS the request rather than refusing it left a visitor looking at a
    // blank white page — no heading, no scoring buttons — for the whole timeout.
    cdnHangMs = 2500;
    await harvest(page);
    await page.goto('about:blank');
    const nav = page.goto(base + '/index.html', { waitUntil: 'load' }).catch(() => {});
    await page.waitForSelector('.categories .category', { timeout: 2000 });
    const early = await page.evaluate(() => ({
      heading: (document.querySelector('h1') || {}).textContent || '',
      rows: document.querySelectorAll('.categories .category').length,
      wedges: document.querySelectorAll('#pieChart path, #pieChart circle').length
    }));
    check('the tool is drawn and usable while the blocked library is still hanging',
          early.rows === 6 && /Social Studies/.test(early.heading), JSON.stringify(early));
    check('and the chart is already filled in for a first-time visitor',
          early.wedges === 3, JSON.stringify(early.wedges));
    await nav;
    cdnHangMs = 0;
  }

  {
    // WAS: with JavaScript unavailable the page rendered as a finished-looking
    // tool where nothing worked, with no <noscript> to say why.
    await harvest(page);
    await page.setJavaScriptEnabled(false);
    await page.goto(base + '/index.html', { waitUntil: 'load' });
    const noscript = await page.evaluate(() =>
      document.querySelector('.noscript') ? document.querySelector('.noscript').textContent : '')
      .catch(() => '');
    const html = await page.content();
    check('with JavaScript switched off the page says so rather than looking finished',
          /needs JavaScript/.test(html), html.slice(0, 60));
    await page.setJavaScriptEnabled(true);
  }

  // =========================================================================
  group('Nothing leaves the laptop');
  // =========================================================================
  {
    await fresh(page, base);
    const outbound = [];
    const listener = req => {
      const u = req.url();
      if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:') &&
          !u.startsWith('about:')) outbound.push(u);
    };
    page.on('request', listener);
    await emptyForm(page);
    await fill(page, 'initials', 'N.W.');
    await score(page, 0, 'M');
    await page.click('button[onclick="exportCSV()"]');
    await page.evaluate(() => new Promise(r => setTimeout(r, 200)));
    page.off('request', listener);
    check('scoring, typing and exporting send nothing anywhere',
          outbound.length === 0, outbound.join(' | '));
  }

  // =========================================================================
  // Coverage
  // =========================================================================
  if (COVERAGE){
    covRuns.push(...await page.coverage.stopJSCoverage());
    const merged = new Map();
    for (const e of covRuns){
      if (!/index\.html/.test(e.url)) continue;
      const cur = merged.get(e.text) || [];
      merged.set(e.text, cur.concat(e.ranges));
    }
    group('Code coverage — which lines never ran');
    if (!merged.size){
      console.log(`${R}  no coverage was recorded${X}`);
    } else {
      for (const [text, ranges] of merged){
        const used = new Uint8Array(text.length);
        ranges.forEach(r => used.fill(1, r.start, r.end));

        const tag = text.indexOf('<script>');
        const open  = tag === -1 ? 0 : tag + '<script>'.length;
        const close = tag === -1 ? text.length : text.lastIndexOf('</script>');

        let lineShift = 0;
        if (tag === -1){
          const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
          const at = html.indexOf('<script>\nconst categories');
          if (at !== -1) lineShift = html.slice(0, at).split('\n').length - 1;
        }

        const lineStarts = [0];
        for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);

        let executable = 0, covered = 0;
        const dead = [];
        for (let ln = 0; ln < lineStarts.length; ln++){
          if (lineStarts[ln] < open || lineStarts[ln] > close) continue;
          const from = lineStarts[ln];
          const to   = (lineStarts[ln + 1] || text.length);
          const src  = text.slice(from, to);
          const code = src.trim();
          if (!code || code.startsWith('//') || code.startsWith('*') ||
              code.startsWith('/*') || /^[}\])\s,;]*$/.test(code)) continue;
          executable++;
          let any = false;
          for (let i = from; i < to; i++) if (used[i]){ any = true; break; }
          if (any) covered++; else dead.push({ ln: ln + 1 + lineShift, code });
        }

        const pct = executable ? (covered / executable * 100) : 0;
        const colour = pct >= 95 ? G : pct >= 85 ? Y : R;
        console.log(`  ${colour}${pct.toFixed(1)}%${X} of executable lines ran ` +
                    `${DIM}(${covered} of ${executable})${X}`);
        if (dead.length){
          console.log(`  ${Y}${dead.length} line(s) never executed:${X}`);
          dead.forEach(d => console.log(`    ${DIM}index.html:${d.ln}${X}  ${d.code.slice(0, 96)}`));
        } else {
          console.log(`  ${G}every executable line was run by a test${X}`);
        }
      }
    }
  }

  await browser.close();
  srv.close();

  // -------------------------------------------------------------------------
  // How many checks were SUPPOSED to run.
  //
  // Several checks sit inside `if (...)` guards, because the thing they inspect
  // has to exist before they can inspect it. When such a guard is false the
  // checks inside do not fail — they silently do not happen, and the run still
  // ends green. That is how a suite quietly shrinks. So the count itself is a
  // check: if it moves, either you added checks (put the new number here,
  // deliberately) or some checks stopped running (find out why).
  // -------------------------------------------------------------------------
  const EXPECTED_CHECKS = Number(process.env.EXPECTED_CHECKS || 167);
  const ran = passed + failures.length;
  if (EXPECTED_CHECKS && ran !== EXPECTED_CHECKS){
    failures.push({
      name: `the suite ran ${ran} checks, but ${EXPECTED_CHECKS} were expected`,
      detail: ran < EXPECTED_CHECKS
        ? 'Checks vanished rather than failed — look for an `if (...)` guard that went false.'
        : 'Checks were added. If that was deliberate, update EXPECTED_CHECKS.',
    });
    console.log(`${R}  FAIL${X} expected ${EXPECTED_CHECKS} checks, ran ${ran}`);
  } else if (!EXPECTED_CHECKS){
    console.log(`${DIM}  (no EXPECTED_CHECKS set — ran ${ran})${X}`);
  }

  console.log('');
  if (failures.length){
    console.log(`${R}${failures.length} CHECK(S) FAILED${X}  (${passed} passed)`);
    failures.forEach(f => console.log(`${R}  · ${f.name}${X}${f.detail ? DIM + ' — ' + f.detail + X : ''}`));
    process.exit(1);
  }
  console.log(`${G}ALL ${passed} CHECKS PASSED${X}`);
}

main().catch(e => { console.error(`${R}The test run itself crashed:${X}\n`, e); process.exit(2); });
