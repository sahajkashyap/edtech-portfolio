# Decodable Passage Generator — first example

This folder holds **one hand-built example sheet**, not the generator yet. The
point is to agree on what a finished sheet looks like before we build the
machine that makes 128 of them.

- `example-lesson-41.html` — open in a browser, click **Print / Save as PDF**
- `Mud Pig - Lesson 41 - EXAMPLE.pdf` — the printed result, 3 pages
- `check-pages.py` — measures each sheet against the page budget before printing,
  so we find what to trim instead of guessing (`python3 check-pages.py`)

## Why Lesson 41

Lesson 41 is "Short Vowels Review (all)" in the phonics tool's own curriculum.
By that point a reader has every single consonant, all five short vowels, the
`-s` ending, and six heart words (`the is a and to in`). Nothing else.

That means **no** silent *e*, **no** digraphs (`sh ch th ck`), **no** blends,
**no** vowel teams, **no** r-controlled vowels. "Mud Pig" obeys all of it:
55 words, 0 untaught sounds.

## About the picture — three separate things

A picture on a decodable is not one decision, it's three. This example uses all
three on purpose.

| # | What it is | Where it is | Why |
|---|---|---|---|
| 1 | **A scene illustration** | Top of page 1 | Gives the child the story in their head before their eyes do the work |
| 2 | **A "cover it up" rule** | Grown-up notes, page 2 | The picture must not become a guessing crutch — that is the habit decodables exist to prevent |
| 3 | **A "draw it" box** | Page 2 | Comprehension check that needs no writing. This is the one most K–2 teachers actually use |

**The illustration is drawn in code (SVG), not generated as an image.** That
matters for four reasons:

1. It costs nothing and needs no image service.
2. Style stays identical across all 128 sheets. AI image tools drift.
3. It prints clean on a cheap home printer — pure black line art, no grey wash.
4. There is no copyright question at all. We drew it.

The trade-off: a code-drawn picture can't show anything we haven't drawn before.
The plan for the real generator is a small reusable **prop box** — a library of
simple shapes (pig, dog, cat, sun, tub, pond, bag, hat, bed…) that the writer
agent composes into a scene. Roughly 40 props covers most CVC-level stories.

## Deliberate layout choices, in case we want to change them

**Three sheets, and who owns each one is printed at the top.** Revised after
teacher review, July 2026 — the first draft mixed adult instructions onto the
child's page, which is just more words for a young reader to get confused by.

| Sheet | Owner | What's on it |
|---|---|---|
| 1 | Grown-up — keep this one | How to use it in five steps, the story to follow along with, what a good answer sounds like, the sound-check reassurance |
| 2 | The reader | Picture, warm-up words, heart words, the story, three fluency circles |
| 3 | The reader | Three questions with wide writing lines, and a big draw-it box |

**Space for young hands is non-negotiable.** A K–2 child is still learning to
hold the pencil, so small targets are a fine-motor problem before they are ever a
reading problem. When a sheet doesn't fit, cut adult text or add a page — never
the child's space.

- Writing lines **48px** tall, drawing box **3.3in** tall, ~20px between questions
- Story type **24px**, word cards and heart words **22px**, question text **19px**
- Adult text may be 11–13px. A child's may not.

`check-pages.py` exists precisely so this rule survives contact with a full page:
it measures each sheet against the 940.8px letter budget and says which one
overflows, so the trimming comes out of headers rather than the drawing box.

**Warm-up words come before the story**, and they are the same words that appear
in it. First encounter should be in isolation, not mid-sentence.

**The "sound check" is written for a parent, not an engineer.** It lives on the
grown-up sheet and says, in plain words, that every word can be sounded out and
what was deliberately kept out. The point is an adult who feels *empowered* to
follow the recipe — not an audit log.

## What the real generator still needs

1. **Writer agent** — drafts a story from the allowed sound list for lesson N.
2. **Grapheme auditor subagent** — goes word by word against the allowed set and
   returns every violation. It did not write the story, so it is not attached
   to it.
3. **Loop** — violations go back to the writer, re-audit, repeat until zero.
4. **Story-quality judge** — checks it is actually a story, not "Sam sat. Sam sat."
5. **Prop-box picker** — chooses props matching the story's nouns.

## Copyright rules (unchanged)

- Scope & sequence is a shared teaching method — fine to follow.
- Dolch (1936) is public domain — fine for sight words.
- Fry is **not** free — never use it.
- Never reproduce UFLI's wording, word lists, or page design. Original text only.
