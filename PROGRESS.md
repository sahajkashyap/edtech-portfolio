# Where we are

A running note of what's done and what's next, so any new chat can pick up
where we left off. Newest updates go at the top.

---

## 2026-07-23

**Done**
- Built the **phonics worksheet generator** on the existing UFLI Foundations
  Tracker (`phonics-assessment-tool:/index.html`): a "Generate practice
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
