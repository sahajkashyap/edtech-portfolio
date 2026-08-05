# Classroom tools, built by a teacher

Fourteen years in elementary classrooms, grades 1 through 6. These are the tools
I wanted while I was teaching, built so the judgement stays with the teacher and
the counting does not.

---

## The one to look at first: a running record

**If you have never seen one done:** a child reads a short passage out loud
while the teacher sits beside them with their own copy and marks every word. The ones the
child got. The ones they missed. The ones they went back and fixed by themselves.

At the end you know how accurately they read, how quickly, and, far more useful
than either, **what they were doing when they went wrong.** A child who reads
*"pony"* for *"horse"* is not making the same mistake as a child who reads
*"house"* for *"horse"*. One is following the story. The other is following the
letters. They need different lessons on Monday.

It tells you more about how a child reads than any single number can. It is
also slow. Marking one takes about as long as the reading, and then scoring it takes as long
again. So it usually happens twice a year, and by the time anyone uses it to
decide which children work together, and on what, the reading is months old.

### What this tool does about that

It is the paper form, on a screen, with the arithmetic already done.

The teacher taps each word the child misreads and picks what happened. The
running total, the accuracy, the reading rate and the error rate are all correct
the moment they look up. One record per child, printable for whoever asked for
it, exportable as a spreadsheet for the whole class.

**Marking takes about as long as the reading, and then you are finished.** That is
the entire point. Fast enough to run every few weeks instead of twice a year, so a
child in the wrong group could be moved after six weeks rather than half a year.

### Passages and word lists are not the same measure

The set is **36 items: 27 passages and 9 word lists.** That split matters, and it
is the same point as the horse and the pony. A word list has no story to follow,
so it cannot show you whether a child was reading for sense. It shows you whether
they can decode words in isolation, which is a different and narrower question.

The tool treats them differently because of it. A word list gets no reading level,
because the accuracy cut-offs are built for passages and do not transfer: the same
child with the same three errors came out at two different levels depending only
on which sheet they sat.

### A note on what the marks mean

Recording *what a child was using* when they went wrong is called cue analysis,
and the field genuinely disagrees about it. Structured-literacy people argue that
treating meaning as a legitimate cue teaches children to guess, and I think that
argument is largely right; the rest of this repo is built on it.

The tool takes no side. It records the mark the teacher made and adds it up. A
teacher who wants to note that a child sailed past *"A cat nap in a pot"* without
noticing can, and a teacher who thinks that observation is beside the point can
leave it blank. What it never does is turn either into a recommendation.

### What it will not do

It will not tell you how well a child is reading.

Every number on the screen is arithmetic on marks a teacher made. There is no
suggested reading level, no recommended next lesson, no flag saying a child is at
risk. Those judgements belong to the person who was in the room.

The tool counts; the teacher decides.

Where it cannot honestly compute something, it says so on the sheet instead of
producing a number anyway. Three items tell the teacher, in the panel beside the
text, that they do not measure the sound the lesson is named for. Two of them
cannot, because the practice version of the test has already used every word
carrying that sound. One cannot because the only word in English that would work
is on the blocked list.

- **▶ [See a finished record](https://sahajkashyap.github.io/edtech-portfolio/running-record-tool/worked-example.html)** &mdash; a child called Maya, one reading, and what her teacher does next
- **▶ [Try the tool](https://sahajkashyap.github.io/edtech-portfolio/running-record-tool/)** &mdash; nothing to install, nothing leaves your laptop
- **▶ [Read all 36 items](https://sahajkashyap.github.io/edtech-portfolio/running-record-tool/all-lessons.html)** &mdash; exactly as a child sees them

The tool uses the field's shorthand once you are inside it: a *miscue* is a
misread word, and Form A and Form B are two versions of the same test, so a child
can be read twice without re-reading what they practised.

*Maya is invented. Her numbers are not: every figure came from marking that
passage in the tool itself.*

---

## How the reading passages are checked

**[`running-record-tool/`](running-record-tool/)** &middot;
[what it decides and what it does not](running-record-tool/DESIGN.md) &middot;
[the writing standard](running-record-tool/formb/WRITING-RULES.md)

The 36 items are 27 passages and 9 word lists, and none of them is written
freehand. A child on Lesson 20 must meet
only sounds taught through Lesson 20, so each one goes through six content checks,
a check on whether a six-year-old actually knows each word, and a writing standard
of 53 numbered rules.

Maya's page shows why that matters in practice. She reads at 93%, which the tool
scores as *Instructional*: right for teaching with support. That does not tell a
teacher what to teach. The pattern does. She dropped the **-s** three times, on the lesson
named for the **-s**, and got every base word right.

| | Writing-rule violations |
|---|---|
| Before the standard was machine-checked | 102 |
| After | **14**, each remaining one measured and recorded |

The test suite falsifies its own checks: every gate must prove it can still
refuse before a run is allowed to pass. That caught a checker that could never
flag the most common error it was written for, a sign-off that had silenced nothing
since the day it was written, and eleven bugs in the tool itself. Two of those were
scoring a child wrongly.

---

## Stories a child can actually sound out

**[`decodable-passage-generator/`](decodable-passage-generator/)**, with
[engineering notes](decodable-passage-generator/ENGINEERING.md)

A correctness system for early-literacy text. A child on Lesson 41 needs a story
built *only* from the sounds taught through Lesson 41; one untaught letter
pattern and the child guesses, which is the exact habit decodable text exists to
prevent. A passage that is 98% correct is broken.

**What makes it worth a look:** nothing ships unless a component that did not
write it can prove it is correct, and I ran adversarial agents at it rather than
hoping.

| | Words wrongly passing at Lesson 41 |
|---|---|
| First version of the checker | 15,764 of 87,119 (18.1%) |
| After three rounds of adversarial review | **57 of 87,119 (0.07%)** |

A 277× reduction. **81 regression tests**, every one a word that beat an earlier
version.

**123 of the 128 lessons now have a decodable story and a printable four-page
packet**: 6,749 words, 492 pages, every one through the gate and every sheet
measured to fit. Lessons 1–5 have none, because at Lesson 1 there are zero words
a child can sound out and by Lesson 5 there are five. You cannot write a story
from five words.

Along the way the loop caught a checker that rejected every word containing `q`
at every lesson, a rulebook that made three lessons impossible to write, and
**17 places where my curriculum data and the published sequence disagreed**, each
one recorded with what I found and what I changed.

**Honest status:** the rulebook, the auditor, the word bank, the page checker,
the writer, two skills and 123 stories are built. Still open: a story-quality
judge, and richer early vocabulary. `and` is unavailable until Lesson 35 and
subject pronouns until 66, so the earliest stories repeat the character's name.

Every word is also checked against a 132-word blocked list with no exceptions,
covering the story, title, warm-up words, questions and the grown-up answer
notes. I had an agent read all 123 stories looking for anything a parent
would object to, with no knowledge of who wrote them.

---

## Also in this repo

**Try these in your browser too:**
[Phonics tracker](https://sahajkashyap.github.io/edtech-portfolio/phonics-assessment-tool/) &middot;
[Times tables](https://sahajkashyap.github.io/edtech-portfolio/factor-field/) &middot;
[A finished reading sheet](https://sahajkashyap.github.io/edtech-portfolio/decodable-passage-generator/example-lesson-41.html)


| Project | What it is |
|---|---|
| [`running-record-tool/`](running-record-tool/) | Running record marking tool, 36 assessment items, MSV cue analysis. [Worked example](https://sahajkashyap.github.io/edtech-portfolio/running-record-tool/worked-example.html) · [design note](running-record-tool/DESIGN.md) |
| `phonics-assessment-tool` | UFLI Foundations tracker with a worksheet generator. All 128 skills produce printable practice sheets across six sheet types. |
| [`factor-field/`](factor-field/) | Times-tables practice tool. |
| [`weekly-family-newsletter/`](weekly-family-newsletter/) | Family communication template. |

---

## How this repo is built

**Skills** in [`.claude/skills/`](.claude/skills/) hold the rules that must not
drift: copyright constraints, fine-motor sizing for K–2 hands, the
generate → audit → fix → re-audit loop. They are procedure cards: written once,
followed the same way every time.

**Constraints come from the classroom, not from the code.** Writing lines are
80px because a child is still learning to hold a pencil. Drawing boxes get their
own sheet because a squeezed box is always the wrong size. When a page overflows,
the fix comes out of adult text, never the child's working space.

**Judgement calls are visible.** Every inference the system makes about the
curriculum is a note in the source, and every correction records what my data
said, what the published sequence says, and which one I changed.

---

## Copyright

A scope and sequence is the order skills are taught in, not a method, which is
why it is free to follow. Sight words
come from the public-domain Dolch list (1936); the Fry list is not free and is
never used. No published program's wording, word lists, or page design is
reproduced. All text and layout here are original.
