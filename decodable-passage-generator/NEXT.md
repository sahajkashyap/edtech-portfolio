# Where this is, and what is left

Written 2026-07-28, mid-task, so any session can pick this up cleanly.

## What just changed

**Sheet order now matches how K–2 actually works**, per the teacher:

1. Grown-up sheet
2. The child reads the story
3. **The child draws what happened** — this is the comprehension check at this age
4. Questions — **explicitly optional**, framed as an extension for a reader who wants
   more, and just as good asked aloud over the drawing

This came from real classroom practice: published decodables (UFLI's 224 passages,
CKLA's readers) carry **zero comprehension questions**. Every one has a draw-the-story
box instead. Our questions stay because a parent at home has no teacher to ask — but
they are no longer presented as the work.

All 123 sheets rebuilt and measured; every one fits.

## The audit that is still outstanding

An independent review compared all 123 stories against **224 real UFLI decodable
passages** and the **Kuperman age-of-acquisition norms** (51,715 words). Verdict:
**74 of 123 need work, 23 need rewriting, 49 are clean.**

`aoa-lookup.csv` in this folder holds the age-of-acquisition rating for all 1,269
words we use. **340 are above the age-6 line.**

### The findings, in the order worth doing them

1. **Build the age gate.** A word should pass only if its age of acquisition is ≤ 6.0,
   or it is a Dolch noun, or it is on a teacher-approved exception list. This would have
   caught `cod` automatically — acquired at **age 11.5**, against `dog` 2.8, `cat` 3.7,
   `pig` 3.8. Same shape as the existing blocked-word gate.

2. **Kill the "did + verb" construction.** We write *"Dad did nap"* at **15× the rate
   real decodables do**. They just write *naps*. Biggest readability gain available, and
   it is a mechanical sweep across roughly lessons 13–26.

3. **Swap the obscure words.** Full table in the audit. Headlines: `kits`→`cats`,
   `bog`→`mud`, `fig`→`nut`, `chum`→`pal`, `sack`→`bag`, `colt`→`pup`, `brook`→`pond`,
   `soil`→`dirt`, `spade`→`shovel`, `stew`→`soup`, `budge`→`move`. `cod` and `gap` have
   no legal replacement — change those stories instead.

4. **Let the stories grow.** Ours are ~60 words at Lesson 6 and ~54 at Lesson 128. Real
   ones go **50 → 172**. The flat ceiling is why the late stories feel rushed: they cram
   a whole plot into seven sentences. `validate_passage.py` already scales the *minimum*
   with vocabulary; it needs to scale the *target* with the lesson.

5. **Rewrite the 23 broken stories.** Worst: L68 (nothing causes anything), L28 (you
   cannot pin a spider web), L114 (Mom is called "he"), L90 (the spoon was never in the
   bag), L83 (Dad introduced, Mom does everything), L81 ("On the third sun up" is not
   English).

6. **Fix 9 questions whose answer is not in the story** — L9, 42, 48, 71, 84, 90, 98,
   115, 118.

7. **Break the third-question template.** It is the same question **81 times out of
   123** — 67 end "Tell me why", 48 open "Do you think". Less urgent now the page is
   optional, but it is still a tell.

## The lesson worth carrying forward

The noun shortage in early lessons is real, and I solved it the wrong way. Faced with
the same constraint, real decodables **add more characters** — 70 distinct names by
Lesson 45, against our 26. They never reach for rarer nouns. I reached for `cod` and
`bog`. Add people, not vocabulary.

## Everything still holds

87 auditor tests · 123/123 passages valid · 123/123 sheets fit · no blocked word
anywhere · heart words mapped with the heart on the irregular part only.
