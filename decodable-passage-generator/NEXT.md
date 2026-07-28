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

## TWO DECISIONS WAITING ON THE TEACHER

**1. Lesson 72 has lost one of its five patterns.** It teaches `-ild -old -ind
-olt -ost`. Every `-olt` word fails the age gate: colt 9.0, bolt 7.3, jolt 9.4.
The story works but no longer demonstrates `-olt`.
*Recommendation: approve `colt` in `word_age.APPROVED`.* It is concrete and it
appears in the picture, which is exactly the stated reason `hen`, `log` and
`pond` are already approved.

**2. Lesson 80 teaches `er` and the only `er` word in the bank is `her`.**
After the gate rejects `fern` (8.7) and `herd` (7.7) there is nothing left.
Words a six-year-old certainly knows — *sister, under, after, never, letter,
winter, corner* — pass **both** gates but are absent from `core_vocabulary.py`
at any lesson, so they cannot be warm-up words.
*Recommendation: add common multi-syllable words to CORE.* This is a gap in my
word list, not a real constraint, and it is probably starving other later
lessons too.

## Still outstanding

A workflow was **running when this was written** — lengthening lessons 46–128
and repairing 15 early stories. Check `validate_passage.py --all` before
assuming anything below is still true.

1. **Stories must grow.** Ours sat flat at ~57 words from Lesson 6 to 128; real
   decodable readers go 50 → 172. `GROWTH_BANDS` in `validate_passage.py` now
   demands 7 lines by L50, 9 by L75, 11 by L110. `TYPE_BANDS` in
   `build_sheet.py` shrinks the story type from 24px to 18px across the same
   span to make the room — which is what real readers do anyway.
2. **~23 stories were flagged as not making sense.** Worst: L68 (nothing causes
   anything), L28 (you cannot pin a spider web), L114 (Mom is called "he"), L90
   (the spoon was never in the bag), L83 (Dad introduced, Mom does everything).
3. **9 questions have no answer in the story** — L9, 42, 48, 71, 84, 90, 98,
   115, 118.
4. **The third question is the same question 81 times of 123.** 67 end "Tell me
   why", 48 open "Do you think". Less urgent now that page is optional, but it
   is a tell.

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
