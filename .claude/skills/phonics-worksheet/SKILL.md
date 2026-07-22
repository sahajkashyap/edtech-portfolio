---
name: phonics-worksheet
description: >-
  Create printable K-2 phonics practice worksheets that match a flagged phonics
  skill (short vowels, digraphs, VCe, vowel teams, r-controlled, affixes, etc.).
  Use whenever building, editing, or extending phonics/decoding practice sheets
  for the Reading Assessment Tool with Phonics Button (the UFLI Foundations
  phonics assessment tool), or any request to generate a one-skill-per-page
  decodable practice sheet for parents to print at home. Enforces the confirmed
  Short a template structure and the hard copyright rules.
---

# Phonics practice worksheet

Build a **printable, one-skill-per-page** practice sheet that a parent can print
and do at home with their child. The sheet is generated from an assessment that
flagged a specific phonics skill, closing the loop: assessment flags a skill →
one click hands the parent matched practice for that exact skill.

## Hard rules (never break these)

- **One skill per sheet.** Never mix target skills on one page.
- **Easy-first, then climb.** Open with words/sounds the child already knows to
  build confidence, then climb to the target ("stretch") skill. End on a win.
- **Original content only.** Write every word list, sentence, and instruction
  from scratch. Never reproduce any published program's wording, word lists, or
  page design — specifically **never** copy UFLI's wording/word choices/layout.
- **Sight words: Dolch only.** Any sight/heart words come from the public-domain
  **Dolch list (1936)**. The **Fry list is NOT free — never use it.**
- **Scope & sequence is fine to follow** — the phonics teaching order is a
  shared, non-ownable method. Following it is allowed; copying someone's words
  is not.
- **Match the assessment tool's skill names and order exactly.** The picker of
  skills must mirror the tool's existing list (read the code for the
  authoritative list). Do not invent, rename, or reorder skills.

## Fine-motor / age constraints (K-2)

- Write-in blanks and boxes must be **generous** — young hands need room.
  Sound boxes ~75px; sentence blanks ~130px; letter boxes ~54px.
- **One box per letter** where a child writes a whole word, so they know where
  each letter goes.
- Keep each "problem" visually distinct — do not chain two instructions on one
  line. If steps are connected, still present them as separate problems with
  their own answer boxes.
- Grown-up guidance sits **at the very top** so the adult can help right away and
  is not overwhelmed. Word "the grown-up" (not "parent") — the helper may be any
  adult.

## Confirmed sheet structure (the Short a template)

Reproduce this section order for every skill, swapping in original,
skill-appropriate content:

1. Header band: tag + `Skill — Reading & Spelling ... Words` + "Flagged skill".
2. **For the grown-up · start here** callout (top).
3. **Warm-up** — a few already-known Dolch words + the target sound named with a
   familiar key word (a=apple, e=egg, i=igloo, o=octopus, u=umbrella).
4. **Read each word out loud** — ~12 target-skill words in a grid.
5. **Read the word families** — 2-3 rime families, first sound changing.
6. **Add the missing letter/grapheme** — write the target grapheme in a blank.
7. **Tap the sounds, then write them** — sound boxes, one box per sound.
8. **Change one sound** — separate one-change problems, one box per letter.
9. **Finish each sentence** — cloze from a check-off word bank (each word once).
10. **Read to a grown-up** — decodable sentences (target words + Dolch), check box.
11. **Sort the words** — discriminate target vs. not (the stretch), one done for
    them, roomy boxes, check-off word bank.
12. Footer: original items + public-domain Dolch note + free to reproduce.

## Output / print

- The sheet is plain white, letter size, `@page { size: letter; margin: 0.75in }`
  — designed to print. Deliver as HTML that prints cleanly to PDF (browser
  Print → Save as PDF), preserving the CSS layout.
- Single-theme (white paper) is intentional; do not add dark mode to the sheet.

## Reference implementation

The working generator + all short-vowel content live in
`phonics-assessment-tool:/index.html` (the `WORKSHEETS` data object + the
`buildWorksheetHTML()` renderer + the "Generate practice worksheets" button).
Add a new skill = add one entry to `WORKSHEETS` keyed by the lesson name; the
picker is generated from the tool's `curriculum` object so names/order always
match automatically.
