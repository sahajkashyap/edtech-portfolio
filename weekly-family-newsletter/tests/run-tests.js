#!/usr/bin/env node
//
// Weekly Family Newsletter — regression tests.
//
// WHAT THIS IS
// ------------
// "Regression" means sliding backward. Every check in this file exists because
// something was once actually broken here. The point is not to prove the tool
// works today — it is so that a bug fixed in August cannot quietly come back in
// November without anybody noticing.
//
// Each check is named for what a PERSON would notice, not for the function
// behind it. If you fix a new bug, add its check here the same day, while you
// still remember what went wrong.
//
// HOW TO RUN IT
// -------------
//     cd ~/Documents/GitHub/edtech-portfolio/weekly-family-newsletter/tests
//     npm test
//
// It opens a real Google Chrome in the background, drives the newsletter with
// real clicks, real typing and a real photo upload, and prints a line per
// check. It needs nothing on the internet — the two picture-making libraries
// the tool downloads are deliberately blocked in one of the groups below.
//
// node_modules: this folder does NOT have its own. It is a symlink to
//     ../../running-record-tool/tests/node_modules
// so there is one copy of puppeteer-core for the whole portfolio and nothing
// to install here.
//
// WHAT YOU SHOULD SEE
// -------------------
// A list of green PASS lines and, at the end, "ALL n CHECKS PASSED".
//
const puppeteer = require('puppeteer-core');
const http      = require('http');
const fs        = require('fs');
const os        = require('os');
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

// ---------------------------------------------------------------------------
// Driving the page
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

// `load`, not `domcontentloaded`: a stylesheet or script still in flight when
// the first assertion runs lands in the console-error list a fraction of the
// time, and a check that is right nine times out of ten teaches you to ignore
// red. Wait for the page to be genuinely finished.
async function fresh(page){
  await harvest(page);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await harvest(page);
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
}

let BASE = '';

// Select everything in an editable block and type over it, the way a teacher
// does — no blur, no clicking away.
async function typeOver(page, selector, text){
  await page.click(selector);
  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    el.focus();
    const r = document.createRange(); r.selectNodeContents(el);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }, selector);
  if (text) await page.keyboard.type(text);
  else await page.keyboard.press('Backspace');
}

// Click the button that SAYS this, not the button that happens to be first.
// A check here once clicked ".ab-actions button" by position; adding a new
// button to the archive bar silently pointed it at a different one and three
// checks failed for a reason that had nothing to do with what they test.
async function clickByText(page, selector, text){
  const found = await page.evaluate((sel, t) => {
    const el = [...document.querySelectorAll(sel)]
      .find(b => b.textContent.includes(t) && b.offsetParent !== null);
    if (!el) return false;
    el.click();
    return true;
  }, selector, text);
  if (!found) throw new Error(`No visible "${selector}" reading "${text}" on the page`);
}

async function addPhoto(page, slot, file){
  const [chooser] = await Promise.all([
    page.waitForFileChooser({ timeout: 8000 }),
    page.click(`.photo[data-slot="${slot}"]`)
  ]);
  await chooser.accept([file]);
  await page.waitForFunction(
    s => document.querySelector(`.photo[data-slot="${s}"]`).classList.contains('has-img'),
    { timeout: 20000 }, slot);
}

// Download a file the way a teacher would, then READ IT BACK as a picture and
// report the colour at one spot on it. The checks about what is printed on the
// PDF and the image use this: an assertion about the markup only proves the
// code meant well, and the whole point is what lands in the family's inbox.
//
// `spot` is in real pixels of the exported picture, measured from its top-left.
async function exportAndSample(page, run, kind, spot){
  const href = await page.evaluate(async (run) => {
    // Watch the file being made rather than the click that saves it: the image
    // is downloaded through the tool's own anchor, but jsPDF hands the PDF to
    // its bundled saver, whose anchor never reaches the document. Both go
    // through createObjectURL, and the URL is thrown away a second later, so
    // keep every one and stop the revoke.
    if (!window.__keptBlobs){
      window.__keptBlobs = [];
      const make = URL.createObjectURL.bind(URL);
      URL.createObjectURL = function(b){ const u = make(b); window.__keptBlobs.push(u); return u; };
      URL.revokeObjectURL = function(){};
    }
    window.__keptBlobs.length = 0;
    eval(run);
    // html2canvas and jsPDF are both async; wait for the file to appear.
    for (let i = 0; i < 120 && !window.__keptBlobs.length; i++){
      await new Promise(r => setTimeout(r, 100));
    }
    return window.__keptBlobs.length ? window.__keptBlobs[window.__keptBlobs.length - 1] : '';
  }, run);
  if (!href) return { error: 'nothing was downloaded' };

  return page.evaluate(async (href, kind, sx, sy) => {
    const buf = await (await fetch(href)).arrayBuffer();
    let blob;
    if (kind === 'pdf'){
      // jsPDF drops the page picture into the PDF as a plain JPEG (DCTDecode,
      // no extra compression), so the bytes from the first SOI marker to the
      // last EOI marker ARE the image a family would open.
      const b = new Uint8Array(buf);
      let start = -1, end = -1;
      for (let i = 0; i < b.length - 3; i++){
        if (b[i] === 0xFF && b[i+1] === 0xD8 && b[i+2] === 0xFF){ start = i; break; }
      }
      for (let i = b.length - 2; i > start; i--){
        if (b[i] === 0xFF && b[i+1] === 0xD9){ end = i + 2; break; }
      }
      if (start < 0 || end < 0) return { error: 'no picture found inside the PDF' };
      blob = new Blob([b.slice(start, end)], { type: 'image/jpeg' });
    } else {
      blob = new Blob([buf], { type: 'image/png' });
    }
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const p = ctx.getImageData(Math.min(sx, bmp.width - 1), Math.min(sy, bmp.height - 1), 1, 1).data;
    return { bytes: buf.byteLength, w: bmp.width, h: bmp.height, rgb: [p[0], p[1], p[2]] };
  }, href, kind, Math.round(spot.x), Math.round(spot.y));
}

// The amber of the "Example" band, as it survives a JPEG round-trip.
const BAND_RGB = [246, 226, 189];
const near = (rgb, want, slack) =>
  Array.isArray(rgb) && rgb.every((v, i) => Math.abs(v - want[i]) <= slack);

const draftSize = page => page.evaluate(() => (localStorage.getItem(STORAGE_KEY) || '').length);
const draftText = page => page.evaluate(() => localStorage.getItem(STORAGE_KEY) || '');
// The little green/red toast the tool drops at the bottom of the screen.
// Chrome normalises the inline style it is given, so match on the computed
// value rather than on the exact text the tool wrote.
const toastText = page => page.evaluate(() =>
  [...document.querySelectorAll('body > div')]
    .filter(d => getComputedStyle(d).position === 'fixed' && d.textContent &&
                 !d.closest('.toolbar') && d.id !== 'summaryModal')
    .map(d => d.textContent).join(' | '));

async function main(){
  if (!fs.existsSync(CHROME)){
    console.error(`${R}Google Chrome was not found at:${X}\n  ${CHROME}\n` +
                  `Install Chrome, or edit the CHROME path at the top of this file.`);
    process.exit(2);
  }

  const { srv, port } = await serve();
  BASE = `http://127.0.0.1:${port}`;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  COVERAGE = process.argv.includes('--coverage');
  if (COVERAGE) await page.coverage.startJSCoverage({ resetOnNavigation: false });

  // The two picture-making libraries come from cdnjs. This switch lets one
  // group below reproduce a school firewall exactly. Answer with an empty file
  // rather than aborting: an aborted request was quietly served out of Chrome's
  // own cache instead, so the "blocked" page still had both libraries and the
  // check passed against nothing.
  let blockCdn = false;
  await page.setCacheEnabled(false);
  await page.setRequestInterception(true);
  page.on('request', r => {
    if (blockCdn && /cdnjs\.cloudflare\.com/.test(r.url())){
      return r.respond({ status: 200, contentType: 'application/javascript',
                         body: '/* blocked by the school firewall */' }).catch(() => {});
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
    if (/cdnjs\.cloudflare\.com/.test(url)) return;   // deliberately blocked below
    consoleErrors.push(m.text() + (url ? '  [' + url + ']' : ''));
  });

  // Anything that would open a window or block on a dialog is stubbed, so the
  // handlers still run and can be inspected.
  await page.evaluateOnNewDocument(() => {
    window.__printed = 0; window.__opened = []; window.__downloads = [];
    window.__confirms = []; window.__confirmAnswer = true;
    window.__promptAnswer = null;
    window.print = () => { window.__printed++; };
    window.open = () => {
      window.__opened.push(1);
      return { document: { write(){}, close(){}, readyState: 'complete' },
               focus(){}, print(){}, close(){} };
    };
    window.confirm = m => { window.__confirms.push(String(m)); return window.__confirmAnswer; };
    window.prompt  = () => window.__promptAnswer;
    window.alert   = m => { window.__alert = String(m); };
    // Catch anchor-triggered downloads instead of writing to disk. The blob
    // URL is kept as well, so a check can read what would have been saved.
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[download]');
      if (a){
        e.preventDefault();
        window.__downloads.push({ name: a.getAttribute('download') || '', href: a.href });
      }
    }, true);
  });

  // =========================================================================
  group('Opening the newsletter');
  // =========================================================================
  await fresh(page);

  check('the page opens with no JavaScript errors',
        pageErrors.length === 0, pageErrors.join(' | '));
  check('the page opens with no console errors',
        consoleErrors.length === 0, consoleErrors.join(' | '));
  check('the page tells you nothing leaves this laptop',
        await page.$eval('.toolbar .privacy', el => /stays on this laptop/i.test(el.textContent)));

  // =========================================================================
  group('A real photo from a phone  (was: the second photo killed every save)');
  // =========================================================================
  {
    // A believable ~1MB camera JPEG, made in the browser and written to disk so
    // the file chooser gets a genuine file.
    const dataUrl = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 2000; c.height = 1500;
      const x = c.getContext('2d');
      const d = x.createImageData(c.width, c.height);
      for (let i = 0; i < d.data.length; i += 4){
        d.data[i]     = Math.random() * 255;
        d.data[i + 1] = Math.random() * 255;
        d.data[i + 2] = Math.random() * 255;
        d.data[i + 3] = 255;
      }
      x.putImageData(d, 0, 0);
      return c.toDataURL('image/jpeg', 0.85);
    });
    const photoFile = path.join(os.tmpdir(), 'newsletter-test-photo.jpg');
    fs.writeFileSync(photoFile, Buffer.from(dataUrl.split(',')[1], 'base64'));
    const mb = fs.statSync(photoFile).size / 1048576;
    check('the test photo is a full-size one, like a phone would take',
          mb > 0.4, mb.toFixed(2) + ' MB');

    await addPhoto(page, 0, photoFile);
    const afterOne = await draftSize(page);
    await addPhoto(page, 1, photoFile);
    const afterTwo = await draftSize(page);
    check('the second photo is saved too, not silently dropped',
          afterTwo > afterOne, `one photo: ${afterOne} chars, two photos: ${afterTwo} chars`);

    await typeOver(page, '[data-field="title"]', 'Our Weekly Newsletter — Week 14');
    await new Promise(r => setTimeout(r, 1200));   // past the 800ms autosave pause
    check('what you type after two photos is saved, not thrown away',
          (await draftText(page)).includes('Week 14'),
          'the saved draft is ' + (await draftSize(page)) + ' chars');
    check('nothing on screen says the newsletter has stopped saving',
          await page.$eval('#saveWarn', el => el.style.display === 'none'),
          await page.$eval('#saveWarn', el => el.textContent));

    await harvest(page);   // or the photo work above vanishes from the coverage report
    await page.reload({ waitUntil: 'load' });
    const back = await page.evaluate(() => ({
      title: document.querySelector('[data-field="title"]').innerText.trim(),
      filled: [...document.querySelectorAll('.photo')].filter(p => p.classList.contains('has-img')).length,
      real:   [...document.querySelectorAll('.photo img')].filter(i => (i.src || '').startsWith('data:')).length
    }));
    check('after a reload both photos and the new title are still there',
          back.filled === 2 && back.real === 2 && /Week 14/.test(back.title),
          JSON.stringify(back));
  }

  // =========================================================================
  group('Clicking a photo that already has a picture in it');
  // =========================================================================
  {
    // Used to do nothing at all — no chooser, no message — so the only way to
    // swap a picture was to guess that ✕ removes it first.
    const chooser = await Promise.all([
      page.waitForFileChooser({ timeout: 5000 }).then(c => { c.cancel(); return true; })
                                                .catch(() => false),
      page.click('.photo[data-slot="0"]')
    ]);
    check('clicking a photo that is already filled lets you choose a different one',
          chooser[0] === true, 'no file chooser appeared');

    // ✕ used to wipe the picture on one click, with nothing asked.
    await page.evaluate(() => { window.__confirmAnswer = false; window.__confirms = []; });
    await page.click('.photo[data-slot="0"] .remove');
    const kept = await page.evaluate(() => ({
      still: document.querySelector('.photo[data-slot="0"]').classList.contains('has-img'),
      asked: window.__confirms.join(' | ')
    }));
    check('taking a picture out asks first, and saying no keeps it',
          kept.still === true && /Take this picture out/.test(kept.asked), JSON.stringify(kept));

    await page.evaluate(() => { window.__confirmAnswer = true; });
    await page.click('.photo[data-slot="0"] .remove');
    check('saying yes really does take it out',
          await page.$eval('.photo[data-slot="0"]', el => !el.classList.contains('has-img')));
  }

  // =========================================================================
  group('The blank photo boxes and what families actually receive');
  // =========================================================================
  await fresh(page);
  {
    const skipped = await page.evaluate(() => ({
      emptyBox:  skipFromExport(document.querySelector('.photo[data-slot="0"]')),
      wholeRow:  skipFromExport(document.querySelector('.photos')),
      toolsOnly: skipFromExport(document.querySelector('#catchup'))
    }));
    check('an empty photo box is left out of the PDF and the image',
          skipped.emptyBox === true && skipped.wholeRow === true, JSON.stringify(skipped));
    check('the screen-only Time travel block is still left out too',
          skipped.toolsOnly === true);
  }

  // =========================================================================
  group('When the school firewall blocks the internet');
  // =========================================================================
  {
    blockCdn = true;
    const before = pageErrors.length;
    await harvest(page);
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    const banner = await page.$eval('#offlineWarn', el => el.style.display !== 'none' ? el.textContent : '');
    check('the page says up front that the two download buttons need the internet',
          /firewall|wifi/i.test(banner) && /Print/.test(banner), banner || '(no banner)');

    await page.click('button.primary');                       // ⬇ Download PDF
    await new Promise(r => setTimeout(r, 300));
    const t1 = await toastText(page);
    check('Download PDF explains itself instead of hanging on "Building your PDF…"',
          /did not arrive/.test(t1) && !/Building/.test(t1), t1 || '(nothing appeared)');

    await new Promise(r => setTimeout(r, 2200));
    await page.evaluate(() => exportImage());
    await new Promise(r => setTimeout(r, 300));
    const t2 = await toastText(page);
    check('Download image explains itself too',
          /did not arrive/.test(t2), t2 || '(nothing appeared)');
    check('neither button throws a JavaScript error at the screen',
          pageErrors.length === before, pageErrors.slice(before).join(' | '));
    blockCdn = false;
  }

  // =========================================================================
  group('Adding a week that is already in the archive');
  // =========================================================================
  await fresh(page);
  {
    const before = await page.evaluate(() => loadArchive().length);
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await new Promise(r => setTimeout(r, 200));
    const after = await page.evaluate(() => ({
      count: loadArchive().length,
      labels: loadArchive().map(w => w.week),
      status: document.getElementById('archiveStatus').textContent,
      asked: window.__confirms.join(' | ')
    }));
    eq('adding this week again updates it instead of filing a twin', after.count, before);
    check('the archive has only one November 23 in it',
          after.labels.filter(l => /November 23, 2026/.test(l)).length === 1,
          after.labels.slice(-3).join(' | '));
    check('it asks before overwriting the saved week',
          /already in the archive/.test(after.asked), after.asked);

    const sum = await page.evaluate(() => buildSummaryText());
    const twice = (sum.match(/introducing division as sharing into equal groups/g) || []).length;
    eq('the term summary prints that week once, not twice', twice, 1);
  }

  // =========================================================================
  group('The photo-album link');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => { window.__promptAnswer = 'not a url at all'; });
    await page.evaluate(() => setAlbumLink());
    await new Promise(r => setTimeout(r, 100));
    const r1 = await page.evaluate(() => ({
      href: document.getElementById('albumLink').getAttribute('href'),
      shown: document.getElementById('albumUrl').textContent
    }));
    check('typing a sentence instead of a web address does not create a broken link',
          !/not a url at all/.test(r1.href + r1.shown), JSON.stringify(r1));
    check('it says so plainly rather than failing in silence',
          /doesn.t look like a web address/.test(await toastText(page)), await toastText(page));

    await new Promise(r => setTimeout(r, 2200));
    await page.evaluate(() => { window.__promptAnswer = 'photos.app.goo.gl/room18-winter'; });
    await page.evaluate(() => setAlbumLink());
    const r2 = await page.evaluate(() => document.getElementById('albumLink').getAttribute('href'));
    eq('a real album address is still accepted, with https:// added for you',
       r2, 'https://photos.app.goo.gl/room18-winter');
  }

  // =========================================================================
  group('Emptying a section  (was: a silent blank gap with no hint)');
  // =========================================================================
  await fresh(page);
  {
    await typeOver(page, '[data-field="greeting"]', '');       // select all, Backspace
    await new Promise(r => setTimeout(r, 100));
    const r = await page.evaluate(() => {
      const el = document.querySelector('[data-field="greeting"]');
      return { html: el.innerHTML,
               hint: getComputedStyle(el, '::before').content };
    });
    check('clearing a section brings its grey hint back',
          r.html === '' && /warm hello/i.test(r.hint), JSON.stringify(r));
  }

  // =========================================================================
  group('Whose newsletter is this');
  // =========================================================================
  await fresh(page);
  {
    await typeOver(page, '[data-field="teacher"]', 'Ms. Rivera');
    await new Promise(r => setTimeout(r, 100));
    const signoff = await page.$eval('[data-field="signoff"]', el => el.innerText.trim());
    eq('changing the teacher changes who signs the letter', signoff, 'Ms. Rivera');

    const text = await page.evaluate(() => buildPlainText());
    check('the copied text carries the room line and the contact details from the footer',
          /room 18/i.test(text) && /Email: teacher@ourschool\.example\.com/.test(text) &&
          /Class site: ourclass\.example\.com/.test(text),
          text.split('\n').slice(0, 2).concat(text.split('\n').slice(-3)).join(' / '));
    check('no real school email address ships with the example newsletter',
          !/skashyap@school\.edu/.test(await page.content()));
  }

  // =========================================================================
  group('Every file that leaves this laptop says which week it is');
  // =========================================================================
  await fresh(page);
  {
    // WAS TESTING THE WRONG MOMENT. This group used to read the two file names
    // straight off a page nobody had touched, and assert that the untouched
    // starting template downloads as "newsletter-sahaj-kashyap-november-23-
    // 2026.pdf" — a made-up teacher's name on a made-up class. It passed the
    // whole time the example was going out unlabelled. Naming a file for the
    // teacher and the week is about a newsletter the teacher has WRITTEN, so
    // write one first; the untouched template is checked further down, in
    // "The newsletter on the sheet says it is only the starting template".
    await typeOver(page, '[data-field="teacher"]', 'Sahaj Kashyap');
    await new Promise(r => setTimeout(r, 100));
    const names = await page.evaluate(() => ({
      pdf: exportFileName('pdf'), png: exportFileName('png')
    }));
    check('the PDF is named for the teacher and the week, not "weekly-newsletter.pdf"',
          /november-23-2026/.test(names.pdf) && /kashyap/.test(names.pdf) && names.pdf.endsWith('.pdf'),
          JSON.stringify(names));
    check('the image is named the same way',
          /november-23-2026/.test(names.png) && names.png.endsWith('.png'), names.png);

    await page.evaluate(() => exportArchive());
    const dl = await page.evaluate(() => window.__downloads.slice());
    check('the archive backup file is named for the weeks inside it',
          dl.length === 1 && /november-23-2026/.test(dl[0].name) && dl[0].name.endsWith('.json'),
          JSON.stringify(dl.map(d => d.name)));

    // Read what would actually have been written to disk.
    const payload = await page.evaluate(async href => {
      const r = await fetch(href);
      return JSON.parse(await r.text());
    }, dl[0].href);
    check('the backup carries the teacher and the date inside the file as well',
          /Kashyap/.test(payload.teacher || '') && /^\d{4}-\d{2}-\d{2}$/.test(payload.savedOn || '') &&
          payload.weeks.length === 12,
          JSON.stringify({ teacher: payload.teacher, savedOn: payload.savedOn, weeks: (payload.weeks || []).length }));
  }

  // =========================================================================
  group('When the browser refuses to save  (a full disk, or a private window)');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => {
      Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); };
    });
    await typeOver(page, '[data-field="highlight"]', 'A lovely week in Room 18.');
    await new Promise(r => setTimeout(r, 1200));
    const warn = await page.$eval('#saveWarn', el => ({
      shown: el.style.display !== 'none', text: el.textContent
    }));
    check('the page says out loud that it has stopped saving',
          warn.shown && /will not survive a reload/.test(warn.text), JSON.stringify(warn));
    check('it says what to do about it, and never the word "Error"',
          /Download PDF|Print/.test(warn.text) && !/error|invalid/i.test(warn.text), warn.text);

    await page.click('.toolbar button:nth-of-type(5)');       // 💾 Save draft
    await new Promise(r => setTimeout(r, 200));
    check('the Save draft button says the same thing rather than pretending it worked',
          /would not store/i.test(await toastText(page)), await toastText(page));
  }

  // =========================================================================
  group('Typing is kept without clicking away');
  // =========================================================================
  await fresh(page);
  {
    await page.click('[data-field="highlight"]');
    await page.keyboard.type(' Ask about the food drive!');
    await new Promise(r => setTimeout(r, 1200));             // no blur, no clicking away
    check('a sentence typed into a box is saved before you click anywhere else',
          (await draftText(page)).includes('Ask about the food drive!'));

    // And the last 800ms is flushed when the tab goes away.
    await page.click('[data-field="coming"]');
    await page.keyboard.type(' Class photo on Friday.');
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    check('leaving the page keeps the sentence you were still typing',
          (await draftText(page)).includes('Class photo on Friday.'));
  }

  // =========================================================================
  group('Start fresh cannot wipe the newsletter by accident');
  // =========================================================================
  await fresh(page);
  {
    await typeOver(page, '[data-field="highlight"]', 'Please do not delete me.');
    await new Promise(r => setTimeout(r, 1200));
    await page.evaluate(() => { window.__confirmAnswer = false; window.__confirms = []; });
    await page.evaluate(() => resetSheet());
    const asked = await page.evaluate(() => window.__confirms.join(' | '));
    check('Start fresh asks first',
          /Start a fresh newsletter/.test(asked), asked);
    check('it says the wipe cannot be undone and how to keep a copy',
          /cannot be undone/.test(asked) && /Download PDF|Print/.test(asked), asked);
    check('it says the saved weeks in the archive are kept',
          /archive are kept/i.test(asked), asked);
    check('saying no leaves the newsletter exactly as it was',
          (await draftText(page)).includes('Please do not delete me.'));

    await page.evaluate(() => { window.__confirmAnswer = true; });
    await page.evaluate(() => resetSheet());
    await page.waitForNavigation({ waitUntil: 'load' }).catch(() => {});
    check('saying yes really does clear it',
          !(await draftText(page)).includes('Please do not delete me.'));
  }

  // =========================================================================
  group('Closing the Term Summary');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => openSummary());
    await page.keyboard.press('Escape');
    eq('Escape closes the summary',
       await page.$eval('#summaryModal', el => el.style.display), 'none');

    await page.evaluate(() => openSummary());
    await page.mouse.click(5, 5);                             // on the dark surround
    eq('clicking outside the summary closes it too',
       await page.$eval('#summaryModal', el => el.style.display), 'none');
  }

  // =========================================================================
  group('One damaged week in the archive cannot stop the whole page');
  // =========================================================================
  // Nobody caught this the first time because every check started from an
  // archive the tool had written itself. A hand-edited backup, or a save that
  // was interrupted, leaves an entry that is valid JSON but is not a week —
  // and Time travel ran on it at BOOT, before the autosave listener was
  // attached, so the page stopped dead and nothing typed afterwards was ever
  // saved. The teacher saw a normal-looking page that quietly kept nothing.
  await fresh(page);
  {
    await page.evaluate(() => {
      const good = loadArchive()[0];
      localStorage.setItem('weekly-family-newsletter-archive',
        JSON.stringify([good, null, 7, 'a string', { week: 'Week 9 · no sections' }]));
      // A teacher whose archive is their own; without this the tool would put
      // the example term back on reload and we would be testing nothing.
      localStorage.setItem('weekly-family-newsletter-owned', '1');
    });
    const before = pageErrors.length;
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));

    check('the page still opens with no JavaScript error',
          pageErrors.length === before, pageErrors.slice(before).join(' | '));

    const state = await page.evaluate(() => ({
      weeks:  loadArchive().length,
      status: document.getElementById('archiveStatus').textContent,
      travel: document.getElementById('catchup').textContent,
      warn:   { shown: document.getElementById('archiveWarn').style.display !== 'none',
                text:  document.getElementById('archiveWarn').textContent }
    }));
    eq('the one real week is kept and the four broken entries are left out',
       state.weeks, 1);
    check('the archive bar and Time travel still draw, with no "undefined" in them',
          !/undefined|NaN|\[object Object\]|null/.test(state.status + ' ' + state.travel),
          state.status + ' || ' + state.travel.slice(0, 120));
    // The one surviving week here is an example week, so this is also where
    // "1 example weeks" showed up on screen.
    check('one of anything is written as one, not "1 example weeks"',
          !/\b1 (example weeks|weeks)\b/.test(state.status + ' ' + state.travel),
          state.status);
    check('it says out loud that some saved weeks could not be read',
          state.warn.shown && /could not be read/.test(state.warn.text) &&
          !/error|invalid/i.test(state.warn.text), JSON.stringify(state.warn));

    // The real damage was here: boot stopping meant no autosave listener.
    await page.click('[data-field="highlight"]');
    await page.keyboard.type(' The bean plants are still going.');
    await new Promise(r => setTimeout(r, 1200));
    check('typing is STILL saved even with a damaged archive in storage',
          (await draftText(page)).includes('The bean plants are still going.'),
          `draft is ${(await draftText(page)).length} characters long`);

    // And Create summary must not throw on the week that has no sections.
    const sum = await page.evaluate(() => { openSummary(); return buildSummaryText(); });
    check('Create summary opens instead of throwing on the week with no sections',
          await page.$eval('#summaryModal', el => el.style.display) === 'grid' &&
          !/undefined|NaN|\[object Object\]/.test(sum), sum.slice(0, 120));
    await page.evaluate(() => closeSummary());
    check('and still no JavaScript error after all of that',
          pageErrors.length === before, pageErrors.slice(before).join(' | '));
  }

  // =========================================================================
  group('The example term says, everywhere, that it is an example');
  // =========================================================================
  // A stranger opening the tool cold used to be shown twelve weeks of somebody
  // else's term with nothing anywhere saying it was made up — including in a
  // backup file named after the teacher in the box.
  await fresh(page);
  {
    const seen = await page.evaluate(() => ({
      status: document.getElementById('archiveStatus').textContent,
      tag:    getComputedStyle(document.getElementById('archiveExampleTag')).display,
      travel: document.getElementById('catchup').textContent,
      btn:    getComputedStyle(document.getElementById('clearExampleBtn')).display
    }));
    check('the archive bar says these weeks are the example that came with the tool',
          /example weeks that came with the tool/i.test(seen.status) &&
          /real class/i.test(seen.status), seen.status);
    check('an "Example" badge sits next to "Term archive"', seen.tag !== 'none', seen.tag);
    check('Time travel says the weeks behind the buttons are the example',
          /example term that came with the tool/i.test(seen.travel),
          seen.travel.slice(0, 140));

    await page.evaluate(() => toggleArchiveList());
    const rows = await page.$eval('#archiveList', el => ({
      rows: el.querySelectorAll('.row').length,
      tags: el.querySelectorAll('.row .tag').length
    }));
    eq('every week in the Manage list is tagged "Example"', rows.tags, rows.rows);
    await page.evaluate(() => toggleArchiveList());

    const summary = await page.evaluate(() => {
      openSummary();
      const html = document.getElementById('summarySheet').textContent;
      closeSummary();
      return { html: html, text: buildSummaryText(), prompt: buildAIPrompt() };
    });
    check('the Term Summary on screen is stamped EXAMPLE TERM',
          /EXAMPLE TERM/.test(summary.html), summary.html.slice(0, 160));
    check('so is the copied summary text', /EXAMPLE TERM/.test(summary.text),
          summary.text.split('\n').slice(0, 3).join(' / '));
    check('and so is the prompt you paste into Claude', /EXAMPLE TERM/.test(summary.prompt),
          summary.prompt.slice(0, 80));

    await page.evaluate(() => { window.__downloads = []; exportArchive(); });
    const dl = await page.evaluate(() => window.__downloads.slice());
    check('a backup of nothing but the example is NOT named after the teacher',
          dl.length === 1 && /EXAMPLE/.test(dl[0].name) && !/kashyap/i.test(dl[0].name),
          JSON.stringify(dl.map(d => d.name)));
    const payload = await page.evaluate(async href =>
      JSON.parse(await (await fetch(href)).text()), dl[0].href);
    check('and the file says inside itself that it is not a real class',
          payload.exampleWeeks === 12 && /not a real class/i.test(payload.note || ''),
          JSON.stringify({ exampleWeeks: payload.exampleWeeks, note: payload.note }));

    check('Clear the example is offered while the example is loaded',
          seen.btn !== 'none', seen.btn);
    await page.evaluate(() => { window.__confirmAnswer = true; window.__confirms = []; });
    await clickByText(page, '.ab-actions button', 'Clear the example');
    await new Promise(r => setTimeout(r, 200));
    const after = await page.evaluate(() => ({
      weeks:  loadArchive().length,
      asked:  window.__confirms.join(' | '),
      status: document.getElementById('archiveStatus').textContent,
      btn:    getComputedStyle(document.getElementById('clearExampleBtn')).display
    }));
    check('it asks first, and says the copy is worth keeping',
          /Remove the 12 example weeks/.test(after.asked) && /Back up/.test(after.asked),
          after.asked);
    eq('one click removes all twelve example weeks', after.weeks, 0);
    check('the archive bar goes back to a plain empty state',
          /No weeks saved yet/.test(after.status) && after.btn === 'none', after.status);

    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
    eq('and the example stays gone after a reload',
       await page.evaluate(() => loadArchive().length), 0);
  }

  // =========================================================================
  group('The newsletter on the sheet says it is only the starting template');
  // =========================================================================
  // The ARCHIVE said "Example" everywhere. The SHEET said nothing — so a cold
  // visitor got a filled-in newsletter for "Room 18 · Mr. Kashyap", dated
  // November 23 2026, and one click on Download PDF sent a file that read like
  // a real class's newsletter out into the world. Every surface a copy can
  // leave by is checked here: the screen, the PDF, the image, Copy as text,
  // Print, and the name on the file.
  await fresh(page);
  {
    const band = await page.evaluate(() => {
      const el = document.getElementById('sheetExampleTag');
      if (!el) return null;
      const sheet = document.getElementById('sheet');
      const sr = sheet.getBoundingClientRect(), br = el.getBoundingClientRect();
      return {
        text: el.textContent.replace(/\s+/g, ' ').trim(),
        shown: getComputedStyle(el).display !== 'none' && br.height > 0,
        insideSheet: sheet.contains(el),
        aboveBanner: br.top <= document.querySelector('.banner').getBoundingClientRect().top,
        exported: !skipFromExport(el),
        sheetW: sr.width, top: br.top - sr.top, h: br.height
      };
    });
    check('a cold visitor sees, on the newsletter itself, that it is a template',
          !!band && band.shown && /starting template/i.test(band.text) &&
          /not a real one/i.test(band.text),
          band ? band.text : '(there is no band on the sheet at all)');
    check('it sits on the sheet above the banner, not in the toolbar',
          !!band && band.insideSheet && band.aboveBanner && band.exported,
          JSON.stringify(band));

    // ---- the two real downloads, read back from the files themselves ----
    // The band is at the very top of the sheet; sample a spot in its left
    // padding, where nothing but the band's own colour can be.
    const scale = 2;                                   // html2canvas scale in the tool
    const geo = band || { top: 0, h: 30 };
    const spot = { x: 26 * scale, y: (geo.top + geo.h / 2) * scale };

    const png1 = await exportAndSample(page, 'exportImage()', 'png', spot);
    check('the downloaded IMAGE really has the band printed on it',
          near(png1.rgb, BAND_RGB, 14), JSON.stringify(png1));

    const pdf1 = await exportAndSample(page, 'exportPDF()', 'pdf', spot);
    check('so does the page inside the downloaded PDF',
          near(pdf1.rgb, BAND_RGB, 14), JSON.stringify(pdf1));

    const text1 = await page.evaluate(() => buildPlainText());
    check('Copy as text opens with the same warning, in words',
          /^EXAMPLE NEWSLETTER — the starting template that came with the tool, not a real class/
            .test(text1), text1.split('\n').slice(0, 3).join(' / '));

    const names = await page.evaluate(() => ({ pdf: exportFileName('pdf'), png: exportFileName('png') }));
    check('and neither file is named after the made-up teacher in the box',
          /EXAMPLE-not-a-real-class/.test(names.pdf) && /EXAMPLE-not-a-real-class/.test(names.png) &&
          !/kashyap/i.test(names.pdf + names.png), JSON.stringify(names));

    await page.emulateMediaType('print');
    const printed = await page.$eval('#sheetExampleTag',
      el => getComputedStyle(el).display + ' / ' + getComputedStyle(el).backgroundColor);
    check('it is still on the page when the newsletter is printed',
          !/^none/.test(printed), printed);
    await page.emulateMediaType('screen');

    // ---- and it gets out of the way the moment the sheet becomes theirs ----
    await typeOver(page, '[data-field="kicker"]', 'Room 4 · Ms. Rivera');
    await new Promise(r => setTimeout(r, 1300));       // past the 800ms autosave
    check('one line typed on the sheet takes the band away',
          await page.evaluate(() => !document.getElementById('sheetExampleTag')));

    const png2 = await exportAndSample(page, 'exportImage()', 'png', spot);
    check('and the downloaded image is a plain newsletter from then on',
          !near(png2.rgb, BAND_RGB, 24) && png2.h < png1.h,
          JSON.stringify({ was: png1.rgb, now: png2.rgb, wasTall: png1.h, nowTall: png2.h }));
    const text2 = await page.evaluate(() => buildPlainText());
    check('the copied text drops the warning as well, and keeps the room line',
          // .kicker is styled in capitals, and innerText reports what is on
          // screen, so the room line comes out shouted. Match either way.
          !/EXAMPLE NEWSLETTER/.test(text2) && /Room 4 · Ms\. Rivera/i.test(text2),
          text2.split('\n').slice(0, 2).join(' / '));
    const names2 = await page.evaluate(() => ({ pdf: exportFileName('pdf') }));
    check('the file goes back to being named for the teacher and the week',
          /sahaj-kashyap/.test(names2.pdf) && /november-23-2026/.test(names2.pdf) &&
          !/EXAMPLE/.test(names2.pdf), names2.pdf);

    await harvest(page);
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
    check('the band stays gone after a reload — it is their newsletter now',
          await page.evaluate(() => !document.getElementById('sheetExampleTag') &&
                                    /Ms\. Rivera/i.test(document.querySelector('[data-field="kicker"]').innerText)));

    // A photo is the other way somebody makes the sheet their own without
    // typing a single character. (The camera JPEG was written to disk by the
    // photo group near the top of this file.)
    await fresh(page);
    await addPhoto(page, 0, path.join(os.tmpdir(), 'newsletter-test-photo.jpg'));
    check('adding a photo takes the band away too, not just typing',
          await page.evaluate(() => !document.getElementById('sheetExampleTag')));

    // Start fresh puts the whole template back, so the label has to come back
    // with it or the second visitor is in exactly the old position.
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      page.evaluate(() => resetSheet())
    ]);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
    check('Start fresh brings the template back WITH its label',
          await page.evaluate(() => {
            const el = document.getElementById('sheetExampleTag');
            return !!el && /starting template/i.test(el.textContent) &&
                   /Room 18/i.test(document.querySelector('[data-field="kicker"]').innerText);
          }));
  }

  // =========================================================================
  group('The photo-album buttons own up to a browser that has stopped saving');
  // =========================================================================
  // These two were the only actions in the tool that threw away the answer to
  // "did the browser take it?", so on a full disk they were the only ones that
  // stayed silent while every other button said so.
  await fresh(page);
  {
    await page.evaluate(() => {
      window.__promptAnswer = 'photos.app.goo.gl/room18-winter';
      Storage.prototype.setItem = function(){ throw new Error('QuotaExceededError'); };
    });
    await page.evaluate(() => setAlbumLink());
    await new Promise(r => setTimeout(r, 150));
    const w1 = await page.$eval('#saveWarn', el => ({
      shown: el.style.display !== 'none', text: el.textContent
    }));
    check('adding an album link on a full disk says the link will not survive a reload',
          w1.shown && /will not survive a reload/.test(w1.text) && !/error|invalid/i.test(w1.text),
          JSON.stringify(w1));

    await page.evaluate(() => { document.getElementById('saveWarn').style.display = 'none'; });
    await page.evaluate(() => { window.__confirmAnswer = true; removeAlbumLink(); });
    await new Promise(r => setTimeout(r, 150));
    const w2 = await page.$eval('#saveWarn', el => ({
      shown: el.style.display !== 'none', text: el.textContent
    }));
    check('removing it says the same thing rather than pretending it stuck',
          w2.shown && /will not survive a reload/.test(w2.text), JSON.stringify(w2));
  }

  // =========================================================================
  group('Nothing broke while all of the above ran');
  // =========================================================================
  check('still no JavaScript errors after every check',
        pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  check('still no console errors after every check',
        consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  // -------------------------------------------------------------------------
  // Coverage report
  // -------------------------------------------------------------------------
  if (COVERAGE){
    covRuns.push(...await page.coverage.stopJSCoverage());
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
        dead.forEach(d => console.log(`    ${DIM}index.html:${d.ln}${X}  ${d.code.slice(0, 96)}`));
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
