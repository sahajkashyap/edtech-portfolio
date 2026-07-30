# Decisions, and what changed because of them

A running log. Newest first. Each entry says what was decided, who decided it,
and why — so nobody re-litigates a settled question or re-derives a reason.

"The teacher" is the classroom teacher this tool is built for and by; fourteen
years across grades 1–6. When their judgement and a published convention
disagree, their judgement wins and the entry says so.

---

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
