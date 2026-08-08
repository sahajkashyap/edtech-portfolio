#!/usr/bin/env node
//
// Reading Assessment Tool — regression tests.
//
// WHAT THIS IS
// ------------
// "Regression" means sliding backward. Every check in this file exists because
// something was once actually broken here. The point is not to prove the tool
// works today — it is so that a bug fixed in August cannot quietly come back in
// November without anybody noticing.
//
// Each check is named for what a PERSON would notice, not for the function
// involved. If you fix a new bug, add its check here on the same day, while you
// still remember what went wrong.
//
// HOW TO RUN IT
// -------------
//     cd ~/Documents/GitHub/edtech-portfolio/reading-assessment-tool/tests
//     npm test
//
// It opens a real Google Chrome in the background, drives the tool with real
// clicks and real typing, and prints a line per check.
//
// node_modules is a symlink to the running record tool's, so nothing needs
// installing here. Add --coverage to also print every line no test ever ran.
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
// Helpers for driving the page
// ---------------------------------------------------------------------------
const covRuns = [];
let COVERAGE = false;
async function harvest(page){
  if (!COVERAGE) return;
  try {
    covRuns.push(...await page.coverage.stopJSCoverage());
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
  } catch (e) { /* coverage not running yet */ }
}

// `load`, not `domcontentloaded`: the PDF library is still in flight when the
// document is parsed, and a check that clicked Export PDF before it landed
// would pass or fail depending on network timing. A test that is right nine
// times out of ten teaches you to ignore red.
//
// "Fresh" is an EMPTY tool belonging to a teacher who has been here before,
// which is the starting point nearly every check below wants. The visited flag
// is set on purpose: on a genuine first arrival the tool now fills itself with
// the sample student, and that belongs in one group of its own rather than
// silently underneath all the others.
async function fresh(page, base){
  await harvest(page);
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.clear();
                              localStorage.setItem('readingVisited', 'yes'); });
  await harvest(page);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

// A stranger who has never opened this page on this laptop.
async function firstVisit(page, base){
  await harvest(page);
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

// Click the E / D / M button on a numbered skill row.
//
// READ THIS BEFORE USING IT FOR ANYTHING ABOUT FOCUS: this calls .click() from
// JavaScript, which never moves the keyboard anywhere. It is a fine way to set
// up a state, and it is the WRONG way to test the scoring gesture itself — the
// un-score check in "Taking a score back" was driven this way and stayed green
// for weeks while the same gesture on a keyboard was broken. Use keyScore().
async function score(page, row, letter){
  await page.evaluate((row, letter) => {
    const btns = document.querySelectorAll('.skill')[row].querySelectorAll('.btn-score');
    ({ E: btns[0], D: btns[1], M: btns[2] })[letter].click();
  }, row, letter);
}

// Score a skill the way a teacher with no mouse does: put the keyboard on the
// button and press a real key.
async function keyScore(page, row, letter, key){
  await page.evaluate((row, letter) => {
    const btns = document.querySelectorAll('.skill')[row].querySelectorAll('.btn-score');
    ({ E: btns[0], D: btns[1], M: btns[2] })[letter].focus();
  }, row, letter);
  await page.keyboard.press(key || 'Enter');
}

// Where the keyboard is standing, if it is standing on a score button at all.
const focusedScoreButton = page => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || !a.classList || !a.classList.contains('btn-score')) {
    return { on: a ? a.tagName.toLowerCase() : 'nothing' };
  }
  return { on: 'score button', row: +a.dataset.skill, level: a.dataset.level,
           pressed: a.getAttribute('aria-pressed') };
});

// Type over what is already in a box, the way somebody replaces text: select
// the lot, then type. Real keys — el.select() only makes the selection.
async function retype(page, sel, text){
  await page.focus(sel);
  await page.$eval(sel, el => el.select());
  await page.keyboard.type(text);
}

const stash = page => page.evaluate(() => {
  const raw = localStorage.getItem('readingStash');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return 'unreadable'; }
});

const counts = page => page.evaluate(() => ({
  e: +document.getElementById('count-e').textContent,
  d: +document.getElementById('count-d').textContent,
  m: +document.getElementById('count-m').textContent
}));

// How much of the chart is actually painted. A shape with no area is, to a
// person looking at the screen, a blank panel.
const chartInk = page => page.evaluate(() => {
  const svg = document.getElementById('pieChart');
  let area = 0;
  svg.querySelectorAll('path, circle').forEach(el => {
    if (el.getAttribute('fill') === 'none') return;      // the dashed placeholder ring
    const b = el.getBBox();
    area += b.width * b.height;
  });
  return { area: Math.round(area), shapes: svg.querySelectorAll('path, circle').length,
           text: svg.textContent.trim() };
});

const msg = page => page.$eval('#sayMsg', e => e.textContent);

// Everything a person can operate on the chart panel, and how it announces
// itself. Measured, not assumed: a click handler on a bare <div> or <path> is
// invisible to a keyboard and to a screen reader.
const drillTargets = page => page.evaluate(() => {
  const out = [];
  document.querySelectorAll('#pieChart path, #pieChart circle, .count-item')
    .forEach(el => {
      if (el.getAttribute('fill') === 'none') return;     // the placeholder ring
      out.push({ tag: el.tagName.toLowerCase(),
                 tabindex: el.getAttribute('tabindex'),
                 role: el.getAttribute('role'),
                 label: el.getAttribute('aria-label') });
    });
  return out;
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
  await page.setViewport({ width: 1280, height: 900 });

  COVERAGE = process.argv.includes('--coverage');
  if (COVERAGE) await page.coverage.startJSCoverage({ resetOnNavigation: false });

  const pageErrors = [], consoleErrors = [], hosts = new Set();
  page.on('pageerror', e => pageErrors.push(e.message));
  // Only real network requests. The CSV download is a data: URI built in the
  // page — it has no host and never touches a network, which is the point.
  page.on('request', r => {
    try {
      const u = new URL(r.url());
      if (u.protocol === 'http:' || u.protocol === 'https:') hosts.add(u.host);
    } catch (e) {}
  });
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // Chrome's message for a failed request is the same generic sentence
    // whatever the file was — the URL lives in location(), not in the text.
    const url = (m.location() && m.location().url) || '';
    if (/favicon/i.test(url)) return;
    consoleErrors.push(m.text() + (url ? '  [' + url + ']' : ''));
  });

  // Anything that would open a window or block on a dialog is stubbed, so the
  // handlers still run and can be inspected.
  await page.evaluateOnNewDocument(() => {
    window.__printed = 0; window.__downloads = [];
    window.print = () => { window.__printed++; };
    window.__confirmAnswer = true;
    window.__confirms = [];
    window.confirm = m => { window.__confirms.push(String(m)); return window.__confirmAnswer; };
    window.alert = m => { window.__alert = String(m); };
    // Catch anchor-triggered CSV downloads instead of writing to disk.
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[download]');
      if (a){
        e.preventDefault();
        window.__downloads.push({ name: a.getAttribute('download'),
                                  href: a.getAttribute('href') || '' });
      }
    }, true);
  });

  // =========================================================================
  group('The page itself');

  await fresh(page, base);
  {
    const mode = await page.evaluate(() => document.compatMode);
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    // THE DEFECT: the file had no doctype line, so Chrome fell back to "quirks
    // mode" — a twenty-year-old box model where padding is not counted in a
    // width. The layout happened to survive, but every CSS check below,
    // including the phone ones, was being measured under the wrong rules.
    check('the page is rendered under modern layout rules, not quirks mode',
          mode === 'CSS1Compat', 'document.compatMode = ' + mode);
    check('the file starts with a doctype line',
          /^<!DOCTYPE html>/i.test(src.trim()), src.slice(0, 40));
  }

  // =========================================================================
  group('What a stranger sees on arrival');

  // THE DEFECT: a stranger landed on a dashed empty ring reading "Nothing
  // scored yet" and three zeros, and had to go and find a button before the
  // tool did anything at all. Every other tool in this portfolio has its charts
  // full on arrival.
  await firstVisit(page, base);
  {
    const c = await counts(page);
    const ink = await chartInk(page);
    const s = await page.evaluate(() => ({
      banner: document.getElementById('sampleBanner').classList.contains('show'),
      initials: document.getElementById('initials').value
    }));
    check('the charts are full the moment a stranger arrives, not after they find a button',
          c.e + c.d + c.m === 6 && ink.area > 5000,
          JSON.stringify(c) + ' ' + JSON.stringify(ink));
    check('and what they are looking at is labelled a made-up child on the same screen',
          s.banner && s.initials === 'M.T.', JSON.stringify(s));
  }

  // The reason this screen was left empty was a good one — nothing may EVER be
  // overwritten on arrival — so the sample only loads when there is provably
  // nothing to lose, and never lets itself back in afterwards.
  await page.click('#sampleBtn');                       // put Maya away
  await reload(page);
  {
    const c = await counts(page);
    const s = await page.evaluate(() => ({
      banner: document.getElementById('sampleBanner').classList.contains('show'),
      initials: document.getElementById('initials').value
    }));
    check('once she has been cleared she does not walk back in on the next reload',
          !s.banner && s.initials === '' && c.e + c.d + c.m === 0,
          JSON.stringify(s) + ' ' + JSON.stringify(c));
  }

  await page.type('#initials', 'R.K.');
  await score(page, 0, 'E');
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'REAL NOTES ABOUT A REAL CHILD');
  await reload(page);
  {
    const s = await page.evaluate(() => ({
      initials: document.getElementById('initials').value,
      strengths: document.getElementById('strengthsComment').value,
      banner: document.getElementById('sampleBanner').classList.contains('show')
    }));
    check('and a real assessment is never overwritten by her on a reload',
          s.initials === 'R.K.' && s.strengths === 'REAL NOTES ABOUT A REAL CHILD' &&
          !s.banner, JSON.stringify(s));
  }

  // =========================================================================
  group('The distribution chart');

  await fresh(page, base);

  {
    const cold = await chartInk(page);
    check('an unscored tool says what the chart is waiting for instead of sitting blank',
          /Nothing scored yet/.test(cold.text), JSON.stringify(cold));
  }

  // THE DEFECT: a whole circle drawn as an SVG arc starts and ends at the same
  // point, so the browser drew nothing. The very first click a visitor made
  // produced an empty chart, and so did any real reading where every skill
  // landed in one band.
  await score(page, 0, 'E');
  {
    const one = await chartInk(page);
    check('the chart draws on the very first click a visitor makes',
          one.area > 5000, JSON.stringify(one));
  }

  for (let i = 1; i < 6; i++) await score(page, i, 'E');
  {
    const same = await chartInk(page);
    const c = await counts(page);
    check('the chart still draws when every skill is the same level',
          same.area > 5000 && c.e === 6, JSON.stringify(same) + ' counts ' + JSON.stringify(c));
    check('the one band is named and counted beside the chart',
          /Emerging . 6/.test(same.text.replace(/\s+/g, ' ')), JSON.stringify(same.text));
  }

  await score(page, 5, 'M');
  {
    const mixed = await chartInk(page);
    check('a mixed reading draws a slice per level',
          mixed.shapes === 2 && mixed.area > 5000, JSON.stringify(mixed));
  }

  // =========================================================================
  await harvest(page);
  group('Reaching the chart without a mouse');

  // THE DEFECT: the pie slices and the three count tiles carried a click
  // handler and nothing else — no tab stop, no role, no label. The drill-down
  // was mouse-only, so a teacher on a keyboard, or anybody using a screen
  // reader, could not open it at all and heard three unnamed boxes.
  await fresh(page, base);
  await score(page, 0, 'E');
  await score(page, 1, 'D');
  {
    const t = await drillTargets(page);
    const slices = t.filter(x => x.tag === 'path' || x.tag === 'circle');
    check('every band of the chart and every count tile is a real button a keyboard can reach',
          t.length === 5 && slices.length === 2 &&
          t.every(x => x.tabindex === '0' && x.role === 'button' && x.label && x.label.length > 3),
          JSON.stringify(t));
    check('each one says out loud which level it is and how many skills are in it',
          t.some(x => /Emerging: 1 skill of 2/.test(x.label || '')) &&
          t.some(x => /Developing: 1 skill of 2/.test(x.label || '')) &&
          t.some(x => /Mastered: nothing scored here yet/.test(x.label || '')),
          JSON.stringify(t.map(x => x.label)));
  }

  // Enter on a slice, the way a keyboard user opens anything.
  await page.evaluate(() => document.querySelector('#pieChart path').focus());
  await page.keyboard.press('Enter');
  {
    const open = await page.$eval('#skillsModal', e => e.classList.contains('show'));
    const listed = await page.$$eval('#modalSkillsList .skill-item', els => els.length);
    const focusIn = await page.evaluate(() =>
      document.querySelector('#skillsModal .modal-content').contains(document.activeElement));
    check('pressing Enter on a slice of the chart opens its list of skills',
          open && listed === 1, `open=${open} listed=${listed}`);
    check('and the keyboard lands inside the box instead of behind it',
          focusIn, 'activeElement was outside the open box');
  }
  await page.keyboard.press('Escape');
  {
    const back = await page.evaluate(() => document.activeElement.tagName.toLowerCase());
    check('closing it puts the keyboard back on the slice it came from',
          back === 'path', 'focus went to <' + back + '>');
  }

  // The space bar on a count tile — and it must not scroll the page instead.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.getElementById('tile-d').focus());
  await page.keyboard.press(' ');
  {
    const open = await page.$eval('#skillsModal', e => e.classList.contains('show'));
    const title = await page.$eval('#modalTitle', e => e.textContent);
    const scrolled = await page.evaluate(() => window.scrollY);
    check('the space bar on a count tile opens that level, and does not scroll the page away',
          open && /Developing/.test(title) && scrolled === 0,
          `open=${open} title=${title} scrollY=${scrolled}`);
  }
  await page.keyboard.press('Escape');

  // A reading where everything landed in one band draws a single full circle
  // rather than slices — that shape needs the same treatment.
  for (let i = 0; i < 6; i++) await score(page, i, 'M');
  {
    const t = await drillTargets(page);
    const ring = t.find(x => x.tag === 'circle');
    check('the single full-circle chart is reachable and named too',
          !!ring && ring.tabindex === '0' && ring.role === 'button' &&
          /Mastered: 6 skills of 6/.test(ring.label || ''), JSON.stringify(t));
  }

  // =========================================================================
  await harvest(page);
  group('Taking a score back');

  await fresh(page, base);
  await score(page, 0, 'E');
  await score(page, 1, 'D');
  await page.type('#strengthsComment', 'Reads with real expression.');
  await score(page, 0, 'E');           // the same button again
  {
    const c = await counts(page);
    const cls = await page.$eval('.skill .btn-score', e => e.className);
    const kept = await page.$eval('#strengthsComment', e => e.value);
    // THE DEFECT: clicking the level a skill already had did nothing, so the
    // only way to undo one mis-tap was Clear — which wiped the other five
    // skills and both comment boxes with it.
    check('a mis-tapped score can be taken back without wiping everything else',
          c.e === 0 && c.d === 1 && cls === 'btn-score' && kept === 'Reads with real expression.',
          JSON.stringify(c) + ' class=' + cls + ' comment=' + JSON.stringify(kept));
    check('the tool says which skill it just un-scored',
          /Score removed/.test(await msg(page)), await msg(page));
  }

  // THE CHECK THAT WAS TESTING THE WRONG MOMENT: everything above this line is
  // driven by score(), which calls element.click() from JavaScript. That route
  // never moves the keyboard, so it could not see — and for weeks did not see —
  // that the SAME gesture was impossible with a keyboard. The hint printed
  // under the skills list tells a teacher to press the same button again, and
  // on a keyboard there was no longer a button to press. From here down, real
  // keys only.
  await fresh(page, base);
  await keyScore(page, 2, 'D', 'Enter');
  {
    const f = await focusedScoreButton(page);
    const c = await counts(page);
    // THE DEFECT: setScore() calls renderSkills(), which empties the list and
    // rebuilds every button — so the button the teacher was standing on was
    // removed from the page and the keyboard landed back on <body>. A
    // keyboard-only teacher had to Tab in from the top of the list again after
    // every single score.
    check('scoring with the keyboard leaves the keyboard on the button it just pressed',
          f.on === 'score button' && f.row === 2 && f.level === 'Developing' &&
          f.pressed === 'true' && c.d === 1,
          JSON.stringify(f) + ' ' + JSON.stringify(c));
  }
  await page.keyboard.press('Enter');
  {
    const c = await counts(page);
    const f = await focusedScoreButton(page);
    check('so the on-screen hint can actually be followed — Enter again takes the score back off',
          c.d === 0 && f.on === 'score button' && f.row === 2 && f.pressed === 'false',
          JSON.stringify(c) + ' ' + JSON.stringify(f));
  }
  await page.keyboard.press(' ');
  {
    const c = await counts(page);
    const kept = await page.$eval('#strengthsComment', e => e.value);
    check('and the space bar scores too, the way it does on any other button',
          c.d === 1 && kept === '', JSON.stringify(c) + ' comment=' + JSON.stringify(kept));
  }

  // =========================================================================
  await harvest(page);
  group('What survives a reload');

  await fresh(page, base);
  await page.type('#initials', 'j.m.');
  await page.$eval('#assessDate', e => { e.value = '2026-08-07';
                                         e.dispatchEvent(new Event('input', { bubbles: true })); });
  await score(page, 2, 'M');
  // THE DEFECT: the comment boxes autosaved on 'change', which does not fire
  // until the box loses focus. A comment typed and then left alone — or the tab
  // closed on it — was simply gone, while a score click one inch away saved
  // instantly.
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'Typed but never clicked away from.');
  {
    const stored = await page.evaluate(() => localStorage.getItem('readingStrengths'));
    check('a comment is saved the moment it is typed, before clicking anywhere else',
          stored === 'Typed but never clicked away from.', JSON.stringify(stored));
  }
  await reload(page);
  {
    const after = await page.evaluate(() => ({
      initials: document.getElementById('initials').value,
      date: document.getElementById('assessDate').value,
      strengths: document.getElementById('strengthsComment').value,
      m: document.getElementById('count-m').textContent
    }));
    eq('the scores, the child, the date and the comments all come back after a reload',
       after, { initials: 'j.m.', date: '2026-08-07',
                strengths: 'Typed but never clicked away from.', m: '1' });
  }

  // =========================================================================
  await harvest(page);
  group('Clear, and getting it back');

  await fresh(page, base);
  await page.type('#initials', 'A.B.');
  await score(page, 0, 'M');
  await score(page, 1, 'D');
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'Loves non-fiction.');

  // THE DEFECT: Clear destroyed the whole assessment on one click. It now asks
  // first, and hands it back.
  await page.evaluate(() => { window.__confirmAnswer = false; });
  await page.click('#clearBtn');
  {
    const c = await counts(page);
    const confirms = await page.evaluate(() => window.__confirms);
    check('Clear asks before it throws an assessment away, and saying no keeps it',
          confirms.length === 1 && c.m === 1 && c.d === 1,
          JSON.stringify(c) + ' confirms=' + JSON.stringify(confirms));
    check('the question says what will be lost and that it can be undone',
          /Undo clear/.test(confirms[0]), confirms[0]);
  }

  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#clearBtn');
  {
    const c = await counts(page);
    const shown = await page.$eval('#undoClearBtn', e => e.className);
    check('saying yes really does clear it', c.m === 0 && c.d === 0, JSON.stringify(c));
    check('and the tool offers Undo clear rather than leaving you stuck',
          /show/.test(shown) && /Undo clear/.test(await msg(page)),
          shown + ' | ' + await msg(page));
  }

  await page.click('#undoClearBtn');
  {
    const back = await page.evaluate(() => ({
      initials: document.getElementById('initials').value,
      strengths: document.getElementById('strengthsComment').value,
      m: document.getElementById('count-m').textContent,
      d: document.getElementById('count-d').textContent,
      stored: localStorage.getItem('readingScores')
    }));
    eq('Undo clear brings back the scores, the child and the comments',
       { initials: back.initials, strengths: back.strengths, m: back.m, d: back.d },
       { initials: 'A.B.', strengths: 'Loves non-fiction.', m: '1', d: '1' });
    check('and writes them back to storage, so a reload keeps them too',
          /Mastered/.test(back.stored || ''), JSON.stringify(back.stored));
  }

  // Undo used to live only in a variable, so a reload — or closing the laptop
  // on a browser that restores tabs — quietly took the way back with it.
  await page.click('#clearBtn');
  await reload(page);
  {
    const s = await page.evaluate(() => ({
      shown: document.getElementById('undoClearBtn').classList.contains('show'),
      label: document.getElementById('undoClearBtn').textContent
    }));
    check('Undo clear is still there after a reload', s.shown && /Undo clear/.test(s.label),
          JSON.stringify(s));
  }
  await page.click('#undoClearBtn');
  {
    const back = await page.evaluate(() => ({
      initials: document.getElementById('initials').value,
      strengths: document.getElementById('strengthsComment').value,
      shown: document.getElementById('undoClearBtn').classList.contains('show'),
      stash: localStorage.getItem('readingStash')
    }));
    eq('and it still hands the whole assessment back, then stops offering',
       back, { initials: 'A.B.', strengths: 'Loves non-fiction.', shown: false, stash: null });
  }

  // =========================================================================
  await harvest(page);
  group('The sample student');

  await fresh(page, base);
  await page.click('#sampleBtn');
  {
    const s = await page.evaluate(() => ({
      banner: document.getElementById('sampleBanner').textContent.trim(),
      shown: document.getElementById('sampleBanner').classList.contains('show'),
      initials: document.getElementById('initials').value,
      date: document.getElementById('assessDate').value,
      strengths: document.getElementById('strengthsComment').value.length,
      stretches: document.getElementById('stretchesComment').value.length,
      btn: document.getElementById('sampleBtn').textContent
    }));
    const c = await counts(page);
    const ink = await chartInk(page);
    check('one click fills the tool so a visitor sees it working',
          s.shown && c.e + c.d + c.m === 6 && s.strengths > 50 && s.stretches > 50 && ink.area > 5000,
          JSON.stringify(s) + ' ' + JSON.stringify(c));
    check('the sample child is Maya Torres, initials M.T.',
          /Maya Torres/.test(s.banner) && s.initials === 'M.T.', JSON.stringify(s));
    check('the sample is labelled on screen as not a real child',
          /Not a real child/i.test(s.banner), s.banner);
    check('her profile is mixed — she is not perfect and not the same on everything',
          c.e > 0 && c.d > 0 && c.m > 0, JSON.stringify(c));
    check('the sample carries a date like a real record would',
          /^\d{4}-\d{2}-\d{2}$/.test(s.date), s.date);
    check('the button now offers to clear her again',
          /Clear the sample/.test(s.btn), s.btn);
    const confirms = await page.evaluate(() => window.__confirms);
    check('an empty tool just fills in — a visitor is not asked to confirm anything',
          confirms.length === 0, JSON.stringify(confirms));
  }

  await reload(page);
  {
    const after = await page.evaluate(() => ({
      shown: document.getElementById('sampleBanner').classList.contains('show'),
      initials: document.getElementById('initials').value
    }));
    // If the flag were not saved, a reload would show Maya's made-up scores
    // with no label on them — the one thing that must never happen.
    check('after a reload the sample is still labelled as a sample',
          after.shown && after.initials === 'M.T.', JSON.stringify(after));
  }

  await page.click('#sampleBtn');
  {
    const c = await counts(page);
    const s = await page.evaluate(() => ({
      shown: document.getElementById('sampleBanner').classList.contains('show'),
      initials: document.getElementById('initials').value,
      strengths: document.getElementById('strengthsComment').value,
      stored: localStorage.getItem('readingScores')
    }));
    check('one click clears the sample student and leaves the tool empty',
          !s.shown && s.initials === '' && s.strengths === '' &&
          c.e + c.d + c.m === 0 && s.stored === null,
          JSON.stringify(s) + ' ' + JSON.stringify(c));
  }

  // =========================================================================
  await harvest(page);
  group('The sample student cannot eat a real assessment');

  // THE DEFECT: "Try it with a sample student" sits an inch from Export and
  // reads like a harmless tour, so a teacher mid-reading clicks it. It used to
  // overwrite a half-finished real assessment with Maya's — no question asked,
  // no Undo offered — and a second click then dropped every key in storage, so
  // the real work was gone for good. Clear had a confirm AND an Undo; the more
  // inviting button had neither.
  await fresh(page, base);
  await page.type('#initials', 'R.K.');
  await score(page, 0, 'E');
  await score(page, 3, 'M');
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'REAL NOTES ABOUT A REAL CHILD');

  await page.evaluate(() => { window.__confirmAnswer = false; });
  await page.click('#sampleBtn');
  {
    const s = await page.evaluate(() => ({
      confirms: window.__confirms,
      initials: document.getElementById('initials').value,
      strengths: document.getElementById('strengthsComment').value,
      stored: localStorage.getItem('readingStrengths'),
      banner: document.getElementById('sampleBanner').classList.contains('show')
    }));
    const c = await counts(page);
    check('it asks first when there is a real assessment on the screen',
          s.confirms.length === 1, JSON.stringify(s.confirms));
    check('the question says what is about to be replaced, and that it can be undone',
          /replaced by Maya Torres/.test(s.confirms[0] || '') &&
          /Bring my assessment back/.test(s.confirms[0] || ''), s.confirms[0]);
    check('saying no changes absolutely nothing — on the screen or in storage',
          s.initials === 'R.K.' && s.strengths === 'REAL NOTES ABOUT A REAL CHILD' &&
          s.stored === 'REAL NOTES ABOUT A REAL CHILD' && !s.banner &&
          c.e === 1 && c.m === 1,
          JSON.stringify(s) + ' ' + JSON.stringify(c));
  }

  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#sampleBtn');
  {
    const s = await page.evaluate(() => ({
      strengths: document.getElementById('strengthsComment').value,
      undoShown: document.getElementById('undoClearBtn').classList.contains('show'),
      undoLabel: document.getElementById('undoClearBtn').textContent
    }));
    check('saying yes loads Maya but offers the way back, the same as Clear does',
          /Maya/.test(s.strengths) && s.undoShown &&
          /Bring my assessment back/.test(s.undoLabel), JSON.stringify(s));
    check('and the tool says out loud that the real assessment is safe',
          /safe/.test(await msg(page)), await msg(page));
  }

  // "Bring my assessment back" is a promise. A promise that expires the moment
  // the tab is reloaded is not one — and reloading, or closing the laptop lid
  // on a browser that restores tabs, is exactly what happens between one child
  // and the next.
  await reload(page);
  {
    const s = await page.evaluate(() => ({
      undoShown: document.getElementById('undoClearBtn').classList.contains('show'),
      undoLabel: document.getElementById('undoClearBtn').textContent,
      banner: document.getElementById('sampleBanner').classList.contains('show')
    }));
    check('the way back is still offered after a reload, not just in the same breath',
          s.undoShown && /Bring my assessment back/.test(s.undoLabel) && s.banner,
          JSON.stringify(s));
  }

  // The second click — "Clear the sample student" — used to be the point of no
  // return, dropping every key in storage including the stashed real work.
  await page.click('#sampleBtn');
  {
    const s = await page.evaluate(() => ({
      initials: document.getElementById('initials').value,
      undoShown: document.getElementById('undoClearBtn').classList.contains('show')
    }));
    check('clearing the sample afterwards still leaves the way back',
          s.initials === '' && s.undoShown, JSON.stringify(s));
  }

  await page.click('#undoClearBtn');
  {
    const back = await page.evaluate(() => ({
      initials: document.getElementById('initials').value,
      strengths: document.getElementById('strengthsComment').value,
      stored: localStorage.getItem('readingStrengths'),
      banner: document.getElementById('sampleBanner').classList.contains('show'),
      sampleFlag: localStorage.getItem('readingSample')
    }));
    const c = await counts(page);
    eq('the real assessment comes back whole — scores, child and comments',
       { initials: back.initials, strengths: back.strengths, stored: back.stored,
         banner: back.banner, e: c.e, m: c.m },
       { initials: 'R.K.', strengths: 'REAL NOTES ABOUT A REAL CHILD',
         stored: 'REAL NOTES ABOUT A REAL CHILD', banner: false, e: 1, m: 1 });
    check('and it is no longer labelled as a sample, because it is not one',
          back.sampleFlag === '', JSON.stringify(back.sampleFlag));
  }

  // =========================================================================
  await harvest(page);
  group('The put-away assessment cannot be destroyed behind your back');

  // Every check in this group is the same shape of bug wearing a different
  // coat: something quietly spent the ONE place this tool has to keep a
  // put-away assessment, and a teacher's real work went with it. Two of them
  // said nothing at all while they did it. The first said the opposite.
  //
  // The group above stops at "clearing the sample afterwards still leaves the
  // way back" — it never pressed the sample button a third time, never pressed
  // Clear while Maya was showing, and never pressed Undo over a new child. All
  // three lost an assessment.

  // --- Clear, pressed while the sample student is on the screen -------------
  // THE DEFECT: clearForm() ran `lastCleared = snapshot('clear')` with no check
  // that a stash was already standing. With Maya on the screen on top of R.K.'s
  // put-away assessment, Clear replaced R.K. with a snapshot of MAYA — and then
  // said "Cleared. Press 'Undo clear' if that was not what you meant". Undo
  // handed back Maya. R.K. was gone for good, under a reassurance that she was
  // not.
  await fresh(page, base);
  await page.evaluate(() => { window.__confirmAnswer = true; window.__confirms = []; });
  await page.type('#initials', 'R.K.');
  await score(page, 0, 'E');
  await score(page, 3, 'M');
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'REAL NOTES ABOUT A REAL CHILD');
  await page.click('#sampleBtn');                       // R.K. put away, Maya loaded
  await page.evaluate(() => { window.__confirms = []; });
  await page.click('#clearBtn');
  {
    const held = await stash(page);
    const s = await page.evaluate(() => ({
      confirms: window.__confirms,
      undoShown: document.getElementById('undoClearBtn').classList.contains('show'),
      undoLabel: document.getElementById('undoClearBtn').textContent,
      msg: document.getElementById('sayMsg').textContent
    }));
    check('Clear does not spend the put-away assessment on a snapshot of the sample student',
          !!held && held.initials === 'R.K.' && held.sample === false &&
          held.strengths === 'REAL NOTES ABOUT A REAL CHILD', JSON.stringify(held));
    check('the way back is still offered, and still named after the real assessment',
          s.undoShown && /Bring my assessment back/.test(s.undoLabel), JSON.stringify(s));
    // The reassurance has to be true. "Undo clear will bring them straight
    // back" over work that has already been destroyed is worse than silence.
    check('and what it says matches what it did, rather than promising back a child it threw away',
          /still here/.test(s.msg) && /Bring my assessment back/.test(s.msg), s.msg);
    check('the question it asked said out loud that the put-away assessment was untouched',
          /R\.K\./.test(s.confirms[0] || '') && /not touched/.test(s.confirms[0] || ''),
          JSON.stringify(s.confirms));
  }
  await page.click('#undoClearBtn');
  {
    const back = await page.evaluate(() => ({
      initials: document.getElementById('initials').value,
      strengths: document.getElementById('strengthsComment').value,
      banner: document.getElementById('sampleBanner').classList.contains('show')
    }));
    const c = await counts(page);
    eq('and the button hands back the real child, not Maya',
       { initials: back.initials, strengths: back.strengths, banner: back.banner,
         e: c.e, m: c.m },
       { initials: 'R.K.', strengths: 'REAL NOTES ABOUT A REAL CHILD', banner: false,
         e: 1, m: 1 });
  }

  // --- the sample button, pressed a third time -----------------------------
  // THE DEFECT: after "Clear the sample student" the screen is empty, so
  // hasRealWork() was false and no new snapshot was taken — and loadSample's
  // `lastCleared = stash || null` then threw the standing rescue away. No
  // confirm, no message; the button simply vanished from the row and R.K. was
  // unrecoverable.
  await fresh(page, base);
  await page.evaluate(() => { window.__confirmAnswer = true; window.__confirms = []; });
  await page.type('#initials', 'R.K.');
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'REAL NOTES ABOUT A REAL CHILD');
  await page.click('#sampleBtn');                       // R.K. put away
  await page.click('#sampleBtn');                       // Maya cleared, R.K. still held
  await page.evaluate(() => { window.__confirms = []; });
  await page.click('#sampleBtn');                       // ...and Maya AGAIN
  {
    const held = await stash(page);
    const s = await page.evaluate(() => ({
      undoShown: document.getElementById('undoClearBtn').classList.contains('show'),
      undoLabel: document.getElementById('undoClearBtn').textContent,
      msg: document.getElementById('sayMsg').textContent
    }));
    check('loading the sample a second time does not drop the assessment already put away',
          !!held && held.initials === 'R.K.' && s.undoShown &&
          /Bring my assessment back/.test(s.undoLabel),
          JSON.stringify(held) + ' ' + JSON.stringify(s));
    check('and it says so, rather than letting a teacher think the way back is gone',
          /safe/.test(s.msg) && /Bring my assessment back/.test(s.msg), s.msg);
  }
  await page.click('#sampleBtn');
  await page.click('#undoClearBtn');
  {
    const back = await page.evaluate(() => ({
      initials: document.getElementById('initials').value,
      strengths: document.getElementById('strengthsComment').value
    }));
    eq('and R.K. is still there to be brought back afterwards',
       back, { initials: 'R.K.', strengths: 'REAL NOTES ABOUT A REAL CHILD' });
  }

  // --- Undo, pressed over a different child --------------------------------
  // THE DEFECT: undoClear() wrote the put-away assessment straight over the
  // screen — no confirm, and no snapshot of what it was discarding. The button
  // sits in the row for as long as something is put away, so a teacher who had
  // moved on to the NEXT child lost that child on one click, with nothing left
  // to press.
  await fresh(page, base);
  await page.evaluate(() => { window.__confirmAnswer = true; window.__confirms = []; });
  await page.type('#initials', 'R.K.');
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'FIRST CHILD NOTES');
  await page.click('#sampleBtn');
  await page.click('#sampleBtn');                       // R.K. put away, screen empty
  await page.type('#initials', 'P.T.');
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'SECOND CHILD NOTES');
  await score(page, 1, 'M');

  await page.evaluate(() => { window.__confirms = []; window.__confirmAnswer = false; });
  await page.click('#undoClearBtn');
  {
    const s = await page.evaluate(() => ({
      confirms: window.__confirms,
      initials: document.getElementById('initials').value,
      strengths: document.getElementById('strengthsComment').value
    }));
    const c = await counts(page);
    check('Undo asks first when there is a different child on the screen',
          s.confirms.length === 1 && /P\.T\./.test(s.confirms[0] || ''),
          JSON.stringify(s.confirms));
    check('and saying no leaves that child exactly as they were',
          s.initials === 'P.T.' && s.strengths === 'SECOND CHILD NOTES' && c.m === 1,
          JSON.stringify(s) + ' ' + JSON.stringify(c));
  }

  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#undoClearBtn');
  {
    const held = await stash(page);
    const s = await page.evaluate(() => ({
      initials: document.getElementById('initials').value,
      strengths: document.getElementById('strengthsComment').value,
      undoLabel: document.getElementById('undoClearBtn').textContent
    }));
    check('saying yes swaps the two rather than destroying one of them',
          s.initials === 'R.K.' && s.strengths === 'FIRST CHILD NOTES' &&
          !!held && held.initials === 'P.T.' && held.strengths === 'SECOND CHILD NOTES',
          JSON.stringify(s) + ' held=' + JSON.stringify(held));
    check('and the button says, in the words on it, that the other one is still there',
          /Bring the other one back/.test(s.undoLabel), s.undoLabel);
  }
  await page.click('#undoClearBtn');
  {
    const s = await page.evaluate(() => ({
      initials: document.getElementById('initials').value,
      strengths: document.getElementById('strengthsComment').value
    }));
    const c = await counts(page);
    eq('and pressing it swaps them straight back, with the second child whole',
       { initials: s.initials, strengths: s.strengths, m: c.m },
       { initials: 'P.T.', strengths: 'SECOND CHILD NOTES', m: 1 });
  }

  // --- Clear, pressed on a tool that is already empty ----------------------
  // The same defect once more: an empty screen is still a snapshot, and taking
  // one wrote nothing over the real assessment the tool was holding.
  await fresh(page, base);
  await page.evaluate(() => { window.__confirmAnswer = true; window.__confirms = []; });
  await page.type('#initials', 'R.K.');
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'REAL NOTES ABOUT A REAL CHILD');
  await page.click('#sampleBtn');
  await page.click('#sampleBtn');                       // empty screen, R.K. held
  await page.evaluate(() => { window.__confirms = []; });
  await page.click('#clearBtn');
  {
    const held = await stash(page);
    const s = await page.evaluate(() => ({ confirms: window.__confirms,
                                           msg: document.getElementById('sayMsg').textContent }));
    check('Clear on an already-empty tool does nothing, instead of spending the way back on nothing',
          s.confirms.length === 0 && !!held && held.initials === 'R.K.' &&
          /nothing to clear/i.test(s.msg),
          JSON.stringify(s) + ' held=' + JSON.stringify(held));
  }

  // --- two real assessments, one place to keep them ------------------------
  // There is only one stash. When it already holds a real assessment, both
  // buttons that would take that place now say so plainly rather than picking a
  // winner in silence.
  await fresh(page, base);
  await page.evaluate(() => { window.__confirmAnswer = true; window.__confirms = []; });
  await page.type('#initials', 'R.K.');
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'FIRST CHILD NOTES');
  await page.click('#sampleBtn');
  await page.click('#sampleBtn');
  await page.type('#initials', 'P.T.');
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'SECOND CHILD NOTES');
  await page.evaluate(() => { window.__confirms = []; window.__confirmAnswer = false; });
  await page.click('#clearBtn');
  await page.click('#sampleBtn');
  {
    const s = await page.evaluate(() => ({
      confirms: window.__confirms,
      initials: document.getElementById('initials').value,
      strengths: document.getElementById('strengthsComment').value
    }));
    const held = await stash(page);
    check('Clear warns, by name, that the earlier assessment cannot be brought back afterwards',
          /R\.K\./.test(s.confirms[0] || '') && /CANNOT be brought back/.test(s.confirms[0] || ''),
          JSON.stringify(s.confirms[0]));
    check('and so does the sample button, in the same words',
          /R\.K\./.test(s.confirms[1] || '') && /CANNOT be brought back/.test(s.confirms[1] || ''),
          JSON.stringify(s.confirms[1]));
    check('saying no to either one changes nothing, on the screen or in the stash',
          s.initials === 'P.T.' && s.strengths === 'SECOND CHILD NOTES' &&
          !!held && held.initials === 'R.K.',
          JSON.stringify(s) + ' held=' + JSON.stringify(held));
  }
  await page.evaluate(() => { window.__confirmAnswer = true; });

  // --- a teacher typing their own child over the sample --------------------
  // THE DEFECT: hasRealWork() opened with `if (sampleLoaded) return false`, so
  // the entire screen counted for nothing the moment Maya was on it. "Clear the
  // sample student" — a button that sounds like it throws away nothing at all —
  // then emptied everything typed on top of her with no question and no way
  // back. The tool now shows the sample on a first arrival, which makes a
  // stranger typing straight over it the likeliest thing that happens here.
  await firstVisit(page, base);
  await page.evaluate(() => { window.__confirmAnswer = true; window.__confirms = []; });
  await retype(page, '#initials', 'J.M.');
  await retype(page, '#strengthsComment', 'MY OWN REAL NOTES');
  {
    const s = await page.evaluate(() => ({
      initials: document.getElementById('initials').value,
      strengths: document.getElementById('strengthsComment').value,
      banner: document.getElementById('sampleBanner').classList.contains('show')
    }));
    check('typing over the sample really does change the screen, and it stays labelled a sample',
          s.initials === 'J.M.' && s.strengths === 'MY OWN REAL NOTES' && s.banner,
          JSON.stringify(s));
  }
  await page.evaluate(() => { window.__confirms = []; window.__confirmAnswer = false; });
  await page.click('#sampleBtn');                       // "Clear the sample student"
  {
    const s = await page.evaluate(() => ({
      confirms: window.__confirms,
      initials: document.getElementById('initials').value,
      strengths: document.getElementById('strengthsComment').value
    }));
    check('"Clear the sample student" asks first once something of yours is typed over her',
          s.confirms.length === 1 && /typed on top of the sample/.test(s.confirms[0] || ''),
          JSON.stringify(s.confirms));
    check('and saying no keeps what you typed',
          s.initials === 'J.M.' && s.strengths === 'MY OWN REAL NOTES', JSON.stringify(s));
  }
  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#sampleBtn');
  {
    const held = await stash(page);
    const s = await page.evaluate(() => ({
      initials: document.getElementById('initials').value,
      undoShown: document.getElementById('undoClearBtn').classList.contains('show')
    }));
    check('and saying yes keeps a way back, instead of emptying the screen for good',
          s.initials === '' && s.undoShown && !!held && held.initials === 'J.M.' &&
          held.strengths === 'MY OWN REAL NOTES', JSON.stringify(s) + ' held=' + JSON.stringify(held));
  }
  await page.click('#undoClearBtn');
  {
    const s = await page.evaluate(() => ({
      initials: document.getElementById('initials').value,
      strengths: document.getElementById('strengthsComment').value
    }));
    eq('and it comes back whole', s, { initials: 'J.M.', strengths: 'MY OWN REAL NOTES' });
  }

  // Maya exactly as she loads is still free to throw away — she is made up, and
  // stopping to ask about her would train a teacher to click through the
  // question above without reading it.
  await firstVisit(page, base);
  await page.evaluate(() => { window.__confirms = []; });
  await page.click('#sampleBtn');
  {
    const s = await page.evaluate(() => ({ confirms: window.__confirms,
      initials: document.getElementById('initials').value }));
    check('but the untouched sample is still cleared in one click, with no question',
          s.confirms.length === 0 && s.initials === '', JSON.stringify(s));
  }

  // =========================================================================
  await harvest(page);
  group('The spreadsheet export');

  await fresh(page, base);
  await page.type('#initials', 'r.k.');
  await page.$eval('#assessDate', e => { e.value = '2026-08-07';
                                         e.dispatchEvent(new Event('input', { bubbles: true })); });
  await score(page, 0, 'M');
  await score(page, 1, 'E');
  await page.click('#strengthsComment');
  // A quote, a comma and a newline — the three things that break a naive CSV.
  await page.type('#strengthsComment', 'She said "I can read it", and did.\nTwice.');
  await page.click('#stretchesComment');
  await page.type('#stretchesComment', 'Blends, but slowly.');
  await page.click('#csvBtn');
  {
    const dl = await page.evaluate(() => window.__downloads[window.__downloads.length - 1]);
    const csv = decodeURIComponent(dl.href.replace(/^data:text\/csv;charset=utf-8,/, ''));
    // THE DEFECT (family): an export that drops the comments it just read.
    check('the spreadsheet contains both comment boxes, quotes and commas intact',
          csv.indexOf('"She said ""I can read it"", and did.\nTwice."') !== -1 &&
          csv.indexOf('"Blends, but slowly."') !== -1, csv.slice(0, 400));
    check('every skill is a row, scored or not',
          (csv.trim().split('\r\n').length) === 7 && /Not scored/.test(csv),
          csv.trim().split('\r\n').length + ' rows');
    check('the child and the date are in the spreadsheet',
          /R\.K\./.test(csv) && /2026-08-07/.test(csv), csv.slice(0, 200));
    // THE DEFECT: every export was called reading_assessment_report, so a
    // second child overwrote the first in the Downloads folder.
    check('the file is named for the child and the date',
          dl.name === 'reading-assessment_RK_2026-08-07.csv', dl.name);
  }

  await page.click('#sampleBtn');
  await page.click('#csvBtn');
  {
    const dl = await page.evaluate(() => window.__downloads[window.__downloads.length - 1]);
    const csv = decodeURIComponent(dl.href.replace(/^data:text\/csv;charset=utf-8,/, ''));
    check('a printed sample can never be mistaken for a real child\'s record',
          /Maya Torres/.test(csv) && /^reading-assessment_SAMPLE-MT_/.test(dl.name),
          dl.name + ' | ' + csv.slice(0, 200));
  }

  // =========================================================================
  await harvest(page);
  group('The PDF export');

  await fresh(page, base);
  // Watch what jsPDF is actually asked to draw, without writing a file.
  await page.evaluate(() => {
    window.__pdf = { text: [], pages: 1, name: null };
    const Real = window.jspdf.jsPDF;
    window.jspdf.jsPDF = function(opts){
      const inst = new Real(opts);
      const realText = inst.text.bind(inst);
      const realAdd  = inst.addPage.bind(inst);
      inst.text = function(t, x, y, o){
        (Array.isArray(t) ? t : [t]).forEach(s =>
          window.__pdf.text.push({ s: String(s), y: y, page: window.__pdf.pages }));
        return realText(t, x, y, o);
      };
      inst.addPage = function(){ window.__pdf.pages++; return realAdd(); };
      inst.save = function(name){ window.__pdf.name = name; };
      return inst;
    };
  });
  await page.type('#initials', 'm.t.');
  await page.$eval('#assessDate', e => { e.value = '2026-08-07';
                                         e.dispatchEvent(new Event('input', { bubbles: true })); });
  await score(page, 0, 'M');
  await page.click('#pdfBtn');
  {
    const p = await page.evaluate(() => window.__pdf);
    const all = p.text.map(t => t.s).join(' | ');
    check('the report says which child it is for, and when',
          /Child: M\.T\./.test(all) && /2026-08-07/.test(all), all.slice(0, 300));
    check('the PDF is named for the child and the date',
          p.name === 'reading-assessment_MT_2026-08-07.pdf', p.name);
  }

  // THE DEFECT: jsPDF writes below the paper edge without complaining, so a
  // long pair of comments simply vanished from the finished report.
  await page.evaluate(() => {
    window.__pdf = { text: [], pages: 1, name: null };
    const long = ('Maya reads with real attention and will talk about a book for as long ' +
                  'as you let her, which is the part I never have to teach. ').repeat(40);
    ['strengthsComment', 'stretchesComment'].forEach(id => {
      const el = document.getElementById(id);
      el.value = long;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  await page.click('#pdfBtn');
  {
    const p = await page.evaluate(() => window.__pdf);
    const lowest = Math.max(...p.text.map(t => t.y));
    const lastLine = p.text[p.text.length - 1].s;
    check('a very long pair of comments still lands on the paper instead of vanishing',
          lowest <= 285 && p.pages > 1, `lowest y=${lowest}mm on a 297mm page, pages=${p.pages}`);
    check('the skills list is still in the report after all that text',
          /Not Scored|Mastered|Developing|Emerging/.test(lastLine), lastLine);
  }

  // A printed sheet must never be able to pass for a real child's record.
  await page.evaluate(() => { window.__pdf = { text: [], pages: 1, name: null }; });
  await page.click('#sampleBtn');
  await page.click('#pdfBtn');
  {
    const p = await page.evaluate(() => window.__pdf);
    const all = p.text.map(t => t.s).join(' | ');
    check('a printed sample report says on the page that it is not a real child',
          /Sample student — Maya Torres \(M\.T\.\) — not a real child/.test(all) &&
          /^reading-assessment_SAMPLE-MT_/.test(p.name), p.name + ' | ' + all.slice(0, 200));
  }

  // =========================================================================
  await harvest(page);
  group('When things go wrong');

  // --- the PDF library cannot be reached (school firewall, no internet) -----
  {
    const p2 = await browser.newPage();
    if (COVERAGE) await p2.coverage.startJSCoverage({ resetOnNavigation: false });
    const errs = [];
    p2.on('pageerror', e => errs.push(e.message));
    await p2.setRequestInterception(true);
    p2.on('request', r => {
      if (/cdnjs\.cloudflare\.com/.test(r.url())) r.abort();
      else r.continue();
    });
    await p2.goto(base + '/index.html', { waitUntil: 'load' });
    // Same origin as the main page, so it inherits whatever that one last
    // saved. Start empty or the counts below are counting somebody else's work
    // — and mark the visit, or the tool quite rightly fills the empty screen
    // with the sample student and the counts are Maya's.
    await p2.evaluate(() => { localStorage.clear();
                              localStorage.setItem('readingVisited', 'yes'); });
    await p2.reload({ waitUntil: 'load' });
    await p2.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
    const noteAtRest = await p2.$eval('#pdfNote', e => e.textContent);
    await p2.evaluate(() => {
      const b = document.querySelectorAll('.skill')[0].querySelectorAll('.btn-score')[0];
      b.click();
    });
    await p2.click('#pdfBtn');
    const said = await p2.$eval('#sayMsg', e => e.textContent);
    const stillWorks = await p2.$eval('#count-e', e => e.textContent);
    // THE DEFECT: this used to throw "Cannot destructure property 'jsPDF'"
    // into a console nobody has open — the main output button just did nothing.
    check('with no internet, Export PDF explains itself instead of doing nothing',
          /did not load/.test(said) && /Export CSV/.test(said), said);
    check('and it warns you before you even click it',
          /unavailable/.test(noteAtRest), noteAtRest);
    check('scoring still works with the PDF library missing, and nothing crashes',
          stillWorks === '1' && errs.length === 0, JSON.stringify(errs));
    await harvest(p2);
    await p2.close();
  }

  // --- the browser refuses to save (Safari private window, full disk) -------
  {
    const p3 = await browser.newPage();
    if (COVERAGE) await p3.coverage.startJSCoverage({ resetOnNavigation: false });
    const errs = [];
    p3.on('pageerror', e => errs.push(e.message));
    await p3.evaluateOnNewDocument(() => {
      const boom = () => { throw new DOMException('QuotaExceededError'); };
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get(){ return { getItem: boom, setItem: boom, removeItem: boom, clear: boom }; }
      });
      // This page needs its own download catcher — evaluateOnNewDocument is per
      // page, and the CSV export below must not write to a real Downloads folder.
      window.__downloads = [];
      document.addEventListener('click', e => {
        const a = e.target.closest && e.target.closest('a[download]');
        if (a){ e.preventDefault(); window.__downloads.push(a.getAttribute('download')); }
      }, true);
    });
    await p3.goto(base + '/index.html', { waitUntil: 'load' });
    await p3.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
    const rendered = await p3.$$eval('.skill', els => els.length);
    const warnOnArrival = await p3.$eval('#storageWarn', e =>
      ({ shown: e.classList.contains('show'), text: e.textContent }));
    await p3.evaluate(() => {
      document.querySelectorAll('.skill')[0].querySelectorAll('.btn-score')[0].click();
    });
    const said = await p3.$eval('#storageWarn', e => e.textContent);
    const c = await p3.$eval('#count-e', e => e.textContent);
    check('a browser that refuses to save says so, loudly, instead of failing silently',
          /NOT BEING SAVED/.test(said), said);
    check('and it says so on arrival, before a whole reading has been typed into nothing',
          warnOnArrival.shown && /NOT BEING SAVED/.test(warnOnArrival.text),
          JSON.stringify(warnOnArrival));
    check('and the tool keeps working so the reading is not interrupted',
          rendered === 6 && c === '1' && errs.length === 0,
          `rows=${rendered} count=${c} errors=${JSON.stringify(errs)}`);

    // THE DEFECT: the warning used to be written to #sayMsg, the one line every
    // other message shares. A single click of Export CSV replaced it with
    // "Spreadsheet saved to your Downloads folder.", that faded after five
    // seconds, and the tool only ever warns once — so a teacher who exported
    // had no sign left that nothing was being kept.
    await p3.click('#csvBtn');
    await p3.evaluate(() => {
      document.querySelectorAll('.skill')[1].querySelectorAll('.btn-score')[2].click();
    });
    await p3.evaluate(() => new Promise(r => setTimeout(r, 5400)));   // past the fade
    const durable = await p3.evaluate(() => ({
      warn: document.getElementById('storageWarn').textContent,
      shown: document.getElementById('storageWarn').classList.contains('show'),
      say: document.getElementById('sayMsg').textContent,
      downloads: window.__downloads.length
    }));
    check('the warning is still on screen after an export, and after the export message fades',
          durable.shown && /NOT BEING SAVED/.test(durable.warn) && durable.downloads === 1,
          JSON.stringify(durable));
    check('it never shared a line with the ordinary messages in the first place',
          !/NOT BEING SAVED/.test(durable.say), JSON.stringify(durable.say));
    await harvest(p3);
    await p3.close();
  }

  // --- one bad value in storage --------------------------------------------
  {
    await fresh(page, base);
    await page.evaluate(() => localStorage.setItem('readingScores', '{not json'));
    const before = pageErrors.length;
    await reload(page);
    const rendered = await page.$$eval('.skill', els => els.length);
    const said = await msg(page);
    // THE DEFECT: the unguarded JSON.parse ran before anything was drawn, so
    // the whole tool was an empty box and nothing said why.
    check('a bad saved value still leaves a working tool, and the tool says what happened',
          rendered === 6 && /could not be read/.test(said) && pageErrors.length === before,
          `rows=${rendered} msg=${said} newErrors=${pageErrors.slice(before).join('; ')}`);
  }

  // --- a bad stash ----------------------------------------------------------
  {
    await fresh(page, base);
    await page.evaluate(() => localStorage.setItem('readingStash', '{not json either'));
    const before = pageErrors.length;
    await reload(page);
    const s = await page.evaluate(() => ({
      rows: document.querySelectorAll('.skill').length,
      undoShown: document.getElementById('undoClearBtn').classList.contains('show'),
      stash: localStorage.getItem('readingStash')
    }));
    // A rescue button that cannot rescue anything is worse than no button, so a
    // stash that will not parse is thrown away rather than offered.
    check('a stash that cannot be read is quietly dropped, not offered as a rescue',
          s.rows === 6 && !s.undoShown && s.stash === null &&
          pageErrors.length === before, JSON.stringify(s));
  }

  // =========================================================================
  await harvest(page);
  group('The skills box');

  await fresh(page, base);
  await score(page, 0, 'E');
  await score(page, 1, 'E');
  await page.click('#tile-e');
  {
    const open = await page.$eval('#skillsModal', e => e.classList.contains('show'));
    const listed = await page.$$eval('#modalSkillsList .skill-item', els => els.length);
    check('clicking a tile opens the list of skills at that level', open && listed === 2,
          `open=${open} listed=${listed}`);
  }
  await page.keyboard.press('Escape');
  {
    const open = await page.$eval('#skillsModal', e => e.classList.contains('show'));
    check('Escape closes the skills box', !open);
  }
  await page.click('#tile-e');
  await page.mouse.click(8, 8);
  {
    const open = await page.$eval('#skillsModal', e => e.classList.contains('show'));
    // THE DEFECT: the small × was the only way out. These are the two gestures
    // everybody tries on a box like this.
    check('clicking outside the skills box closes it', !open);
  }
  await page.click('#tile-e');
  await page.click('#closeModalBtn');
  {
    const open = await page.$eval('#skillsModal', e => e.classList.contains('show'));
    check('the × still closes it too', !open);
  }
  // The × is a <span>, so pressing Enter on it does nothing unless it is wired
  // up — and a keyboard user who tabs to the only visible way out expects it.
  await page.click('#tile-e');
  await page.evaluate(() => document.getElementById('closeModalBtn').focus());
  await page.keyboard.press('Enter');
  {
    const open = await page.$eval('#skillsModal', e => e.classList.contains('show'));
    check('and Enter on the × closes it, for anyone not using a mouse', !open);
  }
  await page.click('#tile-m');
  {
    const txt = await page.$eval('#modalSkillsList', e => e.textContent);
    check('a level with nothing in it says so plainly', /No skills in this category/.test(txt), txt);
    await page.keyboard.press('Escape');
  }

  // =========================================================================
  await harvest(page);
  group('On a phone');

  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await reload(page);
  {
    const m = await page.evaluate(() => {
      const b = document.querySelector('.btn-score').getBoundingClientRect();
      return { scrollWidth: document.documentElement.scrollWidth,
               clientWidth: document.documentElement.clientWidth,
               buttonRight: Math.round(b.right), buttonWidth: Math.round(b.width) };
    });
    // THE DEFECT: the two top panels stayed side by side at 390px, so the whole
    // scoring panel began exactly at the right edge of the screen. A visitor on
    // a phone saw an empty chart, three zeros, and nothing to tap.
    check('on a phone the scoring buttons are on the screen, not off the side of it',
          m.scrollWidth <= m.clientWidth + 1 && m.buttonRight <= m.clientWidth &&
          m.buttonWidth > 20, JSON.stringify(m));

    const list = await page.evaluate(() => {
      const box = document.getElementById('skillsList');
      const last = box.lastElementChild.getBoundingClientRect();
      return { clipped: box.scrollHeight > box.clientHeight + 1,
               lastBottom: Math.round(last.bottom),
               boxBottom: Math.round(box.getBoundingClientRect().bottom) };
    });
    // A scroll box inside a scrolling page hid the sixth skill on a phone, in a
    // box nobody would guess could scroll.
    check('all six skills are on the phone page, not hidden inside a scroll box',
          !list.clipped && list.lastBottom <= list.boxBottom + 1, JSON.stringify(list));
  }

  // Every phone width anybody is likely to hold, not just the one that was
  // broken last time. THE DEFECT: at 320px — an iPhone SE, or a 5s, which
  // plenty of schools still hand out — the page scrolled sideways by 38px,
  // because the three count tiles could not shrink below the width of the word
  // DEVELOPING and a grid item is never allowed under its own minimum width.
  // The check names the offending element, so the next one is a five-second fix
  // instead of a hunt.
  for (const w of [320, 360, 375, 390, 414, 768]){
    await page.setViewport({ width: w, height: 800, isMobile: true });
    await reload(page);
    const m = await page.evaluate(() => {
      const edge = document.documentElement.clientWidth;
      const over = [];
      document.querySelectorAll('*').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0) return;
        if (r.right > edge + 0.5 || r.left < -0.5){
          const name = el.id || String(el.className.baseVal !== undefined
                                       ? el.className.baseVal : el.className) || el.tagName;
          over.push(name.trim().split(/\s+/)[0] + ' ' +
                    Math.round(r.left) + '..' + Math.round(r.right));
        }
      });
      return { scrollWidth: document.documentElement.scrollWidth, clientWidth: edge,
               over: over.slice(0, 5) };
    });
    check('nothing hangs off the side of a ' + w + 'px screen',
          m.scrollWidth <= m.clientWidth && m.over.length === 0, JSON.stringify(m));
  }
  await page.setViewport({ width: 1280, height: 900 });

  // =========================================================================
  await harvest(page);
  group('Nothing leaves the laptop');

  {
    const offsite = [...hosts].filter(h => !/^127\.0\.0\.1/.test(h) &&
                                           h !== 'cdnjs.cloudflare.com');
    check('the only thing fetched from the internet is the PDF library',
          offsite.length === 0, JSON.stringify([...hosts]));
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    check('no fetch, XHR, WebSocket or beacon anywhere in the file',
          !/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(src));
  }

  check('no page errors anywhere in the whole run', pageErrors.length === 0,
        pageErrors.join('\n'));
  check('no console errors anywhere in the whole run', consoleErrors.length === 0,
        consoleErrors.join('\n'));

  // =========================================================================
  // Coverage: not whether the tests PASS but whether they LOOK at everything.
  if (COVERAGE){
    await harvest(page);
    group('Coverage');
    // Every page load produces its own record for index.html and some of them
    // are stubs. Merge the bytes that ran across ALL of them onto the longest
    // copy of the text — taking only the first record reported "0 of 0", which
    // looks like a coverage tool working and is a coverage tool measuring
    // nothing.
    const runs = covRuns.filter(e => /index\.html/.test(e.url) && e.text);
    const entries = runs.length
      ? [runs.reduce((a, b) => (b.text.length > a.text.length ? b : a))]
      : [];
    for (const entry of entries){
      const text = entry.text;
      entry.ranges = runs.filter(r => r.text === text)
                         .reduce((acc, r) => acc.concat(r.ranges), []);
      const used = new Uint8Array(text.length);
      entry.ranges.forEach(r => { for (let i = r.start; i < r.end; i++) used[i] = 1; });

      // Chrome hands back the SCRIPT BODY for an inline script, not the HTML
      // file. Sniffing for a "<script>" substring got this wrong the moment the
      // tool's own code mentioned one in a comment: close came back -1 and the
      // report cheerfully said "0 of 0" — a coverage tool measuring nothing
      // looks exactly like a coverage tool working. Decide by what the text
      // actually starts with.
      const isHtml = text.trimStart().startsWith('<');
      const tag  = isHtml ? text.indexOf('<script>') : -1;
      const open = tag === -1 ? 0 : tag + '<script>'.length;
      const close = tag === -1 ? text.length : text.lastIndexOf('</script>');

      let lineShift = 0;
      if (tag === -1){
        const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
        const at = html.indexOf('<script>');
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
      dead.forEach(d => console.log(`    ${DIM}index.html:${d.ln}${X}  ${d.code.slice(0, 96)}`));

    }
  }

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
