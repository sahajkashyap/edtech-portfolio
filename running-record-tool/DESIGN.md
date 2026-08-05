# What this tool decides, and what it does not

## The short version

The teacher decides. The tool counts.

Everything on the screen is arithmetic on marks a teacher made: accuracy, the
error rate, the self-correction rate, words correct per minute, and the M/S/V
tally. Not one number is a judgement about a child, and the tool never produces
one. It says so on the page, above the marking keys, so nobody has to guess.

## Why it is built that way

A running record is a teacher sitting beside a child with a pen. The value is in
what the teacher notices: that she paused before every word with an ending, that
he looked at the picture and then guessed, that the second half was faster than
the first. None of that is in a percentage, and software that offers to tell you
what a child needs is offering something it cannot know.

What software is good at is the part that costs a teacher time. Counting. Keeping
the running total straight while a child is still reading. Working out the error
rate correctly at the moment you look up. Holding thirty children's records in
one place, in a form you can print for the person who asked for it.

So the split is: the teacher supplies every judgement, and the tool supplies
speed and arithmetic. That is not a limitation to be engineered away later. It is
the design.

## The point of the speed

Assessing a child takes about as long as the reading itself, and then the marking
takes as long again. That is why running records get done twice a year, and why
grouping decisions sit on data from months ago.

If the marking is quick and the arithmetic is right, the assessment can be done
often. Often is the whole thing. A reading in September and a reading in October
tell you something a September reading alone never will, and a child in the wrong
group gets there for six weeks instead of half a year.

## M / S / V: where the line sits, exactly

Coding a miscue for **Meaning**, **Structure** or **Visual** is the part of a
running record that makes it diagnostic rather than a fluency count. It is also a
judgement, and a fine one. Whether *"A cat nap in a pot"* means the child stopped
attending to sense, or simply does not have the `-s` yet, is a call a person
makes with a child in front of them.

So the tool does not make it. The teacher taps M, S or V on each miscue, and the
tool adds them up and reports what was entered, in those words:

> 4 of 4 miscues coded. These are counts of what you marked, not a judgement.

The panel stays hidden until at least one miscue is coded, because `0 / 0 / 0`
reads as *used no cues* rather than *not analysed yet*. And the count of coded
miscues is always shown beside the totals, so the percentages are never out of a
number the teacher cannot see.

The retell works the same way. There is a box for what the child said back, and
four buttons: Nothing, Some of it, Most of it, All of it in order. The
placeholder says *write what they said, not how good it was*. The tool records
it. It does not score it.

## What that rules out

- No suggested reading level.
- No recommended next lesson.
- No "this child is at risk" flag.
- No inference from the marks to a cause.

If any of those ever appear, the tool has stopped being a record and started
being an opinion, and a teacher would be right to trust it less.

## Two places the tool refuses to compute

**Word lists are not banded.** The Independent / Instructional / Frustration
cut-offs are a passage measure. A word list is seventeen to twenty-two items
against a passage of thirty-one to sixty-one words, and nearly half the items are
sight words. The same child with the same three errors came out Independent on
one and Frustration on the other. The tool now reports the count and says
plainly that the band does not apply.

**Two lessons do not measure the sound they are named for.** Lesson 22 is named
for `k` and Lesson 34 for `z`, and at both, every word carrying that sound is
already spent by the practice sheet the child has read. The sign-offs in
`formb/audit_writing.py` say so in full, with the arithmetic. An examiner reading
those two as a check on `k` or `z` is reading them wrong, and the file says that
rather than letting the score imply otherwise.

Both of these are the same principle as the M/S/V line: **where the tool cannot
honestly compute something, it says so instead of producing a number anyway.**

## What is still the teacher's alone

Everything that matters. What to teach on Monday, which group a child belongs in,
whether the retell was thin because comprehension is thin or because the child
was shy, and whether today's reading was representative at all.

The tool's job is to make sure that when a teacher sits down to decide those
things, every piece of information they collected is in front of them, correct,
and took ten minutes instead of thirty.
