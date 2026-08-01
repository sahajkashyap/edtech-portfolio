# Audit records

Every file in this folder is a record of an **independent check** — carried out
by an agent that did not build the thing it was inspecting, and briefed to find
what was wrong rather than to confirm that it was fine.

That distinction is the whole point. An "all correct" from whoever wrote the
work is worth very little. Every genuinely damaging problem this project has
had passed all of its automated checks and was found by someone reading the
output: a story about "wet kits" no adult could explain, `cod` at Lesson 18
(perfectly decodable, learned at age 11), a picture with no children in it, and
a checker that reported zero problems because it had never tested anything.

## What is here

| File | Scope | Date |
|---|---|---|
| [`2026-07-31-lessons-001-045.md`](2026-07-31-lessons-001-045.md) | Lessons 1–45, all pages | 31 Jul 2026 |
| [`2026-07-31-lessons-046-090.md`](2026-07-31-lessons-046-090.md) | Lessons 46–90, all pages | 31 Jul 2026 |
| [`2026-07-31-lessons-091-128.md`](2026-07-31-lessons-091-128.md) | Lessons 91–128, all pages | 31 Jul 2026 |
| [`2026-07-31-outcome.md`](2026-07-31-outcome.md) | What was fixed, and what was left | 31 Jul 2026 |

Each report is the auditor's own words, unedited. They were asked to rank
findings as blocking / should fix / cosmetic / checked-and-correct, and to say
plainly when a category was empty rather than pad it.

## How these were run

Three auditors, one per range, each briefed to:

1. **Check structurally, across every sheet in range** — programmatically, not
   by eye: page counts, the story present on exactly one page, the fold line
   and grown-up instructions, overflow against the 940.8px page budget, type
   sizes against the 18px floor.
2. **Render pages to images and look at them** — at least ten sheets each,
   judging spacing, sizing, legibility, printability, and the drawings as a
   five-year-old would name them with no caption.
3. **Read stories at a child's pace** — does it make sense, does each event
   cause the next, does the child act while adults assist.

The specification they checked against is in [`../DECISIONS.md`](../DECISIONS.md),
which records what was decided, by whom, and why.
