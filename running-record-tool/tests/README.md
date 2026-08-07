# Tests for Word by Word

## What this is, in one sentence

A file that opens the tool in a real browser, uses it the way a teacher would —
real clicks, real keypresses — and checks that every part of it still does what
it is supposed to do.

## Why it exists

Before this existed, the only way to know the tool worked was for somebody to
look at it. Looking at 2,300 lines of code is *sampling*, not *covering*: each
read follows a different path, nothing remembers what the last read concluded,
and so a bug fixed in August can come back in November with nobody noticing.

Every check in here exists because something was genuinely broken once. That is
what "regression" means — sliding backward. The checks are the memory.

---

## How to run it

You need Google Chrome installed. Nothing else, and nothing from the internet.

**Step 1.** Open Terminal.

**Step 2.** Go to the tests folder. Copy this line exactly:

```
cd ~/Documents/GitHub/edtech-portfolio/running-record-tool/tests
```

**Step 3.** The first time only, download the one library the tests use:

```
npm install
```

*What you should see:* a few lines ending in something like `added 8 packages`.
*If it fails:* you probably do not have Node installed. `node --version` will
tell you — if that says "command not found", install Node from nodejs.org.

**Step 4.** Run the tests:

```
npm test
```

*What you should see:* a list of green `PASS` lines grouped by area, and at the
bottom, **`ALL 153 CHECKS PASSED`**.

*If something is broken:* a red `FAIL` line naming the check, then a second line
saying what was expected and what actually happened. The run ends with a count
of what failed. Nothing is changed on your computer either way.

It takes about a minute and a half. A browser window never appears — Chrome runs
invisibly in the background.

---

## The coverage check

`npm test` answers *"does everything still work?"*

This answers a different and harder question: ***is every line of the tool
actually being checked?***

```
npm run coverage
```

Chrome records which lines of the tool's code actually executed while the tests
ran, and the report prints **every line that never ran even once**.

*What you should see:*

```
Code coverage — which lines never ran
  100.0% of executable lines ran (1351 of 1351)
  every executable line was run by a test
```

If it is below 100%, you get the exact line numbers. Each one is a piece of the
tool that no test touches — meaning it could be broken right now and nothing
here would tell you. That list is a to-do list, not an opinion:

> **Either write a test that runs the line and asserts on the result, or delete
> the line because nothing can reach it.**

This is the number that makes "did you check everything?" answerable. It is not
a matter of how carefully anybody looked.

---

## When you fix a bug

Add a check for it here **the same day**, while you still remember what went
wrong. One line in this file is worth more than another review pass, because a
review happens once and a check happens every time.

Write the check so its name says what a person would notice, not what the code
does. `'deleting a record does not bring it back'` is a good name.
`'test deleteRecord()'` is not.

## What this does NOT do

It proves every line runs and produces what a test expects. It cannot prove the
tool is *pedagogically* right — that a word list should not be banded, that a
self-correction is not an error, that these are the correct passages. Those are
judgements, and they stay with the teacher. What this kills is the other
problem: silent breakage in code nobody happened to look at.
