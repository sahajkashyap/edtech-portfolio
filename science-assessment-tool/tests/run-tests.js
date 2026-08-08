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
// clicks and real keypresses, and prints a line per check. node_modules here is
// a symlink to the running-record tool's, so there is nothing to install.
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

// `load`, not `domcontentloaded`: a stylesheet or a CDN script still in flight
// when the first assertion ran landed in the console-error list a fraction of
// the time, so the same suite passed or failed depending on network timing.
async function fresh(page, base){
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

// Click the E / D / M button on skill row `row` (0-based).
async function score(page, row, letter){
  const idx = { E: 0, D: 1, M: 2 }[letter];
  const btns = await page.$$('#skillsList .skill');
  const b = await btns[row].$$('.btn-score');
  await b[idx].click();
}

// Run exportPDF() and hand back everything it laid on the paper, without
// writing a file. jsPDF hangs save/text/addPage off the INSTANCE, not off the
// prototype — patching the prototype quietly captures nothing — so this wraps
// the constructor the page reads out of window.jspdf and patches each new
// document as it is made.
const capturePdf = page => page.evaluate(() => {
  const real = window.jspdf.jsPDF;
  const got = { name: null, pages: 1, lines: [] };
  window.jspdf = { jsPDF: function(opts){
    const doc = new real(opts);
    const rt = doc.text.bind(doc), ra = doc.addPage.bind(doc);
    doc.text = (txt, x, y, o) => {
      [].concat(txt).forEach(line => got.lines.push({ txt: String(line), y: y, page: got.pages }));
      return rt(txt, x, y, o);
    };
    doc.addPage = function(){ got.pages++; return ra.apply(null, arguments); };
    doc.save = name => { got.name = name; return doc; };
    return doc;
  } };
  try { exportPDF(); } finally { window.jspdf = { jsPDF: real }; }
  return got;
});

const chartInk = page => page.evaluate(() => {
  // "Did anything actually get painted?" — measured the way a person sees it,
  // as the drawn area of the shapes, not as the number of elements.
  const svg = document.getElementById('pieChart');
  let area = 0;
  svg.querySelectorAll('path, circle').forEach(el => {
    const b = el.getBBox();
    area += b.width * b.height;
  });
  return Math.round(area);
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

  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // Chrome's message for a failed request is the same generic sentence
    // whatever the file was — the URL lives in location(), not in the text.
    const url = (m.location() && m.location().url) || '';
    if (/favicon/i.test(url)) return;
    consoleErrors.push(m.text() + (url ? '  [' + url + ']' : ''));
  });

  // Anything that would open a window or block on a dialog is stubbed, so the
  // handlers still run all the way through and can be inspected.
  await page.evaluateOnNewDocument(() => {
    window.__printed = 0; window.__downloads = []; window.__confirms = [];
    window.print = () => { window.__printed++; };
    window.__confirmAnswer = true;
    window.confirm = msg => { window.__confirms.push(String(msg)); return window.__confirmAnswer; };
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
  group('It opens');
  // =========================================================================
  await fresh(page, base);

  check('the page opens with no JavaScript errors',
        pageErrors.length === 0, pageErrors.join(' | '));
  check('the page opens with no console errors',
        consoleErrors.length === 0, consoleErrors.join(' | '));

  const mode = await page.evaluate(() => ({
    compat: document.compatMode, lang: document.documentElement.lang,
    doctype: !!document.doctype
  }));
  eq('the browser reads the page in standards mode, not the 1990s one',
     mode, { compat: 'CSS1Compat', lang: 'en', doctype: true });

  eq('all six science skills are on screen',
     await page.$$eval('#skillsList .skill', els => els.length), 6);

  // =========================================================================
  group('The chart draws something the moment you touch it');
  // =========================================================================
  await fresh(page, base);
  check('an untouched form says "No scores yet" instead of showing a blank box',
        (await page.$eval('#pieChart', s => s.textContent)).includes('No scores yet'));

  await score(page, 0, 'M');
  const oneClick = await chartInk(page);
  check('the chart draws after the very first click', oneClick > 5000,
        'drawn area was ' + oneClick);
  eq('and the Mastered tally reads 1',
     await page.$eval('#count-m', e => e.textContent), '1');

  // All six at the same level was the case that painted literally nothing: a
  // full-circle arc starts and ends at the same point and collapses.
  await fresh(page, base);
  for (let i = 0; i < 6; i++) await score(page, i, 'E');
  const allSame = await chartInk(page);
  check('the chart still draws when every skill is at the same level',
        allSame > 5000, 'drawn area was ' + allSame);

  await score(page, 5, 'M');
  const mixed = await chartInk(page);
  check('and it still draws when the levels are mixed', mixed > 5000,
        'drawn area was ' + mixed);

  // =========================================================================
  group('A mis-tapped score can be taken back');
  // =========================================================================
  await fresh(page, base);
  await score(page, 0, 'E');
  eq('tapping E scores the skill Emerging',
     await page.evaluate(() => Object.values(scores)), ['Emerging']);
  await score(page, 0, 'E');
  eq('tapping the same E again takes the score back off',
     await page.evaluate(() => Object.values(scores)), []);
  eq('and the Emerging tally goes back to zero',
     await page.$eval('#count-e', e => e.textContent), '0');

  // =========================================================================
  group('Scoring from the keyboard, with no mouse at all');
  // =========================================================================
  // Scoring rebuilds every button in the list, so the button under the keyboard
  // was destroyed and focus fell back to <body>. Taking a mis-tap back off needs
  // a SECOND press on the SAME button — and there was nothing left to press, so
  // a keyboard-only teacher had to Tab in from the top of the list after every
  // single score. The take-it-back-off feature worked for a mouse only.
  await fresh(page, base);
  const label = 'Developing: Demonstrates curiosity and engagement';
  await page.evaluate(l => {
    document.querySelector('.btn-score[aria-label="' + l + '"]').focus();
  }, label);
  await page.keyboard.press('Enter');
  const afterEnter = await page.evaluate(() => ({
    tally: document.getElementById('count-d').textContent,
    focus: document.activeElement.getAttribute('aria-label'),
    tag: document.activeElement.tagName,
    pressed: document.activeElement.getAttribute('aria-pressed')
  }));
  eq('Enter on a score button scores the skill', afterEnter.tally, '1');
  eq('and the keyboard is still on that same button afterwards, not thrown to the page',
     { tag: afterEnter.tag, label: afterEnter.focus },
     { tag: 'BUTTON', label: label });
  eq('the button now reads as pressed to a screen reader', afterEnter.pressed, 'true');

  await page.keyboard.press(' ');
  const afterSpace = await page.evaluate(() => ({
    tally: document.getElementById('count-d').textContent,
    focus: document.activeElement.getAttribute('aria-label'),
    pressed: document.activeElement.getAttribute('aria-pressed')
  }));
  eq('Space on the same button straight after takes the score back off',
     afterSpace.tally, '0');
  eq('and the keyboard has still not moved', afterSpace.focus, label);
  eq('and the button reads as unpressed again', afterSpace.pressed, 'false');

  // Tab has to keep working from where the keyboard actually is.
  await page.keyboard.press('Tab');
  eq('Tab from there moves on to the next level, not back to the top of the page',
     await page.evaluate(() => document.activeElement.getAttribute('aria-label')),
     'Mastered: Demonstrates curiosity and engagement');

  // =========================================================================
  group('Who was assessed, and when');
  // =========================================================================
  await fresh(page, base);
  const whoFields = await page.evaluate(() => ({
    max: document.getElementById('initials').maxLength,
    hasDate: !!document.getElementById('adate'),
    dateFilled: document.getElementById('adate').value,
    badge: document.body.textContent.includes('Stays on this laptop'),
    noNameField: !document.querySelector('input[placeholder*="name" i]')
  }));
  eq('there is an initials box (four characters), a date and the laptop badge',
     { max: whoFields.max, hasDate: whoFields.hasDate, badge: whoFields.badge,
       noNameField: whoFields.noNameField },
     { max: 4, hasDate: true, badge: true, noNameField: true });
  check('the date starts on today so a teacher does not have to fill it in',
        /^\d{4}-\d{2}-\d{2}$/.test(whoFields.dateFilled), whoFields.dateFilled);

  // =========================================================================
  group('What a visitor actually sees the moment they arrive');
  // =========================================================================
  // There WAS a check called "the chart is populated for a visitor who has only
  // just arrived" — but it was measured after an explicit click on "Try it with
  // a sample student", so it was describing the arrival and measuring a click
  // later. It has been renamed to say what it measures, and the arrival itself
  // is measured here, on a cold load with empty storage.
  await fresh(page, base);
  const arrival = await page.evaluate(() => {
    const visible = el => !!el && el.offsetParent !== null;
    return {
      chart: document.getElementById('pieChart').textContent,
      counts: ['e', 'd', 'm'].map(k => document.getElementById('count-' + k).textContent).join('/'),
      banner: visible(document.getElementById('sampleBanner')),
      undo: visible(document.getElementById('undoBar')),
      // Maya is in the page markup from the start, inside the hidden banner, so
      // "does the text appear anywhere" would say yes. Only leaf elements a
      // person can actually see are counted.
      mayaOnScreen: [...document.querySelectorAll('*')]
        .some(el => visible(el) && el.children.length === 0 && /Maya/.test(el.textContent))
    };
  });
  eq('an untouched form shows an empty ring, no scores, no banner and no sample child',
     arrival, { chart: 'No scores yet', counts: '0/0/0', banner: false,
                undo: false, mayaOnScreen: false });
  // The empty ring is drawn, so "was anything drawn" is not the question — the
  // question is whether any of the three LEVEL colours are on it yet.
  const arrivalColours = await page.evaluate(() => {
    const levelColours = ['#378ADD', '#BA7517', '#639922'];
    return [...document.querySelectorAll('#pieChart path, #pieChart circle, #pieChart rect')]
      .map(el => el.getAttribute('fill'))
      .filter(f => levelColours.includes(f));
  });
  eq('and no level is coloured in on the chart until one is tapped', arrivalColours, []);

  // =========================================================================
  group('The sample student — Maya Torres');
  // =========================================================================
  await fresh(page, base);
  await page.click('button[onclick="fillSample()"]');
  const sample = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    named: document.body.textContent.includes('Maya Torres'),
    bannerShown: document.getElementById('sampleBanner').style.display !== 'none',
    levels: Object.values(scores),
    strengths: document.getElementById('strengthsComment').value.length,
    stretches: document.getElementById('stretchesComment').value.length
  }));
  eq('one click fills the tool with M.T.', sample.initials, 'M.T.');
  check('she is named on screen as a sample, so nobody mistakes her for a real child',
        sample.named && sample.bannerShown);
  eq('all six skills are scored', sample.levels.length, 6);
  check('her profile is mixed — not the same level all the way down',
        new Set(sample.levels).size === 3, sample.levels.join(', '));
  check('both comment boxes are filled in too',
        sample.strengths > 40 && sample.stretches > 40);

  const sampleInk = await chartInk(page);
  // Named for the moment it actually measures. It used to be called "the chart
  // is populated for a visitor who has only just arrived", which is a different
  // moment entirely — that one is measured in the group above.
  check('the chart is populated after one click on "Try it with a sample student"',
        sampleInk > 5000, 'drawn area was ' + sampleInk);

  await page.click('#sampleBanner button');
  const afterClear = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    scored: Object.keys(scores).length,
    strengths: document.getElementById('strengthsComment').value,
    banner: document.getElementById('sampleBanner').style.display
  }));
  eq('one click clears her again and the form is empty',
     afterClear, { initials: '', scored: 0, strengths: '', banner: 'none' });

  // =========================================================================
  group('The sample student cannot eat a real assessment');
  // =========================================================================
  // "Try it with a sample student" is the friendliest-looking button on the
  // page and it sits in the same row as Clear. It used to overwrite the scores,
  // both comments and the initials — on screen AND in localStorage — with
  // Maya's, with no question asked, no Undo offered and no copy of the real
  // child left anywhere. Clear had a confirm and an Undo; this one had neither.
  const realChild = async () => {
    await score(page, 0, 'E');
    await score(page, 1, 'M');
    await score(page, 2, 'D');
    await page.click('#initials');
    await page.type('#initials', 'R.K.');
    await page.click('#strengthsComment');
    await page.type('#strengthsComment', 'Rosa named every shell she found.');
    await page.click('#stretchesComment');
    await page.type('#stretchesComment', 'Rosa needs a second try on the ramp.');
  };

  await fresh(page, base);
  await realChild();
  await page.evaluate(() => { window.__confirms = []; window.__confirmAnswer = false; });
  await page.click('button[onclick="fillSample()"]');
  const refused = await page.evaluate(() => ({
    asked: window.__confirms.length,
    text: window.__confirms[0] || '',
    initials: document.getElementById('initials').value,
    scores: Object.values(scores),
    strengths: document.getElementById('strengthsComment').value,
    stretches: document.getElementById('stretchesComment').value
  }));
  check('loading the sample over a real assessment asks first', refused.asked === 1,
        'confirm boxes: ' + refused.asked);
  check('and the question says the work on screen is what gets replaced, and that Undo exists',
        /Undo/i.test(refused.text) && /scores/i.test(refused.text) &&
        /comments/i.test(refused.text), refused.text);
  eq('saying no leaves the real child exactly as they were',
     { i: refused.initials, s: refused.scores,
       a: refused.strengths.slice(0, 4), b: refused.stretches.slice(0, 4) },
     { i: 'R.K.', s: ['Emerging', 'Mastered', 'Developing'], a: 'Rosa', b: 'Rosa' });

  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('button[onclick="fillSample()"]');
  const swapped = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    undo: document.getElementById('undoBar').offsetParent !== null,
    // The real child must survive SOMEWHERE, not just in a variable.
    rosaInStorage: Object.keys(localStorage)
      .some(k => (localStorage.getItem(k) || '').includes('Rosa'))
  }));
  eq('saying yes does load the sample', swapped.initials, 'M.T.');
  check('but an Undo is offered straight away', swapped.undo);
  check('and the real child is still written down somewhere, not only on screen',
        swapped.rosaInStorage);

  // The reported way to lose it twice over: swap the sample in, then press the
  // banner's own "Clear the sample". That used to empty everything with no
  // confirm and no Undo either.
  await page.click('#sampleBanner button');
  check('pressing "Clear the sample" straight afterwards does not take the Undo away',
        await page.evaluate(() => document.getElementById('undoBar').offsetParent !== null));
  await page.reload({ waitUntil: 'load' });
  check('and neither does a refresh',
        await page.evaluate(() => document.getElementById('undoBar').offsetParent !== null));

  await page.click('#undoClear');
  const rosaBack = await page.evaluate(() => ({
    initials: document.getElementById('initials').value,
    scores: Object.values(scores),
    strengths: document.getElementById('strengthsComment').value,
    stretches: document.getElementById('stretchesComment').value,
    banner: document.getElementById('sampleBanner').offsetParent !== null,
    counts: ['e', 'd', 'm'].map(k => document.getElementById('count-' + k).textContent).join('/'),
    stored: localStorage.getItem('scienceStrengths')
  }));
  eq('Undo puts the real child back — scores, initials and both comments',
     { i: rosaBack.initials, s: rosaBack.scores, a: rosaBack.strengths,
       b: rosaBack.stretches, banner: rosaBack.banner, n: rosaBack.counts },
     { i: 'R.K.', s: ['Emerging', 'Mastered', 'Developing'],
       a: 'Rosa named every shell she found.',
       b: 'Rosa needs a second try on the ramp.', banner: false, n: '1/1/1' });
  check('and their comment is back in storage too, not just on the screen',
        rosaBack.stored === 'Rosa named every shell she found.', rosaBack.stored);

  // The question must not turn up when there is nothing to lose — a visitor
  // arriving at an empty form still gets the sample in one click.
  await fresh(page, base);
  await page.evaluate(() => { window.__confirms = []; });
  await page.click('button[onclick="fillSample()"]');
  const onEmpty = await page.evaluate(() => ({
    asked: window.__confirms.length,
    initials: document.getElementById('initials').value,
    undo: document.getElementById('undoBar').offsetParent !== null
  }));
  eq('an empty form still fills with the sample in one click, with no question asked',
     onEmpty, { asked: 0, initials: 'M.T.', undo: false });
  await page.click('#sampleBanner button');
  eq('and clearing the sample nobody has touched is still one click',
     await page.evaluate(() => ({ asked: window.__confirms.length,
                                  scored: Object.keys(scores).length })),
     { asked: 0, scored: 0 });

  // Once a teacher has typed over the sample it is their work, not Maya's.
  await fresh(page, base);
  await page.click('button[onclick="fillSample()"]');
  await page.evaluate(() => { window.__confirms = []; });
  await page.evaluate(() => {
    const t = document.getElementById('stretchesComment');
    t.value += ' He also counted the legs on every bug.';
    t.dispatchEvent(new Event('input'));
  });
  await page.click('#sampleBanner button');
  const clearedOwn = await page.evaluate(() => ({
    asked: window.__confirms.length,
    scored: Object.keys(scores).length,
    undo: document.getElementById('undoBar').offsetParent !== null
  }));
  eq('but clearing a sample a teacher has written over asks first, and offers Undo',
     clearedOwn, { asked: 1, scored: 0, undo: true });
  await page.click('#undoClear');
  check('and that Undo brings the written-over sample back',
        await page.evaluate(() =>
          document.getElementById('stretchesComment').value.includes('counted the legs') &&
          Object.keys(scores).length === 6));

  // =========================================================================
  group('Typing your own initials over the sample\'s');
  // =========================================================================
  // "M.T." is exactly the four characters the box holds, so clicking in and
  // typing — the natural way to start a real assessment over the sample — did
  // literally nothing: the box was full and every keystroke was refused. The
  // box read as a dead control.
  await fresh(page, base);
  await page.click('button[onclick="fillSample()"]');
  await page.click('#initials');
  const selected = await page.evaluate(() => {
    const i = document.getElementById('initials');
    return { start: i.selectionStart, end: i.selectionEnd };
  });
  await page.keyboard.type('R.K.');
  const retyped = await page.$eval('#initials', i => i.value);
  eq('clicking the Child box selects the sample initials, so the first key replaces them',
     selected, { start: 0, end: 4 });
  eq('typing over them leaves the teacher\'s own initials, not "M.T."', retyped, 'R.K.');
  eq('and the box still holds four characters at most — initials, never a name',
     await page.$eval('#initials', i => i.maxLength), 4);

  // =========================================================================
  group('Undo survives a refresh');
  // =========================================================================
  // Undo used to live in a memory variable while Clear had already dropped all
  // six storage keys — so a reload, a closed lid or a crash between the two lost
  // the assessment for good, with the confirm box still promising "Undo appears
  // straight after and puts it all back".
  await fresh(page, base);
  await realChild();
  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('button[onclick="clearForm()"]');
  await page.reload({ waitUntil: 'load' });
  check('the Undo offer is still on the page after a refresh',
        await page.evaluate(() => document.getElementById('undoBar').offsetParent !== null));
  await page.click('#undoClear');
  const afterReloadUndo = await page.evaluate(() => ({
    scores: Object.values(scores),
    initials: document.getElementById('initials').value,
    strengths: document.getElementById('strengthsComment').value,
    stored: Object.keys(JSON.parse(localStorage.getItem('scienceScores') || '{}')).length,
    offerGone: document.getElementById('undoBar').offsetParent === null,
    keyGone: localStorage.getItem('scienceUndo') === null
  }));
  eq('and it still puts the whole assessment back after that refresh',
     { s: afterReloadUndo.scores, i: afterReloadUndo.initials,
       a: afterReloadUndo.strengths.slice(0, 4), stored: afterReloadUndo.stored },
     { s: ['Emerging', 'Mastered', 'Developing'], i: 'R.K.', a: 'Rosa', stored: 3 });
  check('and the offer is cleared away once it has been used, on screen and in storage',
        afterReloadUndo.offerGone && afterReloadUndo.keyGone,
        JSON.stringify(afterReloadUndo));

  // =========================================================================
  group('Nothing is lost on a refresh');
  // =========================================================================
  await fresh(page, base);
  await score(page, 0, 'M');
  await score(page, 1, 'D');
  await page.type('#initials', 'A.B.');
  // Typed and NEVER blurred — the old auto-save listened for 'change', which
  // only fires when the box loses focus, so this whole comment used to vanish.
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'TYPED BUT NEVER BLURRED');
  await page.reload({ waitUntil: 'load' });
  const back = await page.evaluate(() => ({
    scores: Object.values(scores),
    strengths: document.getElementById('strengthsComment').value,
    initials: document.getElementById('initials').value,
    counts: document.getElementById('count-m').textContent +
            document.getElementById('count-d').textContent
  }));
  eq('a comment typed and never clicked out of is still there after a refresh',
     back.strengths, 'TYPED BUT NEVER BLURRED');
  eq('the scores come back too', back.scores, ['Mastered', 'Developing']);
  eq('and so do the initials', back.initials, 'A.B.');
  eq('and the tallies are redrawn', back.counts, '11');

  // =========================================================================
  group('When the browser refuses to save');
  // =========================================================================
  // Safari private windows and a full disk both throw here. Silence used to
  // mean a teacher scored a whole child into nothing.
  await fresh(page, base);
  await page.evaluate(() => {
    localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  });
  await score(page, 0, 'E');
  // "What can a teacher actually read on the screen right now?" — the warning
  // used to be measured in one particular element, which hid the fact that
  // another message could paint over it.
  const onScreen = () => page.evaluate(() =>
    [...document.querySelectorAll('.saved')]
      .filter(e => e.offsetParent !== null)
      .map(e => e.textContent).join(' ~ '));

  const warn = await onScreen();
  check('the tool says out loud that nothing is being saved',
        /NOT BEING SAVED|NOTHING IS BEING SAVED/i.test(warn), JSON.stringify(warn));
  check('and the score still lands on screen so the sitting is not interrupted',
        (await page.$eval('#count-e', e => e.textContent)) === '1');
  check('a storage failure does not throw a JavaScript error at the page',
        pageErrors.length === 0, pageErrors.join(' | '));

  // The warning was said once, behind a flag that never reset, into the same
  // line every other message uses. One "CSV saved to your Downloads folder."
  // painted over it and it never came back — so a teacher scored five more
  // skills into nothing while looking at a reassuring green line.
  await page.click('button[onclick="exportCsv()"]');
  const afterCsv = await onScreen();
  check('exporting a CSV does not paint over the warning',
        /NOTHING IS BEING SAVED/i.test(afterCsv), JSON.stringify(afterCsv));

  await score(page, 1, 'D');
  await score(page, 2, 'M');
  const stillWarned = await page.evaluate(() => ({
    text: [...document.querySelectorAll('.saved')]
            .filter(e => e.offsetParent !== null).map(e => e.textContent).join(' ~ '),
    stored: localStorage.getItem('scienceScores'),
    red: getComputedStyle(document.getElementById('storageMsg')).color
  }));
  check('and it is still there after five more clicks, while nothing is really being stored',
        /NOTHING IS BEING SAVED/i.test(stillWarned.text) && stillWarned.stored === null,
        JSON.stringify(stillWarned.text) + ' stored=' + stillWarned.stored);
  check('the tool never claims the work is saved while storage is refusing',
        !/Saved on this laptop/i.test(stillWarned.text), JSON.stringify(stillWarned.text));
  check('and the warning is still the red one, not styled like good news',
        stillWarned.red === 'rgb(164, 39, 27)', stillWarned.red);

  // Chained with &&, a failure on the first key skipped the other five outright.
  await fresh(page, base);
  await page.evaluate(() => {
    const real = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (k, v) => {
      if (k === 'scienceScores') throw new Error('QuotaExceededError');
      return real(k, v);
    };
  });
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'She sorted the shells by size.');
  await score(page, 0, 'E');
  const partial = await page.evaluate(() => ({
    strengths: localStorage.getItem('scienceStrengths'),
    date: localStorage.getItem('scienceDate')
  }));
  check('one key failing does not stop the other five being written',
        partial.strengths === 'She sorted the shells by size.' && !!partial.date,
        JSON.stringify(partial));

  // =========================================================================
  group('Clear asks first, and can be undone');
  // =========================================================================
  await fresh(page, base);
  await score(page, 0, 'E');
  await page.type('#strengthsComment', 'She sorted the leaves by edge shape.');
  await page.evaluate(() => { window.__confirmAnswer = false; });
  await page.click('button[onclick="clearForm()"]');
  const cancelled = await page.evaluate(() => ({
    asked: window.__confirms.length,
    text: window.__confirms[0] || '',
    scored: Object.keys(scores).length,
    strengths: document.getElementById('strengthsComment').value
  }));
  check('Clear asks before it does anything', cancelled.asked === 1);
  check('and the question says what will go and that Undo exists',
        /Undo/i.test(cancelled.text) && /scores/i.test(cancelled.text), cancelled.text);
  check('saying no keeps the score and the comment',
        cancelled.scored === 1 && cancelled.strengths.length > 10);

  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('button[onclick="clearForm()"]');
  // offsetParent, not existence: the Undo button is in the page markup from the
  // start now, so "is it in the document?" would pass without it being visible.
  const seen = sel => page.evaluate(s => {
    const el = document.querySelector(s);
    return !!el && el.offsetParent !== null;
  }, sel);

  const wiped = await page.evaluate(() => ({
    scored: Object.keys(scores).length,
    strengths: document.getElementById('strengthsComment').value
  }));
  eq('saying yes clears it', { scored: wiped.scored, strengths: wiped.strengths },
     { scored: 0, strengths: '' });
  check('and an Undo button is sitting there', await seen('#undoClear'));

  // Undo used to be appended to the shared message line, so the very next
  // message removed it — one more score, one export, and the only copy of the
  // assessment was stranded in memory with no way on screen to reach it.
  await score(page, 2, 'M');
  check('Undo is still there after scoring something else', await seen('#undoClear'));
  await page.click('button[onclick="exportCsv()"]');
  check('Undo is still there after an export', await seen('#undoClear'));
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'typing something new');
  await new Promise(r => setTimeout(r, 2200));   // outlive the 1.6s "Saved" line
  check('Undo is still there after typing, and after the Saved line has come and gone',
        await seen('#undoClear'));

  await page.click('#undoClear');
  const restored = await page.evaluate(() => ({
    scores: Object.values(scores),
    strengths: document.getElementById('strengthsComment').value,
    counts: document.getElementById('count-e').textContent
  }));
  eq('Undo puts the score and the comment back',
     { s: restored.scores, c: restored.strengths.slice(0, 10), n: restored.counts },
     { s: ['Emerging'], c: 'She sorted', n: '1' });
  check('and the Undo offer goes away once it has been used',
        !(await seen('#undoClear')));

  // =========================================================================
  group('The CSV carries everything on screen');
  // =========================================================================
  await fresh(page, base);
  await page.type('#initials', 'A.B.');
  await score(page, 0, 'M');
  await score(page, 1, 'E');
  // Commas, quotes and a newline — the three things a naive CSV mangles.
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'Curious, careful, and quick.\nShe said "it floats!" out loud.');
  await page.click('#stretchesComment');
  await page.type('#stretchesComment', 'Needs a second try, every time.');
  await page.click('button[onclick="exportCsv()"]');
  const dl = await page.evaluate(() => window.__downloads[window.__downloads.length - 1]);
  const csv = decodeURIComponent(dl.href.replace(/^data:text\/csv;charset=utf-8,/, ''));

  check('the exported file is named for the child and the date, not the same name every time',
        /A B|AB/.test(dl.name) && /\d{4}-\d{2}-\d{2}\.csv$/.test(dl.name), dl.name);
  check('the child and the date are in the spreadsheet',
        csv.includes('A.B.') && csv.includes(new Date().getFullYear() + '-'));
  check('the comment survives its commas, its quote marks and its line break',
        csv.includes('"Curious, careful, and quick.\nShe said ""it floats!"" out loud."'),
        csv.slice(0, 400));
  check('the second comment box is in there as well',
        csv.includes('Needs a second try, every time.'));
  eq('every one of the six skills has a row, scored or not',
     csv.split('\r\n').length - 1, 6);
  check('an unscored skill says so rather than coming out blank',
        csv.includes(',Not scored,'));

  // =========================================================================
  group('Export PDF when the PDF library never arrived');
  // =========================================================================
  // A school firewall, an outage, or a plane. This used to be a dead button and
  // an uncaught TypeError in a console nobody was looking at.
  const blocked = await browser.newPage();
  const blockedErrors = [];
  blocked.on('pageerror', e => blockedErrors.push(e.message));
  await blocked.setRequestInterception(true);
  blocked.on('request', r => {
    if (/cdnjs|cloudflare/.test(r.url())) r.abort();
    else r.continue();
  });
  await blocked.goto(base + '/index.html', { waitUntil: 'load' });
  // Chrome shares one profile across pages, so this tab inherits whatever the
  // earlier checks saved. Start it empty or the tallies below count two
  // children at once.
  await blocked.evaluate(() => localStorage.clear());
  await blocked.reload({ waitUntil: 'load' });
  await blocked.evaluate(() => { document.querySelectorAll('.btn-score')[0].click(); });
  await blocked.click('button[onclick="exportPDF()"]');
  const told = await blocked.$eval('#saveMsg', e => e.textContent);
  check('the tool explains that the PDF library did not load',
        /did not load/i.test(told), JSON.stringify(told));
  check('and points at what still works',
        /CSV/i.test(told) && /Print/i.test(told), JSON.stringify(told));
  check('nothing is thrown at the page',
        blockedErrors.length === 0, blockedErrors.join(' | '));
  check('scoring still works with the CDN blocked',
        (await blocked.$eval('#count-e', e => e.textContent)) === '1');
  await blocked.close();

  // =========================================================================
  group('The PDF itself');
  // =========================================================================
  await fresh(page, base);
  await page.type('#initials', 'A.B.');
  for (let i = 0; i < 6; i++) await score(page, i, 'D');
  // A verbose teacher: the old export checked the page height once, after both
  // comment blocks were written, so lines were drawn below the bottom edge of
  // the paper and were simply not in the file.
  const long = 'This is a long comment about what happened at the science table. ';
  await page.evaluate(t => {
    document.getElementById('strengthsComment').value = t;
    document.getElementById('stretchesComment').value = t;
    document.getElementById('strengthsComment').dispatchEvent(new Event('input'));
    document.getElementById('stretchesComment').dispatchEvent(new Event('input'));
  }, long.repeat(80));
  const pdfOut = await capturePdf(page);
  check('the PDF is named for the child and the date',
        /AB/.test(pdfOut.name) && /\d{4}-\d{2}-\d{2}\.pdf$/.test(pdfOut.name), pdfOut.name);
  check('a very long comment runs onto a second page instead of off the bottom of the first',
        pdfOut.pages >= 2, 'pages: ' + pdfOut.pages);
  check('the child and the date are printed on the report',
        pdfOut.lines.some(m => /Child: A\.B\./.test(m.txt) && /Date: \d{4}-/.test(m.txt)),
        JSON.stringify(pdfOut.lines.slice(0, 4)));
  // A4 is 297mm tall. Text drawn below that edge is in the file and invisible
  // in every PDF reader — which is exactly how the old export lost thirteen
  // lines of a long comment.
  check('no line is drawn below the bottom edge of the paper',
        pdfOut.lines.every(m => m.y > 0 && m.y < 297),
        JSON.stringify(pdfOut.lines.filter(m => m.y <= 0 || m.y >= 297).slice(0, 3)));
  check('all six skills are on the report',
        pdfOut.lines.filter(m => /: Developing$/.test(m.txt)).length === 6,
        JSON.stringify(pdfOut.lines.filter(m => /Developing/.test(m.txt))));
  // Both boxes hold the same sentence 80 times, so the word "science" has to
  // appear 160 times on the paper. Counting words rather than lines, because a
  // line break can land in the middle of a phrase.
  const saidScience = (pdfOut.lines.map(m => m.txt).join(' ').match(/science/g) || []).length;
  check('not one word of a very long comment is dropped',
        saidScience === 160, 'the word "science" was drawn ' + saidScience + ' times, expected 160');

  // The sample child has to be unmistakable on paper too, or a printed sheet
  // could be filed as a real child's record.
  await fresh(page, base);
  await page.click('button[onclick="fillSample()"]');
  const samplePdf = await capturePdf(page);
  check('a printed sample report says on it that Maya Torres is an example',
        samplePdf.lines.some(m => /Sample student/.test(m.txt) && /Maya Torres/.test(m.txt)),
        samplePdf.lines.slice(0, 5).map(m => m.txt).join(' | '));
  check('and the sample file name says SAMPLE too',
        /SAMPLE/.test(samplePdf.name), samplePdf.name);
  const sampleCsv = await page.evaluate(() => {
    exportCsv();
    return window.__downloads[window.__downloads.length - 1];
  });
  check('the sample CSV is labelled too',
        decodeURIComponent(sampleCsv.href).includes('Sample student') &&
        /SAMPLE/.test(sampleCsv.name), sampleCsv.name);

  // =========================================================================
  group('The pop-up list of skills');
  // =========================================================================
  await fresh(page, base);
  await score(page, 0, 'E');
  await page.click('.count-item.e');
  check('clicking the Emerging tile opens the list',
        await page.$eval('#skillsModal', m => m.classList.contains('show')));
  await page.keyboard.press('Escape');
  check('Escape closes it',
        !(await page.$eval('#skillsModal', m => m.classList.contains('show'))));
  await page.click('.count-item.e');
  await page.mouse.click(5, 5);
  check('clicking outside it closes it too',
        !(await page.$eval('#skillsModal', m => m.classList.contains('show'))));
  const reachable = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.count-item')];
    const close = document.querySelector('.close-modal');
    return tiles.every(t => t.tagName === 'BUTTON') && close.tagName === 'BUTTON';
  });
  check('a keyboard can reach the tiles and the close button', reachable);

  // =========================================================================
  group('On a phone');
  // =========================================================================
  // One width was checked here before — 390, a modern iPhone — and it passed
  // while a 320px iPhone SE still scrolled sideways by 14px. Every phone width a
  // visitor is likely to hold is checked now, narrowest first.
  const PHONES = [
    [320, 'an iPhone SE or iPhone 5, 320px'],
    [360, 'a small Android, 360px'],
    [375, 'an iPhone 8 or SE 2, 375px'],
    [390, 'an iPhone 13, 390px'],
    [414, 'a large iPhone, 414px']
  ];
  // Every width here used to be measured straight after fresh(), which empties
  // the form — so all five were measuring a BLANK page, never a filled one, and
  // the row that would not fit is a row of numbers. Each width is now measured
  // with the sample student loaded: six scored rows, a chart with three colours
  // and a legend, the sample banner, and two full comment boxes. The empty form
  // is checked for sideways scroll as well, since that is what a visitor meets
  // first.
  for (const [w, name] of PHONES){
    await page.setViewport({ width: w, height: 844 });
    await fresh(page, base);
    const emptyOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - window.innerWidth);
    check('an empty form does not scroll sideways on ' + name,
          emptyOverflow <= 0, 'overflow ' + emptyOverflow + 'px');

    await page.click('button[onclick="fillSample()"]');
    const phone = await page.evaluate(() => {
      const b = document.querySelector('#skillsList .btn-score').getBoundingClientRect();
      const wide = [...document.querySelectorAll('*')]
        .filter(el => Math.round(el.getBoundingClientRect().right) > window.innerWidth)
        .map(el => el.tagName + '.' + el.className);
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        buttonRight: Math.round(b.right),
        inner: window.innerWidth,
        wide: wide.slice(0, 4)
      };
    });
    check('a filled-in assessment does not scroll sideways on ' + name,
          phone.overflow <= 0,
          'overflow ' + phone.overflow + 'px, off the edge: ' + phone.wide.join(', '));
    check('the score buttons are on the screen on ' + name,
          phone.buttonRight <= phone.inner, JSON.stringify(phone));
    // The three tallies are the thing that would not fit at 320: three
    // unbreakable words in one row.
    const tiles = await page.evaluate(() =>
      [...document.querySelectorAll('.count-item')].map(t => ({
        right: Math.round(t.getBoundingClientRect().right),
        label: t.querySelector('.count-label').textContent,
        num: t.querySelector('.count-num').textContent,
        clipped: t.scrollWidth > t.clientWidth + 1
      })));
    check('the Emerging / Developing / Mastered tallies fit and are readable, with the ' +
          'sample\'s real numbers in them, on ' + name,
          tiles.every(t => t.right <= phone.inner && !t.clipped) &&
          tiles.map(t => t.num).join('') === '222', JSON.stringify(tiles));
  }
  await page.setViewport({ width: 1280, height: 900 });

  // =========================================================================
  group('Nothing leaves the laptop');
  // =========================================================================
  const requested = [];
  const watch = await browser.newPage();
  watch.on('request', r => requested.push(r.url()));
  await watch.goto(base + '/index.html', { waitUntil: 'load' });
  await watch.evaluate(() => { document.querySelectorAll('.btn-score')[0].click(); });
  await watch.evaluate(() => {
    document.getElementById('strengthsComment').value = 'x';
    document.getElementById('strengthsComment').dispatchEvent(new Event('input'));
  });
  const offSite = requested.filter(u => !u.startsWith(base) &&
                                        !u.startsWith('data:') &&
                                        !/cdnjs\.cloudflare\.com/.test(u));
  eq('the only thing fetched from outside is the PDF library', offSite, []);
  // html2canvas was downloaded on every single visit and never called once.
  check('the unused image library is not downloaded any more',
        !requested.some(u => /html2canvas/.test(u)),
        requested.filter(u => /html2canvas/.test(u)).join(' | '));
  check('and no request carries a child\'s work anywhere',
        !requested.some(u => /initials|score|comment=/.test(u)));
  await watch.close();

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
