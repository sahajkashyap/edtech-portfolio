# Defect class catalogue

Every kind of mistake found while building 36 reading-assessment items, across
six audit passes. **Not a bug list — a list of KINDS.** A kind found once and
turned into an executable check never has to be found again; a kind fixed by
hand recurs.

Use this as the starting checklist for the next project. Anything already here
should be caught by a machine on pass one, so human attention goes to whatever
is genuinely new.

Legend: **[M]** mechanically checkable and implemented · **[H]** needs a human.

---

## A. The checker itself
*The most expensive class, because a broken checker hides every other class.*

| # | Kind | How it showed up here |
|---|---|---|
| A1 [M] | **A gate that cannot fail** | An exemption widened until it covered the words under test. Found on pass four. |
| A2 [M] | **A tolerance on a constant** | Syllable-count tolerance where gate 1 already forces every word to one syllable. It had never judged anything. |
| A3 [M] | **A gate that crashes open** | Missing/unreadable source file → empty string → "no overlap found" → PASS. **Refuse to judge rather than judge against nothing.** |
| A4 [M] | **An opt-in check** | Titles were judged only if `--title` was passed. Nobody passed it, so titles went unchecked for weeks. |
| A5 [M] | **A check with an empty input** | Pseudoword filters ran 36 times per audit and could never fire, because no file had pseudowords. |
| A6 [M] | **A self-test against fabricated data** | The gate self-test used an invented Form A, not the real sheet. |
| A7 [M] | **A relative path** | The corpus checker reported SUCCESS over zero files when run from another directory. |
| A8 [M] | **A sign-off that silences its neighbours** | An `accepted(...)` branch ending in `continue` skipped the six checks after it. |
| A9 [M] | **A check that punishes the repair** | A liveness check failed when a genuine fix removed its last input. |
| A10 [M] | **Two functions with the same name disagreeing** | Two `legal_pseudowords` in one folder returned 13 and 9. |
| A11 [M] | **A stale claim** | `"gates_passed": true` with no timestamp or content hash. Hand-edit the file and the claim survives. |
| A12 [M] | **Duplicated data with no build step** | Content lived in JSON and in the page. Nothing compared them. **Derive, never duplicate.** |
| A13 [M] | **Severity that never blocks** | Judgement-call findings graded so they never fail a run, and nothing ran the strict mode. |
| A14 [M] | **A substring test where a token test was meant** | `if form not in note` — every note ended with "do not score it an error", which *contains* "do not", so the commonest contractible form could never be flagged. The check guaranteed the opposite of its docstring. **Match tokens, not substrings.** |
| A15 [M] | **A sign-off keyed on the wrong field** | `ACCEPTED["40:topics:a child handling a farm or wild animal."]` — keyed on the rule's *reason* where the code keys on its *name*. It could never have matched on any run since it was written. |
| A16 [M] | **A dead sign-off** | An exemption for content that was later fixed. It silences nothing and still reads as "a person reviewed this". Fix: fail when an `ACCEPTED` entry matches no finding. |
| A17 [M] | **A measure narrowed until the finding vanished** | Note length stopped counting the one field that made it long, justified by "it renders once now" — but the renderer still drew it on all nine lessons. Eight findings disappeared and not one character left the screen. **Measure what renders, and put the measure next to the renderer.** |
| A18 [M] | **A generalised rule that does not cover the blanket rule it replaced** | A hand-written `den` rule was deleted for a "generalised" one that only recognises the animal sense when `fox|cub` is in the *same sentence*. A pup in a den went silent. The test written to prove the swap exercised only the case that worked. |
| A19 [M] | **A delimiter that appears in the data** | Slicing a generated JS constant to the first `;` — a semicolon inside the value truncated it, produced permanent false "drift", and on the next write emitted a syntax error that killed the tool's only `<script>`. |
| A20 [M] | **An incomplete list used to GENERATE, not just to check** | `CONTRACTIBLE` lacked `he is`/`she is`. Regenerating notes from it therefore *deleted* the warning from the one passage saying "He is mad." A list that drives generation silently un-warns where it is short. |
| A21 [H] | **A baseline that can only fall** | A rising REVIEW count failed unconditionally, so making a checker more honest was unstampable — the harness rewarded leaving it broken. Fix: allow a rise *with a written reason stored in the manifest*, and keep failing an unexplained one. |

## B. Curriculum correspondence
| # | Kind | Example |
|---|---|---|
| B1 [M] | **Content uses something not yet taught** | Blends before L53, `ss` before L42, `y`-as-vowel before L73. |
| B2 [M] | **The source rulebook itself is wrong** | The auditor could not tell `-s` /s/ from `-s` /z/, so two lessons could swap skills undetected. |
| B3 [M] | **The item does not exercise its own named skill** | The `f` lesson with no `f` in it; the `k` lesson whose only k was a character's name. |
| B4 [M] | **A lesson silently exempt from every check** | Lessons that teach no NEW letter returned an empty target list, so nothing looked at them. |
| B5 [M] | **Pooled targets hiding a gap** | A review lesson passed on total count while one of its named vowels appeared once. |
| B6 [M] | **A character name counted as evidence** | A name containing the target sound counted toward "the skill is exercised". |
| B7 [M] | **Reference data missing an entry** | `quit` was decodable, age-appropriate, and absent from the word bank entirely. |
| B8 [M] | **The alternate form reuses the original's words** | Including stems: `sit` against `sat`, `hum` against `hums`. |
| B9 [M] | **Verbatim reuse across items** | The same sentence in three items, and in an earlier published sheet. |
| B10 [M] | **A taught item never used** | The lesson that teaches a sight word never puts it on the page. |

## C. Language and sense
| # | Kind | Example |
|---|---|---|
| C1 [M] | **A sentence that is not English** | "a top rug", "a mud win", "Sam and Pam man." |
| C2 [M] | **Pronoun with an ambiguous referent** | One `it` taking six values in nine lines. |
| C3 [M] | **Tense flip** | Past, present, past inside three sentences. |
| C4 [H] | **Factually false** | Pigs that hop, insects with dens, cats that hum, planting a bud. |
| C5 [M] | **Verbless fragment / comma splice / inverted subject** | "Lots of bags, but not his cap." |
| C6 [M] | **An invented predicate** | "It is not up" meaning "he could not lift it". |
| C7 [H] | **A story with no arc** | It stops rather than finishes; the fix is asserted, never performed. |
| C8 [H] | **Missing middle step** | The obstacle is solved without the page showing how. |
| C9 [M] | **First-mention `the`** | "the jug" before any jug exists. |
| C10 [M] | **Emphatic `did` used as past** | "did cut", "did tip" — 25 instances. |
| C11 [M] | **In-sentence rhyme** | `bug`/`rug` lets a child chant instead of decode. |
| C12 [M] | **Near-duplicate lines** | One frame repeated six times — recitation scored as reading, which INFLATES the score. |
| C13 [H] | **A preposition that lies** | Writing `on` because `under` is untaught. Fix the plot, not the line. |
| C14 [M] | **Title problems** | Spoils the twist, is a noun-stack, is verbatim line 1, or has an adult reading. |

## D. The child
| # | Kind | Example |
|---|---|---|
| D1 [M] | **Decodable but not KNOWN** | `nip` (7.9), `hut` (8.1), `jogs` (6.2). Age of acquisition ≠ decodability. |
| D2 [M] | **Unrated words defaulting to PASS** | `yap`, `lug`, `quiz`, `yup` had no rating, so the gate waved them through. |
| D3 [M] | **The exemption list eating the test** | Title Case made `ox`, `rats`, `vans`, `quits` look like people's names — the words under test were exempted. |
| D4 [M] | **A blocked word reaching the page** | The blocked-word list was checked for one item type and not the other. |
| D5 [M] | **A pseudoword that is not one** | Real word, name, brand, homophone, doubles-to-real, silent-e-to-real, bare rime. |
| D6 [M] | **A stale word list** | The "is this a real word" filter ran on a 1934 dictionary, so `mic` passed as nonsense. |
| D7 [M] | **Name collisions** | Name = common noun; two names one letter apart; a name that reverses to a known word. |
| D8 [M] | **Known word, unknown SENSE** | `pop` meaning *put*; `cap` as hat in one item and lid in another. |
| D9 [M] | **Unresolved distress** | A character is sad and nothing on the page ends it. |
| D10 [H] | **Peer-competence comparison** | "X can not do it, but Y can" — handed to the child who is struggling. |
| D11 [M] | **`X is a Y` identity statement** | "A mug is a pot." A literal five-year-old reads it as false. |
| D12 [H] | **Phone-call topics** | Hand-feeding strays, charging at animals, trapping insects, pork, nuts, knives, sharps. |
| D13 [H] | **Assumed home context** | A pet, a farm, a garden, food always available. |
| D14 [M] | **Examiner material on the child's page** | Rationale notes naming the very pseudowords they reject. |
| D15 [M] | **The instrument penalising comprehension** | Apostrophes are undecodable, so the text says "can not"; a child who reads for meaning says "can't" and is scored an error. |
| D16 [M] | **Gendered agency across the set** | 28 masculine pronouns to 1 feminine; every repair done by the father. |
| D17 [H] | **Every word known, the event unknown** | Waxing a log, composting. Vocabulary is not comprehension. |
| D18 [H] | **Cast diversity over a year** | 29 names, 3 not Anglo, in an instrument every child sits. |

## E. The set as a whole
*Invisible to any per-item check. Needs its own checker.*

| # | Kind | Example |
|---|---|---|
| E1 [M] | **Repeated endings** | 13 of 27 ended on "It is fun". |
| E2 [M] | **Over-used vocabulary** | `pup` in 36 places, `mud` in 23. Check word FAMILIES, not just words. |
| E3 [M] | **Over-used characters** | Mom or Dad in most items. Count characters separately from vocabulary. |
| E4 [M] | **Duplicate and near-duplicate titles** | Exact match is not enough. |
| E5 [M] | **Repeated plots** | "Animal gets muddy, is rubbed with a rag" five times. |
| E6 [M] | **Pacing steps between neighbours** | 46 words then 76 words. |
| E7 [M] | **Repeated openings** | 8 of 27 opened `<Name> and <Name> sit…`. |
| E8 [H] | **The dominant speech act** | 19 of 72 quoted lines were prohibitions. Over a year the instrument's main word is *no*. |

---

## F. The fix as a source of defects
*Added 2026-08-05, after a session where every one of these happened in a day.
This class is invisible at the moment of the edit and only a diff finds it.*

| # | Kind | How it showed up here |
|---|---|---|
| F1 [M] | **A fix that removes the only instance of something else** | Rewriting L31 removed the only girl in the set with a named feeling. |
| F2 [M] | **A rename the checker does not know about** | `raj` → `jin` made the cast-diversity metric read *worse*, because the "non-Anglo" list was hardcoded and had never heard of `jin`. |
| F3 [H] | **A fix that reverts an earlier hand-correction** | Regenerating L11's sentences put back "The man is tan" — a skin-colour word describing a person — removed by an earlier pass. |
| F4 [H] | **A fix that trades one collision for a worse one** | `Pam` → `Min` fixed `pam`/`map` and created `Min`/`in`/`bin`. `in` is the commonest word in the corpus, so the confusable moved from one line to nearly every line. |
| F5 [H] | **A true sentence made false to silence a rule** | "Buds rot in a hot bin" → "Mud can rot in a hot bin". Mud does not rot. |
| F6 [H] | **A correct verb replaced by an impossible one** | "sets a bun" → "tips a bun". You tip a container, not a bun. |
| F7 [H] | **A causal step deleted, leaving the outcome asserted** | "pop the rug in a tub" (washing) → "tug the rug up", then "the mud is not on the rug". Nothing cleans it now. |
| F8 [H] | **A content beat inserted purely to satisfy a check** | "Jen is sad." … "Jen is not sad." added to clear a corpus finding about girls having feelings, resolving nothing in between. |
| F9 [M] | **Edited content invalidates saved user data** | Changing five passages changed their word counts. Saved records keyed on word count then failed to open, left the tool half-switched, and the next click overwrote a *different* child's record. **When content is versioned and user data references it, check the open path.** |

## G. The review itself
*The kinds that no single reviewer can see, and the roles that see them.*

**The headline lesson of 2026-08-05: a 28KB `WRITING-RULES.md` sat in this repo,
enforced by no checker, and twelve passages were rewritten without it being
opened. Rule 3.1 named the exact defect that got reintroduced, at the exact
lesson number.** If a standard exists and nothing enforces it, it is *more*
important to read, not less — nothing else will catch you.

| # | Kind | Guard |
|---|---|---|
| G1 [H] | **Optimising the number instead of the thing** | A falling finding count is evidence about the *checker*, not the content. Always report what the count measures. Here 117→25 was 63 content fixes and 29 checker edits, presented as one number. |
| G2 [H] | **An unread standard** | Read every `*-RULES.md` / `*-SKILL.md` / `*-CATALOGUE.md` **before** touching content. |
| G3 [H] | **Content and tooling changed in one pass** | A green harness then vouches for prose nobody read. Do them separately. |
| G4 [H] | **Findings acted on without verification** | Reviewer output is not fact. Refute each finding independently before it drives an edit or reaches a teacher. |

### What each reviewer must do
Run these as **separate** agents. One agent doing all of it does none of it.

1. **Standards reviewer** — reads `WRITING-RULES.md` in full *first*, then holds
   every item against it, citing rule numbers and quoting the offending text.
   Also: does each lesson contain the sound it is named for? *This is the only
   reviewer that can catch prose defects, because no gate encodes any of it.*
2. **Checker auditor** — for every checker change asks "did this get weaker
   while claiming to get stronger?" Constructs an input that *should* flag and
   confirms it still does. Separates content fixes from checker edits by running
   the **old checker against the new data**.
3. **Child reviewer** — reads all items end to end, in order. Dangling
   references, unresolved feelings, actions with no motivation, walk-on
   characters who do the pivotal thing and vanish. Judges new vs. old **on the
   merits**, not on whether findings fell.
4. **Assessment-validity reviewer** — does each item still measure what its
   `skill` claims? Is Form B still independent of Form A? Has difficulty drifted
   across the score bands the tool reports in? Are the `*_note` claims *true of
   the data as it now stands*?
5. **Software reviewer** — drives the real page. Escaping, stale state,
   save/open/print/export paths, and anything that touches **user data written
   before the change**.
6. **Integrator** — owns the seams: fix-induced regressions (section F), rule
   collisions, severity drift, sign-off honesty. *Four specialists produce four
   green lights and a broken whole without this role.*

### The checks that did not exist — now `formb/audit_writing.py`
`WRITING-RULES.md` carried **53 rules, 18 marked [MECHANICAL], each shipping the
check that would enforce it**, and even naming the file it belonged in. It was
enforced by nothing for a day, which is how twelve passages were rewritten
straight through it. An independent sweep then held all 36 lessons against it
and found **337 problems, most older than that session** — the standard had been
a diagnosis of this corpus since the day it was written, and the diagnosis was
never acted on.

`audit_writing.py` now executes the mechanical ones (1.2, 1.5, 3.2, 4.1, 7.6,
8.2, 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, plus target-sound-present), each with a
self-test proving it fires on its own example and stays quiet on a clean
passage. It is wired into `verify_all` section 9, and its HIGH backlog is
recorded in `verified.json` so it **can only shrink** — a fresh violation fails
the run, proved by injection.

Three things that only showed up once the rules were executable:

- **A checker's own examples can be wrong.** Rule 7.6 flagged the "clean"
  control case in the self-test, and it was right — the title really did contain
  every content word of line 1. The self-test earns its keep by catching the
  test author, not just the content.
- **Stripping names hid the real difference.** The 10.2 check compared content
  words with character names removed, so *"Pip can not tip it up"* and *"Nan and
  Pip tip it up"* looked like the same line turned by `not`. Nan joining in is
  the whole resolution. Never normalise away the thing the rule is about.
- **Some violations are arithmetically forced.** Lesson 22 is named `k /k/`; the
  decodable vocabulary there holds exactly two k-words; Form A spends both. Put
  either back and gate 3 refuses at 9% overlap against a 5% ceiling. Recorded as
  a sign-off with the measurement, not "fixed" — and the sign-off states plainly
  that Lesson 22's score measures short-vowel decoding, **not** /k/.

**The judgement rules stay human** and are printed at the end of every run, so a
green mechanical pass is never mistaken for a green page.

## H. Why a review does not converge — read this before starting one

*Written 2026-08-05, at the end of a day where six review passes each found new
defect classes and the teacher rightly asked why scanning kept producing new
problems. The answer is structural, and it is the most useful thing in this file.*

**A review that finds new problems every time is not thorough. It is badly
ordered.** Two causes, both avoidable:

### H1. Serial lenses. Six firsts, not six repeats.
Each pass applied a DIFFERENT lens — decodability, curriculum, child-facing
content, checker integrity, prose, tool behaviour — and each found its own class
of defect exactly once, because each was **the first time that lens had ever been
applied**. The dimensions were already named in this file before that day began.

> **Run every lens at once, before fixing anything.** Six parallel reviewers on
> a frozen artifact converge. Six serial reviewers on a moving one cannot.

### H2. Fixing between scans. The target moved while people aimed at it.
Roughly ten defects that later passes "found" had been introduced by earlier
passes *that same day*: a singular article on a plural noun (×8), nuts placed
into a lesson where nut allergy is the commonest food protocol, two taught heart
words deleted, an object made to `sit`, a walk-on character promoted to the one
who resolves three stories, and a true sentence replaced by a false one.

Section F is that class. It means **fixing is itself a defect source**, so a
scan-fix-scan-fix loop diverges by construction.

### The order that converges

```
1  FREEZE the artifact. No edits from here until step 4.
2  RUN every lens in parallel — the six roles in section G.
3  TRIAGE into ONE list. Adversarially verify each finding before acting.
4  FIX once, as a single pass, re-running the mechanical checks after each edit.
5  VERIFY once, all lenses again, on the frozen result.
6  SHIP, or record what is left with its measurement.
```

Step 5 is where convergence gets proved. If it finds a new *class* — not a new
instance — the lens set in section G is incomplete, and the fix is to add a
reviewer, not to run the same ones again.

### What "done" honestly means

Not "no scan finds anything" — that is unachievable and chasing it is how a
project never ships. It means:

- **Every KIND in this catalogue has an executable check**, so instances are
  found by machine on pass one and never by a human twice.
- **Every rule that cannot be mechanised has a named reviewer** (section G) who
  ran, on the final frozen artifact.
- **What is left is measured, recorded, and guarded against growing** — a
  baseline that can only shrink, with a written reason required to raise it.

By that definition the count of remaining findings is not the measure. **The
measure is whether a NEW KIND can still appear.** If one can, the instrument is
under-instrumented, however green the run.

### The specific hole that cost the most here

For six audit passes nothing in this project could read PROSE. Every gate
checked decodability, curriculum correspondence and data integrity, and every
run was green — while the text contained a sentence saying mud rots, a child
told not to tap a bug and then hitting it with a pot, and a resolution where
tugging a rug upward removes mud from it.

A 28KB `WRITING-RULES.md` had been sitting in the repo the whole time, with 18
rules marked **[MECHANICAL]**, each shipping the check that would enforce it. It
was a specification nobody had built. **A standard that no runner executes is a
wish**, and a green suite that cannot see the standard is worse than no suite,
because it says "checked".

Second-largest hole: **nothing had ever opened the tool.** One QA pass driving
the real page found eleven bugs, two of which produced wrong scores about a
child — including every word-list lesson scoring a whole sentence as one word.
Six content audits could not have found any of them.

## The three rules that matter most

1. **Every gate must be proven to REFUSE.** Keep a self-test that hands each
   gate an input it must reject, and for the stated reason. A gate with no
   falsification test is decoration. Class A exists because this was skipped.

2. **Every finding becomes a permanent executable check.** Fixed by hand, it
   recurs. Turned into code, it cannot. Require auditors to deliver the code.

3. **Record what you cannot fix, with the measurement.** At Lesson 6 there are
   zero legal pseudowords. At Lessons 7–12 the published sheet already spends
   every on-target word that exists. Those are limits of the language, and
   writing them down with the number beats a workaround that hides them.

## And the trap to avoid at the end

Chasing the last few corpus-level findings caused three regressions in a row —
each substitution collided with another gate. When constraints are this coupled,
**record a signed baseline instead of optimising**. A number with a written
reason beside it is finished work; an unexplained number is not.
