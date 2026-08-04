# Writing rules for Form B running-record texts

Derived from an exhaustive language/sense/story audit of all 294 sentences in
`data/lesson-006.json` through `data/lesson-041.json` (Aug 2026). Every rule
below exists because a real defect in that set violated it.

**Why these rules are stricter than "decodable" rules.** A child reads this text
aloud while a teacher marks every word. If a sentence does not parse, or a
pronoun cannot be resolved on the fly, the child hesitates or self-corrects —
and the teacher scores that as *the child's* decoding error. A muddled sentence
does not just read badly. It corrupts the assessment data.

Rules marked **[MECHANICAL]** can be checked by a script. A suggested check is
given for each; they belong in `check_formb.py` or `quality.py`.

---

## 1. Sentences

**1.1 Every sentence must have a subject and a finite verb.** No verbless
fragments, even stylish ones. *(L26: "Lots of bags, but not his cap." → "He sees
lots of bags, but not his cap.")*

> **[MECHANICAL]** Flag any sentence with no word from the passage's verb
> inventory. Maintain the inventory per lesson; it is small and closed.

**1.2 Do not use `did` + base verb as the plain narrative past.** `did tip`,
`did pat`, `did cut` is the *emphatic*, used only for contrast ("she DID cut
it"). Used as ordinary past it is not English and it teaches a wrong pattern.
25 instances appear in L15–L19.

Before `-s` is taught (lesson 20) you cannot write `cuts`, so use the irregular
pasts that are already decodable: **sat, got, had, fed, set, cut, put, let, hid,
bit, ran, dug, was, hit, met, fit, did**. Every one of the 25 instances is
fixable this way — `Nan did cut up a nut` → `Nan cut up a nut`; `Dot did tip it
in a cup` → `Dot put it in a cup`.

`did not` + base is correct and stays (negation requires do-support).

> **[MECHANICAL]** `grep -E '\bdid (?!not)[a-z]+'` over every line. Expected
> count: zero.

**1.3 One tense per passage.** Pick present (lessons 20+) or irregular past
(lessons 15–19) and hold it to the last line. Dialogue may sit in its own tense;
`said` stays past throughout. *(L23 opens past — "Deb hid a cap" — and switches
to present at line 3. L16, L17, L19 also drift.)*

> **[MECHANICAL]** Tag every non-dialogue finite verb as present or past. More
> than one tag in a passage = fail.

**1.4 No comma splices.** *(L25: "It is not mud, it is tin!" → "It is not mud.
It is tin!")* Punctuation is phrasing instruction for a child reading aloud.

> **[MECHANICAL]** Flag `, ` followed within four words by a second subject +
> finite verb with no conjunction.

**1.5 No inverted subject and verb.** Beginning readers parse
subject-verb-object and stall on anything else. *(L35: "Up hops the cat!" → "The
cat hops up!")*

> **[MECHANICAL]** Flag any sentence starting with a preposition or particle
> (`Up`, `Down`, `In`, `Out`, `Off`) followed immediately by a verb.

**1.6 No centre-embedded clauses and no stranded prepositions.** *(L28: "Tap the
cup it is in to win." — a relative clause inside an imperative with a stranded
`in` and a purpose infinitive, all in seven words. → "Tap a cup. Can you get the
nut?")*

> **[MECHANICAL]** Cap sentences at 8 words and at one finite verb (two if
> joined by `and`/`but`). Flag anything longer for hand review.

**1.7 Do not invent predicates that are not English.** `It is not up` for "he
could not lift it" (L29), `it is up` for "it is out of reach" (L31), `but it
sits` for "it will not move" (L37). Say the thing plainly: "He can not get it
up." / "It is up on a log." / "Tom tugs and tugs at the bin."

---

## 2. Pronouns

**2.1 A pronoun's referent must be the nearest preceding noun that matches it.**
No exceptions. If the intended referent is not the nearest one, repeat the noun
instead. *(L21: "A big pig begs at the pen. But it tips the tub!" — nearest noun
is `the pen`. → "But the pig tips the tub!")*

**2.2 `it` may point to exactly one thing per passage.** The moment a second
thing needs `it`, name one of them. This is the single most common defect in the
set:

- **L19** — `it` = pig, then cob, then pig, then pen, in five consecutive lines.
- **L22** — `it` = pit, pot, soil, nut, then the cat, across six lines.
- **L26** — `it` = the hen in line 7, the cap in line 9.
- **L15** — `it` = the nut, then the cup, then the spill, then a second nut.
- **L18** — `it` = weather (dummy), then the mat, then the cat.
- **L25** — `it` = the cup, then the mud dot, then the rag, in three lines.

**2.3 Never put two different referents behind `it` in one sentence.**
*(L28: "Deb taps a tan cup, but it is not in it." → "Deb taps a tan cup, but the
nut is not in it.")*

**2.4 No dummy `it`.** `It is ten` (L18), `It is hot` (L37) — a passage that
opens with non-referential `it` and later uses referential `it` trains the child
to look for a referent that was never there. Start with a noun: "Meg is in bed."
/ "The sun is hot."

**2.5 One `he`/`she` per passage, or repeat the name.** *(L36: "Tim runs up to
him. He has a box of pins." — `He` is meant to be Tim but the nearest masculine
is Sid. → "Tim has a box of pins.")* Same problem in L38 ("his mat" — Tim's or
Dad's?) and L34 ("his mug").

**2.6 Do not switch a character between `it` and a name/`he`.** If an animal is
`it`, it stays `it` and no human in the passage is ever `it`. *(L17: `it` = the
bat six times, then "It is not a bad dog" — `it` becomes the dog in the second
to last line.)*

> **[MECHANICAL]** For each passage, walk the lines and bind every `it` to the
> nearest preceding singular non-human noun. Print the binding chain. If the
> chain names more than one distinct noun, fail and require hand review. This
> one check would have caught L15, L18, L19, L21, L22, L25, L26, L28.

---

## 3. Truth and collocation

**3.1 The verb must be what that thing actually does.** Check every
verb-noun pair against reality:

- Jets **roar**; they do not **hum** (L29).
- You **wash** or **wipe** a pot; you **mop** a floor (L12 "I mop the pot").
- You **tip** or **pour** loose feed; you do not **mix** whole corn cobs (L31).
- Rats **gnaw** nuts; they do not **rip at** them (L24).
- You **haul** or **lug** a tub a distance; **tug** is one sharp pull (L21).
- A nutshell **cracks**; it does not **pop** (L39).
- You **spread** jam; you do not **set** jam on a bun (L41).

**3.2 Objects do not `sit`.** `The cobs sit in the pen` (L21), `Nuts sit on the
mat` (L24), `a dot of mud sits in the cup` (L25), `The bus sits` (L33), `but it
sits` (L37). Use `are`, `is on`, `stops`, or `does not move`. Six instances; a
child reading `The bus sits` literally pictures a bus sitting down.

> **[MECHANICAL]** Flag `sit|sits` whose subject is not a person or animal from
> the passage's character list.

**3.3 Do not be mad at, or beg, an object.** *(L38: "Tim is mad at the rip." →
"Tim is sad." L22: "The kids beg it to nap on a bag.")*

**3.4 Do not name an emotion nobody has shown, especially by negating it.**
`Dad is not mad` (L13), `It is not a bad dog` (L17), `Pam is not mad at it`
(L35) — nobody accused anyone. Either show the anger first or cut the line.

**3.5 A physical action must be physically possible on the page.** *(L27: "It
pops up! Ten nuts are in his lap." — a lid popping off does not throw the
contents into your lap; the pot has to tip. L21: a pig inside a pen cannot tip a
tub the children are still carrying toward it.)*

**3.6 The preposition must name the real spatial relation — and if the true
preposition is not decodable yet, change the story, not the preposition.**
Rule 3.1 checks verb-noun pairs; the preposition goes unchecked and it is where
the geometry actually lives.

At lessons 15–41 the decodable preposition inventory is essentially **at, in,
on, up, of, to**. `over`, `under`, `through`, `into`, `onto`, `behind`,
`beside`, `across` are all untaught. So any plot whose central action is *cover*,
*trap beneath*, *pass through* or *put inside* can only be written by using a
preposition that says something false:

- **L22** — the whole plot is trapping a bug **under** a pot. Written: "Ted pops
  a pot **on** it." On the bug is where the pot would crush it. The title then
  promises "The Bug **in** the Pot", a third relation that never occurs.
- **L24** — a rat gets **through** a tear. Written: "A rat hops **in** the rip!"
  which puts the rat inside the tear itself.
- **L16** — "Sid, Pam and a dog sit **at** a mat." You sit *on* a mat, and `on`
  is fully decodable here; line 8 then says "nap **on** the mat," so one relation
  gets two prepositions in one passage.

The fix is at story-selection time. If the passage needs `under` or `through` to
be true, pick a different passage. A lie about where a thing is costs more than a
lost plot: the child builds the wrong picture and then miscues on the line that
contradicts it.

> **[MECHANICAL]** Whitelist the decodable prepositions per lesson. Flag any
> passage whose title and body use different prepositions for the same
> noun pair, and any noun that takes two different prepositions in one passage.

---

## 4. Reference and introduction

**4.1 First mention takes `a`/`an`. `the` means the reader has already met it.**
Violated at L24 ("the nuts"), L29 ("the jug"), L33 ("the bus"), L36 ("the mat"),
L37 ("the cobs"), L38 (nothing), L40 ("a log" when the same log is meant —
the reverse error, which puts fox cubs at the characters' feet).

> **[MECHANICAL]** Build a per-passage noun ledger in reading order. Flag any
> `the <noun>` whose noun has not appeared before. Flag any `a <noun>` for a
> noun already introduced. Whitelist Mom, Dad, and the sun.

**4.2 Every prop that does work in the story must be on the page before it
works.** Unintroduced props doing plot work: the cob (L20 line 6), the mug
(L20 line 8), the mat and the cap (L22), the pot (L23), the mug (L34), the bun
(L35), the bus (L36 last line), the second bun (L41), the dog (L17 line 4 — a
whole character).

**4.3 One word, one meaning across the whole set.** `pot` is a cooking pot (L27,
L38, L41), a flowerpot (L22), and a junk drawer (L38) in the same corpus. `cap`
is a hat (L23, L26, L36) and a lid (L22). `bat` (L17) is never disambiguated —
animal or baseball bat — and the story works either way, which means the child
has no way to picture it.

---

## 5. Story

**5.1 Want, obstacle, resolution — all three on the page.** A vignette is not a
passage. *(L40: Ben sees a fox, then sees cubs. Nothing is wanted and nothing is
in the way.)*

**5.2 The resolution must actually resolve, and the text must say why.**

- **L15** — "It can not tip," said Dot. Nothing changed; the cat is still there
  and the cup is still on the mat. The fix is asserted, not performed.
- **L31** — the cobs are in the mud and the tub is out of reach on a log, and
  then "The ox has its cobs." The middle step is missing.
- **L26** — the payoff is mis-stated: the hen "sits on the mat" and the cap "is
  on the mat," so the hen was *beside* the cap, not on it, and Ned's line "Hen,
  it is not a bed" no longer lands.
- **L25** — the twist is contradicted by the line before it. "The rag rips, but
  the dot is on it!" means the dot came off, i.e. it *was* dirt; Ron then says
  "It is not mud, it is tin!"
- **L21** — "The cobs sit in the pen" negates the problem four lines before the
  characters solve it.

**5.3 No step may live only in the writer's head.** If the child must infer it,
write it. *(L20: Ted puts bun on a cob as a decoy and the reason is never given.
L23: the whole hot/cold hiding game is never set up. L16: the dog got lost
during tag — never stated. L36: the bun and cap fell out through the rip —
never stated. L33: six vans plus "a lot of red vans" must somehow equal exactly
ten.)*

**5.4 The character must earn the ending.** *(L34: Zac fails the riddle and a
bug happens to walk in; Liz says "You got it." He did not.)*

**5.5 Credit the character who actually did it.** *(L27: Dad taps the lid loose,
then says "Hal did it." L37: both of them tug, then "You did the job.")*

**5.6 Do not open with the answer.** *(L30 line 1: "Sal has a red hat in a bag"
— then runs nine lines of guessing what is in the bag.)*

**5.7 A wrong guess must be a plausible wrong guess.** *(L34: the riddle says
"six legs" and Zac guesses "a cat." Either drop the number from the riddle or
give him a guess that fits it.)*

---

## 6. Dialogue

**6.1 Every quoted line must be something a real person would say out loud.**
*(L27: "Dad, is the lid bad?" — no child says this. → "Dad, can you get the lid
up?" L37: "Tug!" as an entire line. → "I can tug.")*

**6.2 Every line of dialogue needs a speaker and a listener.** *(L26: "Let me
look in the bin," said Ned — nobody else is in the room.)*

**6.3 Dialogue must respond to what is actually on the page.** *(L16: Gus finds
his lost dog in the fog and says "Sit." L23: "Not hot" is a move in a game the
text never establishes.)*

**6.4 No adult idiom, and no idiom the story has not taught.** `fed on the nuts`
(L24 — naturalist register, not how a mother speaks), `a lot to lug` (L29),
`It is a job to fix` (L38 — means "hard to fix" or "a task"? both), `You do the
lids` (L41 — a habitual-future joke), `It is not big` as a refusal (L39).

**6.5 Vary the ending.** Eight of 27 passages end with a hug (L25, L28, L30,
L32, L33, L38, L39, L41). Six end with the same praise formula — "Hal did it" /
"Raj did it" / "You did it, Tim" / "You did the job" / "You got it" / "Tom got
it" (L27, L29, L30, L34, L36, L37). Five use `hums` as emotional filler (L23
twice, L29, L32, L33, L34).

> **[MECHANICAL]** Count final lines by pattern across the whole set. No pattern
> may exceed 15% (4 of 27).

**6.6 Dialogue must be in the register of the speaker's age, not merely be
humanly sayable.** Rule 6.1 asks "would a real person say this?" — which passes
lines no *child* would ever say, and lines no *parent* would ever say. Both drifts
are present:

- **A child talking like an adult.** L38: "**You fix a lot**," said Tim — a
  summative judgement about a parent's character. A six-year-old says "Thanks,
  Dad!" L34: "**The cat can have the rug**," said Zeb — granting property
  rights. L28: "**Deb wins**," said Ned — refereeing a game nobody was playing.
- **An adult talking like a textbook.** L19: "**A mug is a pot**," said Mom — a
  definition, not a sentence a mother says. L24: "**Buds rot in a hot bin**,"
  said Mom — a generic scientific truth.

**6.7 Read every line aloud as an adult, not just the title.** Rule 7.5 applies
this test to titles only; the body is where it is actually failing, because
literal decodable words keep colliding with fixed adult expressions.

- **L39** — "Dad sets the log on the mud. **The bugs dig in.**" *Dig in* is the
  idiom for *start eating heartily*. The last line of the passage is a joke.
- **L31** — "Ben, **do the wax**," said Dad — reads as grooming.
- **L22** — "**Do not tap it**," said Gus — has an adult slang reading.

**6.8 Vary the OPENING and every recurring line, not only the ending.** Rule 6.5
counts final lines and nothing else, so two much larger repetitions ran straight
through it:

- **Openings.** 15 of 27 passages open with `<Name> and <Name>` as the subject.
  Eight of those open with the identical frame **`<Name> and <Name> sit …`**
  (L15, L16, L17, L20, L28, L29, L33, L40 — "Nan and Pip sit on a mat," "Deb and
  Ned sit in the sun," "Ben and Dad sit on a log"). Six of 27 put the sun in the
  first line (L20, L23, L28, L29, L37, L39). Nearly a third of the set opens on
  two characters at rest on a surface — no want, no motion, no reason to turn to
  line 2.
- **Mid-passage catchphrases.** Six of 27 contain the same verbless scold at an
  animal: "Dog! Not the cap!" (L17), "Not in the pot, cat!" (L20), "Not the
  buns, dog!" (L21), "Bug, not the bag!" (L22), "Not in the bin, rat!" (L24),
  "Not on the rug, pup!" (L37). Five of 27 open a line of dialogue with "Do not
  …" (L22, L29, L30, L31, L34).

The opening does more work than the ending. It is where the child sets their
reading rate, and where the teacher's running record begins.

> **[MECHANICAL]** Run the 6.5 pattern count over *first* lines and over *all*
> lines, not just last lines. Cap any first-line frame at 15%. Flag any quoted
> sentence whose first two words recur in 4+ passages.

---

## 7. Titles

**7.1 A title must read as English, not as a stack of nouns.** Bad: "The Nut
Pot" (L22), "The Nut Bag" (L38), "The Jam Lid" (L41). Good: "The Fan Quits"
(L32), "Let Ned Look" (L26), "The Fox Den" (L40).

**7.2 A title must mean something.** "Hot and Not" (L23) — the opposite of hot
is cold. The pair exists only because it rhymes.

**7.3 A title must not spoil the ending.** "The Tin Cup" (L25) announces the
twist — that the cup turns out to be tin — in the title. "Pins Fix It" (L36)
gives away the solution.

**7.4 A title must match the story.** "The Red Mug" (L29) — the mug appears in
one line out of nine; the story is about a heavy jug. "Pet Rats" (L24) is plural
for a story about one rat.

**7.5 Read the title aloud as an adult before shipping it.** "The Nut Bag"
(L38) has an adult slang reading. So does "In the Bag" (L30), mildly.
*(See 6.7 — this test must be run over every line, not only the title.)*

**7.6 A title may not be a verbatim line of the passage.** The title is read
first and it is read aloud. If it is also line 1, the child decodes that sentence
once as a title and then *recalls* it as their first scored line — so the running
record opens with a word count the child never actually read.

- **L26** — title "Ned Can Not See His Cap"; line 1 "Ned can not see his cap."
  Identical, seven words, the whole first line of the record.
- **L30** — title "Do Not Look in the Bag"; line 2 "\"Do not look in the bag,\"
  said Sal."
- Near-misses to watch: L41 "The Bug Hops Up" / "The bug hops up on a bag";
  L27 "Hal Hops and Hops" / "He hops and hops"; L32 "The Fan Quits" / "But the
  fan quits and Max hops up."

> **[MECHANICAL]** Lowercase and strip punctuation from the title and from every
> line. Fail on exact match; flag when the title's content words are a subset of
> any one line's.

---

## 8. Form B is an *alternate* form

**8.1 No sentence may appear in both forms of the same lesson.** Currently
violated: L6 (**both** of its sentences — "I tap the mat." and "Sam and Pam
sat." — are lifted verbatim from Form A lesson 6) and L12 ("The pot is on
top."). A child who practised on Form A has already seen these.

**8.2 No sentence may appear anywhere in the other form.** Also violated at L8
("I sit and sip." = Form A L8), L17 ("Is it in the tub?" and "Is it in the bin?"
= Form A L19), L29 ("It is not up." = Form A L34).

> **[MECHANICAL]** Extract every sentence from Form A lessons 1–128 into a set.
> Fail any Form B sentence of 3+ words that is a member. Runs in a second.

**8.3 No plot may be reused across forms.** Form B L28 "Ten Cups" is Form A L20
"Ten Cups and a Nut": same game, same ten cups, same nut, same tan cup, same
tin cup, nearly the same title.

**8.4 No plot may be reused inside Form B.** Currently three straight repeats:

| | |
|---|---|
| L27 "The Lid" / L41 "The Jam Lid" | stuck lid on a pot → tap it → it pops |
| L36 "Pins Fix It" / L38 "The Nut Bag" | bag with a rip → a pin fixes it |
| L21 "Cobs and Pigs" / L37 "Hogs and Cobs" | haul cobs to pigs → container tips → pigs get cobs |

Plus four separate cat-makes-trouble-and-is-patted-anyway stories (L15, L18,
L22, L35).

> **[MECHANICAL]** Reduce each passage to a `<subject, verb, object>` triple
> list and compare pairwise. Flag any two passages sharing 3+ triples.

---

## 9. Sound

Rules 1–8 are all about grammar, sense and story. None of them listen. But this
text is never read silently — it exists only as sound in a child's mouth, and the
sound is what the teacher scores.

**9.1 No rhyme inside a sentence.** Two CVC words sharing a rime in one sentence
turn the line into a chant. A chanting child stops decoding and starts
predicting, and their accuracy score measures the wrong thing. 31 instances:

- L41: "**A bug hops on a rug.**" — the first line of the passage, five words,
  a perfect rhyme.
- L34: "A tan **cat** hops up and naps on the **hat**." then "The **cat** is on
  the **hat**!"
- L37: "Bev and Jon have the **bun** in the **sun**." L39: "Gus and Jen **run**
  in the **sun**."
- L29: three lines in a row rhyme **jug/mug** ("Raj has a jug and a mug," "Do
  not tug at the jug," "Raj dips the mug in the jug").
- L16: "Sid and the dog **tag** in the **fog**" (and the title, "Tag in the
  Fog"). L33: "**Gus** and Mom sit in a **bus**."

CVC decodables make rhyme almost free, which is exactly why it has to be
deliberate. Keep a rhyme only if the passage wants it *everywhere*; never one
line in nine.

**9.2 Two words in one sentence may not be one phoneme apart** — and this
applies hardest to character names. When the child says the wrong one, the
teacher cannot tell what the error was: a decoding failure on the target sound,
an eye-slip to the neighbouring word, or a name confusion. The miscue becomes
unattributable, and an unattributable miscue is a hole in the assessment.

- **L18 casts `Peg`, `Meg` and `Ted`.** Peg and Meg differ by one phoneme, are
  both female, and both handle the bin and the cap: "Ted met Meg at the bin." /
  "Meg got the cap in the bin!" / "Ted got the cap to Peg."
- **L35 casts `Jan` and `Dan`** and puts them side by side three times: "Jan,
  Dan and Sal are on a rug." / "Jan and Dan have buns and jam." / "Dan lets Jan
  have a bit of his bun." (Plus **jam** — one phoneme from both.)
- **L31's payoff line** is one phoneme from its setup: "**Ben, do the wax**,"
  said Dad → "**Ben did the wax**," said Dad.
- **L22** runs **bug / bud / bag** through the whole passage: "A **bug** is on a
  **bag**." / "A **bud** is up in a tub." / "The **bug** is on the **bud**!"
  Worse, the confusion still makes sense — "A bug is up in a tub" is a sentence
  this story could contain, so the child gets no self-correction cue and the
  teacher's meaning-check does not fire. **A minimal-pair miscue must produce
  nonsense.** If both readings work, rename one.
- Also L26 (can/cap, three lines), L27 (tug/tub), L34 (has/hat, cat/can), L19
  (mud/mug), L16 (Sid/sit, Pam/pan).

**9.3 No consonant pile-up across a word boundary.** A stumble here is scored as
the child's error. Watch runs of /s/ and /z/, and stop-to-stop joins:

- L20: "The cat na**ps**. **S**am **s**it**s** in the **s**un."
- L33: "\"We **s**ee **s**ix van**s**,\" **s**he **s**aid." — five sibilants in
  five words, plus **see/she** one phoneme apart.
- L36: "**T**im **t**ips **t**he box up. I**t** fi**ts** in **t**he bin!"
- L38: "**T**im **t**ips **t**en buns in the bag and zi**ps it**."
- L22: "Gus and Ted **pop** the **pot** on the tub."

> **[MECHANICAL]** All three are scriptable on the word forms alone, no
> pronunciation dictionary needed, because the vocabulary is CVC.
> 9.1 — within each sentence, compare all 3-letter words; fail on equal final two
> letters with different first letters. 9.2 — fail on Hamming distance 1 between
> any two words in a sentence, and between any two character names anywhere in a
> passage. 9.3 — count words per sentence beginning or ending in `s`/`z`; flag 4+.

---

## 10. The passage is a scored instrument

Everything above asks whether the writing is good. These ask whether the *score*
means anything. A defect here leaves the prose clean and the data wrong.

**10.1 No two lines of a passage may be near-duplicates.** A child who has just
read a line does not decode its twin — they recite it. The teacher marks those
words correct, and the accuracy percentage counts words that were never read.
This is the one defect that *inflates* a score.

- **L41** is built from a single frame. Title "The Bug Hops Up", then "A bug
  hops on a rug." / "The bug hops up on a bag." / "Let the bug hop in a pot," /
  "The bug hops in!" / "The bug hops on the log." — six occurrences in a nine-line
  passage, and this is the **Short Vowels Review (all)** passage, the one that has
  to prove the most.
- **L22** — "Ted **pops a pot on** it." / "Gus **pops a cap on** the pot." / "Gus
  and Ted **pop the pot on** the tub." / "Ted **pops the cap** up." Four of nine.
- **L36** — "**Tim tips the box in.**" / "**Tim tips the box up.**" Two lines
  apart, differing in one particle; plus "tips a bag up" and "Tip the box up."
- **L21** — line 1 "Bob and Sid pop buns in a bag." and line 6 "Bob and Sid pop
  the buns in a tub."
- **L26** — "A dog sits on the mat." / "The dog sits on it!" / "the dog sits on
  his lap."

Deliberate refrains are allowed *if the child is meant to join in* — L30's three
"Is it a …?" guesses are a game and they earn their repetition. Nothing else does.

> **[MECHANICAL]** For every pair of lines in a passage, compare content-word
> sets. Fail on ≥4 shared words with ≤3 differing. This finds L15, L16, L18, L19,
> L21, L26, L31 immediately.

**10.2 The plot turn may not ride on the word `not` alone.** `not` is
unstressed, monosyllabic, and the single most-omitted word in a running record.
When a passage's obstacle is "can not V" and its resolution is the same verb
without the `not`, dropping one small word turns the passage into a different,
still perfectly grammatical story — so the teacher records a one-word omission
and the total comprehension failure underneath it is invisible. It also breaks
meaning/structure/visual analysis, because the miscue *looks* meaning-preserving.

Eight of 27 passages state their obstacle as "can not": L15, L17, L18, L24, L26,
L27, L36, L39. Five resolve by removing the `not` and nothing else:

| passage | obstacle | resolution |
|---|---|---|
| L15 | "Pip can not tip it up." | "Nan and Pip tip it up." |
| L18 | "I can not nap," said Peg. | "I can nap," said Peg. |
| L26 | "Ned can not see his cap." | "Ned can see the cap!" |
| L36 | "It can not fit." | "It fits in the bin!" |
| L39 | "We can not tug it up." | "It is up!" |

Give the turn a second signal the child cannot miss — a new actor, a new object,
or a physical change ("The lid is off," not "It is not on").

**10.3 A line is the teacher's marking unit and the child's return sweep.
Treat it like one.** Nothing in these rules governs the `lines` array itself,
and it is inconsistent: lines run 3 to 13 words, and hold anywhere from one to
four sentences, with no pattern within a passage or across the set. L33 line 2
is one 12-word sentence — "\"Gus, see a jet, a hat, a bin, ten vans,\" said
Mom." — and also drops the coordinator before the last item, which no
six-year-old can supply from the punctuation alone. L23 pairs a 4-word line with
a 12-word one.

Set a house rule: **one line = one to two sentences and no more than 10 words**,
and no line that wraps. Rule 1.6 caps the *sentence*; nothing caps the line, and
the line is what the child's eye and the teacher's pen both work on.

> **[MECHANICAL]** Flag any line over 10 words or holding 3+ sentences. Flag any
> comma list of 3+ items with no `and` before the final item.

---

## The five-minute check before shipping a passage

1. Read it aloud. Any sentence you stumble on, rewrite.
2. Circle every `it`. Draw a line to its noun. If two lines land on different
   nouns, rewrite.
3. Underline every verb. One tense throughout?
4. For each verb, ask: does that thing really do that?
5. Cover the last line. Can a six-year-old say what the character wanted, what
   was in the way, and how it ended?
6. Read the title aloud as an adult. Does it read as English, mean something,
   and keep the secret? Is it a line of the passage? Then change it.
7. `grep` the sentence against Form A. Zero hits.
8. Read it aloud *again*, listening only for sound. Any two words that rhyme in
   one sentence, any two that are one sound apart, any place your tongue
   stumbles — rewrite. Say the character names one after another: can you hear
   the difference across a classroom?
9. Cover every line but one and ask: could a child say this line correctly from
   having read an earlier line? If yes, the score is inflated. Rewrite.
10. Find the sentence where the story turns. If the turn is the word `not`, add
    a second signal.
11. Read only the first lines of the last ten passages you wrote. Do they sound
    like one passage?
