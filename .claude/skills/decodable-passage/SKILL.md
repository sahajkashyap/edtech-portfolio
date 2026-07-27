---
name: decodable-passage
description: >-
  Write a decodable story/passage sheet for a specific lesson of the phonics
  assessment tool's 128-lesson scope and sequence, where every word uses only
  sounds taught through that lesson. Use whenever building, editing, or
  extending decodable passages, decodable readers, or "Mud Pig"-style story
  sheets for the Reading Assessment Tool with Phonics Button. Enforces the
  generate -> audit -> fix -> re-audit loop, the sound list as the single
  source of truth, and the hard copyright rules.
---

# Decodable passage

Write a short story a child at lesson N can read **without guessing a single
word**, then prove it. The proving is not optional and is not done by the writer.

Everything lives in `decodable-passage-generator/`.

## The one rule that matters

> If a single untaught letter pattern gets in, the child guesses — and guessing
> is the exact habit decodables exist to prevent.

A passage that is 98% correct is not 98% good. It is broken.

## Never trust the writer to check the writer

This is the whole architecture. The agent that wrote the story is attached to it
and will rationalise. So:

1. **Writer** drafts a story from the allowed sound list for lesson N.
2. **Auditor** — `audit_passage.py` — checks it word by word. Mechanical, no
   opinion, did not write the story.
3. **Loop.** Violations go back to the writer. Re-audit. Repeat until zero.
   Never hand-wave a violation away; either change the word or change the rule
   in `build_sound_list.py` and say why.
4. **Story judge** — a *separate* agent asks: is this actually a story? Does
   something happen? Would a child care? "Sam sat. Sam sat." passes the audit
   and fails the child.
5. **Page check** — `check-pages.py` confirms every sheet fits on paper.

Zero violations is the floor, not the goal.

## Commands

```
python3 build_sound_list.py                      # rebuild sound-list.json from the tool
python3 audit_passage.py 41 "the story text"     # audit text
python3 audit_passage.py 41 --html sheet.html    # audit a built sheet
python3 audit_passage.py --selftest              # regression tests, must be 100%
python3 check-pages.py sheet.html                # does each sheet fit on paper
```

`audit_passage.py` exits 0 for clean, 1 for violations, 2 for bad usage.
**Exit 1 means do not ship.**

## The sound list is the single source of truth

`sound-list.json` holds, for each of the 128 lessons: allowed graphemes,
suffixes, prefixes, patterns, heart words, and forbidden letter patterns.

- Lessons are cumulative **by lesson number**. A child at 41 has had 1–40.
  Confirmed by the teacher: worksheets go home in sequence.
- Never hand-edit `sound-list.json`. Edit `build_sound_list.py` and regenerate,
  so the reasoning stays next to the data.
- Every judgement call gets a `note`. Every source oddity gets `FLAGGED for
  teacher review` so it surfaces in `flaggedForTeacherReview`.
- Where one spelling has two sounds taught at different lessons (`ow` in *snow*
  vs *cow*, `ea` in *eat* vs *head*), the gate sits at the **later** lesson.
  Conservative costs a rewrite; permissive costs a child.

## What the auditor cannot do

It judges spelling, not meaning, so it cannot settle words whose spelling is
ambiguous — `lens` (is `-s` a plural?), `snow` (which `ow`?), `head` (which
`ea`?). These are listed in `KNOWN_LIMITATIONS` in `audit_passage.py`.

**The fix is a word bank**: an approved word list per lesson, each word carrying
its grapheme breakdown. Until that exists, prefer words the auditor can prove.

## Every sheet says what has to come first

Confirmed by the teacher, July 2026. A sheet can arrive in a home out of order —
from an assessment report, a teacher's note, or a parent browsing. So the
grown-up sheet opens with a prerequisite banner, **above everything else**:

> **This is Lesson N. It assumes your child has already worked through Lessons
> 1–(N-1).** Each lesson only uses sounds taught in the ones before it. If your
> child has not had those yet, this story will be too hard — not because of
> anything they did, but because the sounds have not been introduced yet. Ask
> their teacher which sheet to start with.

Rules for it:

- It goes on the **grown-up sheet only**, at the very top. Never on a child's page.
- Word it so a struggling reader is never the explanation. The sheet is out of
  sequence, not the child.
- The prerequisite is simply lessons 1..N-1 — the sequence is cumulative and
  there are no non-adjacent dependencies.
- If the lesson carries `requiresWordBank`, or is one of the
  `flaggedForTeacherReview` entries, say so here too: the grown-up should know
  the sheet rests on a judgement call.

## Writing the story — what a test run taught us

- **Use the word bank, not the rules.** `word-bank.json` lists the approved words
  for each lesson. A writer reasoning from rules gets it wrong; a writer picking
  from a proven list mostly cannot.
- **Line length drives page height, not line count.** A line over ~9 words wraps
  and costs a full line. At the later lessons, 6 lines of 9 words or fewer.
- **Something must happen.** A small problem, a turn, an ending. "Sam sat. Sam
  sat." passes every rule and fails the child. This is the part no checker can
  do for you.
- **The early lessons are the craft.** At Lesson 19 there are around 100 words
  and no `and`, no `-s`, no `-ed`. Getting a real story out of that is the skill.
- Run `validate_passage.py` and loop until it exits 0. Never edit the gate or
  the bank to make a story pass — change the story.

## What must never reach a child

Confirmed by the teacher, July 2026, after a word-level review found `gun`,
`kill`, `bet`, `mob` and `cop` sitting in the word bank — all perfectly
decodable, all one generation away from a first-grade sheet.

`core_vocabulary.BLOCKED` holds 132 words across weapons, death, crime,
substances, gambling, bodily functions, appearance and unkindness.
`validate_passage.py` enforces it over the story, the title, the warm-up words,
the questions **and the grown-up answer notes** — two blocked words were once
hiding in those, where nothing was looking.

A parent scanning a sheet in a backpack does not read it in context. They see
the word.

Beyond single words, an independent reviewer reading all 123 stories found
patterns worth holding to:

- **An adult is named in the same sentence** as any fire, blade, hot pan, deep
  water, or trip after dark. A story where children do an adult-risk job alone
  is one a child can copy.
- **Never call a character "bad."** Early stories drifted into a template of
  mess → adult anger → forgiveness. Vary the engine: curiosity, sharing,
  building, a surprise.
- **`fat` is never a descriptor**, even of an animal, and never in a title.
  The blocklist has **no exceptions**, including where it costs a lesson its
  target sound. Lesson 7 teaches `f`, and `fat` is the only real English word
  containing `f` that is decodable there — checked exhaustively. That lesson's
  story practises the other letters and the gap is recorded on the index, which
  is the honest trade. Do not carve out an exception to close it.
- **Balance who helps.** The set once had Dad in 31 stories and Mom in 3, with
  the fixing and driving always male. Both are decodable everywhere.
- **Vary the names.** Decodability constrains them hard, but Ana, Kim, Raj, Sal,
  Nita, Mina, Omar, Hana, Ravi and Lin all fit the same short patterns.
- **Don't end on a small injustice** — an animal taking a child's food with no
  repair reads fine once and sour six times.

## Sheet structure

Follow the `phonics-worksheet` skill for all layout, space, and type rules —
they are shared. Specific to passages:

- **Grown-up sheet first**, then the child's sheets. The child's pages carry
  only the child's things.
- **Picture**: a code-drawn SVG scene (never a generated image — style
  consistency, print quality, no copyright question). The grown-up sheet must
  tell the adult to **cover the picture while the child reads**, so it supports
  meaning without becoming a guessing crutch.
- **Warm-up words** come before the story and are words that appear *in* it.
- **The trust box** on the grown-up sheet says in plain words that every word
  can be sounded out, and what was deliberately left out. Written for a tired
  adult at a kitchen table, not for an engineer. Use both "sound it out" and
  "use your sound spelling" — the phrases school uses.
- **Draw box** gets its own sheet.

## Hard copyright rules

- Scope & sequence is a shared teaching method — fine to follow.
- Dolch (1936) is public domain — fine for sight/heart words.
- The Fry list is **not** free — never use it.
- Never reproduce UFLI's wording, word lists, or page design. Original text only.
