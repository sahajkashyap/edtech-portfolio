# Word by Word — deferred findings

From the six-round verification of 8 August 2026 (343 agents, 78 confirmed findings).
The run did NOT converge: it hit its round ceiling still finding things.

The 29 findings a teacher would hit HAVE BEEN FIXED (see git log for 8 Aug 2026). These 49 are deferred —
mostly things needing deliberately corrupted storage, plus minor and cosmetic items.
Each carries the exact steps that reproduced it, so none of this has to be re-found.

| # | Severity | Reachable | What |
|---|---|---|---|
| 1 | MINOR | yes | Typing in the "read as" box marks the word as a substitution but does not redraw the menu that is still open over it: "Wrong word" stays unhighlighted |
| 2 | MINOR | yes | The address bar keeps whichever lesson the page was opened on. Choosing a different lesson from the dropdown, or opening a saved record from another l |
| 3 | BUG | contrived | exportCsv never clamps a stored stoppedAt, so an out-of-range stop mark turns a real reading into "0 words read, 0 errors, 100%, Independent" in the s |
| 4 | BUG | contrived | A record whose body is damaged but still valid JSON (words:null, body [], body {}, or a lesson number that no longer exists) is refused clearly by Ope |
| 5 | BUG | contrived | A single null element inside one record's words array makes the Export button do nothing at all — no file, no alert, no on-page message, an uncaught T |
| 6 | BUG | contrived | A record body of the literal string "null" parses successfully, so openRecord skips both its guards and throws an uncaught TypeError in recordFits — O |
| 7 | BUG | contrived | A null entry anywhere in the index makes paintRecords throw on every call, so the saved-records list is silently truncated at that point on every page |
| 8 | BUG | contrived | readIndex's `JSON.parse(...) // []` returns any truthy non-array unchanged, so an index holding an object or a number makes the list render blank, mak |
| 9 | BUG | contrived | `insertions` is restored with `// 0` and never through Number(), so a count stored as text makes stats() concatenate instead of add: a 95% Independent |
| 10 | MINOR | contrived | openRecord floors a negative stored `elapsed` at 0, but exportCsv does not, so the spreadsheet prints a negative reading time |
| 11 | COSMETIC | yes | The first lesson card on all-lessons.html carries a self-contradictory generated sentence ("0 legal pseudowords exist here. 0 spellings were examined  |
| 12 | MINOR | contrived | After a word is clicked with the mouse, the mark menu is not focused and is 13 Tab presses away — the tab path runs through Finish, the notes boxes an |
| 13 | MINOR | contrived | There is no beforeprint handler. The print-only blocks are repainted by the 400ms debounced save, so pressing Cmd+P (or File > Print, or Save as PDF)  |
| 14 | MINOR | yes | A first-time visitor who presses Finish to see what it does can then mark an entire reading with the clock permanently stopped at 0:00 and no words-co |
| 15 | BUG | contrived | openRecord() clamps stoppedAt but not cursor. A record whose stored cursor is out of range opens silently, shows no caret, and then every marking key  |
| 16 | BUG | contrived | A stored mark code the tool does not recognise is opened without a word of complaint and scored as if the word were read correctly — the error vanishe |
| 17 | MINOR | contrived | A negative added-words count in storage produces an accuracy over 100% and a negative error total, printed and exported without comment. |
| 18 | BUG | contrived | A single null entry inside a record's saved words array makes Open throw at recordFits(), so the button does nothing and says nothing. |
| 19 | MINOR | yes | A reading that has started but produced no mark and no typing is never written to storage at all — the 5-second heartbeat cannot fire because there is |
| 20 | COSMETIC | yes | When the teacher leaves the retell blank, #prretell is emptied but keeps display:block plus its .prnotes border-top, so the printed record carries a b |
| 21 | MINOR | yes | The "Press Undo" safety message after "Clear all marks" is on screen for 402ms instead of the 6 seconds the code asks for — the debounced save fires 4 |
| 22 | MINOR | yes | The child's initials are upper-cased on the printed record and in the Saved records list but written raw into the spreadsheet, so one child typed two  |
| 23 | COSMETIC | yes | The exported spreadsheet is named for the day the export was clicked, not the day(s) the records were taken, contradicting the file's own contents and |
| 24 | BUG | contrived | An unreadable saved-records index throws during page initialisation, which aborts the rest of the start-up script: render() never runs and the #R reco |
| 25 | MINOR | contrived | worked-example.html's "Load the example" button blames the browser ("private window, or storage is full") when the real problem is a damaged records i |
| 26 | MINOR | yes | On a brand-new record a stop mark (or a changed date) is not treated as content, so it is silently discarded on reload with no record created and no m |
| 27 | MINOR | yes | On the public worked-example page — the first link on the tool and the one page built to show what the tool produces — the LEVEL tile reads "Instructi |
| 28 | MINOR | contrived | The signature cache added to paintRecords stops the list rebuilding when nothing visible changed (the heartbeat case the suite guards), but any save t |
| 29 | BUG | contrived | When the browser refuses to store a record, the tool tells the teacher "Print or export before you close this tab" — but Export only ever reads storag |
| 30 | MINOR | yes | Opening a #R<id> record link on a laptop that never had that record shows a blank Lesson 6 at 100%, and the only explanation — 710px below the fold —  |
| 31 | MINOR | yes | "Print this record" clicked on a cold arrival prints a running record for a child called "—" showing 100% accuracy, 18 words read, 0 errors and 0:00 — |
| 32 | MINOR | yes | All nine word lists tell the teacher "reasons in rejected_pseudowords (examiner data)" — a snake_case JSON field in formb/data/*.json that is not link |
| 33 | COSMETIC | yes | The cold-start lesson's teacher note says "0 spellings were examined and each is ruled out" — a sentence asserting that each of zero things was ruled  |
| 34 | COSMETIC | yes | Lesson 7's teacher note reads "1 spellings were examined" — the generated sentence never handles the singular. |
| 35 | MINOR | yes | The Finish button turns into Reopen in place, so a second press on the same pixel un-finishes the reading: the clock starts again and the saved record |
| 36 | COSMETIC | yes | The design page linked from the tool's own footer states the passage length as "thirty-one to sixty-one words" in the same sentence where it states th |
| 37 | BUG | contrived | A damaged saved-records index is swallowed in silence: the panel says "No saved records yet", Export says there is nothing to export, and the next key |
| 38 | MINOR | contrived | A stop mark stored as a negative index is clamped to word 0 instead of being treated as absent, so a record with four errors opens and prints as 100%, |
| 39 | MINOR | contrived | The added-words count and its positions are trusted straight out of storage: a negative count subtracts genuine errors, and positions past the end of  |
| 40 | MINOR | contrived | A retell level stored as a value the tool does not recognise vanishes from the screen but prints on the child's record as the literal word "undefined" |
| 41 | MINOR | yes | The M / S / V buttons in the mark menu are explained only in `title=` tooltips, which never appear on a tablet — and the on-screen block that spells t |
| 42 | MINOR | yes | The child's-copy sheet — the one artifact whose whole purpose is large type for a beginning reader — is generated without a <meta name="viewport">, so |
| 43 | MINOR | yes | Reloading during a read (an iPad waking a discarded tab, a stray refresh) wipes the marks, the name and the clock from the screen and shows a fresh 10 |
| 44 | MINOR | yes | Backspacing away the very first mark — the one that started the clock — removes the mark but leaves the clock running, so the silence before the child |
| 45 | MINOR | yes | Opening the worked example plants an invented child (M.R., Lesson 20) permanently in the teacher's Saved records and in every exported class spreadshe |
| 46 | MINOR | yes | Teacher notes and retell notes are written into the CSV unquoted when they begin with =, +, - or @, so an ordinary note like "- slowed on the last two |
| 47 | MINOR | contrived | A record body that is damaged into any non-record JSON is refused with the wrong explanation — it blames a lesson edit and prints the literal word "un |
| 48 | MINOR | yes | Below about 540px the saved-record rows stop fitting: Open and Delete sit past the right edge of the screen and the whole page starts scrolling sidewa |
| 49 | MINOR | contrived | Three internal working documents sit in the published folder next to the tool and are live, Jekyll-rendered, search-engine-titled pages — including a  |

---

## 1. read-as-does-not-redraw-the-open-menu

**MINOR** — reachable in normal use  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/running-record-tool/index.html:1943

**What:** Typing in the "read as" box marks the word as a substitution but does not redraw the menu that is still open over it: "Wrong word" stays unhighlighted and the M/S/V cue row never appears, so the cue cannot be coded without closing and reopening the menu.

**Steps:**

```
Chrome via puppeteer, http://127.0.0.1:PORT/index.html#L20, localStorage cleared.
1. Click .w[data-i="3"] — the mark menu opens on an unmarked word, so #msvrow is hidden (correct at that moment).
2. Type `sat` into #saidbox. Wait 300ms.
Observed 3/3 runs, with the menu still open: {word3: 'sub', menuOpen: 'block', wrongWordHighlighted: false, cueRowVisible: false}. A real puppeteer click on `#pop button[data-cue="v"]` fails with "Node is either not clickable" because the row has zero size.
3. Press Escape and click .w[data-i="3"] again: {wrongWordHighlighted: true, cueRowVisible: true}.
```

**Observed vs expected:** Observed: the word underneath now carries a Wrong word mark and counts as an error, while the panel on top of it shows no mark selected and offers no M/S/V buttons; the teacher has to close and reopen the same menu to code the cue. Expected: the same redraw mark() already performs — index.html:1539, `if (popFor === i) openPop(i);`, added for exactly this reason ("a teacher who clicked a word and then reached for the keyboard was left with a popover showing no mark selected while the word underneath it carried one — the panel contradicting the passage"). The #saidbox input handler at index.html:1943 ends `render(); save();` with no openPop(popFor).

## 2. hash-lesson-stale-after-picker

**MINOR** — reachable in normal use  
**Where:** running-record-tool/index.html:2749

**What:** The address bar keeps whichever lesson the page was opened on. Choosing a different lesson from the dropdown, or opening a saved record from another lesson, leaves location.hash on the old lesson, so a reload silently drops the teacher back onto the old lesson with a blank record — and a copied URL sends a colleague to the wrong lesson.

**Steps:**

```
Open index.html#L20. Select "26" in #lessonpick, blur. Read location.hash and currentLesson. Then page.reload() and read them again. Repeated for three routes in: dropdown, a #L26 hash link, and openRecord() of a record saved on lesson 26.
```

**Observed vs expected:** OBSERVED — dropdown: before reload {hash:'#L20', lesson:26, picker:26}; after reload {hash:'#L20', lesson:20}, heading "Lesson 20 · -s /s/ — A Cat N…". openRecord route: before reload {hash:'#L20', lesson:26, picker:26}; after reload {hash:'#L20', lesson:20}. The hash-link route is correct (#L26 -> 26 -> 26 after reload). EXPECTED — the URL names the lesson on screen, the way it does when you arrive by a #L link from all-lessons.html, so a reload (which iPad Safari performs on its own when it discards a backgrounded tab) lands back where the teacher was. No marks are lost — the debounced save has already written the record to Saved records — but the teacher returns to a blank Lesson 20 with the clock reset. The picker, heading and passage never disagreed with each other; only the URL does.

## 3. export-stopmark-not-clamped

**BUG** — needs contrived input

**What:** exportCsv never clamps a stored stoppedAt, so an out-of-range stop mark turns a real reading into "0 words read, 0 errors, 100%, Independent" in the spreadsheet — the exact defect openRecord was fixed for and is guarded against by an existing test, left unfixed on the export surface

**Steps:**

```
Served the folder over 127.0.0.1 and drove headless Chrome. 1) index.html#L20, typed initials AA, blurred, pressed x x x. Screen showed: Errors 3, 55 words read, 95%, Independent. 2) In the page: const l=JSON.parse(localStorage.getItem(INDEX_KEY)); const d=JSON.parse(localStorage.getItem(recKey(l[0].id))); d.stoppedAt=-2; localStorage.setItem(recKey(l[0].id), JSON.stringify(d)); 3) Reloaded the page so nothing is open (recordId===null, so no flushSave repairs it). 4) Clicked #exportbtn and decoded the data: URI.
```

**Observed vs expected:** The saved-records row on screen still reads "AA Lesson 20 2026-08-07 95%", but the exported row reads: read 0, errors 0, Accuracy 100, Level Independent, Every mark empty, and no alert or on-page message of any kind. Expected: the same clamp openRecord applies at index.html:2279-2281 (Math.max(0, Math.min(words.length-1, Number(...)))), or a refusal counted into the existing `unreadable` warning — never a fabricated perfect score. exportCsv computes `last` raw at index.html:2620.

## 4. export-scores-a-record-open-refuses

**BUG** — needs contrived input

**What:** A record whose body is damaged but still valid JSON (words:null, body [], body {}, or a lesson number that no longer exists) is refused clearly by Open but exported as a full row scoring 0 words read / 100% / Independent, with no alert and no unreadable count

**Steps:**

```
1) index.html#L20, initials AA, pressed x x x, flushSave. newRecord(). initials BB, pressed o, flushSave. Two children in the list. 2) Set AA's body words to null: const id=index.find(e=>e.initials==='AA').id; const d=JSON.parse(localStorage.getItem(recKey(id))); d.words=null; localStorage.setItem(recKey(id), JSON.stringify(d)). 3) Reloaded. 4) Called openRecord(id) -> returned false with the message "That record was saved before Lesson 20 was edited, so its marks no longer line up...". 5) Reloaded again and clicked #exportbtn. Also repeated with the body replaced by '[]' and by '{}' and with d.lesson=999.
```

**Observed vs expected:** The spreadsheet contains two rows: "BB: read 55, err 1, 98%, Independent" and a second row "read 0, err 0, 100%, Independent" for the record Open had just refused. window.__alerts was empty and #savedmsg was empty — the `unreadable` counter at index.html:2612 only increments when JSON.parse throws, so a body that parses to something unusable is scored instead of reported. Expected: the same refusal Open gives, counted into the existing "N listed records are MISSING from this spreadsheet" warning. (Control: a genuinely truncated body does hit that path correctly and produces the alert, so the good path exists and is simply not reached here.)

## 5. export-dies-silently-on-null-word

**BUG** — needs contrived input

**What:** A single null element inside one record's words array makes the Export button do nothing at all — no file, no alert, no on-page message, an uncaught TypeError — and every other child's record is lost from the spreadsheet with it

**Steps:**

```
1) index.html#L20, initials AA, pressed x, flushSave. newRecord(). initials BB, pressed o, flushSave. 2) const id=index.find(e=>e.initials==='AA').id; const d=JSON.parse(localStorage.getItem(recKey(id))); d.words[3]=null; localStorage.setItem(recKey(id), JSON.stringify(d)). 3) Reloaded the page. 4) Clicked the real #exportbtn button.
```

**Observed vs expected:** window.__downloads.length === 0 (no file), window.__alerts empty, #savedmsg empty, and pageerror "Cannot read properties of null (reading 'text')" at index.html:2626:27 inside the w.forEach. Both rows are still listed on screen, so the teacher sees a working list and a button that silently does nothing. Expected: the record is skipped and counted as unreadable, and the healthy child is still exported — exactly what the comment at index.html:2607-2611 says this code is for. openRecord(id) on the same record also throws "Cannot read properties of null (reading 'text')" from recordFits at index.html:2222, so both surfaces fail silently on the same damage.

## 6. openrecord-throws-on-null-body

**BUG** — needs contrived input

**What:** A record body of the literal string "null" parses successfully, so openRecord skips both its guards and throws an uncaught TypeError in recordFits — Open does nothing, says nothing, and the existing missing/unreadable messages never fire

**Steps:**

```
1) index.html#L20, initials AA, pressed x, flushSave. 2) localStorage.setItem(recKey(id), 'null'). 3) Reloaded. 4) Cleared #savedmsg, called openRecord(id) inside a try/catch.
```

**Observed vs expected:** openRecord threw "Cannot read properties of null (reading 'lesson')" (recordFits reads d.lesson at index.html:2220) and #savedmsg stayed empty. Expected one of the two messages the code already has for damaged storage — index.html:2231 handles a missing raw string and index.html:2237-2242 handles a parse failure, but valid JSON that is not an object falls between them. (Non-object bodies that are strings or numbers are handled correctly; only null throws.)

## 7. index-null-entry-truncates-list

**BUG** — needs contrived input

**What:** A null entry anywhere in the index makes paintRecords throw on every call, so the saved-records list is silently truncated at that point on every page load and the "Saved on this laptop" confirmation never appears again — while records keep being written invisibly

**Steps:**

```
1) index.html#L20, initials AA, pressed x, flushSave. newRecord(). initials BB, pressed o, flushSave. 2) const l=JSON.parse(localStorage.getItem(INDEX_KEY)); l.splice(1,0,null); localStorage.setItem(INDEX_KEY, JSON.stringify(l)). 3) Reloaded the page and read the #records panel. 4) Blurred, pressed x, waited 800ms, read #savedmsg and the index.
```

**Observed vs expected:** On plain page load only 1 of the 2 real rows rendered (the loop threw at the null before reaching AA), with pageerror "Cannot read properties of null (reading 'id')" at index.html:2371:35. After marking a word: localStorage holds 4 index entries but only 2 rows are visible, and #savedmsg is empty — writeRecord calls paintRecords() at index.html:2150 before say('Saved on this laptop') at :2151, so the throw swallows the confirmation on every save from then on. Expected: the same `e && ...` null guard the signature line one function above already uses (index.html:2359), or a clear message. The tool never says anything is wrong.

## 8. index-not-an-array-false-quota-message

**BUG** — needs contrived input

**What:** readIndex's `JSON.parse(...) || []` returns any truthy non-array unchanged, so an index holding an object or a number makes the list render blank, makes Export claim there are no records, and makes every save report the wrong diagnosis — "this browser refused to store it (private window, or the disk is full)" — while the record body is in fact written to disk

**Steps:**

```
1) index.html#L20, initials AA, pressed x, flushSave. 2) localStorage.setItem(INDEX_KEY, '{"a":1}') (also reproduced with '7'). 3) Reloaded the page. 4) Blurred, pressed x, waited 700ms. 5) Clicked #exportbtn.
```

**Observed vs expected:** The #records panel innerHTML is the empty string — not even the "No saved records yet" copy — with pageerror "list.map is not a function". #savedmsg reads "THIS RECORD IS NOT BEING SAVED — this browser refused to store it (private window, or the disk is full). Print or export before you close this tab." yet 2 running-record-rec-* bodies are present in localStorage and the index key is untouched. Export alerts "There are no saved records to export yet." and downloads nothing. Expected: readIndex (index.html:2072-2075) returns [] for anything that is not an array, so the tool recovers; failing that, the message must not blame the disk when the setItem that failed was the index write and the body write succeeded. The state is permanent — every later save repeats the same false message.

## 9. insertions-as-text-string-concat

**BUG** — needs contrived input

**What:** `insertions` is restored with `|| 0` and never through Number(), so a count stored as text makes stats() concatenate instead of add: a 95% Independent reading reopens as 78% Frustration with "12" errors, and one keystroke writes that wrong figure permanently into the index, the row, the printed record and the spreadsheet

**Steps:**

```
1) index.html#L20, initials AA, blurred, pressed x i space i space, flushSave. Screen showed Errors 3, 95%, Independent (1 substitution + 2 added words over 55 words). 2) const d=JSON.parse(localStorage.getItem(recKey(id))); d.insertions=String(d.insertions); localStorage.setItem(recKey(id), JSON.stringify(d)). 3) Reloaded, called openRecord(id). 4) Typed one character into #notes and called flushSave(). 5) Clicked #exportbtn.
```

**Observed vs expected:** After reopening: #ct-err shows "12", accuracy 78%, band Frustration, and #savedmsg is empty — no warning at all. stats() does `errors += ins` at index.html:1593 where ins is the string "2" (the guard `insertAt.length === insertions` at :1590 is 2 === "2", false, so the raw string is used), giving 1 + "2" = "12". After the one keystroke the index entry reads {"accuracy":78,"errors":"12","read":55}, the saved-records row reads 78%, and the spreadsheet row reads "read 55, err 12, 78%, Frustration". Expected: the same defensive Number() the same function applies to `elapsed` at index.html:2287, or a clear refusal. Instead a child recorded as Independent silently becomes Frustration everywhere at once.

## 10. export-negative-time

**MINOR** — needs contrived input

**What:** openRecord floors a negative stored `elapsed` at 0, but exportCsv does not, so the spreadsheet prints a negative reading time

**Steps:**

```
1) index.html#L20, initials AA, pressed x, flushSave. 2) d.elapsed=-60000 written back to recKey(id). 3) Reloaded. 4) Clicked #exportbtn and read the Time column.
```

**Observed vs expected:** Time column reads "-1:00"; Words correct per min is blank. Expected the same `if (!isFinite(elapsed) || elapsed < 0) elapsed = 0` guard openRecord uses at index.html:2288 — exportCsv only does `d.elapsed || 0` at :2643/:2672, which passes a negative straight through to fmt().

## 11. all-lessons-zero-pseudoword-sentence

**COSMETIC** — reachable in normal use

**What:** The first lesson card on all-lessons.html carries a self-contradictory generated sentence ("0 legal pseudowords exist here. 0 spellings were examined and each is ruled out"), the second has a plural-agreement error ("1 spellings were examined"), and both point the reader at "rejected_pseudowords (examiner data)", which is a filename nothing on the site explains or links to.

**Steps:**

```
Local http server + real Chrome, 1280x900. goto /all-lessons.html, collect the innerText of every leaf element matching /pseudoword/i.
```

**Observed vs expected:** Observed: 9 such notes. Lesson 6 (the first card on the page, above the fold on a portrait iPad): "No nonsense-word subtest: 0 legal pseudowords exist here. 0 spellings were examined and each is ruled out; reasons in rejected_pseudowords (examiner data)." Lesson 7: "…1 spellings were examined and each is ruled out…". The other 7 read correctly ("2 legal pseudowords exist here and each is ruled out… 5 spellings were examined in all"), so the zero and one cases are falling through the wrong branch of the sentence template. Expected: a sentence that makes sense when the count is 0 or 1, and either a link for "rejected_pseudowords" or plain words instead of a filename.

## 12. popover-not-in-tab-order-after-a-click

**MINOR** — needs contrived input

**What:** After a word is clicked with the mouse, the mark menu is not focused and is 13 Tab presses away — the tab path runs through Finish, the notes boxes and both destructive buttons ("Clear all marks", "Start a new record") before it reaches the menu's first button.

**Steps:**

```
Local http server + real Chrome, 1280x900. goto /index.html#L20, localStorage.clear(), reload. page.click('.w[data-i="4"]') to open the menu. Read document.activeElement, then press Tab up to 40 times, recording activeElement and whether #pop contains it. Separately: the documented keyboard route (Space then Enter) for comparison.
```

**Observed vs expected:** Observed: on opening, document.activeElement is BODY — focus is not moved into the menu. #pop is the last block in the document, after </main>, so sequential focus continues from the clicked word onward through the page. It takes 13 Tabs to reach the menu: #finishbtn, #retell, Nothing, Some of it, Most of it, All of it in order, #notes, Print the child's copy, Print this record, Export all records, Clear all marks, Start a new record, then finally "Wrong word" inside the menu. The menu stays open the whole time (display still 'block'), so a keyboard user hunting for the "What they said" box passes through "Clear all marks" and "Start a new record" with the menu still up. The documented route is fine — pressing Enter puts focus straight in #saidbox. Expected: opening the menu moves focus into it, or the menu is next in the tab order.

## 13. cmd-p-prints-notes-typed-in-the-last-400ms

**MINOR** — needs contrived input

**What:** There is no beforeprint handler. The print-only blocks are repainted by the 400ms debounced save, so pressing Cmd+P (or File > Print, or Save as PDF) within about half a second of the last keystroke in the Notes box prints "Teacher notes —" instead of the note.

**Steps:**

```
Local http server + real Chrome, 1280x900. goto /index.html#L20, localStorage.clear(), reload, type "KP" in #initials and blur, mark 5 words with Space/x, type "Slowed on the last line." into #notes, wait W ms, then dispatch window 'beforeprint' (the event Chrome fires on Cmd+P) and read #prnotes/#prwho. W = 0, 100, 250, 350, 450, 700. Compared against clicking #printbtn, which calls paintPrint() itself.
```

**Observed vs expected:** Observed: at W = 0, 100, 250, 350 and 450ms the paper reads "Teacher notes —". At W = 700ms it reads "Teacher notes Slowed on the last line." The child's initials repaint immediately and are never lost. Clicking "Print this record" is always correct. Checked and cleared the wider version of this: creating child AA, starting a new record for BB, then Open-ing AA and dispatching beforeprint without touching anything prints AA's name, numbers, marks and notes correctly. So the exposure is only the sub-500ms window after the last Notes keystroke. Expected: a beforeprint listener that repaints, so the browser's own print command produces the same sheet as the button.

## 14. finish-before-the-read-leaves-a-timeless-record

**MINOR** — reachable in normal use

**What:** A first-time visitor who presses Finish to see what it does can then mark an entire reading with the clock permanently stopped at 0:00 and no words-correct-per-minute, with no warning on any surface.

**Steps:**

```
Local http server + real Chrome, 768x1024 with touch. goto /index.html#L20, localStorage.clear(), reload. Tap #finishbtn before anything else. Then tap a word and tap "Wrong word" in the menu, and read the clock, the rate and the button label.
```

**Observed vs expected:** Observed after the stray Finish: clock "0:00", #wcpm "finished", Pause disabled, button relabelled "Reopen", no alert and #savedmsg empty. Marking then still works — errors go to 1 — while the clock stays 0:00 and the rate stays "finished" forever. On a portrait iPad the clock, the rate and the Reopen label are all below the fold, so nothing above the fold says the timing is dead. The record saves with 0:00 and a "–" reading rate. Expected: marking a word on a finished reading either restarts the clock or says plainly that the clock is stopped.

## 15. cursor-never-clamped-on-open

**BUG** — needs contrived input

**What:** openRecord() clamps stoppedAt but not cursor. A record whose stored cursor is out of range opens silently, shows no caret, and then every marking key does nothing at all — for ever, with no message.

**Steps:**

```
Make a normal record on #L20 (initials AB, Space, x), flushSave(), note its id.
Edit storage the way an evicted/half-written record would look: read `running-record-rec-<id>`, set d.cursor = 9999, write it back.
Reload, real click on that row's Open button.
  savedmsg is "" (no message of any kind), the record opens, marks and errors are correct.
  document.querySelector('#passage .w.cursor') is null — nothing on the passage is highlighted.
Now click the passage and press, in order: x o t s r a Space Space x o t (11 real keypresses).
  words with a code: 1 (unchanged). Errors tile: 1 (unchanged). cursor: still 9999.
No page errors, no console errors, no savedmsg. Ran twice; identical.
Cause: mark() guards `i < 0 || i >= words.length` and returns silently (index.html:1516), and advance() only increments while `cursor < words.length - 1`, so 9999 can never come back down.
```

**Observed vs expected:** Observed: the teacher opens a child's record and the keyboard is dead — x, o, t, s, r, a and Space all do nothing and say nothing, and the only escape is to click a word with the mouse (which they have no reason to know). Expected: cursor is clamped into the passage exactly as stoppedAt is on the very next lines (index.html:2277-2281 does `Math.max(0, Math.min(words.length - 1, Number(d.stoppedAt)))` with a comment explaining why an out-of-range index must never be trusted), or the record is refused with a message.

## 16. unknown-mark-code-silently-scores-as-correct

**BUG** — needs contrived input

**What:** A stored mark code the tool does not recognise is opened without a word of complaint and scored as if the word were read correctly — the error vanishes and accuracy rises.

**Steps:**

```
Make a normal record on #L20 (initials AB, Space, x). On screen: Accuracy 98%, Errors 1.
flushSave(), then change one character in storage: d.words[1].code = 'subb' (was 'sub'), write it back.
Reload, real click on Open.
  savedmsg: "Saved on this laptop" — no warning at all.
  Accuracy 98% -> 100%. Errors 1 -> 0. "Wrong word" row 0. The word carries class "w m-subb" so it gets no colour, and its tag span is empty.
  Export all records -> CSV row: AB,20,-s /s/,A Cat Naps in Mud,...,55,0,100,Independent,,,,0:00,0,0,0,0,0,0,0,"and (undefined)",...
Ran twice; identical.
Cause: IS_ERROR['subb'], TAG['subb'] and MARKNAME['subb'] are all undefined, and nothing anywhere validates w.code against CODES.
```

**Observed vs expected:** Observed: a damaged mark is silently downgraded to "read correctly" — the child's score goes UP, the band can move, and the spreadsheet prints the literal word "undefined" as the mark's name. Expected: the tool refuses the record and says so, the way it already refuses a record whose words no longer line up. Silently doing the arithmetic with a code it cannot name is the one thing it must not do.

## 17. accuracy-not-capped-at-100

**MINOR** — needs contrived input

**What:** A negative added-words count in storage produces an accuracy over 100% and a negative error total, printed and exported without comment.

**Steps:**

```
Make a normal record on #L20 (initials AB, Space, x). flushSave().
In storage set d.insertions = -3 and d.insertAt = [], write back. Reload, real click Open.
  Accuracy tile: 104%. Band: Independent. Errors: -2. Added words: -3. Error rate: 1:1. savedmsg: "".
  CSV row: AB,20,...,55,-2,104,Independent,1:1,...,-3,...
Ran twice; identical.
Cause: stats() at index.html:1594 is `Math.max(0, ((read - errors) / read) * 100)` — floored at 0 (there is a comment explaining that floor) but never capped at 100, and insertions is restored with `d.insertions || 0`, which lets a negative through.
```

**Observed vs expected:** Observed: 104% accuracy and -2 errors on a child's record, on screen and in the spreadsheet. Expected: either the value is clamped to 0-100 with the same care the 0 floor already got, or a negative added-words count is refused as impossible.

## 18. openrecord-throws-on-a-null-word-inside-the-array

**BUG** — needs contrived input

**What:** A single null entry inside a record's saved words array makes Open throw at recordFits(), so the button does nothing and says nothing.

**Steps:**

```
Make a normal record on #L20 (initials AB, Space, x). flushSave().
In storage set d.words[2] = null (the rest of the record intact), write it back.
Reload, real click on the row's Open button.
  Uncaught TypeError: "Cannot read properties of null (reading 'text')" at index.html:2222:36 — that is recordFits()'s `d.words.every((w, i) => w.text === want[i])`.
  savedmsg: "". recordId: null. The row is still listed. Nothing on screen changes.
Ran twice; identical.
Note for the triage: this is a DIFFERENT line from the two already known ones — 'openrecord-throws-on-null-body' is `raw === "null"` (JSON.parse returns null, dies on d.lesson) and 'export-dies-silently-on-null-word' is the same shape inside exportCsv at 2626. This one is recordFits at 2222, on the Open path, with a body that parses to a perfectly good object.
```

**Observed vs expected:** Observed: clicking Open does nothing at all, with no message, which is the exact failure the code above openRecord() says was fixed ("a row in Saved records whose body had been evicted did NOTHING when clicked — no message, no change on screen"). Expected: recordFits() guards the element (`w && w.text === want[i]`) so the record is refused with the message the tool already has for a body it cannot use.

## 19. reading-time-never-saved-until-something-else-is

**MINOR** — reachable in normal use

**What:** A reading that has started but produced no mark and no typing is never written to storage at all — the 5-second heartbeat cannot fire because there is no record for it to update.

**Steps:**

```
Load /index.html#L20. Do NOT type initials. Click the passage and press Space (the child begins; the clock starts).
Wait 7 seconds — the clock tile reads 0:06 and totalMs() is 7007.
  recordId is null. localStorage.getItem(INDEX_KEY) is null. No record body exists.
Reload the page (= the tab was closed, or the iPad reclaimed it).
  Saved records: "No saved records yet." The whole reading is gone.
Contrast, same run: type "ZZ" into Initials first, then Space, then wait 6.5s — recordId exists and storage already holds elapsed 4957ms, and reopening restores it as paused at 0:04. So the heartbeat works, but only for a record that some other action already brought into being.
Cause: advance(true) -> autoStart() (index.html:1444) starts the clock but never calls save(), and the heartbeat at index.html:2158 is guarded by `&& recordId`.
Ran twice; identical.
```

**Observed vs expected:** Observed: minutes of a running clock are held only in memory until the first mark, keypress in a text field, Pause or Finish. Expected: the same protection the heartbeat's own comment promises — "Close the tab mid-read and the record kept a time from whenever the last mark happened" was the bug it was written to fix; starting the clock should be enough to bring the record into being, since hasContent() already counts totalMs() > 0.

## 20. empty-retell-prints-an-orphan-rule

**COSMETIC** — reachable in normal use  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/running-record-tool/index.html:1825

**What:** When the teacher leaves the retell blank, #prretell is emptied but keeps display:block plus its .prnotes border-top, so the printed record carries a bare horizontal rule with ~20px of dead space between "Every mark" and "Teacher notes".

**Steps:**

```
1. Chrome 816x1056, GET /index.html#L20, localStorage.clear(), reload.
2. click #passage, press Space, press 'x', wait 500ms. Leave the retell box and the retell buttons untouched (the common case).
3. click #printbtn (window.print stubbed), then page.emulateMediaType('print').
4. Measure #prretell: {innerHTML:"", display:"block", height:9, borderTopWidth:"1px", borderTopColor:"rgb(153,153,153)", marginTop:"12px", paddingTop:"8px"} -> an empty ruled band is laid out on the sheet.
5. Visible in scratchpad/fm-print-wordlist.png as an unexplained line with nothing under it, directly above TEACHER NOTES (which by contrast prints its heading and an em dash when empty).
Source: paintPrint sets `pr.innerHTML = ''` at index.html:1825 but never hides the element; .prnotes at index.html:315 supplies the rule.
```

**Observed vs expected:** Observed: a stray horizontal rule and empty band on the printed record whenever no retell was entered. Expected: the block is hidden (display:none) when it has no content, the way .printonly blocks are elsewhere.

## 21. clear-marks-undo-hint-erased-in-400ms

**MINOR** — reachable in normal use

**What:** The "Press Undo" safety message after "Clear all marks" is on screen for 402ms instead of the 6 seconds the code asks for — the debounced save fires 400ms later and replaces it with "Saved on this laptop".

**Steps:**

```
Served the folder over 127.0.0.1 and drove real Chrome (puppeteer-core, headless:'new'). 1) Open index.html#L20. 2) Click the initials box, type "JM", blur. 3) Press X, X, O. 4) flushSave() so the record exists in storage (the ordinary state after ~1s of marking). 5) Clear #savedmsg, attach a MutationObserver to it, then click #clearmarksbtn (window.confirm stubbed to true, as the teacher pressing OK). Observed mutations: +1ms "Marks cleared. Press Undo (or Backspace) if that was not what you meant." / +402ms "Saved on this laptop" / +1601ms "". Identical timings on a second path: create a record, newRecord(), openRecord(it), then click Clear all marks -> +1ms hint, +404ms "Saved on this laptop", +1600ms blank. The confirm dialog that precedes it reads "Clear every mark and restart the clock?\n\nThe child, the date and your notes are kept." and never mentions Undo.
```

**Observed vs expected:** Observed: the recovery instruction is visible for ~0.4s and is then overwritten by "Saved on this laptop", which itself clears after 1.6s, leaving nothing. Expected: index.html calls say('Marks cleared. Press Undo (or Backspace) if that was not what you meant.', 6000) — a 6-second instruction. Cause: the same handler calls save(), whose 400ms debounce runs writeRecord() with quiet undefined, so it calls say('Saved on this laptop', 1600) on top. The 5-second heartbeat is deliberately quiet for exactly this reason; the ordinary debounced save is not. Consequence: on the tool's most destructive button, the only place the teacher is told the clear is reversible disappears before they have read it, and is replaced by a message that reads as reassurance. Note the existing regression check 'Clear all marks ...and says how to get them back' reads savedmsg synchronously, so it passes against this

## 22. initials-uppercased-everywhere-but-the-spreadsheet

**MINOR** — reachable in normal use

**What:** The child's initials are upper-cased on the printed record and in the Saved records list but written raw into the spreadsheet, so one child typed two ways looks like one child in the tool and two children in the export.

**Steps:**

```
Served the folder over http://127.0.0.1 with node's http module and drove real Chrome (puppeteer-core, headless:new). (1) Open /index.html#L20. (2) Click the Child box and TYPE `jm` (real key events), blur. (3) Press `x` to mark word 1. (4) Wait 700ms for the save debounce. (5) Click "Print this record" and read #prwho. (6) Read the .who2 span in the Saved records row. (7) Click "Export all records" and read the Child cell of row 1. Result: box `jm`, printed header `JM`, saved-records row `JM`, spreadsheet `jm`. Then the sharper case (t11.js): in one session type `jm`, press `x`, flushSave, Start a new record; type `JM`, press `o`, flushSave; Export. Result: on-screen .who2 spans = ["JM","JM"] (indistinguishable), stored index = ["JM","jm"], spreadsheet Child column = ["JM","jm"].
```

**Observed vs expected:** Observed: index.html:1745 `(...value || '—').toUpperCase()` for the printed header and index.html:2373 `esc((e.initials||'—').toUpperCase())` for the saved-records row, while exportCsv (index.html:2668) writes `e.initials` untouched. Expected: the child's name is the same string on all four surfaces — the export should carry the same normalised value the tool displays, or the tool should stop normalising. Consequence: two sittings for the same child render as two identical `JM` rows on screen and on paper, but a learning specialist who sorts or pivots the spreadsheet by Child gets two separate children.

## 23. csv-filename-dated-today-not-the-records-inside

**COSMETIC** — reachable in normal use

**What:** The exported spreadsheet is named for the day the export was clicked, not the day(s) the records were taken, contradicting the file's own contents and the code comment that says the two match.

**Steps:**

```
Same http + real-Chrome harness (t10.js, case 2). (1) Open /index.html#L20. (2) Type `AB` in the Child box, blur, press `x`. (3) Set the Date box to `2026-08-03` and fire its input event (the same thing the date picker does), flushSave. (4) Click "Export all records" and capture the anchor's download attribute and the file body. Result: download name `running-records-2026-08-08.csv`; the only Date cell in the file is `2026-08-03`; the saved-records row also reads `2026-08-03`.
```

**Observed vs expected:** Observed: index.html:2693 `a.download = 'running-records-' + todayLocal() + '.csv'` with the inline comment "same local day the records are stamped with" — which only holds when every exported record happens to be dated today. Expected: either the filename reflects the dates actually in the file (or is date-neutral), or the comment and the existing same-day-only test stop claiming they agree. Consequence is small — a folder of weekly exports is named by export day rather than assessment day. This may well be the intended convention; I report it only because the code asserts otherwise and the suite's date test passes only because it pins both dates to the same instant.

## 24. corrupt-index-aborts-page-init

**BUG** — needs contrived input  
**Where:** running-record-tool/index.html:2836

**What:** An unreadable saved-records index throws during page initialisation, which aborts the rest of the start-up script: render() never runs and the #R record deep-link handler is never installed, so a link straight to a record lands on a blank cold-start Lesson 6 with no message and empty print blocks.

**Steps:**

```
Executed in headless Chrome over http://127.0.0.1 (scratchpad/savedata/pg.js and final.js). 1) Load index.html, pick Lesson 15, type initials KD, press Space then X, flushSave() — one healthy record, id rmsk3eqcbxa0e. 2) In the console set localStorage['running-record-index'] = '{}'  (repeated with JSON.stringify([null, <the real entry>]) — same outcome). 3) Navigate to index.html#R<that id> (cache-busting query so the document really reloads).
```

**Observed vs expected:** Observed: an uncaught page error at load — "list.map is not a function" (or, for the null-entry variant, "Cannot read properties of null (reading 'id')" at index.html:2371) — thrown by paintRecords() on line 2836, which is followed by render() on 2837 and the #R block on 2846-2854. Neither runs. currentLesson is 6 (cold start), recordId is null, the Child box is empty, the Saved records panel innerHTML is the empty string (not even the "No saved records yet" reassurance), #savedmsg is empty, and #prwho / #prnums / #prmarks are all EMPTY — so a browser-level print at that moment produces a sheet with no child, no lesson and no numbers. Changing the hash to #R<id> afterwards also does nothing (lesson 20 after #L20, recordId still null), proving the hashchange listener was never attached either. Control with a healthy index on the identical URL: lesson 15, recordId set, initials KD, 98%, pr

## 25. worked-example-blames-the-browser-for-a-damaged-index

**MINOR** — needs contrived input  
**Where:** running-record-tool/worked-example.html:142

**What:** worked-example.html's "Load the example" button blames the browser ("private window, or storage is full") when the real problem is a damaged records index; it also leaves the example record body in storage with no index entry and never navigates.

**Steps:**

```
Executed in headless Chrome (scratchpad/savedata/we.js). 1) Open index.html, localStorage.clear(). 2) Set localStorage['running-record-index'] = '{}'  (also tested '[null]'). 3) Open worked-example.html and click the "Load the example" button (#load). Control run with the index set to '[]'.
```

**Observed vs expected:** Observed: alert reads "This browser would not let the page save the example (private window, or storage is full). The tool itself will have the same trouble." — but localStorage is working perfectly: the line before the failure had already written 'running-record-rec-example-maya' successfully (bodyWritten: true). What actually threw is list.filter on line 142 because the stored index is an object, not an array. The page stays on /worked-example.html instead of going to /index.html#Rexample-maya, and the example body is left orphaned in storage with no index entry. Control (healthy index): no alert, landed on /index.html#Rexample-maya. Expected: say the records index is damaged, not that the browser refused to store anything.

## 26. stop-mark-alone-is-never-saved

**MINOR** — reachable in normal use  
**Where:** running-record-tool/index.html:2082

**What:** On a brand-new record a stop mark (or a changed date) is not treated as content, so it is silently discarded on reload with no record created and no message.

**Steps:**

```
Executed in headless Chrome (scratchpad/savedata/pi.js). 1) Fresh index.html with localStorage cleared, pick Lesson 15. 2) Blur the text fields, set the cursor to word 5, press E to place the stop mark. 3) Call flushSave() (the same write any keystroke's debounce would do). Repeated with only the date box changed to 2026-05-01.
```

**Observed vs expected:** Observed: the ‖ stop mark is visible on the passage and stoppedAt === 5, but recordId is null, the saved-records index has 0 entries, no row appears, and #savedmsg is empty — nothing is written and nothing is said. A reload loses the stop mark entirely. Same for the date-only case (date 2026-05-01, 0 entries, no message). hasContent() at index.html:2082 counts marks, insertions, elapsed time, initials, notes and retell, but not stoppedAt and not the date. Expected: either a stop mark counts as content, or the teacher is told the record has not been saved yet. Reachable only in an unusual order — setting where the child should stop before typing initials or making any mark; once initials or a mark exist the record is created and the stop mark saves fine (verified in 24 randomised action-sequence round trips).

## 27. worked-example-level-tile-clips-instructional

**MINOR** — reachable in normal use  
**Where:** running-record-tool/worked-example.html:29

**What:** On the public worked-example page — the first link on the tool and the one page built to show what the tool produces — the LEVEL tile reads "Instructior": the word Instructional runs out of its card and is painted over by the next tile.

**Steps:**

```
Local http server + headless Chrome (scratchpad/t10-clip.js, t11-nums.js, t12-sweep.js).
1. Load http://127.0.0.1:PORT/worked-example.html at 1280x900, deviceScaleFactor 3.
2. Screenshot the .nums element: scratchpad/nums-1280.png (and nums-768.png, identical because .wrap is capped at 720px).
3. Measure: for the second .num tile, take a Range over its <b> and compare the text width with the block's client width.
4. Sweep the viewport 320px..1600px in 10px steps and count the widths where the text is wider than its box.
5. Confirm the same CSS and markup are live: curl https://sahajkashyap.github.io/edtech-portfolio/running-record-tool/worked-example.html — returns `.num b{display:block;font-size:1.45rem;...}` and `<b>Instructional</b>` byte for byte.
```

**Observed vs expected:** Observed: the tile's <b> text measures 145px inside a 107-109px box (over by 36-46px); .num has overflow:visible so the tail spills sideways and the next tile ("1:14 / ERROR RATE", which paints later and has background:var(--paper)) covers it. In the screenshot the reader sees "Instructior". The width sweep flags 126 of the 129 widths tested from 320px to 1600px, including 1280, 1024, 834, 768 and 390 — i.e. every device anyone would use. The neighbouring tiles (93%, 1:14, 1:5, 37, 1:22) all fit exactly. Expected: the reading level, the single most important word on the page, is legible. The same word on index.html's #band chip measures 102px in a 132px box and is fine, so this is worked-example.html's tile CSS alone (worked-example.html:29 sets font-size:1.45rem on a 108px minmax grid track at worked-example.html:27; the markup is worked-example.html:78).

## 28. press-straddling-a-needed-records-list-rebuild-is-swallowed

**MINOR** — needs contrived input  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/running-record-tool/index.html:2362

**What:** The signature cache added to paintRecords stops the list rebuilding when nothing visible changed (the heartbeat case the suite guards), but any save that DOES change a visible column — and every mark changes accuracy — still throws away and rebuilds every row and button. A press on Open or Delete whose mousedown and mouseup straddle that rebuild produces no click event at all: the button goes down, comes up, and nothing happens, with no message.

**Steps:**

```
Server + headless Chrome, script /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/p11.js.
1. index.html#L20. Create saved records AA and BB, then start a third record CC with one mark (flushSave).
2. Scroll AA's row into view, mouse.move onto AA's Delete button, mouse.down.
3. While held, press X on the keyboard (marks another word in CC — CC's accuracy changes, so the list signature changes).
4. Wait 700ms so the 400ms debounce fires writeRecord -> paintRecords -> host.innerHTML = '' and every row/button is rebuilt.
5. mouse.up on the same point.
Observed: the captured click-event log is EMPTY — no click event fired anywhere. The index is unchanged ['CC','BB','AA'].
Note this is a different path from the suite's existing check at run-tests.js:2047 ('a save landing mid-press does not swallow the press'), which uses the heartbeat, where the signature is unchanged and no rebuild happens.
```

**Observed vs expected:** Observed: zero click events; the press is silently discarded. Expected: a press that goes down and comes up on the same Delete button performs that button's action, or at least tells the teacher it did not.

## 29. export-cannot-rescue-a-refused-save

**BUG** — needs contrived input  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/running-record-tool/index.html:2587

**What:** When the browser refuses to store a record, the tool tells the teacher "Print or export before you close this tab" — but Export only ever reads storage, so it either denies the record exists or hands over the stale version with no warning.

**Steps:**

```
Executed in headless Chrome over http://127.0.0.1:<port>/index.html (node http server serving the tool folder), script /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/t10.js.

CASE 1 — storage already full when the assessment starts:
1. Load index.html, localStorage.clear(), reload.
2. Fill the origin's localStorage the way another page on the same origin would, until it is genuinely full: setItem in 64KB chunks until QuotaExceededError, then 4KB, then 256B, then 16B, then 2B chunks (113 chunks written; a 1-byte probe write then throws).
3. Click #initials, type "AA". Click #passage, set cursor 0.
4. Press x, Space, o, Space, t (real keypresses).
5. Wait 700ms for the debounce.
6. Read #savedmsg, #ct-err, #sAcc.
7. Call exportCsv() with window.alert and HTMLAnchorElement.prototype.click stubbed to capture the alert text and any data: download.
8. Click #printbtn with window.print stubbed.

CASE 2 — the record is already stored and the disk fills mid-assessment:
1. Fresh page, type initials "BB", press x, wait 600ms, flushSave(). One error is now in storage.
2. Fill localStorage to full exactly as above (104 chunks).
3. Click #passage and 
```

**Observed vs expected:** CASE 1 — Screen: 3 errors, 83%. #savedmsg: "THIS RECORD IS NOT BEING SAVED — this browser refused to store it (private window, or the disk is full). Print or export before you close this tab." Pressing Export alerts "There are no saved records to export yet." and downloads 0 files. (Print does work: window.print fired once and paintPrint reads live state.) Expected: the rescue the tool just named either produces a spreadsheet containing the record on screen, or says plainly that Export cannot help and only Print can. CASE 2 — Screen: 4 errors, 78%. Saved-records row: "BB Lesson 6 2026-08-08 94%". Export produces a file with NO alert of any kind, and its single data row is `BB,6,p /p/,Word list,2026-08-08,18,1,94,...,map (Wrong word)` — 1 error and 94%, i.e. the pre-quota version. The spreadsheet that reaches the learning specialist silently disagrees with the screen and with the printed 

## 30. shared-record-link-blames-your-browser

**MINOR** — reachable in normal use  
**Where:** running-record-tool/index.html:2231 (openRecord's !raw branch) and :2848 (#R hash route)

**What:** Opening a #R<id> record link on a laptop that never had that record shows a blank Lesson 6 at 100%, and the only explanation — 710px below the fold — wrongly says the record "is listed" and that "the browser may have cleared storage".

**Steps:**

```
Local http server. Chrome at 1280x900. Load /index.html#L20, type "mr" into Child, click the passage, press X, wait 900ms so the auto-save runs, then set location.hash = '#R' + JSON.parse(localStorage.getItem(INDEX_KEY))[0].id — which is exactly the URL the address bar shows once a record is open (worked-example.html advertises this deep-link form and uses it for Maya). Copy that URL. Open a brand-new browser context (empty localStorage, i.e. a colleague's laptop) and navigate to the same URL. Also typed by hand: /index.html#R999999 and /index.html#Rabc give the same; /index.html#R alone gives no message at all. Script: scratchpad/fx-share.js, scratchpad/fx-hash.js.
```

**Observed vs expected:** OBSERVED: the second laptop shows Lesson 6 (currentLesson 6), Child empty, accuracy "100%" — a blank tool — and #savedmsg reads "That record is listed but its contents are no longer on this laptop. The browser may have cleared storage. Nothing else has been changed." measured at rect.top = 1610 with innerHeight 900 and scrollY 0, so it is never seen. Both clauses are false on this machine: the id is not in that browser's index, and its browser never stored anything to clear. EXPECTED: openRecord() should distinguish "this id is not in the index at all" (a link from another computer) from "the index lists it but the body is gone", and say so where the reader can see it — e.g. "this link only opens on the laptop where the record was made".

## 31. blank-record-prints-as-a-perfect-score

**MINOR** — reachable in normal use  
**Where:** running-record-tool/index.html:466 (printbtn) vs the exportbtn guard

**What:** "Print this record" clicked on a cold arrival prints a running record for a child called "—" showing 100% accuracy, 18 words read, 0 errors and 0:00 — while "Export all records" in the same button row refuses the equivalent request.

**Steps:**

```
Local http server. Chrome at 1000x1400 with window.print stubbed to count calls. Load /index.html, localStorage.clear(), reload (a genuine cold arrival). Touch nothing. Click #printbtn. Then page.emulateMediaType('print') and read #prwho, #prnums and the full print-media body text and screenshot. Separately, from the same cold state, click #exportbtn. Scripts: scratchpad/fx-print.js, scratchpad/fx-click.js, screenshot scratchpad/fx-coldprint.png.
```

**Observed vs expected:** OBSERVED: window.__printed goes 0 -> 1; #prwho = "—Lesson 6 · p /p/Word list · 2026-08-08"; #prnums = "100% Accuracy / not banded (word list) Level / 18 Words read / 0 Errors / – Error rate / – Self-correction rate / – Words correct/min / 0:00 Time", followed by the word list, "EVERY MARK — No miscues recorded." and "TEACHER NOTES —". The sheet is indistinguishable from a completed assessment with a perfect score. By contrast #exportbtn from the identical state produces 0 downloads and alerts "There are no saved records to export yet." EXPECTED: the two hand-over paths should agree — either print refuses the same way, or a record with no child named and nothing marked prints as a blank form with the score cells empty rather than 100% / 18 words read.

## 32. rejected-pseudowords-dead-reference

**MINOR** — reachable in normal use  
**Where:** running-record-tool/index.html:lessonnote text for lessons 6-14; all-lessons.html:74 et al

**What:** All nine word lists tell the teacher "reasons in rejected_pseudowords (examiner data)" — a snake_case JSON field in formb/data/*.json that is not linked, served or explained anywhere a reader can reach, and the same sentence is republished on the public all-lessons page.

**Steps:**

```
Local http server. Chrome at 1280x900. Load /index.html cold and read #lessonnote (Lesson 6 is the cold-start lesson, so this needs no interaction at all). Then walk /index.html#L6 through #L41 reading #lessonnote on each. Then load /all-lessons.html and read the .note paragraphs. Script: scratchpad/fx-text.js.
```

**Observed vs expected:** OBSERVED: on the cold-start screen, #lessonnote reads "For the teacher — No nonsense-word subtest: 0 legal pseudowords exist here. 0 spellings were examined and each is ruled out; reasons in rejected_pseudowords (examiner data). ..." measured at rect.top 877 in a 900px window, so it is on screen on arrival. The phrase appears on all nine word-list lessons (6-14) in the tool and again in the .note of all nine word-list articles on all-lessons.html. `grep -rl rejected_pseudowords` finds it only in formb/data/lesson-0NN.json and two python scripts — nothing the reader of either page can open. EXPECTED: teacher-facing prose should not cite an internal snake_case field name, or should link to something the reader can actually open.

## 33. zero-spellings-examined-sentence

**COSMETIC** — reachable in normal use  
**Where:** running-record-tool/index.html (LESSONS[6].note)

**What:** The cold-start lesson's teacher note says "0 spellings were examined and each is ruled out" — a sentence asserting that each of zero things was ruled out.

**Steps:**

```
Local http server. Chrome at 1280x900. Load /index.html cold (localStorage cleared, reload). Read document.getElementById('lessonnote').innerText. No clicks needed — Lesson 6 is where the tool opens. Script: scratchpad/fx-text.js. Same string appears in all-lessons.html article #L6.
```

**Observed vs expected:** OBSERVED: "No nonsense-word subtest: 0 legal pseudowords exist here. 0 spellings were examined and each is ruled out; reasons in rejected_pseudowords (examiner data)." EXPECTED: when the count is zero the clause should be dropped ("no spellings needed examining"), not rendered as "0 ... and each is ruled out". This is the very first prose a stranger reads on the tool.

## 34. one-spellings-plural

**COSMETIC** — reachable in normal use  
**Where:** running-record-tool/index.html (LESSONS[7].note); all-lessons.html:84

**What:** Lesson 7's teacher note reads "1 spellings were examined" — the generated sentence never handles the singular.

**Steps:**

```
Local http server. Chrome at 1280x900. Load /index.html#L7. Read document.getElementById('lessonnote').innerText. Script: scratchpad/fx-text.js (which walked all 36 lessons; Lesson 7 is the only one where the count is 1). Same string appears in all-lessons.html article #L7.
```

**Observed vs expected:** OBSERVED: "No nonsense-word subtest: 0 legal pseudowords exist here. 1 spellings were examined and each is ruled out; ..." EXPECTED: "1 spelling was examined". Reachable by picking the second entry in the lesson dropdown.

## 35. finish-pressed-twice-restarts-the-clock

**MINOR** — reachable in normal use  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/running-record-tool/index.html:2025

**What:** The Finish button turns into Reopen in place, so a second press on the same pixel un-finishes the reading: the clock starts again and the saved record's reading time keeps growing, dropping the words-per-minute of an assessment the teacher believed was closed.

**Steps:**

```
Executed in headless Chrome over http://127.0.0.1:<port>/index.html#L20. Steps actually run:
1. Press X (word 0 marked, clock starts).
2. Wait 900ms.
3. Scroll #finishbtn into view, record its centre point, and click it with the real mouse at that point.
4. Click the same pixel a second time.
5. Wait a further 6 seconds and read totalMs(), the tile, and the elapsed value stored in localStorage under recKey(recordId).
```

**Observed vs expected:** Observed: after click 1 — clockState 'done', button label "Reopen", tile "finished", elapsed 1008ms. After click 2 at the same pixel — clockState 'running', label back to "Finish", tile "reading…", and the clock is counting again (index.html:2025-2035 routes the second click to the Reopen branch). Six seconds later elapsed is 7013ms, the tile reads "464 words correct per minute so far", and the 5-second heartbeat has written elapsed 4991 into the stored record — i.e. the saved reading time of a finished assessment is still growing. Expected: a second press on Finish should not silently reopen a closed reading and restart its clock; Reopen is a different intent and should not land on the pixel the teacher just pressed. Note the screen does report the new state honestly (label, tile), so this is visible if the teacher looks — hence MINOR, not BUG.

## 36. design-page-passage-length-contradicts-the-passages

**COSMETIC** — reachable in normal use  
**Where:** running-record-tool/DESIGN.md:80

**What:** The design page linked from the tool's own footer states the passage length as "thirty-one to sixty-one words" in the same sentence where it states the word-list length exactly right; the tool's passages are 53–79 words, and 19 of the 27 are longer than 61.

**Steps:**

```
Served the folder over node http on 127.0.0.1 and drove headless Chrome with puppeteer-core.
1. Open http://127.0.0.1:PORT/index.html.
2. In the page footer, read the link "What it decides" (href="DESIGN.html").
3. In the same page, evaluate the tool's own data: for every n in LESSONS with kind 'passage', count tokenList(n).filter(t => /[a-z]/i.test(t)).length, and the same for the word lists. Result: word lists 17–22 items; passages 53–79 words; 19 of 27 passages are longer than 61 words.
4. Follow the footer link to DESIGN.html and read the section "Two places the tool refuses to compute". It reads: "A word list is seventeen to twenty-two items against a passage of thirty-one to sixty-one words, and nearly half the items are sight words."
5. Cross-checked the same numbers on the catalogue page all-lessons.html: its per-lesson "N words" metas sum to 1799 across the 27 passages and each one matches the tool exactly (script probe3.js, 0 mismatches on all 36 lessons); the smallest is 53 and the largest 79.
Scripts: /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/xsurf/probe11.js and probe3.js.
```

**Observed vs expected:** Observed: DESIGN.md:80, served as DESIGN.html and linked from index.html:363, says a passage is 31–61 words. The tool serves passages of 53–79 words; not one is under 53 and 19 of 27 are over 61. The first half of the very same sentence ("seventeen to twenty-two items") matches the tool's word lists exactly, which is what invites the second half to be read as describing this tool's passages too. Expected: either the range the tool's own passages have (53–79), or the "Form A" qualifier that the equivalent comment in the code carries (index.html:1667 reads "a Form A passage of 31-61 words") — the tool serves only Form B, so an unqualified 31–61 describes nothing a reader of that page can open.

## 37. damaged-index-silently-reports-no-records

**BUG** — needs contrived input

**What:** A damaged saved-records index is swallowed in silence: the panel says "No saved records yet", Export says there is nothing to export, and the next keystroke rewrites the index so every intact record body becomes unreachable forever.

**Steps:**

```
Served the folder over http on 127.0.0.1 and drove real Chrome (puppeteer-core). 1) Saved three real records — A.A on Lesson 20, B.B on Lesson 22, C.C on Lesson 24, each with a substitution, an omission and 1:00 on the clock. Saved records listed all three (C.C 97%, B.B 97%, A.A 96%) and localStorage held 3 keys beginning running-record-rec-. 2) Simulated the partial write a real browser leaves after a disk-full or a crash: localStorage.setItem('running-record-index', idx.slice(0, Math.floor(idx.length*0.7))) — the record bodies were left completely untouched. 3) Reloaded index.html. 4) Clicked Export the spreadsheet. 5) Typed "D.D" into the Child (initials) box, the ordinary first gesture of the next assessment, and flushed the save.
```

**Observed vs expected:** Observed after the reload: the Saved records panel reads "No saved records yet. One is kept for every child you assess — nothing overwrites anything.", the message line is empty, no console or page error — while all 3 record bodies are still sitting in localStorage. Export alerts "There are no saved records to export yet." and downloads nothing. After the single keystroke on the next child the index is rewritten to exactly one entry (D.D, Lesson 6) and localStorage now holds 4 bodies of which 3 can never again be listed, opened, exported, printed or deleted by any screen in the tool. Expected: readIndex() can tell the two cases apart — getItem returns null when the index has never been written, and a non-null string that fails JSON.parse when it is damaged — so the damaged case should refuse in the same voice openRecord() and exportCsv() already use for a damaged record BODY ("the browse

## 38. negative-stop-mark-clamps-to-a-perfect-score

**MINOR** — needs contrived input

**What:** A stop mark stored as a negative index is clamped to word 0 instead of being treated as absent, so a record with four errors opens and prints as 100%, Independent, one word read.

**Steps:**

```
Saved a real Lesson 20 record (M.R, substitution on word 3 read as "sat", omission on 9, told on 24, self-correction on 36, one added word, 1:22 on the clock) — screen showed 93% / Instructional / 55 words read / 4 errors. Then set the stored body's stoppedAt to -5 (out-of-range index), reloaded, and clicked Open on that row; then called paintPrint() to read the printed record.
```

**Observed vs expected:** Open succeeds with no message at all. The screen now reads 100% Accuracy, Independent Level, 1 word read, 0 errors, 0 added words; the printed record says the same. The four miscue tags are still on the words above those numbers. Expected: openRecord() already Numbers and range-checks this field, and its own comment offers "keep it inside the passage or treat it as absent" — a negative stop mark is not a position inside the passage, so it should become null (or be refused with a message), not silently become "the child stopped after word one". (The spreadsheet's separate failure on the same input is already known as export-stopmark-not-clamped; this is the screen and the paper.)

## 39. insert-count-from-storage-never-sanity-checked

**MINOR** — needs contrived input

**What:** The added-words count and its positions are trusted straight out of storage: a negative count subtracts genuine errors, and positions past the end of the passage discard the additions, both raising the record's accuracy and its band with no message.

**Steps:**

```
Same saved Lesson 20 record as above (baseline 93% / Instructional / 4 errors / 1 added word). Case A: set the stored body's insertions to -3 and insertAt to null, reloaded, clicked Open. Case B: set insertAt to [9999,9999] with insertions 2, reloaded, clicked Open. Read the tally panel, the level tile and the exported CSV row in each case.
```

**Observed vs expected:** Case A: the Added words row shows "-3", Errors falls from 4 to 0, the tile reads 100% Independent, self-correction rate reads "1:1", and the exported row says 0 errors / 100 / Independent — while three miscue tags are still visible on the passage. Case B: Added words shows 0, Errors falls from 5 to 3, the band moves from Instructional (91%) to Independent (95%), on screen, on the printed record and in the spreadsheet. Expected: a count of added words below zero is impossible and a position beyond words.length-1 points at nothing, so both should be refused or ignored the way a damaged record body already is — not folded into the error total. (Distinct from the known insertions-as-text-string-concat: this is arithmetic that runs to completion and produces a better score than the marks support.)

## 40. unknown-retell-prints-the-word-undefined

**MINOR** — needs contrived input

**What:** A retell level stored as a value the tool does not recognise vanishes from the screen but prints on the child's record as the literal word "undefined".

**Steps:**

```
Same saved Lesson 20 record. Set the stored body's retell field to "lots", reloaded, clicked Open, then called paintPrint() and read #prretell.
```

**Observed vs expected:** On screen no retell button is lit, so the record looks as though no retell level was ever chosen. The printed record's Retell block reads "Retell undefined a cat got in the pot". The CSV leaves the Retell column blank. Expected: three surfaces should agree, and none of them should print the word "undefined" onto a record that goes to a learning specialist — an unrecognised level should either be refused on open or shown as blank everywhere.

## 41. msv-letters-never-spelled-out-on-a-touch-device

**MINOR** — reachable in normal use

**What:** The M / S / V buttons in the mark menu are explained only in `title=` tooltips, which never appear on a tablet — and the on-screen block that spells the letters out only appears after you have already tagged a cue.

**Steps:**

```
scratchpad/stranger-lens/t25.js. Launched Chrome with viewport 768x1024, deviceScaleFactor 2, isMobile:true, hasTouch:true (a portrait iPad). Loaded index.html#L20 cold, cleared localStorage, reloaded. Real touch tap (page.tap) on the first word, then touchscreen.tap on the "Wrong word" button in the menu. Dumped document.body.innerText and searched it for "Meaning", "Structure", "Visual". Then read the M button's title attribute, tapped it, and dumped the text again. Also confirmed independently (t24.js) at 768px that marking a word without tagging a cue never reveals the block.
```

**Observed vs expected:** Observed: before any cue is tagged the whole visible page contains no occurrence of "Meaning", "Structure" or "Visual". The only three visible mentions are the bare letters — "the M/S/V tally", "and tag M / S / V — what the child was using when they went wrong (optional)", and "M/S/V only if you want the analysis". The expansion lives solely in title="Meaning — the miscue makes sense in the story so far" (and the S and V equivalents), which a touch device never surfaces. Only after tapping M does the results block appear and the word "Meaning" enter the page. Expected: on the device the tool is built for, a first-time teacher can find out what M, S and V stand for without having to press one to see. Circular: you must use the control to learn what it is.

## 42. childs-copy-window-has-no-viewport-meta

**MINOR** — reachable in normal use

**What:** The child's-copy sheet — the one artifact whose whole purpose is large type for a beginning reader — is generated without a <meta name="viewport">, so on a tablet or phone it lays out at 980 CSS px and is shrunk to fit.

**Steps:**

```
scratchpad/stranger-lens/t19.js. Opened index.html#L41 in Chrome over http and called the page's own childCopyHtml() to get the exact markup the "Print the child's copy" button writes into the new window. Regex-checked it for a viewport meta (false). Then loaded that same markup with page.setContent into three pages: 768x1024 isMobile/hasTouch (iPad portrait), 390x844 isMobile/hasTouch (iPhone), and 1280x900 desktop, and measured window.innerWidth and the computed body font-size. Cross-checked against a genuinely opened popup (t18.js), which confirms the tool really does write a head with no viewport tag: `<!doctype html><html><head><meta charset="utf-8"><title>Ten Buds and a Pup — child's copy</title><style>…`.
```

**Observed vs expected:** Observed: on both emulated touch devices window.innerWidth is 980, not 768/390, so the browser lays the sheet out at 980 px and shrink-to-fits it. The 32px (24pt) body type meant for a beginning reader lands on screen at roughly 25px on an iPad and 13px on a phone; on desktop it is the intended 32px. The generated document also has no lang attribute. Expected: the same 'width=device-width, initial-scale=1' the tool's own three pages all carry, so the sheet is as large on the tablet as it is on paper. Honest limit: printing is unaffected — @page/print CSS ignores the viewport meta — so this only bites a teacher who turns the screen round instead of walking to a printer, which on an iPad is exactly what happens.

## 43. reload-mid-read-blanks-the-screen-with-no-word

**MINOR** — reachable in normal use

**What:** Reloading during a read (an iPad waking a discarded tab, a stray refresh) wipes the marks, the name and the clock from the screen and shows a fresh 100% / Independent, with no message that the reading was auto-saved and how to get it back.

**Steps:**

```
scratchpad/stranger-lens/final.js, section F5, real Chrome over http. Loaded index.html#L20 cold, cleared localStorage, reloaded. Typed "AB" into the Child field, clicked the passage, pressed X twice, waited 1200 ms (long enough for the debounced auto-save to run). Snapshotted state, then called page.reload({waitUntil:'load'}), waited 600 ms, and snapshotted again — marks, initials, clockState, #sAcc, #band, #savemsg, and the length of the stored index.
```

**Observed vs expected:** Observed: before reload {marks:2, initials:"AB", clock:"running"}; after reload {marks:0, initials:"", clock:"idle", accuracy:"100%", band:"Independent", savemsg:"(none)"} while localStorage still holds 1 record. The work is recoverable — scroll to the bottom and press Open on the saved row, which does restore the 2 marks and "AB" (verified in t15.js) — but nothing on screen says so, and what the teacher sees first is a blank record scoring a perfect 100%. Expected: either the in-progress record reopens itself, or a line says something like "Your last reading was saved — open it below."

## 44. undo-of-the-first-mark-leaves-the-clock-running

**MINOR** — reachable in normal use  
**Where:** running-record-tool/index.html:2037

**What:** Backspacing away the very first mark — the one that started the clock — removes the mark but leaves the clock running, so the silence before the child begins is counted into the reading time.

**Steps:**

```
Served over http, at index.html#L20, storage cleared:
1. Press X (a stray keypress while setting up, before the child has read anything). Clock starts.
2. Press Backspace immediately to take it back.
3. Wait 8 seconds — the teacher settles the child.
```

**Observed vs expected:** After step 2: marks 0, but clockState 'running'. After step 3: totalMs 8007, big clock 0:07, tile "413 words correct per minute so far", and a record has been written with 0 marks, 8 seconds of reading time and 100% in the Saved records row. Expected: the mark that STARTED the clock, undone, should put the clock back to idle at 0:00 — the tool states this principle itself in resumeClock()'s comment ("Undoing an accident should return the clock to where it was, never start one that was not running"). snapshot() for an ordinary mark deliberately carries no clock, which is right for the second and later marks but wrong for the first. Consequence: every later assessment number is computed over a reading time that includes the setup silence. NOTE ON OVERLAP: the known list has 'undone-mark-leaves-a-phantom-record'. That names the phantom record; this names the clock that is still running behi

## 45. worked-example-child-exports-as-a-real-child

**MINOR** — reachable in normal use

**What:** Opening the worked example plants an invented child (M.R., Lesson 20) permanently in the teacher's Saved records and in every exported class spreadsheet, with nothing marking it as an example.

**Steps:**

```
Served /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/running-record-tool over http on 127.0.0.1 with node's http module and drove real Chrome via puppeteer-core (scratchpad/t4-misc.js, case A). 1) localStorage.clear(). 2) Navigate to /worked-example.html. 3) Click the button "Open Maya's record in the tool" — the browser lands on index.html#Rexample-maya. 4) Read #records: "M.R. Lesson 20 2026-03-04 93% Open now Delete", and localStorage['running-record-index'] = [{id:'example-maya',lesson:20,initials:'M.R.',...}]. 5) Now do what a teacher does next: set location.hash='#L6', click "Start a new record", type initials JS, mark one word, flushSave(). 6) Click "Export all records" and decode the captured data: URI.
```

**Observed vs expected:** Observed: the CSV has two data rows — "JS,6,p /p/,Word list,2026-08-08,18,1,94,n/a (word list),..." and "M.R.,20,-s /s/,A Cat Naps in Mud,2026-03-04,55,4,93,Instructional,1:14,1:5,37,1:22,...". The invented child is a full, ordinary row: no marker, no note, nothing distinguishing it from a real assessment, and it stays in the Saved records list until the teacher notices and deletes it. Expected: an example record should either not enter the teacher's own record set, or should be labelled as an example on the row and in the spreadsheet. The worked-example page does disclose "It is written to your own browser, and you can clear it again", so the storage write is announced — the spreadsheet handed to a specialist is not.

## 46. csv-note-starting-with-a-dash-becomes-a-formula

**MINOR** — reachable in normal use

**What:** Teacher notes and retell notes are written into the CSV unquoted when they begin with =, +, - or @, so an ordinary note like "- slowed on the last two lines" is handed to Excel/Sheets as a formula instead of text.

**Steps:**

```
scratchpad/t6-csv.js, real Chrome over http. 1) Fresh page at index.html#L20, localStorage cleared. 2) Initials AB. 3) Teacher notes = "- slowed on the last two lines". 4) Retell notes = "=1+1 and @home and +2 mins". 5) mark(1,'sub') with said = "=SUM(A1:A9)". 6) flushSave(), then click "Export all records" and decode the data: URI that the anchor download produced.
```

**Observed vs expected:** Observed exported row (tail): ...,,,,,,=1+1 and @home and +2 mins,- slowed on the last two lines — both cells are emitted bare, with no quoting and no leading apostrophe or space. csvCell() (index.html:2576) quotes only when the value contains a quote, a comma or a newline, so a leading =, +, - or @ passes through untouched. Storage itself is perfect (stored notes are exactly "- slowed on the last two lines"), so this is purely what leaves the tool. Expected: a cell that starts with a formula character is neutralised (quoted plus a leading apostrophe, or prefixed) so the spreadsheet shows the teacher's words. Honest limit: I verified the exported bytes in the browser; I did not open the file in Excel, so the resulting #NAME? cell is the standard spreadsheet behaviour for =-leading cells rather than something I executed.

## 47. corrupt-record-refused-as-lesson-undefined-was-edited

**MINOR** — needs contrived input

**What:** A record body that is damaged into any non-record JSON is refused with the wrong explanation — it blames a lesson edit and prints the literal word "undefined" to the teacher.

**Steps:**

```
scratchpad/t4-misc.js, case B, real Chrome over http. For each body in ['{}','[]','"hello"','5','true','{"lesson":999,"words":[]}']: 1) localStorage.clear(). 2) localStorage['running-record-rec-x1'] = that body. 3) localStorage['running-record-index'] = [{id:'x1',lesson:20,initials:'PQ',date:'2026-08-08',accuracy:100,errors:0,read:55}]. 4) paintRecords() — the row appears normally. 5) Clear #savedmsg, then openRecord('x1') and read #savedmsg.
```

**Observed vs expected:** Observed: openRecord correctly returns false and changes nothing on screen (good), but the message is "That record was saved before Lesson undefined was edited, so its marks no longer line up with the words. It is still saved on this laptop and nothing has been changed." for every one of those bodies — and "That record was saved before Lesson 999 was edited" for a lesson that has never existed. Expected: the two failures are different and need different words — a record that no longer fits an edited lesson, versus a record whose contents are damaged and unreadable. The word "undefined" should never reach a teacher. Note this needs contrived input: the tool itself never writes such a body, only a browser mangling storage would.

## 48. records-row-buttons-off-screen-on-a-phone

**MINOR** — reachable in normal use  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/running-record-tool/index.html:2350

**What:** Below about 540px the saved-record rows stop fitting: Open and Delete sit past the right edge of the screen and the whole page starts scrolling sideways, so on a phone the record list looks like it has no buttons at all.

**Steps:**

```
Chrome via puppeteer, local http server. For each width in 1024, 900, 834, 820, 800, 768, 744, 700, 650, 600, 540, 430, 414, 390, 375, 360, 320: cold load, choose lesson 20, type "AB", click the first word, Escape, 5x Space, x, wait, click #clearbtn to save the record — then measure the record row's buttons. Fine down to 540 (Delete right edge 536 on a 540 screen). At 430 and below the Delete right edge is pinned at 536 while the screen is narrower: off-screen by 106px at 430, 122px at 414, 146px at 390, 216px at 320. At 390, #records has clientWidth 308 but scrollWidth 495, and document.documentElement.scrollWidth becomes 536 against innerWidth 390 — so the whole body gains a horizontal scrollbar. document.elementFromPoint at the right edge of that row returns nothing; window.scrollTo(9999,0) moves scrollX to 146 and the buttons then appear. Screenshot: rows-390-proof.png shows only "AB Lesson 20 2026-08-08 98%" with a sliver of Open clipped at the edge. Scripts: /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/lens-cold-2min/rows.js and rows2.js
```

**Observed vs expected:** Observed at 390px: the saved-record row renders 536px wide inside a 390px screen, Open is clipped and Delete is entirely off-screen, and the page body scrolls horizontally by 146px — the one place the layout does this; with no records saved the same page has docScrollWidth == innerWidth. Expected: the record rows wrap or shrink like every other block on the page, so the body never scrolls sideways and both buttons are visible without scrolling. Note: an iPad in portrait (768, and 744 for a Mini) is unaffected — this is phone-width only.

## 49. internal-notes-published-on-the-public-site

**MINOR** — needs contrived input  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/running-record-tool/DEFERRED-FINDINGS.md:1

**What:** Three internal working documents sit in the published folder next to the tool and are live, Jekyll-rendered, search-engine-titled pages — including a public list of the tool's own confirmed-but-unfixed defects and an unpublished LinkedIn draft with its scheduled post date.

**Steps:**

```
Loaded each URL in the same headless Chrome (not just curl): https://sahajkashyap.github.io/edtech-portfolio/running-record-tool/DEFERRED-FINDINGS.html -> 200, document.title "Word by Word — deferred findings | edtech-portfolio", body begins "Confirmed by two independent agents each, and deliberately NOT fixed on Aug 7, 2026..." and goes on to name defects with file and line numbers (export-trusts-bad-stop-mark, index.html:2397; insertions-as-text-inflates-errors, index.html:2135; damaged-index-silently-reads-as-no-records; two-tab-delete-resurrects-record). https://.../POST-DRAFT-2026-10-20.html -> 200, title "Draft 07 — Word by Word, the running record tool", body begins "Type: Main course (project post) Post: Tuesday 20 October 2026, week 43. Calendar slot 11. Status: rewritten 6 Aug 2026 after Sahaj said the first version was unrecognisable...". https://.../CHANGES-2026-08-05.html -> 200. The .md originals are served too (200 text/markdown). The tool's own footer link "Source" goes to the repo, where the same folder listing shows all of them. Script: /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/lens-cold-2min/live.js
```

**Observed vs expected:** Observed: DEFERRED-FINDINGS.html, POST-DRAFT-2026-10-20.html and CHANGES-2026-08-05.html all return 200 as fully rendered public pages on the portfolio site. Expected: working notes and unpublished post drafts either live outside the published folder or are excluded from the build (a _config.yml exclude, or a leading underscore); the repo has no _config.yml and no .nojekyll, so every .md in the folder is published by default. Nothing in the tool links to them, but the tool links to the repo one click away, and the URLs are directly guessable and indexable.

