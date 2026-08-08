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
// node_modules is a symlink to ../../running-record-tool/tests/node_modules, so
// there is nothing to install.
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
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.resolve(); });
  await page.click('#wsShare');
  await sleep(500);
  check('the FIRST click on Copy share link after typing a title works too',
        /copied/i.test(await page.$eval('#toast', e => e.textContent)),
        await page.$eval('#toast', e => e.textContent));
  {
    const hash = await page.evaluate(() => location.hash);
    const payload = JSON.parse(Buffer.from(hash.replace('#ws=', ''), 'base64').toString('utf8'));
    eq('the share link carries the title you typed', payload.title, 'Monday sheet');
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
  // "Today" is worked out inside the page, not in node — a run that straddles
  // midnight in a different timezone would otherwise fail for no real reason.
  eq('one click clears her and the tool is empty again',
     await page.evaluate(() => ({ answered: totalAnswered(),
                                  stars: document.getElementById('starCount').textContent,
                                  bar: document.getElementById('sampleBar').classList.contains('hidden'),
                                  who: localStorage.getItem('mq_who') })),
     await page.evaluate(() => ({ answered: 0, stars: '0', bar: true,
                                  who: JSON.stringify({ initials: '', date: todayISO(), sample: false }) })));

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
