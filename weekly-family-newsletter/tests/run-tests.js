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
// node_modules: this folder does NOT have its own, and nothing needs
// installing here. The two scripts in package.json set NODE_PATH to
//     ../../running-record-tool/tests/node_modules
// so there is one copy of puppeteer-core for the whole portfolio.
//
// WHAT YOU SHOULD SEE
// -------------------
// A list of green PASS lines and, at the end, "ALL n CHECKS PASSED".
//
//     npm run coverage
//
// runs the same checks and then prints how much of the tool's own JavaScript
// actually ran, and lists any line that did not. It is at 100% of executable
// lines. That proves every line ran and something asserted on what it did —
// it does not prove the wording is right for families. That judgement stays
// with a teacher.
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

// Paste formatted writing in, the way a teacher who keeps her plans in Google
// Docs or Word does: select the whole section and paste over it.
//
// Copy and paste are not key presses as far as the page is concerned — the
// browser decodes Cmd+C and Cmd+V itself and hands the editor an EDIT COMMAND,
// which is why page.keyboard.press('KeyV') does nothing at all here. DevTools
// carries the command as `commands`, which is the same door the real key press
// comes through. Nothing is faked in the page: Chrome does its own copying,
// its own cleaning up of the pasted markup, and its own insertion.
const cdpFor = new WeakMap();
async function editCommand(page, cmd){
  if (!cdpFor.has(page)) cdpFor.set(page, await page.target().createCDPSession());
  const client = cdpFor.get(page);
  const code = cmd === 'copy' ? 67 : 86;
  const key  = cmd === 'copy' ? 'c' : 'v';
  for (const type of ['keyDown', 'keyUp']){
    await client.send('Input.dispatchKeyEvent', {
      type, modifiers: 4, key, code: 'Key' + key.toUpperCase(),
      windowsVirtualKeyCode: code, nativeVirtualKeyCode: code,
      commands: type === 'keyDown' ? [cmd] : []
    });
  }
}
async function selectAllIn(page, selector){
  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    el.focus();
    const r = document.createRange(); r.selectNodeContents(el);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }, selector);
}
// `html` is what the OTHER window holds. It is put in a real editable box on
// the page, copied out of it with a real copy, and pasted into the section —
// so the markup that lands in the newsletter is Chrome's, not the test's.
async function pasteInto(page, selector, html){
  await page.evaluate(doc => {
    const d = document.createElement('div');
    d.id = '__otherWindow';
    d.contentEditable = 'true';
    d.style.cssText = 'position:fixed;bottom:0;left:0;width:320px;background:#fff;z-index:99999';
    d.innerHTML = doc;
    document.body.appendChild(d);
  }, html);
  await page.click('#__otherWindow');
  await selectAllIn(page, '#__otherWindow');
  await editCommand(page, 'copy');
  await new Promise(r => setTimeout(r, 150));
  await page.click(selector);
  await selectAllIn(page, selector);
  await editCommand(page, 'paste');
  await new Promise(r => setTimeout(r, 350));
  await page.evaluate(() => {
    const d = document.getElementById('__otherWindow');
    if (d) d.remove();
  });
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

// The same round-trip, but reporting how much INK landed inside a rectangle of
// the exported picture rather than one pixel's colour. This is how the checks
// about the grey "Add a caption…" prompts prove what a family actually gets:
// an empty area of paper counts zero, and any writing at all counts more.
async function exportAndCountInk(page, run, kind, rect){
  const href = await page.evaluate(async (run) => {
    if (!window.__keptBlobs){
      window.__keptBlobs = [];
      const make = URL.createObjectURL.bind(URL);
      URL.createObjectURL = function(b){ const u = make(b); window.__keptBlobs.push(u); return u; };
      URL.revokeObjectURL = function(){};
    }
    window.__keptBlobs.length = 0;
    eval(run);
    for (let i = 0; i < 120 && !window.__keptBlobs.length; i++){
      await new Promise(r => setTimeout(r, 100));
    }
    return window.__keptBlobs.length ? window.__keptBlobs[window.__keptBlobs.length - 1] : '';
  }, run);
  if (!href) return { error: 'nothing was downloaded' };

  return page.evaluate(async (href, kind, rect) => {
    const buf = await (await fetch(href)).arrayBuffer();
    let blob;
    if (kind === 'pdf'){
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
    c.getContext('2d').drawImage(bmp, 0, 0);
    const x = Math.max(0, rect.x), y = Math.max(0, rect.y);
    const w = Math.min(rect.w, bmp.width - x), h = Math.min(rect.h, bmp.height - y);
    if (w <= 0 || h <= 0) return { error: 'that area is off the edge of the picture' };
    const d = c.getContext('2d').getImageData(x, y, w, h).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4){
      // The paper is #FBF9F7; the grey prompt is #b3a794 italic. Anything this
      // much darker than the paper is writing, not paper.
      if (d[i] < 215 && d[i+1] < 215 && d[i+2] < 215) dark++;
    }
    return { dark, of: w * h, w: bmp.width, h: bmp.height };
  }, href, kind, rect);
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
  // A school wifi that is SLOW rather than blocked, and a reload that takes
  // seconds to come back. Both are switches rather than always-on, because two
  // groups below need them and every other check would just run slower.
  let slowCdnMs = 0;
  let slowPageMs = 0;
  let holdReload = false;
  await page.setCacheEnabled(false);
  await page.setRequestInterception(true);
  page.on('request', r => {
    if (blockCdn && /cdnjs\.cloudflare\.com/.test(r.url())){
      return r.respond({ status: 200, contentType: 'application/javascript',
                         body: '/* blocked by the school firewall */' }).catch(() => {});
    }
    if (slowCdnMs && /cdnjs\.cloudflare\.com/.test(r.url())){
      return setTimeout(() => r.continue().catch(() => {}), slowCdnMs);
    }
    // A reload answered with "204 No Content": the browser cancels the
    // navigation and stays on the page it is already showing, so the document
    // that pressed Start fresh is still there to be looked at.
    if (holdReload && r.resourceType() === 'document'){
      return r.respond({ status: 204 }).catch(() => {});
    }
    if (slowPageMs && /index\.html/.test(r.url()) && r.resourceType() === 'document'){
      return setTimeout(() => r.continue().catch(() => {}), slowPageMs);
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
  group('A single line that cannot be read is not thrown away in silence');
  // =========================================================================
  // WHY THIS SLIPPED THROUGH THE FIRST TIME: the group above hands the tool
  // four broken WHOLE weeks — null, a number, a string, a week with no
  // sections — and checks the warning appears. Every one of those is thrown
  // out at the envelope. Not one of them tests the shape check going one level
  // DEEPER: a week that is perfectly good except that one bullet inside it was
  // stored as a number. That line was dropped, the week was kept, and nothing
  // on screen ever said so — the note stayed hidden and the bar read "1 week
  // saved" as if nothing had happened. The teacher lost a line of their own
  // writing without being told. So: a check that goes a level down.
  await fresh(page);
  {
    const before = pageErrors.length;
    await page.evaluate(() => {
      localStorage.setItem('weekly-family-newsletter-archive', JSON.stringify([
        { week: 'Week 5 · October 6, 2026',
          sections: { learned: ['Reading: the main idea', 7, 'Math: arrays'],
                      coming:  ['Field trip on Friday'] } }
      ]));
      localStorage.setItem('weekly-family-newsletter-owned', '1');
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));

    const one = await page.evaluate(() => ({
      weeks:  loadArchive().length,
      lines:  loadArchive()[0].sections.learned,
      status: document.getElementById('archiveStatus').textContent,
      travel: document.getElementById('catchup').textContent,
      shown:  document.getElementById('archiveWarn').style.display !== 'none',
      warn:   document.getElementById('archiveWarn').textContent
    }));
    check('the page still opens with no JavaScript error',
          pageErrors.length === before, pageErrors.slice(before).join(' | '));
    eq('the week itself is kept — one bad bullet does not cost the whole week',
       one.weeks, 1);
    eq('and the two lines that ARE the teacher\'s writing are still there',
       one.lines, ['Reading: the main idea', 'Math: arrays']);
    check('the tool SAYS a line could not be read, instead of dropping it in silence',
          one.shown && /line inside a saved week could not be read/.test(one.warn),
          JSON.stringify({ shown: one.shown, warn: one.warn }));
    check('one line is written as "1 line", not "1 lines"',
          /\b1 line inside\b/.test(one.warn) && !/\b1 lines\b/.test(one.warn), one.warn);
    check('it says the rest of the writing is still here, and says it plainly',
          /rest of your writing is still here/.test(one.warn) &&
          /nothing has been thrown away/.test(one.warn) &&
          !/error|invalid/i.test(one.warn), one.warn);
    check('nothing anywhere reads undefined, NaN or [object Object]',
          !/undefined|NaN|\[object Object\]|null/.test(one.warn + ' ' + one.status + ' ' + one.travel),
          one.warn + ' || ' + one.status);

    // The promise in that sentence has to be true. A damaged whole week rides
    // along at the end of the archive on the next save; a damaged single LINE
    // does not, so without a copy kept aside the very next "Add this week"
    // would write over the only trace of it.
    const rescueBefore = await page.evaluate(
      () => localStorage.getItem('weekly-family-newsletter-archive-unreadable'));
    check('the archive as it was found is kept to one side, exactly as promised',
          !!rescueBefore && rescueBefore.includes('7') &&
          rescueBefore.includes('Reading: the main idea'), String(rescueBefore).slice(0, 120));

    await typeOver(page, '[data-field="week"]', 'Week 6 · October 13, 2026');
    await new Promise(r => setTimeout(r, 900));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await new Promise(r => setTimeout(r, 400));
    const rescueAfter = await page.evaluate(
      () => localStorage.getItem('weekly-family-newsletter-archive-unreadable'));
    eq('and an ordinary "Add this week" does not write over that copy',
       rescueAfter, rescueBefore);

    // And once the archive is clean the note must go away again, or it becomes
    // a note that is always on, which is a note nobody reads.
    const cleared = await page.evaluate(() => {
      localStorage.setItem('weekly-family-newsletter-archive', JSON.stringify([
        { week: 'Week 5 · October 6, 2026', sections: { learned: ['Reading: the main idea'] } }
      ]));
      loadArchive();
      return document.getElementById('archiveWarn').style.display !== 'none';
    });
    check('the note goes away once the archive reads cleanly again', !cleared, String(cleared));
  }

  // =========================================================================
  group('Several unreadable lines, and a damaged week alongside them');
  // =========================================================================
  await fresh(page);
  {
    const before = pageErrors.length;
    await page.evaluate(() => {
      localStorage.setItem('weekly-family-newsletter-archive', JSON.stringify([
        { week: 'Week 5 · October 6, 2026',
          sections: { learned: ['Reading: the main idea', 7, { nope: 1 }] } },
        { week: 'Week 6 · October 13, 2026',
          sections: { learned: [null, 'Math: arrays'] } },
        { week: 42, sections: { learned: ['a week whose label is a number'] } }
      ]));
      localStorage.setItem('weekly-family-newsletter-owned', '1');
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));

    const many = await page.evaluate(() => ({
      weeks: loadArchive().length,
      shown: document.getElementById('archiveWarn').style.display !== 'none',
      warn:  document.getElementById('archiveWarn').textContent,
      sum:   buildSummaryText()
    }));
    check('the page still opens with no JavaScript error',
          pageErrors.length === before, pageErrors.slice(before).join(' | '));
    eq('the two readable weeks are kept and the week with a number for a name is not',
       many.weeks, 2);
    check('three bad lines are counted as "3 lines", not "3 line"',
          many.shown && /3 lines inside your saved weeks could not be read/.test(many.warn),
          many.warn);
    check('and the damaged WEEK is still reported in its own sentence as well',
          /1 saved week in the term archive could not be read/.test(many.warn), many.warn);
    check('the two counts are not muddled into one number',
          !/3 saved week/.test(many.warn) && !/1 line inside/.test(many.warn), many.warn);
    check('and the note does not say "left out of the summary and Time travel" twice over',
          many.warn.split('left out of the summary and Time travel').length === 2, many.warn);
    check('Restore is still offered as the way to get a missing week back',
          /use Restore to load it back from a backup file/.test(many.warn), many.warn);
    check('and the term summary is built from the good lines without throwing',
          many.sum.includes('Reading: the main idea') && many.sum.includes('Math: arrays') &&
          !/undefined|NaN|\[object Object\]/.test(many.sum), many.sum.slice(0, 160));
  }

  // =========================================================================
  group('A backup file with an unreadable line says so on the way in');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => { window.__confirmAnswer = true; window.confirm = () => true; });
    await clickByText(page, '.ab-actions button', 'Clear the example');
    await new Promise(r => setTimeout(r, 300));

    const mixed = path.join(os.tmpdir(), 'newsletter-backup-with-a-bad-line.json');
    fs.writeFileSync(mixed, JSON.stringify({ type: 'weekly-family-newsletter-archive', version: 1, weeks: [
      { week: 'Week 1 · September 8, 2026', sections: { learned: ['Reading: from my other laptop', 12] } },
      { week: 'Week 2 · September 14, 2026', sections: { learned: ['Math: place value'] } }
    ] }));
    const [chooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 8000 }),
      clickByText(page, '.ab-actions button', 'Restore')
    ]);
    await chooser.accept([mixed]);
    await new Promise(r => setTimeout(r, 700));

    const said = await toastText(page);
    eq('both weeks in the file are restored', await page.evaluate(() => loadArchive().length), 2);
    check('the green tick owns up to the one line it could not read',
          /Restored/.test(said) && /1 line inside them could not be read/.test(said) &&
          !/1 lines/.test(said), said);
    check('and the good line in that same week came through',
          await page.evaluate(() => loadArchive()[0].sections.learned[0] === 'Reading: from my other laptop'),
          await page.evaluate(() => JSON.stringify(loadArchive()[0].sections)));
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
  group('A warning about one thing is not cancelled by another thing working');
  // =========================================================================
  // The worst bug this tool has had. There was ONE warning box shared by the
  // newsletter and the term archive, and every successful write of any kind
  // hid it. So a laptop that had stopped saving the newsletter went quiet the
  // moment a much smaller archive write succeeded — and the teacher lost a
  // photo on the next reload with nothing on screen having said so.
  await fresh(page);
  {
    await page.evaluate(() => {
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'weekly-family-newsletter') throw new DOMException('full', 'QuotaExceededError');
        return real.call(this, k, v);
      };
    });
    await page.click('[data-field="highlight"]');
    await page.keyboard.type(' A lovely week.');
    await new Promise(r => setTimeout(r, 1200));
    const first = await page.$eval('#saveWarn', el => ({ shown: el.style.display !== 'none', text: el.textContent }));
    check('a newsletter that will not save says so, and stays on screen',
          first.shown && /stopped storing your newsletter/.test(first.text), JSON.stringify(first));

    await typeOver(page, '[data-field="week"]', 'December 7, 2026');
    await new Promise(r => setTimeout(r, 900));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await new Promise(r => setTimeout(r, 400));
    const after = await page.evaluate(() => ({
      saveWarn: document.getElementById('saveWarn').style.display !== 'none',
      archived: loadArchive().some(w => w.week === 'December 7, 2026')
    }));
    check('the week really is added to the archive', after.archived);
    check('and adding it does NOT cancel the warning about the newsletter',
          after.saveWarn, 'the standing "this browser has stopped saving" note was hidden');
  }

  await fresh(page);
  {
    // The same thing in the other direction, and the false green tick with it.
    await page.evaluate(() => {
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'weekly-family-newsletter-archive') throw new DOMException('full', 'QuotaExceededError');
        return real.call(this, k, v);
      };
    });
    await typeOver(page, '[data-field="week"]', 'December 7, 2026');
    await new Promise(r => setTimeout(r, 900));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await new Promise(r => setTimeout(r, 400));
    const t = await toastText(page);
    check('a week the browser refused to store never gets a green tick',
          !/to the archive ✓|Updated ".*" in the archive ✓/.test(t), t);
    const warned = await page.$eval('#archiveSaveWarn', el => ({ shown: el.style.display !== 'none', text: el.textContent }));
    check('it says instead that the week will be gone after a reload',
          warned.shown && /gone after a reload/.test(warned.text), JSON.stringify(warned));

    await page.click('[data-field="highlight"]');
    await page.keyboard.type(' one more sentence');
    await new Promise(r => setTimeout(r, 1300));
    check('and typing a sentence that DOES save does not wipe that warning',
          await page.$eval('#archiveSaveWarn', el => el.style.display !== 'none'),
          'the archive warning disappeared as soon as the draft saved');
  }

  // =========================================================================
  group('Backing out of Restore leaves the saved weeks alone');
  // =========================================================================
  // Escape and Cancel mean "change nothing" on every dialog on a computer.
  // Here Cancel silently deleted every week in the archive and replaced them
  // with the file's, then reported it as a green success.
  await fresh(page);
  {
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await typeOver(page, '[data-field="week"]', 'Week 13 · November 30, 2026');
    await new Promise(r => setTimeout(r, 900));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await new Promise(r => setTimeout(r, 300));
    const beforeCount = await page.evaluate(() => loadArchive().length);

    // Say no to both questions — "don't merge" and then "don't replace either".
    await page.evaluate(() => {
      window.__confirms = [];
      window.confirm = m => { window.__confirms.push(String(m)); return false; };
    });
    const backup = path.join(os.tmpdir(), 'newsletter-one-week-backup.json');
    fs.writeFileSync(backup, JSON.stringify({
      type: 'weekly-family-newsletter-archive', version: 1,
      weeks: [{ week: 'Week 3 · September 21, 2026', sections: { learned: ['Reading: from my other laptop'] } }]
    }));
    let [chooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 8000 }),
      clickByText(page, '.ab-actions button', 'Restore')
    ]);
    await chooser.accept([backup]);
    await new Promise(r => setTimeout(r, 700));
    const afterCancel = await page.evaluate(() => ({
      count: loadArchive().length,
      asked: window.__confirms.slice(),
      toast: [...document.querySelectorAll('body > div')]
        .filter(d => getComputedStyle(d).position === 'fixed' && d.textContent && d.id !== 'summaryModal')
        .map(d => d.textContent).join(' | ')
    }));
    eq('saying no keeps every week that was already there', afterCancel.count, beforeCount);
    check('and it says plainly that nothing was changed',
          /Nothing was changed/.test(afterCancel.toast), afterCancel.toast);
    check('replacing everything is a question of its own, not the Cancel button',
          afterCancel.asked.length === 2 && /Replace your/.test(afterCancel.asked[1]) &&
          /cannot be undone/.test(afterCancel.asked[1]),
          afterCancel.asked.join(' || '));

    // And saying yes to the second question really does replace.
    await page.evaluate(() => {
      const answers = [false, true];
      window.confirm = () => answers.shift();
    });
    [chooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 8000 }),
      clickByText(page, '.ab-actions button', 'Restore')
    ]);
    await chooser.accept([backup]);
    await new Promise(r => setTimeout(r, 700));
    eq('saying yes to "replace them" does replace them',
       await page.evaluate(() => loadArchive().length), 1);
  }

  // =========================================================================
  group('Emptying a bulleted section brings its grey prompt back');
  // =========================================================================
  // The greeting always worked; the four sections that hold LISTS did not.
  // Clearing one left <ul><li></li></ul> — a lone bullet dot on the sheet, no
  // grey hint, and a phantom "- " in the text copy and the archived week.
  await fresh(page);
  {
    for (const field of ['learned', 'coming', 'reminders', 'home']){
      await typeOver(page, `[data-field="${field}"]`, '');
      await new Promise(r => setTimeout(r, 200));
      const st = await page.evaluate(f => {
        const el = document.querySelector(`[data-field="${f}"]`);
        return { html: el.innerHTML, hint: getComputedStyle(el, '::before').content,
                 bullets: el.querySelectorAll('li').length };
      }, field);
      check(`"${field}" comes back to its grey prompt when you empty it`,
            st.html === '' && st.bullets === 0 && /[a-z]/i.test(st.hint), JSON.stringify(st));
    }
    const txt = await page.evaluate(() => buildPlainText());
    check('and no lonely "- " bullet is left in the text copy',
          !/\n-\s*\n/.test('\n' + txt + '\n'), txt.slice(0, 200));

    // Pressing Enter in a section that looks empty used to lose the hint too.
    await page.click('[data-field="highlight"]');
    await page.evaluate(() => {
      const el = document.querySelector('[data-field="highlight"]');
      const r = document.createRange(); r.selectNodeContents(el);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    });
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 200));
    const afterEnter = await page.$eval('[data-field="highlight"]', el =>
      ({ html: el.innerHTML, hint: getComputedStyle(el, '::before').content }));
    check('pressing Enter in an emptied section does not lose the prompt',
          afterEnter.html === '' && /[a-z]/i.test(afterEnter.hint), JSON.stringify(afterEnter));
  }

  // =========================================================================
  group('A line typed under the bullets goes everywhere the bullets go');
  // =========================================================================
  // It was on the sheet, in the PDF and in the print-out, and silently missing
  // from Copy as text, from the archived week and from the Term Summary — the
  // same newsletter saying two different things depending on how it was sent.
  await fresh(page);
  {
    await page.evaluate(() => {
      const el = document.querySelector('[data-field="coming"]');
      const li = el.querySelectorAll('li');
      const r = document.createRange();
      r.setStart(li[li.length - 1], li[li.length - 1].childNodes.length);
      r.collapse(true);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      el.focus();
    });
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Please return the field trip form by Friday.');
    await new Promise(r => setTimeout(r, 1200));
    const seen = await page.evaluate(() => {
      const snap = snapshotWeek();
      return { text: buildPlainText(), archived: (snap.sections.coming || []).join(' | ') };
    });
    check('the sentence under the list is in Copy as text',
          seen.text.includes('Please return the field trip form by Friday.'),
          seen.text.slice(0, 200));
    check('and in the week that gets saved to the archive',
          seen.archived.includes('Please return the field trip form by Friday.'), seen.archived);
  }

  // WHAT THIS CHECK WAS GETTING WRONG: the one above only ever TYPED the
  // sentence, and typing puts it after the list, outside the <ul>. Paste the
  // week's plan in over the section instead — a list with a sentence under it,
  // the ordinary shape of a note — and the sentence comes to rest INSIDE the
  // <ul>, alongside the bullets, because that is where the caret was. The
  // section still read only the <li>s, so the sentence was on the sheet and
  // missing from the text copy: the very thing this group is named for, with
  // the typed check passing all the way through it. Test the pasted moment.
  await fresh(page);
  {
    await pasteInto(page, '[data-field="coming"]',
      '<ul><li>Winter concert practice begins next week</li></ul>' +
      '<div>Please return the field trip form by Friday.</div>');
    await new Promise(r => setTimeout(r, 1200));
    const seen = await page.evaluate(() => {
      const el = document.querySelector('[data-field="coming"]');
      const snap = snapshotWeek();
      return { inTheList: !!el.querySelector('ul > div, ol > div'),
               onSheet: el.innerText.includes('Please return the field trip form by Friday.'),
               text: buildPlainText(),
               archived: (snap.sections.coming || []).join(' | ') };
    });
    check('the pasted sentence really did land inside the list, not after it',
          seen.inTheList && seen.onSheet, JSON.stringify(seen).slice(0, 200));
    check('a pasted sentence under the bullets is in Copy as text',
          seen.text.includes('Please return the field trip form by Friday.'),
          seen.text.slice(0, 300));
    check('and a pasted one is in the week that gets saved too',
          seen.archived.includes('Please return the field trip form by Friday.'), seen.archived);
  }

  // =========================================================================
  group('A plan pasted in from a document, indented sub-bullets and all');
  // =========================================================================
  // A sub-bullet indented under another bullet was written down TWICE: once
  // swallowed into the end of its parent bullet, and once again as a bullet of
  // its own. The sheet, the PDF, the picture and the print-out were right, so
  // the duplicate only showed up in Copy as text, in the archived week and in
  // the Term Summary — the same newsletter saying two different things
  // depending on how it was sent home. It cannot be typed (Tab moves focus);
  // it arrives by paste, which is how plans get into this tool.
  const PLAN =
    '<ul><li>Reading: main idea<ul><li>with nonfiction texts</li></ul></li>' +
    '<li>Math: arrays</li></ul>';
  await fresh(page);
  {
    await pasteInto(page, '[data-field="learned"]', PLAN);
    const seen = await page.evaluate(() => ({
      nested: !!document.querySelector('[data-field="learned"] li ul li, [data-field="learned"] ul ul li'),
      onSheet: document.querySelector('[data-field="learned"]').innerText.replace(/\s+/g, ' ').trim(),
      lines: blockToLines('learned'),
      text: buildPlainText()
    }));
    check('the sub-bullet really is indented under its parent on the sheet',
          seen.nested, seen.onSheet);
    eq('the section reads as three lines, the sub-bullet indented under its own parent',
       seen.lines,
       ['- Reading: main idea', '  - with nonfiction texts', '- Math: arrays']);
    check('the parent bullet does not swallow the words of the one under it',
          !/main idea with nonfiction/i.test(seen.text), seen.text.slice(0, 400));
    check('and "with nonfiction texts" is in Copy as text exactly once',
          (seen.text.match(/with nonfiction texts/g) || []).length === 1,
          seen.text.slice(0, 400));
  }

  // The other shape the same indent arrives in. Some documents hang the
  // indented list off the LIST rather than off the bullet it belongs to; it
  // looks identical on the sheet, and it must read identically too.
  await fresh(page);
  {
    await pasteInto(page, '[data-field="learned"]',
      '<ul><li>Reading: main idea</li><ul><li>with nonfiction texts</li></ul>' +
      '<li>Math: arrays</li></ul>');
    const lines = await page.evaluate(() => blockToLines('learned'));
    eq('an indent written the other way round reads exactly the same',
       lines, ['- Reading: main idea', '  - with nonfiction texts', '- Math: arrays']);
  }

  // A bullet a teacher has broken over two lines with Shift+Enter is ONE
  // bullet, and its two halves must not run together into one word.
  await fresh(page);
  {
    await pasteInto(page, '[data-field="learned"]',
      '<ul><li>Reading: main idea<br>and how we find it</li></ul>');
    const lines = await page.evaluate(() => blockToLines('learned'));
    eq('a bullet broken over two lines keeps the gap between them',
       lines, ['- Reading: main idea and how we find it']);
  }

  // The same paste, all the way through to the archive and the Term Summary —
  // the two surfaces a family and a principal actually read.
  await fresh(page);
  {
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await clickByText(page, '.ab-actions button', 'Clear the example');
    await pasteInto(page, '[data-field="learned"]', PLAN);
    await typeOver(page, '[data-field="week"]', 'March 3, 2027');
    await new Promise(r => setTimeout(r, 1100));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await new Promise(r => setTimeout(r, 300));
    const saved = await page.evaluate(() => {
      const w = loadArchive()[0];
      openSummary();
      const bullets = [...document.querySelectorAll('#summarySheet .subj')]
        .find(s => /What we learned/i.test(s.textContent))
        .querySelectorAll('li');
      const onScreen = [...bullets].map(b => b.textContent.trim());
      const text = buildSummaryText();
      closeSummary();
      return { archived: w.sections.learned, onScreen, text };
    });
    eq('the archived week keeps the sub-bullet once, and keeps it indented',
       saved.archived,
       ['- Reading: main idea', '  - with nonfiction texts', '- Math: arrays']);
    eq('the Term Summary on screen shows three bullets, not four',
       saved.onScreen,
       ['Reading: main idea', 'with nonfiction texts', 'Math: arrays']);
    check('and no bullet in it is drawn with a stray dash still on the front',
          !saved.onScreen.some(t => t.startsWith('-')), JSON.stringify(saved.onScreen));
    check('the summary you copy says "with nonfiction texts" once',
          (saved.text.match(/with nonfiction texts/g) || []).length === 1,
          saved.text.slice(0, 400));
    check('and does not say it inside the Reading bullet as well',
          !/main idea with nonfiction/i.test(saved.text), saved.text.slice(0, 400));
  }

  // Time travel reads the archived lines apart at the first colon. An indented
  // sub-bullet kept its dash there, so "  - Reading: ..." was filed under a
  // subject called "- Reading" and the row of buttons grew a second, duplicate
  // Reading that nothing could ever be added to.
  await fresh(page);
  {
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await clickByText(page, '.ab-actions button', 'Clear the example');
    await pasteInto(page, '[data-field="learned"]',
      '<ul><li>Science: weather<ul><li>Reading: main idea with charts</li></ul></li></ul>');
    await typeOver(page, '[data-field="week"]', 'March 3, 2027');
    await new Promise(r => setTimeout(r, 1100));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await typeOver(page, '[data-field="week"]', 'March 10, 2027');
    await new Promise(r => setTimeout(r, 500));
    const pills = await page.$$eval('.catchup-pill', els =>
      els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    check('no Time travel button is named after a dash',
          !pills.some(p => /^-/.test(p)), JSON.stringify(pills));
    check('the indented "Reading:" line is filed under Reading, like any other',
          pills.some(p => /^Reading\b/.test(p)), JSON.stringify(pills));
  }

  // =========================================================================
  group('Adding the untouched template keeps it labelled as the example');
  // =========================================================================
  // One click re-filed a made-up week as the teacher's own: the Example tag
  // vanished, the bar said "1 of your weeks saved", and the backup file
  // stopped being named EXAMPLE-not-a-real-class — while the sheet it was
  // copied from still said it was only the starting template.
  await fresh(page);
  {
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await new Promise(r => setTimeout(r, 400));
    const st = await page.evaluate(() => {
      const list = loadArchive();
      return { total: list.length, examples: list.filter(w => w.example).length,
               status: document.getElementById('archiveStatus').textContent };
    });
    eq('the archive still holds twelve weeks', st.total, 12);
    eq('and every one of them is still marked as the example', st.examples, 12);
    check('the archive bar does not claim one of them is the teacher\'s own',
          !/of your weeks saved/.test(st.status), st.status);
  }

  // =========================================================================
  group('Time travel counts agree with the archive');
  // =========================================================================
  await fresh(page);
  {
    const before = await page.$eval('.catchup-pill', el => el.textContent.trim());
    await typeOver(page, '[data-field="week"]', 'November 30, 2026');
    await new Promise(r => setTimeout(r, 400));
    const after = await page.$eval('.catchup-pill', el => el.textContent.trim());
    check('changing "Week of" updates the counts on screen straight away',
          before !== after, `both read "${after}"`);
    const clicked = await page.evaluate(() => {
      const p = document.querySelector('.catchup-pill');
      const wasSaying = p.textContent.trim();
      p.click();
      return { wasSaying, nowSaying: document.querySelector('.catchup-pill').textContent.trim() };
    });
    eq('and clicking a subject does not change its number', clicked.nowSaying, clicked.wasSaying);
  }

  await fresh(page);
  {
    // Two bullets for the same subject in one week is one WEEK, not two.
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await clickByText(page, '.ab-actions button', 'Clear the example');
    await typeOver(page, '[data-field="learned"]', '');
    await page.keyboard.type('Reading: main idea in nonfiction');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Reading: book clubs started');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Math: arrays');
    await typeOver(page, '[data-field="week"]', 'March 3, 2027');
    await new Promise(r => setTimeout(r, 1100));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await typeOver(page, '[data-field="week"]', 'March 10, 2027');
    await new Promise(r => setTimeout(r, 500));
    const shown = await page.evaluate(() => {
      const pill = [...document.querySelectorAll('.catchup-pill')]
        .find(p => /reading/i.test(p.textContent));
      pill.click();
      return { pill: pill.textContent.replace(/\s+/g, ' ').trim(),
               panel: document.querySelector('.catchup-panel .cp-title').textContent,
               rows: document.querySelectorAll('.catchup-panel .catchup-week').length,
               bar: document.getElementById('archiveStatus').textContent };
    });
    check('one saved week with two Reading bullets counts as one week, not two',
          /Reading 1\b/.test(shown.pill) && shown.rows === 1, JSON.stringify(shown));
    check('and the panel says "1 week", the way the archive bar does',
          /· 1 week\b/.test(shown.panel) && /1 week saved/.test(shown.bar), JSON.stringify(shown));
  }

  await fresh(page);
  {
    // A week whose bullets carry no "Subject:" puts nothing behind the buttons.
    // Time travel used to say "once you save a few weeks" while the archive bar
    // on the same screen said one was saved.
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await clickByText(page, '.ab-actions button', 'Clear the example');
    await typeOver(page, '[data-field="learned"]', 'We practiced our multiplication facts');
    await typeOver(page, '[data-field="week"]', 'March 3, 2027');
    await new Promise(r => setTimeout(r, 1100));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await typeOver(page, '[data-field="week"]', 'March 10, 2027');
    await new Promise(r => setTimeout(r, 500));
    const said = await page.evaluate(() => ({
      bar: document.getElementById('archiveStatus').textContent,
      travel: document.getElementById('catchup').textContent
    }));
    check('Time travel does not claim nothing is saved when a week is',
          /1 week saved/.test(said.bar) && !/Once you save a few weeks/.test(said.travel),
          JSON.stringify(said));
    check('it explains what it needs instead — a "Reading:" at the start of a bullet',
          /Reading:/.test(said.travel), said.travel.slice(0, 200));
  }

  // =========================================================================
  group('A subject with a quotation mark in its name still opens');
  // =========================================================================
  // Reading "Charlotte's Web" drew a button that could never be opened —
  // clicking it did nothing at all, forever, with no message and no error.
  await fresh(page);
  {
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await clickByText(page, '.ab-actions button', 'Clear the example');
    await typeOver(page, '[data-field="learned"]', '');
    await page.keyboard.type('Reading "Charlotte\'s Web": chapter 5 read-aloud');
    await typeOver(page, '[data-field="week"]', 'January 12, 2027');
    await new Promise(r => setTimeout(r, 1100));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await typeOver(page, '[data-field="week"]', 'January 19, 2027');
    await new Promise(r => setTimeout(r, 500));
    const box = await page.evaluate(() => {
      const p = document.querySelector('.catchup-pill');
      if (!p) return null;
      p.scrollIntoView({ block: 'center' });
      return p.getBoundingClientRect().toJSON();
    });
    check('the subject button is drawn', !!box);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await new Promise(r => setTimeout(r, 250));
    check('and a real click on it opens its history',
          await page.evaluate(() => !!document.querySelector('.catchup-panel')),
          'clicking the pill did nothing at all');
  }

  // =========================================================================
  group('Manage removes the week you clicked on');
  // =========================================================================
  // The Remove buttons had the row's POSITION baked into them, so a list drawn
  // before the archive changed deleted a different week — or nothing at all.
  await fresh(page);
  {
    await page.evaluate(() => {
      localStorage.setItem('weekly-family-newsletter-owned', '1');
      localStorage.setItem('weekly-family-newsletter-archive', JSON.stringify(
        ['Week A', 'Week B', 'Week C', 'Week D'].map(w => ({ week: w, sections: { learned: ['Math: ' + w] } }))));
    });
    await page.reload({ waitUntil: 'load' });
    await clickByText(page, '.ab-actions button', 'Manage');
    // Another tab removes Week A while this list is on screen.
    await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('weekly-family-newsletter-archive'));
      list.shift();
      localStorage.setItem('weekly-family-newsletter-archive', JSON.stringify(list));
      window.__confirmAnswer = true;
    });
    await page.evaluate(() => {
      const row = [...document.querySelectorAll('.archive-list .row')].find(r => /Week C/.test(r.textContent));
      row.querySelector('button').click();
    });
    await new Promise(r => setTimeout(r, 300));
    const left = await page.evaluate(() => loadArchive().map(w => w.week));
    check('clicking Remove on "Week C" removes Week C and nothing else',
          !left.includes('Week C') && left.includes('Week D') && left.includes('Week B'),
          left.join(', '));

    // And the open list keeps up with a week added underneath it.
    await typeOver(page, '[data-field="week"]', 'Week Z');
    await new Promise(r => setTimeout(r, 900));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await new Promise(r => setTimeout(r, 300));
    const shown = await page.evaluate(() => ({
      rows: document.querySelectorAll('.archive-list .row').length,
      stored: loadArchive().length
    }));
    eq('a week added with Manage open appears in the list right away',
       shown.rows, shown.stored);
  }

  // =========================================================================
  group('A backup file the computer cannot open says so');
  // =========================================================================
  await fresh(page);
  {
    const locked = path.join(os.tmpdir(), 'newsletter-unreadable-backup.json');
    fs.writeFileSync(locked, JSON.stringify({ weeks: [{ week: 'W', sections: { learned: [] } }] }));
    fs.chmodSync(locked, 0o000);
    const [chooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 8000 }),
      clickByText(page, '.ab-actions button', 'Restore')
    ]);
    await chooser.accept([locked]);
    await new Promise(r => setTimeout(r, 900));
    const t = await toastText(page);
    check('Restore does not fail in silence when the file will not open',
          /could not be opened/.test(t), t || '(nothing was said at all)');
    fs.chmodSync(locked, 0o600);
    fs.unlinkSync(locked);
  }

  // =========================================================================
  group('The newsletter that goes home does not point at things it has not got');
  // =========================================================================
  await fresh(page);
  {
    const shipped = await page.evaluate(() => ({
      greeting: document.querySelector('[data-field="greeting"]').innerText,
      album: document.getElementById('album').className,
      href: document.getElementById('albumLink').getAttribute('href'),
      text: buildPlainText()
    }));
    check('the greeting does not send families to Time travel, which no copy carries',
          !/time travel/i.test(shipped.greeting), shipped.greeting.slice(0, 160));
    check('no made-up photo album link is wired up waiting to be sent out',
          !/has-link/.test(shipped.album) && shipped.href === '#' &&
          !/photos\.app\.goo\.gl/.test(shipped.text), JSON.stringify(shipped).slice(0, 200));
    check('so the album row is kept out of the PDF and the image until there is a link',
          await page.evaluate(() => skipFromExport(document.getElementById('album'))));

    await page.evaluate(() => { window.__promptAnswer = 'photos.example.com/room18'; });
    await clickByText(page, '.album-controls button', 'Add photo album link');
    await new Promise(r => setTimeout(r, 300));
    check('adding a real link puts the row back into the exports',
          await page.evaluate(() => !skipFromExport(document.getElementById('album'))));
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await clickByText(page, '.album-controls button', 'Remove');
    await new Promise(r => setTimeout(r, 300));
    check('and taking the link out takes the blue bar out of them again',
          await page.evaluate(() => skipFromExport(document.getElementById('album'))),
          'the "More photos from this week" bar would still print with nothing behind it');
  }

  // =========================================================================
  group('The Term Summary holds the keyboard while it is open');
  // =========================================================================
  // Six Tabs from the open summary landed on "Start fresh" — behind the
  // summary, with no focus ring on screen — and Enter wiped the newsletter.
  await fresh(page);
  {
    await page.evaluate(() => openSummary());
    await new Promise(r => setTimeout(r, 200));
    const inside = [];
    for (let i = 0; i < 8; i++){
      await page.keyboard.press('Tab');
      inside.push(await page.evaluate(() =>
        !!(document.activeElement && document.activeElement.closest('#summaryModal'))));
    }
    check('every Tab stays inside the summary instead of walking the page behind it',
          inside.every(Boolean), `${inside.filter(Boolean).length} of 8 stayed inside`);
    const draftBefore = await draftSize(page);
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 400));
    check('so pressing Enter cannot fire "Start fresh" from behind the summary',
          await draftSize(page) >= draftBefore || await page.$('#sheetExampleTag') !== null,
          'the newsletter was wiped by a keypress aimed at the summary');
    await page.evaluate(() => closeSummary());
  }

  // =========================================================================
  group('The Term Summary stays put and opens at its own title');
  // =========================================================================
  await fresh(page);
  {
    await page.setViewport({ width: 768, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => openSummary());
    await new Promise(r => setTimeout(r, 200));
    await page.mouse.move(384, 600);
    for (let i = 0; i < 10; i++) await page.mouse.wheel({ deltaY: 600 });
    await new Promise(r => setTimeout(r, 300));
    const scrolled = await page.evaluate(() => ({
      page: window.scrollY,
      inside: document.querySelector('#summaryModal .modal-scroll').scrollTop
    }));
    check('reading the summary to the end does not scroll the newsletter behind it',
          scrolled.page === 0 && scrolled.inside > 0, JSON.stringify(scrolled));
    await page.evaluate(() => closeSummary());
    await page.evaluate(() => openSummary());
    await new Promise(r => setTimeout(r, 200));
    const reopened = await page.evaluate(() => ({
      top: document.querySelector('#summaryModal .modal-scroll').scrollTop,
      firstWords: document.querySelector('#summarySheet h1').textContent
    }));
    check('reopening it starts at the title and its "EXAMPLE TERM" stamp',
          reopened.top === 0 && /Term Summary/.test(reopened.firstWords), JSON.stringify(reopened));

    await page.emulateMediaType('print');
    const printed = await page.evaluate(() => getComputedStyle(document.getElementById('summaryModal')).display);
    check('and pressing Print with it open prints the newsletter, not the summary box',
          printed === 'none', printed);
    await page.emulateMediaType(null);
    await page.evaluate(() => closeSummary());
    await page.setViewport({ width: 1280, height: 1000 });
  }

  // =========================================================================
  group('Printing does not cut a card away from its own heading');
  // =========================================================================
  await fresh(page);
  {
    await page.emulateMediaType('print');
    await page.setViewport({ width: Math.round(816 - 2 * 38.4), height: Math.round(1056 - 2 * 38.4) });
    const fit = await page.evaluate(() => ({
      sheet: document.getElementById('sheet').getBoundingClientRect().height,
      printable: window.innerHeight,
      avoid: [...document.querySelectorAll('.card, .footer')]
        .every(el => /avoid/.test(getComputedStyle(el).breakInside))
    }));
    check('an ordinary week fits on one sheet of paper',
          fit.sheet <= fit.printable, `${Math.round(fit.sheet)}px of content in a ${fit.printable}px page`);
    check('and no card or footer can be split across a page break', fit.avoid);
    await page.emulateMediaType(null);
    await page.setViewport({ width: 1280, height: 1000 });
  }

  // =========================================================================
  group('The grey prompts are not photographed into the PDF or the image');
  // =========================================================================
  // @media print blanks them, but html2canvas photographs the SCREEN, so
  // "Add a caption…" was burned across a photo in the file families receive.
  await fresh(page);
  {
    await typeOver(page, '[data-field="greeting"]', '');
    await new Promise(r => setTimeout(r, 300));
    const band = await page.evaluate(() => {
      const s = document.getElementById('sheet').getBoundingClientRect();
      const g = document.querySelector('[data-field="greeting"]').getBoundingClientRect();
      return { x: Math.round((g.left - s.left) * 2), y: Math.round((g.top - s.top) * 2),
               w: Math.round(g.width * 2), h: Math.round(Math.max(g.height, 20) * 2) };
    });
    const ink = await exportAndCountInk(page, 'exportImage()', 'png', band);
    check('an emptied section exports blank, with no grey prompt printed on it',
          ink.dark === 0, JSON.stringify(ink));
    check('and the prompt is back on screen the moment the picture is taken',
          await page.$eval('[data-field="greeting"]', el =>
            /[a-z]/i.test(getComputedStyle(el, '::before').content)));
  }

  // =========================================================================
  group('A second tab cannot write over the newer newsletter');
  // =========================================================================
  await fresh(page);
  {
    await typeOver(page, '[data-field="highlight"]', 'MONDAY line.');
    await new Promise(r => setTimeout(r, 1300));
    const other = await browser.newPage();
    await other.goto(BASE + '/index.html', { waitUntil: 'load' });
    await other.click('[data-field="highlight"]');
    await other.evaluate(() => {
      const el = document.querySelector('[data-field="highlight"]');
      const r = document.createRange(); r.selectNodeContents(el);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    });
    await other.keyboard.type('FRIDAY write-up, an hour of work.');
    await new Promise(r => setTimeout(r, 1400));
    await page.bringToFront();
    await page.click('[data-field="kicker"]');
    await page.keyboard.type('!');
    await new Promise(r => setTimeout(r, 1500));
    const kept = await page.evaluate(() => localStorage.getItem('weekly-family-newsletter') || '');
    check('the older tab does not destroy the hour of work done in the newer one',
          kept.includes('FRIDAY write-up'), 'the saved newsletter is back to MONDAY');
    check('and the older tab says out loud that it has stopped saving',
          await page.$eval('#tabWarn', el => el.style.display !== 'none' && /another tab/.test(el.textContent)));
    await other.close();
    await page.bringToFront();
  }

  // =========================================================================
  group('An open Term Summary notices the archive changing under it');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => openSummary());
    const other = await browser.newPage();
    await other.goto(BASE + '/index.html', { waitUntil: 'load' });
    await other.evaluate(() => { window.confirm = () => true; });
    await other.evaluate(() => clearExampleWeeks());
    await new Promise(r => setTimeout(r, 600));
    await page.bringToFront();
    const state = await page.evaluate(() => ({
      open: document.getElementById('summaryModal').style.display !== 'none',
      onScreen: document.getElementById('summarySheet').textContent,
      copied: buildSummaryText()
    }));
    check('it does not keep showing twelve weeks that are no longer saved anywhere',
          !state.open || state.onScreen.replace(/\s+/g, ' ').includes(state.copied.split('\n')[0]) ||
          !/12 weeks/.test(state.onScreen), state.onScreen.slice(0, 120));
    await other.close();
    await page.bringToFront();
    await page.evaluate(() => closeSummary());
  }

  // =========================================================================
  group('Time travel says so when everything behind the buttons is made up');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await typeOver(page, '[data-field="learned"]', 'We finished our unit on rocks and minerals');
    await typeOver(page, '[data-field="week"]', 'December 1, 2026');
    await new Promise(r => setTimeout(r, 1100));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await typeOver(page, '[data-field="week"]', 'December 8, 2026');
    await new Promise(r => setTimeout(r, 700));
    const note = await page.$eval('.catchup-head .note', el => el.textContent);
    check('a panel made entirely of example weeks still says it is not a real class',
          /every week behind these buttons is the example term/.test(note), note);
  }

  // =========================================================================
  group('Time travel does not spring open on its own');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => { window.__confirmAnswer = true; toggleCatchup('math'); });
    await clickByText(page, '.ab-actions button', 'Clear the example');
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => storeArchive([{ week: 'Week 1 · January 5, 2027', sections: { learned: ['Math: counting on'] } }]));
    await new Promise(r => setTimeout(r, 300));
    eq('weeks coming back later do not open a panel nobody clicked',
       await page.evaluate(() => document.querySelectorAll('.catchup-panel').length), 0);
  }

  // =========================================================================
  group('Two messages at once are both readable');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => { flash('This is the first message'); flash('And here is the second'); });
    await new Promise(r => setTimeout(r, 200));
    const overlap = await page.evaluate(() => {
      const t = [...document.querySelectorAll('.toast')].map(d => d.getBoundingClientRect());
      if (t.length < 2) return 'only ' + t.length + ' toast(s)';
      return (t[0].bottom > t[1].top && t[1].bottom > t[0].top) ? 'they overlap' : 'ok';
    });
    eq('a second message does not land on top of the first', overlap, 'ok');
  }

  // =========================================================================
  group('The sign-off goes back to following the Teacher when you empty it');
  // =========================================================================
  await fresh(page);
  {
    await typeOver(page, '[data-field="signoff"]', 'Mrs. Bhatt');
    await typeOver(page, '[data-field="signoff"]', '');
    await typeOver(page, '[data-field="teacher"]', 'Ms. Rivera');
    await new Promise(r => setTimeout(r, 300));
    const sign = await page.$eval('[data-field="signoff"]', el =>
      ({ text: el.textContent.trim(), ph: el.getAttribute('data-ph') }));
    eq('the letter is signed by the teacher again, not by nobody', sign.text, 'Ms. Rivera');
    check('and the grey ghost text is not the tool author\'s own name',
          !/sahaj/i.test(sign.ph), sign.ph);
  }

  // =========================================================================
  group('The Term Summary is labelled with the term as it stands now');
  // =========================================================================
  // It used to take the class name and grade from the FIRST archived week, so
  // a grade corrected in October never reached the summary; and its date range
  // named the last-ADDED week, so a week filled in late made the header
  // contradict the list of weeks printed under it.
  await fresh(page);
  {
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await clickByText(page, '.ab-actions button', 'Clear the example');
    await typeOver(page, '[data-field="week"]', 'September 8, 2026');
    await typeOver(page, '[data-field="grade"]', '3rd Grade');
    await new Promise(r => setTimeout(r, 900));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await typeOver(page, '[data-field="week"]', 'November 23, 2026');
    await typeOver(page, '[data-field="grade"]', '3rd / 4th Grade');
    await new Promise(r => setTimeout(r, 900));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    // A week the teacher missed at the time, filled in last.
    await typeOver(page, '[data-field="week"]', 'October 7, 2026');
    await new Promise(r => setTimeout(r, 900));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await new Promise(r => setTimeout(r, 300));

    const sum = await page.evaluate(() => {
      openSummary();
      return { meta: document.querySelector('#summarySheet .sum-meta').textContent,
               text: buildSummaryText(), prompt: buildAIPrompt() };
    });
    check('the week range ends at the latest week, not the last one added',
          /September 8, 2026 → November 23, 2026/.test(sum.meta), sum.meta);
    check('the grade shown is the corrected one, not the one from week 1',
          /3rd \/ 4th Grade/.test(sum.meta), sum.meta);
    check('the copied summary text carries the grade too',
          /3rd \/ 4th Grade/.test(sum.text), sum.text.split('\n').slice(0, 3).join(' / '));
    check('and none of the three surfaces says "3 weeks" as "3 week" or "1 weeks"',
          !/\b1 weeks\b/.test(sum.meta + sum.text + sum.prompt));
    await page.evaluate(() => closeSummary());

    await page.evaluate(() => { window.__downloads = []; });
    await clickByText(page, '.ab-actions button', 'Back up');
    await new Promise(r => setTimeout(r, 400));
    const name = await page.evaluate(() => (window.__downloads[0] || {}).name || '');
    check('and the backup file is named for the latest week as well',
          /november-23-2026/.test(name), name);
  }

  // =========================================================================
  group('One example week reads as "1 example week"');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => {
      localStorage.setItem('weekly-family-newsletter-owned', '1');
      localStorage.setItem('weekly-family-newsletter-archive', JSON.stringify([
        { week: 'Week 1 · September 8, 2026', example: true, sections: { learned: ['Math: counting'] } },
        { week: 'Week 2 · September 14, 2026', sections: { learned: ['Math: place value'] } }
      ]));
    });
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => { window.__downloads = []; });
    await clickByText(page, '.ab-actions button', 'Back up');
    await new Promise(r => setTimeout(r, 400));
    const note = await page.evaluate(async () => {
      const d = window.__downloads[0];
      const txt = await (await fetch(d.href)).text();
      return JSON.parse(txt).note;
    });
    check('the sentence inside the backup file says "1 of these weeks is", not "are"',
          /1 of these weeks is the example/.test(note), note);
  }

  // =========================================================================
  group('A damaged saved week is not quietly thrown away');
  // =========================================================================
  // The tool promised "everything else is still here" — then the very next
  // ordinary click deleted the damaged week from the laptop for good.
  await fresh(page);
  {
    await page.evaluate(() => {
      localStorage.setItem('weekly-family-newsletter-owned', '1');
      localStorage.setItem('weekly-family-newsletter-archive', JSON.stringify([
        { week: 'Week 9 · a real week I care about' },
        { week: 'Week 10 · November 9, 2026', sections: { learned: ['Math: arrays'] } }
      ]));
      window.__confirmAnswer = true;
    });
    await page.reload({ waitUntil: 'load' });
    check('the tool says a saved week could not be read',
          await page.$eval('#archiveWarn', el => el.style.display !== 'none' && /could not be read/.test(el.textContent)));
    await typeOver(page, '[data-field="week"]', 'November 23, 2026');
    await new Promise(r => setTimeout(r, 900));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await new Promise(r => setTimeout(r, 400));
    const raw = await page.evaluate(() => localStorage.getItem('weekly-family-newsletter-archive'));
    check('and adding another week does not delete it from the laptop',
          raw.includes('a real week I care about'), raw.slice(0, 200));
    check('so the notice about it is still on screen afterwards',
          await page.$eval('#archiveWarn', el => el.style.display !== 'none'),
          'the notice vanished as if the problem had solved itself');
  }

  // =========================================================================
  group('An archive that cannot be read at all is not written over');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => {
      localStorage.setItem('weekly-family-newsletter-owned', '1');
      const good = JSON.stringify([{ week: 'Week 1 · September 8, 2026', sections: { learned: ['Math: counting'] } }]);
      localStorage.setItem('weekly-family-newsletter-archive', good.slice(0, good.length - 25));
      window.__confirmAnswer = true;
    });
    await page.reload({ waitUntil: 'load' });
    const said = await page.$eval('#archiveWarn', el => ({ shown: el.style.display !== 'none', text: el.textContent }));
    check('a term archive that will not read says so instead of "No weeks saved yet"',
          said.shown && /could not be read/.test(said.text), JSON.stringify(said));
    await typeOver(page, '[data-field="week"]', 'November 23, 2026');
    await new Promise(r => setTimeout(r, 900));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await new Promise(r => setTimeout(r, 400));
    check('and the damaged text is kept to one side rather than overwritten',
          await page.evaluate(() => (localStorage.getItem('weekly-family-newsletter-archive-unreadable') || '').includes('September 8')),
          'the only copy of the damaged archive was written over');
  }

  // =========================================================================
  group('A teacher\'s real archive is never replaced by the example');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => {
      localStorage.removeItem('weekly-family-newsletter-owned');
      localStorage.setItem('weekly-family-newsletter-archive', JSON.stringify([
        { week: 'Week 1 · Sept 8', title: 'Room 18', sections: { learned: ['Reading: real work'] } },
        { week: 'Week 2 · Sept 14', title: 'Room 18', sections: { learned: ['Math: real work'] } }
      ]));
    });
    await page.reload({ waitUntil: 'load' });
    const after = await page.evaluate(() => loadArchive().map(w => w.week));
    check('losing the "this is mine" flag does not destroy two real saved weeks',
          after.length === 2 && after[0] === 'Week 1 · Sept 8', after.join(', '));
  }

  // =========================================================================
  group('Damaged saved data can never stop the newsletter saving');
  // =========================================================================
  // Every one of these threw at BOOT, before the autosave listener was
  // attached. The page looked normal, the archive bar said "1 week saved", and
  // every word typed afterwards was lost with no warning anywhere.
  {
    const shapes = [
      ['a week label stored as a number',
       [{ week: 'Week A', sections: { learned: ['Reading: a'] } }, { week: 2026, sections: { learned: ['Math: b'] } }]],
      ['a section stored as a sentence instead of a list',
       [{ week: 'Week 1 · September 8, 2026', sections: { learned: 'Reading: fables' } }]],
      ['a single bullet stored as a number',
       [{ week: 'Week 1 · September 8, 2026', sections: { learned: ['Math: counting', 2026] } }]],
      ['a saved week with no name at all',
       [{ sections: { learned: ['Math: counting'] } }, { week: 'Week 2', sections: { learned: ['Math: more'] } }]]
    ];
    for (const [what, archive] of shapes){
      await fresh(page);
      const before = pageErrors.length;
      await page.evaluate(a => {
        localStorage.setItem('weekly-family-newsletter-owned', '1');
        localStorage.setItem('weekly-family-newsletter-archive', JSON.stringify(a));
      }, archive);
      await page.reload({ waitUntil: 'load' });
      await page.click('[data-field="greeting"]');
      await page.keyboard.type(' An hour of writing after that.');
      await new Promise(r => setTimeout(r, 1300));
      const saved = (await draftText(page)).includes('An hour of writing after that.');
      check(`typing is still saved with ${what} in storage`, saved,
            `the draft is ${(await draftText(page)).length} characters long`);
      check(`and the page does not throw with ${what}`,
            pageErrors.length === before, pageErrors.slice(before).join(' | '));
      const sum = await page.evaluate(() => buildSummaryText());
      check(`and the summary reads cleanly with ${what}`,
            !/undefined|NaN|\[object Object\]/.test(sum), sum.slice(0, 140));
    }
  }

  // =========================================================================
  group('A backup file of the wrong shape cannot break the tool for good');
  // =========================================================================
  await fresh(page);
  {
    const bad = path.join(os.tmpdir(), 'newsletter-bad-sections-backup.json');
    fs.writeFileSync(bad, JSON.stringify({ type: 'weekly-family-newsletter-archive', version: 1, weeks: [
      { week: 'Week 1 · Sept 8', sections: { learned: ['Reading: running records'] } },
      { week: 'Week 2 · Sept 14', sections: { learned: 'Reading: just-right books' } }
    ] }));
    await page.evaluate(() => { const a = [false, true]; window.confirm = () => a.shift(); });
    const [chooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 8000 }),
      clickByText(page, '.ab-actions button', 'Restore')
    ]);
    await chooser.accept([bad]);
    await new Promise(r => setTimeout(r, 700));
    const before = pageErrors.length;
    await page.reload({ waitUntil: 'load' });
    await page.click('[data-field="greeting"]');
    await page.keyboard.type(' Still writing after the restore.');
    await new Promise(r => setTimeout(r, 1300));
    check('the good week from the file is kept',
          await page.evaluate(() => loadArchive().length) === 1);
    check('the bad one does not stop the page saving anything ever again',
          (await draftText(page)).includes('Still writing after the restore.'));
    check('and the page still opens with no error',
          pageErrors.length === before, pageErrors.slice(before).join(' | '));
  }

  // =========================================================================
  group('A saved draft that cannot be used says so instead of vanishing');
  // =========================================================================
  {
    for (const [what, stored] of [
      ['a draft that is not a newsletter at all', '[1,2,3]'],
      ['a draft whose newsletter is a single number', JSON.stringify({ html: 7, photos: ['', ''] })]
    ]){
      await fresh(page);
      await page.evaluate(v => {
        clearTimeout(window.__save); window.__save = null;
        localStorage.setItem('weekly-family-newsletter', v);
      }, stored);
      await page.goto(BASE + '/index.html', { waitUntil: 'load' });
      const st = await page.evaluate(() => ({
        warn: { shown: document.getElementById('saveWarn').style.display !== 'none',
                text: document.getElementById('saveWarn').textContent },
        fields: document.querySelectorAll('#sheet [data-field]').length
      }));
      check(`${what} is refused out loud, not in silence`,
            st.warn.shown && /could not be read/.test(st.warn.text) &&
            !/error|invalid/i.test(st.warn.text), JSON.stringify(st.warn));
      check(`and the whole newsletter is still on the page after ${what}`,
            st.fields > 5, `${st.fields} editable fields left`);
    }
  }

  // =========================================================================
  group('A restore that loses only the pictures says exactly that');
  // =========================================================================
  await fresh(page);
  {
    await typeOver(page, '[data-field="title"]', 'Room 18 Weekly — Week 15');
    await new Promise(r => setTimeout(r, 1200));
    await page.evaluate(() => {
      clearTimeout(window.__save); window.__save = null;
      const d = JSON.parse(localStorage.getItem('weekly-family-newsletter'));
      d.photos = ['IMG_2043.HEIC', ''];
      localStorage.setItem('weekly-family-newsletter', JSON.stringify(d));
    });
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    const st = await page.evaluate(() => ({
      title: document.querySelector('[data-field="title"]').textContent.trim(),
      warn: document.getElementById('saveWarn').textContent,
      shown: document.getElementById('saveWarn').style.display !== 'none',
      filled: document.querySelector('.photo[data-slot="0"]').classList.contains('has-img'),
      inExport: !skipFromExport(document.querySelector('.photo[data-slot="0"]'))
    }));
    check('the teacher\'s own newsletter really is back on screen',
          st.title === 'Room 18 Weekly — Week 15', st.title);
    check('and the note describes that, rather than claiming the example loaded',
          st.shown && /pictures could not be read/.test(st.warn) &&
          !/example content instead/.test(st.warn), st.warn);
    check('a photo that is not a picture is not counted as one, or exported',
          !st.filled && !st.inExport, JSON.stringify(st));
  }

  // =========================================================================
  group('Adding a photo from the keyboard, and a finger-sized ✕');
  // =========================================================================
  await fresh(page);
  {
    await page.focus('.photo[data-slot="0"]');
    const [chooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 8000 }),
      page.keyboard.press('Enter')
    ]);
    check('pressing Enter on a photo box opens the picture chooser', true);
    await chooser.accept([path.join(os.tmpdir(), 'newsletter-test-photo.jpg')]);
    await page.waitForFunction(() => document.querySelector('.photo[data-slot="0"]').classList.contains('has-img'),
                               { timeout: 20000 });
    const size = await page.$eval('.photo[data-slot="0"] .remove', el => {
      const r = el.getBoundingClientRect(); return { w: r.width, h: r.height };
    });
    check('the ✕ that takes a picture out is a finger-sized target',
          size.w >= 44 && size.h >= 44, JSON.stringify(size));
    const missed = await page.evaluate(() => {
      const r = document.querySelector('.photo[data-slot="0"] .remove').getBoundingClientRect();
      let opened = 0;
      const input = document.getElementById('fileInput');
      const real = input.click.bind(input);
      input.click = () => { opened++; };
      const el = document.elementFromPoint(r.left + 6, r.top + r.height / 2);
      el.click();
      input.click = real;
      return opened;
    });
    eq('and a near-miss on it does not open "choose a photo" instead', missed, 0);
  }

  // =========================================================================
  group('Two photos chosen one after the other both land');
  // =========================================================================
  await fresh(page);
  {
    const photo = path.join(os.tmpdir(), 'newsletter-test-photo.jpg');
    const cdp = await page.target().createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    let [c1] = await Promise.all([page.waitForFileChooser({ timeout: 8000 }),
                                 page.click('.photo[data-slot="0"]')]);
    await c1.accept([photo]);
    // Straight on to the second box, without waiting for the first to appear.
    let [c2] = await Promise.all([page.waitForFileChooser({ timeout: 8000 }),
                                 page.click('.photo[data-slot="1"]')]);
    await c2.accept([photo]);
    await page.waitForFunction(
      () => document.querySelectorAll('.photo.has-img').length === 2, { timeout: 25000 }
    ).catch(() => {});
    const both = await page.evaluate(() => document.querySelectorAll('.photo.has-img').length);
    eq('the second picture is not silently dropped', both, 2);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }

  // =========================================================================
  group('A picture you take out stays out');
  // =========================================================================
  await fresh(page);
  {
    const photo = path.join(os.tmpdir(), 'newsletter-test-photo.jpg');
    await addPhoto(page, 0, photo);
    const cdp = await page.target().createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 });
    await page.evaluate(() => { window.__confirmAnswer = true; });
    const [c] = await Promise.all([page.waitForFileChooser({ timeout: 8000 }),
                                   page.click('.photo[data-slot="0"]')]);
    await c.accept([photo]);
    // Change your mind while it is still being read.
    await page.evaluate(() => document.querySelector('.photo[data-slot="0"] .remove').click());
    await new Promise(r => setTimeout(r, 3000));
    const back = await page.evaluate(() => ({
      filled: document.querySelector('.photo[data-slot="0"]').classList.contains('has-img'),
      inDraft: ((JSON.parse(localStorage.getItem('weekly-family-newsletter') || '{}').photos || [''])[0] || '').length
    }));
    check('a picture removed while the next one was loading does not come back',
          !back.filled && back.inDraft === 0, JSON.stringify(back));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }

  // =========================================================================
  group('Start fresh is not undone by a photo that was still loading');
  // =========================================================================
  await fresh(page);
  {
    const cdp = await page.target().createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 });
    const [c] = await Promise.all([page.waitForFileChooser({ timeout: 8000 }),
                                   page.click('.photo[data-slot="0"]')]);
    await c.accept([path.join(os.tmpdir(), 'newsletter-test-photo.jpg')]);
    slowPageMs = 3000;                    // a reload that takes its time
    await page.evaluate(() => { window.__confirmAnswer = true; resetSheet(); });
    // Take the coverage record while the old document is still alive: Chrome
    // throws it away the instant the reload commits, and Start fresh's own
    // lines would otherwise be reported as never having run.
    await harvest(page);
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 25000 });
    slowPageMs = 0;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const after = await page.evaluate(() => ({
      draft: (localStorage.getItem('weekly-family-newsletter') || '').length,
      filled: document.querySelectorAll('.photo.has-img').length,
      band: !!document.getElementById('sheetExampleTag')
    }));
    check('Start fresh really does start fresh, photo and all',
          after.draft === 0 && after.filled === 0 && after.band, JSON.stringify(after));
  }

  // =========================================================================
  group('The newsletter appears before the internet does');
  // =========================================================================
  // The two picture-making libraries used to block the whole page, so on a slow
  // school wifi a visitor's first several seconds were a blank white rectangle.
  {
    slowCdnMs = 4000;
    const nav = page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 1200));
    const early = await page.evaluate(() => ({
      toolbar: !!document.querySelector('.toolbar'),
      title: (document.querySelector('h1.title') || {}).textContent || '',
      sheet: !!document.getElementById('sheet')
    })).catch(e => ({ error: String(e) }));
    check('the newsletter is on screen a second in, with the wifi still thinking',
          early.toolbar && early.sheet && /Newsletter/.test(early.title), JSON.stringify(early));
    await nav;
    slowCdnMs = 0;
  }

  // =========================================================================
  group('The page is a standards-mode page in a language browsers can read');
  // =========================================================================
  await fresh(page);
  {
    const doc = await page.evaluate(() => ({
      mode: document.compatMode,
      lang: document.documentElement.getAttribute('lang')
    }));
    eq('it is not drawn in quirks mode', doc.mode, 'CSS1Compat');
    eq('and it says what language it is written in', doc.lang, 'en');
  }

  // =========================================================================
  group('A highlight written as paragraphs keeps its shape everywhere');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await clickByText(page, '.ab-actions button', 'Clear the example');
    await typeOver(page, '[data-field="highlight"]', 'AAA first line here.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('BBB second line here.');
    await page.keyboard.press('Enter');
    await page.keyboard.type('CCC third line here.');
    await typeOver(page, '[data-field="week"]', 'March 3, 2027');
    await new Promise(r => setTimeout(r, 1100));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await new Promise(r => setTimeout(r, 300));
    const shape = await page.evaluate(() => {
      openSummary();
      const lis = [...document.querySelectorAll('#summarySheet .subj')]
        .find(s => /Highlights/i.test(s.textContent))
        .querySelectorAll('li');
      const text = buildSummaryText();
      closeSummary();
      return { onScreen: lis.length,
               inText: (text.match(/^\s+- (AAA|BBB|CCC)/gm) || []).length };
    });
    check('three paragraphs are three lines in the summary on screen', shape.onScreen === 3, JSON.stringify(shape));
    check('and three bullets in the summary you copy', shape.inText === 3, JSON.stringify(shape));
  }

  // =========================================================================
  group('An emptied bullet is not counted as something the class did');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await clickByText(page, '.ab-actions button', 'Clear the example');
    await typeOver(page, '[data-field="coming"]', '');
    await typeOver(page, '[data-field="week"]', 'March 3, 2027');
    await new Promise(r => setTimeout(r, 1100));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await new Promise(r => setTimeout(r, 300));
    const said = await page.evaluate(() => {
      openSummary();
      const block = [...document.querySelectorAll('#summarySheet .subj')]
        .find(s => /Coming up next/i.test(s.textContent)).textContent;
      closeSummary();
      return block;
    });
    check('a section the teacher emptied reads "Nothing recorded for this yet."',
          /Nothing recorded for this yet/.test(said), said.slice(0, 120));
  }

  // =========================================================================
  group('The buttons that copy, print and back things up all still work');
  // =========================================================================
  // These are the ordinary paths a teacher takes every week. They are here so
  // that a fix somewhere else cannot quietly break one of them.
  await fresh(page);
  {
    await page.evaluate(() => { window.__promptAnswer = 'photos.example.com/room18'; });
    await clickByText(page, '.album-controls button', 'Add photo album link');
    await new Promise(r => setTimeout(r, 300));
    const copied = await page.evaluate(async () => {
      let got = '';
      navigator.clipboard.writeText = t => { got = t; return Promise.resolve(); };
      copyPlainText();
      await new Promise(r => setTimeout(r, 200));
      return got;
    });
    check('Copy as text puts the album address in the text families are sent',
          /MORE PHOTOS FROM THIS WEEK: https:\/\/photos\.example\.com\/room18/.test(copied),
          copied.slice(0, 200));

    // The older way of copying, for a browser that will not hand over the
    // clipboard. It was silently untested until now.
    const fallback = await page.evaluate(async () => {
      const saved = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
      let copiedText = '';
      document.execCommand = () => { copiedText = document.querySelector('textarea') ? document.querySelector('textarea').value : ''; return true; };
      copyPlainText();
      await new Promise(r => setTimeout(r, 200));
      Object.defineProperty(navigator, 'clipboard', { value: saved, configurable: true });
      return copiedText;
    });
    check('and it still copies on a browser that will not hand over the clipboard',
          /OUR WEEKLY NEWSLETTER/.test(fallback), fallback.slice(0, 120));

    await page.evaluate(() => { window.__opened = []; });
    await page.evaluate(() => openSummary());
    await clickByText(page, '.modal-bar-actions button', 'Print');
    await new Promise(r => setTimeout(r, 500));
    eq('Print on the Term Summary opens a page to print',
       await page.evaluate(() => window.__opened.length), 1);
    const sumCopy = await page.evaluate(async () => {
      let got = '';
      navigator.clipboard.writeText = t => { got = t; return Promise.resolve(); };
      copySummaryText();
      await new Promise(r => setTimeout(r, 200));
      return got;
    });
    check('and Copy as text on the summary copies the whole term',
          /TERM SUMMARY/.test(sumCopy) && /WHAT WE LEARNED/.test(sumCopy), sumCopy.slice(0, 120));
    await page.evaluate(() => closeSummary());
  }

  // =========================================================================
  group('Restore, from an empty archive and into a full one');
  // =========================================================================
  await fresh(page);
  {
    const notABackup = path.join(os.tmpdir(), 'newsletter-not-a-backup.json');
    fs.writeFileSync(notABackup, JSON.stringify({ shoppingList: ['milk'] }));
    let [chooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 8000 }),
      clickByText(page, '.ab-actions button', 'Restore')
    ]);
    await chooser.accept([notABackup]);
    await new Promise(r => setTimeout(r, 600));
    check('a file that is not a backup is refused in plain words',
          /isn't a newsletter backup/.test(await toastText(page)), await toastText(page));

    // Into an empty archive there is nothing to ask about.
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await clickByText(page, '.ab-actions button', 'Clear the example');
    await new Promise(r => setTimeout(r, 300));
    const twoWeeks = path.join(os.tmpdir(), 'newsletter-two-week-backup.json');
    fs.writeFileSync(twoWeeks, JSON.stringify({ type: 'weekly-family-newsletter-archive', version: 1, weeks: [
      { week: 'Week 1 · September 8, 2026', sections: { learned: ['Reading: from my other laptop'] } },
      { week: 'Week 2 · September 14, 2026', sections: { learned: ['Math: place value'] } }
    ] }));
    [chooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 8000 }),
      clickByText(page, '.ab-actions button', 'Restore')
    ]);
    await chooser.accept([twoWeeks]);
    await new Promise(r => setTimeout(r, 600));
    eq('restoring into an empty archive just loads the file',
       await page.evaluate(() => loadArchive().length), 2);

    // And merging keeps what is already there.
    await typeOver(page, '[data-field="week"]', 'Week 3 · September 21, 2026');
    await new Promise(r => setTimeout(r, 900));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => { window.confirm = () => true; });
    [chooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 8000 }),
      clickByText(page, '.ab-actions button', 'Restore')
    ]);
    await chooser.accept([twoWeeks]);
    await new Promise(r => setTimeout(r, 600));
    const merged = await page.evaluate(() => loadArchive().map(w => w.week));
    check('and saying yes to "add them" keeps the week already saved here',
          merged.length === 3 && merged.some(w => /Week 3/.test(w)), merged.join(', '));
  }

  // =========================================================================
  group('The tool says what it needs instead of doing nothing');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await clickByText(page, '.ab-actions button', 'Clear the example');
    await new Promise(r => setTimeout(r, 300));
    await clickByText(page, '.ab-actions button', 'Create summary by subject');
    await new Promise(r => setTimeout(r, 300));
    check('Create summary with nothing saved says to add a week first',
          /Add at least one week to the archive first/.test(await toastText(page)),
          await toastText(page));
    check('and it does not open an empty summary',
          await page.$eval('#summaryModal', el => el.style.display) === 'none');

    // A Manage row for a week that is gone says so rather than deleting
    // somebody else's week or doing nothing at all.
    await typeOver(page, '[data-field="week"]', 'Week A');
    await new Promise(r => setTimeout(r, 900));
    await clickByText(page, '.ab-actions button', 'Add this week to archive');
    await clickByText(page, '.ab-actions button', 'Manage');
    await new Promise(r => setTimeout(r, 200));
    await page.evaluate(() => {
      localStorage.setItem('weekly-family-newsletter-archive', JSON.stringify([]));
      document.querySelector('.archive-list .row button').click();
    });
    await new Promise(r => setTimeout(r, 300));
    check('a Remove button for a week that is no longer there explains itself',
          /is not in the archive any more/.test(await toastText(page)), await toastText(page));
  }

  // =========================================================================
  group('When the picture-makers fail half way through');
  // =========================================================================
  await fresh(page);
  {
    const said = await page.evaluate(async () => {
      const real = window.html2canvas;
      window.html2canvas = () => Promise.reject(new Error('ran out of memory'));
      exportImage();
      await new Promise(r => setTimeout(r, 300));
      const one = [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ');
      exportPDF();
      await new Promise(r => setTimeout(r, 300));
      const two = [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ');
      window.html2canvas = real;
      return { one, two, prompts: getComputedStyle(document.querySelector('[data-field="caption"]'), '::before').content };
    });
    check('an image that cannot be made says so and points at the PDF',
          /image could not be made/.test(said.one), said.one);
    check('a PDF that cannot be made says so and points at Print',
          /PDF could not be made/.test(said.two), said.two);
    check('and the grey prompts come back on screen afterwards either way',
          /[a-z]/i.test(said.prompts), said.prompts);
  }

  // =========================================================================
  group('A very long newsletter spills onto a second page of the PDF');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => {
      const el = document.querySelector('[data-field="greeting"]');
      el.innerHTML = Array.from({ length: 40 },
        (_, i) => '<div>Line ' + (i + 1) + ' of a very full week.</div>').join('');
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 1200));
    // Read the PDF that would be saved and count the pages inside it. jsPDF
    // hands its file to its own bundled saver, so the way to see it is the
    // blob it makes on the way past.
    const made = await page.evaluate(async () => {
      const kept = [];
      const make = URL.createObjectURL.bind(URL);
      URL.createObjectURL = b => { const u = make(b); kept.push(u); return u; };
      URL.revokeObjectURL = () => {};
      exportPDF();
      for (let i = 0; i < 400 && !kept.length; i++) await new Promise(r => setTimeout(r, 100));
      if (!kept.length) return { pages: 0 };
      const txt = await (await fetch(kept[kept.length - 1])).text();
      return { pages: (txt.match(/\/Type\s*\/Page[^s]/g) || []).length, bytes: txt.length };
    });
    check('a newsletter too long for one page is carried onto more pages',
          made.pages > 1, JSON.stringify(made));
  }

  // =========================================================================
  group('A picture the computer cannot read, and a private window');
  // =========================================================================
  await fresh(page);
  {
    const locked = path.join(os.tmpdir(), 'newsletter-unreadable-photo.jpg');
    fs.copyFileSync(path.join(os.tmpdir(), 'newsletter-test-photo.jpg'), locked);
    fs.chmodSync(locked, 0o000);
    const [chooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 8000 }),
      page.click('.photo[data-slot="0"]')
    ]);
    await chooser.accept([locked]);
    await new Promise(r => setTimeout(r, 900));
    check('a picture the computer cannot open says so instead of nothing happening',
          /picture could not be read/.test(await toastText(page)), await toastText(page));
    fs.chmodSync(locked, 0o600);
    fs.unlinkSync(locked);
  }
  {
    // Safari's private window refuses to read storage at all, and reading used
    // to throw before the page had finished drawing itself.
    const before = pageErrors.length;
    const stub = await page.evaluateOnNewDocument(() => {
      Storage.prototype.getItem = function () { throw new DOMException('denied', 'SecurityError'); };
      Storage.prototype.setItem = function () { throw new DOMException('denied', 'SecurityError'); };
    });
    await harvest(page);
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    const st = await page.evaluate(() => ({
      warn: document.getElementById('saveWarn').textContent,
      shown: document.getElementById('saveWarn').style.display !== 'none',
      fields: document.querySelectorAll('#sheet [data-field]').length
    }));
    check('a private window is told plainly that saving will not work here',
          st.shown && /private window/.test(st.warn), JSON.stringify(st.warn));
    check('and the whole newsletter still works on screen there',
          st.fields > 5 && pageErrors.length === before, pageErrors.slice(before).join(' | '));
    await page.removeScriptToEvaluateOnNewDocument(stub.identifier);
  }

  // =========================================================================
  group('A saved draft whose pictures are not a list at all');
  // =========================================================================
  await fresh(page);
  {
    await page.evaluate(() => {
      clearTimeout(window.__save); window.__save = null;
      localStorage.setItem('weekly-family-newsletter', JSON.stringify({
        html: '<h1 class="title" data-field="title">MY REAL DRAFT</h1>',
        photos: 'data:image/png;base64,AAA'
      }));
    });
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    const st = await page.evaluate(() => ({
      title: (document.querySelector('[data-field="title"]') || {}).textContent || '',
      warn: document.getElementById('saveWarn').textContent,
      shown: document.getElementById('saveWarn').style.display !== 'none'
    }));
    check('the teacher\'s own words are back on screen', /MY REAL DRAFT/.test(st.title), st.title);
    check('and the note says the pictures are what went missing, not the words',
          st.shown && /pictures could not be read/.test(st.warn), st.warn);
  }

  // =========================================================================
  group('Start fresh asks first, and then really does clear the saved copy');
  // =========================================================================
  await fresh(page);
  {
    await typeOver(page, '[data-field="highlight"]', 'Work I would hate to lose.');
    await new Promise(r => setTimeout(r, 1200));
    const saved = await draftSize(page);
    await page.evaluate(() => { window.__confirms = []; window.__confirmAnswer = false; });
    await clickByText(page, '.toolbar button', 'Start fresh');
    await new Promise(r => setTimeout(r, 400));
    const asked = await page.evaluate(() => window.__confirms[0] || '');
    check('it asks first, and says the change cannot be undone',
          /cannot be undone/.test(asked) && /Download PDF or Print first/.test(asked), asked);
    check('and saying no leaves the newsletter exactly where it was',
          await draftSize(page) === saved && await page.$eval('[data-field="highlight"]',
            el => /Work I would hate to lose/.test(el.textContent)));

    // Now say yes, with the reload held back so the page Start fresh was
    // pressed on stays alive long enough to be looked at.
    holdReload = true;
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await clickByText(page, '.toolbar button', 'Start fresh');
    await new Promise(r => setTimeout(r, 800));
    const wiped = await page.evaluate(() => ({
      draft: localStorage.getItem('weekly-family-newsletter'),
      locked: window.__resetting === true,
      pending: window.__save
    }));
    check('saying yes clears the saved newsletter and stops anything writing it back',
          wiped.draft === null && wiped.locked && !wiped.pending, JSON.stringify(wiped));
    // The autosave that was still in flight must not undo it.
    await page.evaluate(() => autoSave());
    check('and a save still in flight cannot put it back',
          await page.evaluate(() => localStorage.getItem('weekly-family-newsletter')) === null);
    holdReload = false;
  }

  // =========================================================================
  group('If drawing the archive ever breaks, the teacher is told');
  // =========================================================================
  await fresh(page);
  {
    const said = await page.evaluate(() => {
      const real = window.renderCatchup;
      window.renderCatchup = () => { throw new Error('something in the archive'); };
      drawArchiveAndCatchup();
      window.renderCatchup = real;
      return { text: document.getElementById('archiveWarn').textContent,
               shown: document.getElementById('archiveWarn').style.display !== 'none' };
    });
    check('a Time travel that will not draw says so instead of going blank in silence',
          said.shown && /could not be read/.test(said.text) && /still being saved/.test(said.text),
          JSON.stringify(said));
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
