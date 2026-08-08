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
  // INDEX_KEY, read from the page itself. This used to be the literal string
  // 'wbw.index', which the tool has never used — so this always returned 0 and
  // the check asserting "nothing was written to storage" passed by checking
  // nothing at all. A test that cannot fail is worse than no test.
  records: (JSON.parse(localStorage.getItem(INDEX_KEY) || '[]')).length
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
    // The front door is the FIRST item in the sequence — a teacher expects
    // lesson 6 before lesson 15, and opening in the middle says the order does
    // not matter.
    const first = await page.evaluate(() =>
      Math.min(...Object.keys(LESSONS).map(Number)));
    eq('opens on the first lesson in the sequence', s.lesson, first);
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
      const rec = JSON.parse(localStorage.getItem(recKey(id)));
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
  group('Undoing an accident returns the clock to where it was');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    // Finish (or E) on a reading that never STARTED, then Reopen: the clock
    // used to run from idle, timing the silence before the child began, and
    // the debounce saved a phantom record whose time grew on every heartbeat.
    await page.keyboard.press('e');
    await page.keyboard.press('e');
    await new Promise(r => setTimeout(r, 700));
    const s = await state(page);
    eq('lifting a stop mark that never started a reading leaves the clock idle',
       s.clock, 'idle');
    eq('...with no time on it', s.elapsed, 0);
    eq('...and no phantom record saved', s.records, 0);
  }
  await fresh(page, base, '#L20');
  {
    await page.click('#finishbtn');
    await page.click('#finishbtn');            // now labelled Reopen
    await new Promise(r => setTimeout(r, 700));
    const s = await state(page);
    eq('the same holds for Finish then Reopen on a reading never begun',
       s.clock, 'idle');
    eq('...and nothing was written to storage', s.records, 0);
  }
  await fresh(page, base, '#L20');
  {
    // A teacher paused for an interruption, then hit E by mistake and
    // corrected it. The clock used to quietly restart during the pause.
    await page.keyboard.press('x');
    await new Promise(r => setTimeout(r, 800));
    await page.keyboard.press('p');
    const paused = await state(page);
    eq('the clock is paused', paused.clock, 'paused');
    await page.keyboard.press('e');
    await page.keyboard.press('e');
    const after = await state(page);
    eq('lifting the stop mark leaves it paused, not running', after.clock, 'paused');
    await new Promise(r => setTimeout(r, 600));
    eq('...and no time passes during the interruption',
       (await state(page)).elapsed, after.elapsed);
  }
  await fresh(page, base, '#L20');
  {
    // But a reading that WAS running must come back running.
    await page.keyboard.press('x');
    await page.keyboard.press('e');
    await page.keyboard.press('e');
    eq('a reading that was under way resumes when the stop mark is lifted',
       await page.evaluate(() => clockState), 'running');
  }

  // =========================================================================
  group('Moving the cursor is not scoring a word');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    // The legend calls the arrows navigation. ArrowRight was starting the
    // assessment clock, so lining the cursor up before the child began timed
    // the silence.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const s = await state(page);
    eq('the arrow key moves the cursor', await page.evaluate(() => cursor), 2);
    eq('...without starting the clock', s.clock, 'idle');
  }
  await fresh(page, base, '#L20');
  {
    // Space DOES score — "read correctly, move on" — so it still starts it.
    await page.keyboard.press(' ');
    eq('the space bar still starts the clock, because it scores a word',
       await page.evaluate(() => clockState), 'running');
  }

  // =========================================================================
  group('The popover always agrees with the word underneath it');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    await page.click('.w[data-i="2"]');
    await page.keyboard.press('x');
    const r = await page.evaluate(() => ({
      code: words[2].code,
      lit: [...document.querySelectorAll('#pop button[data-code]')]
             .filter(b => b.classList.contains('on')).map(b => b.dataset.code),
      open: document.getElementById('pop').style.display === 'block' }));
    eq('marking with the keyboard marks the word', r.code, 'sub');
    check('the open popover shows that mark rather than showing none',
          !r.open || r.lit.includes('sub'), JSON.stringify(r));
  }

  // =========================================================================
  group('A finished reading does not say it is still reading');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    await page.keyboard.press('x');
    await page.click('#finishbtn');
    const label = await page.evaluate(() =>
      document.getElementById('wcpm').textContent);
    check('a finished reading with no rate yet is not labelled "reading…"',
          !/reading/i.test(label), 'the tile said: ' + label);
  }

  // =========================================================================
  group('Regressions introduced by the Aug 7 fixes, and now guarded');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    // "Start a new record" was wired straight to newRecord, so the click event
    // arrived as the skipFlush argument. An event object is truthy, so the
    // record being left was never written: mark a word, type initials, press
    // the button, and the whole record was gone.
    await page.keyboard.press('x');
    await page.type('#initials', 'JD');
    await page.click('#clearbtn');
    await new Promise(r => setTimeout(r, 800));
    eq('starting a new record saves the one you are leaving',
       (await state(page)).records, 1);
  }
  await fresh(page, base, '#L20');
  {
    // Moving the stop mark called finish() a second time while already
    // finished, overwriting the memory of what the clock had been doing. The
    // tile then reported a reading rate for a child who never read a word.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('e');           // stop mark
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('e');           // MOVE it
    await page.keyboard.press('e');           // lift it
    await new Promise(r => setTimeout(r, 900));
    const s = await state(page);
    eq('moving the stop mark then lifting it leaves the clock idle', s.clock, 'idle');
    eq('...with no time on it', s.elapsed, 0);
    eq('...and no phantom record saved', s.records, 0);
  }
  await fresh(page, base, '#L20');
  {
    // The same memory lives only in the page, so after a reload Reopen used to
    // drop a finished record's clock to 'idle' with time still showing —
    // "starts when you begin" on screen, a finished rate on the paper.
    const KEY = await indexKey(page);
    await page.keyboard.press('x');
    await new Promise(r => setTimeout(r, 1400));
    await page.click('#finishbtn');
    await page.evaluate(() => flushSave());
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(k => openRecord(JSON.parse(localStorage.getItem(k))[0].id), KEY);
    await page.click('#finishbtn');           // now labelled Reopen
    const s = await page.evaluate(() => ({ clock: clockState,
      label: document.getElementById('wcpm').textContent,
      pauseDisabled: document.getElementById('pausebtn').disabled }));
    check('reopening after a reload does not claim the reading never started',
          s.clock !== 'idle', JSON.stringify(s));
    check('...and Pause still works', !s.pauseDisabled);
  }
  await fresh(page, base, '#L20');
  {
    // Reopening a reading ended with the stop mark left the mark in place, so
    // the rate's denominator grew for ever against a frozen word count.
    await page.keyboard.press('x');
    await page.keyboard.press('e');
    await page.click('#finishbtn');           // Reopen
    eq('reopening lifts the stop mark that ended the reading',
       await page.evaluate(() => stoppedAt), null);
  }
  await fresh(page, base, '#L20');
  {
    // Choosing the lesson is the teacher's FIRST action, and it left focus on
    // the dropdown — where marking keys are deliberately ignored. Every key
    // after it was silently discarded.
    await page.select('#lessonpick', '26');
    await page.keyboard.press('x');
    const s = await state(page);
    eq('marking works immediately after choosing a lesson from the dropdown',
       s.marks, 1);
    eq('...on the lesson that was chosen', s.lesson, 26);
  }

  // =========================================================================
  group('The date on the record is the teacher\'s day, wherever they are');
  // =========================================================================
  // The date box used to be filled in with `rdate.valueAsDate = new Date()`,
  // and that setter reads the instant back out in UTC. So a reading done at
  // 5pm in California was stamped TOMORROW, and one done at 9am in Sydney was
  // stamped YESTERDAY — on the screen, on the paper, in the saved-records list
  // and in the spreadsheet. Only initials and a date name a child here, so the
  // wrong day is the wrong child's record.
  //
  // The page's clock is pinned to one exact instant so this check says the
  // same thing in November as it does today, and Chrome is put in a real
  // timezone either side of UTC midnight.
  {
    const pinScript = `(() => {
      // Keep hold of the browser's own Date, so pinning a second instant
      // later wraps the real one rather than the first pin.
      const Real = window.__nativeDate || Date; window.__nativeDate = Real;
      const FIXED = ${Date.UTC(2026, 7, 8, 0, 2, 0)};
      function D(...a){
        if (!(this instanceof D)) return new Real(FIXED).toString();
        return a.length ? new Real(...a) : new Real(FIXED);
      }
      D.prototype = Real.prototype; D.now = () => FIXED;
      D.parse = Real.parse; D.UTC = Real.UTC;
      window.Date = D;
    })()`;
    const pinned = await page.evaluateOnNewDocument(pinScript);

    // Friday 7 August, 17:02 in California — already Saturday 8th in UTC.
    await page.emulateTimezone('America/Los_Angeles');
    await fresh(page, base, '#L20');
    eq('a reading marked at 5pm in California is dated today, not tomorrow',
       await page.evaluate(() => document.getElementById('rdate').value), '2026-08-07');

    await page.type('#initials', 'JM');
    await page.keyboard.press('x');
    await page.evaluate(() => flushSave());
    const surfaces = await page.evaluate(() => {
      paintPrint(); paintRecords();
      return { paper:  document.getElementById('prwho').textContent,
               row:    document.getElementById('records').textContent,
               stored: (JSON.parse(localStorage.getItem(INDEX_KEY) || '[]')[0] || {}).date };
    });
    check('...and the printed header says that same day',
          surfaces.paper.includes('2026-08-07'), surfaces.paper.replace(/\s+/g, ' ').trim());
    check('...and so does the saved-records row',
          surfaces.row.includes('2026-08-07'));
    eq('...and so does the record in storage', surfaces.stored, '2026-08-07');

    // The spreadsheet is the third surface, and the file it downloads is named
    // for the same day.
    await page.evaluate(() => {
      window.__csvName = '';
      document.addEventListener('click', e => {
        const a = e.target.closest && e.target.closest('a[download]');
        if (a) window.__csvName = a.getAttribute('download') || '';
      }, true);
    });
    await page.click('#exportbtn');
    const csv = await page.evaluate(() => ({
      name: window.__csvName,
      text: decodeURIComponent((window.__downloads.slice(-1)[0] || '').replace(/^data:[^,]*,/, ''))
    }));
    check('...and the exported spreadsheet is dated that day too',
          csv.text.includes('2026-08-07') && !csv.text.includes('2026-08-08'), csv.text.slice(0, 200));
    eq('...right down to the name of the file', csv.name, 'running-records-2026-08-07.csv');

    // "Start a new record" fills the box in a second time, from the same
    // construct — it was wrong there too.
    await page.evaluate(() => newRecord());
    eq('"Start a new record" also fills in the teacher\'s day',
       await page.evaluate(() => document.getElementById('rdate').value), '2026-08-07');

    // The other side of UTC: Friday 7 August, 09:15 in Sydney is still
    // Thursday 6th in UTC, and the box used to read the 6th all morning.
    await page.emulateTimezone('Australia/Sydney');
    const sydney = await page.evaluateOnNewDocument(
      pinScript.replace(String(Date.UTC(2026, 7, 8, 0, 2, 0)),
                        String(Date.UTC(2026, 7, 6, 23, 15, 0))));
    await fresh(page, base, '#L20');
    eq('a reading marked on a Friday morning in Sydney is dated that Friday',
       await page.evaluate(() => document.getElementById('rdate').value), '2026-08-07');

    // Put the clock and the timezone back so nothing after this runs pinned.
    for (const s of [pinned, sydney])
      if (s && s.identifier) await page.removeScriptToEvaluateOnNewDocument(s.identifier);
    await page.emulateTimezone(undefined);
  }

  // =========================================================================
  group('The pages either side of the tool tell the same story it does');
  // =========================================================================
  // Three surfaces have to agree about the numbers; the pages a reader reaches
  // in one click have to agree about everything else. Each of these was found
  // by a reader who simply followed a link out of the tool and back.
  {
    // The "For the teacher" panel on Lessons 22 and 34 says the score does NOT
    // measure the sound the lesson is named for. all-lessons.html is generated
    // from the same data and claims to be "what the tool serves" — but its
    // builder rendered scoring_note and never limit_note, so on exactly those
    // two lessons the catalogue dropped the most important sentence on it.
    await fresh(page, base, '#L22');
    const notes = await page.evaluate(() => ({ 22: LESSONS[22].note, 34: LESSONS[34].note }));
    await nav(page, base + '/all-lessons.html');
    const sections = await page.evaluate(() => ({
      22: document.getElementById('L22').innerText,
      34: document.getElementById('L34').innerText }));
    const flat = s => s.replace(/\s+/g, ' ').trim();
    for (const n of [22, 34]){
      const paras = notes[n].split('\n\n').map(flat).filter(Boolean);
      check(`Lesson ${n}'s "this does not measure what it is named for" warning ` +
            'is on the catalogue page too',
            paras.length === 2 && paras.every(p => flat(sections[n]).includes(p)),
            JSON.stringify({ paras: paras.length, section: flat(sections[n]).slice(0, 90) }));
    }

    // The catalogue counted a word list's SENTENCES as one item each while the
    // tool scores every word in them, so Lesson 14 advertised "12 items" for a
    // list the tool marks out of 22 — and that number is the denominator of
    // the accuracy the teacher reads. The page even contradicted its own
    // header total, which had always used the tool's number.
    const metas = await page.evaluate(() => {
      const o = {};
      document.querySelectorAll('article.item.wordlist').forEach(a =>
        o[a.id.slice(1)] = parseInt(a.querySelector('.meta').textContent, 10));
      return o;
    });
    await nav(page, base + '/index.html');
    const scored = await page.evaluate(ns => {
      const o = {}; ns.forEach(n => o[n] = tokenCount(+n)); return o;
    }, Object.keys(metas));
    check('every word list is advertised with the number of items the tool scores',
          Object.keys(metas).length === 9 &&
          Object.keys(metas).every(n => metas[n] === scored[n]),
          JSON.stringify({ page: metas, tool: scored }));

    // "Open Maya's record in the tool" wrote the record and then linked to the
    // LESSON, so the reader landed on a blank Lesson 20 — no marks, 100%,
    // Independent, 0:00 — contradicting every number in the article they had
    // just read. There is now a #R<id> deep link that opens the record itself.
    await page.evaluate(() => localStorage.clear());
    await nav(page, base + '/worked-example.html');
    await harvest(page);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.click('#load')
    ]);
    const maya = await page.evaluate(() => ({
      open: recordId !== null,
      marks: words.filter(w => w.code).length,
      initials: document.getElementById('initials').value,
      acc: document.getElementById('sAcc').textContent,
      band: document.getElementById('band').textContent,
      clock: document.getElementById('clock').textContent }));
    eq('the worked example\'s button lands on Maya\'s record, not a blank one',
       maya, { open: true, marks: 5, initials: 'M.R.', acc: '93%',
               band: 'Instructional', clock: '1:22' });
    // Following that same link from index.html itself changes only the hash,
    // which does not reload the page — so the deep link has to work on
    // hashchange too, or it would move the address bar and nothing else.
    const back = await page.evaluate(async () => {
      const id = recordId;
      newRecord();
      location.hash = '#L20';        // leave the record's own hash first
      await new Promise(r => setTimeout(r, 60));
      location.hash = '#R' + id;
      await new Promise(r => setTimeout(r, 60));
      return { open: recordId === id,
               acc: document.getElementById('sAcc').textContent };
    });
    eq('...and the same link followed from inside the tool opens it too',
       back, { open: true, acc: '93%' });

    // The tool badges its passage "Assessment text · internal school use" and
    // the nav link one click away published all 36 of those texts with no
    // caveat at all. Two clicks, and the tool contradicted itself.
    await nav(page, base + '/all-lessons.html');
    const said = await page.evaluate(() => document.body.innerText);
    check('the public catalogue repeats the tool\'s internal-use flag',
          /internal school use/i.test(said), said.slice(0, 120));
  }
  {
    // A portrait iPad is what a teacher actually holds, and the only marking
    // instructions on the page were a card of keyboard KEYS sitting 1800px
    // below the fold. Nothing anywhere said a word could be tapped.
    await page.setViewport({ width: 768, height: 1024, isMobile: true, hasTouch: true });
    await fresh(page, base);
    const hint = await page.evaluate(() => {
      const el = document.getElementById('taphint');
      const r = el.getBoundingClientRect();
      return { text: el.innerText.replace(/\s+/g, ' ').trim(),
               aboveTheFold: r.top >= 0 && r.bottom <= window.innerHeight,
               shown: getComputedStyle(el).display !== 'none' };
    });
    check('an iPad user is told, above the fold, that a word can be tapped',
          hint.shown && hint.aboveTheFold && /^Tap a word to mark it\./.test(hint.text),
          JSON.stringify(hint));
    await page.emulateMediaType('print');
    eq('...and that instruction is not on the printed record',
       await page.evaluate(() =>
         getComputedStyle(document.getElementById('taphint')).display), 'none');
    await page.emulateMediaType('screen');
    await page.setViewport({ width: 1280, height: 900 });
    await fresh(page, base, '#L20');
  }

  // =========================================================================
  group('What the screen takes away, the saved record must not keep');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    // "Clear all marks" on a record with nothing typed in it — no initials, no
    // notes, no retell — emptied the last thing hasContent() could see, so the
    // write gave up before rewriting. The screen said 100% and 0 errors while
    // the saved-records row and the spreadsheet both still said 95% and 3.
    await page.keyboard.press('x');
    await page.keyboard.press('x');
    await page.keyboard.press('x');
    await new Promise(r => setTimeout(r, 700));
    const wasSaved = await page.evaluate(k =>
      JSON.parse(localStorage.getItem(k))[0].errors, await indexKey(page));
    eq('three wrong words are saved as three errors', wasSaved, 3);

    await page.click('#clearmarksbtn');
    await new Promise(r => setTimeout(r, 900));
    const r = await page.evaluate(k => {
      paintPrint();
      document.getElementById('exportbtn').click();
      const row = JSON.parse(localStorage.getItem(k))[0];
      return { screenAcc: document.getElementById('sAcc').textContent,
               screenErr: +document.getElementById('ct-err').textContent,
               screenBand: document.getElementById('band').textContent,
               printBand: [...document.getElementById('prnums').children][1]
                            .querySelector('.v').textContent,
               rowAcc: row.accuracy, rowErr: row.errors,
               csv: decodeURIComponent((window.__downloads.slice(-1)[0] || '')
                      .replace(/^data:[^,]*,/, '')) };
    }, await indexKey(page));
    eq('after Clear all marks the screen shows no errors', r.screenErr, 0);
    eq('the saved-records row agrees with the screen', r.rowAcc + '%', r.screenAcc);
    eq('...and shows no errors either', r.rowErr, 0);
    eq('the printed record agrees with the screen', r.printBand, r.screenBand);
    {
      const rows = r.csv.replace(/^﻿/, '').trim().split('\r\n').map(l => l.split(','));
      const ec = rows[0].indexOf('Errors'), ac = rows[0].indexOf('Accuracy %');
      eq('the spreadsheet agrees with the screen too',
         [Number(rows[1][ec]), rows[1][ac] + '%'], [r.screenErr, r.screenAcc]);
    }
  }
  await fresh(page, base, '#L26');
  {
    // "Clear this mark" took the mark off and left the M/S/V cue analysis on
    // the word, in memory and in storage. Re-marking that word later — even on
    // another day, after a reload — arrived pre-coded Meaning, Structure and
    // Visual, and the cue tally reported it as the teacher's judgement.
    await page.type('#initials', 'CUE');
    await page.click('.w[data-i="4"]');
    await page.click('#pop button[data-code="sub"]');
    await page.click('#pop button[data-cue="m"]');
    await page.click('#pop button[data-cue="s"]');
    await page.click('#pop button[data-cue="v"]');
    await page.click('#pop button[data-code="correct"]');
    await new Promise(r => setTimeout(r, 700));
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem(recKey(recordId))).words[4].cues || null);
    eq('clearing a mark takes its cue analysis with it, in storage as well',
       stored, null);

    await page.reload({ waitUntil: 'load' });
    await page.evaluate(k => openRecord(JSON.parse(localStorage.getItem(k))[0].id),
                        await indexKey(page));
    await page.click('.w[data-i="4"]');
    const pressed = await page.evaluate(() =>
      [...document.querySelectorAll('#pop button[data-cue]')]
        .filter(b => b.className === 'on').length);
    eq('reopening that word shows no cues still pressed', pressed, 0);
    await page.click('#pop button[data-code="told"]');
    const after = await page.evaluate(() => ({
      cues: JSON.stringify(words[4].cues || null),
      cuebox: document.getElementById('cuebox').style.display }));
    eq('a fresh mark on that word is not pre-coded', after.cues, 'null');
    eq('...so the cue tally stays out of sight until a cue is entered',
       after.cuebox, 'none');
  }
  await fresh(page, base, '#L15');
  {
    // ArrowLeft never forgot that a word had been tapped, so with the cursor
    // in the identical place the arrows-only path tagged the word just read and
    // the tap-then-ArrowLeft path tagged the word the child had not reached.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('s');
    const arrows = await page.evaluate(() =>
      words.map((w, i) => w.code ? i + ':' + w.text : null).filter(Boolean));

    await fresh(page, base, '#L15');
    await page.click('.w[data-i="4"]');
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('s');
    const tapped = await page.evaluate(() => ({
      cursor,
      marks: words.map((w, i) => w.code ? i + ':' + w.text : null).filter(Boolean) }));
    eq('the cursor ends up in the same place either way', tapped.cursor, 3);
    eq('a self-correction after ArrowLeft marks the word just read, not the next one',
       tapped.marks, arrows);
  }
  await fresh(page, base, '#L15');
  {
    // Opening a saved record is not tapping a word either: reopening after a
    // tap left the tool in click mode, so the first S, R or A landed on the
    // cursor word instead of the word just read.
    const KEY = await indexKey(page);
    await page.type('#initials', 'RE');
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('x');
    await page.evaluate(() => { cursor = 4; flushSave(); });
    await page.evaluate(() => newRecord());
    await page.click('.w[data-i="2"]');            // a tap, to set click mode
    await page.keyboard.press('Escape');
    await page.evaluate(k => openRecord(JSON.parse(localStorage.getItem(k))[0].id), KEY);
    await page.keyboard.press('r');
    const marked = await page.evaluate(() =>
      words.map((w, i) => w.code === 'rep' ? i : null).filter(i => i !== null));
    eq('a repetition after reopening a record marks the word before the cursor',
       marked, [3]);
  }
  await fresh(page, base, '#L20');
  {
    // Export skipped any record whose body storage had lost or half-written,
    // with no alert and no message: three children on the screen, two in the
    // spreadsheet, and a file downloaded anyway.
    const KEY = await indexKey(page);
    await page.type('#initials', 'AA');
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('x');
    await page.evaluate(() => flushSave());
    await page.evaluate(() => newRecord());
    await page.click('#initials');
    await page.type('#initials', 'BB');
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('o');
    await page.evaluate(() => flushSave());
    const r = await page.evaluate(k => {
      const gone = JSON.parse(localStorage.getItem(k)).find(e => e.initials === 'AA');
      localStorage.removeItem(recKey(gone.id));
      window.__alert = ''; window.__downloads.length = 0;
      document.getElementById('savedmsg').textContent = '';
      document.getElementById('exportbtn').click();
      return { alert: window.__alert,
               msg: document.getElementById('savedmsg').textContent,
               rows: document.querySelectorAll('.recrow').length,
               csv: decodeURIComponent((window.__downloads.slice(-1)[0] || '')
                      .replace(/^data:[^,]*,/, '')) };
    }, KEY);
    const dataRows = r.csv.replace(/^﻿/, '').trim().split('\r\n').length - 1;
    eq('two children are listed but only one can be exported',
       [r.rows, dataRows], [2, 1]);
    check('the teacher is told a record is missing from the spreadsheet',
          /missing/i.test(r.alert), JSON.stringify(r.alert));
    check('...and the message stays on the page after the alert is dismissed',
          /missing/i.test(r.msg), JSON.stringify(r.msg));
  }
  await fresh(page, base, '#L20');
  {
    // The same silence with the only record damaged handed over a spreadsheet
    // with a header row and no children in it, which reads like an empty class.
    const KEY = await indexKey(page);
    await page.type('#initials', 'ZZ');
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('x');
    await page.evaluate(() => flushSave());
    await page.evaluate(() => newRecord());
    const r = await page.evaluate(k => {
      const id = JSON.parse(localStorage.getItem(k))[0].id;
      localStorage.setItem(recKey(id), '{half written');
      window.__alert = ''; window.__downloads.length = 0;
      document.getElementById('exportbtn').click();
      return { alert: window.__alert, downloads: window.__downloads.length };
    }, KEY);
    eq('a spreadsheet with nobody in it is not handed over', r.downloads, 0);
    check('...and the refusal says why, the way Open already does',
          /could be read/i.test(r.alert), JSON.stringify(r.alert));
  }

  // =========================================================================
  group('Everything on screen can actually be reached and pressed');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    // Coding a single M/S/V cue opens "What they were using", which takes the
    // fixed bottom bar from 67px to nearly 250px tall. main's bottom padding
    // was a flat 130px, so past that the bar covered the Saved records card
    // completely — scrolled all the way down, the centre of the Open button
    // belonged to #cuebox, a real click on Delete did nothing at all, and the
    // only way to reach the list again was to un-tag the cue.
    await page.type('#initials', 'JM');
    await page.click('.w[data-i="0"]');
    await page.click('#pop button[data-code="sub"]');
    await page.click('#pop button[data-cue="m"]');
    await page.keyboard.press('Escape');
    await page.evaluate(() => flushSave());
    // Scroll twice: the bar's new height reaches the page's bottom padding on
    // the next frame, and the page grows taller than the first scroll allowed.
    for (let i = 0; i < 2; i++){
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
      await page.evaluate(() => window.scrollTo(0, 999999));
    }
    const reach = await page.evaluate(() => {
      const del = [...document.querySelectorAll('#records .btn')]
                    .find(b => b.textContent === 'Delete');
      const r = del.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { bar: document.getElementById('stats').offsetHeight,
               onTop: hit === del, sits: hit ? (hit.id || hit.className) : null,
               x: Math.round(r.left + r.width / 2),
               y: Math.round(r.top + r.height / 2) };
    });
    check('coding one cue grows the bottom bar past the old fixed runway',
          reach.bar > 130, 'bar is ' + reach.bar + 'px');
    check('the saved records are still reachable underneath it',
          reach.onTop, JSON.stringify(reach));
    await page.mouse.click(reach.x, reach.y);
    eq('...and a real press on Delete reaches the button, not the bar',
       (await state(page)).records, 0);
  }
  {
    // The mark menu was placed with `Math.min(left, window.innerWidth - 270)`,
    // and 270 was a guess at its width — it is 319px. On a portrait iPad, the
    // device this tool is written for, "Appealed" hung 49px off the right edge
    // and the whole page could be dragged sideways.
    await page.setViewport({ width: 768, height: 1024 });
    for (const n of [15, 25, 41]){
      await fresh(page, base, '#L' + n);
      const r = await page.evaluate(() => {
        let off = 0, neverOpened = 0, opened = 0;
        const pop = document.getElementById('pop');
        document.querySelectorAll('.w').forEach(el => {
          el.click();
          // Assert the menu actually OPENED before measuring where it is. A
          // hidden element reports a rectangle of [0,0,0,0], which is neither
          // off the right edge nor left of zero — so this whole sweep used to
          // pass green against a tool where tapping a word did nothing at all.
          if (pop.style.display !== 'block'){ neverOpened++; return; }
          opened++;
          const p = pop.getBoundingClientRect();
          if (p.right > document.documentElement.clientWidth || p.left < 0) off++;
        });
        return { off, neverOpened, openedAtLeastOne: opened > 0,
                 sideways: document.documentElement.scrollWidth >
                           document.documentElement.clientWidth };
      });
      eq(`on a portrait iPad every mark menu in lesson ${n} opens and stays on the screen`,
         r, { off: 0, neverOpened: 0, openedAtLeastOne: true, sideways: false });
    }

    // Turning the iPad reflowed the passage under an open menu while the menu
    // kept its old coordinates. It drifted a full line down and hung under a
    // DIFFERENT word than the one it was about to mark.
    await fresh(page, base, '#L15');
    await page.click('.w[data-i="20"]');
    await page.setViewport({ width: 1024, height: 768 });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
    const rot = await page.evaluate(() => {
      const w = document.querySelector('.w[data-i="20"]').getBoundingClientRect();
      const p = document.getElementById('pop').getBoundingClientRect();
      return { dx: Math.round(p.left - w.left), dy: Math.round(p.top - w.bottom),
               shown: document.getElementById('pop').style.display };
    });
    eq('turning the iPad leaves the mark menu under the word it will mark',
       rot, { dx: 0, dy: 8, shown: 'block' });
    await page.setViewport({ width: 1280, height: 900 });
  }
  await fresh(page, base, '#L20');
  {
    // Every save re-sorted the Saved records list most-recently-updated first.
    // Open an older child, type one letter in the notes, and 400ms later the
    // Delete button the teacher's mouse was resting on belonged to a different
    // child — with no warning and no movement to see.
    await page.evaluate(() => {
      for (const who of ['AA', 'BB', 'CC']){
        newRecord(); document.getElementById('initials').value = who;
        mark(1, 'sub'); flushSave();
      }
      openRecord(readIndex().find(e => e.initials === 'AA').id);
    });
    const cc = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.recrow')]
                    .find(r => r.querySelector('.who2').textContent === 'CC');
      row.scrollIntoView({ block: 'center' });
      const b = [...row.querySelectorAll('button')].find(b => b.textContent === 'Delete');
      const r = b.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    await page.mouse.move(cc.x, cc.y);
    await page.focus('#notes');
    await page.keyboard.type('h');
    await new Promise(r => setTimeout(r, 700));
    const under = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      const row = el && el.closest && el.closest('.recrow');
      return { order: readIndex().map(e => e.initials),
               who: row ? row.querySelector('.who2').textContent : null,
               label: el ? el.textContent : null };
    }, cc);
    eq('typing a note does not slide another child\'s row under the mouse',
       under, { order: ['CC', 'BB', 'AA'], who: 'CC', label: 'Delete' });
  }
  await fresh(page, base, '#L20');
  {
    // The 5-second reading-time heartbeat writes the record, and that repainted
    // the list, and that replaced every button with a brand new element. A
    // press whose mousedown and mouseup straddled the rebuild produced no click
    // at all: the button visibly went down, came up, and nothing happened.
    await page.evaluate(() => {
      for (const who of ['AA', 'BB']){
        newRecord(); document.getElementById('initials').value = who;
        mark(1, 'sub'); flushSave();
      }
    });
    const aa = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.recrow')]
                    .find(r => r.querySelector('.who2').textContent === 'AA');
      row.scrollIntoView({ block: 'center' });
      const b = [...row.querySelectorAll('button')].find(b => b.textContent === 'Delete');
      const r = b.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    await page.mouse.move(aa.x, aa.y);
    await page.mouse.down();
    await page.evaluate(() => writeRecord(true));   // exactly what the heartbeat runs
    await page.mouse.up();
    eq('a save landing mid-press does not swallow the press',
       await page.evaluate(() => readIndex().map(e => e.initials)), ['BB']);
  }

  // =========================================================================
  group('What goes on the paper, and what goes in the spreadsheet');
  // =========================================================================
  await fresh(page, base, '#L20');
  {
    // The printed "Every mark" table ran to the end of the passage while every
    // number beside it stopped at the stop mark. A reading stopped at word 5
    // printed a miscue from word 10 directly above its own "Errors 1".
    await page.click('.w[data-i="0"]');
    await page.click('#pop button[data-code="sub"]');
    await page.click('#pop button[data-cue="v"]');
    await page.keyboard.press('Escape');
    await page.click('.w[data-i="10"]');
    await page.click('#pop button[data-code="sub"]');
    await page.click('#pop button[data-cue="v"]');
    await page.keyboard.press('Escape');
    const r = await page.evaluate(() => {
      stoppedAt = 5; render();
      // Only the per-word rows: the cue-analysis line under them is one
      // colspan=3 cell, and it has a <b> in it too.
      const rows = [...document.querySelectorAll('#prmarks tr')]
                     .filter(t => t.cells.length === 3);
      return { words: rows.map(t => t.querySelector('b').textContent),
               errors: document.getElementById('ct-err').textContent,
               printed: document.getElementById('prmarks').innerText };
    });
    eq('the printed record stops listing marks at the stop mark',
       r.words, ['Sam']);
    eq('...so the list is as long as the Errors figure printed above it',
       r.words.length, Number(r.errors));
    check('...and the cue tally on the same sheet still counts one of one',
          /1 of 1 miscues coded/.test(r.printed), r.printed.replace(/\n/g, ' | '));
  }
  await fresh(page, base, '#L20');
  {
    // A word marked "Wrong word" and coded M and V, then re-marked
    // "Self-corrected" when the teacher saw the child fix it, keeps those cues
    // in the record. The screen and the spreadsheet both refuse to show them.
    // Only the paper printed "sit [MV] Self-corrected" — cue letters on a word
    // its own cue tally, two lines below, did not count.
    await page.click('.w[data-i="3"]');
    await page.click('#pop button[data-code="sub"]');
    await page.click('#pop button[data-cue="m"]');
    await page.click('#pop button[data-cue="v"]');
    await page.click('#pop button[data-code="sc"]');
    await page.keyboard.press('Escape');
    await page.click('.w[data-i="9"]');
    await page.click('#pop button[data-code="sub"]');
    await page.click('#pop button[data-cue="v"]');
    await page.keyboard.press('Escape');
    const r = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#prmarks tr')]
        .filter(t => t.cells.length === 3)
        .map(t => ({ word: t.querySelector('b').textContent,
                     cues: t.querySelector('i') ? t.querySelector('i').textContent : '' }));
      return { rows, printed: document.getElementById('prmarks').innerText,
               foot: document.getElementById('cueFoot').textContent };
    });
    eq('a self-corrected word prints with no cue letters left on it',
       r.rows, [{ word: 'sit', cues: '' }, { word: 'naps', cues: '[V]' }]);
    eq('...and the cue tally printed under it counts the same one word',
       /(\d+) of (\d+) miscues coded/.exec(r.printed).slice(1, 3), ['1', '1']);
    check('...which is what the screen was saying all along',
          /^1 of 1 miscues coded/.test(r.foot), r.foot);
  }
  await fresh(page, base, '#L20');
  {
    // The eight numbers were one flex row inside overflow:hidden and could not
    // shrink past their own labels, so on Letter the last two tiles ran off
    // the right edge of the paper and on A4 the last three did. WORDS
    // CORRECT/MIN and TIME are nowhere else on the sheet: the copy that goes
    // to the learning specialist had no reading rate and no reading time on
    // it, and nothing on screen said so. Measured at the real printable width
    // of both papers, 18mm margins in: Letter 710px, A4 688px.
    await page.evaluate(() => {
      mark(2, 'sub'); mark(5, 'omit'); mark(8, 'told');
      elapsed = 92000; runningSince = null; clockState = 'paused';
      render();
    });
    await page.emulateMediaType('print');
    for (const [paper, w] of [['US Letter', 710], ['A4', 688]]){
      await page.setViewport({ width: w, height: 1000 });
      const r = await page.evaluate(() => {
        const box = document.getElementById('prnums');
        const b = box.getBoundingClientRect();
        const tiles = [...box.children].map(c => ({
          key: c.querySelector('.k').textContent,
          val: c.querySelector('.v').textContent,
          off: c.getBoundingClientRect().right > b.right + 0.5
        }));
        return { off: tiles.filter(t => t.off).map(t => t.key), tiles };
      });
      eq(`every number is on the paper on ${paper}`, r.off, []);
      eq(`...including the reading rate on ${paper}`,
         r.tiles[6], { key: 'Words correct/min', val: '34', off: false });
      eq(`...and the reading time on ${paper}`,
         r.tiles[7], { key: 'Time', val: '1:32', off: false });
    }
    await page.emulateMediaType('screen');
    await page.setViewport({ width: 1280, height: 900 });
  }
  await fresh(page, base, '#L20');
  {
    // The spreadsheet column was called "Miscues" but held one entry per mark
    // of ANY kind — self-corrections, repetitions and appeals included. A
    // specialist counting the cell got 5 for a record the screen, the paper
    // and the "Miscues coded" column beside it all called 4. The printed table
    // holds the same list and has always been honest about its name.
    const r = await page.evaluate(() => {
      document.getElementById('initials').value = 'KL';
      mark(3, 'sc'); mark(9, 'sub'); words[9].cues = { v: true };
      render(); flushSave();
      document.getElementById('exportbtn').click();
      return { csv: window.__downloads.slice(-1)[0] || '',
               err: document.getElementById('ct-err').textContent };
    });
    const text = decodeURIComponent(r.csv.replace(/^data:[^,]*,/, '')).replace(/^﻿/, '');
    const rows = text.trim().split('\n').map(l => l.split(','));
    check('the spreadsheet does not call a list of every mark "Miscues"',
          rows[0].indexOf('Miscues') === -1, rows[0].join('|'));
    const col = rows[0].indexOf('Every mark');
    check('it calls it "Every mark", the same as the printed table', col >= 0,
          rows[0].join('|'));
    eq('...and it still lists the self-correction the specialist wants to see',
       (rows[1][col] || '').split('; ').length, 2);
    eq('...beside a Miscues coded count that is not that number',
       rows[1][rows[0].indexOf('Miscues coded')], '1');
  }
  {
    // The child's copy is handed across the table before a timed read and the
    // child reads it aloud straight through. Lessons 31 and 35 are eleven
    // lines long and short-lined enough to earn the full 26pt, so their last
    // sentence printed alone on a second sheet with the footer — a second
    // sheet to hand over mid-sentence. Rendered at the real Letter content
    // box, 18mm margins in: 680 x 920px.
    const copies = await page.evaluate(() => Object.keys(LESSONS).map(n => {
      switchLesson(+n);
      return { n, html: childCopyHtml() };
    }));
    const sheet = await browser.newPage();
    await sheet.emulateMediaType('print');
    await sheet.setViewport({ width: 680, height: 920 });
    const over = [];
    for (const c of copies){
      await sheet.setContent(c.html, { waitUntil: 'load' });
      const h = await sheet.evaluate(() => document.body.scrollHeight);
      if (h > 920) over.push('L' + c.n + ' is ' + h + 'px');
    }
    await sheet.close();
    check('no child\'s copy runs onto a second sheet, on any of the 36 lessons',
          over.length === 0, over.join(', '));
    eq('...and the two long ones are still printed in large type',
       await page.evaluate(() =>
         [31, 35].map(n => childPassagePt(LESSONS[n].lines, LESSONS[n].title))),
       [22, 22]);
    eq('...while a lesson that already fitted is untouched at its full size',
       await page.evaluate(() =>
         childPassagePt(LESSONS[20].lines, LESSONS[20].title)), 26);
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
  // -------------------------------------------------------------------------
  // How many checks were SUPPOSED to run.
  //
  // Several checks sit inside `if (...)` guards, because the thing they inspect
  // has to exist before they can inspect it. When such a guard is false the
  // checks inside do not fail — they silently do not happen, and the run still
  // ends green. That is how a suite quietly shrinks: two runs of this file
  // reported 267 and then 268 checks, with no FAIL line in either.
  //
  // So the count itself is a check. If it moves, either you added checks (put
  // the new number here, deliberately) or some checks stopped running (find out
  // why). Both are things you want to be told about.
  // -------------------------------------------------------------------------
  const EXPECTED_CHECKS = Number(process.env.EXPECTED_CHECKS || 0);
  const ran = passed + failures.length;
  if (EXPECTED_CHECKS && ran !== EXPECTED_CHECKS){
    failures.push({
      name: `the suite ran ${ran} checks, but ${EXPECTED_CHECKS} were expected`,
      detail: ran < EXPECTED_CHECKS
        ? 'Checks vanished rather than failed — look for an `if (...)` guard that went false.'
        : 'Checks were added. If that was deliberate, update EXPECTED_CHECKS.',
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
