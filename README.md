# EdTech Portfolio

Classroom tools built by a teacher of fourteen years across grades 1 through 6,
working with Claude Code. The through-line is **teacher judgement encoded as
software constraints** — not "AI makes a worksheet," but systems where the
pedagogy is written down as rules a machine can enforce and a second component
can verify.

**▶ Try the tools in your browser — nothing to install:**
[Phonics Assessment Tracker](https://sahajkashyap.github.io/edtech-portfolio/phonics-assessment-tool/) ·
[Factor Field](https://sahajkashyap.github.io/edtech-portfolio/factor-field/) ·
[Math Tracker](https://sahajkashyap.github.io/edtech-portfolio/math-assessment-tool/) ·
[A finished decodable sheet](https://sahajkashyap.github.io/edtech-portfolio/decodable-passage-generator/example-lesson-41.html)

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

A 277× reduction. **81 regression tests**, every one a word that beat an earlier
version.

**123 of the 128 lessons now have a decodable story and a printable four-page
packet** — 6,749 words, 492 pages, every one through the gate and every sheet
measured to fit. Lessons 1–5 have none, because at Lesson 1 there are zero words
a child can sound out and by Lesson 5 there are five. You cannot write a story
from five words.

Along the way the loop caught a checker that rejected every word containing `q`
at every lesson, a rulebook that made three lessons impossible to write, and
**17 typos in the source curriculum** — including a lesson that taught a concept
the published scope and sequence does not contain.

**Honest status:** the rulebook, the auditor, the word bank, the page checker,
the writer, two skills and 123 stories are built. Still open: a story-quality
judge, and richer early vocabulary — `and` is unavailable until Lesson 35 and
subject pronouns until 66, so the earliest stories repeat the character's name.
Both are stated in the docs rather than implied away.

Every word is also checked against a 132-word blocked list with no exceptions,
covering the story, title, warm-up words, questions and the grown-up answer
notes. An independent reviewer read all 123 stories for content a parent would
object to; what it found is in the git history.

---

## Also here

| Project | What it is |
|---|---|
| `phonics-assessment-tool` | UFLI Foundations tracker with a worksheet generator. All 128 skills produce printable practice sheets across six sheet types. |
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
