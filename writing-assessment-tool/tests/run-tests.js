#!/usr/bin/env node
//
// Writing Assessment — regression tests.
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
//     cd ~/Documents/GitHub/edtech-portfolio/writing-assessment-tool/tests
//     npm test
//
// It opens a real Google Chrome in the background, drives the tool with real
// clicks and real typing, and prints a line per check.
//
// It needs NOTHING on the internet. The jsPDF script the tool loads from a CDN
// is blocked for the whole run, because "the school firewall ate it" is one of
// the things being tested, and because a suite whose result depends on the wifi
// teaches you to ignore red. Where a working PDF maker is needed, a stand-in is
// put on the page that records what would have been drawn.
//
// WHAT YOU SHOULD SEE
// -------------------
// Green PASS lines and, at the end, "ALL n CHECKS PASSED". A red FAIL line says
// what was expected and what actually happened, and the script exits non-zero.
//
// node_modules is a SYMLINK to ../../running-record-tool/tests/node_modules —
// nothing is installed here.
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
// Coverage. Chrome throws its record away on every navigation and this suite
// reloads dozens of times, so the record is harvested before each one.
// ---------------------------------------------------------------------------
const covRuns = [];
let COVERAGE = false;
async function harvest(page){
  if (!COVERAGE) return;
  try {
    covRuns.push(...await page.coverage.stopJSCoverage());
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
  } catch (e) { /* not running yet */ }
}

// ---------------------------------------------------------------------------
// Helpers for driving the page
// ---------------------------------------------------------------------------
// `load`, not `domcontentloaded`: a stylesheet still in flight when the first
// assertion ran used to land in the console-error list a fraction of the time,
// so the same suite passed or failed depending on timing.
//
// A genuinely cold arrival: nothing ever saved, nothing clicked. This is what a
// stranger opening the link for the first time sees, and it is the only honest
// place to check what is "on arrival".
async function coldArrival(page, base){
  await harvest(page);
  await page.goto('about:blank');
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await harvest(page);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

// An empty tool, ready for a teacher's own assessment. A cold arrival opens on
// the sample child, so getting to empty means pressing the button that clears
// her — which is exactly what a teacher starting their own assessment does.
async function fresh(page, base){
  await coldArrival(page, base);
  // Guarded, so a regression in WHAT ARRIVES fails the arrival checks instead
  // of garbling every other check in the file.
  if (await page.$eval('#sampleBtn', el => /Clear the sample/.test(el.textContent))){
    await page.click('#sampleBtn');
  }
}

async function reload(page){
  await harvest(page);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

// Type into a box the way a person does, replacing whatever is there.
async function retype(page, sel, text){
  await page.click(sel);
  await page.evaluate(s => document.querySelector(s).select(), sel);
  await page.keyboard.press('Backspace');
  if (text) await page.type(sel, text);
}

const scoreBtn = (row, n) =>
  `.skills-list .skill-item:nth-child(${row}) .skill-buttons button:nth-child(${n})`;
const LETTER = { e: 1, d: 2, m: 3, x: 4 };
const setScore = (page, row, band) => page.click(scoreBtn(row, LETTER[band]));

const msg      = page => page.$eval('#savedmsg', el => el.textContent);
const bannerOn = page => page.$eval('#sampleFlag', el => el.style.display === 'block');
const undoShown= page => page.$eval('#undoBtn', el => el.style.display !== 'none');
const modalOpen= page => page.$eval('#modal', el => el.style.display === 'block');
const record   = page => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('writingRecord') || 'null'); }
  catch (e){ return 'unreadable'; }
});
// The last CSV the tool handed the browser, decoded back into text.
const lastCSV  = page => page.evaluate(() => {
  const href = window.__downloads[window.__downloads.length - 1] || '';
  return decodeURIComponent(href.replace(/^data:text\/csv;charset=utf-8,/, ''));
});
const csvRows  = async page => {
  const text = await lastCSV(page);
  return text.replace(/^﻿/, '').split('\r\n');
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
  await page.setViewport({ width: 1280, height: 950 });

  COVERAGE = process.argv.includes('--coverage');
  if (COVERAGE) await page.coverage.startJSCoverage({ resetOnNavigation: false });

  // The CDN is blocked for the WHOLE run. See the note at the top.
  await page.setRequestInterception(true);
  page.on('request', r => {
    if (/cdnjs\.cloudflare\.com/.test(r.url())) return r.abort();
    r.continue();
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
    window.__printed = 0; window.__downloads = []; window.__confirms = 0;
    window.__confirmText = []; window.__confirmAnswer = true;
    window.print = () => { window.__printed++; };
    window.confirm = (t) => { window.__confirms++; window.__confirmText.push(String(t));
                              return window.__confirmAnswer; };
    window.alert = m => { window.__alert = String(m); };
    // Catch anchor-triggered CSV downloads instead of writing to disk.
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[download]');
      if (a){ e.preventDefault();
              window.__downloads.push(a.getAttribute('href') || '');
              window.__lastName = a.getAttribute('download') || ''; }
    }, true);

    // A stand-in for the PDF maker. It is NOT installed by default — the tool
    // has to cope with it missing, which is what a school firewall gives you.
    // installPDF() puts it on the page and records every line that would have
    // been drawn, and on which sheet of paper.
    window.installPDF = () => {
      window.__pdf = { lines: [], name: '', pages: 1 };
      function Doc(){
        this.size = 12;
        this.internal = { pageSize: { getHeight: () => 297, getWidth: () => 210 } };
      }
      Doc.prototype.setFontSize = function(n){ this.size = n; };
      Doc.prototype.splitTextToSize = function(text, width){
        const per = Math.max(10, Math.floor(width / (this.size * 0.42)));
        const out = [];
        String(text).split('\n').forEach(para => {
          let line = '';
          para.split(' ').forEach(w => {
            if (!line) { line = w; }
            else if ((line + ' ' + w).length <= per) { line += ' ' + w; }
            else { out.push(line); line = w; }
          });
          out.push(line);
        });
        return out;
      };
      Doc.prototype.text = function(t, x, y){
        (Array.isArray(t) ? t : [t]).forEach((line, i) => {
          window.__pdf.lines.push({ page: window.__pdf.pages, y: y + i * 5, text: String(line) });
        });
      };
      Doc.prototype.addPage = function(){ window.__pdf.pages++; };
      Doc.prototype.save = function(name){ window.__pdf.name = name; };
      window.jspdf = { jsPDF: Doc };
    };
  });

  // =========================================================================
  group('She is there on arrival, and she is unmistakably an example');
  // =========================================================================
  await coldArrival(page, base);

  check('a stranger opening the link sees a filled-in sheet, not an empty one',
        (await page.$eval('#initials', el => el.value)) === 'M.T.');
  check('the chart is drawn, not blank',
        (await page.$$eval('#pieChart path, #pieChart circle', els => els.length)) >= 4);
  check('the orange "this is an example" banner is showing', await bannerOn(page));
  check('the banner names her, so a printed sheet can never be filed as a real child',
        /Maya Torres/.test(await page.$eval('#sampleFlagText', el => el.textContent)));
  check('both comment boxes are filled in, so there is something to read',
        (await page.$eval('#strengths', el => el.value.length)) > 50 &&
        (await page.$eval('#stretches', el => el.value.length)) > 50);

  const bands = await page.evaluate(() => skills.map(s => scores[s.id]));
  check('her profile is mixed — she is good at some things and not others',
        new Set(bands).size >= 3, JSON.stringify(bands));

  // WHAT WAS WRONG: the one sentence telling a first-time visitor how to start
  // their own assessment named a button a thousand pixels below the fold, and
  // then deleted itself after ten seconds.
  const clearBtnTop = await page.$eval('#bannerClearBtn', el => el.getBoundingClientRect().top);
  check('the way to clear her is on the first screen, not a thousand pixels down the page',
        clearBtnTop > 0 && clearBtnTop < 900, 'top = ' + clearBtnTop);
  check('and pressing it is what clears her',
        await page.$eval('#bannerClearBtn', el => /Clear the sample/.test(el.textContent)));

  await page.click('#bannerClearBtn');
  check('one click clears her', !(await bannerOn(page)));
  eq('and the sheet is empty',
     await page.evaluate(() => ({
       initials: document.getElementById('initials').value,
       strengths: document.getElementById('strengths').value,
       scored: Object.keys(scores).length })),
     { initials: '', strengths: '', scored: 0 });

  await reload(page);
  check('she does not walk back in after a refresh once she has been sent away',
        !(await bannerOn(page)) && (await page.$eval('#initials', el => el.value)) === '');

  // =========================================================================
  group('Typing your own child over the sample takes the SAMPLE label off');
  // =========================================================================
  // THE WORST DEFECT THIS TOOL HAS HAD: the flag only ever came off through the
  // button that destroys the sheet, so a real assessment typed over the arrival
  // sample was permanently stamped "not a real child" — in the banner, in both
  // export filenames and inside the exported file.
  await coldArrival(page, base);
  await retype(page, '#initials', 'J.M.');
  check('the banner is still up while her words are still on the page', await bannerOn(page));
  // THIS CHECK WAS TESTING THE WRONG MOMENT. It used to look only for the words
  // "Part sample" and "strengths", and it looked for them straight after typing
  // in a text box — the one path that always redrew the banner. So it went on
  // passing for the whole time the COUNT in the same sentence was going stale
  // after a score was pressed. It now reads the number out loud, and the group
  // below drives the score path the old version never touched.
  eq('and it says WHICH parts of the sheet are still hers, counted correctly',
     await page.$eval('#sampleFlagText', el => el.textContent),
     'Part sample — some of this is still Maya Torres, the made-up example. ' +
     'Still hers: 7 of her scores, her strengths, her stretches.');

  await retype(page, '#strengths', 'J.M. writes a whole page without stopping and reads it back to himself.');
  await retype(page, '#stretches', 'Full stops still come and go. Next step is one sentence at a time.');
  check('still flagged while her scores are the only thing left of her', await bannerOn(page));
  for (let r = 1; r <= 7; r++) await setScore(page, r, 'e');

  check('once nothing of hers is left, the example label comes off', !(await bannerOn(page)));
  check('and the tool says so, rather than leaving the teacher to notice',
        /example label has come off/.test(await msg(page)));
  eq('the export filename is the teacher\'s own child, with no SAMPLE in it',
     await page.evaluate(() => fileStem()), 'writing-assessment-J.M.-' +
     (await page.evaluate(() => todayISO())));

  await page.evaluate(() => exportCSV());
  let rows = await csvRows(page);
  check('the spreadsheet says it is a classroom record, not "SAMPLE — not a real child"',
        /Classroom record/.test(rows[1]) && !/SAMPLE/.test(rows[1]), rows[1]);
  check('and the file is named for the real child',
        !/SAMPLE/.test(await page.evaluate(() => window.__lastName)));

  await reload(page);
  check('the label stays off after a refresh', !(await bannerOn(page)));

  // The escape routes the audit tried, which all used to bring the flag back.
  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.evaluate(() => clearAll());
  await page.click('#undoBtn');
  check('clearing and undoing does not stamp the real record SAMPLE again',
        !(await bannerOn(page)) &&
        !/SAMPLE/.test(await page.evaluate(() => fileStem())));

  // =========================================================================
  group('The "still hers" count is the count right now, on screen and on paper');
  // =========================================================================
  // WHAT WAS WRONG: afterEdit() — the one place every score press and every
  // little x ends up — redrew the rows, the chart, the panel and the print
  // header, and did not redraw the banner. Only typing in a text box did that.
  // So on the most ordinary flow there is (land on Maya, type your own child
  // over her initials, start scoring) the banner kept the count from before any
  // scoring: "Still hers: 7 of her scores" with three of them left. It is the
  // one sentence a teacher reads to learn which parts of this sheet are made
  // up, and it printed that wrong number onto the paper too.
  const banner = () => page.$eval('#sampleFlagText', el => el.textContent);
  const liveN  = () => page.evaluate(() => liveSampleScoreKeys().length);

  await coldArrival(page, base);
  await retype(page, '#initials', 'J.M.');
  for (let r = 1; r <= 4; r++) await setScore(page, r, 'e');

  eq('after scoring four rows the banner counts the three still hers, not seven',
     await banner(),
     'Part sample — some of this is still Maya Torres, the made-up example. ' +
     'Still hers: 3 of her scores, her strengths, her stretches.');
  check('and the number on the banner is the number the tool actually holds',
        (await banner()).indexOf((await liveN()) + ' of her scores') > -1,
        `banner says "${await banner()}", tool holds ${await liveN()}`);

  await page.emulateMediaType('print');
  eq('and the paper copy carries that same live count, not the stale one',
     await banner(),
     'Part sample — some of this is still Maya Torres, the made-up example. ' +
     'Still hers: 3 of her scores, her strengths, her stretches.');
  check('on a sheet that is part sample, that sentence really is printed',
        await page.$eval('#sampleFlag', el => getComputedStyle(el).display !== 'none'));
  await page.emulateMediaType(null);

  // One left reads as English, not as "1 of her scores".
  for (let r = 5; r <= 6; r++) await setScore(page, r, 'd');
  check('down to the last one it says "one of her scores"',
        /Still hers: one of her scores, her strengths, her stretches\.$/.test(await banner()),
        await banner());

  await setScore(page, 7, 'm');
  check('and once every row is the teacher\'s the scores drop out of the sentence',
        /Still hers: her strengths, her stretches\.$/.test(await banner()), await banner());
  check('while the banner itself stays up, because her two comment boxes are still there',
        await bannerOn(page));

  // The little x runs through the same function and used to go just as stale.
  await coldArrival(page, base);
  await retype(page, '#initials', 'J.M.');
  await page.click(scoreBtn(1, LETTER.x));
  eq('clearing one of her scores with the x drops it out of the count straight away',
     await banner(),
     'Part sample — some of this is still Maya Torres, the made-up example. ' +
     'Still hers: 6 of her scores, her strengths, her stretches.');

  // =========================================================================
  group('The way back is never quietly spent');
  // =========================================================================
  // After a Clear the teacher's whole assessment exists only inside the Undo.
  await fresh(page, base);
  await retype(page, '#initials', 'S.S.');
  await retype(page, '#strengths', 'TWENTY MINUTES OF REAL OBSERVATION');
  await setScore(page, 1, 'd'); await setScore(page, 2, 'd');
  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.evaluate(() => clearAll());
  check('Clear offers a way back', await undoShown(page));

  await setScore(page, 3, 'm');
  check('one click on a score afterwards does NOT silently destroy that way back',
        await undoShown(page));
  await page.type('#stretches', 'x');
  check('and neither does one character typed in a comment box', await undoShown(page));
  await page.click('#undoBtn');
  eq('and the cleared assessment is still there to be brought back',
     await page.$eval('#initials', el => el.value), 'S.S.');

  // The sample button used to eat the Undo with no question asked at all.
  await fresh(page, base);
  await retype(page, '#initials', 'S.S.');
  await retype(page, '#strengths', 'TWENTY MINUTES OF REAL OBSERVATION');
  await setScore(page, 1, 'd'); await setScore(page, 2, 'd');
  await page.evaluate(() => { window.__confirmAnswer = true; clearAll(); });
  await page.evaluate(() => toggleSample());
  check('pressing "Try it with a sample student" does not eat the cleared assessment',
        await undoShown(page));
  check('and the tool says the assessment is still one press away',
        /still one press/.test(await msg(page)), await msg(page));

  // Clear-while-the-sample-is-loaded used to overwrite the owed Undo with Maya.
  await page.evaluate(() => clearAll());
  await page.click('#undoBtn');
  const back = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    strengths: document.getElementById('strengths').value }));
  check('clearing the loaded sample brings back the TEACHER\'s assessment, not Maya',
        back.initials === 'S.S.' && /TWENTY MINUTES/.test(back.strengths),
        JSON.stringify(back));

  // WHAT WAS WRONG: this was the one clear path that never mentioned Undo, so a
  // teacher whose assessment was being held one click away was told the tool
  // was simply "empty and ready".
  await fresh(page, base);
  await retype(page, '#initials', 'K.L.');
  await setScore(page, 1, 'e');
  await page.evaluate(() => { window.__confirmAnswer = true; clearAll(); toggleSample(); });
  await page.evaluate(() => toggleSample());          // clear the untouched sample
  check('clearing an untouched sample says the held assessment is still one press away',
        /one press of/.test(await msg(page)), await msg(page));

  // WHAT WAS WRONG: the bottom row was one centred flexbox, so the moment Undo
  // appeared or disappeared every button slid about 65px sideways — putting
  // "Clear this assessment" exactly where the pointer had just pressed "Undo
  // clear". A second click in the same spot fired the destructive one.
  await fresh(page, base);
  const clearX = () => page.$$eval('.button-group .btn', els => {
    const b = els.find(e => /Clear this assessment/.test(e.textContent));
    return Math.round(b.getBoundingClientRect().x);
  });
  const xEmpty = await clearX();
  await retype(page, '#initials', 'V.V.');
  await page.evaluate(() => { window.__confirmAnswer = true; clearAll(); });
  const xWithUndo = await clearX();
  await page.click('#undoBtn');
  const xAfter = await clearX();
  check('the Clear button never slides under the pointer when Undo comes and goes',
        xEmpty === xWithUndo && xWithUndo === xAfter,
        `${xEmpty} -> ${xWithUndo} -> ${xAfter}`);

  // WHAT WAS WRONG: the Undo button was hidden while the keyboard was still on
  // it, leaving focus on an invisible control so the next Tab jumped back to
  // the top of the page.
  await fresh(page, base);
  await retype(page, '#initials', 'U.U.');
  await page.evaluate(() => { window.__confirmAnswer = true; clearAll(); });
  await page.$eval('#undoBtn', el => el.focus());
  await page.click('#undoBtn');
  await page.$eval('#undoBtn', el => el.focus());     // pressing it hid it again
  check('the keyboard is never left sitting on a button that has just been hidden',
        await page.evaluate(() =>
          document.activeElement.id !== 'undoBtn' ||
          getComputedStyle(document.activeElement).display !== 'none'));

  // Undo standing over live work has to ask.
  await fresh(page, base);
  await retype(page, '#initials', 'A.B.');
  await setScore(page, 1, 'e');
  await page.evaluate(() => clearAll());
  await retype(page, '#initials', 'C.D.');
  await setScore(page, 2, 'm');
  let before = await page.evaluate(() => window.__confirms);
  await page.evaluate(() => { window.__confirmAnswer = false; });
  await page.click('#undoBtn');
  check('pressing Undo over work you have since done asks before replacing it',
        (await page.evaluate(() => window.__confirms)) === before + 1);
  eq('and answering no changes nothing',
     await page.$eval('#initials', el => el.value), 'C.D.');
  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#undoBtn');
  eq('answering yes puts the earlier assessment back',
     await page.$eval('#initials', el => el.value), 'A.B.');
  check('and what it replaced is itself offered back, so nothing is ever a dead end',
        await undoShown(page) &&
        /put back what was on screen/.test(await page.$eval('#undoBtn', el => el.textContent)));
  await page.click('#undoBtn');
  eq('one more press really does bring it back',
     await page.$eval('#initials', el => el.value), 'C.D.');

  // =========================================================================
  group('The chart');
  // =========================================================================
  await fresh(page, base);
  for (let r = 1; r <= 7; r++) await setScore(page, r, 'm');
  const allSame = await page.evaluate(() => {
    const svg = document.getElementById('pieChart');
    const green = Array.from(svg.querySelectorAll('[fill="#639922"]'));
    return { green: green.length,
             shape: green.length ? green[0].tagName.toLowerCase() : '',
             r: green.length ? green[0].getAttribute('r') : '' };
  });
  check('the chart still draws when every skill is the same level',
        allSame.green === 1 && allSame.shape === 'circle' && allSame.r === '80',
        JSON.stringify(allSame));
  eq('and the legend agrees with it',
     await page.$eval('#numMastered', el => el.textContent), '7');

  // WHAT WAS WRONG: the grey "not yet assessed" ring was drawn only while
  // nothing was scored, so from the first tap to the seventh the chart was a
  // broken-looking fragment beside a note saying "1 of 7 skills scored".
  await fresh(page, base);
  await setScore(page, 1, 'e');
  check('after the very first score the chart is still a whole circle, not a fragment',
        await page.evaluate(() => !!document.querySelector('#pieChart circle[fill="#E0DCD4"]')));
  eq('and the note beside it counts honestly',
     await page.$eval('#chartNote', el => el.textContent), '1 of 7 skills scored');

  await fresh(page, base);
  eq('an empty sheet does not show a hand cursor over a ring that is not a control',
     await page.$eval('#pieChart circle', el => getComputedStyle(el).cursor), 'default');

  // =========================================================================
  group('Scores, and taking one back');
  // =========================================================================
  await fresh(page, base);
  await setScore(page, 1, 'e');
  eq('a score is recorded', await page.evaluate(() => scores[0]), 'e');
  await page.click(scoreBtn(1, 4));
  check('a mis-clicked score can be cleared without wiping the form',
        await page.evaluate(() => scores[0] === undefined));

  // WHAT WAS WRONG: the × only appeared once a row was scored, which shoved
  // E, D and M 35px to the left — so a second tap in the same PLACE landed on
  // the next letter and the tool silently recorded a band higher.
  await fresh(page, base);
  const spot = await page.$eval(scoreBtn(1, 1), el => {
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.mouse.click(spot.x, spot.y);
  await page.mouse.click(spot.x, spot.y);
  check('tapping the same PLACE twice clears the score instead of recording one band higher',
        await page.evaluate(() => scores[0] === undefined),
        'row 1 came out as ' + await page.evaluate(() => String(scores[0])));

  await page.mouse.click(spot.x, spot.y);
  const xSpot = await page.$eval(scoreBtn(1, 4), el => {
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.mouse.click(xSpot.x, xSpot.y);
  await page.mouse.click(xSpot.x, xSpot.y);
  check('and tapping where the × was, once it has gone, does not record Mastered',
        await page.evaluate(() => scores[0] === undefined),
        'row 1 came out as ' + await page.evaluate(() => String(scores[0])));

  check('the page spells out what E, D and M stand for',
        /Emerging/.test(await page.$eval('.skill-key', el => el.textContent)) &&
        /Developing/.test(await page.$eval('.skill-key', el => el.textContent)) &&
        /Mastered/.test(await page.$eval('.skill-key', el => el.textContent)));
  eq('and each button says its whole word out loud, with the skill it belongs to',
     await page.$eval(scoreBtn(2, 1), el => el.getAttribute('aria-label')),
     'Emerging — Prints using upper and lower case letters');
  await setScore(page, 2, 'e');
  eq('a chosen button says it is the chosen one',
     await page.$eval(scoreBtn(2, 1), el => el.getAttribute('aria-pressed')), 'true');
  eq('and its neighbours say they are not',
     await page.$eval(scoreBtn(2, 2), el => el.getAttribute('aria-pressed')), 'false');
  check('the line that reports saving and exporting is announced, not silent',
        await page.$eval('#savedmsg', el => el.getAttribute('role') === 'status' &&
                                            el.getAttribute('aria-live') === 'polite'));

  // =========================================================================
  group('Whose sheet is it, and when — on screen, in the file, in the filename');
  // =========================================================================
  await fresh(page, base);
  eq('the child is identified by initials only, four characters, never a name',
     await page.$eval('#initials', el => [el.maxLength, el.type]), [4, 'text']);
  check('and the page says the record stays on this laptop',
        /Stays on this laptop/.test(await page.$eval('.privacy', el => el.textContent)));

  await retype(page, '#initials', 'R.K.');
  await page.evaluate(() => { document.getElementById('wdate').value = '2026-03-04';
                              document.getElementById('wdate').dispatchEvent(new Event('input')); });
  await setScore(page, 1, 'm'); await setScore(page, 2, 'd');
  await retype(page, '#strengths', 'Writes at length, "with feeling", and re-reads it.');
  await retype(page, '#stretches', 'Line one\nLine two, with a comma');
  await page.evaluate(() => exportCSV());
  rows = await csvRows(page);
  const name1 = await page.evaluate(() => window.__lastName);
  eq('the export filename carries the initials and the date', name1,
     'writing-assessment-R.K.-2026-03-04.csv');
  check('the spreadsheet\'s first two columns are the child and the date',
        rows[1].startsWith('R.K.,2026-03-04,'), rows[1].slice(0, 40));
  check('a comment typed seconds earlier is in the file, not the previous one',
        /with feeling/.test(rows.join('\n')));
  check('quotes and commas inside a comment survive',
        /"Writes at length, ""with feeling"", and re-reads it."/.test(rows.join('\n')));
  const rawCSV = await lastCSV(page);
  check('and a newline inside a comment does not break the file into extra rows',
        rows.length === 2 && /"Line one\nLine two, with a comma"/.test(rawCSV),
        'rows: ' + rows.length);
  const heads = await page.evaluate(() => skills.map(s => s.label));
  check('every skill has a column of its own, scored or not',
        heads.every(h => rawCSV.indexOf(h) !== -1),
        JSON.stringify(heads.filter(h => rawCSV.indexOf(h) === -1)));
  check('and so do the strengths and the stretches',
        /Strengths/.test(rows[0]) && /Stretches/.test(rows[0]));
  check('an unscored skill says so rather than coming out blank',
        /Not assessed/.test(rows[1]));

  // Two children, two files.
  await retype(page, '#initials', 'T.W.');
  await page.evaluate(() => exportCSV());
  check('a second child gives a different filename, not the same one again',
        (await page.evaluate(() => window.__lastName)) !== name1);

  // WHAT WAS WRONG: the Child box is styled uppercase, so "rk" looked like "RK"
  // on screen and was written "RK" in the file, but the FILENAME kept the raw
  // lower case — the same child, two spellings, on two different days.
  await retype(page, '#initials', 'rk');
  await page.evaluate(() => exportCSV());
  eq('lower-case initials give the same filename as upper-case ones',
     await page.evaluate(() => window.__lastName),
     'writing-assessment-RK-2026-03-04.csv');

  // =========================================================================
  group('A date the tool cannot use is not quietly swapped for today');
  // =========================================================================
  await fresh(page, base);
  await retype(page, '#initials', 'R.K.');
  await setScore(page, 1, 'm');
  await page.evaluate(() => { document.getElementById('wdate').value = '';
                              document.getElementById('wdate').dispatchEvent(new Event('input')); });
  await page.evaluate(() => { window.installPDF(); exportCSV(); exportPDF(); });
  rows = await csvRows(page);
  const pdf = await page.evaluate(() => window.__pdf);
  const dateLine = pdf.lines.find(l => /^Date:/.test(l.text)) || { text: '' };
  check('with the date box empty, the spreadsheet, the PDF and both filenames agree',
        rows[1].split(',')[1] === '' &&
        /no date/.test(dateLine.text) &&
        /no-date/.test(pdf.name),
        JSON.stringify({ csv: rows[1].split(',')[1], pdf: dateLine.text, name: pdf.name }));
  await reload(page);
  eq('and an emptied date box is still empty after a refresh, not today',
     await page.$eval('#wdate', el => el.value), '');

  // WHAT WAS WRONG: with the date blanked, Undo in the same session put back a
  // blank date while the same Undo after a refresh put back today — one button
  // with two different answers.
  await page.evaluate(() => { window.__confirmAnswer = true; clearAll(); });
  await reload(page);
  await page.click('#undoBtn');
  eq('Undo after a refresh puts back the same blank date it puts back before one',
     await page.$eval('#wdate', el => el.value), '');

  // A year with one digit too many — one extra keypress in Chrome's year box.
  await page.evaluate(() => { document.getElementById('wdate').value = '20261-03-04';
                              document.getElementById('wdate').dispatchEvent(new Event('input')); });
  check('a five-digit year is called out in plain words',
        /too many digits/.test(await msg(page)), await msg(page));
  await page.evaluate(() => exportCSV());
  rows = await csvRows(page);
  check('and it does not end up in the spreadsheet or the filename',
        !/20261/.test(rows.join('\n')) &&
        !/20261/.test(await page.evaluate(() => window.__lastName)));

  // A date the teacher set is work, and clearing it is not free.
  await fresh(page, base);
  await page.evaluate(() => { document.getElementById('wdate').value = '2026-01-09';
                              document.getElementById('wdate').dispatchEvent(new Event('input')); });
  before = await page.evaluate(() => window.__confirms);
  await page.evaluate(() => { window.__confirmAnswer = true; clearAll(); });
  check('a date the teacher set counts as work, so Clear asks before throwing it away',
        (await page.evaluate(() => window.__confirms)) === before + 1 &&
        !/nothing to clear/.test(await msg(page)));
  check('and it can be brought back', await undoShown(page));
  await page.click('#undoBtn');
  eq('the date really does come back',
     await page.$eval('#wdate', el => el.value), '2026-01-09');

  // The same for the sample button, which used to overwrite it with today.
  await fresh(page, base);
  await page.evaluate(() => { document.getElementById('wdate').value = '2026-01-09';
                              document.getElementById('wdate').dispatchEvent(new Event('input')); });
  before = await page.evaluate(() => window.__confirms);
  await page.evaluate(() => { window.__confirmAnswer = false; toggleSample(); });
  check('loading the sample over a date the teacher set asks first too',
        (await page.evaluate(() => window.__confirms)) === before + 1);
  eq('and cancelling leaves the date alone',
     await page.$eval('#wdate', el => el.value), '2026-01-09');

  // =========================================================================
  group('Exporting as a PDF');
  // =========================================================================
  // The CDN is blocked for this whole run — a school firewall, or a plane.
  await fresh(page, base);
  await retype(page, '#initials', 'P.Q.');
  await page.evaluate(() => exportPDF());
  const blocked = await msg(page);
  check('a blocked PDF maker says what happened in plain words',
        /did not load/.test(blocked), blocked);
  check('and says what still works instead of leaving a dead button',
        /Print/.test(blocked) && /CSV/.test(blocked));
  check('never the word "Error"', !/Error/.test(blocked));

  // WHAT WAS WRONG: with long comments the "Writing Skills Assessment:" heading
  // and the first of the seven skills were drawn below the bottom edge of page
  // one, where jsPDF simply does not draw them — the export lost a skill while
  // the screen, the CSV and the printed sheet all still showed seven.
  await fresh(page, base);
  const LONG = ('This child sat down and wrote for the whole period without once ' +
                'asking what to write about, which is new. ').repeat(12);
  await retype(page, '#initials', 'L.C.');
  await page.evaluate(t => {
    document.getElementById('strengths').value = t;
    document.getElementById('strengths').dispatchEvent(new Event('input'));
    document.getElementById('stretches').value = t;
    document.getElementById('stretches').dispatchEvent(new Event('input'));
  }, LONG);
  for (let r = 1; r <= 7; r++) await setScore(page, r, 'd');
  const long = await page.evaluate(() => { window.installPDF(); exportPDF(); return window.__pdf; });
  const labels = await page.evaluate(() => skills.map(s => s.label));
  const missing = labels.filter(l => !long.lines.some(ln => ln.text.indexOf(l.slice(0, 25)) === 0));
  check('all seven skills are in the exported PDF even after two long comments',
        missing.length === 0, 'missing: ' + JSON.stringify(missing));
  check('and nothing is drawn off the bottom edge of the paper',
        long.lines.every(l => l.y <= 279), JSON.stringify(long.lines.filter(l => l.y > 279).slice(0, 2)));
  check('it used more than one sheet rather than losing what would not fit',
        long.pages > 1, 'pages = ' + long.pages);

  // WHAT WAS WRONG: one character the built-in PDF font does not know turned
  // that whole line into spaced-out gibberish, while the screen, the printed
  // page and the CSV all carried the sentence perfectly.
  await fresh(page, base);
  await retype(page, '#initials', 'E.M.');
  await page.evaluate(() => {
    document.getElementById('strengths').value = 'Next step → one sentence at a time ✓ 🎉';
    document.getElementById('strengths').dispatchEvent(new Event('input'));
  });
  const emoji = await page.evaluate(() => { window.installPDF(); exportPDF(); return window.__pdf; });
  const arrowLine = emoji.lines.map(l => l.text).join(' ');
  check('an arrow, a tick or an emoji in a comment does not garble the PDF line',
        /Next step -> one sentence at a time yes \?/.test(arrowLine), arrowLine.slice(0, 160));
  check('and every character the PDF is asked to draw is one it can draw',
        emoji.lines.every(l => !/[^\x00-\xFF]/.test(l.text)));

  // The two files must spell the same value the same way.
  await fresh(page, base);
  await setScore(page, 1, 'm');
  await page.evaluate(() => { window.installPDF(); exportCSV(); exportPDF(); });
  const both = await page.evaluate(() => window.__pdf);
  rows = await csvRows(page);
  check('the PDF and the spreadsheet spell "Not assessed" the same way',
        both.lines.some(l => /Not assessed$/.test(l.text)) &&
        /Not assessed/.test(rows[1]) &&
        !both.lines.some(l => /Not Assessed/.test(l.text)),
        JSON.stringify(both.lines.slice(-3)));
  check('the PDF carries the child and the date, so a printed sheet can be filed',
        both.lines.some(l => /^Child:/.test(l.text)) &&
        both.lines.some(l => /^Date:/.test(l.text)));

  // A PDF maker that loaded but then fell over on this particular computer.
  await fresh(page, base);
  await setScore(page, 1, 'e');
  await page.evaluate(() => {
    window.jspdf = { jsPDF: function(){ throw new Error('something went wrong inside'); } };
    exportPDF();
  });
  const brokeMsg = await msg(page);
  check('a PDF maker that falls over says so and points at what still works',
        /did not get made/.test(brokeMsg) && /Print/.test(brokeMsg) && /CSV/.test(brokeMsg),
        brokeMsg);
  check('and never shows the teacher a raw error', !/Error/.test(brokeMsg));

  // The sample has to say so on paper too.
  await coldArrival(page, base);
  const samplePdf = await page.evaluate(() => { window.installPDF(); exportPDF(); return window.__pdf; });
  check('a PDF of the sample child says on the page that it is not a real child',
        samplePdf.lines.some(l => /not a real child/.test(l.text)) &&
        /SAMPLE/.test(samplePdf.name));

  // =========================================================================
  group('Saving, and coming back to it');
  // =========================================================================
  await fresh(page, base);
  await retype(page, '#initials', 'N.O.');
  await setScore(page, 3, 'd');
  await page.type('#strengths', 'Typed and never clicked away from.');
  // NO blur, no click elsewhere — this is the defect: the last box a teacher
  // types in is the one they close the tab on.
  await reload(page);
  eq('a comment typed and never clicked away from survives a refresh',
     await page.$eval('#strengths', el => el.value), 'Typed and never clicked away from.');
  eq('and so do the scores', await page.evaluate(() => scores[2]), 'd');
  eq('and so do the initials',
     await page.$eval('#initials', el => el.value), 'N.O.');

  // Undo has to survive a refresh too, or the promise it makes is a lie.
  await page.evaluate(() => { window.__confirmAnswer = true; clearAll(); });
  await reload(page);
  check('after a refresh the way back is still offered', await undoShown(page));
  await page.click('#undoBtn');
  eq('and it really does bring the assessment back',
     await page.$eval('#initials', el => el.value), 'N.O.');

  // A browser that refuses to remember anything.
  await fresh(page, base);
  await page.evaluate(() => {
    Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); };
  });
  await retype(page, '#initials', 'Q.Q.');
  check('a browser that refuses to save says so, loudly and in plain words',
        /NOT BEING SAVED/.test(await msg(page)), await msg(page));
  check('and it never says "Error"', !/Error:/.test(await msg(page)));

  // WHAT WAS WRONG: Clear said "Assessment cleared" over the top of a browser
  // that had refused the write, so the record was still there and a reload
  // brought the child straight back with the Undo button gone.
  await fresh(page, base);
  await retype(page, '#initials', 'T.W.');
  await setScore(page, 1, 'm');
  await page.evaluate(() => {
    Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); };
    window.__confirmAnswer = true;
    clearAll();
  });
  const clearedMsg = await msg(page);
  check('a Clear the browser refused does not claim the assessment was cleared',
        !/^Assessment cleared/.test(clearedMsg) && /still there/.test(clearedMsg), clearedMsg);
  await reload(page);
  eq('and the record that came back is honestly reported, not a surprise',
     await page.$eval('#initials', el => el.value), 'T.W.');

  // One key, one write — a refusal part way through cannot mix two sheets.
  await fresh(page, base);
  await retype(page, '#initials', 'M.M.');
  await setScore(page, 1, 'e');
  await page.type('#strengths', 'Both halves of this belong together.');
  const rec = await record(page);
  check('the whole sheet is saved as one thing, so a half-written save is impossible',
        rec && rec.initials === 'M.M.' && rec.scores['0'] === 'e' &&
        /Both halves/.test(rec.comments.strengths), JSON.stringify(rec && Object.keys(rec)));
  eq('and the old three separate keys are gone',
     await page.evaluate(() => [localStorage.getItem('writingScores'),
                                localStorage.getItem('writingComments'),
                                localStorage.getItem('writingWho')]),
     [null, null, null]);

  // An assessment saved by the older version of the tool is not lost.
  await coldArrival(page, base);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('writingScores', JSON.stringify({ 0: 'm', 1: 'e' }));
    localStorage.setItem('writingComments', JSON.stringify({ strengths: 'Saved by the old version.', stretches: '' }));
    localStorage.setItem('writingWho', JSON.stringify({ initials: 'O.V.', date: '2026-02-02', sample: false, sampleCleared: true }));
  });
  await reload(page);
  eq('an assessment saved by the older version of this tool still opens',
     await page.evaluate(() => ({ i: document.getElementById('initials').value,
                                  d: document.getElementById('wdate').value,
                                  s: scores[0], c: comments.strengths })),
     { i: 'O.V.', d: '2026-02-02', s: 'm', c: 'Saved by the old version.' });

  // WHAT WAS WRONG: if the saved header was damaged while the scores and the
  // comments survived, Maya's made-up data stayed on the page with every
  // "sample" marking stripped off it, and went out as a classroom record.
  await coldArrival(page, base);
  await page.evaluate(() => {
    const r = JSON.parse(localStorage.getItem('writingRecord'));
    delete r.sample; delete r.sampleScoreKeys; r.initials = '';
    localStorage.setItem('writingRecord', JSON.stringify(r));
  });
  await reload(page);
  check('a damaged saved record cannot strip the sample label off Maya\'s own words',
        await bannerOn(page));
  check('and her sheet still exports as a sample',
        /SAMPLE/.test(await page.evaluate(() => fileStem())));

  // Rubbish in storage must not stop the tool opening at all.
  await coldArrival(page, base);
  await page.evaluate(() => localStorage.setItem('writingRecord', '{not json at all'));
  await reload(page);
  check('a damaged saved record still opens a usable tool rather than a dead page',
        (await page.$$eval('.skill-item', els => els.length)) === 7);

  // A browser that will not let the tool read anything back at all — Safari's
  // private window is the everyday one. Done in a tab of its own and then
  // thrown away, so the crippled storage cannot leak into anything below.
  const lockedTab = await browser.newPage();
  await lockedTab.setRequestInterception(true);
  lockedTab.on('request', r => { if (/cdnjs/.test(r.url())) return r.abort(); r.continue(); });
  await lockedTab.evaluateOnNewDocument(() => {
    Storage.prototype.getItem = function(){ throw new Error('SecurityError'); };
  });
  if (COVERAGE) await lockedTab.coverage.startJSCoverage({ resetOnNavigation: false });
  await lockedTab.goto(base + '/index.html', { waitUntil: 'load' });
  check('a browser that refuses to remember still opens a usable tool',
        (await lockedTab.$$eval('.skill-item', els => els.length)) === 7);
  check('and says so, rather than looking as if the work simply vanished',
        /will not let the tool remember/.test(await msg(lockedTab)), await msg(lockedTab));
  await lockedTab.click(scoreBtn(1, 1));
  eq('and scoring still works in it', await lockedTab.evaluate(() => scores[0]), 'e');
  if (COVERAGE) covRuns.push(...await lockedTab.coverage.stopJSCoverage());
  await lockedTab.close();

  // =========================================================================
  group('Loading and clearing the sample over work that is already there');
  // =========================================================================
  // WHAT WAS WRONG, AND IT WAS THE WORST BUTTON ON THE PAGE: this is the
  // friendliest-looking button in the row, and one click dropped Maya straight
  // over a real assessment with no question asked and no way back — while the
  // frightening-looking "Clear this assessment" asked first AND offered one.
  await fresh(page, base);
  await retype(page, '#initials', 'B.B.');
  await retype(page, '#strengths', 'A REAL ASSESSMENT THAT WAS ALREADY HERE');
  await setScore(page, 4, 'm');
  await page.evaluate(() => { window.__confirms = 0; window.__confirmText = [];
                              window.__confirmAnswer = false; toggleSample(); });
  check('loading the sample over a real assessment asks first',
        (await page.evaluate(() => window.__confirms)) === 1);
  check('and the question says the assessment on screen would be written over',
        /straight over what is on this page/.test(
          await page.evaluate(() => window.__confirmText[0] || '')));
  eq('answering no leaves the real assessment alone',
     await page.$eval('#initials', el => el.value), 'B.B.');

  await page.evaluate(() => { window.__confirmAnswer = true; toggleSample(); });
  eq('answering yes loads Maya', await page.$eval('#initials', el => el.value), 'M.T.');
  check('and offers the real assessment straight back', await undoShown(page));
  check('with a button that says what it will do',
        /put my assessment back/.test(await page.$eval('#undoBtn', el => el.textContent)));

  // Clearing a sample that has been typed over is the teacher's own writing
  // going, so that path asks too.
  await retype(page, '#strengths', 'Typed over Maya, and worth keeping.');
  await page.evaluate(() => { window.__confirms = 0; window.__confirmAnswer = false;
                              window.__confirmText = []; toggleSample(); });
  check('clearing a sample somebody has typed over asks first as well',
        (await page.evaluate(() => window.__confirms)) === 1 &&
        /What has been typed in over Maya goes/.test(
          await page.evaluate(() => window.__confirmText[0] || '')));
  await page.evaluate(() => { window.__confirmAnswer = true; toggleSample(); });
  check('and answering yes still leaves a way back',
        await undoShown(page) && /Press Undo/.test(await msg(page)));
  await page.click('#undoBtn');
  eq('which really does bring the typed-over sheet back',
     await page.$eval('#strengths', el => el.value), 'Typed over Maya, and worth keeping.');

  // =========================================================================
  group('Clearing');
  // =========================================================================
  await fresh(page, base);
  before = await page.evaluate(() => window.__confirms);
  await page.evaluate(() => clearAll());
  check('Clear on an empty sheet does not ask a pointless question',
        (await page.evaluate(() => window.__confirms)) === before &&
        /nothing to clear/.test(await msg(page)));

  await retype(page, '#initials', 'W.W.');
  await setScore(page, 1, 'e');
  await page.evaluate(() => { window.__confirmAnswer = false; window.__confirmText = []; clearAll(); });
  eq('Clear asks first and answering no changes nothing',
     await page.$eval('#initials', el => el.value), 'W.W.');
  const dialog = await page.evaluate(() => window.__confirmText[0] || '');
  check('the question says exactly what goes',
        /scores/.test(dialog) && /comment boxes/.test(dialog) && /initials/.test(dialog));
  check('and it says how to get it back',
        /Undo clear brings it straight back/.test(dialog));
  await page.evaluate(() => { window.__confirmAnswer = true; clearAll(); });
  check('after clearing, the screen tells the teacher how to get it back',
        /Undo clear/.test(await msg(page)));

  // WHAT WAS WRONG: when storage was near its cap the way back was silently
  // never written, while the tool showed the button and repeated the promise.
  await fresh(page, base);
  await retype(page, '#initials', 'Z.Z.');
  await setScore(page, 1, 'e');
  await page.evaluate(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v){
      if (k === 'writingUndo') throw new Error('QuotaExceededError');
      return real.call(this, k, v);
    };
    window.__confirmAnswer = true;
    clearAll();
  });
  check('when the way back could not be saved, the tool says so instead of promising it',
        /would not let the tool save the way back/.test(await msg(page)), await msg(page));

  // =========================================================================
  group('The panel that opens when you press a level');
  // =========================================================================
  await fresh(page, base);
  await setScore(page, 1, 'm'); await setScore(page, 2, 'm');
  await page.click('#countMastered');
  check('pressing a level opens the list of skills at that level', await modalOpen(page));
  eq('and it lists them', await page.$$eval('.modal-skill', els => els.length), 2);
  check('it announces itself as a dialog',
        await page.$eval('.modal-content', el => el.getAttribute('role') === 'dialog' &&
                                                 el.getAttribute('aria-modal') === 'true'));
  check('the keyboard is moved into it, not left behind on the page',
        await page.evaluate(() => document.querySelector('.modal-content')
                                           .contains(document.activeElement)));

  // WHAT WAS WRONG: Tab walked straight out onto the score buttons hidden under
  // the dark overlay, and Enter there changed a score nobody could see.
  const walkOut = [];
  for (let i = 0; i < 6; i++){
    await page.keyboard.press('Tab');
    walkOut.push(await page.evaluate(() =>
      document.querySelector('.modal-content').contains(document.activeElement)));
  }
  check('tabbing round and round stays inside the panel', walkOut.every(Boolean),
        JSON.stringify(walkOut));
  await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
  check('and tabbing backwards stays inside it too',
        await page.evaluate(() => document.querySelector('.modal-content')
                                           .contains(document.activeElement)));

  // WHAT WAS WRONG: the panel was drawn once and then left, so it went on
  // describing a record that had changed underneath it.
  await page.evaluate(() => setScore(2, 'm'));
  eq('scoring another skill updates the open panel instead of leaving it stale',
     await page.$$eval('.modal-skill', els => els.length), 3);
  await page.evaluate(() => { window.__confirmAnswer = true; clearAll(); });
  check('clearing the sheet closes the panel rather than leaving it describing a ghost',
        !(await modalOpen(page)));

  await page.click('#undoBtn');
  await page.click('#countMastered');
  await page.click('#modalCloseBtn');
  check('closing the panel puts the keyboard back where it came from',
        await page.evaluate(() => document.activeElement.id === 'countMastered'));

  await page.click('#countEmerging');
  check('a level nobody is on still opens and says so plainly',
        (await modalOpen(page)) &&
        /No skills are marked Emerging yet/.test(await page.$eval('#modalSkills', el => el.textContent)));
  await page.keyboard.press('Escape');
  check('Escape closes it', !(await modalOpen(page)));

  // The chart slices are the same control by another route.
  await fresh(page, base);
  await setScore(page, 1, 'm');
  await page.evaluate(() => document.querySelector('#pieChart [fill="#639922"]').focus());
  await page.keyboard.press('Enter');
  check('a chart slice opens the same list from the keyboard', await modalOpen(page));
  eq('and it is the right list',
     await page.$eval('#modalTitle', el => el.textContent), 'Mastered Skills');
  await page.keyboard.press('Escape');

  // =========================================================================
  group('Two tabs of the same tool');
  // =========================================================================
  // WHAT WAS WRONG: one keystroke in the older tab wrote its whole stale sheet
  // over everything the newer tab had saved, silently.
  await fresh(page, base);
  await retype(page, '#initials', 'F.T.');
  await setScore(page, 1, 'e');
  const tabB = await browser.newPage();
  await tabB.setRequestInterception(true);
  tabB.on('request', r => { if (/cdnjs/.test(r.url())) return r.abort(); r.continue(); });
  await tabB.goto(base + '/index.html', { waitUntil: 'load' });
  await tabB.evaluate(() => {
    document.getElementById('strengths').value = 'THE NEWER TAB WROTE THIS';
    document.getElementById('strengths').dispatchEvent(new Event('input'));
  });
  await page.waitForFunction(() => /another tab/i.test(document.getElementById('savedmsg').textContent),
                             { timeout: 4000 }).catch(() => {});
  check('the older tab notices the newer one and says so',
        /another tab/i.test(await msg(page)), await msg(page));
  await page.type('#stretches', 'typed in the older tab');
  const survived = await tabB.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('writingRecord')).comments.strengths; }
    catch (e){ return 'gone'; }
  });
  check('and typing in the older tab no longer wipes out the newer tab\'s work',
        /THE NEWER TAB WROTE THIS/.test(survived), survived);
  await tabB.close();

  // =========================================================================
  group('On paper');
  // =========================================================================
  await coldArrival(page, base);
  await page.emulateMediaType('print');

  // WHAT WAS WRONG: on Chrome's default print settings the orange sample banner
  // and the three coloured tiles lost their backgrounds and printed white text
  // as pale grey — the safeguard against a made-up sheet being filed as real
  // was the first thing to vanish on paper.
  const inkOnPaper = await page.evaluate(() => {
    const g = el => getComputedStyle(el);
    return { banner: g(document.getElementById('sampleFlag')).color,
             tile:   g(document.getElementById('countEmerging')).color };
  });
  check('the sample warning is dark ink on paper, not white text on nothing',
        inkOnPaper.banner !== 'rgb(255, 255, 255)', inkOnPaper.banner);
  check('and so are the three counts', inkOnPaper.tile !== 'rgb(255, 255, 255)', inkOnPaper.tile);

  // WHAT WAS WRONG: the second printed sheet — both narrative comment boxes,
  // the part most likely to be photocopied — had no initials, no date and no
  // sample warning anywhere on it.
  const sheet2 = await page.$eval('#sheetTwoId', el => el.textContent);
  check('the second printed sheet says which child and which date it belongs to',
        /M\.T\./.test(sheet2) && /\d{4}-\d{2}-\d{2}/.test(sheet2), sheet2);
  check('and, for the sample, that it is not a real child', /SAMPLE/.test(sheet2));

  await page.emulateMediaType(null);   // the sample button is not on paper
  await fresh(page, base);
  await page.emulateMediaType('print');
  // WHAT WAS WRONG: a blank sheet printed to be filled in by hand came out with
  // the placeholder "J.M." in the Child box, so it read as a record that already
  // belonged to a child — and the date box printed its calendar-picker glyph.
  const chrome = await page.evaluate(() => ({
    initialsBox: getComputedStyle(document.getElementById('initials')).display,
    dateBox: getComputedStyle(document.getElementById('wdate')).display,
    x: getComputedStyle(document.querySelector('.clear-score')).display,
    buttons: getComputedStyle(document.querySelector('.button-group')).display
  }));
  eq('a blank sheet printed to fill in by hand carries no fake initials and no date widget',
     chrome, { initialsBox: 'none', dateBox: 'none', x: 'none', buttons: 'none' });

  // WHAT WAS WRONG: with the two boxes gone from the paper, the plain-text
  // stand-ins that replaced them were not blank when the sheet was blank. The
  // Child space printed "—" and the Date space printed the words "no date" —
  // the tool answering, in ink, the question the paper was printed to ask. A
  // teacher who prints a sheet to fill in by hand wants a ruled line with its
  // label beside it, not a sentence sitting where the writing goes. (The labels
  // themselves used to be hidden on paper along with the boxes, which would
  // have left an unlabelled empty line — so they come back on paper too.)
  await page.evaluate(() => { const d = document.getElementById('wdate');
                              d.value = ''; d.dispatchEvent(new Event('input')); });
  const emptySheet = await page.evaluate(() => {
    const i = document.getElementById('initialsPrint'), d = document.getElementById('datePrint');
    const ri = i.getBoundingClientRect(), rd = d.getBoundingClientRect();
    return {
      childText: i.textContent,
      dateText: d.textContent,
      childRule: getComputedStyle(i).borderBottomStyle,
      dateRule: getComputedStyle(d).borderBottomStyle,
      childWide: ri.width >= 60 && ri.height > 0,
      dateWide: rd.width >= 60 && rd.height > 0,
      labels: document.querySelector('.who-row').innerText.replace(/\s+/g, ' ').trim()
    };
  });
  eq('a blank sheet prints a blank Child space, not the tool\'s own "—"',
     emptySheet.childText, '');
  eq('and a blank Date space, not the words "no date"', emptySheet.dateText, '');
  check('each blank space is a ruled line wide enough to write on',
        emptySheet.childRule === 'solid' && emptySheet.dateRule === 'solid' &&
        emptySheet.childWide && emptySheet.dateWide, JSON.stringify(emptySheet));
  check('with its label beside it, so the line says what to write on it',
        /CHILD/i.test(emptySheet.labels) && /DATE/i.test(emptySheet.labels), emptySheet.labels);
  check('and the line identifying the second sheet leaves the same spaces to fill in',
        await page.$eval('#sheetTwoId', el =>
          /Child: _+/.test(el.textContent) && /Date: _+/.test(el.textContent) &&
          !/no date/.test(el.textContent)),
        await page.$eval('#sheetTwoId', el => el.textContent));

  await page.evaluate(() => { document.getElementById('initials').value = 'H.J.';
                              document.getElementById('initials').dispatchEvent(new Event('input')); });
  eq('but a real sheet does print the initials, as plain text',
     await page.$eval('#initialsPrint', el => el.textContent), 'H.J.');
  // The ruled line is for an EMPTY space only — a filled one must not be
  // underlined as though it were still waiting to be written on.
  check('and a filled-in Child space is printed as text, with no line under it',
        await page.$eval('#initialsPrint', el => getComputedStyle(el).borderBottomStyle === 'none'));
  await page.evaluate(() => { const d = document.getElementById('wdate');
                              d.value = '2026-03-04'; d.dispatchEvent(new Event('input')); });
  eq('and a real date prints as the date, beside its label',
     await page.$eval('.who-row', el => el.innerText.replace(/\s+/g, ' ').trim()),
     'CHILD H.J. DATE 2026-03-04');

  // A long comment must reach the paper: a textarea only prints what fits in it.
  await page.evaluate(t => {
    document.getElementById('strengths').value = t;
    document.getElementById('strengths').dispatchEvent(new Event('input'));
  }, 'A'.repeat(1500));
  eq('a long comment is printed in full, not cut off at the bottom of its box',
     await page.$eval('#strengthsPrint', el => el.textContent.length), 1500);
  check('and the box itself is not printed on top of it',
        await page.$eval('#strengths', el => getComputedStyle(el).display === 'none'));
  await page.emulateMediaType(null);

  // =========================================================================
  group('On a phone and on an iPad');
  // =========================================================================
  for (const w of [320, 360, 390, 414, 768, 1024]){
    await page.setViewport({ width: w, height: 900 });
    await coldArrival(page, base);
    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`at ${w}px the page does not scroll sideways`, over <= 0, 'overflow ' + over + 'px');
  }

  // WHAT WAS WRONG: on the device this is built for — an iPad in portrait — the
  // E, D and M buttons were 30x28 and the × was 25x24.
  await page.setViewport({ width: 768, height: 1024, isMobile: true, hasTouch: true,
                           deviceScaleFactor: 2 });
  await coldArrival(page, base);
  const sizes = await page.evaluate(() => {
    const b = document.querySelector('.skills-list .skill-item .skill-buttons button');
    const x = document.querySelector('.skills-list .skill-item .clear-score');
    const r1 = b.getBoundingClientRect(), r2 = x.getBoundingClientRect();
    return { w: Math.round(r1.width), h: Math.round(r1.height),
             xw: Math.round(r2.width), xh: Math.round(r2.height) };
  });
  check('on a touch screen the score buttons are big enough for a finger',
        sizes.w >= 44 && sizes.h >= 44, JSON.stringify(sizes));
  check('and so is the × that clears a score',
        sizes.xw >= 44 && sizes.xh >= 44, JSON.stringify(sizes));

  // WHY THE SWEEP BELOW EXISTS: the two checks above name the four controls the
  // original bug was found on, and they went green while the REST of the page
  // was still too small for a finger — "Clear the sample student" in the orange
  // banner 32px tall, the five buttons along the bottom 40, Close on a pop-up
  // panel 32, the Child and Date boxes 34 and 36. A check that names the thing
  // it is checking can only ever find the bug you already knew about. This one
  // asks the page what is on it and measures every single control, so a NEW
  // control added tomorrow is measured on the day it appears without anybody
  // remembering to come back here.
  const tooSmall = () => page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('button, input, select, textarea, a[href]').forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;              // not laid out at all
      if (r.width >= 44 && r.height >= 44) return;
      bad.push(`${Math.round(r.width)}x${Math.round(r.height)} "${
        (el.textContent || el.value || el.placeholder || el.id).trim().replace(/\s+/g, ' ').slice(0, 30)}"`);
    });
    return bad;
  });

  let small = await tooSmall();
  check('EVERY control on the arrival screen is big enough for a finger, not just the score buttons',
        small.length === 0, small.join(' | '));

  // The three tiles open a panel, and its Close is a finger target too.
  await page.click('#countMastered');
  await page.evaluate(() => new Promise(r => setTimeout(r, 350)));
  small = await tooSmall();
  check('and every control inside the panel a count tile opens, including its Close',
        small.length === 0, small.join(' | '));
  await page.keyboard.press('Escape');
  await page.evaluate(() => new Promise(r => setTimeout(r, 350)));

  // Undo only exists after a clear, so it is never on screen for the sweep above.
  await page.evaluate(() => { window.__confirmAnswer = true; clearAll(); });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
  check('and Undo clear, which only appears after the assessment has been wiped',
        await undoShown(page));
  small = await tooSmall();
  check('is big enough for a finger too — it is the way back from a mistake',
        small.length === 0, small.join(' | '));

  // WHAT WAS WRONG WAITING TO HAPPEN: making everything 44px tall adds height to
  // a narrow screen, and the Child and Date boxes sit in one wrapping row. A
  // real phone is a coarse pointer AND 320px wide at the same time, but the
  // sideways-scroll loop above never switched touch on, so it was measuring the
  // desktop sizes on a phone-sized window.
  for (const w of [320, 360, 390, 414, 768]){
    await page.setViewport({ width: w, height: 900, isMobile: true, hasTouch: true });
    await coldArrival(page, base);
    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`at ${w}px with a finger-sized layout the page still does not scroll sideways`,
          over <= 0, 'overflow ' + over + 'px');
  }
  await page.setViewport({ width: 768, height: 1024, isMobile: true, hasTouch: true,
                           deviceScaleFactor: 2 });

  // WHAT WAS WRONG: when a status message expired the whole page jumped up to
  // 28px on a phone, and a tap already on its way to a score button landed on
  // nothing.
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await fresh(page, base);
  const yBefore = await page.$eval(scoreBtn(1, 1), el => el.getBoundingClientRect().top);
  await page.evaluate(() => say('Spreadsheet saved as writing-assessment-R.K.-2026-03-04.csv', 60000));
  const yDuring = await page.$eval(scoreBtn(1, 1), el => el.getBoundingClientRect().top);
  await page.evaluate(() => { document.getElementById('savedmsg').textContent = ''; });
  const yAfter = await page.$eval(scoreBtn(1, 1), el => el.getBoundingClientRect().top);
  check('a message appearing or going away does not move the score buttons under a finger',
        yBefore === yDuring && yDuring === yAfter,
        `${yBefore} -> ${yDuring} -> ${yAfter}`);
  await page.setViewport({ width: 1280, height: 950 });

  // =========================================================================
  group('Messages say what happened, and do not talk over each other');
  // =========================================================================
  await fresh(page, base);
  // WHAT WAS WRONG: showing the same sentence twice let the FIRST showing's
  // timer wipe the second one off the screen early.
  await page.evaluate(async () => {
    say('Same message twice', 400);
    await new Promise(r => setTimeout(r, 300));
    say('Same message twice', 3000);
    await new Promise(r => setTimeout(r, 300));
  });
  check('a message shown twice is not erased early by its own earlier showing',
        (await msg(page)) === 'Same message twice');
  await page.evaluate(() => new Promise(r => { say('Gone in a moment', 250); setTimeout(r, 700); }));
  eq('and a message does clear itself once its time really is up', await msg(page), '');

  // WHAT WAS WRONG: in a browser that refuses to save, the warning was
  // overwritten by a friendly message a millisecond later.
  await page.evaluate(() => {
    Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); };
    say('', 1);
  });
  await page.type('#stretches', 'a');
  await page.evaluate(() => say('Something cheerful and unimportant', 5000));
  check('a cheerful message cannot talk over the warning that nothing is being saved',
        /NOT BEING SAVED/.test(await msg(page)), await msg(page));

  // =========================================================================
  group('Odds and ends a visitor would still notice');
  // =========================================================================
  await coldArrival(page, base);
  check('the tab has an icon of its own',
        await page.evaluate(() => !!document.querySelector('link[rel="icon"]')));
  check('and a shared link has something to say about itself',
        await page.evaluate(() => {
          const d = document.querySelector('meta[name="description"]');
          return !!d && d.content.length > 40;
        }));
  // WHAT WAS WRONG: the optional PDF script was a plain <script> in the head,
  // so on a network that silently swallows the request — a school filter that
  // drops rather than refuses — the page was blank white for as long as the
  // request hung. It is blocked for this whole run, and the page is still here.
  check('the optional PDF script cannot hold up the page being drawn',
        await page.evaluate(() => {
          const s = document.querySelector('script[src*="jspdf"]');
          return !!s && (s.defer || s.async);
        }));
  check('and the tool is fully usable with it blocked',
        (await page.$$eval('.skill-item', els => els.length)) === 7);

  check('with JavaScript switched off the page explains itself instead of sitting there dead',
        await page.evaluate(() => {
          const n = document.querySelector('noscript');
          return !!n && /JavaScript/.test(n.textContent);
        }));

  // A visitor who has asked their system to stop things moving.
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await reload(page);
  await page.click('#countMastered');
  eq('a visitor who asked for less movement does not get a panel that slides at them',
     await page.$eval('.modal-content', el => getComputedStyle(el).animationName), 'none');
  await page.keyboard.press('Escape');
  await page.emulateMediaFeatures([]);

  // WHAT WAS WRONG: the Child box armed itself on mousedown and only disarmed
  // in its own mouseup, so a drag that ended outside left it armed forever —
  // and the next mouse-release over the box yanked focus in and the next
  // keystroke overwrote the initials instead of the words that were selected.
  await coldArrival(page, base);
  const boxRect = await page.$eval('#initials', el => {
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.mouse.move(boxRect.x, boxRect.y);
  await page.mouse.down();
  await page.mouse.move(boxRect.x + 400, boxRect.y + 300);
  await page.mouse.up();                       // released well outside the box
  await page.click('#strengths');
  await page.mouse.move(boxRect.x, boxRect.y);
  await page.mouse.down(); await page.mouse.up();
  await page.click('#stretches');
  await page.keyboard.type('Z');
  eq('a drag that started in the Child box cannot hijack a later click somewhere else',
     await page.$eval('#initials', el => el.value), 'M.T.');

  // =========================================================================
  check('no JavaScript errors happened anywhere in the whole run',
        pageErrors.length === 0, pageErrors.join(' | '));
  check('no console errors happened anywhere in the whole run',
        consoleErrors.length === 0, consoleErrors.join(' | '));

  // -------------------------------------------------------------------------
  // Coverage measures the tests that actually exist, so the two cannot drift
  // apart. Every line it lists as never executed is either given a check that
  // asserts on its result, or deleted because nothing can reach it.
  if (COVERAGE){
    covRuns.push(...await page.coverage.stopJSCoverage());
    // Every page load produces another record for the same script. Merge them
    // all, or a line exercised early in the run looks untested at the end.
    const merged = new Map();
    for (const e of covRuns){
      // Anything evaluated in the page also arrives under the page's own URL.
      // The tool itself is the only record big enough to be the tool.
      if (!/index\.html/.test(e.url) || e.text.length < 20000) continue;
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

        // Chrome may hand back the whole document or just the inline script
        // body. When the tag is there, measure only between the tags so the
        // HTML and CSS cannot flatter the number; the tool's own comments
        // mention "<script>", so take the LAST one.
        const tag = text.lastIndexOf('<script>');
        const open  = tag === -1 ? 0 : tag + '<script>'.length;
        const close = tag === -1 ? text.length : text.lastIndexOf('</script>');

        // When Chrome gives back only the script body its line 1 is not the
        // file's line 1, and reporting the wrong line sends somebody to the
        // wrong place — worse than saying nothing.
        let lineShift = 0;
        if (tag === -1){
          const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
          const at = html.lastIndexOf('<script>');
          if (at !== -1) lineShift = html.slice(0, at).split('\n').length - 1;
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
          const code = text.slice(from, to).trim();
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
          console.log(`  ${G}every executable line was run by a check${X}`);
        }
      }
    }
  }

  await browser.close();
  srv.close();

  console.log('');
  if (failures.length){
    console.log(`${R}${failures.length} CHECK(S) FAILED${X}  (${passed} passed)`);
    failures.forEach(f => console.log(`${R}  · ${f.name}${X}${f.detail ? DIM + ' — ' + f.detail + X : ''}`));
    process.exit(1);
  }
  console.log(`${G}ALL ${passed} CHECKS PASSED${X}`);
}

main().catch(e => { console.error(`${R}The test run itself crashed:${X}\n`, e); process.exit(2); });
