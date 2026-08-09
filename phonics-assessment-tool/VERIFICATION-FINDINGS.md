# phonics-assessment-tool — verification findings

From the three-round verification of 8-9 Aug 2026. 53 findings, 45 reachable by an ordinary user.

These are HUNTER findings. The run was stopped before every one had been through
the sceptics, so some may not survive scrutiny — treat them as candidates with
reproductions attached, not as confirmed defects.

| Severity | Reachable | What |
|---|---|---|
| BLOCKER | yes | The sample banner's "Clear her scores, keep what I typed" button also deletes the teacher's own scores, says it kept what they typed, offers |
| BLOCKER | yes | "Clear the sample" — the button the banner tells every first-time teacher to press — wipes the teacher's own scores, initials and comments w |
| BUG | yes | Printing the tool — the fallback it names itself when the PDF library is blocked — puts 5 of 128 lessons and a third of each comment on pape |
| BUG | yes | For six lessons the Generate button opens a practice sheet for a different skill than the row it sits on — Lesson 90 'oo /ū/ (moon)' opens t |
| BUG | yes | A second tab of the tool silently overwrites the saved assessment made in the first tab. Each tab writes its whole in-memory snapshot to the |
| BUG | contrived | A saved score whose lesson name is an ordinary object property (`toString`, `valueOf`, `constructor`, `hasOwnProperty`) passes the `k in sco |
| BUG | contrived | When the saved record cannot be parsed — a write cut off half way, for instance — readSaved() swallows the error and returns null, so start( |
| BUG | yes | "Undo the clear" never expires: it stays on screen for the rest of the session and, once the teacher has started the next child, pressing it |
| BUG | yes | With the lessons list open, Tab walks the keyboard onto the score buttons hidden behind the sheet, and Enter there silently changes a score  |
| BUG | yes | The main tool page has no @media print rules at all, so File > Print produces a plausible-looking but silently incomplete record: 5 of 128 l |
| BUG | yes | Generated practice worksheets carry no page-break CSS, so activity rows and sorting boxes are sliced horizontally in half by the page break. |
| BUG | yes | "Clear the sample" destroys the teacher's own initials, comments and scores with no confirmation and no Undo, then saves the empty record —  |
| BUG | yes | When the browser refuses to store anything, the "THIS ASSESSMENT IS NOT BEING SAVED" warning is painted below the fold on every screen size, |
| BUG | yes | The saved `sample` flag survives every reload and there is no way to turn it off that keeps the scores, so a real child's CSV/JSON/filename  |
| BUG | contrived | A parseable record with damaged parts is loaded with those parts silently thrown away — no message anywhere — and the first click then overw |
| BUG | yes | The two cdnjs <script> tags sit in <head> with no defer/async, so if the CDN hangs (school filter that drops packets rather than refusing th |
| BUG | yes | Every generated worksheet is stamped "Flagged skill" and "Generated from the assessment. This practice matches the one skill your reader is  |
| BUG | yes | The page holds itself blank waiting for html2canvas — a library it loads from a CDN in <head> and then never calls once. |
| BUG | yes | The Lesson 32 practice sheet a parent prints tells them "This is the letter Ququ", and the browser tab reads "Practice — Letter Ququ". |
| BUG | yes | On the Lesson 119 and Lesson 120 practice sheets the answer boxes are drawn from the correct word, but the equation printed beside them adds |
| BUG | yes | "Clear her scores, keep what I typed" keeps Maya Torres' entire invented comment paragraph — and removes the banner that said it was invente |
| MINOR | yes | 'All Lessons' runs 62 → 98 → 84 → 88 → 77 → 97 → 63 → 99: three backwards jumps, and Lesson 98 (silent letters kn/wr/mb) is filed under Unit |
| MINOR | yes | The printed report says 'Mastered in: • Unit 1' when one lesson out of the unit's 33 is mastered, contradicting the 'Mastered: 1' three line |
| MINOR | yes | Neither dialog closes on Escape, and closing the lessons list with the X drops the keyboard back on <body> instead of the tally it was opene |
| MINOR | yes | Choosing a different unit keeps the previous list's scroll position, so the new unit opens part-way down — the first lessons of the unit are |
| MINOR | yes | Two tabs of the tool share one record with last-writer-wins: a score made in one tab is erased by the next save in the other, and the losing |
| MINOR | yes | Clear writes the emptied record to storage immediately but keeps the only copy of the old one in memory, so a reload inside the 30-second "y |
| MINOR | contrived | Text in the comment boxes is only written to storage 300ms after typing stops, so leaving the page inside that window loses everything typed |
| MINOR | yes | Every "Reading practice" link from this tool opens a sheet hard-coded to 8.5in (816px) wide on screen with no max-width, so on an iPad in po |
| MINOR | yes | The lesson list is capped at 350px with an overlay scrollbar that takes no width, and the seventh row has exactly 0px showing, so the list l |
| MINOR | yes | The responsive breakpoint is max-width:760px, so the rule that makes the E/D/M score buttons finger-sized fires on phones but on no iPad in  |
| MINOR | yes | Worksheets are document.write()n into an about:blank tab, so the tab has no real URL: reloading it, or letting Chrome restore the session, g |
| MINOR | yes | Buttons that remove themselves when pressed ("Undo the clear", "Clear her scores, keep what I typed") leave focus sitting on a display:none  |
| MINOR | yes | The message strip is the tool's only status channel — it carries "Cleared. Press Undo the clear", "Sample cleared", and the critical "THIS A |
| MINOR | contrived | Export PDF has no page-break check around the Strengths and Stretches paragraphs, so once the two notes get long the tail of the Stretches n |
| MINOR | yes | Every label and colour swatch in the Distribution legend shows a hand cursor and does nothing; the small wedges an inch to the left are the  |
| MINOR | yes | The one sentence that explains what E, D and M mean is the hardest text on the page to read — 3.03:1, below the 4.5:1 minimum. |
| MINOR | yes | Initials with no A-Z/0-9 character (Ö.Ç., 李明, Cyrillic м.т.) make every export file be named 'no-initials' while the record inside names the |
| MINOR | yes | On all 19 review worksheets the sort activity says 'Check off each word — one is done for you', but the word already sitting in the first bo |
| COSMETIC | yes | With 'All Lessons' chosen, the printed report header and the JSON export both call the unit 'all' where the screen says 'All Lessons'. |
| COSMETIC | yes | The chart key's percentages add up to 99% or 101% — three lessons, one at each level, prints 33% / 33% / 33%. |
| COSMETIC | contrived | savedText() truncates stored initials with a plain slice(0,4) on UTF-16 code units, which can cut an emoji in half and leave an unpaired sur |
| COSMETIC | yes | Saying the same status message twice makes the first message's timer clear the second one early. |
| COSMETIC | contrived | index.html begins with a bare <html> tag — no <!DOCTYPE html> and no lang attribute — so Chrome renders the whole tool in quirks mode, unlik |
| COSMETIC | yes | Neither modal responds to the Escape key, and once you scroll the 128-lesson picker the close "x" is thousands of pixels above the viewport. |
| COSMETIC | yes | Three generated worksheets use an entire teaching sentence as the document <title>, up to 122 characters, which is what the browser tab and  |
| COSMETIC | yes | index.html has no @media print rule of its own, so File > Print on the tracker prints the Get practice sheets / Export PDF / Export JSON / E |
| COSMETIC | yes | The page ships with no favicon, no <html lang>, and no meta description — the browser tab shows a bare grey globe next to "UFLI Foundations  |
| COSMETIC | contrived | Same root cause as above, stated as the code fact it rests on: exportPDF() guards page breaks only for the 'Needs Work In' section; the Stre |
| COSMETIC | yes | The bottom action row mixes two typefaces: the six <button>s fall back to Arial while the one <a> styled to match them renders in the system |
| COSMETIC | yes | The tool's chosen page background (#E8D4C4) is dead CSS — an inline style on <body> overrides it, so the page always renders on plain white. |
| COSMETIC | yes | The Lesson 46 (voiced th) worksheet prints a word-family row labelled 'big' over mother / father / brother / other — the label is not the fa |
| COSMETIC | yes | Pressing Clear a second time replaces "Cleared. Press 'Undo the clear' if that was not what you meant." with "There is nothing to clear yet. |

---

## banner-fix-button-deletes-real-scores

**BLOCKER** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/phonics-assessment-tool/index.html:731

**What:** The sample banner's "Clear her scores, keep what I typed" button also deletes the teacher's own scores, says it kept what they typed, offers no undo, and writes the loss to storage so a reload cannot get it back.

**Steps:**

```
Chrome via puppeteer, tool served on http://127.0.0.1 (scratchpad/t7-startmyown.js, run twice, identical both times). 1) localStorage.clear() then load index.html — first visit, Maya Torres' sample is on screen (8 E / 10 D / 39 M). 2) Select the Child box, type "R.P." — the banner flips to the mixed warning "These are still Maya Torres' scores... Clear her scores, keep what I typed". 3) Pick "Unit 6: R-Controlled & Other Vowels" — a unit Maya has NO scores in — and click M on Lessons 77, 78, 79, 80. Counts go 8/10/43; scores{L77..L80} = Mastered. 4) Type a comment of your own in Strengths. 5) Click the banner button #startMineBtn. 6) Read counts, scores, #sayMsg, #undoBtn, then reload the page.
```

**Observed vs expected:** Observed: after step 5 counts = 0/0/0 and Lessons 77-80 are all null — the four real scores are gone along with Maya's; the message reads "Maya's scores are gone. Your initials and anything you wrote are still here."; #undoBtn stays display:none; saveWork() has already written the emptied record, so after the reload counts are still 0/0/0 and the scores are unrecoverable. (Initials "R.P." and the comment do survive.) Expected: either the button keeps the scores the teacher entered themselves, or it says out loud that every score goes and offers the same Undo the general Clear button offers. index.html:731 calls clearSample(), which at index.html:688 calls wipe() — wipe() nulls every key in `

## clear-sample-eats-real-work

**BLOCKER** — reachable  
**Where:** phonics-assessment-tool/index.html:685

**What:** "Clear the sample" — the button the banner tells every first-time teacher to press — wipes the teacher's own scores, initials and comments with no confirmation, no undo button, and overwrites the saved record, so a reload cannot get them back. The neighbouring "Clear" button, which destroys exactly the same thing, asks first and offers Undo.

**Steps:**

```
Chrome via puppeteer over http://127.0.0.1:PORT/index.html, localStorage cleared first (scratchpad probes p1.js case P1, p2.js case A, p5.js case T — all three run and reproduced).
1. Open the tool fresh. The sample student Maya Torres loads and the banner reads "...Press Clear the sample to start your own."
2. Unit dropdown -> "Unit 3: Digraphs".
3. Click M on Lesson 46, D on Lesson 47, E on Lesson 48 (a real child being scored on the screen the tool opened with).
4. Type into the Strengths box: "Ellie blends VCe well when I cover the e."
5. Wait 400ms; confirm localStorage 'ufli-assessment' holds strengths = "Ellie blends VCe well when I cover the e."
6. Click the toolbar button "Clear the sample" — exactly what the banner instructed.
7. Read window.__confirmed.length, #undoBtn visibility, and localStorage again; then reload the page.
Variant also run (p1.js/p2.js): first type your own initials J.M. over M.T. so the banner switches to "These are still Maya Torres' scores", then score
```

**Observed vs expected:** Observed: window.__confirmed.length === 0 (no confirm dialog at all); #undoBtn.offsetParent === null (no Undo offered); saved record immediately becomes strengths:"" with 0 scores; after reload the screen reads tallies {e:0,d:0,m:0}, initials "", both comment boxes empty. The work is gone with no recovery path of any kind. Expected: either the same guard the sibling "Clear" button has (confirm + "Undo the clear"), or the behaviour of the banner's own "Clear her scores, keep what I typed" button, which removes only Maya's data and keeps what the teacher typed. Root cause is state, not wording: isSample stays true for the whole session no matter how much real work is layered on top, and clearS

## print-page-clips-scores-and-comments

**BUG** — reachable  
**Where:** index.html:55

**What:** Printing the tool — the fallback it names itself when the PDF library is blocked — puts 5 of 128 lessons and a third of each comment on paper, beside tallies that say 43/43/42.

**Steps:**

```
Server: node http server on 127.0.0.1 serving phonics-assessment-tool/. Chrome via puppeteer-core, viewport 1280x1000. 1) load /index.html, localStorage.clear(), reload. 2) score every one of the 128 lessons (rotating E/D/M) and choose 'All Lessons' in the unit dropdown. 3) paste a 12-sentence note into both Strengths and Stretches. 4) page.emulateMediaType('print') — i.e. exactly what File > Print renders — then measure #lessonsList and both textareas, take a full-page screenshot, and page.pdf({format:'A4'}).
```

**Observed vs expected:** Observed on the printed rendering: #lessonsList computed overflow-y 'auto', max-height 350px, clientHeight 350 vs scrollHeight 8054; 128 rows exist, 5 are fully on the page (Lesson 1 through Lesson 5, with Lesson 6 half-cut). Each comment box prints clientHeight 78 of scrollHeight 262 — roughly the first third of the note, mid-sentence. The printed PDF is 2 pages. On that same printed page the three tallies read 43 / 43 / 42 and the chart legend claims 128 lessons scored. Expected: the print surface either lists every scored lesson and the full comments, or does not present itself as a record of them — the tallies and the list on one sheet of paper must not disagree. The tool's own advice wh

## worksheet-skill-mismatch

**BUG** — reachable  
**Where:** index.html:1901

**What:** For six lessons the Generate button opens a practice sheet for a different skill than the row it sits on — Lesson 90 'oo /ū/ (moon)' opens the 'as in book' sheet, Lesson 113 'ear /ir/ (hear)' opens 'ear saying /er/'.

**Steps:**

```
Enumerated all 128 lessons, then re-ran the six worst by hand through the real UI. Click path used for each: click 'Get practice sheets', read the picker row text, click that row's Generate button, read the <h1> and word grid of the page it writes into the new tab. Also re-ran the flagged-skill path: clear the sample, choose 'Unit 6: R-Controlled & Other Vowels', click E on Lesson 90, click the Emerging tally tile, click 'Get practice worksheet' on the Lesson 90 line.
```

**Observed vs expected:** picker row 'Lesson 90: oo /ū/ (moon)' -> sheet 'Vowel Team oo — Reading & Spelling the Short /oo/ Sound (as in book)', words book look took good foot. picker row 'Lesson 89: oo, u /oo/' -> sheet '... Long /oo/ Sound (as in moon)', words moon food room zoo — the two sheets are the wrong way round against the row that explicitly names moon. 'Lesson 113: ear /ir/ (hear)' -> sheet 'ear Saying /er/', words earth early earn learn heard — the opposite sound to the one the row names. 'Lesson 10: CVC Practice (a, i)' -> sheet 'CVC Practice — g & i', sorting columns 'has g (gas)' / 'has i (pig)'. 'Lesson 94: ea /ĕ/ (head), a /ŏ/ (want)' -> sheet 'The Schwa a — Words that End in a Quiet a', words sofa 

## stale-tab-overwrites-saved-assessment

**BUG** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/phonics-assessment-tool/index.html:548

**What:** A second tab of the tool silently overwrites the saved assessment made in the first tab. Each tab writes its whole in-memory snapshot to the single localStorage record on every change, and nothing listens for the `storage` event, so the older tab's stale view wins the last write. The first tab keeps showing the work on screen, so nothing looks wrong until it is reloaded or reopened — then the assessment is gone, with no warning and no Undo.

**Steps:**

```
Served the folder over http on 127.0.0.1 and drove real Chrome (scratchpad/e2.js and e2b.js).
1. Tab A: load index.html, localStorage.clear(), reload, click #sampleBtn to clear Maya.
2. Tab A: select 'Unit 3: Digraphs', type initials 'A.B.', type 'Forty minutes of real notes about a real child.' into #strengthsComment, score Lesson 42=Emerging, 43=Developing, 44/45/46=Mastered. Wait 500ms. Tallies read {e:1,d:1,m:3} and localStorage contains 'Forty minutes'.
3. Open the tool a SECOND time in the same browser (tab B). Tab B correctly loads A's work: tallies {e:1,d:1,m:3}, child 'A.B.'.
4. In tab B do one ordinary thing — e2.js typed a single character into #initials; e2b.js pressed Clear and confirmed. Wait 500ms.
5. Read localStorage: /Forty minutes/ is now false and every score in the record is null.
6. Tab A still shows {e:1,d:1,m:3} and 'A.B.' on screen, and its #undoBtn is hidden (it did nothing to undo).
7. Close tab B, reload tab A.
```

**Observed vs expected:** Observed after the reload of tab A: tallies {e:0,d:0,m:0}, initials '', strengths '', sample banner false, #sayMsg ''. The whole assessment is gone and the tool says nothing at all. Expected: the tool should not let a second view of the same record silently destroy the first — either notice the record changed underneath it (a `storage` listener), or say so before overwriting. grep confirms index.html registers no 'storage', 'beforeunload', 'pagehide' or 'visibilitychange' handler anywhere.

## phantom-lesson-from-inherited-key

**BUG** — contrived  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/phonics-assessment-tool/index.html:596

**What:** A saved score whose lesson name is an ordinary object property (`toString`, `valueOf`, `constructor`, `hasOwnProperty`) passes the `k in scores` guard, because `in` walks the prototype chain. It becomes a real score: the tallies count it, the pie chart's percentages are computed from it, and the CSV and JSON exports carry a row for it — but no lesson on screen is scored and the list behind the tally says 'No lessons at this level'. The arithmetic is silently wrong and the tool never says a word.

**Steps:**

```
scratchpad/e5.js section A, real Chrome over http, run twice with identical results.
1. Load index.html, localStorage.clear().
2. localStorage.setItem('ufli-assessment', '{"sampleCleared":true,"unit":"Unit 3: Digraphs","initials":"A.B.","scores":{"Lesson 42":"Mastered","toString":"Mastered","valueOf":"Emerging"}}')
3. Reload.
4. Read the three count tiles, the scored buttons in #lessonsList, showLessonsByScore('m') and ('e'), the #pieChart text nodes, and exportCSV().
5. Then score one more real lesson (setScore('Lesson 43','Emerging')) and re-read localStorage.
```

**Observed vs expected:** Tiles read {e:1, d:0, m:2}. Only ONE button on screen is scored: Lesson 42=Mastered. Clicking the Emerging tile shows 'No lessons at this level.' while the tile says 1. The chart key prints 'Emerging — 1 (33%)' and 'Mastered — 2 (67%)' — percentages computed over a lesson that does not exist. The CSV gains two rows with an empty Unit and an empty Skill: 'A.B.,2026-08-08,,,toString,,Mastered,,' and 'A.B.,2026-08-08,,,valueOf,,Emerging,,'. Exported JSON has scores {"toString":"Mastered","valueOf":"Emerging"} with skills {"toString":"","valueOf":""}. #sayMsg is ''. After scoring one more real lesson the phantom is written straight back to storage (/"toString":"Mastered"/ still true) and the til

## unreadable-record-silently-becomes-maya

**BUG** — contrived  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/phonics-assessment-tool/index.html:562

**What:** When the saved record cannot be parsed — a write cut off half way, for instance — readSaved() swallows the error and returns null, so start() treats the visit as a first visit and loads the sample student. A teacher's real assessment is replaced on screen by Maya Torres' 57 made-up scores with nothing said, and the damaged record is then overwritten by the sample's own save, so there is nothing left to recover by hand.

**Steps:**

```
scratchpad/e5.js section D, real Chrome over http.
1. Load index.html, localStorage.clear(), reload, click #sampleBtn to clear Maya.
2. Select 'Unit 3: Digraphs', type initials 'A.B.', score Lessons 42/43/44 Mastered. Wait 400ms. Tallies {e:0,d:0,m:3}; read the saved record into `good`.
3. Simulate a write that was cut off: localStorage.setItem('ufli-assessment', good.slice(0, Math.floor(good.length*0.6))).
4. Reload and read the tiles, the Child box, the sample banner, #sayMsg, and localStorage.
```

**Observed vs expected:** After the reload the tiles read {e:8, d:10, m:39}, the Child box reads 'M.T.', the sample banner is showing, and #sayMsg is '' — not one word about the record that could not be read. localStorage now holds the sample (/Maya|M.T./ matches), so the truncated record is destroyed too. Expected: an unreadable record is a failure the tool should own up to, the way it already does when a save is refused ('THIS ASSESSMENT IS NOT BEING SAVED …'). The existing suite's 'a record that is not even JSON' case only asserts that nothing crashes and no programmer's junk shows — it never asserts that the teacher is told, and never sets up real work to lose first.

## undo-clobbers-later-work

**BUG** — reachable  
**Where:** phonics-assessment-tool/index.html:1384

**What:** "Undo the clear" never expires: it stays on screen for the rest of the session and, once the teacher has started the next child, pressing it silently destroys that new work with no question and no second undo.

**Steps:**

```
Served the folder over http://127.0.0.1:<port> and drove real clicks in headless Chrome (script: /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/s6.js, repeated 3x, identical each time).
1. Open the tool, press "Clear the sample".
2. Unit 3, score Lesson 42 = E.
3. Press "Clear", answer yes to the confirm. Undo button appears, message: 'Cleared. Press "Undo the clear" if that was not what you meant.'
4. Now start the next child: pick Unit 2, score Lesson 35 = M and Lesson 36 = M, type "child two" in the Stretches box, wait 400ms so it saves.
5. The Undo button is STILL visible (verified offsetParent !== null; in a separate run it was still visible 31s later, long after its explanatory message had timed out at 30s).
6. Press "Undo the clear".
```

**Observed vs expected:** Observed: no confirm is asked (window.confirm called 0 times); the tallies snap back to {e:1,d:0,m:0} (child one), the Stretches box is emptied, and localStorage's record now has stretches:"" and Lesson 35: null — child two's scores and notes are gone from screen AND from storage, and undoSnapshot is set to null so there is no way back. Same result via the "undo after a unit switch" route and via loading the sample after a clear (Undo wiped Maya's 57 scores with no question either). Expected: the offer to undo should either expire / disappear once new work has been started, or at minimum ask before overwriting work that was created after the clear.

## score-behind-open-dialog

**BUG** — reachable  
**Where:** phonics-assessment-tool/index.html:978

**What:** With the lessons list open, Tab walks the keyboard onto the score buttons hidden behind the sheet, and Enter there silently changes a score — while the open list goes on showing the old, now-wrong information.

**Steps:**

```
Same harness (s6.js, 3/3 identical).
1. Press "Clear the sample", pick Unit 3, score Lesson 42 = E.
2. Focus the blue Emerging tally and press Enter — the "Emerging / Beginning Lessons" dialog opens listing Lesson 42.
3. Press Tab six times.
4. Press Enter.
Also measured from the same starting point: it takes 42 Tab presses to reach the dialog's own first button ("Get practice worksheet"), and 41 of those 42 stops are on controls hidden behind the sheet.
```

**Observed vs expected:** Observed: after 6 Tabs the keyboard is standing on the Mastered button of Lesson 42 — document.elementFromPoint says that button is covered by the modal (covered:true, inModal:false), so the teacher cannot see what they are standing on. Enter moves Lesson 42 from Emerging to Mastered (tallies behind the sheet go {e:1,m:0} -> {e:0,m:1}, and the change is written to localStorage), while the dialog still reads "Emerging / Beginning Lessons — Lesson 42", which is now untrue. Expected: while the dialog is open the keyboard should stay inside it (focus trap), and nothing behind it should be operable.

## main-page-print-silently-truncated

**BUG** — reachable

**What:** The main tool page has no @media print rules at all, so File > Print produces a plausible-looking but silently incomplete record: 5 of 128 lessons, a comment cut off mid-sentence, and seven UI buttons on the paper. The tool itself recommends this path when the CDN is blocked.

**Steps:**

```
Serve the repo on 127.0.0.1 and open /phonics-assessment-tool/index.html in Chrome. Abort every request to cdnjs.cloudflare.com (a school content filter — the case the tool's own message names). Choose "All Lessons" in SELECT UNIT. Type a 275-character comment into Strengths. Click "Export PDF". The tool prints into #sayMsg: "The PDF maker did not load... Nothing is lost: Export CSV holds every score and both comment boxes, and File > Print will save this page as a PDF." Now do exactly that — emulateMediaType('print') / Cmd-P. Script: scratchpad/stranger-lens/t20.js. Also reproduced without the firewall in t18.js and main-print-all.png.
```

**Observed vs expected:** Observed on the printed page: lessonsOnPaper = 5, lessonsInRecord = 128 (last row on paper is "Lesson 5: VC & CVC Words"); the Strengths comment shows commentClientH 78 of commentScrollH 92 and stops mid-sentence; and these seven buttons print onto the sheet: "Get practice sheets", "Reading practice — all 128 lessons", "Export PDF", "Export JSON", "Export CSV", "Clear the sample", "Clear". With a longer 684-character comment only 44% of it prints (clientH 78 of scrollH 177). Expected: the printed page carries every scored lesson and the whole of both comments, and drops the buttons — or, at minimum, the tool does not tell the teacher to print when printing loses most of the record. grep conf

## worksheet-print-splits-mid-activity

**BUG** — reachable

**What:** Generated practice worksheets carry no page-break CSS, so activity rows and sorting boxes are sliced horizontally in half by the page break. 48 of 128 sheets have at least one element straddling a break; 40 have a section heading stranded at the foot of a page.

**Steps:**

```
Open /phonics-assessment-tool/index.html, click "Get practice sheets", click "Generate" on Lesson 35 (Short a — a core early lesson), then print the worksheet that opens. The sheet declares its own @page { size: letter; margin: 0.75in }, so the printable box is 672 x 912 CSS px. I laid each generated sheet out at 672px in print media and computed the breaks, then validated the model against Chrome's own PDF page tree: predicted 2/4/2/4 pages for Lessons 2/35/66/54, Chrome produced 2/4/2/4. Scripts: scratchpad/stranger-lens/t9.js (128-sheet sweep, pagination.json), t10.js and t11.js (page-break rulers drawn in red, crops saved as crop-Lesson_35-b2.png and crop-Lesson_69-b3.png).
```

**Observed vs expected:** Lesson 35, section "5 · Change one sound": the row "man → change n to d → [ ][ ][ ]" spans y=1801..1855 across the break at y=1824, so the word "man" and its answer boxes are cut through the middle — the top half prints on page 2 and the bottom half on page 3 (see crop-Lesson_35-b2.png). Lesson 69, section "8 · Sort the words": both sorting boxes span y=2689..2821 across the break at y=2736, so the headers "HAS /CH/ (LIKE CATCH)" / "NO /CH/" and the worked example "catch" print at the foot of page 3 while the empty space the child writes in prints on page 4 (crop-Lesson_69-b3.png). Same pattern on Lessons 36, 37, 39, 40, 44, 54, 55, 56, 58, 60, 61, 70, 74 and 34 others. Lesson 2 strands the 

## clear-the-sample-wipes-real-work-without-asking

**BUG** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/phonics-assessment-tool/index.html:685

**What:** "Clear the sample" destroys the teacher's own initials, comments and scores with no confirmation and no Undo, then saves the empty record — while the general "Clear" button beside it does ask and does offer Undo.

**Steps:**

```
Chrome via puppeteer over http (scratchpad/t11-clearsample.js). 1) localStorage.clear(), load index.html — Maya's sample is on screen and the banner says "Press Clear the sample to start your own". 2) Type "R.P." over the Child box. 3) Pick Unit 6 and click D on the first five lessons (77-81). 4) Type "My own words about R." into Strengths. State before: counts 8/15/39, those five lessons Developing, comment present. 5) Click #sampleBtn ("Clear the sample"). window.confirm is stubbed and recorded. 6) Read counts/scores/initials/comment/#undoBtn, then reload.
```

**Observed vs expected:** Observed: window.confirm was never called (recorded list is empty); counts drop to 0/0/0, the five Developing scores are null, initials become "" and the Strengths comment is emptied; #undoBtn is not shown; the record is saved immediately, so after a reload everything is still gone. The message says "Sample cleared. The tool is empty and ready for your own assessment." Expected: the same treatment the "Clear" button gets three buttons along — a confirm that names what will go, and an Undo. clearSample() (index.html:685) calls wipe() and saveWork() with no confirm and without setting undoSnapshot.

## not-saved-warning-below-the-fold

**BUG** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/phonics-assessment-tool/index.html:305

**What:** When the browser refuses to store anything, the "THIS ASSESSMENT IS NOT BEING SAVED" warning is painted below the fold on every screen size, while the part of the page the teacher can see carries a reassuring "Stays on this laptop" badge.

**Steps:**

```
Chrome via puppeteer over http (scratchpad/t5-warning.js and t9-shot.js). Before navigation, make localStorage throw the way a private window / blocked-cookies profile does: page.evaluateOnNewDocument(() => Object.defineProperty(window,'localStorage',{get(){const e=new Error('The operation is insecure.');e.name='SecurityError';throw e;}})). Load index.html at four viewports and measure getBoundingClientRect() of #sayMsg at scrollY 0.
```

**Observed vs expected:** Observed: the warning text is set correctly but sits entirely off screen at scrollY 0 in every case — MacBook Air 1440x800: top 1122, viewport 800; 1280x720: top 1157; iPad portrait 810x1080: top 1203; iPhone 390x844: top 1877. anyInView=false in all four. A screenshot of the first screen shows no mention of saving at all; what IS visible, top right, is the badge "● Stays on this laptop" (index.html:196), which in this state is untrue. Scrolling all the way to the bottom does bring it into view (top 707). Expected: the one message that says a teacher's morning is not being stored should be shown where they are working — near the header or as a sticky bar — not in the button row at the foot o

## real-record-stamped-sample-for-ever

**BUG** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/phonics-assessment-tool/index.html:1146

**What:** The saved `sample` flag survives every reload and there is no way to turn it off that keeps the scores, so a real child's CSV/JSON/filename carry "Maya Torres — made-up scores, not a real child" indefinitely.

**Steps:**

```
Chrome via puppeteer over http (scratchpad/t10-stamp.js). 1) localStorage.clear(), load index.html — the sample is on screen. 2) Type "R.P." over the Child box, set the date to 2026-06-02, type your own text into both comment boxes. 3) Pick Unit 3 and re-score every lesson Maya had at Emerging to Developing, i.e. replace her results with the real child's. 4) Click Export CSV and read the filename and first row. 5) Reload the page. 6) Click Export CSV and Export JSON again.
```

**Observed vs expected:** Observed: both before and after the reload the file is named ufli_assessment_SAMPLE-RP_2026-06-02.csv and every row reads R.P.,2026-06-02,Maya Torres,...; the JSON says "sampleStudent": "Maya Torres" and "note": "SAMPLE STUDENT — Maya Torres. Made-up scores, not a real child."; the stored record still has sample:true. The only two buttons that clear the flag — "Clear her scores, keep what I typed" and "Clear the sample" — both delete every score (see the two findings above), so a teacher who has done a real assessment on top of the sample cannot get an unstamped export without redoing the whole assessment. Expected: a record whose initials, date, comments and scores have all been replaced by

## corrupt-record-opens-as-if-nothing-was-wrong

**BUG** — contrived  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/phonics-assessment-tool/index.html:585

**What:** A parseable record with damaged parts is loaded with those parts silently thrown away — no message anywhere — and the first click then overwrites the original bytes with the reduced version.

**Steps:**

```
Chrome via puppeteer over http (scratchpad/t2-corrupt.js: 29 seeded records; scratchpad/t6-destroy.js: the three destructive ones). For each, localStorage.setItem('ufli-assessment', <record>) then reload and read the screen, #sayMsg, and localStorage. (a) {initials:"A.B.",date:"2026-03-09",unit:"Unit 3: Digraphs",scores:null,strengths:"Reads CVC words alone.",stretches:"th and wh.",sampleCleared:true} — same for scores:["Mastered","Mastered"]. Then click M on Lesson 42 and re-read localStorage. (b) same record but date:"2026-02-31" (also tried "03/09/2026" and "2026-03-09T08:00:00Z") with two real scores; then click one more score and re-read the stored date. (c) scores:{"Lesson 42":"mastered","Lesson 43":"Developing ","Lesson 44":"M","Lesson 45":3,"Lesson 46":"Emerging"}.
```

**Observed vs expected:** Observed (a): the tool opens showing A.B., the right date, the right unit and both of the teacher's comments — and 0/0/0 in the chart and the three count tiles, with #sayMsg empty and nothing anywhere on the page matching /could not|problem|damag|corrupt|refus|not read/. One click on a score button then rewrites the record, so the original bytes are gone. (b) the date box comes back blank with no message, and one further score writes date:"" over "2026-02-31" permanently — the CSV/JSON then say no-date. (c) five scores in the record, one on screen: counts 0/0/1, silently. Expected, per the tool's own rule that a half-written record must not be trusted: say so on screen — "part of the saved a

## blank-white-page-when-cdn-hangs

**BUG** — reachable

**What:** The two cdnjs <script> tags sit in <head> with no defer/async, so if the CDN hangs (school filter that drops packets rather than refusing them) the whole tracker is a blank white page forever — even though nothing on the page needs those libraries to render.

**Steps:**

```
Served the repo root over http on 127.0.0.1 in Chrome with request interception. Any request to cdnjs.cloudflare.com is left pending (never resolved, never aborted) — a black-holed filter, not a refused one. Then loaded http://127.0.0.1:PORT/phonics-assessment-tool/index.html and polled document.body.innerText.length every 250ms. Ran the same three times in a row (scratchpad/stranger/t-slow4.js), plus an instrumented run at a 25s delay (t-slow3.js) and a poll run at an 8s delay (t-slowcdn.js).
```

**Observed vs expected:** Observed: body innerText length stayed 0 and there was no <h1> for the whole 40-second window in all three runs; document.readyState stayed "loading". With the 25s-delay run, DOMContentLoaded did not fire until 12,049ms — twelve seconds of white screen. Expected: the page paints immediately and only "Export PDF" degrades, exactly as it already does when the CDN fails fast (the existing suite's BLOCK_CDN abort path renders fine and passes). Every byte of the tool is inline in index.html; the CDN scripts are only needed by exportPDF(), which already has a graceful "The PDF maker did not load" message. Adding defer to both tags removes the blank page entirely.

## worksheet-says-flagged-for-a-skill-that-is-mastered-or-unassessed

**BUG** — reachable

**What:** Every generated worksheet is stamped "Flagged skill" and "Generated from the assessment. This practice matches the one skill your reader is still building" — even when the picker was used to generate a lesson the child scored Mastered, or when nothing has been assessed at all.

**Steps:**

```
Case A (scratchpad/stranger/t-flag.js): loaded the tool cold, clicked "Clear the sample" (0 lessons scored), chose Unit 3: Digraphs, clicked the M button on Lesson 45 so scores['Lesson 45'] === 'Mastered', then clicked "Get practice sheets" and clicked Generate on Lesson 45. Case B (scratchpad/stranger/t-final.js): cleared the sample so Object.values(scores).filter(Boolean).length === 0, then clicked Generate on Lesson 12.
```

**Observed vs expected:** Observed, Case A: the printed sheet reads "Digraph sh — Reading & Spelling Words with sh / Flagged skill / Generated from the assessment. This practice matches the one skill your reader is still building." for a lesson the teacher just marked Mastered. Observed, Case B: with zero lessons ever assessed, the Lesson 12 sheet carries the same "Flagged skill" badge and the same "Generated from the assessment" sentence. Expected: the badge and that sentence appear only when that lesson's score is actually Emerging or Developing; otherwise the sheet should say nothing about the assessment. This is a false statement printed on a page that goes home to a parent.

## unused-html2canvas-blocks-first-paint

**BUG** — reachable

**What:** The page holds itself blank waiting for html2canvas — a library it loads from a CDN in <head> and then never calls once.

**Steps:**

```
1. Serve the repo over http on 127.0.0.1 and open /phonics-assessment-tool/index.html in Chrome (puppeteer-core, scratchpad/stranger/t10.js and t11.js).
2. TEST A (is it used?): intercept and ABORT only https://cdnjs.cloudflare.com/.../html2canvas/1.4.1/html2canvas.min.js; answer the jspdf request normally. Load the page, then drive everything a teacher touches: click a score button, openWorksheetPicker + close, showLessonsByScore('m') + close, exportPDF(), exportCSV(), exportJSON(), openWorksheet('Lesson 45').
3. TEST B (what it costs): delay ONLY the html2canvas response by 4000ms, answer every other cdnjs request instantly, then poll every 100ms for getBoundingClientRect().height of '.header h1' to become > 0.
```

**Observed vs expected:** TEST A: window.html2canvas === 'undefined', yet the page renders fully (scrollHeight > 500, 12 lesson rows, 3 chart wedges), the PDF still saves as ufli_assessment_report_SAMPLE-MT_2026-08-08.pdf with 39 lines of text, every export and worksheet works, and there are ZERO page errors — the only console line is the aborted request itself. `grep -c html2canvas index.html` returns 1: the <script> tag on line 6 is the sole occurrence in the whole 2613-line file. TEST B: the page heading did not paint until 4081ms after navigation start (window load at 4084ms). Expected: a script that is never referenced should not be fetched at all, and certainly not as a render-blocking <head> tag with no defer/

## letter-qu-worksheet-says-ququ

**BUG** — reachable

**What:** The Lesson 32 practice sheet a parent prints tells them "This is the letter Ququ", and the browser tab reads "Practice — Letter Ququ".

**Steps:**

```
1. Open /phonics-assessment-tool/index.html cold (scratchpad/stranger/t17.js, real window.open, no stubbing of the child tab).
2. Real-click the first button in the bottom action row, "Get practice sheets".
3. In the picker, find the row whose text starts "Lesson 32" (it reads "Lesson 32: qu /kw/ | Generate | Reading practice"), scrollIntoView, and real-click its Generate button.
4. Read document.title and the '.tip' block of the tab that opens.
```

**Observed vs expected:** New tab title: "Practice — Letter Ququ". The FOR THE GROWN-UP · START HERE paragraph reads: "This is the letter Ququ. It says /kw/, like the start of quit...". The <h1> on the same sheet correctly says "Letter Qu — the /kw/ Sound", so the sheet contradicts itself. Cause is index.html:2462 and the title string, both `${c.Letter}${c.letter}` — fine for one-character letters ("Aa", "Xx") but "Qu"+"qu" for the only two-character one. Expected "Qu qu" or "Qu". Swept all 128 lessons by calling each builder in-page: Lesson 32 is the only one affected, and no worksheet contains undefined/null/NaN/[object.

## worksheet-answer-boxes-dont-match-the-sum-they-print

**BUG** — reachable

**What:** On the Lesson 119 and Lesson 120 practice sheets the answer boxes are drawn from the correct word, but the equation printed beside them adds a different number of letters — so a child following the instruction runs out of boxes (or has one left over) on 10 rows.

**Steps:**

```
node harness, real Chrome over http://127.0.0.1:PORT/index.html (server = node http, ROOT = phonics-assessment-tool). Closed-loop path actually executed: click 'Clear the sample' -> select 'Unit 8: Affixes & Advanced Patterns' -> click E on 'Lesson 119' -> click the 'Emerging / Beginning' tally tile -> click 'Get practice worksheet' in the modal. Captured the exact HTML the tool writes into the new tab, rendered it in a second real tab, and counted .abox elements per .mrow in section '2 · Add the ending tion'. Screenshot saved at /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/l119-section2.png. Same via 'Get practice sheets' -> row 'Lesson 120: -ture' -> Generate (screenshot l120-section2.png). Enumerated all 156 add-rows across all 26 ending sheets and all 128 worksheets.
```

**Observed vs expected:** Lesson 119, hint reads 'Add tion to the base word. Write the new word, one letter in each box.' Rows printed: 'act + tion =' 6 boxes (a-c-t-t-i-o-n is 7); 'invent + tion' 9 (10); 'protect + tion' 10 (11); 'correct + tion' 10 (11); 'collect + tion' 10 (11); 'subtract + tion' 11 (12) — all 6 rows off by one. The grown-up tip repeats it: 'add tion on the end: act -> action'. Lesson 120: 'depart + ture' 9 boxes (departture is 10), 'sculpt + ture' 9 (10), 'sign + ture' 9 but sign+ture is only 8, 'moist + ture' 8 (9); only mix/fix are right. Expected: the boxes and the printed sum describe the same word (they do on the other 24 ending sheets, and on Lessons 107/108/109/110 the difference is the do

## fix-button-keeps-mayas-words-and-drops-the-warning

**BUG** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/phonics-assessment-tool/index.html:734

**What:** "Clear her scores, keep what I typed" keeps Maya Torres' entire invented comment paragraph — and removes the banner that said it was invented — whenever the teacher edited that box instead of retyping it from scratch. The record is then marked as NOT a sample, so nothing on screen or in any export says those sentences are made up about a made-up child.

**Steps:**

```
Executed in headless Chrome (puppeteer-core) against a node http server on 127.0.0.1 serving the tool folder; scripts /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/probe7.js and probe9.js. 1) localStorage.clear(), reload — the Maya Torres sample loads. 2) Click the Child box, select all, type "JM". The banner switches to "These are still Maya Torres' scores... every score, and both comment boxes, still belong to the made-up sample student" and the button "Clear her scores, keep what I typed" (#startMineBtn) appears — verified visible via offsetParent. 3) Click into the Stretches box, press Cmd+Down to reach the end of her text, type " Drill nk." — i.e. add to her paragraph rather than replace it. 4) Wait 400ms so the 300ms save debounce has landed. 5) Click #startMineBtn. 6) Read the boxes, snapshot().sample, and the banner. 7) Reload and read again. 8) Click Export CSV and read the blob text and download filename.
```

**Observed vs expected:** OBSERVED after pressing the button: initials "JM" kept (right), all 57 sample scores gone (right), sample banner gone, snapshot().sample === false, Strengths box "" (right — it was never touched), but the Stretches box still holds Maya's whole fabricated paragraph: "th and wh still come out as /f/ and /w/, and she guesses at ng and nk at the end of a word. Magic e is brand new — she reads "c Drill nk.ape" as "cap" about half the time. Ten minutes a day on VCe words, and th cards in the warm-up." It survives a reload unchanged. Exported CSV is named ufli_assessment_JM_2026-08-08.csv (no SAMPLE prefix), its Sample column is empty, "Maya" appears nowhere — and the Stretches cell is her invented

## all-lessons-out-of-order

**MINOR** — reachable  
**Where:** index.html:392

**What:** 'All Lessons' runs 62 → 98 → 84 → 88 → 77 → 97 → 63 → 99: three backwards jumps, and Lesson 98 (silent letters kn/wr/mb) is filed under Unit 4: VCe.

**Steps:**

```
Clear the sample, choose 'All Lessons' in the unit dropdown, read the lesson number off each of the 128 rendered rows in DOM order.
```

**Observed vs expected:** Rendered order: 1..62, 98, 84,85,86,87,88, 77..83, 89..97, 63..76, 99..128. Backwards steps 98→84, 88→77, 97→63. Because the CSV Unit column, the tally modal's grouping and the PDF's 'Needs Work In' headings all read the same curriculum, they all report Lesson 98's unit as 'Unit 4: VCe & Special Patterns' — a silent-letter lesson inside the magic-e unit — and every one of those surfaces inherits the same scrambled order. Expected: scrolling the full list, the lesson numbers go up.

## pdf-mastered-in-overstates

**MINOR** — reachable  
**Where:** index.html:1269

**What:** The printed report says 'Mastered in: • Unit 1' when one lesson out of the unit's 33 is mastered, contradicting the 'Mastered: 1' three lines above it.

**Steps:**

```
Stub window.jspdf with a recording fake, clear the sample, score only Lesson 1 as Mastered, click Export PDF, read the text lines the report asked for.
```

**Observed vs expected:** Report lines: 'Mastered: 1' ... 'Mastered in:' ... '• Unit 1: Alphabet & Sounds'. The unit is listed whenever ANY lesson in it is mastered (index.html:1262 uses .some), so a report that a parent reads says the child has mastered a whole unit on the strength of one lesson, while the summary block on the same page says 1. Expected: either a count beside each unit ('Unit 1: 1 of 33') or the heading wording changed to say 'Some mastery in'.

## dialogs-ignore-escape-and-drop-focus

**MINOR** — reachable  
**Where:** phonics-assessment-tool/index.html:1049

**What:** Neither dialog closes on Escape, and closing the lessons list with the X drops the keyboard back on <body> instead of the tally it was opened from.

**Steps:**

```
Same harness (s3.js / s5.js).
1. Score Lesson 42 = E, focus the Emerging tally, press Enter to open the list.
2. Press Escape.
3. Reopen, then click the X (.close-modal).
4. Separately: open the worksheet picker from the toolbar and press Escape.
```

**Observed vs expected:** Observed: after Escape the lessons dialog still has class "show" (still open); after Escape the worksheet picker is still open too. After closing with the X, document.activeElement is BODY — so a keyboard-only teacher has to Tab in from the top of the document again. This is the same "keyboard thrown away" failure the suite already guards for score buttons, but it is unguarded on the dialogs. Expected: Escape closes the dialog, and focus returns to the control that opened it.

## unit-change-keeps-scroll

**MINOR** — reachable  
**Where:** phonics-assessment-tool/index.html:793

**What:** Choosing a different unit keeps the previous list's scroll position, so the new unit opens part-way down — the first lessons of the unit are scrolled out of sight.

**Steps:**

```
Same harness (s6.js, 3/3 identical).
1. Press "Clear the sample".
2. Pick "Unit 8: Affixes & Advanced Patterns", scroll the lesson box to the bottom.
3. Pick "Unit 1: Alphabet & Sounds" from the dropdown.
Also from "All Lessons" scrolled to 2000px, then Unit 1: the box opens at Lesson 29.
```

**Observed vs expected:** Observed: the lesson box keeps scrollTop 1380, so the top visible row is "Lesson 25: r /r/ Part 2" — Lessons 1 through 24 are hidden above and the unit looks like it starts at 25. Expected: picking a new unit shows that unit from its first lesson. The scroll-keeping in updateLessons() exists so scoring does not jump the list back to the top; unitChanged() reuses the same redraw and inherits it.

## two-tabs-silently-overwrite

**MINOR** — reachable  
**Where:** phonics-assessment-tool/index.html:548

**What:** Two tabs of the tool share one record with last-writer-wins: a score made in one tab is erased by the next save in the other, and the losing tab goes on showing the score that no longer exists.

**Steps:**

```
Same harness (s2.js). Tab 1: clear the sample, Unit 3, score Lesson 42 = E, type initials A.A. Open a second tab on the same URL (it loads the same record). Tab 2: pick Unit 2, score Lesson 35 = M. Back in tab 1: score Lesson 43 = M.
```

**Observed vs expected:** Observed: after tab 1's click, localStorage holds Lesson 42 Emerging and Lesson 43 Mastered, and Lesson 35 is back to null — tab 2's score is gone. Tab 2's screen still shows a Mastered tally of 1 and its own storage read confirms scores['Lesson 35'] === null, so what is on that screen no longer exists anywhere. Nothing warns either tab. Expected: either the second tab notices the record changed under it (storage event) or it says the record is open elsewhere.

## undo-dies-on-reload

**MINOR** — reachable  
**Where:** phonics-assessment-tool/index.html:1375

**What:** Clear writes the emptied record to storage immediately but keeps the only copy of the old one in memory, so a reload inside the 30-second "you can undo this" window makes the assessment unrecoverable.

**Steps:**

```
Same harness (s1.js). Clear the sample, Unit 3, score Lesson 42 = E, press "Clear" and answer yes. The message reads 'Cleared. Press "Undo the clear" if that was not what you meant.' and stays up for 30 seconds. Reload the page inside that window.
```

**Observed vs expected:** Observed: after the reload the Undo button is hidden (offsetParent === null), the tallies are {e:0,d:0,m:0}, and the cleared assessment cannot be recovered — while the message that was on screen a moment before promised it could. Expected: either the undo copy is written to storage alongside the cleared record, or the message does not promise an undo that a refresh destroys.

## debounce-swallows-last-typing

**MINOR** — contrived  
**Where:** phonics-assessment-tool/index.html:614

**What:** Text in the comment boxes is only written to storage 300ms after typing stops, so leaving the page inside that window loses everything typed since the last pause.

**Steps:**

```
Same harness (s4.js). Clear the sample, click into the Strengths box and type "She blends every short vowel word on her own now." at 90ms per key (human speed), then reload immediately. Repeat with a 350ms pause before reloading.
```

**Observed vs expected:** Observed: reloading straight after the last keystroke gives back an empty Strengths box — the whole sentence is gone, because the debounce timer restarts on every keystroke and never fired. With a 350ms pause first, the text comes back intact. Expected: a comment box is not lost by leaving 200ms too early; save on blur/pagehide as well as on the timer. Scores are unaffected (setScore saves synchronously — verified an instant reload after a click keeps the score).

## reading-sheets-816px-wide-on-ipad

**MINOR** — reachable

**What:** Every "Reading practice" link from this tool opens a sheet hard-coded to 8.5in (816px) wide on screen with no max-width, so on an iPad in portrait (768px) the page scrolls sideways and the lesson badge on the right is clipped.

**Steps:**

```
Open /phonics-assessment-tool/index.html at 768x1024, click "Get practice sheets", click "Reading practice" on Lesson 1 (or the header button "Reading practice — all 128 lessons" and then any lesson). Script: scratchpad/stranger-lens/t4.js; screenshot sheet-001-768.png.
```

**Observed vs expected:** document.documentElement.scrollWidth = 816 against clientWidth = 768 on lesson-001.html, lesson-041.html and lesson-128.html; the offending element is `.page`. The cause is `@media screen { .page { ... width: 8.5in; ... } }` at line 23 of the sheet, with no max-width — present in all 128 of decodable-passage-generator/sheets/*.html (grep -l "8.5in" returns 128). Visibly, the "LESSON 1 / a /ă/" badge in the top right is cut off at the viewport edge and the whole sheet must be dragged sideways to read. Expected: the sheet fits the width it is given, the way the phonics tool itself does (its scrollWidth is exactly 768 at that viewport). NOTE: the defect lives in /Users/sahajkashyap/Documents/Gi

## lesson-list-hides-most-of-the-unit

**MINOR** — reachable

**What:** The lesson list is capped at 350px with an overlay scrollbar that takes no width, and the seventh row has exactly 0px showing, so the list looks like it simply ends after six lessons. Unit 1 shows 6 of 34; "All Lessons" shows 6 of 128.

**Steps:**

```
Open /phonics-assessment-tool/index.html at 768x1024 (or 1280x1000 — identical). The default view is Unit 3: Digraphs. Measure #lessonsList. Then step through all nine options of #unitSelect. Scripts: scratchpad/stranger-lens/t19.js and t18.js; screenshot ipad-full.png.
```

**Observed vs expected:** #lessonsList: clientHeight 350, scrollHeight 710, 12 child rows, offsetWidth 294 == clientWidth 294 (so the scrollbar is an overlay and occupies no width — invisible until you already scroll), and pxOfRow7Visible = 0. On screen the box ends cleanly under "Lesson 47: Unvoiced th /th/" with nothing to suggest Lessons 48-53 exist. Per unit, rows vs the 350px window: All Lessons 128 rows / scrollHeight 8054, Unit 1 34 / 1962, Unit 3 12 / 710, Unit 6 16 / 918, Unit 7 14 / 802, Unit 8 30 / 1730. Only Unit 5 (5 rows, 280px) fits. Expected: some affordance — a partial row, a fade, a count, or simply letting the box grow — so a first-time visitor is not told by the layout that Unit 1 contains six les

## score-buttons-shrink-to-29px-on-every-ipad

**MINOR** — reachable

**What:** The responsive breakpoint is max-width:760px, so the rule that makes the E/D/M score buttons finger-sized fires on phones but on no iPad in portrait — the buttons a teacher taps 128 times are 29x26 CSS px with 6px gaps.

**Steps:**

```
scratchpad/stranger/t-tap.js: loaded the tool with hasTouch/isMobile at widths 759, 760, 761, 768, 810, 820, 834 and 1024, and measured getBoundingClientRect() on the first three #lessonsList .btn-score elements plus the gaps between them.
```

**Observed vs expected:** Observed: at 759px and 760px each score button is 214.3 x 30 px (the @media max-width:760px rule sets .score-buttons .btn-score { flex:1; padding:8px 10px }). At 761px and every width above it — which is every iPad in portrait except the mini: iPad 10.2" 810, iPad Air 820, iPad Pro 11" 834 — they collapse to 29.3 x 26, 30 x 26 and 31.2 x 26 px with 6px gaps. Expected: on a touch device the primary tap target should not be 29x26; Apple's HIG minimum is 44x44. There is no overflow and nothing is unreachable, so the existing 390px phone check passes and never sees this. Moving the breakpoint to ~1000px, or gating on (pointer: coarse), covers the iPad.

## worksheet-tab-is-blank-after-reload

**MINOR** — reachable

**What:** Worksheets are document.write()n into an about:blank tab, so the tab has no real URL: reloading it, or letting Chrome restore the session, gives a blank white page with no way back to the tool.

**Steps:**

```
scratchpad/stranger/t-newtab.js: launched with the real window.open (no stub), clicked "Get practice sheets", clicked Generate on Lesson 1, waited for the third browser page, screenshotted it (renders correctly), then called ws.reload() on that tab — exactly what pressing Cmd+R or the reload button does.
```

**Observed vs expected:** Observed: before reload the tab renders the full Letter Aa sheet and its title is "Practice — Letter Aa", but its URL reports as the tracker's own URL (inherited about:blank). After reload: location.href === 'about:blank', document.body.innerHTML.length === 0, innerText === '' — a blank white page. The sheet also contains zero <a href> elements, so there is no link back to the tracker. Expected: reloading a printable worksheet either re-renders it or at minimum does not silently become an empty page. A parent who prints, then reloads or reopens the tab after a browser restart, loses the sheet with no explanation.

## undo-button-drops-the-keyboard

**MINOR** — reachable  
**Where:** phonics-assessment-tool/index.html:1384

**What:** Buttons that remove themselves when pressed ("Undo the clear", "Clear her scores, keep what I typed") leave focus sitting on a display:none element, so the next Tab restarts from the very top of the page instead of continuing from the toolbar.

**Steps:**

```
Chrome via puppeteer (scratchpad p2.js case B, p4.js case P, p5.js cases U and U2).
Undo: fresh load -> unit "Unit 3: Digraphs" -> click M on Lesson 42 -> click "Clear" -> confirm -> focus #undoBtn -> press Enter -> read document.activeElement -> press Tab -> read document.activeElement and its index among visible focusables.
Banner button: fresh load -> select the Child box and type "J.M." (banner switches to the mixed wording) -> focus #startMineBtn -> press Enter -> press Tab.
```

**Observed vs expected:** Observed after Enter on Undo: document.activeElement is still #undoBtn although offsetParent === null (it has just been hidden); one Tab later focus is on #initials, focusable index 0 of 51 — the first control on the page, roughly 49 stops back from where the hands were. After Enter on #startMineBtn: activeElement is still the now-hidden #startMineBtn, and one Tab later focus is on the "Emerging / Beginning" tally tile, index 2 of 51. Expected: focus moves to a sensible neighbour (the "Clear" button beside it, or the toolbar), the way updateLessons() already deliberately restores focus after it rebuilds the score list. A keyboard-only teacher loses their place every time they use either butt

## status-strip-never-announced

**MINOR** — reachable  
**Where:** phonics-assessment-tool/index.html:305

**What:** The message strip is the tool's only status channel — it carries "Cleared. Press Undo the clear", "Sample cleared", and the critical "THIS ASSESSMENT IS NOT BEING SAVED" warning — but it is a bare <div> with no aria-live and no role, and the page contains no live region at all, so none of those state changes is announced.

**Steps:**

```
Chrome via puppeteer (scratchpad p2.js case C, p4.js case R). On a freshly loaded page, read #sayMsg and its ancestor chain for aria-live/role, and query the whole document for [aria-live],[role=status],[role=alert]. Then force the save failure that produces the loudest message: override Storage.prototype.setItem to throw, select "Unit 3: Digraphs" and click M on Lesson 42 (p1.js case P3) — the strip fills with "THIS ASSESSMENT IS NOT BEING SAVED...".
```

**Observed vs expected:** Observed: #sayMsg is <div class="say"> with aria-live null and role null; its ancestors are plain DIVs with neither; document.querySelectorAll('[aria-live],[role=status],[role=alert]') returns an empty list for the entire page. Expected: role="status" (or aria-live="polite", and assertive for the not-being-saved warning) so a teacher using a screen reader is told the assessment was cleared, that Undo exists, and above all that nothing is being saved. Verified by inspecting the DOM for live regions rather than by listening with a screen reader; affects teachers using assistive technology, not sighted mouse users.

## pdf-report-drops-the-end-of-a-long-note

**MINOR** — contrived

**What:** Export PDF has no page-break check around the Strengths and Stretches paragraphs, so once the two notes get long the tail of the Stretches note is drawn past the bottom edge of the A4 page and never appears in the report — while the same text is complete on screen, in the CSV and in the JSON, and the report even continues onto a page 2 for the lesson list, so nothing signals that anything was cut.

**Steps:**

```
Real Chrome, tool served over http://127.0.0.1 from /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/phonics-assessment-tool, with the REAL jsPDF 2.5.1 (fetched from cdnjs and served back through request interception) so the wrapping and line spacing are the library's own; jsPDF's text()/addPage()/save() wrapped only to record where each line is placed. Steps actually executed (scratchpad/repro.js): 1) load index.html, clear localStorage, reload. 2) click 'Clear the sample'. 3) type A.B. in the Child box. 4) in each of the 8 units, click M on the first two lessons and E on the third — 24 real button clicks, so 'Mastered in:' lists all 8 units. 5) paste a 2,198-character Strengths note and a 3,268-character Stretches note ending in the marker text MARKER-THE-VERY-LAST-THING-I-WROTE. 6) click the real Export PDF button. Separately clicked Export CSV to compare. Also swept the capacity boundary at 80/120/150/180/200/220/240/260/300 words per box with 128 lessons scored (scratchpad/x7
```

**Observed vs expected:** Observed: 7 lines of the Stretches note are placed at y = 295.31, 299.37, 303.42, 307.48, 311.54, 315.59 and 319.65 mm on a page that is 297 mm tall — i.e. at and below the bottom edge, so they are not in the printed report. The final line, holding the marker, sits at y=319.65mm, 22mm below the paper. The document still gets a page 2 (for 'Needs Work In'), and the tool says only 'PDF saved to your Downloads folder.' The same text is intact in the CSV (checked: the marker string is present) and on screen. The boundary sweep with 128 lessons scored shows the first line going off the page at about 1,969 characters per box (~3,900 characters combined); at 1,809 per box everything still lands (la

## chart-legend-looks-clickable-but-is-not

**MINOR** — reachable

**What:** Every label and colour swatch in the Distribution legend shows a hand cursor and does nothing; the small wedges an inch to the left are the only clickable part.

**Steps:**

```
1. Open the tool cold at 1280x1000 (scratchpad/stranger/t15.js, t16.js).
2. Read getComputedStyle().cursor and .onclick for every <text> and <rect> inside #pieChart.
3. Reset #lessonsModal.className to 'modal', then page.mouse.click the measured centre of each of the six legend elements in turn, waiting 250ms, and re-read the class.
4. As a control, click the centre of a pie wedge at (30% width, 55% height) of the SVG.
```

**Observed vs expected:** All six legend elements — the three colour swatches (11x11px) and the three labels "Emerging — 8 (14%)" (121x13px), "Developing — 10 (18%)", "Mastered — 39 (68%)" — report cursor: pointer and onclick: false. Clicking each one leaves #lessonsModal at class 'modal': nothing happened, 6 times out of 6. The control click on a wedge changed it to 'modal show' and grew document.body.innerText from 1679 to 4302 characters. Expected: either the legend opens the same lesson list the wedge does, or it does not advertise itself with a pointer cursor.

## key-explanation-is-lowest-contrast-text

**MINOR** — reachable

**What:** The one sentence that explains what E, D and M mean is the hardest text on the page to read — 3.03:1, below the 4.5:1 minimum.

**Steps:**

```
1. Open the tool cold at 1280x1000 (scratchpad/stranger/t6.js).
2. For every visible element holding its own text, read computed color and walk up to the first ancestor with an opaque background, then compute the WCAG 2.x relative-luminance contrast ratio and compare against 4.5:1 (3:1 for large text).
```

**Observed vs expected:** #lessonsHint ("E is emerging, D is developing, M is mastered. Tap a level a second time to take the score back off.") is rgb(127,140,141) at 12px on rgb(243,239,231) = 3.03:1 against a 4.5:1 requirement. The same 3.03:1 hits the section headings "Distribution" and "Select Unit" and all three tally labels ("Emerging / Beginning", "Developing", "Mastered"); the header attribution, the "Child" and "Date" labels and "Stays on this laptop" come in at 3.48:1; the three tally numbers at 3.00-3.24:1; and the white E/D/M letters on their coloured buttons at 3.44-3.72:1. Expected 4.5:1 or better for the sentence a stranger has to read to use the tool at all.

## non-latin-initials-file-named-no-initials

**MINOR** — reachable

**What:** Initials with no A-Z/0-9 character (Ö.Ç., 李明, Cyrillic м.т.) make every export file be named 'no-initials' while the record inside names the child — and two such children on the same day get byte-identical filenames.

**Steps:**

```
Real Chrome over http. For each of ['M.T.','MT','É.C.','Ö.Ç.','李明','м.т.','A-B','A B']: fresh page + localStorage.clear, click 'Clear the sample', click the Child box, select-all, type the initials, choose 'Unit 1: Alphabet & Sounds', click M on Lesson 1, then Export CSV, Export JSON and Export PDF (jsPDF stubbed to record the filename). Downloads intercepted via the a[download] click and the blob text read back.
```

**Observed vs expected:** 'Ö.Ç.' -> ufli_assessment_no-initials_2026-08-08.csv / .json / ufli_assessment_report_no-initials_2026-08-08.pdf, while the Child cell inside reads 'Ö.Ç.' and the PDF header line reads 'Child: Ö.Ç.'. '李明' and 'м.т.' produce exactly the same three filenames — two different children, indistinguishable files. 'É.C.' -> ufli_assessment_C_... (silently reduced to one letter). Expected: the filename agrees with the record it contains, the way the suite already requires for the date ('an undated CSV is not named for today / it says so in its name instead') and for two children ('a second child gets a different filename'). Cause: index.html:759 strips everything outside /[^A-Za-z0-9]/ before falling

## review-sort-example-word-is-not-in-the-word-bank

**MINOR** — reachable

**What:** On all 19 review worksheets the sort activity says 'Check off each word — one is done for you', but the word already sitting in the first box is not one of the words in the bank, so nothing can be checked off and all of them still have to be sorted.

**Steps:**

```
Real Chrome over http. 'Get practice sheets' -> row 'Lesson 5: VC & CVC Words' -> Generate; rendered the emitted HTML in a real tab and read section '2 · Sort the words' (screenshot /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/l5-sort.png). Then enumerated all 128 worksheets in the page: parsed each built sheet, compared the pre-placed word in every sort box against the checkbox word bank.
```

**Observed vs expected:** Lesson 5: bank = mat, jam, sat, ram, bat, yam, rat, dam, hat (9 checkboxes); box '-at words (cat)' already contains 'cat', which is not in the bank. Same on Lessons 10 (gas), 19 (net), 38, 41, 62 (cat), 49 (ship), 53 (chip), 57 (cake), 59 (cave), 71 (catch), 76 (jumping), 79/83 (car), 88 (rain), 92 (moon), 97 (coin), 106 (unlock), 128 (action) — 19 of 128 sheets, every review sheet. Expected: what the other 109 sheets do — Lesson 45 pre-places 'ship' and Lesson 100 pre-places 'fast', both of which ARE the first bank word, so 'one is done for you' is true and one checkbox gets ticked.

## pdf-unit-reads-all

**COSMETIC** — reachable  
**Where:** index.html:1179

**What:** With 'All Lessons' chosen, the printed report header and the JSON export both call the unit 'all' where the screen says 'All Lessons'.

**Steps:**

```
Choose 'All Lessons' in the unit dropdown, click Export PDF (with the recording jsPDF fake) and Export JSON, compare with the dropdown's own visible option text.
```

**Observed vs expected:** Dropdown on screen reads 'All Lessons'. PDF header line: 'Child: M.T. Date: 2026-08-08 Unit: all'. JSON: "unit": "all". With no unit chosen at all the same two surfaces say 'All Units', which is a third wording. Expected: one name for the same thing on all three surfaces.

## chart-percents-dont-sum-100

**COSMETIC** — reachable  
**Where:** index.html:969

**What:** The chart key's percentages add up to 99% or 101% — three lessons, one at each level, prints 33% / 33% / 33%.

**Steps:**

```
Clear the sample, open Unit 3: Digraphs, click E on Lesson 42, D on Lesson 43, M on Lesson 44 with real mouse clicks. Then swept every total from 1 to 128 in thirds plus 21 hand-picked splits.
```

**Observed vs expected:** Tiles read 1 / 1 / 2... sorry, tiles read 1 / 1 / 1 and the key reads 'Emerging — 1 (33%)', 'Developing — 1 (33%)', 'Mastered — 1 (33%)' = 99%. The whole-year case (43/43/42, visible in the print screenshot) prints 34% + 34% + 33% = 101%. 47 of the 128 cumulative totals swept land on 99% or 101%; the smallest is three lessons. Expected: the three shares of one chart total 100%. Nothing else disagrees — the counts in the key always match the tiles exactly, and no non-zero band ever rounds to 0%.

## initials-cut-through-emoji

**COSMETIC** — contrived  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/phonics-assessment-tool/index.html:579

**What:** savedText() truncates stored initials with a plain slice(0,4) on UTF-16 code units, which can cut an emoji in half and leave an unpaired surrogate in the Child box — a broken glyph on the teacher's screen, and it goes into the exports too. The existing guard only checks that the box holds four characters or fewer, so a lone surrogate passes it.

**Steps:**

```
scratchpad/e5.js section C, real Chrome over http.
1. Load index.html, localStorage.clear().
2. localStorage.setItem('ufli-assessment', JSON.stringify({sampleCleared:true, initials:'A\u{1F467}\u{1F466}', date:'2026-03-04'}))  — 'A' plus two emoji, five code units.
3. Reload, read document.getElementById('initials').value and its code points, then click exportCSV().
```

**Observed vs expected:** The Child box holds 'A\u{1F467}\uD83D' — three code points, the last of which is the unpaired high surrogate D83D, which paints as a broken-character box. The CSV filename comes out as ufli_assessment_A_2026-03-04.csv. Expected: truncation should not split a character; slice on code points, or drop the trailing lone surrogate. Reaching this needs a hand-written storage record — the box's maxlength="4" stops it being typed or pasted.

## repeat-message-cut-short

**COSMETIC** — reachable  
**Where:** phonics-assessment-tool/index.html:505

**What:** Saying the same status message twice makes the first message's timer clear the second one early.

**Steps:**

```
Same harness (s2.js). On an empty tool press "Clear" (message: "There is nothing to clear yet."), wait 4 seconds, press "Clear" again, then watch the message region.
```

**Observed vs expected:** Observed: the message is gone by t=5.2s — one second after the second press — because the first press's 5-second timer sees the identical text and wipes it. Expected: the message set at t=4s should stay for its own 5 seconds. say() only guards against clearing a *different* message, not the same one set again.

## no-doctype-renders-in-quirks-mode

**COSMETIC** — contrived

**What:** index.html begins with a bare <html> tag — no <!DOCTYPE html> and no lang attribute — so Chrome renders the whole tool in quirks mode, unlike every sibling tool in the portfolio and unlike the worksheets this file itself generates.

**Steps:**

```
Open /phonics-assessment-tool/index.html and evaluate document.compatMode, document.doctype and document.documentElement.lang. Then compare the sibling tools. To see whether it changes anything on screen, I served the real file and a byte-identical copy with only "<!DOCTYPE html>" prepended and diffed the bounding box, box-sizing, font-size and line-height of all 149 elements at 1280, 768 and 390. Scripts: scratchpad/stranger-lens/t14.js, t19.js, t15.js.
```

**Observed vs expected:** Target file: compatMode "BackCompat", doctype null, lang "(none)"; the raw first bytes are `<html><head>`. Every page it links to or generates is in standards mode: decodable-passage-generator/index.html CSS1Compat lang=en, its sheets CSS1Compat lang=en, running-record-tool CSS1Compat lang=en, reading-assessment-tool CSS1Compat lang=en, and the worksheets this file writes start `<!DOCTYPE html><html lang="en">`. (math-assessment-tool is BackCompat too.) Layout impact today is small — 27 of 149 elements shift, all by exactly 3px (the quirks inline line-box gap under the SVG chart and the textareas), document height 1220 vs 1223 — so nothing is visibly wrong; but this is the first line a revie

## modal-escape-does-nothing-and-close-x-scrolls-away

**COSMETIC** — reachable

**What:** Neither modal responds to the Escape key, and once you scroll the 128-lesson picker the close "x" is thousands of pixels above the viewport. Clicking the backdrop still works, so nobody is trapped — but the two exits a stranger reaches for first are both gone.

**Steps:**

```
Open /phonics-assessment-tool/index.html at 768x1024, click "Get practice sheets", press Escape. Then scroll the modal to the bottom (to reach Lesson 128) and press Escape again, and look for the x. Script: scratchpad/stranger-lens/t19.js and t12.js; screenshot modal-bottom-768.png.
```

**Observed vs expected:** On open the x sits at top 71 and is on screen. After Escape, worksheetModal still has class "show" (there is no keydown handler anywhere in the file — grep for addEventListener('keydown') returns nothing). After scrolling the picker to the bottom, the x is at top -8455 and off screen, because `.close-modal` is `float: right` with `position: static` inside the `.modal-content` box that scrolls (scrollHeight 9241 vs clientHeight 715). Escape at that point still does nothing. The one remaining exit is clicking the 84px of backdrop to the left or the 38px above — which works (window.onclick at line 1053 handles it) but is undiscoverable. Expected: Escape closes the modal, and/or the x stays put 

## syllable-worksheet-title-is-a-whole-sentence

**COSMETIC** — reachable

**What:** Three generated worksheets use an entire teaching sentence as the document <title>, up to 122 characters, which is what the browser tab and Chrome's default print header show.

**Steps:**

```
Open /phonics-assessment-tool/index.html, click "Get practice sheets", click "Generate" on Lesson 66 (also 67 and 68), and read the browser tab. I swept the <title> of all 128 generated worksheets. Scripts: scratchpad/stranger-lens/t6.js (all-titles.txt) and t7.js/t8.js (real popup, no window.open stub).
```

**Observed vs expected:** Lesson 66's real popup reports document.title = "Practice — Two-syllable words: a closed syllable has a short vowel; an open syllable ends with a vowel that says its name." (122 chars). Lesson 67: "Practice — Both syllables are closed: split the word between the two middle consonants (rab-bit)." Lesson 68: "Practice — The first syllable is open: it ends in a vowel that says its long name (ro-bot, ti-ger)." Every other one of the 128 is between 26 and 70 characters, e.g. "Practice — Short a (CVC)", "Practice — Magic e: a_e", "Practice — Letter Mm". The page body itself is right — its <h1> reads the short, correct "Closed & Open Syllables" — so only the title tag is picking up the long teachin

## tracker-print-puts-export-and-clear-buttons-on-the-paper

**COSMETIC** — reachable

**What:** index.html has no @media print rule of its own, so File > Print on the tracker prints the Get practice sheets / Export PDF / Export JSON / Export CSV / Clear the sample / Clear buttons onto the sheet of paper.

**Steps:**

```
scratchpad/stranger/t-print.js and t-print2.js: loaded the tool cold, called page.emulateMediaType('print'), then (a) enumerated visible .section button/.section a, (b) checked every stylesheet for a print media rule, (c) rendered a full-page screenshot at 816x1056 (US Letter at 96dpi) and page.pdf({format:'Letter'}).
```

**Observed vs expected:** Observed: with print media active the buttons ['Get practice sheets','Reading practice — all 128 lessons','Export PDF','Export JSON','Export CSV','Clear the sample','Clear'] are all still displayed, the yellow sample banner still has display:block, and no stylesheet on the tracker page contains any print media rule (the three @media print rules in the file all live inside the generated worksheet documents, not this page). The 816px print render shows the full blue button bar at the bottom of the paper. Expected: a printed assessment record should not carry a row of screen-only buttons. Noted separately from the already-known print truncation findings because this is a missing @media print bl

## no-favicon-no-lang-no-description

**COSMETIC** — reachable

**What:** The page ships with no favicon, no <html lang>, and no meta description — the browser tab shows a bare grey globe next to "UFLI Foundations Tracker".

**Steps:**

```
scratchpad/stranger/t-fav.js requested /favicon.ico, /phonics-assessment-tool/favicon.ico and /apple-touch-icon.png over the case-sensitive http server. scratchpad/stranger/t-sweep.js read document.documentElement.getAttribute('lang'), document.querySelector('link[rel*=icon]'), meta[name=description], meta[name=theme-color] and the #pieChart svg's role/aria-label from the live page.
```

**Observed vs expected:** Observed: all three icon paths return 404; lang === null; no link[rel*=icon]; no meta description; no theme-color; and <svg id="pieChart"> has no role and no aria-label, so the distribution chart has no accessible name. Expected for a portfolio piece a hiring manager opens: a favicon, lang="en", and a one-line meta description. (document.compatMode === 'BackCompat' is the already-known missing-doctype finding and is not re-reported here.)

## pdf-comment-sections-have-no-page-break-guard

**COSMETIC** — contrived

**What:** Same root cause as above, stated as the code fact it rests on: exportPDF() guards page breaks only for the 'Needs Work In' section; the Strengths block, the 'Mastered in:' unit list and the Stretches block advance yPosition with no pageHeight test at all, so yPosition can exceed 297mm before any guard is reached.

**Steps:**

```
Same run as pdf-report-drops-the-end-of-a-long-note (scratchpad/repro.js and scratchpad/x7.js). Instrumented the real jsPDF and printed every drawn line's y coordinate; with 300 words in each comment box and 128 lessons scored, the recorded coordinates run to y=318.31mm before the first page-break guard (the one before 'Needs Work In') is ever consulted, at which point it resets to y=20 on a new page.
```

**Observed vs expected:** Observed: lines drawn at y>297mm on a 297mm page, with the page break only happening afterwards, at the start of the lesson list. Expected: a page-break check after each comment block, the same shape as the ones already written for the lesson list at index.html lines ~1300-1345.

## two-typefaces-in-one-button-row

**COSMETIC** — reachable

**What:** The bottom action row mixes two typefaces: the six <button>s fall back to Arial while the one <a> styled to match them renders in the system font.

**Steps:**

```
1. Open the tool cold at 1280x1000 (scratchpad/stranger/t13.js, t14.js).
2. Read getComputedStyle().fontFamily for body, .header h1, #unitSelect, #lessonsList .btn-score, .count-item, .section button and .section a.btn-primary.
3. Screenshot the last .section element at deviceScaleFactor 3 (scratchpad/stranger/actionrow2.png).
```

**Observed vs expected:** body / h1 / .lesson-name / .count-item / .section a.btn-primary = '-apple-system, "system-ui", "Segoe UI", sans-serif'. .section button (Get practice sheets, Export PDF, Export JSON, Export CSV, Clear the sample, Clear), #lessonsList .btn-score (every E/D/M) and #unitSelect = 'Arial' — Chrome's UA fallback, because no font-family is set on them. In the screenshot "Reading practice — all 128 lessons" is visibly a different face from "Get practice sheets" sitting immediately beside it at the same 14px. The author already fixed this in one place (.count-item carries an explicit font-family: inherit) but nowhere else.

## page-background-colour-never-applies

**COSMETIC** — reachable

**What:** The tool's chosen page background (#E8D4C4) is dead CSS — an inline style on <body> overrides it, so the page always renders on plain white.

**Steps:**

```
1. Open the tool cold (scratchpad/stranger/t7.js).
2. Read document.body.getAttribute('style'), getComputedStyle(document.body).backgroundColor and getComputedStyle(document.documentElement).backgroundColor.
3. Screenshot at 768x1024 (scratchpad/stranger/ipad-portrait.png).
```

**Observed vs expected:** The <body> tag carries style="...; background: transparent;", which beats the stylesheet's `body { ... background: #E8D4C4; }` on specificity. Computed body background = rgba(0,0,0,0) and html = rgba(0,0,0,0), so the canvas paints white; the screenshot shows white margins around the cream boxes, not the intended tan. Expected the declared background to show, or the dead rule to be removed.

## word-family-row-labelled-big

**COSMETIC** — reachable

**What:** The Lesson 46 (voiced th) worksheet prints a word-family row labelled 'big' over mother / father / brother / other — the label is not the family those words share.

**Steps:**

```
Real Chrome over http. 'Get practice sheets' -> row 'Lesson 46: Voiced th /th/' -> Generate; rendered the emitted HTML and read section '2 · Read the word families' (screenshot /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/l46-families.png). Found by enumerating every families[] row on all 128 sheets and checking each word against its own row label.
```

**Observed vs expected:** Row 3 prints the bold red label 'big' followed by 'mother father brother other', under the hint 'Only the first sound changes. Read down each line.' The four words share '-ther', not 'big'; the other two rows on the same sheet are correctly labelled 'th-'. index.html:1582 — { rime: "big", words: ["mother","father","brother","other"] }. Expected: a label the row's words actually share (the other 11 flagged labels I checked — 'more oo', 'quiet a', 'ch says /k/' — are deliberate descriptive headings; 'big' is not one of them).

## second-clear-erases-the-only-sentence-explaining-undo

**COSMETIC** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/phonics-assessment-tool/index.html:1369

**What:** Pressing Clear a second time replaces "Cleared. Press 'Undo the clear' if that was not what you meant." with "There is nothing to clear yet." about a second after it appeared, instead of the 30 seconds it was given. The Undo button stays on screen and still works, but the only sentence that ever explains what it will do is gone.

**Steps:**

```
Same harness, script probe8.js. 1) localStorage.clear(), reload (Maya on screen). 2) Stub confirm to accept. 3) document.querySelector('button[onclick="clearForm()"]').focus(); press Enter; wait 200ms; read #sayMsg and #undoBtn visibility. 4) Press Enter again (focus never left Clear); wait 200ms; read both again. 5) Click #undoBtn and read the tallies. With a mouse instead of the keyboard the second click misses: I measured that wiping the lesson list moves the button row up out from under the cursor, so this is a keyboard-user path, or a mouse user who re-aims.
```

**Observed vs expected:** OBSERVED: after the first Enter the status line reads 'Cleared. Press "Undo the clear" if that was not what you meant.' and #undoBtn is visible. After the second Enter (~200ms later) the status line reads 'There is nothing to clear yet.', #undoBtn is still visible, and clicking it still restores the record (tallies came back {e:8,d:10,m:39}). EXPECTED: the recovery instruction should hold for the 30s it was asked to hold, or the second press should re-state it; a teacher who presses Clear twice to be sure is left with a live Undo button and no explanation of it. Note this is the 'nothing to clear' early-return path, which is a different branch from the known repeat-message-cut-short timer bu

