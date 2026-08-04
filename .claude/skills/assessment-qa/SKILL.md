---
name: assessment-qa
description: Verify generated educational content — assessment passages, word lists, worksheets, any set of pages a child will read — in ONE sweep that catches everything, instead of discovering new defects on every pass. Use whenever content is generated in bulk, before calling any of it done, and whenever an audit finds something a previous audit missed. Encodes why repeated audits keep finding new problems and how to stop it.
---

# Verifying generated content so one pass is enough

## Why this skill exists

Building Form B (36 assessment items) took **five** audit passes. Each one found
real defects the previous ones missed. The decodable passage generator — 128
sheets, a bigger job — took one. This skill is the difference between them,
written down.

**The 128 decodables went well because they had ONE dimension and a rulebook.**
Decodability. It was defined in `sound-list.json`, implemented in
`audit_passage.py`, and given **71 regression tests before any content existed**.
Every sheet went through the same gate, and the gate had been proven to say no.

**Form B went badly because it had SIX dimensions and a rulebook for one.**
Decodable, equivalent, distinct, story quality, age-appropriate, title. Only the
first had a curriculum-derived specification. The other five were judgment calls
encoded in a hurry, alongside the content instead of before it.

That is the whole diagnosis. Everything below follows from it.

---

## The six reasons repeated audits keep finding new things

Found by a specialist auditor whose only job was to explain the pattern.

**1. There was no "the checks" — there were seven programs and a memory.**
Each run by hand, from the right directory, with the right arguments. "Did it
pass?" had no single answer, so every audit invented its own definition and each
definition was different. That is precisely why each found something the last
did not.

**2. The checks were opt-in and the default was off.** A title was judged only
if you passed `--title`. Titles went unchecked for weeks — not because anyone
decided that, but because the flag was optional and nobody typed it.

**3. Nothing re-checked the shipped artefact.** Gates ran on *drafts*. A draft
passed, became a file, and was never read by a gate again. **The audits were
doing the regression testing by hand, one sample at a time.**

**4. Quality flags were claims, not evidence.** `"gates_passed": true` is a
string somebody typed — no timestamp, no content hash, no record of which gate
set produced it. Worse than no claim: it makes the next reader trust the file
and look elsewhere.

**5. Some gates could not fail, and nothing was watching for that.** A rule that
exempted "any word Form A uses 3+ times" widened the reuse gate until it passed
everything — including the exact words under test. A syllable tolerance sat live
for weeks on a value that is arithmetically constant. A gate that always passes
is indistinguishable from a gate that works, **unless something deliberately
tries to break it**.

**6. Whole-corpus properties had no home.** A per-item judge cannot see that 13
of 27 stories end the same way. No amount of per-item rigour finds it.

**Underneath all six:** the data existed twice, in the JSON and in the page, with
no build step. Nothing compared them. That is not a bug that happened — it is a
bug that was scheduled.

---

## The rules that fix it

### 1. Build the rulebook before the content
For every dimension you will judge, write the specification first, derive it
from source data where source data exists, and give it regression tests. If you
cannot specify a dimension, you cannot gate it — say so out loud rather than
writing a gate that shrugs.

### 2. Every gate must be proven to refuse
For each gate, construct an input that SHOULD fail it and assert that it does,
**and for the stated reason**. Keep those in the test suite forever. A gate with
no falsification test is decoration.

Watch for the three ways a gate silently stops working:
- **Widened** — an exemption that grows until nothing is left to judge.
- **Constant input** — a tolerance on a value that cannot vary yet.
- **Crash-open** — a missing file, empty string or exception producing PASS.
  Refuse to judge rather than judging against nothing.

### 3. One command, no arguments, runs everything
Every check, over every item, every time. No flags that turn checks off. Absolute
paths — a checker that reports success over zero files because of a relative
glob is worse than no checker.

### 4. Re-verify the shipped artefact, not the draft
Read the files back off disk and run the full suite on them. Recompute every
quality flag rather than trusting it. Keep a manifest with a content hash per
file so a hand-edit shows up as a **stale claim**, not a silent one.

### 5. Derive, never duplicate
If content lives in two places, generate one from the other and check the drift
in the sweep. Two hand-maintained copies will diverge; the only question is when.

### 6. Give corpus properties their own checker
Endings, repeated words, repeated plots, repeated names, near-duplicate titles,
pacing between neighbours. Per-item gates are structurally blind to these.

### 7. Specialise the auditors
A generalist told to "find what's wrong" across six dimensions and 36 items
**samples**. Four generalists sample four different subsets — which is exactly
what happened. Give each auditor ONE dimension and require enumeration: every
item, every field, a per-item verdict table, and an explicit "this category is
clean" only after enumerating.

### 8. Every finding becomes a permanent check
This is the one that actually ends the cycle. An audit finding that is fixed by
hand will recur. An audit finding converted into an executable check cannot.
**Require each auditor to deliver the code, not just the list.**

---

## The four specialists

Run all four in parallel. Each gets ONE dimension and must deliver executable
checks, not just findings.

| Specialist | Dimension | Delivers |
|---|---|---|
| **1 Curriculum** | Does every item match what the lesson teaches? Does it exercise the skill it is named for? Independently derived from the curriculum data — never by running the project's own gates | `audit_curriculum.py` |
| **2 Language** | Does every sentence parse, track its pronouns, hold its tense, tell a story, and say true things? | `WRITING-RULES.md` |
| **3 The child** | Is every word one they KNOW (age of acquisition, not just decodable)? Is every idea one they should meet? Names, pseudowords, feelings, family assumptions | `audit_child.py` |
| **4 The system** | Do the gates actually refuse? What is unchecked? Schema, formatting, corpus patterns, data drift, regression coverage | `verify_all.py` |

Brief each one: *"Previous audits each found different defects, which means each
was sampling. You must ENUMERATE."*

---

## Checklist before calling generated content done

- [ ] One command runs every check over every item and exits non-zero on failure
- [ ] Every gate has a test proving it refuses a deliberately bad input
- [ ] No gate can crash open on missing, empty or malformed input
- [ ] The shipped files — not the drafts — went through the suite
- [ ] Quality flags are recomputed, with a content hash so edits show as stale
- [ ] Duplicated data is derived and drift is checked
- [ ] Corpus-level checks exist and cover more than the top few
- [ ] Every finding from every audit became a permanent executable check
- [ ] Any dimension that CANNOT be mechanised is written down as a human step,
      not quietly dropped

---

## The honest limit

Some things no checker will catch: whether a story is worth reading, whether a
title is charming, whether a six-year-old would care what happens. Those need a
person. The point of mechanising everything else is to leave a human's attention
free for the part only a human can do — not to replace it.

And record what the language genuinely will not allow. Lesson 6 has zero legal
pseudowords because five letters cannot make one that is not already a word.
Lesson 33 has exactly one free `v` word. Writing that down as a measured limit
is worth more than a workaround that hides it.
