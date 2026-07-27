# EdTech Portfolio

Classroom tools built by a teacher of fourteen years in 3rd and 4th grade,
working with Claude Code. The through-line is **teacher judgement encoded as
software constraints** — not "AI makes a worksheet," but systems where the
pedagogy is written down as rules a machine can enforce and a second component
can verify.

---

## Start here: the Decodable Passage Engine

**[`decodable-passage-generator/`](decodable-passage-generator/)** —
[engineering notes](decodable-passage-generator/ENGINEERING.md)

A correctness system for early-literacy text. A child on Lesson 41 needs a story
built *only* from the sounds taught through Lesson 41; one untaught letter
pattern and the child guesses, which is the exact habit decodable text exists to
prevent. A passage that is 98% correct is broken.

**What makes it worth reading:** nothing ships unless a component that did not
write it can prove it is correct, and the failure modes were found by adversarial
agents rather than by hoping.

| | Words wrongly passing at Lesson 41 |
|---|---|
| First version of the checker | 15,764 of 87,119 (18.1%) |
| After three rounds of adversarial review | **57 of 87,119 (0.07%)** |

A 277× reduction. **71 regression tests**, every one a word that beat an earlier
version.

Along the way the loop caught a checker that rejected every word containing `q`
at every lesson, a rulebook that made three lessons impossible to write, and
**17 typos in the source curriculum** — including a lesson that taught a concept
the published scope and sequence does not contain.

**Honest status:** the rulebook, the auditor, the page checker, two skills and
one complete 4-page sheet are built. The writer that generates the other 127
sheets is not. That is stated in the docs rather than implied away.

---

## Also here

| Project | What it is |
|---|---|
| `phonics-assessment-tool:` | UFLI Foundations tracker with a worksheet generator. All 128 skills produce printable practice sheets across six sheet types. |
| [`factor-field/`](factor-field/) | Times-tables practice tool. |
| [`weekly-family-newsletter/`](weekly-family-newsletter/) | Family communication template. |

---

## How this repo is built

**Skills** in [`.claude/skills/`](.claude/skills/) hold the rules that must not
drift — copyright constraints, fine-motor sizing for K–2 hands, the
generate → audit → fix → re-audit loop. They are procedure cards: written once,
followed the same way every time.

**Constraints come from the classroom, not from the code.** Writing lines are
80px because a child is still learning to hold a pencil. Drawing boxes get their
own sheet because a squeezed box is always the wrong size. When a page overflows,
the fix comes out of adult text — never the child's working space.

**Judgement calls are visible.** Every inference the system makes about the
curriculum is a note in source, and every correction cites what the source says
against what the published standard teaches.

---

## Copyright

Scope and sequence is a shared teaching method and free to follow. Sight words
come from the public-domain Dolch list (1936); the Fry list is not free and is
never used. No published program's wording, word lists, or page design is
reproduced — all text and layout here is original.
