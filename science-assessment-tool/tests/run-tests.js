#!/usr/bin/env node
//
// Science Assessment Tool — regression tests.
//
// WHAT THIS IS
// ------------
// "Regression" means sliding backward. Every check in this file exists because
// something was once actually broken here. The point is not to prove the tool
// works today — it is so that a bug fixed in August cannot quietly come back in
// November without anybody noticing.
//
// Each check is named for what a PERSON would notice, not for the function
// involved. If you fix a new bug, add a check for it the same day, while you
// still remember what went wrong.
//
// HOW TO RUN IT
// -------------
//     cd ~/Documents/GitHub/edtech-portfolio/science-assessment-tool/tests
//     npm test
//
// It opens a real Google Chrome in the background, drives the tool with real
// clicks and real keypresses, and prints a line per check.
//
// NOTHING IS INSTALLED HERE. package.json sets NODE_PATH to the running-record
// tool's node_modules, which already has puppeteer-core in it.
//
// NOTHING IS FETCHED FROM THE INTERNET EITHER. The tool loads jsPDF from a CDN;
// these tests intercept that one request and answer it themselves — with a
// stand-in jsPDF for most checks, with a refusal for the "the PDF library is
// blocked" checks, and with silence for the "a school filter that drops packets"
// check. So the suite gives the same answer on a plane as it does at a desk.
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
// The stand-in for jsPDF.
//
// The real one is 360KB downloaded from cdnjs. These tests need to know WHAT
// the tool put on the page, not how Adobe encodes it, so this records every
// line of text the tool draws and the file name it asks for. It is answered in
// place of the CDN by the request handler below.
// ---------------------------------------------------------------------------
const JSPDF_STUB = `
(function(){
  window.__pdf = null;
  window.__pdfSaveThrows = false;
  function Doc(){
    this.lines = [];
    this.pages = 1;
    this.internal = { pageSize: { getWidth: function(){ return 210; },
                                  getHeight: function(){ return 297; } } };
  }
  Doc.prototype.setFontSize = function(){};
  Doc.prototype.setTextColor = function(){};
  Doc.prototype.addPage = function(){ this.pages++; };
  Doc.prototype.text = function(t){ this.lines.push(String(t)); };
  Doc.prototype.splitTextToSize = function(t, w){
    var max = Math.max(10, Math.floor(w / 1.9)), out = [];
    String(t).split('\\n').forEach(function(par){
      var s = par;
      if (!s){ out.push(''); return; }
      while (s.length > max){
        var cut = s.lastIndexOf(' ', max);
        if (cut <= 0) cut = max;
        out.push(s.slice(0, cut));
        s = s.slice(cut).replace(/^ /, '');
      }
      out.push(s);
    });
    return out;
  };
  Doc.prototype.save = function(name){
    if (window.__pdfSaveThrows) throw new Error('the browser refused to save');
    window.__pdf = { name: name, lines: this.lines.slice(), pages: this.pages };
  };
  window.jspdf = { jsPDF: Doc };
})();
`;

// 'stub'  — answer with the stand-in above (the normal case)
// 'block' — refuse instantly, the way a firewall that says no behaves
// 'hang'  — never answer at all, the way a school content filter that drops
//           packets behaves. This is the one that used to leave a blank page.
let CDN_MODE = 'stub';

// ---------------------------------------------------------------------------
// Making a page: viewport, the intercepted CDN, and stubs for anything that
// would open a window or block on a dialog, so the handlers still run all the
// way through and can be inspected afterwards.
// ---------------------------------------------------------------------------
async function makePage(browser, collect){
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on('request', r => {
    if (/cdnjs|jspdf/i.test(r.url())){
      if (CDN_MODE === 'stub'){
        return r.respond({ status: 200, contentType: 'application/javascript',
                           body: JSPDF_STUB }).catch(() => {});
      }
      if (CDN_MODE === 'block') return r.abort('connectionrefused').catch(() => {});
      return;   // 'hang': never answered
    }
    r.continue().catch(() => {});
  });

  if (collect){
    page.on('pageerror', e => collect.pageErrors.push(e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      // Chrome's message for a failed request is the same generic sentence
      // whatever the file was — the URL lives in location(), not in the text.
      const url = (m.location() && m.location().url) || '';
      if (/favicon/i.test(url)) return;
      collect.consoleErrors.push(m.text() + (url ? '  [' + url + ']' : ''));
    });
  }

  await page.evaluateOnNewDocument(() => {
    window.__confirms = [];
    window.__confirmAnswer = true;
    window.confirm = m => { window.__confirms.push(String(m)); return window.__confirmAnswer; };
    window.__printed = 0;
    window.print = () => { window.__printed++; };
    window.alert = m => { window.__alert = String(m); };
    window.__downloads = [];
    // Catch anchor-triggered CSV downloads instead of writing to disk.
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[download]');
      if (a){
        e.preventDefault();
        window.__downloads.push({ name: a.getAttribute('download'),
                                  href: a.getAttribute('href') });
      }
    }, true);
    // A switch for "this browser refuses to save", which is what Safari's
    // private windows and a full disk both really do.
    window.__blockStorage = false;
    const realSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v){
      if (window.__blockStorage) throw new Error('QuotaExceededError');
      return realSet.call(this, k, v);
    };
  });
  return page;
}

// ---------------------------------------------------------------------------
// Helpers for driving the page
// ---------------------------------------------------------------------------
async function fresh(page, base){
  await page.goto('about:blank');
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

const st = page => page.evaluate(() => ({
  scored: Object.keys(scores).length,
  scores: Object.assign({}, scores),
  initials: document.getElementById('initials').value,
  date: document.getElementById('adate').value,
  strengths: document.getElementById('strengthsComment').value,
  stretches: document.getElementById('stretchesComment').value,
  isSample: isSample,
  banner: document.getElementById('sampleBanner').style.display !== 'none',
  bannerText: document.getElementById('sampleFlagText').textContent,
  undo: document.getElementById('undoBar').style.display !== 'none',
  undoText: document.getElementById('undoText').textContent,
  say: document.getElementById('saveMsg').textContent,
  notice: document.getElementById('noticeMsg').style.display !== 'none'
            ? document.getElementById('noticeText').textContent : '',
  storage: document.getElementById('storageMsg').style.display !== 'none'
            ? document.getElementById('storageMsg').textContent : '',
  counts: { e: +document.getElementById('count-e').textContent,
            d: +document.getElementById('count-d').textContent,
            m: +document.getElementById('count-m').textContent },
  confirms: window.__confirms.slice()
}));

const stored = page => page.evaluate(() => {
  const raw = localStorage.getItem(K_RECORD);
  return raw ? JSON.parse(raw) : null;
});

// The saved Undo copy, raw. It is a SECOND shared key, and "is this tab still
// writing?" has to be asked of both — see the two-tab Undo group below.
const storedUndo = page => page.evaluate(() => localStorage.getItem(K_UNDO));

// Everything this tool has put in storage, as one comparable string. Used to
// ask the whole question — "did this tab write ANYTHING?" — instead of the
// narrow one, "did this tab write the record?".
const dumpStorage = page => page.evaluate(() => {
  const out = {};
  for (let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    out[k] = localStorage.getItem(k);
  }
  return JSON.stringify(out, Object.keys(out).sort());
});

async function score(page, i, level){
  await page.click(`.btn-score[data-skill="${i}"][data-level="${level}"]`);
}
async function typeIn(page, sel, text){
  await page.click(sel);
  await page.type(sel, text, { delay: 0 });
}
async function replaceIn(page, sel, text){
  await page.click(sel);
  await page.$eval(sel, el => el.select());
  await page.keyboard.press('Backspace');
  await page.type(sel, text, { delay: 0 });
}
async function setConfirm(page, answer){
  await page.evaluate(a => { window.__confirmAnswer = a; window.__confirms = []; }, answer);
}
const lastDownload = page => page.evaluate(() => {
  const d = window.__downloads[window.__downloads.length - 1];
  return d ? { name: d.name, text: decodeURIComponent(d.href.replace(/^data:[^,]+,/, '')) } : null;
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
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    // Nothing here takes anywhere near a minute. Without this, a click on an
    // element that never becomes clickable hangs the whole run silently
    // instead of failing, which is a miserable thing to debug.
    protocolTimeout: 60000
  });
  const collect = { pageErrors: [], consoleErrors: [] };
  const page = await makePage(browser, collect);

  // =========================================================================
  group('A stranger opens the page');
  // =========================================================================
  await fresh(page, base);

  check('the page opens with no JavaScript errors',
        collect.pageErrors.length === 0, collect.pageErrors.join(' | '));
  check('the page opens with no console errors',
        collect.consoleErrors.length === 0, collect.consoleErrors.join(' | '));

  {
    const shown = await page.$$eval('.skill-name', els => els.map(e => e.textContent));
    eq('all six science skills are listed', shown.length, 6);
  }

  {
    // WAS: the skills box was capped at 350px tall with an overlay scrollbar, so
    // on an iPad in portrait the sixth skill was missing from the screen
    // altogether and there was nothing to scroll.
    await page.setViewport({ width: 834, height: 1194 });
    await page.reload({ waitUntil: 'load' });
    const cut = await page.evaluate(() => {
      const box = document.getElementById('skillsList').getBoundingClientRect();
      return [...document.querySelectorAll('.skill')]
        .filter(el => el.getBoundingClientRect().bottom > box.bottom + 1)
        .map(el => el.querySelector('.skill-name').textContent);
    });
    eq('on an iPad the sixth skill is on the screen like the other five', cut, []);
    await page.setViewport({ width: 1280, height: 900 });
    await page.reload({ waitUntil: 'load' });
  }

  {
    const meta = await page.evaluate(() => ({
      icon: !!document.querySelector('link[rel="icon"]'),
      desc: (document.querySelector('meta[name="description"]') || {}).content || '',
      og: document.querySelectorAll('meta[property^="og:"]').length
    }));
    check('a link to this tool has an icon and says what it is',
          meta.icon && meta.desc.length > 20 && meta.og >= 2, JSON.stringify(meta));
  }

  {
    // WAS: cursor:pointer sat on the whole chart, so the "No scores yet" ring
    // advertised itself as a button on a cold page and did nothing when clicked.
    const cur = await page.evaluate(() => getComputedStyle(document.getElementById('pieChart')).cursor);
    eq('the empty chart does not pretend to be a button', cur, 'default');
    await page.click('#pieChart');
    const open = await page.evaluate(() => document.getElementById('skillsModal').classList.contains('show'));
    check('clicking the empty chart does not open an empty pop-up', open === false);
  }

  // =========================================================================
  group('The chart  (was: blank whenever every skill was the same level)');
  // =========================================================================
  {
    await fresh(page, base);
    await score(page, 0, 'Mastered');
    const one = await page.evaluate(() => {
      const svg = document.getElementById('pieChart');
      const shapes = [...svg.querySelectorAll('circle, path')];
      return { drawn: shapes.filter(s => (s.getAttribute('fill') || '') !== '' &&
                                         s.getAttribute('fill') !== 'none').length,
               empty: /No scores yet/.test(svg.textContent) };
    });
    check('the chart draws something after the very first click',
          one.drawn >= 1 && !one.empty, JSON.stringify(one));

    for (let i = 1; i < 6; i++) await score(page, i, 'Mastered');
    const all = await page.evaluate(() => {
      const svg = document.getElementById('pieChart');
      const shapes = [...svg.querySelectorAll('circle, path')];
      return { drawn: shapes.filter(s => (s.getAttribute('fill') || '') !== '' &&
                                         s.getAttribute('fill') !== 'none').length,
               legend: svg.textContent };
    });
    check('the chart still draws when all six skills are the same level',
          all.drawn >= 1, JSON.stringify(all));
    check('the legend says which level that one colour is',
          /Mastered 6/.test(all.legend), all.legend);

    await score(page, 0, 'Emerging');
    const two = await page.evaluate(() =>
      document.querySelectorAll('#pieChart path').length);
    check('two levels in play draw as two slices', two === 2, String(two));
  }

  // =========================================================================
  group('A mis-clicked score  (was: only Clear could undo one)');
  // =========================================================================
  {
    await fresh(page, base);
    await score(page, 2, 'Emerging');
    let s = await st(page);
    eq('one tap sets a level', s.counts, { e: 1, d: 0, m: 0 });
    await score(page, 2, 'Emerging');
    s = await st(page);
    eq('tapping the same level again takes it back off', s.scored, 0);
    check('taking a score off does not wipe anything else', s.initials === '');
  }

  // =========================================================================
  group('Maya Torres, the sample student');
  // =========================================================================
  {
    await fresh(page, base);
    await page.click('button[onclick="fillSample()"]');
    const s = await st(page);
    eq('one click fills the tool in', s.scored, 6);
    eq('the sample is Maya Torres, initials only', s.initials, 'M.T.');
    check('she is named on screen as an example',
          s.banner && /Maya Torres/.test(s.bannerText) && /not a real child/.test(s.bannerText),
          s.bannerText);
    check('her profile is mixed, not perfect',
          s.counts.e > 0 && s.counts.d > 0 && s.counts.m > 0, JSON.stringify(s.counts));
    check('both comment boxes are filled so a visitor sees a whole report',
          s.strengths.length > 60 && s.stretches.length > 60);
  }

  {
    // WAS: "Clear the sample" wiped Maya in one click, but the Clear button next
    // to it threw a scary "Clear everything?" about work that did not exist and
    // then left a permanent Undo offer over an empty form.
    await setConfirm(page, true);
    await page.click('button[onclick="clearForm()"]');
    const s = await st(page);
    eq('clearing the untouched sample asks nothing', s.confirms.length, 0);
    eq('clearing the untouched sample empties the form', s.scored, 0);
    check('and leaves no Undo offering to bring made-up data back', s.undo === false);
  }

  {
    // WAS: isSample was switched on by the sample button and off by nothing, so
    // a real child typed over the sample got a PDF and a CSV stamped
    // "Sample student — Maya Torres" and file names saying SAMPLE.
    await fresh(page, base);
    await page.click('button[onclick="fillSample()"]');
    await replaceIn(page, '#initials', 'R.K.');
    let s = await st(page);
    check('typing over only the initials says which parts are still Maya\'s',
          /Part sample/.test(s.bannerText) && /strengths note/.test(s.bannerText),
          s.bannerText);

    await replaceIn(page, '#strengthsComment', 'Rosa asked about every shell on the tray.');
    await replaceIn(page, '#stretchesComment', 'Rosa needs a second try on the ramp.');
    for (let i = 0; i < 6; i++) await score(page, i, i < 3 ? 'Emerging' : 'Mastered');
    s = await st(page);
    check('once none of Maya is left the record stops calling itself an example',
          s.isSample === false && s.banner === false, JSON.stringify({ isSample: s.isSample, banner: s.banner }));

    await page.click('button[onclick="exportCsv()"]');
    const csv = await lastDownload(page);
    check('a real child\'s spreadsheet is not named SAMPLE',
          !/SAMPLE/.test(csv.name) && /RK/.test(csv.name), csv.name);
    check('and no row of it calls that real child a made-up example',
          !/Maya Torres/.test(csv.text) && !/not a real child/.test(csv.text));

    await page.click('button[onclick="exportPDF()"]');
    const pdf = await page.evaluate(() => window.__pdf);
    check('and neither does her PDF report',
          !/SAMPLE/.test(pdf.name) && !pdf.lines.some(l => /Maya Torres/.test(l)), pdf.name);

    const after = await page.reload({ waitUntil: 'load' }).then(() => st(page));
    check('and it is still her own record after a refresh', after.isSample === false);
  }

  {
    // The label has to reach the paper, or a printed sample sheet can be filed
    // as a real child's record.
    await fresh(page, base);
    await page.click('button[onclick="fillSample()"]');
    await page.click('button[onclick="exportCsv()"]');
    const csv = await lastDownload(page);
    check('the sample label is in the spreadsheet and in its file name',
          /SAMPLE/.test(csv.name) && /Maya Torres/.test(csv.text), csv.name);
    await page.click('button[onclick="exportPDF()"]');
    const pdf = await page.evaluate(() => window.__pdf);
    check('and on the PDF report and in its file name',
          /SAMPLE/.test(pdf.name) && pdf.lines.some(l => /Maya Torres/.test(l)), pdf.name);
  }

  // =========================================================================
  group('Who was assessed  (was: no name and no date anywhere)');
  // =========================================================================
  {
    await fresh(page, base);
    const box = await page.evaluate(() => {
      const el = document.getElementById('initials');
      return { max: el.maxLength,
               label: document.querySelector('label[for="initials"]').textContent.trim(),
               privacy: document.querySelector('.privacy').textContent,
               hasDate: !!document.getElementById('adate') };
    });
    eq('the child box takes initials only, four characters', box.max, 4);
    check('and says so on its label', /initials/i.test(box.label), box.label);
    check('the page says the work stays on this laptop',
          /Stays on this laptop/.test(box.privacy), box.privacy);
    check('there is a date box', box.hasDate === true);

    // WAS: the box silently swallowed the fifth character, so typing a name left
    // "MARC" on screen with nothing anywhere explaining why.
    await typeIn(page, '#initials', 'Marc');
    await page.keyboard.press('KeyO');
    const s = await st(page);
    check('typing a whole name says why only four characters stuck',
          /initials only/i.test(s.say), s.say);
  }

  {
    await fresh(page, base);
    await typeIn(page, '#initials', 'A.B.');
    await page.$eval('#adate', el => { el.value = '2026-05-04'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await score(page, 0, 'Mastered');
    await page.click('button[onclick="exportCsv()"]');
    const csv = await lastDownload(page);
    check('the initials and the date are in the spreadsheet',
          /A\.B\./.test(csv.text) && /2026-05-04/.test(csv.text));
    eq('and in its file name', csv.name, 'science-assessment-AB-2026-05-04.csv');
  }

  {
    // WAS: the file name stripped every character outside A-Z0-9, so "Á.Ñ." and
    // "É.Ö." both came out as "no-initials" — two children, one file name.
    await fresh(page, base);
    await typeIn(page, '#initials', 'Á.Ñ.');
    await page.click('button[onclick="exportCsv()"]');
    const one = await lastDownload(page);
    await fresh(page, base);
    await typeIn(page, '#initials', 'É.Ö.');
    await page.click('button[onclick="exportCsv()"]');
    const two = await lastDownload(page);
    check('two children with accented initials get two different file names',
          one.name !== two.name, one.name + ' vs ' + two.name);
    check('and neither of them is called "no-initials"',
          !/no-initials/.test(one.name) && !/no-initials/.test(two.name),
          one.name + ' / ' + two.name);
  }

  {
    // WAS: an emptied date box produced a report saying "(no date)" inside a
    // file whose name was stamped with today.
    await fresh(page, base);
    await typeIn(page, '#initials', 'C.D.');
    await page.$eval('#adate', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('button[onclick="exportCsv()"]');
    const csv = await lastDownload(page);
    check('a report with no date is not filed under today\'s date',
          /no-date/.test(csv.name), csv.name);
  }

  // =========================================================================
  group('Nothing is lost on a refresh');
  // =========================================================================
  {
    await fresh(page, base);
    await score(page, 1, 'Developing');
    await typeIn(page, '#initials', 'E.F.');
    // WAS: the comment listeners were on 'change', so a comment typed and never
    // clicked out of was gone on reload — every word of it.
    await typeIn(page, '#strengthsComment', 'She sorted the leaves by edge shape.');
    const said = (await st(page)).say;
    check('typing a comment says it was saved, the way scoring does',
          /Saved on this laptop/.test(said), said);

    await page.reload({ waitUntil: 'load' });
    const s = await st(page);
    eq('the score is still there after a refresh', s.counts, { e: 0, d: 1, m: 0 });
    eq('the initials are still there', s.initials, 'E.F.');
    eq('the comment is still there without ever leaving the box',
       s.strengths, 'She sorted the leaves by edge shape.');
  }

  {
    // WAS: an emptied date came back as today, because loading did
    // `savedDate || today()`.
    await fresh(page, base);
    await typeIn(page, '#initials', 'G.H.');
    await page.$eval('#adate', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.reload({ waitUntil: 'load' });
    const s = await st(page);
    eq('a date box left empty on purpose comes back empty', s.date, '');
  }

  {
    // The tool used to write six separate keys, which is how one child's scores
    // ended up filed next to the previous child's comment when a disk filled up
    // part way through. It writes one record now — and an assessment saved by
    // the older version has to survive the change, not disappear on the first
    // opening of the new one.
    await fresh(page, base);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('scienceScores', JSON.stringify({
        'Demonstrates curiosity and engagement': 'Mastered' }));
      localStorage.setItem('scienceStrengths', 'Saved before the tool was rebuilt.');
      localStorage.setItem('scienceInitials', 'W.X.');
      localStorage.setItem('scienceDate', '2026-02-02');
    });
    await page.reload({ waitUntil: 'load' });
    const s = await st(page);
    eq('an assessment saved by the older version is still here', s.counts.m, 1);
    eq('with its initials', s.initials, 'W.X.');
    eq('its date', s.date, '2026-02-02');
    eq('and its comment', s.strengths, 'Saved before the tool was rebuilt.');
    const leftovers = await page.evaluate(() =>
      ['scienceScores', 'scienceStrengths', 'scienceInitials', 'scienceDate']
        .filter(k => localStorage.getItem(k) !== null));
    eq('and the old half-a-dozen keys are tidied away after the move', leftovers, []);
  }

  // =========================================================================
  group('When the browser refuses to save  (Safari private, or a full disk)');
  // =========================================================================
  {
    await fresh(page, base);
    await page.evaluate(() => { window.__blockStorage = true; });
    await score(page, 0, 'Mastered');
    let s = await st(page);
    check('a browser that will not save says so, in words, and stays saying it',
          /NOTHING IS BEING SAVED/.test(s.storage), s.storage);
    check('and does not also claim it saved', !/Saved on this laptop/.test(s.say), s.say);

    // WAS: once the red warning was up it never came down, so a teacher who
    // fixed the problem saw the warning and the green "Saved" line at once.
    await page.evaluate(() => { window.__blockStorage = false; });
    await score(page, 1, 'Developing');
    s = await st(page);
    eq('and the warning comes down once saving works again', s.storage, '');
    check('and says so', /working again/i.test(s.say), s.say);
  }

  // =========================================================================
  group('A saved record that is not a science assessment');
  // =========================================================================
  {
    // WAS: a valid-JSON record of the wrong shape went straight into `scores`,
    // and after that every score button was a silent no-op while the tool
    // answered "Saved on this laptop".
    await fresh(page, base);
    await page.evaluate(() => localStorage.setItem(K_RECORD,
      JSON.stringify({ v: 1, scores: 'not an object', initials: 'J.K.' })));
    await page.reload({ waitUntil: 'load' });
    await score(page, 0, 'Mastered');
    const s = await st(page);
    eq('a nonsense saved record does not leave the score buttons dead', s.counts.m, 1);
    check('and the record is a real one again afterwards',
          (await stored(page)).scores['Demonstrates curiosity and engagement'] === 'Mastered');
    check('and the teacher is told part of the record could not be read',
          /could not be read/.test(s.notice), s.notice);
  }

  {
    // WAS: an array-shaped record accepted scores on screen but stringify drops
    // named properties, so storage kept "[]" and the sitting was gone on reload.
    await fresh(page, base);
    await page.evaluate(() => localStorage.setItem(K_RECORD,
      JSON.stringify({ v: 1, scores: [] })));
    await page.reload({ waitUntil: 'load' });
    await score(page, 3, 'Emerging');
    await page.reload({ waitUntil: 'load' });
    const s = await st(page);
    eq('a score put on top of a broken record survives the next refresh', s.counts.e, 1);
  }

  {
    // WAS: tally() counted every value in the saved object, so a score for a
    // skill no row on screen shows was added to the tallies, the legend, the
    // CSV totals and the PDF summary.
    await fresh(page, base);
    await page.evaluate(() => localStorage.setItem(K_RECORD, JSON.stringify({
      v: 1,
      scores: { 'A skill this tool has never had': 'Mastered',
                'Demonstrates curiosity and engagement': 'Brilliant' }
    })));
    await page.reload({ waitUntil: 'load' });
    const s = await st(page);
    eq('a score for a skill that is not on the list is not counted', s.counts, { e: 0, d: 0, m: 0 });
    await page.click('button[onclick="exportCsv()"]');
    const csv = await lastDownload(page);
    check('and it is not written into the spreadsheet either',
          !/never had|Brilliant/.test(csv.text));
  }

  // =========================================================================
  group('Clear, and the way back');
  // =========================================================================
  {
    await fresh(page, base);
    await typeIn(page, '#initials', 'L.M.');
    await typeIn(page, '#strengthsComment', 'Careful observer.');
    await score(page, 0, 'Mastered');

    await setConfirm(page, false);
    await page.click('button[onclick="clearForm()"]');
    let s = await st(page);
    check('Clear asks before it wipes anything', s.confirms.length === 1, JSON.stringify(s.confirms));
    check('the question says what goes and how to get it back',
          /six scores/.test(s.confirms[0]) && /Undo/.test(s.confirms[0]), s.confirms[0]);
    eq('saying no keeps the work', s.scored, 1);

    await setConfirm(page, true);
    await page.click('button[onclick="clearForm()"]');
    s = await st(page);
    eq('saying yes empties the form', s.scored, 0);
    check('and offers a way back', s.undo === true && /puts it all back/.test(s.undoText), s.undoText);

    // WAS: the Undo copy lived only in a variable, so a refresh between the
    // Clear and the Undo lost the assessment for good.
    await page.reload({ waitUntil: 'load' });
    s = await st(page);
    check('the Undo is still offered after a refresh', s.undo === true);
    await page.click('#undoClear');
    s = await st(page);
    eq('and it brings the whole assessment back', s.scored, 1);
    eq('including the initials', s.initials, 'L.M.');
    eq('including the comment', s.strengths, 'Careful observer.');
  }

  {
    // WAS: the Undo offer never expired and never asked. Clear child A, assess
    // child B in full, click Undo out of curiosity — child B was gone from the
    // screen AND from storage, with nothing left to press.
    await fresh(page, base);
    await typeIn(page, '#initials', 'A.A.');
    await score(page, 0, 'Mastered');
    await setConfirm(page, true);
    await page.click('button[onclick="clearForm()"]');

    await typeIn(page, '#initials', 'B.B.');
    await typeIn(page, '#strengthsComment', 'Built a tall ramp on his own.');
    for (let i = 0; i < 6; i++) await score(page, i, 'Developing');

    await setConfirm(page, false);
    await page.click('#undoClear');
    let s = await st(page);
    check('Undo asks first when there is a child on screen now',
          s.confirms.length === 1, JSON.stringify(s.confirms));
    eq('and saying no leaves that child alone', s.initials, 'B.B.');
    eq('with all six scores', s.scored, 6);

    await setConfirm(page, true);
    await page.click('#undoClear');
    s = await st(page);
    eq('saying yes brings the earlier child back', s.initials, 'A.A.');
    check('and the child who was on screen is now the one Undo offers',
          s.undo === true && /put back what was on screen/i.test(s.undoText), s.undoText);
    await page.click('#undoClear');
    s = await st(page);
    eq('so one more Undo returns to the child being assessed now', s.initials, 'B.B.');
    eq('with the comment intact', s.strengths, 'Built a tall ramp on his own.');
  }

  {
    // WAS: the single Undo slot was silently overwritten by the next
    // destructive action, so Undo handed back Maya instead of the real child.
    await fresh(page, base);
    await typeIn(page, '#initials', 'R.K.');
    await typeIn(page, '#strengthsComment', 'R.K. real notes');
    await score(page, 0, 'Mastered');

    await setConfirm(page, true);
    await page.click('button[onclick="fillSample()"]');
    let s = await st(page);
    check('loading the sample over real work asks first', s.confirms.length === 1);
    check('and offers to put the real child back', s.undo === true);

    await setConfirm(page, true);
    await page.click('button[onclick="clearForm()"]');   // clears the untouched sample
    await page.click('#undoClear');
    s = await st(page);
    eq('clearing the sample afterwards does not cost the real child their Undo',
       s.initials, 'R.K.');
    eq('and the real comment comes back with them', s.strengths, 'R.K. real notes');
  }

  {
    // WAS: neither isEmptyForm() nor the sample buttons looked at the date, so a
    // date the teacher had chosen was wiped back to today with no confirm and
    // nothing to press — and Clear refused to run at all on a changed date.
    await fresh(page, base);
    await page.$eval('#adate', el => { el.value = '2026-03-09'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await setConfirm(page, false);
    await page.click('button[onclick="fillSample()"]');
    let s = await st(page);
    check('the sample button asks before it overwrites a date you chose',
          s.confirms.length === 1, JSON.stringify(s.confirms));
    eq('and saying no keeps that date', s.date, '2026-03-09');

    await setConfirm(page, false);
    await page.click('button[onclick="clearForm()"]');
    s = await st(page);
    check('Clear does not refuse to run when the date is the only change',
          s.confirms.length === 1 && /Clear everything/.test(s.confirms[0] || ''),
          JSON.stringify(s.confirms));
  }

  {
    // WAS: an unreadable Undo snapshot was swallowed in silence and its key
    // deleted, so a teacher who came back for the promised Undo found no button
    // and no explanation.
    await fresh(page, base);
    await page.evaluate(() => localStorage.setItem(K_UNDO, '{ this is not json'));
    await page.reload({ waitUntil: 'load' });
    const s = await st(page);
    check('a broken Undo says it is gone instead of vanishing',
          /Undo saved here from an earlier session/.test(s.notice), s.notice);
    check('and no Undo button is left pretending otherwise', s.undo === false);
  }

  {
    // WAS: an Undo snapshot whose scores body was the wrong shape was restored
    // with no checking, manufacturing phantom scores the tallies, the legend,
    // the CSV totals and the PDF summary all counted.
    await fresh(page, base);
    await page.evaluate(() => localStorage.setItem(K_UNDO, JSON.stringify({
      scores: ['Mastered', 'Mastered', 'Mastered'],
      strengths: '', stretches: '', initials: 'Z.Z.', date: '2026-01-01',
      msg: 'Cleared. If you did not mean to, this puts it all back.'
    })));
    await page.reload({ waitUntil: 'load' });
    await page.click('#undoClear');
    const s = await st(page);
    eq('a damaged Undo does not invent scores nobody gave', s.counts, { e: 0, d: 0, m: 0 });
    eq('but everything readable in it still comes back', s.initials, 'Z.Z.');
  }

  {
    // WAS: Clear deleted the record even when the backup write had been refused,
    // so the confirm's promise was already broken as it was made.
    await fresh(page, base);
    await typeIn(page, '#initials', 'N.O.');
    await score(page, 0, 'Mastered');
    await page.evaluate(() => { window.__blockStorage = true; });
    await setConfirm(page, true);
    await page.click('button[onclick="clearForm()"]');
    const s = await st(page);
    check('if the backup copy could not be saved, Clear says so',
          /would not save the backup copy/.test(s.say), s.say);
    await page.evaluate(() => { window.__blockStorage = false; });
  }

  // =========================================================================
  group('Two tabs of the same tool');
  // =========================================================================
  {
    // WAS: two tabs shared one localStorage with no owner check at all, so a
    // tab left open from an earlier child re-saved that child on the next
    // keystroke and destroyed the assessment done since — in both tabs.
    await fresh(page, base);
    await typeIn(page, '#initials', 'A.A.');
    await typeIn(page, '#strengthsComment', 'Child A sorted the leaves.');
    await score(page, 0, 'Mastered');

    const tab2 = await makePage(browser, null);
    await tab2.goto(base + '/index.html', { waitUntil: 'load' });
    const seen = await tab2.evaluate(() => document.getElementById('initials').value);
    eq('a second tab opens on the child the first tab was assessing', seen, 'A.A.');

    await setConfirm(tab2, true);
    await tab2.click('button[onclick="clearForm()"]');
    await replaceIn(tab2, '#initials', 'B.B.');
    await typeIn(tab2, '#strengthsComment', 'Child B built a tall ramp.');
    await score(tab2, 2, 'Emerging');

    await page.bringToFront();
    await typeIn(page, '#strengthsComment', ' Also counted the seeds.');
    const rec = await stored(page);
    eq('one keystroke in the older tab cannot write its child back over the new one',
       rec.initials, 'B.B.');
    check('and the older tab says out loud that it has stopped saving',
          /stopped saving/.test((await st(page)).notice), (await st(page)).notice);
    await tab2.close();
  }

  // =========================================================================
  group('The spreadsheet');
  // =========================================================================
  {
    await fresh(page, base);
    await typeIn(page, '#initials', 'P.Q.');
    await score(page, 0, 'Mastered');
    await score(page, 1, 'Emerging');
    // A comment with the three things that break a CSV in it.
    await page.click('#strengthsComment');
    await page.type('#strengthsComment', 'He said "wow", loudly.', { delay: 0 });
    await page.keyboard.press('Enter');
    await page.type('#strengthsComment', 'Then he counted them all.', { delay: 0 });
    await typeIn(page, '#stretchesComment', 'Needs a second try, every time.');

    await page.click('button[onclick="exportCsv()"]');
    const csv = await lastDownload(page);
    check('the comment typed a second ago is in the spreadsheet',
          /Then he counted them all/.test(csv.text));
    check('quotes, commas and line breaks in a comment survive it',
          csv.text.includes('"He said ""wow"", loudly.\nThen he counted them all."'),
          csv.text.slice(0, 400));
    check('the other comment box is in there too',
          /Needs a second try, every time/.test(csv.text));
    {
      const head = csv.text.replace(/^﻿/, '').split('\r\n')[0];
      eq('every field on screen has a column',
         head, 'Child,Date,Sample,Skill,Level,Emerging total,Developing total,Mastered total,Strengths,Stretches');
      const rows = csv.text.trim().split('\r\n').length;
      check('and there is a row for every skill, scored or not', rows >= 7, String(rows));
    }
    check('an unscored skill is written the same way everywhere',
          /Not scored/.test(csv.text) && !/Not Scored/.test(csv.text));
  }

  // =========================================================================
  group('The PDF');
  // =========================================================================
  {
    await fresh(page, base);
    await typeIn(page, '#initials', 'L.K.');
    await score(page, 0, 'Mastered');
    // WAS: jsPDF's built-in font only knows the first 256 characters and does
    // not say so — one accented name turned that whole line into spaced-out
    // gibberish and ran the rest of the sentence off the edge of the paper.
    await typeIn(page, '#strengthsComment',
      'Łukasz noticed the taller ramp sent the car further — he tried it eleven times.');
    await page.click('button[onclick="exportPDF()"]');
    const pdf = await page.evaluate(() => window.__pdf);
    const body = pdf.lines.join(' ');
    check('an accented name reaches the PDF as a word, not as gibberish',
          /Lukasz noticed the taller ramp sent the car further - he tried it eleven times\./.test(body),
          body.slice(0, 300));
    check('the child and the date are on the report',
          /Child: L\.K\./.test(body) && /Date: /.test(body));
    check('an unscored skill is spelled the same way as in the spreadsheet',
          /Not scored/.test(body) && !/Not Scored/.test(body));
  }

  {
    // WAS: with jsPDF blocked the button threw into a console nobody was
    // looking at and simply did nothing, forever.
    CDN_MODE = 'block';
    await fresh(page, base);
    await score(page, 0, 'Mastered');
    await page.click('button[onclick="exportPDF()"]');
    let s = await st(page);
    check('a blocked PDF library is explained, not silent',
          /did not load/.test(s.notice) && /firewall/.test(s.notice), s.notice);
    check('and the message says what still works',
          /Export CSV and Print/.test(s.notice), s.notice);

    // WAS: that message went into the shared line, so the next ordinary save
    // painted over it and nothing recorded that the export never happened.
    await score(page, 1, 'Developing');
    await new Promise(r => setTimeout(r, 2200));
    s = await st(page);
    check('and it is still on screen after the next save wrote over the green line',
          /did not load/.test(s.notice), s.notice);
    CDN_MODE = 'stub';
  }

  {
    // WAS: a browser that refuses the download left no trace at all.
    await fresh(page, base);
    await score(page, 0, 'Mastered');
    await page.evaluate(() => { window.__pdfSaveThrows = true; });
    await page.click('button[onclick="exportPDF()"]');
    const s = await st(page);
    check('a PDF the browser will not save points at Print instead',
          /Print instead/.test(s.notice), s.notice);
  }

  {
    // WAS: the whole page was gated behind this one <script> in <head>, so a
    // school filter that drops packets rather than refusing them left a blank
    // white page for the entire network timeout — no header, no skills, no
    // message, nothing to click.
    CDN_MODE = 'hang';
    // Empty the saved record first, or this page opens on the child the last
    // check left behind and the click below toggles an existing score off.
    await page.evaluate(() => localStorage.clear());
    const slow = await makePage(browser, null);
    await slow.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 4000 })
              .catch(() => {});
    const alive = await slow.evaluate(() => ({
      body: !!document.body,
      skills: document.querySelectorAll('.skill').length,
      heading: (document.querySelector('h1') || {}).textContent || ''
    }));
    check('the page is on screen while the PDF library is still in flight',
          alive.body && alive.skills === 6 && /Science/.test(alive.heading),
          JSON.stringify(alive));
    await slow.click('.btn-score[data-skill="4"][data-level="Developing"]');
    await new Promise(r => setTimeout(r, 400));
    const scoredAnyway = await slow.evaluate(() => Object.keys(scores).length);
    eq('and it can be scored while the library is still in flight', scoredAnyway, 1);
    await slow.close();
    CDN_MODE = 'stub';
  }

  // =========================================================================
  group('What comes out of the printer');
  // =========================================================================
  {
    await fresh(page, base);
    await typeIn(page, '#initials', 'S.T.');
    await score(page, 0, 'Mastered');
    // A real report paragraph. WAS: a textarea prints only the four lines
    // inside its own scroll box, and paper has no scrollbar, so everything past
    // about 380 characters was simply not on the sheet — with nothing on the
    // page saying so.
    const LONG = 'Sam comes to the science table first every morning and asks about ' +
      'everything on it. He described the wet sponge as heavier and darker without ' +
      'being prompted, and he went back to the tray three times to check that the ' +
      'dry one really was lighter. When the ramp fell over he set it up again rather ' +
      'than starting something new, which is new this term. He counts out loud while ' +
      'he works and he tells the other children what he has noticed, so the whole ' +
      'table ends up looking at the same thing. He still needs a hand writing any of ' +
      'it down, but he will say all of it if you ask him at the end of the session.';
    await typeIn(page, '#strengthsComment', LONG);

    await page.emulateMediaType('print');
    // The score buttons carry a 0.2s transition, so a measurement taken the
    // instant the media type flips catches the colours half way there.
    await new Promise(r => setTimeout(r, 400));
    const paper = await page.evaluate(() => {
      const cs = el => getComputedStyle(el);
      const printed = document.getElementById('strengthsPrint');
      const scoredBtn = document.querySelector('.btn-score.m');
      const plainBtn = document.querySelector('.btn-score[data-skill="0"][data-level="Emerging"]');
      return {
        bodyBg: cs(document.body).backgroundColor,
        buttonsHidden: cs(document.querySelector('.actions')).display,
        textareaHidden: cs(document.getElementById('strengthsComment')).display,
        copyShown: cs(printed).display,
        copyText: printed.textContent,
        copyFits: printed.scrollHeight <= printed.clientHeight + 2,
        scoredColor: cs(scoredBtn).color,
        scoredBorder: cs(scoredBtn).borderTopWidth,
        plainColor: cs(plainBtn).color,
        initialsBox: cs(document.getElementById('initials')).display,
        initialsPrint: document.getElementById('initialsPrint').textContent,
        hint: cs(document.querySelector('.hint')).display,
        privacy: cs(document.querySelector('.privacy')).display
      };
    });
    eq('the whole comment is on the paper, not the first four lines of it',
       paper.copyText, LONG);
    check('and it is not cut off at the bottom of a box', paper.copyFits === true,
          JSON.stringify({ shown: paper.copyShown }));
    eq('the box itself does not print twice', paper.textareaHidden, 'none');
    // WAS: the scored E/D/M letter printed white-on-white at 2.2:1 with Chrome's
    // default settings — the one mark carrying the result was the faintest thing
    // on the page, while the two levels the child did NOT get printed at 10:1.
    eq('the level the child actually got prints as black ink', paper.scoredColor, 'rgb(0, 0, 0)');
    check('with a heavy box around it so it reads at a glance',
          parseFloat(paper.scoredBorder) >= 3, paper.scoredBorder);
    check('and the levels they did not get are the quieter ones',
          paper.plainColor !== 'rgb(0, 0, 0)', paper.plainColor);
    eq('the tan page background does not go to the printer', paper.bodyBg, 'rgb(255, 255, 255)');
    eq('the button row is not on the paper', paper.buttonsHidden, 'none');
    eq('nor is the on-screen hint', paper.hint, 'none');
    eq('nor the on-screen privacy badge', paper.privacy, 'none');
    eq('the date picker does not print its calendar glyph', paper.initialsBox, 'none');
    eq('and the initials are on the sheet as plain text', paper.initialsPrint, 'S.T.');
    await page.emulateMediaType(null);
  }

  // =========================================================================
  group('The keyboard, and what gets announced');
  // =========================================================================
  {
    await fresh(page, base);
    await score(page, 0, 'Emerging');
    await page.focus('#tile-e');
    await page.keyboard.press('Enter');
    let where = await page.evaluate(() => ({
      open: document.getElementById('skillsModal').classList.contains('show'),
      inside: !!document.activeElement.closest('#skillsModal')
    }));
    check('opening the pop-up with the keyboard puts the keyboard inside it',
          where.open && where.inside, JSON.stringify(where));

    // WAS: Tab walked straight out onto the buttons hidden behind the dim
    // overlay — including Clear, which a keyboard could then press on a page it
    // could not see.
    for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
    where = await page.evaluate(() => ({
      open: document.getElementById('skillsModal').classList.contains('show'),
      inside: !!document.activeElement.closest('#skillsModal'),
      on: document.activeElement.textContent.trim().slice(0, 20)
    }));
    check('Tab cannot walk out of the pop-up onto the buttons behind it',
          where.inside === true, JSON.stringify(where));

    // WAS: the pop-up was a snapshot that never refreshed, so it sat there
    // listing skills while the tallies behind it said something else.
    await page.evaluate(() => setScore(SCIENCE_SKILLS[1], 'Emerging'));
    const listed = await page.$$eval('#modalSkillsList .skill-item-name', els => els.length);
    eq('the open pop-up follows the scores instead of going stale', listed, 2);

    // WAS: closing left the keyboard parked on the × inside a display:none
    // dialog, and the next Tab jumped past the whole skills list.
    await page.keyboard.press('Escape');
    const back = await page.evaluate(() => ({
      open: document.getElementById('skillsModal').classList.contains('show'),
      on: document.activeElement.id
    }));
    check('closing the pop-up puts the keyboard back on the tile that opened it',
          back.open === false && back.on === 'tile-e', JSON.stringify(back));
  }

  {
    // WAS: none of the three message lines was a live region and nothing ever
    // moved focus to them, so a screen-reader user was told about the storage
    // warning and the Undo offer never.
    const roles = await page.evaluate(() => ({
      saved: document.getElementById('saveMsg').getAttribute('role'),
      storage: document.getElementById('storageMsg').getAttribute('role'),
      notice: document.getElementById('noticeMsg').getAttribute('role'),
      undo: document.getElementById('undoBar').getAttribute('role')
    }));
    eq('what the tool says is announced, not just painted',
       roles, { saved: 'status', storage: 'alert', notice: 'alert', undo: 'alert' });
  }

  // =========================================================================
  group('Where the teacher is actually looking');
  // =========================================================================
  {
    // WAS: the five buttons sit at the bottom of a page taller than the window,
    // and every message they produced — the Undo the confirm had just promised,
    // the "not a real child" banner — was painted at the very top with zero
    // pixels of it inside the viewport.
    await page.setViewport({ width: 1280, height: 800 });
    await fresh(page, base);
    await typeIn(page, '#initials', 'U.V.');
    await typeIn(page, '#strengthsComment', 'A whole sitting of work.');
    for (let i = 0; i < 6; i++) await score(page, i, 'Developing');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await setConfirm(page, true);
    await page.click('button[onclick="clearForm()"]');
    const seen = await page.evaluate(() => {
      const r = document.getElementById('undoBar').getBoundingClientRect();
      const m = document.getElementById('saveMsg').getBoundingClientRect();
      return { undoTop: Math.round(r.top), undoBottom: Math.round(r.bottom),
               msgTop: Math.round(m.top), h: window.innerHeight };
    });
    check('the Undo the confirm promised is on the screen, not above it',
          seen.undoTop >= 0 && seen.undoBottom <= seen.h, JSON.stringify(seen));
    check('and so is the line saying what just happened',
          seen.msgTop >= 0 && seen.msgTop <= seen.h, JSON.stringify(seen));

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.click('button[onclick="fillSample()"]');
    const maya = await page.evaluate(() => {
      const r = document.getElementById('sampleBanner').getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: window.innerHeight };
    });
    check('"this is not a real child" is on the screen the moment she loads',
          maya.top >= 0 && maya.bottom <= maya.h, JSON.stringify(maya));
    await page.setViewport({ width: 1280, height: 900 });
  }

  // =========================================================================
  group('Everything a person has to read, and everything they have to hit');
  // =========================================================================
  {
    // A SWEEP, not a list of named controls. A contrast check written against
    // three headings only ever re-finds those three headings.
    await fresh(page, base);
    await page.click('button[onclick="fillSample()"]');
    const bad = await page.evaluate(() => {
      const toRGB = s => {
        const m = String(s).match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
      };
      const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const L = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
      const effBg = el => {
        const chain = [];
        let e = el;
        while (e){
          const c = toRGB(getComputedStyle(e).backgroundColor);
          if (c && c.a > 0) chain.push(c);
          e = e.parentElement;
        }
        let out = { r: 255, g: 255, b: 255 };
        for (let i = chain.length - 1; i >= 0; i--){
          const c = chain[i];
          out = { r: c.r * c.a + out.r * (1 - c.a),
                  g: c.g * c.a + out.g * (1 - c.a),
                  b: c.b * c.a + out.b * (1 - c.a) };
        }
        return out;
      };
      const out = [];
      document.querySelectorAll('body *').forEach(el => {
        if (el instanceof SVGElement) return;
        if (el.offsetParent === null && el !== document.body) return;
        const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (!own) return;
        const cs = getComputedStyle(el);
        const fg = toRGB(cs.color);
        if (!fg || fg.a === 0) return;
        const size = parseFloat(cs.fontSize);
        const weight = parseInt(cs.fontWeight, 10) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const l1 = L(fg), l2 = L(effBg(el));
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < (large ? 3 : 4.5)){
          out.push({ text: el.textContent.trim().slice(0, 34), size,
                     ratio: +ratio.toFixed(2), color: cs.color });
        }
      });
      return out;
    });
    check('every word on the page clears the readability floor',
          bad.length === 0, JSON.stringify(bad.slice(0, 6)));
  }

  {
    // Also a sweep. WAS: the E/D/M buttons measured 29x27px with 6px between
    // them on an iPad — the control tapped six-plus times a sitting was the
    // smallest thing on the page.
    await page.setViewport({ width: 834, height: 1194 });
    await page.reload({ waitUntil: 'load' });
    const small = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('button, input, textarea, a').forEach(el => {
        if (el.offsetParent === null) return;
        const r = el.getBoundingClientRect();
        if (r.width < 44 || r.height < 44){
          out.push({ what: (el.id || el.className || el.tagName) + '',
                     w: Math.round(r.width), h: Math.round(r.height) });
        }
      });
      return out;
    });
    eq('every control on a tablet is big enough for a finger', small, []);
    await page.setViewport({ width: 1280, height: 900 });
  }

  {
    // The one rule that is never traded away: nothing here identifies a child,
    // and nothing here goes anywhere.
    const privacy = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('input, textarea')].map(el => ({
        id: el.id,
        type: el.type,
        max: el.maxLength,
        label: (document.querySelector('label[for="' + el.id + '"]') || {}).textContent || '',
        placeholder: el.placeholder || ''
      }));
      const html = document.documentElement.outerHTML;
      return {
        // A box that could hold a child's name: free text, no four-character
        // cap, and something in its label or placeholder asking for a name.
        nameBoxes: boxes.filter(b => (b.type === 'text' || b.type === 'textarea') &&
                                     b.max !== 4 &&
                                     /name/i.test(b.label + ' ' + b.placeholder))
                        .map(b => b.id),
        initialsCap: (boxes.find(b => b.id === 'initials') || {}).max,
        // the deferred jsPDF tag is the only outside address in the file
        urls: (html.match(/https?:\/\/[^"' ]+/g) || [])
                .filter(u => !/w3\.org|schema\.org/.test(u))
      };
    });
    eq('there is no box anywhere that asks for a child\'s name', privacy.nameBoxes, []);
    eq('the only box that identifies a child stops at four characters',
       privacy.initialsCap, 4);
    eq('the only outside address in the file is the PDF library',
       privacy.urls.map(u => /cdnjs/.test(u)), [true]);
  }

  // =========================================================================
  group('The same assessment open in two tabs');
  // =========================================================================
  // WAS: two tabs shared one localStorage with no owner check at all, so a tab
  // left open from an earlier child re-saved that child on the next keystroke
  // and destroyed everything done since — in both tabs, while saying "Saved on
  // this laptop". The losing tab stops writing now.
  //
  // AND THIS IS THE PART NOBODY CHECKED THE FIRST TIME: the only thing that
  // said so was the notice line, and that line carries an OK button. A teacher
  // who read it, clicked OK and carried on typing had no signal of any kind
  // afterwards — the explanation was gone, the green line stayed blank, and the
  // red one was never raised. She could write a full paragraph into a tab that
  // was keeping none of it. Every check below the OK click is there for that.
  //
  // Chrome does not run rAF in a background tab, and puppeteer's click waits on
  // it, so each tab is brought to the front before it is driven.
  {
    const errsBefore = collect.pageErrors.length;

    await fresh(page, base);
    await page.bringToFront();
    await score(page, 0, 'Mastered');

    const other = await makePage(browser, collect);
    await other.goto(base + '/index.html', { waitUntil: 'load' });
    await other.bringToFront();
    await score(other, 1, 'Developing');        // the second tab saves

    await page.bringToFront();
    await page.evaluate(() => new Promise(r => setTimeout(r, 150)));

    const took = await st(page);
    check('the tab that did not save last is told the other one has taken over',
          /another tab/i.test(took.notice), JSON.stringify(took.notice));
    check('and the red "nothing is being saved" line goes up beside it',
          /NOTHING IS BEING SAVED/.test(took.storage) && /another tab/i.test(took.storage),
          JSON.stringify(took.storage));
    check('the red line gives the real reason, not the disk-is-full one',
          took.storage !== '' && !/disk is full|private window/i.test(took.storage),
          JSON.stringify(took.storage));
    eq('and the green line stops claiming a save that is no longer happening',
       took.say, '');

    // The OK button dismisses the explanation. It must not dismiss the fact.
    await page.click('#noticeMsg button');
    const afterOk = await st(page);
    eq('clicking OK puts the explanation away', afterOk.notice, '');
    check('but the red line stays up, because the tab is still not saving',
          /NOTHING IS BEING SAVED/.test(afterOk.storage), JSON.stringify(afterOk.storage));

    // A teacher who dismissed it and simply kept working.
    //
    // THE CHECK BELOW USED TO ASK THE NARROW QUESTION. It read the record key
    // and nothing else, so it went green for months while this same tab was
    // still writing the OTHER shared key — the Undo copy — over the top of the
    // healthy tab's. "Did this tab write the record?" is not the question. "Did
    // this tab write anything at all?" is, so the whole of storage is compared
    // before and after, and Clear — the button that writes the Undo copy — is
    // pressed here too.
    const storageBefore = await dumpStorage(page);
    await typeIn(page, '#strengthsComment',
                 'She sorted the rocks by weight without being asked to.');
    await score(page, 2, 'Emerging');
    const afterWork = await st(page);
    check('a whole paragraph and a score button later, the red line is still there',
          /NOTHING IS BEING SAVED/.test(afterWork.storage), JSON.stringify(afterWork.storage));
    check('and the overtaken tab never says "Saved on this laptop" again',
          !/Saved/.test(afterWork.say), JSON.stringify(afterWork.say));

    await setConfirm(page, true);
    await page.click('button[onclick="clearForm()"]');
    eq('nothing the overtaken tab did wrote a single byte of shared storage',
       await dumpStorage(page), storageBefore);

    const kept = await stored(page);
    eq('not a word of that paragraph reached the saved record', kept.strengths, '');
    eq('which still holds only what the tab that won put there',
       Object.keys(kept.scores).length, 2);

    // Reloading is the way out, and the tool tells her to close the tab — but a
    // reload must genuinely free it, not leave a tab that can never save again.
    await page.reload({ waitUntil: 'load' });
    const freed = await st(page);
    eq('reloading the tab takes the red line down again', freed.storage, '');
    await score(page, 3, 'Mastered');
    eq('and that tab is saving again', Object.keys((await stored(page)).scores).length, 3);

    check('driving two tabs raised no JavaScript error in either',
          collect.pageErrors.length === errsBefore,
          collect.pageErrors.slice(errsBefore).join(' | '));

    await other.close();
    await page.bringToFront();
  }

  // =========================================================================
  group('The Undo, when the same assessment is open in two tabs');
  // =========================================================================
  // WAS: saveAll() refused to write once another tab had taken over, but the
  // Undo copy was written straight to localStorage from two OTHER places —
  // Clear's snapshot and Undo's counter-snapshot — with no owner check at all.
  // So the tab whose own red line said NOTHING IS BEING SAVED went on
  // overwriting the one shared Undo key. Tab B cleared its child and was
  // promised an Undo; the overtaken tab A then pressed Clear; tab B reloaded,
  // pressed the Undo it had been promised, and got a DIFFERENT CHILD back —
  // A's scores under A's initials, with no warning — while B's own cleared
  // assessment was gone for good.
  //
  // `page` is the tab that gets overtaken. tabB is the one that keeps saving.
  {
    const errsBefore = collect.pageErrors.length;

    await fresh(page, base);
    await page.bringToFront();
    await typeIn(page, '#initials', 'A.A.');
    await typeIn(page, '#strengthsComment', 'Tab A child sorted the leaves.');
    await score(page, 0, 'Mastered');

    const tabB = await makePage(browser, collect);
    await tabB.goto(base + '/index.html', { waitUntil: 'load' });
    await tabB.bringToFront();
    await setConfirm(tabB, true);
    await tabB.click('button[onclick="clearForm()"]');       // start a real child
    await replaceIn(tabB, '#initials', 'B.B.');
    await typeIn(tabB, '#strengthsComment', 'Tab B child built a tall ramp.');
    await score(tabB, 1, 'Developing');
    await tabB.click('button[onclick="clearForm()"]');       // and is promised an Undo
    const promised = await storedUndo(tabB);
    check('the tab that is saving gets its Undo written down where a reload can find it',
          /B\.B\./.test(promised || '') && /tall ramp/.test(promised || ''),
          String(promised).slice(0, 120));

    // Tab A has been overtaken by now. Everything it does from here must leave
    // that saved Undo exactly as it is.
    await page.bringToFront();
    await page.evaluate(() => new Promise(r => setTimeout(r, 150)));
    await setConfirm(page, true);
    await page.click('button[onclick="clearForm()"]');
    eq('Clear in the overtaken tab cannot overwrite the Undo the other tab was promised',
       await storedUndo(page), promised);

    const cleared = await st(page);
    check('and that tab says the backup was not kept, and blames the right thing',
          /another tab/i.test(cleared.say) && !/browser would not save/i.test(cleared.say),
          JSON.stringify(cleared.say));
    check('while still offering the Undo it can honour, on screen, in this tab',
          cleared.undo === true);

    // Its own Undo still puts its own screen back — that is what it was
    // promised, and it is all the overtaken tab is allowed to promise.
    await typeIn(page, '#strengthsComment', 'Typed again after the clear.');
    await setConfirm(page, true);
    await page.click('#undoClear');
    const back = await st(page);
    eq('the overtaken tab can still put its own screen back', back.initials, 'A.A.');
    eq('with its own words on it', back.strengths, 'Tab A child sorted the leaves.');
    eq('and taking that counter-snapshot did not touch the other tab\'s Undo either',
       await storedUndo(page), promised);

    // "Try it with a sample student" writes a snapshot by the same route.
    await setConfirm(page, true);
    await page.click('button[onclick="fillSample()"]');
    eq('nor does the sample button in the overtaken tab',
       await storedUndo(page), promised);

    // And the branch that DELETES the key: Undo with nothing precious on screen.
    await setConfirm(page, true);
    await page.click('#undoClear');
    eq('and an overtaken tab cannot delete the other tab\'s Undo either',
       await storedUndo(page), promised);

    // The whole point: what tab B is handed when it presses the button it was
    // promised is tab B's own child.
    await tabB.bringToFront();
    await tabB.reload({ waitUntil: 'load' });
    const offered = await st(tabB);
    check('the healthy tab still finds its Undo after a reload', offered.undo === true);
    // Clicking a hidden button throws, and a crashed run says far less than a
    // red line does. If the offer is gone, let the checks below report what is
    // on screen instead.
    if (offered.undo){
      await setConfirm(tabB, true);
      await tabB.click('#undoClear');
    }
    const restored = await st(tabB);
    eq('and what comes back is its own child, not the other tab\'s',
       restored.initials, 'B.B.');
    eq('with its own words, not the other tab\'s',
       restored.strengths, 'Tab B child built a tall ramp.');
    eq('and its own score, not the other tab\'s', restored.scored, 1);
    eq('the sixth skill the other tab had scored is not in this record',
       restored.scores['Demonstrates curiosity and engagement'], undefined);

    check('driving the Undo across two tabs raised no JavaScript error in either',
          collect.pageErrors.length === errsBefore,
          collect.pageErrors.slice(errsBefore).join(' | '));

    await tabB.close();
    await page.bringToFront();
  }

  await browser.close();
  srv.close();

  // -------------------------------------------------------------------------
  // How many checks were SUPPOSED to run. Several checks sit inside blocks that
  // could stop being reached; when that happens they do not fail, they silently
  // do not happen, and the run still ends green. So the count itself is a check.
  // -------------------------------------------------------------------------
  const EXPECTED_CHECKS = Number(process.env.EXPECTED_CHECKS || 0);
  const ran = passed + failures.length;
  if (EXPECTED_CHECKS && ran !== EXPECTED_CHECKS){
    failures.push({
      name: `the suite ran ${ran} checks, but ${EXPECTED_CHECKS} were expected`,
      detail: ran < EXPECTED_CHECKS
        ? 'Checks vanished rather than failed — find out why.'
        : 'Checks were added. If that was deliberate, update EXPECTED_CHECKS.'
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
