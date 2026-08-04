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

## The five-minute check before shipping a passage

1. Read it aloud. Any sentence you stumble on, rewrite.
2. Circle every `it`. Draw a line to its noun. If two lines land on different
   nouns, rewrite.
3. Underline every verb. One tense throughout?
4. For each verb, ask: does that thing really do that?
5. Cover the last line. Can a six-year-old say what the character wanted, what
   was in the way, and how it ended?
6. Read the title aloud as an adult. Does it read as English, mean something,
   and keep the secret?
7. `grep` the sentence against Form A. Zero hits.
