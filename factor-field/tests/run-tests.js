#!/usr/bin/env node
//
// Factor Field — regression tests.
//
// WHAT THIS IS
// ------------
// "Regression" means sliding backward. Every check in this file exists because
// something was once actually broken in Factor Field. The point is not to prove
// the tool works today — it is so that a bug fixed in August cannot quietly come
// back in November without anybody noticing.
//
// Each check is named for what a PERSON would notice, not for the function
// involved. If you fix a new bug, add its check here the same day, while you
// still remember what went wrong.
//
// HOW TO RUN IT
// -------------
//     cd ~/Documents/GitHub/edtech-portfolio/factor-field/tests
//     npm test
//
// It opens a real Google Chrome in the background, drives the tool with real
// clicks and real keypresses, and prints a line per check. It needs nothing on
// the internet — and one of the checks below proves that.
//
// puppeteer-core is borrowed from ../../running-record-tool/tests/node_modules
// via NODE_PATH (see package.json), so there is nothing to install.
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
const sleep = ms => new Promise(r => setTimeout(r, ms));

// `load`, not `domcontentloaded`: a stylesheet still in flight when the first
// assertion ran was landing in the console-error list a fraction of the time, so
// the same suite passed or failed depending on timing. A test that is right nine
// times out of ten is not a test — it teaches you to ignore red.
async function fresh(page, base, hash){
  await page.goto(base + '/index.html' + (hash || ''), { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

// Answer n Digit Drop questions correctly, through the tool's own public
// recording path rather than by writing to storage behind its back.
const playCorrect = (page, a, b, n) => page.evaluate((a, b, n) => {
  for (let i = 0; i < n; i++) recordAttempt(a, b, true, false);
  addStars(2 * n);
}, a, b, n);

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

  // Anything that would open a window or block on a dialog is stubbed, so the
  // handlers still run all the way through and can be inspected.
  const pageErrors = [], consoleErrors = [], offSiteRequests = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // Chrome's message for a failed request is the same generic sentence
    // whatever the file was — the URL lives in location(), not in the text.
    const url = (m.location() && m.location().url) || '';
    if (/favicon/i.test(url)) return;
    consoleErrors.push(m.text() + (url ? '  [' + url + ']' : ''));
  });
  page.on('request', r => {
    const u = r.url();
    if (!/^https?:/.test(u)) return;                  // data:, blob: are local
    if (u.startsWith(base)) return;                   // our own server
    offSiteRequests.push(u);
  });
  await page.evaluateOnNewDocument(() => {
    window.__printed = 0;
    window.__printTitles = [];
    window.__confirms = [];
    window.__confirmAnswer = true;
    window.__downloads = [];
    window.__grownupsOpen = [];
    window.__whoPrintAtPrint = [];
    // Record the tab title AT THE MOMENT of printing — that is the name the
    // browser suggests for the saved PDF — and whether the grown-ups summary
    // was open, because a closed <details> prints as nothing but its heading.
    // Also grab the "Child: … · Date: …" line in that same instant: reading it
    // any later (after a reload, say) reads a redrawn page and not the paper.
    window.print = () => {
      window.__printed++;
      window.__printTitles.push(document.title);
      const g = document.getElementById('grownups');
      window.__grownupsOpen.push(g ? g.open : null);
      const w = document.querySelector('.who-print');
      window.__whoPrintAtPrint.push(w ? w.textContent : null);
    };
    window.confirm = m => { window.__confirms.push(String(m)); return window.__confirmAnswer; };
    window.alert = m => { window.__alert = String(m); };
    // Catch the CSV instead of writing it to disk, and keep the Blob so the
    // test can read what was actually in the file.
    const origCOU = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => { window.__lastBlob = blob; return origCOU(blob); };
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[download]');
      if (a){ e.preventDefault(); window.__downloads.push(a.getAttribute('download')); }
    }, true);
  });

  // =========================================================================
  group('It opens, and it opens quietly');
  await fresh(page, base);
  check('the page draws something on arrival',
        (await page.evaluate(() => document.getElementById('app').innerHTML.length)) > 500);
  eq('no red errors in the console when it opens', consoleErrors, []);
  eq('nothing crashed when it opened', pageErrors, []);

  // =========================================================================
  group('Safari private windows and a full disk (nothing may be saved)');
  {
    // A separate tab where every single localStorage call throws — exactly what
    // Safari's private window and a full disk do. This used to take the whole
    // tool down: the very first read happened before any screen had drawn, so
    // the page came up blank white with only a console error nobody would see.
    const p2 = await browser.newPage();
    const p2Errors = [];
    p2.on('pageerror', e => p2Errors.push(e.message));
    await p2.evaluateOnNewDocument(() => {
      const boom = () => { throw new DOMException('QuotaExceededError'); };
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get(){ return { getItem: boom, setItem: boom, removeItem: boom, clear: boom }; }
      });
    });
    await p2.goto(base + '/index.html', { waitUntil: 'load' });
    await sleep(200);
    check('the tool still opens in a browser that refuses to save anything',
          (await p2.evaluate(() => document.getElementById('app').innerHTML.length)) > 500,
          'the page came up blank');
    eq('and nothing crashes when it does', p2Errors, []);
    const note = await p2.evaluate(() => {
      const el = document.getElementById('storageNote');
      return el ? el.textContent : '';
    });
    check('it says out loud that nothing is being saved',
          /won't let the page store anything/.test(note) && /private window/.test(note), note);
    check('you can still play in that browser', await p2.evaluate(() => {
      show('drop');
      document.querySelector('[data-card="4"]').click();
      return document.querySelectorAll('.digit-box').length > 0;
    }));
    await p2.close();
  }

  // =========================================================================
  group('Worksheet Maker: typing a title');
  await fresh(page, base);
  await page.evaluate(() => show('worksheet'));
  // Select the whole box the way a person would (click in, select all), then
  // type over it with real keystrokes.
  await page.click('#wsTitle');
  await page.evaluate(() => document.getElementById('wsTitle').select());
  await page.type('#wsTitle', 'Friday homework');
  await sleep(250);
  eq('the sheet heading shows the title as you type it, before you click away',
     await page.$eval('#wsHeadTitle', e => e.textContent), 'Friday homework');

  // The caret is still in the Title box. This single click used to be swallowed:
  // the old blur handler re-rendered the panel between mousedown and mouseup, so
  // the click landed on a button that no longer existed. No error, nothing
  // printed, and you had to click Print twice.
  await page.click('#wsPrint');
  await sleep(600);
  eq('the FIRST click on Print after typing a title actually prints',
     await page.evaluate(() => window.__printed), 1);

  await page.click('#wsTitle');
  await page.evaluate(() => document.getElementById('wsTitle').select());
  await page.type('#wsTitle', 'Monday sheet');
  await sleep(150);
  await page.evaluate(() => { navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  await page.click('#wsShare');
  await sleep(500);
  check('the FIRST click on Copy share link after typing a title works too',
        /copied/i.test(await page.$eval('#toast', e => e.textContent)),
        await page.$eval('#toast', e => e.textContent));
  {
    const copied = await page.evaluate(() => window.__copied);
    const payload = JSON.parse(Buffer.from(copied.split('#ws=')[1], 'base64').toString('utf8'));
    eq('the share link carries the title you typed', payload.title, 'Monday sheet');
    // The link used to be written into THIS tab's address bar too, where it sat
    // for ever: every later reload dumped you back on this old sheet.
    eq('copying the link does not chain this tab to the old sheet',
       await page.evaluate(() => location.hash), '');
  }

  await page.click('#wsRegen');
  await sleep(200);
  eq('and a fresh set of problems keeps that title',
     await page.$eval('#wsHeadTitle', e => e.textContent), 'Monday sheet');
  await page.select('#wsType', 'wordproblem');
  await sleep(200);
  eq('picking a different worksheet type renames the sheet to match',
     await page.evaluate(() => [document.getElementById('wsTitle').value,
                                document.getElementById('wsHeadTitle').textContent]),
     ['Word Problems', 'Word Problems']);

  // =========================================================================
  group('Worksheet Maker: saved sheets are not all called the same thing');
  await fresh(page, base);
  await page.evaluate(() => show('worksheet'));
  await page.click('#wsTitle');
  await page.evaluate(() => document.getElementById('wsTitle').select());
  await page.type('#wsTitle', 'Year 3 practice');
  await page.click('#wsPrint');
  await sleep(600);
  const wsName = await page.evaluate(() => window.__printTitles[0]);
  check('the suggested filename names the sheet and the day',
        /Year 3 practice/.test(wsName) && /\d{4}-\d{2}-\d{2}/.test(wsName), wsName);
  eq('and the tab gets its own title back afterwards',
     await page.evaluate(async () => { await new Promise(r => setTimeout(r, 1500)); return document.title; }),
     'Factor Field — Times Tables Practice');

  // =========================================================================
  group('Worksheet Maker on a phone');
  await page.setViewport({ width: 390, height: 844 });
  await fresh(page, base);
  await page.evaluate(() => show('worksheet'));
  await sleep(250);
  {
    // "Score: ____ / 20" used to hang 65px past the right edge, so the page
    // scrolled sideways — which also dragged the closed Settings drawer into view.
    const m = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth
    }));
    check('the worksheet page does not scroll sideways on a 390px phone',
          m.scrollW <= m.innerW, `scrollWidth ${m.scrollW} vs window ${m.innerW}`);
    const wide = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('#app *').forEach(el => {
        const b = el.getBoundingClientRect();
        if (b.width && b.right > window.innerWidth + 1) out.push(el.textContent.trim().slice(0, 40));
      });
      return out;
    });
    eq('nothing on the sheet is cut off at the right edge', wide, []);
  }
  await page.setViewport({ width: 1280, height: 900 });

  // =========================================================================
  group('My Progress: the report knows who it is for');
  await fresh(page, base);
  await playCorrect(page, 3, 4, 10);
  await page.evaluate(() => show('progress'));
  await page.type('#whoInitials', 'ab');
  await page.type('#whoDate', '03/11/2026');
  await sleep(150);
  // Saved on every keystroke. Before this, nothing was stored until the box was
  // clicked out of — so typing initials and printing straight away lost them.
  eq('the initials are kept the moment you type them, without clicking away',
     await page.evaluate(() => JSON.parse(localStorage.getItem('mq_who')).initials), 'AB');
  eq('the date is kept too',
     await page.evaluate(() => JSON.parse(localStorage.getItem('mq_who')).date), '2026-03-11');
  check('the initials box will not take a whole name',
        (await page.$eval('#whoInitials', e => e.maxLength)) === 4);
  check('the report says it stays on this laptop',
        /Stays on this laptop/.test(await page.$eval('.who-row', e => e.textContent)));
  eq('and there is nowhere to type a full name',
     await page.evaluate(() => document.querySelectorAll('input[type=text]:not([maxlength="4"])').length), 0);

  // THE MOMENT THAT MATTERS. This check used to reload the page first, which
  // re-drew the report out of storage and hid the real bug: the printed line was
  // built once when the report was drawn and never repainted, so a teacher who
  // typed initials, picked a date and pressed Print straight away got
  // "Child: —" and TODAY'S date on the paper — a report carrying a date nobody
  // chose. Read the line WITHOUT reloading, and read it again in the instant
  // window.print fires, because that is what goes on paper.
  const printLineNow = await page.$eval('.who-print', e => e.textContent);
  check('the printed line updates as you type, with no reload and no clicking away',
        /AB/.test(printLineNow) && /2026-03-11/.test(printLineNow) && !/Child: —/.test(printLineNow),
        printLineNow);

  await page.click('#progPrint');
  await sleep(400);
  const lineAtPrint = await page.evaluate(() => window.__whoPrintAtPrint.slice(-1)[0]);
  check('a printed report carries the initials and the date',
        /AB/.test(lineAtPrint) && /2026-03-11/.test(lineAtPrint), lineAtPrint);
  check('the printed report never shows a date the teacher did not choose',
        !/2026-08|Child: —/.test(String(lineAtPrint).replace('2026-03-11', '')) &&
        !/Child: —/.test(lineAtPrint), lineAtPrint);

  // What the paper ACTUALLY shows: under print styling the typing boxes are
  // hidden and this line is the only place the child's initials appear.
  await page.emulateMediaType('print');
  const onPaper = await page.evaluate(() => ({
    boxes: getComputedStyle(document.querySelector('.who-row')).display,
    line:  getComputedStyle(document.querySelector('.who-print')).display,
    text:  document.querySelector('.who-print').textContent
  }));
  await page.emulateMediaType('screen');
  check('on paper the typing boxes are gone and the printed line is the one that shows',
        onPaper.boxes === 'none' && onPaper.line === 'block' &&
        /AB/.test(onPaper.text) && /2026-03-11/.test(onPaper.text),
        JSON.stringify(onPaper));

  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => show('progress'));
  eq('the initials are still there after a reload',
     await page.$eval('#whoInitials', e => e.value), 'AB');
  const printLineAfter = await page.$eval('.who-print', e => e.textContent);
  check('and the printed line still says so after a reload',
        /AB/.test(printLineAfter) && /2026-03-11/.test(printLineAfter), printLineAfter);

  await page.click('#progPrint');
  await sleep(400);
  const rptName = await page.evaluate(() => window.__printTitles.slice(-1)[0]);
  check('a saved report is named for who and when, not the same as every other one',
        /AB/.test(rptName) && /2026-03-11/.test(rptName) && /progress/i.test(rptName), rptName);
  check('the grown-ups summary is opened so it is actually on the paper',
        await page.evaluate(() => window.__grownupsOpen.slice(-1)[0]) === true);

  // =========================================================================
  group('My Progress: saving the numbers');
  await page.evaluate(() => show('progress'));
  // A comma in the title used to be the classic way to shift a whole CSV row
  // one column to the left. Put one in and check nothing moves.
  await page.evaluate(() => { who.initials = 'AB, JR'; saveWho(); show('progress'); });
  await page.click('#progCsv');
  await sleep(400);
  const csv = await page.evaluate(() => window.__lastBlob.text());
  const dl  = await page.evaluate(() => window.__downloads.slice(-1)[0]);
  check('the CSV file is named for who and when',
        /AB, JR/.test(dl) && /\d{4}-\d{2}-\d{2}/.test(dl) && /\.csv$/.test(dl), dl);
  check('a comma in the initials does not split the row in two',
        csv.includes('Child (initials),"AB, JR"'),
        csv.split('\r\n').filter(l => /Child/.test(l)).join(' | '));
  check('the CSV carries the date', /^Date,2026-03-11$/m.test(csv));
  check('the CSV carries every headline number on the report',
        /Questions answered,10/.test(csv) && /Correct overall \(%\),100/.test(csv) &&
        /Stars earned,20/.test(csv), csv.slice(0, 300));
  check('the CSV has a row for all twelve times tables',
        csv.split(/\r\n/).filter(l => /^\d+s,/.test(l)).length === 12);
  check('the CSV carries the strengths and stretches, with the bold tags taken out',
        /Strengths/.test(csv) && /Stretches/.test(csv) && !/<b>/.test(csv));
  check('the CSV says the numbers never left the laptop',
        /Nothing was uploaded/.test(csv));

  // =========================================================================
  group('My Progress: clearing it');
  await fresh(page, base);
  await playCorrect(page, 3, 4, 9);
  await page.evaluate(() => show('progress'));
  eq('nine correct answers show as eighteen stars',
     await page.$eval('#starCount', e => e.textContent), '18');

  // Saying no must change nothing at all.
  await page.evaluate(() => { window.__confirmAnswer = false; });
  await page.click('#resetProg');
  await sleep(200);
  eq('saying no to "Reset progress" leaves everything alone',
     await page.evaluate(() => ({ stars: document.getElementById('starCount').textContent,
                                  answered: totalAnswered() })),
     { stars: '18', answered: 9 });
  check('and it asked before touching anything',
        /Clear all progress/.test(await page.evaluate(() => window.__confirms.slice(-1)[0])));
  check('the question says the stars go too, and that you can change your mind',
        /stars/.test(await page.evaluate(() => window.__confirms.slice(-1)[0])) &&
        /Bring it back/.test(await page.evaluate(() => window.__confirms.slice(-1)[0])),
        await page.evaluate(() => window.__confirms.slice(-1)[0]));

  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#resetProg');
  await sleep(300);
  // The old bug: the answers were cleared but the ⭐ count was not, so the very
  // same card said "9 questions answered" and "36 stars earned".
  eq('clearing progress clears the stars as well as the answers',
     await page.evaluate(() => ({ stars: document.getElementById('starCount').textContent,
                                  stored: localStorage.getItem('mq_stars') })),
     { stars: '0', stored: '0' });
  await page.reload({ waitUntil: 'load' });
  eq('and the stars are still zero after a reload',
     await page.$eval('#starCount', e => e.textContent), '0');

  await playCorrect(page, 5, 6, 9);
  await page.evaluate(() => show('progress'));
  {
    const tiles = await page.$$eval('.stat-tile', els => els.map(e => e.innerText.replace(/\n/g, ' ')));
    check('the two headline numbers agree with each other after a reset',
          tiles.some(t => /^9 /.test(t)) && tiles.some(t => /^18 /.test(t)), tiles.join(' | '));
  }

  // =========================================================================
  group('My Progress: getting it back after clearing it by mistake');
  await fresh(page, base);
  await playCorrect(page, 7, 8, 12);
  await page.evaluate(() => show('progress'));
  await page.click('#resetProg');
  await sleep(300);
  check('a "Bring it back" button appears right after clearing',
        await page.evaluate(() => !!document.getElementById('undoReset')));
  await page.click('#undoReset');
  await sleep(300);
  eq('and it brings back the answers and the stars',
     await page.evaluate(() => ({ answered: totalAnswered(),
                                  stars: document.getElementById('starCount').textContent })),
     { answered: 12, stars: '24' });
  await page.reload({ waitUntil: 'load' });
  eq('what came back is still there after a reload',
     await page.evaluate(() => totalAnswered()), 12);

  // =========================================================================
  group('The sample student, so a visitor sees a real report on arrival');
  await fresh(page, base);
  check('there is a "Try it with a sample student" button on the front page',
        /sample student/i.test(await page.$eval('#loadSample', e => e.textContent)));
  await page.click('#loadSample');
  await sleep(400);
  const sample = await page.evaluate(() => ({
    heading: document.querySelector('#app h1') ? document.querySelector('#app h1').textContent : '',
    banner: document.querySelector('.sample-banner') ? document.querySelector('.sample-banner').textContent : '',
    bar: document.getElementById('sampleBar').classList.contains('hidden') ? ''
         : document.getElementById('sampleBar').textContent,
    initials: document.getElementById('whoInitials').value,
    tiles: [...document.querySelectorAll('.stat-tile')].map(e => e.innerText.replace(/\n/g, ' ')),
    cells: document.querySelectorAll('.tbl-cell').length,
    strengths: [...document.querySelectorAll('.ss-strength li')].map(e => e.textContent),
    stretches: [...document.querySelectorAll('.ss-stretch .stretch-btn span:first-child')].map(e => e.textContent),
    bands: [...document.querySelectorAll('.tbl-cell')].map(e => e.className.replace('tbl-cell ', ''))
  }));
  check('one click lands you on a filled-in report', /My Progress/.test(sample.heading), sample.heading);
  check('she is named on screen as a sample and not a real child',
        /Maya Torres/.test(sample.banner) && /not a real child/i.test(sample.banner), sample.banner);
  check('every other screen says so too',
        /Maya Torres/.test(sample.bar) && /Not a real child/i.test(sample.bar), sample.bar);
  eq('her initials are M.T., the same in every tool', sample.initials, 'M.T.');
  check('the report has real numbers in it', sample.tiles.every(t => !/^0 /.test(t)), sample.tiles.join(' | '));
  eq('the times-table map draws all twelve tables', sample.cells, 12);
  check('she is good at some tables', sample.strengths.length >= 2, JSON.stringify(sample.strengths));
  check('and genuinely wobbly on others', sample.stretches.length >= 2, JSON.stringify(sample.stretches));
  check('she is not perfect — the map shows more than one colour',
        new Set(sample.bands).size >= 3, JSON.stringify(sample.bands));
  check('and two tables she has never tried are still grey',
        sample.bands.filter(b => b === 'tc-none').length >= 2, JSON.stringify(sample.bands));
  check('the small 6s / big 6s pattern is spotted',
        sample.stretches.some(s => /6s/.test(s) && /bigger/.test(s)), JSON.stringify(sample.stretches));
  check('you cannot type a real child\'s initials over the sample\'s numbers',
        await page.$eval('#whoInitials', e => e.readOnly));

  await page.click('#progCsv');
  await sleep(400);
  const sampleCsv = await page.evaluate(() => window.__lastBlob.text());
  const sampleDl  = await page.evaluate(() => window.__downloads.slice(-1)[0]);
  check('a saved copy of her report is labelled as a sample',
        /Sample student — Maya Torres/.test(sampleCsv) && /not a real child/i.test(sampleCsv),
        sampleCsv.split('\r\n')[1]);
  check('and so is the filename', /SAMPLE Maya Torres/.test(sampleDl), sampleDl);
  await page.click('#progPrint');
  await sleep(400);
  check('a printed copy of her report is labelled as a sample too',
        /SAMPLE Maya Torres/.test(await page.evaluate(() => window.__printTitles.slice(-1)[0])) &&
        /Sample student — Maya Torres/.test(await page.$eval('.who-print', e => e.textContent)));

  await page.click('#clearSampleBtn');
  await sleep(400);
  eq('one click clears her and the tool is empty again',
     await page.evaluate(() => ({ answered: totalAnswered(),
                                  stars: document.getElementById('starCount').textContent,
                                  bar: document.getElementById('sampleBar').classList.contains('hidden'),
                                  who: JSON.parse(localStorage.getItem('mq_who')) })),
     { answered: 0, stars: '0', bar: true,
       who: { initials: '', date: '', dateChosen: false, sample: false } });

  // Loading her over real practice must not throw that practice away.
  await fresh(page, base);
  await playCorrect(page, 9, 9, 11);
  await page.evaluate(() => show('progress'));
  await page.click('#loadSample');
  await sleep(400);
  check('loading her over a real child\'s practice asks first',
        /sample student/i.test(await page.evaluate(() => window.__confirms.slice(-1)[0])),
        await page.evaluate(() => window.__confirms.slice(-1)[0]));
  await page.click('#undoReset');
  await sleep(400);
  eq('and the real practice can be brought straight back',
     await page.evaluate(() => totalAnswered()), 11);

  // =========================================================================
  group('The times-table map when everything sits in one band');
  await fresh(page, base);
  // Eight answers on ONE fact — every scored table is 100%, nothing else tried.
  // A map that only draws when there is a spread of results is no use for a real
  // reading, which is very often all-one-band.
  await playCorrect(page, 3, 4, 8);
  await page.evaluate(() => show('progress'));
  {
    const m = await page.evaluate(() => ({
      cells: document.querySelectorAll('.tbl-cell').length,
      scored: [...document.querySelectorAll('.tbl-cell')]
                .filter(e => e.querySelector('.pct').textContent !== '—')
                .map(e => e.querySelector('.num').textContent + ' ' + e.querySelector('.pct').textContent),
      strengthText: document.querySelector('.ss-strength').innerText.trim(),
      stretchText: document.querySelector('.ss-stretch').innerText.trim(),
      mapVisible: document.querySelector('.tbl-map').getBoundingClientRect().height > 0
    }));
    eq('the map still draws all twelve tables when every score is identical', m.cells, 12);
    check('the map is actually visible, not a zero-height box', m.mapVisible);
    eq('the tables that were practised show their percentage', m.scored, ['3s 100%', '4s 100%']);
    check('the strengths panel still says something', m.strengthText.length > 20, m.strengthText);
    check('the stretches panel still says something', m.stretchText.length > 20, m.stretchText);
  }
  // The other end of the same problem: every score identically wrong.
  await fresh(page, base);
  await page.evaluate(() => { for (let i = 0; i < 8; i++) recordAttempt(7, 8, false, false); show('progress'); });
  {
    const m = await page.evaluate(() => ({
      cells: document.querySelectorAll('.tbl-cell').length,
      strengthText: document.querySelector('.ss-strength').innerText.trim(),
      stretchText: document.querySelector('.ss-stretch').innerText.trim()
    }));
    eq('the map still draws when every answer was wrong', m.cells, 12);
    check('and both panels still say something helpful',
          m.strengthText.length > 20 && m.stretchText.length > 20,
          m.strengthText + ' || ' + m.stretchText);
  }

  // =========================================================================
  group('A saved file that has gone bad never puts nonsense on the report');
  // A blob whose SHAPE looks right but whose contents are not numbers used to
  // slip past the guard, and the report then printed "NaN questions answered"
  // and "NaN% correct overall" as its two headline numbers. Nothing crashed and
  // nothing showed in the console — the paper was just wrong. Feed it every
  // shape of rubbish and insist the numbers stay numbers.
  {
    // The first three hold a usable list of facts and enough real answers to
    // unlock the full report, so the three big headline tiles and all twelve
    // map squares are genuinely exercised. The rest are wrecked past use — the
    // whole file is dropped and the visitor lands back on the friendly
    // "keep going" screen, with a real number on it, not NaN.
    const junk = [
      ['fact records full of rubbish',     '{"facts":{"3 x 4":{"seen":"x","correct":"y","hinted":"z"}},"correct":10,"wrong":2}',   true],
      ['counts saved as text',             '{"facts":{"3 x 4":{"seen":4,"correct":3,"hinted":0}},"correct":"9","wrong":"3"}',      true],
      ['more right than were ever asked',  '{"facts":{"3 x 4":{"seen":2,"correct":99,"hinted":50}},"correct":8,"wrong":0}',        true],
      // This exact blob is the one that used to print "NaN questions answered"
      // and "NaN% correct overall" as the two headline numbers.
      ['a facts list that is a word',      '{"facts":"nope"}',                                                                     false],
      ['that, plus counts to go with it',  '{"facts":"nope","correct":10,"wrong":2}',                                              false],
      ['a facts list that is an array',    '{"facts":[1,2,3],"correct":null,"wrong":null}',                                        false],
      ['counts that are not numbers',      '{"facts":{},"correct":"lots","wrong":"some"}',                                         false],
      ['not JSON at all',                  'not json {{{',                                                                         false],
      ['the word null',                    'null',                                                                                 false]
    ];
    const BAD = /NaN|Infinity|undefined|\[object Object\]/;
    for (const [why, blob, reachesReport] of junk){
      await fresh(page, base);
      await page.evaluate(b => localStorage.setItem('mq_stats', b), blob);
      await page.reload({ waitUntil: 'load' });
      await page.evaluate(() => show('progress'));
      const seen = await page.evaluate(() => ({
        tiles: Array.from(document.querySelectorAll('.stat-tile .big')).map(e => e.textContent),
        map:   Array.from(document.querySelectorAll('.tbl-cell .pct')).map(e => e.textContent),
        body:  document.getElementById('app').innerText
      }));
      if (reachesReport){
        check('the three headline numbers are still numbers — ' + why,
              seen.tiles.length === 3 && seen.tiles.every(t => /^\d+%?$/.test(t)),
              JSON.stringify(seen.tiles));
        check('and no square of the times-table map shows nonsense — ' + why,
              seen.map.length === 12 && seen.map.every(m => /^(\d+%|—)$/.test(m)),
              JSON.stringify(seen.map));
      } else {
        check('a wrecked file just puts you back on the "keep going" screen — ' + why,
              /Answered so far: \d+ of 8/.test(seen.body),
              seen.body.split('\n').slice(0, 4).join(' / '));
      }
      check('and nothing anywhere on the screen reads as nonsense — ' + why,
            !BAD.test(seen.body), (seen.body.match(BAD) || []).join(' '));
    }
    eq('and none of that made the tool throw', pageErrors, []);
  }

  // =========================================================================
  group('Nothing is lost when you reload');
  await fresh(page, base);
  await playCorrect(page, 6, 7, 10);
  await page.evaluate(() => { who.initials = 'ZQ'; saveWho(); });
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => show('progress'));
  eq('the answers, the stars and the initials all survive a reload',
     await page.evaluate(() => ({ answered: totalAnswered(),
                                  stars: document.getElementById('starCount').textContent,
                                  initials: document.getElementById('whoInitials').value })),
     { answered: 10, stars: '20', initials: 'ZQ' });

  // Every one of these used to talk to localStorage directly and now goes
  // through the wrapper that survives a private window. Prove the wrapper still
  // actually saves in a normal one.
  await fresh(page, base);
  await page.click('#gearBtn');
  await sleep(400);                 // the drawer slides in; wait for it to land
  await page.click('#selEasy');
  await page.select('#maxFactor', '9');
  await page.click('#saveSettings');
  await sleep(200);
  await page.evaluate(() => { lsSet('mq_speed_best', '3289'); lsSet('mq_blast_level', 'hard'); });
  await page.reload({ waitUntil: 'load' });
  eq('practice settings, the Speed Run best and the Takeoff level all come back',
     await page.evaluate(() => ({ tables: settings.tables.slice().sort((a,b)=>a-b),
                                  max: settings.maxFactor,
                                  speedBest: lsGet('mq_speed_best'),
                                  blastLevel: lsGet('mq_blast_level') })),
     { tables: [1,2,3,4,5], max: 9, speedBest: '3289', blastLevel: 'hard' });

  // =========================================================================
  group('Taking back a mis-tap');
  await fresh(page, base);
  await page.evaluate(() => show('drop'));
  await page.click('[data-card="7"]');
  await sleep(120);
  const filled = await page.$$eval('.digit-box', els => els.map(e => e.textContent));
  await page.click('.digit-box');
  await sleep(120);
  const cleared = await page.$$eval('.digit-box', els =>
    els.map(e => ({ txt: e.textContent, empty: e.classList.contains('empty') })));
  check('a digit tapped by mistake can be cleared without starting the question again',
        filled[0] === '7' && cleared[0].empty === true,
        JSON.stringify({ filled, cleared }));

  // =========================================================================
  group('"Bring it back" cannot eat a newer child\'s practice');
  // The button used to survive for ever, and one un-asked click replaced the
  // current child's week with the old snapshot and deleted the only copy.
  await fresh(page, base);
  await playCorrect(page, 6, 7, 12);
  await page.evaluate(() => show('progress'));
  await page.click('#resetProg');
  await sleep(300);
  await page.reload({ waitUntil: 'load' });               // the next morning
  await playCorrect(page, 4, 5, 20);                      // the next child
  await page.evaluate(() => show('progress'));
  check('the undo button is still offered the next session',
        await page.evaluate(() => !!document.getElementById('undoReset')));
  await page.evaluate(() => { window.__confirmAnswer = false; });
  await page.click('#undoReset');
  await sleep(300);
  eq('saying no to it changes nothing',
     await page.evaluate(() => totalAnswered()), 20);
  check('and it ASKED before touching the newer practice',
        /put\s+aside/i.test(await page.evaluate(() => window.__confirms.slice(-1)[0])),
        await page.evaluate(() => window.__confirms.slice(-1)[0]));
  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#undoReset');
  await sleep(300);
  eq('saying yes brings the old practice back', await page.evaluate(() => totalAnswered()), 12);
  await page.evaluate(() => show('progress'));
  await page.click('#undoReset');
  await sleep(300);
  eq('and the newer practice was not destroyed — pressing again swaps back',
     await page.evaluate(() => totalAnswered()), 20);

  // =========================================================================
  group('Resetting the sample cannot overwrite the real practice put aside');
  await fresh(page, base);
  await playCorrect(page, 3, 4, 14);
  await page.evaluate(() => show('progress'));
  await page.click('#loadSample');                        // stashes the real 14
  await sleep(400);
  await page.click('#resetProg');                         // reset over the SAMPLE
  await sleep(400);
  eq('the undo slot still holds the real child, not Maya Torres',
     await page.evaluate(() => { const u = JSON.parse(localStorage.getItem('mq_undo'));
                                 return { answered: u.stats.correct + u.stats.wrong,
                                          sample: !!(u.who && u.who.sample) }; }),
     { answered: 14, sample: false });
  await page.click('#undoReset');
  await sleep(300);
  eq('and the real practice comes back whole', await page.evaluate(() => totalAnswered()), 14);

  // =========================================================================
  group('Playing while the sample is loaded');
  // Every answer used to pour straight into Maya Torres' made-up record, which
  // then still printed "Sample student" over the mix.
  await fresh(page, base);
  await page.click('#loadSample');
  await sleep(400);
  await page.evaluate(() => { recordAttempt(2, 3, true, false); addStars(2); });
  eq('the first real answer clears the sample instead of feeding it',
     await page.evaluate(() => ({ answered: totalAnswered(),
                                  stars: document.getElementById('starCount').textContent,
                                  sample: JSON.parse(localStorage.getItem('mq_who')).sample,
                                  barHidden: document.getElementById('sampleBar').classList.contains('hidden') })),
     { answered: 1, stars: '2', sample: false, barHidden: true });
  check('and it says so out loud',
        /sample student/i.test(await page.$eval('#toast', e => e.textContent)),
        await page.$eval('#toast', e => e.textContent));

  // =========================================================================
  group('Closing the settings drawer without saving');
  // The ✕ used to keep the change live on screen but never store it — the tool
  // practised tables 1–5 all afternoon and forgot about it on the next reload.
  await fresh(page, base);
  await page.click('#gearBtn');
  await sleep(400);
  await page.click('#selEasy');
  await page.select('#maxFactor', '9');
  await page.click('#closePanel');
  await sleep(300);
  eq('closing with the ✕ puts the settings back exactly as they were',
     await page.evaluate(() => ({ tables: settings.tables.slice().sort((a, b) => a - b),
                                  max: settings.maxFactor,
                                  stored: localStorage.getItem('mq_settings') })),
     { tables: [2, 3, 4, 5, 6, 7, 8, 9, 10], max: 12, stored: null });

  // =========================================================================
  group('Saving settings does not wipe the worksheet being built');
  await fresh(page, base);
  await page.evaluate(() => show('worksheet'));
  await page.select('#wsType', 'wordproblem');
  await sleep(200);
  await page.select('#wsCount', '12');
  await sleep(200);
  await page.click('#wsTitle');
  await page.evaluate(() => document.getElementById('wsTitle').select());
  await page.type('#wsTitle', 'Year 4 Tuesday homework');
  await sleep(150);
  // The panel's own note says: change tables in ⚙️ Settings, then press New
  // problems. Following that instruction used to throw the whole sheet away.
  await page.click('#gearBtn');
  await sleep(400);
  await page.click('#selEasy');
  await page.click('#saveSettings');
  await sleep(500);
  eq('the sheet keeps its type, its count and its typed title after Save',
     await page.evaluate(() => ({ type: document.getElementById('wsType').value,
                                  count: document.getElementById('wsCount').value,
                                  title: document.getElementById('wsHeadTitle').textContent })),
     { type: 'wordproblem', count: '12', title: 'Year 4 Tuesday homework' });

  // =========================================================================
  group('The date on the report is the teacher\'s, or nobody\'s');
  // Clearing the Date box used to store "" but print TODAY's date anyway — a
  // date the teacher had just deliberately removed.
  await fresh(page, base);
  await playCorrect(page, 3, 4, 10);
  await page.evaluate(() => show('progress'));
  await page.type('#whoInitials', 'ab');
  await page.type('#whoDate', '03/11/2026');
  await sleep(150);
  await page.click('#whoDate');
  await page.keyboard.down('Meta');
  await page.keyboard.press('a');
  await page.keyboard.up('Meta');
  await page.keyboard.press('Backspace');
  await sleep(200);
  {
    const seen = await page.evaluate(() => ({
      stored: JSON.parse(localStorage.getItem('mq_who')).date,
      line: document.querySelector('.who-print').textContent,
      today: todayISO()
    }));
    check('an emptied date prints as no date, never as today',
          seen.stored === '' && /Date: —/.test(seen.line) && !seen.line.includes(seen.today),
          JSON.stringify(seen));
  }
  await page.click('#progPrint');
  await sleep(400);
  check('and the filename says "no date" rather than inventing one',
        /no date/.test(await page.evaluate(() => window.__printTitles.slice(-1)[0])),
        await page.evaluate(() => window.__printTitles.slice(-1)[0]));
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => show('progress'));
  eq('the cleared box stays cleared after a reload — it never re-fills itself',
     await page.$eval('#whoDate', e => e.value), '');

  // The other half of the same defect: a date that was auto-saved once used to
  // be frozen for ever, so a report printed months later carried the first
  // day's date for a different child.
  await fresh(page, base);
  await playCorrect(page, 3, 4, 10);
  await page.evaluate(() => localStorage.setItem('mq_who',
    JSON.stringify({ initials: 'JR', date: '2020-01-01', sample: false })));
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => show('progress'));
  {
    const seen = await page.evaluate(() => ({
      line: document.querySelector('.who-print').textContent,
      box: document.getElementById('whoDate').value,
      today: todayISO()
    }));
    check('an old auto-saved date is ignored — an untouched report is dated today',
          seen.line.includes(seen.today) && !seen.line.includes('2020-01-01') && seen.box === seen.today,
          JSON.stringify(seen));
  }

  // =========================================================================
  group('One answer, one payout');
  // Nothing locked the controls during the reward pause, so every extra tap of
  // Check recorded another correct attempt and paid the stars again.
  await fresh(page, base);
  await page.evaluate(() => { settings.difficulty = 'easy'; saveSettings(); show('drop'); });
  await sleep(200);
  {
    const digits = await page.evaluate(() => {
      const m = document.querySelector('.equation').textContent.match(/(\d+)\s*×\s*(\d+)\s*=/);
      return String(+m[1] * +m[2]).split('');
    });
    for (const d of digits) await page.click(`[data-card="${d}"]`);
    for (let i = 0; i < 6; i++){ await page.click('#check'); await sleep(60); }
    await sleep(300);
    eq('six taps of Check during the celebration still count as ONE answer',
       await page.evaluate(() => ({ answered: totalAnswered(),
                                    stars: document.getElementById('starCount').textContent })),
       { answered: 1, stars: '2' });
  }

  // Array Builder used to go further: after a wrong tap it highlighted the
  // right answer in green, and tapping that green answer was scored as correct.
  await fresh(page, base);
  await page.evaluate(() => show('array'));
  await sleep(200);
  {
    const fact = await page.evaluate(() => {
      const m = document.querySelector('.arr-q').textContent.match(/(\d+)\s*×\s*(\d+)/);
      const p = +m[1] * +m[2];
      const wrong = [...document.querySelectorAll('.choice')].find(c => +c.dataset.val !== p);
      wrong.click();
      return { a: +m[1], b: +m[2], p };
    });
    await sleep(120);
    await page.evaluate(p => {
      const right = [...document.querySelectorAll('.choice')].find(c => +c.dataset.val === p);
      if (right) right.click();
    }, fact.p);
    await sleep(200);
    eq('tapping the revealed green answer earns nothing',
       await page.evaluate(k => ({ fact: stats.facts[k],
                                   stars: document.getElementById('starCount').textContent }),
                           `${Math.min(fact.a, fact.b)}x${Math.max(fact.a, fact.b)}`),
       { fact: { seen: 1, correct: 0, wrong: 1, hinted: 0,
                 ts: await page.evaluate(k => stats.facts[k].ts, `${Math.min(fact.a, fact.b)}x${Math.max(fact.a, fact.b)}`) },
         stars: '0' });
  }

  // =========================================================================
  group('"New problem" during the celebration sticks');
  // The old auto-advance timer used to fire a second later and replace the
  // question the child had just asked for, wiping anything already typed.
  await fresh(page, base);
  await page.evaluate(() => { settings.difficulty = 'easy'; saveSettings(); show('drop'); });
  await sleep(200);
  {
    const digits = await page.evaluate(() => {
      const m = document.querySelector('.equation').textContent.match(/(\d+)\s*×\s*(\d+)\s*=/);
      return String(+m[1] * +m[2]).split('');
    });
    for (const d of digits) await page.click(`[data-card="${d}"]`);
    await page.click('#check');
    await sleep(80);
    await page.click('#skip');                       // "New problem", mid-celebration
    await sleep(100);
    await page.evaluate(() => { document.querySelector('.equation').dataset.mark = 'stay'; });
    await sleep(1500);                               // the orphaned timer's moment
    eq('the problem the child asked for is still the one on screen 1.5s later',
       await page.evaluate(() => (document.querySelector('.equation').dataset.mark || 'REPLACED')),
       'stay');
  }

  // =========================================================================
  group('Speed Run: "Play again" starts clean');
  // An answer in the last second of the clock left a next-question timer alive;
  // it fired ~0.7s into the NEW run and silently swapped the first question.
  await fresh(page, base);
  await page.evaluate(() => {
    // Run the 250ms game clock at 5ms so 60 seconds pass in ~1.2s of test time.
    const oi = window.setInterval.bind(window);
    window.setInterval = (fn, ms) => oi(fn, ms === 250 ? 5 : ms);
    show('speed');
  });
  await page.click('#go');
  await sleep(500);                                  // most of the clock is gone
  await page.evaluate(() => {                        // answer WRONG near the buzzer
    const m = document.querySelector('.equation').textContent.match(/(\d+)\s*×\s*(\d+)/);
    if (!m) return;
    const p = +m[1] * +m[2];
    const wrong = [...document.querySelectorAll('.choice')].find(c => +c.dataset.val !== p);
    if (wrong) wrong.click();
  });
  await page.waitForSelector('#again', { timeout: 4000 });
  await page.click('#again');
  await sleep(100);
  await page.evaluate(() => { const e = document.querySelector('.equation'); if (e) e.dataset.mark = 'stay'; });
  await sleep(500);
  eq('the first question of the new run is not replaced by a ghost timer',
     await page.evaluate(() => (document.querySelector('.equation') ? (document.querySelector('.equation').dataset.mark || 'REPLACED') : 'GONE')),
     'stay');

  // =========================================================================
  group('What lands on paper');
  await fresh(page, base);
  await page.evaluate(() => show('worksheet'));
  await page.evaluate(() => { navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  await page.click('#wsShare');                      // puts the toast up
  await sleep(200);
  await page.emulateMediaType('print');
  {
    const seen = await page.evaluate(() => ({
      toast: getComputedStyle(document.getElementById('toast')).display,
      prob: getComputedStyle(document.querySelector('.ws-prob')).breakInside
    }));
    eq('the black toast pill never prints onto a worksheet', seen.toast, 'none');
    eq('a worksheet problem is never sliced in half by the page break', seen.prob, 'avoid');
  }
  await page.emulateMediaType('screen');
  await playCorrect(page, 3, 4, 10);
  await page.evaluate(() => show('progress'));
  await page.emulateMediaType('print');
  {
    const seen = await page.evaluate(() => ({
      cellAdjust: getComputedStyle(document.querySelector('.tbl-cell')).webkitPrintColorAdjust,
      focusRow: getComputedStyle(document.getElementById('focusSpeed').closest('.row')).display
    }));
    eq('the times-table map keeps its colours on paper', seen.cellAdjust, 'exact');
    eq('the practice buttons stay off the paper', seen.focusRow, 'none');
  }
  await page.emulateMediaType('screen');

  // =========================================================================
  group('A worksheet never repeats itself');
  // Problems were drawn independently, so a printed 20-question sheet routinely
  // carried the same question two to five times — once, five times in twenty.
  await fresh(page, base);
  await page.evaluate(() => show('worksheet'));
  for (let round = 0; round < 5; round++){
    await page.click('#wsRegen');
    await sleep(150);
    const probs = await page.evaluate(() =>
      [...document.querySelectorAll('.ws-prob')].map(e => e.textContent.replace(/^\d+\./, '').trim()));
    eq(`all 20 facts problems are different (round ${round + 1})`,
       new Set(probs).size, probs.length);
  }
  await page.select('#wsType', 'equalgroups');       // its whole pool is exactly 20
  await sleep(250);
  for (let round = 0; round < 3; round++){
    const probs = await page.evaluate(() =>
      [...document.querySelectorAll('.ws-prob')].map(e => e.innerHTML));
    eq(`all 20 equal-groups pictures are different (round ${round + 1})`,
       new Set(probs).size, probs.length);
    await page.click('#wsRegen');
    await sleep(200);
  }

  // =========================================================================
  group('A shared sheet opens once, not for ever');
  await fresh(page, base);
  await page.evaluate(() => show('worksheet'));
  await page.click('#wsTitle');
  await page.evaluate(() => document.getElementById('wsTitle').select());
  await page.type('#wsTitle', 'Shared sheet');
  await page.evaluate(() => { navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  await page.click('#wsShare');
  await sleep(300);
  {
    const url = await page.evaluate(() => window.__copied);
    await page.goto(url, { waitUntil: 'load' });
    eq('pasting the link opens the exact sheet that was shared',
       await page.$eval('#wsHeadTitle', e => e.textContent), 'Shared sheet');
    eq('and the link is consumed, not left in the address bar',
       await page.evaluate(() => location.hash), '');
    await page.reload({ waitUntil: 'load' });
    check('so a plain reload later brings the tool back normally, not the old sheet',
          /Pick a way to play/.test(await page.$eval('#app h1', e => e.textContent)),
          await page.$eval('#app h1', e => e.textContent));
  }

  // =========================================================================
  group('The CSV and the map tell the same story');
  await fresh(page, base);
  await page.evaluate(() => {
    for (let i = 0; i < 8; i++) recordAttempt(3, 4, true, false);
    recordAttempt(3, 7, true, false);                // the 7s tried exactly once
    show('progress');
  });
  {
    const map7 = await page.evaluate(() =>
      [...document.querySelectorAll('.tbl-cell')].find(c => c.querySelector('.num').textContent === '7s')
        .querySelector('.pct').textContent);
    eq('a table tried once shows as not-tried-yet on the map', map7, '—');
  }
  await page.click('#progCsv');
  await sleep(400);
  {
    const csv2 = await page.evaluate(() => window.__lastBlob.text());
    const row7 = csv2.split(/\r\n/).find(l => /^7s,/.test(l));
    eq('and the CSV row agrees — no percentage next to "not tried yet"',
       row7, '7s,1,1,,0,not tried yet');
  }

  // =========================================================================
  group('The Stretches card cannot contradict the map beneath it');
  await fresh(page, base);
  await page.evaluate(() => {
    for (let i = 0; i < 5; i++) recordAttempt(7, 4, false, false);   // 7s and 4s all wrong
    for (let i = 0; i < 3; i++) recordAttempt(2, 5, true, false);
    show('progress');
  });
  {
    const seen = await page.evaluate(() => ({
      stretch: document.querySelector('.ss-stretch').innerText,
      clay: [...document.querySelectorAll('.tbl-cell.tc-low .num')].map(e => e.textContent)
    }));
    check('tables the map paints "needs practice" are named as Stretches, not "Nothing tricky"',
          seen.clay.includes('7s') && /7s/.test(seen.stretch) && !/Nothing tricky/.test(seen.stretch),
          JSON.stringify(seen));
  }

  // =========================================================================
  group('Mixed review is honest about the tables setting');
  await fresh(page, base);
  await page.evaluate(() => show('worksheet'));
  await page.select('#wsType', 'mixed');
  await sleep(250);
  check('the Mixed sheet no longer claims to use your chosen tables',
        !/Uses your chosen tables/.test(await page.$eval('.small-note', e => e.textContent)),
        await page.$eval('.small-note', e => e.textContent));

  // =========================================================================
  group('A browser that cannot save never promises an undo');
  {
    const p3 = await browser.newPage();
    await p3.evaluateOnNewDocument(() => {
      window.__confirms = []; window.__confirmAnswer = true;
      window.confirm = m => { window.__confirms.push(String(m)); return window.__confirmAnswer; };
      const boom = () => { throw new DOMException('QuotaExceededError'); };
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get(){ return { getItem: boom, setItem: boom, removeItem: boom, clear: boom }; }
      });
    });
    await p3.goto(base + '/index.html', { waitUntil: 'load' });
    await p3.evaluate(() => {
      for (let i = 0; i < 20; i++) recordAttempt(3, 4, true, false);
      addStars(40);
      show('progress');
    });
    await p3.click('#resetProg');
    await sleep(300);
    const said = await p3.evaluate(() => ({
      confirmText: window.__confirms.slice(-1)[0],
      undoBtn: !!document.getElementById('undoReset'),
      toast: document.getElementById('toast').textContent
    }));
    check('the confirm says the clear is final instead of promising "Bring it back"',
          /no way to bring it back/i.test(said.confirmText) && !/button appears/i.test(said.confirmText),
          said.confirmText);
    check('no phantom undo button appears', said.undoBtn === false);
    check('and the toast does not promise one either',
          !/bring it back/i.test(said.toast), said.toast);
    await p3.close();
  }

  // =========================================================================
  group('A half-full disk cannot half-save');
  // The tiny star write used to keep succeeding after the big stats write had
  // started failing, so a reload showed "10 questions answered / 70 stars"
  // with the warning banner gone.
  await fresh(page, base);
  await playCorrect(page, 3, 4, 10);                 // 10 answers, 20 stars, saved cleanly
  await page.evaluate(() => {
    // From here on, big writes fail (a filling disk) while small ones would fit.
    const proto = Object.getPrototypeOf(localStorage);
    const orig = proto.setItem;
    proto.setItem = function (k, v) {
      if (String(v).length > 60) throw new DOMException('QuotaExceededError');
      return orig.call(this, k, v);
    };
    recordAttempt(8, 9, true, false);                // stats write fails…
    addStars(2);                                     // …so this must not land either
  });
  eq('once one write fails, the star count on disk stops moving too',
     await page.evaluate(() => ({ stars: localStorage.getItem('mq_stars'),
                                  banner: !!document.getElementById('storageNote') })),
     { stars: '20', banner: true });

  // =========================================================================
  group('Two tabs on one laptop');
  await fresh(page, base);
  await playCorrect(page, 6, 7, 12);
  {
    const pageB = await browser.newPage();
    await pageB.goto(base + '/index.html', { waitUntil: 'load' });
    await playCorrect(page, 6, 7, 5);                // tab A keeps going; B is now stale
    await sleep(200);
    await pageB.evaluate(() => { recordAttempt(2, 2, true, false); addStars(2); });
    await sleep(200);
    eq('one answer in the older tab adds to the other tab\'s work instead of erasing it',
       await pageB.evaluate(() => JSON.parse(localStorage.getItem('mq_stats')))
         .then(s => s.correct + s.wrong), 18);
    await pageB.close();
  }
  await page.reload({ waitUntil: 'load' });
  eq('and the first tab sees all eighteen after a reload',
     await page.evaluate(() => totalAnswered()), 18);

  // =========================================================================
  group('Times Table Takeoff on a 13-inch laptop');
  await page.setViewport({ width: 1280, height: 690 });
  await fresh(page, base);
  await page.evaluate(() => { document.querySelector('[data-screen="blast"]').click(); });
  await sleep(500);
  {
    const m = await page.evaluate(() => {
      const r = document.getElementById('blStart').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, vh: window.innerHeight };
    });
    check('the Start button is on screen when the game screen opens',
          m.top >= 0 && m.bottom <= m.vh, JSON.stringify(m));
  }
  await page.evaluate(() => document.getElementById('blStart').click());
  await sleep(300);
  {
    const m = await page.evaluate(() => {
      const r = document.getElementById('blCanvas').getBoundingClientRect();
      const nav = document.querySelector('.nav').getBoundingClientRect();
      return { canvasTop: r.top, canvasBottom: r.bottom, navBottom: nav.bottom,
               shipY: r.bottom - 40, vh: window.innerHeight };
    });
    check('the problem at the top and the ship at the bottom are both visible at once',
          m.canvasTop >= m.navBottom - 2 && m.canvasBottom <= m.vh + 2 && m.shipY < m.vh,
          JSON.stringify(m));
  }
  await page.setViewport({ width: 1280, height: 900 });

  // =========================================================================
  group('Show Me How on an iPad in portrait');
  await page.setViewport({ width: 768, height: 1024 });
  await fresh(page, base);
  await page.evaluate(() => show('showme'));
  await sleep(400);
  {
    const m = await page.evaluate(() => {
      const r = document.getElementById('smPlay').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, vh: window.innerHeight };
    });
    check('the "Show me how" button the instructions name is actually on screen',
          m.top >= 0 && m.bottom <= m.vh, JSON.stringify(m));
  }
  await page.setViewport({ width: 1280, height: 900 });

  // =========================================================================
  group('Takeoff cannot credit an alien the child never saw');
  await fresh(page, base);
  await page.evaluate(() => { document.querySelector('[data-screen="blast"]').click(); });
  await sleep(300);
  await page.evaluate(() => document.getElementById('blStart').click());
  await sleep(100);
  await page.keyboard.down(' ');                     // hold fire, the natural way to play
  for (let i = 0; i < 25; i++){
    // Re-clicking the level button forces a fresh problem while bullets fly —
    // the deterministic route to the old first-frame kill.
    await page.evaluate(() => document.querySelector('.blvl.active').click());
    await sleep(40);
  }
  await page.keyboard.up(' ');
  eq('no answer is recorded for an alien still above the play area',
     await page.evaluate(() => ({ answered: totalAnswered(),
                                  stars: document.getElementById('starCount').textContent })),
     { answered: 0, stars: '0' });
  await page.evaluate(() => show('home'));           // stop the game loop

  // =========================================================================
  group('The difficulty setting actually changes the game');
  await fresh(page, base);
  await page.click('#gearBtn');
  await sleep(400);
  await page.click('[data-diff="easy"]');
  await page.click('#saveSettings');
  await sleep(400);
  await page.evaluate(() => show('drop'));
  {
    const blanks = [];
    for (let i = 0; i < 12; i++){
      blanks.push(await page.$eval('.equation', e => e.dataset.blank));
      await page.click('#skip');
      await sleep(60);
    }
    check('on Easy, Digit Drop always asks for the answer',
          blanks.every(b => b === 'p'), blanks.join(','));
  }
  await page.click('#gearBtn');
  await sleep(400);
  await page.click('[data-diff="hard"]');
  await page.click('#saveSettings');
  await sleep(400);
  await page.evaluate(() => show('drop'));
  {
    const blanks = [];
    for (let i = 0; i < 30; i++){
      blanks.push(await page.$eval('.equation', e => e.dataset.blank));
      await page.click('#skip');
      await sleep(50);
    }
    check('on Hard, it sometimes hides a factor instead',
          blanks.some(b => b !== 'p'), blanks.join(','));
  }

  // =========================================================================
  group('Nothing leaves this laptop');
  await fresh(page, base);
  await page.evaluate(() => { ['home','drop','mystery','speed','array','showme','worksheet','progress'].forEach(show); });
  await sleep(400);
  eq('the tool never asks the internet for anything', offSiteRequests, []);
  eq('there are no <script src> or <link href> tags pointing off the page',
     await page.evaluate(() => [...document.querySelectorAll('script[src], link[href]')]
       .map(e => e.src || e.href).filter(u => !u.startsWith(location.origin))), []);

  // =========================================================================
  group('Still quiet at the end');
  eq('no red errors in the console across the whole run', consoleErrors, []);
  eq('nothing crashed across the whole run', pageErrors, []);

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
