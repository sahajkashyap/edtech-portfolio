# Decodable Passage Generator — first example

This folder holds **one hand-built example sheet**, not the generator yet. The
point is to agree on what a finished sheet looks like before we build the
machine that makes 128 of them.

- `example-lesson-41.html` — open in a browser, click **Print / Save as PDF**
- `Mud Pig - Lesson 41 - EXAMPLE.pdf` — the printed result, 4 pages
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

**Four sheets, and who owns each one is printed at the top.** Revised after
teacher review, July 2026 — the first draft mixed adult instructions onto the
child's page, which is just more words for a young reader to get confused by.

| Sheet | Owner | What's on it |
|---|---|---|
| 1 | Grown-up — keep this one | How to use it in five steps, the story to follow along with, what a good answer sounds like, the sound-check reassurance |
| 2 | The reader | Picture, warm-up words, heart words, the story, three fluency circles |
| 3 | The reader | Three questions with tall writing lines |
| 4 | The reader | A full-page drawing box |

The drawing got its own sheet the moment taller writing lines stopped fitting
beside it. That is the rule working as intended: the page count gives, the
child's space does not.

**Space for young hands is non-negotiable.** A K–2 child is still learning to
hold the pencil, so small targets are a fine-motor problem before they are ever a
reading problem. When a sheet doesn't fit, cut adult text or add a page — never
the child's space.

- Writing lines **80px** tall, drawing box **7.8in** tall, ~34px between questions
- Story type **24px**, word cards and heart words **22px**, question text **19px**
- Adult text may be 11–13px. A child's may not.
- Name lines are ~3in of ruled line, long enough for a whole name, tucked into
  the header row so they cost no vertical space

`check-pages.py` exists precisely so this rule survives contact with a full page:
it measures each sheet against the 940.8px letter budget and says which one
overflows, so the trimming comes out of headers rather than the drawing box.

**Warm-up words come before the story**, and they are the same words that appear
in it. First encounter should be in isolation, not mid-sentence.

**Say it the way school says it.** Where the grown-up sheet tells an adult what
to do when a child gets stuck, it offers both "sound it out" *and* "use your
sound spelling" — the phrases a teacher uses in class, so home and school match.

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

---

# The sound list and the checking loop

Added July 2026. This is the machinery the passages are built on.

## Files

| File | What it is |
|---|---|
| `build_sound_list.py` | Generates the rulebook from the assessment tool's own curriculum. Every judgement call is a `note` you can argue with. |
| `sound-list.json` | The rulebook. 128 lessons; allowed graphemes, suffixes, prefixes, patterns, heart words, and forbidden spellings for each. Never hand-edit it. |
| `audit_passage.py` | The auditor. Checks a passage word by word. Did not write the story. |
| `check-pages.py` | Checks each sheet fits on paper. |

## The model

Cumulative **by lesson number**: a child at Lesson 41 has had 1–40. Confirmed by
the teacher — sheets go home in sequence, and a skill a child missed earlier is
a separate conversation between teacher and parent, not something a worksheet
should paper over.

## The loop

```
writer drafts -> audit_passage.py -> violations? -> back to writer -> re-audit
                                  -> zero -> story judge -> page check -> ship
```

`audit_passage.py` exits 1 on any violation. **Exit 1 means do not ship.**

## How the auditor got its rules

Every rule in it exists because an adversarial agent — one that did not write it
— found a word that slipped past the previous version. The first version called
**15,764 of 87,119 dictionary words (18%) readable at Lesson 41**, including
*picnic*, *basket*, *rabbit*, *little* and *vein*. After three rounds of the
loop that is **57 words (0.07%)** — a 277x reduction — and nearly all of the
survivors are genuinely readable (*digs*, *dogs*, *kids*, *mats*, *taps*,
*quit*, *quiz*).

Full write-up for a technical reader: **[ENGINEERING.md](ENGINEERING.md)**.

Round 1 added: medial consonant clusters (not just word edges), a
one-syllable-before-Lesson-66 gate, longest-match pattern scanning so *night*
isn't blocked for containing `gh`, y-as-a-vowel gating, untaught vowel pairs
(*lion*, *dial*), soft c/g with a hard-g exception list, stricter suffix
peeling, and empty input never counting as a pass.

**Round 2 caught the opposite failure**: round 1 had traded false negatives for
false *positives*, three of them bad enough to make whole lessons unwritable —
no word containing `q` passed at any lesson (so Lesson 32, the `qu` lesson,
rejected *quit* and *queen*); `milk`, `self`, `elf` and `film` were blocked for
45 lessons; and Lesson 85 could not use `ea`, the grapheme Lesson 85 teaches.
Also fixed: Lesson 66 was a cliff where the syllable gate switched off entirely
and *photograph* passed; *hundred* was being read as `hundr` + `ed`; Lesson 65
could not use *running*; *egg* and *odd* were rejected; *cold* and *kind* passed
at 53 as short-vowel words.

An unwritable lesson is a harder failure than a bad word slipping through — the
generator produces nothing and the teacher never learns why.

Words passing at each lesson, out of 120,958 dictionary words (3–9 letters):

| Lesson | 20 | 41 | 53 | 65 | 66 | 77 | 99 |
|---|---|---|---|---|---|---|---|
| pass | 0.3% | 0.7% | 2.7% | 5.1% | 20.5% | 25.3% | 81.8% |

The jump at 66 is the two-syllable unlock and is legitimate. **The 81.8% at 99
is not yet tight enough** — from Lesson 99 the syllable limit is removed
entirely because affix lessons build long words. That is the next thing to
narrow.

`python3 audit_passage.py --selftest` runs all 71 cases as regression tests.

## What it still cannot do

Spelling alone cannot settle words like `lens` (is that `-s` a plural?), `snow`
(which `ow`?) or `head` (which `ea`?). These are listed in `KNOWN_LIMITATIONS`
rather than quietly passed. **The fix is a word bank** — an approved word list
per lesson with each word's grapheme breakdown. That is the next thing to build.

## Verified against UFLI, July 2026

An agent checked the whole list against UFLI Foundations' published Toolbox and
Scope & Sequence.

**The lesson order is correct.** Every lesson number teaches what UFLI says it
teaches, in the right sequence, and the count of 128 is right. The cumulative
model — a child at lesson N has had 1..N — matches everything UFLI publishes;
UFLI documents no prerequisites beyond plain sequence.

**17 entries had typos**, now corrected in `CURRICULUM_CORRECTIONS` in
`build_sound_list.py`, each citing what the tool says and what UFLI teaches. The
ones that changed what a child could read:

| Lesson | Tool said | UFLI teaches |
|---|---|---|
| 94 | `schwa` | `ea` /ĕ/ (head) and `a` /ŏ/ (want) — UFLI has no schwa lesson |
| 98 | silent letters `kn, wr, mb, m` | `kn, wr, mb` only — `mn` is taught nowhere in the 128 |
| 114 | `... high ...` | `aigh` — previously dropped, so never taught at all |
| 58 | `u` | `u_e`, and it carries a second sound /yū/ (cube) |
| 90 | `oo` /ŭ/ | `oo` /ū/ — the breve reversed the sound |
| 113 | `ear` /ɛr/ | the *hear* sound, not the *her* sound |
| 116 | `ough` /ə/ | `ough` /ō/ |
| 27 | `l /l/ Part 2, ai` | `l /l/ Part 2` — the stray letters are `-al`, not `ai` |

**Two things worth knowing:**

1. **The unit labels were not UFLI's.** UFLI has **14 units, all contiguous
   blocks** of consecutive lessons. The tool had 8 units that were not in numeric
   order — Lesson 98 filed under "VCe", lessons 84–88 placed before 77–83.
   Anything grouping by those units showed lessons out of teaching order. The
   real 14 are now in `UFLI_UNITS`.

2. **The wording matches a Learning A-Z correlation chart**, not UFLI's own
   document — every typo is a one- or two-character slip off that chart. Worth
   knowing which document to re-check against.

**The same typos are still in `phonics-assessment-tool/index.html`** and will be
re-imported unless fixed there. `CURRICULUM_CORRECTIONS` is what stands between
them and a child until then.
