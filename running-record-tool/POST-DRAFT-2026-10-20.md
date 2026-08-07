# Draft 07 — Word by Word, the running record tool

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

### The five options, and what each one costs

Sahaj asked on 6 Aug for the options laid out rather than a single
recommendation. These are they, in order of how narrow the name is.

| Name | What it actually names | Who hears it and knows | What it costs |
|---|---|---|---|
| **Running record** | The marking technique: every word marked as the child reads | K–2 teachers, literacy specialists, reading interventionists. Immediate. | Slightly narrow. A true running record is usually taken on a *familiar* book; these are unseen passages. |
| **Miscue analysis** | Reading the *pattern* in the mistakes rather than counting them | Specialists and reading professors | Ties the tool to the three-cueing argument, which much of the structured-literacy field treats as discredited. The repo deliberately takes no side. |
| **Informal Reading Inventory (IRI)** | The shape of the instrument: graded word lists plus graded passages | Reading researchers, some specialists | The most *technically* accurate name for what this is, and it means nothing to a recruiter or a hiring manager. |
| **Benchmark assessment** | The commercial category: F&P's BAS, the DRA | Administrators and most classroom teachers | Names commercial products. The repo's own rule is never to name a publisher as having done badly, and this name invites the comparison. |
| **Reading assessment** | Plain English for the whole activity | Everyone | No precision at all. Buys recognition, tells a specialist nothing. |

**Recommended framing, unchanged:** call it a **reading assessment** in the post,
and say *running record* once so a literacy specialist recognises it immediately.
The post now does this in the opening paragraph: *"Teachers call it a running
record."* Keep **informal reading inventory** for an interview, when someone asks
what it technically is. Do not lead with it.

### SETTLED, 6 August 2026: the tool is called **Word by Word**

Sahaj chose it, on the grounds that "Running Record" is the category rather than
a name: it tells a literacy specialist what the thing is and tells a recruiter
nothing at all.

**Word by Word** is literally what the teacher does. It carries no jargon, it
says the method out loud, and it survives a cold reading: *"Word by Word, a
running record tool I built for K–2 teachers."*

The lockup everywhere is **the distinctive name, with the plain descriptor
underneath**, so neither has to do the other's job:

> **Word by Word**
> A running record tool for K‑2 teachers

Applied to: the tool header, the page title, the printed record's header (which
reads *Word by Word · running record · Form B*, because the person receiving that
page is a specialist who needs the category), `DESIGN.md`, the root `README.md`,
`PROGRESS.md`, and a kicker line on `all-lessons.html` and `worked-example.html`
linking back to the tool.

**The folder stays `running-record-tool/`.** The site is live at that path, every
link in the repo points at it, `check_links.py` starts from it, and the URL
saying *running record* is an accurate description rather than a stale name.
Renaming the folder would break the live links to buy nothing.

The other six candidates, kept in case the name is ever revisited: **Beside**
(the posture, most memorable, needs the descriptor to carry it), **Aloud** (one
word for oral reading), **Bricks** (from Sahaj's own ending, uniquely his,
opaque without the story), **Twenty Minutes** (the cost argument, meaningless
cold), **Return Sweep** (a striking phrase, but it names what the child's eyes do
rather than what the teacher does), and **Miscue** (precise, and it ties the tool
to the three-cueing argument the repo takes no side in).

Sources:
- https://www.readingrockets.org/topics/assessment-and-evaluation/articles/critical-analysis-eight-informal-reading-inventories
- https://classroomteacher.ca/3301/running-records-and-miscue-analysis/
- https://fpblog.fountasandpinnell.com/faq-friday-how-long-does-it-take-to-administer-the-benchmark-assessment-to-a-student
- https://www.fountasandpinnell.com/faqs/assessment

---

## THE POST

*Version of 6 Aug 2026, afternoon. Sahaj's own tweaks kept; see the revision
record below for what changed and why. Paste-ready copy lives at
`~/Desktop/linkedin-posts/POST-2026-10-20-word-by-word.txt`.*

It is customary to do a reading assessment on every child twice a year. One
child at a time, out of class, fifteen to twenty-five minutes each depending on
the reader. A teacher sits beside them and listens to them read. Teachers call it
a running record.

You mark every word as they go. At the end you know how accurately they read and
how quickly, and that tells you which books are a good fit next. Not so easy that
nothing is learned. Not so hard that a child gives up. What teachers call a just
right book: challenging enough that they have to use the skills they have.

It is the most useful reading data a school collects. It also costs the one thing
a teacher never has, which is twenty uninterrupted minutes. You need a quiet
space and one child, while the rest of the class works on something independent
or is at art, P.E. or Spanish.

So I built the paper form as a web page, and added a few things paper cannot do.
I called it Word by Word, because that is what the marking is.

The passage sits on the screen for the teacher, and the child has the paper copy
in front of them. When a child misreads a word, you click it and choose what
happened:

Wrong word. Skipped it. You told them. Self-corrected. Repeated it. Asked for
help.

The first three count against them. The last three do not, and that difference
matters more than the total: a child who catches their own mistakes is doing
something a child who sails past them is not. There is a box to type what they
actually said, because a child who reads "house" for "horse" and a child who
reads "pony" for "horse" need different lessons on Monday.

The timer runs on its own. The scores build in the corner while you work, so when
the child stands up, you are finished. The notes you would have hurriedly
scribbled on the back of the sheet get typed into a box that stays with the
record.

Nothing then needs writing up. It prints as one page for the student support
team, and the whole class comes out as a spreadsheet, so everyone caring for a
child is reading the same thing, and you can see at a glance who has not been
assessed yet.

None of that is a judgement. Words read, errors, self-corrections, the time, what
the child said instead of the word on the page: those are bricks. A teacher lays
them into the decisions that actually matter. Which book to hand this child next.
Which phonics group fits them now. What to say to the family.

Here is the part I am still building. Once every child in a class has been
assessed, the bricks for the whole room are sitting in one place, and an A.I.
could read across them and describe the class back to you: how many children are
secure, how many are close, how many need help now. An experienced teacher
already knows. Having it counted, next to what you already believed, is worth
something on the morning you are making five groups out of twenty-four children.

It takes a village to raise a child. The teacher still builds the house.

---

## REVISION RECORD — 6 August 2026, afternoon

Sahaj edited the Google Doc directly. Five changes. What was kept, what was
fixed, and why.

### Kept as written

**"The passage sits on the screen for the teacher, and the child has the paper
copy in front of them."** The best edit of the five. The old line implied the
child read off the laptop, which was never the practice, and this is Sahaj's own
thesis showing up: the digital part serves the paper part.

*It also had a consequence.* The tool did not print a child's copy; the only
print was the finished record. Rather than soften the sentence, the button was
built (see `index.html`, "the child's copy"). The post now describes something
the tool does.

**"hurriedly scribbled."** The real texture of the moment. Kept.

**"and added a few things paper cannot do."** Sahaj's softened version of a flat
claim. The softening is his and it belongs; only the noun changed, from "a few
tools" (vague, and the paragraph that follows is otherwise concrete) to "a few
things paper cannot do," which sets up the list.

### Kept, with the number put back

**The quiet space.** Sahaj added: *"This requires a quiet space, one-on-one, with
a student while the rest of the class is working on an independent assignment or
in a specialist class like art, P.E. or Spanish."* Only a teacher knows that this
assessment is scheduled around a specialist block, and *art, P.E. or Spanish* is
a triad in his own voice.

But the same edit replaced *"another twenty minutes"* with *"time,"* and the
number was the thing doing the work. Both are now in: **"the one thing a teacher
never has, which is twenty uninterrupted minutes."**

### Fixed

**"stays with the school's internal records and shared with the student support
team."** Two problems in one sentence. It does not agree (*stays … and shared*),
and it drifts back toward the vision: **the tool does not do live sharing** (see
the gap section below), and the very next sentence already states correctly what
sharing is. Reverted to *"stays with the record,"* with *student support team*
moved into the printout sentence where it is true.

### Rewritten — the ending

Sahaj's spoken intent, recorded 6 Aug: *"these bricks allow us to put the house
together… as teachers we can look at this information and decide what is in the
best interest. It also provides an opportunity to have artificial intelligence,
which now has data on all the kids in the classroom, to figure out what does this
class really look like… but an experienced teacher will already be able to figure
that out. To have both those pieces is a huge advantage."*

That idea is now the ending. Three things were repaired on the way:

1. **"Twice a year was never the right number. It was the affordable one."** had
   been deleted. I restored it, moved earlier in the post, on the grounds that it
   was the strongest line in the piece. **Later the same evening Sahaj cut it
   again, for good, and he was right.** It reads as a verdict on schools, and his
   own standing rule is that nothing may imply a school or a teacher was failing
   beforehand. The line was originally his, from `VISION-AND-NEXT.md`, and I
   handed it back to him in a place where it did damage. The cost paragraph now
   runs straight into *"So I built the paper form as a web page,"* which reads
   cleanly with nothing between them. It also freed about 66 characters.
2. **The image was mixed and it was doing three jobs.** Bricks, then a house,
   then A.I. informing thinking, inside four sentences. The bricks now appear
   once, name a specific list of real numbers, and the house is the last three
   words of the post.
3. **The A.I. paragraph claimed a feature that is not built.** Whole-class
   grouping analysis is gap 2 in `VISION-AND-NEXT.md`. It now opens *"Here is the
   part I am still building,"* which is both true and, per Sahaj's own standard,
   the stronger register. The concession *"An experienced teacher already knows"*
   is his, and it is what keeps the paragraph from reading as a tool that decides.

Also fixed: a semicolon before *but*, and a doubled space.

### The closing line is Sahaj's

Later on 6 August he asked for something at the end with a little of his humour
in it, and proposed: *"Yes, it takes a village to raise a child, but the teacher
still builds the house."*

It is his instinct and it is a good one. Closing on a familiar phrase tilted
slightly is a move he makes in his own writing, and it is not even a mixed image:
a village is made of houses. **One change only, the joint.** *But* sets the
village against the teacher, and the paragraph two above spends its whole length
arguing the village is a good thing — the printout for the student support team,
everyone caring for a child reading the same thing. A full stop lets both be
true instead of one beating the other:

> It takes a village to raise a child. The teacher still builds the house.

---

## Length and voice check

- **2,959 characters, 552 words.** LinkedIn's hard cap is 3,000 characters, so this leaves 41 to spare. Longer than the 279-word version, and longer than the 360 in the
  Google Doc header, because the ending Sahaj asked for is a new argument rather
  than a closing line. LinkedIn shows about three lines before *see more*, so the
  cost is real but it is paid at the end, not the top. Cut further only on
  Sahaj's say-so; the material added is the material he asked to land.
- No arithmetic, no percentages, no test suite, no word-list banding. That
  material is real and it belongs in the repo, not in a post.
- **No em dashes** (checked mechanically, 0 in the file).
- Triads intact: *art, P.E. or Spanish*; *Wrong word / Skipped it / You told
  them*; *which book / which phonics group / what to say to the family*; *secure
  / close / need help now*.
- Landing sentence is short and **complete**: *The teacher still builds the
  house.* Nothing explains past it.
- One image per piece, used once: **the bricks**. Sahaj's other figure, *"all the
  heads are behind the same steering wheel,"* stays in the background section.
  Two images would compete and the ending is where this one has to land.
- Nothing claims a child has used the tool, that the marking has been timed, or
  that a child has been grouped because of it. The A.I. paragraph is explicitly
  future tense.
- No named publisher. No group of teachers put at fault: twice-a-year is framed
  as a cost, not a failure.

### An alternative Sahaj raised: put the bricks at the top

He asked whether this idea belongs at the beginning instead. It does not, and the
reason is structural rather than stylistic: the bricks are only meaningful once
the reader knows *what the tool collects*, and that list is the middle of the
post. Opening with the image would spend it before it means anything. The
opening's job is to make a teacher recognise their own Tuesday, which the current
first paragraph does. **Worth revisiting only if the post is ever cut in half**,
in which case the bricks become the whole post and the marking detail goes.

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

**The second gap is now in the post, on purpose.** The whole-class A.I. analysis
is gap 2 in `VISION-AND-NEXT.md` and is not built. The closing paragraph names it
as *"the part I am still building,"* which is the honest form of the claim and
the one Sahaj's own standard asks for. If anyone asks in an interview: the data
that analysis would need is already exported, and nothing reads across it yet.

**One gap closed the same afternoon.** The post says the child has the paper copy
in front of them. Before 6 Aug the tool printed only the finished record, so that
sheet had to be pulled out of `all-lessons.html` and trimmed by hand. There is
now a **Print the child's copy** button: this lesson's text alone, nothing
marked, sized per lesson so that no sentence wraps onto a second line. A wrapped
line costs a young reader the return sweep, and the tool would then have scored
an error its own sheet caused.

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
