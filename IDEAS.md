# Twenty Things I Could Build

*Working file. Started July 25, 2026.*

---

## What this file is for

I am applying to work at an EdTech company. I have taught 3rd and 4th grade for
fourteen years. My advantage over other applicants is not that I am a better
programmer — it is that I know **which problems are actually worth solving**,
and I know when a generated worksheet is quietly wrong.

So the goal of everything in this file is to show two things at once:

1. **Teacher judgment.** The thing works because someone who has taught the
   skill designed it. An engineer would have built it subtly wrong.
2. **Real AI systems thinking.** Not "I asked a chatbot for worksheets." Instead:
   agents that check each other's work, loops that keep fixing until the output
   is clean, reusable skills, and pipelines. Systems, not prompts.

Anything I build should be able to finish this sentence:
**"A regular developer could not have built this, and a regular teacher could
not have built this. It needed both."**

---

## The Claude toolbox, in classroom words

Before the ideas, here is the vocabulary — explained the way I actually think
about it. This matters because the ideas below use these on purpose.

| Claude thing | What it is, in teacher terms |
|---|---|
| **Agent** | A student teacher. You hand it one job and it goes off and does it. |
| **Subagent** | A student teacher that *another* student teacher hired. Fan out ten of them and they all work at once. |
| **Loop** | "Do it again until it's right." Like having a kid revise a paragraph until it meets the rubric, instead of accepting draft one. |
| **Skill** | A laminated procedure card. Written once, followed the same way every time by anyone who picks it up. My phonics worksheet rules live in one. |
| **Workflow** | A whole lesson plan for the agents: first this, then split into groups, then everyone reports back. |
| **QA gate** | The rubric taped to the turn-in bin. Nothing leaves the room until it passes. |
| **Structured output** | Making the agent fill out a form instead of writing an essay, so the next agent can actually use it. |

**The single most important pattern for education:** *generate → check → fix →
check again.* One agent writes. A different agent, who did not write it, tries
to break it. If it breaks, it goes back. That loop is the entire difference
between "AI worksheet slop" and something I would hand a child.

---

## How to read each idea

- **The problem** — the real classroom pain.
- **Teacher edge** — the part an outsider gets wrong.
- **AI machinery** — which of the above it shows off.
- **Smallest first version** — what I'd build in one sitting to prove it.
- **Portfolio value** — ★ to ★★★★★, how impressive this is to an EdTech hiring manager.

---

# Part 1 — Generators (my strongest lane)

### 1. Phonics Worksheet Generator ✅ *already built*

**The problem** Assessment tells a parent their kid failed "vowel teams." Then
nothing. No practice, no next step.
**Teacher edge** The practice has to match the *exact* skill flagged, in the
same order and the same words the curriculum uses.
**AI machinery** A skill file holds the template and the copyright rules; six
sheet types; 128 skills covered.
**Status** Done, browser-verified, in this repo.
**Portfolio value** ★★★★ — this is my anchor. It proves I finish things.

---

### 2. Decodable Passage Generator 🔥

**The problem** Decodable stories are the hardest thing in early literacy to
write, and there are never enough of them. A kid on lesson 34 needs a story
that uses *only* the sounds taught through lesson 34.
**Teacher edge** This is the one everybody gets wrong. If a single untaught
grapheme sneaks in — one silent *e*, one *-tion* — the child guesses, and
guessing is exactly the habit decodables exist to prevent. Plus you need enough
sight words to make English sentences sound like English.
**AI machinery** This is the best possible demo of agents checking agents:
1. **Writer agent** drafts a story with the allowed sound list.
2. **Grapheme auditor subagent** goes word by word against the allowed set and
   returns every violation. It did not write the story, so it is not attached to it.
3. **Loop** — send violations back to the writer, re-audit. Repeat until zero.
4. **Story-quality judge** checks it's actually a story, not "Sam sat. Sam sat."

**Smallest first version** One lesson's sound list, one 5-sentence story, and the
auditor printing "CLEAN" or a list of bad words.
**Portfolio value** ★★★★★ — **my #1 pick.** Massive real demand, visibly hard,
and the correctness loop is impossible to fake.

---

### 3. Word Problem Generator with a Solver Watching

**The problem** AI math worksheets are full of problems with wrong or ambiguous
answers, or that quietly require a skill not taught yet.
**Teacher edge** Three constraints only a teacher knows to enforce: no regrouping
before it's taught; the numbers have to be *friendly* for the strategy being
practiced; and names/contexts should reflect the kids in the room.
**AI machinery** Generator agent → **independent solver subagent** that solves it
cold without seeing the intended answer → they must agree, or the item is thrown
out and regenerated. A third subagent checks that exactly one reading of the
sentence is possible.
**Smallest first version** Ten 3rd-grade two-step problems where the solver
agrees on all ten.
**Portfolio value** ★★★★★ — "my generator checks its own math" is a sentence
that lands in an interview.

---

### 4. Assessment Item Bank with Diagnostic Distractors

**The problem** Multiple choice usually tells you *that* a kid missed it, not
*why*.
**Teacher edge** Every wrong answer should be a specific misconception I have
watched real kids have. In 3-digit subtraction: subtracted small-from-large in
each column; forgot to decrement; borrowed across a zero wrong. Now the wrong
answers are data.
**AI machinery** A subagent per misconception generates that distractor; a
verifier confirms each distractor is reachable by a *plausible* error and that no
two distractors match the same mistake.
**Smallest first version** One standard, five items, misconception labeled on
each distractor.
**Portfolio value** ★★★★★ — this is assessment-literacy, and it's rare.

---

### 5. Fluency Passage Set with Difficulty Drift Control

**The problem** Weekly fluency progress monitoring is only valid if every
passage is the *same* difficulty. Most homemade sets drift, so the growth graph
is fiction.
**Teacher edge** Knowing that the graph is worthless if week 4 is easier than
week 3. That's the whole insight.
**AI machinery** Generate 30 passages → readability/word-frequency scoring agent
→ **reject and regenerate anything outside the band** → loop until all 30 sit
inside a tight range. Then chart the band to prove it.
**Smallest first version** Six passages, all landing within a narrow readability
window, plotted.
**Portfolio value** ★★★★ — quietly sophisticated. Shows I know what makes data valid.

---

### 6. Vocabulary Set Builder (Tier 2, not Tier 3)

**The problem** Vocabulary instruction usually targets the wrong words — the
rare topic words, not the useful across-the-curriculum ones.
**Teacher edge** *Tier 2* selection (`reluctant`, `enormous`, `gather`) is a
judgment call. Also: kid-friendly definitions must avoid using the word itself
or a harder word.
**AI machinery** Fan-out subagents: one writes the kid definition, one writes
example + non-example, one builds the morphology family (`gather / gathering /
gathered`), one drafts a picture prompt. A "no harder word than the target"
checker gates the definition.
**Smallest first version** One chapter book, ten tier-2 words, full cards.
**Portfolio value** ★★★

---

### 7. Handwriting & Letter Formation Sheets

**The problem** Small, honest, real: I need dotted-trace practice for a
particular letter, with correct starting-stroke arrows.
**Teacher edge** Start point and stroke order matter, and most generators get
lowercase *b/d* reversals backwards.
**AI machinery** Light. Mostly SVG generation.
**Smallest first version** One letter, one page.
**Portfolio value** ★★ — filler, but ships in an hour and rounds out the suite.

---

# Part 2 — Closing the assessment loop

### 8. Running Record & Miscue Analyzer 🔥

**The problem** Running records are the richest reading data we collect and they
mostly rot in a folder because analyzing them takes too long.
**Teacher edge** A miscue isn't just "wrong." It's *meaning*, *structure*, or
*visual*. A kid who reads "pony" for "horse" has a completely different problem
than one who reads "house" for "horse" — and the instruction that follows is
completely different.
**AI machinery** The best **end-to-end loop** in this file:
teacher types what the kid said → classifier agent tags every miscue M/S/V →
accuracy + self-correction rate computed → pattern-namer agent says "over-relies
on first letter, ignores meaning" → **it then calls my existing phonics worksheet
generator** to print the matching practice.
**Smallest first version** Paste a text and a kid's reading, get the three rates
and one named pattern.
**Portfolio value** ★★★★★ — this is the demo that makes the whole portfolio look
like one connected system instead of five toys.

---

### 9. Exit Ticket → Tomorrow's First Ten Minutes

**The problem** I collect 25 exit tickets at 2:40 and I'm supposed to
"differentiate tomorrow" using them by 8:15.
**Teacher edge** Sorting into three piles is not the hard part. Naming the
*specific misconception* in each pile is, and so is knowing that the "partial"
pile needs a different move than the "not yet" pile.
**AI machinery** Fan out one subagent per pile; each writes a targeted 10-minute
opener. A synthesis agent checks the three openers don't accidentally teach three
different strategies for the same skill.
**Smallest first version** Type in 10 student answers, get 3 piles + 3 openers.
**Portfolio value** ★★★★★ — every teacher alive would use this tomorrow.

---

### 10. Differentiation Engine (one lesson → six versions)

**The problem** One lesson, and I owe legally-required accommodations to six
different kids by tomorrow.
**Teacher edge** Real accommodation profiles: extended time, reduced item count,
read-aloud-friendly formatting, visual supports, EL entering/emerging, and
above-grade extension. Reduced-item does **not** mean "the first five" — it means
keep coverage of every sub-skill with fewer items. That distinction is the whole job.
**AI machinery** Textbook fan-out: one subagent per profile, all at once, then a
QA agent confirms every version still assesses the same standard.
**Smallest first version** One worksheet in, three profiles out.
**Portfolio value** ★★★★★ — biggest time-saver on this list. Also the most
directly sellable to a district.

---

### 11. Standards Unpacker

**The problem** A standard is a dense sentence. Turning it into instruction takes
an hour.
**Teacher edge** Knowing the *prerequisite* skills underneath it — the ones that
aren't written down anywhere but are why kids fail the standard.
**AI machinery** Parallel subagents: kid-friendly "I can" statement / prerequisite
ladder / common misconceptions / 3-question exit ticket / rubric. One call,
five specialists.
**Smallest first version** Paste one standard, get all five sections.
**Portfolio value** ★★★★

---

### 12. Small-Group Grouping Agent

**The problem** Flexible grouping is supposed to change every two weeks. In
practice groups calcify in September and never move.
**Teacher edge** A good group has a peer model and no dead ends. Also some
kids must not be grouped together and that constraint never lives in the data.
**AI machinery** Propose → **critic subagent** ("does any group have no peer
model? is anyone always the lowest in every group?") → revise → repeat. A
straight generate-check-fix loop on a human problem.
**Smallest first version** 24 fake students with scores, three grouping options
with reasons.
**Portfolio value** ★★★★

---

### 13. Math Fact Fluency Engine (grow *Factor Field*)

**The problem** My Factor Field tool practices times tables. Right now it knows
what kids get *wrong*.
**Teacher edge** **Speed is the real signal.** A fact answered correctly in four
seconds is not fluent — it's being computed, not recalled. Accuracy hides this
completely.
**AI machinery** Track per-fact latency, cluster the slow ones, generate targeted
sets, adapt nightly. Add a loop that keeps re-testing until a fact is fast three
sessions in a row.
**Smallest first version** Log response time per fact and show the slow-but-correct list.
**Portfolio value** ★★★★ — building *on top of* something I already shipped
tells a good story about iteration.

---

# Part 3 — Talking to families and colleagues

### 14. Report Card Comment Composer

**The problem** Ninety comments, three times a year, all needing to be honest,
specific, warm, and not copy-pasted.
**Teacher edge** A good comment does three things: names a strength truthfully,
names one next step, and never uses diagnosis language I'm not licensed to use.
**AI machinery** Generator → **tone-check subagent** (is this deficit-framed? is
there an actionable next step?) → **repetition checker** against last trimester's
comments so no family gets the same sentence twice. Memory across terms.
**Smallest first version** Checkboxes + 2 data points → one comment, tone-checked.
**Portfolio value** ★★★★ — universally hated task, so instantly appreciated.

---

### 15. Parent Message Translator & Softener

**The problem** What I need to say and what a worried parent can hear at 9pm are
two different messages.
**Teacher edge** Rewriting to ~6th-grade reading level, in the family's home
language, while keeping every fact intact — and knowing which words are legally
off-limits for me to write.
**AI machinery** Rewriter agent → **fidelity-checker subagent** that compares
original and rewrite and flags anything the softening accidentally changed or
dropped. Softening must never become lying, and a second agent is how you prove that.
**Smallest first version** Paste a blunt note, get a warm version plus a
"facts preserved: yes/no" report.
**Portfolio value** ★★★★

---

### 16. Weekly Family Practice Pack

**The problem** "How can I help at home?" — asked constantly, answered vaguely.
**Teacher edge** It has to be *ten minutes*, need no printing, no prep, and match
what we actually did this week.
**AI machinery** Reads the week's lessons → generates a one-pager per family →
translates → optionally sends. Chains right into ideas #1 and #8.
**Smallest first version** One week of skills → one printable page.
**Portfolio value** ★★★★ — this is the *closed loop* story again, and families
are who EdTech companies want to reach.

---

### 17. Behavior Documentation Assistant

**The problem** My in-the-moment notes are subjective ("he was defiant again").
For an SST or a referral they have to be objective and observable.
**Teacher edge** ABC format — antecedent, behavior, consequence — and the
discipline of stripping every judgment word. "Defiant" is an opinion. "Did not
begin work for 6 minutes after the third prompt" is a fact.
**AI machinery** Rewriter → **judgment-word detector subagent** that flags any
inference and forces it back to observable language. Pattern-finder across weeks
of entries surfaces the antecedent I keep missing.
**Smallest first version** Paste three messy notes, get three ABC entries.
**Portfolio value** ★★★★ — shows I understand documentation, not just content.
Careful, sensitive, private-by-default. Never leaves the device.

---

# Part 4 — Bigger systems (the show-off tier)

### 18. Sub Plans in Ten Minutes

**The problem** It's 5:00am, I'm sick, and writing sub plans is harder than
going in sick. Every teacher knows this feeling.
**Teacher edge** Real sub plans need things nobody thinks of: which kids need a
heads-up, what the sub does when the tech fails, and true no-prep filler for the
twelve minutes that always go wrong.
**AI machinery** Fan-out per block of the day, plus a "what could go wrong"
subagent that adds the backup activity for each block.
**Smallest first version** One day, three subjects, one page.
**Portfolio value** ★★★★★ — the most *emotionally* compelling demo here. Say
"5am, sick, kids still need a day" in an interview and everyone in the room nods.

---

### 19. Curriculum Gap Auditor

**The problem** In June you find out you never really taught measurement.
**Teacher edge** Knowing the difference between "mentioned it" and "taught it to
mastery," and that pacing guides lie.
**AI machinery** The biggest fan-out on this list: point it at a year of plans,
one subagent per standard reads everything looking only for its own standard,
then a synthesis agent produces the gap report and a recovery plan for the weeks
left. A completeness critic asks "what did no agent look at?"
**Smallest first version** One quarter, ten standards, a covered/thin/missing table.
**Portfolio value** ★★★★★ — this is the one that looks like *engineering*, not
a worksheet maker. Dozens of agents, one report.

---

### 20. The QA Gate Skill (the piece that ties it all together) 🔑

**The problem** Every generator above can produce plausible garbage.
**Teacher edge** I know exactly what makes a worksheet unusable, and it's never
one big thing — it's reading level creeping too high, the same three names every
time, an answer key that's wrong, a skill that hasn't been taught yet, or a page
that won't print on 8.5×11 without cutting off.
**AI machinery** **One reusable skill that every other project calls.** Nothing
ships until it passes: reading level in band, name/context variety, answer key
independently verified, no untaught skills, prints clean, copyright rules honored.
**Smallest first version** Run it against my existing phonics sheets and see
what it catches.
**Portfolio value** ★★★★★ — **build this second.** It instantly turns "some
tools I made" into "a platform with quality control," and it's the clearest
signal that I think in systems. It is also, not coincidentally, the most
teacher-y idea in the file: I built the rubric before I graded the work.

---

## My honest recommendation: what to build next

If I only get three, in this order:

1. **#2 Decodable Passage Generator** — highest real-world demand, visibly hard,
   and the self-checking loop is the single best proof that I build carefully.
2. **#20 The QA Gate Skill** — cheap to build, and it upgrades everything I've
   already shipped, retroactively.
3. **#8 Running Record Analyzer** — because wiring it into the phonics generator
   turns four separate tools into one closed loop: *assess → diagnose → practice.*

That trio tells a complete story: **I can build it, I can prove it's correct, and
I connect the pieces.**

**The pitch sentence, once those three exist:**
> "I built a reading system that assesses a child, names the specific skill
> that's broken, generates practice for exactly that skill, and refuses to print
> anything that doesn't pass its own quality gate. I've taught this for fourteen
> years — I know what wrong looks like, so I taught the software to know too."

---

## Rules I carry into all of it

- **Copyright:** phonics scope & sequence is shared teaching method (fine).
  Dolch (1936) is public domain (fine). **Fry is not free — never use it.**
  Never reproduce another program's wording, word lists, or page design.
- **Student data never leaves the device** unless there is a real reason and a
  real agreement. Especially #17.
- **Ship the smallest working thing first**, look at it in a browser, then grow it.
- **Nothing prints that I wouldn't hand a child in my own room.**
