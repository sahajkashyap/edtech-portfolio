#!/usr/bin/env node
//
// UFLI Foundations Tracker — regression tests.
//
// WHAT THIS IS
// ------------
// "Regression" means sliding backward. Every check in this file exists because
// something was once actually broken here. The point is not to prove the tool
// works today — it is so that a bug fixed in August cannot quietly come back in
// November without anybody noticing.
//
// Each check is named for what a PERSON would notice, not for the function
// involved. If you fix a new bug, add its check here the same day, while you
// still remember what went wrong.
//
// HOW TO RUN IT
// -------------
//     cd ~/Documents/GitHub/edtech-portfolio/phonics-assessment-tool/tests
//     npm test
//
// It opens a real Google Chrome in the background, drives the tool with real
// clicks and real typing, and prints a line per check.
//
// It needs nothing on the internet. The tool pulls its PDF library from a CDN;
// these tests answer that request themselves, so the suite behaves the same on
// a plane as it does at a desk.
//
// node_modules is a SYMLINK to ../../running-record-tool/tests/node_modules —
// puppeteer-core is shared rather than installed twice. Nothing to install.
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
// Coverage. Chrome throws its record away on every navigation and this suite
// reloads a lot, so harvest before each one and start a new record. What gets
// reported is then every line the WHOLE run executed, not just the last page.
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

// `load`, not `domcontentloaded`: a stylesheet still in flight when the first
// assertion ran used to land in the console-error list a fraction of the time,
// so the same suite passed or failed depending on timing. A test that is right
// nine times out of ten teaches you to ignore red.
async function fresh(page, base){
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

// ---------------------------------------------------------------------------
// Driving the tool the way a teacher does
// ---------------------------------------------------------------------------
async function pickUnit(page, unit){
  await page.select('#unitSelect', unit);
}

// A real click on a real score button, found by reading the row's own text —
// the same way a teacher finds it.
async function clickScore(page, lessonName, letter){
  const idx = await page.evaluate(n => {
    const rows = [...document.querySelectorAll('#lessonsList > .lesson')];
    return rows.findIndex(r =>
      r.querySelector('.lesson-name').textContent.split(':')[0].trim() === n) + 1;
  }, lessonName);
  if (!idx) throw new Error('no row on screen for ' + lessonName);
  const j = { E: 1, D: 2, M: 3 }[letter];
  await page.click(`#lessonsList > .lesson:nth-child(${idx}) .score-buttons button:nth-child(${j})`);
}

// Standing on a score button the way Tab does, then leaving the hands there.
// The list is thrown away and rebuilt on every score, so the button has to be
// found again by what it IS (this lesson, this level) and not by where it sat.
async function standOnScore(page, lessonName, level){
  return page.evaluate((n, lv) => {
    const b = document.querySelector(
      '#lessonsList .btn-score[data-lesson="' + n + '"][data-level="' + lv + '"]');
    if (!b) return false;
    b.focus();
    return document.activeElement === b;
  }, lessonName, level);
}

// Where the keyboard is standing right now. `body` is the answer that means the
// keyboard was thrown away: from there the next key does nothing useful and the
// only way back into the list is Tab, from the top of the document.
const keyboardOn = page => page.evaluate(() => {
  const a = document.activeElement;
  return { tag: a ? a.tagName : 'none',
           lesson: (a && a.dataset) ? a.dataset.lesson : undefined,
           level:  (a && a.dataset) ? a.dataset.level  : undefined,
           pressed: (a && a.getAttribute) ? a.getAttribute('aria-pressed') : null };
});

const tallies = page => page.evaluate(() => ({
  e: +document.getElementById('count-e').textContent,
  d: +document.getElementById('count-d').textContent,
  m: +document.getElementById('count-m').textContent
}));

// Which half of the sample banner is on screen, and whether its way out is
// really visible rather than merely present in the markup.
const bannerState = page => page.evaluate(() => {
  const vis = id => {
    const n = document.getElementById(id);
    return !!(n && n.offsetParent !== null);
  };
  return {
    shown: document.getElementById('sampleBanner').classList.contains('show'),
    plain: vis('sampleBannerPlain'),
    mixed: vis('sampleBannerMixed'),
    fixBtn: vis('startMineBtn'),
    text: document.getElementById('sampleBanner').textContent.replace(/\s+/g, ' ').trim()
  };
});

// Typing over what is already in a box, the way a person does: select the lot,
// then type. Appending would test nothing — the sample's initials already fill
// the four characters the box allows.
async function typeOver(page, id, text){
  await page.evaluate(i => {
    const n = document.getElementById(i);
    n.focus(); n.select();
  }, id);
  await page.keyboard.type(text);
}

// What is actually PAINTED in the chart — measured, not counted. A path can
// exist in the DOM and cover nothing at all, which is exactly the bug this
// guards against.
const chartInk = page => page.evaluate(() => {
  const svg = document.getElementById('pieChart');
  return [...svg.querySelectorAll('path, circle')]
    .filter(n => n.getAttribute('fill') && n.getAttribute('fill') !== 'none')
    .map(n => {
      const r = n.getBoundingClientRect();
      return { tag: n.tagName, w: Math.round(r.width), h: Math.round(r.height),
               fill: n.getAttribute('fill') };
    });
});

const saved = page => page.evaluate(() => {
  const raw = localStorage.getItem('ufli-assessment');
  return raw ? JSON.parse(raw) : null;
});

const sayText = page => page.evaluate(() => document.getElementById('sayMsg').textContent);

// A fake PDF library, so the report can be checked without anything on the
// internet. It records every line of text the tool asks for and the filename
// it saves under.
const FAKE_JSPDF = () => {
  window.__pdf = { lines: [], file: null, pages: 1 };
  function Doc(){
    this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
  }
  Doc.prototype.setFontSize = function(){};
  Doc.prototype.setTextColor = function(){};
  Doc.prototype.addPage = function(){ window.__pdf.pages++; };
  // Wraps at roughly the same width the real library does, so the page-break
  // arithmetic in the tool is genuinely exercised rather than skipped.
  Doc.prototype.splitTextToSize = function(t, w){
    const out = [], limit = Math.max(20, Math.floor(w / 2));
    String(t).split('\n').forEach(para => {
      let line = '';
      para.split(' ').forEach(word => {
        if (line && (line + ' ' + word).length > limit){ out.push(line); line = word; }
        else line = line ? line + ' ' + word : word;
      });
      out.push(line);
    });
    return out;
  };
  Doc.prototype.text = function(t){
    (Array.isArray(t) ? t : [t]).forEach(line => window.__pdf.lines.push(String(line)));
  };
  Doc.prototype.save = function(name){ window.__pdf.file = name; };
  window.jspdf = { jsPDF: Doc };
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
  await page.setViewport({ width: 1280, height: 1000 });

  COVERAGE = process.argv.includes('--coverage');
  if (COVERAGE) await page.coverage.startJSCoverage({ resetOnNavigation: false });

  // The tool loads its PDF library from cdnjs. These tests answer that request
  // themselves so the suite never depends on the network — and so the
  // "CDN is blocked" check below is a decision this file makes, not weather.
  let BLOCK_CDN = false;
  await page.setRequestInterception(true);
  page.on('request', r => {
    if (/cdnjs\.cloudflare\.com/.test(r.url())){
      if (BLOCK_CDN) return r.abort().catch(() => {});
      return r.respond({ status: 200, contentType: 'text/javascript',
                         body: '/* stubbed by run-tests.js */' }).catch(() => {});
    }
    r.continue().catch(() => {});
  });

  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // Chrome's message for a failed request is the same generic sentence
    // whatever the file was — the URL lives in location(), not in the text.
    const url = (m.location() && m.location().url) || '';
    if (/favicon/i.test(url)) return;
    if (/cdnjs\.cloudflare\.com/.test(url)) return;   // blocked on purpose below
    consoleErrors.push(m.text() + (url ? '  [' + url + ']' : ''));
  });

  await page.evaluateOnNewDocument(() => {
    window.__opened = []; window.__downloads = []; window.__childCopy = '';
    window.__confirmed = [];
    window.__confirmAnswer = true;
    window.confirm = msg => { window.__confirmed.push(String(msg)); return window.__confirmAnswer; };
    window.alert = msg => { window.__alert = String(msg); };
    window.open = () => {
      window.__opened.push(1);
      window.__childCopy = '';
      return { document: { write(h){ window.__childCopy += h; }, close(){}, open(){},
                           readyState: 'complete' },
               addEventListener(_, fn){ fn(); }, focus(){}, print(){}, close(){} };
    };
    // Catch the export downloads instead of writing them to disk, and keep the
    // file's CONTENTS as well as its name — a filename alone proves nothing.
    const realCreate = URL.createObjectURL;
    URL.createObjectURL = blob => {
      const url = realCreate.call(URL, blob);
      const rd = new FileReader();
      rd.onload = () => { window.__lastBlobText = rd.result; };
      rd.readAsText(blob);
      window.__lastBlob = url;
      return url;
    };
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[download]');
      if (a){ e.preventDefault(); window.__downloads.push(a.getAttribute('download')); }
    }, true);
  });

  const lastDownload = async () => {
    // The blob is read asynchronously; give the FileReader its turn.
    await page.evaluate(() => new Promise(r => setTimeout(r, 60)));
    return page.evaluate(() => ({
      name: window.__downloads[window.__downloads.length - 1],
      text: window.__lastBlobText || ''
    }));
  };

  // =========================================================================
  group('Opening the tool');
  // =========================================================================
  await fresh(page, base);

  check('page loads with no JavaScript errors',
        pageErrors.length === 0, pageErrors.join(' | '));
  check('page loads with no console errors',
        consoleErrors.length === 0, consoleErrors.join(' | '));

  // =========================================================================
  group('The sample student  (was: a stranger arrived at an empty white page)');
  // =========================================================================
  {
    const t = await tallies(page);
    check('a first-time visitor arrives with the tool already filled in',
          t.e + t.d + t.m > 0, JSON.stringify(t));

    const banner = await page.evaluate(() => {
      const b = document.getElementById('sampleBanner');
      return { shown: b.classList.contains('show'), text: b.textContent.replace(/\s+/g, ' ').trim() };
    });
    check('the page says on screen that this is a sample student, not a real child',
          banner.shown && /Sample student/i.test(banner.text), JSON.stringify(banner));
    check('the sample student is named Maya Torres',
          /Maya Torres/.test(banner.text), banner.text);

    eq('the sample student\'s initials are M.T.',
       await page.evaluate(() => document.getElementById('initials').value), 'M.T.');
    check('the sample student has a date on her',
          /^\d{4}-\d{2}-\d{2}$/.test(await page.evaluate(() =>
            document.getElementById('assessDate').value)));

    check('the sample student has a mixed profile — some strong, some not',
          t.e > 0 && t.d > 0 && t.m > 0, JSON.stringify(t));
    check('the sample student is not perfect', t.e + t.d > 0, JSON.stringify(t));
    check('both comment boxes are filled in for her',
          await page.evaluate(() =>
            document.getElementById('strengthsComment').value.length > 30 &&
            document.getElementById('stretchesComment').value.length > 30));
    check('the chart has something in it on arrival',
          (await chartInk(page)).some(s => s.w > 10 && s.h > 10));
  }

  // =========================================================================
  group('Clearing the sample  (one press, and she does not come back)');
  // =========================================================================
  {
    eq('the button offers to clear her',
       await page.evaluate(() => document.getElementById('sampleBtn').textContent),
       'Clear the sample');
    await page.click('#sampleBtn');
    const t = await tallies(page);
    eq('one press empties the tool', t, { e: 0, d: 0, m: 0 });
    eq('and empties the initials box',
       await page.evaluate(() => document.getElementById('initials').value), '');
    check('and the sample notice is gone',
          await page.evaluate(() =>
            !document.getElementById('sampleBanner').classList.contains('show')));
    eq('the button now offers to bring her back',
       await page.evaluate(() => document.getElementById('sampleBtn').textContent),
       'Try it with a sample student');

    await reload(page);
    const after = await tallies(page);
    eq('she does not walk back in after a reload', after, { e: 0, d: 0, m: 0 });

    await page.click('#sampleBtn');
    check('and she can be asked back for on purpose',
          (await tallies(page)).m > 0);
    await page.click('#sampleBtn');   // back to empty for the checks below
  }

  // =========================================================================
  group('Typing your own initials over the sample  (was: your initials sitting ' +
        'on top of her made-up scores, with nothing saying so)');
  // =========================================================================
  await fresh(page, base);
  {
    const arrival = await bannerState(page);
    check('on arrival the banner simply introduces her',
          arrival.shown && arrival.plain && !arrival.mixed, JSON.stringify(arrival));

    await typeOver(page, 'initials', 'J.M.');
    const mixed = await bannerState(page);
    check('the moment the Child box stops saying M.T., the banner changes what it says',
          mixed.mixed && !mixed.plain, JSON.stringify(mixed));
    check('and what it says is that the scores on screen are still hers',
          /still Maya Torres/i.test(mixed.text), mixed.text.slice(0, 160));
    check('with a button right there to put it right',
          mixed.fixBtn, JSON.stringify(mixed));

    // The safe direction the tool already erred in must not be lost: while the
    // two are mixed, every export still says out loud that this is the sample.
    await page.click('button[onclick="exportCSV()"]');
    const half = await lastDownload();
    check('and until it is put right the export still owns up to being a sample',
          /SAMPLE/.test(half.name) && /Maya Torres/.test(half.text), half.name);

    await typeOver(page, 'stretchesComment', 'Mine, about a real child in my room.');
    // A real mouse press, and only if the button is genuinely on screen. Calling
    // its handler directly would pass even with the button hidden — and clicking
    // a hidden button crashes the run instead of failing one line, which would
    // take the other 200 checks down with it.
    if (mixed.fixBtn) await page.click('#startMineBtn');

    eq('one press and every made-up score is gone',
       await tallies(page), { e: 0, d: 0, m: 0 });
    eq('the initials typed are still there',
       await page.evaluate(() => document.getElementById('initials').value), 'J.M.');
    eq('and so is what was written',
       await page.evaluate(() => document.getElementById('stretchesComment').value),
       'Mine, about a real child in my room.');
    eq('her words are not left behind in the other box',
       await page.evaluate(() => document.getElementById('strengthsComment').value), '');
    check('the sample notice is gone',
          !(await bannerState(page)).shown);
    check('and the unit stays open, so the lessons do not disappear from under the teacher',
          await page.evaluate(() =>
            document.getElementById('unitSelect').value !== '' &&
            document.querySelectorAll('#lessonsList > .lesson').length > 0),
          await page.evaluate(() => document.getElementById('unitSelect').value));
    eq('and the button goes back to offering her',
       await page.evaluate(() => document.getElementById('sampleBtn').textContent),
       'Try it with a sample student');

    await page.click('button[onclick="exportCSV()"]');
    const mine = await lastDownload();
    check('the export is no longer marked as a sample', !/SAMPLE/.test(mine.name), mine.name);
    check('and she is not named anywhere inside it', !/Maya/.test(mine.text));
    check('while the teacher\'s own note is', /real child in my room/.test(mine.text));

    await reload(page);
    eq('none of her scores come back after a reload',
       await tallies(page), { e: 0, d: 0, m: 0 });
    check('and neither does the sample notice',
          !(await bannerState(page)).shown);
    eq('what the teacher typed survives the reload',
       await page.evaluate(() => document.getElementById('initials').value), 'J.M.');
  }

  // =========================================================================
  group('BLOCKER: the chart still draws when every skill is at the same level');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');            // clear Maya, start empty
  await pickUnit(page, 'Unit 3: Digraphs');
  {
    await clickScore(page, 'Lesson 42', 'E');
    const oneClick = await chartInk(page);
    check('the chart draws after the very first click a stranger makes',
          oneClick.length === 1 && oneClick[0].w > 10 && oneClick[0].h > 10,
          JSON.stringify(oneClick));
    eq('and it is drawn in the Emerging colour', oneClick[0].fill, '#378ADD');

    for (const n of [42,43,44,45,46,47,48,49,50,51,52,53])
      await clickScore(page, 'Lesson ' + n, 'M');
    const allSame = await chartInk(page);
    const t = await tallies(page);
    eq('all twelve lessons are mastered', t, { e: 0, d: 0, m: 12 });
    check('the chart is a full circle when every scored lesson is Mastered',
          allSame.length === 1 && allSame[0].w > 90 && allSame[0].h > 90,
          JSON.stringify(allSame));
    eq('and it is drawn in the Mastered colour', allSame[0].fill, '#639922');

    await clickScore(page, 'Lesson 47', 'D');
    const mixed = await chartInk(page);
    check('two levels still draw as two slices',
          mixed.length === 2 && mixed.every(s => s.w > 0 && s.h > 0),
          JSON.stringify(mixed));

    const legend = await page.evaluate(() =>
      [...document.querySelectorAll('#pieChart text')].map(t => t.textContent));
    check('the chart names its bands, so one solid colour still says which band it is',
          legend.some(t => /Mastered/.test(t)) && legend.some(t => /Developing/.test(t)),
          JSON.stringify(legend));

    // SVG clips at the edge of its viewBox without a word of complaint, so a
    // key that is a few units too wide loses its last characters — on a phone
    // it read "Mastered — 39 (68".
    const clipped = await page.evaluate(() => {
      const vb = document.getElementById('pieChart').viewBox.baseVal;
      return [...document.querySelectorAll('#pieChart text')]
        .filter(t => t.getBBox().x + t.getBBox().width > vb.width - 2)
        .map(t => t.textContent);
    });
    check('none of the key is cut off at the edge of the chart',
          clipped.length === 0, clipped.join(' | '));
  }

  // =========================================================================
  group('The chart with nothing scored  (was: a large blank white box)');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');
  {
    const words = await page.evaluate(() =>
      [...document.querySelectorAll('#pieChart text')].map(t => t.textContent).join(' '));
    check('an unscored tool says so instead of showing an empty box',
          /No scores yet/i.test(words), words);
    check('and that message is not cut off at the edge either',
          (await page.evaluate(() => {
            const vb = document.getElementById('pieChart').viewBox.baseVal;
            return [...document.querySelectorAll('#pieChart text')]
              .filter(t => t.getBBox().x + t.getBBox().width > vb.width - 2).length;
          })) === 0);
    eq('and the tallies read zero', await tallies(page), { e: 0, d: 0, m: 0 });
  }

  // =========================================================================
  group('Who was assessed  (was: no name, no date, anywhere)');
  // =========================================================================
  {
    const who = await page.evaluate(() => {
      const i = document.getElementById('initials');
      return {
        maxlength: i.getAttribute('maxlength'),
        placeholder: i.getAttribute('placeholder'),
        label: document.querySelector('label[for="initials"]').textContent,
        privacy: document.querySelector('.privacy').textContent,
        // Nothing anywhere should be asking for a child's full name.
        namey: [...document.querySelectorAll('input, textarea')]
          .filter(n => /(full ?)?name/i.test((n.placeholder || '') + ' ' + (n.id || '')))
          .map(n => n.id)
      };
    });
    eq('the child field takes initials only — four characters', who.maxlength, '4');
    check('it is labelled for a person, not a database', /child/i.test(who.label), who.label);
    check('nothing on the page asks for a full name', who.namey.length === 0,
          who.namey.join(' | '));
    check('the page promises the work stays on this laptop',
          /Stays on this laptop/i.test(who.privacy), who.privacy);
  }

  // =========================================================================
  group('Nothing survives a refresh  (was: a reload silently threw it all away)');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');
  await page.click('#initials');
  await page.type('#initials', 'A.B.');
  await pickUnit(page, 'Unit 3: Digraphs');
  await clickScore(page, 'Lesson 42', 'E');
  await clickScore(page, 'Lesson 43', 'D');
  await clickScore(page, 'Lesson 44', 'M');
  await clickScore(page, 'Lesson 45', 'M');
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'Knows sh and ch cold.');
  {
    // g. A comment must count as soon as it is typed. It was never saved at
    // all before; a save that only ran on blur would still lose the last box a
    // teacher typed in before closing the tab.
    check('a comment is saved as it is typed, without clicking away first',
          await page.evaluate(() => new Promise(r => setTimeout(() => {
            const d = JSON.parse(localStorage.getItem('ufli-assessment') || '{}');
            r(/sh and ch/.test(d.strengths || ''));
          }, 500))));

    await reload(page);
    eq('the scores are still there after a reload',
       await tallies(page), { e: 1, d: 1, m: 2 });
    eq('the child is still there after a reload',
       await page.evaluate(() => document.getElementById('initials').value), 'A.B.');
    eq('the comment is still there after a reload',
       await page.evaluate(() => document.getElementById('strengthsComment').value),
       'Knows sh and ch cold.');
    eq('the unit is still open after a reload',
       await page.evaluate(() => document.getElementById('unitSelect').value),
       'Unit 3: Digraphs');
    check('the scored lessons still show their level after a reload',
          await page.evaluate(() => {
            const row = [...document.querySelectorAll('#lessonsList > .lesson')]
              .find(r => r.querySelector('.lesson-name').textContent.startsWith('Lesson 42:'));
            return row.querySelector('.btn-score.e') !== null;
          }));
  }

  // =========================================================================
  group('When the browser refuses to save  (Safari private window, full disk)');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');
  await pickUnit(page, 'Unit 3: Digraphs');
  await page.evaluate(() => {
    localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  });
  await clickScore(page, 'Lesson 42', 'M');
  {
    const msg = await sayText(page);
    check('the tool says out loud when it cannot save, instead of failing silently',
          /NOT BEING SAVED/i.test(msg), JSON.stringify(msg));
    check('and tells the teacher what to do about it',
          /export/i.test(msg), JSON.stringify(msg));
    check('the tool keeps working anyway',
          (await tallies(page)).m === 1);
  }

  // =========================================================================
  group('Clear  (was: one click destroyed everything, no question, no undo)');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');
  await pickUnit(page, 'Unit 3: Digraphs');
  await clickScore(page, 'Lesson 42', 'E');
  await clickScore(page, 'Lesson 43', 'M');
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'Forty minutes of notes.');
  {
    await page.evaluate(() => { window.__confirmAnswer = false; window.__confirmed = []; });
    await page.click('button[onclick="clearForm()"]');
    const asked = await page.evaluate(() => window.__confirmed);
    check('Clear asks before it throws the assessment away', asked.length === 1,
          JSON.stringify(asked));
    check('the question says what is about to go', /score/i.test(asked[0] || ''), asked[0]);
    eq('saying no keeps every score', await tallies(page), { e: 1, d: 0, m: 1 });
    eq('saying no keeps the comment',
       await page.evaluate(() => document.getElementById('strengthsComment').value),
       'Forty minutes of notes.');

    await page.evaluate(() => { window.__confirmAnswer = true; });
    await page.click('button[onclick="clearForm()"]');
    eq('saying yes does clear it', await tallies(page), { e: 0, d: 0, m: 0 });
    check('and the tool offers a way back',
          await page.evaluate(() =>
            document.getElementById('undoBtn').style.display !== 'none'));
    check('and says so in words', /Undo/i.test(await sayText(page)));

    await page.click('#undoBtn');
    eq('Undo brings every score back', await tallies(page), { e: 1, d: 0, m: 1 });
    eq('Undo brings the comment back',
       await page.evaluate(() => document.getElementById('strengthsComment').value),
       'Forty minutes of notes.');
    await reload(page);
    eq('and what Undo put back survives a reload', await tallies(page), { e: 1, d: 0, m: 1 });
  }

  // =========================================================================
  group('Taking a score back  (was: a mis-click could only be undone by Clear)');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');
  await pickUnit(page, 'Unit 3: Digraphs');
  {
    await clickScore(page, 'Lesson 42', 'E');
    eq('the mis-clicked score lands', await tallies(page), { e: 1, d: 0, m: 0 });
    await clickScore(page, 'Lesson 42', 'E');
    eq('pressing the same level again takes the score back off',
       await tallies(page), { e: 0, d: 0, m: 0 });
    check('and the button stops looking scored',
          await page.evaluate(() => {
            const row = [...document.querySelectorAll('#lessonsList > .lesson')]
              .find(r => r.querySelector('.lesson-name').textContent.startsWith('Lesson 42:'));
            return row.querySelector('.btn-score.e') === null;
          }));
    check('the chart goes back to saying nothing is scored',
          /No scores yet/i.test(await page.evaluate(() =>
            [...document.querySelectorAll('#pieChart text')].map(t => t.textContent).join(' '))));
    await clickScore(page, 'Lesson 42', 'E');
    await clickScore(page, 'Lesson 42', 'D');
    eq('changing to a different level still just moves the score',
       await tallies(page), { e: 0, d: 1, m: 0 });
    check('the screen tells a teacher this is possible',
          /take the score back off/i.test(await page.evaluate(() =>
            document.getElementById('lessonsHint').textContent)));

    // TESTED AT THE WRONG MOMENT, and fixed here. The check above reads the
    // hint on screen and stops there. It passed for months while the promise it
    // quotes — "tap a level a second time to take the score back off" — was
    // true for a mouse only: the second press needs the SAME button, and
    // scoring rebuilt the list and threw the keyboard onto <body>, so from the
    // keyboard there was no second press to make. A promise printed on screen
    // is not a check; keeping it is. The group below keeps it.
  }

  // =========================================================================
  group('Scoring from the keyboard  (was: every score threw the keyboard back ' +
        'to the top of the page)');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');                       // start from empty
  await pickUnit(page, 'Unit 3: Digraphs');
  {
    check('the keyboard can stand on a score button',
          await standOnScore(page, 'Lesson 42', 'Emerging'));

    await page.keyboard.press('Enter');
    eq('Enter scores the lesson', await tallies(page), { e: 1, d: 0, m: 0 });

    const held = await keyboardOn(page);
    check('and the keyboard is still standing on the button it just pressed',
          held.lesson === 'Lesson 42' && held.level === 'Emerging', JSON.stringify(held));
    eq('which now reads as pressed, so a screen reader says the score went on',
       held.pressed, 'true');
    check('and the keyboard mark is drawn on it, so a teacher can see where they are',
          await page.evaluate(() => document.activeElement.matches(':focus-visible')));

    check('(the page really can scroll, so the next check means something)',
          await page.evaluate(() =>
            document.documentElement.scrollHeight > window.innerHeight));
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.keyboard.press(' ');
    eq('Space on that same button takes the score straight back off',
       await tallies(page), { e: 0, d: 0, m: 0 });
    eq('rather than scrolling the page out from under the teacher',
       await page.evaluate(() => window.scrollY), scrollBefore);

    const after = await keyboardOn(page);
    eq('the keyboard has not been dumped on the page itself', after.tag, 'BUTTON');
    eq('it is still on that lesson', after.lesson, 'Lesson 42');
    eq('and the button reads as not pressed again', after.pressed, 'false');

    // Scoring a second lesson must leave the hands on the SECOND lesson — not
    // back on the first one, and not nowhere.
    await standOnScore(page, 'Lesson 44', 'Mastered');
    await page.keyboard.press('Enter');
    const moved = await keyboardOn(page);
    eq('scoring the next lesson leaves the keyboard on the next lesson',
       moved.lesson, 'Lesson 44');
    eq('and one lesson is scored, not two', await tallies(page), { e: 0, d: 0, m: 1 });

    // A whole row scored without ever touching the mouse.
    await standOnScore(page, 'Lesson 45', 'Developing');
    await page.keyboard.press('Enter');
    await standOnScore(page, 'Lesson 46', 'Emerging');
    await page.keyboard.press('Enter');
    eq('three lessons scored from the keyboard alone',
       await tallies(page), { e: 1, d: 1, m: 1 });
    eq('and the work is saved just as a mouse would have saved it',
       (await saved(page)).scores['Lesson 46'], 'Emerging');

    // Deep in "All Lessons", where losing your place costs the most: 128 rows,
    // and the keyboard must stay on the row it was on rather than being sent
    // back to Lesson 1 with the list scrolled to the top.
    await pickUnit(page, 'all');
    await standOnScore(page, 'Lesson 100', 'Mastered');
    await page.evaluate(() => document.activeElement.scrollIntoView({ block: 'center' }));
    const listWas = await page.evaluate(() =>
      document.getElementById('lessonsList').scrollTop);
    check('(the list really is scrolled down, so the next check means something)',
          listWas > 0, 'scrollTop ' + listWas);
    await page.keyboard.press('Enter');
    const deep = await keyboardOn(page);
    eq('scoring Lesson 100 leaves the keyboard on Lesson 100', deep.lesson, 'Lesson 100');
    eq('and the list has not jumped back to the top',
       await page.evaluate(() => document.getElementById('lessonsList').scrollTop), listWas);
  }

  // =========================================================================
  group('Export CSV  (was: an empty Skill column and both comments dropped)');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');
  await page.click('#initials');
  await page.type('#initials', 'A.B.');
  await pickUnit(page, 'Unit 3: Digraphs');
  await clickScore(page, 'Lesson 42', 'E');
  await clickScore(page, 'Lesson 43', 'D');
  await clickScore(page, 'Lesson 44', 'M');
  await page.click('#strengthsComment');
  await page.type('#strengthsComment', 'Strong with sh, ch, and "sounds it out" well.');
  await page.click('#stretchesComment');
  await page.type('#stretchesComment', 'Needs th.');
  {
    await page.click('button[onclick="exportCSV()"]');
    const dl = await lastDownload();
    const lines = dl.text.replace(/^﻿/, '').trim().split(/\r?\n/);

    check('the CSV names the skill on every row',
          /FLSZ Spelling Rule/.test(dl.text) && /-all, -oll, -ull/.test(dl.text) &&
          /ck \/k\//.test(dl.text), lines.join('\n'));
    check('no row has an empty skill cell',
          lines.slice(1).every(l => l.split(',').length > 3), lines.join('\n'));
    check('the CSV keeps the strengths comment', /sounds it out/.test(dl.text));
    check('the CSV keeps the stretches comment', /Needs th\./.test(dl.text));
    check('the CSV says who was assessed', /A\.B\./.test(dl.text));
    check('the CSV says when', new RegExp(new Date().getFullYear()).test(dl.text));

    // f. A comma and a pair of quotes in a comment used to be able to split one
    // field into several columns. Parse it back the way a spreadsheet would.
    const parsed = await page.evaluate(text => {
      const rows = []; let row = [], cell = '', q = false;
      for (let i = 0; i < text.length; i++){
        const c = text[i];
        if (q){
          if (c === '"' && text[i + 1] === '"'){ cell += '"'; i++; }
          else if (c === '"') q = false;
          else cell += c;
        } else if (c === '"') q = true;
        else if (c === ','){ row.push(cell); cell = ''; }
        else if (c === '\r'){ /* skip */ }
        else if (c === '\n'){ row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += c;
      }
      if (cell || row.length) { row.push(cell); rows.push(row); }
      return rows;
    }, dl.text.replace(/^﻿/, ''));

    eq('every row has exactly as many columns as the header',
       [...new Set(parsed.map(r => r.length))], [parsed[0].length]);
    const skillCol = parsed[0].indexOf('Skill');
    check('the Skill column really holds skill names',
          parsed.slice(1).every(r => r[skillCol].trim() !== ''),
          JSON.stringify(parsed.slice(1).map(r => r[skillCol])));
    const strCol = parsed[0].indexOf('Strengths');
    eq('a comment with a comma and quotes in it survives intact',
       parsed[1][strCol], 'Strong with sh, ch, and "sounds it out" well.');

    check('the filename says who and when, so two children do not collide',
          /A\.?B\.?|AB/.test(dl.name) && /\d{4}-\d{2}-\d{2}/.test(dl.name), dl.name);

    // The same assessment under a different child must not overwrite the first.
    const first = dl.name;
    await page.evaluate(() => { document.getElementById('initials').value = 'C.D.'; });
    await page.click('button[onclick="exportCSV()"]');
    const second = (await lastDownload()).name;
    check('a second child gets a different filename', first !== second,
          first + ' vs ' + second);
  }

  // =========================================================================
  group('Export JSON  (the three exports must agree with each other)');
  // =========================================================================
  {
    await page.evaluate(() => { document.getElementById('initials').value = 'A.B.'; });
    await page.click('button[onclick="exportJSON()"]');
    const dl = await lastDownload();
    const j = JSON.parse(dl.text);
    eq('the JSON says who', j.child, 'A.B.');
    check('the JSON says when', /^\d{4}-\d{2}-\d{2}$/.test(j.date || ''), j.date);
    check('the JSON keeps both comments',
          /sounds it out/.test(j.strengths) && /Needs th/.test(j.stretches));
    eq('the JSON carries the skill names the CSV and the PDF use',
       j.skills['Lesson 42'], 'FLSZ Spelling Rule (ff, ll, ss, zz)');
    check('the JSON filename says who and when',
          /\d{4}-\d{2}-\d{2}/.test(dl.name) && /AB/.test(dl.name), dl.name);
  }

  // =========================================================================
  group('Export PDF  (was: a dead button when the school firewall blocks cdnjs)');
  // =========================================================================
  {
    BLOCK_CDN = true;
    const before = pageErrors.length;
    await fresh(page, base);
    await page.click('#sampleBtn');
    await pickUnit(page, 'Unit 3: Digraphs');
    await clickScore(page, 'Lesson 42', 'E');
    await page.click('button[onclick="exportPDF()"]');
    const msg = await sayText(page);
    check('a blocked PDF library says what happened, in plain words',
          msg.length > 0 && /PDF/i.test(msg), JSON.stringify(msg));
    check('and says what still works instead',
          /CSV/i.test(msg) && /Print/i.test(msg), JSON.stringify(msg));
    check('and it does not throw an error into a console nobody has open',
          pageErrors.length === before, pageErrors.slice(before).join(' | '));
    BLOCK_CDN = false;
  }

  // =========================================================================
  group('The PDF report itself  (was: an anonymous file, always the same name)');
  // =========================================================================
  // jsPDF is a third-party library from a CDN; standing it in for lets the
  // REPORT be checked — what it says, and what it is called — without this
  // suite ever touching the internet.
  await fresh(page, base);
  await page.evaluate(FAKE_JSPDF);
  {
    await page.click('button[onclick="exportPDF()"]');
    const pdf = await page.evaluate(() => window.__pdf);
    check('the report says who it is for and when',
          pdf.lines.some(l => /Child: M\.T\./.test(l) && /Date: \d{4}-\d{2}-\d{2}/.test(l)),
          JSON.stringify(pdf.lines.slice(0, 4)));
    check('the report names the sample student on the printed page too',
          pdf.lines.some(l => /SAMPLE STUDENT/.test(l) && /Maya Torres/.test(l)),
          JSON.stringify(pdf.lines.slice(0, 4)));
    check('a sample report is marked as a sample in its filename too',
          /SAMPLE/.test(pdf.file), pdf.file);
    check('the report still carries both comments',
          pdf.lines.some(l => /Blends and reads short-vowel words/.test(l)) &&
          pdf.lines.some(l => /Magic e is brand new/.test(l)));

    const sampleFile = pdf.file;

    // A real child now: clear Maya, type initials, score something.
    await page.click('#sampleBtn');
    await page.click('#initials');
    await page.type('#initials', 'A.B.');
    await pickUnit(page, 'Unit 3: Digraphs');
    await clickScore(page, 'Lesson 42', 'E');
    await page.evaluate(() => { window.__pdf.lines = []; window.__pdf.file = null; });
    await page.click('button[onclick="exportPDF()"]');
    const real = await page.evaluate(() => window.__pdf);
    check('a real child\'s report says their initials, not the sample\'s',
          real.lines.some(l => /Child: A\.B\./.test(l)),
          JSON.stringify(real.lines.slice(0, 4)));
    check('and it is not marked as a sample', !/SAMPLE/.test(real.file), real.file);
    check('the file is not called the same thing every time',
          real.file !== sampleFile && /AB/.test(real.file) &&
          /\d{4}-\d{2}-\d{2}/.test(real.file), real.file + ' vs ' + sampleFile);
    check('the report names the lesson that still needs work',
          real.lines.some(l => /FLSZ Spelling Rule/.test(l)),
          JSON.stringify(real.lines.slice(-4)));
  }

  // =========================================================================
  group('On a phone  (was: the page was 247px wider than the screen)');
  // =========================================================================
  {
    await page.setViewport({ width: 390, height: 844 });
    await fresh(page, base);
    await pickUnit(page, 'Unit 3: Digraphs');
    await clickScore(page, 'Lesson 42', 'E');
    const fit = await page.evaluate(() => {
      const w = window.innerWidth;
      const off = [...document.querySelectorAll('button, select, textarea, input, a')]
        .filter(n => n.offsetParent !== null)
        .filter(n => n.getBoundingClientRect().right > w + 1)
        .map(n => n.id || n.textContent.trim().slice(0, 24));
      return { scrollWidth: document.documentElement.scrollWidth, innerWidth: w, off };
    });
    check('the page is no wider than the phone screen',
          fit.scrollWidth <= fit.innerWidth + 1,
          `scrollWidth ${fit.scrollWidth} vs innerWidth ${fit.innerWidth}`);
    check('every button and box is reachable without scrolling sideways',
          fit.off.length === 0, fit.off.join(' | '));
    await page.setViewport({ width: 1280, height: 1000 });
  }

  // =========================================================================
  group('The practice worksheets  (was: the badge butting into the title)');
  // =========================================================================
  await fresh(page, base);
  // The FLAGGED SKILL badge only prints when the assessment really flagged the
  // lesson now, so flag the four sheets this group opens before opening them.
  // (39 is already Developing and 40 already Emerging in Maya's sample.)
  await pickUnit(page, 'Unit 2: Short Vowels & CVC Review');
  await clickScore(page, 'Lesson 35', 'E');
  await clickScore(page, 'Lesson 37', 'E');
  {
    const built = await page.evaluate(() => {
      const bad = [];
      Object.keys(WORKSHEETS).forEach(name => {
        try {
          const c = WORKSHEETS[name];
          const build = c.review ? buildReviewHTML : c.syllable ? buildSyllableHTML
                      : c.letter ? buildLetterHTML : c.ending ? buildEndingHTML
                      : c.vce ? buildVCeHTML : buildWorksheetHTML;
          const html = build(c, true);   // flagged, so the badge is on the sheet
          if (!/<h1>/.test(html) || html.length < 500) bad.push(name);
        } catch (e) { bad.push(name + ': ' + e.message); }
      });
      return { count: Object.keys(WORKSHEETS).length, bad };
    });
    eq('all 128 worksheets still build', built.count, 128);
    check('none of them throws', built.bad.length === 0, built.bad.slice(0, 5).join(' | '));

    // The four sheets that collided, opened the way a parent opens them:
    // click "Get practice sheets", then click Generate.
    //
    // Every click happens FIRST and the second tab is opened afterwards. Doing
    // it the other way round — a second page alive while this one is still
    // being clicked — hangs Chrome's protocol connection and the whole run
    // times out with no failing check to explain it.
    const sheets = [];
    for (const n of [35, 37, 39, 40]){
      await page.click('button[onclick="openWorksheetPicker()"]');
      await page.click(`button[onclick="openWorksheet('Lesson ${n}')"]`);
      sheets.push([n, await page.evaluate(() => window.__childCopy)]);
      await page.evaluate(() => closeWorksheetModal());
    }
    check('all four worksheets opened', sheets.every(s => s[1].length > 1000));

    const sheet = await browser.newPage();
    await sheet.setViewport({ width: 1000, height: 900 });
    const gaps = [];
    for (const [n, html] of sheets){
      await sheet.setContent(html, { waitUntil: 'load' });
      // A Range over the h1's text, not the h1 box: the box is as wide as the
      // column, and it was the TEXT that ran into the badge.
      gaps.push({ n, gap: await sheet.evaluate(() => {
        const h1 = document.querySelector('h1');
        const rng = document.createRange();
        rng.selectNodeContents(h1);
        const t = rng.getBoundingClientRect();
        const f = document.querySelector('.flagged').getBoundingClientRect();
        return Math.round(f.left - t.right);
      }) });
    }
    check('the FLAGGED SKILL badge never touches the worksheet title',
          gaps.every(x => x.gap >= 8), JSON.stringify(gaps));
    await sheet.close();
  }

  // =========================================================================
  group('The rest of the tool still works');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');
  await pickUnit(page, 'Unit 3: Digraphs');
  await clickScore(page, 'Lesson 42', 'E');
  {
    await page.click('.count-item.e');
    const modal = await page.evaluate(() => ({
      shown: document.getElementById('lessonsModal').classList.contains('show'),
      text: document.getElementById('modalLessonsList').textContent
    }));
    check('clicking a tally still lists the lessons behind it',
          modal.shown && /Lesson 42/.test(modal.text), JSON.stringify(modal).slice(0, 200));
    await page.click('#lessonsModal .close-modal');
    check('and the modal closes again',
          await page.evaluate(() =>
            !document.getElementById('lessonsModal').classList.contains('show')));

    // TESTED AT THE WRONG MOMENT, and fixed here. The check just above was the
    // only thing guarding these three tiles, and it passed the whole time they
    // were plain <div>s that no keyboard and no screen reader could reach. A
    // scripted click lands on anything at all, so what it proved was that the
    // handler runs — never that a person can get to it. What a tile IS, and
    // whether Tab arrives at it, is the moment that was missing.
    const tiles = await page.evaluate(() =>
      [...document.querySelectorAll('.count-item')].map(n =>
        ({ tag: n.tagName, tabIndex: n.tabIndex, label: n.getAttribute('aria-label') })));
    eq('there are three tallies', tiles.length, 3);
    check('each one is a real button, not a div with a click stuck on it',
          tiles.every(t => t.tag === 'BUTTON'), JSON.stringify(tiles));
    check('each one is in the tab order',
          tiles.every(t => t.tabIndex === 0), JSON.stringify(tiles));
    check('and each one says out loud what pressing it opens',
          tiles.every(t => /lessons scored/i.test(t.label || '')), JSON.stringify(tiles));

    // Real Tab presses, from the box just above. A date box swallows a few of
    // them itself — it has three little parts — so keep going until the
    // keyboard leaves it, then see where it landed.
    await page.evaluate(() => document.getElementById('assessDate').focus());
    let landed = null;
    for (let i = 0; i < 6; i++){
      await page.keyboard.press('Tab');
      landed = await page.evaluate(() => {
        const a = document.activeElement;
        return { id: a.id, cls: a.className };
      });
      if (landed.id !== 'assessDate') break;
    }
    check('tabbing on from the date box arrives at the first tally',
          /count-item/.test(landed.cls) && / e$/.test(landed.cls), JSON.stringify(landed));

    await page.keyboard.press('Enter');
    const byKey = await page.evaluate(() => ({
      shown: document.getElementById('lessonsModal').classList.contains('show'),
      text: document.getElementById('modalLessonsList').textContent
    }));
    check('and Enter there opens the same list of lessons',
          byKey.shown && /Lesson 42/.test(byKey.text), JSON.stringify(byKey).slice(0, 200));
    // closeModal() rather than a click on the X: if the list never opened, the X
    // is not on screen and a click on it crashes the whole run. A broken tool
    // should give a red line, not take the other 200 checks down with it.
    await page.evaluate(() => closeModal());

    await page.evaluate(() => document.querySelector('.count-item.m').focus());
    await page.keyboard.press(' ');
    check('Space opens it too, the way it does on every other button',
          await page.evaluate(() =>
            document.getElementById('lessonsModal').classList.contains('show')));
    await page.evaluate(() => closeModal());

    await page.click('button[onclick="openWorksheetPicker()"]');
    const picker = await page.evaluate(() => ({
      shown: document.getElementById('worksheetModal').classList.contains('show'),
      rows: document.querySelectorAll('#worksheetPickerList .ws-row').length,
      links: document.querySelectorAll('#worksheetPickerList a.ws-story').length
    }));
    eq('the worksheet picker still lists all 128 lessons', picker.rows, 128);
    eq('and every one still has its reading-practice link', picker.links, 128);
    await page.evaluate(() => closeWorksheetModal());

  }

  // =========================================================================
  group('Corners that still have to behave');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');                       // start from empty
  {
    await pickUnit(page, 'all');
    const all = await page.evaluate(() => ({
      rows: document.querySelectorAll('#lessonsList > .lesson').length,
      meta: (document.querySelector('#lessonsList .lesson-meta') || {}).textContent || ''
    }));
    eq('"All Lessons" really lists all 128 of them', all.rows, 128);
    check('and each row says which unit it belongs to', /Unit 1/.test(all.meta), all.meta);

    await page.click('.count-item.d');
    check('a tally with nothing behind it says so, instead of an empty box',
          /No lessons at this level/i.test(await page.evaluate(() =>
            document.getElementById('modalLessonsList').textContent)));
    await page.mouse.click(5, 5);                        // the dark surround
    check('clicking outside the list closes it',
          await page.evaluate(() =>
            !document.getElementById('lessonsModal').classList.contains('show')));

    await page.click('button[onclick="openWorksheetPicker()"]');
    await page.mouse.click(5, 5);
    check('the practice-sheet list closes the same way',
          await page.evaluate(() =>
            !document.getElementById('worksheetModal').classList.contains('show')));

    // A browser set to block pop-ups makes window.open return null.
    await page.evaluate(() => { window.__realOpen = window.open; window.open = () => null;
                                window.__alert = ''; });
    await page.click('button[onclick="openWorksheetPicker()"]');
    await page.click(`button[onclick="openWorksheet('Lesson 35')"]`);
    check('a blocked pop-up says what to change, instead of nothing happening',
          /pop-ups/i.test(await page.evaluate(() => window.__alert)),
          await page.evaluate(() => window.__alert));
    await page.evaluate(() => { window.open = window.__realOpen; closeWorksheetModal(); });
  }

  // =========================================================================
  group('Notes without scores, and the sample over real work');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');
  await page.click('#stretchesComment');
  await page.type('#stretchesComment', 'Only notes so far, nothing scored yet.');
  {
    await page.click('button[onclick="exportCSV()"]');
    const dl = await lastDownload();
    check('a CSV with notes but no scores still keeps the notes',
          /Only notes so far/.test(dl.text), dl.text.slice(0, 200));

    await page.evaluate(() => { window.__confirmed = []; window.__confirmAnswer = false; });
    await page.click('#sampleBtn');
    check('loading the sample over real work asks first',
          (await page.evaluate(() => window.__confirmed)).length === 1);
    eq('and saying no leaves the work alone',
       await page.evaluate(() => document.getElementById('stretchesComment').value),
       'Only notes so far, nothing scored yet.');
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await page.click('#sampleBtn');
    check('saying yes puts the sample in', (await tallies(page)).m > 0);
  }

  // =========================================================================
  group('A long report  (a whole year of lessons must not fall off page one)');
  // =========================================================================
  await fresh(page, base);
  await page.evaluate(FAKE_JSPDF);
  await page.click('#sampleBtn');
  await pickUnit(page, 'all');
  {
    // Two long comments, set the way a paste does it — the point of this check
    // is the PDF's page breaks, not the typing.
    const long = ('She needs the sound drilled every day, in short bursts, with a ' +
                  'mirror so she can see her mouth. ').repeat(30);   // long enough that the
                  // lesson list starts on page two — that page break was the one
                  // branch of the report no shorter assessment ever reaches.
    await page.evaluate(t => {
      ['strengthsComment', 'stretchesComment'].forEach(id => {
        const box = document.getElementById(id);
        box.value = t;
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }, long);

    // Units 1 to 5 in full, six of Unit 6, and one of Unit 7 — enough that the
    // Unit 7 heading would otherwise print in the last few millimetres of a
    // page with its lessons stranded on the next one.
    const click = i =>
      page.click(`#lessonsList > .lesson:nth-child(${i}) .score-buttons button:nth-child(1)`);
    for (let i = 1; i <= 74; i++) await click(i);
    await click(85);
    eq('seventy-five lessons are scored', (await tallies(page)).e, 75);

    await page.click('button[onclick="exportPDF()"]');
    let pdf = await page.evaluate(() => window.__pdf);
    check('a report too long for one page carries on to the next',
          pdf.pages > 1, 'pages: ' + pdf.pages);
    check('a unit heading near the bottom of a page starts the next page instead, ' +
          'so it is never left stranded from its lessons',
          pdf.pages >= 3, 'pages: ' + pdf.pages);

    // Now the whole year.
    await page.evaluate(() => { window.__pdf.lines = []; window.__pdf.pages = 1; });
    for (let i = 75; i <= 128; i++) if (i !== 85) await click(i);
    eq('all 128 lessons are scored', (await tallies(page)).e, 128);
    await page.click('button[onclick="exportPDF()"]');
    pdf = await page.evaluate(() => window.__pdf);
    check('a whole year of lessons runs on across as many pages as it needs',
          pdf.pages >= 3, 'pages: ' + pdf.pages);
    check('the last lesson is still in the report',
          pdf.lines.some(l => /Lesson 128/.test(l)),
          JSON.stringify(pdf.lines.slice(-3)));
  }

  // =========================================================================
  group('A saved record that has gone bad  (was: the Child box read "[object Object]")');
  // =========================================================================
  // Only this tool ever writes that record — but it is one line of text in the
  // browser's own storage, and a write cut off half way, a browser extension or
  // somebody with the developer tools open can leave anything at all in it.
  // Whatever is in there, the tool has to open, and it must never put a
  // programmer's junk on a teacher's screen. The first record below is the real
  // one that got through: it did not crash the page, so nobody noticed that the
  // Child box was showing the literal words "[object Object]".
  {
    const junk = /\[object Object\]|\bundefined\b|\bNaN\b|\bInfinity\b/;
    const bad = [
      ['a record whose initials are not text',
       '{"scores":{"Lesson 1":{"a":1}},"unit":"No Such Unit","initials":{"x":1}}'],
      ['a record that is not even JSON',      'not json at all'],
      ['the word null',                        'null'],
      ['a list where a record should be',      '[]'],
      ['a bare number',                        '123'],
      ['a record of the wrong shape throughout',
       '{"scores":"oops","initials":null,"date":123,"strengths":[1,2],"stretches":{},"unit":7}'],
      ['scores that are not one of the three levels',
       '{"scores":{"Lesson 42":"banana","Lesson 43":7,"Lesson 44":{"m":1}},"initials":"A.B.","date":"2026-03-04"}'],
      ['initials far longer than the box allows',
       '{"initials":"THIS IS A WHOLE NAME AND SHOULD NEVER BE HERE","date":"2026-03-04"}']
    ];
    for (const [what, raw] of bad){
      const errsBefore = pageErrors.length, conBefore = consoleErrors.length;
      await fresh(page, base);
      await page.evaluate(v => localStorage.setItem('ufli-assessment', v), raw);
      await reload(page);
      const state = await page.evaluate(() => ({
        child: document.getElementById('initials').value,
        date: document.getElementById('assessDate').value,
        strengths: document.getElementById('strengthsComment').value,
        stretches: document.getElementById('stretchesComment').value,
        unit: document.getElementById('unitSelect').value,
        body: document.body.innerText
      }));
      check(`${what}: the tool still opens, with nothing thrown`,
            pageErrors.length === errsBefore && consoleErrors.length === conBefore,
            pageErrors.slice(errsBefore).concat(consoleErrors.slice(conBefore)).join(' | '));
      check(`${what}: no programmer's junk in any box a teacher types in`,
            !junk.test(state.child + '|' + state.date + '|' + state.strengths +
                       '|' + state.stretches + '|' + state.unit),
            JSON.stringify(state));
      check(`${what}: and none of it anywhere on the page either`,
            !junk.test(state.body), state.body.slice(0, 300));
      check(`${what}: the Child box holds initials or nothing, never more than four`,
            state.child.length <= 4, JSON.stringify(state.child));
    }

    // A score has to be one of the three levels. "banana" is not a score, so it
    // must not be counted as one, and it must not colour a button in.
    await fresh(page, base);
    await page.evaluate(() => localStorage.setItem('ufli-assessment',
      '{"scores":{"Lesson 42":"banana","Lesson 43":7,"Lesson 44":"Mastered"},' +
      '"unit":"Unit 3: Digraphs","initials":"A.B.","sampleCleared":true}'));
    await reload(page);
    eq('a made-up score level is not counted in the tallies',
       await tallies(page), { e: 0, d: 0, m: 1 });
    check('and the real score beside it still comes back',
          await page.evaluate(() => {
            const row = [...document.querySelectorAll('#lessonsList > .lesson')]
              .find(r => r.querySelector('.lesson-name').textContent.startsWith('Lesson 44:'));
            return row.querySelector('.btn-score.m') !== null;
          }));
    // A unit that is not in the curriculum must not end up in the dropdown.
    await fresh(page, base);
    await page.evaluate(() => localStorage.setItem('ufli-assessment',
      '{"unit":"No Such Unit","initials":"A.B.","sampleCleared":true}'));
    await reload(page);
    eq('a unit that does not exist never reaches the dropdown',
       await page.evaluate(() => document.getElementById('unitSelect').value), '');
  }

  // =========================================================================
  group('A file called what it is  (was: named for today, dated nowhere inside)');
  // =========================================================================
  // A teacher who clears the date is saying "I am not dating this one". The
  // filename used to fill today's date in anyway, so the file was called
  // ..._2026-08-07.csv while the row inside it had no date at all — the name of
  // the file and the record inside it disagreed.
  {
    await fresh(page, base);
    await page.evaluate(FAKE_JSPDF);
    await page.click('#sampleBtn');          // Maya out of the way
    await page.click('#initials');
    await page.type('#initials', 'A.B.');
    await pickUnit(page, 'Unit 3: Digraphs');
    await clickScore(page, 'Lesson 42', 'M');
    await page.evaluate(() => {
      const d = document.getElementById('assessDate');
      d.value = '';
      d.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const today = await page.evaluate(() => {
      const n = new Date();
      return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') +
             '-' + String(n.getDate()).padStart(2, '0');
    });

    await page.click('button[onclick="exportCSV()"]');
    const csv = await lastDownload();
    check('an undated CSV is not named for today', !csv.name.includes(today), csv.name);
    check('it says so in its name instead', /no-date/.test(csv.name), csv.name);
    const dateCol = csv.text.replace(/^﻿/, '').trim().split(/\r?\n/)[1].split(',')[1];
    eq('and the Date cell inside agrees with the name', dateCol, '');

    await page.click('button[onclick="exportJSON()"]');
    const js = await lastDownload();
    check('an undated JSON is not named for today either', !js.name.includes(today), js.name);
    eq('and its date field agrees with its name', JSON.parse(js.text).date, '');

    await page.evaluate(() => { window.__pdf.lines = []; window.__pdf.file = null; });
    await page.click('button[onclick="exportPDF()"]');
    const pdfOut = await page.evaluate(() => window.__pdf);
    check('the printed report does not invent a date either',
          pdfOut.lines.some(l => /Date:\s*—/.test(l)) &&
          !pdfOut.lines.some(l => new RegExp('Date:.*' + today).test(l)),
          JSON.stringify(pdfOut.lines.slice(0, 5)));
    check('and the report file is named to match', /no-date/.test(pdfOut.file), pdfOut.file);

    // A date that IS filled in must still reach the filename, both ways round.
    await page.evaluate(() => {
      const d = document.getElementById('assessDate');
      d.value = '2026-03-04';
      d.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.click('button[onclick="exportCSV()"]');
    const dated = await lastDownload();
    check('a dated file is still named for its date',
          /2026-03-04/.test(dated.name) && !/no-date/.test(dated.name), dated.name);
    check('and the date inside it is the same one',
          dated.text.split(/\r?\n/)[1].split(',')[1] === '2026-03-04',
          dated.text.split(/\r?\n/)[1]);

    // Clearing the date has to stick. It used to be quietly filled back in with
    // today's date on the next reload.
    await page.evaluate(() => {
      const d = document.getElementById('assessDate');
      d.value = '';
      d.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
    await reload(page);
    eq('a date the teacher cleared stays cleared after a reload',
       await page.evaluate(() => document.getElementById('assessDate').value), '');
  }

  // =========================================================================
  group('Export JSON is the assessment, not a page of nulls');
  // =========================================================================
  // Every lesson gets a slot the moment the tool opens, so a straight copy of
  // the score sheet meant a one-lesson assessment exported as three thousand
  // characters with 128 "null"s in it and the one real score buried inside.
  {
    await fresh(page, base);
    await page.click('#sampleBtn');
    await pickUnit(page, 'Unit 3: Digraphs');
    await clickScore(page, 'Lesson 42', 'M');
    await page.click('button[onclick="exportJSON()"]');
    const dl = await lastDownload();
    const j = JSON.parse(dl.text);
    eq('a one-lesson assessment exports one lesson', Object.keys(j.scores), ['Lesson 42']);
    eq('with the score that was given', j.scores['Lesson 42'], 'Mastered');
    check('the file is not mostly the word "null"',
          (dl.text.match(/\bnull\b/g) || []).length <= 1 && dl.text.length < 600,
          dl.text.length + ' chars, ' + (dl.text.match(/\bnull\b/g) || []).length + ' nulls');
    eq('the scores and the skill names still list the same lessons',
       Object.keys(j.scores), Object.keys(j.skills));

    // And a fuller assessment still exports every lesson it should.
    await clickScore(page, 'Lesson 43', 'E');
    await clickScore(page, 'Lesson 44', 'D');
    await page.click('button[onclick="exportJSON()"]');
    const more = JSON.parse((await lastDownload()).text);
    eq('three scored lessons export as three',
       Object.keys(more.scores).sort(), ['Lesson 42', 'Lesson 43', 'Lesson 44']);
  }

  // =========================================================================
  group('File > Print  (was: 5 of 128 lessons and a third of each comment on paper)');
  // =========================================================================
  await fresh(page, base);
  await page.evaluate(() => { window.__confirmAnswer = true; });
  await page.click('#sampleBtn');                       // start from empty
  await pickUnit(page, 'all');
  {
    // Scores spread across the year, so the print surface has to reach past
    // the part of the list that is visible on screen.
    const click = i =>
      page.click(`#lessonsList > .lesson:nth-child(${i}) .score-buttons button:nth-child(1)`);
    for (const i of [1, 2, 3, 4, 5, 60, 100, 128]) await click(i);

    const longNote = 'She blends short-vowel words on her own now and self-corrects when a ' +
      'word does not sound real. '.repeat(6) + 'THE VERY LAST SENTENCE OF THE NOTE.';
    await page.evaluate(t => {
      ['strengthsComment', 'stretchesComment'].forEach(id => {
        const box = document.getElementById(id);
        box.value = t;
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }, longNote);
    await page.evaluate(() => new Promise(r => setTimeout(r, 450)));   // the save debounce

    await page.emulateMediaType('print');
    const printed = await page.evaluate(() => ({
      report: getComputedStyle(document.getElementById('printReport')).display,
      lessonsBox: getComputedStyle(document.querySelector('.top-boxes')).display,
      buttons: getComputedStyle(document.querySelector('button[onclick="exportPDF()"]')
                 .closest('.section')).display,
      commentsBox: getComputedStyle(document.getElementById('strengthsComment')
                 .closest('.section')).display,
      text: document.getElementById('printReport').innerText,
      rows: document.querySelectorAll('#printReport tbody tr').length
    }));
    check('printing shows the printable report instead of the scrolling screen',
          printed.report === 'block', JSON.stringify(printed.report));
    eq('every scored lesson is on the paper, not just the five that fit the scroll box',
       printed.rows, 8);
    check('including the very last lesson of the year',
          /Lesson 128/.test(printed.text));
    check('the whole comment prints, down to its last sentence',
          printed.text.includes('THE VERY LAST SENTENCE OF THE NOTE.'));
    check('the tallies on the paper agree with the lessons listed on it',
          /8 of 128 lessons scored/.test(printed.text), printed.text.slice(0, 300));
    check('no buttons print onto the paper',
          printed.buttons === 'none' && printed.lessonsBox === 'none' &&
          printed.commentsBox === 'none', JSON.stringify(printed));
    await page.emulateMediaType('screen');
  }

  // =========================================================================
  group('A second tab of the tool  (was: the older tab silently overwrote the newer work)');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');
  await pickUnit(page, 'Unit 3: Digraphs');
  await clickScore(page, 'Lesson 42', 'E');
  await typeOver(page, 'initials', 'A.B.');
  await page.evaluate(() => new Promise(r => setTimeout(r, 450)));
  {
    const tabB = await browser.newPage();
    await tabB.setRequestInterception(true);
    tabB.on('request', r => {
      if (/cdnjs\.cloudflare\.com/.test(r.url()))
        return r.respond({ status: 200, contentType: 'text/javascript', body: '' }).catch(() => {});
      r.continue().catch(() => {});
    });
    await tabB.goto(base + '/index.html', { waitUntil: 'load' });
    check('a second tab opens showing the first tab\'s work',
          await tabB.evaluate(() => document.getElementById('initials').value) === 'A.B.');

    // Work in the second tab, the thing that used to be fatal.
    await tabB.select('#unitSelect', 'Unit 3: Digraphs');
    const idx = await tabB.evaluate(() => {
      const rows = [...document.querySelectorAll('#lessonsList > .lesson')];
      return rows.findIndex(r =>
        r.querySelector('.lesson-name').textContent.startsWith('Lesson 43:')) + 1;
    });
    await tabB.click(`#lessonsList > .lesson:nth-child(${idx}) .score-buttons button:nth-child(3)`);
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

    eq('the first tab catches up instead of holding a stale copy',
       await tallies(page), { e: 1, d: 0, m: 1 });
    check('and says out loud that another tab changed the record',
          /another tab/i.test(await sayText(page)), await sayText(page));
    await tabB.close();

    await reload(page);
    eq('nothing was overwritten: both tabs\' work survives the reload',
       await tallies(page), { e: 1, d: 0, m: 1 });
  }

  // =========================================================================
  group('Undo long after the clear  (was: it silently destroyed the next child\'s work)');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');
  await pickUnit(page, 'Unit 3: Digraphs');
  await clickScore(page, 'Lesson 42', 'E');
  {
    await page.click('button[onclick="clearForm()"]');       // confirm answers yes
    eq('the clear lands', await tallies(page), { e: 0, d: 0, m: 0 });

    // The next child's assessment begins.
    await pickUnit(page, 'Unit 2: Short Vowels & CVC Review');
    await clickScore(page, 'Lesson 35', 'M');
    await page.click('#stretchesComment');
    await page.type('#stretchesComment', 'child two');
    await page.evaluate(() => new Promise(r => setTimeout(r, 450)));

    await page.evaluate(() => { window.__confirmed = []; window.__confirmAnswer = false; });
    await page.click('#undoBtn');
    check('pressing Undo with new work on screen asks first',
          (await page.evaluate(() => window.__confirmed)).length === 1);
    check('and the question says the new work would be replaced',
          /since the clear/i.test((await page.evaluate(() => window.__confirmed))[0] || ''));
    eq('saying no keeps the next child\'s scores', await tallies(page), { e: 0, d: 0, m: 1 });
    eq('and the next child\'s note',
       await page.evaluate(() => document.getElementById('stretchesComment').value), 'child two');

    await page.evaluate(() => { window.__confirmAnswer = true; });
    await page.click('#undoBtn');
    eq('saying yes really does bring the cleared child back',
       await tallies(page), { e: 1, d: 0, m: 0 });
  }

  // =========================================================================
  group('The keyboard behind an open list  (was: Enter changed a score hidden under the sheet)');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');
  await pickUnit(page, 'Unit 3: Digraphs');
  await clickScore(page, 'Lesson 42', 'E');
  {
    await page.evaluate(() => document.querySelector('.count-item.e').focus());
    await page.keyboard.press('Enter');
    check('Enter on the tally opens the list',
          await page.evaluate(() =>
            document.getElementById('lessonsModal').classList.contains('show')));

    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    check('six Tabs later the keyboard is still inside the open list, ' +
          'not on a score button hidden behind it',
          await page.evaluate(() =>
            document.getElementById('lessonsModal').contains(document.activeElement)),
          await page.evaluate(() =>
            document.activeElement.outerHTML.slice(0, 120)));

    await page.keyboard.press('Enter');   // the press that used to flip E to M
    eq('and Enter there cannot silently change the score behind the sheet',
       await tallies(page), { e: 1, d: 0, m: 0 });

    // Escape closes it, like every native dialog.
    await page.click('.count-item.e');
    await page.keyboard.press('Escape');
    check('Escape closes the list',
          await page.evaluate(() =>
            !document.getElementById('lessonsModal').classList.contains('show')));
  }

  // =========================================================================
  group('BLOCKER: "Clear the sample" with your own work on it  (was: gone, no question, no undo)');
  // =========================================================================
  await fresh(page, base);
  await typeOver(page, 'initials', 'R.P.');
  await pickUnit(page, 'Unit 6: R-Controlled & Other Vowels');
  await clickScore(page, 'Lesson 77', 'D');
  await clickScore(page, 'Lesson 78', 'D');
  await typeOver(page, 'strengthsComment', 'My own words about R.');
  await page.evaluate(() => new Promise(r => setTimeout(r, 450)));
  {
    await page.evaluate(() => { window.__confirmed = []; window.__confirmAnswer = false; });
    await page.click('#sampleBtn');
    check('with the teacher\'s own scores on screen, Clear the sample asks first',
          (await page.evaluate(() => window.__confirmed)).length === 1,
          JSON.stringify(await page.evaluate(() => window.__confirmed)));
    eq('saying no loses nothing', await tallies(page), { e: 8, d: 12, m: 39 });

    await page.evaluate(() => { window.__confirmAnswer = true; });
    await page.click('#sampleBtn');
    eq('saying yes clears it', await tallies(page), { e: 0, d: 0, m: 0 });
    check('and Undo is offered, the same as the Clear button beside it',
          await page.evaluate(() =>
            document.getElementById('undoBtn').style.display !== 'none'));
    await page.click('#undoBtn');
    eq('and Undo brings the whole thing back',
       await tallies(page), { e: 8, d: 12, m: 39 });
    eq('initials included',
       await page.evaluate(() => document.getElementById('initials').value), 'R.P.');
    await page.evaluate(() => { window.__confirmAnswer = true; });
  }

  // =========================================================================
  group('BLOCKER: "Clear her scores, keep what I typed"  (was: it deleted the teacher\'s own scores too)');
  // =========================================================================
  await fresh(page, base);
  await typeOver(page, 'initials', 'R.P.');
  await pickUnit(page, 'Unit 6: R-Controlled & Other Vowels');
  // Four real scores in a unit Maya never touched, and one of HER lessons
  // re-scored by hand — all five belong to the teacher now.
  await clickScore(page, 'Lesson 77', 'M');
  await clickScore(page, 'Lesson 78', 'M');
  await clickScore(page, 'Lesson 79', 'M');
  await clickScore(page, 'Lesson 80', 'M');
  await typeOver(page, 'strengthsComment', 'My own words about R.');
  // EDIT Maya's stretches paragraph rather than replacing it — the exact move
  // that used to hand her invented sentences to a real child's record.
  await page.evaluate(() => {
    const box = document.getElementById('stretchesComment');
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  });
  await page.keyboard.type(' Drill nk.');
  await page.evaluate(() => new Promise(r => setTimeout(r, 450)));
  {
    await page.click('#startMineBtn');
    eq('the four scores the teacher entered themselves survive',
       await tallies(page), { e: 0, d: 0, m: 4 });
    check('while every one of Maya\'s own scores is gone',
          await page.evaluate(() =>
            ['Lesson 42', 'Lesson 45', 'Lesson 54'].every(k => !scores[k])));
    eq('the teacher\'s replaced comment stays',
       await page.evaluate(() => document.getElementById('strengthsComment').value),
       'My own words about R.');
    eq('but Maya\'s EDITED paragraph does not sneak through as the teacher\'s words',
       await page.evaluate(() => document.getElementById('stretchesComment').value), '');
    check('the record stops claiming to be the sample',
          await page.evaluate(() => !JSON.parse(localStorage.getItem('ufli-assessment')).sample));
    check('and even this careful path offers Undo',
          await page.evaluate(() =>
            document.getElementById('undoBtn').style.display !== 'none'));

    await page.click('button[onclick="exportCSV()"]');
    const dl = await lastDownload();
    check('the export is no longer stamped SAMPLE', !/SAMPLE/.test(dl.name), dl.name);
    check('Maya appears nowhere inside it', !/Maya/.test(dl.text));
    check('and the teacher\'s own scores are in it', /Lesson 77/.test(dl.text));

    await reload(page);
    eq('the kept scores survive a reload', await tallies(page), { e: 0, d: 0, m: 4 });
  }

  // =========================================================================
  group('The not-saved warning  (was: painted below the fold on every screen size)');
  // =========================================================================
  await fresh(page, base);
  await page.click('#sampleBtn');
  await pickUnit(page, 'Unit 3: Digraphs');
  await page.evaluate(() => {
    localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  });
  await clickScore(page, 'Lesson 42', 'M');
  {
    const warn = await page.evaluate(() => {
      const w = document.getElementById('saveWarn');
      const r = w.getBoundingClientRect();
      return { shown: w.classList.contains('show'), top: r.top, bottom: r.bottom,
               text: w.textContent };
    });
    check('the warning appears at the top of the page, where the teacher is working',
          warn.shown && warn.top >= 0 && warn.bottom < 400, JSON.stringify(warn));
    check('and says plainly that nothing is being saved',
          /NOT BEING SAVED/.test(warn.text), warn.text);

    // Scroll to the foot of the page — the warning must come along.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const stuck = await page.evaluate(() => {
      const r = document.getElementById('saveWarn').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, vh: window.innerHeight };
    });
    check('it stays on screen even scrolled to the bottom (it is sticky)',
          stuck.top >= 0 && stuck.bottom <= stuck.vh, JSON.stringify(stuck));
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  // =========================================================================
  group('A CDN that hangs  (was: a blank white page for as long as the filter held the line)');
  // =========================================================================
  {
    const slow = await browser.newPage();
    const held = [];
    await slow.setRequestInterception(true);
    slow.on('request', r => {
      // A black-holed school filter: the request is never answered at all.
      if (/cdnjs\.cloudflare\.com/.test(r.url())) { held.push(r); return; }
      r.continue().catch(() => {});
    });
    // The navigation cannot be awaited: with the CDN hanging, 'load' does not
    // fire until the request is released. Fire it, then watch the page paint
    // while the request is still held.
    const nav = slow.goto(base + '/index.html', { waitUntil: 'load', timeout: 20000 })
                    .catch(() => {});
    let paintedAfter = -1;
    const t0 = Date.now();
    while (Date.now() - t0 < 5000) {
      const h = await slow.evaluate(() => {
        const el = document.querySelector('.header h1');
        return el ? el.getBoundingClientRect().height : 0;
      }).catch(() => 0);
      if (h > 0) { paintedAfter = Date.now() - t0; break; }
      await new Promise(r => setTimeout(r, 100));
    }
    check('the page paints while the CDN request is still hanging',
          paintedAfter >= 0 && paintedAfter < 3000, 'painted after ' + paintedAfter + 'ms');
    check('and the tool is fully usable without the library',
          await slow.evaluate(() =>
            typeof setScore === 'function' &&
            document.querySelectorAll('.count-item').length === 3).catch(() => false));
    check('html2canvas — a library nothing ever called — is not fetched at all',
          !held.some(r => /html2canvas/.test(r.url())),
          held.map(r => r.url()).join(' | '));
    // Release the held request so the page can settle before closing.
    for (const r of held) r.abort().catch(() => {});
    await nav;
    await slow.close();
  }

  // =========================================================================
  group('Each worksheet practises the skill its lesson row names');
  // =========================================================================
  await fresh(page, base);
  {
    const sheets = await page.evaluate(() => {
      const gen = name => {
        const c = WORKSHEETS[name];
        const build = c.review ? buildReviewHTML : c.syllable ? buildSyllableHTML
                    : c.letter ? buildLetterHTML : c.ending ? buildEndingHTML
                    : c.vce ? buildVCeHTML : buildWorksheetHTML;
        return build(c, false);
      };
      return {
        l89: gen('Lesson 89'), l90: gen('Lesson 90'), l113: gen('Lesson 113'),
        l10: gen('Lesson 10'), l94: gen('Lesson 94'), l111: gen('Lesson 111'),
        l114: gen('Lesson 114'), l24: gen('Lesson 24'), l25: gen('Lesson 25'),
        l26: gen('Lesson 26'), l27: gen('Lesson 27'), l32: gen('Lesson 32')
      };
    });
    check('Lesson 90 "oo (moon)" opens the moon sheet, not the book sheet',
          /as in moon/.test(sheets.l90) && /moon/.test(sheets.l90) && !/as in book/.test(sheets.l90));
    check('Lesson 89 "oo, u" opens the book sheet, not the moon sheet',
          /as in book/.test(sheets.l89) && /book/.test(sheets.l89) && !/as in moon/.test(sheets.l89));
    check('Lesson 113 "ear (hear)" practises hear/near, not earth/learn',
          /hear/.test(sheets.l113) && /near/.test(sheets.l113) &&
          !/earth/.test(sheets.l113) && !/Saying \/er\//.test(sheets.l113));
    check('Lesson 10 "CVC (a, i)" practises a and i, not g',
          /Short <em>a<\/em>/.test(sheets.l10) && /short i \(sit\)/.test(sheets.l10) &&
          !/has g/.test(sheets.l10) && !/gas/.test(sheets.l10));
    check('Lesson 94 practises head and want, not the schwa',
          /head/.test(sheets.l94) && /want/.test(sheets.l94) && !/sofa/.test(sheets.l94));
    check('Lesson 111 practises dollar and doctor, not "a person who..."',
          /dollar/.test(sheets.l111) && /doctor/.test(sheets.l111) && !/teacher/.test(sheets.l111));
    check('Lesson 114 shows the five alternate spellings it names',
          ['ei', 'eigh', 'ey', 'ea', 'aigh'].every(sp =>
            new RegExp('<em>' + sp + '</em>').test(sheets.l114)) &&
          /eight/.test(sheets.l114) && /sleigh/.test(sheets.l114) && /straight/.test(sheets.l114),
          sheets.l114.slice(0, 200));
    check('Lesson 25 (Part 2) is not a copy of Lesson 24 (Part 1)',
          sheets.l24 !== sheets.l25);
    check('Lesson 27 (Part 2) is not a copy of Lesson 26 (Part 1)',
          sheets.l26 !== sheets.l27);
    check('the Qu sheet says "Qu qu", never "Ququ"',
          !/Ququ/.test(sheets.l32) && /Letter Qu qu/.test(sheets.l32));

    // Every add-the-ending row: the boxes and the printed sum must describe
    // the same word. (107–110 teach the doubling / drop-e / y-to-i rules, where
    // the difference in letters IS the lesson — they are checked the other way:
    // the extra or missing letter must match the rule taught.)
    const sums = await page.evaluate(() => {
      const bad = [];
      const ruleLessons = ['Lesson 107', 'Lesson 108', 'Lesson 109', 'Lesson 110'];
      Object.entries(WORKSHEETS).forEach(([name, c]) => {
        if (!c.ending || ruleLessons.includes(name)) return;
        const doc = new DOMParser().parseFromString(buildEndingHTML(c, false), 'text/html');
        doc.querySelector('.mgrid').querySelectorAll('.mrow').forEach(row => {
          const base = row.querySelector('.mbase').textContent.trim();
          const added = row.querySelector('.mplus strong').textContent.trim();
          const boxes = row.querySelectorAll('.abox').length;
          if ((base + added).length !== boxes)
            bad.push(`${name}: ${base} + ${added} needs ${(base + added).length} boxes, sheet draws ${boxes}`);
        });
      });
      return bad;
    });
    check('every "add the ending" sum matches its answer boxes, letter for letter',
          sums.length === 0, sums.slice(0, 6).join(' | '));

    // The FLAGGED SKILL badge tells the truth now.
    await page.click('#sampleBtn');                     // nothing assessed
    await page.click('button[onclick="openWorksheetPicker()"]');
    await page.click(`button[onclick="openWorksheet('Lesson 45')"]`);
    let copy = await page.evaluate(() => window.__childCopy);
    check('an unassessed lesson\'s sheet does not claim to be "generated from the assessment"',
          !/Flagged skill/.test(copy) && !/Generated from the assessment/.test(copy));
    await page.evaluate(() => closeWorksheetModal());

    await pickUnit(page, 'Unit 3: Digraphs');
    await clickScore(page, 'Lesson 45', 'M');
    await page.click('button[onclick="openWorksheetPicker()"]');
    await page.click(`button[onclick="openWorksheet('Lesson 45')"]`);
    copy = await page.evaluate(() => window.__childCopy);
    check('a MASTERED lesson\'s sheet does not say "flagged" either',
          !/Flagged skill/.test(copy));
    await page.evaluate(() => closeWorksheetModal());

    await clickScore(page, 'Lesson 45', 'E');
    await page.click('button[onclick="openWorksheetPicker()"]');
    await page.click(`button[onclick="openWorksheet('Lesson 45')"]`);
    copy = await page.evaluate(() => window.__childCopy);
    check('an Emerging lesson\'s sheet IS marked as the flagged skill',
          /Flagged skill/.test(copy) && /Generated from the assessment/.test(copy));
    await page.evaluate(() => closeWorksheetModal());
  }

  // =========================================================================
  group('Worksheets on paper  (was: activity rows sliced in half by the page break)');
  // =========================================================================
  {
    // The generated sheets, rendered for print: the rules that stop an
    // activity being cut in half must actually reach the printed page.
    const htmls = await page.evaluate(() => ({
      short: buildWorksheetHTML(WORKSHEETS['Lesson 35'], true),
      letter: buildLetterHTML(WORKSHEETS['Lesson 24'], true),
      ending: buildEndingHTML(WORKSHEETS['Lesson 119'], true)
    }));
    const sheet = await browser.newPage();

    await sheet.setContent(htmls.short, { waitUntil: 'load' });
    await sheet.emulateMediaType('print');
    const frag = await sheet.evaluate(() => ({
      sbrow: getComputedStyle(document.querySelector('.sbrow')).breakInside,
      chainq: getComputedStyle(document.querySelector('.chainq')).breakInside,
      sort: getComputedStyle(document.querySelector('.sort')).breakInside,
      box: getComputedStyle(document.querySelector('.box')).breakInside,
      h2: getComputedStyle(document.querySelector('h2')).breakAfter
    }));
    check('a sound-box row cannot be sliced in half by the page break',
          frag.sbrow === 'avoid' && frag.chainq === 'avoid', JSON.stringify(frag));
    check('a sorting box prints whole on one page',
          frag.sort === 'avoid' && frag.box === 'avoid', JSON.stringify(frag));
    check('a section heading is never stranded alone at the foot of a page',
          frag.h2 === 'avoid-page' || frag.h2 === 'avoid', frag.h2);

    await sheet.setContent(htmls.letter, { waitUntil: 'load' });
    await sheet.emulateMediaType('print');
    check('the letter sheets keep their tracing rows whole too',
          await sheet.evaluate(() =>
            getComputedStyle(document.querySelector('.tracerow')).breakInside === 'avoid' &&
            getComputedStyle(document.querySelector('.lettergrid')).breakInside === 'avoid'));

    await sheet.setContent(htmls.ending, { waitUntil: 'load' });
    await sheet.emulateMediaType('print');
    check('and the ending sheets keep each add-the-ending row whole',
          await sheet.evaluate(() =>
            getComputedStyle(document.querySelector('.mrow')).breakInside === 'avoid'));
    await sheet.close();
  }

  // =========================================================================
  group('No packet quietly grows a page  (Chrome\'s own print pipeline, all 128)');
  // =========================================================================
  {
    // Every generated packet, printed the way a parent prints it: Chrome's PDF
    // pipeline with the sheets' own @page margins. Bigger writing boxes and
    // bigger read-aloud type are only safe while the page count stays put —
    // a sheet that gains a page hands a parent a stapler. The packets run 2 to
    // 5 pages BY DESIGN (grown-up page plus practice sections); what must
    // never change without a decision is the total. 404 printed pages across
    // the 128 packets is the count Sahaj approved on paper.
    const htmls = await page.evaluate(() => {
      const out = {};
      Object.keys(WORKSHEETS).forEach(name => {
        const c = WORKSHEETS[name];
        const build = c.review ? buildReviewHTML : c.syllable ? buildSyllableHTML
                    : c.letter ? buildLetterHTML : c.ending ? buildEndingHTML
                    : c.vce ? buildVCeHTML : buildWorksheetHTML;
        out[name] = build(c, true);
      });
      return out;
    });
    const pdfPages = (buf) =>
      (Buffer.from(buf).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    const sheet = await browser.newPage();
    const counts = {};
    for (const [name, html] of Object.entries(htmls)){
      await sheet.setContent(html, { waitUntil: 'load' });
      counts[name] = pdfPages(await sheet.pdf({ format: 'Letter', printBackground: true }));
    }
    await sheet.close();
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    eq('all 128 packets still print in 404 pages, none has quietly grown one',
       total, 404);
    eq('no single packet runs past its five-page ceiling',
       Object.entries(counts).filter(([, n]) => n > 5).map(([k, n]) => `${k}: ${n}`), []);
  }

  // =========================================================================
  group('Nothing shouted into a console nobody has open');
  // =========================================================================
  {
    check('no JavaScript errors anywhere in the whole run',
          pageErrors.length === 0, pageErrors.join(' | '));
    check('no console errors anywhere in the whole run',
          consoleErrors.length === 0, consoleErrors.join(' | '));
  }

  // =========================================================================
  if (COVERAGE){
    group('Coverage');
    await harvest(page);
    // Some harvested records arrive with no text or no function list (a page
    // that was navigated away from mid-record). Skipping them silently would
    // undercount, so drop only the genuinely empty ones.
    const entry = covRuns.filter(e => /index\.html/.test(e.url) && e.text &&
                                     (e.functions || e.ranges));
    if (!entry.length) console.log('  (no coverage recorded)');
    else {
      const merged = new Map();
      entry.forEach(e => {
        const cur = merged.get(e.url) || { text: e.text, used: new Uint8Array(e.text.length) };
        // Chrome hands the record back in one of two shapes depending on the
        // puppeteer version: a list of functions each with ranges, or a flat
        // list of ranges. Reading only the first shape reports 0% and looks
        // like the tests cover nothing.
        const ranges = e.functions
          ? e.functions.reduce((all, f) => all.concat(f.ranges), [])
          : e.ranges;
        ranges.forEach(r => {
          // ...and the two shapes name their offsets differently too
          // (startOffset/endOffset raw from Chrome, start/end once puppeteer
          // has folded them). Reading the wrong pair marks nothing at all.
          const from = r.startOffset !== undefined ? r.startOffset : r.start;
          const to   = r.endOffset   !== undefined ? r.endOffset   : r.end;
          if (r.count === undefined || r.count > 0)
            for (let i = from; i < to && i < cur.used.length; i++) cur.used[i] = 1;
        });
        merged.set(e.url, cur);
      });
      for (const [, { text, used }] of merged){
        const tag = text.indexOf('<script>');
        const open  = tag === -1 ? 0 : tag + '<script>'.length;
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
        if (dead.length){
          console.log(`  ${Y}${dead.length} line(s) never executed:${X}`);
          dead.forEach(d => console.log(`    ${DIM}index.html:${d.ln}${X}  ${d.code.slice(0, 96)}`));
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
