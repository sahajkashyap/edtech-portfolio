#!/usr/bin/env node
//
// Word by Word — regression tests.
//
// WHAT THIS IS
// ------------
// "Regression" means sliding backward. Every check in this file exists because
// something was once actually broken here. The point is not to prove the tool
// works today — it is so that a bug fixed in August cannot quietly come back in
// November without anybody noticing.
//
// Each test names the defect it guards. If you fix a new bug, add a test for it
// here on the same day, while you still remember what went wrong.
//
// HOW TO RUN IT
// -------------
//     cd ~/Documents/GitHub/edtech-portfolio/running-record-tool/tests
//     npm test
//
// It opens a real Google Chrome in the background, drives the tool with real
// clicks and real keypresses, and prints a line per check. It needs nothing on
// the internet.
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
      let file = path.join(ROOT, p);
      // Never serve outside the tool directory.
      if (!file.startsWith(ROOT)){ res.writeHead(403); return res.end(); }
      // GitHub Pages runs Jekyll, which renders every .md file to a matching
      // .html page. DESIGN.html therefore exists in production but not on this
      // computer. Mirror that here, or these tests would report a 404 for a
      // link that is fine live — and, worse, would tempt somebody to "fix" the
      // link back to DESIGN.md, which browsers download instead of opening.
      if (!fs.existsSync(file) && file.endsWith('.html') &&
          fs.existsSync(file.replace(/\.html$/, '.md'))){
        file = file.replace(/\.html$/, '.md');
      }
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
// Chrome throws its coverage record away on every navigation, and this suite
// reloads the page dozens of times. Left alone, the report would describe only
// whatever the LAST page load happened to touch — which is how a suite can
// claim 74% while actually measuring one screen. Harvest the record before
// each navigation and start a new one, so what gets reported is every line the
// whole run executed.
const covRuns = [];
let COVERAGE = false;
async function harvest(page){
  if (!COVERAGE) return;
  try {
    covRuns.push(...await page.coverage.stopJSCoverage());
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
  } catch (e) { /* coverage not running yet */ }
}

// `load`, not `domcontentloaded`: a favicon or stylesheet request still in
// flight when the first assertion ran was landing in the console-error list a
// fraction of the time, so the same suite passed or failed depending on
// network timing. A test that is right nine times out of ten is not a test —
// it teaches you to ignore red. Wait for the page to be genuinely finished.
async function fresh(page, base, hash){
  await harvest(page);
  await page.goto(base + '/index.html' + (hash || ''), { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await harvest(page);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}
// Every other navigation in the suite goes through here for the same reason.
async function nav(page, url){
  await harvest(page);
  return page.goto(url, { waitUntil: 'load' });
}
const state = page => page.evaluate(() => ({
  lesson: currentLesson,
  picker: +document.getElementById('lessonpick').value,
  heading: document.getElementById('ptitle').textContent,
  marks: words.filter(w => w.code).length,
  insertions, insertAt: insertAt.slice(),
  clock: clockState,
  elapsed: totalMs(),
  acc: document.getElementById('sAcc').textContent,
  band: document.getElementById('band').textContent,
  errRate: document.getElementById('sErrRatio').textContent,
  wcpm: document.getElementById('sWcpm').textContent,
  errors: +document.getElementById('ct-err').textContent,
  read: +document.getElementById('ct-words').textContent,
  ins: +document.getElementById('ct-ins').textContent,
  popOpen: document.getElementById('pop').style.display === 'block',
  records: (JSON.parse(localStorage.getItem('wbw.index') || '[]')).length
}));

// The storage keys are read from the page itself so a rename cannot silently
// make these tests pass against nothing.
const indexKey = page => page.evaluate(() => INDEX_KEY);

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

  // --- code coverage ------------------------------------------------------
  // Run with --coverage to find out not whether the tests PASS but whether
  // they LOOK at everything. Chrome records which bytes of the tool's
  // JavaScript actually executed; at the end we print every line that never
  // ran. That list is the honest answer to "what percentage is really being
  // checked" — and it is a to-do list, not an opinion.
  COVERAGE = process.argv.includes('--coverage');
  if (COVERAGE) await page.coverage.startJSCoverage({ resetOnNavigation: false });

  // Anything that would open a window or block on a dialog is stubbed, so the
  // handlers still run and can be inspected.
  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // Chrome's message for a failed request is the same generic sentence
    // whatever the file was — the URL lives in location(), not in the text. A
    // filter written against the text alone matched nothing and the run went
    // red about a quarter of the time with no way to see why. Always report
    // the URL, so a future 404 names itself instead of being a mystery.
    const url = (m.location() && m.location().url) || '';
    if (/favicon/i.test(url)) return;
    consoleErrors.push(m.text() + (url ? '  [' + url + ']' : ''));
  });
  await page.evaluateOnNewDocument(() => {
    window.__printed = 0; window.__opened = []; window.__downloads = [];
    window.print = () => { window.__printed++; };
    // Stands in for a real new window closely enough that the child's-copy
    // handler runs all the way to its print call: it needs a document with a
    // readyState, and an addEventListener for the branch Safari takes.
    window.__blockPopup = false;
    window.open = () => {
      if (window.__blockPopup) return null;
      window.__opened.push(1);
      window.__childCopy = '';
      return { document: { write(h){ window.__childCopy += h; }, close(){},
                           readyState: 'complete' },
               addEventListener(_, fn){ fn(); },
               focus(){}, print(){ window.__childPrinted = true; }, close(){} };
    };
    window.confirm = () => true;
    window.alert   = m => { window.__alert = String(m); };
    // Count live timers so an orphaned clock cannot hide.
    const si = window.setInterval, ci = window.clearInterval;
    window.__intervals = new Set();
    window.setInterval = (fn, ms) => { const id = si(fn, ms); window.__intervals.add(id); return id; };
    window.clearInterval = id => { window.__intervals.delete(id); return ci(id); };
    // Catch anchor-triggered CSV downloads instead of writing to disk.
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[download]');
      if (a){ e.preventDefault(); window.__downloads.push(a.getAttribute('href') || ''); }
    }, true);
  });

  // =========================================================================
  group('Loading, and the 36 lessons');
  // =========================================================================
  await fresh(page, base);

  check('page loads with no JavaScript errors',
        pageErrors.length === 0, pageErrors.join(' | '));
  check('page loads with no console errors',
        consoleErrors.length === 0, consoleErrors.join(' | '));

  const inventory = await page.evaluate(() => {
    const nums = Object.keys(LESSONS).map(Number).sort((a,b) => a-b);
    const bad = [];
    nums.forEach(n => {
      const L = LESSONS[n];
      if (!L.skill || !String(L.skill).trim()) bad.push(n + ': no skill');
      if (!L.title || !String(L.title).trim()) bad.push(n + ': no title');
      if (L.kind !== 'passage' && L.kind !== 'wordlist') bad.push(n + ': bad kind');
      if (L.kind === 'passage' && !Array.isArray(L.lines)) bad.push(n + ': no lines');
      if (L.kind === 'wordlist' && !Array.isArray(L.groups)) bad.push(n + ': no groups');
      if (!tokenList(n).length) bad.push(n + ': builds no words');
    });
    return { count: nums.length,
             lists: nums.filter(n => LESSONS[n].kind === 'wordlist'),
             passages: nums.filter(n => LESSONS[n].kind === 'passage').length,
             bad };
  });
  eq('36 lessons are defined', inventory.count, 36);
  eq('9 of them are word lists', inventory.lists.length, 9);
  eq('27 of them are passages', inventory.passages, 27);
  check('every lesson has the fields the screen needs',
        inventory.bad.length === 0, inventory.bad.join(' | '));

  // =========================================================================
  group('The lesson picker  (was: nine identical "word list" entries)');
  // =========================================================================
  const picker = await page.evaluate(() => {
    const sel = document.getElementById('lessonpick');
    return {
      options: sel.options.length,
      groups: [...sel.querySelectorAll('optgroup')].map(g => g.label),
      labels: [...sel.options].map(o => o.textContent),
      value: +sel.value
    };
  });
  eq('all 36 lessons are in the dropdown', picker.options, 36);
  check('the dropdown separates word lists from passages',
        picker.groups.length === 2, JSON.stringify(picker.groups));
  {
    const dupes = picker.labels.filter((l, i) => picker.labels.indexOf(l) !== i);
    check('no two lessons share a dropdown label', dupes.length === 0, dupes.join(' | '));
    const noSkill = await page.evaluate(labels => {
      const sel = document.getElementById('lessonpick');
      return [...sel.options].filter(o => !o.textContent.includes(LESSONS[o.value].skill))
                             .map(o => o.textContent);
    }, picker.labels);
    check('every dropdown entry names the sound it tests',
          noSkill.length === 0, noSkill.slice(0, 3).join(' | '));
  }

  // =========================================================================
  group('Cold start  (was: a stranger landed on Lesson 41, the hardest item)');
  // =========================================================================
  {
    const s = await state(page);
    check('opens on a passage, not a word list',
          await page.evaluate(() => LESSONS[currentLesson].kind === 'passage'),
          'opened on lesson ' + s.lesson);
    eq('the picker agrees with the lesson on screen', s.picker, s.lesson);
  }

  // =========================================================================
  group('BLOCKER: the error popover must not survive a lesson change');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    await page.click('.w[data-i="7"]');
    const opened = await state(page);
    check('the popover opens on a tapped word', opened.popOpen);

    // Move to the dropdown WITHOUT clicking the page — this is the exact route
    // that used to leave the popover alive, because it fires no document click.
    await page.focus('#lessonpick');
    await page.select('#lessonpick', '6');
    const after = await state(page);

    check('the popover is closed after switching lesson', !after.popOpen);
    eq('no marks were carried onto the new lesson', after.marks, 0);
    eq('the clock did not start', after.clock, 'idle');
    eq('nothing was written to storage', after.records, 0);
  }

  // =========================================================================
  group('BLOCKER: marking keys must not fire from the dropdown or a button');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    await page.focus('#lessonpick');
    const focused = await page.evaluate(() => document.activeElement.id);
    eq('the dropdown really has focus', focused, 'lessonpick');
    await page.keyboard.press('x');
    const s = await state(page);
    eq('pressing X with the dropdown focused marks nothing', s.marks, 0);
    eq('...and does not start the clock', s.clock, 'idle');
    eq('...and the picker still matches the passage', s.picker, s.lesson);
    check('...and the heading still names that lesson',
          s.heading.includes('Lesson ' + s.lesson), s.heading);
  }
  await fresh(page, base, '#L20');
  {
    await page.evaluate(() => document.getElementById('undobtn').focus());
    const focused = await page.evaluate(() => document.activeElement.id);
    eq('the Undo button really has focus', focused, 'undobtn');
    await page.keyboard.press('x');
    eq('pressing X with a button focused marks nothing', (await state(page)).marks, 0);
  }
  await fresh(page, base, '#L20');
  {
    // The fix above must not cost the teacher their keyboard: after clicking a
    // control with the MOUSE, the marking keys have to keep working.
    await page.click('#pausebtn');
    await page.click('#pausebtn');
    await page.keyboard.press('x');
    const s = await state(page);
    check('marking keys still work after clicking a button with the mouse',
          s.marks === 1, JSON.stringify(s));
  }

  // =========================================================================
  group('The picker and the passage can never disagree');
  // =========================================================================
  {
    const drift = await page.evaluate(() => {
      const out = [];
      Object.keys(LESSONS).map(Number).forEach(n => {
        switchLesson(n);
        const pick = +document.getElementById('lessonpick').value;
        const head = document.getElementById('ptitle').textContent;
        if (pick !== n) out.push(n + ': picker showed ' + pick);
        if (!head.includes('Lesson ' + n)) out.push(n + ': heading said "' + head + '"');
        if (!head.includes(LESSONS[n].skill)) out.push(n + ': heading omits skill');
        if (words.length !== tokenList(n).length) out.push(n + ': wrong word count');
        if (words.some(w => w.code)) out.push(n + ': marks carried over');
      });
      return out;
    });
    check('all 36 lessons: picker, heading and words agree',
          drift.length === 0, drift.slice(0, 4).join(' | '));
  }

  // =========================================================================
  group('The clock');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    const before = await page.evaluate(() => window.__intervals.size);
    await page.keyboard.press('x');
    await page.keyboard.press('x');
    await page.evaluate(() => { autoStart(); autoStart(); autoStart(); });
    const after = await page.evaluate(() => window.__intervals.size);
    eq('starting the clock repeatedly never adds a second timer', after, before);

    const t1 = (await state(page)).elapsed;
    await new Promise(r => setTimeout(r, 1000));
    const t2 = (await state(page)).elapsed;
    check('the clock accumulates about one second per second',
          (t2 - t1) > 800 && (t2 - t1) < 1300, `moved ${t2 - t1}ms in 1000ms`);

    await page.click('#pausebtn');
    const p1 = (await state(page)).elapsed;
    await new Promise(r => setTimeout(r, 600));
    const p2 = (await state(page)).elapsed;
    eq('pause really stops the clock', p1, p2);

    await page.keyboard.press('o');
    const p3 = (await state(page)).elapsed;
    eq('marking while paused does not secretly restart it', p2, p3);
  }
  {
    // Switching lesson mid-read must not leave a timer running behind.
    await fresh(page, base, '#L20');
    await page.keyboard.press('x');
    await page.select('#lessonpick', '26');
    const s1 = await state(page);
    await new Promise(r => setTimeout(r, 900));
    const s2 = await state(page);
    eq('switching lesson resets the clock', s1.elapsed, 0);
    eq('...and leaves nothing counting behind it', s2.elapsed, 0);
  }

  // =========================================================================
  group('The arithmetic');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    const s = await page.evaluate(() => {
      // A known hand-checked case: 1 substitution, 1 omission, 1 told,
      // 1 self-correction, 1 repetition, 1 appeal, 2 insertions.
      mark(0, 'sub'); mark(1, 'omit'); mark(2, 'told');
      mark(3, 'sc');  mark(4, 'rep');  mark(5, 'appeal');
      insertions = 2; insertAt = [6, 7];
      elapsed = 60000; runningSince = null; clockState = 'paused';
      render();
      return stats();
    });
    eq('self-corrections, repetitions and appeals are not errors', s.errors, 5);
    const shown = await state(page);
    const expectedAcc = Math.round(((s.read - s.errors) / s.read) * 100);
    eq('accuracy is (words - errors) / words', shown.acc, expectedAcc + '%');
    eq('error rate is one in (words / errors)', shown.errRate,
       '1:' + Math.max(1, Math.round(s.read / s.errors)));
    eq('words correct per minute is (words - errors) per minute',
       shown.wcpm, String(s.read - s.errors));
  }

  // =========================================================================
  group('Numbers that cannot be true  (was: "-944 wcpm" and "1:0")');
  // =========================================================================
  {
    const bad = await page.evaluate(() => {
      insertions = 999; insertAt = []; elapsed = 60000; render();
      const wcpm = document.getElementById('sWcpm').textContent;
      const err  = document.getElementById('sErrRatio').textContent;
      const acc  = document.getElementById('sAcc').textContent;
      return { wcpm, err, acc };
    });
    check('words correct per minute never goes negative',
          !bad.wcpm.startsWith('-'), 'showed ' + bad.wcpm);
    check('the error rate is never "1:0"', bad.err !== '1:0', 'showed ' + bad.err);
    check('accuracy never goes below zero',
          !bad.acc.startsWith('-'), 'showed ' + bad.acc);
  }
  {
    const text = await page.evaluate(() => document.body.innerText);
    check('no NaN or Infinity reaches the screen in any of the above',
          !/\bNaN\b|\bInfinity\b/.test(text),
          (text.match(/.{0,30}(NaN|Infinity).{0,30}/) || [''])[0]);
  }
  {
    await fresh(page, base, '#L20');
    const zero = await page.evaluate(() => {
      mark(0, 'sub'); elapsed = 0; runningSince = null; render();
      return document.getElementById('sWcpm').textContent;
    });
    eq('a rate is not reported off a zero-length reading', zero, '–');
  }

  // =========================================================================
  group('Added words past the stop mark  (was: counted anyway)');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    const r = await page.evaluate(() => {
      mark(0, 'sub');
      insertions = 4; insertAt = [1, 2, 30, 31];   // two before the stop, two after
      stoppedAt = 4; render();
      return { counted: stats().ins, shown: +document.getElementById('ct-ins').textContent };
    });
    eq('only the added words before the stop mark are counted', r.counted, 2);
    eq('the tally on screen shows the same number', r.shown, 2);
  }
  {
    // A record saved before insertAt existed must not silently lose errors.
    const legacy = await page.evaluate(() => {
      insertions = 4; insertAt = []; stoppedAt = 4; render();
      return stats().ins;
    });
    eq('older records keep their whole count rather than losing errors', legacy, 4);
  }

  // =========================================================================
  group('Word lists are never given a reading level');
  // =========================================================================
  {
    const offenders = await page.evaluate(() => {
      const bad = [];
      Object.keys(LESSONS).map(Number)
        .filter(n => LESSONS[n].kind === 'wordlist')
        .forEach(n => {
          switchLesson(n);
          // Force an accuracy that WOULD band as Frustration on a passage.
          words.forEach((w, i) => { if (i < 3) w.code = 'sub'; });
          render();
          const band = document.getElementById('band').textContent;
          if (/Independent|Instructional|Frustration/.test(band)) bad.push(n + ' screen: ' + band);
          paintPrint();
          const pr = document.getElementById('prnums').textContent;
          if (/Independent|Instructional|Frustration/.test(pr)) bad.push(n + ' print');
        });
      return bad;
    });
    check('all 9 word lists: no band on screen or in print',
          offenders.length === 0, offenders.join(' | '));
  }

  // =========================================================================
  group('Saving and re-opening');
  // =========================================================================
  await fresh(page, base, '#L26');
  {
    const KEY = await indexKey(page);
    await page.type('#initials', 'AB');
    await page.click('.w[data-i="2"]');
    await page.click('#pop button[data-code="sub"]');
    await page.evaluate(() => flushSave());

    const first = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    eq('one record after assessing one child', first.length, 1);

    // A second child, same lesson. This used to overwrite the first.
    await page.evaluate(() => newRecord());
    await page.type('#initials', 'CD');
    await page.click('.w[data-i="5"]');
    await page.click('#pop button[data-code="omit"]');
    await page.evaluate(() => flushSave());

    const both = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    eq('two children on the same lesson keep two records', both.length, 2);
    eq('both children are named', both.map(r => r.initials).sort(), ['AB', 'CD']);

    // Re-open the first child and confirm every mark comes back.
    const restored = await page.evaluate((k) => {
      const id = JSON.parse(localStorage.getItem(k)).find(r => r.initials === 'AB').id;
      const ok = openRecord(id);
      return { ok, initials: document.getElementById('initials').value,
               marks: words.map(w => w.code), lesson: currentLesson,
               picker: +document.getElementById('lessonpick').value };
    }, KEY);
    check('the first child re-opens', restored.ok);
    eq('their initials come back', restored.initials, 'AB');
    eq('their mark is on the same word', restored.marks[2], 'sub');
    eq('re-opening moves the picker too', restored.picker, restored.lesson);
  }

  // =========================================================================
  group('A retell on its own must save  (was: silently discarded)');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    const KEY = await indexKey(page);
    await page.type('#retell', 'She retold the whole story in order.');
    await page.evaluate(() => flushSave());
    const list = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), KEY);
    eq('typing only a retell still creates a record', list.length, 1);
  }
  await fresh(page, base, '#L20');
  {
    const KEY = await indexKey(page);
    await page.click('.retellrow button');
    await page.evaluate(() => flushSave());
    const list = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), KEY);
    eq('choosing only a retell level still creates a record', list.length, 1);
  }

  // =========================================================================
  group('Reading time is not lost  (was: stale in storage while running)');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    const KEY = await indexKey(page);
    await page.keyboard.press('x');              // starts the clock, creates a record
    await new Promise(r => setTimeout(r, 6000)); // past one heartbeat
    const gap = await page.evaluate(k => {
      const id = JSON.parse(localStorage.getItem(k))[0].id;
      const rec = JSON.parse(localStorage.getItem('wbw.rec.' + id) ||
                             localStorage.getItem(recKey(id)));
      return { live: totalMs(), stored: rec.elapsed };
    }, KEY);
    check('the stored reading time keeps up with the clock',
          Math.abs(gap.live - gap.stored) < 5500,
          `live ${gap.live}ms vs stored ${gap.stored}ms`);
  }
  await fresh(page, base, '#L20');
  {
    // flushSave() used to decline to write if it had already run once.
    const KEY = await indexKey(page);
    await page.keyboard.press('x');
    await page.evaluate(() => flushSave());
    await new Promise(r => setTimeout(r, 1200));
    const gap = await page.evaluate(k => {
      const id = JSON.parse(localStorage.getItem(k))[0].id;
      flushSave();
      const rec = JSON.parse(localStorage.getItem(recKey(id)));
      return { live: totalMs(), stored: rec.elapsed };
    }, KEY);
    check('a second flush still writes the time that has passed',
          Math.abs(gap.live - gap.stored) < 300,
          `live ${gap.live}ms vs stored ${gap.stored}ms`);
  }

  // =========================================================================
  group('A child\'s name is never treated as HTML');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    const r = await page.evaluate(() => {
      document.getElementById('initials').value = '<u>x';
      mark(0, 'sub');
      paintPrint(); writeRecord(true); paintRecords();
      return { print: document.getElementById('prwho').querySelectorAll('u').length,
               list:  document.getElementById('records').querySelectorAll('u').length };
    });
    eq('no live HTML in the printed header', r.print, 0);
    eq('no live HTML in the saved-records list', r.list, 0);
  }

  // =========================================================================
  group('Exporting the spreadsheet');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    const csv = await page.evaluate(() => {
      document.getElementById('initials').value = 'Smith, J. "JJ"';
      document.getElementById('notes').value = 'line one\nline two, with a comma';
      mark(0, 'sub'); mark(1, 'omit');
      elapsed = 60000; clockState = 'paused';
      writeRecord(true);
      // Grab what the export builds without writing a file.
      const a = [...document.querySelectorAll('button')]
        .find(b => /export|csv|spreadsheet/i.test(b.textContent));
      if (a) a.click();
      return window.__downloads.slice(-1)[0] || '';
    });
    check('the export produces a file', csv.length > 0, 'no download was triggered');
    if (csv){
      const text = decodeURIComponent(csv.replace(/^data:[^,]*,/, ''));
      check('a quoted name is escaped, not broken across columns',
            text.includes('"Smith, J. ""JJ"""'), text.slice(0, 120));

      // A proper CSV reader, not a split on newlines. A teacher's notes may
      // legally contain a comma, a quote or a line break, and all three are
      // supposed to sit INSIDE one quoted field — splitting on '\n' tears such
      // a row in half and then reports the tool as broken when it is correct.
      const parse = s => {
        const rows = [[]]; let cell = '', quoted = false;
        for (let i = 0; i < s.length; i++){
          const c = s[i];
          if (quoted){
            if (c === '"' && s[i+1] === '"'){ cell += '"'; i++; }
            else if (c === '"') quoted = false;
            else cell += c;
          } else if (c === '"') quoted = true;
          else if (c === ','){ rows[rows.length-1].push(cell); cell = ''; }
          else if (c === '\n'){ rows[rows.length-1].push(cell); cell = ''; rows.push([]); }
          else if (c !== '\r') cell += c;
        }
        rows[rows.length-1].push(cell);
        return rows.filter(r => r.length > 1 || r[0] !== '');
      };
      const rows = parse(text.replace(/^﻿/, ''));
      const widths = [...new Set(rows.map(r => r.length))];
      check('every row has the same number of columns',
            widths.length === 1, 'column counts: ' + widths.join(', '));
      check('a note containing a comma, a quote and a line break survives whole',
            rows.some(r => r.some(c => c.includes('line one\nline two, with a comma'))),
            JSON.stringify(rows[1] ? rows[1].slice(-4) : []));
    }
  }

  // =========================================================================
  group('Deep links, and the routes into a lesson');
  // =========================================================================
  for (const n of [6, 14, 25, 41]){
    await fresh(page, base, '#L' + n);
    const s = await state(page);
    eq(`#L${n} opens lesson ${n}`, s.lesson, n);
    eq(`#L${n} moves the picker too`, s.picker, n);
  }
  {
    await fresh(page, base, '#L999');
    check('a lesson number that does not exist falls back safely',
          await page.evaluate(() => !!LESSONS[currentLesson]));
  }
  {
    await fresh(page, base);
    const navBar = await page.evaluate(() => {
      const el = document.querySelector('.sitenav');
      if (!el) return null;
      const passage = document.getElementById('passage');
      return { links: [...el.querySelectorAll('a')].map(a => a.getAttribute('href')),
               // Above the passage means a teacher on an iPad sees it on arrival.
               aboveThePassage: !!(el.compareDocumentPosition(passage) &
                                   Node.DOCUMENT_POSITION_FOLLOWING) };
    });
    check('the navigation links exist', !!navBar);
    if (navBar){
      check('they sit above the passage, not below it', navBar.aboveThePassage);
      check('none of them points at a file the browser would download',
            !navBar.links.some(h => /\.md$/.test(h)), navBar.links.join(' | '));
      for (const href of navBar.links.filter(h => !/^https?:/.test(h))){
        const res = await nav(page, base + '/' + href);
        eq(`the "${href}" link opens a real page`, res.status(), 200);
      }
    }
  }
  {
    // Every "Mark this one" link on the all-lessons page must land correctly.
    await nav(page, base + '/all-lessons.html');
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="index.html#L"]')].map(a => a.getAttribute('href')));
    eq('all 36 lessons link back into the tool', links.length, 36);
    const sample = [links[0], links[8], links[9], links[35]];
    for (const href of sample){
      const n = +href.split('#L')[1];
      await fresh(page, base, '#L' + n);
      eq(`"${href}" lands on lesson ${n}`, (await state(page)).lesson, n);
    }
  }

  // =========================================================================
  group('Print, and the child\'s sheet');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    const ok = await page.evaluate(() => {
      const out = [];
      Object.keys(LESSONS).map(Number).forEach(n => {
        try { switchLesson(n); paintPrint(); childCopyHtml(); }
        catch (e){ out.push(n + ': ' + e.message); }
      });
      return out;
    });
    check('the printed record and the child\'s sheet build for all 36 lessons',
          ok.length === 0, ok.slice(0, 3).join(' | '));
  }

  // =========================================================================
  group('Every marking key, by hand');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    // One key at a time, each checked against the mark it is supposed to make.
    const cases = [['x','sub'], ['o','omit'], ['t','told']];
    for (const [key, code] of cases){
      await fresh(page, base, '#L20');
      await page.keyboard.press(key);
      const r = await page.evaluate(() => ({ code: words[0].code, cursor, clock: clockState }));
      eq(`"${key}" marks a ${code}`, r.code, code);
      eq(`"${key}" moves to the next word`, r.cursor, 1);
      eq(`"${key}" starts the clock`, r.clock, 'running');
    }
    // These three land on the word just read, not the one under the cursor.
    for (const [key, code] of [['s','sc'], ['r','rep'], ['a','appeal']]){
      await fresh(page, base, '#L20');
      await page.keyboard.press('x');       // deal with word 0, cursor moves to 1
      await page.keyboard.press(key);
      const r = await page.evaluate(() => words.map(w => w.code));
      eq(`"${key}" marks a ${code} on the word just read`, r[0], code);
    }
  }
  await fresh(page, base, '#L20');
  {
    await page.keyboard.press('i');
    const r = await page.evaluate(() => ({ n: insertions, at: insertAt.slice(),
                                           clock: clockState }));
    eq('"i" records an added word', r.n, 1);
    eq('...and remembers where it happened', r.at, [0]);
    eq('...and starts the clock', r.clock, 'running');
  }
  await fresh(page, base, '#L20');
  {
    await page.keyboard.press('x');
    await page.keyboard.press('p');
    const paused = await page.evaluate(() => clockState);
    eq('"p" pauses the clock', paused, 'paused');
    await page.keyboard.press('p');
    eq('"p" again resumes it', await page.evaluate(() => clockState), 'running');
  }
  await fresh(page, base, '#L20');
  {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    eq('the arrow keys move the cursor forward', await page.evaluate(() => cursor), 2);
    await page.keyboard.press('ArrowLeft');
    eq('...and back', await page.evaluate(() => cursor), 1);
    await page.keyboard.press('e');
    const st = await page.evaluate(() => ({ stop: stoppedAt, clock: clockState }));
    eq('"e" sets the stop mark where the cursor is', st.stop, 1);
    eq('...and finishes the reading', st.clock, 'done');
    await page.keyboard.press('e');
    eq('"e" again lifts the stop mark', await page.evaluate(() => stoppedAt), null);
  }
  await fresh(page, base, '#L20');
  {
    await page.keyboard.press('Enter');
    const r = await page.evaluate(() => ({
      open: document.getElementById('pop').style.display === 'block',
      focused: document.activeElement.id }));
    check('Enter opens the popover on the word just read', r.open);
    eq('...with the cursor in the "read as" box', r.focused, 'saidbox');
    await page.keyboard.press('Escape');
    eq('Escape closes it again',
       await page.evaluate(() => document.getElementById('pop').style.display), 'none');
  }

  // =========================================================================
  group('Undo');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    await page.keyboard.press('x');
    await page.keyboard.press('o');
    await page.keyboard.press('Backspace');
    const one = await page.evaluate(() => words.map(w => w.code).filter(Boolean));
    eq('Backspace undoes the last mark only', one, ['sub']);
    await page.click('#undobtn');
    eq('the Undo button undoes the one before it',
       await page.evaluate(() => words.map(w => w.code).filter(Boolean)), []);
    await page.click('#undobtn');
    check('undoing past the beginning does not throw',
          await page.evaluate(() => Array.isArray(words)));
  }
  await fresh(page, base, '#L20');
  {
    // Clearing every mark is the most destructive button on the page. It must
    // be reversible, and the added words must come back with the marks.
    await page.keyboard.press('x');
    await page.keyboard.press('i');
    await page.click('#clearmarksbtn');
    const cleared = await page.evaluate(() => ({
      marks: words.filter(w => w.code).length, ins: insertions, at: insertAt.slice(),
      msg: document.getElementById('savedmsg').textContent }));
    eq('Clear all marks removes the marks', cleared.marks, 0);
    eq('...and the added words', cleared.ins, 0);
    check('...and says how to get them back', /Undo/.test(cleared.msg), cleared.msg);
    await page.click('#undobtn');
    const back = await page.evaluate(() => ({
      marks: words.filter(w => w.code).length, ins: insertions, at: insertAt.slice() }));
    eq('Undo brings every mark back', back.marks, 1);
    eq('...and the added words with them', back.ins, 1);
    // The "x" moved the cursor to word 1 before the "i" was pressed, so the
    // added word belongs at 1, not 0.
    eq('...including where they happened', back.at, [1]);
  }

  // =========================================================================
  group('The popover: cue analysis and "read as"');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    await page.click('.w[data-i="0"]');
    await page.click('#pop button[data-code="sub"]');
    await page.click('#pop button[data-cue="m"]');
    await page.click('#pop button[data-cue="v"]');
    const r = await page.evaluate(() => ({ cues: words[0].cues,
      coded: document.getElementById('cuebox').style.display,
      m: document.getElementById('cM').textContent,
      v: document.getElementById('cV').textContent }));
    eq('meaning is recorded when the teacher marks it', r.cues.m, true);
    eq('visual is recorded too', r.cues.v, true);
    eq('the cue tally appears once something is coded', r.coded, 'block');
    eq('the M count is what was marked', r.m, '1');
    eq('the V count is what was marked', r.v, '1');
    await page.click('#pop button[data-cue="m"]');
    eq('clicking a cue again takes it off',
       await page.evaluate(() => !!(words[0].cues || {}).m), false);
    await page.click('#undobtn');
    eq('a cue is undoable like any other mark',
       await page.evaluate(() => !!(words[0].cues || {}).m), true);
  }
  await fresh(page, base, '#L20');
  {
    await page.click('.w[data-i="3"]');
    await page.type('#saidbox', 'horse');
    const typed = await page.evaluate(() => ({ said: words[3].said, code: words[3].code }));
    eq('what the child said is recorded', typed.said, 'horse');
    eq('typing what they said makes it a substitution', typed.code, 'sub');
    await page.evaluate(() => { const b = document.getElementById('saidbox');
      b.value = ''; b.dispatchEvent(new Event('input', { bubbles: true })); });
    eq('deleting it again does not leave a substitution behind',
       await page.evaluate(() => words[3].code), null);
    await page.click('.w[data-i="3"]');
    await page.type('#saidbox', 'pony');
    await page.keyboard.press('Enter');
    eq('Enter in the "read as" box closes the popover',
       await page.evaluate(() => document.getElementById('pop').style.display), 'none');
    eq('...and keeps what was typed', await page.evaluate(() => words[3].said), 'pony');
  }

  // =========================================================================
  group('Finish, Reopen, and starting again');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    await page.keyboard.press('x');
    await page.click('#finishbtn');
    const done = await page.evaluate(() => ({ clock: clockState,
      label: document.getElementById('finishbtn').textContent,
      pauseDisabled: document.getElementById('pausebtn').disabled }));
    eq('Finish stops the clock', done.clock, 'done');
    check('the button now offers to reopen', /Reopen/i.test(done.label), done.label);
    const t1 = (await state(page)).elapsed;
    await new Promise(r => setTimeout(r, 600));
    eq('a finished reading really has stopped counting', (await state(page)).elapsed, t1);
    await page.click('#finishbtn');
    eq('Reopen starts it again', await page.evaluate(() => clockState), 'running');
  }
  await fresh(page, base, '#L20');
  {
    await page.evaluate(() => { clockState = 'idle'; finish(); });
    eq('finishing without ever starting still closes the record',
       await page.evaluate(() => clockState), 'done');
  }
  await fresh(page, base, '#L20');
  {
    await page.type('#initials', 'ZZ');
    await page.keyboard.press('x');
    await page.click('#clearbtn');
    const s = await page.evaluate(() => ({ initials: document.getElementById('initials').value,
      marks: words.filter(w => w.code).length, clock: clockState }));
    eq('Start a new record clears the child', s.initials, '');
    eq('...and the marks', s.marks, 0);
    eq('...and the clock', s.clock, 'idle');
  }

  // =========================================================================
  group('Deleting a record');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    const KEY = await indexKey(page);
    await page.type('#initials', 'QQ');
    await page.keyboard.press('x');
    await page.evaluate(() => flushSave());
    eq('a record exists to delete',
       (await page.evaluate(k => JSON.parse(localStorage.getItem(k)).length, KEY)), 1);
    const leftovers = await page.evaluate(k => {
      const id = JSON.parse(localStorage.getItem(k))[0].id;
      deleteRecord(id);
      return { index: JSON.parse(localStorage.getItem(k) || '[]').length,
               body: localStorage.getItem(recKey(id)) };
    }, KEY);
    eq('deleting removes it from the list', leftovers.index, 0);
    eq('...and does not leave the record behind in storage', leftovers.body, null);
  }

  // =========================================================================
  group('A record that no longer fits its lesson');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    const KEY = await indexKey(page);
    await page.type('#initials', 'RR');
    await page.keyboard.press('x');
    await page.evaluate(() => flushSave());
    const guard = await page.evaluate(k => {
      const id = JSON.parse(localStorage.getItem(k))[0].id;
      // Corrupt it the way an edited passage would: one word no longer matches.
      const rec = JSON.parse(localStorage.getItem(recKey(id)));
      rec.words[0].text = 'zzzz-not-a-real-word';
      localStorage.setItem(recKey(id), JSON.stringify(rec));
      const before = { lesson: currentLesson, marks: words.filter(w => w.code).length };
      const ok = openRecord(id);
      return { ok, before, after: { lesson: currentLesson,
               marks: words.filter(w => w.code).length },
               msg: document.getElementById('savedmsg').textContent,
               stillThere: !!localStorage.getItem(recKey(id)) };
    }, KEY);
    eq('a record whose words no longer match is refused', guard.ok, false);
    check('the teacher is told why', /no longer line up/.test(guard.msg), guard.msg);
    check('the record is still saved', guard.stillThere);
    eq('and nothing on screen was disturbed', guard.after, guard.before);
  }
  {
    const counts = await page.evaluate(() => ({
      real: tokenCount(20), missing: tokenCount(9999) }));
    check('the word count for a real lesson is a real number', counts.real > 0, String(counts.real));
    eq('a lesson that does not exist counts as -1, not a crash', counts.missing, -1);
  }

  // =========================================================================
  group('Printing');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    await page.type('#initials', 'PP');
    await page.keyboard.press('x');
    await page.click('#printbtn');
    const r = await page.evaluate(() => ({ printed: window.__printed,
      header: document.getElementById('prwho').textContent }));
    eq('Print this record calls the print dialog once', r.printed, 1);
    check('the printed header names the child and the lesson',
          r.header.includes('PP') && r.header.includes('Lesson 20'), r.header);
  }
  await fresh(page, base, '#L20');
  {
    await page.click('#childcopybtn');
    const r = await page.evaluate(() => ({ opened: window.__opened.length,
      printed: !!window.__childPrinted, html: window.__childCopy || '' }));
    eq('the child\'s copy opens its own window', r.opened, 1);
    check('...and prints it', r.printed);
    check('...containing the passage, with nothing marked on it',
          r.html.length > 200 && !/class="tag/.test(r.html), 'length ' + r.html.length);
  }
  await fresh(page, base, '#L20');
  {
    const msg = await page.evaluate(() => {
      window.__blockPopup = true;                 // as a pop-up blocker would
      document.getElementById('childcopybtn').click();
      return document.getElementById('savedmsg').textContent;
    });
    check('a blocked pop-up is explained rather than failing silently',
          /pop-?ups/i.test(msg), msg);
  }

  // =========================================================================
  group('The screen, the paper and the spreadsheet must never disagree');
  // =========================================================================
  // The printed record and the CSV each re-derive the same arithmetic instead
  // of calling stats(). Three separate implementations of one calculation is
  // three chances to drift, and all three had drifted.
  await fresh(page, base, '#L20');
  {
    // 19 words read with 1 error is 94.74% — which every surface DISPLAYS as
    // "95%". The screen banded the rounded number and the paper banded the
    // raw one, so the same record came out Independent on screen and
    // Instructional on the page that goes to the learning specialist.
    const r = await page.evaluate(() => {
      const letters = words.map((w, i) => /[a-z]/i.test(w.text) ? i : -1).filter(i => i >= 0);
      words[letters[0]].code = 'sub';
      stoppedAt = letters[18];
      elapsed = 60000; runningSince = null; clockState = 'paused';
      render(); paintPrint();
      return { acc: document.getElementById('sAcc').textContent,
               screen: document.getElementById('band').textContent,
               print: [...document.getElementById('prnums').children][1]
                        .querySelector('.v').textContent };
    });
    eq('the percentage shown is the rounded one', r.acc, '95%');
    eq('the paper shows the band the teacher saw on screen', r.print, r.screen);
  }
  await fresh(page, base, '#L20');
  {
    // The other cut-off, from the other side: 29 read with 3 errors is 89.66%,
    // displayed as "90%".
    const r = await page.evaluate(() => {
      const letters = words.map((w, i) => /[a-z]/i.test(w.text) ? i : -1).filter(i => i >= 0);
      [0, 1, 2].forEach(k => { words[letters[k]].code = 'sub'; });
      stoppedAt = letters[28];
      elapsed = 60000; runningSince = null; clockState = 'paused';
      render(); paintPrint();
      return { acc: document.getElementById('sAcc').textContent,
               screen: document.getElementById('band').textContent,
               print: [...document.getElementById('prnums').children][1]
                        .querySelector('.v').textContent };
    });
    eq('the percentage shown is the rounded one, at the lower cut-off', r.acc, '90%');
    eq('the paper agrees with the screen there too', r.print, r.screen);
  }
  await fresh(page, base, '#L6');
  {
    // A word list gets no reading RATE either, and the tile used to show one
    // right beside the banner explaining that it would not.
    const r = await page.evaluate(() => {
      elapsed = 60000; runningSince = null; clockState = 'paused';
      render(); paintPrint();
      return { tile: document.getElementById('sWcpm').textContent,
               print: [...document.getElementById('prnums').children][6]
                        .querySelector('.v').textContent };
    });
    eq('the printed record refuses a word-list rate', r.print, '–');
    eq('the tile on screen refuses it too', r.tile, '–');
  }
  await fresh(page, base, '#L20');
  {
    // Cues on miscues past the stop mark: the screen and the paper exclude
    // them, and the spreadsheet used to count them.
    const r = await page.evaluate(() => {
      mark(0, 'sub'); words[0].cues = { m: true };
      const mid = Math.floor(words.length / 2);
      mark(mid + 1, 'sub'); words[mid + 1].cues = { m: true };   // past the stop
      stoppedAt = mid;
      render(); flushSave();
      const onScreen = +document.getElementById('cM').textContent;
      document.getElementById('exportbtn').click();
      return { onScreen, csv: window.__downloads.slice(-1)[0] || '' };
    });
    check('the export ran', r.csv.length > 0);
    if (r.csv){
      const text = decodeURIComponent(r.csv.replace(/^data:[^,]*,/, '')).replace(/^﻿/, '');
      const rows = text.trim().split('\n').map(l => l.split(','));
      const col = rows[0].findIndex(h => /Cue M/i.test(h));
      check('the spreadsheet has a Cue M column', col >= 0, rows[0].join('|').slice(0, 120));
      if (col >= 0)
        eq('Cue M in the spreadsheet is Cue M on the screen',
           Number(rows[1][col]), r.onScreen);
    }
  }

  // =========================================================================
  group('BLOCKER: moving to the next lesson must not relabel the record just saved');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    // The ordinary end-of-assessment gesture. switchLesson() flushed correctly,
    // then newRecord() flushed AGAIN on its way out — after the lesson number
    // had moved on but before the marks were cleared — rewriting the record
    // just saved with the new lesson against the old lesson's words. The row
    // named a lesson the child never read, and re-opening it was refused.
    const KEY = await indexKey(page);
    await page.type('#initials', 'AB');
    await page.click('.w[data-i="0"]');
    await page.click('#pop button[data-code="sub"]');
    await page.keyboard.press('Escape');
    await page.select('#lessonpick', '26');
    const rec = await page.evaluate(k => {
      const list = JSON.parse(localStorage.getItem(k) || '[]');
      const e = list[0];
      return { count: list.length, id: e.id, listed: e.lesson,
               stored: JSON.parse(localStorage.getItem(recKey(e.id))).lesson };
    }, KEY);
    eq('moving on leaves exactly one record behind', rec.count, 1);
    eq('the record still names the lesson it was read on', rec.stored, 20);
    eq('the saved-records list shows that same lesson', rec.listed, 20);
    check('the child\'s record still opens afterwards',
          await page.evaluate(id => openRecord(id), rec.id));
  }

  // =========================================================================
  group('Export writes down what is on the screen now');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    // Export read storage straight past the 400ms save debounce, so it claimed
    // there was nothing to export with a marked-up record in plain view.
    await page.keyboard.press('x');
    await page.click('#exportbtn');
    const r = await page.evaluate(() => ({ alert: window.__alert || '',
                                           got: window.__downloads.length }));
    check('exporting right after a mark exports it, rather than claiming there is nothing',
          r.got === 1, 'alert said: ' + r.alert);
  }
  await fresh(page, base, '#L20');
  {
    await page.type('#initials', 'NN');
    await page.keyboard.press('x');
    await page.evaluate(() => flushSave());
    await page.type('#notes', 'checked the picture on every page');
    await page.click('#exportbtn');
    const text = await page.evaluate(() =>
      decodeURIComponent((window.__downloads.slice(-1)[0] || '').replace(/^data:[^,]*,/, '')));
    check('a note typed just before Export is in the export',
          text.includes('checked the picture on every page'));
  }

  // =========================================================================
  group('Undo really reverses "Clear all marks" — the reading time included');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    // The button's own message says "Press Undo if that was not what you
    // meant". Undo brought the marks back but not the minute of reading the
    // same button had reset to zero.
    await page.keyboard.press('x');
    await new Promise(r => setTimeout(r, 1200));
    const before = await page.evaluate(() => totalMs());
    await page.click('#clearmarksbtn');
    await page.click('#undobtn');
    const after = await page.evaluate(() => ({ ms: totalMs(),
      marks: words.filter(w => w.code).length }));
    eq('the mark comes back', after.marks, 1);
    check('the reading time comes back with it',
          after.ms >= before - 50, `had ${before}ms, after undo ${after.ms}ms`);
  }
  await fresh(page, base, '#L20');
  {
    // But an ordinary Undo must NOT rewind the clock — undoing a mark means
    // undoing the mark, not the reading.
    await page.keyboard.press('x');
    await new Promise(r => setTimeout(r, 700));
    const before = await page.evaluate(() => totalMs());
    await page.keyboard.press('o');
    await page.click('#undobtn');
    const after = await page.evaluate(() => totalMs());
    check('undoing a single mark leaves the clock alone',
          after >= before, `was ${before}ms, now ${after}ms`);
  }

  // =========================================================================
  group('An accidental stop mark can be taken back, clock included');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    // Pressing E mid-read then taking it back used to leave the clock 'done'
    // with no stop mark and nothing on screen saying so: every later mark
    // recorded no time, and the final rate came out silently inflated.
    await page.keyboard.press('x');
    await page.keyboard.press('e');
    await page.keyboard.press('e');
    eq('pressing E again lifts the stop mark',
       await page.evaluate(() => stoppedAt), null);
    eq('...and the clock is counting again',
       await page.evaluate(() => clockState), 'running');
  }
  await fresh(page, base, '#L20');
  {
    await page.keyboard.press('x');
    await page.keyboard.press('e');
    await page.keyboard.press('Backspace');
    eq('undoing a stop mark lifts it', await page.evaluate(() => stoppedAt), null);
    eq('...and restores the clock too', await page.evaluate(() => clockState), 'running');
  }

  // =========================================================================
  group('Clearing a mark is not making one');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    await page.click('.w[data-i="3"]');
    await page.click('#pop button[data-code="correct"]');
    eq('"Clear this mark" on an unmarked word does not start the assessment clock',
       await page.evaluate(() => clockState), 'idle');
  }

  // =========================================================================
  group('Records that storage has damaged');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    // A row listed with its contents gone: Open did nothing at all — no
    // message, nothing on screen — so a teacher could not tell a missed click
    // from a lost record.
    const KEY = await indexKey(page);
    await page.type('#initials', 'GH');
    await page.keyboard.press('x');
    await page.evaluate(() => flushSave());
    const msg = await page.evaluate(k => {
      const id = JSON.parse(localStorage.getItem(k))[0].id;
      newRecord();
      localStorage.removeItem(recKey(id));
      document.getElementById('savedmsg').textContent = '';
      openRecord(id);
      return document.getElementById('savedmsg').textContent;
    }, KEY);
    check('opening a record whose contents are gone says so', msg.trim() !== '', msg);
  }
  await fresh(page, base, '#L20');
  {
    // The other way storage goes wrong: the row is there, the body is there,
    // and it is not readable. It must say so rather than fail silently.
    const KEY = await indexKey(page);
    await page.type('#initials', 'JK');
    await page.keyboard.press('x');
    await page.evaluate(() => flushSave());
    const r = await page.evaluate(k => {
      const id = JSON.parse(localStorage.getItem(k))[0].id;
      newRecord();
      localStorage.setItem(recKey(id), '{not valid json at all');
      document.getElementById('savedmsg').textContent = '';
      const ok = openRecord(id);
      return { ok, msg: document.getElementById('savedmsg').textContent,
               marks: words.filter(w => w.code).length };
    }, KEY);
    eq('an unreadable record is refused', r.ok, false);
    check('...and the teacher is told why', r.msg.trim() !== '', r.msg);
    eq('...and nothing on screen was disturbed', r.marks, 0);
  }
  await fresh(page, base, '#L20');
  {
    // A stored time that had become text made the clock add by joining strings
    // instead of adding numbers, and it jumped to 833 hours.
    const KEY = await indexKey(page);
    await page.type('#initials', 'TT');
    await page.keyboard.press('x');
    await page.evaluate(() => flushSave());
    const ms = await page.evaluate(k => {
      const id = JSON.parse(localStorage.getItem(k))[0].id;
      const rec = JSON.parse(localStorage.getItem(recKey(id)));
      rec.elapsed = '5000';                       // text, not a number
      localStorage.setItem(recKey(id), JSON.stringify(rec));
      openRecord(id);
      resumeClock();
      elapsed += 700; runningSince = null; clockState = 'paused';
      return totalMs();
    }, KEY);
    check('a reading time stored as text cannot explode the clock',
          Number(ms) < 60000, String(ms) + 'ms');
  }
  await fresh(page, base, '#L20');
  {
    // A stop mark outside the passage made stats() count from a negative
    // index: a record with a real substitution reported 0 words read, 100%,
    // Independent.
    const KEY = await indexKey(page);
    await page.type('#initials', 'UU');
    await page.keyboard.press('x');
    await page.evaluate(() => flushSave());
    const r = await page.evaluate(k => {
      const id = JSON.parse(localStorage.getItem(k))[0].id;
      const rec = JSON.parse(localStorage.getItem(recKey(id)));
      rec.stoppedAt = -2;
      localStorage.setItem(recKey(id), JSON.stringify(rec));
      openRecord(id);
      return { read: +document.getElementById('ct-words').textContent,
               acc: document.getElementById('sAcc').textContent };
    }, KEY);
    check('a nonsense stop mark cannot turn a marked record into a perfect one',
          !(r.read === 0 && r.acc === '100%'), JSON.stringify(r));
  }

  // =========================================================================
  group('Nothing broke while all of the above ran');
  // =========================================================================
  check('still no JavaScript errors after every test',
        pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  // -------------------------------------------------------------------------
  // Coverage report
  // -------------------------------------------------------------------------
  if (COVERAGE){
    covRuns.push(...await page.coverage.stopJSCoverage());
    // Every page load produces another record for the same script. Merge them
    // all, or a line exercised early in the run looks untested at the end.
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
        // script body, depending on how the script was parsed. Handle both:
        // when the <script> tag is present, measure only between the tags, so
        // the HTML and CSS — which are not executable — cannot flatter the
        // number. When it is absent, the text already IS the script.
        const tag = text.indexOf('<script>');
        const open  = tag === -1 ? 0 : tag + '<script>'.length;
        const close = tag === -1 ? text.length : text.lastIndexOf('</script>');

        // When Chrome gives back only the script body, its line 1 is not the
        // file's line 1. Reporting "index.html:881" for what is really line
        // 1385 sends somebody to the wrong place, which is worse than saying
        // nothing. Work out where the script actually starts in the file.
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
          const src  = text.slice(from, to);
          const code = src.trim();
          // Blank lines, comment lines and bare punctuation are not statements.
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
  console.log('');
  if (failures.length){
    console.log(`${R}${failures.length} CHECK(S) FAILED${X}  (${passed} passed)`);
    failures.forEach(f => console.log(`${R}  · ${f.name}${X}${f.detail ? DIM + ' — ' + f.detail + X : ''}`));
    process.exit(1);
  }
  console.log(`${G}ALL ${passed} CHECKS PASSED${X}`);
}

main().catch(e => { console.error(`${R}The test run itself crashed:${X}\n`, e); process.exit(2); });
