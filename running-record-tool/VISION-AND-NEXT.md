# What this tool is, in Sahaj's words, and what it still needs

Recorded 6 August 2026, from Sahaj's own description. The build documents
(`DESIGN.md`, `CHANGES-2026-08-05.md`) describe what the software does. This file
records **why it exists and what it is for**, which is the part that drifts if it
is only ever said out loud.

---

## What it is

There is a paper form version of this, where a teacher sits down with a child.
It is almost like a spelling inventory or a miscue analysis. It is to see how a
child does when reading certain passages and sentences.

**What it is for:**

- To verify what a child's reading ability actually is
- To decide what interventions need to be shared or discussed with a learning
  specialist or with families
- To put children in the right reading groups
- To help a teacher figure out what level books a child should be reading

### The "just right" book

This is the point of the whole exercise, and it is easy to state wrongly.

It is **not** about what is worth a child's time. It is about **fit**.

- **Too easy** and the child learns nothing.
- **Too hard** and the child is discouraged.
- **Just right** is challenging enough that the child has to use the skills they
  already have to decode what is happening and read the story.

## What it costs on paper, and why that matters

Doing this for every child twice a year is laborious. A teacher pulls one
individual child out of class and has to be with them one on one, for **fifteen
to twenty-five minutes depending on the child's ability**.

*(For comparison, publisher-sourced: Fountas & Pinnell's own FAQ gives 20–30
minutes per student for their Benchmark Assessment System, and 30–40 at upper
levels. Ours is the classroom figure; theirs is the published one.)*

Twice a year is what that cost buys. It was never the right number for a
child's learning; it was the affordable one.

## What the tool changes

Same information, recorded much more quickly, plus more data that is useful to
teachers, learning specialists and families.

**A timer.** How long a child takes may or may not be a factor, and now you have
it either way.

**A quick-click menu on every word.** If the child makes a mistake, you mark it
with a mouse, fast, while the child is still reading, instead of writing it out
by hand as they go. The six marks:

| Mark | Counts against the child |
|---|---|
| Wrong word | yes |
| Skipped it | yes |
| You told them | yes |
| Self-corrected | **no** |
| Repeated it | **no** |
| Asked for help | **no** |

Plus a box to type what the child actually said, an added-word count, and an
optional M/S/V tag for what the child was using when they went wrong.

**A score section to the side.** Everything laid out, more visual, so an educator
can see where this child is in terms of raw data at a glance. What goes into that
corner can be explained very simply.

**A notes section.** Right after you meet with a child you want to write
something down. On a keyboard it is faster, and it lives in one spot with the
record. Internal to the school, and shareable with the learning specialist.

## Coordinating the care of a child

More information, more granular and specific, done more quickly, and just as
accurate. The information can be shared with the learning specialist without all
the back and forth, so they can see what is being done and focus on the children
as the information comes in. The children who have **not** been assessed yet can
clearly be seen.

It is another way to coordinate the care of a child. *All the heads are behind
the same steering wheel.*

**The efficiency argument:** minimally this should be done twice a year, but if
it needs to be done more often it can be, because it will not be a huge
disruption to a teacher who is already managing so many other balls in the air.

---

## NOT BUILT YET — the honest gaps

### 1. Live sharing with the support team

Records live in the browser's storage on **one laptop**. There are no network
calls anywhere in the file. Sharing today is a one-page printout per child and a
spreadsheet export of every saved record.

That is genuinely faster than transcribing a paper form, and the export does make
"who has not been assessed yet" visible. **It is not a shared view a specialist
watches fill up.** That is the obvious next feature and it is what the
description above actually asks for.

Scope note: a classroom team (kindergarten, first, second grade) and the
learning specialist are the intended audience. An **outside** educational
therapist would not get it right away, and should not be promised.

### 2. Whole-class grouping analysis

*Sahaj's idea, 6 August 2026, thinking aloud:*

Once every child in a class has been assessed, all the data is sitting there:
the scores, what they are missing, the timing, the teacher's own notes. At that
point something should look across the whole class and suggest **how to group
them** for reading groups or phonics groups, what pairings make sense, and what
level books a group could read together.

**The line that matters, and it is his:** that decision should not rely on the
tool. The teacher has the experience to know who is a good match, and knows a
great deal the tool never will. But an objective read of the data, offered as an
opinion rather than an instruction, is genuinely useful when you are staring at
twenty-four children and trying to make five groups.

This is the same principle as everything else here: **the tool counts, the
teacher decides.** A grouping suggestion is a count with a shape on it. It is
still not a decision.

**If this gets built, it must:**
- present as a suggestion, never as a placement
- show the data it used, so a teacher can disagree with it specifically
- never override or hide the teacher's own notes
- work on a whole class at once, because that is the moment it is needed

---

## For the record

Nobody has used this tool with a real child yet. The worked example
(`worked-example.html`) is a made-up child called Maya, and the page says so in
bold. Every number on that page came from marking the real passage through the
real interface, so the arithmetic is real even though the reader is not.

Do not claim, in a post or an interview, that the marking has been timed with a
child, that a child has been moved between groups because of it, or that a
specialist has used the export. None of that has happened yet.
