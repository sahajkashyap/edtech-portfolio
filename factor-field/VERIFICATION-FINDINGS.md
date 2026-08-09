# factor-field — verification findings

From the three-round verification of 8-9 Aug 2026. 74 findings, 60 reachable by an ordinary user.

These are HUNTER findings. The run was stopped before every one had been through
the sceptics, so some may not survive scrutiny — treat them as candidates with
reproductions attached, not as confirmed defects.

| Severity | Reachable | What |
|---|---|---|
| BLOCKER | yes | The "Bring back the progress I just cleared" button never expires. Days and sessions later it is still on the report, and one click — with n |
| BUG | yes | Changing practice settings and closing the drawer with the ✕ (or the dim overlay) applies the change everywhere on screen but never writes i |
| BUG | yes | Clearing the Date box on My Progress stores an empty date, but the printed line, the print filename and the CSV all then carry TODAY'S date  |
| BUG | contrived | undoReset() writes the mq_undo blob straight into stats/stars with none of the rebuild-and-cap guard that loadStats applies to mq_stats, so  |
| BUG | contrived | If mq_who.initials is stored as anything but a string (a number, an object, an array), every attempt to open My Progress throws and silently |
| BUG | contrived | A personal-best key holding text makes the best show as NaN and — because the comparison is score > NaN — the best can never be recorded aga |
| BUG | contrived | loadSettings only checks that mq_settings.tables is a non-empty array, never what is in it, so a file holding words or nulls produces real q |
| BUG | contrived | The #ws= share payload is trusted whole: only `type` is validated. A payload with tables:[] prints a worksheet of "undefined × 11 =" with a  |
| BUG | yes | Nothing locks the answer controls during the 1.1–1.5 s reward pause, so every extra tap after a correct answer records another correct attem |
| BUG | yes | "Bring back the progress I just cleared" never expires — it survives reloads and a whole later session, and one click silently destroys ever |
| BUG | yes | Resetting progress while the sample student is loaded overwrites the undo slot with the sample's numbers, permanently destroying the real pr |
| BUG | yes | Pressing "Save" in the Settings drawer while on the Worksheet Maker re-renders the sheet from defaults, throwing away the type, the problem  |
| BUG | yes | Tapping "New problem" during the reward pause does not cancel the pending auto-advance, so about a second later the question is replaced a s |
| BUG | yes | The black toast pill ("Share link copied! 🔗", "Settings saved! ✓", "This is Maya Torres — a made-up student. ⭐") is not hidden by @media pr |
| BUG | yes | Worksheet problems are drawn independently with no de-duplication, so a printed 20-question sheet routinely carries the same question two to |
| BUG | yes | After "Copy share link", history.replaceState leaves #ws=… in the URL forever and show() never clears it, so every later reload/bookmark/reo |
| BUG | yes | A times table tried exactly once is shown as "—" (grey, not tried) on the report and on paper, but the saved CSV prints a real percentage fo |
| BUG | yes | The Mixed Review worksheet prints the promise "Uses your chosen tables: 3 (up to ×9)" and then prints problems with no 3 in them at all, up  |
| BUG | contrived | A saved settings file holding a non-numeric tables entry or maxFactor makes the product NaN, and distractors() then spins forever — Array Bu |
| BUG | yes | In a browser that cannot save (Safari private window, full disk) the tool correctly announces "nothing is being saved" at the top of the pag |
| BUG | yes | Two tabs of the tool on one laptop: each keeps its own copy of progress in memory and writes the whole file on every answer. One question an |
| BUG | contrived | If the who record is damaged while the stats record survives, the sample student's 181 made-up answers stay in the report but the "Sample st |
| BUG | yes | On a 13-inch laptop window (1280x690 viewport), opening Times Table Takeoff shows the starfield but the "Start" button is 144px below the fo |
| BUG | yes | Times Table Takeoff's play area (667px) plus 200px of sticky header/nav does not fit a 690px-tall viewport: at every scroll position at leas |
| BUG | yes | On an iPad in portrait, the signature "Show Me How" screen tells you to "Press Show me how" but that button is 332px below the fold — the sc |
| BUG | yes | In Times Table Takeoff, bullets already in flight are never cleared when the problem changes, and the hit test has no "is the alien on scree |
| BUG | yes | Speed Run: an answer given in the last second of the 60s clock leaves a "next question" timer running past the end of the game. Press "Play  |
| BUG | yes | Nothing stops a child playing while the sample student is loaded. Every answer and every star goes straight into Maya Torres's record, and t |
| BUG | yes | "Clear the sample" throws away everything, including real practice done since the sample was loaded — with no confirmation and no "Bring it  |
| BUG | yes | The report date is written to storage once (the first time initials are typed, or the first Reset) and then never refreshes. Every report pr |
| BUG | yes | When localStorage is full, the small mq_stars write still succeeds while the larger mq_stats write fails. After the next reload the warning  |
| BUG | contrived | loadStats rebuilds every fact's numbers but never checks the fact KEY. A nonsense key is printed verbatim as a 'trickiest single fact' on th |
| BUG | yes | The Stretches card (and the Stretches block in the exported CSV) says "Nothing tricky right now" on the very same page/file where the times- |
| BUG | yes | Array Builder "Count it" has no answer lock: after a wrong tap the tool highlights the right answer in green, and tapping that green answer  |
| BUG | yes | The Easy / Medium / Hard control in Settings saves, persists and shows itself as chosen, but nothing in the tool ever reads it — pickBlank() |
| BUG | yes | On the picture-based worksheets (Arrays, Bar models, Number bonds, Equal groups) the printed page break falls INSIDE a problem, so the dot a |
| BUG | yes | "🖨️ Print this report" with the browser's default print settings prints the times-table map as twelve identical white boxes, while the lege |
| MINOR | yes | Pasting a Factor Field share link into a tab that already has Factor Field open changes the address bar but nothing else — the shared worksh |
| MINOR | contrived | mq_stars is trusted for any value parseInt can chew on, so a negative or astronomical star count flows straight onto the star jar, the repor |
| MINOR | yes | After a wrong answer Digit Drop empties the answer boxes in memory but leaves the wrong digits on screen for 1.4 s, so pressing Check in tha |
| MINOR | yes | While Times Table Takeoff is open, its document-level key handler swallows Space and the arrow keys for the whole page, so the spacebar cann |
| MINOR | yes | Opening the ⚙️ Settings drawer over Takeoff or Speed Run does not pause them — the clock keeps running behind the modal, and in Takeoff the  |
| MINOR | yes | Closing the Settings drawer with the X or by clicking the backdrop keeps the changes for the rest of the session but never saves them, so th |
| MINOR | yes | There is no hashchange listener, so pasting a shared worksheet link into a tab that already has Factor Field open does nothing at all — the  |
| MINOR | yes | On US Letter, "Word problems" and "Multiply in parts" overflow one page by about 20 px, so every print produces an extra sheet of paper carr |
| MINOR | yes | The Speed Run end-of-round review can list the same fact in both columns at once — "4 × 7 = 28" under "You got these!" and "7 × 4 = 28" unde |
| MINOR | yes | Two times-table squares both reading "90%" are coloured and graded differently — one green/"strong", one amber/"good" — because the printed  |
| MINOR | yes | The header pill keeps claiming "🎯 Practicing your 8s" on the Times Table Takeoff screen, which never serves an 8 on its easier levels. |
| MINOR | yes | Clicking "Print this report" twice in quick succession leaves the browser tab permanently named "Factor Field progress - AB 2026-08-08" — a  |
| MINOR | yes | Same browser, same page: the banner across the top says nothing can be stored, yet pressing Save in Settings answers "Settings saved! ✓". Tw |
| MINOR | contrived | The undo slot's star count is restored without being turned back into a number. If it is text, the next correct answer concatenates instead  |
| MINOR | yes | In Show Me How, clicking "🇪🇸 Español" leaves every word on the page in English — the screen text is byte-identical before and after. Only  |
| MINOR | yes | The Settings drawer cannot be closed with Escape, focus is never moved into it when it opens, and Tab from there walks the nav buttons hidde |
| MINOR | contrived | `npm run coverage` in factor-field/tests silently runs the identical test suite and prints "ALL 102 CHECKS PASSED" with no coverage number — |
| MINOR | contrived | factor-field/index.html is not in check_links.py's DEFAULT_STARTS, so the repo's own "verify every link before calling anything done" checke |
| MINOR | yes | Speed Run only pays out stars (and saves the personal best) when the 60-second timer expires. Leave the screen first and every question you  |
| MINOR | yes | Tapping a Takeoff level button mid-game — even the one already selected — wipes the aliens and issues a brand-new problem with no penalty, s |
| MINOR | yes | Show Me How: changing the Speed while the hand is working has no effect at all on the run in progress, but the button lights up as if it did |
| MINOR | yes | 'Reset progress' clears answers, stars and the map but never touches mq_speed_best or mq_blast_best, so the next child on a shared laptop st |
| MINOR | contrived | loadWho accepts any string for initials with no length check, so a stored value long enough to be a full name goes onto the printed report,  |
| MINOR | contrived | loadSettings validates that tables is a non-empty array but never checks maxFactor, so a non-numeric stored maxFactor makes every question r |
| MINOR | yes | Same page, opposite direction: the Strengths card and the CSV Strengths block say "Nothing stands out yet" while the map paints those tables |
| MINOR | yes | "Reset progress" promises "The answers, the stars and the times-table map all go back to zero. Your settings and your worksheet are kept." ( |
| MINOR | yes | "Needs practice" means two different numbers on the same sheet. The grown-ups summary calls a table "Needs practice" at acc<0.7 (index.html: |
| MINOR | yes | In the Settings drawer the label says "Which times tables? (tap to toggle)", but tapping the last remaining lit table does nothing at all —  |
| COSMETIC | yes | The #ws= share hash is never cleared after "Copy share link", so the address bar keeps describing the worksheet while you are on another scr |
| COSMETIC | yes | The page declares no icon, so Chrome requests /favicon.ico (404 on GitHub Pages) and the tab shows the blank generic globe. |
| COSMETIC | yes | The My Progress report mixes British "practise" and American "practice" in adjacent lines of the same Stretches card. |
| COSMETIC | yes | The first sentence on the landing screen is missing a word: "Practice your times tables lots of fun ways" (should be "in lots of fun ways"), |
| COSMETIC | yes | In Worksheet Maker on an iPad in portrait (and on a phone) the "Title" label sits flush against the text box with zero gap, reading as "Titl |
| COSMETIC | yes | In the "Mixed sections" worksheet, unticking the last remaining section is silently refused — the box snaps back with no toast, no message a |
| COSMETIC | yes | The Times Table Takeoff game-over card always says "⭐ added to your jar", including when the score is 0 and no star was added. |
| COSMETIC | yes | Pressing "🖨️ Print this report" twice within 1.2 seconds leaves the "👀 For grown-ups" section expanded on screen afterwards, even though t |
| COSMETIC | yes | Printing the progress report arms a 1.2 s timer that restores the "For grown-ups" section to whatever state it was in before the print; if t |

---

## stale-undo-destroys-current-progress

**BLOCKER** — reachable

**What:** The "Bring back the progress I just cleared" button never expires. Days and sessions later it is still on the report, and one click — with no confirmation — silently replaces the current child's practice with the old snapshot and deletes the undo slot, so the current work is gone for good.

**Steps:**

```
Executed in headless Chrome over http://127.0.0.1:<port>/index.html (scratchpad/saved-data-lens/t4.js and t10.js, run three times, identical each time).
1. Fresh tool, empty localStorage.
2. Child 1: 12 correct answers, 24 stars, initials JD. Open My Progress, click "Reset progress", accept the confirm. The "Bring back the progress I just cleared" button appears — correct so far.
3. Close the tab. page.reload() — a new session, exactly what happens the next morning.
4. Child 2: 20 correct answers, 40 stars, initials ML. Open My Progress.
5. Screenshot (scratchpad/saved-data-lens/stale-undo.png) shows the report reading "20 questions answered / 100% / 40 stars earned" for ML, with "↩️ Bring back the progress I just cleared" still sitting under "For grown-ups" (getBoundingClientRect 340x47, display:block, visibility:visible).
6. Click it.
```

**Observed vs expected:** Observed: window.__confirms length is 0 before and after — nothing is asked. Immediately after the click totalAnswered()=12, star jar=24, initials=JD; mq_undo is null and the undo button is gone. After a reload it is still 12/24/JD. Child 2's 20 answers and 40 stars are unrecoverable: undoReset() does not stash the state it is overwriting, and it deletes mq_undo. Expected: either the undo offer is dropped once new practice has been recorded (or on the next load), or clicking it asks first the way "Reset progress" does — that path confirms before destroying far less.

## settings-lost-when-drawer-closed-with-x

**BUG** — reachable

**What:** Changing practice settings and closing the drawer with the ✕ (or the dim overlay) applies the change everywhere on screen but never writes it to storage, so a reload silently throws it away.

**Steps:**

```
scratchpad/saved-data-lens/t6.js, run twice, identical.
1. Fresh tool, empty localStorage. mq_settings is null.
2. Click #gearBtn to open Settings.
3. Click "Easy (1–5)".
4. Choose "up to 9" in Biggest second number.
5. Click the ✕ (#closePanel) — the natural way to dismiss a drawer — instead of Save.
6. Go to the home screen, then generate 25 questions.
7. page.reload() and look again.
```

**Observed vs expected:** Observed after step 5: settings.tables = [1,2,3,4,5], settings.maxFactor = 9, but localStorage mq_settings is still null. The home screen reads "Practicing: 1, 2, 3, 4, 5 times tables" and 25 generated questions really do use only tables 1–5 with second factor at most 9 — the tool behaves as if the change took. After the reload: settings.tables = [2,3,4,5,6,7,8,9,10], maxFactor = 12, home reads "Practicing: 2, 3, 4, 5, 6, 7, 8, 9, 10 times tables". No warning at any point. Expected: either closing without Save reverts the live settings too (so the screen never lies), or closing warns that the change has not been saved.

## cleared-date-prints-todays-date

**BUG** — reachable

**What:** Clearing the Date box on My Progress stores an empty date, but the printed line, the print filename and the CSV all then carry TODAY'S date — a date the teacher deliberately removed — and the box redraws showing today after a reload while storage still holds "".

**Steps:**

```
scratchpad/saved-data-lens/t6.js, run twice, identical.
1. Fresh tool. Record 10 correct answers so the report unlocks. Open My Progress.
2. Type "ab" into Who's this for and 03/11/2026 into Date. mq_who = {"initials":"AB","date":"2026-03-11",...}; the print line reads "Child: AB · Date: 2026-03-11". Good.
3. Click into the Date box, select all (Cmd+A), press Backspace to clear it.
4. Click "Print this report" (window.print is stubbed and captures the .who-print line and document.title at that instant).
5. page.reload(), reopen My Progress.
```

**Observed vs expected:** Observed after step 3: the Date box is empty and mq_who is {"initials":"AB","date":"","sample":false}, but the on-screen printed line already reads "Child: AB · Date: 2026-08-08". At print time the captured line is "Child: AB · Date: 2026-08-08" and the suggested filename is "Factor Field progress - AB 2026-08-08". After the reload the Date box shows 2026-08-08 while mq_who.date is still "" — what was saved is not what comes back. Expected: the tool's own comment says a report carrying a date the teacher never chose "is worse than carrying no line at all", so an emptied date should print no date (or refuse to print until one is chosen), and the box should not silently show a value that is no

## undo-slot-restores-unsanitised-stats

**BUG** — contrived

**What:** undoReset() writes the mq_undo blob straight into stats/stars with none of the rebuild-and-cap guard that loadStats applies to mq_stats, so a corrupt undo slot puts "lotsnull questions answered", "NaN% correct overall", "many stars earned" and a 4950% times-table square on the report — and saves them back.

**Steps:**

```
scratchpad/saved-data-lens/t3.js section B.
1. Fresh tool. 10 correct answers, 20 stars. Open My Progress, click "Reset progress", accept — this creates a real mq_undo slot.
2. Corrupt the slot the way a half-written record would be: localStorage.setItem('mq_undo', '{"stats":{"facts":{"3x4":{"seen":"x","correct":"y","hinted":"z"}},"correct":"lots","wrong":null},"stars":"many","who":{"initials":"AB","date":"2026-03-11"}}')
3. show('progress') — the "Bring back" button is offered.
4. Click it.
Also ran with '{"stats":{"facts":{"3x4":{"seen":2,"correct":99,"wrong":0,"hinted":0}},"correct":1000,"wrong":0},"stars":5,...}' and with '{"stats":{"facts":"nope"},"stars":5,...}'.
```

**Observed vs expected:** Observed: the three headline tiles read "lotsnull", "NaN%", "many"; the star jar reads "many"; mq_stats is written back as the raw junk and mq_stars as "many", so on the next reload every star is silently 0. With the seen:2/correct:99 blob the times-table map shows 3s and 4s at 4950% and the tile says "1000 questions answered"; after a reload the same report quietly changes to 100% — two different reports from one file. With facts:"nope" the tiles are "NaN" and "NaN%". No console error, no page error. Expected: the same treatment mq_stats gets — rebuild the shape, cap correct/wrong at seen, or refuse the undo and say so. The tool guards one door into stats and leaves the other open.

## who-initials-not-a-string-kills-progress-screen

**BUG** — contrived

**What:** If mq_who.initials is stored as anything but a string (a number, an object, an array), every attempt to open My Progress throws and silently does nothing — the report is unreachable for good, with no message.

**Steps:**

```
scratchpad/saved-data-lens/t2.js and t3.js section A.
1. Fresh tool. Record 10 correct answers and 20 stars.
2. localStorage.setItem('mq_who', '{"initials":123,"date":"2026-03-11"}')
3. page.reload().
4. Click the "My Progress" nav button (real click on the nav button element).
Repeated with initials {"x":1} and ["A","B"] — same result. With a non-string DATE ({"y":1} or 20260311) the report survives.
```

**Observed vs expected:** Observed: pageerror "(who.initials || \"\").trim is not a function" thrown from whoPrintInner → SCREENS.progress → show(). The screen never changes — the app keeps showing the home screen (innerHTML length 3189, first line "Pick a way to play! 🚀"), there is no report, no #whoInitials box, and nothing on screen says anything is wrong. It repeats on every load and every click, so the report is permanently unreachable. Expected: loadWho() should coerce/reject a non-string (it already does !!w.sample for the boolean), or the report should refuse with a visible message rather than a dead nav button.

## best-score-stored-as-text-is-NaN-forever

**BUG** — contrived

**What:** A personal-best key holding text makes the best show as NaN and — because the comparison is score > NaN — the best can never be recorded again, so every future run silently fails to save.

**Steps:**

```
scratchpad/saved-data-lens/t7.js and t8.js, both games played for real.
SPEED RUN: fresh tool → localStorage.setItem('mq_speed_best','abc') → reload → show('speed'). Click Start, answer 8 questions correctly by reading the equation off the page and clicking the matching choice, then let the full 60 seconds run out.
TAKEOFF: fresh tool → localStorage.setItem('mq_blast_best','abc') → reload → show('blast') → click #blStart → sit still until all three lives are lost (~75s).
```

**Observed vs expected:** Observed (Speed Run): the start screen reads "Personal best: NaN". After a genuine 17-point run the end screen reads "Score 17 · earned 9 ⭐ · best NaN", mq_speed_best is STILL "abc", and going back to the start screen still reads "Personal best: NaN". A real 17 is thrown away and no future score can ever beat NaN. Observed (Takeoff): the game-over overlay reads "Best: NaN · ⭐ added to your jar" and mq_blast_best is still "abc". Expected: a best that is not a finite number should be treated as no best at all (0), so the run records normally, and the words "NaN" should never reach a child's screen.

## settings-tables-contents-never-checked

**BUG** — contrived

**What:** loadSettings only checks that mq_settings.tables is a non-empty array, never what is in it, so a file holding words or nulls produces real questions like "a × 7 =" and "null × 7 =" in Digit Drop and a literal NaN on the Mystery Factor screen.

**Steps:**

```
scratchpad/saved-data-lens/t2.js, mq_settings section.
1. Fresh tool. localStorage.setItem('mq_settings','{"tables":["a","b"],"maxFactor":12}') → reload → show('drop'), then show('mystery').
2. Repeated with '{"tables":[3,null],"maxFactor":12}', '{"tables":[3],"maxFactor":-5}' and '{"tables":[3],"maxFactor":0}'.
```

**Observed vs expected:** Observed: with tables ["a","b"] Digit Drop draws the equation "a × 7 = [boxes]" and genFact() returns {"a":"b","b":7,"p":null}; the Mystery Factor screen's innerText contains the literal string "NaN". With [3,null] Digit Drop draws "null × 7". With maxFactor -5 genFact() returns {"a":3,"b":-1,"p":-3} — a negative times table. With maxFactor 0 every question is × 1. Nothing throws, nothing is logged. Expected: the same treatment mq_stats gets — keep only whole numbers in a sensible range, otherwise fall back to DEFAULTS. A child should never be shown "a × 7" or a question whose answer is null.

## shared-worksheet-payload-unchecked

**BUG** — contrived

**What:** The #ws= share payload is trusted whole: only `type` is validated. A payload with tables:[] prints a worksheet of "undefined × 11 =" with a NaN answer key, tables:null leaves the page completely blank, and a title that is an object prints "[object Object]" as the sheet heading.

**Steps:**

```
scratchpad/saved-data-lens/t5b.js. Each case is a genuine full page load (about:blank first, then goto the URL — going straight from one hash to another is a same-document navigation and does not re-run boot(), which is what made my first attempt read stale).
1. base64 of {"v":1,"type":"facts","count":6,"tables":[],"maxFactor":12,"title":"T"} → open /index.html#ws=<that>.
2. Same with tables:null, tables:["a","b"], title:{a:1}, count:3000, and sections:["facts","oldstyle"].
Also checked the honest path first: build a "sections" sheet titled "Room 12 Friday", click Copy share link, open the link in a clean load — the sheet comes back byte-identical, so the round trip itself is sound.
```

**Observed vs expected:** Observed: tables:[] renders six problems reading "1. undefined × 11 =", "2. undefined × 9 =" … and an answer key full of NaN. tables:null throws "Cannot read properties of null (reading 'slice')" and the whole #app is empty — a blank white page. tables:["a","b"] renders "1. a × 11 =" with NaN answers. title:{a:1} prints "[object Object]" as the sheet heading. count:3000 renders 3000 problems and perSection:20000 renders 20000. sections:["facts","oldstyle"] throws nothing but silently drops the teacher on the home screen with no explanation of why the shared sheet did not open. Mangled base64 (truncated, or with a space) correctly falls back to home. Expected: `type` is already guarded with W

## reward-window-double-count

**BUG** — reachable

**What:** Nothing locks the answer controls during the 1.1–1.5 s reward pause, so every extra tap after a correct answer records another correct attempt and pays the stars again — in Digit Drop, Mystery Factor and both Array Builder modes.

**Steps:**

```
Served factor-field over http://127.0.0.1:<port> in headless Chrome (puppeteer-core), localStorage cleared. (a) DIGIT DROP: show('drop'); read the two factors off .equation (7 × 10 = 70), clicked [data-card=7] then [data-card=0], clicked #check once -> totalAnswered()=1, stars=2. Then clicked #check 5 more times, 60 ms apart, all inside the 1100 ms window -> totalAnswered()=6, stars=12, window.__liveTimers.size=6. (b) MYSTERY FACTOR: show('mystery'); clicked #hint then #hint2 to read the answer (8); typed it into #ans and pressed Enter -> answered=1, stars=1; pressed Enter 5 more times, 50 ms apart -> answered=6, stars=6. (c) ARRAY BUILDER / Count it: show('array'); question 6 × 4; clicked .choice[data-val="24"] once -> answered=1, stars=2; clicked the same tile 4 more times -> answered=5, stars=10; then clicked a WRONG tile (18) in the same window -> answered=6, stats.correct=5, stats.wrong=1 — a wrong answer logged against a question already answered right. (d) ARRAY BUILDER / Build 
```

**Observed vs expected:** Observed: one correct answer is counted up to 6 times, the stars are paid each time, and a wrong tap inside the window is recorded against the same question. Three real answers produce a report saying 12 questions answered and 24 stars. Expected: one recorded attempt and one star payout per question, the way Speed Run already does it with its `locked` flag (index.html:1440–1442).

## undo-eats-newer-session

**BUG** — reachable

**What:** "Bring back the progress I just cleared" never expires — it survives reloads and a whole later session, and one click silently destroys everything recorded since, with no confirmation and no way back.

**Steps:**

```
Fresh page. Recorded 12 correct answers (recordAttempt/addStars via the tool's own path), set initials AB, show('progress'), clicked #resetProg and confirmed. Then simulated the next child's week: 20 more correct answers, initials 'JR', date 2026-09-01, then a full page reload, then show('progress'). Screen showed answered=20, stars=40, initials JR, AND the button #undoReset still labelled "↩️ Bring back the progress I just cleared". Clicked it once. Result: answered=12, stars=24, initials='' , date reset to today, window.__confirms.length=0 (no dialog was shown), #undoReset gone, localStorage 'mq_undo' = null.
```

**Observed vs expected:** Observed: 20 answers, 40 stars and the child's initials/date were wiped and replaced by the session cleared long before; no confirmation was asked and the undo slot was deleted, so the newer session is unrecoverable. Expected: either the undo offer disappears once new practice is recorded (or after a reload), or clicking it warns that newer work will be lost.

## reset-over-sample-clobbers-undo

**BUG** — reachable

**What:** Resetting progress while the sample student is loaded overwrites the undo slot with the sample's numbers, permanently destroying the real practice that "Load the sample student" promised was put safely aside.

**Steps:**

```
Fresh page. Recorded 14 correct answers for a real child. show('progress'), clicked #loadSample and accepted the confirm — its text promises "The practice already on this laptop is put safely aside, and a 'Bring it back' button appears so you can undo this." Checked localStorage 'mq_undo': it held the real 14 answers. Then, with Maya Torres on screen (who.sample=true, 181 answers), clicked #resetProg and confirmed. Re-read 'mq_undo': it now holds 181 answers with who.sample=true — the sample. Clicked #undoReset: totalAnswered()=181, who.sample=true, who.initials='M.T.'.
```

**Observed vs expected:** Observed: the undo slot silently changes owner. The real child's 14 answers are gone from both stats and the undo slot, and "Bring it back" restores Maya Torres instead. Expected: the reset should not overwrite an undo snapshot that is still the only copy of real practice — or should refuse to stash the sample over it.

## settings-save-wipes-worksheet

**BUG** — reachable

**What:** Pressing "Save" in the Settings drawer while on the Worksheet Maker re-renders the sheet from defaults, throwing away the type, the problem count and the typed title — and this is the exact flow the panel's own note tells you to follow.

**Steps:**

```
Fresh page. show('worksheet'); set #wsType to 'wordproblem', #wsCount to '12', selected the title box and typed 'Year 4 Tuesday homework'. Confirmed on screen: type=wordproblem, count=12, title and #wsHeadTitle both 'Year 4 Tuesday homework'. Then followed the note printed on that same panel ("Change these in ⚙️ Settings, then press 'New problems'"): clicked #gearBtn, clicked #selEasy, clicked #saveSettings. After 500 ms: still on the Worksheet Maker, but type='facts', count='20', title='Multiplication Facts', heading='Multiplication Facts'.
```

**Observed vs expected:** Observed: the whole worksheet configuration is silently reset to defaults. Expected: saving settings should leave the sheet you were building alone (index.html:3494 calls show(activeScreen) with no params, so SCREENS.worksheet rebuilds cfg from scratch).

## skip-during-reward-swaps-problem

**BUG** — reachable

**What:** Tapping "New problem" during the reward pause does not cancel the pending auto-advance, so about a second later the question is replaced a second time and any digits already typed are wiped.

**Steps:**

```
Fresh page. show('drop'); read the factors, clicked the matching number cards, clicked #check (correct). ~80 ms later clicked #skip ("New problem"). Screen showed a new question, '4 × 10 = _ _', with window.__liveTimers.size = 1 still pending. Clicked [data-card="1"] and [data-card="0"], boxes read ['1','0']. Waited 1.4 s without touching anything: the equation changed by itself to '10 × 11 = _ _ _' and the boxes were back to ['0','0','0'] (empty).
```

**Observed vs expected:** Observed: the question the child asked for is thrown away mid-answer by an orphaned timer from the previous question, along with what they had typed. Expected: next()/skip should cancel the pending later(next, 1100). Same shape exists in Mystery Factor (later(next,1200) at index.html:1384).

## toast-prints-on-the-worksheet

**BUG** — reachable  
**Where:** factor-field/index.html:456 (.toast {position:fixed}) and :504 (@media print hide list, which omits .toast)

**What:** The black toast pill ("Share link copied! 🔗", "Settings saved! ✓", "This is Maya Torres — a made-up student. ⭐") is not hidden by @media print, so it is printed onto the worksheet / progress report a teacher hands out.

**Steps:**

```
Served factor-field over http://127.0.0.1 and drove Chrome. 1) Load index.html cold (localStorage cleared). 2) Click 🖨️ Worksheet Maker. 3) Click 🔗 Copy share link. 4) 500 ms later click 🖨️ Print — the two buttons sit side by side and the toast lasts 1800 ms. At the instant window.print() fired I read #toast: {text:"Share link copied! 🔗", classList has 'show', opacity:"1", position:"fixed"}. 5) Generated the real thing with page.pdf({format:'Letter',printBackground:true,margin:0.4in}) at that same moment and rendered it: /private/tmp/.../scratchpad/final-toast.pdf.png and sheet-with-toast.pdf.png both show a solid black pill reading "Share link copied! 🔗" printed near the foot of the worksheet. Same at step 3 with ⚙️ Settings → Save → Print (toast "Settings saved! ✓"), and on My Progress with 👋 Try it with a sample student → 📊 Print (toast "This is Maya Torres — a made-up student. ⭐"); on the report the pill lands ON TOP of the text and hides the "Needs practice:" and "Trickiest
```

**Observed vs expected:** Observed: a black opaque pill printed across the sheet/report; on the progress report it obscures two lines of the grown-ups summary. Expected: .toast joins .app-header/.nav/.no-print in the @media print display:none list, so nothing transient reaches paper.

## worksheet-repeats-the-same-question

**BUG** — reachable  
**Where:** factor-field/index.html:3390 (worksheet body generation — no Set/seen guard anywhere in the file)

**What:** Worksheet problems are drawn independently with no de-duplication, so a printed 20-question sheet routinely carries the same question two to five times.

**Steps:**

```
1) Load cold, click 🖨️ Worksheet Maker. 2) Choose "Equal groups". 3) Click 🎲 New problems and read the 20 .ws-prob items; repeat 20 times. Result: 20/20 sheets contained at least one repeated question; the worst sheet had the identical question "4 groups of __ × __ =" five times, plus "3 groups of 3" three times and three more repeated pairs. Same sweep, 30 regenerations per type: Multiplication facts 26/30 sheets repeat (worst x3), Multiply by tens 15/30 (x3), Missing factors 16/30 (x3), Word problems 8/30, 2-digit × 1-digit 5/30. The printed PDF at /private/tmp/.../scratchpad/final-toast.pdf.png shows it on paper: #1 and #9 are both "6 × 11 =", #6 and #7 are both "2 × 7 =", #5 and #12 are both "6 × 5 =".
```

**Observed vs expected:** Observed: a 20-question printed sheet with 3 duplicate pairs, and Equal Groups sheets where one question appears 5 times out of 20. Expected: 20 distinct questions when the pool (9 tables × 12 factors = 108, or 36 equal-group combinations) is far larger than 20.

## share-hash-never-clears

**BUG** — reachable  
**Where:** factor-field/index.html:3462 (history.replaceState(null,"",hash)) with show() at :1107 never touching location.hash

**What:** After "Copy share link", history.replaceState leaves #ws=… in the URL forever and show() never clears it, so every later reload/bookmark/reopen dumps you back on the Worksheet Maker showing the OLD shared sheet — not Home, and not the sheet that was on screen.

**Steps:**

```
1) Load cold. 2) Click 🖨️ Worksheet Maker. 3) Click 🔗 Copy share link (URL becomes …/index.html#ws=eyJ2Ijox…). 4) Click 🎲 New problems — a different set of 20 questions is now on screen. 5) Click 🃏 Digit Drop and play. location.hash is still "#ws=eyJ2Ijox…" while Digit Drop is showing. 6) Press reload (⌘R / reopening the bookmarked tab). Landed on "🖨️ Worksheet Maker", and the sheet shown is byte-for-byte the sheet from step 3 (shared === true), NOT the sheet that was on screen at step 5 (onScreen === false).
```

**Observed vs expected:** Observed: reload lands on Worksheet Maker with a stale sheet, even after moving to a game. Expected: reload returns to Home (or at worst to what was on screen); pressing 🎲 New problems should not leave a link in the address bar that resurrects the discarded sheet.

## csv-percent-for-table-tried-once

**BUG** — reachable

**What:** A times table tried exactly once is shown as "—" (grey, not tried) on the report and on paper, but the saved CSV prints a real percentage for it — and the very same CSV row also says "not tried yet".

**Steps:**

```
Served factor-field/ over 127.0.0.1 with node http, drove Chrome via puppeteer-core. fresh page (localStorage cleared) → in-page, through the tool's own recording path: `for(i<8) recordAttempt(3,4,true,false); recordAttempt(3,7,true,false); addStars(18)` → `show('progress')` → read every .tbl-cell → click #progCsv and read the captured Blob. Repeated with the single 7s question ANSWERED WRONG (`recordAttempt(3,7,false,false)`). Also fuzzed 60 randomly generated practice histories (8–67 answers each, built only with recordAttempt/addStars) comparing all 12 map squares against all 12 CSV rows: 25 of the 60 histories hit this.
```

**Observed vs expected:** Screen/print map: `7s —` with class tc-none (legend: "grey = not tried yet"). CSV row: `7s,1,1,100,0,not tried yet`. Wrong-answer variant: map `7s —`, CSV `7s,1,0,0,0,not tried yet`. Expected: the two surfaces agree — either both withhold the percentage below 2 attempts, or both show it; and one CSV row must not say "100" in the Correct (%) column and "not tried yet" in the next column. Cause: the map uses `r.seen >= 2` to decide whether to print a percentage (index.html:2792) but progressCSV only checks `r.acc == null`, i.e. seen >= 1 (index.html:2682), while the band word in the same row still uses `r.seen < 2` (index.html:2680).

## mixed-worksheet-ignores-chosen-tables

**BUG** — reachable

**What:** The Mixed Review worksheet prints the promise "Uses your chosen tables: 3 (up to ×9)" and then prints problems with no 3 in them at all, up to 400 × 8.

**Steps:**

```
fresh page → click #gearBtn → in the real gear drawer click every lit ×n button except ×3 → set "up to 9" in #maxFactor → click #saveSettings (settings became {"tables":[3],"maxFactor":9}) → show('worksheet') → pick "Mixed review" in #wsType → read .small-note and all 20 answer-key lines. Repeated the same measurement for facts, missing and numberbond as controls.
```

**Observed vs expected:** Note under the controls: "Uses your chosen tables: 3 (up to ×9). Change these in ⚙️ Settings, then press "New problems"." Sheet: 7 of the 20 problems contain no 3 anywhere — 7×58, 6×34, 4×60, 400×4, 8×31, 400×8 — and many exceed ×9. Controls facts / missing / numberbond: 0 of 20 off-table each, as promised. Expected: either the Mixed sheet honours the chosen tables, or the note does not claim it does. Cause: `facty` includes "mixed" (index.html:3325) so the promise is printed, but `wsProblem("mixed")` delegates to tens/inparts (index.html:3003), which use their own ranges and never read settings.tables.

## corrupt-settings-freezes-the-tab

**BUG** — contrived

**What:** A saved settings file holding a non-numeric tables entry or maxFactor makes the product NaN, and distractors() then spins forever — Array Builder freezes the tab the instant it opens, and Speed Run freezes the instant a child presses Start. No error, no message, no recovery except force-closing the tab.

**Steps:**

```
Served factor-field over http://127.0.0.1 with node's http module and drove real Chrome (headless) via puppeteer-core. In a fresh tab: localStorage.clear(); localStorage.setItem('mq_settings','{"tables":[3,4],"maxFactor":"twelve","difficulty":"medium"}'); reload. (a) evaluate show('array') -> the call never returns; a second, independent evaluate of `1+1` three seconds later also never returns, so the tab is genuinely wedged, not slow. (b) Same setup, show('speed') then click Start -> same permanent hang. Same result with '{"tables":["seven"],...}', '{"tables":[[2,3]],...}' and '{"tables":[{"t":3}],...}'. Takeoff is immune (it uses its own level tables). Ran the whole matrix of 10 corrupt settings blobs x 8 screens once, then re-confirmed the two frozen screens twice more — FROZEN both times, identical.
```

**Observed vs expected:** Observed: the tab locks up permanently with 0 console errors and 0 page errors; the child sees a dead page. Expected: index.html:845 loadSettings only checks that `tables` is a non-empty array, never that its members are numbers and never that maxFactor is one; index.html:1037 `while (set.size < 4) { set.add(p + n); n++; }` can never grow a Set whose only member is NaN. A file it cannot trust should be dropped back to defaults the way loadStats does, and the loop needs a bound.

## reset-promises-an-undo-that-cannot-exist

**BUG** — reachable

**What:** In a browser that cannot save (Safari private window, full disk) the tool correctly announces "nothing is being saved" at the top of the page — and then, on Reset progress, promises in the confirm box AND in the toast that a "Bring it back" button will appear. The undo slot could not be written, no button appears, and the session's practice is gone.

**Steps:**

```
New tab with window.localStorage stubbed to throw DOMException('QuotaExceededError') on every call (the same stub the existing suite uses for its private-window check). Load index.html; the storage banner appears. Then: recordAttempt(3,4,true,false) x20 and addStars(40) through the tool's own recording path, show('progress'), click #resetProg, accept the confirm. Read back: confirm text contained "a “Bring it back” button appears right afterwards", toast read "Progress cleared — you can still bring it back.", document.getElementById('undoReset') was null, totalAnswered() was 0. Reproduced identically on two separate runs.
```

**Observed vs expected:** Observed: promised undo, no undo button, 20 answers and 40 stars unrecoverable. Expected: stashUndo() at index.html:2874 calls lsSet, which returns false when the write fails, and that return value is discarded; the toast at index.html:2879 and the confirm text are printed regardless. When storageOK is false the tool already knows it cannot keep a copy, so it should say the clear is final instead of promising a way back.

## second-tab-silently-erases-the-first

**BUG** — reachable

**What:** Two tabs of the tool on one laptop: each keeps its own copy of progress in memory and writes the whole file on every answer. One question answered in the older tab overwrites everything done in the other — twelve answers and twenty-four stars gone, with no warning and nothing to undo.

**Steps:**

```
Fresh page A (storage cleared). Opened page B on the same origin and left it sitting on the home screen. In A: recordAttempt(6,7,true,false) x12 and addStars(24) — A shows 12 answered, 24 stars. In B: recordAttempt(2,2,true,false) once and addStars(2). Read localStorage: mq_stats is now {"facts":{"2x2":{"seen":1,...}},"correct":1,"wrong":0} and mq_stars is "2". Reloaded A: totalAnswered() 1, stars 2. Reproduced identically on two runs.
```

**Observed vs expected:** Observed: A's whole session silently replaced by B's single answer. Expected: saveStats (index.html:914) serialises the in-memory object wholesale and there is no `storage` event listener anywhere in the file, so the tab that writes last wins. Either re-read before writing, or listen for the storage event and refuse/merge.

## sample-numbers-lose-their-label

**BUG** — contrived

**What:** If the who record is damaged while the stats record survives, the sample student's 181 made-up answers stay in the report but the "Sample student — Maya Torres" banner disappears, the initials box unlocks, and the sheet prints as a real child's record: "Child: JD", filename "Factor Field progress - JD 2026-08-08".

**Steps:**

```
Fresh page: loadSample() through the tool's own button path, then localStorage.setItem('mq_who','{"initials":"M.T.","date":"2026-08-08","sam') — a truncated record, the shape a half-finished write leaves behind. Reload, show('progress'). Observed: no .sample-banner, #sampleBar carries class "hidden", totalAnswered() 181, the initials box accepts typing; typed 'JD', clicked #progPrint, and the line captured at the moment window.print fired was "Child: JD  ·  Date: 2026-08-08  ·  ✖️ Factor Field" with tab title "Factor Field progress - JD 2026-08-08". Same result when mq_who is removed entirely instead of truncated. Reproduced on two runs.
```

**Observed vs expected:** Observed: made-up practice printed under a real child's initials with no sample label anywhere. Expected: loadWho (index.html:932) quietly falls back to sample:false whenever mq_who will not parse, and nothing ever cross-checks that against the stats it is describing. The one label the tool exists to guarantee fails open rather than closed.

## takeoff-start-button-below-the-fold

**BUG** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/factor-field/index.html:3285

**What:** On a 13-inch laptop window (1280x690 viewport), opening Times Table Takeoff shows the starfield but the "Start" button is 144px below the fold, so there is no visible way to begin the game.

**Steps:**

```
Local node http server on 127.0.0.1 serving factor-field/. Chrome via puppeteer-core, viewport 1280x690 (a 13" MacBook Air screen minus browser chrome). goto /index.html, localStorage.clear(), reload. Then clicked the nav button with page.evaluate (NOT page.click, which would auto-scroll): document.querySelector('[data-screen="blast"]').click(). Waited 600ms. Measured document.getElementById('blStart').getBoundingClientRect().top. Screenshot at /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/lens4/fold-blast-mba13.png. Repeated 4 cold loads: 834, 834, 834, 834 — deterministic.
```

**Observed vs expected:** Observed: blStart.top = 834 with window.innerHeight = 690 — the button is 144px below the viewport. The visible screen shows the title, the Level buttons, the hearts/score HUD and empty starfield; the intro text only just begins at the bottom edge. Expected: the only control that starts the game is on screen when the screen is opened, or the page scrolls it into view.

## takeoff-no-scroll-position-shows-whole-game

**BUG** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/factor-field/index.html:3054

**What:** Times Table Takeoff's play area (667px) plus 200px of sticky header/nav does not fit a 690px-tall viewport: at every scroll position at least a quarter of the play area is hidden, and there is no position where both the problem at the top and the player's ship at the bottom are visible at once.

**Steps:**

```
Same harness, viewport 1280x690. Opened blast via [data-screen] click, then started the game with page.evaluate(()=>document.getElementById('blStart').click()) (again no puppeteer auto-scroll). Then stepped window.scrollTo(0,y) for y=0..docH in 5-10px steps, and at each step measured blCanvas.getBoundingClientRect() against the sticky bottom edge of .app-header/.nav and window.innerHeight. Ship position is canvasTop + canvasHeight - 40 (ship = {x:W/2, y:H-40} in the source). Screenshot of the best available position: /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/lens4/bl5-mba13.png
```

**Observed vs expected:** Observed at 1280x690: sticky header+nav occupy the top 200px; canvas is 667px tall; the best scroll position (y=250) shows 499px = 75% of the play area, and scanning every scroll position found NONE where the problem row and the ship are both visible. At scrollY=0 (where the game starts) the ship sits at y=1062 and the arrow keypad ends at y=1192, both off a 690px screen. Same at 1024x690. On 1440x830 and iPad portrait 768x1024 a workable position exists (y=235 / y=15) but the game still STARTS with the ship and keypad below the fold. Expected: when the game starts, the player can see their own ship and the controls without scrolling.

## showme-play-button-below-fold-on-ipad

**BUG** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/factor-field/index.html:2564

**What:** On an iPad in portrait, the signature "Show Me How" screen tells you to "Press Show me how" but that button is 332px below the fold — the screen a stranger lands on from the home page's "Start here" card looks like it has no button at all.

**Steps:**

```
Harness at viewport 768x1024 (iPad portrait). fresh load, then clicked the home hero "Watch it worked out →" (and separately the nav [data-screen="showme"] button) via page.evaluate so no auto-scroll happened. Waited 400-600ms. Measured document.getElementById('smPlay').getBoundingClientRect().top over 6 cold loads: 1356, 1356, 1356, 1356, 1356, 1356. Viewport screenshot (not fullPage): /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/lens4/fold-showme-ipad.png
```

**Observed vs expected:** Observed: smPlay.top = 1356 with innerHeight 1024 — 332px below the fold. What IS on screen is the heading, the four operation buttons, the speed/language row, the instruction "...Press Show me how and the hand works it out slowly...", then a large blank band and the top of the stacked digits. Same for Subtract and Add (1356); Divide is fine (689) because its layout is more compact. Expected: the one button the on-screen instruction names is visible on the screen that names it.

## takeoff-zaps-aliens-before-they-appear

**BUG** — reachable  
**Where:** factor-field/index.html:3143 (update(): bullet/invader collision, no y>0 guard) and 3125 (onCorrect: invaders=[] but bullets kept)

**What:** In Times Table Takeoff, bullets already in flight are never cleared when the problem changes, and the hit test has no "is the alien on screen yet" guard — so a leftover bullet destroys the next problem's correct alien while it is still above the top of the canvas. The child is credited with a correct answer, +10 score and a star for a fact they never saw.

**Steps:**

```
Ran two browser sessions against http://127.0.0.1:<port>/index.html.
(a) NATURAL PLAY — Takeoff → Level 🌱 Beginner → Start ▶ → hold Space down (the natural way to play) and jiggle ←/→ for 260s across 2 games. Wrapped recordAttempt() to timestamp every recorded answer. A new problem appears 260ms after a correct zap and 750ms after a miss, and an alien spawns at y=-28..-98 and falls at ~22px/s, so it is above the canvas for at least ~0.8s. RESULT: 2 of 29 recorded correct answers landed less than 800ms after their aliens spawned; the fastest at +76ms, at which point the alien was still ~26px ABOVE the top of the canvas.
(b) DETERMINISTIC — same screen, hold Space, then force a fresh problem repeatedly by clicking the level button already selected (which runs `invaders = []; newProblem()`), 521 times over 90s. RESULT: 63 recorded correct answers, several at +4ms, +10ms and +11ms after the aliens were created — a kill on the very first frame after spawn. Stars went 0 → 63.
```

**Observed vs expected:** Observed: a correct answer is recorded, +1 star added and the score raised for an alien destroyed while it was still off the top of the canvas; the banner problem then flips 260ms later. On the My Progress report this shows as a fact the child answered correctly and never actually saw. Expected: bullets cleared (or ignored) when the problem changes, and no collision with an alien that has not entered the play area.

## speed-play-again-swaps-first-question

**BUG** — reachable  
**Where:** factor-field/index.html:1463 (end() clears the ticker but not pendingTimers) / 1450 and 1456 (later(nextQ,...))

**What:** Speed Run: an answer given in the last second of the 60s clock leaves a "next question" timer running past the end of the game. Press "Play again ⚡" and that orphaned timer fires into the NEW run, silently replacing the first question the child is reading.

**Steps:**

```
Speed Run → Start! → let the clock run to the very last quarter-second (I polled #timerFill until its width was ≤0.5%) → click a WRONG choice (this schedules `later(nextQ, 900)`) → the results screen appears ~210ms later → click "Play again ⚡" immediately → then touch nothing and watch the equation. Ran twice, both times identical.
Run 1: new game opened on "8 × 6 = ?", changed by itself to "3 × 4 = ?" 690ms after Play again.
Run 2: new game opened on "4 × 8 = ?", changed by itself to "8 × 8 = ?" 683ms after Play again.
```

**Observed vs expected:** Observed: the first question of the new run, plus its four answer buttons, is thrown away and replaced with a different one about 0.7s in, with no input from the child. Expected: end() (or start()) cancels the pending next-question timer, so a new run shows the question it started with. Note the guard `if (timeLeft > 0) nextQ()` passes because start() has already reset timeLeft to 60.

## sample-mode-absorbs-real-practice

**BUG** — reachable  
**Where:** factor-field/index.html:2748 (loadSample path) / 959 recordAttempt (no who.sample guard)

**What:** Nothing stops a child playing while the sample student is loaded. Every answer and every star goes straight into Maya Torres's record, and the report, the print and the CSV all still say "Sample student — Maya Torres".

**Steps:**

```
My Progress → "👋 Try it with a sample student" (181 answered, 260 stars, sample bar showing) → Digit Drop → answer 6 questions correctly through the normal card-tap + "Check ✓" path → My Progress.
```

**Observed vs expected:** Observed: the report now reads 187 questions answered / 272 stars — the child's six real answers merged into the sample's numbers. The initials box is still locked to "M.T." and read-only, mq_who.sample is still true, and clicking 🖨️ Print produces a file named "Factor Field progress - SAMPLE Maya Torres 2026-08-08" whose printed line reads "Sample student — Maya Torres (M.T.)". Expected: either the sample is read-only while loaded (the code already blocks typing real initials over it, for exactly this reason — see the comment at wireWhoBoxes), or the first real answer clears the sample first.

## clear-sample-wipes-practice-no-warning-no-undo

**BUG** — reachable  
**Where:** factor-field/index.html:2754 (clear handler calls clearSample() with no confirm/stashUndo) / 1816 clearSample()

**What:** "Clear the sample" throws away everything, including real practice done since the sample was loaded — with no confirmation and no "Bring it back" button, unlike "Reset progress" which has both.

**Steps:**

```
Continuing straight from the run above (sample loaded, then 6 real questions answered in Digit Drop, report showing 187 answered / 272 stars): on My Progress click "Clear the sample" in the sample banner.
```

**Observed vs expected:** Observed: totalAnswered() → 0, stars → 0, window.__confirms.length === 0 (nothing was asked), localStorage 'mq_undo' === null and no #undoReset button on the page. The six real questions are unrecoverable. Expected: the same treatment "Reset progress" gets — a confirm and a stashUndo() so "↩️ Bring back the progress I just cleared" appears.

## report-date-frozen-from-the-day-it-was-first-saved

**BUG** — reachable

**What:** The report date is written to storage once (the first time initials are typed, or the first Reset) and then never refreshes. Every report printed on every later day carries that first date — a date the teacher never chose.

**Steps:**

```
Served factor-field/ over node http on 127.0.0.1 and drove real Chrome (puppeteer-core, headless:'new'). Script: scratchpad/t4-date.js and t13-date2.js.
Path A (t4): fresh page, localStorage cleared. Answered 10 questions via recordAttempt, show('progress'), clicked #whoInitials and typed 'ab' with real keypresses. Stored mq_who = {"initials":"AB","date":"2026-08-08","sample":false}. Then reloaded the same tab with window.Date shimmed forward 5 days (evaluateOnNewDocument Proxy on Date, so todayISO() returns 2026-08-13). show('progress'), clicked #progPrint.
Path B (t13, no typing at all): fresh page, answered 10, show('progress'), clicked #resetProg (confirm stubbed true) — that alone writes mq_who with today's date. Reloaded 90 days forward, answered 10 more as a different child, typed 'jr' into #whoInitials, clicked #progPrint.
```

**Observed vs expected:** Path A: page reports todayISO() === '2026-08-13', but #whoDate still reads '2026-08-08', the .who-print line reads 'Child: AB · Date: 2026-08-08 · ✖️ Factor Field', and that is exactly the string captured inside the stubbed window.print. Path B: page reports todayISO() === '2026-11-06'; the captured print line is 'Child: JR · Date: 2026-08-08 · ✖️ Factor Field' and mq_who is {"initials":"JR","date":"2026-08-08"}. Expected: the date box and the printed line default to the current day whenever the teacher has not explicitly set a date for this report; observed a three-month-old date on a new child's paper, plus in the suggested PDF filename ('Factor Field progress - JR 2026-08-08'). index.html

## full-disk-half-saves-stars-but-not-answers

**BUG** — reachable

**What:** When localStorage is full, the small mq_stars write still succeeds while the larger mq_stats write fails. After the next reload the warning is gone and the report shows two headline numbers that contradict each other — the exact bug the reset code says it fixed.

**Steps:**

```
scratchpad/t11-quota2.js and t12-confirm.js (run 3x, identical each time). Fresh page over http. Answered 10 questions (mq_stats and mq_stars both saved cleanly). Then filled the origin's localStorage to the byte from inside the page — 512KB chunks until QuotaExceededError, then 64KB, 4KB, 256B, 16B and 1B chunks until even a 1-byte write throws. Then carried on playing: show('drop'), 25 more recordAttempt(8,9,true,false), addStars(50). Waited 250ms. Reloaded the tab and opened show('progress').
```

**Observed vs expected:** During the session storageOK === false and the 'Nothing is being saved on this laptop' banner is present (68px tall, first child of body). But mq_stars on disk is already '70' (the new value — it fits, because the string is the same length) while mq_stats on disk is still the old 10-question blob. After the reload the banner is GONE (document.getElementById('storageNote') === null, because small writes work again) and the progress report reads: '10 questions answered' / '100% correct overall' / '70 stars earned'. Expected: either both save or neither, or the report refuses to present a star count that its own answer count cannot account for. Instead a teacher gets a clean-looking, unwarned r

## fact-key-from-storage-is-injected-raw-into-the-report

**BUG** — contrived

**What:** loadStats rebuilds every fact's numbers but never checks the fact KEY. A nonsense key is printed verbatim as a 'trickiest single fact' on the parent report and in the CSV, and because it is interpolated into innerHTML unescaped, a key containing HTML executes.

**Steps:**

```
scratchpad/t3-deep.js and t9-inject.js. Fresh page over http. Set localStorage mq_stats to {"facts":{"6x7":{seen:6,correct:5,wrong:1,hinted:0,ts:1}, KEY:{seen:6,correct:1,wrong:5,hinted:0,ts:1}},"correct":6,"wrong":6}. Reloaded, show('progress'), opened the #grownups <details>, and read buildInsights().trouble, the summary text, and progressCSV(...). Tried KEY = 'banana', '3x', 'x', '999x999', '0x0', '5x4x3', '<b>hi</b>', and '<img src=x onerror="document.title=\'INJECTED\';window.__pwned=1">'. Re-ran; identical.
```

**Observed vs expected:** KEY='banana' → grown-ups summary reads 'Trickiest single facts: banana×undefined.' and the CSV line is 'Trickiest single facts,banana×undefined'. KEY='3x' → '3×'. KEY='x' → '×'. KEY='999x999' → '999×999' (a fact the tool cannot generate). KEY='<b>hi</b>' → CSV holds '<b>hi</b>×undefined' while the screen shows a bold 'hi', proving the tags were parsed. KEY='<img src=x onerror=...>' → document.title became 'INJECTED', window.__pwned === 1, and one <img> element exists inside #grownups. Expected: a key that is not two integers 1–12 is dropped on load, and whatever is shown is escaped. Root cause: index.html:895 iterates Object.keys(s.facts) and sanitises only the values; index.html:1743 does k

## stretches-say-nothing-tricky-while-map-and-csv-say-needs-practice

**BUG** — reachable  
**Where:** factor-field/index.html:1737

**What:** The Stretches card (and the Stretches block in the exported CSV) says "Nothing tricky right now" on the very same page/file where the times-table map, the CSV table rows and the For-grown-ups summary all mark tables as "needs practice". A table needs seen>=6 to become a Stretch (index.html:1737) but only seen>=2 to be banded "needs practice" on the map (index.html:1844) and seen>=4 to be listed in the grown-ups summary (index.html:1849).

**Steps:**

```
Real clicks/typing, no scripting of state. 1) Open http://127.0.0.1:PORT/index.html, clear localStorage, reload. 2) Click ⚙️, untick every table except ×7, click Save. 3) Go to 🔍 Mystery Factor. Five times: read the equation, type a WRONG number, click "Check ✓", then click "New mystery". 4) Click ⚙️ again, untick ×7, tick ×2, Save. 5) In Mystery Factor answer 3 questions CORRECTLY. 6) Click 📊 My Progress, open the "👀 For grown-ups" summary, then click "⬇️ Save the numbers (CSV)".
```

**Observed vs expected:** Observed — map: 4s 50% clay, 7s 0% clay, 11s 33% clay, 2s 100% green; CSV rows: "4s,2,1,50,0,needs practice", "7s,5,0,0,0,needs practice", "11s,3,1,33,0,needs practice"; grown-ups: "Needs practice: 7s." — but the Stretches card reads "Nothing tricky right now — you're doing great! 🎉" and the CSV's Stretches section reads "Nothing tricky right now." Expected — the Stretches list (screen, print and CSV) to name the same tables its own map/rows/summary have just flagged, or at least not to state the opposite.

## array-count-reveal-tap-scores-as-correct

**BUG** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/factor-field/index.html:1641

**What:** Array Builder "Count it" has no answer lock: after a wrong tap the tool highlights the right answer in green, and tapping that green answer within the next 1.5 s is scored as a correct answer — +2 stars and a correct attempt logged against the same fact the child just got wrong.

**Steps:**

```
Executed in headless Chrome over http://127.0.0.1 with real page.mouse.click, 4/4 trials reproduced.
1. Load index.html fresh (localStorage cleared).
2. show('array') — it opens in the "Count it" sub-mode.
3. Scroll to "Now pick the answer 👇" (the choices sit below the fold at 1280x900) and click a WRONG choice with a real mouse click.
4. Feedback reads e.g. "It was 63." and the handler adds class .correct to the right answer, turning it green.
5. Within the 1500 ms before the deferred renderCount fires, click that green choice with a real mouse click.
Trials: 7x9 (tapped 72 then 63), 5x10 (51 then 50), 2x12 (36 then 24), 10x5 (51 then 50).
Contrast run in the same script: the identical sequence in Speed Run changes nothing, because SCREENS.speed sets locked = true in answer().
```

**Observed vs expected:** Observed: feedback flips from "It was 63." to "🎉 Correct! +2 ⭐"; stars go 0 -> 2; stats for the fact become {seen:2, correct:1, wrong:1} — one question the child got wrong is recorded as 50% correct, and the star jar pays out for tapping the answer the tool had just revealed. Repeating the tap inside the window pays again. Expected: the same lock Speed Run uses — the first answer settles the question, further taps on the revealed answer are ignored, the fact stays {seen:1, correct:0, wrong:1}, no stars. Root: the .choices click handler in renderCount (factor-field/index.html:1641-1656) has no `locked` guard, unlike SCREENS.speed's answer() at index.html:1436.

## difficulty-setting-does-nothing

**BUG** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/factor-field/index.html:1024

**What:** The Easy / Medium / Hard control in Settings saves, persists and shows itself as chosen, but nothing in the tool ever reads it — pickBlank() is never called, so every mode generates exactly the same problems on Easy as on Hard.

**Steps:**

```
Executed in headless Chrome over http://127.0.0.1.
1. Fresh load. Click ⚙️, click "Easy" in the Difficulty segment, click "Save settings" (toast: "Settings saved! ✓").
2. show('mystery'); click "New mystery" 50 times and read #eq each time. Result: product hidden 0/50, a factor hidden 50/50. Easy is specified (index.html:1020) as always hiding the product.
3. Click ⚙️, click "Hard", Save.
4. show('drop'); click "New problem" 50 times. Result: product hidden 50/50, factor hidden 0/50. Hard is specified (index.html:1022) as leaning toward missing factors.
5. Wrapping pickBlank with a counter before any of this and reading the counter after 120 generated problems: 0 calls.
6. localStorage mq_settings.difficulty === "hard"; reload the page, open ⚙️, and #diffSeg button.on reads "Hard".
```

**Observed vs expected:** Observed: the setting is stored, survives a reload, and the drawer highlights it — but Digit Drop always hides the product and Mystery Factor always hides a factor, identically on Easy, Medium and Hard. pickBlank() is executed zero times because both genProblem() call sites (index.html:1202 `genProblem("p")` and index.html:1314 `genProblem(pick(["a","b"]))`) pass a forced blank, so `forceBlank || pickBlank()` never falls through. Expected: changing the difficulty changes which part of the equation is blank, as the code at index.html:1019-1023 describes. A control that says "Settings saved! ✓" and then persists a choice nothing acts on is a state nothing on screen reports.

## worksheet-visuals-cut-in-half-by-page-break

**BUG** — reachable

**What:** On the picture-based worksheets (Arrays, Bar models, Number bonds, Equal groups) the printed page break falls INSIDE a problem, so the dot array or bar diagram prints at the foot of one sheet and its "___ × ___ = ___" answer line prints at the top of the next. No rule anywhere in index.html sets page-break-inside / break-inside: avoid.

**Steps:**

```
Served /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/factor-field over node http on 127.0.0.1, opened /index.html in real Chrome (puppeteer-core, headless 'new'), localStorage.clear() + reload. Clicked into Worksheet Maker via show('worksheet'), then page.select('#wsType','array') leaving How-many at its default 20 problems. Switched to print media (page.emulateMediaType('print')) and set the viewport to the printable area of US Letter with Chrome's default 0.4in margins: 739 x 979 CSS px. Then measured every .ws-prob against the page boundary at y=979. Script: scratchpad/stranger/clip2.js and split.js / split2.js. Also captured the band around the boundary as a PNG (scratchpad/stranger/out/ws/clip2-array.png).
```

**Observed vs expected:** Observed: problems 16, 17 and 18 all span the boundary — top 892, bottom 1018, boundary 979. Problem 16's answer line starts at y=969, so the line of underscores is sliced horizontally by the page edge; problem 18's grid still has dots below 979 and its answer line (992–1018) lands entirely on sheet 2. Reproduced 3 runs out of 3 (3 straddling problems each time), and it is not an artefact of my margin guess: with zero margins (boundary 1056) the same three problems straddle. Matrix over the count dropdown (740x979, boundary 979) — array 10:0 12:0 15:0 20:3 24:3 30:0, barmodel 10:0 12:2 15:2 20:2 24:2 30:4, numberbond 20:3 24:3 30:3, equalgroups 15:1 20:2 24:2 30:2, facts 0 at every count. Ex

## progress-report-prints-with-no-colour

**BUG** — reachable

**What:** "🖨️ Print this report" with the browser's default print settings prints the times-table map as twelve identical white boxes, while the legend immediately above still reads "Green = strong · amber = getting there · clay = needs practice · grey = not tried yet". The map's meaning lives entirely in background-color and nothing sets print-color-adjust: exact. The "🎯 Practise all of these — Speed Run" button prints as an empty box for the same reason.

**Steps:**

```
Same local http server + real Chrome. Built a real report through the tool's own recording path (for t=2..10, six recordAttempt(t, ...) calls each, then addStars(30)) and called show('progress'); the 12 cells came out as tc-none/tc-strong/tc-good/tc-mid/tc-low with backgrounds rgb(159,211,171), rgb(207,224,189), rgb(240,216,166), rgb(231,180,166), rgb(233,226,213). Then printed the page twice with page.pdf({format:'Letter', margin:0.4in}) — once with printBackground:false (which is exactly the print dialog's "Background graphics" checkbox, unticked by default in Chrome, Safari and Firefox) and once with printBackground:true — inflated every PDF content stream with zlib and searched for those four fill colours. Scripts: scratchpad/stranger/mapprint.js and btncheck.js; visual of the same page with backgrounds suppressed at scratchpad/stranger/out/progress-print-nobg.png vs progress-print-withbg.png.
```

**Observed vs expected:** Observed: printBackground=false -> strong:false, good:false, mid:false, none:false — not one of the four band colours is drawn anywhere on the printed page. printBackground=true -> all four present. So the paper a parent gets shows "2s 93%", "7s 50%", "11s —" in twelve unbordered white boxes, under a legend that explains four colours that are not there. Same cause hits #focusSpeed: computed color rgb(255,255,255), background rgb(167,95,62), borderStyle none, and it is NOT inside .no-print — so "🎯 Practise all of these — Speed Run" prints as white text on white paper, an empty bordered gap with only the 🎯 visible (see progress-print-nobg.png). Expected: the map keeps its colours on paper (p

## share-link-pasted-into-an-open-tab-does-nothing

**MINOR** — reachable

**What:** Pasting a Factor Field share link into a tab that already has Factor Field open changes the address bar but nothing else — the shared worksheet never loads, because the payload is only read once at page load and there is no hashchange handler.

**Steps:**

```
scratchpad/saved-data-lens/t5b.js, last section.
1. Open /index.html fresh (home screen showing).
2. Navigate to the same page with a share hash, which is exactly what the address bar does: location.href = origin + pathname + '#ws=' + base64({v:1,type:'wordproblem',count:8,tables:[3],maxFactor:12,title:'Ms Lee word problems'}). Wait 700ms.
3. Then press reload.
```

**Observed vs expected:** Observed after step 2: location.hash is the new share payload, but the screen is unchanged — first line still "Pick a way to play! 🚀", and there is no #wsHeadTitle at all. After the manual reload in step 3 the screen becomes "🖨️ Worksheet Maker" with heading "Ms Lee word problems". So the link works only if it opens in a fresh tab. Expected: a hashchange listener that re-reads the #ws= payload, so a pasted link opens the sheet whether or not the tool is already open in that tab.

## stars-stored-out-of-range-are-trusted

**MINOR** — contrived

**What:** mq_stars is trusted for any value parseInt can chew on, so a negative or astronomical star count flows straight onto the star jar, the report tile and the CSV.

**Steps:**

```
scratchpad/saved-data-lens/t2.js and t7.js.
1. Fresh tool → localStorage.setItem('mq_stars','-40') → reload.
2. Record 10 correct answers and addStars(20), then open My Progress and click "Save the numbers (CSV)" (the download is intercepted and the Blob read).
3. Separately: mq_stars = '999999999999999999999' → reload → addStars(2).
```

**Observed vs expected:** Observed for '-40': the header star jar reads "-20", the report tile reads "-20 stars earned", mq_stars is written back as "-20", and the CSV row is "Stars earned,-20". For the huge value: stars loads as 1e21, the jar renders the literal text "1e+21", and addStars(2) changes nothing at all — the child earns stars forever with no effect, and "1e+21" is written back to storage. Expected: parseInt's result should be clamped to a finite count of zero or more (and to something a child can read) before it reaches the jar, the report and the CSV — "-20 stars earned" on a printed report is nonsense.

## stale-boxes-after-wrong

**MINOR** — reachable

**What:** After a wrong answer Digit Drop empties the answer boxes in memory but leaves the wrong digits on screen for 1.4 s, so pressing Check in that gap says "Fill every box first!" while every box visibly holds a digit.

**Steps:**

```
Fresh page. show('drop'); question 7 × 1 = 7; clicked [data-card="8"] so the single box read '8'. Clicked #check -> feedback 'Not quite — tap 🧮 I need a hint and use the blocks!' and the box still read '8' (class 'empty' absent). Clicked #check again 80 ms later -> feedback 'Fill every box first!' while the box on screen still read '8'. Then clicked [data-card="5"] during the same window: the box jumped straight to '5', replacing the '8' rather than adding to it.
```

**Observed vs expected:** Observed: for 1.4 s the screen and the state disagree, and the tool tells the child to fill boxes that look full. Expected: clear the boxes on screen at the same moment they are cleared in state (index.html:1301 defers render by 1400 ms after already emptying `boxes`).

## takeoff-eats-spacebar

**MINOR** — reachable

**What:** While Times Table Takeoff is open, its document-level key handler swallows Space and the arrow keys for the whole page, so the spacebar cannot activate any focused button anywhere and arrow keys cannot work the Settings dropdown.

**Steps:**

```
Fresh page. show('blast'). Focused the nav button [data-screen="worksheet"] and pressed Space -> nothing happened, the heading stayed '🚀 Times Table Takeoff'. Control: show('home'), focused the same nav button, pressed Space -> heading became '🖨️ Worksheet Maker'. Separately, with Takeoff running I clicked #gearBtn, focused #maxFactor and dispatched a cancelable ArrowLeft keydown: e.defaultPrevented === true, and holding ArrowLeft lit the game's on-screen '←' key (#blLeft gained class 'active'); holding Space lit #blFire.
```

**Observed vs expected:** Observed: from the Takeoff screen the spacebar is dead for every button on the page (nav, Settings drawer) and arrow keys steer the ship instead of working the focused control. Expected: the game's key handling should be scoped to the game (or ignore keys while a modal/another control has focus). index.html:3255 binds onKey to `document` and preventDefaults unconditionally.

## game-runs-behind-settings

**MINOR** — reachable

**What:** Opening the ⚙️ Settings drawer over Takeoff or Speed Run does not pause them — the clock keeps running behind the modal, and in Takeoff the questions the child cannot see are recorded as wrong answers on the progress report.

**Steps:**

```
Takeoff: fresh page, show('blast'), clicked #blStart, waited 30 s untouched -> totalAnswered()=1, stats.wrong=1. Repeated identically but clicked #gearBtn 300 ms after starting and left the drawer open (panel.classList 'open' confirmed) for the same 30 s -> totalAnswered()=1, stats.wrong=1: byte-for-byte the same, so the drawer pauses nothing and a life plus a wrong answer were logged for a question hidden behind the modal. Speed Run: fresh page, show('speed'), clicked #go, waited 1.2 s (#tnum='59'), clicked #gearBtn, waited 1.5 s -> #tnum='57' with the drawer open.
```

**Observed vs expected:** Observed: the modal covers the game but the game clock and its scoring keep going; wrong answers nobody was shown land in the times-table map and the "needs practice" list. Expected: pause the run (or at least stop recording attempts) while the settings drawer is open.

## settings-x-still-applies

**MINOR** — reachable

**What:** Closing the Settings drawer with the X or by clicking the backdrop keeps the changes for the rest of the session but never saves them, so the same click sequence behaves one way now and the opposite way after a reload.

**Steps:**

```
Fresh page (settings.tables = [2,3,4,5,6,7,8,9,10]). Clicked #gearBtn, clicked #selHard, then clicked #closePanel (the X) — no Save. settings.tables in memory = [6,7,8,9,10,11,12]; localStorage 'mq_settings' = null. Generated 40 questions through the tool's own genFact(): 0 of 40 came from tables 1–5 (sample: 12x4, 6x1, 6x5, 12x7, 11x7, 9x3), so the abandoned change is live in the game. Reloaded the page: settings.tables back to [2,3,4,5,6,7,8,9,10].
```

**Observed vs expected:** Observed: the X reads as "cancel" but the change takes effect immediately and silently reverts on the next reload. Expected: either the X discards the edits, or closing applies and saves them.

## share-link-ignored-in-an-open-tab

**MINOR** — reachable  
**Where:** factor-field/index.html:3514 (boot() reads location.hash once and nothing listens for a change)

**What:** There is no hashchange listener, so pasting a shared worksheet link into a tab that already has Factor Field open does nothing at all — the screen does not change and there is no message.

**Steps:**

```
1) Tab A: load cold, 🖨️ Worksheet Maker, choose "Bar models", click 🔗 Copy share link, capture location.href. 2) Same tab, load cold again so it is sitting on Home ("Pick a way to play! 🚀"). 3) Set location.href to the copied link — exactly what pressing Enter on a pasted URL does when only the hash differs. 4) Wait 800 ms. Result: h1 still "Pick a way to play! 🚀", document.getElementById('sheet') is null, location.hash is 280 characters long. Nothing happened, silently. (Opening the same link in a genuinely fresh tab works — all 14 worksheet types round-trip identically, so the payload itself is fine.)
```

**Observed vs expected:** Observed: the link appears to be broken to the person who received it; the URL bar changes but the page does not. Expected: window.addEventListener('hashchange', …) re-runs boot() so the shared sheet appears.

## wordproblem-prints-a-near-blank-extra-page

**MINOR** — reachable  
**Where:** factor-field/index.html:3390 (worksheet layout; no page-height budget for the 1-column word-problem body)

**What:** On US Letter, "Word problems" and "Multiply in parts" overflow one page by about 20 px, so every print produces an extra sheet of paper carrying a single question.

**Steps:**

```
1) Load cold, 🖨️ Worksheet Maker, choose "Word problems" (defaults: 20 problems, 1 column, answer key on). 2) page.pdf({format:'Letter', margin:0.4in}) — the PDF's /Pages /Count is 3 (body page, spill page, answer key). 3) Rendered page 2 alone (pageRanges:'2'): /private/tmp/.../scratchpad/wp-page2.pdf.png is a full sheet of paper holding only "20. There are 7 bags. Each bag has 3 apples. How many apples in all? ______". Measured under print media at 739 px printable width: sheet body bottom = 1000 px against a 979 px Letter page box (Multiply in parts = 989 px). The same two types print 2 pages on A4, so this is Letter-specific.
```

**Observed vs expected:** Observed: 3 printed pages instead of 2, page 2 being 97% blank — 25 wasted sheets for a class set. Expected: 20 word problems fit the page they were laid out for, or the body is allowed to break sensibly.

## speed-review-same-fact-both-columns

**MINOR** — reachable

**What:** The Speed Run end-of-round review can list the same fact in both columns at once — "4 × 7 = 28" under "You got these!" and "7 × 4 = 28" under "Practice these next time".

**Steps:**

```
fresh page → #gearBtn → turn on only ×4 and ×7, "up to 9", #saveSettings → show('speed') → click #go → played the full real 60-second round, reading the .equation each time and clicking the correct .choice when the first factor was the smaller one and a wrong .choice when it was the bigger one (99 questions answered) → read the two .review-col lists on the Time! screen.
```

**Observed vs expected:** GOT column contained "4 × 7 = 28"; MISS column contained "7 × 4 = 28you said 32". The same fact, contradictory advice, on one screen — and the progress report records them as one fact (factKey uses min/max, index.html:958). Expected: one fact appears once. Cause: the review keys on the ordered pair `e.a + "x" + e.b` (index.html:1472), so the `for (const k of missed.keys()) got.delete(k)` de-duplication at index.html:1476 never matches the reversed order.

## map-band-disagrees-with-rounded-percent

**MINOR** — reachable

**What:** Two times-table squares both reading "90%" are coloured and graded differently — one green/"strong", one amber/"good" — because the printed number is rounded but the colour and the CSV band use the unrounded fraction.

**Steps:**

```
For each case: fresh page → in-page `for(i<C) recordAttempt(7,7,true,false); for(i<W) recordAttempt(7,7,false,false); addStars(2*C)` → show('progress') → read the 7s square's .pct and class and the Strengths list → click #progCsv and read the 7s row. Ran C/W = 26/3, 18/2, 15/5, 38/13, 12/8, 0/10.
```

**Observed vs expected:** 26 right of 29 (89.66%): map reads "90%" but is tc-good (amber); CSV `7s,29,26,90,0,good`; Strengths list empty. 18 right of 20 (90.00%): map reads "90%" and is tc-strong (green); CSV `7s,20,18,90,0,strong`; Strengths says "Your 7s are strong — 90% right!". Same for 75%: 38/51 reads "75%" but is tc-mid/"getting there", while 15/20 reads "75%" and is tc-good. Expected: a square labelled 90% is banded the same way whichever child it belongs to; the legend says "Green = strong" and a 90% square that is amber contradicts it. Cause: the label rounds (index.html:2792) while cellClass (index.html:1842) and the CSV band (index.html:2681) compare the raw fraction.

## focus-pill-ignored-by-takeoff

**MINOR** — reachable

**What:** The header pill keeps claiming "🎯 Practicing your 8s" on the Times Table Takeoff screen, which never serves an 8 on its easier levels.

**Steps:**

```
fresh page → build a report through recordAttempt (twelve 8×8 wrong, ten 2×3 right, addStars(20)) → show('progress') → click the Stretch button "Your 8s — 0% right so far ▶ practice the 8s" → pill reads "🎯 Practicing your 8s" and genFact returns an 8 in 40/40 draws → navigate to Takeoff (show('blast')) → wrapped window.recordAttempt to log the facts the game really serves → clicked the Beginner level, clicked Start, held ArrowUp and swept ArrowLeft/ArrowRight for a real play session; repeated across Beginner/Medium/Advanced.
```

**Observed vs expected:** Pill still reads "🎯 Practicing your 8s" and is visible on the Takeoff screen. Facts actually served on Beginner across two sessions: 1×3, 2×4, 2×3, 10×5, 10×1, 1×4, 5×3, 4×4, 5×1 — zero 8s (Beginner's own list is [1,2,3,4,5,10], so an 8 cannot appear); Medium served 5×2. The Worksheet Maker likewise still says "Uses your chosen tables: 2, 3, 4, 5, 6, 7, 8, 9, 10" with the pill on. Expected: the pill either applies on that screen or is not shown there. Cause: Takeoff's newProblem (index.html:3099) picks from LEVELS[blLevel].tables and never calls genFact, so focusTable is ignored while the pill stays lit.

## print-twice-leaves-tab-title-stuck

**MINOR** — reachable

**What:** Clicking "Print this report" twice in quick succession leaves the browser tab permanently named "Factor Field progress - AB 2026-08-08" — a child's initials stay in the tab and window title for the rest of the session.

**Steps:**

```
fresh page → recordAttempt(3,4,true) ×10, addStars(20) → show('progress') → type "ab" into #whoInitials → click #progPrint, wait 200 ms, click #progPrint again (window.print stubbed so the handler runs through) → wait 3 s and read document.title → then show('worksheet') and click #wsPrint, wait 2.5 s, read document.title again.
```

**Observed vs expected:** Suggested filenames were right both times ('Factor Field progress - AB 2026-08-08'), but document.title 3 s later was still 'Factor Field progress - AB 2026-08-08' instead of 'Factor Field — Times Tables Practice', and it was still that after printing a worksheet. Expected: the tab returns to the tool's own name, as the existing single-print check asserts. Cause: printAs (index.html:2612) captures `original` from the live document.title and restores it 1200 ms later; the second call captures the already-stamped title, and its later timer overwrites the first timer's correct restore.

## settings-save-says-saved-when-nothing-is

**MINOR** — reachable

**What:** Same browser, same page: the banner across the top says nothing can be stored, yet pressing Save in Settings answers "Settings saved! ✓". Two contradictory statements on one screen; the teacher believes the choice will stick.

**Steps:**

```
Same throwing-localStorage tab as above. Click #gearBtn, wait for the drawer, click #selEasy (tables 1-5), click #saveSettings. Read #toast -> "Settings saved! ✓" while #storageNote is present and reads "Nothing is being saved on this laptop...". Also tested a second, quieter browser shape: localStorage whose setItem is a silent no-op (some privacy extensions behave this way rather than throwing) — there is then no banner at all, the toast still says saved, and after a reload 15 recorded answers, 30 stars and the chosen tables were all back to defaults with nothing on screen ever hinting at it. Reproduced on two runs.
```

**Observed vs expected:** Observed: "Settings saved! ✓" after a save that failed. Expected: index.html:3509 `saveSettings(); closePanel(); toast("Settings saved! ✓")` ignores the boolean lsSet returns. The toast should reflect whether the write succeeded.

## undo-slot-star-count-as-text-concatenates

**MINOR** — contrived

**What:** The undo slot's star count is restored without being turned back into a number. If it is text, the next correct answer concatenates instead of adding: 20 stars plus 2 becomes 202, and 202 is what gets saved.

**Steps:**

```
Fresh page: localStorage.setItem('mq_undo','{"stats":{"facts":{"3x4":{"seen":4,"correct":4,"wrong":0,"hinted":0,"ts":1}},"correct":4,"wrong":0},"stars":"20","who":null}'), then undoReset() (what the "Bring back the progress I just cleared" button calls). stars is then the string "20"; a single addStars(2) makes it "202", the ⭐ counter in the header reads 202 and localStorage mq_stars is "202".
```

**Observed vs expected:** Observed: 20 + 2 = 202. Expected: index.html:954 `setStars(u.stars || 0)` passes the stored value straight through, unlike loadStats which rebuilds every count with safeCount. Note this is adjacent to the already-known undo-slot-restores-unsanitised-stats, but it is a different field and a different symptom — arithmetic that silently concatenates rather than a bad report number.

## espanol-changes-nothing-visible

**MINOR** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/factor-field/index.html:2564

**What:** In Show Me How, clicking "🇪🇸 Español" leaves every word on the page in English — the screen text is byte-identical before and after. Only the speech bubbles during the walkthrough switch to Spanish.

**Steps:**

```
Harness at 1280x900. fresh load, show('showme'), captured document.getElementById('app').innerText. Clicked the button whose text matches /Espa/ via page.evaluate. Waited 500ms, captured innerText again and compared. Then pressed "Show me how" and sampled .sm-bubble every 250ms for 15s.
```

**Observed vs expected:** Observed: before === after is TRUE — not one character of the page changed. The only difference is the button class ('🇬🇧 English:sm-spd on' / '🇪🇸 Español:sm-spd ' becomes '🇬🇧 English:sm-spd ' / '🇪🇸 Español:sm-spd on'). The heading, instructions ("A big multiplication problem, stacked up. Press Show me how..."), and both buttons ("👆 Show me how", "🎲 New problem") stay English. Only after starting the walkthrough do bubbles appear in Spanish (e.g. "¡36 tiene dos dígitos — llevamos 3!"). Expected: a control labelled with a language flag changes the language of the page, or is labelled to say it only changes what is said aloud.

## escape-doesnt-close-settings-and-focus-stays-behind

**MINOR** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/factor-field/index.html:3477

**What:** The Settings drawer cannot be closed with Escape, focus is never moved into it when it opens, and Tab from there walks the nav buttons hidden behind the drawer.

**Steps:**

```
Harness at 1280x900. fresh load, page.click('#gearBtn'), waited 600ms — panel.className is 'panel open'. Recorded document.activeElement. Pressed Escape, waited 500ms, re-read panel.className. Then pressed Tab six times, recording activeElement and whether it was inside #panel. Separately confirmed clicking the dim overlay DOES close it.
```

**Observed vs expected:** Observed: after Escape the class is still 'panel open' (drawer stays open). document.activeElement after opening is still 'gearBtn' — focus was never moved into the drawer. The next six Tab stops are all outside the panel: 🏠 Home, 🃏 Digit Drop, 🔍 Mystery Factor, ⚡ Speed Run, 🔢 Array Builder, 🖐️ Show Me How. Source registers close on #closePanel and on the overlay only (index.html:3477-3478); there is no keydown handler for Escape. Expected: Escape closes an overlay drawer, and focus moves into it so a keyboard user reaches Save without tabbing through the page underneath.

## npm-run-coverage-reports-no-coverage

**MINOR** — contrived  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/factor-field/tests/run-tests.js:1

**What:** `npm run coverage` in factor-field/tests silently runs the identical test suite and prints "ALL 102 CHECKS PASSED" with no coverage number — run-tests.js does not implement the --coverage flag its package.json passes.

**Steps:**

```
cd /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/factor-field/tests && npm test (ALL 102 CHECKS PASSED), then npm run coverage. Diffed the two outputs. Then grep -n 'coverage' run-tests.js.
```

**Observed vs expected:** Observed: `npm run coverage` output is identical to `npm test` — 102 PASS lines and "ALL 102 CHECKS PASSED", no coverage report, no percentage, exit 0. grep for 'coverage' in run-tests.js returns zero hits, so the --coverage argument the package.json script passes is ignored. The repo's own standing rule makes 100% executable-line coverage the completion criterion; for this tool that number does not exist and the command that claims to produce it exits green regardless. Expected: either a real coverage report, or no coverage script at all.

## factor-field-missing-from-link-checker

**MINOR** — contrived  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/check_links.py:27

**What:** factor-field/index.html is not in check_links.py's DEFAULT_STARTS, so the repo's own "verify every link before calling anything done" checker never looks at this tool.

**Steps:**

```
grep -n 'DEFAULT_STARTS' -A 20 /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/check_links.py, and grep -rni 'factor' README.md PROGRESS.md check_links.py.
```

**Observed vs expected:** Observed: DEFAULT_STARTS lists decodable-passage-generator/index.html, phonics-assessment-tool/index.html, running-record-tool/index.html, running-record-tool/all-lessons.html, running-record-tool/worked-example.html — factor-field is absent, despite the comment two lines below it saying "A new page joins this list in the same commit that creates it". README.md:201 does link to factor-field/. There is also no root index.html in the repo, so the tool is reachable only by typing its URL. Expected: factor-field/index.html in DEFAULT_STARTS. (Note: the tool itself has no <a href> and no external script/link/img at all, so there is no path case-sensitivity risk on GitHub Pages — I checked.)

## speed-run-stars-vanish-if-you-leave-mid-run

**MINOR** — reachable

**What:** Speed Run only pays out stars (and saves the personal best) when the 60-second timer expires. Leave the screen first and every question you answered is still counted on My Progress, but the stars for them are never awarded — the printed report ends up saying "10 questions answered · 100% correct overall · 0 stars earned". Every other mode (Digit Drop, Mystery Factor, both Array Builder modes, Takeoff) pays per question as you go.

**Steps:**

```
Real clicks in headless Chrome over http://127.0.0.1:PORT/index.html (scratchpad/leave2.js).
1. Fresh page, localStorage cleared.
2. Click the nav button "Speed Run". Intro reads "Personal best: 0".
3. Click "Start!".
4. Answer 10 questions correctly by clicking the choice whose data-val equals a×b (about 6 seconds of play). The HUD now reads "⭐ Score: 25 · 🔥 Streak: 10 · ⏱️ 54s" while the star jar in the page header still reads 0.
5. With ~54 s still on the clock, click the nav button "My Progress" — an entirely ordinary thing to tap.
Also reproduced with 9 questions (scratchpad/leave1.js) and with 4 questions (report still locked, "Answered so far: 4 of 8").
Contrast: scratchpad/speed1.js played a FULL 60-second run — end screen "Score 1688 · earned 844 ⭐", jar 844, mq_stars 844, mq_speed_best 1688 — everything agrees. scratchpad/play1.js shows Digit Drop, Mystery Factor and both Array Builder modes crediting the jar on every single question.
```

**Observed vs expected:** Observed: the three headline tiles read "10 questions answered", "100% correct overall", "0 stars earned"; the header star jar is 0; localStorage mq_stars is still null (never written) and mq_speed_best is still null, so returning to Speed Run again shows "Personal best: 0" even though the child had 25 on screen. Expected: the stars the child visibly earned (the HUD called them "⭐ Score") to be in the jar, so the report's own three numbers do not contradict one another — this is the same self-contradiction the code's own reset comment calls out ("two headline numbers contradicting each other").

## takeoff-level-button-is-a-free-skip

**MINOR** — reachable  
**Where:** factor-field/index.html:3279 (level click handler: `if (running) { invaders = []; newProblem(); }` with no equality check and no penalty)

**What:** Tapping a Takeoff level button mid-game — even the one already selected — wipes the aliens and issues a brand-new problem with no penalty, so a child can dodge every fact they cannot answer and never lose a life or record a wrong answer.

**Steps:**

```
Takeoff → Level ⭐ Medium (already the default) → Start ▶ → never press fire, never move, just click the "⭐ Medium" button once every 1.5 seconds for 150 seconds (100 taps).
Control: same screen, Start ▶, then 150 seconds of doing absolutely nothing.
```

**Observed vs expected:** Observed (tapping): game still running after 150s, 0 attempts recorded, 0 stars, 3 lives intact. Observed (control): game over after 150s, 3 wrong answers recorded. So the level control is a penalty-free skip button that also hides the missed facts from the progress report. Expected: changing the level either restarts the run or at least does not clear an in-flight problem for free; re-selecting the level you are already on should do nothing at all.

## showme-speed-change-ignored-mid-demo

**MINOR** — reachable  
**Where:** factor-field/index.html:2577 (speed button handler only toggles classes) / 2519 (mult and curGlide captured in play())

**What:** Show Me How: changing the Speed while the hand is working has no effect at all on the run in progress, but the button lights up as if it did — the control reports a state the animation is not in.

**Steps:**

```
Show Me How (opens on ✖️ Multiply, 🐢 Slowest) → "👆 Show me how" → 1.5s in, click "🐇 Quicker" → time the caption changes and read the hand's --smglide variable.
```

**Observed vs expected:** Observed: the Quicker button turns on (slower:false slow:false quick:true) but the demo carries on at the slowest pace — captions ~4,200ms apart and --smglide still 1102ms (760 × 1.45). Pressing "🔁 Show me again" afterwards gives --smglide 456ms and captions ~1,650ms apart, so the setting only ever takes effect on the next run. Nothing on screen says so. Expected: either the pace changes from the next beat, or the button does not light up until it is actually in force. (mult and curGlide are read once, in play().)

## reset-leaves-the-personal-bests-behind

**MINOR** — reachable

**What:** 'Reset progress' clears answers, stars and the map but never touches mq_speed_best or mq_blast_best, so the next child on a shared laptop starts against the previous child's personal best.

**Steps:**

```
scratchpad/t8-reset.js. Fresh page over http. Answered 12 questions, addStars(24). Set the two best scores through the tool's own storage wrapper (lsSet('mq_speed_best','240'); lsSet('mq_blast_best','1180')) and reloaded — the same technique the existing suite uses at run-tests.js:668. show('progress'), then clicked #resetProg with window.confirm stubbed to true. Read storage back, then show('speed') and read the screen text. Re-ran; identical.
```

**Observed vs expected:** Before reset: {speedBest:'240', blastBest:'1180', answered:12, stars:24}. After reset: {speedBest:'240', blastBest:'1180', answered:0, stars:0}. The Speed Run start screen then reads '⚡ Speed Run … 🔥 Personal best: 240 Start!'. The confirm text the teacher agreed to says 'The answers, the stars and the times-table map all go back to zero. Your settings and your worksheet are kept.' — the personal bests are neither zeroed nor listed among what is kept, and 'Bring it back' cannot restore them either because they were never stashed (index.html:2874, stashUndo only carries stats/stars/who). Expected: after 'start fresh' a new child sees 'Personal best: 0', or the dialog says the bests are kept.

## stored-initials-bypass-the-four-character-limit

**MINOR** — contrived

**What:** loadWho accepts any string for initials with no length check, so a stored value long enough to be a full name goes onto the printed report, the PDF filename and the CSV — the one thing the 4-character box exists to prevent.

**Steps:**

```
scratchpad/t9-inject.js part B. Fresh page over http, answered 10 questions, addStars(20). Set localStorage mq_who = {"initials":"Maya Torres-Fitzgerald","date":"2026-03-11","sample":false}. Reloaded, show('progress'), clicked #progPrint (window.print stubbed), and generated the CSV via progressCSV(). Re-ran; identical.
```

**Observed vs expected:** #whoInitials has maxLength 4 but its value is 'Maya Torres-Fitzgerald'. The printed line is 'Child: MAYA TORRES-FITZGERALD · Date: 2026-03-11 · ✖️ Factor Field', the tab title at the moment of printing (the suggested PDF name) is 'Factor Field progress - MAYA TORRES-FITZGERALD 2026-03-11', and the CSV's second line is 'Child (initials),MAYA TORRES-FITZGERALD'. Expected: the loader truncates to 4 characters, matching the box and the tool's stated rule 'initials and a date, never a full name' (index.html:917). index.html:932 does `w.initials || ""` with no cap. Only reachable by writing storage directly — the box and paste both honour maxlength — so contrived, but it defeats a stated safety pr

## settings-maxfactor-never-checked

**MINOR** — contrived

**What:** loadSettings validates that tables is a non-empty array but never checks maxFactor, so a non-numeric stored maxFactor makes every question render as '3 × NaN =' with an unanswerable NaN answer; zero/null/negative values silently distort the questions instead.

**Steps:**

```
scratchpad/t3-deep.js part 3. Fresh page over http. Set localStorage mq_settings and reloaded, then called genProblem() six times and opened show('drop') and show('mystery') to read what a child actually sees. Values tried: {"tables":[3],"maxFactor":"lots"}, maxFactor 0, -4, and null.
```

**Observed vs expected:** maxFactor:"lots" → genProblem() returns a=3,b=NaN,p=NaN,answer=NaN six times out of six; the Digit Drop screen reads '3 × NaN = HUNDREDS 0 TENS 0 ONES 0' and Mystery Factor reads '3 × ? = NaN'. Nothing throws, nothing appears in the console, and no answer can ever be right. maxFactor:-4 → questions like '3 × -3 =' and '? × 0 = 0' (negative products in a times-tables tool). maxFactor 0 or null → every question silently collapses to '3 × 1 ='. Expected: an unusable maxFactor falls back to the default 12, the way tables falls back. index.html:846 checks only s.tables before Object.assign, and index.html:1015 feeds the value straight into rint(). Needs a hand-written storage value — the select o

## strengths-say-nothing-while-map-and-csv-say-strong

**MINOR** — reachable  
**Where:** factor-field/index.html:1735

**What:** Same page, opposite direction: the Strengths card and the CSV Strengths block say "Nothing stands out yet" while the map paints those tables green and the CSV rows label them "strong" and the grown-ups summary lists them under "Confident with". Strengths needs seen>=5 (index.html:1735), the map band needs seen>=2 (index.html:1842), the grown-ups list needs seen>=4 (index.html:1848).

**Steps:**

```
Same real-click run as above gives the 2s case. For the sharper case I also ran, in the browser: clear storage, then `for(let i=0;i<4;i++) recordAttempt(4,7,true,false); for(let i=0;i<4;i++) recordAttempt(3,9,true,false); addStars(16); show('progress')`, opened "👀 For grown-ups", then clicked "🖨️ Print this report" and read the page text captured at the moment window.print fired.
```

**Observed vs expected:** Observed on the printed page: "8 questions answered / 100% correct overall" … "💪 Strengths — Keep playing and your wins will show up here!" … map "3s 100% 4s 100% 7s 100% 9s 100%" (all green) … "👀 For grown-ups … Confident with: 3s, 4s, 7s, 9s." In the real-click run the CSV reads "2s,3,3,100,0,strong" while its Strengths section reads "Nothing stands out yet — keep playing." Expected — one consistent statement about which tables are strong across the map, the panel, the summary and the export.

## personal-bests-survive-reset-progress

**MINOR** — reachable  
**Where:** factor-field/index.html:2870

**What:** "Reset progress" promises "The answers, the stars and the times-table map all go back to zero. Your settings and your worksheet are kept." (index.html:2870) but the Speed Run personal best (mq_speed_best) and the Takeoff best (mq_blast_best) are left untouched, so two screens keep reporting a score from practice the report now says never happened.

**Steps:**

```
Speed Run: cleared storage, opened ⚡ Speed Run, clicked Start!, answered the 60-second run correctly (timers scaled down in-page so the run completes quickly; no tool logic changed) — end screen "🏆 New personal best! Score 589 · earned 295 ⭐". Then 📊 My Progress → "Reset progress" → confirmed. Then ⚡ Speed Run again. Takeoff: cleared storage, 🚀 Times Table Takeoff → Start, held ↑ and swept ←/→ until game over (score 110, badge ⭐10). Then My Progress → Reset progress → confirmed → back to Takeoff → Start → let all 3 lives run out.
```

**Observed vs expected:** Observed after the reset — My Progress: 0 questions answered, ⭐ 0, localStorage mq_stars "0"; but Speed Run's intro still reads "Personal best: 589" and Takeoff's game-over overlay still reads "Your score 0 Best: 110" (mq_blast_best still "110"). Expected — either the dialog says the personal bests are kept, or the reset clears them along with the stars and the map.

## grownups-needs-practice-map-calls-getting-there

**MINOR** — reachable  
**Where:** factor-field/index.html:1849

**What:** "Needs practice" means two different numbers on the same sheet. The grown-ups summary calls a table "Needs practice" at acc<0.7 (index.html:1849), while the map legend reserves the phrase "needs practice" for the clay band, which starts below 0.6 (index.html:1844) — so a table at 60–69% is amber "getting there" on the map and in the CSV row, and "Needs practice" in the summary directly beneath it.

**Steps:**

```
Cleared storage, opened 📊 My Progress, clicked "👋 Try it with a sample student" (the demo every first-time visitor is pointed at), opened "👀 For grown-ups", then clicked "⬇️ Save the numbers (CSV)" and "🖨️ Print this report".
```

**Observed vs expected:** Observed — map: "6s 65%", "7s 64%", "8s 64%", "9s 64%" all in the tc-mid amber band, under the legend "amber = getting there · clay = needs practice"; CSV rows: "7s,36,23,64,13,getting there"; grown-ups summary and printed page: "Needs practice: 6s, 7s, 8s, 9s." Expected — the same threshold, or different wording, so the two halves of one page do not label the same table two different things.

## settings-last-table-wont-untick-silently

**MINOR** — reachable

**What:** In the Settings drawer the label says "Which times tables? (tap to toggle)", but tapping the last remaining lit table does nothing at all — no toast, no alert, no note in the panel. The teacher taps and the button simply refuses. (Distinct surface from the already-known worksheet section picker: this is the ⚙ Settings drawer that drives every game.)

**Steps:**

```
Local http server + real Chrome, fresh load with localStorage cleared. Clicked #gearBtn to open Settings, then clicked every lit #tableGrid button except ×7 (leaving only ×7 on — confirmed: ['×7']). Then clicked ×7. Script: scratchpad/stranger/lasttable.js.
```

**Observed vs expected:** Observed: after the click ×7 is still lit (['×7']); #toast textContent is empty and its class is still plain 'toast' with no 'show'; window.alert was never called (window.__alerts === []); and the full innerText of #panel contains no explanatory sentence — the only words are the control labels and "Easy = find the answer…". Expected: either the tap is honoured, or the tool says why it cannot be, e.g. a toast "Keep at least one times table."

## share-hash-sticks

**COSMETIC** — reachable

**What:** The #ws= share hash is never cleared after "Copy share link", so the address bar keeps describing the worksheet while you are on another screen, and any reload teleports you back to the Worksheet Maker.

**Steps:**

```
Fresh page. show('worksheet'), stubbed navigator.clipboard.writeText, clicked #wsShare -> location.hash = '#ws=eyJ2IjoxLCJ0eXBl…'. Navigated to show('progress'): heading '📊 My Progress' but location.hash unchanged. Pressed reload: the page came up on '🖨️ Worksheet Maker' with that nav button active.
```

**Observed vs expected:** Observed: after copying a share link, reloading from any screen silently lands on the Worksheet Maker instead of where you were. Expected: clear the hash on leaving the worksheet screen (index.html:3455 sets it with history.replaceState and nothing ever removes it).

## no-favicon

**COSMETIC** — reachable  
**Where:** factor-field/index.html:3 (<head> has title and description but no <link rel="icon">)

**What:** The page declares no icon, so Chrome requests /favicon.ico (404 on GitHub Pages) and the tab shows the blank generic globe.

**Steps:**

```
Loaded index.html cold and logged every request: exactly one request to http://127.0.0.1:PORT/favicon.ico, answered 404 by the server. document.querySelectorAll('link[rel*="icon"]').length === 0.
```

**Observed vs expected:** Observed: blank default tab icon and a 404 in the network log. Expected: an inline data: URI favicon (the file already inlines a whole woff2 font, so a data: icon costs nothing and keeps the tool single-file and offline).

## practise-and-practice-in-the-same-panel

**COSMETIC** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/factor-field/index.html:2814

**What:** The My Progress report mixes British "practise" and American "practice" in adjacent lines of the same Stretches card.

**Steps:**

```
Harness at 1280x900. fresh load, show('progress'), clicked #loadSample (the front-door "Try it with a sample student"), waited 600ms, dumped #app innerText. Cross-checked with grep -n on index.html.
```

**Observed vs expected:** Observed, all visible at once in the Stretches card: "Tap one to practise that table — or do them all together below." (line 2814), the buttons "▶ practice the 6s / 7s / 8s / 9s" (line 2789), then "🎯 Practise all of these — Speed Run" and "🎯 Practise all — Mystery Factor" (lines 2817-2818). The toast on tapping one says "🎯 Practising your 7s!" (line 2858). Elsewhere the tool is consistently American: "Practicing: 2, 3, 4..." and "⚙️ Change practice settings" on Home. 3 British spellings against 19 American ones. Expected: one spelling throughout.

## home-lead-sentence-missing-a-word

**COSMETIC** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/factor-field/index.html:1139

**What:** The first sentence on the landing screen is missing a word: "Practice your times tables lots of fun ways" (should be "in lots of fun ways"), and it is a comma splice.

**Steps:**

```
Harness, fresh cold load at 1280x900 and again at 768x1024, read document.getElementById('app').innerText — first paragraph under the h1. Confirmed at index.html:1139.
```

**Observed vs expected:** Observed: "Practice your times tables lots of fun ways, watch a hand work a problem step by step — then print your own worksheet to do offline." Expected: "Practice your times tables in lots of fun ways, watch a hand..." — this is the first line of prose a stranger or a hiring manager reads.

## title-label-touches-its-box

**COSMETIC** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/factor-field/index.html:3391

**What:** In Worksheet Maker on an iPad in portrait (and on a phone) the "Title" label sits flush against the text box with zero gap, reading as "TitleMultiplication Facts".

**Steps:**

```
Harness at 768x1024, 390x844 and 1280x900. fresh load, show('worksheet'), waited 400ms. Measured the <label> whose text is exactly "Title" and #wsTitle: same-row check (|labelTop - inputTop| < 8) and gap = input.left - label.right. Screenshot: /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/lens4/ipad-worksheet.png
```

**Observed vs expected:** Observed: at 768x1024 and 390x844 the label and input are on the same row with gap = 0px (they touch). At 1280x900 they stack (label above the box) and it looks correct. Every other field on that row ("Worksheet type", "How many?", "Columns") has its label above the control at all widths, so the Title row is also inconsistent with its neighbours. Expected: a gap, or the same stacked treatment as the other three fields.

## last-worksheet-section-silently-refuses-to-untick

**COSMETIC** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/factor-field/index.html:3391

**What:** In the "Mixed sections" worksheet, unticking the last remaining section is silently refused — the box snaps back with no toast, no message and no explanation.

**Steps:**

```
Harness at 1280x900. show('worksheet'), page.select('#wsType','sections'), waited 500ms. Unticked section checkboxes one at a time (re-querying the DOM each time because the panel re-renders), down to one remaining. Clicked that last one ("Word problems"), waited 500ms, then read #toast textContent/className/opacity and searched #app innerText for /at least|need|one section/i.
```

**Observed vs expected:** Observed: ticked count stays 1, #toast is {txt:"", cls:"toast", opacity:"0"}, and no message appears anywhere on screen. Repeating the click 10 more times changes nothing. The guard itself is correct (it prevents an empty sheet) but the user gets no feedback at all. Expected: a short line such as "Keep at least one section".

## takeoff-says-stars-added-when-none-were

**COSMETIC** — reachable

**What:** The Times Table Takeoff game-over card always says "⭐ added to your jar", including when the score is 0 and no star was added.

**Steps:**

```
scratchpad/blast1.js, real browser over http.
1. Fresh page, localStorage cleared. Star jar reads 0.
2. Click "Times Table Takeoff" (show('blast')), then click "Start ▶".
3. Do not fire. Let the correct answer fall past the ship three times (~2.5 minutes of real play) until all three lives are gone.
4. Read the game-over overlay and the star jar in the header.
```

**Observed vs expected:** Observed: overlay reads "Great zapping! 🌟 · Your score 0 · Best: 0 · ⭐ added to your jar", while the header jar is still 0 and mq_stars was never written (null). Expected: no star claim when no star was added (Speed Run gets this right — it always awards at least 1 and names the number it awarded). The rest of the screen is honest: the 3 missed answers are recorded as 3 wrong, and My Progress correctly says "Answered so far: 3 of 8".

## print-report-twice-leaves-grownups-open

**COSMETIC** — reachable  
**Where:** factor-field/index.html:2847 (setTimeout(() => { g.open = wasOpen; }, 1200))

**What:** Pressing "🖨️ Print this report" twice within 1.2 seconds leaves the "👀 For grown-ups" section expanded on screen afterwards, even though the teacher never opened it. Same 1200ms restore race as the already-known stuck tab title.

**Steps:**

```
Answer 10 questions (so the report unlocks) → My Progress, with "👀 For grown-ups" collapsed → click "🖨️ Print this report" → click it again 200ms later → wait 2 seconds.
```

**Observed vs expected:** Observed: #grownups.open === true two seconds later (the second print captured wasOpen=true because the first had already forced it open, and its restore timer runs last). The tab title was also still "Factor Field progress - no initials 2026-08-08" — that part is the already-known print-twice-leaves-tab-title-stuck; the left-open summary is the separate observable. Expected: the report returns to exactly the state the teacher left it in.

## grownups-reopen-eaten-after-print

**COSMETIC** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/factor-field/index.html:2847

**What:** Printing the progress report arms a 1.2 s timer that restores the "For grown-ups" section to whatever state it was in before the print; if the teacher opens that section inside that window, their click is silently undone and it collapses again.

**Steps:**

```
Executed in headless Chrome over http://127.0.0.1, with window.print stubbed exactly as the project's own tests/run-tests.js stubs it.
1. Fresh load; record 10 correct attempts and 20 stars; show('progress'). #grownups starts closed (open === false).
2. Click "🖨️ Print this report". The handler force-opens #grownups, prints, and schedules setTimeout(() => { g.open = wasOpen; }, 1200) with wasOpen === false.
3. Within that 1.2 s, click the "👀 For grown-ups" summary to read it on screen. Immediately after the click, open === true.
4. Wait 1.5 s.
```

**Observed vs expected:** Observed: open === false — the section shuts itself, discarding the teacher's click. Repeated in two separate runs (once by setting .open programmatically, once by a real click on `#grownups > summary`). Expected: once the teacher opens the summary it stays open; the deferred restore should not overwrite a state the user has changed since the print. Narrow window, so low severity: it only bites if the teacher opens the section within ~1.2 s of the print dialog being dismissed. Distinct from the already-known print-twice case — here a single print plus one click is enough, and the symptom is the opposite (it closes rather than staying open).

