# Word by Word — deferred findings

Confirmed by two independent agents each, and deliberately NOT fixed on Aug 7, 2026.
All of them need deliberately corrupted storage, or are cosmetic. Nothing here is
reachable by a teacher using the tool normally.

Next session: run these as a batch through fix-running-record.js.

## export-trusts-bad-stop-mark

- **Severity:** BUG — needs contrived input
- **Where:** running-record-tool/index.html:2397
- **What:** An out-of-range stop mark in storage makes the spreadsheet report 0 words read, 0 errors, 100% and Independent for the same record the screen shows as 0% Frustration.
- **Observed:** Observed: same record, screen says 0% Frustration, spreadsheet says 100% Independent. Expected: the two surfaces agree, or the row is refused.

## insertions-as-text-inflates-errors

- **Severity:** BUG — needs contrived input
- **Where:** running-record-tool/index.html:2135
- **What:** insertions stored as text makes stats() concatenate instead of add: 1 substitution + 3 added words is reported as 13 errors, 76%, Frustration on the screen, the printed record and the spreadsheet.
- **Observed:** Observed: 13 errors / 76% / Frustration for a record whose true value is 4 errors / 93% / Instructional, with no warning, on all three surfaces. Expected: the stored number coerced with Number() and rejected if it is not finite and >= 0.

## damaged-index-silently-reads-as-no-records

- **Severity:** BUG — needs contrived input
- **What:** If the saved-records index becomes unreadable, readIndex() swallows the error and returns an empty list with no message at all — every record body is still in storage but permanently invisible, and the next save overwrites the damaged index so recovery is gone.
- **Observed:** Observed at step 4: 0 rows, the panel reads "No saved records yet. One is kept for every child you assess — nothing overwrites anything", #savedmsg is empty — no warning of any kind — while 3 record bodies are still sitting in localStorage. At step 6 the index contains only ["DD"], 4 bodies exist, so 3 finished assessments are now unreachable from every surface, and Export produces 1 data row instead of 4. Expected: the tool refuses clearly, the way it already does for a damaged record BODY — openRecord says "That record is stored in a form this tool cannot read..." and "That record is listed 

## two-tab-delete-resurrects-record

- **Severity:** MINOR — needs contrived input
- **Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/running-record-tool/index.html:1996
- **What:** There is no storage-event listener, so a second tab holding the same record open will write it back after the first tab deletes it. Delete does not stick.
- **Observed:** Index length went 1 → 0 after the delete in tab A, then back to 1 after tab B's debounced write, with the same id and initials "TT". Expected: a deleted record stays deleted. Contrived: it needs the same record open in two tabs at once and an edit in the stale tab after the delete.

## export-nan-time

- **Severity:** MINOR — needs contrived input
- **Where:** running-record-tool/index.html:2449
- **What:** A non-numeric elapsed in storage puts "NaN:NaN" in the spreadsheet's Time column, although openRecord coerces the same value to 0:00 on screen.
- **Observed:** Observed: NaN:NaN in the exported spreadsheet. Expected: the same '0:00' / refusal the screen gives.

## insertions-negative-accuracy-over-100

- **Severity:** MINOR — needs contrived input
- **Where:** running-record-tool/index.html:1532
- **What:** A negative insertions count in storage produces -4 errors and 107% accuracy, banded Independent, on the screen and on the printed record.
- **Observed:** Observed: 107% accuracy and -4 errors printed on the record that goes to the learning specialist. Expected: a number that cannot be true is refused, the way '-944 wcpm' and '1:0' already are.

## null-index-entry-false-storage-warning

- **Severity:** MINOR — needs contrived input
- **Where:** running-record-tool/index.html:1997
- **What:** One damaged entry in the record index makes every later save claim 'THIS RECORD IS NOT BEING SAVED — private window, or the disk is full' while the record is in fact being written to storage perfectly.
- **Observed:** Observed: a permanent, unrecoverable and factually wrong 'not being saved / disk is full' banner (or a blank records panel) while saving is actually working. Expected: skip or repair the damaged entry and say what is actually wrong.

## no-flush-before-the-page-leaves

- **Severity:** MINOR — needs contrived input
- **What:** There is no beforeunload/pagehide flush, so anything done in the last 400ms before the tab is closed or a link is followed is thrown away silently — the debounce timer dies with the page.
- **Observed:** Observed: at W = 0, 100, 250, 300 and 380ms the stored record still has only "sub" — the last two marks are gone with no warning. At W = 450 and 600ms all three are stored ("sub,omit,told"). Expected: leaving the page writes down what is on it. Every in-app path that abandons a record already flushes (switchLesson, openRecord, exportCsv, deleteRecord), and the 5-second heartbeat only runs while `runningSince !== null`, so unload is the one exit with no flush at all. The exposure is bounded at 400ms, so it takes finishing a mark or a keystroke and then hitting Cmd+W or a footer link inside that

## null-inside-a-record-makes-open-do-nothing

- **Severity:** MINOR — needs contrived input
- **What:** A record body that is the literal null, or whose words array contains a null entry, throws an uncaught TypeError inside recordFits before any of the three corruption guards run — the Open button does nothing at all: no message, no change on screen.
- **Observed:** Observed: #savedmsg stays empty, currentLesson stays on the cold-start lesson 15, recordId stays null, and the page throws — (a) "Cannot read properties of null (reading 'text')" at index.html:2080, (b) "Cannot read properties of null (reading 'lesson')" in tokenList(d.lesson). To the teacher, Open is a dead button; they cannot tell a missed click from a lost record, which is the exact failure the code at index.html:2084-2100 was written to eliminate for the neighbouring cases (missing body, unparseable body, words that no longer fit). Expected: one of those messages. recordFits() dereferences

## child-field-truncates-a-name-silently

- **Severity:** COSMETIC — reachable in normal use
- **What:** The header field is labelled "Child" but has maxlength="4"; a teacher typing a name gets it silently cut with no message.
- **Observed:** Observed: value is `Sama`, maxLength 4, and the label for `initials` is the single word `Child`. Nothing on screen says initials only; the only hint is the placeholder `J.M.`, which disappears the moment you start typing. Expected: either a label that says "Initials" or a visible cap.

## horizontal-overflow-below-360px

- **Severity:** COSMETIC — needs contrived input
- **What:** Below roughly 360 px the page scrolls sideways: the header's Lesson block and the fixed stats bar stick out past the viewport.
- **Observed:** Observed: at 1280, 768, 744 and 390 there is no horizontal overflow at all (`scrollWidth === clientWidth`). At 320×568, `scrollWidth` is 369 against a `clientWidth` of 320, and three elements stick out: the `.who` block holding the Lesson picker (right edge 368), `#lessonpick` itself (right edge 368) and `#stats` (right edge 369). Expected: no sideways scroll. An iPad in portrait, the stated target, is clean — this only bites a very narrow phone.

## export-keeps-lowercase-initials

- **Severity:** COSMETIC — reachable in normal use
- **Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/running-record-tool/index.html:2445
- **What:** The child's initials are uppercased on every surface the teacher can see and left as typed only in the exported spreadsheet.
- **Observed:** Observed: input value "jd" displayed uppercase, printed header "JD", saved-records row "JD", CSV Child = "jd". Expected: the export is the only surface carrying a form of the name the teacher never saw. index.html:1683 and :2207 both call .toUpperCase(); index.html:2445 writes e.initials raw. Harmless on its own, but the same child entered as "jd" one week and "JD" the next looks identical in the tool and different in the spreadsheet.

