# Where we are

A running note of what's done and what's next, so any new chat can pick up
where we left off. Newest updates go at the top.

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
