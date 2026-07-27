# Decodable Passage Engine — engineering notes

A correctness system for early-literacy text, built by a classroom teacher of
fourteen years working with Claude Code.

The interesting part is not that it generates worksheets. It is that **nothing
ships unless a component that did not write it can prove it is correct** — and
that the failure modes were found by adversarial agents rather than by hoping.

---

## The problem

Decodable stories are the hardest text in early literacy to write. A child on
Lesson 41 needs a story built *only* from the sounds taught through Lesson 41.
If one untaught grapheme sneaks in — a single silent *e*, one `sh` — the child
cannot decode it, so they guess. Guessing is the precise habit decodable text
exists to prevent.

So a passage that is 98% correct is not 98% good. It is broken.

There are never enough of these, because writing them by hand is slow and
checking them by eye does not scale to 128 lessons.

---

## Architecture

```
                    ┌─────────────────────────────┐
   assessment  ───► │  build_sound_list.py        │
   tool's           │  + CURRICULUM_CORRECTIONS   │ ──►  sound-list.json
   curriculum       │  + UFLI_UNITS               │      (the rulebook)
                    └─────────────────────────────┘
                                                              │
   writer  ──── draft ────►  audit_passage.py  ◄──────────────┘
      ▲                            │
      │                            ▼
      └──── violations ───  exit 1 = do not ship
                                   │
                            exit 0 │
                                   ▼
                        story judge → check-pages.py → ship
```

Four properties this buys:

1. **The rulebook is generated, not typed.** It reads the assessment tool's own
   curriculum, so lesson names and order cannot drift apart from the tool.
2. **The checker is not the writer.** `audit_passage.py` has no opinion about
   the story and no stake in it.
3. **Judgement calls are visible.** Every inference is a `note` in source, and
   every correction cites what the source says against what UFLI teaches.
4. **Silence is never approval.** Empty input returns "NOT CHECKED", exit 1.

---

## What the adversarial loop actually caught

Three agents were used, none of which wrote the code they attacked.

### Round 1 — a checker that was 18% wrong

The first auditor called **15,764 of 87,119 dictionary words readable at
Lesson 41 — 18% of English.** It passed *picnic*, *basket*, *rabbit*, *little*,
*vein*, *gem*.

Root causes, each found by attack rather than review:

| Hole | Consequence |
|---|---|
| Consonant clusters checked only at word edges | *picnic*, *basket*, *napkin* passed |
| No syllable limit at all | *potato* passed at Lesson 12 |
| Doubled consonants beyond `ff/ll/ss/zz` unlisted | *rabbit*, *kitten* passed |
| `ei` and `uy` missing from the rulebook | *vein* passed at Lesson 34 |
| Soft c/g never checked | *gem*, *acid*, *cell* passed |
| `y`-as-a-vowel never gated | *my*, *happy* passed 43 lessons early |

### Round 2 — the overcorrection was worse

Fixing round 1 traded false negatives for false *positives*, and three were bad
enough to make entire lessons impossible to write:

- **No word containing `q` passed at any lesson, ever.** `qu` was in the allowed
  set but the check tested raw characters, so Lesson 32 — the `qu` lesson —
  rejected *quit*, *quiz*, *queen*.
- **`milk`, `silk`, `self`, `elf`, `film` blocked for 45 lessons**, because
  `lk`/`lf` had been gated as silent-letter spellings when they are ordinary
  blends.
- **Lesson 85 could not use `ea`** — the grapheme Lesson 85 teaches.

> An unwritable lesson is a harder failure than a bad word slipping through: the
> generator produces nothing and nobody learns why.

Also caught: Lesson 66 was a cliff where the syllable limit vanished entirely
(*photograph* passed); *hundred* was being read as `hundr` + `ed`; *cold* and
*kind* passed at Lesson 53 as short-vowel words.

### Round 3 — checking the source data itself

An agent verified the whole curriculum against UFLI Foundations' published
Toolbox and Scope & Sequence.

**The lesson order was correct** — every lesson number teaches what UFLI says,
in sequence. But **17 entries carried typos**, four of which changed what a
child would see:

| Lesson | Source said | UFLI teaches |
|---|---|---|
| 94 | `schwa` | `ea` /ĕ/ (*head*), `a` /ŏ/ (*want*) — UFLI has no schwa lesson |
| 98 | `kn, wr, mb, m` | `kn, wr, mb` only — `mn` is taught nowhere in the 128 |
| 114 | `... high ...` | `aigh` — had been dropped, so never taught at all |
| 27 | `l /l/ Part 2, ai` | `l /l/ Part 2` — the stray letters are `-al` |

It also established that the **unit labels were not UFLI's**: UFLI has 14
contiguous units; the source had 8 that ran out of numeric order.

And it identified the *provenance* of the typos — the wording matches a
third-party correlation chart rather than UFLI's own document, and every error
is a one- or two-character slip off that chart.

### Result

| | Words wrongly passing at Lesson 41 |
|---|---|
| First version | 15,764 of 87,119 (18.1%) |
| After the loop | **57 of 87,119 (0.07%)** |

A **277× reduction**, and the 57 survivors are almost all legitimate — *digs*,
*dogs*, *kids*, *mats*, *taps*, *quit*, *quiz*.

**71 regression tests**, every one a word that beat an earlier version.

---

## Design decisions worth defending

**Gate at the later sound, or mark the lesson.** Where one spelling has two
sounds taught at different lessons (`ow` in *snow* vs *cow*), an early gate lets
an untaught sound through and a late gate makes the teaching lesson unwritable.
Resolution: gate at first teaching, and mark the lesson `requiresWordBank` so
the generator knows it needs an approved list. 31 of 128 lessons carry this.

**Record what cannot be solved.** `lens` and `gets` have identical spelling
shapes; only a dictionary knows one `-s` is a suffix. Rather than fake a rule,
these sit in `KNOWN_LIMITATIONS` with the reason. Four entries.

**English irregularity gets a list, not a rule.** *was*, *son*, *put*, *talk*
cannot be read off their spelling. 68 words are enumerated with the lesson from
which each is safe, or `999` for never.

**Correct the source in the open.** The assessment tool still carries the 17
typos and would re-import them. `CURRICULUM_CORRECTIONS` documents each one —
what the tool says, what UFLI teaches, why — instead of silently patching data.

**Pedagogy constrains layout, not the reverse.** A K–2 child is still learning
to hold a pencil, so writing lines are 80px and drawing boxes get their own
sheet. When a page overflows, `check-pages.py` reports it and the fix comes out
of adult text — never the child's working space. That rule forced a 3-sheet
packet to 4, which was the correct outcome.

---

## Honest status

| Component | State |
|---|---|
| Sound list, 128 lessons, verified against UFLI | Built |
| Deterministic auditor, 71 regression tests | Built |
| Page-fit checker | Built |
| Two skills encoding the rules and the loop | Built |
| Human-readable review page | Built |
| One complete 4-page sheet (Lesson 41, hand-built) | Built |
| **Writer agent — generating the other 127 sheets** | **Not built** |
| **Word bank — per-lesson approved word lists** | **Not built** |
| Story-quality judge | Not built |

The word bank is the next build, because it is what resolves the four known
limitations and the 31 word-bank lessons.

---

## Running it

```bash
python3 build_sound_list.py                    # rebuild the rulebook
python3 audit_passage.py 41 "Sam has a pig."   # check text against a lesson
python3 audit_passage.py 41 --html sheet.html  # check a built sheet
python3 audit_passage.py --selftest            # 71 regression tests
python3 check-pages.py                         # does every sheet fit on paper
python3 build_review_page.py                   # regenerate the review page
```

Exit codes: `0` clean, `1` violations found, `2` bad usage.

---

## Copyright

Scope and sequence is a shared teaching method and free to follow. Sight words
come from the public-domain Dolch list (1936); the Fry list is not free and is
never used. No UFLI wording, word lists, or page design is reproduced — all
passage text and page layout is original.
