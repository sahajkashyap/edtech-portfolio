# decodable-passage-generator — verification findings

From the three-round verification of 8-9 Aug 2026. 47 findings, 32 reachable by an ordinary user.

These are HUNTER findings. The run was stopped before every one had been through
the sceptics, so some may not survive scrutiny — treat them as candidates with
reproductions attached, not as confirmed defects.

| Severity | Reachable | What |
|---|---|---|
| BUG | yes | The five Lesson 1-5 cards do nothing when clicked, while the page tells you twice to click them |
| BUG | yes | If a lesson has a passage record but its printable sheet file is missing, the generator still emits the blue "Print this sheet" button for i |
| BUG | contrived | The "Stories" and "Words written" tiles count passage records that never render on the page. A lesson number stored as text ("41") or out of |
| BUG | contrived | Two passage files claiming the same lesson number: the later filename silently overwrites the earlier one, so the card previews one story an |
| BUG | contrived | The front-page note prints a range built from min()/max() of a set that has gaps, so one absent passage record makes the page assert "Lesson |
| BUG | contrived | A mid-curriculum lesson that loses its passage record is silently rendered as an alphabet "Letter and sound" card, while the Print button on |
| BUG | contrived | If a passage's `lines` is a string rather than an array, the generator accepts it, the story renders one character per line down the card, a |
| BUG | yes | On Lessons 63-67 the words page is headed "this week's words" but prints come/some (introduced at Lesson 62), while the heart words that les |
| BUG | yes | The story previewed on a lesson card and the story on the sheet that card prints are two separate saved copies with no consistency check. Ed |
| MINOR | yes | At 200% browser zoom on a laptop the page announces 'This page is built for a computer... open this on a laptop' |
| MINOR | yes | The Lesson 1-5 title link replaces the index in the same tab, and the sheet it lands on has no link back |
| MINOR | yes | A stranger gets 128 numbered choices with no way to find out which lesson their child is on, and the page links nowhere else |
| MINOR | yes | A 128-card page exposes exactly two headings; the 14 unit titles are plain divs |
| MINOR | yes | 'Print this sheet' - the page's only call to action - is white on blue at 3.59:1, under the 4.5:1 AA floor |
| MINOR | contrived | A passage record saved with an empty lines array produces a card that opens onto nothing and a dangling "warm-up:" label, and still counts a |
| MINOR | yes | The index's opening note tells a parent that by Lesson 5 a child can read four words and names them (am, at, mat, sat). The Lesson 5 sheet t |
| MINOR | yes | Lesson 2's printable grown-up page renders the prerequisite range at its boundary as "Lessons 1-1" instead of "Lesson 1". |
| MINOR | yes | Page 1 of every packet tells the grown-up "the little heart marks the bit to just remember," but on 22 of the 123 story packets the child's  |
| MINOR | yes | The index card for Lesson 7 carries a visible "see note" flag explaining that the story contains no /f/ word; the printed packet is headed " |
| MINOR | yes | "Print this sheet" is an <a> nested inside <summary>, so pressing Space while it has keyboard focus both scrolls the page AND toggles the ca |
| MINOR | yes | On Lessons 1-5 the lesson number is an invisible link that replaces the index with a sheet page containing zero links, while the identical-l |
| MINOR | yes | Refreshing while stories are open collapses every card but restores the raw pixel scroll offset onto a much shorter document, landing the te |
| MINOR | contrived | A sheet file that exists but is empty (a truncated or failed write) is never detected: the Printable pages tile silently drops, the card sti |
| MINOR | contrived | Every malformed passage record aborts the build with a raw Python traceback that never says which of the 123 files is bad - the tool refuses |
| MINOR | yes | At the bottom of the page the sticky unit bar permanently reads "Unit 13: Low Frequency Spelling — lessons 111–118" while the whole screen u |
| MINOR | yes | The fourth headline stat reads "100% / PASSED THE GATE" — and the word "gate" appears nowhere else on the page, so a first-time visitor has  |
| MINOR | yes | On the 22 sheets that fall back to the plain heart-word list, the six words shown are the alphabetically last six of the cumulative list, no |
| MINOR | yes | Eight of the 72 heart words in the curriculum are never printed on any words page of any of the 128 sheets, including "he", which is used in |
| MINOR | contrived | If a passage's warmup is saved as a single word instead of a list of words, the build succeeds silently and the card prints the word spelled |
| MINOR | contrived | A lesson listed twice in sound-list.json renders its card twice, so a story exists twice on the page while the Stories tile still counts it  |
| MINOR | contrived | A unit header's "lessons X-Y" label is just min and max of whatever rows carry that unit name, so one mis-filed lesson makes the header clai |
| MINOR | contrived | Four fully-written pages ship in this folder — including case-study.html, the one document written for a hiring manager — and nothing anywhe |
| MINOR | contrived | example-lesson-41.html is a superseded 4-page version of Lesson 41 with a different story, different heart words and a different word-count  |
| MINOR | yes | The front-page note tells you the first five lessons contain a keyword picture, a mouth cue, three-line handwriting practice, a letter hunt  |
| MINOR | yes | The front-page note tells a parent that all five of Lessons 1-5 teach "the letter with a keyword picture, how the mouth makes the sound, han |
| MINOR | yes | The "Grown-up sheet - keep this one" / "For the reader" / "If you want more" badges are white text on a solid colour. Chrome's print dialog  |
| COSMETIC | yes | Each story card's expand control announces itself as '...Print this sheet', because a link is nested inside the <summary> |
| COSMETIC | yes | Printable sheets are 816px wide on screen, so an iPad in portrait gets a horizontal scrollbar |
| COSMETIC | yes | The page has no meta description, no favicon and no og: tags, so a shared link previews as nothing |
| COSMETIC | yes | Opening one story stretches the two other cards in its CSS grid row to the same height, turning them into tall, mostly empty boxes. |
| COSMETIC | contrived | An empty warm-up array renders a bare "warm-up:" label with nothing after it, and a null title renders the literal word "None" as the story' |
| COSMETIC | yes | Clicking a lesson card that is sitting on the bottom edge of the window opens its story entirely below the fold and the page does not scroll |
| COSMETIC | yes | The only sentence that says where the lesson numbering comes from is "Grouped by UFLI's real units" — UFLI appears exactly once on the page  |
| COSMETIC | yes | Printing the front page (no @media print rule exists) turns all 128 "Print this sheet" buttons into near-white text with no button shape — d |
| COSMETIC | yes | Clicking the last unit button, "Unit 14: Additional Affixes", scrolls to the bottom of the page, where the sticky banner pinned at the very  |
| COSMETIC | contrived | Story text is dropped into the HTML unescaped, so anything between angle brackets disappears from the preview while still being counted in t |
| COSMETIC | yes | 33 grown-up sheets print typewriter quotes and typographic quotes side by side in the same paragraph block; 96 of the 128 sheets contain str |

---

## letter-cards-dead-to-the-click

**BUG** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/decodable-passage-generator/index.html:1 (generated by build_index.py)

**What:** The five Lesson 1-5 cards do nothing when clicked, while the page tells you twice to click them

**Steps:**

```
Served the folder over 127.0.0.1 http, Chrome 1280x900, loaded /index.html. For each of the five .card.letter elements (Lessons 1-5) I scrolled it into view and fired three REAL page.mouse.click() events inside the card body but away from the two links: at (centre, 35% height) = the 'Letter and sound' line, at (80% width, 12% height) = just right of the 'Lesson n' text, and at (centre, 55% height) = the '/a/' symbol line. 15 clicks total. After each I read page.url() and document.querySelectorAll('details[open]').length.
```

**Observed vs expected:** Observed: navigated=false and anythingOpened=0 on all 15 clicks - nothing happens at all. Expected: the same thing the page promises. The .note says verbatim 'Click them like any other lesson.' and the section blurb says 'Click a card to preview its story right here.' The identical click on a story card (details.card, dead centre) returns open=true. The letter card is a plain <div class="card letter"> with cursor:auto; the only working target is the 81x20px 'Lesson 1' text, whose computed style is byte-identical to the NON-clickable 'Lesson 6' title on story cards (color rgb(44,62,80), text-decoration none, weight 700, 16.8px, same mono family) - so nothing marks it as a link except the curs

## dead-print-button-when-sheet-missing

**BUG** — reachable  
**Where:** build_index.py:194 (symptom on index.html, the Lesson N card's .print a)

**What:** If a lesson has a passage record but its printable sheet file is missing, the generator still emits the blue "Print this sheet" button for it and exits 0 — a parent clicks it and gets a 404 tab. The page's own "Printable pages" tile silently drops by 5 while the headline keeps promising "128 printable practice sheets".

**Steps:**

```
1. Copied the tool to a scratch dir; ran `python3 build_index.py` — output byte-identical to the shipped index.html (verified with cmp).
2. Deleted only `sheets/lesson-041.html` (the passage record `passages/lesson-041.json` was left in place).
3. Ran `python3 build_index.py`. It exited 0 and printed "123 passages, 12,730 words, 629 printable pages" — no warning about the missing sheet.
4. Served the folder over http on 127.0.0.1 (node http, real Chrome via puppeteer-core, headless new).
5. Clicked the "Print this sheet" button on the Lesson 41 card exactly as a parent would.
```

**Observed vs expected:** Observed: the Lesson 41 card renders normally (story "Mud Pig", warm-up words, blue "Print this sheet" button -> sheets/lesson-041.html). Clicking it opens a new tab whose entire content is "404 Not Found". The stat tile reads "629 Printable pages" (was 634) with no explanation, while the h1 still reads "...128 lessons with 128 printable practice sheets". Expected: the build refuses (or at minimum warns) when a listed lesson has no sheet body, exactly as it already does for the letter-and-sound branch — build_index.py:200 guards that branch with `.exists()`, but the passage branch at build_index.py:194 emits the link unconditionally, and sheet_pages() at build_index.py:158 quietly returns 0 

## orphan-passage-inflates-stats-tiles

**BUG** — contrived  
**Where:** build_index.py:166 (passages[spec["lesson"]] = spec); tiles at build_index.py:220 and :262

**What:** The "Stories" and "Words written" tiles count passage records that never render on the page. A lesson number stored as text ("41") or out of range (999) makes the record invisible, but the tiles still count it — and that lesson's card is silently relabelled "Letter and sound" with its story gone.

**Steps:**

```
1. In the scratch copy, changed `passages/lesson-041.json` "lesson": 41 to the string "41". Ran `python3 build_index.py` — exit 0, printed "123 passages, 12,730 words", and listed lesson 41 under "no passage for lessons" without treating that as an error.
2. Loaded the rebuilt index.html in Chrome over http and counted `document.querySelectorAll('details.card').length` against the tile text.
3. Repeated the whole thing with "lesson": 999 (an out-of-range index) — identical result.
```

**Observed vs expected:** Observed: the tile says "123 Stories" but only 122 story cards exist on the page; "12,730 Words written" still includes the 61 words of a story no visitor can reach. The Lesson 41 card is now a plain div reading title "Letter and sound" with no story and no warm-up — the fallback copy at build_index.py:205 is hardcoded and is only true for lessons 1-5, so Lesson 41 is described to a parent as a letter-and-sound lesson. Expected: a lesson number that is not an integer in 1-128 is refused loudly; failing that, the tiles must count what was actually rendered (they come from len(passages) at build_index.py:262 and the sum at :220, neither of which knows whether the record reached the page).

## duplicate-lesson-record-silently-wins

**BUG** — contrived  
**Where:** build_index.py:166

**What:** Two passage files claiming the same lesson number: the later filename silently overwrites the earlier one, so the card previews one story and the "Print this sheet" button prints a different story. Build exits 0 with no warning.

**Steps:**

```
1. In the scratch copy, edited `passages/lesson-042.json` to say "lesson": 41 (the accident of copying a passage file as a template and not changing the number).
2. Ran `python3 build_index.py` — exit 0, printed "122 passages, 12,669 words, 634 printable pages". No mention that two records collided.
3. Loaded the rebuilt page in Chrome over http, read the Lesson 41 card's preview, then opened sheets/lesson-041.html in the same browser.
```

**Observed vs expected:** Observed: the Lesson 41 card previews "The Ball in the Well" ("Bill has a red ball and a tall hill..."), but sheets/lesson-041.html — the sheet its own button opens — prints "Mud Pig / LESSON 41". A parent reads one story on screen and hands their child a different one on paper. Separately, the Lesson 42 card is silently downgraded to a story-less "Letter and sound" div. Expected: a duplicate lesson key is refused, or at least the passage is keyed on the filename rather than on a hand-maintained field inside the file (build_index.py:166 does `passages[spec["lesson"]] = spec` over a `sorted(glob)`, so last-sorted wins with no collision check).

## missing-passage-rewrites-the-front-page-note

**BUG** — contrived  
**Where:** build_index.py:222-224,273

**What:** The front-page note prints a range built from min()/max() of a set that has gaps, so one absent passage record makes the page assert "Lessons 1-41 are letter-and-sound sheets, not stories" - a flatly false claim about 41 lessons, with nothing anywhere flagging it.

**Steps:**

```
Copied the tool to a scratch dir (repo untouched), deleted passages/lesson-041.json, ran `python3 build_index.py` (exit 0, printed "122 passages, 12,669 words"), served the folder over node http on 127.0.0.1 and loaded /index.html in headless Chrome via puppeteer-core. Read document.querySelector('.note strong').textContent.
```

**Observed vs expected:** Observed: "Lessons 1-41 are letter-and-sound sheets, not stories." Expected: either the true set ("Lessons 1-5 and 41") or a clear refusal. build_index.py computes `letter_sheets = sorted(n for n in missing if sheet exists)` and then renders `Lessons {min(letter_sheets)}-{max(letter_sheets)}`, i.e. it renders a contiguous range from a non-contiguous set. The same false note appears with the record present but its lesson number stored as text (`"lesson": "41"`), which I also ran: build still reports 123 passages, the Stories tile still reads 123 and Words 12,730, but only 122 story cards exist on the page - the two counters silently disagree. Deleting passages/lesson-006.json instead yields "

## orphaned-lesson-mislabelled-as-letter-and-sound

**BUG** — contrived  
**Where:** build_index.py:200-211

**What:** A mid-curriculum lesson that loses its passage record is silently rendered as an alphabet "Letter and sound" card, while the Print button on that very card opens a 5-page decodable-passage packet - the card and the packet it opens contradict each other.

**Steps:**

```
Same scratch copy with passages/lesson-041.json deleted, rebuilt, served over http, loaded in headless Chrome. Read the Lesson 41 card: className and .t text. Then opened its .print a href (sheets/lesson-041.html) in a second Chrome page and read document.title and .page count.
```

**Observed vs expected:** Observed: card class "card letter", label "Letter and sound", and its Print button opens {title: "Decodable Passage - Lesson 41, Short Vowels Review (all)", pages: 5} whose first page reads "Prints as 5 pages: 1 grown-up sheet, then 4 child sheets". Expected: the page must not describe Lesson 41 - a short-vowel review well past the alphabet - as a letter-and-sound sheet, and must not contradict the packet it hands the parent. The generator's `elif sheet exists` branch hardcodes the assumption that "no passage but has a sheet" can only mean lessons 1-5 (it even special-cases n==5 for "Blending"), so any other lesson falling into it is mislabelled with no warning. Build exited 0 and printed no

## lines-as-a-string-renders-one-letter-per-line

**BUG** — contrived  
**Where:** build_index.py:185,220

**What:** If a passage's `lines` is a string rather than an array, the generator accepts it, the story renders one character per line down the card, and the headline "Words written" tile silently changes to a character count - wrong arithmetic, no refusal.

**Steps:**

```
Scratch copy; set lesson-041.json `"lines": "Sam has a pig."` (a plausible hand-edit - one line typed without brackets), ran build_index.py (exit 0), served over http, opened the Lesson 41 card with a real summary.click() in headless Chrome, counted .story span elements and their distinct getBoundingClientRect().top values.
```

**Observed vs expected:** Observed: 14 spans stacked on 11 separate visual rows reading "S" / "a" / "m" / " " / "h" / "a" ... , and the Words written tile read 12,680 instead of 12,730. Expected: refuse the record, or at minimum leave the tile alone. `"".join(f"<span>{ln}</span>" for ln in spec["lines"])` and `" ".join(s["lines"]).split()` both iterate a string character by character, so a child is shown a vertical column of letters and the front-page word count is quietly recomputed from characters. Build printed no warning; the Stories tile still said 123.

## heart-this-week-shows-last-weeks

**BUG** — reachable

**What:** On Lessons 63-67 the words page is headed "this week's words" but prints come/some (introduced at Lesson 62), while the heart words that lesson actually introduces — two, does, any, many, been, into, because — are never shown, even though the story on the very next page uses them.

**Steps:**

```
Served the tool folder over node http on 127.0.0.1 and drove real Chrome (puppeteer-core, headless:'new'). Steps executed: (1) load http://127.0.0.1:PORT/index.html; (2) find the details.card whose .n reads "Lesson 63" and .click() its ".print a" link; (3) the new tab opens /sheets/lesson-063.html; (4) read the Heart-words h2 and every .hwcard .hwword, plus every .passage .ln. Result from the browser: heading = "Heart words — this week's words, not always in the story; the ♥ part is learned by heart"; cards = ["come","some"]; story line 1 = "Lin packs two big boxes for the trip.", line 4 = "Lin does not see him. She shuts the lid.", line 7 = '"What does a fox want with dishes?" said Lin.'; the reading page is titled "Two Big Boxes". Grepping the whole sheet file confirms "two"/"does" occur only inside the story, title and questions — never on the words page. I then enumerated all 123 story sheets in the browser against heart_words.py: exactly Lessons 63, 64, 65, 66 and 67 print heart c
```

**Observed vs expected:** Observed: Lesson 63's words page says "this week's words" and shows come and some. Expected: the words page shows the heart words Lesson 63 introduces (two, does) — the ones the child is about to meet in the title and in lines 1, 4 and 7 — or, at minimum, does not label last week's words as this week's.

## preview-and-printed-sheet-drift-silently

**BUG** — reachable

**What:** The story previewed on a lesson card and the story on the sheet that card prints are two separate saved copies with no consistency check. Edit a passage and rebuild the index the documented way and the page happily ships a preview that contradicts the packet it links to, exit code 0, no warning anywhere.

**Steps:**

```
1. Copied the whole tool to a sandbox and confirmed it rebuilds byte-for-byte identical to the shipped index.html.
2. Made one ordinary editorial fix to the saved record passages/lesson-041.json: line 0 "Sam has a big pig and a red tub." -> "...big hog...", title "Mud Pig" -> "Mud Hog", warmup[0] "pig" -> "hog".
3. Ran the documented rebuild: `python3 build_index.py`. It printed "wrote .../index.html / 123 passages, 12,730 words, 634 printable pages" and exited 0. No mention of lesson 41.
4. Served the folder over http on 127.0.0.1 and drove real Chrome (puppeteer-core, same boilerplate as tests/run-tests.js): clicked the Lesson 41 summary open, read the card, then opened the exact href on its "Print this sheet" button (sheets/lesson-041.html) in a second tab and read document.body.innerText.
5. Ran the whole thing twice from pristine — identical both times.
6. Also ran the project's own checker, `python3 check_all.py`: "128 sheets measured / fitting cleanly: 128" — it only measures pa
```

**Observed vs expected:** Observed — card: title "Mud Hog", first line "Sam has a big hog and a red tub.", warm-up "hog, mud, sun, tub, rag, wet". The sheet that same card prints: "Mud Pig ... LESSON 41", and the card's first line is absent from the sheet entirely (harness reported LINES ON CARD BUT NOT ON SHEET: ["Sam has a big hog and a red tub."]). Expected — either the two agree, or the build refuses/warns that lesson 41's sheet is older than its passage. The page itself makes the promise it breaks: "Click a card to preview its story right here. Print this sheet opens that lesson's printable packet — that's the one to print for your child." The child reads a different story than the grown-up previewed.

## zoom-200-tells-a-laptop-user-to-use-a-laptop

**MINOR** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/decodable-passage-generator/index.html:1 (the @media (max-width:640px) rule)

**What:** At 200% browser zoom on a laptop the page announces 'This page is built for a computer... open this on a laptop'

**Steps:**

```
Launched real Chrome with --force-device-scale-factor=2 --window-size=640,900 and defaultViewport:null - i.e. a 1280-physical-pixel laptop window at 200% page zoom. Loaded /index.html and read the computed display of .onphone. Also swept the exact boundary at widths 638/639/640/641/642/700/768/820.
```

**Observed vs expected:** Observed: cssWidth 640, devicePixelRatio 2, physicalWidth 1280, and the note is VISIBLE reading 'This page is built for a computer. You can read the stories on a phone, but the practice sheets are made for letter-size paper - open this on a laptop when it is time to print one.' Expected: nothing, because the reader IS on a laptop. The single rule @media (max-width:640px) uses width as a proxy for 'phone'; boundary confirmed as shown at <=640 and hidden at >=641. Hit by anyone using 200% zoom (a mainstream low-vision setting, and WCAG 1.4.4 requires the page to work at it) or a half-screen browser window.

## lesson-1-5-title-navigates-in-place-into-a-dead-end

**MINOR** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/decodable-passage-generator/index.html:1 (.card.letter .n a, 5 occurrences)

**What:** The Lesson 1-5 title link replaces the index in the same tab, and the sheet it lands on has no link back

**Steps:**

```
1280x900, loaded /index.html, real mouse click on the 'Lesson 1' text of the first letter card. Counted browser tabs before/after and read the resulting page. Then loaded /sheets/lesson-001.html directly and counted anchors and buttons.
```

**Observed vs expected:** Observed: tabsBefore=2, tabsAfter=2 - no new tab; page.url() became /sheets/lesson-001.html, i.e. the index was replaced. The sheet contains 0 <a> elements and exactly one button ('Print / Save as PDF'), so the only route back to the 128-lesson list is the browser Back button. Expected: the same behaviour as every other route to a sheet - all 128 'Print this sheet' links carry target="_blank" rel="noopener", while all five .card.letter .n a carry target=null. Two different behaviours for what looks like the same action.

## no-guidance-on-which-lesson-and-no-way-out

**MINOR** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/decodable-passage-generator/index.html:1

**What:** A stranger gets 128 numbered choices with no way to find out which lesson their child is on, and the page links nowhere else

**Steps:**

```
Loaded /index.html at 1280x900 and enumerated every <a href> that is not '#...' or 'sheets/...'; also extracted all visible prose with the 128-card grid and the jump nav removed, and regex-tested it for any of: 'which lesson', 'not sure', 'assessment', 'start here', 'teacher'.
```

**Observed vs expected:** Observed: outbound links = [] (the page links only to its own 128 sheets), and the prose test returns false - the words 'which lesson', 'not sure', 'assessment' and 'start here' appear nowhere. Expected: some sentence, or a link back to phonics-assessment-tool/index.html, telling a parent how to choose. The link runs one way only: phonics-assessment-tool/index.html contains href="../decodable-passage-generator/index.html", and nothing here points back. A parent handed this URL cold has to guess between 128 lessons.

## unit-headers-are-not-headings

**MINOR** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/decodable-passage-generator/index.html:1 (div.uh, 14 occurrences)

**What:** A 128-card page exposes exactly two headings; the 14 unit titles are plain divs

**Steps:**

```
Loaded /index.html and (a) listed every h1/h2/h3/h4/[role=heading] in the DOM, (b) took Chrome's own accessibility snapshot via page.accessibility.snapshot() and filtered for role 'heading', (c) dumped the tag of the first three .uh elements.
```

**Observed vs expected:** Observed: the DOM has exactly two headings ('Reading practice for every lesson...' and 'Every lesson') and Chrome's accessibility tree agrees - 2 heading nodes out of 358. The 14 unit titles come back as 'DIV.uh -> Unit 1: Alphabetlessons 1-34' etc., with no heading role. There is also no <main> landmark and no skip link. Expected: a screen-reader or VoiceOver user pressing H to skim the 14 units should reach them; instead they must tab past everything. Sighted keyboard navigation is fine - I confirmed the jump buttons work from the keyboard (Tab x9 to 'Unit 9: Other Vowel Teams', Enter, then Tab lands on 'Lesson 89'), and focus is never hidden behind the sticky unit header (0 of 60 tab stop

## print-button-contrast-below-aa

**MINOR** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/decodable-passage-generator/index.html:1 (.card .print a)

**What:** 'Print this sheet' - the page's only call to action - is white on blue at 3.59:1, under the 4.5:1 AA floor

**Steps:**

```
Loaded /index.html at 1280x900 and computed the WCAG relative-luminance contrast ratio from getComputedStyle for nine text elements against their nearest opaque background, in the page itself.
```

**Observed vs expected:** Observed: .card .print a is rgb(255,255,255) on rgb(55,138,221) (#378ADD) at font-size 11.52px weight 600 = 3.59:1. WCAG AA needs 4.5:1 for text this size (the 3:1 large-text exemption starts at 18.66px bold). It appears 128 times and is the only thing on the page a visitor is meant to click. The same white-on-#378ADD is the 'Print / Save as PDF' button on all 128 sheets. Everything else on the page clears AA: .lede/.sub/footer 4.95:1, card text 6.76:1, .stat .k 6.19:1.

## empty-story-renders-blank-card

**MINOR** — contrived  
**Where:** build_index.py:185

**What:** A passage record saved with an empty lines array produces a card that opens onto nothing and a dangling "warm-up:" label, and still counts as a Story in the tile. The build reports success.

**Steps:**

```
1. In the scratch copy, set `passages/lesson-041.json` "lines": [] and "warmup": [].
2. Ran `python3 build_index.py` — exit 0, "123 passages, 12,669 words".
3. Loaded the page in Chrome over http and inspected the Lesson 41 card.
```

**Observed vs expected:** Observed: the Lesson 41 card still shows the title "Mud Pig" and its Print button, but `.story` is an empty div and `.warm` reads literally "warm-up: " with nothing after the colon; clicking the card opens onto blank space. The tile still counts it as one of "123 Stories". Expected: an empty story is refused at build time (build_index.py:185 joins the lines with no emptiness check). Note the contrast — "lines": null, a truncated half-written JSON file, and deleting all five letter sheets all DO fail loudly (exit 1, traceback, previous index.html left untouched); an empty list is the one corrupt shape that slips through.

## lesson-5-four-vs-five-words

**MINOR** — reachable

**What:** The index's opening note tells a parent that by Lesson 5 a child can read four words and names them (am, at, mat, sat). The Lesson 5 sheet that same page links to asks the child to read five — it adds Sam.

**Steps:**

```
Local http server on 127.0.0.1 over the tool folder, headless Chrome via puppeteer-core. 1) Load http://127.0.0.1:PORT/index.html. 2) Read document.querySelector('.note').textContent -> "...by Lesson 5 there are four (am, at, mat, sat)." 3) Click the 'Print this sheet' link on the card whose .n reads exactly 'Lesson 5' (real .click() on the anchor). 4) In the new tab (/sheets/lesson-005.html) read [...document.querySelectorAll('.wline .bwd')].map(e=>e.textContent.trim()).
```

**Observed vs expected:** Observed on the sheet's 'Slide and read' row: ["am","at","mat","sat","Sam"] — five words. Expected: the same count the index states (four), or an index note that says five. build_index.py's own module docstring says "at Lessons 4-5 there are five", so the generator's record agrees with the sheet and disagrees with the sentence it prints. word-bank.json's newAtLesson also yields four (am at L2; at, mat, sat at L4) because it excludes the proper noun, which is exactly where the two surfaces diverge.

## lesson-2-degenerate-range-1-to-1

**MINOR** — reachable

**What:** Lesson 2's printable grown-up page renders the prerequisite range at its boundary as "Lessons 1-1" instead of "Lesson 1".

**Steps:**

```
Same server/Chrome. 1) Load index.html. 2) Click the 'Print this sheet' anchor inside the card whose .n reads 'Lesson 2'. 3) In the new tab (/sheets/lesson-002.html) read document.querySelector('.prereq').innerText. Enumerated the same paragraph on all 128 sheets; lesson 2 is the only one where the range collapses to a single lesson.
```

**Observed vs expected:** Observed: "This is Lesson 2. It assumes your child has met the letters from Lessons 1–1 (a). If not, start at Lesson 1...". Expected: "Lesson 1 (a)". Lessons 3, 4, 5 read correctly ("Lessons 1–2 (a, m)", etc.), and every story sheet from Lesson 6 up reads "Lessons 1–5" and higher — only the one-item boundary case prints an empty-looking range.

## heart-mark-promised-but-never-printed

**MINOR** — reachable

**What:** Page 1 of every packet tells the grown-up "the little heart marks the bit to just remember," but on 22 of the 123 story packets the child's words page lists the heart words as plain text with a tick box and there is no heart anywhere in the file.

**Steps:**

```
Same server/Chrome. 1) Load index.html. 2) Click 'Print this sheet' on the Lesson 41 card. 3) In the new tab evaluate: the promise line from body.innerText, [...document.querySelectorAll('.hearts .hw')].map(textContent), document.querySelectorAll('.hwcard').length, and the count of heart glyphs (innerHTML match of /&hearts;|♥/g plus .hwcard svg path[fill="#b23f28"]). 4) Repeated the same body-text probe across all 123 story sheets loaded in the browser.
```

**Observed vs expected:** Observed on Lesson 41: promise = "A heart word has one part that cannot be sounded out — the little heart marks the bit to just remember."; heart words printed = [the, to, was, we, what, you]; heart cards = 0; heart symbols anywhere on the sheet = 0. Expected: either a heart-marked card, or page-1 wording that matches the plain list. The grown-up promise is on all 123 sheets; the plain no-heart list is on 22 of them — lessons 39, 40, 41, 104-109, 116-128.

## lesson-7-target-sound-note-only-on-screen

**MINOR** — reachable

**What:** The index card for Lesson 7 carries a visible "see note" flag explaining that the story contains no /f/ word; the printed packet is headed "LESSON 7 / F /F/" and says nothing about it.

**Steps:**

```
Same server/Chrome. 1) Load index.html. 2) Click the summary of the card whose .n starts 'Lesson 7' — .n reads "Lesson 7 · see note" and .tnote explains the gap. 3) Click that card's 'Print this sheet' anchor. 4) In the new tab (/sheets/lesson-007.html) read body.innerText and the story spans.
```

**Observed vs expected:** Observed: sheet heading "LESSON 7 / F /F/"; story = "I am Tam. Sam and Pam sat. The map! Pat the map, Sam. ..." with zero words containing f; a regex for /worksheet generator|does not use an f|no f word/i over the whole packet returns false. Expected: the caveat that the screen shows travels onto the paper that goes home, since the packet is labelled with the sound it does not practise.

## space-on-print-link-toggles-the-card

**MINOR** — reachable

**What:** "Print this sheet" is an <a> nested inside <summary>, so pressing Space while it has keyboard focus both scrolls the page AND toggles the card — closing the story the teacher was reading.

**Steps:**

```
Executed in headless Chrome over http://127.0.0.1:<port>/index.html (viewport 1280x900).
1. Load index.html.
2. Real click on the summary of details.card[10] ("Lesson 16") to open its story. Verified d.open === true, scrollY 1381.
3. Focus its "Print this sheet" link: d.querySelector('.print a').focus() — document.activeElement.textContent === "Print this sheet". This is exactly where a Tab press lands (verified separately: from a story summary, one Tab moves to that card's "Print this sheet" link).
4. page.keyboard.press('Space').
Result: {y:1381, open:true} -> {y:2241, open:false, storyH:211}.
Also run twice on a CLOSED card (st1 probe [B] and st4 [R3] runs 1 and 2): before {y:1259, open:false, focus:"Print this sheet"} -> after SPACE {y:2119, open:true}, identical both runs. 3/3 deterministic, no new tab opened, no page or console errors.
```

**Observed vs expected:** Observed: one Space press does two unrelated things — the page scrolls one screen (860px) and the <details> toggles. On an open card the story silently collapses and the teacher is scrolled away from it. Expected: Space on a focused link scrolls the page and nothing else; only Enter (activating the link) or a click/Enter on the summary itself should change the card's open/closed state. Cause is markup, not Chrome: the interactive <a> is placed inside <summary> (build_index.py:194, rendered at index.html:114), so the key event reaches the summary's activation behaviour.

## letter-card-title-same-tab-dead-end

**MINOR** — reachable

**What:** On Lessons 1-5 the lesson number is an invisible link that replaces the index with a sheet page containing zero links, while the identical-looking numbers on every other card are not links at all.

**Steps:**

```
Executed in headless Chrome over http://127.0.0.1:<port>/index.html.
1. Load index.html. Measure the "Lesson 1" number on the first .card.letter against the "Lesson 6" number on the first details.card: computed colour identical (rgb(44,62,80) both), text-decoration-line "none", same font-size and weight — CSS at index.html:69 is `.card.letter .n a{color:inherit;text-decoration:none}`.
2. Open all 12 stories in Unit 3 with real summary clicks, scroll the Lesson 1 card into view (scrollY 571, documentHeight 9985).
3. page.mouse.click on the centre of the "Lesson 1" text.
Result: tabs 2 -> 2 (no new tab); location.pathname becomes /sheets/lesson-001.html.
4. Inspect the landing page: document.querySelectorAll('a').length === 0. Only content is the toolbar: "Print / Save as PDF  Prints as 3 pages...". Same for sheets/lesson-041.html (links: 0).
5. For contrast, clicking "Print this sheet" on that same card: tabs 1 -> 2, index still at /index.html.
6. page.goBack() -> scroll 571 and all 12 
```

**Observed vs expected:** Observed: two links on the same card point at the same URL but behave differently — the untargeted, unstyled lesson number replaces the index in the same tab, the blue button opens a new tab. The destination has no link back, so the only way home is the browser Back button. Expected: the lesson number either is not clickable (matching all 123 story cards, where it is plain text) or is visibly a link and opens in a new tab like the button beside it. The page's own note says these five lessons are clickable "like any other lesson" and the section text says "Click a card to preview its story right here", but on these five a click takes you off the page instead. Back does restore scroll and open

## refresh-drops-you-in-a-different-unit

**MINOR** — reachable

**What:** Refreshing while stories are open collapses every card but restores the raw pixel scroll offset onto a much shorter document, landing the teacher a whole unit further down the list with no sign anything moved.

**Steps:**

```
Executed in headless Chrome over http://127.0.0.1:<port>/index.html, three consecutive runs, byte-identical results.
1. Load index.html.
2. Real summary click on every details.card inside #u3 (12 Unit 3 stories open, as a teacher reading down the unit would).
3. Scroll so "Lesson 50" sits just under the sticky unit header.
   Measured: {y:3976, docH:9985, unit:"Unit 3: Digraphs", firstCardBelowHeader:"Lesson 48"}.
4. page.reload({waitUntil:'load'}), wait 1200ms.
   Measured: {y:3976, docH:8780, unit:"Unit 4: VCe", firstCardBelowHeader:"Lesson 60"}.
Runs 2 and 3 identical. A control I also ran (st5 [R5]) shows that when the URL carries a hash (#u13) the refresh does land correctly, and a second control (st5 [R1b], 70 cards open) happened to re-anchor correctly — so the failure needs the scroll-offset path, which is what a plain scroll-and-refresh gives you.
```

**Observed vs expected:** Observed: after refresh the scroll offset is preserved unchanged (3976) but the document lost 1205px of height because all 12 stories collapsed, so the screen now shows Lesson 60 in Unit 4 instead of Lesson 48 in Unit 3 — twelve lessons and one unit away. Expected: the refresh either keeps the reading position (the lesson that was at the top stays at the top) or returns to the top of the page; landing silently in a different unit is the worst of both. The page holds no state at all by design (no script, no storage), which is why nothing re-opens the cards or corrects the offset. Recoverable by scrolling, but the teacher gets no signal that they moved.

## empty-sheet-file-opens-a-blank-page-with-no-error

**MINOR** — contrived  
**Where:** build_index.py:148-158,200

**What:** A sheet file that exists but is empty (a truncated or failed write) is never detected: the Printable pages tile silently drops, the card still advertises the packet, and clicking Print this sheet opens a blank white page with HTTP 200 - no 404, no message.

**Steps:**

```
Scratch copy; truncated sheets/lesson-041.html to zero bytes (file still present), ran build_index.py (exit 0, printed "629 printable pages"), served over http, loaded /index.html in headless Chrome, then navigated a second page to the card's print href and read the response status and document.body.innerText.
```

**Observed vs expected:** Observed: Printable pages tile changed 634 -> 629 with no warning anywhere; the Lesson 41 card still reads "Mud Pig" and still offers "Print this sheet"; opening it gives HTTP 200 and innerText "" - a blank page. Expected: the build should refuse a zero-page sheet, or the card should not offer a packet that has no content. This is adjacent to the already-known dead-print-button-when-sheet-missing, but the failure mode differs: the file is present, so there is no 404 and no dead link to notice - the parent gets a silently blank sheet, and the page-count arithmetic changes underneath them.

## bad-passage-file-aborts-without-naming-the-file

**MINOR** — contrived  
**Where:** build_index.py:164-166,185-186,220

**What:** Every malformed passage record aborts the build with a raw Python traceback that never says which of the 123 files is bad - the tool refuses, but not clearly.

**Steps:**

```
Scratch copy, four separate runs of `python3 build_index.py`: (a) lesson-041.json truncated mid-string at 300 bytes, (b) `"lines": null`, (c) `"warmup": null`, (d) `lines[2]` set to the number 7. Also deleted all five sheets/lesson-00N.html to empty letter_sheets.
```

**Observed vs expected:** Observed: (a) `json.decoder.JSONDecodeError: Unterminated string starting at: line 11 column 5 (char 290)` - I grepped the whole traceback for "lesson-041" and it does not appear; (b) `TypeError: 'NoneType' object is not iterable`; (c) `TypeError: can only join an iterable`; (d) `TypeError: sequence item 2: expected str instance, int found`; (e) `ValueError: min() arg is an empty sequence`. None names the offending file or lesson. Expected: "passages/lesson-041.json is not valid JSON" or similar. Credit where due, and I verified it: index.html is left byte-for-byte untouched on every crash (compared before/after hashes), so the refusal is at least safe - a half-written page is never shipped.

## last-unit-header-pins-the-wrong-unit

**MINOR** — reachable

**What:** At the bottom of the page the sticky unit bar permanently reads "Unit 13: Low Frequency Spelling — lessons 111–118" while the whole screen underneath is Unit 14 (lessons 119–128). On a window 880px tall or more there is no scroll position at which Unit 14's own heading ever reaches the bar, so the page's only "which unit am I in" indicator is stuck naming the wrong unit for the last ten lessons.

**Steps:**

```
1. node http server on 127.0.0.1 serving decodable-passage-generator/, Chrome at viewport 1280x900 (the same LAPTOP size run-tests.js uses).
2. page.goto http://127.0.0.1:PORT/index.html
3. Click the last jump button: document.querySelector('.jump a[href="#u14"]').click()
4. After 500ms read document.elementFromPoint(300,10).closest('.uh') and #u14 .uh getBoundingClientRect().top.
Ran 3 times in a row, identical each time: {"pinned":"Unit 13: Low Frequency Spelling","u14top":109}. Screenshot saved at /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/statetiming/vp-u14.png.
Also reached without the nav at all: scroll to the very bottom (window.scrollTo(0, max)) — elementFromPoint(300,10) is still the Unit 13 header.
Swept every .uh's minimum top over the whole scroll range at 1280x900: u1..u13 all reach 0 or less (they pin), u14 never gets below 109 — it can never pin. Height sweep at width 1440 after clicking #u14: h=640/700/760/800/820/840 -> 
```

**Observed vs expected:** Observed: after clicking the jump button labelled "Unit 14: Additional Affixes", the heading pinned at the top of the screen reads "Unit 13: Low Frequency Spelling / lessons 111–118", and it keeps reading that for as long as you look at lessons 119–128, because the document ends before Unit 14 can scroll far enough to pin. Expected: the control you clicked and the heading the page reports back should agree — Unit 14's heading at the top, or at least reachable by scrolling.

## passed-the-gate-tile-unexplained

**MINOR** — reachable

**What:** The fourth headline stat reads "100% / PASSED THE GATE" — and the word "gate" appears nowhere else on the page, so a first-time visitor has no way to know what was passed.

**Steps:**

```
1. Served /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/decodable-passage-generator over node http on 127.0.0.1 (case-sensitive server, Content-Type: text/html; charset=utf-8).
2. Launched real Chrome via puppeteer-core, viewport 1280x900, navigated to http://127.0.0.1:<port>/index.html, waitUntil 'load'.
3. Read the hero tiles: page.evaluate reading .stat .k / .stat .v -> [{STORIES,123},{WORDS WRITTEN,12,730},{PRINTABLE PAGES,634},{PASSED THE GATE,100%}].
4. Counted occurrences of /[Gg]ate/ and /GATE/ in document.body.innerText across the whole rendered page (all 128 cards, note box, footer): exactly 1 — the tile label itself.
5. Read the footer text in full: "Every passage passed validate_passage.py: each word decodable at its lesson, words using a two-sound spelling drawn from an approved list, warm-up words taken from the story itself..." — it explains the check but never uses the word "gate", and sits ~9 screens below the tile.
```

**Observed vs expected:** Observed: a headline quality claim ("100% PASSED THE GATE") in the first screenful, with the term used exactly once on the page and defined nowhere near it. Expected: the tile label names something the page explains, or the tile says what a stranger can actually verify (e.g. "every passage machine-checked").

## heart-review-strip-alphabetical-not-newest

**MINOR** — reachable

**What:** On the 22 sheets that fall back to the plain heart-word list, the six words shown are the alphabetically last six of the cumulative list, not the newest six — so Lessons 116-128 all print the identical strip "where who woman would you your" and the newest heart word (laugh, L110) never appears again.

**Steps:**

```
Same local server + real Chrome. Steps: (1) load index.html; (2) click "Print this sheet" on the Lesson 116 card — the tab opens /sheets/lesson-116.html; (3) read .rowlab and every ".hearts .hw". Browser returned label "Heart words — read each one, then check the box." and words ["where","who","woman","would","you","your"]. I then loaded all 128 sheets in Chrome and collected the same selector: 22 sheets use this plain list (39, 40, 41, 104-109, 116-128) and every one of Lessons 116-128 — thirteen consecutive sheets — prints that byte-identical six-word strip; Lessons 104-109 print it too; Lessons 39-41 print "the to was we what you". Checking sound-list.json: allowedHeartWords is stored alphabetically (hw == sorted(hw) is True for every lesson), and build_sheet.py takes older[-6:], so "the last six" means the alphabetically last six. The newest heart words at those lessons (door L?, floor, son, eye L96, about L98, laugh L110) never appear. audits/2026-07-31-outcome.md records the inte
```

**Observed vs expected:** Observed: the plain heart-word strip is the alphabetically last six taught words and is identical on 13 consecutive sheets. Expected: the newest six taught heart words, as the design record states, so the strip changes as the child progresses.

## heart-words-never-printed-on-any-sheet

**MINOR** — reachable

**What:** Eight of the 72 heart words in the curriculum are never printed on any words page of any of the 128 sheets, including "he", which is used in 53 of the 123 stories.

**Steps:**

```
Collected every heart word rendered by Chrome across all 128 sheets (both renderings: ".hwcard .hwword" and ".hearts .hw"), then compared with the heart words sound-list.json introduces. 64 of 72 are printed somewhere; 8 never are: be (L23), he (L23), go (L43), two (L63), does (L63), many (L64), any (L64), been (L65). Cross-checked the story text of all 123 passages: "he" appears in 53 stories (first at Lesson 24), "go" in 25 (first at Lesson 43), "two" in 5, "be" in 2, and does/many/any/been in one each. Verified the mechanism in the browser at Lesson 23: sound-list.json introduces be, he, me, she at that lesson and the sheet prints only me and she (build_sheet.py's new_here[-2:] cap), and be/he are then never picked up by the plain review strip because it is alphabetical.
```

**Observed vs expected:** Observed: a child working through every printable sheet is never given the heart-word card for "he", yet meets it in 53 of the stories. Expected: every heart word the curriculum introduces is introduced on at least one words page before the stories that use it. Same root cause as the two findings above (list-order truncation plus an alphabetical fallback).

## warmup-as-a-string-becomes-a-list-of-letters

**MINOR** — contrived

**What:** If a passage's warmup is saved as a single word instead of a list of words, the build succeeds silently and the card prints the word spelled out as comma-separated letters.

**Steps:**

```
1. In a sandbox copy, set passages/lesson-041.json "warmup" to the string "pig" instead of ["pig", ...].
2. `python3 build_index.py` -> "123 passages, 12,730 words, 634 printable pages", exit 0, empty stderr.
3. Served over http on 127.0.0.1 and read the Lesson 41 card in real Chrome.
```

**Observed vs expected:** Observed: the card reads `warm-up: p, i, g`, with no page error and no console error, and every tile unchanged. Expected: the build refuses a warm-up list that is not a list, or the card at least does not present three letters to a parent as the words to warm up on. (Same root cause family as the known lines-as-a-string bug but a different field — a fix to `lines` would not touch this one.)

## duplicate-curriculum-row-prints-a-lesson-twice

**MINOR** — contrived

**What:** A lesson listed twice in sound-list.json renders its card twice, so a story exists twice on the page while the Stories tile still counts it once. Nothing refuses.

**Steps:**

```
1. In a sandbox copy, duplicated the lesson-41 entry inside sound-list.json["lessons"] (inserted a deep copy right after it).
2. `python3 build_index.py` -> exit 0, "123 passages, 12,730 words, 634 printable pages", empty stderr.
3. Served over http and counted cards in real Chrome.
```

**Observed vs expected:** Observed: 129 cards on the page, 124 of them story cards, with Lesson 41's story and its "Print this sheet" button appearing twice inside Unit 2 — while the headline tile still reads Stories 123. Expected: a duplicated record is refused, or at least the count on the page and the count in the tile agree.

## unit-range-label-is-min-max-not-membership

**MINOR** — contrived

**What:** A unit header's "lessons X-Y" label is just min and max of whatever rows carry that unit name, so one mis-filed lesson makes the header claim a range 60 lessons wide that it does not contain.

**Steps:**

```
1. In a sandbox copy, changed lesson 100's "unit" in sound-list.json to "Unit 2: Alphabet Review & Longer Words" (a plausible copy-paste slip in the curriculum record).
2. `python3 build_index.py` -> exit 0, no warning.
3. Served over http and read every .unit header in real Chrome.
```

**Observed vs expected:** Observed: Unit 2's header reads "lessons 35-100" over a section holding 8 cards (35-41 plus a stray 100), and the following header still reads "lessons 42-53", so the ranges now overlap and run backwards. Expected: the label describes the lessons actually in the section, or the build refuses a unit whose lessons are not contiguous.

## orphan-pages-published-but-unlinked

**MINOR** — contrived

**What:** Four fully-written pages ship in this folder — including case-study.html, the one document written for a hiring manager — and nothing anywhere in the repo links to any of them.

**Steps:**

```
1. Serve the tool folder over http on 127.0.0.1 and load /index.html in Chrome (1280x900). 2. In the console run `[...document.querySelectorAll('a')].map(a=>a.getAttribute('href')).filter(h=>h&&!h.startsWith('#')&&!/^sheets\/lesson-\d{3}\.html$/.test(h))` -> returns `[]`. Every clickable link on the front page is either a #unit anchor or one of the 128 lesson sheets. 3. Navigate directly to /case-study.html, /heart-words-preview.html, /sound-list-review.html, /example-lesson-41.html — all four return 200 and render real content (5360 / 6951 / 11029 / 3444 characters of visible text, titles 'Decodable Passage Engine — a correctness system for early reading', 'Heart words — how they will be taught', 'Phonics Sound List — 128 Lessons', 'Decodable Passage — Lesson 41, Short Vowels Review'). 4. `grep -rl case-study.html --include='*.html' .` across the whole repo -> no hits; same for the other three. 5. Each of the four also has zero outbound links (`[...document.querySelectorAll('a')]` fil
```

**Observed vs expected:** Observed: four live, finished HTML pages with no inbound link from index.html or from any other page in the repository, and no link back out. Expected: at minimum the case study — the artifact that explains the engineering behind the tool — reachable from the front page, and every published page reachable from somewhere.

## stale-example-lesson-41-still-published

**MINOR** — contrived

**What:** example-lesson-41.html is a superseded 4-page version of Lesson 41 with a different story, different heart words and a different word-count claim, still live next to the real 5-page sheet.

**Steps:**

```
1. Load /sheets/lesson-041.html — 5 pages, story reads 'Sam has a big pig and a red tub. The pig naps in the hot sun. It gets up and runs to the mud. "Not the mud!" said Sam. ...', heart words `the to was we what you`, grown-up page says 'all 61 words in this story'. 2. Load /example-lesson-41.html — 200 OK, 4 pages, story reads 'Sam has a pig. The pig is big. Sam and the pig sit in the sun. The pig runs to the mud. ...', heart words `the is a and to in`, and it claims 'Every one of the 55 words in this story'. 3. Text-only diff of the two files (tags stripped, whitespace collapsed) gives a SequenceMatcher ratio of 0.182 — they are substantially different documents, not a formatting variant.
```

**Observed vs expected:** Observed: two different Lesson 41 packets are published at guessable URLs — one current, one from an earlier design with a different story text, different sight words and a different self-audit number. The stale one is the file named 'EXAMPLE', i.e. the one most likely to be pasted into a message as 'here is a sample lesson'. Expected: one Lesson 41, or the old one removed.

## lesson-5-sheet-has-none-of-the-five-promised-activities

**MINOR** — reachable

**What:** The front-page note tells you the first five lessons contain a keyword picture, a mouth cue, three-line handwriting practice, a letter hunt and a beginning-sound sort; Lesson 5's printed packet contains none of the five.

**Steps:**

```
1. Load /index.html. The .note reads: 'So those five teach the letter and its sound instead: the letter with a keyword picture, how the mouth makes the sound, handwriting practice on three-line guides, a letter hunt and a beginning-sound sort — and, at Lesson 5, first blending.' 2. Click the 'Lesson 5' card, then print the sheet (Chrome, Letter, background graphics off — I generated the PDF with puppeteer `page.pdf({format:'Letter',printBackground:false})` and rendered each page). 3. Compare against Lesson 1, which does deliver all five: an SVG `aria-label="The letter a drawn as an apple"`, a 'Mouth check' block, a 'Write it' three-line handwriting guide, a 'Letter hunt', and a 'Circle the ones that start with /ă/' sort row. 4. Lesson 5's four pages are headed: 'What this lesson teaches', 'How to run the pages, in order', 'Touch and say', 'Slide and read', 'Touch the sound boxes', 'Your first spelling', 'The changing word', 'Read it and do it'. `grep -c` on sheets/lesson-005.html: 0 oc
```

**Observed vs expected:** Observed: a parent who read the note and clicked Lesson 5 expecting a letter-and-sound page gets a blending packet with sound boxes and word sliding — good work, but not one of the five things the note listed. Expected: the note to say that Lessons 1–4 carry those five activities and Lesson 5 is a blending sheet instead.

## front-page-promises-lesson-5-a-letter-hunt-it-does-not-have

**MINOR** — reachable

**What:** The front-page note tells a parent that all five of Lessons 1-5 teach "the letter with a keyword picture, how the mouth makes the sound, handwriting practice on three-line guides, a letter hunt and a beginning-sound sort". Lesson 5's printed sheet contains none of those five things.

**Steps:**

```
1. Serve the folder over http on 127.0.0.1 (node http module) and open http://127.0.0.1:PORT/index.html in real Chrome (puppeteer-core, headless:'new', viewport 1280x900).
2. Read the note: page.evaluate(() => document.querySelector('.note').textContent) -> the sentence quoted above.
3. Click the 5th card's print link exactly as a parent would: document.querySelectorAll('.card')[4].querySelector('.print a').click() -> new tab at /sheets/lesson-005.html.
4. In that tab: /Letter hunt/i on body.innerText = false; /Circle the ones that start with/i = false; / is for /i = false; /Mouth check/i = false; document.querySelectorAll('.ruled').length = 0.
5. The sheet's own h2 list is: What this lesson teaches / How to run the pages, in order / Touch and say / Slide and read / Touch the sound boxes / Your first spelling / The changing word / Read it and do it.
6. Control: the same five probes on lessons 1-4 all come back true (letter hunt, sort, keyword picture, mouth cue, and .ruled handwriting 
```

**Observed vs expected:** Observed: lesson 5's sheet has no keyword picture, no mouth cue, no three-line handwriting guides, no letter hunt and no beginning-sound sort - only blending (sound strip, slide-and-read, sound boxes, changing word). Expected: either the sheet contains what the front page says it contains, or the note excludes Lesson 5 from that list the way it already excludes it elsewhere ("and, at Lesson 5, first blending"). The index card for Lesson 5 is honest ("Blending - first words"); it is the front-page note that disagrees with the paper.

## owner-badges-wash-out-when-chrome-prints-with-its-default-settings

**MINOR** — reachable

**What:** The "Grown-up sheet - keep this one" / "For the reader" / "If you want more" badges are white text on a solid colour. Chrome's print dialog has "Background graphics" OFF by default and no sheet sets print-color-adjust, so on paper the badge fill disappears and the white text is auto-darkened only to #ABABAB - about 2.3:1 on white, for 11px bold uppercase.

**Steps:**

```
1. Serve the folder over http and open http://127.0.0.1:PORT/sheets/lesson-041.html in real Chrome.
2. On screen, getComputedStyle on the five .owner spans gives: adult = color rgb(247,243,234) on background rgb(74,63,44); the three child badges = rgb(255,255,255) on rgb(55,138,221); extra = rgb(255,255,255) on rgb(107,119,133).
3. page.pdf({format:'Letter', printBackground:true}) then printBackground:false - the same flag as the dialog's "Background graphics" checkbox.
4. Inflate the PDF content streams (zlib) and collect every 'r g b rg' fill operator. With backgrounds: #378ADD and #6B7785 present. Without: both gone, and two new colours appear - #ABABAB and #A3A09A.
5. Diffing the streams pairwise shows the exact substitutions Chrome made on lesson 6: page 1 #4A3F2C -> #FFFFFF (badge fill) and #F7F3EA -> #A3A09A (badge text); pages 2,3,4 #378ADD -> #FFFFFF and #FFFFFF -> #ABABAB; page 5 #6B7785 -> #FFFFFF and #FFFFFF -> #ABABAB.
6. grep confirms 0 of 128 sheets set print-color-adjus
```

**Observed vs expected:** Observed on paper with Chrome's out-of-the-box settings: the badge block vanishes and its label prints as pale grey (#ABABAB, contrast 2.30:1; the adult badge #A3A09A, 2.52:1) instead of a loud coloured tag. Expected: the label that decides who gets which page stays legible on paper - the sheet's own source comment says it is "printed loud so nobody hands the wrong page to a kid". Adding print-color-adjust: exact, or giving .owner a dark text colour and a border instead of relying on a background fill, would make screen and paper agree.

## summary-swallows-the-print-link-name

**COSMETIC** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/decodable-passage-generator/index.html:1 (details.card summary, 123 occurrences)

**What:** Each story card's expand control announces itself as '...Print this sheet', because a link is nested inside the <summary>

**Steps:**

```
Loaded /index.html and read Chrome's accessibility snapshot with interestingOnly:false, then printed the nodes surrounding the Lesson 6 card. Also dumped the first 40 tab stops with page.keyboard.press('Tab').
```

**Observed vs expected:** Observed: the disclosure control's accessible name is the whole string 'Lesson 6 Tap and Pat p /p/ Print this sheet', and the next tab stop is a separate link also named 'Print this sheet'. Expected: the expand control should be named for the lesson only. A screen-reader user hears 'Print this sheet' twice per card, once on a control that only expands a story. Root cause is markup: <summary> holds <div>s and an interactive <a>, which is outside summary's content model, so a validator flags it too. The click behaviour itself is fine - I clicked the nested link with a real mouse and it opened a new tab (2 -> 3) without toggling the details (open stayed false).

## sheet-scrolls-sideways-on-ipad-portrait

**COSMETIC** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/decodable-passage-generator/sheets/lesson-041.html:1 (@media screen .page{width:8.5in}, same in all 128 sheets)

**What:** Printable sheets are 816px wide on screen, so an iPad in portrait gets a horizontal scrollbar

**Steps:**

```
Loaded /sheets/lesson-041.html at four viewports (390x844 dpr2 touch, 768x1024 dpr2 touch = iPad portrait, 1024x768, 1280x900) and compared documentElement.scrollWidth to clientWidth, then walked every element to find the widest one overflowing and the widest one with its own text.
```

**Observed vs expected:** Observed at 768: scrollWidth 816 vs clientWidth 768 - the page scrolls sideways by 48px. The overflowing element is DIV.page (@media screen sets .page{width:8.5in} = 816px), and the widest overflowing TEXT element is null, so nothing is actually cut - the 48px is the sheet's own white padding. At 390 it is worse: scrollWidth still 816 and DIV.flagged ('Lesson 41 Short Vowels Review (all)') extends to x=768, well off-screen. Expected: no horizontal scroll on the device a teacher actually holds. Fits at 1024 and 1280. Note the index's 'built for a computer' warning is hidden above 640px, so an iPad-portrait user is never told anything.

## no-description-no-favicon-no-preview

**COSMETIC** — reachable  
**Where:** /Users/sahajkashyap/Documents/GitHub/edtech-portfolio/decodable-passage-generator/index.html:1 (head)

**What:** The page has no meta description, no favicon and no og: tags, so a shared link previews as nothing

**Steps:**

```
Loaded /index.html and read document.title, meta[name=description].content, every meta[property^=og:], and link[rel*=icon] count.
```

**Observed vs expected:** Observed: description null, og [] (zero tags), icon links 0. Only document.title is set ('Decodable Passages - all 128 lessons'). Expected: a portfolio page a hiring manager is sent should carry a one-line description and an icon. As shipped, the browser tab shows a blank globe and pasting the GitHub Pages URL into LinkedIn, Slack or an email produces a preview card with no summary text.

## open-story-inflates-row-neighbours

**COSMETIC** — reachable

**What:** Opening one story stretches the two other cards in its CSS grid row to the same height, turning them into tall, mostly empty boxes.

**Steps:**

```
Executed in headless Chrome over http://127.0.0.1:<port>/index.html at 1280x900 (3-column grid).
1. Load index.html.
2. Measure the first row of #u3's .grid: Lesson 42, 43, 44 all height 130px, all top 3180.
3. Real summary click on Lesson 42 only.
4. Re-measure: Lesson 42 height 391, Lesson 43 height 391, Lesson 44 height 391 — all still top 3180. Lesson 45 (next row) unchanged at 130 and pushed from top 3318 to 3579.
5. Screenshot saved to /private/tmp/claude-501/-Users-sahajkashyap/8b30f2b0-b294-4070-9d08-21712382187a/scratchpad/st-lens/row-stretch.png confirms Lessons 43 and 44 render as ~260px of blank white inside their card borders.
Cause: .grid at index.html:45 is `display:grid` with the default `align-items: normal` (stretch), so every item in a row takes the row height.
```

**Observed vs expected:** Observed: opening one card visually expands three cards; the two neighbours look as if they were opened too but have nothing in them. Expected: only the card that was clicked changes height (`align-items:start` on .grid). Happens every time any of the 123 stories is opened.

## empty-and-null-fields-render-as-dangling-labels

**COSMETIC** — contrived  
**Where:** build_index.py:186,192,198

**What:** An empty warm-up array renders a bare "warm-up:" label with nothing after it, and a null title renders the literal word "None" as the story's title - both accepted silently.

**Steps:**

```
Scratch copy, two runs. (1) set lesson-041.json `"warmup": []`, rebuilt, served over http, read the card's .warm textContent in headless Chrome. (2) set `"title": null`, rebuilt, read the card's .t textContent.
```

**Observed vs expected:** Observed: (1) .warm reads exactly "warm-up:" with no words; (2) .t reads "None" - Python's None interpolated straight into the f-string, so the card is titled "None" while its story and 5-page packet are intact. Expected: omit the warm-up line entirely when there are no words, and refuse a record with no title rather than printing "None" to a parent. Both builds exited 0 and reported "123 passages" with no warning.

## card-opened-at-the-fold-shows-nothing

**COSMETIC** — reachable

**What:** Clicking a lesson card that is sitting on the bottom edge of the window opens its story entirely below the fold and the page does not scroll to follow it, so the only feedback a teacher gets that anything happened is the card's 1px border changing from beige to blue.

**Steps:**

```
1. Same local server, Chrome at 1280x900, http://127.0.0.1:PORT/index.html
2. Scroll so one card's bottom is 12px above the fold: const d=[...document.querySelectorAll('details.card')][45]; window.scrollTo(0, d.offsetTop_abs + d.height - innerHeight + 12) — this landed on "Lesson 51 — A Song for the King", card rect top 759, bottom 888, viewport 900.
3. d.querySelector('summary').click()
4. Measure the .story rect and scrollY.
Screenshots bottom-before.png / bottom-after.png in the same scratchpad folder.
```

**Observed vs expected:** Observed: d.open === true, scrollY unchanged at 2834, story rect top 886 bottom 1147 in a 900px viewport — 13.7px of a 261px story is on screen, i.e. a blank strip. The card's border went rgb(212,197,185) -> rgb(55,138,221) and the document grew from 8780 to 9092. Expected: opening a story should put at least the first line of it where the reader can see it (a scrollIntoView on open, or scroll-margin), rather than leaving the page looking untouched — the natural next move is to click again, which closes it.

## ufli-acronym-never-expanded

**COSMETIC** — reachable

**What:** The only sentence that says where the lesson numbering comes from is "Grouped by UFLI's real units" — UFLI appears exactly once on the page and is never expanded.

**Steps:**

```
1. Same server + Chrome setup, 1280x900, http://127.0.0.1:<port>/index.html.
2. Cloned document.body, removed every .grid (the lesson cards), read .innerText to get just the framing prose a stranger reads.
3. The "Every lesson" section blurb reads: "Grouped by UFLI's real units. Click a card to preview its story right here. Print this sheet opens that lesson's printable packet in a new tab..."
4. Counted /UFLI/ in document.body.innerText over the whole page: exactly 1. No expansion, no gloss, no link.
```

**Observed vs expected:** Observed: the page's single statement of provenance for a 128-lesson scope and sequence rests on a bare four-letter acronym, unexpanded. A parent who arrives from the tracker may know it; a hiring manager opening the portfolio cold does not. Expected: one clause of expansion, e.g. "the UFLI Foundations scope and sequence".

## index-page-prints-buttons-as-grey-ghosts

**COSMETIC** — reachable

**What:** Printing the front page (no @media print rule exists) turns all 128 "Print this sheet" buttons into near-white text with no button shape — darkest ink measured rgb(171,171,171), about 2.3:1 against paper.

**Steps:**

```
1. Same server + Chrome, viewport 1280x900, loaded /index.html.
2. printed to PDF with Chrome's real defaults — page.pdf({format:'Letter'}), i.e. "Background graphics" OFF, which is what Chrome's print dialogue ships with. Result: 9 pages of Letter paper.
3. Rendered page 2 to PNG (sips) and read its pixels back through a canvas in Chrome: in the rows containing the "Print this sheet" labels (y 149-155 of 792), the darkest pixel is luminance 171; the colour histogram over that strip is 255,255,255 (1195px) then 171,171,171 (58px), 178,178,178, 202,202,202 — no blue, no button rectangle.
4. Re-printed the same page with printBackground:true for comparison: darkest pixel 123 and 612 non-white pixels per row, i.e. the blue button is present only when backgrounds are on.
5. Confirmed the cause in-browser: emulateMediaType('print') then getComputedStyle on .card .print a -> background rgb(55,138,221), color rgb(255,255,255); and the stylesheet contains exactly one @media rule, "(max-width: 
```

**Observed vs expected:** Observed: on paper the front page's 128 call-to-action buttons read as faint grey ghosts with no button shape (Chrome darkens the white text to #ABABAB rather than dropping it, so it is technically legible at ~2.3:1). Expected: on a page whose whole subject is printing, the buttons either print as legible dark text or are suppressed in print. Note the 128 printable sheets themselves print perfectly — this is only the index.

## jump-to-last-unit-lands-under-previous-banner

**COSMETIC** — reachable

**What:** Clicking the last unit button, "Unit 14: Additional Affixes", scrolls to the bottom of the page, where the sticky banner pinned at the very top of the screen reads "Unit 13: Low Frequency Spelling — lessons 111-118".

**Steps:**

```
Local server + real Chrome at 1280x900. For each of the 14 buttons in .jump I reloaded index.html, clicked the button, waited 400ms, then recorded which .uh heading was within 70px of the viewport top. Buttons 1-13 all land with their own heading at top (measured top 57-58px, atTop = that unit). Button 14 lands at scrollY 7880 = maxScroll 7880: Unit 14's heading sits 109px down and the heading stuck at top:0 is "Unit 13: Low Frequency Spelling". Screenshot captured. Repeated at 1440x900 (same), 1512x982 (Unit 14 heading 191px down, Unit 13 still pinned) and 1280x1400 (Unit 14 heading 609px down, "Unit 12: Suffix Spelling Changes" pinned at top).
```

**Observed vs expected:** Observed: the banner at the top of the screen names a different unit from the button just pressed, and the taller the window the further off it is. Expected: the unit you clicked is the one named at the top of the screen. It is only cosmetic — Unit 14's own heading is still visible below it — and it is the last-item boundary: the page cannot scroll any further.

## angle-brackets-in-story-text-vanish-but-still-count

**COSMETIC** — contrived

**What:** Story text is dropped into the HTML unescaped, so anything between angle brackets disappears from the preview while still being counted in the "Words written" tile.

**Steps:**

```
1. In a sandbox copy, set lesson 41's lines to include "Tom said <sniff> and ran." alongside lines using & and >.
2. `python3 build_index.py` -> exit 0, tile recomputed to 12,687.
3. Served over http, opened the card in real Chrome and read the .story spans.
```

**Observed vs expected:** Observed: the card renders "Tom said and ran." — the word is gone from the story with no error — yet the Words-written arithmetic counted it. Ampersands and > survived intact. Expected: text saved in the record renders as saved, or the word count matches what is shown.

## mixed-straight-and-curly-quotes-on-printed-sheets

**COSMETIC** — reachable

**What:** 33 grown-up sheets print typewriter quotes and typographic quotes side by side in the same paragraph block; 96 of the 128 sheets contain straight quotes somewhere.

**Steps:**

```
1. For every lesson 1–128, load /sheets/lesson-NNN.html in Chrome and read each `.page` element's innerText, counting `"` versus `“”`. 2. 96 sheets contain at least one straight quote; on 33 of them a single printed page carries both styles. 3. Concrete, visible on paper: print /sheets/lesson-041.html (Letter, background graphics off) and read page 1. Question 2's answer reads: `If they just say "the tub," ask "and what happened in the tub?"` — straight quotes — three lines below `Don’t say “no” — point at the word: “Try that one again — say each sound.”` with curly quotes, on the same page. 4. Lesson 7 page 1 is the same defect: `The first line says "I am Tam."` sits on a page with five curly-quoted phrases.
```

**Observed vs expected:** Observed: two quotation styles mixed within one printed page of the parent-facing instructions on 33 lessons. Expected: one style throughout, the way the rest of the page already does it. It is the sort of thing a hiring manager notices in a PDF and reads as an unfinished template.

