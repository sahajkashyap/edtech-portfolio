# Draft 07 — the reading assessment tool

**Type:** 🍽 Main course (project post)
**Post:** Tuesday 20 October 2026, week 43. Calendar slot 11.
**Status:** rewritten 6 Aug 2026 after Sahaj said the first version was
unrecognisable as the project. Half the length, no engineering, teacher-first.

**Post AFTER the project itself is up on LinkedIn.**

---

## BACKGROUND — Sahaj's own description of the tool

*Recorded 6 Aug 2026, in his words, because the first draft drifted away from
this and toward the software. Anything written about this project should be
checked back against this section.*

There is a paper form version of this that is somewhat similar to what I have,
where a teacher has to sit down with a child. It is almost like a spelling
inventory or a miscue analysis. It is to see how a child does when reading
certain passages and sentences.

**What it is for:**
- To verify what a child's reading ability actually is
- To decide what interventions need to be shared or discussed with a learning
  specialist or with families
- To put children in the right reading groups
- To help teachers figure out what level books a child should be reading:
  not too easy, not too hard, but appropriate for their level and appropriate
  to challenge them

**Why the build matters.** Doing these for every child twice a year is a
laborious process. It takes a long time to pull an individual child out of
class, and a teacher has to be with them one on one. The tool records the same
information but does it much more quickly, and it captures more data that is
useful to teachers, education specialists and families.

**What is in it, and why each piece is there:**
- **A timer.** How long a child takes may or may not be a factor, and now you
  have it either way.
- **A quick-click menu on every word.** If the child makes a mistake, maybe
  they pronounce it more than once, maybe they use a different word, maybe they
  skip it. Four or five choices. You mark it with a mouse, fast, while the
  child is still reading, instead of writing it out by hand as they go.
- **A score section to the side.** Everything written out, more visual, so an
  educator can see where this child is in terms of raw data at a glance. What
  goes into that corner can be explained very simply.
- **A notes section.** Right after you meet with a child you want to write
  something down. Sometimes you do it by hand. On a keyboard it is faster, and
  it lives in one spot with the record. Internal to the school, and shareable
  with the learning specialist.

**Coordinating the care of a child** *(added by Sahaj, 6 Aug 2026)*. The way I
looked at it and designed it, we are actually getting more information. It is
more granular and specific. It can be done more quickly, and it is just as
accurate. The information can be shared with the learning specialists without
having to do all this back and forth, so they can see what is being done and
focus on the children as the information comes in. And the children who are not
done yet, who have not been assessed, can clearly be seen. It is another way to
coordinate the care of a child. All the heads are behind the same steering
wheel with this.

*(His image. Kept here rather than in the post, because he does not reach for a
figure of speech in his own writing and the literal version lands harder.)*

**The argument.** It saves time. It gives more information. It is more accurate,
in a way that lets you compile more serious data on how a child is doing. And
the efficiency means: minimally we should be doing this twice a year, but if it
needs to be done more often, it can be, because it will not be a huge disruption
to a teacher who is already managing so many other balls in the air.

---

## WHAT THIS IS ACTUALLY CALLED — the naming question

Sahaj asked what other schools and publishers call this. Researched 6 Aug 2026.

**The tool is closest to an Informal Reading Inventory.** An IRI is built from
**graded word lists** (word recognition) **plus graded passages** (oral reading
and comprehension). That is exactly this tool's shape: lessons 6–14 are word
lists, 15–41 are passages. Commercial versions include the Qualitative Reading
Inventory (QRI) and Johns' Basic Reading Inventory. Reading Rockets has a
comparison of eight of them.

**The marking technique is a running record.** That is the specific practice of
marking every word as the child reads, to calculate error rate and find a
reading level. Running records are usually done on a *familiar* passage and are
administered often, to guide teaching.

**The error coding is miscue analysis.** That is reviewing the mistakes to find
a *pattern* in the strategies a child is using, rather than counting them. In a
running record the mistakes are called errors; in miscue analysis, miscues.

**The commercial equivalent most teachers will recognise** is a benchmark
assessment: Fountas & Pinnell's Benchmark Assessment System, or the DRA. Those
combine the reading, the marking, the retell and the level.

**The number that makes the argument:** Fountas & Pinnell's own FAQ says the
Benchmark Assessment takes **20 to 30 minutes per student**, and 30 to 40 at
upper levels. Per child, one on one, out of class. It is the strongest single
fact available for this post, and it is publisher-sourced rather than ours.

**Recommended framing:** call it a **reading assessment** in the post, and say
*running record* once so a literacy specialist recognises it immediately. Do not
lead with "informal reading inventory" — accurate, and it means nothing to a
recruiter.

Sources:
- https://www.readingrockets.org/topics/assessment-and-evaluation/articles/critical-analysis-eight-informal-reading-inventories
- https://classroomteacher.ca/3301/running-records-and-miscue-analysis/
- https://fpblog.fountasandpinnell.com/faq-friday-how-long-does-it-take-to-administer-the-benchmark-assessment-to-a-student
- https://www.fountasandpinnell.com/faqs/assessment

---

## THE POST

It is customary to do a reading assessment on every child twice a year. One
child at a time, out of class, fifteen to twenty-five minutes each depending on
the reader. A teacher sits beside them and listens to them read.

You mark every word as they go. At the end you know how accurately they read and
how quickly, and that tells you which books are a good fit next. Not so easy that
nothing is learned. Not so hard that a child gives up. What teachers call a just
right book: challenging enough that they have to use the skills they have.

It is the most useful reading data a school collects. It also costs the one thing
a teacher never has, which is another twenty minutes.

So I built the paper form as a web page.

The passage sits on screen. When a child misreads a word, you click it and choose
what happened:

Wrong word. Skipped it. You told them. Self-corrected. Repeated it. Asked for
help.

The first three count against them. The last three do not, and that difference
matters more than the total: a child who catches their own mistakes is doing
something a child who sails past them is not. There is a box to type what they
actually said, because a child who reads "house" for "horse" and a child who
reads "pony" for "horse" need different lessons on Monday.

The timer runs on its own. The scores build in the corner while you work, so when
the child stands up, you are finished. The notes you would have scribbled on the
back of the sheet get typed into a box that stays with the record.

Nothing then needs writing up. It prints as one page for the learning specialist,
and the whole class comes out as a spreadsheet, so a grade team can see where
every child is and who has not been assessed yet.

Same information, and more of it. Same judgement calls, which stay with the
teacher, because the tool counts and it does not decide.

Twice a year was never the right number. It was the affordable one.

---

## Length and voice check

- **279 words.** The previous draft was 433 and Sahaj could not tell it was about
  this project. This one names the classroom practice in the first sentence.
- No arithmetic, no percentages, no test suite, no word-list banding. That
  material is real and it belongs in the repo, not in a post.
- Triads intact: *missed / skipped / went back and fixed*; *not too easy, not too
  hard, hard enough to be worth their time*; *skipped it / said something else /
  fixed it themselves*.
- Landing sentences are complete: *So I built the paper form as a web page.* ·
  *Twice a year was never the right number. It was the affordable one.*
- No em dashes. No named publisher in the post itself. No group of teachers put
  at fault: the closing frames twice-a-year as a cost, not a failure.
- The one concrete object is **the back of the sheet**, which is where the notes
  used to go.
- Sahaj's own phrase for the coordination point is *"all the heads are behind the
  same steering wheel."* It is in the background section, not the post: his
  writing stays literal and one image per piece, and the true image here is
  already the back of the sheet.

## One gap between the vision and the build — worth knowing before posting

Sahaj's description says the information can be shared with the learning
specialist "without having to do this back and forth," and that they can see it
"as the information is coming in."

**The tool does not do live sharing.** Records live in the browser's storage on
one laptop, with no network calls anywhere in the file. What it actually offers
is a one-page printout per child and a spreadsheet export of every saved record.
That is genuinely faster than transcribing a paper form, and the export does make
"who has not been assessed yet" visible at a glance. It is not a shared view that
a specialist watches fill up.

The post is written to the build, not the vision: *"It prints as one page for the
learning specialist, and the whole class comes out as a spreadsheet."* True today.

A live shared view is the obvious next feature and would deliver exactly what the
description asks for. Worth saying out loud in an interview as the next thing,
rather than implying it already exists.

## Before posting

- The project must be up first.
- **Do not claim** the marking has been timed, that any child has used it, or
  that a child has been moved between groups. None of that has happened. "Twice
  a year was never the right number" is a claim about the old cost, not about a
  result.
- The twenty-to-thirty-minute figure is Fountas & Pinnell's own, for their
  Benchmark Assessment System. Safe to state as the cost of the paper practice;
  do not attach it to this tool as a measured comparison.

## The old draft, kept for reference

The first version led with a measurement finding: same child, same three
mistakes, two different reading levels depending on which sheet they sat. It was
accurate and independently fact-checked, and it was the wrong post, because it
was about the software rather than about the classroom. Kept as a possible
appetizer later, retitled around the finding rather than the tool.
