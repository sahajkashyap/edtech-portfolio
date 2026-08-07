# Classroom tools, built by a teacher

Fourteen years in elementary classrooms, grades 1 through 6. These are the tools
I wanted while I was teaching, built so the judgement stays with the teacher and
the counting does not.

---

## The one to look at first: Word by Word, a running record tool

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

The passage is on the teacher's screen and the child reads from paper. The
teacher taps each word the child misreads and picks what happened. The running
total, the accuracy, the reading rate and the error rate are all correct the
moment they look up. One record per child, printable for whoever asked for it,
exportable as a spreadsheet for the whole class.

It prints the child's sheet too: the passage on its own, in large type, nothing
marked on it, sized so that no sentence wraps onto a second line.

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
[what it decides and what it does not](running-record-tool/DESIGN.html) &middot;
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

Eleven tools, all of them ordinary browser pages. Nothing to install, no account
to make, and nothing leaves the laptop they are opened on.

The six subject trackers below work the same way, because a teacher should not
have to learn a new tool for each subject. Every skill is marked **Emerging,
Developing or Mastered**, the chart redraws as you go, there is a box for
strengths and one for next steps in the teacher's own words, and the whole thing
prints as a report for a conference.

### Reading and writing

| Tool | What it is |
|---|---|
| [`running-record-tool/`](running-record-tool/) | The marking screen: tap each misread word, pick what the child did, and the accuracy, rate and error rate are counted for you. 36 assessment items, MSV cue analysis. [Worked example](https://sahajkashyap.github.io/edtech-portfolio/running-record-tool/worked-example.html) · [design note](running-record-tool/DESIGN.html) |
| [`decodable-passage-generator/`](decodable-passage-generator/) | The index of all 128 lessons, 123 of them with a printable four-page packet. [A finished sheet](https://sahajkashyap.github.io/edtech-portfolio/decodable-passage-generator/example-lesson-41.html) |
| [`phonics-assessment-tool/`](phonics-assessment-tool/) | UFLI Foundations tracker with a worksheet generator. All 128 skills produce printable practice sheets across six sheet types. |
| [`reading-assessment-tool/`](reading-assessment-tool/) | Six reading skills, from decoding two-syllable words to retelling a story and finding the main topic of an informational text. |
| [`writing-assessment-tool/`](writing-assessment-tool/) | Seven writing skills, from printing upper and lower case letters to revising and editing with guidance. |

### Across the other subjects

| Tool | What it is |
|---|---|
| [`math-assessment-tool/`](math-assessment-tool/) | Five units and 57 lessons, marked one lesson at a time: place value, addition, subtraction and money, geometry, graphing. Choose a single unit or see the whole year. Exports as PDF, CSV or JSON. |
| [`science-assessment-tool/`](science-assessment-tool/) | Six skills, including describing the properties of materials and living things, and planning, building and testing a design. |
| [`social-studies-assessment-tool/`](social-studies-assessment-tool/) | Six categories, including using maps and globes, identifying roles in a community, and taking part in shared research. Exports as PDF, CSV or JSON. |
| [`social-emotional-assessment-tool/`](social-emotional-assessment-tool/) | Six skills: routines and directions, self-regulation, empathy, persistence, conflict resolution, and asking questions. |
| [`factor-field/`](factor-field/) | Times-tables practice tool. |

### For families

| Tool | What it is |
|---|---|
| [`weekly-family-newsletter/`](weekly-family-newsletter/) | Family communication template: what the class did this week, in a page a parent will read. |

---

## Three more, in their own repos

Same idea, three separate repositories. All of them run in a browser, and each
one opens on real content rather than an empty screen.

**[Bathysphere](https://sahajkashyap.github.io/bathysphere/)** builds
reading-comprehension question sets at four levels of demand: literal,
inferential, analytical, evaluative. Open-ended with answer keys, or multiple
choice, 5, 8 or 10 questions at a time. Eight public-domain books are loaded,
from Aesop and *Peter Rabbit* through *Tom Sawyer* to *Frankenstein* and *Pride
and Prejudice*, covering grade bands K&ndash;1 to 11&ndash;12, and every
question carries a CCSS ELA standard. It runs with no login and no API key.

In the **[Class-Aware Unit Generator](https://sahajkashyap.github.io/unit-generator/)**,
a book title and a grade band become a full ELA unit: a three-week arc,
day-by-day scripted lessons that say what the teacher says and does, passages
and questions at three levels, vocabulary, graphic organizers, and support for
English learners. There is a live demo and a complete 15-lesson sample unit to
read.

The **[Whole-Child Assessment Suite](https://sahajkashyap.github.io/whole-child-profile/)**
takes the subject trackers and the social-emotional one, fall and spring across
seven areas, and gathers them into a single page for a parent. The demo is
populated with a sample second-grader.

---

## How this repo is built

**Skills** in [`.claude/skills/`](https://github.com/sahajkashyap/edtech-portfolio/tree/main/.claude/skills) hold the rules that must not
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
