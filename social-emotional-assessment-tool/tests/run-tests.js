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
// There is no node_modules in this folder on purpose. puppeteer-core is
// borrowed from the running record tool by NODE_PATH; see package.json.
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
  } catch (e) { /* coverage not running yet */ }
}

// ---------------------------------------------------------------------------
// Helpers for driving the page
// ---------------------------------------------------------------------------
const frame = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));

// `load`, not `domcontentloaded`: a stylesheet or icon still in flight when the
// first assertion runs lands in the console-error list a fraction of the time,
// and a check that is right nine times out of ten teaches you to ignore red.
async function goFirstVisit(page, base){
  await harvest(page);
  await page.goto('about:blank');
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await harvest(page);
  await page.reload({ waitUntil: 'load' });
  await frame(page);
}
// A returning teacher: nothing on the sheet, but this laptop has used the tool
// before, so the sample child does not reappear over the top of them.
const EMPTY_RECORD = JSON.stringify({
  v: 1, scores: {}, comments: { strengths:'', stretches:'' },
  initials: '', date: '', sample: false, sampleCleared: true, sampleScoreKeys: []
});
async function goEmpty(page, base, record){
  await harvest(page);
  await page.goto('about:blank');
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(r => { localStorage.clear(); localStorage.setItem('seRecord', r); },
                      record || EMPTY_RECORD);
  await harvest(page);
  await page.reload({ waitUntil: 'load' });
  await frame(page);
}
// Start from whatever is already in localStorage, untouched.
async function goRaw(page, base, setup){
  await harvest(page);
  await page.goto('about:blank');
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.evaluate(setup);
  await harvest(page);
  await page.reload({ waitUntil: 'load' });
  await frame(page);
}
async function reload(page){
  await harvest(page);
  await page.reload({ waitUntil: 'load' });
  await frame(page);
}

// The E/D/M buttons for skill `i`. The list is rebuilt after every click, so
// the nodes must be found again each time or the click lands on a detached one.
async function score(page, skillIndex, band){
  const col = { e:0, d:1, m:2 }[band];
  const handles = await page.$$('.score-btn');
  await handles[skillIndex * 3 + col].click();
  await frame(page);
}
// Make skill `i` end up on `band`, the way a teacher would: press the button,
// and if it was already on that band the press takes it off, so press again.
// Both presses are the teacher's own act, which is the point of the sample
// tests below — a score they clicked is theirs even when Maya had the same one.
async function makeScore(page, skillIndex, band){
  const want = band.toUpperCase();
  if ((await board(page))[skillIndex] === want){
    await score(page, skillIndex, band);
  }
  await score(page, skillIndex, band);
}
async function clearOneScore(page, skillIndex){
  const handles = await page.$$('.undo-score');
  await handles[skillIndex].click();
  await frame(page);
}
async function typeIn(page, sel, text, replace){
  await page.click(sel);
  if (replace){
    await page.$eval(sel, el => el.select ? el.select() : null);
    await page.keyboard.press('Backspace');
  }
  await page.type(sel, text);
  await frame(page);
}
// Set a long value without typing it character by character, which takes
// minutes. Still a real input event, so the tool's own handler runs.
async function fill(page, sel, text){
  await page.$eval(sel, (el, t) => {
    el.value = t;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  await frame(page);
}
// Click something that is only on the page when the tool is behaving. If the
// bug being guarded against comes back, the button is hidden and puppeteer's
// click throws, which stops the run dead and hides every later check. This
// clicks when it can and lets the checks report the failure instead.
async function clickIfShown(page, sel){
  const shown = await page.$eval(sel, el =>
    !el.hidden && getComputedStyle(el).display !== 'none' &&
    getComputedStyle(el).visibility !== 'hidden').catch(() => false);
  if (!shown) return false;
  await page.click(sel);
  await frame(page);
  return true;
}
const tiles = page => page.evaluate(() => ({
  e: +document.getElementById('numEmerging').textContent,
  d: +document.getElementById('numDeveloping').textContent,
  m: +document.getElementById('numMastered').textContent,
  x: +document.getElementById('numNone').textContent
}));
// The six skill rows as the teacher sees them: which letter is lit, or '-'.
const board = page => page.evaluate(() =>
  [...document.querySelectorAll('.skill-item')].map(row => {
    const lit = row.querySelector('.score-btn.e, .score-btn.d, .score-btn.m');
    return lit ? lit.textContent.trim() : '-';
  }).join(''));
const message = page => page.$eval('#saymsg', el => el.textContent);
const record  = page => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('seRecord') || 'null'); }
  catch (e) { return 'UNPARSEABLE'; }
});
const undoBtn = page => page.evaluate(() => {
  const b = document.getElementById('undoBtn');
  return { hidden: b.hidden, label: b.textContent };
});

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
        lastCharInside
      };
    };
    const h = document.getElementById('printHeader');
    const bodyText = document.body.innerText;
    return {
      strengths: one('strengths'), stretches: one('stretches'),
      header: { text: h.textContent, display: getComputedStyle(h).display,
                position: getComputedStyle(h).position },
      initialsBox:  getComputedStyle(document.getElementById('initials')).display,
      dateBox:      getComputedStyle(document.getElementById('adate')).display,
      initialsPaper: document.getElementById('initialsPrint').textContent,
      datePaper:     document.getElementById('datePrint').textContent,
      // What the printer would actually put in each skill row.
      scoreWords: [...document.querySelectorAll('.score-print')].map(e => e.textContent),
      scoreButtonsShown: getComputedStyle(document.querySelector('.skill-buttons')).display,
      chartShown: getComputedStyle(document.getElementById('pieChart')).display,
      bodyText: bodyText
    };
  });
  await page.emulateMediaType(null);
  return out;
}

// Does the printed record fit on one sheet of Letter paper? The page box is
// 8.5in x 11in less the 14mm margins the stylesheet asks for, which is
// 710 x 950 CSS pixels at 96dpi. Chrome compresses its own PDF output, so
// counting "/Type /Page" in the bytes finds nothing; laying the page out at
// exactly the printable size and measuring where the content ends does not.
async function printedHeight(page){
  const before = page.viewport();
  await page.emulateMediaType('print');
  await page.setViewport({ width: 710, height: 950 });
  await frame(page);
  const bottom = await page.evaluate(() =>
    Math.round(document.querySelector('.container').getBoundingClientRect().bottom));
  await page.emulateMediaType(null);
  await page.setViewport(before);
  await frame(page);
  return bottom;
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
// aiming at a band would. Returns the panel title seen at each point, or ''.
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

// Every visible piece of text on the page, with the contrast ratio it is drawn
// at. A SWEEP, not a list of named controls: a check written against
// ".privacy and .chart-hint" goes on passing forever while a new colour is
// added underneath it.
const contrastSweep = page => page.evaluate(() => {
  const lum = rgb => {
    const v = rgb.map(c => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); });
    return 0.2126*v[0] + 0.7152*v[1] + 0.0722*v[2];
  };
  const parse = s => (s.match(/[\d.]+/g) || []).slice(0,4).map(Number);
  const opaqueBehind = el => {
    let n = el;
    while (n && n !== document.documentElement){
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) return c.slice(0,3);
      n = n.parentElement;
    }
    return [255,255,255];
  };
  const bad = [];
  document.querySelectorAll('*').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    // Only elements that draw text of their own.
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const fg = parse(cs.color).slice(0,3);
    const bg = opaqueBehind(el);
    const l1 = lum(fg), l2 = lum(bg);
    const ratio = (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
    const px = parseFloat(cs.fontSize);
    const bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
    // WCAG: 3:1 is enough only for 24px, or 18.66px bold.
    const needed = (px >= 24 || (bold && px >= 18.66)) ? 3 : 4.5;
    if (ratio < needed - 0.005){
      bad.push({ text: el.textContent.trim().slice(0, 34), px, bold,
                 ratio: +ratio.toFixed(2), needed });
    }
  });
  return bad;
});

// Everything a finger has to hit, on a screen driven by a finger.
const tapTargets = page => page.evaluate(() =>
  [...document.querySelectorAll('button, input, [role="button"]')]
    .filter(el => el.offsetParent !== null || el.tagName === 'path')
    .map(el => {
      const r = el.getBoundingClientRect();
      return { what: (el.id || el.className || el.tagName) + ' "' +
                     (el.textContent || '').trim().slice(0, 14) + '"',
               w: Math.round(r.width), h: Math.round(r.height) };
    })
    .filter(o => o.w > 0 && (o.w < 44 || o.h < 44)));

async function main(){
  if (!fs.existsSync(CHROME)){
    console.error(`${R}Google Chrome was not found at:${X}\n  ${CHROME}\n` +
                  `Install Chrome, or edit the CHROME path at the top of this file.`);
    process.exit(2);
  }

  const { srv, port } = await serve();
  const base = `http://127.0.0.1:${port}`;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', protocolTimeout: 120000,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  COVERAGE = process.argv.includes('--coverage');
  if (COVERAGE) await page.coverage.startJSCoverage({ resetOnNavigation: false });

  // The jsPDF CDN is blocked for the WHOLE run, on purpose. This suite must
  // pass on a plane and on a school network that blocks cdnjs, and the offline
  // path is one of the things that was broken. The happy path is exercised
  // against a stand-in library installed below.
  await page.setRequestInterception(true);
  const requested = [];
  page.on('request', req => {
    requested.push(req.url());
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
    window.__writes = [];
    window.print = () => { window.__printed++; };
    window.confirm = m => { window.__confirm = String(m); window.__confirms =
      (window.__confirms || []).concat([String(m)]);
      return window.__confirmAnswer !== false; };
    window.alert   = m => { window.__alert = String(m); };
    // Catch anchor-triggered CSV downloads instead of writing to disk.
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[download]');
      if (a){ e.preventDefault();
              window.__downloads.push({ name: a.getAttribute('download'),
                                        href: a.getAttribute('href') || '' }); }
    }, true);
    // A full disk and Safari's private window both make setItem throw. This
    // switch reproduces that without needing either. Every write is logged so
    // a save that is supposed to be one write can be shown to be one write.
    const realSet = Storage.prototype.setItem;
    const realGet = Storage.prototype.getItem;
    window.__blockStorage = false;
    Storage.prototype.setItem = function(k, v){
      window.__writes.push(k);
      if (window.__blockStorage || location.hash === '#nostorage')
        throw new Error('QuotaExceededError');
      return realSet.call(this, k, v);
    };
    // Some locked-down browsers refuse to READ localStorage too, and that
    // throws before the tool has drawn anything at all. The hash is the switch
    // because this has to be in force before the page's own init() runs.
    Storage.prototype.getItem = function(k){
      if (location.hash === '#nostorage') throw new Error('SecurityError');
      return realGet.call(this, k);
    };
  });

  // A stand-in for jsPDF, so the happy path can be driven with no internet.
  // It remembers which page each line was drawn on and where down the page it
  // landed, because "the exported record quietly lost a skill" was a line drawn
  // below the bottom edge of the paper, where the real library simply does not
  // put ink.
  const installFakePdf = () => page.evaluate(() => {
    window.__pdfLibBlocked = false;
    window.__pdfSaved = [];
    window.jspdf = { jsPDF: function(){
      const pages = [[]];
      let cur = 0;
      return {
        internal: { pageSize: { getHeight: () => 297, getWidth: () => 210 } },
        setFontSize(s){ this.__size = s; },
        addPage(){ pages.push([]); cur++; },
        // Wrap the way the real one does: roughly two millimetres per
        // character at the sizes this tool uses.
        splitTextToSize(t, w){
          const per = Math.max(10, Math.floor(w / 1.9));
          const out = [];
          String(t).split('\n').forEach(par => {
            let line = '';
            par.split(' ').forEach(word => {
              if ((line + ' ' + word).trim().length > per){ out.push(line.trim()); line = word; }
              else line += ' ' + word;
            });
            out.push(line.trim());
          });
          return out;
        },
        text(t, x, y){
          (Array.isArray(t) ? t : [t]).forEach(s => pages[cur].push({ s: String(s), y: y }));
        },
        save(name){
          const all = pages.reduce((a, p) => a.concat(p), []);
          window.__pdfSaved.push({
            name: name,
            pageCount: pages.length,
            text: all.map(o => o.s).join(' | '),
            maxY: all.length ? Math.max.apply(null, all.map(o => o.y)) : 0
          });
        }
      };
    }};
  });
  const lastPdf = () => page.evaluate(() => window.__pdfSaved[window.__pdfSaved.length - 1]);
  const lastCsv = () => page.evaluate(() => {
    const d = window.__downloads[window.__downloads.length - 1];
    return d ? { name: d.name, text: decodeURIComponent(d.href.split(',')[1] || '') } : null;
  });

  const TODAY = (() => {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate());
  })();

  // =========================================================================
  group('Arriving at the tool');
  // =========================================================================
  await goFirstVisit(page, base);

  check('the page opens with no JavaScript errors',
        pageErrors.length === 0, pageErrors.join(' | '));
  check('the page opens with no console errors',
        consoleErrors.length === 0, consoleErrors.join(' | '));

  {
    const first = await page.evaluate(() => ({
      initials: document.getElementById('initials').value,
      date: document.getElementById('adate').value,
      strengths: document.getElementById('strengths').value,
      stretches: document.getElementById('stretches').value,
      banner: document.getElementById('sampleBanner').classList.contains('on'),
      bannerText: document.getElementById('sampleBannerText').textContent
    }));
    check('a first visitor arrives on a filled-in sheet, not an empty one',
          first.initials === 'M.T.' && first.strengths.length > 40 &&
          first.stretches.length > 40, JSON.stringify(first).slice(0, 200));
    eq('the date is filled in with today, read from this laptop not from UTC',
       first.date, TODAY);
    check('the made-up child is named on screen as a sample',
          first.banner && /Sample student/.test(first.bannerText) &&
          /Maya Torres/.test(first.bannerText), first.bannerText);
    const t = await tiles(page);
    check('the sample child has a mixed profile, not the same score everywhere',
          t.e > 0 && t.d > 0 && t.m > 0, JSON.stringify(t));
    check('and every one of her six skills is scored', t.x === 0, JSON.stringify(t));
  }

  check('the chart has drawn before the visitor clicks anything',
        (await chart(page)).length === 3, JSON.stringify(await chart(page)));

  {
    const script = await page.$eval('script[src*="jspdf"]', el => ({
      defer: el.defer, async: el.async }));
    check('the optional PDF library cannot hold up the first paint of the page',
          script.defer || script.async, JSON.stringify(script));
    const drew = await page.evaluate(() => document.querySelectorAll('.score-btn').length);
    check('and the tool is fully drawn and usable with that library blocked',
          drew === 18, 'score buttons drawn: ' + drew);
  }

  check('a browser with JavaScript switched off is told why nothing works',
        (await page.evaluate(() => !!document.querySelector('noscript') &&
          /JavaScript/.test(document.querySelector('noscript').textContent))), '');

  // =========================================================================
  group('The chart  (was: it went blank when every skill matched)');
  // =========================================================================
  {
    await goEmpty(page, base);
    for (let i = 0; i < 6; i++) await score(page, i, 'm');
    const c = await chart(page);
    check('the chart still draws when every skill is the same level',
          c.length === 1 && c[0].w > 100 && c[0].len > 300, JSON.stringify(c));
    const seen = await ringClicks(page);
    check('and the one colour can still be clicked to see which skills are in it',
          seen.filter(t => /Mastered/.test(t)).length === 8, JSON.stringify(seen));
  }
  {
    await goEmpty(page, base);
    await score(page, 0, 'e');
    const c = await chart(page);
    check('one skill scored draws a real chart, not a sliver in a blank ring',
          c.length === 2 && c.every(s => s.w > 40), JSON.stringify(c));
    check('and the unscored skills are drawn in grey rather than left out',
          c.some(s => s.fill.toLowerCase() === '#5a544b'), JSON.stringify(c));
  }
  {
    await goEmpty(page, base);
    const c = await chart(page);
    check('an empty assessment still shows a whole grey ring',
          c.length === 1 && c[0].w > 100, JSON.stringify(c));
  }
  {
    // WHAT WAS WRONG: the wedges ran to the centre and a white circle was laid
    // on top, so the plain white hole was five invisible click targets and two
    // pixels of mouse movement over identical white space changed the answer.
    await goFirstVisit(page, base);
    const centre = await page.$eval('#pieChart', el => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width/2, y: r.y + r.height/2 };
    });
    const opened = [];
    for (const [dx, dy] of [[0,0],[-8,0],[8,0],[0,-8],[0,8]]){
      await page.mouse.click(centre.x + dx, centre.y + dy);
      const open = await page.$eval('#modal', el => el.style.display === 'block');
      opened.push(open);
      if (open) await page.click('.modal-footer .close-btn');
    }
    check('clicking the blank middle of the ring does not answer a question nobody asked',
          opened.every(o => o === false), JSON.stringify(opened));
  }
  {
    await goFirstVisit(page, base);
    await page.$eval('#pieChart path', el => el.focus());
    await page.keyboard.press('Enter');
    const open = await page.$eval('#modal', el => el.style.display === 'block');
    check('the chart can be opened from the keyboard, with no mouse at all', open);
    await page.keyboard.press('Escape');
  }

  // =========================================================================
  group('Taking a score back  (was: only Reset All could undo a mis-click)');
  // =========================================================================
  {
    await goEmpty(page, base);
    await score(page, 2, 'd');
    await score(page, 3, 'm');
    eq('two scores land where they were clicked', await board(page), '--DM--');
    await clearOneScore(page, 2);
    eq('a mis-clicked score can be cleared without wiping the assessment',
       await board(page), '---M--');
    await score(page, 3, 'm');
    eq('and pressing the same level twice takes it off too', await board(page), '------');
    const t = await tiles(page);
    eq('the counts follow', t, { e:0, d:0, m:0, x:6 });
  }
  {
    await goEmpty(page, base);
    await score(page, 0, 'e');
    const aria = await page.$$eval('.skill-item:first-child .score-btn',
      els => els.map(e => ({ label: e.getAttribute('aria-label'),
                             pressed: e.getAttribute('aria-pressed') })));
    check('a screen reader is told what E, D and M mean',
          aria.every(a => /Emerging|Developing|Mastered/.test(a.label || '')),
          JSON.stringify(aria));
    check('and which one is this child\'s score',
          aria[0].pressed === 'true' && aria[1].pressed === 'false',
          JSON.stringify(aria));
  }

  // =========================================================================
  group('The band list  (was: it opened behind the keyboard and went stale)');
  // =========================================================================
  {
    await goFirstVisit(page, base);
    await page.click('#countMastered');
    await frame(page);
    const opened = await page.evaluate(() => ({
      open: document.getElementById('modal').style.display === 'block',
      focus: document.activeElement.id,
      role: document.querySelector('.modal-content').getAttribute('role'),
      modal: document.querySelector('.modal-content').getAttribute('aria-modal'),
      rows: document.querySelectorAll('.modal-skill').length
    }));
    check('the keyboard moves into the panel when it opens',
          opened.focus === 'modalTitle', JSON.stringify(opened));
    check('and the panel says out loud that it is a dialog',
          opened.role === 'dialog' && opened.modal === 'true', JSON.stringify(opened));
    eq('two skills are listed under Mastered', opened.rows, 2);

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const stillInside = await page.evaluate(() =>
      document.querySelector('.modal-content').contains(document.activeElement));
    check('Tab stays inside the panel instead of walking the page underneath it',
          stillInside);

    await page.click('.modal-footer .close-btn');
    await frame(page);
    const back = await page.evaluate(() => document.activeElement.id);
    check('closing puts the keyboard back on the tile it came from',
          back === 'countMastered', back);
  }
  {
    // WHAT WAS WRONG: the panel was drawn once and left, so scoring a skill
    // underneath it left it listing a record the tool was no longer in.
    await goFirstVisit(page, base);
    await page.click('#countMastered');
    await frame(page);
    await page.keyboard.press('Escape');
    await score(page, 1, 'm');
    await page.click('#countMastered');
    await frame(page);
    const rows = await page.$$eval('.modal-skill', els => els.length);
    eq('the panel counts what is on the sheet now, not what was there before', rows, 3);
    await page.keyboard.press('Escape');
    // And with it open.
    await page.click('#countMastered');
    await frame(page);
    await page.keyboard.press('Escape');
    await score(page, 1, 'm');            // take it off again
    await page.click('#countMastered');
    await frame(page);
    eq('and it follows a score being taken off as well',
       await page.$$eval('.modal-skill', els => els.length), 2);
    await page.keyboard.press('Escape');
  }
  {
    await goEmpty(page, base);
    await page.click('#countMastered');
    await frame(page);
    const st = await page.evaluate(() => ({
      open: document.getElementById('modal').style.display === 'block',
      text: document.getElementById('modalSkills').textContent,
      say: document.getElementById('saymsg').textContent
    }));
    check('a tile that reads 0 opens a panel that says so, instead of looking dead',
          st.open && /No skills are marked Mastered/.test(st.text), JSON.stringify(st));
    check('and no leftover message is left sitting behind the open panel',
          st.say === '', st.say);
    await page.keyboard.press('Escape');
  }
  {
    // WHAT WAS WRONG: a mouse press inside the white box and a release outside
    // it makes Chrome dispatch the click to their common ancestor — the dark
    // backdrop — so dragging a selection across the skill list closed the panel
    // and threw the selection away.
    await goFirstVisit(page, base);
    await page.click('#countMastered');
    await frame(page);
    const row = await page.$eval('.modal-skill', el => {
      const r = el.getBoundingClientRect();
      return { x: r.x + 4, y: r.y + r.height/2 };
    });
    await page.mouse.move(row.x, row.y);
    await page.mouse.down();
    await page.mouse.move(row.x + 520, row.y + 60, { steps: 6 });
    await page.mouse.up();
    await frame(page);
    const stillOpen = await page.$eval('#modal', el => el.style.display === 'block');
    check('dragging a selection across the skill list does not close the panel',
          stillOpen);
    await page.mouse.click(60, 400);      // a real press and release on the backdrop
    await frame(page);
    check('but a click on the dark background still closes it',
          await page.$eval('#modal', el => el.style.display === 'none'));
  }

  // =========================================================================
  group('Nothing is lost on a refresh');
  // =========================================================================
  {
    await goEmpty(page, base);
    await score(page, 0, 'e');
    await score(page, 4, 'm');
    await typeIn(page, '#initials', 'R.K.');
    await reload(page);
    eq('the scores are still there after a reload', await board(page), 'E---M-');
    eq('and so are the initials',
       await page.$eval('#initials', el => el.value), 'R.K.');
  }
  {
    // WHAT WAS WRONG: on 'change' a comment was only stored when the box lost
    // focus, so ten minutes of notes went with a closed tab or a sleeping iPad.
    await goEmpty(page, base);
    await page.click('#strengths');
    await page.keyboard.type('Settles quickly after recess.');
    // No blur, no click elsewhere — straight to a reload.
    await reload(page);
    eq('a comment survives a reload without the teacher clicking away from the box',
       await page.$eval('#strengths', el => el.value), 'Settles quickly after recess.');
  }
  {
    await goEmpty(page, base);
    await fill(page, '#adate', '2026-05-04');
    await typeIn(page, '#initials', 'J.M.');
    await reload(page);
    eq('an assessment recorded for another day does not come back dated today',
       await page.$eval('#adate', el => el.value), '2026-05-04');
  }
  {
    // WHAT WAS WRONG: one Backspace in the date box makes its value '' and that
    // empty string went straight over the saved date with nothing said, so the
    // sheet came back dated today and the exports agreed with the wrong date.
    await goEmpty(page, base);
    await fill(page, '#adate', '2026-05-04');
    await typeIn(page, '#initials', 'J.M.');
    await fill(page, '#adate', '');
    const said = await message(page);
    check('emptying the date box says so instead of quietly becoming today',
          /date box is empty/.test(said) && /2026-05-04/.test(said), said);
    await reload(page);
    eq('and the box really is still empty after a reload — not silently today',
       await page.$eval('#adate', el => el.value), '');
    await page.click('button[onclick="exportCSV()"]');
    await frame(page);
    const csv = await lastCsv();
    check('a sheet with no date says "no date" in the file and in its name, in both places',
          /no date/.test(csv.text) && /no-date/.test(csv.name),
          csv.name + ' :: ' + csv.text.split('\r\n')[1]);
  }

  // =========================================================================
  group('When the browser refuses to save');
  // =========================================================================
  {
    await goEmpty(page, base);
    await page.evaluate(() => { window.__blockStorage = true; });
    await score(page, 1, 'd');
    const warned = await message(page);
    check('a browser that refuses to store the assessment says so, loudly',
          /NOT BEING SAVED/.test(warned), warned);
    check('and the warning is styled as a warning, not as a friendly note',
          await page.$eval('#saymsg', el => el.classList.contains('warn')));

    // WHAT WAS WRONG: the warning told the teacher to export, and exporting
    // replaced it with the word "Saved", which then faded to an empty bar.
    await page.click('button[onclick="exportCSV()"]');
    await frame(page);
    const after = await message(page);
    check('exporting does not erase the warning it just told the teacher to act on',
          /NOT being saved|NOT BEING SAVED/.test(after), after);

    // WHAT WAS WRONG: once shown, the warning never came down again, even after
    // the disk was freed and saving really was working.
    await page.evaluate(() => { window.__blockStorage = false; });
    await score(page, 2, 'm');
    const recovered = await message(page);
    check('and when saving starts working again the tool stops insisting it is not',
          /Saving is working again/.test(recovered), recovered);
  }
  {
    // WHAT WAS WRONG: the sheet was six separate keys inside one try/catch, so a
    // browser that started refusing part way through kept this child's scores
    // beside the last child's initials and comments, and reopened the mixture.
    await goEmpty(page, base);
    await page.evaluate(() => { window.__writes = []; });
    await score(page, 0, 'e');
    const writes = await page.evaluate(() => window.__writes.slice());
    eq('saving the sheet is one single write, so it can never land half-done',
       writes, ['seRecord']);
  }

  // =========================================================================
  group('Saved data that cannot be trusted');
  // =========================================================================
  {
    await goRaw(page, base, () => {
      localStorage.clear();
      localStorage.setItem('seRecord', '{"scores":{"0":"m"');   // half-written
    });
    const said = await message(page);
    check('a half-written saved record is announced, not swallowed',
          /could not be read/.test(said), said);
    const kept = await page.evaluate(() => localStorage.getItem('seUnreadable'));
    check('and the unreadable copy is kept aside rather than written over',
          kept === '{"scores":{"0":"m"', String(kept));
    check('the tool still works — every score button is on the page',
          (await page.$$('.score-btn')).length === 18);
  }
  {
    await goRaw(page, base, () => {
      localStorage.clear();
      localStorage.setItem('seRecord', '[1,2,3]');   // valid JSON, wrong shape
    });
    check('saved data of the wrong shape gets the same plain warning',
          /could not be read/.test(await message(page)), await message(page));
  }
  {
    await goRaw(page, base, () => {
      localStorage.clear();
      localStorage.setItem('seRecord', JSON.stringify({
        v:1, scores:{0:'m'}, comments:{ strengths:{}, stretches:['x'] },
        initials:'J.M.', date:'2026-03-04', sample:false }));
    });
    const boxes = await page.evaluate(() => ({
      s: document.getElementById('strengths').value,
      t: document.getElementById('stretches').value
    }));
    check('a saved comment that is not text never prints as "[object Object]"',
          boxes.s === '' && boxes.t === '', JSON.stringify(boxes));
  }
  {
    await goRaw(page, base, () => {
      localStorage.clear();
      localStorage.setItem('seRecord', JSON.stringify({
        v:1, scores:{}, comments:{strengths:'',stretches:''},
        initials:'Marcus Webb', date:'2026-03-04', sample:false }));
    });
    eq('a saved value longer than the box allows is cut back to four characters',
       await page.$eval('#initials', el => el.value), 'Marc');
  }
  {
    // WHAT WAS WRONG: an unrecognised value counted as "Not yet scored" on the
    // tile, in the chart, in the CSV and in the PDF — but was left out of the
    // list you got by clicking that tile. The number and the click disagreed.
    await goRaw(page, base, () => {
      localStorage.clear();
      localStorage.setItem('seRecord', JSON.stringify({
        v:1, scores:{0:'z', 1:7, 3:'m'}, comments:{strengths:'',stretches:''},
        initials:'J.M.', date:'2026-03-04', sample:false }));
    });
    const t = await tiles(page);
    eq('a saved score the tool does not recognise is not counted as a score',
       t, { e:0, d:0, m:1, x:5 });
    await page.click('#countNone');
    await frame(page);
    eq('and clicking the tile lists exactly the number the tile says',
       await page.$$eval('.modal-skill', els => els.length), 5);
    await page.keyboard.press('Escape');
  }
  {
    // WHAT WAS WRONG: the "this is the sample" flag was believed without ever
    // being checked against what actually came back, so a real child could
    // reappear labelled, exported and filed as Maya Torres.
    await goRaw(page, base, () => {
      localStorage.clear();
      localStorage.setItem('seRecord', JSON.stringify({
        v:1, scores:{0:'e', 2:'d'},
        comments:{ strengths:'J.M. asks for help now.', stretches:'Turn taking.' },
        initials:'J.M.', date:'2026-03-04', sample:true,
        sampleScoreKeys:['0','1','2','3','4','5'] }));
    });
    const st = await page.evaluate(() => ({
      banner: document.getElementById('sampleBanner').classList.contains('on'),
      ini: document.getElementById('initials').value,
      stem: fileStem()
    }));
    check('a real child does not come back labelled Maya Torres because of a stale flag',
          !st.banner && st.ini === 'J.M.' && /J-?M/i.test(st.stem.replace('.', '')),
          JSON.stringify(st));
  }
  {
    // WHAT WAS WRONG: the "has this been opened before" flag going missing was
    // enough for the sample to be loaded over a saved assessment and written
    // straight to disk, with no undo available.
    await goRaw(page, base, () => {
      localStorage.clear();
      localStorage.setItem('seRecord', JSON.stringify({
        v:1, scores:{1:'e'}, comments:{ strengths:'Real notes about J.M.', stretches:'' },
        initials:'J.M.', date:'2026-03-04', sample:false }));
    });
    const st = await page.evaluate(() => ({
      ini: document.getElementById('initials').value,
      s: document.getElementById('strengths').value
    }));
    check('the sample is never loaded over an assessment already on this laptop',
          st.ini === 'J.M.' && /Real notes/.test(st.s), JSON.stringify(st));
  }

  // =========================================================================
  group('Two tabs of the same tool  (was: the older one silently won)');
  // =========================================================================
  {
    await goEmpty(page, base);
    await typeIn(page, '#initials', 'A.B.');

    const tabB = await browser.newPage();
    await tabB.setViewport({ width: 1280, height: 900 });
    // The second tab needs the CDN blocked too, or `load` waits on a request
    // that never answers and the whole run stalls.
    await tabB.setRequestInterception(true);
    tabB.on('request', req => {
      if (/cdnjs|jspdf/i.test(req.url())) req.abort(); else req.continue();
    });
    await tabB.goto(base + '/index.html', { waitUntil: 'load' });
    await tabB.$eval('#initials', el => {
      el.value = 'R.K.'; el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await tabB.$eval('#strengths', el => {
      el.value = 'Forty minutes of notes on R.K. written up after school.';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 300));

    // The older tab now types one character, exactly as a teacher who left it
    // open would. bringToFront first: a background tab gets no animation
    // frames, and puppeteer's own click waits for one, so without this the
    // whole run stops here rather than failing.
    await page.bringToFront();
    await page.click('#strengths');
    await page.keyboard.type('x');
    await new Promise(r => setTimeout(r, 200));

    const onDisk = await tabB.evaluate(() => JSON.parse(localStorage.getItem('seRecord')));
    check('a second tab\'s saved assessment is not written over by the older tab',
          onDisk.initials === 'R.K.' && /Forty minutes/.test(onDisk.comments.strengths),
          JSON.stringify(onDisk).slice(0, 180));
    check('and the older tab says plainly that it has stopped saving',
          /another tab/.test(await message(page)), await message(page));
    await tabB.close();
    await page.bringToFront();
  }

  // =========================================================================
  group('Clearing, and getting it back');
  // =========================================================================
  {
    await goEmpty(page, base);
    await typeIn(page, '#initials', 'A.B.');
    await score(page, 0, 'e');
    await fill(page, '#strengths', 'A.B. shares readily.');

    await page.evaluate(() => { window.__confirmAnswer = false; window.__confirm = ''; });
    await page.click('button[onclick="resetAll()"]');
    await frame(page);
    const asked = await page.evaluate(() => window.__confirm);
    check('Reset All asks before it throws an assessment away', /Clear this assessment/.test(asked), asked);
    eq('and saying no really does keep everything', await board(page), 'E-----');

    await page.evaluate(() => { window.__confirmAnswer = true; });
    await page.click('button[onclick="resetAll()"]');
    await frame(page);
    eq('saying yes empties the sheet', await board(page), '------');
    const btn = await undoBtn(page);
    check('and the way back is offered, named for what it puts back',
          !btn.hidden && /Undo the clear/.test(btn.label), JSON.stringify(btn));
    check('the message tells the teacher which button to press',
          /Undo the clear/.test(await message(page)), await message(page));

    // WHAT WAS WRONG: the way back lived only in a variable while storage had
    // already been emptied, so a refresh — the very thing somebody does when a
    // page looks wrong — left nothing behind the promise.
    await reload(page);
    const after = await undoBtn(page);
    check('the way back survives a refresh', !after.hidden, JSON.stringify(after));
    await clickIfShown(page, '#undoBtn');
    eq('and it really does bring the assessment back', await board(page), 'E-----');
    eq('with the initials', await page.$eval('#initials', el => el.value), 'A.B.');
    eq('and the comment', await page.$eval('#strengths', el => el.value), 'A.B. shares readily.');
  }
  {
    // THE BLOCKER: the Undo button and its snapshot were never retired. After a
    // Reset All the button stayed on screen for the rest of the session, with
    // the message beside it still telling the teacher to press it — so pressing
    // it part way through the NEXT child silently replaced that child, forever.
    await goEmpty(page, base);
    await typeIn(page, '#initials', 'A.B.');
    await score(page, 0, 'e');
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await page.click('button[onclick="resetAll()"]');
    await frame(page);

    // A whole new child is now assessed.
    await typeIn(page, '#initials', 'R.T.');
    await fill(page, '#strengths', 'R.T. — forty minutes of real notes.');
    for (let i = 0; i < 6; i++) await score(page, i, 'd');

    await page.evaluate(() => { window.__confirmAnswer = false; window.__confirm = ''; });
    await clickIfShown(page, '#undoBtn');
    const asked = await page.evaluate(() => window.__confirm);
    check('Undo asks first when there is new work on the page to replace',
          /Put the earlier assessment back/.test(asked), asked);
    eq('and saying no leaves the new child exactly where they were',
       await board(page), 'DDDDDD');

    await page.evaluate(() => { window.__confirmAnswer = true; });
    await clickIfShown(page, '#undoBtn');
    eq('saying yes brings the earlier child back', await board(page), 'E-----');
    const btn = await undoBtn(page);
    check('and the child that was just replaced is itself offered back',
          !btn.hidden && /put back what was on screen/i.test(btn.label), JSON.stringify(btn));
    await clickIfShown(page, '#undoBtn');
    eq('one more press returns the page that was replaced', await board(page), 'DDDDDD');
    eq('with its own notes intact',
       await page.$eval('#strengths', el => el.value), 'R.T. — forty minutes of real notes.');
  }
  {
    await goEmpty(page, base);
    await typeIn(page, '#initials', 'A.B.');
    await page.evaluate(() => { window.__confirmAnswer = true; });
    await page.click('button[onclick="resetAll()"]');
    await frame(page);
    await page.evaluate(() => { window.__confirm = ''; });
    await page.click('button[onclick="resetAll()"]');
    await frame(page);
    check('Reset on an already-empty sheet asks nothing and destroys nothing',
          (await page.evaluate(() => window.__confirm)) === '' &&
          /nothing to clear/.test(await message(page)), await message(page));
    await clickIfShown(page, '#undoBtn');
    eq('so the way back still holds the real assessment, not the emptiness',
       await page.$eval('#initials', el => el.value), 'A.B.');
  }
  {
    // WHAT WAS WRONG: resetAll() skipped the snapshot whenever the sample
    // banner was up — but the banner stays up while a teacher types a full real
    // assessment over Maya, so Reset All destroyed real work with no snapshot
    // anywhere, and the undo it advertised restored a different, older child.
    await goEmpty(page, base);
    await typeIn(page, '#initials', 'A.A.');
    await fill(page, '#strengths', 'CHILD ONE notes.');
    await score(page, 1, 'e');

    await page.evaluate(() => { window.__confirmAnswer = true; });
    await page.click('#sampleBtn');
    await frame(page);
    check('loading the sample over real work asks first',
          /Load the sample child/.test(await page.evaluate(() => window.__confirm)), '');

    // Now a whole real assessment is typed on top of Maya, without touching
    // the Child box — which is exactly what leaves the banner up.
    await fill(page, '#strengths', 'CHILD TWO — a full page of real notes written after school.');
    await fill(page, '#stretches', 'CHILD TWO stretches.');
    for (let i = 0; i < 6; i++) await makeScore(page, i, 'm');

    await page.click('button[onclick="resetAll()"]');
    await frame(page);
    await clickIfShown(page, '#undoBtn');
    const backTo = await page.$eval('#strengths', el => el.value);
    check('Reset All snapshots the assessment that is really on screen',
          /CHILD TWO/.test(backTo), backTo.slice(0, 80));
  }
  {
    // WHAT WAS WRONG: "Clear the sample" wiped the teacher's own scores and
    // notes with no question and no undo, and wrote the empty sheet to the
    // laptop immediately — while the first-visit message pointed them at it.
    await goFirstVisit(page, base);
    const own = ['e','e','d','e','d','e'];   // different from Maya on every row
    for (let i = 0; i < 6; i++) await makeScore(page, i, own[i]);
    await fill(page, '#strengths', 'Ravi settles quickly after recess.');
    await page.evaluate(() => { window.__confirmAnswer = false; window.__confirm = ''; });
    await page.click('#clearSampleBtn');
    await frame(page);
    const asked = await page.evaluate(() => window.__confirm);
    check('Clear the sample asks first once the teacher has typed over it',
          /Clear the sample student/.test(asked), asked);
    eq('and saying no keeps their work', await board(page), 'EEDEDE');

    await page.evaluate(() => { window.__confirmAnswer = true; });
    await page.click('#clearSampleBtn');
    await frame(page);
    eq('saying yes empties the sheet', await board(page), '------');
    const btn = await undoBtn(page);
    check('and their own work is one press away, not gone',
          !btn.hidden && /put my assessment back/i.test(btn.label), JSON.stringify(btn));
    await clickIfShown(page, '#undoBtn');
    eq('which really does bring it back', await board(page), 'EEDEDE');
    eq('with the note they typed',
       await page.$eval('#strengths', el => el.value), 'Ravi settles quickly after recess.');
  }
  {
    // Clearing Maya while she is still untouched costs nobody anything — and
    // must not be what finally destroys an assessment she was loaded over.
    await goEmpty(page, base);
    await typeIn(page, '#initials', 'A.B.');
    await score(page, 0, 'e');
    await page.evaluate(() => { window.__confirmAnswer = true; window.__confirm = ''; });
    await page.click('#sampleBtn');
    await frame(page);
    await page.evaluate(() => { window.__confirm = ''; });
    await page.click('#clearSampleBtn');
    await frame(page);
    check('clearing an untouched sample asks nothing — there is nothing of yours in it',
          (await page.evaluate(() => window.__confirm)) === '', '');
    check('and it names the assessment still waiting underneath',
          /one press of/.test(await message(page)), await message(page));
    await clickIfShown(page, '#undoBtn');
    eq('which comes back whole', await page.$eval('#initials', el => el.value), 'A.B.');
  }

  // =========================================================================
  group('The sample child  (was: typing your initials deleted your scores)');
  // =========================================================================
  {
    // THE BLOCKER: takeOverFromSample() decided what was Maya's by comparing
    // letters, so every score the teacher had clicked that happened to match
    // hers was deleted — while the message said "What you filled in yourself is
    // still here." No undo, and it survived a reload.
    await goFirstVisit(page, base);
    // The teacher's own six judgements, four of which coincide with Maya's.
    const mine = ['m','d','m','e','m','d'];   // four of the six match Maya's letter
    for (let i = 0; i < 6; i++) await makeScore(page, i, mine[i]);
    await fill(page, '#strengths', 'Ravi joins group work without being asked.');
    eq('the teacher\'s six scores are on the board', await board(page), 'MDMEMD');
    await typeIn(page, '#initials', 'R.P.', true);
    eq('typing your own initials over the sample deletes none of them',
       await board(page), 'MDMEMD');
    await reload(page);
    eq('and they are all still there after a reload', await board(page), 'MDMEMD');
    eq('with the note', await page.$eval('#strengths', el => el.value),
       'Ravi joins group work without being asked.');
  }
  {
    // The toggle-off-and-on case: an explicit act of the teacher's judgement
    // that happens to end on the same letter Maya arrived with.
    await goFirstVisit(page, base);
    await score(page, 5, 'd');       // off — it was Maya's D
    await score(page, 5, 'd');       // on again, this time the teacher's own
    await score(page, 2, 'm');
    await typeIn(page, '#initials', 'T.W.', true);
    const b = await board(page);
    check('a score the teacher clicked is theirs even when Maya had the same letter',
          b[5] === 'D' && b[2] === 'M', b);
  }
  {
    // WHAT WAS WRONG: a real child whose initials genuinely are M.T. was
    // exported, printed and filed as "Sample student — Maya Torres" forever,
    // because the only escape from sample mode ran through the Child box.
    //
    // WHAT THIS CHECK ITSELF USED TO GET WRONG, AND IT HID THE OTHER HALF OF
    // THE BUG FOR A WHOLE RELEASE: it scored all SIX rows before looking. The
    // sixth score takes the last of Maya off the sheet, which ends sample mode
    // altogether — so the check only ever saw the state after the danger had
    // passed, and it went on passing while a teacher part-way through the same
    // child's assessment was still being filed as Maya Torres. Five rows is the
    // moment that matters: one of Maya's scores is still on the page, the
    // example label is still up, and the letters in the Child box read M.T.
    // because that is this child's name. The sixth row is scored afterwards, so
    // both moments are checked instead of only the safe one.
    await goFirstVisit(page, base);
    for (let i = 0; i < 5; i++) await makeScore(page, i, 'e');   // row 5 is still Maya's
    await fill(page, '#strengths', 'M.T. is settling in well this term.');
    await fill(page, '#stretches', 'Needs a reminder to pack away.');

    const five = await page.evaluate(() => ({
      banner: document.getElementById('sampleBanner').classList.contains('on'),
      txt: document.getElementById('sampleBannerText').textContent,
      stem: fileStem(), who: whoLine(),
      ini: document.getElementById('initials').value
    }));
    check('a real child whose initials are M.T. is not filed as Maya Torres part-way through',
          five.ini === 'M.T.' && five.stem === 'part-sample-social-emotional-MT-' + TODAY &&
          !/^sample-maya-torres/.test(five.stem) && five.who === 'Child: M.T. — part sample',
          JSON.stringify(five));
    check('and the banner names the one score of hers that is left, not the whole sheet',
          five.banner && /Part sample/.test(five.txt) && /one of her scores/.test(five.txt),
          five.txt);

    await installFakePdf();
    await page.click('button[onclick="exportPDF()"]');
    await frame(page);
    const mtPdf = await lastPdf();
    check('that child\'s PDF is not named after the sample',
          mtPdf.name === 'part-sample-social-emotional-MT-' + TODAY + '.pdf' &&
          !/^sample-maya-torres/.test(mtPdf.name) &&
          /Child: M\.T\./.test(mtPdf.text) &&
          /Part sample/.test(mtPdf.text) && /one of her scores/.test(mtPdf.text),
          mtPdf.name + ' | ' + mtPdf.text.slice(0, 220));

    await page.click('button[onclick="exportCSV()"]');
    await frame(page);
    const mtCsv = await lastCsv();
    const mtRows = mtCsv.text.split('\r\n').slice(1);
    check('and every spreadsheet row says M.T., not "Sample student — Maya Torres"',
          mtCsv.name === 'part-sample-social-emotional-MT-' + TODAY + '.csv' &&
          mtRows.length === 6 &&
          mtRows.every(r => /^"M\.T\. — part sample/.test(r)) &&
          !mtRows.some(r => /^"Sample student/.test(r)),
          mtCsv.name + ' | ' + mtRows[0].slice(0, 110));

    const mtPaper = await paper(page);
    check('and the printed header does not call that child\'s sheet "not a real child"',
          /Child: M\.T\./.test(mtPaper.header.text) &&
          !/not a real child/.test(mtPaper.header.text) &&
          /one of her scores/.test(mtPaper.header.text),
          mtPaper.header.text);

    // Now the sixth row, which is where this check used to start.
    await makeScore(page, 5, 'e');
    const st = await page.evaluate(() => ({
      banner: document.getElementById('sampleBanner').classList.contains('on'),
      stem: fileStem(),
      ini: document.getElementById('initials').value
    }));
    check('a real child whose initials are M.T. is not filed as Maya Torres',
          !st.banner && st.ini === 'M.T.' && /MT/.test(st.stem) && !/sample/.test(st.stem),
          JSON.stringify(st));
    check('and the tool says out loud that the example label has come off',
          /Nothing of the sample is left/.test(await message(page)), await message(page));
  }
  {
    // WHAT WAS WRONG: emptying the sample by hand — clearing all six scores and
    // both comment boxes — instead of pressing "Clear the sample" took the
    // example label off and said "This is your own assessment now" while M.T.
    // was still sitting in the Child box, put there by the sample and typed by
    // nobody. The next export was named social-emotional-MT-<date> and every
    // spreadsheet row said M.T., so a real child was filed under the made-up
    // one's initials with nothing on screen saying where those letters came
    // from. Nothing is deleted — for some children M.T. is right — but it is
    // said out loud, on the page, and it survives a reload.
    await goFirstVisit(page, base);
    for (let i = 0; i < 6; i++) await clearOneScore(page, i);
    await fill(page, '#strengths', '');
    await fill(page, '#stretches', '');

    const left = await page.evaluate(() => ({
      banner: document.getElementById('sampleBanner').classList.contains('on'),
      ini: document.getElementById('initials').value,
      noteShown: !document.getElementById('sampleInitialsNote').hidden &&
                 getComputedStyle(document.getElementById('sampleInitialsNote')).display !== 'none',
      noteTxt: document.getElementById('sampleInitialsNote').textContent
    }));
    check('emptying the sample by hand does not leave M.T. in the Child box unremarked',
          !left.banner && left.ini === 'M.T.' && left.noteShown &&
          /came from the sample/.test(left.noteTxt), JSON.stringify(left).slice(0, 300));
    check('and the message that takes the label off says so too',
          /still says M\.T\./.test(await message(page)), await message(page));

    await reload(page);
    const after = await page.evaluate(() => ({
      noteShown: !document.getElementById('sampleInitialsNote').hidden,
      ini: document.getElementById('initials').value, stem: fileStem()
    }));
    check('and the note is still there after a reload, when the export happens',
          after.noteShown && after.ini === 'M.T.' &&
          after.stem === 'social-emotional-MT-' + TODAY, JSON.stringify(after));

    // The box is full — four characters in a four-character box — so clicking
    // into it has to select what is there or typing over it does nothing.
    await page.$eval('#strengths', el => el.focus());
    await page.$eval('#initials', el => el.focus());
    const sel = await page.$eval('#initials', el => el.selectionEnd - el.selectionStart);
    check('clicking into the leftover initials selects them, so they can be typed over',
          sel === 4, 'selected ' + sel + ' characters');

    await typeIn(page, '#initials', 'B.N.', true);
    const typed = await page.evaluate(() => ({
      noteShown: !document.getElementById('sampleInitialsNote').hidden,
      stem: fileStem()
    }));
    check('typing this child\'s own initials puts the note away',
          !typed.noteShown && typed.stem === 'social-emotional-BN-' + TODAY,
          JSON.stringify(typed));

    // And the one-press way out, for the teacher who says "no, that was hers".
    await goFirstVisit(page, base);
    for (let i = 0; i < 6; i++) await clearOneScore(page, i);
    await fill(page, '#strengths', '');
    await fill(page, '#stretches', '');
    await makeScore(page, 0, 'm');                  // this child's first real score
    await page.click('#dropSampleInitialsBtn');
    await frame(page);
    const dropped = await page.evaluate(() => ({
      noteShown: !document.getElementById('sampleInitialsNote').hidden,
      ini: document.getElementById('initials').value,
      board: [...document.querySelectorAll('.skill-item')].map(row => {
        const lit = row.querySelector('.score-btn.e, .score-btn.d, .score-btn.m');
        return lit ? lit.textContent.trim() : '-';
      }).join('')
    }));
    check('"Empty the Child box" empties the initials and nothing else',
          !dropped.noteShown && dropped.ini === '' && dropped.board === 'M-----',
          JSON.stringify(dropped));

    // A child whose initials the TEACHER typed as M.T. is not nagged about it.
    await goEmpty(page, base);
    await typeIn(page, '#initials', 'M.T.', true);
    await makeScore(page, 0, 'd');
    const own = await page.evaluate(() => ({
      noteShown: !document.getElementById('sampleInitialsNote').hidden,
      stem: fileStem(), who: whoLine()
    }));
    check('a child whose initials the teacher typed as M.T. gets no such note',
          !own.noteShown && own.who === 'Child: M.T.' &&
          /^social-emotional-MT-/.test(own.stem), JSON.stringify(own));
  }
  {
    // Half and half: some of Maya still there, some of the teacher's own work.
    // The banner has to say which, so a mixed sheet is never exported as though
    // all of it were invented.
    await goFirstVisit(page, base);
    await score(page, 0, 'e');
    await fill(page, '#strengths', 'My own note about this child.');
    const txt = await page.$eval('#sampleBannerText', el => el.textContent);
    check('a half-and-half sheet says which parts are still the sample',
          /Part sample/.test(txt) && /of her scores/.test(txt) &&
          /her stretches note/.test(txt), txt);
  }
  {
    // WHAT WAS WRONG, and it needed no old saved data to reach: a teacher who
    // scored four of the six rows themselves, wrote both comment boxes and typed
    // K.P. over M.T. still had two of Maya's scores on the sheet — so the sheet
    // was still "the sample", whole and entire, to everything that files it. The
    // PDF and the spreadsheet were both named sample-maya-torres-…, every row of
    // the spreadsheet said the child was "Sample student — Maya Torres (M.T.)",
    // the printed header said the same, and K.P. appeared in neither filename.
    // A real child's initials were thrown away because two rows of made-up data
    // were left on the page.
    await goFirstVisit(page, base);
    await makeScore(page, 0, 'e');
    await makeScore(page, 1, 'm');
    await makeScore(page, 2, 'd');
    await makeScore(page, 3, 'm');            // the same letter Maya had, pressed
                                              // off and on again — the teacher's own
                                              // judgement, not hers
                                              // rows 4 and 5 are still Maya's
    await fill(page, '#strengths', 'K.P. settles quickly after lunch and helps tidy.');
    await fill(page, '#stretches', 'Needs a reminder to ask before leaving the table.');
    await typeIn(page, '#initials', 'K.P.', true);

    const txt = await page.$eval('#sampleBannerText', el => el.textContent);
    check('the banner still says which two scores are the sample\'s',
          /Part sample/.test(txt) && /2 of her scores/.test(txt), txt);

    await installFakePdf();
    await page.click('button[onclick="exportPDF()"]');
    await frame(page);
    const pdf = await lastPdf();
    check('a half-taken-over sheet is filed under the real child, not under Maya',
          /^part-sample-social-emotional-KP-/.test(pdf.name) &&
          !/^sample-maya-torres/.test(pdf.name), pdf.name);
    check('and the PDF names that child inside it as well',
          /Child: K\.P\./.test(pdf.text), pdf.text.slice(0, 200));
    check('and still says on the page which parts of it are made up',
          /Part sample/.test(pdf.text) && /Maya Torres/.test(pdf.text) &&
          /2 of her scores/.test(pdf.text), pdf.text.slice(0, 260));

    await page.click('button[onclick="exportCSV()"]');
    await frame(page);
    const csv = await lastCsv();
    check('the spreadsheet is named for the real child too',
          /^part-sample-social-emotional-KP-/.test(csv.name), csv.name);
    const rows = csv.text.split('\r\n').slice(1);
    check('every spreadsheet row names that child and says part of it is the sample',
          rows.length === 6 &&
          rows.every(r => /^"K\.P\. — part sample/.test(r)) &&
          rows.every(r => /Maya Torres/.test(r)),
          rows[0].slice(0, 110));

    const p = await paper(page);
    check('the printed header says the child\'s own initials, not Maya\'s',
          /Child: K\.P\./.test(p.header.text) &&
          !/Sample student — Maya Torres \(M\.T\.\), not a real child/.test(p.header.text),
          p.header.text);
    check('and the printed header still warns that two scores are the sample\'s',
          /part sample/i.test(p.header.text) && /2 of her scores/.test(p.header.text),
          p.header.text);
    const h = await printedHeight(page);
    check('a half-taken-over sheet still fits on one piece of paper',
          h <= 950, 'content ends at ' + h + 'px of the 950px printable height');

    await reload(page);
    const back = await page.evaluate(() => ({
      banner: document.getElementById('sampleBanner').classList.contains('on'),
      txt: document.getElementById('sampleBannerText').textContent,
      stem: fileStem(), ini: document.getElementById('initials').value
    }));
    check('and a reload brings back the same half-and-half sheet, filed the same way',
          back.banner && back.ini === 'K.P.' && /2 of her scores/.test(back.txt) &&
          /^part-sample-social-emotional-KP-/.test(back.stem), JSON.stringify(back));

    // Finishing the job takes the example label off altogether, and then the
    // filename is the plain one — no "part sample" left on a sheet with none.
    await makeScore(page, 4, 'm');
    await makeScore(page, 5, 'e');
    const done = await page.evaluate(() => ({
      banner: document.getElementById('sampleBanner').classList.contains('on'),
      stem: fileStem(), who: whoLine()
    }));
    check('scoring the last two rows takes the example label off for good',
          !done.banner && done.stem === 'social-emotional-KP-' + TODAY &&
          done.who === 'Child: K.P.', JSON.stringify(done));
  }
  {
    // Clicking back into the Child box once your own initials are in it must not
    // select them — the sample arrives with M.T. filling all four characters, so
    // the box selects itself on focus, and it used to keep doing that after the
    // teacher had typed their own. One keystroke would have wiped them.
    await goFirstVisit(page, base);
    await typeIn(page, '#initials', 'K.P.', true);
    await page.$eval('#strengths', el => el.focus());
    await page.$eval('#initials', el => el.focus());
    const sel = await page.$eval('#initials', el => el.selectionEnd - el.selectionStart);
    check('clicking back into your own initials does not select them for deletion',
          sel === 0, 'selected ' + sel + ' characters');
  }

  // =========================================================================
  group('Getting it off the screen: the PDF');
  // =========================================================================
  {
    await goFirstVisit(page, base);
    await page.click('button[onclick="exportPDF()"]');
    await frame(page);
    const said = await message(page);
    check('Export as PDF says what happened when the library cannot be downloaded',
          /could not load/.test(said) && /Print/.test(said) && /CSV/.test(said), said);
    check('and it does not throw a JavaScript error into the console instead',
          pageErrors.length === 0, pageErrors.join(' | '));

    // WHAT WAS WRONG: the buttons are at the bottom of the page and the only
    // feedback was the strip at the very top, 94px above the viewport on a
    // 1280x800 laptop — so on a blocked network the button looked dead.
    await page.setViewport({ width: 1280, height: 800 });
    await frame(page);
    await page.click('button[onclick="exportPDF()"]');
    await frame(page);
    const seen = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.say.on')];
      return els.map(el => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top),
                 visible: r.bottom > 0 && r.top < window.innerHeight };
      });
    });
    check('and the person who pressed the button can actually see the answer',
          seen.some(s => s.visible), JSON.stringify(seen));
    await page.setViewport({ width: 1280, height: 900 });
  }
  {
    await goEmpty(page, base);
    await installFakePdf();
    await typeIn(page, '#initials', 'R.K.');
    await fill(page, '#adate', '2026-03-04');
    await score(page, 0, 'm');
    await fill(page, '#strengths', 'Asks for help now.');
    await page.click('button[onclick="exportPDF()"]');
    await frame(page);
    const pdf = await lastPdf();
    eq('the exported PDF is named for the child and the date, not the same name every time',
       pdf.name, 'social-emotional-RK-2026-03-04.pdf');
    check('the child and the date are inside the file as well as on it',
          /R\.K\./.test(pdf.text) && /2026-03-04/.test(pdf.text), pdf.text.slice(0, 200));
    check('the comment the teacher typed is in it',
          /Asks for help now/.test(pdf.text), pdf.text.slice(0, 200));
    const missing = await page.evaluate(() => skills.map(s => s.label))
      .then(labels => labels.filter(l => !pdf.text.includes(l.slice(0, 24))));
    eq('and every one of the six skills', missing, []);
    check('an unscored skill is called what the rest of the tool calls it',
          /Not yet scored/.test(pdf.text) && !/Not Assessed/.test(pdf.text),
          pdf.text.slice(-260));
  }
  {
    // WHAT WAS WRONG: two long comments pushed "Skills Assessment:" and the
    // first skill below the bottom edge of page one, where jsPDF does not draw
    // them — five skills exported where the screen showed six — and hundreds of
    // the teacher's own words ran off the paper into no page at all.
    await goEmpty(page, base);
    await installFakePdf();
    await typeIn(page, '#initials', 'L.W.');
    // One distinctive WORD, repeated. Counting a whole sentence would count
    // wrong for an innocent reason — a line wrap falling inside it.
    const marker = 'Persevering. ';
    await fill(page, '#strengths', marker.repeat(300));
    await fill(page, '#stretches', marker.repeat(300));
    for (let i = 0; i < 6; i++) await score(page, i, 'm');
    await page.click('button[onclick="exportPDF()"]');
    await frame(page);
    const pdf = await lastPdf();
    const labels = await page.evaluate(() => skills.map(s => s.label));
    const missing = labels.filter(l => !pdf.text.includes(l.slice(0, 24)));
    eq('with two very long comments the PDF still holds every skill', missing, []);
    check('and nothing at all is drawn past the bottom edge of the paper',
          pdf.maxY <= 297, 'lowest line at y=' + pdf.maxY + 'mm on a 297mm page');
    check('so the PDF runs onto as many pages as it needs',
          pdf.pageCount >= 2, 'pages: ' + pdf.pageCount);
    const kept = (pdf.text.match(/Persevering/g) || []).length;
    eq('and not one word of the teacher\'s notes is cut off at the paper edge', kept, 600);
  }
  {
    // WHAT WAS WRONG: with the date box empty the PDF printed "Date: —" inside
    // while its own filename carried today, and the CSV of the same state said
    // today in both places — one assessment, three answers to "when".
    await goEmpty(page, base);
    await installFakePdf();
    await typeIn(page, '#initials', 'R.K.');
    await fill(page, '#adate', '');
    await page.click('button[onclick="exportPDF()"]');
    await frame(page);
    await page.click('button[onclick="exportCSV()"]');
    await frame(page);
    const pdf = await lastPdf(), csv = await lastCsv();
    check('with the date box empty the PDF and its own filename agree',
          /no date/.test(pdf.text) && /no-date/.test(pdf.name), pdf.name);
    check('and the spreadsheet gives the very same answer',
          /no date/.test(csv.text) && /no-date/.test(csv.name), csv.name);
  }
  {
    // WHAT WAS WRONG: fileStem() kept only A-Z and 0-9, so every child whose
    // initials carry an accent got the identical filename on the same day while
    // the file's own contents named them.
    await goEmpty(page, base);
    await installFakePdf();
    await typeIn(page, '#initials', 'Á.Ñ.');
    await page.click('button[onclick="exportCSV()"]');
    await frame(page);
    const one = await lastCsv();
    await typeIn(page, '#initials', 'Ç.Ö.', true);
    await page.click('button[onclick="exportCSV()"]');
    await frame(page);
    const two = await lastCsv();
    check('initials with an accent still name the file they are in',
          /Á/.test(one.name) && /Ç/.test(two.name), one.name + ' / ' + two.name);
    check('so two such children on the same day do not collide on one filename',
          one.name !== two.name, one.name + ' vs ' + two.name);
  }

  // =========================================================================
  group('Getting it off the screen: the spreadsheet');
  // =========================================================================
  {
    await goEmpty(page, base);
    await typeIn(page, '#initials', 'R.K.');
    await fill(page, '#adate', '2026-03-04');
    await score(page, 0, 'e');
    await fill(page, '#strengths', 'Waits, listens, and then joins in.');
    await fill(page, '#stretches', 'Asking for help before it gets big.');
    await page.click('button[onclick="exportCSV()"]');
    await frame(page);
    const csv = await lastCsv();
    const rows = csv.text.replace(/^﻿/, '').split('\r\n');
    eq('the spreadsheet is named for the child and the date too',
       csv.name, 'social-emotional-RK-2026-03-04.csv');
    eq('it has a heading row and one row per skill', rows.length, 7);
    check('it holds the comments the teacher just typed',
          /Waits, listens/.test(csv.text) && /Asking for help/.test(csv.text), rows[1]);
    check('the child and the date are in every single row',
          rows.slice(1).every(r => r.startsWith('R.K.,2026-03-04,')), rows[3]);
    const cols = rows[1].split(',').slice(0, 8);
    check('and every column has something in it', cols.every(c => c !== ''),
          JSON.stringify(cols));
  }
  {
    await goEmpty(page, base);
    await typeIn(page, '#initials', 'J.M.');
    await fill(page, '#strengths', 'He said "I can do it", then did it, twice.\nNew line here.');
    await page.click('button[onclick="exportCSV()"]');
    await frame(page);
    const csv = await lastCsv();
    check('a comment with a comma, a quote and a line break does not break the columns',
          /"He said ""I can do it"", then did it, twice\.\nNew line here\."/.test(csv.text),
          csv.text.split('\r\n')[1]);
  }
  {
    await goFirstVisit(page, base);
    await page.click('button[onclick="exportCSV()"]');
    await frame(page);
    const csv = await lastCsv();
    check('the sample spreadsheet says on every row that it is a sample',
          csv.text.split('\r\n').slice(1).every(r => /Sample student/.test(r)),
          csv.text.split('\r\n')[1].slice(0, 80));
    check('and the sample file is named as a sample',
          /^sample-maya-torres/.test(csv.name), csv.name);
  }

  // =========================================================================
  group('On paper  (the fallback when the PDF library is blocked)');
  // =========================================================================
  {
    await goEmpty(page, base);
    await typeIn(page, '#initials', 'R.K.');
    await fill(page, '#adate', '2026-03-04');
    await score(page, 0, 'm');
    await score(page, 3, 'e');
    const p = await paper(page);
    check('every printed page says which child it is about and when',
          p.header.display !== 'none' && p.header.position === 'fixed' &&
          /R\.K\./.test(p.header.text) && /2026-03-04/.test(p.header.text),
          JSON.stringify(p.header));
    check('the child and the date are printed as plain text, not as form boxes',
          p.initialsBox === 'none' && p.dateBox === 'none' &&
          p.initialsPaper === 'R.K.' && p.datePaper === '2026-03-04',
          JSON.stringify({ i: p.initialsPaper, d: p.datePaper }));
    // WHAT WAS WRONG: on paper the score the teacher GAVE was the palest letter
    // in the row and the two NOT given printed dark, so the sheet read backwards
    // and on a mono printer recorded nothing at all.
    check('the score the teacher gave is printed as a word, in ink',
          p.scoreButtonsShown === 'none' &&
          p.scoreWords[0] === 'Mastered' && p.scoreWords[3] === 'Emerging' &&
          p.scoreWords[1] === 'Not yet scored', JSON.stringify(p.scoreWords));
    check('and the colour-coded ring, which is one flat grey in mono, is left off paper',
          p.chartShown === 'none', p.chartShown);
  }
  {
    // WHAT WAS WRONG: with the Child box left empty the printed sheet put the
    // placeholder "J.M." on the paper in the same bold black as a real entry,
    // naming a child who was never entered.
    await goEmpty(page, base);
    await score(page, 0, 'm');
    const p = await paper(page);
    check('an empty Child box does not print a child who was never entered',
          p.initialsPaper === '' && !/J\.M\./.test(p.bodyText), p.initialsPaper);
  }
  {
    await goEmpty(page, base);
    const longNote = 'This is a long note about how the day went. '.repeat(40);
    await fill(page, '#strengths', longNote);
    const p = await paper(page);
    check('a long note is printed whole, not cut off at the bottom of its box',
          p.strengths.onPaper === longNote && p.strengths.cutOff <= 0 &&
          p.strengths.lastCharInside,
          JSON.stringify({ cut: p.strengths.cutOff, inside: p.strengths.lastCharInside }));
    check('the scrolling box itself is not what goes on the paper',
          p.strengths.boxShown === 'none' && p.strengths.copyShown === 'block',
          p.strengths.boxShown + '/' + p.strengths.copyShown);
  }
  {
    await goFirstVisit(page, base);
    const p = await paper(page);
    check('a printed sample sheet says it is a sample, so it cannot be taken for a real child',
          /Sample student/.test(p.header.text) && /not a real child/.test(p.header.text),
          p.header.text);
    // WHAT WAS WRONG: printing the tool as it arrives spilled three lines onto
    // an otherwise blank second sheet — the first thing a stranger sees if they
    // press Print in their first two minutes.
    const h = await printedHeight(page);
    check('and the whole sample sheet fits on one piece of paper',
          h <= 950, 'content ends at ' + h + 'px of the 950px printable height');
  }
  {
    await goFirstVisit(page, base);
    await page.click('button[onclick="printSheet()"]');
    await frame(page);
    eq('the Print button really prints', await page.evaluate(() => window.__printed), 1);
  }
  {
    // The four counts used to print ragged, because "Not yet scored" wraps to
    // three lines on paper and pushed its number below the other three. Measured
    // at the width of the paper, where the wrapping actually happens.
    await page.emulateMediaType('print');
    await page.setViewport({ width: 710, height: 950 });
    await frame(page);
    const ys = await page.$$eval('.count-box',
      els => els.map(e => Math.round(e.lastElementChild.getBoundingClientRect().bottom)));
    await page.emulateMediaType(null);
    await page.setViewport({ width: 1280, height: 900 });
    check('the four counts print on one line, not with the fourth dropped below',
          Math.max(...ys) - Math.min(...ys) <= 1, JSON.stringify(ys));
  }

  // =========================================================================
  group('On a phone, under a finger, and for a Lighthouse run');
  // =========================================================================
  {
    await goFirstVisit(page, base);
    await page.setViewport({ width: 320, height: 700 });
    await frame(page);
    const w = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    check('the narrowest common phone does not have to scroll sideways',
          w.scroll <= w.inner, JSON.stringify(w));
    await page.setViewport({ width: 1280, height: 900 });
  }
  {
    await goFirstVisit(page, base);
    await page.setViewport({ width: 834, height: 1112, hasTouch: true, isMobile: true });
    await frame(page);
    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    check('an iPad really is being emulated as a touch screen', coarse);
    const small = await tapTargets(page);
    check('every control a finger has to hit is at least 44px on a touch screen',
          small.length === 0, JSON.stringify(small).slice(0, 400));
    await page.setViewport({ width: 1280, height: 900 });
  }
  {
    await goFirstVisit(page, base);
    const bad = await contrastSweep(page);
    check('every piece of text on the page meets the WCAG AA contrast minimum',
          bad.length === 0, JSON.stringify(bad).slice(0, 500));
    await page.click('#countMastered');
    await frame(page);
    const badModal = await contrastSweep(page);
    check('including the text inside the band panel',
          badModal.length === 0, JSON.stringify(badModal).slice(0, 400));
    await page.keyboard.press('Escape');
  }
  {
    await goEmpty(page, base);
    await page.evaluate(() => { window.__blockStorage = true; });
    await score(page, 0, 'e');
    const bad = await contrastSweep(page);
    check('and the warning that the assessment is not being saved',
          bad.length === 0, JSON.stringify(bad).slice(0, 400));
    await page.evaluate(() => { window.__blockStorage = false; });
  }
  {
    // The note about the sample's leftover initials is a whole banner and a
    // whole button that only exist after the sample has been emptied by hand,
    // so neither sweep above has ever laid eyes on them.
    await goFirstVisit(page, base);
    for (let i = 0; i < 6; i++) await clearOneScore(page, i);
    await fill(page, '#strengths', '');
    await fill(page, '#stretches', '');
    const badNote = await contrastSweep(page);
    check('the note about the sample\'s leftover initials is readable too',
          badNote.length === 0, JSON.stringify(badNote).slice(0, 400));
    await page.setViewport({ width: 834, height: 1112, hasTouch: true, isMobile: true });
    await frame(page);
    const smallNote = await tapTargets(page);
    check('and the button that empties the Child box is big enough for a finger',
          smallNote.length === 0, JSON.stringify(smallNote).slice(0, 400));
    await page.setViewport({ width: 1280, height: 900 });
    await frame(page);
  }

  // =========================================================================
  group('The page does not move under the teacher\'s hand');
  // =========================================================================
  {
    // WHAT WAS WRONG: the message box grew and shrank in the layout and every
    // message removed itself on a timer nobody armed, so six seconds after a
    // click the assessment jumped 51px up the screen — and skill rows are 65px
    // apart, so the next click landed on the wrong child skill.
    await goEmpty(page, base);
    const where = () => page.evaluate(() =>
      Math.round(document.getElementById('skillsList').getBoundingClientRect().top));
    const before = await where();
    await page.evaluate(() => say('A message that takes up two or three lines of the ' +
      'width of this page, so that any change in its height would be obvious.', 60000));
    await frame(page);
    const during = await where();
    await page.evaluate(() => { paintSay('', false); });
    await frame(page);
    const after = await where();
    check('a message appearing does not move the assessment under the pointer',
          before === during, before + ' -> ' + during);
    check('and neither does it going away again', during === after, during + ' -> ' + after);
  }

  // =========================================================================
  group('Nothing leaves the laptop');
  // =========================================================================
  {
    const offsite = requested.filter(u => !u.startsWith(base) && !u.startsWith('about:') &&
                                          !u.startsWith('data:'));
    check('the tool makes no network request except the one optional PDF library',
          offsite.every(u => /cdnjs|jspdf/i.test(u)), offsite.slice(0, 4).join(' | '));
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    check('and there is no analytics, no upload and no fetch anywhere in the file',
          !/fetch\(|XMLHttpRequest|navigator\.sendBeacon|googletag|analytics/.test(html));
    const textBoxes = (html.match(/<input type="text"[^>]*>/g) || []);
    check('the file asks for initials and nothing longer — one four-character box',
          textBoxes.length === 1 && /maxlength="4"/.test(textBoxes[0]), textBoxes.join(' | '));
  }

  // =========================================================================
  group('The corners a teacher only meets on a bad day');
  // =========================================================================
  {
    // A message really does take itself off the screen when its time is up —
    // without moving anything, which the group above already pins down.
    await goEmpty(page, base);
    await page.evaluate(() => say('A short-lived note.', 120));
    check('a message is on screen while it lasts',
          /short-lived/.test(await message(page)), await message(page));
    await new Promise(r => setTimeout(r, 350));
    eq('and it takes itself off again afterwards', await message(page), '');
  }
  {
    // A browser that refuses to READ localStorage — some locked-down school
    // profiles do — used to throw before the tool had drawn anything.
    await harvest(page);
    await page.goto('about:blank');
    await page.goto(base + '/index.html#nostorage', { waitUntil: 'load' });
    await frame(page);
    check('a browser that will not remember anything still draws the whole tool',
          (await page.$$('.score-btn')).length === 18);
    check('and says plainly that nothing here will survive a reload',
          /will not let the tool read or save/.test(await message(page)),
          await message(page));
    check('the sample child is not dropped over the top of that',
          !(await page.$eval('#sampleBanner', el => el.classList.contains('on'))));
  }
  {
    // The move from the six keys this tool used to write to the single record
    // it writes now. Nobody's saved assessment may be lost in the move.
    await goRaw(page, base, () => {
      localStorage.clear();
      localStorage.setItem('seScores', '{"0":"m","4":"e"}');
      localStorage.setItem('seComments', '{"strengths":"Old saved note.","stretches":""}');
      localStorage.setItem('seInitials', 'P.Q.');
      localStorage.setItem('seDate', '2026-02-02');
      localStorage.setItem('seSample', '');
      localStorage.setItem('seSeen', '1');
    });
    eq('an assessment saved by the previous version of this tool still opens',
       await board(page), 'M---E-');
    eq('with its initials', await page.$eval('#initials', el => el.value), 'P.Q.');
    eq('its date', await page.$eval('#adate', el => el.value), '2026-02-02');
    eq('and its note', await page.$eval('#strengths', el => el.value), 'Old saved note.');
    await score(page, 1, 'd');
    const left = await page.evaluate(() =>
      ['seScores','seComments','seInitials','seDate','seSample','seSeen']
        .filter(k => localStorage.getItem(k) !== null));
    eq('and the old keys are tidied away once it has been saved the new way', left, []);
  }
  {
    // WHAT WAS WRONG, and it is the migration path itself: the previous version
    // only ever left sample mode through the Child box, so a real child assessed
    // on top of the sample was saved with seSample still set to '1'. The move to
    // one record filled in the missing "which rows were Maya's" as ALL SIX and
    // then decided by comparing letters — and across six skills and three bands
    // at least one row matches hers about nine times in ten. So a real child came
    // back labelled, and both exports were named sample-maya-torres-… with the
    // real initials thrown away. The scores below share exactly one letter with
    // Maya's, which is the commonest case of all.
    await goRaw(page, base, () => {
      localStorage.clear();
      localStorage.setItem('seScores', '{"0":"m","1":"e","2":"d","3":"e","4":"d","5":"m"}');
      localStorage.setItem('seComments', JSON.stringify({
        strengths: 'K.P. is kind to the younger ones at lunch.',
        stretches: 'Finds transitions hard on a Monday.' }));
      localStorage.setItem('seInitials', 'K.P.');
      localStorage.setItem('seDate', '2026-04-04');
      localStorage.setItem('seSample', '1');
      localStorage.setItem('seSeen', '1');
    });
    const mig = await page.evaluate(() => ({
      banner: document.getElementById('sampleBanner').classList.contains('on'),
      ini: document.getElementById('initials').value,
      stem: fileStem(), who: whoLine()
    }));
    check('a real child saved by the previous version is not relabelled Maya Torres',
          !mig.banner && mig.ini === 'K.P.' && mig.who === 'Child: K.P.' &&
          mig.stem === 'social-emotional-KP-2026-04-04', JSON.stringify(mig));
    eq('and every one of that child\'s own scores comes across untouched',
       await board(page), 'MEDEDM');
  }
  {
    // The other side of that coin: an old record that really IS the sample must
    // keep saying so. Her initials and her notes word for word are evidence no
    // real child produces by accident — unlike one matching letter.
    await goRaw(page, base, () => {
      localStorage.clear();
      // Her own scores and her own notes, taken from the tool itself so this
      // check cannot drift away from what the sample actually is.
      localStorage.setItem('seScores', JSON.stringify(SAMPLE.scores));
      localStorage.setItem('seComments', JSON.stringify({
        strengths: SAMPLE.strengths, stretches: SAMPLE.stretches }));
      localStorage.setItem('seInitials', 'M.T.');
      localStorage.setItem('seDate', '2026-04-04');
      localStorage.setItem('seSample', '1');
      localStorage.setItem('seSeen', '1');
    });
    const kept = await page.evaluate(() => ({
      banner: document.getElementById('sampleBanner').classList.contains('on'),
      stem: fileStem()
    }));
    check('an old record that really is the sample still says it is a sample',
          kept.banner && /^sample-maya-torres/.test(kept.stem), JSON.stringify(kept));
  }
  {
    // Her six scores and her initials, with the notes cleared: still nobody but
    // the sample child. All six at once is 1 chance in 729, which is evidence;
    // one row matching is not.
    await goRaw(page, base, () => {
      localStorage.clear();
      localStorage.setItem('seScores', JSON.stringify(SAMPLE.scores));
      localStorage.setItem('seComments', '{"strengths":"","stretches":""}');
      localStorage.setItem('seInitials', 'M.T.');
      localStorage.setItem('seDate', '2026-04-04');
      localStorage.setItem('seSample', '1');
    });
    const st = await page.evaluate(() => ({
      banner: document.getElementById('sampleBanner').classList.contains('on'),
      stem: fileStem()
    }));
    check('the sample\'s own six scores are enough to keep her label without her notes',
          st.banner && /^sample-maya-torres/.test(st.stem), JSON.stringify(st));
  }
  {
    // And the child this matters most for: a real child whose initials genuinely
    // ARE M.T., saved by the version that could only leave sample mode through
    // the Child box. Her initials alone prove nothing — the work on the sheet is
    // this child's own, so the example label does not come back with it.
    await goRaw(page, base, () => {
      localStorage.clear();
      localStorage.setItem('seScores', '{"0":"m","1":"e","2":"e","3":"d","4":"e","5":"e"}');
      localStorage.setItem('seComments', JSON.stringify({
        strengths: 'M.T. is settling in well this term.',
        stretches: 'Needs a reminder to pack away.' }));
      localStorage.setItem('seInitials', 'M.T.');
      localStorage.setItem('seDate', '2026-04-04');
      localStorage.setItem('seSample', '1');
    });
    const st = await page.evaluate(() => ({
      banner: document.getElementById('sampleBanner').classList.contains('on'),
      stem: fileStem(), who: whoLine()
    }));
    check('a real child whose initials are M.T. is not relabelled by the move either',
          !st.banner && st.who === 'Child: M.T.' &&
          st.stem === 'social-emotional-MT-2026-04-04', JSON.stringify(st));
  }
  {
    // A record from an in-between version: it knows it is the sample but never
    // wrote down which rows were hers. Same rule — the missing list is only
    // filled in for a sheet that is unmistakably Maya's, never for a real child.
    await goRaw(page, base, () => {
      localStorage.clear();
      localStorage.setItem('seRecord', JSON.stringify({
        v:1, scores:{0:'m',1:'e',2:'d',3:'e',4:'d',5:'m'},
        comments:{ strengths:'K.P. is kind to the younger ones at lunch.', stretches:'' },
        initials:'K.P.', date:'2026-04-04', sample:true }));
    });
    const st = await page.evaluate(() => ({
      banner: document.getElementById('sampleBanner').classList.contains('on'),
      stem: fileStem()
    }));
    check('a saved record with no list of the sample\'s rows does not invent one',
          !st.banner && st.stem === 'social-emotional-KP-2026-04-04', JSON.stringify(st));
  }
  {
    // A saved Undo with nothing in it is not an offer worth making.
    await goRaw(page, base, () => {
      localStorage.clear();
      localStorage.setItem('seRecord', JSON.stringify({
        v:1, scores:{}, comments:{strengths:'',stretches:''}, initials:'',
        date:'', sample:false, sampleCleared:true, sampleScoreKeys:[] }));
      localStorage.setItem('seUndo', JSON.stringify({
        scores:{}, comments:{strengths:'',stretches:''}, initials:'',
        date:'', label:'Undo the clear' }));
    });
    check('an empty way-back is not offered as though it held something',
          (await undoBtn(page)).hidden, JSON.stringify(await undoBtn(page)));
  }
  {
    // Reset when the browser will not save: the sheet on screen empties but the
    // saved copy is untouched, and a reload brings the child straight back. The
    // teacher has to be told that, not told "Everything cleared".
    await goEmpty(page, base);
    await typeIn(page, '#initials', 'D.F.');
    await score(page, 0, 'e');
    await page.evaluate(() => { window.__blockStorage = true; window.__confirmAnswer = true; });
    await page.click('button[onclick="resetAll()"]');
    await frame(page);
    check('Reset does not claim to have cleared what the browser would not let it clear',
          /would not let the tool save/.test(await message(page)), await message(page));
    await page.evaluate(() => { window.__blockStorage = false; });
    await reload(page);
    eq('and a reload really does bring the child back', await board(page), 'E-----');
  }
  {
    // Keyboard going backwards out of the panel.
    await goFirstVisit(page, base);
    await page.click('#countMastered');
    await frame(page);
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
    check('Shift-Tab is held inside the panel too',
          await page.evaluate(() =>
            document.querySelector('.modal-content').contains(document.activeElement)));
    await page.keyboard.press('Escape');
  }
  {
    await goFirstVisit(page, base);
    await installFakePdf();
    await page.click('button[onclick="exportPDF()"]');
    await frame(page);
    const pdf = await lastPdf();
    check('a sample PDF says inside it that it is not a real child\'s record',
          /not a real child/.test(pdf.text) && /Sample student/.test(pdf.text),
          pdf.text.slice(0, 180));
    check('and the file is named as a sample',
          /^sample-maya-torres/.test(pdf.name), pdf.name);
  }
  {
    // The library arrived but fell over anyway — a corrupted copy, an old
    // browser. Still not a dead button and a console error nobody sees.
    await goEmpty(page, base);
    await page.evaluate(() => {
      window.__pdfLibBlocked = false;
      window.jspdf = { jsPDF: function(){ throw new Error('broken build'); } };
    });
    await score(page, 0, 'e');
    await page.click('button[onclick="exportPDF()"]');
    await frame(page);
    check('a PDF library that fails halfway says so and points at Print and CSV',
          /did not get made/.test(await message(page)), await message(page));
  }

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
      merged.set(e.text, (merged.get(e.text) || []).concat(e.ranges));
    }
    // The suite injects small helper scripts (the stand-in PDF library, the
    // storage switch) which Chrome also files under this URL. They would each
    // print their own cheerful "100% of 1 line" and bury the number that
    // matters, so only the document itself is reported.
    for (const k of [...merged.keys()]) if (k.length < 20000) merged.delete(k);
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
        const tag = text.indexOf('<script>\n        const skills');
        const open  = tag === -1 ? 0 : tag + '<script>'.length;
        const close = tag === -1 ? text.length : text.lastIndexOf('</script>');

        // When Chrome gives back only the script body, its line 1 is not the
        // file's line 1. Reporting "index.html:881" for what is really line
        // 1385 sends somebody to the wrong place, which is worse than saying
        // nothing.
        let lineShift = 0;
        if (tag === -1){
          const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
          const at = html.indexOf('<script>\n        const skills');
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
  // How many checks were SUPPOSED to run. Several checks sit inside `if (...)`
  // guards; when a guard goes false those checks do not fail, they silently do
  // not happen, and the run still ends green. That is how a suite quietly
  // shrinks. The count itself is therefore a check.
  // -------------------------------------------------------------------------
  const EXPECTED_CHECKS = Number(process.env.EXPECTED_CHECKS || 190);
  const ran = passed + failures.length;
  if (EXPECTED_CHECKS && ran !== EXPECTED_CHECKS){
    failures.push({
      name: `the suite ran ${ran} checks, but ${EXPECTED_CHECKS} were expected`,
      detail: ran < EXPECTED_CHECKS
        ? 'Checks vanished rather than failed — look for an `if (...)` guard that went false.'
        : 'Checks were added. If that was deliberate, update EXPECTED_CHECKS.'
    });
    console.log(`${R}  FAIL${X} expected ${EXPECTED_CHECKS} checks, ran ${ran}`);
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
