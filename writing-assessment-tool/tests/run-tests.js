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
// is deliberately blocked for the whole run, because "the school firewall ate
// it" is one of the things being tested, and because a suite whose result
// depends on the wifi teaches you to ignore red.
//
// WHAT YOU SHOULD SEE
// -------------------
// Green PASS lines and, at the end, "ALL n CHECKS PASSED". A red FAIL line says
// what was expected and what actually happened, and the script exits non-zero.
//
// node_modules is a symlink to ../../running-record-tool/tests/node_modules —
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
// Helpers for driving the page
// ---------------------------------------------------------------------------
// `load`, not `domcontentloaded`: a stylesheet still in flight when the first
// assertion ran used to land in the console-error list a fraction of the time,
// so the same suite passed or failed depending on timing.
// A genuinely cold arrival: nothing ever saved, nothing clicked. This is what a
// stranger opening the link for the first time sees, and it is the only honest
// place to check what is "on arrival". Everything below that talks about arrival
// uses this and clicks nothing.
async function coldArrival(page, base){
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

// An empty tool, ready for a teacher's own assessment. A cold arrival now opens
// on the sample child (see "She is there on arrival"), so getting to empty means
// pressing the button that clears her — which is exactly what a teacher starting
// their own assessment does.
async function fresh(page, base){
  await coldArrival(page, base);
  // Guarded, so that a regression in WHAT ARRIVES fails the checks that are
  // about arrival instead of garbling every other check in the file.
  if (await page.$eval('#sampleBtn', el => /Clear the sample/.test(el.textContent))){
    await page.click('#sampleBtn');
  }
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

// A real click on the E / D / M button of one skill row. col: 1=E, 2=D, 3=M,
// 4 = the little x that clears the row.
function scoreSel(row, col){
  return `.skills-list .skill-item:nth-child(${row + 1}) .skill-buttons button:nth-child(${col})`;
}
async function clickScore(page, row, band){
  const col = { e: 1, d: 2, m: 3 }[band];
  await page.click(scoreSel(row, col));
}

// What the chart actually drew, measured the way a pair of eyes would: how big
// is the coloured shape on screen.
const chartShapes = page => page.evaluate(() => {
  const svg = document.getElementById('pieChart');
  return Array.from(svg.children).map(el => {
    const b = el.getBBox();
    return { tag: el.tagName.toLowerCase(), fill: el.getAttribute('fill'),
             w: Math.round(b.width), h: Math.round(b.height) };
  });
});

const msg = page => page.$eval('#savedmsg', el => el.textContent);
const modalOpen = page => page.$eval('#modal', el => getComputedStyle(el).display === 'block');

// Put something into localStorage by hand and reopen the tool on it. This is
// how a half-written save from a laptop that was closed mid-lesson, or a file
// left behind by an older version of this list, actually arrives.
async function reopenWith(page, entries){
  await page.evaluate(e => {
    localStorage.clear();
    Object.keys(e).forEach(k => localStorage.setItem(k, e[k]));
  }, entries);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

// What the download was called. Returns the last file the page produced.
async function csvName(page){
  await page.evaluate(() => { window.__downloads = []; });
  await page.click('button[onclick="exportCSV()"]');
  const d = await page.evaluate(() => window.__downloads.slice());
  return d.length ? d[0].name : null;
}

// The storage keys are read from the page itself so a rename cannot silently
// make these checks pass against nothing.
const keys = page => page.evaluate(() => ({ scores: K_SCORES, comments: K_COMMENTS, who: K_WHO }));

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

  // Everything a page needs to be driven without opening real windows or
  // blocking on real dialogs, plus the CDN block described at the top.
  async function prep(page, opts){
    opts = opts || {};
    await page.setRequestInterception(true);
    const offsite = [];
    page.on('request', req => {
      const url = req.url();
      if (url.startsWith(base) || url.startsWith('data:')) return req.continue();
      offsite.push(url);
      req.abort();          // nothing in this suite is allowed to touch the internet
    });
    page.__offsite = offsite;
    await page.evaluateOnNewDocument((breakStorage) => {
      window.__printed = 0; window.__downloads = []; window.__confirms = [];
      window.print = () => { window.__printed++; };
      window.__confirmAnswer = true;
      window.confirm = m => { window.__confirms.push(String(m)); return window.__confirmAnswer; };
      window.alert = m => { window.__alert = String(m); };
      // Catch anchor-triggered downloads instead of writing files to disk.
      document.addEventListener('click', e => {
        const a = e.target.closest && e.target.closest('a[download]');
        if (a){ e.preventDefault();
                window.__downloads.push({ name: a.getAttribute('download') || '',
                                          href: a.getAttribute('href') || '' }); }
      }, true);
      if (breakStorage){
        // Safari's private window and a full disk both throw here.
        Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); };
      }
    }, !!opts.breakStorage);
    return page;
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 950 });
  await prep(page);

  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // Chrome's message for a failed request is the same generic sentence
    // whatever the file was — the URL lives in location(), not in the text.
    const url = (m.location() && m.location().url) || '';
    if (/favicon/i.test(url)) return;
    // The blocked CDN is the point of this run, not a fault. See the top.
    if (/cdnjs|jspdf/i.test(url)) return;
    consoleErrors.push(m.text() + (url ? '  [' + url + ']' : ''));
  });

  // =========================================================================
  group('It opens, with no internet at all');
  // =========================================================================
  await fresh(page, base);

  check('the tool opens with no JavaScript errors',
        pageErrors.length === 0, pageErrors.join(' | '));
  check('the tool opens with no console errors',
        consoleErrors.length === 0, consoleErrors.join(' | '));
  eq('all seven writing skills are listed',
     await page.$$eval('.skill-item', els => els.length), 7);

  const offsiteTried = page.__offsite.filter(u => !/cdnjs|jspdf/i.test(u));
  eq('nothing is sent anywhere — the only offsite request is the optional PDF maker',
     offsiteTried, []);

  // =========================================================================
  group('Who was assessed, and when');
  // =========================================================================
  const who = await page.evaluate(() => ({
    hasNameField: !!document.getElementById('studentName'),
    initialsMax: document.getElementById('initials').maxLength,
    dateType: document.getElementById('wdate').type,
    dateValue: document.getElementById('wdate').value,
    privacy: (document.querySelector('.privacy') || {}).textContent || ''
  }));
  check('there is no full-name box anywhere', who.hasNameField === false);
  eq('the child is identified by initials only, four characters', who.initialsMax, 4);
  eq('there is a date box', who.dateType, 'date');
  check('the date starts on today, so a sheet is never undated',
        /^\d{4}-\d{2}-\d{2}$/.test(who.dateValue), who.dateValue);
  check('the screen says the work stays on this laptop',
        /Stays on this laptop/.test(who.privacy), who.privacy);

  // =========================================================================
  group('The chart draws whatever the scores are');
  // =========================================================================
  await fresh(page, base);
  let shapes = await chartShapes(page);
  check('before anything is scored the chart is a visible ring, not a blank square',
        shapes.some(s => s.w >= 158 && s.h >= 158),
        JSON.stringify(shapes));

  // Straight down one column — the first thing most people try.
  for (let r = 0; r < 7; r++) await clickScore(page, r, 'm');
  shapes = await chartShapes(page);
  check('the chart still draws when every skill is given the same level',
        shapes.some(s => s.fill === '#639922' && s.w >= 158 && s.h >= 158),
        JSON.stringify(shapes));
  eq('the legend agrees with it', await page.$eval('#numMastered', el => el.textContent), '7');

  // ...and that full circle has to still be clickable, which the old hairline
  // was not.
  const box = await page.$eval('#pieChart', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  // A point on the ring itself: 0.15 down from the top is inside the outer
  // edge and outside the white middle.
  await page.mouse.click(box.x + box.w / 2, box.y + box.h * 0.15);
  check('clicking that all-one-colour ring still opens the list of skills',
        await modalOpen(page));
  eq('and the list holds all seven',
     await page.$$eval('#modalSkills .modal-skill', els => els.length), 7);

  // Escape used to leave the panel sitting there.
  await page.keyboard.press('Escape');
  check('Escape closes the list', (await modalOpen(page)) === false);

  await fresh(page, base);
  for (let r = 0; r < 7; r++) await clickScore(page, r, 'e');
  shapes = await chartShapes(page);
  check('the same is true when everything is Emerging',
        shapes.some(s => s.fill === '#378ADD' && s.w >= 158 && s.h >= 158),
        JSON.stringify(shapes));

  await fresh(page, base);
  for (let r = 0; r < 7; r++) await clickScore(page, r, 'd');
  shapes = await chartShapes(page);
  check('and when everything is Developing',
        shapes.some(s => s.fill === '#BA7517' && s.w >= 158 && s.h >= 158),
        JSON.stringify(shapes));

  // A genuinely mixed sheet must still come out as a proper donut.
  await fresh(page, base);
  await clickScore(page, 0, 'm'); await clickScore(page, 1, 'd'); await clickScore(page, 2, 'e');
  shapes = await chartShapes(page);
  eq('a mixed sheet draws one wedge per level',
     shapes.filter(s => ['#378ADD','#BA7517','#639922'].includes(s.fill)).length, 3);

  // =========================================================================
  group('The three count tiles');
  // =========================================================================
  await page.click('#countMastered');
  check('clicking the Mastered tile opens the same list the chart does',
        await modalOpen(page));
  eq('and it is titled for that level',
     await page.$eval('#modalTitle', el => el.textContent), 'Mastered Skills');
  eq('with the right skill in it',
     await page.$$eval('#modalSkills .modal-skill', els => els.map(e => e.textContent)),
     ['Demonstrates curiosity and engagement']);
  await page.click('.close-btn');
  check('Close closes it', (await modalOpen(page)) === false);

  // An empty band used to fire a blocking alert.
  await fresh(page, base);
  await page.click('#countEmerging');
  check('a level with nothing in it explains itself in the panel, not in a browser alert',
        (await modalOpen(page)) &&
        /No skills are marked Emerging yet/.test(await page.$eval('#modalSkills', el => el.textContent)) &&
        (await page.evaluate(() => window.__alert)) === undefined);
  await page.keyboard.press('Escape');

  // =========================================================================
  group('Taking a wrong tap back');
  // =========================================================================
  await fresh(page, base);
  await clickScore(page, 3, 'e');
  eq('a score shows on the row',
     await page.$eval(scoreSel(3, 1), el => el.className), 'score-btn e');
  await page.click(scoreSel(3, 4));      // the little x
  eq('the x beside the row clears that one score',
     await page.$eval(scoreSel(3, 1), el => el.className), 'score-btn ');
  eq('and the counts follow it back down',
     await page.$eval('#numEmerging', el => el.textContent), '0');
  await clickScore(page, 3, 'e');
  await clickScore(page, 3, 'e');
  eq('tapping the same letter twice also clears it',
     await page.$eval('#numEmerging', el => el.textContent), '0');

  // =========================================================================
  group('Scoring with the keyboard alone');
  // =========================================================================
  // WHAT WAS WRONG: scoring rebuilds every row, which destroyed the button the
  // keyboard was sitting on. Focus fell back to the top of the page, so scoring
  // by keyboard meant tabbing in again from the very top for every skill, and
  // pressing the same letter again to clear a wrong tap — the tool's own way
  // back — could not be done at all. The space bar just scrolled the page.
  await fresh(page, base);
  await page.focus(scoreSel(0, 2));                 // the D of the first skill
  await page.keyboard.press('Enter');
  const k1 = await page.evaluate(() => ({
    key: document.activeElement.dataset ? document.activeElement.dataset.focuskey : null,
    tag: document.activeElement.tagName,
    d: document.getElementById('numDeveloping').textContent }));
  eq('pressing Enter on a letter scores that skill', k1.d, '1');
  eq('and the keyboard stays on the very button that was pressed',
     [k1.tag, k1.key], ['BUTTON', 's0-d']);

  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Space');
  const k2 = await page.evaluate(() => ({
    d: document.getElementById('numDeveloping').textContent,
    key: document.activeElement.dataset ? document.activeElement.dataset.focuskey : null,
    scroll: window.scrollY }));
  eq('pressing the same letter again clears it, from the keyboard too', k2.d, '0');
  eq('the keyboard is still on that button afterwards', k2.key, 's0-d');
  eq('and the space bar scored instead of scrolling the page away',
     k2.scroll, scrollBefore);

  // Straight down the list without touching the mouse: Tab moves to the next
  // letter, not back to the top of the page.
  await page.keyboard.press('Enter');               // score it again
  await page.keyboard.press('Tab');
  eq('Tab after scoring moves on to the next control, not back to the top',
     await page.evaluate(() => document.activeElement.dataset.focuskey), 's0-m');

  // The little x disappears the moment it is used, so the keyboard has to be
  // handed somewhere sensible rather than dropped on the floor.
  await page.focus(scoreSel(0, 4));
  await page.keyboard.press('Enter');
  eq('using the x from the keyboard leaves the keyboard on that same row',
     await page.evaluate(() => ({
       key: document.activeElement.dataset ? document.activeElement.dataset.focuskey : null,
       d: document.getElementById('numDeveloping').textContent })),
     { key: 's0-e', d: '0' });

  // =========================================================================
  group('Nothing is lost on a refresh');
  // =========================================================================
  await fresh(page, base);
  await page.click('#initials');
  await page.type('#initials', 'R.K.');
  await clickScore(page, 0, 'm');
  await clickScore(page, 1, 'd');
  // Typed and NEVER clicked away from — this is the exact way the comments
  // used to disappear, because saving happened on blur.
  await page.click('#strengths');
  await page.type('#strengths', 'Starts writing without being asked.');
  await page.click('#stretches');
  await page.type('#stretches', 'Full stops come and go.');

  await page.reload({ waitUntil: 'load' });
  const after = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    strengths: document.getElementById('strengths').value,
    stretches: document.getElementById('stretches').value,
    m: document.getElementById('numMastered').textContent,
    d: document.getElementById('numDeveloping').textContent
  }));
  eq('the initials survive a refresh', after.initials, 'R.K.');
  eq('a comment typed and never clicked away from survives a refresh',
     after.stretches, 'Full stops come and go.');
  eq('so does the one before it', after.strengths, 'Starts writing without being asked.');
  eq('the scores survive a refresh', [after.m, after.d], ['1', '1']);

  // =========================================================================
  group('Reopening on a saved file that has gone bad');
  // =========================================================================
  // NOT tested the first time round, which is why all of this slipped through.
  // JSON.parse succeeding only proves the saved line is valid JSON. It does not
  // prove it is a score sheet. Everything below is a file the tool could really
  // be handed: interrupted mid-write, left by an older version of the skill
  // list, or opened up and edited by somebody curious.

  // A saved header where every field is the wrong kind of thing.
  await reopenWith(page, { writingWho: '{"initials":123,"date":"nope","sample":"yes"}' });
  const bad = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    date: document.getElementById('wdate').value,
    flag: getComputedStyle(document.getElementById('sampleFlag')).display !== 'none',
    btn: document.getElementById('sampleBtn').textContent,
    rows: document.querySelectorAll('.skill-item').length
  }));
  eq('a number saved where the initials go is not shown as though a teacher typed it',
     bad.initials, '');
  check('a date the box cannot show falls back to today, so the sheet is never undated',
        /^\d{4}-\d{2}-\d{2}$/.test(bad.date), bad.date);
  check('the orange "Sample student — Maya Torres" banner only comes on for a real saved sample',
        bad.flag === false, bad.btn);
  check('and the button still offers the sample rather than offering to clear one',
        /Try it with a sample student/.test(bad.btn), bad.btn);
  eq('the seven rows still render — a bad saved file does not empty the page', bad.rows, 7);

  // Overlong initials: the box stops anyone typing more than four, but nothing
  // stopped a saved file carrying more.
  await reopenWith(page, { writingWho: '{"initials":"ABCDEFGHIJ","date":"2026-03-04"}' });
  eq('initials longer than the box allows are cut to the four it allows',
     await page.$eval('#initials', el => el.value), 'ABCD');

  // A saved sheet holding a level that is not E, D or M, and a score for a
  // skill id that is not in the list at all.
  await reopenWith(page, { writingScores: '{"0":"z","9":"m"}' });
  const ghost = await page.evaluate(() => ({
    note: document.getElementById('chartNote').textContent,
    e: document.getElementById('numEmerging').textContent,
    d: document.getElementById('numDeveloping').textContent,
    m: document.getElementById('numMastered').textContent,
    marked: Array.from(document.querySelectorAll('.skill-item .score-btn'))
                 .filter(b => b.className.trim() !== 'score-btn').length
  }));
  eq('a score saved against a skill that does not exist is not counted',
     [ghost.e, ghost.d, ghost.m], ['0', '0', '0']);
  eq('and the note under the chart agrees with what the rows show',
     ghost.note, 'Nothing scored yet — use E, D or M beside a skill.');
  eq('no row is lit up either', ghost.marked, 0);
  shapes = await chartShapes(page);
  check('the chart is the plain grey ring, not a green wedge for a skill nobody can see',
        shapes.some(s => s.fill === '#E0DCD4') &&
        !shapes.some(s => ['#378ADD','#BA7517','#639922'].includes(s.fill)),
        JSON.stringify(shapes));

  // The same thing mixed in with one genuine score: the real one must survive
  // and the ghost must not be added to it.
  await reopenWith(page, { writingScores: '{"2":"m","9":"m","x":"e"}' });
  eq('a real score alongside a ghost one counts once, not twice',
     await page.evaluate(() => ({
       m: document.getElementById('numMastered').textContent,
       note: document.getElementById('chartNote').textContent })),
     { m: '1', note: '1 of 7 skills scored' });
  {
    const name = await csvName(page);
    const href = (await page.evaluate(() => window.__downloads.slice()))[0].href;
    // Nothing in this row is quoted — both comment boxes are empty — so a plain
    // split reads it honestly. Columns 10, 11, 12 are Emerging, Developing,
    // Mastered, in that order.
    const cols = decodeURIComponent(href.replace(/^data:text\/csv;charset=utf-8,/, ''))
                 .replace(/^﻿/, '').split('\r\n')[1].split(',');
    eq('and the spreadsheet counts it once as well', cols.slice(10, 13), ['0', '0', '1']);
    eq('the seven skill columns show the one real score and nothing invented',
       cols.slice(3, 10),
       ['Not assessed', 'Not assessed', 'Mastered', 'Not assessed',
        'Not assessed', 'Not assessed', 'Not assessed']);
    check('the file still gets a name', /\.csv$/.test(name), name);
  }

  // Saved lines that are valid JSON but are not a score sheet at all.
  for (const junk of ['"hello"', '42', '[]', 'null', '{"0":true}']){
    await reopenWith(page, { writingScores: junk });
    const ok = await page.evaluate(() => ({
      rows: document.querySelectorAll('.skill-item').length,
      scored: +document.getElementById('numEmerging').textContent +
              +document.getElementById('numDeveloping').textContent +
              +document.getElementById('numMastered').textContent }));
    eq(`a saved score sheet of ${junk} opens as an empty sheet, not a broken page`,
       ok, { rows: 7, scored: 0 });
  }

  // A comment box saved as something that is not text.
  await reopenWith(page, { writingComments: '{"strengths":5,"stretches":["a","b"]}' });
  eq('a comment box saved as a number or a list comes up empty, not showing the number',
     await page.evaluate(() => [document.getElementById('strengths').value,
                                document.getElementById('stretches').value]),
     ['', '']);

  await fresh(page, base);

  // =========================================================================
  group('When the browser refuses to remember');
  // =========================================================================
  {
    const p2 = await browser.newPage();
    await prep(p2, { breakStorage: true });
    const broke = [];
    p2.on('pageerror', e => broke.push(e.message));
    await fresh(p2, base);
    await clickScore(p2, 0, 'm');
    const warned = await msg(p2);
    check('a browser that will not save says so on screen instead of losing the work quietly',
          /NOT BEING SAVED/.test(warned) && /Print or export/.test(warned), warned);
    check('and the tool keeps working — nothing throws',
          broke.length === 0, broke.join(' | '));
    eq('the score still lands on screen',
       await p2.$eval('#numMastered', el => el.textContent), '1');
    await p2.close();
  }

  // =========================================================================
  group('Clearing, and getting it back');
  // =========================================================================
  // An Undo offered over an empty sheet is an offer that means nothing, and it
  // is the one Undo that could not survive a refresh — there was nothing in it.
  await fresh(page, base);
  await page.evaluate(() => { window.__confirms = []; window.__confirmAnswer = true; });
  await page.click('button[onclick="clearAll()"]');
  eq('Clear on an empty sheet says so instead of asking a pointless question',
     await page.evaluate(() => ({
       asked: window.__confirms.length,
       said: document.getElementById('savedmsg').textContent,
       undo: getComputedStyle(document.getElementById('undoBtn')).display !== 'none' })),
     { asked: 0, said: 'There is nothing to clear yet.', undo: false });

  await fresh(page, base);
  await page.type('#initials', 'Z.Q.');
  await clickScore(page, 0, 'm');
  await clickScore(page, 1, 'e');
  await page.click('#strengths');
  await page.type('#strengths', 'Lots to say.');

  await page.evaluate(() => { window.__confirmAnswer = false; });
  await page.click('button[onclick="clearAll()"]');
  const askedFirst = await page.evaluate(() => window.__confirms.slice());
  check('Clear asks before it destroys anything', askedFirst.length === 1, JSON.stringify(askedFirst));
  check('and the question says what goes and how to keep a copy',
        /Clear this assessment/.test(askedFirst[0]) &&
        /export or print first/.test(askedFirst[0]) &&
        /Undo clear/.test(askedFirst[0]), askedFirst[0]);
  eq('saying no keeps everything',
     await page.evaluate(() => document.getElementById('initials').value), 'Z.Q.');

  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('button[onclick="clearAll()"]');
  eq('saying yes clears it',
     await page.evaluate(() => ({
       initials: document.getElementById('initials').value,
       strengths: document.getElementById('strengths').value,
       m: document.getElementById('numMastered').textContent })),
     { initials: '', strengths: '', m: '0' });
  check('and the screen says how to get it back',
        /Undo clear if that was not what you meant/.test(await msg(page)));
  check('the Undo button is there to be pressed',
        await page.$eval('#undoBtn', el => getComputedStyle(el).display !== 'none'));

  await page.click('#undoBtn');
  eq('Undo clear brings the whole assessment back',
     await page.evaluate(() => ({
       initials: document.getElementById('initials').value,
       strengths: document.getElementById('strengths').value,
       m: document.getElementById('numMastered').textContent,
       e: document.getElementById('numEmerging').textContent })),
     { initials: 'Z.Q.', strengths: 'Lots to say.', m: '1', e: '1' });
  await page.reload({ waitUntil: 'load' });
  eq('and what came back is what is saved, not just what is on screen',
     await page.$eval('#initials', el => el.value), 'Z.Q.');

  // WHAT WAS WRONG: the one step of Undo lived only in a variable on the page,
  // while Clear had already emptied storage. Refreshing the tab — the very thing
  // somebody does when a page looks wrong — made the Undo button disappear and
  // took the work with it, so the promise in the Clear question ("Undo clear
  // brings it straight back") stopped being true with nothing left behind it.
  await fresh(page, base);
  await page.type('#initials', 'P.L.');
  await clickScore(page, 2, 'd');
  await page.click('#strengths');
  await page.type('#strengths', 'Twenty minutes of watching her write.');
  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('button[onclick="clearAll()"]');
  await page.reload({ waitUntil: 'load' });
  check('after a refresh the Undo button is still there to be pressed',
        await page.$eval('#undoBtn', el => getComputedStyle(el).display !== 'none'));
  await page.click('#undoBtn');
  eq('and it still brings the whole assessment back',
     await page.evaluate(() => ({
       initials: document.getElementById('initials').value,
       strengths: document.getElementById('strengths').value,
       d: document.getElementById('numDeveloping').textContent })),
     { initials: 'P.L.', strengths: 'Twenty minutes of watching her write.', d: '1' });
  await page.reload({ waitUntil: 'load' });
  eq('what came back is saved, and the offer is not made twice',
     await page.evaluate(() => ({
       initials: document.getElementById('initials').value,
       undo: getComputedStyle(document.getElementById('undoBtn')).display !== 'none' })),
     { initials: 'P.L.', undo: false });

  // =========================================================================
  group('The sample student');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');
  const sample = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    flag: getComputedStyle(document.getElementById('sampleFlag')).display !== 'none',
    flagText: document.getElementById('sampleFlag').textContent,
    strengths: document.getElementById('strengths').value.length,
    stretches: document.getElementById('stretches').value.length,
    e: +document.getElementById('numEmerging').textContent,
    d: +document.getElementById('numDeveloping').textContent,
    m: +document.getElementById('numMastered').textContent,
    date: document.getElementById('wdate').value,
    btn: document.getElementById('sampleBtn').textContent
  }));
  eq('one click fills the tool in for Maya Torres', sample.initials, 'M.T.');
  check('the screen says out loud that she is a sample',
        sample.flag && /Sample student — Maya Torres/.test(sample.flagText), sample.flagText);
  // WAS TESTING THE WRONG MOMENT: this check used to be named "...populated on
  // arrival" while reading the page immediately after a click on #sampleBtn. It
  // was green the whole time a cold arrival was a blank grey ring, 0/0/0 and two
  // empty boxes. Arrival is now checked with nothing clicked, in "She is there
  // on arrival" below; what is left here is what the BUTTON does.
  eq('every skill is scored, so the chart is populated after that click',
     sample.e + sample.d + sample.m, 7);
  check('her profile is mixed — some strong, some not — not a straight column',
        sample.e > 0 && sample.d > 0 && sample.m > 0,
        `E${sample.e} D${sample.d} M${sample.m}`);
  check('both comment boxes are written in', sample.strengths > 50 && sample.stretches > 50);
  check('she is dated', /^\d{4}-\d{2}-\d{2}$/.test(sample.date), sample.date);
  shapes = await chartShapes(page);
  eq('and the chart shows all three levels',
     shapes.filter(s => ['#378ADD','#BA7517','#639922'].includes(s.fill)).length, 3);

  check('the button now offers to clear her again',
        /Clear the sample student/.test(sample.btn), sample.btn);

  // The banner is only allowed on for a genuinely saved sample — so the genuine
  // one has to survive a refresh, or tightening that rule would have quietly
  // turned the label off on a real sample sheet.
  await page.reload({ waitUntil: 'load' });
  eq('a refresh keeps her labelled as a sample',
     await page.evaluate(() => ({
       flag: getComputedStyle(document.getElementById('sampleFlag')).display !== 'none',
       initials: document.getElementById('initials').value,
       btn: document.getElementById('sampleBtn').textContent })),
     { flag: true, initials: 'M.T.', btn: 'Clear the sample student' });
  {
    const rdl = await csvName(page);
    check('and an export made after that refresh still says SAMPLE on it',
          /^writing-assessment-SAMPLE-M\.T\.-\d{4}-\d{2}-\d{2}\.csv$/.test(rdl), rdl);
  }
  await page.click('#sampleBtn');
  eq('one click clears her and the tool is empty again',
     await page.evaluate(() => ({
       initials: document.getElementById('initials').value,
       strengths: document.getElementById('strengths').value,
       flag: getComputedStyle(document.getElementById('sampleFlag')).display !== 'none',
       scored: +document.getElementById('numEmerging').textContent +
               +document.getElementById('numDeveloping').textContent +
               +document.getElementById('numMastered').textContent })),
     { initials: '', strengths: '', flag: false, scored: 0 });

  // =========================================================================
  group('She is there on arrival — and she goes for good');
  // =========================================================================
  // Nothing is clicked anywhere in this block. WHAT WAS WRONG: a first visit was
  // a blank grey ring, "Nothing scored yet", 0/0/0 and two empty boxes, so a
  // stranger opening the link saw nothing of what the tool does.
  await coldArrival(page, base);
  const arrival = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    note: document.getElementById('chartNote').textContent,
    flag: getComputedStyle(document.getElementById('sampleFlag')).display !== 'none',
    strengths: document.getElementById('strengths').value.length,
    stretches: document.getElementById('stretches').value.length,
    e: +document.getElementById('numEmerging').textContent,
    d: +document.getElementById('numDeveloping').textContent,
    m: +document.getElementById('numMastered').textContent
  }));
  eq('a first visit opens on the sample child, with nothing clicked', arrival.initials, 'M.T.');
  eq('every skill is scored, so the chart is populated on arrival',
     arrival.e + arrival.d + arrival.m, 7);
  check('her profile on arrival is mixed, not a straight column',
        arrival.e > 0 && arrival.d > 0 && arrival.m > 0,
        `E${arrival.e} D${arrival.d} M${arrival.m}`);
  eq('and the note under the chart says so', arrival.note, '7 of 7 skills scored');
  check('both comment boxes are written in on arrival',
        arrival.strengths > 50 && arrival.stretches > 50);
  check('and the orange banner says she is a sample before anybody touches anything',
        arrival.flag);
  shapes = await chartShapes(page);
  eq('all three wedges are drawn on arrival',
     shapes.filter(s => ['#378ADD','#BA7517','#639922'].includes(s.fill)).length, 3);

  // Once she has been sent away she does not walk back in on the next reload.
  await page.click('#sampleBtn');
  await page.reload({ waitUntil: 'load' });
  eq('after she is cleared she stays cleared, even after a refresh',
     await page.evaluate(() => ({
       initials: document.getElementById('initials').value,
       note: document.getElementById('chartNote').textContent,
       flag: getComputedStyle(document.getElementById('sampleFlag')).display !== 'none' })),
     { initials: '', note: 'Nothing scored yet — use E, D or M beside a skill.', flag: false });

  // =========================================================================
  group('The sample button cannot eat a real assessment');
  // =========================================================================
  // THE WORST THING THIS TOOL EVER DID. "Try it with a sample student" is the
  // friendliest-looking button on the page, and one click dropped Maya straight
  // over a real assessment: no question asked, no Undo offered, and the saved
  // copy overwritten too, so twenty minutes of watching a child existed nowhere
  // at all. "Clear this assessment" — the frightening-looking button — asked
  // first AND offered a way back. This one did neither.
  const REAL = 'REAL NOTES ABOUT A REAL CHILD - 20 minutes of observation';
  async function typeRealAssessment(){
    await fresh(page, base);
    await page.click('#initials'); await page.type('#initials', 'R.K.');
    await page.click('#strengths'); await page.type('#strengths', REAL);
    await page.click('#stretches'); await page.type('#stretches', 'Vowel teams still a guess.');
    for (const r of [0, 1, 2, 3]) await clickScore(page, r, 'd');
  }

  await typeRealAssessment();
  await page.evaluate(() => { window.__confirms = []; window.__confirmAnswer = false; });
  await page.click('#sampleBtn');
  const asked = await page.evaluate(() => window.__confirms.slice());
  check('loading the sample over an assessment asks first', asked.length === 1, JSON.stringify(asked));
  check('and the question says what would go and how to get it back',
        /sample student/i.test(asked[0]) && /comment boxes/.test(asked[0]) && /Undo/.test(asked[0]),
        asked[0]);
  eq('saying no leaves every word of the real assessment where it was',
     await page.evaluate(() => ({
       strengths: document.getElementById('strengths').value,
       initials: document.getElementById('initials').value,
       d: document.getElementById('numDeveloping').textContent })),
     { strengths: REAL, initials: 'R.K.', d: '4' });

  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#sampleBtn');
  const swapped = await page.evaluate(k => ({
    onScreen: document.getElementById('strengths').value.slice(0, 5),
    undoOffered: getComputedStyle(document.getElementById('undoBtn')).display !== 'none',
    undoLabel: document.getElementById('undoBtn').textContent,
    savedSomewhere: Object.keys(localStorage)
      .some(key => /REAL NOTES ABOUT A REAL CHILD/.test(localStorage.getItem(key) || ''))
  }), await keys(page));
  eq('saying yes does load her', swapped.onScreen, 'Maya ');
  check('the Undo button is offered — this path used to hide it', swapped.undoOffered, swapped.undoLabel);
  check('and the real assessment is still written down somewhere, not just in a variable',
        swapped.savedSomewhere);

  await page.click('#undoBtn');
  eq('Undo puts the real assessment straight back',
     await page.evaluate(() => ({
       strengths: document.getElementById('strengths').value,
       stretches: document.getElementById('stretches').value,
       initials: document.getElementById('initials').value,
       d: document.getElementById('numDeveloping').textContent,
       flag: getComputedStyle(document.getElementById('sampleFlag')).display !== 'none' })),
     { strengths: REAL, stretches: 'Vowel teams still a guess.', initials: 'R.K.',
       d: '4', flag: false });
  await page.reload({ waitUntil: 'load' });
  eq('and what came back survives a refresh',
     await page.$eval('#strengths', el => el.value), REAL);

  // The same rescue has to survive the obvious next move: the sample is loaded
  // over the work, then the same button is pressed again to get rid of her.
  await typeRealAssessment();
  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#sampleBtn');     // Maya over the top of the real work
  await page.click('#sampleBtn');     // and away again
  check('clearing the sample afterwards does not destroy the assessment it was loaded over',
        await page.$eval('#undoBtn', el => getComputedStyle(el).display !== 'none'));
  await page.click('#undoBtn');
  eq('Undo still brings it back after that',
     await page.$eval('#strengths', el => el.value), REAL);

  // And a refresh in the middle of that muddle keeps the way back.
  await typeRealAssessment();
  await page.click('#sampleBtn');
  await page.reload({ waitUntil: 'load' });
  check('after a refresh with the sample loaded over it, the way back is still offered',
        await page.$eval('#undoBtn', el => getComputedStyle(el).display !== 'none'));
  await page.click('#undoBtn');
  eq('and it still works', await page.$eval('#strengths', el => el.value), REAL);

  // Typing over Maya and then clearing her is somebody's own writing going too.
  await fresh(page, base);
  await page.click('#sampleBtn');
  await page.click('#stretches');
  await page.type('#stretches', ' My own words on the end of hers.');
  await page.evaluate(() => { window.__confirms = []; window.__confirmAnswer = false; });
  await page.click('#sampleBtn');
  const askedClear = await page.evaluate(() => window.__confirms.slice());
  check('clearing a sample that has been typed over asks first as well',
        askedClear.length === 1, JSON.stringify(askedClear));
  check('and saying no keeps what was typed',
        /My own words on the end of hers\.$/.test(await page.$eval('#stretches', el => el.value)));

  // =========================================================================
  group('Typing over the sample child\'s initials');
  // =========================================================================
  // WHAT WAS WRONG: the box arrives holding "M.T." — exactly the four characters
  // it allows — so the obvious move, click and type, did nothing whatsoever. The
  // only way in was to backspace it empty first.
  await fresh(page, base);
  await page.click('#sampleBtn');
  await page.click('#initials');
  await page.type('#initials', 'JM');
  eq('clicking the Child box and typing replaces the sample initials',
     await page.$eval('#initials', el => el.value), 'JM');

  await fresh(page, base);
  await page.click('#sampleBtn');
  await page.focus('#initials');           // arriving by Tab, not by mouse
  await page.type('#initials', 'AB');
  eq('and so does arriving there with the keyboard',
     await page.$eval('#initials', el => el.value), 'AB');

  // Selecting everything is only right while the box is still hers. Once it is
  // the teacher's own, clicking must put a caret down like any other box.
  await page.click('#initials');
  await page.keyboard.press('End');
  await page.type('#initials', 'C');
  eq('once the initials are the teacher\'s own, clicking no longer wipes them',
     await page.$eval('#initials', el => el.value), 'ABC');

  // =========================================================================
  group('The spreadsheet export');
  // =========================================================================
  await fresh(page, base);
  await page.type('#initials', 'R.K.');
  await page.evaluate(() => { document.getElementById('wdate').value = '2026-03-04';
                              document.getElementById('wdate')
                                .dispatchEvent(new Event('input', { bubbles: true })); });
  await clickScore(page, 0, 'm');
  await clickScore(page, 2, 'd');
  await clickScore(page, 3, 'e');
  await page.click('#strengths');
  // A comma, a pair of quotes and a line break — the three things that used to
  // tear the file into the wrong columns.
  await page.type('#strengths', 'She said "I can do it", then wrote it.\nTwo lines, in fact.');
  await page.click('#stretches');
  await page.type('#stretches', 'Vowel teams, still guessing.');
  await page.click('button[onclick="exportCSV()"]');

  const dl = await page.evaluate(() => window.__downloads.slice());
  check('Export as CSV actually produces a file', dl.length === 1, JSON.stringify(dl));
  eq('the filename carries the initials and the date',
     dl[0] && dl[0].name, 'writing-assessment-R.K.-2026-03-04.csv');

  const csv = decodeURIComponent(dl[0].href.replace(/^data:text\/csv;charset=utf-8,/, ''));
  const lines = csv.replace(/^﻿/, '').split('\r\n');
  const cells = (() => {                     // a small honest CSV reader
    const out = []; let cur = '', q = false;
    const row = lines[1];
    for (let i = 0; i < row.length; i++){
      const ch = row[i];
      if (q){ if (ch === '"' && row[i+1] === '"'){ cur += '"'; i++; }
              else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ','){ out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur); return out;
  })();
  const head = lines[0].split(',').length;
  eq('the header names every column the row has', head >= 3 + 7 + 3 + 2, true);
  eq('the child and the date are in the file', [cells[0], cells[1]], ['R.K.', '2026-03-04']);
  eq('every one of the seven skills has its own column, scored or not',
     cells.slice(3, 10),
     ['Mastered', 'Not assessed', 'Developing', 'Emerging', 'Not assessed', 'Not assessed', 'Not assessed']);
  eq('the counts are there', cells.slice(10, 13), ['1', '1', '1']);
  eq('the Strengths box comes out whole — quotes, comma and line break and all',
     cells[13], 'She said "I can do it", then wrote it.\nTwo lines, in fact.');
  eq('and so does Stretches, which used to come out empty',
     cells[14], 'Vowel teams, still guessing.');
  check('the screen confirms the file was written', /\.csv/.test(await msg(page)));

  // The sample child has to be unmistakable in the file too.
  await fresh(page, base);
  await page.click('#sampleBtn');
  await page.click('button[onclick="exportCSV()"]');
  const sdl = await page.evaluate(() => window.__downloads.slice());
  const scsv = decodeURIComponent(sdl[0].href.replace(/^data:text\/csv;charset=utf-8,/, ''));
  check('a printed sample sheet says on it that it is a sample',
        /Sample student — Maya Torres/.test(scsv) && /SAMPLE — not a real child/.test(scsv));
  check('and its filename says so as well',
        /^writing-assessment-SAMPLE-M.T.-\d{4}-\d{2}-\d{2}\.csv$/.test(sdl[0].name), sdl[0].name);

  // A sheet exported before anybody filled in the initials box. Two of these in
  // one downloads folder have to be called the same thing, or a teacher sorting
  // by name sees two different sheets that are the same kind of unnamed.
  await fresh(page, base);
  const noneName = await csvName(page);
  check('an export with the initials box empty is named as having no initials',
        /^writing-assessment-no-initials-\d{4}-\d{2}-\d{2}\.csv$/.test(noneName), noneName);

  await page.click('#initials');
  await page.type('#initials', '/\\ ?');     // typed, and none of it can go in a filename
  const oddName = await csvName(page);
  eq('initials made only of characters a filename cannot hold get that same name, not a second spelling of it',
     oddName, noneName);

  // And the ordinary case is untouched by that.
  await fresh(page, base);
  await page.click('#initials');
  await page.type('#initials', 'A/B');
  const mixedName = await csvName(page);
  check('initials that are partly usable keep the usable part',
        /^writing-assessment-AB-\d{4}-\d{2}-\d{2}\.csv$/.test(mixedName), mixedName);

  // =========================================================================
  group('The PDF export, on a laptop with no internet');
  // =========================================================================
  await fresh(page, base);
  await page.type('#initials', 'R.K.');
  await clickScore(page, 0, 'm');
  await page.click('button[onclick="exportPDF()"]');
  const pdfMsg = await msg(page);
  check('with the PDF maker blocked, the button says what happened instead of doing nothing',
        /did not load/.test(pdfMsg), pdfMsg);
  check('and it says what still works without the internet',
        /Print/.test(pdfMsg) && /CSV/.test(pdfMsg), pdfMsg);
  check('nothing was thrown into the console for nobody to see',
        pageErrors.length === 0, pageErrors.join(' | '));

  // With the PDF maker present, the sheet has to carry the child and the date.
  await page.evaluate(() => {
    window.__pdf = { text: [], name: '' };
    window.jspdf = { jsPDF: function(){
      return {
        internal: { pageSize: { getHeight: () => 297, getWidth: () => 210 } },
        setFontSize(){}, addPage(){},
        splitTextToSize: t => String(t).split('\n'),
        text(t){ window.__pdf.text.push(String(t)); },
        save(n){ window.__pdf.name = n; }
      }; } };
  });
  await page.click('button[onclick="exportPDF()"]');
  const pdf = await page.evaluate(() => window.__pdf);
  const pdfText = pdf.text.join('\n');
  check('the PDF names the child by initials', /Child: R\.K\./.test(pdfText), pdfText.slice(0, 200));
  check('the PDF is dated', /Date: \d{4}-\d{2}-\d{2}/.test(pdfText));
  check('the PDF filename carries the initials and the date',
        /^writing-assessment-R\.K\.-\d{4}-\d{2}-\d{2}\.pdf$/.test(pdf.name), pdf.name);

  // =========================================================================
  group('Print');
  // =========================================================================
  await page.click('button[onclick="window.print()"]');
  eq('the Print button really asks the browser to print',
     await page.evaluate(() => window.__printed), 1);

  // WHAT WAS WRONG: Print is what the tool itself offers when the PDF maker is
  // blocked, and a textarea prints only the slice that fits its own 148px scroll
  // box. Anything past roughly 760 characters never reached the paper, and paper
  // has no scrollbar to hint that anything was missing. The sample child's own
  // note is short enough to fit, which is why a demo looked fine.
  await fresh(page, base);
  const LONG = ('She starts writing the moment the books come out and does not ask what to put. ' +
                'Her printing is clear and the upper and lower case stay apart. She reads it back ' +
                'to herself and adds a detail while she is doing it, which is new this term. ')
               .repeat(6) + 'THE LAST SENTENCE MUST REACH THE PAPER.';
  await page.evaluate(t => {
    ['strengths', 'stretches'].forEach(id => {
      const el = document.getElementById(id);
      el.value = t;                                   // as a paste would arrive
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }, LONG);
  check('the comment used for this check is longer than the old cut-off',
        LONG.length > 1200, String(LONG.length));

  await page.emulateMediaType('print');
  await page.setViewport({ width: 739, height: 1000 });   // paper content width
  const printed = await page.evaluate(() => {
    const out = {};
    ['strengths', 'stretches'].forEach(id => {
      const box = document.getElementById(id);
      const paper = document.getElementById(id + 'Print');
      out[id] = {
        boxShown: getComputedStyle(box).display !== 'none',
        paperShown: getComputedStyle(paper).display !== 'none',
        text: paper.textContent,
        clipped: paper.scrollHeight > paper.clientHeight + 1,
        tall: paper.getBoundingClientRect().height
      };
    });
    return out;
  });
  for (const id of ['strengths', 'stretches']){
    const p = printed[id];
    check(`on paper the ${id} box is replaced by the words themselves`,
          p.paperShown && !p.boxShown, JSON.stringify({ paperShown: p.paperShown, boxShown: p.boxShown }));
    eq(`every character of the ${id} comment is on the paper`, p.text, LONG);
    check(`and none of it is cut off — the ${id} text grows to fit instead of scrolling`,
          !p.clipped && p.tall > 200, JSON.stringify({ clipped: p.clipped, tall: p.tall }));
  }
  // A blank sheet printed to be filled in by hand still has somewhere to write.
  await page.evaluate(() => {
    ['strengths', 'stretches'].forEach(id => {
      const el = document.getElementById(id);
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  const blankPaper = await page.evaluate(() => {
    const p = document.getElementById('strengthsPrint');
    return { h: Math.round(p.getBoundingClientRect().height),
             border: getComputedStyle(p).borderTopWidth };
  });
  check('a sheet printed with the comment boxes empty still has a box to write in',
        blankPaper.h >= 120 && blankPaper.border !== '0px', JSON.stringify(blankPaper));
  // WHAT WAS WRONG: 120px was sized against the printed 13px type — about
  // three handwritten lines once a real pen is on the paper. The floor is now
  // a box a teacher can actually fill in by hand at a desk.
  check('an empty comment box is deep enough for real handwriting, not three cramped lines',
        blankPaper.h >= 200, JSON.stringify(blankPaper));

  await page.emulateMediaType(null);
  await page.setViewport({ width: 1280, height: 950 });

  // Chrome's own print pipeline, not a measurement of the screen. This print
  // has ALWAYS been two sheets — the dashboard, then the comment boxes — and
  // the deeper boxes spend slack that already existed on sheet two. What must
  // never happen silently is a third sheet.
  {
    const pdfPages = (buf) =>
      (Buffer.from(buf).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    const pdf = await page.pdf({ format: 'Letter', printBackground: true,
      margin: { top: '0.5in', bottom: '0.5in', left: '0.5in', right: '0.5in' } });
    eq('the printed record is still its two sheets — the roomier boxes never buy a third',
       pdfPages(pdf), 2);
  }

  // =========================================================================
  group('On a small phone');
  // =========================================================================
  // WHAT WAS WRONG: at 320px and 360px the page was 366px wide, so it slid
  // sideways under the thumb — the three count tiles plus the body padding
  // needed more room than the screen had.
  for (const w of [320, 360, 375, 390, 414, 768]){
    await page.setViewport({ width: w, height: 800 });
    await page.reload({ waitUntil: 'load' });
    const size = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      tiles: document.getElementById('numMastered').textContent
    }));
    check(`at ${w}px the page does not scroll sideways`,
          size.scrollW <= size.clientW, JSON.stringify(size));
  }
  await page.setViewport({ width: 1280, height: 950 });

  // =========================================================================
  group('The chart can be used without a mouse');
  // =========================================================================
  // WHAT WAS WRONG: the slices had no tabindex, no role and no name, so they
  // could only be clicked. The three count tiles do the same job, so this was a
  // lost shortcut rather than a dead end — but a shortcut only some people can
  // use is not a shortcut.
  await fresh(page, base);
  await page.click('#sampleBtn');
  const slices = await page.evaluate(() => Array.from(document.getElementById('pieChart').children)
    .filter(el => ['#378ADD', '#BA7517', '#639922'].includes(el.getAttribute('fill')))
    .map(el => ({ tabindex: el.getAttribute('tabindex'), role: el.getAttribute('role'),
                  label: el.getAttribute('aria-label') })));
  eq('all three slices are reachable by keyboard', slices.map(s => s.tabindex), ['0', '0', '0']);
  eq('and each says it is a button', slices.map(s => s.role), ['button', 'button', 'button']);
  check('each slice says out loud which level it is and how many skills are in it',
        slices.every(s => /^(Emerging|Developing|Mastered) — \d of 7 skills\. Open the list\.$/
                            .test(s.label || '')), JSON.stringify(slices.map(s => s.label)));

  // Focusable is not the same as reachable. Walk in with the Tab key from the
  // date box and the three slices have to actually turn up, in order.
  await page.focus('#wdate');
  const walk = [];
  for (let i = 0; i < 8; i++){
    await page.keyboard.press('Tab');
    walk.push(await page.evaluate(() => {
      const a = document.activeElement;
      return (a.getAttribute && a.getAttribute('aria-label')) || a.id || a.tagName;
    }));
  }
  eq('tabbing in from the date box reaches all three slices, in chart order',
     walk.filter(w => / of 7 skills\. Open the list\.$/.test(w))
         .map(w => w.split(' —')[0]),
     ['Emerging', 'Developing', 'Mastered']);

  await page.evaluate(() => document.getElementById('pieChart')
                              .querySelector('[fill="#639922"]').focus());
  await page.keyboard.press('Enter');
  check('Enter on a slice opens the same list a click does', await modalOpen(page));
  eq('and it is the list for that slice',
     await page.$eval('#modalTitle', el => el.textContent), 'Mastered Skills');
  await page.keyboard.press('Escape');

  const beforeSpace = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => document.getElementById('pieChart')
                              .querySelector('[fill="#378ADD"]').focus());
  await page.keyboard.press('Space');
  check('the space bar opens it too, without scrolling the page away',
        (await modalOpen(page)) && (await page.evaluate(() => window.scrollY)) === beforeSpace);
  eq('and on the right level',
     await page.$eval('#modalTitle', el => el.textContent), 'Emerging Skills');
  await page.keyboard.press('Escape');

  // =========================================================================
  check('no JavaScript errors happened anywhere in the whole run',
        pageErrors.length === 0, pageErrors.join(' | '));
  check('no console errors happened anywhere in the whole run',
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
