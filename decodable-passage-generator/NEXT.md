# Where this is, and what is left

Last written 2026-07-28. Read this first in any new session.

## The thing that matters most

There are now **two gates**, and the second one is the day's real discovery.

1. **`audit_passage.py`** — can a child at this lesson *sound this out*?
2. **`word_age.py`** — does a six-year-old *know what it means*?

Only the first existed for most of this project, and that gap is how `cod` got
into a Lesson 18 story. Perfectly decodable, and learned at **age 11.5**. For
scale: dog 2.8, cat 3.7, pig 3.8. The teacher caught it by reading two stories;
neither the gate nor I would have.

`word_age.py` passes a word if it is learned by **age 6.0**, or is on the
**Dale-Chall familiar list** *and* learned by about **7.6**, or a person has
approved it in `APPROVED` with a stated reason, or it is a character's name.

Two signals rather than one, because either alone is wrong. A raw age-6 cutoff
flagged 108 of 123 lessons — it rejects `then` (6.7), `just` (7.0), `as` (6.1),
words a six-year-old says hourly, because the data is adults recalling when they
learned a word. Dale-Chall alone under-rejects: `cod` is on it. Together they
separate cleanly. Ratings take the **lowest** value across a word and its base
forms, because `taps` is rated 8.9 (the raters pictured faucets) while `tap` is
5.8.

`aoa-lookup.csv` holds ratings for the 1,269 words we use, from Kuperman et al.
(2012). Only our subset is stored; the 51,715-word source has no clean
redistribution licence.

## The two decisions the teacher made (29 July) — settled, do not re-ask

**1. Lesson 72 keeps its `-olt` pattern.** It teaches `-ild -old -ind -olt
-ost`, and every `-olt` word failed the age gate (colt 9.0, bolt 7.3, jolt
9.4), so the lesson had quietly lost one of its five patterns. The teacher
approved **`colt` by name** — it is concrete and it appears in the picture, the
same stated reason `hen`, `log` and `pond` are approved. `bolt` and `jolt` are
still rejected, and the gate proved it by catching both when I tried to write
them into the story. The passage is a colt again, not a pup.

**2. Lesson 80 has real `er` words.** It teaches `er` and only `her` survived
the gate. The gap was in `core_vocabulary.py`, not in the curriculum — *sister,
under, after, never, letter, winter, corner* pass both gates and were simply
absent from the list. 33 two-syllable `er` words added; the ones that are never
pluralised are marked as function words so the bank stops offering `afters` and
`clevers`. The warm-up strip is six `er` words now instead of one.

Also changed: `build_word_bank.py` filters by the age gate, so a word like
`fern` never reaches a writer at all rather than being suggested and refused.

## Still outstanding

Everything below is accurate as of the end of 28 July. All 123 stories pass
both gates and all 123 sheets fit.

1. **The late stories are still short.** L91–128 averages 113 words against a
   real reader's ~172. Getting there needs another step down in story type
   size, and 18px is already the floor I would want for a seven-year-old.
   **This is a teacher's call, not mine.**
2. **9 questions have no answer in the story** — L9, 42, 48, 71, 84, 90, 98,
   115, 118. The parent's answer key gives it away: it supplies an inference the
   story never states.
3. **The third question is the same question 81 times of 123.** 67 end "Tell me
   why", 48 open "Do you think". Less urgent now that page is optional, but it
   is a template rather than a question.
4. **Nobody has read the grown stories end to end.** 83 were lengthened today
   and the readers checked them, but the teacher has not. That is the highest
   value thing to do next — every serious problem in this project was found that
   way, not by a checker.

## What was settled today, so nobody re-litigates it

- **Sheet order**: grown-up sheet → the story → **the drawing** → questions,
  which are explicitly optional. The drawing *is* the comprehension check at
  K–2. Published decodables (224 UFLI passages, CKLA readers) carry **zero**
  comprehension questions and a draw-the-story box instead. Ours stay because a
  parent at home has no teacher to ask.
- **Heart words are mapped, not memorised**: sound boxes with a heart on the
  irregular part only, and the heart *moves* as the child learns — `the` carries
  two hearts until Lesson 46 teaches `th`, then one. 72 words, all Dolch.
- **`she` arrives at Lesson 23**, with `he`. It was 45, which meant 22 lessons
  where only a boy could carry a pronoun.
- **17 curriculum typos fixed at source** in `phonics-assessment-tool/`, plus 5
  short-vowel symbols that were IPA for the wrong vowels.
- **Story length scales with available vocabulary** at the early end: at Lesson
  6 a child can sound out eight words, so demanding six lines forced padding.

## The lesson I would most want carried forward

When the sound list runs out of decodable nouns, **add a person, not a rarer
word.** Published decodables use 70 distinct character names by Lesson 45; we
had 26. They never mine the dictionary for obscure three-letter nouns. Reaching
for `cod` and `bog` was the wrong instinct, and it is the root cause of the
single biggest quality problem found in this project.

## Commands

```
python3 build_sound_list.py      # rulebook from the assessment tool's curriculum
python3 build_word_bank.py       # which words are readable by which lesson
python3 validate_passage.py --all
python3 audit_passage.py --selftest      # 87 regression tests
python3 build_sheet.py --all
python3 check_all.py             # every sheet measured against the page
python3 build_index.py           # the browsable page of all 123
python3 build_heart_preview.py   # the heart-word review page
```
