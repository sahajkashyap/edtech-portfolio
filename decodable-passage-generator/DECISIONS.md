# Decisions, and what changed because of them

A running log. Newest first. Each entry says what was decided, who decided it,
and why — so nobody re-litigates a settled question or re-derives a reason.

"The teacher" is the classroom teacher this tool is built for and by; fourteen
years across grades 1–6. When their judgement and a published convention
disagree, their judgement wins and the entry says so.

---

## 31 July 2026 — The grown-up's instructions fold off the child's page

**The teacher's observation, and it reframes what a worksheet is for.**

The instructions sat beside the words. Their objection: *a child seeing all
those words next to the thing they are practising can feel overwhelmed — "what
is all this stuff I have to figure out?"* A five-year-old cannot read a
paragraph of adult text. What they can do is see that a page is **full of
words they cannot manage**, and decide the page is hard before they have
started.

So on every words page the adult text now sits at the **foot of the page**,
under a **dashed line the grown-up can fold back or tear off**, headed
plainly **"Instructions for the grown-up."** Once it is folded, the child is
holding a page with nothing on it but the words they are there to read.

Three things this gets right at once, which is why it is worth recording:

1. **It removes cognitive load from the child** without removing information
   from the adult. Nothing was cut — it moved.
2. **It puts the guidance where it is used.** The parent reads it while looking
   straight at the dots it describes, rather than a page away.
3. **It is a physical affordance a five-year-old understands.** A fold is not
   an instruction to be read; it is a thing that happened to the paper.

### What filled the space

The words grew — **up to 128px** where a lesson has only one — and they now sit
centred in the space above the fold rather than pinned to the top with a hole
beneath them. A lone small word marooned on a page reads as a mistake.

**The word lists could not simply be padded.** At Lesson 2 the entire readable
vocabulary of the language, given the letters taught, is the word *am*. Lesson
3 adds *Sam*. There is nothing being withheld. So what fills the page is
**re-reading**, not more words: a read-them-3-times row with circles to colour.
For a first reader, a word is learned by meeting it again, not by meeting more
of them.

### The layout detail worth keeping

The fold block is pushed to the foot of the page with `margin-top: auto` in a
flex column, so the fold lands in the same place whatever the words above it
need. That put its bottom edge exactly on the page boundary and read as a 0.2px
overflow; an 8px bottom margin makes it stop just short. Worth knowing, because
the page-fit checker is right to be that strict and should not be loosened.

## 31 July 2026 — Sound dots under the words, and the words made large

**Asked for by the teacher, who named the reason exactly right:** a small
finger moves much faster than a beginner can sound a letter out, so without
somewhere to land the finger outruns the eye and the tracking stops helping.

The words are now **84px** — roughly double — and every word carries a **dot
under each sound**, with the sweep arrow underneath.

This is the *touch-and-sweep* routine used across structured literacy: touch
each dot as you say its sound, then sweep along the arrow and say the whole
word. The dots give the finger discrete places to land.

**The nuance that decides the wording.** Dots and continuous blending pull
against each other: dots invite stopping on each sound, and stopping is exactly
what makes blending hard — "/m/ … /a/ … /t/" does not sound like *mat*. So the
two marks are given different jobs, and the instruction says both: **the dots
show WHERE each sound lives; the arrow says DO NOT STOP between them.** The
page reads "Touch each dot and say its sound. Then slide along the arrow
without stopping — and say the word."

One rule for anyone extending this: **one dot per grapheme, not per letter.**
At Lessons 1–5 every grapheme is a single letter, but a sheet using `sh` or
`ck` must give the pair a single dot, or it teaches the wrong split.

Because the words got much bigger, they no longer share a page with the letter
hunt and the picture sort — **they have a page of their own**, and Lesson 5's
word chain and act-it-out moved to theirs. Lessons 2–5 print four pages;
Lesson 1 prints three, having no words yet. That is the standing rule again:
add a page rather than shrink anything the child uses.

## 31 July 2026 — Lessons 1–5 get letter-and-sound sheets

**Asked for by the teacher; the design follows a research pass over published
programs.**

Lessons 1–5 had nothing, and the reason was real: Lesson 1 teaches only `a`, so
there is not a single word a child could read. Lesson 2 adds `m` and yields
exactly one word — *am*. A story is not possible until about Lesson 6.

**A finding worth keeping: UFLI itself has no home-practice sheet for Lessons
1–4.** Their home materials begin at Lesson 5 and their decodable passages at
Lesson 8. This gap is the program's gap, so filling it extends the sequence
rather than catching up with it.

### What the sheets contain, and where each part comes from

Lessons 1–4, three pages each — grown-up sheet, the letter, then practice:

- **Keyword anchor with the picture drawn into the letter's shape** — a—apple,
  m—mountains, s—snake, t—tent. Embedded mnemonics have direct research support
  (Ehri, Deffner & Wilce): a letter drawn into its picture needs fewer
  repetitions before the sound sticks.
- **Mouth check** — one line on what the lips and tongue do, and "look in a
  mirror together." Both CKLA and UFLI teach the articulatory gesture.
- **Letter formation**, the largest block: numbered stroke arrows, a start dot
  on every letter, three-line guides with a dotted midline, and the child says
  the **sound** each time they finish one.
- **Letter hunt** whose distractors are the letters already taught, so it is
  quietly cumulative review, and a **beginning-sound picture sort**.
- **A word line from Lesson 2 on**: am; then am, Sam; then am, at, mat, sat, Sam.

Lesson 5 is the blending sheet: sound strip, **continuous blending**
("mmmaaat", no gaps, then say it fast), blend-and-read lines with finger
arrows, Elkonin sound boxes including the child's first spelling, a
one-letter-change chain, and a small do-what-it-says.

Continuous blending beats choppy /m/ … /a/ … /t/ for beginners (Gonzalez-Frey &
Ehri, 2021). It is also why the sequence opens `a m s t`: m, s and a can be
stretched, t cannot, so the first blending words begin with m and s.

### Two corrections the research forced

- **"as" is out.** It is spelled with `s` but says /z/, and week one is no place
  for an exception.
- **"tam" is out** — it fails the age gate.

### Do the alphabet sheets need pictures, when the stories do not?

Yes, and the distinction matters. Story pictures were removed because a picture
of the plot tells a child what happens and stops them building meaning from the
words. **There is no plot in an alphabet lesson.** The picture holds a *sound*
in place; it is a memory hook, not a spoiler — and every mainstream program
anchors early letter-sounds to a picture. Exactly two kinds of drawing appear
on these five sheets, the keyword anchor and the sort pictures, and nothing else.

### What was dropped rather than shipped

**A drawing a child names wrongly is worse than no drawing** — in a /m/ sort it
actively teaches the wrong sound. Applied honestly, that cost us three things:

- the **t embedded in the tent** made the crossbar read as a mast, so it fell
  back to a plain bold `t` beside a clean tent. A legible letter beats a clever one.
- a standalone **snake** in the sort read as a worm, and a **spinning top** could
  be named a kite — both replaced.
- the **mouse** was dropped after two attempts, having read as something a child
  could as easily call a snail or a rock. Two clear targets in the /m/ sort beat
  three where one is a guess.

Also fixed on inspection: the lowercase **t was drawn as a bare cross** — no
hook at the baseline — which read as a dagger rather than the letterform
children are taught. It now turns right at the baseline.

### Left out deliberately, though real programs use them in class

Pseudowords (a parent will "correct" them), timed or scored anything (pressure
with no teacher's judgment in the room), cut-and-glue and card games (they
assume prepared materials; pencil-only survives a kitchen table), and uppercase
*writing* practice — capitals are shown but not practised, since most have
different shapes and it doubles the load.

## 30 July 2026 — The packet's final shape

**Decided by the teacher, refining the same day's earlier decisions.**

Every lesson now prints the same five pages, in the same order:

| Page | Who | What |
|---|---|---|
| 1 | Grown-up | How to use it, what to say when it goes wrong, the dictation sentence |
| 2 | Child | **Words first** — practice words, then heart words |
| 3 | Child | **The story, whole** |
| 4 | Child | **Draw it** (top half), then **write the sentence you hear** (bottom half) |
| 5 | Child | Three questions, still optional |

**The story is never split.** The teacher's reason: a child should meet it as
one whole thing, and turning a page mid-story costs them the thread. Every
story fits alone on a page. What does not always fit is the story *with* the
practice words above it — so the words moved, not the story. The furniture
gives way; the story does not.

**Practice words and heart words run down the page, not across it**, and much
larger — 30px cards one per line, heart-word boxes at 58px. On a page of their
own there is room, and a big word is easier to see and to point along.

**The drawing box came down to about half a page.** The teacher relaxed their
own standing rule here, deliberately and with a reason: children normally get a
third to a half of a page to draw on, and what was there was more than enough.
The freed half carries the writing lines, which puts the work in its natural
order — **read it, draw it, then write the sentence you hear.**

### Story type is now set per lesson, not per band

Giving each story its own page made this possible, and it is the change that
most affects what a child sees. Type is no longer a fixed size by lesson band —
it grows until the story fills its page. It ranges from **18px to 38px**, and
Lesson 45 went from 24px to 29px.

Two ceilings, and the tighter one wins:

- **height** — the lines must fit between the header and the fluency stars
- **width** — a line must NEVER wrap. The line is the unit a child points
  along, so a wrapped line is worse than smaller type. `wrap_check.py` renders
  every sheet in a browser and confirms it; it currently reports zero.

18px stays the floor, and the band size is now where a story *starts* rather
than a floor of its own: the two 23-line stories genuinely need 18px to stay
whole on one page, and keeping the story whole is worth more than three points
of type.

Where the width ceiling binds and height is left over, **the spare space goes
into line spacing** instead of sitting blank. More air between lines is easier
for a young reader to track, and it is space the child gets rather than loses.

## 30 July 2026 — No picture on the reading page

**Decided by the teacher. This reverses an earlier decision of theirs.**

The child's reading page had a small drawn scene above the story. It is gone.

The reasoning, in their words: the child is meant to build the picture in their
own mind from the words and then **draw that understanding**. A picture at the
top tells them what happens, so they read toward an answer they already have,
and the drawing page stops being a comprehension check and becomes copying.
This is how decodables are used in their school; the original picture was
adopted on an assumption about how other schools did it.

The design was already admitting the problem. The grown-up sheet instructed the
parent to **"cover the picture while they read."** An instruction that exists to
undo the harm of an element is an argument for removing the element. Both the
picture and that instruction are now gone.

`props.py` is untouched and still draws scenes; the reading page simply stops
calling it. The **drawing page keeps its full-size box** — that was never in
question.

The freed space goes to the child, and here is what it bought:

| | before | after |
|---|---|---|
| story type, by lesson band | 24 / 22 / 20 / 18px | **25 / 24 / 21 / 21px** |
| heart-word boxes | 25px | **42px** |
| pages in a typical packet | 4 | **5** |

**The type ceiling was not page height — it was line width.** A story line must
never wrap, because the line is the unit a child points along, so the largest
usable type is set by the single widest line in all 123 stories. The column was
widened three ways (print margins 0.6in → 0.5in, passage padding 22px → 12px,
proportional word-spacing) and every candidate size measured in a real browser.

**The cost, stated plainly:** 105 of 123 lessons now print five pages, 13 print
four, and 5 print six. That is the page count giving way instead of the child's
space — the rule working as intended — but it is more paper, and the lever if
it is ever too much is type size, not the child's room.

### A mistake worth not repeating

Setting the lines-per-page limits by measuring how much room was free does not
work, and the failure is not obvious. Measuring a page that just fits suggests
room to grow; filling it overflows; the next measurement shrinks it again. The
caps ping-pong and never settle, and one pass locked in a value where Lesson 45
had 318px free and a cap of five lines.

`measure_capacity.py` approaches from above instead: start with a cap no page
can meet, render, and shrink only what overflowed, by exactly how much it
overflowed. Monotone, so it terminates, and it stops at the true maximum rather
than somewhere timidly below it. One further trap: shrink from the lines
*actually on the page*, not from the cap — a cap of 14 on an eight-line story
does nothing until it falls below eight, and subtracting from the cap burns
rounds changing a number that has no effect.

## 30 July 2026 — One dictation sentence, chosen automatically

**Decided by the teacher after weighing it openly.**

The packet was entirely reading. Structured literacy treats decoding and
encoding as two halves of one skill — a child who can read *shed* but not spell
it has not finished learning it — and there was no writing anywhere.

Why it is safe here in a way a school dictation lesson is not: every word in
these stories is decodable with what the child has already been taught, and by
the time they write, they will have **read that exact sentence three times**. It
is not "spell this word." It is "write the sentence you just read."

**The sentence is chosen in code, never by the parent.** The teacher's reason:
parents do not want to make decisions, they want a black-and-white instruction.
It is also printed on the grown-up sheet, so a parent who brings the sheet to a
meeting can show exactly what was practised, with no mystery about it.

**The failure mode this is designed against** is a parent turning dictation into
a spelling test — saying it once, too fast, then correcting letter by letter. So
the parent's words are scripted: say it, say it again slowly, have the child say
it back, say the sounds together if they stick, and explicitly **this is
practice, not a test — do not mark it wrong.**

**Three-line handwriting rules**, not a single underline: top line, dotted
midline, baseline. The dotted midline is what tells a child how tall an *a* is
against an *h* and where a *g* drops below. Most home worksheets omit it and
children's letters come out every size. Generous height, two line-groups so a
sentence that runs on has somewhere to go. These are never compressed to make
something else fit.

## 30 July 2026 — Words a child can *say*, not just decode

Two gates already asked *can it be sounded out?* and *does a six-year-old know
it?* Neither asked whether a young mouth can produce it, or which of two
pronunciations is meant. All 123 stories were read aloud; 33 changed.

The worst class, and the reason `homographs.py` now exists: **a child sounds the
word out correctly by the rule they were just taught, and is told they are
wrong.** "Read" in the past tense, at a lesson teaching `ea` = /ee/. "Close"
and "live" at lessons teaching magic e. Six were live. That is the cruellest
thing a decodable can contain, because the child did everything right.

Also fixed: words known in the *other* sense (a child knows "bank" as money, not
riverbank; "cross" as a shape, not angry), and clusters young articulators
simplify — "baths" has one of the hardest endings in English and was being
shouted three times in Lesson 46.

Kept deliberately: "wind" (the breeze — short i is what the rules give and it is
correct), "tear" at the lesson that teaches `ear` saying /air/, and lesson-target
words whose stories teach their meaning through action.

## 29–30 July 2026 — All 123 stories read end to end

The highest-value item on the list, and the only one no checker could do. Four
readers took the whole sequence at a child's pace. **69 of 123 changed.**

Everything they found had passed every automated gate:

- Lesson 45 read **"Six wet cats!"** with nothing saying why they were wet —
  the "wet kits" problem again in another costume. Now six *sad* cats, hungry
  with no fish, which also explains the theft and the kindness.
- Lesson 113 had a pup at the bottom of a box, under pots, under a lid, with no
  account of how it got there.
- Lesson 97 had a cow put its head in a pot **boiling on hot coals**.
- Lessons 26 and 31 had the pup and the Dad solving the story while the child
  watched.
- Four titles were wrong: one gave away its only suspense, one promised a
  unicorn that never appears, one contradicted its plot, one counted ten bins
  that were never there.
- Three phantom narrators — third-person stories that suddenly say "our pup."

**Names were the biggest sameness problem.** Meg led 19 stories and Ben 18. No
name now leads more than 15 of 123, across 127 distinct characters.

Left alone on purpose, and flagged rather than patched: **Lessons 7 and 8 read
as chants**, because at Lesson 7 a child has about eight words available —
every alternative validated and read worse. **Lesson 33** is a cat with a cut
seen by a vet, which brushes the no-medical rule, and "vet" is essentially the
only realistic **v** story. Awaiting the teacher's call.

## 29 July 2026 — Stories reach a real reader's length

L91–128 sat at 113 words against a real reader's ~172. Now **162 average**;
the whole set went 10,607 → 12,593 words.

The constraint was the page, not the writing. **18px is the floor** for a
seven-year-old, so past Lesson 90 a story now takes a **second reading page**
rather than shrinking further. This is the standing rule in action: a child's
space is never cut to fit the paper — cut adult text or add a page, and type
size is the child's space as much as a drawing box is.

The grown-up sheet also stopped claiming "five minutes" for a story that takes
ten.

## 29 July 2026 — The third question stopped being a ritual

Of 85 third questions in Lessons 6–90, **61 ended "Tell me why"** and 29 opened
"Do you think." A child doing eight sheets met the same question eight times.
All 85 rewritten across ten kinds of thinking, none used more than nine times,
and no two consecutive lessons repeat a kind.

Seven questions asked for something the story never said. Two of those were
introduced the same morning, when Lesson 72's story became a colt and its
questions still asked about "the pup."

## 29 July 2026 — Affix lessons got their own words

Eleven lessons taught an affix that appeared **nowhere in their own word bank**.
Lesson 124 taught `-ness` from a warm-up strip reading *bed lamp dark room*,
while `darkness`, `kindness`, `happiness` and `sadness` sat unpractised in its
own story.

Derivational affixes cannot be generated the way `-s` and `-ing` are —
*unhappy* is a word and *unbed* is not, and no rule separates them — so 87 are
listed by hand and each still clears the auditor and the age gate. Ten were
rejected as too old or undecodable.

Same shape as the `er` gap: **the list was short, not the curriculum.**

## 29 July 2026 — Two curriculum decisions the teacher made

**Lesson 72 keeps its `-olt` pattern.** Every `-olt` word failed the age gate
(colt 9.0, bolt 7.3, jolt 9.4), so the lesson had quietly lost one of the five
patterns it teaches. `colt` is approved by name — concrete, and the same stated
reason `hen`, `log` and `pond` are approved. `bolt` and `jolt` stay rejected,
and the gate proved it by catching both when they were tried in the story.

**Lesson 80 has real `er` words.** It teaches `er` and only `her` survived the
gate. 33 two-syllable `er` words added; the warm-up strip went from one `er`
word to six.

---

# Guards added, and the bug each one exists for

Every guard here was written *after* something got through. None is theoretical.

| Guard | The bug it exists for |
|---|---|
| `audit_passage.py` | a word using a letter-sound the child has not been taught |
| `word_age.py` | `cod` at Lesson 18 — decodable, and learned at age 11.5 |
| `line_pointers.py` | an answer note saying "line two" after a rewrite moved line two |
| `homographs.py` | past-tense "read" at a lesson teaching `ea` = /ee/ |
| blocked-word list at the gate | `gun`, `kill`, `cop` — legal letters, wrong for children |
| `check_all.py` | a page that runs off the paper |

**The pattern worth keeping:** every one of these was found by a person reading,
or by an agent reading work it did not write. Not one was found by the checker
that now prevents it. Checkers catch what they were told to catch — so the
lesson is not "write more checkers," it is "keep reading the output, and write a
checker each time reading finds something."
