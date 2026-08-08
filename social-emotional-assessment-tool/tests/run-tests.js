#!/usr/bin/env node
//
// Social-Emotional Assessment — regression tests.
//
// WHAT THIS IS
// ------------
// "Regression" means sliding backward. Every check in this file exists because
// something was once actually broken here. The point is not to prove the tool
// works today — it is so that a bug fixed in August cannot quietly come back in
// November without anybody noticing.
//
// Each check is named for what a PERSON would notice, not for the function
// involved. If you fix a new bug, add its check here the same day.
//
// HOW TO RUN IT
// -------------
//     cd ~/Documents/GitHub/edtech-portfolio/social-emotional-assessment-tool/tests
//     npm test
//
// It opens a real Google Chrome in the background, drives the tool with real
// clicks and real keypresses, and prints a line per check. It needs nothing on
// the internet — the one CDN script the tool uses is deliberately blocked for
// the whole run, so the offline behaviour is what gets tested.
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
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', X = '\x1b[0m';
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
// Helpers for driving the page
// ---------------------------------------------------------------------------
// `load`, not `domcontentloaded`: a stylesheet or icon still in flight when the
// first assertion runs lands in the console-error list a fraction of the time,
// and a check that is right nine times out of ten teaches you to ignore red.
async function goFirstVisit(page, base){
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}
// A returning teacher: storage empty, but the tool has been used before, so the
// sample child does not reappear.
async function goEmpty(page, base){
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('seSeen','1'); });
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}
async function reload(page){
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

// The E/D/M buttons for skill `i`. The list is rebuilt after every click, so
// the nodes must be found again each time or the click lands on a detached one.
async function score(page, skillIndex, band){
  const col = { e:0, d:1, m:2 }[band];
  const handles = await page.$$('.score-btn');
  await handles[skillIndex * 3 + col].click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}
async function clearOneScore(page, skillIndex){
  const handles = await page.$$('.undo-score');
  await handles[skillIndex].click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}
// Click something that is only on the page when the tool is behaving. If the
// bug being guarded against comes back, the button is hidden and puppeteer's
// click throws, which stops the run dead and hides every later check. This
// clicks when it can and lets the checks report the failure instead.
async function clickIfShown(page, sel){
  const shown = await page.$eval(sel, el =>
    !el.hidden && getComputedStyle(el).display !== 'none' &&
    getComputedStyle(el).visibility !== 'hidden');
  if (!shown) return false;
  await page.click(sel);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
  return true;
}
const tiles = page => page.evaluate(() => ({
  e: +document.getElementById('numEmerging').textContent,
  d: +document.getElementById('numDeveloping').textContent,
  m: +document.getElementById('numMastered').textContent,
  x: +document.getElementById('numNone').textContent
}));
const message = page => page.$eval('#saymsg', el => el.textContent);

// What actually reaches the paper.
//
// This is the check that was missing, and it is why a printed sheet could stop
// mid-word for a month without anybody noticing. Chrome is put into print
// media — the same stylesheet the printer sees — and then, for each note, the
// LAST CHARACTER of the teacher's text is measured against the bottom of the
// box it is printed in. A textarea has its own scrollbox and prints only the
// slice of words that fits inside it, and paper has no scrollbar to show you
// the rest is missing. Counting characters, or trusting `height: auto`, would
// have missed it. Measuring where the last letter lands does not.
async function paper(page){
  await page.emulateMediaType('print');
  const out = await page.evaluate(() => {
    const one = id => {
      const box  = document.getElementById(id);
      const copy = document.getElementById(id + 'Print');
      const r    = copy.getBoundingClientRect();
      let lastCharInside = true;
      const tn = copy.firstChild;
      if (tn && tn.length){
        const range = document.createRange();
        range.setStart(tn, tn.length - 1);
        range.setEnd(tn, tn.length);
        const last = range.getBoundingClientRect();
        lastCharInside = last.bottom <= r.bottom + 0.5 && last.top >= r.top - 0.5;
      }
      return {
        onPaper: copy.textContent,
        onScreen: box.value,
        boxShown:  getComputedStyle(box).display,
        copyShown: getComputedStyle(copy).display,
        cutOff: copy.scrollHeight - copy.clientHeight,
        height: Math.round(r.height),
        lastCharInside
      };
    };
    return { strengths: one('strengths'), stretches: one('stretches') };
  });
  await page.emulateMediaType(null);
  return out;
}

// Does the chart actually have a visible ring, or is it the invisible hairline
// a 360-degree arc used to collapse into?
const chart = page => page.evaluate(() => {
  const paths = [...document.querySelectorAll('#pieChart path')];
  return paths.map(p => {
    const b = p.getBBox();
    return { fill: p.getAttribute('fill'), w: Math.round(b.width), h: Math.round(b.height),
             len: Math.round(p.getTotalLength()) };
  });
});

// Click the coloured ring at eight points around the circle, the way a person
// aiming at a band would. Returns the modal title seen at each point, or ''.
async function ringClicks(page){
  const box = await page.$eval('#pieChart', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2, r: r.width * 0.36 };
  });
  const seen = [];
  for (let i = 0; i < 8; i++){
    const a = (i * 45) * Math.PI / 180;
    await page.mouse.click(box.x + box.r * Math.cos(a), box.y + box.r * Math.sin(a));
    const open = await page.$eval('#modal', el => el.style.display === 'block');
    seen.push(open ? await page.$eval('#modalTitle', el => el.textContent) : '');
    if (open) await page.click('.modal-footer .close-btn');
  }
  return seen;
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

  // The jsPDF CDN is blocked for the WHOLE run, on purpose. This suite must
  // pass on a plane and on a school network that blocks cdnjs, and the offline
  // path is one of the things that was broken. The happy path is exercised
  // against a stand-in library installed below.
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (/cdnjs|jspdf/i.test(req.url())) req.abort();
    else req.continue();
  });

  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // Chrome's message for a failed request is the same generic sentence
    // whatever the file was — the URL lives in location(), not in the text.
    const url = (m.location() && m.location().url) || '';
    if (/favicon/i.test(url)) return;
    if (/cdnjs|jspdf/i.test(url)) return;      // blocked on purpose, see above
    consoleErrors.push(m.text() + (url ? '  [' + url + ']' : ''));
  });

  await page.evaluateOnNewDocument(() => {
    window.__printed = 0; window.__downloads = []; window.__pdfSaved = [];
    window.print = () => { window.__printed++; };
    window.confirm = m => { window.__confirm = String(m); return window.__confirmAnswer !== false; };
    window.alert   = m => { window.__alert = String(m); };
    // Catch anchor-triggered CSV downloads instead of writing to disk.
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[download]');
      if (a){ e.preventDefault();
              window.__downloads.push({ name: a.getAttribute('download'),
                                        href: a.getAttribute('href') || '' }); }
    }, true);
    // A full disk and Safari's private window both make setItem throw. This
    // switch reproduces that without needing either.
    const realSet = Storage.prototype.setItem;
    window.__blockStorage = false;
    Storage.prototype.setItem = function(k, v){
      if (window.__blockStorage) throw new Error('QuotaExceededError');
      return realSet.call(this, k, v);
    };
  });

  // A stand-in for jsPDF, so the happy path can be driven with no internet.
  // It records the text drawn and the filename asked for.
  const installFakePdf = () => page.evaluate(() => {
    window.__pdfLibBlocked = false;
    window.jspdf = { jsPDF: function(){
      const runs = [];
      return {
        __runs: runs,
        internal: { pageSize: { getHeight: () => 297, getWidth: () => 210 } },
        setFontSize(){}, addPage(){},
        splitTextToSize(t){ return String(t).split('\n'); },
        text(t){ runs.push(Array.isArray(t) ? t.join(' ') : String(t)); },
        save(name){ window.__pdfSaved.push({ name, text: runs.join(' | ') }); }
      };
    }};
  });

  // =========================================================================
  group('Arriving at the tool');
  // =========================================================================
  await goFirstVisit(page, base);

  check('the page opens with no JavaScript errors',
        pageErrors.length === 0, pageErrors.join(' | '));
  check('the page opens with no console errors',
        consoleErrors.length === 0, consoleErrors.join(' | '));

  const arrival = await page.evaluate(() => ({
    banner: document.getElementById('sampleBanner').classList.contains('on'),
    bannerText: document.getElementById('sampleBanner').textContent.replace(/\s+/g,' ').trim(),
    initials: document.getElementById('initials').value,
    strengths: document.getElementById('strengths').value,
    stretches: document.getElementById('stretches').value,
    slices: document.querySelectorAll('#pieChart path').length
  }));
  check('a visitor arrives to a filled-in chart and report, not an empty page',
        arrival.slices >= 3 && arrival.strengths.length > 40 && arrival.stretches.length > 40,
        JSON.stringify(arrival));
  check('the made-up child is named on screen as a sample',
        arrival.banner && /Sample student — Maya Torres \(M\.T\.\)/.test(arrival.bannerText),
        arrival.bannerText);
  eq('the sample child is entered by initials only', arrival.initials, 'M.T.');

  // "Has this tool been used before" used to be written down only when the
  // teacher touched something, so simply arriving and reading the page left the
  // flag unset and the sample was built again from scratch on every reload.
  eq('arriving at the tool is enough for it to know it has been opened',
     await page.evaluate(() => localStorage.getItem('seSeen')), '1');

  const sampleTiles = await tiles(page);
  check('the sample child has a mixed profile, not the same score on everything',
        sampleTiles.e > 0 && sampleTiles.d > 0 && sampleTiles.m > 0 && sampleTiles.x === 0,
        JSON.stringify(sampleTiles));

  const privacy = await page.evaluate(() => ({
    badge: (document.querySelector('.privacy') || {}).textContent || '',
    maxlen: document.getElementById('initials').maxLength,
    nameFields: [...document.querySelectorAll('input,textarea')]
      .filter(el => /name/i.test(el.id + ' ' + (el.placeholder || ''))).map(el => el.id)
  }));
  check('the page says the assessment stays on this laptop',
        /Stays on this laptop/.test(privacy.badge), privacy.badge);
  eq('the child field takes initials only, never a full name', privacy.maxlen, 4);
  eq('there is no name field left anywhere on the page', privacy.nameFields, []);

  // One click puts the sample away.
  await page.click('#clearSampleBtn');
  const afterClear = await page.evaluate(() => ({
    banner: document.getElementById('sampleBanner').classList.contains('on'),
    initials: document.getElementById('initials').value,
    strengths: document.getElementById('strengths').value,
    scored: [...document.querySelectorAll('.score-btn')]
      .filter(b => ['e','d','m'].some(c => b.classList.contains(c))).length,
    sampleBtn: !document.getElementById('sampleBtn').hidden
  }));
  check('one click clears the sample child and leaves the tool empty',
        !afterClear.banner && afterClear.initials === '' &&
        afterClear.strengths === '' && afterClear.scored === 0 && afterClear.sampleBtn,
        JSON.stringify(afterClear));

  await reload(page);
  const stillEmpty = await page.evaluate(() =>
    document.getElementById('sampleBanner').classList.contains('on'));
  check('the sample child does not come back after you have cleared her',
        stillEmpty === false);

  // This check used to press "Try it with a sample student" on an already-empty
  // tool — the one moment in the tool's life when that button cannot cost
  // anybody anything, and so the wrong moment to test it at. The button is shown
  // precisely when isSample is false, which is to say whenever a teacher has a
  // real assessment on screen, and pressing it there used to wipe that
  // assessment out silently. It is driven from a filled-in tool now.
  await page.click('#initials');
  await page.keyboard.type('D.L.');
  await page.click('#strengths');
  await page.keyboard.type('Twenty minutes of notes that must survive a stray click.');
  await score(page, 4, 'm');
  await page.evaluate(() => { window.__confirmAnswer = true; window.__confirm = ''; });
  await clickIfShown(page, '#sampleBtn');
  const backAgain = await page.evaluate(() => ({
    banner: document.getElementById('sampleBanner').classList.contains('on'),
    initials: document.getElementById('initials').value,
    asked: window.__confirm || '',
    undoShown: !document.getElementById('undoBtn').hidden
  }));
  check('the sample student button brings her back whenever you want her — ' +
        'after asking, and with the real assessment recoverable',
        backAgain.banner === true && backAgain.initials === 'M.T.' &&
        /Load the sample child\?/.test(backAgain.asked) && backAgain.undoShown,
        JSON.stringify(backAgain));
  await clickIfShown(page, '#undoBtn');   // leave the tool as this teacher had it

  // =========================================================================
  group('Trying the sample on top of a real assessment');
  // =========================================================================
  // "Try it with a sample student" wears the kindest label on the page and sits
  // first in the button row, next to Export as PDF. It used to replace a real
  // child's assessment with Maya's on ONE click: nothing asked, no snapshot
  // taken, and the overwrite saved to this laptop straight away, so a reload
  // finished the job. Reset All has asked first and offered Undo for a while;
  // this button had neither.
  await goEmpty(page, base);
  await page.click('#initials');
  await page.keyboard.type('R.K.');
  await page.click('#strengths');
  await page.keyboard.type('An hour of notes on this child, written up after school.');
  await page.click('#stretches');
  await page.keyboard.type('Waits to be asked before starting.');
  // Deliberately NOT the sample's own spread of two, two and two: if the real
  // scores happened to add up the same way as Maya's, a check that counted them
  // would pass even with her scores sitting on top of them.
  for (let i = 0; i < 5; i++) await score(page, i, 'm');

  await page.evaluate(() => { window.__confirmAnswer = false; window.__confirm = ''; });
  await page.click('#sampleBtn');
  const sampleSaidNo = await page.evaluate(() => ({
    asked: window.__confirm || '',
    initials: document.getElementById('initials').value,
    strengths: document.getElementById('strengths').value,
    banner: document.getElementById('sampleBanner').classList.contains('on'),
    stored: localStorage.getItem('seComments') || ''
  }));
  check('the sample button asks first when there is a real assessment on screen',
        /Load the sample child\?/.test(sampleSaidNo.asked) && /Undo/.test(sampleSaidNo.asked),
        sampleSaidNo.asked);
  check('saying no to the sample leaves the real assessment exactly as it was',
        sampleSaidNo.initials === 'R.K.' && /An hour of notes/.test(sampleSaidNo.strengths) &&
        sampleSaidNo.banner === false,
        JSON.stringify(sampleSaidNo).slice(0, 300));
  eq('and the scores are all still there', (await tiles(page)), { e:0, d:0, m:5, x:1 });
  // The overwrite used to reach localStorage before anybody could object.
  check('saying no does not write Maya over what is saved on the laptop',
        /An hour of notes/.test(sampleSaidNo.stored) && !/Maya/.test(sampleSaidNo.stored),
        sampleSaidNo.stored.slice(0, 120));

  await page.evaluate(() => { window.__confirmAnswer = true; window.__confirm = ''; });
  await clickIfShown(page, '#sampleBtn');
  const sampleSaidYes = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    banner: document.getElementById('sampleBanner').classList.contains('on'),
    undoShown: !document.getElementById('undoBtn').hidden,
    undoLabel: document.getElementById('undoBtn').textContent,
    msg: document.getElementById('saymsg').textContent
  }));
  check('saying yes loads the sample and puts an Undo button up beside it',
        sampleSaidYes.initials === 'M.T.' && sampleSaidYes.banner === true &&
        sampleSaidYes.undoShown && /Undo/.test(sampleSaidYes.undoLabel),
        JSON.stringify(sampleSaidYes));
  check('and the message says the real assessment has not been thrown away',
        /not been thrown away/.test(sampleSaidYes.msg) &&
        sampleSaidYes.msg.includes(sampleSaidYes.undoLabel),
        sampleSaidYes.msg);
  // An undo that lives in the page and not on the laptop has to say so, or a
  // teacher will close the tab believing their assessment is still recoverable.
  check('and it says how long that undo lasts',
        /until you leave this page/.test(sampleSaidYes.msg), sampleSaidYes.msg);

  await clickIfShown(page, '#undoBtn');
  const sampleUndone = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    strengths: document.getElementById('strengths').value,
    stretches: document.getElementById('stretches').value,
    banner: document.getElementById('sampleBanner').classList.contains('on'),
    sampleBtnBack: !document.getElementById('sampleBtn').hidden
  }));
  check('Undo brings the whole real assessment back from under the sample',
        sampleUndone.initials === 'R.K.' && /An hour of notes/.test(sampleUndone.strengths) &&
        sampleUndone.stretches === 'Waits to be asked before starting.' &&
        sampleUndone.banner === false && sampleUndone.sampleBtnBack,
        JSON.stringify(sampleUndone).slice(0, 300));
  eq('including every score', (await tiles(page)), { e:0, d:0, m:5, x:1 });

  await reload(page);
  const sampleUndoneSaved = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    strengths: document.getElementById('strengths').value
  }));
  check('and what is saved on the laptop is the real assessment, not Maya',
        sampleUndoneSaved.initials === 'R.K.' &&
        /An hour of notes/.test(sampleUndoneSaved.strengths),
        JSON.stringify(sampleUndoneSaved).slice(0, 200));

  // Loading the sample and then pressing Reset All. The undo slot holds one
  // thing, and what it must hold is the teacher's own assessment — not Maya's
  // made-up scores, which are recreated by a button whenever anybody wants them.
  await goEmpty(page, base);
  await page.click('#initials');
  await page.keyboard.type('T.W.');
  await page.click('#strengths');
  await page.keyboard.type('Notes from a parent meeting, worth keeping.');
  await score(page, 1, 'e');
  await page.evaluate(() => { window.__confirmAnswer = true; });
  await clickIfShown(page, '#sampleBtn');
  await page.click('button[onclick="resetAll()"]');
  const resetOverSample = await page.evaluate(() => ({
    msg: document.getElementById('saymsg').textContent,
    label: document.getElementById('undoBtn').textContent,
    undoShown: !document.getElementById('undoBtn').hidden
  }));
  check('after Reset the message names the button that is actually on screen',
        resetOverSample.undoShown && resetOverSample.msg.includes(resetOverSample.label),
        JSON.stringify(resetOverSample));
  await clickIfShown(page, '#undoBtn');
  const rescued = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    strengths: document.getElementById('strengths').value
  }));
  check('clearing the sample away with Reset still gives the real assessment back',
        rescued.initials === 'T.W.' && /parent meeting/.test(rescued.strengths),
        JSON.stringify(rescued).slice(0, 200));
  eq('with its score', (await tiles(page)), { e:1, d:0, m:0, x:5 });

  // The "Clear the sample" button is the other way out of a sample that landed
  // on top of real work, and it has to lead back to the same place.
  await goEmpty(page, base);
  await page.click('#initials');
  await page.keyboard.type('P.N.');
  await page.click('#strengths');
  await page.keyboard.type('Written up on the bus home.');
  await page.evaluate(() => { window.__confirmAnswer = true; });
  await clickIfShown(page, '#sampleBtn');
  await page.click('#clearSampleBtn');
  await clickIfShown(page, '#undoBtn');
  const rescued2 = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    strengths: document.getElementById('strengths').value
  }));
  check('and so does "Clear the sample"',
        rescued2.initials === 'P.N.' && /bus home/.test(rescued2.strengths),
        JSON.stringify(rescued2).slice(0, 200));

  // The question must not become a nag. On an empty tool there is nothing to
  // lose, so the sample still arrives on one click.
  await goEmpty(page, base);
  await page.evaluate(() => { window.__confirm = ''; });
  await clickIfShown(page, '#sampleBtn');
  const sampleOnEmpty = await page.evaluate(() => ({
    asked: window.__confirm || '',
    banner: document.getElementById('sampleBanner').classList.contains('on'),
    undoShown: !document.getElementById('undoBtn').hidden
  }));
  check('trying the sample on an empty tool still takes one click and asks nothing',
        sampleOnEmpty.asked === '' && sampleOnEmpty.banner === true &&
        !sampleOnEmpty.undoShown,
        JSON.stringify(sampleOnEmpty));

  // =========================================================================
  group('Typing your own child over the sample');
  // =========================================================================
  // A teacher who does not spot the "Clear the sample" button does the obvious
  // thing: clicks the Child box and types their own initials. That has to work,
  // and what comes out of the tool afterwards has to be theirs.
  await goFirstVisit(page, base);
  await page.click('#initials');                 // a plain click, nothing clever
  await page.keyboard.type('JM');
  const typedOver = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    banner: document.getElementById('sampleBanner').classList.contains('on'),
    strengths: document.getElementById('strengths').value,
    stretches: document.getElementById('stretches').value,
    msg: document.getElementById('saymsg').textContent
  }));
  // The box arrives holding M.T., which is all four characters it will take, so
  // every keystroke was refused and the field never changed. Clicking and
  // typing looked like a tool that was ignoring the teacher.
  eq('clicking the Child box and typing replaces the sample initials',
     typedOver.initials, 'JM');
  check('putting your own initials in puts the sample away',
        typedOver.banner === false && /sample has been put away/.test(typedOver.msg),
        JSON.stringify(typedOver));
  check("and the sample's made-up notes come off with her",
        typedOver.strengths === '' && typedOver.stretches === '',
        JSON.stringify([typedOver.strengths, typedOver.stretches]));
  eq('with no scores of hers left behind either', (await tiles(page)), { e:0, d:0, m:0, x:6 });

  for (let i = 0; i < 6; i++) await score(page, i, 'm');
  await page.click('button[onclick="exportCSV()"]');
  const ownDl = await page.evaluate(() => window.__downloads[window.__downloads.length - 1]);
  const ownCsv = decodeURIComponent(ownDl.href.replace(/^data:text\/csv;charset=utf-8,/, ''));
  const ownDate = await page.$eval('#adate', el => el.value);
  // This is the whole point: a real child's assessment used to be filed under a
  // made-up name, with the teacher's own initials thrown away.
  check('a real child is filed under the teacher\'s initials, not under Maya Torres',
        ownDl.name === `social-emotional-JM-${ownDate}.csv`, ownDl.name);
  check('and no row of that spreadsheet claims to be the sample child',
        !/Maya|[Ss]ample/.test(ownCsv) && /^JM,/m.test(ownCsv.split('\r\n')[1] || ''),
        ownCsv.split('\r\n')[1]);

  // Scoring first and typing the initials afterwards must not throw the
  // teacher's own work away.
  await goFirstVisit(page, base);
  await score(page, 1, 'm');                     // sample had Developing here
  await page.click('#stretches');
  await page.keyboard.type(' My own note.');
  await page.click('#initials');
  await page.keyboard.type('RK');
  const kept = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    banner: document.getElementById('sampleBanner').classList.contains('on'),
    stretches: document.getElementById('stretches').value,
    msg: document.getElementById('saymsg').textContent
  }));
  check('anything the teacher changed themselves is kept when the sample steps aside',
        kept.initials === 'RK' && kept.banner === false &&
        /My own note\./.test(kept.stretches) && /read the two boxes/.test(kept.msg),
        JSON.stringify(kept));
  eq('their own score is still there, and only theirs',
     (await tiles(page)), { e:0, d:0, m:1, x:5 });

  // =========================================================================
  group('The chart');
  // =========================================================================
  await goEmpty(page, base);

  const emptyChart = await chart(page);
  check('the chart draws a full grey ring before anything is scored',
        emptyChart.length === 1 && emptyChart[0].fill === '#8A8378' &&
        emptyChart[0].w >= 150 && emptyChart[0].h >= 150,
        JSON.stringify(emptyChart));
  eq('all six skills start in "not yet scored"', (await tiles(page)).x, 6);

  for (let i = 0; i < 6; i++) await score(page, i, 'm');
  const allM = await chart(page);
  check('the chart still draws when every skill is the same level',
        allM.length === 1 && allM[0].fill === '#639922' &&
        allM[0].w >= 150 && allM[0].h >= 150,
        JSON.stringify(allM));

  const ring = await ringClicks(page);
  check('every part of that ring can be clicked to see which skills are in it',
        ring.every(t => t === 'Mastered Skills'), JSON.stringify(ring));

  await goEmpty(page, base);
  await score(page, 0, 'e');
  const oneScored = await chart(page);
  check('a part-finished assessment shows the unscored skills in grey, not a gap',
        oneScored.length === 2 && oneScored.some(p => p.fill === '#8A8378'),
        JSON.stringify(oneScored));
  eq('the tiles say how many skills are still unscored', (await tiles(page)).x, 5);

  await goEmpty(page, base);
  for (let i = 0; i < 6; i++) await score(page, i, 'e');
  const allE = await chart(page);
  check('the same is true when every skill is Emerging',
        allE.length === 1 && allE[0].w >= 150, JSON.stringify(allE));
  await goEmpty(page, base);
  for (let i = 0; i < 6; i++) await score(page, i, 'd');
  const allD = await chart(page);
  check('the same is true when every skill is Developing',
        allD.length === 1 && allD[0].w >= 150, JSON.stringify(allD));

  // Keyboard, and the count tiles.
  await goEmpty(page, base);
  await score(page, 0, 'm');
  await score(page, 1, 'm');
  const keyed = await page.evaluate(async () => {
    const p = document.querySelector('#pieChart path');
    p.focus();
    p.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return { focused: document.activeElement.tagName.toLowerCase(),
             open: document.getElementById('modal').style.display === 'block',
             title: document.getElementById('modalTitle').textContent };
  });
  check('the bands can be opened from the keyboard, without a mouse',
        keyed.focused === 'path' && keyed.open && keyed.title === 'Mastered Skills',
        JSON.stringify(keyed));
  await page.click('.modal-footer .close-btn');

  await page.click('#countNone');
  const tileModal = await page.evaluate(() => ({
    open: document.getElementById('modal').style.display === 'block',
    title: document.getElementById('modalTitle').textContent,
    rows: document.querySelectorAll('.modal-skill').length
  }));
  check('the count boxes open the list too — they look clickable, so they are',
        tileModal.open && tileModal.title === 'Not yet scored' && tileModal.rows === 4,
        JSON.stringify(tileModal));
  await page.click('.modal-footer .close-btn');

  // =========================================================================
  group('Scoring');
  // =========================================================================
  await goEmpty(page, base);
  await score(page, 2, 'm');
  eq('a score lands where it was clicked', (await tiles(page)), { e:0, d:0, m:1, x:5 });

  await clearOneScore(page, 2);
  eq('a mis-clicked score can be taken back without wiping the whole form',
     (await tiles(page)), { e:0, d:0, m:0, x:6 });

  await score(page, 2, 'd');
  await score(page, 2, 'd');
  eq('pressing the same level twice also takes it off',
     (await tiles(page)), { e:0, d:0, m:0, x:6 });

  // Scoring from the keyboard.
  //
  // Every score rebuilds the whole skills list with innerHTML = '', which
  // destroys the very button the teacher is standing on. With a mouse you never
  // see it. From the keyboard, Enter registered the score and then dropped
  // focus all the way back to <body>: a teacher who does not use a mouse had to
  // Tab in from the top of the page again for every single skill, and pressing
  // the same level twice — the toggle-off the check above proves works — did
  // nothing at all, because the second Enter went to the page, not the button.
  await goEmpty(page, base);
  const focusKey = () => page.evaluate(() => {
    const a = document.activeElement;
    return (a && a.dataset && a.dataset.k) ? a.dataset.k : a.tagName;
  });
  await page.evaluate(() => document.querySelectorAll('.score-btn')[0].focus());
  await page.keyboard.press('Enter');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
  eq('Enter on a level scores it', (await tiles(page)), { e:1, d:0, m:0, x:5 });
  eq('and the keyboard is still standing on that same button afterwards',
     (await focusKey()), '0-e');

  await page.keyboard.press('Enter');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
  eq('so pressing Enter on the same level again takes the score off',
     (await tiles(page)), { e:0, d:0, m:0, x:6 });

  // And Tab still moves along the row from where the teacher is, rather than
  // from the top of the document.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
  eq('two Tabs along from there reaches Mastered on the same skill',
     (await tiles(page)), { e:0, d:0, m:1, x:5 });
  eq('and focus stays on it', (await focusKey()), '0-m');

  // The × goes invisible the moment the score it clears is gone, and an
  // invisible button cannot hold focus — so clearing from the keyboard lands on
  // that skill's first level instead of falling back to <body>.
  await goEmpty(page, base);
  await score(page, 2, 'd');
  await page.evaluate(() => document.querySelectorAll('.undo-score')[2].focus());
  await page.keyboard.press('Enter');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
  eq('clearing a score with the keyboard works', (await tiles(page)), { e:0, d:0, m:0, x:6 });
  eq('and leaves the keyboard on that skill, not back at the top of the page',
     (await focusKey()), '2-e');

  // =========================================================================
  group('Nothing is lost');
  // =========================================================================
  await goEmpty(page, base);
  await page.click('#initials');
  await page.keyboard.type('J.M.');
  await page.click('#strengths');
  await page.keyboard.type('Ten minutes of careful notes about this child that must not be lost.');
  await page.click('#stretches');
  await page.keyboard.type('Waits to be asked, twice this week.');
  await score(page, 0, 'e');
  await score(page, 1, 'm');
  // Deliberately do NOT click away from the last box before reloading — that is
  // exactly how the comments used to disappear.
  await page.click('#stretches');
  await page.keyboard.type(' Trying again tomorrow.');
  await reload(page);

  const survived = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    date: document.getElementById('adate').value,
    strengths: document.getElementById('strengths').value,
    stretches: document.getElementById('stretches').value
  }));
  check('a comment typed and never clicked away from is still there after a refresh',
        survived.stretches === 'Waits to be asked, twice this week. Trying again tomorrow.',
        JSON.stringify(survived.stretches));
  check('the other comment box survives the refresh too',
        /Ten minutes of careful notes/.test(survived.strengths), survived.strengths);
  eq('the initials survive the refresh', survived.initials, 'J.M.');
  eq('the scores survive the refresh', (await tiles(page)), { e:1, d:0, m:1, x:4 });
  check('the date is filled in for you and survives the refresh',
        /^\d{4}-\d{2}-\d{2}$/.test(survived.date), survived.date);
  // The date used to come from the browser's UTC clock, so an assessment done on
  // a Tuesday evening in California was dated Wednesday.
  const localToday = (d => d.getFullYear() + '-' +
        String(d.getMonth()+1).padStart(2,'0') + '-' +
        String(d.getDate()).padStart(2,'0'))(new Date());
  eq('the date offered is today on this laptop, not tomorrow', survived.date, localToday);

  // =========================================================================
  group('When the browser refuses to save');
  // =========================================================================
  await goEmpty(page, base);
  await page.evaluate(() => { window.__blockStorage = true; });
  await score(page, 0, 'm');
  const refused = await message(page);
  check('the teacher is told plainly when this browser will not store anything',
        /NOT BEING SAVED/.test(refused) && /private window|disk is full/.test(refused),
        refused);
  check('and the tool keeps working anyway, rather than throwing',
        (await tiles(page)).m === 1);
  await page.evaluate(() => { window.__blockStorage = false; });

  // Unreadable stored data
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('seSeen', '1');
    localStorage.setItem('seScores', 'not json at all');
  });
  const before = pageErrors.length;
  await reload(page);
  const rebuilt = await page.evaluate(() => ({
    buttons: document.querySelectorAll('.score-btn').length,
    msg: document.getElementById('saymsg').textContent
  }));
  eq('the whole tool still draws when the saved data is unreadable', rebuilt.buttons, 18);
  check('and it says so instead of leaving a half-built page',
        /could not be read/.test(rebuilt.msg), rebuilt.msg);
  check('no JavaScript error escapes when the saved data is unreadable',
        pageErrors.length === before, pageErrors.slice(before).join(' | '));

  // A full name left by an older version of this tool must not stay on the disk.
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('seSeen', '1');
    localStorage.setItem('seStudentName', 'Marcus Webb-O\'Neil');
  });
  await reload(page);
  const oldName = await page.evaluate(() => localStorage.getItem('seStudentName'));
  check('a full name saved by an older version is wiped off the laptop on sight',
        oldName === null, String(oldName));

  // =========================================================================
  group('Clearing, and getting it back');
  // =========================================================================
  await goEmpty(page, base);
  await page.click('#initials');
  await page.keyboard.type('R.K.');
  await page.click('#strengths');
  await page.keyboard.type('Reads to the class without being asked.');
  await score(page, 0, 'm');
  await score(page, 3, 'e');

  await page.evaluate(() => { window.__confirmAnswer = false; });
  await page.click('button[onclick="resetAll()"]');
  const saidNo = await page.evaluate(() => ({
    asked: window.__confirm || '',
    initials: document.getElementById('initials').value,
    strengths: document.getElementById('strengths').value
  }));
  check('Reset asks first, and says how to get the work back',
        /Clear this assessment\?/.test(saidNo.asked) && /Undo/.test(saidNo.asked),
        saidNo.asked);
  check('saying no to Reset changes nothing at all',
        saidNo.initials === 'R.K.' && /Reads to the class/.test(saidNo.strengths),
        JSON.stringify(saidNo));

  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('button[onclick="resetAll()"]');
  const cleared = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    strengths: document.getElementById('strengths').value,
    undoShown: !document.getElementById('undoBtn').hidden,
    msg: document.getElementById('saymsg').textContent
  }));
  check('saying yes clears it, and an Undo button appears with a note about it',
        cleared.initials === '' && cleared.strengths === '' && cleared.undoShown &&
        /Undo the clear/.test(cleared.msg),
        JSON.stringify(cleared));
  eq('the scores are cleared as well', (await tiles(page)), { e:0, d:0, m:0, x:6 });

  await page.click('#undoBtn');
  const undone = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    strengths: document.getElementById('strengths').value
  }));
  check('Undo brings the whole assessment back',
        undone.initials === 'R.K.' && /Reads to the class/.test(undone.strengths),
        JSON.stringify(undone));
  eq('including the scores', (await tiles(page)), { e:1, d:0, m:1, x:4 });

  await reload(page);
  const undoneSurvived = await page.$eval('#initials', el => el.value);
  eq('and the restored assessment is what is saved on the laptop', undoneSurvived, 'R.K.');

  // Pressing Reset twice. The snapshot used to be taken AFTER the tool had been
  // emptied, so the second press wrote that emptiness over the top of the real
  // work and "Undo the clear" then said "Put back." and put back nothing at
  // all. An hour of notes gone, with an affirmative message saying they were
  // restored. Nobody presses Reset once in a test; teachers press it twice.
  await goEmpty(page, base);
  await page.click('#strengths');
  await page.keyboard.type('An hour of notes.');
  await score(page, 0, 'm');
  await page.evaluate(() => { window.__confirmAnswer = true; window.__confirm = ''; });
  await page.click('button[onclick="resetAll()"]');
  await page.evaluate(() => { window.__confirm = ''; });
  await page.click('button[onclick="resetAll()"]');
  const secondPress = await page.evaluate(() => ({
    askedAgain: window.__confirm || '',
    msg: document.getElementById('saymsg').textContent,
    undoShown: !document.getElementById('undoBtn').hidden
  }));
  check('pressing Reset on an already-empty tool says there is nothing to clear',
        secondPress.askedAgain === '' && /nothing to clear/.test(secondPress.msg) &&
        secondPress.undoShown,
        JSON.stringify(secondPress));
  check('and it points at the undo that is still waiting',
        /Undo the clear/.test(secondPress.msg), secondPress.msg);

  await page.click('#undoBtn');
  const afterTwo = await page.evaluate(() => ({
    strengths: document.getElementById('strengths').value,
    msg: document.getElementById('saymsg').textContent
  }));
  check('Undo after two presses of Reset brings the real work back, not an empty page',
        afterTwo.strengths === 'An hour of notes.' && /Put back/.test(afterTwo.msg),
        JSON.stringify(afterTwo));
  eq('including the score', (await tiles(page)), { e:0, d:0, m:1, x:5 });

  // =========================================================================
  group('What reaches the paper');
  // =========================================================================
  // Print is what the tool offers instead of the PDF on a network that blocks
  // the CDN, so the printed sheet has to be a complete record. It was not: the
  // comment boxes are textareas, and a textarea prints only the words that fit
  // inside it. See paper() at the top of this file for how this is measured.
  await goFirstVisit(page, base);          // the sample child's long notes
  const samplePaper = await paper(page);
  check('every word of a long note reaches the paper, not just the first few lines',
        samplePaper.stretches.onPaper === samplePaper.stretches.onScreen &&
        samplePaper.stretches.cutOff === 0 && samplePaper.stretches.lastCharInside,
        JSON.stringify(samplePaper.stretches));
  check('the same for the strengths box',
        samplePaper.strengths.onPaper === samplePaper.strengths.onScreen &&
        samplePaper.strengths.cutOff === 0 && samplePaper.strengths.lastCharInside,
        JSON.stringify(samplePaper.strengths));
  check('the printed note grows to the length of the note, rather than staying box-sized',
        samplePaper.stretches.height >= 80, String(samplePaper.stretches.height));
  check('the scrolling box itself is not printed as well, so nothing is doubled',
        samplePaper.stretches.boxShown === 'none' &&
        samplePaper.stretches.copyShown === 'block',
        JSON.stringify([samplePaper.stretches.boxShown, samplePaper.stretches.copyShown]));

  // Words typed a second ago, never saved or re-rendered, must be on the sheet.
  await goEmpty(page, base);
  await page.click('#stretches');
  const longNote = ('Waits at the door before lunch and needs a name for the feeling. ' +
                    'We are trying a drink of water, then two minutes at the calm table, ' +
                    'then coming to find me. Ask again on Friday.');
  await page.keyboard.type(longNote);
  await page.click('button[onclick="printSheet()"]');
  const typedPaper = await paper(page);
  check('a note typed a moment ago is on the sheet in full',
        typedPaper.stretches.onPaper === longNote &&
        typedPaper.stretches.cutOff === 0 && typedPaper.stretches.lastCharInside,
        JSON.stringify(typedPaper.stretches));

  // Cmd-P never goes near the Print button, so the same has to be true there.
  await page.evaluate(() => {
    const el = document.getElementById('stretches');
    el.focus(); el.setSelectionRange(el.value.length, el.value.length);
  });
  await page.keyboard.type(' And once more on Monday.');
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  const cmdP = await paper(page);
  check('printing from the browser menu prints the same complete note',
        cmdP.stretches.onPaper === longNote + ' And once more on Monday.',
        cmdP.stretches.onPaper.slice(-60));

  // =========================================================================
  group('Getting it off the screen');
  // =========================================================================
  await goEmpty(page, base);
  await page.click('#initials');
  await page.keyboard.type('J.M.');
  await page.click('#strengths');
  await page.keyboard.type('Kind, funny, "steady" — and she listens.\nAsks for help now.');
  await page.click('#stretches');
  await page.keyboard.type('Frustration at transitions, especially before lunch.');
  await score(page, 0, 'm');
  await score(page, 1, 'e');
  await score(page, 2, 'd');

  // --- the PDF button with the library blocked ----------------------------
  await page.evaluate(() => { window.__alert = ''; });
  await page.click('button[onclick="exportPDF()"]');
  const pdfBlocked = await message(page);
  check('Export as PDF says what happened when the PDF part cannot be downloaded',
        /could not load/.test(pdfBlocked) && /Print/.test(pdfBlocked) && /CSV/.test(pdfBlocked),
        pdfBlocked);
  check('and it does not throw a JavaScript error into the console instead',
        pageErrors.length === 0, pageErrors.join(' | '));

  // --- the PDF button with the library present ----------------------------
  await installFakePdf();
  await page.click('button[onclick="exportPDF()"]');
  const pdf = await page.evaluate(() => window.__pdfSaved[window.__pdfSaved.length - 1]);
  const today = await page.$eval('#adate', el => el.value);
  check('the exported PDF is named for the child and the date, not the same name every time',
        pdf.name === `social-emotional-JM-${today}.pdf`, pdf.name);
  check('the PDF carries the initials and the date inside it as well',
        /Child: J\.M\./.test(pdf.text) && pdf.text.includes(today), pdf.text);
  check('the PDF holds both comments and every skill',
        /steady/.test(pdf.text) && /Frustration at transitions/.test(pdf.text) &&
        /Shows curiosity and asks questions — Mastered/.test(pdf.text),
        pdf.text);

  // --- CSV ----------------------------------------------------------------
  await page.click('button[onclick="exportCSV()"]');
  const dl = await page.evaluate(() => window.__downloads[window.__downloads.length - 1]);
  const csv = decodeURIComponent(dl.href.replace(/^data:text\/csv;charset=utf-8,/, ''));
  const lines = csv.replace(/^﻿/, '').split('\r\n');
  check('the spreadsheet is named for the child and the date too',
        dl.name === `social-emotional-JM-${today}.csv`, dl.name);
  eq('the spreadsheet has a heading row and one row per skill', lines.length, 7);
  check('the spreadsheet holds the comments the teacher just typed',
        /steady/.test(csv) && /Frustration at transitions/.test(csv), csv.slice(0, 400));
  check('a comment with a comma, a quote and a line break does not break the columns',
        lines.slice(1).every(l => l === '' || l.match(/"/) ) &&
        /""steady""/.test(csv), csv.slice(0, 600));

  const cells = await page.evaluate(csvText => {
    // Parse the CSV back the way a spreadsheet would, and look for empty cells.
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < csvText.length; i++){
      const ch = csvText[i];
      if (q){
        if (ch === '"' && csvText[i+1] === '"'){ cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ','){ row.push(cell); cell = ''; }
      else if (ch === '\r'){ /* skip */ }
      else if (ch === '\n'){ row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length){ row.push(cell); rows.push(row); }
    return rows;
  }, csv.replace(/^﻿/, ''));
  check('every column in the spreadsheet has something in it',
        cells.length === 7 && cells.every(r => r.length === 10 && r.every(c => c !== '')),
        JSON.stringify(cells.map(r => r.length)) + ' ' +
        JSON.stringify(cells.filter(r => r.some(c => c === ''))));
  check('the child and the date are in every row of the spreadsheet',
        cells.slice(1).every(r => r[0] === 'J.M.' && r[1] === today),
        JSON.stringify(cells[1] && cells[1].slice(0, 2)));

  // --- a spreadsheet with almost nothing filled in ------------------------
  // The two comment columns can honestly be empty. The child and the date
  // cannot: a row that says nothing about who or when, inside a file whose NAME
  // says today's date, is two different answers to the same question.
  await goEmpty(page, base);
  await page.evaluate(() => {
    const d = document.getElementById('adate');
    d.value = ''; d.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await score(page, 0, 'm');
  await page.click('button[onclick="exportCSV()"]');
  const bare = await page.evaluate(() => window.__downloads[window.__downloads.length - 1]);
  const bareRow = decodeURIComponent(bare.href.replace(/^data:text\/csv;charset=utf-8,/, ''))
                    .replace(/^﻿/, '').split('\r\n')[1].split(',');
  const todayStr = (d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') +
                        '-' + String(d.getDate()).padStart(2,'0'))(new Date());
  check('with nothing typed in, the spreadsheet still says who and when in every row',
        bareRow[0] === '—' && bareRow[1] === todayStr &&
        bareRow[2] !== '' && bareRow[3] !== '',
        JSON.stringify(bareRow.slice(0, 4)));
  check('and the date in the row matches the date in the filename',
        bare.name === `social-emotional-no-initials-${todayStr}.csv`, bare.name);

  // --- printing -----------------------------------------------------------
  await goEmpty(page, base);
  await page.click('button[onclick="printSheet()"]');
  eq('the Print button really prints', await page.evaluate(() => window.__printed), 1);

  // --- the sample child is labelled in what comes out ----------------------
  await goFirstVisit(page, base);
  await installFakePdf();
  await page.click('button[onclick="exportPDF()"]');
  const samplePdf = await page.evaluate(() => window.__pdfSaved[window.__pdfSaved.length - 1]);
  check('a printed sample sheet says it is a sample, so it cannot be taken for a real child',
        /Sample student — Maya Torres \(M\.T\.\)/.test(samplePdf.text) &&
        /not a real child/.test(samplePdf.text), samplePdf.text);
  check('and the sample file is named as a sample',
        /^sample-maya-torres-social-emotional-\d{4}-\d{2}-\d{2}\.pdf$/.test(samplePdf.name),
        samplePdf.name);
  await page.click('button[onclick="exportCSV()"]');
  const sampleCsv = await page.evaluate(() => window.__downloads[window.__downloads.length - 1]);
  check('the sample spreadsheet is labelled a sample as well',
        /^sample-maya-torres-social-emotional-/.test(sampleCsv.name) &&
        /Sample student/.test(decodeURIComponent(sampleCsv.href)),
        sampleCsv.name);

  // =========================================================================
  group('Nothing leaves the laptop');
  // =========================================================================
  const requested = [];
  page.on('request', r => requested.push(r.url()));
  await goEmpty(page, base);
  await score(page, 0, 'm');
  await page.click('button[onclick="exportCSV()"]');
  const offsite = requested.filter(u => !u.startsWith(base) && !u.startsWith('data:'));
  check('the tool makes no network request except the one PDF library',
        offsite.every(u => /cdnjs|jspdf/i.test(u)), offsite.join(' | '));

  // =========================================================================
  await browser.close();
  srv.close();

  console.log('');
  if (failures.length){
    console.log(`${R}${failures.length} CHECK(S) FAILED${X} (${passed} passed)`);
    failures.forEach(f => console.log(`${R}  - ${f.name}${X}${f.detail ? '\n      ' + f.detail : ''}`));
    process.exit(1);
  }
  console.log(`${G}ALL ${passed} CHECKS PASSED${X}`);
}

main().catch(e => { console.error(e); process.exit(1); });
