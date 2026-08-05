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
