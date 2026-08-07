# Where we are

A running note of what's done and what's next, so any new chat can pick up
where we left off. Newest updates go at the top.

---

## 2026-08-07

**Done — eleven bugs fixed in Word by Word, and the reason they kept appearing.**

### What we learned, which matters more than the fixes

Ten review passes had each found new bugs and never converged. That was NOT an
agent-skill problem, and no amount of "be more thorough" was going to fix it:

> **"Find the bugs" has no completion criterion.** A reviewer — person or agent
> — stops when it runs out of ideas, and *where* it runs out is different every
> pass. Reading 2,300 lines is SAMPLING, not covering. Nothing remembers what
> the last pass concluded. Ten passes with no test suite is one pass, ten times,
> on shuffled ground.

Two things fixed it, and both are now standing rules:

1. **A test file** (`running-record-tool/tests/`) — 182 checks driving real
   Chrome with real clicks and keypresses. Every check exists because something
   was genuinely broken once. A bug fixed in August cannot come back in November.
2. **A coverage number in the same file** (`npm run coverage`) — Chrome records
   which lines actually executed, and prints every line that never ran. **100%
   of 1,375 executable lines.** "What percentage is really being checked" stops
   being a guess and becomes a printed list of line numbers. Each one either
   gets a test or gets deleted as unreachable.

Driving coverage from 94.2% to 100% is what found the delete-resurrect bug that
ten review passes had missed.

Bounded instructions beat thorough ones. The agent told "prove these four
surfaces agree across every lesson and report the case count" ran 620 cases and
came back with three real defects. The agents told "find bugs" kept wandering.

### The bugs

**Records could be silently corrupted.** The popover survived a lesson change
and marked a word on the new passage. Marking keys fired from the dropdown and
from buttons. Moving to the next lesson relabelled the record just saved with
the new lesson against the old lesson's words — and re-opening it was then
refused outright. Deleting the open record wrote it straight back. (The last two
were introduced by the `flushSave` fix earlier the same day, and caught by the
tests and by an adversarial agent respectively.)

**The four surfaces disagreed.** Print banded the unrounded accuracy while the
screen banded the rounded one, so the same child came out Independent on screen
and Instructional on the paper the specialist receives. The stats tile showed a
rate for word lists beside the banner saying it would not. The CSV cue analysis
ignored the stop mark. Insertions past the stop mark were counted; rate could go
negative; error rate could read "1:0".

**The clock lied.** Reading time went stale in storage until the next mark. Undo
did not restore the reading time after "Clear all marks", whose own message
promises it does. Taking back an accidental stop mark left the clock dead and
silent, inflating the final rate.

**Findability.** The picker showed nine identical "word list" entries and never
named the skill; it now reads `Lesson 6 · p /p/`, grouped into word lists and
passages. Navigation moved above the passage for iPad portrait. A stranger lands
on Lesson 15, the first passage, not Lesson 41. `DESIGN.md` links pointed at a
file browsers download — and `check_links.py` passed them, because it checked
only for a 200 and a word count. Both fixed.

### New: `verify <tool>`

`.claude/workflows/verify-everything.js` — say **"verify running record tool"**.
Four phases: **Hunt** (four agents, four different lenses) → **Refute** (three
skeptics per finding, majority rules) → **Tests** (survivors become test code) →
**Verdict**. It loops until two consecutive rounds find nothing new, then says
whether it converged or hit the ceiling still finding things. Runs on Fable 5.

### Next

- Let `verify running-record-tool` run to convergence.
- Same treatment for the other ten tools in this repo.
- Retrofit tests + coverage onto the tools that don't have them.

---

## 2026-08-05

**Done — the seventh pass. Child-audit findings 117 → 33, zero HIGH anywhere.**

Started as "fix Lessons 40 and 41" and turned into a full pass, because three of
the four findings on those lessons turned out to be the checker being wrong
rather than the content.

**The examiner never saw the warning.** Every passage carried a `scoring_note`
saying a child who reads "don't" for "do not" must NOT be marked wrong.
`sync_index.py` only carried `nwf_note` to the screen, so on all 27 passages the
teacher panel was empty. The note is now built per lesson from the forms that
lesson actually contains, and the register check VERIFIES it instead of
asserting it is absent — a passage whose note fails to name a form it contains
now fails HIGH. That stronger check immediately found three word lists whose
sentences had the same problem and no note at all.

**Five names retired.** `pam, meg, deb, ned, raj` each reverse into a word the
child knows (`map, gem, bed, den, jar`). b/d reversal is THE five-year-old
error, and a name that reverses into a real word makes the miscue unscoreable —
the examiner cannot tell a reversal from a meaning error, and those mean
opposite things. Replaced with `Min, Lin, Kip, Jin`, gender preserved name for
name. Non-Anglo names went from 2 of 27 to 5 of 26.

**Two dead sign-offs found and removed.** Both entries in `ACCEPTED` matched no
finding: one was keyed on the rule's REASON where the code keys on its NAME, so
it could never have matched on any run since it was written. A sign-off that
silences nothing still reads as "a person reviewed this". `dead_signoffs()` now
fails `--strict`, and `test_gates.py` proves it can fire.

**Passages rewritten:** 31 (the child does the fixing now, instead of being told
no and handed a lesser job while the adult uses the tool), 24, 35, 39, plus verb
and noun repairs at 15, 16, 21, 22, 23, 26, 30, 37. Gone: `pop`/`set` meaning
PUT, transitive `fit`, `pit` for a hole, intransitive `tag`, composting, washing
a rug by hand, `cap` meaning both a hat and a lid.

**One fix-induced regression caught by the audit, then fixed:** rewriting Lesson
31 removed the only girl in the set with a named feeling. Lesson 39 now has one,
resolved on the page.

**The same bug had a third instance.** `supply_note` — the only thing that
explains why Lesson 7 ships no `f` word — never reached the screen either. An
unexplained gap in an assessment reads as a broken tool, and the teacher's next
move is to distrust the score rather than the curriculum that caused it. All
three note fields now render.

**The word-list claim is said once, not nine times.** `instrument_claim` is the
same 261 characters on all nine word lists, because it describes the
*instrument*, not the lesson. Reprinting it under every lesson is what pushed
every word list over the note-length bar — and prose an examiner has already
read eight times is prose they stop reading. It now renders once as standing
copy (`WORDLIST_CLAIM`), generated by `sync_index.py`, which **refuses to write
if the nine files ever stop agreeing on it** rather than let one file's claim
silently speak for all nine.

**Three word-list sentences rewritten** so they no longer contain contractible
forms at all — which removes the need for a second note rather than shortening
one. Per-lesson notes went 869 → 132-287 characters.

**Still open — 25 findings, all REVIEW, all recorded**

1. **22 `context`** — what the passage assumes the child has at home (a pet, a
   farm, food that is always there). These are `cat, dog, pig, hen, bun, jam,
   nut` — very close to the entire set of decodable nouns below Lesson 40. This
   is coupled to decodability, not to writing. Left as written: it is a design
   question about the instrument, and narrowing the rule to make the number
   fall would be answering it by deleting it.
2. **1 `notes`** — Lesson 7 carries two notes (287 chars): why there is no
   nonsense-word subtest, and why there is no `f` word. Two different facts, one
   sentence each. That is the floor, not padding.
3. **2 `topics` — YOUR CALL, not mine.** Lesson 15 uses nuts (nut allergy is the
   commonest food protocol in a primary school); Lesson 24 uses a rat. Both are
   forced by the target sound: at Lesson 24 the r-words left after Form A are
   `rat, rid, rip, rot`, and three must carry the target. I left these visible
   rather than signing them off, because they are community decisions.

**Signed off with its arithmetic:** the ax at Lesson 31. Lesson 31 is named for
x /ks/, the entire legal vocabulary holds four x words (`ax, mix, ox, wax`),
Form A spends `box, fix, fox, six`, and three must carry the target. Using `ox`
instead raises a HIGH — a draft animal is further outside a five-year-old's
world than an ax. So the passage answers the question the rule asks: Mom has the
ax, Jen has the wax, and the job the story is about is the child's.

**Next up:** decide the two `topics` questions above.

---

## 2026-08-03 to 08-04

**Done — the running record tool** (`running-record-tool/`, named **Word by
Word** on 6 Aug 2026; the folder path stays as it is because the site is live)

This is the third piece of the set, and it is where a child's reading is
actually measured. It has two halves that answer different questions:

- **27 passages** (`instrument: "passage"`) — the child reads a whole little
  story aloud and you mark what they say. This is the narrative half: does the
  skill hold up when there is meaning to follow?
- **9 word lists** (`instrument: "wordlist"`) — real words *and* nonsense words
  for the lesson's target sound. This is the phonics half. Nonsense words are
  the point: a child can recognise "cat" from memory, but "zam" can only be read
  by producing the sounds. Each list carries an `instrument_claim` saying
  exactly what its score does and does not mean.

Together they cover **Lessons 6–41**, Form B — deliberately different words from
Form A so a child can be assessed twice without re-reading what they practised.

**The marking screen** (`running-record-tool/index.html`)

- Six mark types, one colour each. Warm colours count against the child
  (substitution, omission, told); cool colours do not (self-correction,
  repetition, appeal). You only need the first two to start.
- **One saved record per child**, not one per lesson — nothing is overwritten.
- Print and export, so a record can reach the learning specialist.

**Then: six audit passes** (2026-08-04)

The tool was built in a day; making it trustworthy took six independent passes.
What that produced:

- `formb/verify_all.py` — the one command that checks everything. It does not
  just run the gates, it **falsifies** each one first: every gate must prove it
  can still refuse bad input, so a checker that silently stopped checking gets
  caught. Three real bugs were found *in the checkers themselves* this way.
- Six content gates, plus an age-of-acquisition gate (does a six-year-old know
  this word?) across 1,985 words.
- `audit_curriculum.py` and `audit_child.py` — one asks whether the content
  teaches what it claims, the other reads every page as the child.
- `DEFECT-CLASS-CATALOGUE.md` — every *kind* of defect found across all six
  passes, grouped by dimension, most marked mechanically checkable and now
  implemented.
- `ASSESSMENT-QA-SKILL.md` — the five-role review team, including the
  **INTEGRATOR**, whose only job is the seams: rule collisions, fix-induced
  regressions, severity drift, and honest sign-off. Four specialists produce
  four green lights and a broken whole without it.

**Current state: VERIFY PASSED** — zero HIGH, zero MEDIUM, zero BLOCK.

**Open — recorded limits, not regressions**

These are signed off with a written reason rather than fixed. A number with a
reason beside it is finished work; an unexplained failure stays loud.

1. **117 REVIEW findings** on the child audit, accepted as a baseline.
2. **37 LOW curriculum findings**, each a recorded limit.
3. **Three named dead ends**, each with its measurement: the Lesson 7 `f`-word
   shortage, the hand-corrected word lists, and the `sit-` family appearing in
   14 of 27 passages. Chasing that last one caused three regressions in a row,
   because every substitution collided with another gate.

**Open — child-facing, worth a decision**

4. **Lesson 40 register.** Decodability forbids apostrophes, so the passage says
   "do not run" and "are not up yet". A fluent child reads that aloud as "don't"
   and "aren't" — and a running record scores each one a substitution. The
   instrument marks down the child who is reading for *meaning*. There is a
   `scoring_note` in the file saying not to score it; the question is whether it
   reaches the examiner's eye at the moment of marking.
5. **Lesson 40 `den`.** It is a fox's home in one lesson and a room in the house
   in another. One instrument should not teach two senses of a word.
6. **Lesson 41 assumes the child has a pet.**
7. **222 characters of adult prose** in a note field on Lessons 40 and 41 —
   longer than everything the child is asked to read.

**How to check it yourself**

    cd running-record-tool/formb && python3 verify_all.py

You should see `VERIFY PASSED` at the bottom. If a gate breaks you will see
which one, and the run will stop rather than pass quietly.

---

## 2026-07-28 to 08-01

**Done — the decodable passages became a printable set, and got wired together**

- **Heart words earn their place.** Heart words (irregular words like "said")
  are now mapped with sound boxes and a heart over the irregular part, and each
  lesson's own heart words feed the sound list. This answered the open question
  from 2026-07-27: the early stories now have enough grammar to say something,
  so they no longer repeat the character's name in every sentence.
- **The 17 curriculum typos are fixed at source**, in
  `phonics-assessment-tool/index.html` — so they can no longer be re-imported.
  (Open question 2 from 2026-07-27, closed.)
- **All 123 stories read end to end** by a human pass, and repaired for the
  things only reading catches. Story length now scales with the language a
  lesson actually has.
- **Letter-and-sound sheets for Lessons 1–5**, with touch-and-slide sound dots
  under the early words. The dots stop after Lesson 5, on purpose, and the
  reason is written down.
- **The packet's shape is settled**: story whole on one page, words vertical,
  read → draw → questions only if wanted. The grown-up's instructions are folded
  off the child's page.
- **Reading practice is connected to the phonics tracker**, so a flagged skill
  leads to a story, not just a worksheet.
- **A link checker that checks content, not just existence** (`check_links.py`),
  now a standing rule in CLAUDE.md. It checks three things per link: the target
  exists, it is not blank, and it is the *right* page.

---

## 2026-07-27

**Done — the decodable passage engine**

- **The sound list.** `decodable-passage-generator/sound-list.json` records, for
  each of the 128 lessons, exactly which letters, letter teams and heart words a
  child has by then. Generated from the assessment tool's own curriculum so the
  names can never drift. Verified against UFLI's published scope and sequence:
  **the lesson order is correct**, and 17 entries had typos, now corrected in the
  open in `CURRICULUM_CORRECTIONS`.
- **The auditor.** `audit_passage.py` checks a passage word by word and did not
  write it. 81 regression tests, each one a word that beat an earlier version.
  Adversarial agents cut wrongly-passing words at Lesson 41 from 18% of the
  dictionary to 0.07%.
- **The word bank.** 857 hand-picked K-2 words plus generated inflections, each
  placed at the earliest lesson it is readable.
- **123 decodable stories**, one per lesson that can have one, each a printable
  4-page packet. 123/123 pass the gate; 123/123 measured to fit on paper.
- **A blocked-word list**, 132 words, no exceptions, enforced over the story,
  title, warm-up words, questions and the grown-up answer notes.
- Two skills: `phonics-worksheet` and `decodable-passage`.
- Read it all at `decodable-passage-generator/index.html`.

**Open questions for me (the teacher)**

1. **`and` is not available until Lesson 35**, and subject pronouns (`he`, `she`)
   not until 66. For the first 34 lessons a story cannot join two nouns or two
   actions, and every sentence repeats the character's name. My tool's heart
   words are 3 per unit (24 total); real programs teach many more, earlier. If I
   want richer early stories, this is the thing to change.
2. **The same 17 typos are still in `phonics-assessment-tool/index.html`** and
   will be re-imported unless fixed there too.
3. **Lesson 7 has no `f` word in its story.** "fat" was the only decodable one
   and we chose not to use it. Recorded on the index; the worksheet covers `f`.
4. Review the 123 stories themselves.

**Next up**

- Read through the stories.
- Decide on the heart-word question above.

---

## 2026-07-23

**Done**
- Built the **phonics worksheet generator** on the existing UFLI Foundations
  Tracker (`phonics-assessment-tool/index.html`): a "Generate practice
  worksheets" button + skill picker that produces a printable practice sheet
  for the exact skill the assessment flagged.
- **All 128 skills generate** across six sheet types (sound patterns, magic-e,
  letter-sounds, word endings/affixes, reviews, syllables). Browser-verified —
  every worksheet opens with no errors.
- Saved a reusable `phonics-worksheet` skill so future chats can build more.
- Merged everything to `main` and backed it up to GitHub.

**Next up**
- Try the worksheets with a real reader and see what to adjust; optional polish.

**Notes / decisions**
- The **"CORE Phonics Survey" tool is a SEPARATE project** and is NOT part of
  this repo. Its notes were removed from here on purpose so the two don't get
  mixed up. (That earlier content is still recoverable from git history if the
  other project ever needs it.)
