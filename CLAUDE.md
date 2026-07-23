# Reading Assessment Tool with Phonics Button

## What this project is

A reading/phonics assessment portfolio. The active build adds **one new
capability** to the existing **phonics assessment tool** (the "UFLI Foundations
Tracker" at `phonics-assessment-tool:/index.html`): a **Phonics Button** that
hands parents matched, printable practice worksheets. Same tool, more
capability — NOT a separate standalone generator.

Tool title shown to parents: **"Reading Assessment Tool with Phonics Button."**

## The closed loop

Assessment flags a skill → parent clicks **"Generate practice worksheets"** →
picks the skill → one click produces a printable PDF practice sheet for that
exact skill. The picker's skill names and order **exactly match** the tool's
existing curriculum (it is generated from the same `curriculum` object, so it
can never drift).

## Locked decisions

- **Host tool:** the phonics assessment tool (`phonics-assessment-tool:/index.html`).
- **Picker granularity:** **per-skill** (per-lesson), matching the tool's list.
- **Template:** the **Short a** sheet is the confirmed, locked template. Every
  other skill's sheet matches its structure and layout. See the
  `phonics-worksheet` skill in `.claude/skills/` for the full spec.
- **Worksheet format:** one skill per printable page, easy-first then climb to
  the target ("stretch") skill.

## Copyright constraints (hard rules)

- Phonics scope & sequence is a shared, non-ownable teaching method — fine to follow.
- The **Dolch** word list (1936) is public domain — fine to use for sight words.
- The **Fry** list is NOT free — do NOT use it; exclude it entirely.
- Never reproduce **UFLI's** wording, word lists, or page design. Original
  wording and original word choices only.

## Build status

- Stage 1 — Prove the Short a template: **done / locked.**
- Stage 2 — Button + skill picker + generator in the phonics tool: **built.**
- Stage 3 — Worksheet ladder content: **COMPLETE — all 128 skills generate.**
  Six sheet shapes: sound-pattern (CVC/digraph/teams), magic-e, letter-sound,
  word-ending/affix, review (multi-column sort), and syllable. Browser-verified:
  128/128 render with zero JS errors.
- Stage 4 — Merge to `main`: only on explicit approval.

## Git workflow

- `main` is the safety net and must NEVER be edited directly. Keep it clean and
  pushed as the known-good baseline.
- Do button work on the feature branch. (This session's assigned branch is
  `claude/phonics-worksheet-button-2v653s`; the human's shorthand for it is
  `reading-assessment-with-phonics-button`.)
- Push the branch to GitHub so work is backed up.
- Merge into `main` only when the button is proven and the human approves.

## When starting a fresh session

1. Pull the latest from GitHub; confirm the branch.
2. Read the existing assessment code to get the REAL skill list before touching
   worksheet logic.
3. Build incrementally; check in before large changes.
