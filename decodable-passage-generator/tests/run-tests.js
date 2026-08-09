#!/usr/bin/env node
//
// Decodable Passages — regression tests.
//
// WHAT THIS IS
// ------------
// "Regression" means sliding backward. Every check in this file exists because
// something was once actually broken on this page. The point is not to prove
// the page works today — it is so that a bug fixed in August cannot quietly
// come back in November without anybody noticing.
//
// Each test names the defect it guards, in the words of the person who would
// notice it. If you fix a new bug, add a test for it here on the same day,
// while you still remember what went wrong.
//
// ONE THING TO KNOW BEFORE YOU EDIT ANYTHING
// ------------------------------------------
// index.html is GENERATED. build_index.py writes it, and running that script
// reproduces the shipped file byte for byte. So a fix belongs in
// build_index.py, and index.html is then rebuilt. These tests deliberately
// check the built index.html — that is the file a visitor loads — and one of
// them re-runs the generator to prove the two have not drifted apart.
//
// HOW TO RUN IT
// -------------
//     cd ~/Documents/GitHub/edtech-portfolio/decodable-passage-generator/tests
//     npm test
//
// It opens a real Google Chrome in the background, drives the page with real
// clicks, and prints a line per check. It needs nothing on the internet.
//
// There is no node_modules folder here on purpose: the npm test script sets
// NODE_PATH to ../../running-record-tool/tests/node_modules, so puppeteer-core
// is not installed twice. Nothing to npm install.
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
const { execFileSync } = require('child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT   = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Two tiny local web servers, both serving the same folder.
//
// The page opens happily from the filesystem, but serving over http is what
// GitHub Pages actually does, and one of the bugs below only appears over
// http: a server that sends "Content-Type: text/html" with no charset. The
// BARE server does exactly that, which is what `python3 -m http.server` and a
// few CDNs do. The UTF-8 server sends a charset, which is what GitHub Pages
// does. The page has to be right on both.
//
// There is a third condition, and it is the one the first round of tests
// missed. The page defends itself against a charset-less host TWICE: once with
// <meta charset="utf-8"> in the head, and once by containing no raw non-ASCII
// byte for anything to mis-read. Testing only the first two servers proves
// "the page is fine", but it cannot tell you WHICH defence is doing the work —
// and it was doing it with only one. So the servers below also answer the URL
//
//     /__no-charset-tag.html
//
// which is index.html with the <meta charset> line stripped out. Fetched from
// the BARE server, that is a page with no charset declared anywhere at all:
// the worst case a real host can produce. It has to read correctly there too.
// ---------------------------------------------------------------------------
const TYPES = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
                '.json':'application/json', '.md':'text/markdown' };

const NO_META = '/__no-charset-tag.html';

function serve(sendCharset){
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const strip = (p === NO_META);
      if (strip) p = '/index.html';
      const file = path.join(ROOT, p);
      // Never serve outside the tool directory.
      if (!file.startsWith(ROOT)){ res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, buf) => {
        if (err){ res.writeHead(404); return res.end('not found'); }
        if (strip) buf = Buffer.from(
          buf.toString('utf8').replace(/<meta charset=[^>]*>\s*/i, ''), 'utf8');
        const type = TYPES[path.extname(file)] || 'text/plain';
        res.writeHead(200, {
          'Content-Type': sendCharset ? type + '; charset=utf-8' : type });
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

// `load`, not `domcontentloaded`: a stylesheet still in flight when the first
// assertion runs lands in the console-error list a fraction of the time, and a
// test that is right nine times out of ten teaches you to ignore red.
async function nav(page, url){ return page.goto(url, { waitUntil: 'load' }); }

const LAPTOP = { width: 1280, height: 900 };
const PHONE  = { width: 390, height: 844, deviceScaleFactor: 2,
                 isMobile: true, hasTouch: true };   // iPhone 14

// Count the printed pages a sheet contains, the way the sheet builder lays
// them out. Cross-checked against real Chrome pagination further down.
function pagesInSheet(n){
  const f = path.join(ROOT, 'sheets', `lesson-${String(n).padStart(3,'0')}.html`);
  if (!fs.existsSync(f)) return 0;
  return (fs.readFileSync(f, 'utf8').match(/class="page/g) || []).length;
}

async function main(){
  if (!fs.existsSync(CHROME)){
    console.error(`${R}Google Chrome was not found at:${X}\n  ${CHROME}\n` +
                  `Install Chrome, or edit the CHROME path at the top of this file.`);
    process.exit(2);
  }

  const utf8 = await serve(true);
  const bare = await serve(false);
  const base     = `http://127.0.0.1:${utf8.port}`;
  const baseBare = `http://127.0.0.1:${bare.port}`;

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport(LAPTOP);

  // Anything that would open a window or block on a dialog is stubbed, so the
  // handlers still run and can be inspected.
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
  await page.evaluateOnNewDocument(() => {
    window.__printed = 0;
    window.print   = () => { window.__printed++; };
    window.confirm = () => true;
    window.alert   = () => {};
  });

  // =========================================================================
  group('A visitor on a phone gets an explanation, not 6-point type');
  // WAS BROKEN: index.html had no <meta name="viewport">, so a phone laid the
  // page out at 980px and shrank the whole thing to 40%. 16px body text
  // arrived at 6.4 device pixels. (The printable sheets always had the tag —
  // only the front page was missing it.)
  // =========================================================================
  {
    await page.setViewport(PHONE);
    await nav(page, base + '/index.html');
    const m = await page.evaluate(() => ({
      layoutWidth: document.documentElement.clientWidth,
      lede:  parseFloat(getComputedStyle(document.querySelector('.lede')).fontSize),
      phoneNote: (() => {
        const el = document.querySelector('.onphone');
        if (!el) return null;
        return getComputedStyle(el).display === 'none' ? '' : el.textContent.trim();
      })(),
      sideways: document.documentElement.scrollWidth >
                document.documentElement.clientWidth + 1
    }));
    eq('the page lays out at the phone\'s real width instead of being shrunk to 40%',
       m.layoutWidth, 390);
    // Deliberately measured in DEVICE pixels, not CSS pixels. getComputedStyle
    // reported a comfortable 16px even when the page was unreadable, because
    // the browser was shrinking the whole 980px layout down to a 390px screen
    // afterwards. The size that matters is what reaches the eye: the CSS size
    // times the scale the browser is forced to apply.
    const onGlass = m.lede * (390 / m.layoutWidth);
    check('body text reaches the eye at full size, not shrunk to 6-point',
          onGlass >= 15,
          `.lede is ${m.lede}px CSS but arrives at ${onGlass.toFixed(1)} device px`);
    check('a phone is told plainly that this page is built for a computer',
          /built for a computer/i.test(m.phoneNote || ''),
          `the phone note read: ${JSON.stringify(m.phoneNote)}`);
    check('the phone note mentions printing, which is the reason to move to a laptop',
          /print/i.test(m.phoneNote || ''), m.phoneNote);
    check('nothing hangs off the right edge on a phone', !m.sideways);
  }

  // =========================================================================
  group('The page was not rebuilt for phones — it just says so');
  // Sahaj's decision: this is a desktop page on purpose. The polite line is
  // the ONLY thing small screens change. If somebody later grows a mobile
  // design here, this check is where they should stop and think.
  // =========================================================================
  {
    await page.setViewport(LAPTOP);
    await nav(page, base + '/index.html');
    const m = await page.evaluate(() => {
      const el = document.querySelector('.onphone');
      const cards = [...document.querySelectorAll('.card')];
      const tops = new Set(cards.slice(0, 12).map(c => Math.round(c.getBoundingClientRect().top)));
      return {
        noteHidden: !el || getComputedStyle(el).display === 'none',
        cardWidth: Math.round(cards[0].getBoundingClientRect().width),
        rowsForFirst12: tops.size
      };
    });
    check('the phone line does not clutter the page on a laptop', m.noteHidden);
    // Careful with the word "unchanged". Leaving quirks mode DID move things a
    // little: standards-mode line boxes make each card 1px taller, so the page
    // is about 42px longer and the footer sits that much lower. That is the
    // browser rendering the CSS correctly rather than the layout breaking. So
    // this asserts the thing that actually matters to a teacher — the cards
    // are still wide and still several to a row — and not pixel sameness.
    check('the laptop layout still reads as a grid: cards wide, several to a row',
          m.rowsForFirst12 <= 4 && m.cardWidth > 250,
          `card width ${m.cardWidth}px, first 12 cards on ${m.rowsForFirst12} rows`);
    const media = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
                    .match(/@media[^{]*\{/g) || [];
    eq('there is exactly one small-screen rule in the stylesheet, and it is the note',
       media.map(s => s.replace(/\s+/g, ' ').trim()),
       ['@media (max-width:640px){']);
  }

  // =========================================================================
  group('No word on the page turns to gibberish, whatever the host sends');
  // WAS BROKEN: no <meta charset>, so a host that sends no charset in its
  // Content-Type header — a plain python3 -m http.server, some CDNs — made
  // Chrome fall back to windows-1252 and misread every raw UTF-8 byte.
  //
  // WHAT THE FIRST ROUND OF TESTS GOT WRONG, and why this group is now bigger:
  // it checked ONE sentence — the em dash in the "Lessons 1-5" note. The real
  // damage was 28 ruined runs of text. The other 27 were the phonetic symbols
  // in the lesson skill labels, which are the whole point of a phonics page:
  // "a /ă/" read as "a /Äƒ/", "ng /ŋ/" as "ng /Å‹/", "a_e /ā/" as "a_e /Ä/".
  // A test that looks at one sentence passes while 27 lesson cards are
  // unreadable, so it is now the WHOLE rendered page that gets checked, and
  // the check is a whitelist rather than a hunt for known-bad characters: any
  // non-ASCII character that is not one we deliberately put there is a
  // failure, whatever it looks like.
  // =========================================================================
  {
    // Every non-ASCII character this page is ALLOWED to render. If a character
    // outside this set appears, something mis-decoded — no need to guess what
    // mojibake looks like.
    const INTENDED = [
      '—', '–', '·',                       // — – ·
      'ă','ĭ','ŏ','ŭ','ĕ',       // ă ĭ ŏ ŭ ĕ
      'ā','ī','ō','ē','ū',       // ā ī ō ē ū
      'ŋ','ɑ','ɔ','ɛ','ə'        // ŋ ɑ ɔ ɛ ə
    ];

    // The source file itself: after this fix there is not one raw non-ASCII
    // byte left in it. This is the defence that does NOT depend on the head
    // being right, and it is the one that was missing.
    const bytes = fs.readFileSync(path.join(ROOT, 'index.html'));
    const rawHigh = [...bytes].filter(b => b > 127).length;
    eq('index.html contains no raw non-ASCII bytes at all — every special ' +
       'character is an HTML entity, so there is nothing for a host to misread',
       rawHigh, 0);
    const src = bytes.toString('utf8');
    check('and the charset tag is still there too, so either defence alone would hold',
          /<meta charset="utf-8">/i.test(src));

    const read = () => page.evaluate(() => {
      const t = document.body.innerText;
      return {
        charset: document.characterSet,
        text: t,
        odd: [...new Set([...t].filter(c => c.charCodeAt(0) > 127))].sort().join(''),
        // The labels that were the other 27 casualties.
        symbolLabels: [...document.querySelectorAll('.card .s')]
          .map(e => e.textContent.trim())
          .filter(s => [...s].some(c => c.charCodeAt(0) > 127)),
        note: document.querySelector('.note').textContent
      };
    });

    const seen = {};
    for (const [label, url, expectUtf8] of [
      ['a server that sends a charset',            base     + '/index.html', true],
      ['a server that sends none',                 baseBare + '/index.html', true],
      ['a server that sends none, on a page whose <meta charset> was also removed',
                                                   baseBare + NO_META,       false]]){
      await nav(page, url);
      const m = await read();
      seen[label] = m.text;

      if (expectUtf8){
        eq(`the page is read as UTF-8 on ${label}`, m.charset, 'UTF-8');
      } else {
        // Chrome genuinely falls back to windows-1252 here — there is nothing
        // left telling it otherwise — and the page is still perfect, because
        // windows-1252 and UTF-8 agree on every byte below 128 and there are
        // no others. That is the whole argument for the entities, demonstrated
        // rather than asserted: the browser guesses WRONG and it does not
        // matter. If someone ever pastes a raw special character back into
        // build_index.py, this is the check that goes red.
        eq(`Chrome falls back to a legacy encoding on ${label}`,
           m.charset, 'windows-1252');
      }
      const stray = [...m.odd].filter(c => !INTENDED.includes(c));
      check(`nothing anywhere on the page is mis-decoded on ${label}`,
            stray.length === 0,
            `unexpected characters: ${JSON.stringify(stray.join(''))}`);
      check(`the Lessons 1-5 note still has its dash on ${label}`,
            m.note.includes('letter-sounds — at Lesson 1'), m.note.slice(0, 160));
      // The 27 that the old test could not see.
      check(`every phonetic symbol in the lesson labels survives on ${label}`,
            m.symbolLabels.length >= 27 &&
            m.symbolLabels.every(s => [...s].every(
              c => c.charCodeAt(0) < 128 || INTENDED.includes(c))),
            `${m.symbolLabels.length} labels carry a symbol; first few: ` +
            JSON.stringify(m.symbolLabels.slice(0, 4)));
      check(`the short-a label still reads "a /ă/" on ${label}`,
            m.symbolLabels.some(s => s.includes('/ă')), m.symbolLabels[0]);
      check(`the ng label still reads "ng /ŋ/" on ${label}`,
            m.symbolLabels.some(s => s.includes('/ŋ')),
            m.symbolLabels.find(s => /ng/.test(s)));
    }

    // The plainest statement of all: a visitor reads exactly the same words on
    // all three hosts, character for character.
    const [a, b, c] = Object.values(seen);
    check('all three hosts show a visitor the identical text, character for character',
          a === b && b === c,
          a === b ? 'the charset-tag-less page differs' : 'the charset-less server differs');
  }

  // =========================================================================
  group('There is only one .note on the page, and it is the visible one');
  // NOT a bug a visitor could ever see — this page runs no script at all — but
  // a trap for whoever writes the first one. The phone line was
  // class="onphone note", so the page had two .note elements and the FIRST,
  // the one querySelector('.note') hands you, was the one hidden on a laptop.
  // Anyone reaching for '.note' would have silently got the invisible element.
  // The two boxes now share their styling through a comma in the stylesheet
  // instead of through a shared class.
  // =========================================================================
  {
    await page.setViewport(LAPTOP);
    await nav(page, base + '/index.html');
    const m = await page.evaluate(() => {
      const first = document.querySelector('.note');
      return {
        count: document.querySelectorAll('.note').length,
        firstIsHidden: getComputedStyle(first).display === 'none',
        firstText: first.textContent.replace(/\s+/g, ' ').trim().slice(0, 60),
        phoneIsNote: document.querySelector('.onphone').classList.contains('note'),
        // The look must not have changed when the class did.
        sameBox: (() => {
          const s = getComputedStyle(first), p = getComputedStyle(
            document.querySelector('.onphone'));
          return ['backgroundColor','borderLeftColor','borderLeftWidth',
                  'borderTopColor','borderTopWidth','borderTopLeftRadius',
                  'paddingTop','paddingLeft','fontSize']
                 .every(k => s[k] === p[k]);
        })()
      };
    });
    eq('there is exactly one .note element on the page', m.count, 1);
    check('the phone line is not one of them', !m.phoneIsNote);
    check('the .note you get is the visible Lessons 1-5 explainer, not a hidden box',
          !m.firstIsHidden && /Lessons 1/.test(m.firstText), m.firstText);
    check('the phone line still looks exactly like the note box it used to share a class with',
          m.sameBox);
  }

  // =========================================================================
  group('The browser is not asked to fall back to its legacy rendering mode');
  // WAS BROKEN: no <!doctype html>, so Chrome rendered the page in quirks
  // mode, and <html> had no lang, so a screen reader had to guess the
  // language. Nothing was visibly WRONG in quirks mode, but it was not
  // free either: coming out of it makes each card 1px taller, which adds
  // about 42px to the page. That is the correct rendering, arrived at late.
  // Both are one line to fix and an unguarded dependency to leave.
  // =========================================================================
  {
    await nav(page, base + '/index.html');
    const m = await page.evaluate(() => ({
      compat: document.compatMode,
      doctype: !!document.doctype,
      lang: document.documentElement.lang,
      sideways: document.documentElement.scrollWidth >
                document.documentElement.clientWidth + 1
    }));
    check('and standards mode did not push anything off the side of a laptop screen',
          !m.sideways);
    eq('the page renders in standards mode, not quirks mode', m.compat, 'CSS1Compat');
    check('the page declares a doctype', m.doctype);
    eq('a screen reader is told the page is in English', m.lang, 'en');
  }

  // =========================================================================
  group('The headline "printable pages" number is the truth');
  // WAS BROKEN: the tile said 630. It was arithmetic — stories x 5 plus
  // letter sheets x 3 — and four of the five letter sheets are four pages, not
  // three. The real number is 634. Every individual sheet's own page count was
  // right; only the front-page tile was guessing.
  // =========================================================================
  {
    await nav(page, base + '/index.html');
    const tiles = await page.evaluate(() =>
      Object.fromEntries([...document.querySelectorAll('.stat')].map(s => [
        s.querySelector('.k').textContent.trim(),
        s.querySelector('.v').textContent.trim()])));

    let real = 0;
    for (let n = 1; n <= 128; n++) real += pagesInSheet(n);
    eq('the tile matches the pages the 128 sheets actually contain',
       tiles['Printable pages'], String(real));
    eq('and that number is 634', real, 634);

    // Chrome is the referee, not the markup: print three sheets for real and
    // count the pages in the PDF it produces. This is what ties the count
    // above to paper.
    const printer = await browser.newPage();
    for (const n of [1, 2, 41]){
      const file = `sheets/lesson-${String(n).padStart(3,'0')}.html`;
      await printer.goto(`${base}/${file}`, { waitUntil: 'load' });
      const pdf = Buffer.from(await printer.pdf({ format: 'Letter', printBackground: true }));
      const printedPages = (pdf.toString('latin1').match(/\/MediaBox/g) || []).length;
      eq(`lesson ${n} really prints as ${pagesInSheet(n)} pages of letter paper`,
         printedPages, pagesInSheet(n));
    }
    await printer.close();

    eq('the "Stories" tile matches the number of story cards on the page',
       tiles['Stories'],
       String(await page.evaluate(() => document.querySelectorAll('details.card').length)));
  }

  // =========================================================================
  group('The page a visitor loads is the page the generator writes');
  // index.html is generated by build_index.py. If somebody hand-edits
  // index.html, the next rebuild silently throws their change away — which is
  // exactly how the stale 630 could come back. Re-run the generator and
  // require the file to come out identical.
  // =========================================================================
  {
    const before = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    let ran = true, err = '';
    try { execFileSync('python3', ['build_index.py'], { cwd: ROOT, stdio: 'pipe' }); }
    catch (e){ ran = false; err = String(e.stderr || e); }
    check('build_index.py still runs', ran, err);
    if (ran){
      const after = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      check('rebuilding produces the exact file that is shipped — no hand edits have drifted in',
            before === after,
            before === after ? '' : 'index.html changed when build_index.py was re-run');
      if (before !== after) fs.writeFileSync(path.join(ROOT, 'index.html'), before);
    }
  }

  // =========================================================================
  group('Everything a visitor actually clicks still works');
  // Not a bug this page ever had — these guard the fixes above from breaking
  // the page while fixing its head.
  // =========================================================================
  {
    await nav(page, base + '/index.html');

    // Open a story card with a real click.
    const opened = await page.evaluate(() => {
      const d = document.querySelectorAll('details.card')[40];
      d.querySelector('summary').click();
      return { open: d.open,
               height: d.querySelector('.story').getBoundingClientRect().height,
               text: d.querySelector('.story').textContent.trim().length,
               warm: (d.querySelector('.warm') || {}).textContent || '' };
    });
    check('clicking a lesson card opens its story', opened.open);
    check('the story is actually visible and has words in it',
          opened.height > 0 && opened.text > 60,
          `height ${opened.height}, ${opened.text} chars`);
    check('the card shows its warm-up words', /warm-up: \w/.test(opened.warm), opened.warm);

    // Clicking it again closes it.
    const closed = await page.evaluate(() => {
      const d = document.querySelectorAll('details.card')[40];
      d.querySelector('summary').click();
      return d.open;
    });
    check('clicking it again closes the story', !closed);

    // A unit jump link scrolls to that unit.
    const jumped = await page.evaluate(async () => {
      const a = [...document.querySelectorAll('.jump a')][8];
      const label = a.textContent.trim();
      a.click();
      await new Promise(r => setTimeout(r, 250));
      const target = document.querySelector(a.getAttribute('href'));
      return { label, hash: location.hash, scrolled: window.scrollY > 0,
               heading: target.querySelector('.uh span').textContent.trim() };
    });
    eq('a unit button jumps to that unit', jumped.hash, '#u9');
    check('and the unit it lands on is the one on the button',
          jumped.label === jumped.heading, `${jumped.label} vs ${jumped.heading}`);
    check('the page did scroll', jumped.scrolled);

    // "Print this sheet" opens that lesson's sheet in a new tab.
    const before = (await browser.pages()).length;
    await page.evaluate(() => {
      const d = document.querySelectorAll('details.card')[0];
      d.querySelector('.print a').click();
    });
    await new Promise(r => setTimeout(r, 700));
    const pages = await browser.pages();
    check('"Print this sheet" opens a new tab', pages.length === before + 1,
          `${before} tabs before, ${pages.length} after`);
    if (pages.length > before){
      const tab = pages[pages.length - 1];
      await tab.bringToFront();
      const info = await tab.evaluate(() => ({
        url: location.pathname,
        heading: document.body.innerText.slice(0, 400)
      }));
      check('the new tab is a printable sheet for that lesson',
            /sheets\/lesson-\d{3}\.html$/.test(info.url) && /Lesson\s*6\b/.test(info.heading),
            `${info.url} — ${info.heading.replace(/\s+/g,' ').slice(0,100)}`);
      // The one button in this whole tool.
      await tab.evaluate(() => { window.__printed = 0; window.print = () => window.__printed++; });
      const btn = await tab.$('button');
      if (btn) await btn.click();
      eq('and its "Print / Save as PDF" button opens the print dialogue once',
         await tab.evaluate(() => window.__printed), 1);
      await tab.close();
      await page.bringToFront();
    }
  }

  // =========================================================================
  group('The Lessons 1-5 cards do what the page says: click anywhere, get the packet');
  // WAS BROKEN: the page said "Click them like any other lesson" and "Click a
  // card to preview its story right here" — and the five letter cards were
  // plain divs. An audit fired 15 real clicks on their bodies (three spots per
  // card, away from the links) and nothing happened on any of them; the only
  // live target was the 81x20px "Lesson 1" text, styled identically to the
  // NON-clickable titles on story cards. The whole card is one <a> now.
  // =========================================================================
  {
    await nav(page, base + '/index.html');
    const isLink = await page.evaluate(() => {
      const c = document.querySelector('.card.letter');
      return { tag: c.tagName, href: c.getAttribute('href'),
               blank: c.target === '_blank',
               cursor: getComputedStyle(c).cursor };
    });
    check('the letter card is one whole link to its packet',
          isLink.tag === 'A' && isLink.href === 'sheets/lesson-001.html',
          JSON.stringify(isLink));
    check('it opens in a new tab, so the index is never navigated away from',
          isLink.blank);
    check('the cursor over the card body says "clickable", like a story card',
          isLink.cursor === 'pointer', isLink.cursor);

    // The exact three spots the audit clicked and got nothing from: the
    // "Letter and sound" line, just right of the "Lesson 1" text, and the
    // skill-symbol line. Real mouse clicks, not element.click().
    const card = await page.$('.card.letter');
    await page.evaluate(el => el.scrollIntoView({ block: 'center' }), card);
    const box = await card.boundingBox();
    for (const [label, fx, fy] of [
      ['the "Letter and sound" line',        0.5, 0.35],
      ['just right of the "Lesson 1" text',  0.8, 0.12],
      ['the sound-symbol line',              0.5, 0.55]]){
      const before = (await browser.pages()).length;
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      await new Promise(r => setTimeout(r, 600));
      const tabs = await browser.pages();
      const opened = tabs.length === before + 1;
      check(`a real click on ${label} opens the packet`, opened,
            `${before} tabs before, ${tabs.length} after`);
      if (opened){
        const tab = tabs[tabs.length - 1];
        check('and it is Lesson 1\'s own printable sheet',
              /sheets\/lesson-001\.html$/.test(tab.url()), tab.url());
        await tab.close();
        await page.bringToFront();
      }
    }
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a.card.letter')].map(a => a.getAttribute('href')));
    eq('all five letter cards are whole-card links to their own sheets',
       hrefs, [1, 2, 3, 4, 5].map(n => `sheets/lesson-00${n}.html`));
  }

  // =========================================================================
  group('The words page shows this week\'s words, not last week\'s');
  // WAS BROKEN: Lessons 63-67 headed their words page "this week's words" and
  // printed come/some — introduced back at Lesson 62 — while the words those
  // lessons actually introduce (two, does, any, many, been, into, because)
  // never appeared, even though the Lesson 63 story is TITLED "Two Big Boxes".
  // Cause: heart_words.py is not written in lesson order, and the sheet
  // builder took the last two by LIST position instead of by lesson.
  // Lessons 29-33 had the same disease from "we" (Lesson 28) sitting late in
  // the list; they are pinned here too.
  // =========================================================================
  {
    const sheetTab = await browser.newPage();
    const newest = {
      63: ['two', 'does'],   64: ['any', 'many'],  65: ['been', 'into'],
      66: ['been', 'into'],  67: ['into', 'because'],
      29: ['we', 'was'],     31: ['was', 'you']
    };
    for (const [n, want] of Object.entries(newest)){
      await sheetTab.goto(
        `${base}/sheets/lesson-${String(n).padStart(3, '0')}.html`,
        { waitUntil: 'load' });
      const got = await sheetTab.evaluate(() =>
        [...document.querySelectorAll('.hwcard .hwword')].map(e => e.textContent.trim()));
      eq(`lesson ${n} maps its newest heart words: ${want.join(', ')}`, got, want);
    }
    await sheetTab.goto(`${base}/sheets/lesson-063.html`, { waitUntil: 'load' });
    const m = await sheetTab.evaluate(() => ({
      heading: ([...document.querySelectorAll('h2')]
        .map(h => h.textContent).find(t => /Heart words/.test(t)) || ''),
      story: [...document.querySelectorAll('.passage .ln')]
        .map(e => e.textContent).join(' ')
    }));
    check('the heading still says these are this week\'s words',
          /this week/.test(m.heading), m.heading.slice(0, 80));
    check('and the child meets those exact words in the story on the next page',
          /\btwo\b/i.test(m.story) && /\bdoes\b/i.test(m.story),
          m.story.slice(0, 120));
    await sheetTab.close();
    await page.bringToFront();
  }

  // =========================================================================
  group('The build refuses to ship a page that disagrees with its sheets');
  // WAS BROKEN, two ways, both silent and both exit code 0:
  //   1. Delete a sheet file and rebuild: the index still grew a blue "Print
  //      this sheet" button for it, so a parent clicked it and got a 404 tab,
  //      while the "Printable pages" tile quietly dropped by 5.
  //   2. Edit a passage and rebuild only the index (the documented step): the
  //      card previewed "Mud Hog" while its button printed "Mud Pig" — the
  //      child read a different story than the grown-up previewed.
  // build_index.py now checks every passage's title, lines and warm-up words
  // against the sheet file before writing anything, and refuses with the
  // exact fix command. These run against a throwaway copy of the tool.
  // =========================================================================
  {
    const os = require('os');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dpg-guard-'));
    for (const f of ['build_index.py', 'build_sheet.py', 'heart_words.py',
                     'sound-list.json', 'words-page.json',
                     'example-lesson-41.html', 'index.html'])
      fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
    fs.cpSync(path.join(ROOT, 'passages'), path.join(tmp, 'passages'), { recursive: true });
    fs.cpSync(path.join(ROOT, 'sheets'),   path.join(tmp, 'sheets'),   { recursive: true });

    const rebuildIndex = () => {
      try {
        return { code: 0, out: execFileSync('python3', ['build_index.py'],
                                            { cwd: tmp, stdio: 'pipe' }).toString() };
      } catch (e){
        return { code: e.status,
                 out: String(e.stdout || '') + String(e.stderr || '') };
      }
    };
    const rebuildSheet41 = () => execFileSync(
      'python3', ['build_sheet.py', 'passages/lesson-041.json'],
      { cwd: tmp, stdio: 'pipe' });

    eq('sanity: an untouched copy of the tool still builds', rebuildIndex().code, 0);

    // --- 1. a sheet file goes missing ---
    const before = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
    fs.rmSync(path.join(tmp, 'sheets', 'lesson-041.html'));
    let r = rebuildIndex();
    check('a missing sheet stops the build instead of shipping a dead Print button',
          r.code !== 0, `build_index.py exited ${r.code}`);
    check('the message names Lesson 41 and the exact command that fixes it',
          /Lesson 41/.test(r.out) &&
          /build_sheet\.py passages\/lesson-041\.json/.test(r.out),
          r.out.slice(0, 300));
    check('and index.html was left exactly as it was',
          fs.readFileSync(path.join(tmp, 'index.html'), 'utf8') === before);
    rebuildSheet41();
    eq('doing what the message says makes the build pass again', rebuildIndex().code, 0);

    // --- 2. a passage is edited but its sheet is not rebuilt ---
    const pj = path.join(tmp, 'passages', 'lesson-041.json');
    const spec = JSON.parse(fs.readFileSync(pj, 'utf8'));
    spec.title = 'Mud Hog';
    spec.lines[0] = spec.lines[0].replace('pig', 'hog');
    fs.writeFileSync(pj, JSON.stringify(spec, null, 1));
    r = rebuildIndex();
    check('an edited passage stops the index build until its sheet is rebuilt',
          r.code !== 0, `build_index.py exited ${r.code}`);
    check('and says plainly the card would preview a different story than it prints',
          /Lesson 41/.test(r.out) && /disagree/.test(r.out), r.out.slice(0, 400));
    rebuildSheet41();
    r = rebuildIndex();
    eq('after the sheet is rebuilt, the index builds again', r.code, 0);
    const idx   = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
    const sheet = fs.readFileSync(path.join(tmp, 'sheets', 'lesson-041.html'), 'utf8');
    check('and the card and the packet now tell the same story',
          idx.includes('Mud Hog') && sheet.includes('Mud Hog'));
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // =========================================================================
  group('Nothing is broken behind the scenes');
  // =========================================================================
  eq('the page raises no script errors', pageErrors, []);
  eq('nothing failed to load', consoleErrors, []);
  {
    // The whole point of this tool: no network, no storage, nothing leaves the
    // laptop. There is not a single <script> tag on this page, and it should
    // stay that way.
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    check('the page still calls nothing on the internet',
          !/https?:\/\//i.test(html.replace(/<!--[\s\S]*?-->/g, '')),
          (html.match(/https?:\/\/\S{0,60}/i) || [])[0]);
    const stored = await page.evaluate(() => ({
      ls: localStorage.length, ss: sessionStorage.length, cookie: document.cookie }));
    eq('and stores nothing about anyone', stored, { ls: 0, ss: 0, cookie: '' });
  }

  await browser.close();
  utf8.srv.close();
  bare.srv.close();

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
