# What happened today, honestly

A record of the 28 July session, written so tomorrow starts informed rather
than from scratch.

## The day in one line

Three tasks were asked for. All three landed. But the most valuable thing that
happened was the teacher reading two stories and finding a problem class the
machinery could not see — and everything after that was a consequence.

---

## What went well

**Building the gate before doing the work.** `word_age.py` took 45 minutes. It
then turned "which of 123 stories has a vocabulary problem, and exactly which
words" from a reading job into a two-second query. The vocabulary sweep that
followed ran at eight lessons a minute. Nearly every time this project has gone
fast, it is because something mechanical was built first.

**Calibrating the gate instead of trusting it.** The first cut of the age gate
flagged **108 of 123 lessons** — it was rejecting `then`, `just`, `as`. Words a
six-year-old says hourly. Two corrections fixed it: add a second signal
(Dale-Chall familiarity, which asks a different question), and take the *lowest*
rating across a word's forms, because `taps` is rated 8.9 only because the
raters pictured faucets. 108 → 67 → 64, and those 64 were real.

**Going and reading real decodable readers.** The teacher's push — *"you've
never been in a classroom with a child"* — was the single most useful correction
of the day. Reading 224 UFLI passages and CKLA's readers settled arguments that
would otherwise have been my taste against theirs: our stories were 3× too
short, we used a stiff construction 15× too often, and 37 of the words I had
flagged appear nowhere in real material.

**Agents attacking work they did not write.** Every significant finding today
came from that pattern, not from review-by-the-author.

---

## What went wrong

**I was checking the wrong thing for weeks.** Every gate asked *can this be
sounded out?* Nothing asked *does a six-year-old know it?* That let `cod` —
learned at **age 11.5** — into a Lesson 18 story. The teacher found it by
reading two stories at random. Both had problems. That hit rate says the whole
set needed the check, and it did: 81 words across 64 lessons.

**I solved the noun shortage exactly backwards.** Early lessons run out of
decodable nouns. I reached into the dictionary for rarer three-letter words —
`cod`, `bog`, `yam`, `chum`. Real decodables hit the identical constraint and
solve it by **adding characters**: 70 distinct names by Lesson 45 against our
26. Never a rarer word. This one wrong instinct produced the largest quality
problem in the project.

**I let a stale page mislead the teacher.** They complained about a Lesson 23
story that had already been rewritten — the index simply had not been rebuilt.
They spent real attention on a problem that no longer existed. Rebuild
generated artefacts before showing anyone anything.

**I mis-mapped seven heart words**, four of them the same mistake repeated: a
silent letter given its own sound box (`walk` as `w a l k`, `two` as `t w o`).
Caught only because it was checked against UFLI's published card deck.

**My time estimates were consistently wrong**, in both directions — I guessed
5–6 hours for work that took about 90 minutes, then under-estimated the
lengthening. Padding for "a bug will appear" was right in principle; the
sizing was guesswork.

---

## What I would tell tomorrow

1. **Read the output, not just the checks.** Every genuinely damaging problem
   this project has had passed every automated gate: `gun` in the word bank,
   "No" at Lesson 12, `cod` at Lesson 18, `wet kits`. The gates catch what they
   were told to catch. A person reading two stories at random caught three
   things in a day.

2. **When a constraint bites, add a person, not a rarer word.**

3. **The physical page is a real constraint and it bites late.** Story type size
   caps line count independently of any rule — at the 46–65 band, 10 story lines
   fit and 11 do not. A title long enough to wrap costs 33px on its own.

4. **Two of today's findings are curriculum gaps, not story problems**, and both
   need the teacher: Lesson 72 has lost its `-olt` pattern entirely, and Lesson
   80 teaches `er` with only `her` surviving. See `NEXT.md`.

---

## Numbers, for the record

| | Start of day | End |
|---|---|---|
| Words a six-year-old would not know | 81 across 64 lessons | **0** |
| `"Dad did nap"` construction | 64 uses | **1** |
| Total words across 123 stories | 7,011 | **10,607** |
| Words per story, L91–128 | 54 | **113** (real readers ~172) |
| Heart words | 24, unmapped | **72, mapped, hearts move with the lesson** |
| Curriculum typos in the assessment tool | 17 | **0** |
| Gates a word must pass | 1 | **2** |

Still true at the end: 123/123 through both gates, 123/123 sheets fit on paper,
87 auditor regression tests, no blocked word anywhere including parent notes.
