#!/usr/bin/env node
//
// Reading Assessment Tool — regression tests.
//
// WHAT THIS IS
// ------------
// "Regression" means sliding backward. Every check in this file exists because
// something was once actually broken here — most of them found by driving the
// real tool in a real browser, not by reading the code. The point is not to
// prove the tool works today. It is so that a bug fixed in August cannot
// quietly come back in November without anybody noticing.
//
// Each check is named for what a PERSON would notice, not for the function
// involved. If you fix a new bug, add its check here the same day, while you
// still remember what went wrong.
//
// HOW TO RUN IT
// -------------
//     cd ~/Documents/GitHub/edtech-portfolio/reading-assessment-tool/tests
//     npm test
//
// It opens a real Google Chrome in the background, drives the tool with real
// clicks, real keypresses and a real mouse, and prints a line per check.
// It needs nothing on the internet: the one library the tool fetches from a CDN
// is intercepted and answered locally, so the PDF checks are offline and
// repeatable.
//
// npm install is NOT needed and must not be run here. node_modules in this
// folder is a symlink to running-record-tool/tests/node_modules, and npm test
// also sets NODE_PATH to the same place, so puppeteer-core resolves either way.
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
// A stand-in for jsPDF.
//
// The tool fetches jsPDF from cdnjs. Letting these tests reach out to the
// internet would make them slower, flaky and untestable on a plane — and a
// flaky check is worse than no check, because it teaches you to ignore red. So
// the request is intercepted and answered with this, which records every line
// of text the tool asks it to draw. That is what makes it possible to assert
// on what the PDF actually SAYS.
// ---------------------------------------------------------------------------
const JSPDF_STUB = `
window.jspdf = { jsPDF: function(){
  var self = this;
  window.__pdf = self;
  window.__pdfSaved = null;
  self.__lines = [];
  self.__pages = 1;
  self.internal = { pageSize: { getWidth: function(){ return 210; },
                                getHeight: function(){ return 297; } } };
  self.setFontSize  = function(){ return self; };
  self.setTextColor = function(){ return self; };
  self.addPage      = function(){ self.__pages++; return self; };
  self.text         = function(t){ self.__lines.push(String(t)); return self; };
  self.splitTextToSize = function(t, w){
    var out = [];
    String(t).split(/\\r?\\n/).forEach(function(para){
      var line = '';
      para.split(' ').forEach(function(word){
        if ((line + ' ' + word).trim().length > 95){ out.push(line.trim()); line = word; }
        else line = (line + ' ' + word).trim();
      });
      out.push(line);
    });
    return out;
  };
  self.save = function(name){ window.__pdfSaved = name; };
}};
`;

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
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Helpers for driving the page
// ---------------------------------------------------------------------------
// Chrome throws its coverage record away on every navigation, and this suite
// reloads the page dozens of times. Left alone, the report would describe only
// whatever the LAST page load happened to touch — which is how a suite can
// claim 74% while actually measuring one screen. Harvest the record before
// each navigation and start a new one.
const covRuns = [];
let COVERAGE = false;
async function harvest(page){
  if (!COVERAGE) return;
  try {
    covRuns.push(...await page.coverage.stopJSCoverage());
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
  } catch (e) { /* coverage not running yet */ }
}

// `load`, not `domcontentloaded`: the tool's "did the PDF library arrive?" note
// is written on the load event, and a check that ran before it was landing
// green or red depending on timing. A test that is right nine times out of ten
// is not a test.
//
// Two arrivals matter and they behave differently, so both are spelled out
// here. A FIRST visit fills itself in with the sample student; a returning
// teacher gets their own empty screen back. Most checks want the second.
async function fresh(page, base, opts){
  opts = opts || {};
  await harvest(page);
  await page.emulateMediaType(null);
  await page.goto('about:blank');
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  if (!opts.firstVisit) await page.evaluate(() => localStorage.setItem('readingVisited', 'yes'));
  await harvest(page);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

// Click the E, D or M button on one skill row, with a real mouse click at real
// coordinates — element.click() would skip whatever is sitting on top.
async function score(page, row, letter){
  const sel = `.skill:nth-of-type(${row + 1}) .btn-score:nth-of-type(${'edm'.indexOf(letter) + 1})`;
  await page.click(sel);
}
// The letters of Maya's own six scores, read out of the tool itself and in the
// order the rows are drawn, so a reordered skill list cannot make these helpers
// click the wrong row and quietly stop testing anything.
const mayaLetters = page => page.evaluate(() =>
  READING_SKILLS.map(s => ({ Emerging:'e', Developing:'d', Mastered:'m' })[SAMPLE_STUDENT.scores[s]]));

// Score every skill at a level that is NOT the one Maya arrived with — a
// teacher working straight over the sample, one row at a time.
async function replaceEveryScore(page){
  const hers = await mayaLetters(page);
  for (let row = 0; row < hers.length; row++){
    await score(page, row, hers[row] === 'e' ? 'm' : 'e');
  }
}
// The ordinary case, and the one this suite never drove: a teacher who agrees
// with Maya on ONE skill and so leaves that row alone, and works over the other
// five. replaceEveryScore() above cannot produce this screen — it is built to
// avoid Maya's level on every row — which is exactly why the "the label comes
// off when the last made-up score goes" check passed while the agreeing teacher
// was stuck with a "Part sample" stamp on her finished record.
async function replaceEveryScoreExcept(page, keepRow){
  const hers = await mayaLetters(page);
  for (let row = 0; row < hers.length; row++){
    if (row === keepRow) continue;
    await score(page, row, hers[row] === 'e' ? 'm' : 'e');
  }
}
// And the coincidence: a real child who happens to land on exactly Maya's six.
async function scoreExactlyLikeMaya(page){
  const hers = await mayaLetters(page);
  for (let row = 0; row < hers.length; row++) await score(page, row, hers[row]);
}
// Everything of Maya's, replaced: her six scores, both of her paragraphs, the
// Child box and the date. Nothing she brought is left anywhere on the screen.
async function replaceEverySampleField(page, initials, date){
  await replaceEveryScore(page);
  await retype(page, 'initials', initials);
  await setValue(page, 'assessDate', date);
  await setValue(page, 'strengthsComment',
    'Rosa retells in order and goes back to the page to check herself.');
  await setValue(page, 'stretchesComment',
    'Digraphs are still guessed at; she needs the sound before the word.');
}
// A REAL paste, not a made-up event. A dispatched ClipboardEvent does nothing
// at all in Chrome — no text arrives, no message is said — so a suite built on
// one proves only that nothing happened, and that is exactly how "pasting a
// name is silently truncated" came to be reported against a tool that in fact
// says so. This puts the words on the actual system clipboard by typing them
// into a scratch box and pressing Copy, then presses Paste in the real box.
async function pasteInto(page, cdp, id, text){
  await page.evaluate(t => {
    const b = document.createElement('textarea');
    b.id = '__clip'; b.value = t;
    document.body.appendChild(b); b.focus(); b.select();
  }, text);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'c', code: 'KeyC',
    windowsVirtualKeyCode: 67, modifiers: 4, commands: ['copy'] });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'c', code: 'KeyC',
    windowsVirtualKeyCode: 67, modifiers: 4 });
  await page.evaluate(() => document.getElementById('__clip').remove());
  await page.click('#' + id);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'v', code: 'KeyV',
    windowsVirtualKeyCode: 86, modifiers: 4, commands: ['paste'] });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'v', code: 'KeyV',
    windowsVirtualKeyCode: 86, modifiers: 4 });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}
// And a real drag-and-drop, which is the other way a whole name arrives in a
// four-character box: dragged out of a class list in another window. Chrome
// delivers it as a different kind of edit from typing or pasting.
async function dropInto(page, cdp, id, text){
  const at = await page.evaluate(i => {
    const r = document.getElementById(i).getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, id);
  const data = { items: [{ mimeType: 'text/plain', data: text }], dragOperationsMask: 1 };
  for (const type of ['dragEnter', 'dragOver', 'drop']){
    await cdp.send('Input.dispatchDragEvent', { type, x: at.x, y: at.y, data });
  }
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}
async function typeIn(page, id, text){
  await page.click('#' + id);
  await page.keyboard.type(text);
}
// Select everything in a box and type over it, the way a teacher replaces one
// child with the next. A triple-click does NOT reliably select all of "M.T." —
// it stops at a word boundary, which quietly left half the old value behind and
// made two checks pass against the wrong screen.
async function retype(page, id, text){
  await page.click('#' + id);
  await page.evaluate(i => document.getElementById(i).select(), id);
  if (text === '') await page.keyboard.press('Backspace');
  else await page.keyboard.type(text);
}
async function setValue(page, id, value){
  await page.evaluate((i, v) => {
    const el = document.getElementById(i);
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, id, value);
}
const sayMsg   = page => page.evaluate(() => document.getElementById('sayMsg').textContent);
const counts   = page => page.evaluate(() => ['e','d','m'].map(k =>
                          +document.getElementById('count-' + k).textContent));
const stash    = page => page.evaluate(() => {
                          const s = localStorage.getItem('readingStash');
                          return s ? JSON.parse(s) : null; });
const lastCsv  = page => page.evaluate(() => {
                          const href = window.__downloads[window.__downloads.length - 1] || '';
                          return decodeURIComponent(href.replace(/^data:text\/csv;charset=utf-8,/, '')); });
const lastName = page => page.evaluate(() =>
                          window.__downloadNames[window.__downloadNames.length - 1] || '');

// Everything on screen that a person would look at, in one go.
const screenState = page => page.evaluate(() => ({
  initials:  document.getElementById('initials').value,
  date:      document.getElementById('assessDate').value,
  strengths: document.getElementById('strengthsComment').value,
  stretches: document.getElementById('stretchesComment').value,
  scored:    Object.keys(scores).length,
  banner:    document.getElementById('sampleBanner').classList.contains('show'),
  // Not only whether it is up, but which of the two things it says: "this is
  // the sample" and "some of the sample is still here" are different promises.
  bannerText: document.getElementById('sampleBanner').textContent.trim(),
  // The warning sentence on its own, without the button that sits beside it —
  // a hidden button still puts its words into the parent's textContent, and a
  // screen reader reading the warning would read the button label as the end of
  // the sentence. Asserting on both is how that stays true.
  bannerSentence: document.getElementById('sampleBannerText').textContent.trim(),
  // '' when the tool is not offering it at all.
  claimBtn: document.getElementById('claimScoresBtn').hidden ? ''
            : document.getElementById('claimScoresBtn').textContent.trim(),
  sampleBtn: document.getElementById('sampleBtn').textContent,
  undoShown: document.getElementById('undoClearBtn').classList.contains('show')
}));

// ---------------------------------------------------------------------------
// The contrast sweep, run inside the page.
//
// Walks every element that owns text, composites the real background up the
// ancestor chain onto the browser canvas, and works out the WCAG 2.x ratio
// against the AA threshold for that element's own size and weight. This is the
// check that 23 pieces of text on the first screen once failed.
// ---------------------------------------------------------------------------
const CONTRAST_SWEEP = () => {
  const parse = c => {
    const m = (c || '').match(/[\d.]+/g);
    if (!m) return { r: 0, g: 0, b: 0, a: 0 };
    return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 };
  };
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a),
                              g: fg.g * fg.a + bg.g * (1 - fg.a),
                              b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const bgOf = el => {
    const stack = [];
    let n = el;
    while (n && n.nodeType === 1){
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.a > 0) stack.push(c);
      n = n.parentElement;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return base;
  };
  const out = [];
  document.querySelectorAll('*').forEach(el => {
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const owns = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
    if (!owns) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return;
    // An SVG <text> is painted with fill, not color.
    const isSvg = el.namespaceURI === 'http://www.w3.org/2000/svg';
    const fg = parse(isSvg ? cs.fill : cs.color);
    if (!fg.a) return;
    const bg = bgOf(el);
    const front = over(fg, bg);
    const l1 = lum(front), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    if (ratio + 0.005 < need){
      out.push(el.textContent.trim().slice(0, 26) + ' @' + ratio.toFixed(2) +
               ' (needs ' + need + ')');
    }
  });
  return out;
};

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
  // A direct line to the browser, for the two gestures puppeteer's own API
  // cannot make: a paste from the real clipboard, and a drop from outside the
  // page. Both matter here — this tool has a box that quietly drops what it
  // cannot hold.
  const cdp = await page.target().createCDPSession();
  await page.setViewport({ width: 1280, height: 900 });

  COVERAGE = process.argv.includes('--coverage');
  if (COVERAGE) await page.coverage.startJSCoverage({ resetOnNavigation: false });

  // 'stub'  — answer the CDN locally with the recorder above (the normal case)
  // 'block' — the school firewall: the request simply fails
  // 'slow'  — the filtered school network: the request takes six seconds
  let pdfMode = 'stub';
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (!/jspdf/i.test(req.url())) return req.continue();
    if (pdfMode === 'block') return req.abort();
    const send = () => req.respond({ status: 200,
                                     contentType: 'text/javascript',
                                     body: JSPDF_STUB }).catch(() => {});
    if (pdfMode === 'slow') return setTimeout(send, 3000);
    send();
  });

  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // Chrome's message for a failed request is the same generic sentence
    // whatever the file was — the URL lives in location(), not in the text.
    // Always report the URL, so a future 404 names itself.
    const url = (m.location() && m.location().url) || '';
    if (/favicon/i.test(url)) return;
    if (/jspdf/i.test(url)) return;      // deliberately blocked in one group
    consoleErrors.push(m.text() + (url ? '  [' + url + ']' : ''));
  });

  await page.evaluateOnNewDocument(() => {
    window.__downloads = [];
    window.__downloadNames = [];
    window.__confirmAnswer = true;
    window.__confirms = [];
    window.confirm = msg => { window.__confirms.push(String(msg)); return window.__confirmAnswer; };
    window.alert = msg => { window.__alert = String(msg); };
    // A browser that refuses to store anything — Safari's private window, or a
    // full disk. Switched on by the URL rather than by a variable, because it
    // has to be in force before the tool's very first line runs, and it has to
    // survive a reload.
    if (location.search.indexOf('breakstorage') !== -1){
      Storage.prototype.setItem = function(){ throw new Error('the disk is full'); };
    }
    // Catch anchor-triggered CSV downloads instead of writing to the real
    // Downloads folder.
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[download]');
      if (a){
        e.preventDefault();
        window.__downloads.push(a.getAttribute('href') || '');
        window.__downloadNames.push(a.getAttribute('download') || '');
      }
    }, true);
  });

  // =========================================================================
  group('Arriving at the tool');
  // =========================================================================
  await fresh(page, base, { firstVisit: true });

  check('the page loads with no JavaScript errors',
        pageErrors.length === 0, pageErrors.join(' | '));
  check('the page loads with no console errors',
        consoleErrors.length === 0, consoleErrors.join(' | '));

  // THE DEFECT: an inline style="...background: transparent" on <body> outranked
  // the stylesheet, so the warm page colour never painted once and the pale
  // panels sat on plain white with almost no edge between them.
  eq('the page paints its own warm background instead of plain white',
     await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
     'rgb(232, 212, 196)');

  const arrival = await screenState(page);
  eq('a first-time visitor arrives to a filled-in tool, not an empty one',
     arrival.scored, 6);
  eq('...belonging to the sample student M.T.', arrival.initials, 'M.T.');
  check('...clearly labelled on screen as a made-up child', arrival.banner);
  check('...whose profile is mixed, not all one level',
        (await counts(page)).every(n => n > 0), JSON.stringify(await counts(page)));

  // THE DEFECT: the first sentence a stranger read told them to "click the same
  // button" when they had pressed nothing, and the button meant was off the
  // bottom of the screen.
  const firstWords = await sayMsg(page);
  check('the first thing the tool says names the button that empties it',
        /Clear the sample student/.test(firstWords) && !/the same button/.test(firstWords),
        firstWords);

  // THE DEFECT: 23 of the 51 pieces of text on this screen were under the AA
  // minimum, including the three big count numbers and the chosen E/D/M letter
  // that is the tool's only record of a score.
  const badContrast = await page.evaluate(CONTRAST_SWEEP);
  check('every piece of text on the first screen can actually be read',
        badContrast.length === 0, badContrast.join(' | '));

  // =========================================================================
  group('The library that comes from the internet');
  // =========================================================================
  // THE DEFECT: the <script> tag had no defer, so it BLOCKED the page from
  // being drawn. On a filtered school network — slow, not blocked — a visitor
  // sat looking at a blank white sheet for six seconds.
  check('the PDF library is fetched in a way that cannot hold up the page',
        await page.evaluate(() =>
          !!document.querySelector('script[src*="jspdf"]').defer));

  pdfMode = 'slow';
  await page.goto('about:blank');
  const slowLoad = page.goto(base + '/index.html', { waitUntil: 'load' });
  await wait(1200);
  const whileSlow = await page.evaluate(() => ({
    h1:    !!document.querySelector('h1'),
    rows:  document.querySelectorAll('.skill').length,
    text:  document.body.innerText.trim().length
  }));
  check('the whole tool is on screen while the slow library is still arriving',
        whileSlow.h1 && whileSlow.rows === 6 && whileSlow.text > 200,
        JSON.stringify(whileSlow));
  await slowLoad;
  pdfMode = 'stub';

  // THE DEFECT: Export PDF threw into a console nobody has open, so the main
  // output button simply did nothing on a school network that blocks the CDN.
  pdfMode = 'block';
  await fresh(page, base);
  await typeIn(page, 'initials', 'R.K.');
  await score(page, 0, 'e');
  const noteWhenBlocked = await page.evaluate(() =>
    document.getElementById('pdfNote').textContent);
  check('a blocked PDF library is announced beside the button, not left silent',
        /did not load/.test(noteWhenBlocked), noteWhenBlocked);
  await page.click('#pdfBtn');
  const blockedMsg = await sayMsg(page);
  check('...and pressing Export PDF explains itself and points at what still works',
        /did not load/.test(blockedMsg) && /Export CSV/.test(blockedMsg), blockedMsg);
  eq('...and nothing was lost', (await screenState(page)).scored, 1);
  pdfMode = 'stub';

  // =========================================================================
  group('The chart');
  // =========================================================================
  await fresh(page, base);

  // THE DEFECT: a whole circle drawn as an arc starts and ends at the same
  // point, and SVG then draws nothing at all — so the very first click a
  // visitor made produced an empty chart, and so did any real reading where
  // every skill sat in one band.
  await score(page, 0, 'e');
  const oneSlice = await page.evaluate(() => {
    const svg = document.getElementById('pieChart');
    return { shapes: svg.querySelectorAll('circle, path').length,
             filled: Array.from(svg.querySelectorAll('circle, path'))
                          .filter(s => s.getAttribute('fill') &&
                                       s.getAttribute('fill') !== 'none').length };
  });
  check('the chart draws on the very first click a visitor makes',
        oneSlice.filled === 1, JSON.stringify(oneSlice));

  for (let i = 1; i < 6; i++) await score(page, i, 'e');
  const allOneBand = await page.evaluate(() => {
    const svg = document.getElementById('pieChart');
    const filled = Array.from(svg.querySelectorAll('circle, path'))
                        .filter(s => s.getAttribute('fill') && s.getAttribute('fill') !== 'none');
    return { filled: filled.length, tag: filled[0] && filled[0].tagName,
             box: filled[0] ? filled[0].getBBox().width : 0 };
  });
  check('the chart still draws when every skill is the same level',
        allOneBand.filled === 1 && allOneBand.box > 50, JSON.stringify(allOneBand));

  // THE DEFECT: 'out of 1 skills scored' — the one number-carrying label that
  // never got the singular treatment every other one has.
  await fresh(page, base);
  await score(page, 0, 'e');
  const oneLabel = await page.evaluate(() =>
    document.getElementById('pieChart').getAttribute('aria-label'));
  check('the chart says "1 skill", not "1 skills", on the first score',
        /out of 1 skill scored/.test(oneLabel), oneLabel);

  // THE DEFECT: cursor:pointer sat on the whole 516x160 panel, so the legend,
  // the empty space beside the pie and the "Nothing scored yet" ring all said
  // "click me" and none of them did anything.
  const cursors = await page.evaluate(() => {
    const svg = document.getElementById('pieChart');
    const slice = svg.querySelector('circle, path');
    const legend = svg.querySelector('text');
    return { panel: getComputedStyle(svg).cursor,
             slice: slice ? getComputedStyle(slice).cursor : 'none',
             legend: legend ? getComputedStyle(legend).cursor : 'none' };
  });
  check('only the pie slices offer a hand cursor, not the legend beside them',
        cursors.panel !== 'pointer' && cursors.slice === 'pointer' &&
        cursors.legend !== 'pointer', JSON.stringify(cursors));

  // =========================================================================
  group('Scoring, and taking a score back');
  // =========================================================================
  await fresh(page, base);
  await typeIn(page, 'initials', 'R.K.');
  await typeIn(page, 'strengthsComment', 'Reads with real expression.');
  await score(page, 0, 'e');
  await score(page, 1, 'd');

  // THE DEFECT: the only way to undo one mis-tapped button was Clear, which
  // wiped the other five skills and both written comments as well.
  await score(page, 0, 'e');
  const afterUnscore = await screenState(page);
  eq('a mis-tapped score can be taken back on its own', afterUnscore.scored, 1);
  eq('...without touching the child', afterUnscore.initials, 'R.K.');
  eq('...or the comment beside it', afterUnscore.strengths, 'Reads with real expression.');
  check('...and the tool says which skill it took the score off',
        /Score removed from/.test(await sayMsg(page)), await sayMsg(page));

  // THE DEFECT: nothing cleared that line when a score went back on, so the one
  // status line said "Score removed" directly above a visibly scored row — the
  // exact correction the on-screen hint teaches.
  await score(page, 0, 'd');
  const afterRescore = await sayMsg(page);
  check('the tool stops saying "Score removed" the moment the score goes back on',
        !/Score removed/.test(afterRescore), afterRescore);

  // THE DEFECT: say() started a timer per call and cancelled none of them, so
  // saying the SAME sentence twice let the first call's timer wipe the second
  // message early — sometimes 1.2 seconds into a 5-second life. It hit hardest
  // when a teacher clicked twice because they thought nothing had happened.
  await fresh(page, base);
  await page.click('#clearBtn');
  eq('pressing Clear on an empty tool says so',
     /nothing to clear/.test(await sayMsg(page)), true);
  await wait(4200);
  await page.click('#clearBtn');
  await wait(1400);
  check('saying the same thing twice does not make it vanish early',
        /nothing to clear/.test(await sayMsg(page)), await sayMsg(page));

  // =========================================================================
  group('Who was assessed, and what leaves the laptop');
  // =========================================================================
  await fresh(page, base);
  await typeIn(page, 'initials', 'R.K.');
  await setValue(page, 'assessDate', '2026-08-07');
  await score(page, 0, 'm');
  await typeIn(page, 'strengthsComment', 'Re-reads when he loses the thread, "every time", and says so.');
  await typeIn(page, 'stretchesComment', 'Two-syllable words,\nespecially with a schwa.');
  await page.click('#csvBtn');

  const csv = await lastCsv(page);
  const csvName = await lastName(page);
  check('the spreadsheet says which child it is for and when',
        /^R\.K\.,2026-08-07,/m.test(csv.split('\r\n')[1]), csv.split('\r\n')[1]);
  eq('the file is named for that child and that date',
     csvName, 'reading-assessment_RK_2026-08-07.csv');
  // THE DEFECT: the comments were read and then left out of the export.
  check('the spreadsheet carries both comments, not just the scores',
        csv.indexOf('loses the thread') !== -1 && csv.indexOf('schwa') !== -1);
  // THE DEFECT: quotes, commas and newlines were not escaped, so the columns
  // came out shuffled or empty.
  check('a comment with a comma, a quote and a line break does not break the columns',
        csv.indexOf('""every time""') !== -1 &&
        csv.indexOf('"Two-syllable words,\nespecially with a schwa."') !== -1,
        csv.split('\r\n')[1]);

  // THE DEFECT: fileStamp() stripped every character outside A-Z0-9, so Ö.M.
  // and É.M. produced ONE filename and the second download silently replaced
  // the first in the teacher's Downloads folder.
  await fresh(page, base);
  await typeIn(page, 'initials', 'Ö.M.');
  await setValue(page, 'assessDate', '2026-08-07');
  await page.click('#csvBtn');
  const nameO = await lastName(page);
  await fresh(page, base);
  await typeIn(page, 'initials', 'É.M.');
  await setValue(page, 'assessDate', '2026-08-07');
  await page.click('#csvBtn');
  const nameE = await lastName(page);
  check('two children with accented initials do not get the same filename',
        nameO !== nameE, nameO + ' vs ' + nameE);
  check('...and each filename still names the child inside the file',
        /Ö/.test(nameO) && /É/.test(nameE), nameO + ' | ' + nameE);

  // THE DEFECT: with the Date box untouched, the filename claimed today while
  // the record inside said "Date: —". A reading done on Monday and exported on
  // Friday was filed under Friday by a sheet that denied having a date.
  await fresh(page, base);
  await typeIn(page, 'initials', 'R.K.');
  await score(page, 0, 'm');
  await page.click('#csvBtn');
  const noDateName = await lastName(page);
  const noDateRow = (await lastCsv(page)).split('\r\n')[1];
  check('an untouched date is filed as "no-date", not as today',
        /no-date/.test(noDateName), noDateName);
  check('...so the filename and the record agree about the date',
        noDateRow.startsWith('R.K.,,'), noDateRow);

  // THE DEFECT: the Child box takes four characters and swallowed the fifth in
  // silence, so a stranger typing a name got "Sophia" filed as "SOPH".
  await fresh(page, base);
  await typeIn(page, 'initials', 'Sophia');
  const truncated = await screenState(page);
  eq('the Child box still keeps initials only', truncated.initials, 'Soph');
  check('...and now says so when it drops what you typed',
        /initials only/i.test(await sayMsg(page)), await sayMsg(page));
  check('...and says it on the screen before you type, too',
        /initials/i.test(await page.evaluate(() =>
          document.querySelector('label[for="initials"]').textContent)));

  // Typing is not how a whole name usually arrives in this box — it is pasted
  // out of a class list, or dragged in from another window. Both were untested,
  // and the warning is driven by one event, so both are tested here now with
  // the real clipboard and a real drop rather than a made-up event.
  await fresh(page, base);
  await pasteInto(page, cdp, 'initials', 'Sophia');
  const pasted = await screenState(page);
  eq('a pasted full name is cut down to initials', pasted.initials, 'Soph');
  check('...and the tool says so, the same as when it is typed',
        /initials only/i.test(await sayMsg(page)), await sayMsg(page));
  await fresh(page, base);
  await dropInto(page, cdp, 'initials', 'Sophia');
  const dropped = await screenState(page);
  eq('a name dragged into the box is cut down too', dropped.initials, 'Soph');
  check('...and that is not done in silence either',
        /initials only/i.test(await sayMsg(page)), await sayMsg(page));

  // =========================================================================
  group('The made-up child, and keeping her separate from a real one');
  // =========================================================================
  await fresh(page, base, { firstVisit: true });
  await replaceEverySampleField(page, 'R.K.', '2026-08-07');

  // THE DEFECT: the sample flag went on when Maya loaded and came off for
  // nothing short of Clear, so a visitor who typed their own child over her got
  // exports branding that real child "Sample student — Maya Torres (M.T.) — not
  // a real child", inside the same row whose Child cell said R.K.
  const typedOver = await screenState(page);
  check('replacing every last piece of the sample takes the banner off the screen',
        !typedOver.banner, typedOver.bannerText);
  await page.click('#csvBtn');
  const realCsv = await lastCsv(page);
  const realName = await lastName(page);
  check('...and out of the spreadsheet',
        realCsv.indexOf('Maya Torres') === -1 && /^R\.K\.,2026-08-07,,/m.test(realCsv.split('\r\n')[1]),
        realCsv.split('\r\n')[1]);
  check('...and off the filename', realName.indexOf('SAMPLE') === -1, realName);
  await page.click('#pdfBtn');
  const realPdf = await page.evaluate(() => window.__pdf.__lines.join(' | '));
  check('...and off the PDF report',
        realPdf.indexOf('Maya Torres') === -1 && /Child: R\.K\./.test(realPdf), realPdf.slice(0, 160));

  // THE DEFECT THIS GROUP MISSED THE FIRST TIME, and it is why the check above
  // now replaces every field instead of just the Child box: the fix for the
  // defect above dropped the sample label on the FIRST KEYSTROKE, because the
  // flag was tied to "is the screen still the sample EXACTLY". One Backspace in
  // the Child box — M.T. to M.T — and the banner went, the button flipped, the
  // filename lost SAMPLE- and the spreadsheet's Sample record column emptied,
  // while all six of Maya's made-up scores and both of her made-up paragraphs
  // were still sitting there. A wholly fabricated child's record, with nothing
  // anywhere on it to say so. The old test passed because it only ever changed
  // the two fields that carry no made-up data.
  await fresh(page, base, { firstVisit: true });
  await page.click('#initials');
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  const nibbled = await screenState(page);
  eq('one Backspace in the Child box really does change it', nibbled.initials, 'M.T');
  check('...and Maya\'s made-up scores are all still on the screen', nibbled.scored === 6);
  check('...so the sample banner STAYS UP', nibbled.banner, JSON.stringify(nibbled));
  check('...and says which way round it is now, and what to do about it',
        /still on this screen/i.test(nibbled.bannerText) &&
        /Clear the sample student/.test(nibbled.bannerText), nibbled.bannerText);
  await page.click('#csvBtn');
  const nibbledCsv = await lastCsv(page);
  check('...the spreadsheet still marks the record as part sample',
        /Part sample/.test(nibbledCsv.split('\r\n')[1]), nibbledCsv.split('\r\n')[1].slice(0, 120));
  check('...and SAMPLE- is still on the filename',
        /^reading-assessment_SAMPLE-/.test(await lastName(page)), await lastName(page));
  await page.click('#pdfBtn');
  check('...and the printed report still carries a label',
        await page.evaluate(() => window.__pdf.__lines.some(l => /Part sample/.test(l))));

  // It has to survive a reload too — that is where the flag used to be read
  // back off the disk and believed.
  await page.reload({ waitUntil: 'load' });
  const nibbledAgain = await screenState(page);
  check('...and the label is still there after the tab is reloaded',
        nibbledAgain.banner && nibbledAgain.scored === 6, JSON.stringify(nibbledAgain));

  // The flag is not a one-way latch any anymore: put her back exactly and the
  // full sample label comes back with her, the way Cmd+Z would.
  await retype(page, 'initials', 'M.T.');
  const backAgain = await screenState(page);
  check('putting the sample back exactly brings the full sample label back',
        backAgain.banner && /These scores are made up/.test(backAgain.bannerText),
        backAgain.bannerText);
  await page.click('#csvBtn');
  check('...and the spreadsheet calls it the sample student again',
        (await lastCsv(page)).indexOf(
          'Sample student — Maya Torres (M.T.) — not a real child') !== -1);

  // Half-replaced, the other way round: the teacher's own child in the Child
  // box and her own comments, but Maya's six made-up scores still underneath.
  await fresh(page, base, { firstVisit: true });
  await retype(page, 'initials', 'R.K.');
  await setValue(page, 'strengthsComment', 'Rosa reads the pictures first, every time.');
  await setValue(page, 'stretchesComment', 'Blends stall at three sounds.');
  const scoresLeft = await screenState(page);
  check('made-up SCORES left under a real child still count as sample data',
        scoresLeft.banner, JSON.stringify(scoresLeft));
  await page.click('#csvBtn');
  const scoresLeftCsv = await lastCsv(page);
  check('...and the spreadsheet says "part sample", not that this is Maya\'s record',
        /Part sample/.test(scoresLeftCsv) &&
        scoresLeftCsv.indexOf('Sample student — Maya Torres (M.T.) — not a real child') === -1,
        scoresLeftCsv.split('\r\n')[1].slice(0, 120));
  // ...and replacing the last of the made-up scores is what finally takes it off.
  await replaceEveryScore(page);
  const nothingLeft = await screenState(page);
  check('replacing the last made-up score is what finally takes the label off',
        !nothingLeft.banner && nothingLeft.scored === 6, JSON.stringify(nothingLeft));
  await page.click('#csvBtn');
  check('...and the spreadsheet is a clean record of a real child',
        (await lastCsv(page)).indexOf('Maya Torres') === -1);

  // =========================================================================
  // THE CHECK ABOVE WAS TESTING THE WRONG MOMENT.
  //
  // replaceEveryScore() is built to pick a level that is NOT Maya's on every
  // one of the six rows, so the only teacher it has ever driven is one who
  // disagrees with the sample about everything. The ordinary teacher agrees
  // with it somewhere — three levels, six skills — and leaves that row alone.
  //
  // THE DEFECT that hid behind it: her finished record, with her child in the
  // Child box, her date, both of her comments and five scores she had entered
  // herself, still came out stamped "Part sample — some of this is Maya Torres,
  // the made-up example, not a real child" — on the banner, in the spreadsheet
  // column, on the PDF and on a SAMPLE- filename. The label was literally true,
  // because that sixth level did arrive with Maya. But nothing on the page said
  // which score it meant or what to do about it, and the only thing that
  // actually worked was tapping that one button off and straight back on.
  //
  // The tool cannot tell "I agree with this one" from "I have not got to this
  // one yet" — the two screens are identical — so it stops guessing, says which
  // pieces are still Maya's, and offers the teacher the one button that settles
  // it. These checks drive that whole path.
  // =========================================================================
  await fresh(page, base, { firstVisit: true });
  await replaceEveryScoreExcept(page, 0);          // agrees with Maya on row 1
  await retype(page, 'initials', 'R.K.');
  await setValue(page, 'assessDate', '2026-08-07');
  await setValue(page, 'strengthsComment', 'Rosa retells in order and checks the page.');
  await setValue(page, 'stretchesComment', 'Digraphs are still guessed at.');
  const agreed = await screenState(page);
  check('a teacher who agrees with the sample on one skill still sees the label',
        agreed.banner && agreed.scored === 6, JSON.stringify(agreed));
  check('...and is now TOLD it is one score, not just "some of her"',
        /Still hers: one score\./.test(agreed.bannerSentence), agreed.bannerSentence);
  eq('...and is offered the button that settles it, in one click',
     agreed.claimBtn, 'That score is mine, not Maya\'s');
  // The contrast sweep further up runs on the FIRST screen, where this button
  // is hidden — so its colours would never have been measured. It sits on the
  // amber banner rather than on the page, which is its own background problem.
  check('...and that button can actually be read against the amber banner',
        (await page.evaluate(CONTRAST_SWEEP)).length === 0,
        (await page.evaluate(CONTRAST_SWEEP)).join(' | '));
  // A teacher without a mouse has to be able to settle it too.
  const byKeyboard = await page.evaluate(() => {
    const b = document.getElementById('claimScoresBtn');
    b.focus();
    return document.activeElement === b;
  });
  check('...and reached from the keyboard, not only with a mouse', byKeyboard);
  await page.click('#claimScoresBtn');
  const claimed = await screenState(page);
  check('claiming that score takes the sample label off the screen',
        !claimed.banner && claimed.scored === 6, JSON.stringify(claimed));
  check('...and says so, rather than changing in silence',
        /Marked as your own/.test(await sayMsg(page)), await sayMsg(page));
  await page.click('#csvBtn');
  const claimedCsv = await lastCsv(page);
  check('...and the spreadsheet is a clean record of R.K.',
        claimedCsv.indexOf('Maya Torres') === -1 &&
        /^R\.K\.,2026-08-07,,/m.test(claimedCsv.split('\r\n')[1]),
        claimedCsv.split('\r\n')[1].slice(0, 120));
  check('...and SAMPLE- is off the filename',
        (await lastName(page)).indexOf('SAMPLE') === -1, await lastName(page));
  await page.click('#pdfBtn');
  check('...and the printed report carries no sample line either',
        await page.evaluate(() => !window.__pdf.__lines.some(l => /[Ss]ample/.test(l))),
        await page.evaluate(() => window.__pdf.__lines.join(' | ').slice(0, 200)));
  // The claim has to reach the disk. refreshSampleFlag() only writes when it
  // sees the flag or the count move, and emptying the list is invisible to that
  // test when the label stays on for the comments — so a reload would have
  // handed the claimed scores straight back to Maya.
  await page.reload({ waitUntil: 'load' });
  const claimedAgain = await screenState(page);
  check('...and the claim survives the tab being reloaded',
        !claimedAgain.banner && claimedAgain.scored === 6 && claimedAgain.initials === 'R.K.',
        JSON.stringify(claimedAgain));

  // Claiming scores is not a way to un-label a made-up record: it only ever
  // moves the SCORES, and Maya's two paragraphs are her own words that nobody
  // can "agree" with. Left in place, they keep the label on.
  await fresh(page, base, { firstVisit: true });
  await replaceEveryScoreExcept(page, 0);
  await retype(page, 'initials', 'R.K.');
  const partly = await screenState(page);
  check('with her paragraphs still there, the banner names all three pieces',
        /Still hers: one score, the Strengths comment and the Stretches comment\./
          .test(partly.bannerSentence), partly.bannerSentence);
  await page.click('#claimScoresBtn');
  const stillHerWords = await screenState(page);
  check('claiming the scores does NOT clear a label her paragraphs still earn',
        stillHerWords.banner, JSON.stringify(stillHerWords));
  check('...and the banner drops the score from the list of what is left',
        /Still hers: the Strengths comment and the Stretches comment\./
          .test(stillHerWords.bannerSentence), stillHerWords.bannerSentence);
  eq('...and stops offering a button with nothing left to claim',
     stillHerWords.claimBtn, '');
  // ...and stops offering it in words as well. A banner that says "or say the
  // scores are yours" beside no such button is an instruction pointing at
  // nothing, and this is the state a teacher lands in the moment she claims.
  check('...and stops telling her to press a button that is no longer there',
        !/say the scores are yours/.test(stillHerWords.bannerSentence) &&
        /say the scores are yours/.test(partly.bannerSentence),
        stillHerWords.bannerSentence);
  await page.click('#csvBtn');
  check('...and the spreadsheet still marks the record as part sample',
        /Part sample/.test(await lastCsv(page)),
        (await lastCsv(page)).split('\r\n')[1].slice(0, 120));

  // And it is not offered at all while the screen is still the sample exactly,
  // or it would be a one-click way to strip the warning off a wholly made-up
  // record.
  await fresh(page, base, { firstVisit: true });
  const untouched = await screenState(page);
  eq('the claim button is not offered on the untouched sample', untouched.claimBtn, '');
  check('...and the hidden button puts no words into the warning itself',
        untouched.bannerText === untouched.bannerSentence &&
        /These scores are made up/.test(untouched.bannerSentence), untouched.bannerText);

  // And the other half: her paragraphs left in place under replaced scores.
  await fresh(page, base, { firstVisit: true });
  await retype(page, 'initials', 'R.K.');
  await replaceEveryScore(page);
  check('made-up COMMENTS left under a real child still count as sample data',
        (await screenState(page)).banner);
  await setValue(page, 'strengthsComment', 'Rosa reads the pictures first, every time.');
  check('...and one of the two is still enough to keep the label on',
        (await screenState(page)).banner);
  await setValue(page, 'stretchesComment', 'Blends stall at three sounds.');
  check('...and the label goes when the second one is replaced as well',
        !(await screenState(page)).banner);

  // The opposite mistake, which is the one that made this hard: a REAL child
  // must never be branded the sample by coincidence. Three levels and six
  // skills — a real child shares a level with Maya on at least one skill about
  // nine times out of ten — and her initials are two letters anybody can have.
  await fresh(page, base);
  await typeIn(page, 'initials', 'M.T.');
  await scoreExactlyLikeMaya(page);
  const doppel = await screenState(page);
  check('a real child who scores just like Maya is NOT branded the sample',
        !doppel.banner && doppel.scored === 6, JSON.stringify(doppel));
  await page.click('#csvBtn');
  const doppelCsv = await lastCsv(page);
  check('...and her spreadsheet rows say nothing about a sample',
        doppelCsv.split('\r\n').slice(1).every(r => !/[Ss]ample/.test(r)),
        doppelCsv.split('\r\n')[1].slice(0, 120));

  // A record saved by an OLDER version of this file, which kept nothing but a
  // yes/no flag: the flag could be left on top of a real child, because it used
  // to survive everything a teacher typed. Reading it back must not brand her.
  await fresh(page, base);
  await page.evaluate(() => {
    const s = {};
    READING_SKILLS.forEach((k, i) => { s[k] = i % 2 ? 'Emerging' : 'Developing'; });
    localStorage.setItem('readingScores', JSON.stringify(s));
    localStorage.setItem('readingInitials', 'R.K.');
    localStorage.setItem('readingStrengths', 'Rosa reads the pictures first, every time.');
    localStorage.setItem('readingStretches', 'Blends stall at three sounds.');
    localStorage.setItem('readingSample', 'yes');       // the old flag, left on
    localStorage.removeItem('readingSampleScores');     // never written back then
  });
  await page.reload({ waitUntil: 'load' });
  const oldReal = await screenState(page);
  check('a stale sample flag saved by an older version does not brand a real child',
        !oldReal.banner && oldReal.initials === 'R.K.', JSON.stringify(oldReal));
  await page.click('#csvBtn');
  check('...and her spreadsheet comes out clean',
        (await lastCsv(page)).split('\r\n').slice(1).every(r => !/[Ss]ample/.test(r)));

  // The same old record, but it really was Maya: the label has to be worked out
  // from her values, and it has to hold when the teacher touches one field.
  await fresh(page, base);
  await page.evaluate(() => {
    localStorage.setItem('readingScores', JSON.stringify(SAMPLE_STUDENT.scores));
    localStorage.setItem('readingInitials', SAMPLE_STUDENT.initials);
    localStorage.setItem('readingStrengths', SAMPLE_STUDENT.strengths);
    localStorage.setItem('readingStretches', SAMPLE_STUDENT.stretches);
    localStorage.setItem('readingSample', 'yes');
    localStorage.removeItem('readingSampleScores');
  });
  await page.reload({ waitUntil: 'load' });
  check('...while an old record that really is the sample keeps its label',
        (await screenState(page)).banner);
  await page.click('#initials');
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  const oldNibbled = await screenState(page);
  check('...and keeps it through the first keystroke, because her scores are still there',
        oldNibbled.banner && oldNibbled.scored === 6, JSON.stringify(oldNibbled));

  // Clearing a half-replaced screen is no longer free: the teacher's own typing
  // is on it, so the button has to ask and has to leave a way back.
  await fresh(page, base, { firstVisit: true });
  await retype(page, 'initials', 'R.K.');
  await setValue(page, 'strengthsComment', 'Rosa reads the pictures first, every time.');
  await page.evaluate(() => { window.__confirms = []; });
  await page.click('#sampleBtn');
  const askedFirst = await page.evaluate(() => window.__confirms.slice());
  check('clearing a half-replaced screen asks before it throws the typing away',
        askedFirst.length === 1 && /your own typing/i.test(askedFirst[0]), askedFirst.join(' | '));
  const afterMixedClear = await screenState(page);
  check('...and offers it back afterwards',
        afterMixedClear.scored === 0 && afterMixedClear.undoShown,
        JSON.stringify(afterMixedClear));
  await page.click('#undoClearBtn');
  const mixedBack = await screenState(page);
  eq('...and it comes back with the teacher\'s own words in it',
     mixedBack.strengths, 'Rosa reads the pictures first, every time.');
  check('...still marked as part sample, because Maya\'s scores came back too',
        mixedBack.banner, JSON.stringify(mixedBack));

  // And the label DOES follow the sample while she is still the sample.
  await fresh(page, base, { firstVisit: true });
  await page.click('#csvBtn');
  const sampleCsv = await lastCsv(page);
  const sampleName = await lastName(page);
  check('an untouched sample is labelled as one in the spreadsheet',
        sampleCsv.indexOf('Sample student — Maya Torres (M.T.) — not a real child') !== -1);
  check('...and in the filename, so a printed sheet can never pass for a real record',
        /SAMPLE-MT/.test(sampleName), sampleName);
  await page.click('#pdfBtn');
  check('...and on the PDF report, so a printed sheet carries the label too',
        await page.evaluate(() =>
          window.__pdf.__lines.some(l => /Sample student — Maya Torres/.test(l))));
  await page.click('#sampleBtn');
  eq('one click puts the sample student away again',
     (await screenState(page)).scored, 0);

  // =========================================================================
  group('What the PDF report says');
  // =========================================================================
  await fresh(page, base);
  await typeIn(page, 'initials', 'R.K.');
  await setValue(page, 'assessDate', '2026-08-07');
  await score(page, 0, 'm');
  await page.click('#pdfBtn');
  const plainPdf = await page.evaluate(() => window.__pdf.__lines);
  check('the PDF names the child and the date on the sheet itself',
        plainPdf.some(l => /Child: R\.K\.\s+·\s+Date: 2026-08-07/.test(l)),
        plainPdf.slice(0, 3).join(' | '));
  // THE DEFECT: one state of one thing, spelled two ways across two exports.
  check('an unscored skill is spelled the same way in the PDF as in the spreadsheet',
        plainPdf.some(l => /: Not scored/.test(l)) &&
        !plainPdf.some(l => /Not Scored/.test(l)),
        plainPdf.filter(l => /Not [Ss]cored/.test(l))[0]);

  // THE DEFECT, and it changed what the report SAID about a child: jsPDF's
  // built-in font is single-byte, so "Ł.K." printed as "Child: A.K." and a
  // comment reading "on ŏ versus ō" printed as "on O versus M" — a different
  // statement about the child — with whole phrases pushed off the paper.
  await fresh(page, base);
  await typeIn(page, 'initials', 'Ł.K.');
  await setValue(page, 'assessDate', '2026-08-07');
  await typeIn(page, 'stretchesComment', 'Still mixes b → d, and ŏ versus ō.');
  await page.click('#csvBtn');
  const markCsv = await lastCsv(page);
  await page.click('#pdfBtn');
  const markPdf = await page.evaluate(() => window.__pdf.__lines);
  const outOfRange = markPdf.filter(l => Array.from(l).some(c => c.charCodeAt(0) > 255));
  check('the PDF never sends the font a character it cannot print',
        outOfRange.length === 0, outOfRange.join(' | '));
  check('...so it cannot silently rename the child',
        markPdf.some(l => /Child: \?\.K\./.test(l)),
        markPdf.slice(0, 3).join(' | '));
  const markMsg = await sayMsg(page);
  check('...and the tool says out loud which characters it could not print',
        /could not print/.test(markMsg) && markMsg.indexOf('Ł') !== -1 &&
        markMsg.indexOf('ŏ') !== -1, markMsg);
  check('...and points at the export that does keep them',
        /Export CSV/.test(markMsg) && markCsv.indexOf('ŏ versus ō') !== -1, markMsg);

  // =========================================================================
  group('Keeping the work');
  // =========================================================================
  // THE DEFECT: scores were lost on reload.
  await fresh(page, base);
  await typeIn(page, 'initials', 'R.K.');
  await score(page, 0, 'e');
  await score(page, 1, 'm');
  // THE DEFECT: the comment boxes listened for 'change', which does not fire
  // until the box loses focus, so a comment typed and then left alone was gone.
  await page.click('#strengthsComment');
  await page.keyboard.type('Loves nonfiction.');
  await page.reload({ waitUntil: 'load' });
  const afterReload = await screenState(page);
  eq('the scores are still there after a refresh', afterReload.scored, 2);
  eq('...and so is the child', afterReload.initials, 'R.K.');
  eq('a comment survives a refresh without clicking away from the box first',
     afterReload.strengths, 'Loves nonfiction.');

  // THE DEFECT: a browser that refuses to store anything — a private window, or
  // a full disk — failed silently, and the teacher was never told their whole
  // assessment was not being kept.
  await harvest(page);
  await page.goto(base + '/index.html?breakstorage=1', { waitUntil: 'load' });
  // removeItem still works when setItem does not, so this really is a first
  // arrival at a browser that will not remember it.
  await page.evaluate(() => localStorage.clear());
  await harvest(page);
  await page.reload({ waitUntil: 'load' });
  const warned = await page.evaluate(() => {
    const bar = document.getElementById('storageWarn');
    return { shown: bar.classList.contains('show'), text: bar.textContent,
             role: bar.getAttribute('role') };
  });
  check('a browser that refuses to save says so, in its own bar on screen',
        warned.shown && /NOT BEING SAVED/.test(warned.text), JSON.stringify(warned));
  check('...loudly enough that a screen reader announces it', warned.role === 'alert');
  check('...and the tool still works, so nothing typed is thrown away',
        await page.evaluate(() => document.querySelectorAll('.skill').length === 6));
  // THE DEFECT this guards: the warning used to go through the shared status
  // line, so one "Spreadsheet saved to your Downloads folder." wiped it off the
  // screen and, because the tool only warns once, nothing ever brought it back.
  // Every failed write puts it straight back now.
  await page.evaluate(() => document.getElementById('storageWarn').classList.remove('show'));
  await typeIn(page, 'strengthsComment', 'Reads with real expression.');
  check('...and the warning comes back on the next thing that cannot be saved',
        await page.evaluate(() =>
          document.getElementById('storageWarn').classList.contains('show')));
  // THE DEFECT: a visit that cannot be remembered looks like a FIRST visit
  // every single time, so the sample student walked back in on every reload
  // however often she was cleared. She only offers herself where the tool can
  // remember being told no.
  check('the sample student does not walk back in where the tool cannot remember saying no',
        await page.evaluate(() =>
          !document.getElementById('sampleBanner').classList.contains('show')));

  // =========================================================================
  group('Clear, and getting it back');
  // =========================================================================
  // THE DEFECT: Clear destroyed everything on one click, with no question and
  // no way back.
  await fresh(page, base);
  await typeIn(page, 'initials', 'R.K.');
  await typeIn(page, 'strengthsComment', 'REAL NOTES ABOUT A REAL CHILD');
  await score(page, 0, 'e');
  await page.evaluate(() => { window.__confirmAnswer = false; window.__confirms = []; });
  await page.click('#clearBtn');
  const refused = await screenState(page);
  check('Clear asks before it throws anything away',
        (await page.evaluate(() => window.__confirms.length)) === 1);
  eq('...and answering no changes nothing', refused.initials, 'R.K.');
  eq('...and says so', /Nothing was changed/.test(await sayMsg(page)), true);

  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#clearBtn');
  eq('answering yes empties the tool', (await screenState(page)).scored, 0);
  check('...and offers the work back by name',
        /Undo clear/.test(await sayMsg(page)) &&
        (await screenState(page)).undoShown, await sayMsg(page));
  await page.reload({ waitUntil: 'load' });
  check('...and the offer survives closing the tab', (await screenState(page)).undoShown);
  await page.click('#undoClearBtn');
  const broughtBack = await screenState(page);
  eq('pressing it brings the assessment back whole', broughtBack.initials, 'R.K.');
  eq('...with its comment', broughtBack.strengths, 'REAL NOTES ABOUT A REAL CHILD');
  eq('...and its scores', broughtBack.scored, 1);

  // THE DEFECT: Clear on an already-empty screen took a snapshot of nothing and
  // wrote it over the assessment the tool was still holding.
  await fresh(page, base);
  await typeIn(page, 'initials', 'R.K.');
  await score(page, 0, 'e');
  await page.click('#clearBtn');
  await page.click('#clearBtn');
  check('Clear on an already-empty tool does not spend the way back',
        (await stash(page)).initials === 'R.K.', JSON.stringify(await stash(page)));

  // THE DEFECT: that guard read `!sampleLoaded && !hasRealWork()`, and the
  // sample flag defeated it. A teacher who put their own assessment away and
  // then emptied Maya out BY HAND met a blank screen with the banner still up —
  // and Clear asked about work that was not there, then wrote a snapshot of
  // NOTHING over the assessment they had put away, with no way back.
  await fresh(page, base);
  await typeIn(page, 'initials', 'R.K.');
  await typeIn(page, 'strengthsComment', 'REAL NOTES ABOUT A REAL CHILD');
  await score(page, 0, 'e');
  await page.click('#sampleBtn');                       // R.K. goes into the stash
  eq('putting the sample student on top puts the real one away',
     (await stash(page)).initials, 'R.K.');
  // Empty Maya by hand, exactly as a teacher would: select and delete.
  for (const id of ['initials', 'strengthsComment', 'stretchesComment']){
    await retype(page, id, '');
  }
  await setValue(page, 'assessDate', '');
  for (let i = 0; i < 6; i++){
    const lit = await page.evaluate(r => {
      const b = document.querySelectorAll('.skill')[r].querySelector('.btn-score.e, .btn-score.d, .btn-score.m');
      return b ? b.textContent : null;
    }, i);
    if (lit) await score(page, i, lit.toLowerCase());
  }
  const handEmptied = await screenState(page);
  eq('emptying the sample by hand really does leave a blank screen', handEmptied.scored, 0);
  await page.click('#clearBtn');
  check('Clear on a screen emptied by hand does not spend the way back either',
        (await stash(page)) && (await stash(page)).initials === 'R.K.',
        JSON.stringify(await stash(page)));
  check('...and says there was nothing to clear',
        /nothing to clear/.test(await sayMsg(page)), await sayMsg(page));
  await page.click('#undoClearBtn');
  eq('...so the real assessment still comes back',
     (await screenState(page)).strengths, 'REAL NOTES ABOUT A REAL CHILD');

  // THE DEFECT: after a first-time visitor cleared the sample, the tool kept
  // MAYA in its one rescue slot and then promised "Your own assessment is safe"
  // to somebody who had never made one — and the button went on offering her
  // back after every reload.
  await fresh(page, base, { firstVisit: true });
  await page.click('#clearBtn');
  const afterSampleClear = await screenState(page);
  check('clearing the made-up child does not pretend to be holding your assessment',
        !afterSampleClear.undoShown && (await stash(page)) === null,
        JSON.stringify(await stash(page)));
  check('...and says plainly that the tool is now ready for a real reading',
        /ready for a real reading/.test(await sayMsg(page)), await sayMsg(page));
  await page.click('#sampleBtn');
  check('...and bringing her back does not promise a rescue that does not exist',
        !/your own assessment is safe/i.test(await sayMsg(page)), await sayMsg(page));

  // =========================================================================
  group('When the tool is asked to hold two children at once');
  // =========================================================================
  // The tool has exactly ONE place to keep a put-away assessment. Every path
  // that is about to take that place has to say plainly that something else is
  // standing in it, instead of choosing for the teacher in silence.
  await fresh(page, base);
  await typeIn(page, 'initials', 'A.A.');
  await score(page, 0, 'e');
  await page.click('#clearBtn');                       // A.A. goes into the slot
  await typeIn(page, 'initials', 'B.B.');
  await score(page, 1, 'm');
  await page.evaluate(() => { window.__confirmAnswer = false; window.__confirms = []; });
  await page.click('#clearBtn');
  const warning = await page.evaluate(() => window.__confirms[0] || '');
  check('putting a second child away warns that the first one will be lost',
        /only hold one assessment at a time/.test(warning) &&
        warning.indexOf('A.A.') !== -1 &&
        /CANNOT be brought back/.test(warning), warning.slice(0, 200));
  eq('...and answering no leaves both of them exactly where they were',
     (await screenState(page)).initials, 'B.B.');
  eq('...and the first child is still the one on offer',
     (await stash(page)).initials, 'A.A.');
  check('...and the tool says nothing was changed',
        /Nothing was changed/.test(await sayMsg(page)), await sayMsg(page));

  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#clearBtn');
  eq('answering yes puts the second child away instead', (await stash(page)).initials, 'B.B.');

  // THE DEFECT: Undo used to write the put-away assessment straight over
  // whatever was on the screen, with no question and no snapshot — so a teacher
  // who had started the NEXT child lost her on one click, with nothing left to
  // press.
  await typeIn(page, 'initials', 'C.C.');
  await score(page, 2, 'd');
  await page.evaluate(() => { window.__confirmAnswer = false; window.__confirms = []; });
  await page.click('#undoClearBtn');
  const swapAsk = await page.evaluate(() => window.__confirms[0] || '');
  check('bringing one back asks first when a different child is on the screen',
        swapAsk.indexOf('C.C.') !== -1 && /swaps the two of them/.test(swapAsk),
        swapAsk.slice(0, 200));
  eq('...and answering no keeps the child on the screen', (await screenState(page)).initials, 'C.C.');
  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#undoClearBtn');
  const swapped = await screenState(page);
  eq('answering yes swaps the two of them', swapped.initials, 'B.B.');
  eq('...and the one that was on screen is now the one on offer',
     (await stash(page)).initials, 'C.C.');
  eq('...under a button that says which', swapped.sampleBtn && await page.evaluate(() =>
     document.getElementById('undoClearBtn').textContent), 'Bring the other one back');

  // The sample student sitting on top of a real, put-away assessment: clearing
  // her must not touch it, and must say so.
  await fresh(page, base);
  await typeIn(page, 'initials', 'R.K.');
  await score(page, 0, 'e');
  await page.click('#sampleBtn');                      // R.K. into the slot, Maya on screen
  await page.evaluate(() => { window.__confirmAnswer = false; window.__confirms = []; });
  await page.click('#clearBtn');
  const mayaAsk = await page.evaluate(() => window.__confirms[0] || '');
  check('clearing the sample off the top says the real assessment is not touched',
        /is not touched/.test(mayaAsk) && mayaAsk.indexOf('R.K.') !== -1, mayaAsk);
  check('...and answering no leaves the sample on the screen',
        (await screenState(page)).banner);
  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#clearBtn');
  eq('...and answering yes clears only the sample', (await screenState(page)).scored, 0);
  eq('...leaving the real assessment where it was', (await stash(page)).initials, 'R.K.');
  check('...and saying so by the name on the button',
        /Bring my assessment back/.test(await sayMsg(page)), await sayMsg(page));

  // Same again through the sample button rather than Clear.
  await page.click('#sampleBtn');                      // Maya back on screen
  await page.click('#sampleBtn');                      // and away again
  check('putting the sample away by its own button also says the real one is safe',
        /still here/.test(await sayMsg(page)) &&
        (await stash(page)).initials === 'R.K.', await sayMsg(page));

  // =========================================================================
  group('When what was saved cannot be read');
  // =========================================================================
  // THE DEFECT: an unguarded JSON.parse threw before the skills had ever been
  // drawn, so one bad value in storage left the whole tool as an empty box with
  // nothing said about why.
  await fresh(page, base);
  await page.evaluate(() => localStorage.setItem('readingScores', 'this is not json'));
  await page.reload({ waitUntil: 'load' });
  const damaged = await page.evaluate(() => ({
    rows: document.querySelectorAll('.skill').length,
    said: document.getElementById('sayMsg').textContent,
    left: localStorage.getItem('readingScores')
  }));
  check('a damaged saved file leaves a working tool, not an empty box',
        damaged.rows === 6 && /could not be read/.test(damaged.said) && damaged.left === null,
        JSON.stringify(damaged));

  // THE DEFECT: a stash was accepted on the strength of its `scores` field
  // alone, so a damaged one made "Undo clear" write the word "undefined" into
  // the child's initials and both comment boxes — and then save it.
  await fresh(page, base);
  await page.evaluate(() => localStorage.setItem('readingStash', '{"why":"clear"}'));
  await page.reload({ waitUntil: 'load' });
  const badStash = await page.evaluate(() => ({
    offered: document.getElementById('undoClearBtn').classList.contains('show'),
    left: localStorage.getItem('readingStash')
  }));
  check('a damaged put-away assessment is not offered back as the word "undefined"',
        !badStash.offered && badStash.left === null, JSON.stringify(badStash));

  // =========================================================================
  group('Two tabs open on the same laptop');
  // =========================================================================
  // THE DEFECT: with the tool open twice, one tap in the older tab wrote its
  // stale fields over the newer tab's record — producing a saved assessment
  // carrying one child's initials and another child's scores, with no confirm,
  // no warning and no way back for the second child.
  await fresh(page, base);
  await typeIn(page, 'initials', 'R.K.');
  await score(page, 0, 'e');
  await score(page, 1, 'e');

  const tabB = await browser.newPage();
  await tabB.setRequestInterception(true);
  tabB.on('request', r => /jspdf/i.test(r.url())
    ? r.respond({ status: 200, contentType: 'text/javascript', body: JSPDF_STUB })
    : r.continue());
  await tabB.evaluateOnNewDocument(() => { window.confirm = () => true; });
  await tabB.goto(base + '/index.html', { waitUntil: 'load' });
  await tabB.bringToFront();
  eq('a second tab opens on the same child', await tabB.evaluate(() =>
     document.getElementById('initials').value), 'R.K.');

  await tabB.click('#clearBtn');
  await tabB.click('#initials');
  await tabB.keyboard.type('T.W.');
  await tabB.click('.skill:nth-of-type(4) .btn-score:nth-of-type(3)');
  await tabB.click('.skill:nth-of-type(5) .btn-score:nth-of-type(3)');
  await wait(400);
  await page.bringToFront();

  const tabACaughtUp = await screenState(page);
  eq('the first tab catches up instead of holding a stale child',
     tabACaughtUp.initials, 'T.W.');
  eq('...with the newer child\'s scores, not the older one\'s', tabACaughtUp.scored, 2);
  check('...and says why the screen changed under the teacher',
        /another tab/.test(await sayMsg(page)), await sayMsg(page));

  await score(page, 5, 'd');
  await wait(200);
  const blended = await page.evaluate(() => ({
    initials: localStorage.getItem('readingInitials'),
    scores: Object.keys(JSON.parse(localStorage.getItem('readingScores') || '{}')).length
  }));
  check('one child\'s initials can no longer end up welded to another\'s scores',
        blended.initials === 'T.W.' && blended.scores === 3, JSON.stringify(blended));
  await tabB.close();
  await page.bringToFront();

  // =========================================================================
  group('The printed page');
  // =========================================================================
  // THE DEFECT: printing clipped both comment boxes to the 78px height of the
  // textarea, so the end of a teacher's writing never reached the paper — with
  // no ellipsis and no scrollbar to show anything was missing — while the CSV
  // and the PDF carried it in full. And the tool itself recommends printing as
  // the fallback when the PDF library is blocked.
  await fresh(page, base, { firstVisit: true });
  await page.emulateMediaType('print');
  const printed = await page.evaluate(() => {
    const ta = document.getElementById('strengthsComment');
    const copy = document.getElementById('strengthsPrint');
    return { taShown:   getComputedStyle(ta).display !== 'none',
             copyShown: getComputedStyle(copy).display !== 'none',
             sameText:  copy.textContent === ta.value,
             clipped:   copy.scrollHeight > copy.clientHeight + 1,
             tail:      copy.textContent.slice(-18) };
  });
  check('the whole of a comment reaches the paper, not the first four lines',
        !printed.taShown && printed.copyShown && printed.sameText && !printed.clipped,
        JSON.stringify(printed));
  check('...right down to the last words the teacher wrote',
        /proves her point\./.test(printed.tail), printed.tail);

  // THE DEFECT: '.count-item:hover' was in the print stylesheet's display:none
  // list — plainly meant to switch off the hover animation, but it hid the tile.
  // :hover is not cleared when a print job renders, so the printed record
  // silently dropped whichever count the mouse was resting on, contradicting
  // the legend printed two inches above it.
  await page.emulateMediaType(null);
  await fresh(page, base, { firstVisit: true });
  await page.hover('#tile-d');
  await page.emulateMediaType('print');
  const hoveredPrint = await page.evaluate(() => ({
    hovering: document.getElementById('tile-d').matches(':hover'),
    shown: ['e','d','m'].map(k =>
      getComputedStyle(document.getElementById('tile-' + k)).display !== 'none')
  }));
  check('all three counts print, even the one the mouse is resting on',
        hoveredPrint.hovering && hoveredPrint.shown.every(Boolean),
        JSON.stringify(hoveredPrint));

  await page.emulateMediaType(null);
  await page.click('#tile-d');
  await page.keyboard.press('Escape');
  await page.emulateMediaType('print');
  const tappedPrint = await page.evaluate(() => ({
    shown: ['e','d','m'].map(k =>
      getComputedStyle(document.getElementById('tile-' + k)).display !== 'none'),
    ring: getComputedStyle(document.getElementById('tile-d')).outlineStyle
  }));
  check('all three counts still print after the teacher taps one to look at it',
        tappedPrint.shown.every(Boolean), JSON.stringify(tappedPrint));
  check('...and the printed sheet has no black focus ring around it',
        tappedPrint.ring === 'none', tappedPrint.ring);
  await page.emulateMediaType(null);

  // The sample banner is deliberately NOT in the print-hidden list — a printed
  // sheet of a made-up child has to carry the warning. The button that now sits
  // inside it is a different matter: on paper it is not a button any more, it
  // is the sentence "Those 6 scores are mine, not Maya's" printed immediately
  // under a warning that says the opposite.
  await fresh(page, base, { firstVisit: true });
  await page.click('#initials');
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  await page.emulateMediaType('print');
  const bannerOnPaper = await page.evaluate(() => ({
    warning: getComputedStyle(document.getElementById('sampleBanner')).display !== 'none',
    claim:   document.getElementById('claimScoresBtn').getClientRects().length
  }));
  check('a part-sample sheet still prints its warning',
        bannerOnPaper.warning, JSON.stringify(bannerOnPaper));
  check('...but the claim button does not print as a contradicting sentence',
        bannerOnPaper.claim === 0, JSON.stringify(bannerOnPaper));
  await page.emulateMediaType(null);

  // =========================================================================
  group('The box that opens when you click a count');
  // =========================================================================
  await fresh(page, base);
  await score(page, 0, 'e');
  await score(page, 1, 'e');
  await score(page, 2, 'd');
  await page.click('#tile-e');
  eq('clicking a count opens the list of skills behind it',
     await page.evaluate(() => document.querySelectorAll('#modalSkillsList .skill-item').length), 2);
  await page.keyboard.press('Escape');

  // The slices and the tiles were mouse-only: a click handler and nothing else,
  // so a keyboard could not reach them at all.
  await page.focus('#tile-d');
  await page.keyboard.press('Enter');
  check('a count can be opened from the keyboard as well as the mouse',
        await page.evaluate(() => document.getElementById('skillsModal').classList.contains('show')));
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelector('#pieChart path, #pieChart circle').focus());
  await page.keyboard.press(' ');
  check('...and so can a slice of the chart',
        await page.evaluate(() => document.getElementById('skillsModal').classList.contains('show')));
  await page.keyboard.press('Escape');

  // A band with nothing in it has to say so rather than open an empty box.
  await page.click('#tile-m');
  check('a count of nought opens a box that says there is nothing in it',
        await page.evaluate(() =>
          /No skills in this category/.test(document.getElementById('modalSkillsList').textContent)));
  await page.keyboard.press('Escape');
  await page.click('#tile-e');

  // THE DEFECT: Tab walked straight OUT of the open box onto Clear and Export —
  // buttons sitting under the grey overlay where a mouse physically cannot
  // reach them — and Enter fired them. Clear wiped the assessment while the box
  // was still open on top of it, still listing skills that no longer had scores.
  const escapees = [];
  for (let i = 0; i < 6; i++){
    await page.keyboard.press('Tab');
    escapees.push(await page.evaluate(() =>
      document.getElementById('skillsModal').contains(document.activeElement)));
  }
  check('the keyboard cannot escape the open box onto Clear behind it',
        escapees.every(Boolean), JSON.stringify(escapees));
  await page.keyboard.press('Enter');
  eq('...so nothing behind the box can be fired by accident',
     (await screenState(page)).scored, 3);
  // Close it deliberately. Clicking #tile-e while the box is up would land on
  // the backdrop covering it, which is a CLOSE — a test that reopened the box
  // that way was in fact measuring a closed one.
  await page.keyboard.press('Escape');

  // THE DEFECT: the box closed on any mouse-up over the backdrop, including the
  // end of a drag that STARTED inside it — so selecting a skill name to copy it
  // closed the box and threw the selection away.
  await page.click('#tile-e');
  check('the box is open before the drag begins',
        await page.evaluate(() =>
          document.getElementById('skillsModal').classList.contains('show')));
  const nameBox = await page.evaluate(() => {
    const r = document.querySelector('#modalSkillsList .skill-item-name').getBoundingClientRect();
    return { x: r.left + 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(nameBox.x, nameBox.y);
  await page.mouse.down();
  await page.mouse.move(nameBox.x + 220, nameBox.y);
  await page.mouse.move(30, nameBox.y + 260);
  await page.mouse.up();
  check('selecting the text inside the box does not close the box',
        await page.evaluate(() =>
          document.getElementById('skillsModal').classList.contains('show')));

  // THE DEFECT: the page went on scrolling under the open box — a trackpad
  // flick over the backdrop moved the whole tool 247px while the box sat still,
  // and the box's own hint ("click outside this box to close it") was aimed at
  // a moving target.
  await page.setViewport({ width: 1280, height: 620 });
  const room = await page.evaluate(() =>
    document.documentElement.scrollHeight - window.innerHeight);
  // A real wheel gesture over the dark backdrop — window.scrollBy() would be a
  // programmatic scroll, which overflow:hidden does not stop and a trackpad is
  // not. Measure the gesture the teacher actually makes.
  await page.mouse.move(200, 500);
  await page.mouse.wheel({ deltaY: 800 });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
  const afterWheel = await page.evaluate(() => window.scrollY);
  check('the page holds still behind the open box',
        room > 100 && afterWheel === 0,
        JSON.stringify({ room, afterWheel }));
  await page.setViewport({ width: 1280, height: 900 });

  // The two gestures everybody tries on a box like this still work.
  await page.mouse.click(30, 400);
  check('a click on the dark backdrop still closes the box',
        await page.evaluate(() =>
          !document.getElementById('skillsModal').classList.contains('show')));
  await page.click('#tile-e');
  await page.keyboard.press('Escape');
  check('and so does Escape',
        await page.evaluate(() =>
          !document.getElementById('skillsModal').classList.contains('show')));

  // =========================================================================
  group('On a teacher\'s iPad, held in portrait');
  // =========================================================================
  // THE DEFECT: the skills list was a 350px scroll box, and the fix that lifted
  // the cap only applied below 780px — so an iPad in portrait, at 810-834px, was
  // the exact device the fix missed. The sixth skill was sliced in half, its
  // buttons bisected, with the page itself not scrolling and blank space below.
  for (const width of [768, 820, 834, 1000, 1280]){
    await page.setViewport({ width, height: 1180 });
    await fresh(page, base, { firstVisit: true });
    const fit = await page.evaluate(() => {
      const list = document.getElementById('skillsList');
      const box = list.getBoundingClientRect();
      const rows = Array.from(document.querySelectorAll('.skill'));
      return { hidden: list.scrollHeight > list.clientHeight + 1,
               cut: rows.filter(r => r.getBoundingClientRect().bottom > box.bottom + 1).length,
               rows: rows.length };
    });
    check(`all six skills are fully on the page at ${width}px wide`,
          fit.rows === 6 && !fit.hidden && fit.cut === 0, JSON.stringify(fit));
  }

  // THE DEFECT: the E/D/M buttons — the gesture a teacher makes six times per
  // child, one-handed, while holding the thing — were 29x26, and the × on the
  // box was 15.7px wide, under the WCAG 2.2 minimum of 24x24 outright.
  await page.setViewport({ width: 820, height: 1180, isMobile: true, hasTouch: true });
  await fresh(page, base, { firstVisit: true });
  const targets = await page.evaluate(() => {
    const b = document.querySelector('.btn-score').getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height) };
  });
  check('the score buttons are big enough to hit with a finger',
        targets.w >= 44 && targets.h >= 44, JSON.stringify(targets));
  await page.click('#tile-e');
  const closeSize = await page.evaluate(() => {
    const b = document.getElementById('closeModalBtn').getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height) };
  });
  check('the close button on the box is big enough to hit too',
        closeSize.w >= 44 && closeSize.h >= 44, JSON.stringify(closeSize));
  await page.keyboard.press('Escape');

  // A 320px phone still must not scroll sideways.
  await page.setViewport({ width: 320, height: 700, isMobile: true, hasTouch: true });
  await fresh(page, base, { firstVisit: true });
  check('a 320px phone does not scroll sideways',
        await page.evaluate(() =>
          document.documentElement.scrollWidth <= window.innerWidth + 1),
        await page.evaluate(() =>
          document.documentElement.scrollWidth + ' vs ' + window.innerWidth));
  // ...including with the longer "some of Maya is still here" sentence in the
  // banner, which is the one a visitor typing over her actually sees.
  await page.click('#initials');
  await page.keyboard.press('End');
  await page.keyboard.press('Backspace');
  check('...not even with the longer part-sample banner up',
        await page.evaluate(() =>
          document.getElementById('sampleBanner').classList.contains('show') &&
          document.documentElement.scrollWidth <= window.innerWidth + 1),
        await page.evaluate(() =>
          document.documentElement.scrollWidth + ' vs ' + window.innerWidth));
  await page.setViewport({ width: 1280, height: 900 });

  // =========================================================================
  group('Told out loud, for a teacher who cannot see the screen');
  // =========================================================================
  // THE DEFECT: #sayMsg is the tool's only voice — and it was a plain div with
  // no role and no aria-live, so none of it was spoken. Pressing Clear on an
  // already-empty tool changes nothing else on the whole page, so the button
  // simply appeared to be broken.
  await fresh(page, base);
  const voice = await page.evaluate(() => {
    const m = document.getElementById('sayMsg');
    return { role: m.getAttribute('role'), live: m.getAttribute('aria-live'),
             atomic: m.getAttribute('aria-atomic') };
  });
  check('what the tool just did is announced, not only shown',
        voice.role === 'status' && voice.live === 'polite' && voice.atomic === 'true',
        JSON.stringify(voice));

  await score(page, 0, 'e');
  const spoken = await page.evaluate(() => ({
    chart: document.getElementById('pieChart').getAttribute('aria-label'),
    tile:  document.getElementById('tile-e').getAttribute('aria-label'),
    pressed: document.querySelector('.btn-score.e').getAttribute('aria-pressed')
  }));
  check('the chart and the counts describe themselves as the numbers change',
        /Emerging 1/.test(spoken.chart) && /1 skill of 1/.test(spoken.tile) &&
        spoken.pressed === 'true', JSON.stringify(spoken));

  // =========================================================================
  group('Nothing broke while all of the above ran');
  // =========================================================================
  check('still no JavaScript errors after every check',
        pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  check('still no console errors after every check',
        consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  // -------------------------------------------------------------------------
  // Coverage report
  // -------------------------------------------------------------------------
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

        // Chrome may hand back either the whole document or just the inline
        // script body. Handle both: when it is the whole document, measure only
        // between the script tags, so the HTML and CSS — which are not
        // executable — cannot flatter the number.
        //
        // Whether it IS the whole document has to be decided by how the text
        // STARTS, not by searching for "<script>" anywhere in it. A comment in
        // the tool's own JavaScript mentions that tag, so the search found it
        // inside the script body, then found no closing tag to pair it with,
        // and the whole report silently measured a range of zero lines and
        // printed "every executable line was run by a test".
        const wholeDoc = /^\s*<!doctype|^\s*<html/i.test(text);
        const tag   = wholeDoc ? text.indexOf('<script>') : -1;
        const open  = wholeDoc ? tag + '<script>'.length : 0;
        const close = wholeDoc ? text.lastIndexOf('</script>') : text.length;

        let lineShift = 0;
        if (!wholeDoc){
          const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
          const at = html.indexOf('\n<script>');
          if (at !== -1) lineShift = html.slice(0, at + 1).split('\n').length - 1;
        }

        const lineStarts = [0];
        for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);
        const lineOf = off => {
          let lo = 0, hi = lineStarts.length - 1;
          while (lo < hi){ const mid = (lo + hi + 1) >> 1;
            if (lineStarts[mid] <= off) lo = mid; else hi = mid - 1; }
          return lo;
        };

        const dead = [];
        let executable = 0, covered = 0;
        for (let ln = lineOf(open); ln <= lineOf(close); ln++){
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
          console.log(`\n  ${DIM}Each line above is untested. Either write a test that runs it` +
                      ` and\n  asserts on the result, or delete it because nothing can reach it.${X}`);
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
  // Several checks read a value out of the page first. If that read ever comes
  // back undefined the check does not fail — it can silently stop happening,
  // and the run still ends green. That is how a suite quietly shrinks. So the
  // count itself is a check: if it moves, either you added checks (put the new
  // number here, deliberately) or some stopped running (find out why).
  // -------------------------------------------------------------------------
  const EXPECTED_CHECKS = Number(process.env.EXPECTED_CHECKS || 0);
  const ran = passed + failures.length;
  if (EXPECTED_CHECKS && ran !== EXPECTED_CHECKS){
    failures.push({
      name: `the suite ran ${ran} checks, but ${EXPECTED_CHECKS} were expected`,
      detail: ran < EXPECTED_CHECKS
        ? 'Checks vanished rather than failed — look for a read that came back empty.'
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
