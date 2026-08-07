# How to work with me

I am a classroom teacher who builds. Fourteen years in elementary classrooms
across grades 1 through 6 — I think in curriculum, assessment, and what actually
happens when a child sits down with a page. I am not a software engineer by
training, so I work best when the reasoning is in plain language and the
pedagogy leads the code.

## Explain in plain language

- Use analogies and examples. They are how I learn. Every new idea should come
  with one.
- One-sentence explanations first. Details only if I ask.
- Tell me WHY before you tell me HOW.
- Never assume I know a word. If you use "repo," "branch," "server," "port,"
  "dependency," or "PATH," define it in one line the first time.

## Break it smaller than you think you need to

- If you were going to explain something in five steps, give me ten easier ones
  instead.
- Give me one step at a time. Do not give me steps 1 through 5 at once. Give me
  step 1. Wait for me.
- Do not skip the in-between steps. If there is a click, a window to switch to,
  a key to press, or a menu to open, say it out loud. I would rather you tell me
  something I already knew than leave it out and lose me.
- Tell me exactly where I am supposed to be typing before you give me something
  to type: the plain terminal, or inside Claude Code.
- Anything that starts with a slash only works inside Claude Code. Say so.
- When you give me a command, put the command alone in its own box with nothing
  else in it, so I can copy and paste it cleanly.
- After every command, tell me what I should see if it worked, AND what I might
  see if it didn't.

## Show me pictures when you can

- A visual chart or diagram helps me more than a paragraph.
- The terminal can't draw. When something would be clearer as a picture, write
  me a short block I can copy and paste into Claude Chat in my browser, and let
  Claude Chat draw it for me. Say plainly: "Copy this into Claude Chat to see it
  visually."
- Do this especially for how pieces of the project fit together, what happens in
  what order, and anything with more than three moving parts.

## Give me suggestions and advice

- I get ideas from talking with you. Offer them.
- If there is a better way to do what I asked, say so before you build the thing
  I asked for.
- If I am about to go down a bad road, tell me. Do not just do what I said.
- If I am missing something obvious, tell me. I would rather hear it.

## When something breaks

- I will paste in the error or send a screenshot. Read it literally.
- Tell me what the computer is actually saying, in plain words, before you tell
  me how to fix it.
- If I have made a wrong assumption, say so directly. Do not work around it.
- Do not fix five things at once. Fix one, have me check, then move on.

## Before you write code

- Say in one sentence what you are about to do.
- Do not install anything without telling me what it does and why.
- Build the smallest working piece first and let me see it run before adding
  anything else.
- After you write code, tell me exactly what to type to see it working in a
  browser.

## Suggested additions from Claude — delete any you disagree with

- Ask me one question at a time when you need information. A list of questions
  overwhelms me.
- Warn me before anything hard to undo: deleting files, renaming folders,
  installing something big. Say "this one is hard to undo" first.
- Tell me the size of a job before starting. "This is five minutes" or "this is
  an afternoon" helps me decide whether to start it now.
- At the end of every working session, check in with me like a partner: "Would
  you like me to push today's work to GitHub?" This is a standing rule.
  - I will try to save it myself first. If I already have, just confirm it's
    backed up. If I haven't, offer to do it for me.
  - Do this especially if we've built a lot, or if we've been at it a while, so
    a frozen container or crash never costs us the day's work.
  - I have the GitHub Desktop app installed, so offer me both ways: the simple
    point-and-click steps in GitHub Desktop, AND the exact terminal commands.
    Let me pick, or just let you do it.
- If I ask for something that will not work, tell me why, and tell me the
  closest thing that will.

---

# This project — Reading Assessment Tool with Phonics Button

This project adds ONE capability to the phonics assessment tool I already have
(the "UFLI Foundations Tracker" at `phonics-assessment-tool/index.html`): a
**worksheet generator**. A button on that tool hands parents matched, printable
practice worksheets for the exact skill the assessment flagged. Same tool, more
capability — not a separate standalone app.

> NOTE: The "CORE Phonics Survey" tool is a **separate project** and is NOT part
> of this repo. Do not mix it into this work.

## The closed loop

Assessment flags a skill → parent clicks **"Generate practice worksheets"** →
picks the skill → one click makes a printable PDF practice sheet for that exact
skill. The picker is built from the tool's own curriculum, so its skill names
and order always match the tool exactly.

## Copyright rules (hard rules)

- Phonics scope & sequence is a shared teaching method — fine to follow.
- The Dolch word list (1936) is public domain — fine to use for sight words.
- The Fry list is NOT free — never use it.
- Never reproduce UFLI's wording, word lists, or page design. Original words only.

## Status

Done — all 128 skills generate printable worksheets across six sheet types
(sound patterns, magic-e, letter-sounds, word endings/affixes, reviews, and
syllables). Browser-verified, backed up on `main`. The full build spec lives in
the `phonics-worksheet` skill in `.claude/skills/`.

## Standing rule — tests and coverage, not review passes

Established Aug 7, 2026, after ten-plus agent reviews of the running record tool
each found new bugs and never converged.

Reviewing a file by reading it is SAMPLING, not covering. "Find the bugs" has no
finish line, so a reviewer stops where it runs out of ideas, and that is a
different place every time. More agents with more specialised roles does not fix
this — each slice is still unbounded.

So every tool in this repo with real logic in it gets:

1. **A regression test file** that drives a real browser with real clicks and
   keypresses — not an agent reasoning about the code. One check per bug ever
   found, named for what a person would notice.
2. **A code-coverage number in the same file**, so coverage measures the tests
   that actually exist and the two cannot drift apart.

    cd running-record-tool/tests
    npm test            # does everything still work?
    npm run coverage    # is every line actually being checked?

**The bar is 100% of executable lines.** Every line the coverage report lists as
never executed is either given a test that asserts on its result, or deleted
because nothing can reach it. That list is the completion criterion — it is what
makes "did you check everything?" answerable without taking anyone's word for it.

Rules that come with it:
- A flaky check is worse than no check; it teaches you to ignore red. Run the
  suite several times before calling it done.
- Fix a bug, add its check the same day.
- Say the honest limit out loud: coverage proves every line ran and something
  asserted on its output. It does not prove the teaching decisions are right.
  That judgement stays with me.

The working example to copy is `running-record-tool/tests/run-tests.js`.

## The command: `ultracode verify <folder>`

Example: **`ultracode verify running-record-tool`**

That runs the saved workflow at `.claude/workflows/verify-everything.js`. The
word "ultracode" is the switch that turns on multi-agent orchestration for that
turn; "verify" names the workflow. Both words are needed.

Four phases, run by the machine rather than steered by hand:

| Phase | What happens |
|---|---|
| **1. Hunt** | Four agents at once, on four *different* lenses — timing and state, cross-surface consistency, saved data and corruption, a stranger's first two minutes. Different lenses on purpose: redundant hunters find redundant bugs. |
| **2. Refute** | Every claimed finding goes to three skeptics whose job is to KILL it — one checks the behaviour is real, one checks a teacher can actually reach it, one checks the severity is honest. Majority rules. |
| **3. Tests** | Each survivor is written up as test code in `run-tests.js` style, ready to paste. |
| **4. Verdict** | Plain language: what is broken, what to fix first, and **whether it converged**. |

**The loop is the point.** It does not stop after a set number of passes. It
repeats until **two consecutive rounds find nothing new**, then says plainly
whether it went quiet or hit the ceiling still finding things. Nobody has to sit
there judging whether we are done yet.

Options: `ultracode verify <folder>, 3 quiet rounds` or `..., up to 6 rounds`.

## Standing rule — verify every link before calling anything "done"

Established Aug 1, 2026, after a lesson link was reported opening a blank or
duplicate page. At the end of ANY project or change that adds, moves, renames,
or restyles pages or links — and before telling me a build works — run the
checker at the repo root, in both modes:

    python3 check_links.py            # against the files on this computer
    python3 check_links.py --live     # against the live GitHub Pages site

It verifies three things per link: the target EXISTS, it is NOT BLANK (real
visible text, not an empty shell), and it is the RIGHT PAGE (not identical to
the page the link was on, and a link named `lesson-095.html` must actually say
"Lesson 95"). "The file exists" is not verification; all three checks are.

When a new tool or page type joins the portfolio, add its start page to
`DEFAULT_STARTS` and a content rule for what its filenames promise. The skill
lives at `.claude/skills/link-verify/SKILL.md`; its editable source is
`LINK-VERIFY-SKILL.md` at the repo root (Claude's sessions can't write inside
`.claude/skills/`, so edit the root copy and deploy it with
`! cp LINK-VERIFY-SKILL.md .claude/skills/link-verify/SKILL.md`).
