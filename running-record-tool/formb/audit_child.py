#!/usr/bin/env python3
"""Gate 7 — THE CHILD. Is every word one they know, and every idea one they
should meet?

The other gates ask "can this be sounded out?" and "is this the right lesson?".
This one asks the question a teacher asks when a five-year-old sits down with
the page: do they know what this means, and would their grown-up mind it?

Four generalist audits each found DIFFERENT defects in the same 36 files, which
means each was sampling. This file enumerates. Everything below is a check that
runs over every field of every lesson -- title, real_words, nonsense_words,
high_frequency, sentences and lines -- not over a sample.

WHAT IT CHECKS

  1  blocked          core_vocabulary.BLOCKED, in EVERY field including titles
                      and the two word-list sentences. ("fat" got through once
                      because nothing looked at passage lines.)
  2  age              word_age, with an EXPLICIT cast list. gates.character_names
                      treats any capitalised non-initial word as a name, so in a
                      Title Case title -- "The Big Ox", "Pet Rats", "Ten Vans" --
                      every word after the first was exempted from the age gate.
                      The words under test were the ones being waved through.
  3  unrated          word_age.check returns "no rating available" -> PASS for
                      any word absent from aoa-lookup.csv. That default is a
                      hole: `yap` and `lug` walk straight through it. UNRATED
                      names the words a person has judged unsuitable.
  4  judged           Words that DO clear the numeric gate but that a teacher
                      rejects anyway, each with its reason.
  5  pseudoword       Say it aloud. Is it, or could a child hear it as, a real
                      word / a name / a brand / something rude? `mic`, `ap`
                      (app), `mis` (miss), `nic` (Nick), `im` (I'm), `tif`
                      (tiff) all shipped once.
  6  names            A name that collides with a common noun (Dot/dot). Two
                      names in one passage a single letter apart, which makes a
                      miscue unscoreable. A name whose mirror image is another
                      word on the page -- b/d reversal is THE five-year-old
                      confusion, and Pam/map sit in the same word list.
  7  feelings         A child who is sad, mad, scared or beaten, with no
                      resolution on the page.
  8  topics           Content a parent phones the school about: pork, nuts,
                      sharps, hand-feeding livestock, vermin as pets, insects
                      on food.
  9  context          What the passage assumes the child has at home -- a pet,
                      a farm, food that is always there.

WHAT THE SECOND PASS ADDED (checks 10-18)

Checks 1-9 all ask one shape of question: is THIS word, in THIS item, one the
child has? Everything below asks a question that shape cannot reach -- because
the defect lives in a field nobody scans, or in the SENSE rather than the word,
or only in the 36 items taken together.

 10  notes            The *_note and instrument_claim fields. fields_of() never
                      looked at them, because they were assumed to be for the
                      examiner. index.html appends L.note into #passage, the
                      same element the items are in. Lessons 13 and 14 print
                      "nad (slang)" -- a word this file's own PSEUDO_BANNED
                      calls "slang for a testicle" -- onto the page, along with
                      eight real words during a decoding measure.
 11  register         Decodability forbids apostrophes, so the corpus writes
                      "can not", "do not", "Let us". A child who reads for
                      meaning says "can't", "don't", "let's" -- and a running
                      record scores each as a substitution. The instrument
                      penalises the child who understands it.
 12  sense            A word inside the child's vocabulary, used in a sense the
                      child does not have. "pop" thirteen times meaning PUT.
                      word_age rates the lemma; nobody rates the sense.
 13  polysemy         Check 4 hand-wrote ONE rule for `den` ("one instrument
                      should not teach two senses"). This generalises it. `cap`
                      is a hat in six lessons and a lid in three.
 14  literal          "A mug is a pot." "The cap is a fan." Sentences that are
                      false as written. A literal-minded or EAL five-year-old
                      stops dead, and the stop is scored as disfluency.
 15  failure          The reader of these pages is a child being assessed
                      BECAUSE reading is hard. "Dan can not dip it, but Pam
                      can." is a peer-competence comparison handed to them
                      mid-test. Check 7 misses it: nobody is sad, so nothing
                      needs resolving.
 16  agency           Who fixes it. Every repair in the corpus is Dad's -- the
                      ax, the pin, the log the children could not lift. Mom
                      explains, directs and hugs, and never touches a tool. And
                      of 29 pronouns across the 36 items, 28 are masculine: no
                      girl in the instrument is ever "she".
 17  event            Every word known, the EVENT unknown. Waxing a cut log.
                      Composting. Check 9 asks what the child HAS at home;
                      this asks what the child has ever SEEN done.
 18  cast             Twenty-nine named characters over a year, three of them
                      not Anglo -- and decodability did not force that. Jin,
                      Rin, Min, Han, Tam, Nam, Lin and Kim are all CVC.

Checks 13, 16 and 18, plus the animal half of 9, are CORPUS-level: they run in
corpus_checks() over the whole folder and report against lesson 0. Asking them
of a subset would be asking a question three lessons cannot answer, so
audit(whole_set=False) skips them.

SEVERITY

  BLOCK   never ship. A blocked word, or a pseudoword that is a real word.
  HIGH    fails the run. A defect a teacher would send back.
  REVIEW  printed, does not fail unless --strict. A judgement call for a person.

ACCEPTED is the sign-off mechanism, modelled on word_age.APPROVED: a person
looks at a finding, writes down why it is fine, and it stops failing the run.
Nothing is silenced without a reason next to it.

USAGE

    python3 audit_child.py                 # all 36 lessons
    python3 audit_child.py --strict        # REVIEW findings fail too
    python3 audit_child.py --dir some/dir  # audit a copy
    python3 audit_child.py 24 35           # just these lessons

Exit 0 = clean, 1 = findings.
"""

import argparse
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
GENERATOR = HERE.parents[1] / "decodable-passage-generator"
sys.path.insert(0, str(GENERATOR))

import word_age                       # noqa: E402
import core_vocabulary as cv          # noqa: E402

BLOCKED = {w.lower() for w in cv.BLOCKED}

# ---------------------------------------------------------------------------
# The cast, declared. NOT inferred from capitalisation -- that is the bug this
# file exists to close. A name is exempt from the age gate; nothing else is.
# ---------------------------------------------------------------------------
# pam, meg, deb, ned and raj were retired: each reverses into a word the child
# already knows (map, gem, bed, den, jar), which turns the classic b/d reversal
# into a miscue an examiner cannot score. Their replacements are in the second
# row. They stay listed here — a name this instrument USED still has to be
# recognised as a name if it ever reappears, or the reversal check goes quiet
# on exactly the words it was written for.
CAST = {
    "sam", "pam", "tim", "nan", "dot", "gus", "bob", "meg", "ben", "sid",
    "ted", "kim", "deb", "reg", "ron", "ned", "hal", "raj", "sal", "tom",
    "max", "liz", "zac", "dan", "jen", "mom", "dad", "i",
    "min", "lin", "kip", "jin",
}

# ---------------------------------------------------------------------------
# CHECK 3 -- the hole in the age gate.
#
# word_age.check() returns (True, "no rating available") for anything missing
# from aoa-lookup.csv, because the alternative -- rejecting every unrated word --
# would reject every character name. So an unrated word is a word nobody has
# looked at. These are the ones a person has now looked at and rejected.
# ---------------------------------------------------------------------------
UNRATED_UNSUITABLE = {
    "lug": "an adult word for carrying; a child says 'take' or 'pull'",
    "quiz": "a testing word, and the concept of quizzing a friend is not one a "
            "five-year-old has; also unkind framing inside an assessment",
    "yup": "slang; a child reading aloud will say 'yes', which scores as an error",
    "zigs": "'zigzag' is one word children meet as a shape, never as two verbs",
    "zags": "as zigs",
    "yap": "a dog's bark, but not a word a five-year-old produces",
    "nib": "a pen part; unknown before about age nine",
    "sod": "turf to an adult, an insult in British English",
    "wan": "adult vocabulary",
    "gam": "not a child's word in any sense",
    "vim": "adult vocabulary",
    "tot": "an adult's word for a small child, not a child's own word",
    "cur": "an adult word, and an unkind one for a dog",
    "hob": "unknown to a child",
    "fob": "unknown to a child",
    "gib": "unknown to a child",
    "wen": "a lump on the skin",
    "tup": "a ram; farm vocabulary a child does not have",
    "sup": "archaic",
    "dun": "a colour name no child has",
}

# ---------------------------------------------------------------------------
# CHECK 4 -- words that clear the number and still fail the child.
#
# word_age lets a word through on a strong signal (learned by six) or two
# moderate ones (Dale-Chall familiar AND learned by 7.6). Dale-Chall asks about
# FOURTH graders. A word can be familiar to a nine-year-old and be furniture to
# a five-year-old, which is how `cot` (7.53) and `tan` (7.05) pass.
# ---------------------------------------------------------------------------
JUDGED_UNSUITABLE = {
    "cot": "7.53, and known to fourth graders, not to fives; most homes in the "
           "audience do not contain one. Approved in word_age for ONE lesson; "
           "it is used at three.",
    "tin": "6.79. As a MATERIAL ('it is tin', 'a tin pan') this is adult "
           "vocabulary. word_age approves it 'at one lesson only, where the "
           "story makes it a container' -- it is used at five.",
    "cob": "6.52. Children know 'corn on the cob' as a phrase; a bare 'cob' as "
           "a countable object is not a word they have.",
    "cobs": "as cob",
    "dim": "7.06. An abstract quality of light, with no picture to carry it.",
    "hog": "5.70 but regional, and it is the same animal the instrument "
           "elsewhere calls a pig -- one animal, two names, one test. 'Hog' "
           "also carries the playground insult.",
    "hogs": "as hog",
    "ox": "the brief's own example of decodable-but-unfamiliar. A draft animal "
          "outside a five-year-old's world, and it is a large animal placed "
          "next to a small child.",
    "vat": "unknown to a child",
    "fig": "a fruit most of the audience has never seen",
    "wig": "the concept carries teasing",
    "sow": "farm vocabulary, and a homograph (sow seeds)",
    "ewe": "farm vocabulary, and a homophone of 'you'",
}

# The same word can be fine or not depending on what it is attached to.
CONTEXT_RULES = [
    (r"\b(man|kid|boy|girl|mom|dad|he|she|sam|pam|ben|meg|gus|deb|ned|hal|"
     r"raj|sal|tom|max|liz|zac|dan|jen|tim|nan|sid|ted|kim|reg|ron|bob|dot)"
     r"\b[^.!?]{0,12}\bis tan\b",
     "HIGH", "'tan' describing a person is a skin-colour word. Say what the "
             "thing is instead, or use tan only for objects."),
    (r"\btan (man|kid|boy|girl|lad)\b",
     "HIGH", "'tan' describing a person is a skin-colour word."),
    (r"\bpit\b",
     "REVIEW", "'pit' meaning a hole. A child's word is 'hole'; 'pit' also "
               "conjures somewhere you fall into."),
    # The hand-written `den` rule was removed here. It fired on ANY use of the
    # word, and gave as its reason "a fox's home in one lesson and a room in
    # the house in another" -- a statement about the corpus that stopped being
    # true. 'den' now appears at Lesson 40 only, in the fox sense only, so the
    # rule was reporting a collision that no longer existed, three times, on
    # the one lesson that uses the word correctly.
    #
    # Check 13 (SENSE_KEYS) is the generalised form of exactly this rule and
    # already carries 'den' with both senses and the narrow one first. It fires
    # only when two senses are genuinely present, which is what the hand rule
    # was trying to say. Deleting a blanket rule in favour of a conditional one
    # is only safe if the conditional one can still refuse -- test_gates.py
    # now proves it does.
    (r"\brag\b",
     "REVIEW", "a rag is an adult cleaning prop; 'cloth' is the child's word."),
    (r"\bbegs?\b",
     "REVIEW", "an animal begging, or a child begging an animal, is a needy "
               "frame; 'wants' or 'waits' is kinder."),
]

# ---------------------------------------------------------------------------
# CHECK 5 -- pseudoword contamination.
#
# A nonsense-word subtest measures decoding of items with no lexical entry. The
# moment an item IS a word, or a name, or a brand, or turns into one under the
# smallest plausible slip, it stops measuring decoding and starts measuring
# vocabulary. Say each one aloud; that is the test.
# ---------------------------------------------------------------------------

# Short modern words the 1913 system dictionary does not contain.
MODERN_WORDS = {
    "mic", "app", "apps", "vlog", "blog", "wifi", "emoji", "selfie", "meme",
    "yup", "yep", "nope", "ok", "okay", "gif", "pic", "pics", "text", "tap",
}

# Names, brands and things a child hears every day.
NAMES_AND_BRANDS = {
    "nic", "nick", "vic", "rick", "mick", "dom", "tom", "tim", "sam", "pam",
    "ron", "ben", "dan", "jen", "kim", "liz", "max", "zac", "gus", "hal",
    "sal", "meg", "deb", "ned", "sid", "ted", "reg", "bob", "nan", "dot",
    "raj", "kit", "van", "vans", "jet", "jets", "lego", "nike", "ford",
    "mac", "pop", "gap", "dell", "fox", "sim", "tim", "wix", "zip",
}

# Judged by a person saying them aloud. Each needs a why.
PSEUDO_BANNED = {
    "im": "read as \"I'm\" on sight; the apostrophe is the only difference",
    "ap": "read as \"app\"",
    "mis": "read as \"miss\"",
    "nic": "read as \"Nick\"",
    "tif": "read as \"tiff\"",
    "mic": "a real word",
    "som": "read as \"some\"; the only difference is a silent e",
    "ot": "the rime of hot/not/pot standing alone; a child completes it to one "
          "of them, and in a cot-caught dialect it is \"ought\"",
    "ip": "heard as the letters \"I P\", and a bare VC invites completion",
    "nom": "\"nom nom\" is how children talk about eating; also near \"gnome\"",
    "fom": "read as \"foam\"",
    "wam": "read as \"wham\"",
    "bab": "read as \"bab(y)\"",
    "dat": "a nonstandard spelling of \"that\"; penalises dialect speakers",
    "dis": "reads as the slang \"dis\"",
    "gud": "a phonetic respelling of \"good\"",
    "wat": "reads as \"what\"",
    "cum": "vulgar",
    "fuk": "vulgar",
    "sut": "near a vulgar word",
    "tit": "vulgar",
    "bum": "vulgar in British English",
    "pis": "vulgar",
    "ass": "vulgar",
    "sux": "reads as \"sucks\"",
    "gob": "coarse for mouth",
    "wog": "a slur",
    "pak": "near a slur",
    "jap": "a slur",
    "hom": "near a slur",
    "fag": "a slur",
    "spic": "a slur",
    "fap": "internet slang for masturbating; a parent will know it even if the "
           "child does not",
    "nad": "slang for a testicle",
    "dif": "read as \"diff\"",
    "tis": "read as \"'tis\"",
    "pis": "near a vulgar word",
    "wap": "current slang with a sexual meaning",
    "thot": "a slur",
    "twat": "vulgar",
}

# ---------------------------------------------------------------------------
# CHECK 7 -- feelings.
# A distress word is fine. A distress word with nothing after it is not.
# ---------------------------------------------------------------------------
DISTRESS = r"\b(sad|mad|cross|scared|afraid|upset|cries|cried|cry|sobs|weeps|angry|sorry)\b"
RESOLVED = r"(\bhugs?\b|\bnot sad\b|\bnot mad\b|\bgrins?\b|\bsmiles?\b|\blaughs?\b|\bis glad\b|\bglad\b|\byes!)"

# ---------------------------------------------------------------------------
# CHECK 8 -- the phone call.
# ---------------------------------------------------------------------------
TOPICS = [
    ("pork", r"\bham\b|\bbacon\b|\bpork\b|\bribs\b",
     "a reading assessment is given to every child in the class, and a "
     "meaningful share of families do not eat pork. Use jam, egg or a bun."),
    ("nut allergy", r"\bnuts?\b",
     "nut allergy is the commonest food protocol in a primary school, and this "
     "instrument uses nuts as its default prop across seven lessons."),
    ("sharps", r"\bpins?\b|\btacks?\b|\bax\b|\baxe\b|\bsaw\b",
     "check whether it is a CHILD handling them; a grown-up doing it reads "
     "differently."),
    ("rats", r"\brats?\b",
     "loose in the house and into the food is the version families mind; a rat "
     "as a pet also assumes an unusual home."),
    ("insects on food",
     r"\bbugs?\b[^.!?]*\b(bun|buns|mug|cup|cob|jam|ham)\b|"
     r"\b(bun|buns|mug|cup|cob)\b[^.!?]*\bbugs?\b",
     "insects on food that is then eaten."),
    ("hand-feeding livestock",
     r"\b(fed|feeds)\b[^.!?]*\b(pig|pigs|hog|hogs|ox|hen|rat|rats|cub|cubs|"
     r"fox)\b|\b(pig|pigs|hog|hogs|ox|hen|rat|rats)\b[^.!?]*\b(fed|feeds)\b|"
     r"\bfed it the\b",
     "hand-feeding livestock. An earlier audit already caught this pattern."),
    ("handling an animal",
     r"\bpats? (the |it |a )?(big )?(rat|rats|ox|hen|pig|hogs?|fox|cubs?)\b",
     "a child touching a farm or wild animal."),
    ("a child at work", r"\bhas a job\b|\bjob at the pen\b",
     "a child working livestock. Read whether it lands as chores or as labour."),
    ("a knife", r"\bcuts?\b[^.!?]*\b(bun|nut|ham)\b|\bcut up a nut\b",
     "a child using a knife."),
    ("winning over a friend", r"\bi win\b",
     "one child announcing a win over another. Check it is resolved."),
]

# ---------------------------------------------------------------------------
# CHECK 9 -- what the passage assumes is at home.
# ---------------------------------------------------------------------------
CONTEXT_ASSUMPTIONS = {
    # 'pets' was matching the VERB. "She pets it" is a child touching an
    # animal, not a household that owns one, and it fired this check on a
    # lesson with no pet in it at all. The noun senses still match; the bare
    # verb no longer does.
    "a pet": r"\b(cat|cats|dog|dogs|rat|rats|hen|hens)\b"
             r"|\b(a|the|my|his|her|its|our|their|no) pets?\b",
    "a farm": r"\b(pig|pigs|hog|hogs|ox|hen|pen|cob|cobs|barn)\b",
    "food that is always there": r"\b(bun|buns|ham|jam|nut|nuts|cob|cobs)\b",
}

# ---------------------------------------------------------------------------
# Sign-off. A finding listed here has been read by a person and kept, with the
# reason written down next to it. Key is "lesson:check:item".
# ---------------------------------------------------------------------------
ACCEPTED = {
    "31:topics:sharps":
        "The ax is in the lesson because arithmetic put it there, not because "
        "the scene wanted one: Lesson 31 is named for x /ks/, the whole legal "
        "vocabulary offers exactly four x words (ax, mix, ox, wax), Form A "
        "already spends box, fix, fox and six, and three distinct non-name "
        "words must carry the target. Drop the ax and the lesson stops "
        "assessing its own sound; use 'ox' instead and audit_child raises a "
        "HIGH, because a draft animal is further outside a five-year-old's "
        "world than an ax is. So the question this rule asks -- is a CHILD "
        "handling it? -- is answered in the passage itself: Mom has the ax, "
        "Jen has the wax, and the job the story is about is the child's.",
}

# Two sign-offs were removed here rather than carried forward, both dead:
#
#   "17:feelings:sad"  -- written for a passage that was later rewritten. With
#       ACCEPTED emptied, Lesson 17 raises no feelings finding at all.
#   "40:topics:a child handling a farm or wild animal."  -- keyed on the rule's
#       REASON. found() builds its key from the rule's NAME ('handling an
#       animal'), so this string could never have matched anything, on any run,
#       since the day it was written.
#
# Neither was doing what it appeared to. A sign-off is a promise that a person
# looked; leaving a dead one in place spends that promise on nothing.
# dead_signoffs() now fails --strict so this cannot recur silently.

# ---------------------------------------------------------------------------
# CHECK 10 -- the fields nobody scanned.
#
# These were written for the examiner, so fields_of() skips them. But
# index.html builds the word-list card like this:
#
#     if (L.note){ nt.className='wlnote'; nt.textContent = L.note;
#                  passageEl.appendChild(nt); }
#
# passageEl is #passage -- the element the child's five words live in. There is
# no separate child stimulus page in this tool, so whatever the child reads
# from, the note is on it. Everything in checks 1-9 applies to these fields too.
# ---------------------------------------------------------------------------
NOTE_FIELDS = ("nwf_note", "supply_note", "instrument_claim")

# ---------------------------------------------------------------------------
# CHECK 11 -- the register decodability forces, and what it costs at scoring.
#
# Each entry: the written form, what a fluent child actually says, and whether
# a running record will call that a substitution.
# ---------------------------------------------------------------------------
CONTRACTIBLE = {
    r"\bcan not\b": "can't",
    r"\bdo not\b": "don't",
    r"\blet us\b": "let's",
    r"\bdid not\b": "didn't",
    r"\bis not\b": "isn't",
    r"\bare not\b": "aren't",
    r"\bdoes not\b": "doesn't",
    r"\bi am\b": "I'm",
    r"\bit is\b": "it's",
    r"\bwe are\b": "we're",
    r"\blet me\b": "lemme",
    # Third-person forms were missing, and their absence had a victim: Lesson 32
    # says "He is mad." Regenerating the notes from this list therefore found no
    # contractible form there and DELETED that lesson's scoring_note, so the one
    # passage naming a feeling ships with an empty examiner panel and a child who
    # says "He's mad" is marked wrong. A list used to generate a warning has to
    # be complete, or it silently un-warns.
    r"\bhe is\b": "he's",
    r"\bshe is\b": "she's",
    r"\bthey are\b": "they're",
    r"\byou are\b": "you're",
    r"\bthat is\b": "that's",
    r"\bthere is\b": "there's",
}
# The forms above that no six-year-old says aloud at all, contraction or not.
UNSPOKEN_REGISTER = {
    r"\blet us\b": "'Let us look at bugs' is not a register any six-year-old "
                   "speaks. It reads as archaic, and the child will say "
                   "\"let's\", which scores as an error.",
}

# ---------------------------------------------------------------------------
# CHECK 12 -- the word is known, the SENSE is not.
#
# word_age.check('pop') passes, and it is right to: children know 'pop'. They
# know it as a bang and as a fizzy drink. They do not know it as PUT. This is
# the same failure mode as check 4 but one level down -- check 4 rejects a
# word, this rejects a use of a word that is fine elsewhere.
# ---------------------------------------------------------------------------
SENSE_RULES = [
    (r"\bpops?\b(?!\s*(up|out)\b)",
     "REVIEW",
     "'pop' meaning PUT ('pop buns in a bag', 'pops a cap on the pot') is "
     "British-colloquial and adult. A five-year-old's senses of 'pop' are "
     "burst and fizzy drink, so the sentence pictures buns exploding. It is "
     "used this way thirteen times across the instrument. 'Put' is the child's "
     "word; where 'put' is not decodable yet, rewrite the action."),
    (r"\bsets?\b(?!\s*(up)\b)",
     "REVIEW",
     "'set' meaning PUT ('Mom set a bud in the mug', 'Nan sets a lid on top'). "
     "A child's 'set' is a set of things. Same substitution-for-decodability "
     "problem as 'pop'."),
    (r"\bfits? a \w+ on\b",
     "REVIEW",
     "transitive 'fit' ('Meg fits a cap on the tub'). A child's 'fit' is "
     "intransitive -- does it fit. Fitting one thing onto another is an "
     "adult's use."),
    (r"\bon a peg\b|\bup on the peg\b",
     "REVIEW",
     "'peg' meaning a wall hook is British. An American five-year-old's peg is "
     "a clothes peg or a peg in a hole, and a mug hanging on one has no "
     "picture."),
    (r"\b(and|,)? ?\w+ tag in\b|\bdog tag\b",
     "REVIEW",
     "'tag' as an intransitive verb ('Sid and the dog tag in the fog'). You "
     "PLAY tag; nobody tags. The sentence is not English a child has heard."),
]

# ---------------------------------------------------------------------------
# CHECK 13 -- two senses of one word across the instrument, generalised.
#
# CONTEXT_RULES already carries this rule for `den`, written by hand, at one
# word. The principle is not about den: a child who is still building the word
# is being shown two different things behind it inside a single measure. Each
# entry names the senses and how to spot each one. Order matters -- the first
# pattern that matches wins, so the narrower sense goes first.
# ---------------------------------------------------------------------------
SENSE_KEYS = {
    "cap": [
        ("a lid", r"\b(fits?|fit|pops?|pop|put) (a|the) cap (on|onto) the "
                  r"(tub|pot|rip|bin|jug|box)\b|\bcap on the (tub|pot|rip)\b"),
        ("a hat you wear", r"\bcap\b"),
    ],
    "den": [
        ("an animal's home", r"\b(fox|cub|cubs) [^.!?]*\bden\b|"
                             r"\bden\b[^.!?]*\b(fox|cub|cubs)\b"),
        ("a room in the house", r"\bden\b"),
    ],
    "fan": [
        ("to fan somebody", r"\bfans (him|her|it|me)\b"),
        ("the machine", r"\bfan\b"),
    ],
    "pot": [
        ("a plant pot", r"\b(bud|buds|mug is a pot)\b[^.!?]*\bpot\b|"
                        r"\bpot\b[^.!?]*\b(bud|buds)\b"),
        ("a cooking pot", r"\bpot\b"),
    ],
}

# ---------------------------------------------------------------------------
# CHECK 14 -- sentences that are false as written.
#
# A running record scores hesitation and self-correction. A child who stops to
# work out how a mug can be a pot is scored as less fluent for thinking. The
# two in this corpus are both said by a PARENT, which makes them assertions of
# fact rather than jokes the child is invited to get.
# ---------------------------------------------------------------------------
LITERAL_FALSE = [
    (r"\b(a|the) (\w+) is (a|the) (\w+)\b",
     "an 'X is a Y' identity statement between two different concrete things. "
     "Read it literally, the way a five-year-old, an EAL child or a literal "
     "thinker will: it is false. Say what is meant -- 'we can use the mug as a "
     "pot', 'Dad waves the cap' -- or cut it."),
]
# Pairs already judged fine (a real category statement, not a metaphor).
LITERAL_OK = {("cap", "bed"), ("bug", "bug")}

# ---------------------------------------------------------------------------
# CHECK 15 -- what the page says to the child who is failing at it.
#
# These pages are handed to the child who finds reading hardest, with an adult
# watching and a stopwatch running. That is the reading context, and no check
# so far has taken it into account. Check 7 asks whether a CHARACTER's feeling
# resolves. This asks what the READER hears.
# ---------------------------------------------------------------------------
FAILURE_RULES = [
    (r"\b(\w+) can not [^.!?,]{1,20}, but (\w+) can\b",
     "HIGH",
     "an explicit peer-competence comparison -- this child cannot, that child "
     "can -- handed to a child who is at that moment failing a task in front "
     "of an adult. Give both children the action, or let the same child "
     "succeed on the second try."),
    (r"\bI do not see\b|\bI can not see\b",
     "REVIEW",
     "a child who cannot SEE what an adult can see, is corrected, and is sad "
     "about it. This is the shape of the assessment the child is sitting in. "
     "Let the child spot it first, or make the adult the one who misses it."),
    (r"\bhe is not big\b|\bshe is not big\b|\bis not big\b",
     "REVIEW",
     "the child's own body named as the reason they cannot. Make the obstacle "
     "the situation, not the child."),
    (r"\bdo the wax\b|\bdo the \w+,\" said (Dad|Mom)\b",
     "REVIEW",
     "the child is stopped from the real task and assigned a lesser one by an "
     "adult. Read whether it lands as being included or as being sidelined."),
]

# ---------------------------------------------------------------------------
# CHECK 16 -- who is allowed to solve it, and who is allowed a pronoun.
#
# Item-level. The corpus-level counting is in corpus_checks().
# ---------------------------------------------------------------------------
REPAIR_VERBS = r"\b(fix|fixes|fixed|cuts?|pins? up|mix wax|sets? .{0,12}up|" \
               r"tugs? (at )?the log|has an ax|have a pin)\b"
# min, lin replace pam/meg/deb; kip, jin replace ned/raj. Gender is preserved
# name for name so the agency balance this check measures is not quietly moved
# by a rename that was made for a different reason.
FEMALE_CAST = {"nan", "pam", "peg", "meg", "deb", "liz", "jan", "sal", "jen",
               "bev", "val", "kim", "mom", "min", "lin"}
MALE_CAST = {"sam", "tim", "sid", "dan", "ted", "bob", "gus", "tom", "ron",
             "ned", "hal", "ben", "max", "raj", "zeb", "jon", "pip", "dev",
             "zac", "reg", "dad", "kip", "jin"}

# ---------------------------------------------------------------------------
# CHECK 17 -- every word known, the event unknown.
#
# Vocabulary is not comprehension. A child can decode every word of "Dad and
# Ben mix wax" and have no idea what is happening, because sealing the cut end
# of a log is not a thing any five-year-old has watched. With no picture, the
# child reads word by word, which is exactly what the fluency score punishes.
# ---------------------------------------------------------------------------
UNFAMILIAR_EVENTS = [
    (r"\bmix wax\b|\brubs? wax on\b|\bdo the wax\b",
     "waxing a cut log. Sealing log ends is a thing almost no child has seen "
     "done, and the passage never says what the wax is for. Every word passes "
     "the age gate and the scene is still a blank."),
    (r"\bbuds? rot\b|\btip mud and buds in a bin\b|\brot in the sun\b",
     "composting. 'The mud and buds rot in the sun' assumes a garden waste "
     "bin and the idea that rotting is on purpose."),
    (r"\bpop the rug in a tub\b|\brug in a tub\b",
     "washing a rug by hand in a tub. Most of the audience has only seen a "
     "washing machine, if that."),
    (r"\bdigs? up a (cup|mug|pot)\b",
     "digging crockery out of the ground and keeping it. Read whether the "
     "child can picture why a cup was in the mud."),
    (r"\bmug is up on a peg\b",
     "a mug hanging on a wall peg, out of a child's reach, as the premise of "
     "the whole passage."),
]

# ---------------------------------------------------------------------------
# CHECK 18 -- the cast, over a whole year.
#
# Corpus-level. Decodable CVC does not mean Anglo: Jin, Rin, Min, Han, Tam,
# Nam, Lin, Bo, Kip, Kim, Raj, Dev, Zeb all fit the same letter budget.
# ---------------------------------------------------------------------------
NON_ANGLO_CAST = {"raj", "dev", "zeb",
                  # The names this check's own comment lists as fitting the
                  # letter budget are now IN the instrument, not just cited as
                  # proof that they could be. Leaving them out understated the
                  # cast: retiring 'raj' for its reversal (raj/jar) and
                  # replacing it with 'jin' read as the cast getting less
                  # diverse, because the measure only knew the old name.
                  # 'kip' is NOT here. Kip is an English name, and adding it
                  # was load-bearing: with it the corpus diversity check passes
                  # at 5 of 26, without it the check fires. Padding the list
                  # that a metric counts, with a name that does not belong in
                  # it, is how a metric stops measuring anything.
                  "min", "lin", "jin"}
DECODABLE_ALTERNATIVES = ("Jin, Rin, Min, Han, Tam, Nam, Lin, Bo, Kip, Kim, "
                          "Ravi (later), Nia")

FIELDS = ("real_words", "nonsense_words", "high_frequency", "sentences", "lines")
SEVERITIES = {"BLOCK": 0, "HIGH": 1, "REVIEW": 2}


# --- helpers ---------------------------------------------------------------
def real_words_set():
    """Everything we are willing to call a real English word."""
    words = set(cv.word_list()) | MODERN_WORDS
    ages, familiar = word_age._table()
    words |= set(ages) | familiar
    sysdict = pathlib.Path("/usr/share/dict/words")
    if sysdict.exists():
        words |= {w.strip().lower() for w in
                  sysdict.read_text(errors="ignore").split()
                  if 3 <= len(w.strip()) <= 8}
    return words


REAL = None
CHILD = None


def is_real(word):
    global REAL
    if REAL is None:
        REAL = real_words_set()
    return word.lower() in REAL


def is_child_word(word):
    """A word a CHILD has, not a word the 1913 dictionary has. The mirror check
    needs this: `sam` reversed is `mas`, which web2 lists and no six-year-old
    has ever met, while `deb` reversed is `bed`."""
    global CHILD
    if CHILD is None:
        _, familiar = word_age._table()
        CHILD = set(cv.word_list()) | set(familiar)
    return word.lower() in CHILD


def fields_of(doc):
    """(label, text) for every piece of text a child will see."""
    out = []
    if doc.get("title"):
        out.append(("title", doc["title"]))
    for key in FIELDS:
        for i, value in enumerate(doc.get(key) or []):
            out.append(("%s[%d]" % (key, i), value))
    return out


def tokens(text):
    return re.findall(r"[a-z']+", text.lower())


def edit_distance_one(a, b):
    if len(a) != len(b):
        return False
    return sum(x != y for x, y in zip(a, b)) == 1


# --- the checks ------------------------------------------------------------
def check_blocked(doc, found):
    for label, text in fields_of(doc):
        for w in tokens(text):
            if w in BLOCKED:
                found("BLOCK", "blocked", w,
                      "on core_vocabulary.BLOCKED -- never in front of a child",
                      label, text)


def check_age(doc, found):
    names = tuple(sorted(CAST))
    for label, text in fields_of(doc):
        if label.startswith("nonsense_words"):
            continue
        for w, why in word_age.scan(text, names=names).items():
            found("HIGH", "age", w, why, label, text)


def check_unrated(doc, found):
    for label, text in fields_of(doc):
        if label.startswith("nonsense_words"):
            continue
        for w in tokens(text):
            if w in CAST:
                continue
            if w in UNRATED_UNSUITABLE:
                found("HIGH", "unrated", w, UNRATED_UNSUITABLE[w], label, text)


def check_judged(doc, found):
    for label, text in fields_of(doc):
        if label.startswith("nonsense_words"):
            continue
        for w in tokens(text):
            if w in CAST:
                continue
            if w in JUDGED_UNSUITABLE:
                found("HIGH", "judged", w, JUDGED_UNSUITABLE[w], label, text)
        low = text.lower()
        for pattern, severity, why in CONTEXT_RULES:
            if re.search(pattern, low):
                found(severity, "judged", re.search(pattern, low).group(0),
                      why, label, text)


def _pseudo_problem(word):
    """Why this pseudoword is not a pseudoword. None if it is fine."""
    w = word.lower()
    if w in PSEUDO_BANNED:
        return "BLOCK", PSEUDO_BANNED[w]
    if is_real(w):
        return "BLOCK", "this is a real English word"
    if w in NAMES_AND_BRANDS:
        return "BLOCK", "this is a name or a brand"
    if len(w) == 2:
        return "HIGH", ("a two-letter item is a rime standing alone; a child "
                        "completes it to the nearest real word")
    # smallest plausible slips
    if is_real(w + w[-1]):
        return "HIGH", 'doubling the last letter makes "%s"' % (w + w[-1])
    if is_real(w + "e"):
        return "HIGH", 'adding a silent e makes "%s"' % (w + "e")
    if w.endswith("c") and (is_real(w + "k") or (w + "k") in NAMES_AND_BRANDS):
        return "HIGH", 'children read final c as ck: "%s"' % (w + "k")
    for i in range(1, len(w)):
        candidate = w[:i] + "'" + w[i:]
        if candidate.replace("'", "") and is_real(candidate):
            return "HIGH", 'an apostrophe makes "%s"' % candidate
    return None


def check_pseudowords(doc, found):
    for i, w in enumerate(doc.get("nonsense_words") or []):
        problem = _pseudo_problem(w)
        if problem:
            severity, why = problem
            found(severity, "pseudoword", w, why, "nonsense_words[%d]" % i, w)


def check_names(doc, found, corpus_words, corpus_lessons):
    text = " ".join(t for _, t in fields_of(doc))
    words = set(tokens(text))
    # A name is present only where it is CAPITALISED. `dot` lowercase at
    # lesson 13 is a mark on a page, not the girl in lesson 15.
    capitalised = {m.group(1).lower()
                   for m in re.finditer(r"\b([A-Z][a-z']*)\b", text)}
    here = sorted((CAST & capitalised) - {"i", "mom", "dad"})

    # a name that is also a common noun somewhere in this instrument
    for name in here:
        elsewhere = sorted(corpus_lessons.get(name, ()))
        if name in corpus_words and elsewhere:
            found("HIGH", "names", name,
                  "'%s' is also used as a common noun in this instrument "
                  "(lesson%s %s). An examiner cannot score a miscue between the "
                  "person and the thing."
                  % (name, "s" if len(elsewhere) > 1 else "",
                     ", ".join(str(l) for l in elsewhere)),
                  "cast", text[:80])

    # two names one letter apart in the same lesson
    for a in here:
        for b in here:
            if a < b and edit_distance_one(a, b):
                found("HIGH", "names", "%s/%s" % (a, b),
                      "two names in one lesson a single letter apart; a miscue "
                      "between them cannot be scored", "cast", text[:80])

    # mirror-image confusion: b/d reversal is THE five-year-old error
    for name in here:
        mirror = name[::-1]
        if mirror == name:
            continue
        if mirror in words:
            found("HIGH", "names", "%s/%s" % (name, mirror),
                  "'%s' reversed is '%s', which is on the same page. Reversal "
                  "is the classic error at this age." % (name, mirror),
                  "cast", text[:80])
        elif is_child_word(mirror):
            found("REVIEW", "names", "%s/%s" % (name, mirror),
                  "'%s' reversed is '%s', a word this child already knows and "
                  "meets elsewhere in this instrument." % (name, mirror),
                  "cast", text[:80])


def check_feelings(doc, found):
    lines = list(doc.get("lines") or [])
    if lines:
        cleaned = [re.sub(r"\bnot (sad|mad)\b", "", ln, flags=re.I)
                   for ln in lines]
        last_distress = None
        for i, ln in enumerate(cleaned):
            if re.search(DISTRESS, ln, re.I):
                last_distress = i
        if last_distress is not None:
            after = " ".join(lines[last_distress:])
            if not re.search(RESOLVED, after, re.I):
                word = re.search(DISTRESS, cleaned[last_distress], re.I).group(1)
                found("HIGH", "feelings", word.lower(),
                      "a child is %s and nothing on the page tells the reader "
                      "the feeling ended" % word.lower(),
                      "lines[%d]" % last_distress, lines[last_distress])
    # a bare negated feeling with no story to resolve it
    for i, s in enumerate(doc.get("sentences") or []):
        if re.search(r"\bnot (sad|mad|cross)\b", s, re.I):
            found("REVIEW", "feelings", "not mad/sad", (
                "a word-list sentence has no story to resolve it; the negation "
                "makes the feeling the only thing on the line"),
                "sentences[%d]" % i, s)


def check_topics(doc, found):
    for label, text in fields_of(doc):
        if label.startswith("nonsense_words"):
            continue
        low = text.lower()
        for name, pattern, why in TOPICS:
            if re.search(pattern, low):
                found("REVIEW", "topics", name, why, label, text)


def check_context(doc, found):
    text = " ".join(t for l, t in fields_of(doc)
                    if not l.startswith("nonsense_words")).lower()
    for what, pattern in CONTEXT_ASSUMPTIONS.items():
        if re.search(pattern, text):
            found("REVIEW", "context", what,
                  "the passage assumes the child has %s" % what,
                  "whole lesson", text[:80])


# --- checks 10-18 ----------------------------------------------------------
def note_fields_of(doc):
    """The fields fields_of() deliberately skips.

    These used to be appended straight into #passage, so the child read them.
    They now render into #lessonnote, in the examiner's tally panel beside
    'Words read' and the timer. That is a real improvement and the severities
    below no longer rest on the old claim -- but it is a SIDE PANEL ON THE SAME
    SCREEN, in 12.5px muted text, not a separate examiner's copy. A child
    sitting next to the examiner can still read it. For a subtest whose whole
    premise is that the items are unfamiliar, that is still a leak.
    """
    out = []
    for key in NOTE_FIELDS:
        if doc.get(key):
            out.append((key, doc[key]))
    for key in doc:
        if key.endswith("_note") and key not in NOTE_FIELDS and doc.get(key):
            out.append((key, doc[key]))
    return out


# What the examiner ACTUALLY READS in #lessonnote for this lesson.
#
# This was briefly narrowed to exclude instrument_claim, on the reasoning that
# the claim is "standing copy, read once rather than nine times". That reasoning
# was wrong, and checkably so: paintNote() pushes the claim onto EVERY word-list
# lesson, so all nine still render it. Only the JSON storage was deduplicated,
# not the reading. The effect was to drop eight lessons rendering 378-424
# characters below a 200-character bar without a single character leaving the
# screen -- a measure quietly narrowed until the finding disappeared, which is
# the exact failure this file exists to catch.
#
# So the rule is now: measure what paintNote() draws. If the claim ever stops
# being drawn per lesson, delete it from here in the same commit and the number
# will fall honestly.
PER_LESSON_NOTE_FIELDS = ("scoring_note", "nwf_note", "supply_note")


def per_lesson_notes(doc):
    """Mirrors sync_index.entry() + paintNote(). Keep the three in step."""
    out = [(k, doc[k]) for k in PER_LESSON_NOTE_FIELDS if doc.get(k)]
    if doc.get("instrument") == "word list" and doc.get("instrument_claim"):
        out.append(("instrument_claim", doc["instrument_claim"]))
    return out


def check_notes(doc, found):
    """One finding per lesson, not per word -- a writer moves the whole note,
    not each word out of it."""
    fields = note_fields_of(doc)
    if not fields:
        return
    blocked, banned, leaks, chars = set(), {}, set(), 0
    for label, text in fields:
        chars += len(text)
        for w in tokens(text):
            if w in BLOCKED:
                blocked.add(w)
            if w in PSEUDO_BANNED:
                banned[w] = PSEUDO_BANNED[w]
        for q in re.findall(r'"([a-z]+)"', text.lower()):
            if is_real(q):
                leaks.add(q)
    first_label, first_text = fields[0]
    if blocked:
        found("BLOCK", "notes", ", ".join(sorted(blocked))[:24],
              "BLOCKED words rendered on the assessment screen. These no "
              "longer land in #passage -- paintNote() puts them in "
              "#lessonnote, the examiner's tally panel -- but that panel is on "
              "the same screen, an arm's length from the child. A word this "
              "instrument refuses to print for the child does not become safe "
              "by moving four inches right.", first_label, first_text)
    if banned:
        found("BLOCK", "notes", ", ".join(sorted(banned))[:24],
              "this same file refuses these as test items -- %s -- and then "
              "prints them, spelled out, onto the child's page in the "
              "rationale for refusing them. A reason is not a hiding place."
              % "; ".join("%s: %s" % (k, v) for k, v in sorted(banned.items())),
              first_label, first_text)
    if leaks:
        found("HIGH", "notes", ", ".join(sorted(leaks))[:24],
              "real words (%s) printed on the page of a measure whose whole "
              "premise is that the child cannot recognise the items. Move "
              "every note out of the child-visible field and into an "
              "examiner-only one the renderer does not draw."
              % ", ".join(sorted(leaks)), first_label, first_text)
    # Length is measured against what renders UNDER THIS LESSON — which on a
    # word list INCLUDES instrument_claim, because paintNote() draws it there.
    # (This comment previously said the opposite, forty lines from the block
    # above it that corrected the record. Two live comments disagreeing about
    # the same fact is worse than either being wrong alone: whichever a reader
    # finds first, they have no way to know there is another.)
    per_lesson = per_lesson_notes(doc)
    lesson_chars = sum(len(t) for _, t in per_lesson)
    if lesson_chars > 200:
        pl_label, pl_text = per_lesson[0]
        found("REVIEW", "notes", "%d chars" % lesson_chars,
              "%d characters of adult prose in %d field(s), in a 12.5px side "
              "panel the examiner is reading WHILE a child reads aloud to "
              "them. The old reason for this check -- that the child saw it -- "
              "no longer holds; this one is worse. A note this long does not "
              "get read at the moment it is needed, so a warning that is "
              "present is functionally absent. Say it in one sentence or the "
              "examiner will not have it."
              % (lesson_chars, len(per_lesson)), pl_label, pl_text)


def check_register(doc, found):
    """One finding per lesson listing every contractible form in it."""
    hits, unspoken = {}, []
    example = ("", "")
    for label, text in fields_of(doc):
        if label.startswith(("nonsense_words", "real_words", "high_frequency")):
            continue
        low = text.lower()
        for pattern, spoken in CONTRACTIBLE.items():
            m = re.search(pattern, low)
            if not m:
                continue
            hits[m.group(0)] = spoken
            if not example[0]:
                example = (label, text)
            if pattern in UNSPOKEN_REGISTER:
                unspoken.append((m.group(0), UNSPOKEN_REGISTER[pattern],
                                 label, text))
    for hit, why, label, text in unspoken:
        found("HIGH", "register", hit, why, label, text)
    plain = {k: v for k, v in hits.items()
             if not any(k == u[0] for u in unspoken)}
    if not plain:
        return

    # This check used to assert that "no field anywhere in these files tells
    # the examiner otherwise". That is no longer true and must not be assumed:
    # scoring_note now carries the warning, and sync_index.py renders it in the
    # examiner's panel. So ASK, rather than assume. The finding fires when the
    # mitigation is absent or incomplete -- which is a stronger check than the
    # blanket one it replaces, because a note that silently stops naming a form
    # the passage still contains now gets caught.
    # Match against the forms the note NAMES, not against the note as a string.
    #
    # `k not in note` was a bare substring test, and every scoring_note ends
    # with "— do not score it an error." That contains the literal text
    # "do not" — the commonest contractible form in CONTRACTIBLE — so this
    # check could never fire on it, on any lesson, ever. Any note containing
    # the phrase for an unrelated reason ("Do not stop the child mid-line")
    # suppressed it too. The check was written to guarantee that a note failing
    # to name a form gets caught, and for the single most likely form it
    # guaranteed the opposite.
    #
    # The notes state their forms in double quotes, so read those.
    note = (doc.get("scoring_note") or "")
    named = {m.group(1).lower() for m in re.finditer(r'"([a-z][a-z ]*)"', note.lower())}
    unnamed = sorted(k for k in plain if k not in named)
    if unnamed:
        found("HIGH" if note else "REVIEW", "register",
              ", ".join(unnamed)[:24],
              "uncontracted forms a fluent child will not say aloud: %s. A "
              "running record scores each spoken contraction as a "
              "substitution, so this instrument marks down the child who is "
              "reading for meaning. %s"
              % ("; ".join("'%s' -> \"%s\"" % (k, plain[k]) for k in unnamed),
                 "scoring_note exists but does not name %s, so the examiner is "
                 "warned about the other forms and not this one -- the most "
                 "dangerous state, because the note reads as complete."
                 % ", ".join("'%s'" % k for k in unnamed) if note else
                 "No scoring_note on this lesson, so nothing tells the "
                 "examiner otherwise."),
              example[0], example[1])


def check_sense(doc, found):
    for label, text in fields_of(doc):
        if label.startswith("nonsense_words"):
            continue
        low = text.lower()
        for pattern, severity, why in SENSE_RULES:
            m = re.search(pattern, low)
            if m:
                # name the finding after the lemma so pop/pops are one fix
                item = re.sub(r"s\b", "", m.group(0).strip().split()[-1]) \
                    if m.group(0).strip().split() else m.group(0)
                found(severity, "sense", item, why, label, text)


def check_literal(doc, found):
    for label, text in fields_of(doc):
        if label.startswith(("nonsense_words", "real_words", "high_frequency")):
            continue
        for pattern, why in LITERAL_FALSE:
            for m in re.finditer(pattern, text.lower()):
                a, b = m.group(2), m.group(4)
                if a == b or (a, b) in LITERAL_OK or (b, a) in LITERAL_OK:
                    continue
                if a in CAST or b in CAST:
                    continue
                found("HIGH", "literal", "%s is a %s" % (a, b), why, label, text)


def check_failure(doc, found):
    for label, text in fields_of(doc):
        if label.startswith("nonsense_words"):
            continue
        low = text.lower()
        for pattern, severity, why in FAILURE_RULES:
            m = re.search(pattern, low)
            if m:
                found(severity, "failure", m.group(0)[:24], why, label, text)


def check_agency(doc, found):
    """Item-level half of check 16: an adult present, and the adult doing the
    repair while the child watches or is told no."""
    lines = list(doc.get("lines") or [])
    if not lines:
        return
    text = " ".join(lines)
    if not re.search(r"\b(Mom|Dad)\b", text):
        return
    adult = "Dad" if "Dad" in text else "Mom"
    repairs = [ln for ln in lines
               if re.search(r"\b(Mom|Dad)\b", ln)
               and re.search(REPAIR_VERBS, ln, re.I)]
    child_blocked = [ln for ln in lines
                     if re.search(r'"do not [^"]*," said (Mom|Dad)', ln, re.I)]
    if repairs:
        found("REVIEW", "agency", "%s solves it" % adult,
              "the thing that fixes the story is done by the grown-up. Across "
              "the 36 items every repair belongs to Dad -- the ax, the pin, "
              "the log the children could not lift -- and Mom never handles a "
              "tool. Let the child do the fixing at least as often, and let "
              "Mom hold the tool sometimes.", "lines", repairs[0])
    if child_blocked and repairs:
        found("REVIEW", "agency", "told no, then watches",
              "the child is told not to, and then watches the adult do it. "
              "That is the shape of the assessment the reader is sitting in.",
              "lines", child_blocked[0])


def check_event(doc, found):
    for label, text in fields_of(doc):
        if label.startswith(("nonsense_words", "real_words", "high_frequency")):
            continue
        low = text.lower()
        for i, (pattern, why) in enumerate(UNFAMILIAR_EVENTS):
            m = re.search(pattern, low)
            if m:
                # keyed by the RULE, not the wording, so one unfamiliar event
                # is one finding however many lines it spreads over
                found("REVIEW", "event", why.split(".")[0][:24], why,
                      label, text)


def corpus_checks(docs, found_corpus):
    """Checks that no single item can fail. A child meets all of these across a
    year; these are the questions you can only ask of the set.

    Only meaningful over the WHOLE folder -- audit() skips it for a subset,
    because "28 masculine pronouns across the set" is not a claim you can make
    from three lessons."""
    n = len(docs)
    def visible(doc):
        return " ".join(t for l, t in fields_of(doc)
                        if not l.startswith("nonsense_words"))

    # --- 13: one word, two senses, across lessons --------------------------
    for word, senses in SENSE_KEYS.items():
        where = {}
        for doc in docs:
            for ln in re.split(r"(?<=[.!?])\s+", visible(doc)):
                if not re.search(r"\b%s\b" % word, ln, re.I):
                    continue
                for name, pattern in senses:
                    if re.search(pattern, ln.lower()):
                        where.setdefault(name, set()).add(doc["lesson"])
                        break
        if len(where) > 1:
            parts = "; ".join(
                "%s in L%s" % (name, ",".join(str(x) for x in sorted(ls)))
                for name, ls in sorted(where.items()))
            found_corpus("REVIEW", "polysemy", word,
                         "'%s' carries two senses inside one instrument (%s). "
                         "A child still building the word is shown two "
                         "different things behind it. Pick one sense for the "
                         "whole instrument, or name the other thing." % (word, parts),
                         "corpus", parts)

    # --- 16: gendered agency, over the whole set ---------------------------
    male = female = 0
    male_names = collections_counter()
    female_names = collections_counter()
    sad_boys, sad_girls = set(), set()
    for doc in docs:
        t = visible(doc)
        male += len(re.findall(r"\b(he|him|his)\b", t, re.I))
        female += len(re.findall(r"\b(she|her|hers)\b", t, re.I))
        for m in re.finditer(r"said ([A-Z][a-z]+)", t):
            who = m.group(1).lower()
            if who in FEMALE_CAST:
                female_names[who] += 1
            elif who in MALE_CAST:
                male_names[who] += 1
        for ln in (doc.get("lines") or []):
            m = re.search(r"\b([A-Z][a-z]+) is (sad|mad)\b", ln)
            if m:
                (sad_girls if m.group(1).lower() in FEMALE_CAST
                 else sad_boys).add(doc["lesson"])
    if male and female * 4 < male:
        found_corpus("HIGH", "agency", "pronouns %d:%d" % (male, female),
                     "%d masculine pronouns and %d feminine across all %d "
                     "items. Girls appear only as names attached to actions; "
                     "no girl in the instrument is ever 'she'. A pronoun is "
                     "where a reader sits inside a character, and that seat is "
                     "male throughout. Give the girls the pronouns and the "
                     "interior lines." % (male, female, n), "corpus", "")
    mt, ft = sum(male_names.values()), sum(female_names.values())
    if mt and ft * 2 < mt:
        found_corpus("REVIEW", "agency", "speaks %d:%d" % (mt, ft),
                     "boys and men carry %d of the %d speaking turns. Over a "
                     "year the child hears the instrument talk in a male "
                     "voice." % (mt, mt + ft), "corpus", "")
    if sad_boys and not sad_girls:
        found_corpus("REVIEW", "agency", "only boys feel",
                     "every named feeling in the instrument belongs to a boy "
                     "(L%s); no girl is ever sad, and no girl is ever "
                     "comforted. The inner life of the set is entirely male."
                     % ",".join(str(x) for x in sorted(sad_boys)), "corpus", "")

    # --- 18: the cast, over a whole year -----------------------------------
    cast_seen = set()
    for doc in docs:
        for m in re.finditer(r"\b([A-Z][a-z]{1,3})\b", visible(doc)):
            who = m.group(1).lower()
            if who in FEMALE_CAST or who in MALE_CAST or who in NON_ANGLO_CAST:
                cast_seen.add(who)
    cast_seen -= {"mom", "dad"}
    diverse = cast_seen & NON_ANGLO_CAST
    if cast_seen and len(diverse) * 6 < len(cast_seen):
        found_corpus("REVIEW", "cast", "%d of %d" % (len(diverse), len(cast_seen)),
                     "%d named characters across the year, %d of them not "
                     "Anglo (%s). Decodability did not force this -- %s all "
                     "fit the same letter budget. Every child in the class "
                     "sits this instrument."
                     % (len(cast_seen), len(diverse),
                        ", ".join(sorted(diverse)) or "none",
                        DECODABLE_ALTERNATIVES), "corpus", "")

    # --- 11, corpus half: nothing warns the examiner -----------------------
    contractible_lessons = {
        doc["lesson"] for doc in docs
        if any(re.search(p, visible(doc), re.I) for p in CONTRACTIBLE)}
    warns = any(re.search(r"contraction|can't|don't|not an error",
                          json.dumps(doc), re.I) for doc in docs)
    if contractible_lessons and not warns:
        found_corpus("HIGH", "register", "no examiner warning",
                     "%d of the %d items are written in uncontracted forms a "
                     "fluent child will not say, and not one field anywhere in "
                     "the data tells the examiner that \"can't\" for \"can "
                     "not\" is not an error. Add one line to instrument_claim "
                     "and to every passage: contractions of the written form "
                     "are read as correct." % (len(contractible_lessons), n),
                     "corpus", "")

    # --- animals: present in the check, absent from the role ---------------
    # check 9 asks whether the child has a pet. It never asks what the animal
    # DOES. In this corpus the animal is nearly always the one causing the mess.
    # The tell is a quoted line that names the animal AND says "not" -- the
    # animal being told off. "Not the buns, dog!"  "Not in the pot, cat!"
    ANIMAL = r"dog|cat|pup|rat|bug|pig|hen|fox|hog|ox"
    culprit = set()
    for doc in docs:
        for quote in re.findall(r'"([^"]+)"', visible(doc)):
            if re.search(r"\b(%s)s?\b" % ANIMAL, quote, re.I) and \
                    re.search(r"\bnot\b", quote, re.I):
                culprit.add(doc["lesson"])
    if len(culprit) >= 5:
        found_corpus("REVIEW", "context", "the animal is the culprit",
                     "in %d items (L%s) the animal is the one who takes, "
                     "dirties or sits on the thing, and a child puts it right. "
                     "No single passage is a problem; the year teaches that "
                     "the pet is the trouble. Let an animal help, or be the "
                     "one helped, at least once."
                     % (len(culprit), ",".join(str(x) for x in sorted(culprit))),
                     "corpus", "")


def collections_counter():
    import collections
    return collections.Counter()


# --- driver ----------------------------------------------------------------
def corpus_index(docs):
    """Which lessons use each word LOWERCASE -- i.e. as an ordinary word and
    not as somebody's name. This is what makes Dot/dot visible."""
    words, lessons = set(), {}
    for doc in docs:
        for label, text in fields_of(doc):
            if label.startswith("nonsense_words"):
                continue
            for m in re.finditer(r"(?<![A-Za-z'])([a-z][a-z']*)(?![A-Za-z'])", text):
                w = m.group(1)
                words.add(w)
                lessons.setdefault(w, set()).add(doc["lesson"])
    return words, {k: sorted(v) for k, v in lessons.items()}


# Which sign-offs actually silenced something on the last run. A sign-off that
# matches NO finding is not harmless: it reads as "a person reviewed this and
# kept it" forever, while silencing nothing. Both original entries were dead --
# one keyed on the rule's REASON where the code keys on its NAME, so it never
# could have matched, and one written for a passage that was later rewritten.
# Neither would ever have been noticed, because a sign-off that suppresses
# nothing looks exactly like a sign-off that is working.
ACCEPTED_USED = set()


def dead_signoffs():
    """ACCEPTED keys that matched no finding on the last audit() run."""
    return sorted(set(ACCEPTED) - ACCEPTED_USED)


def audit(paths, whole_set=True):
    docs = [json.loads(p.read_text()) for p in paths]
    corpus_words, corpus_lessons = corpus_index(docs)
    all_findings = []
    ACCEPTED_USED.clear()

    for doc in docs:
        lesson = doc["lesson"]
        rows = []

        def found(severity, check, item, why, label, text):
            key = "%d:%s:%s" % (lesson, check, item)
            if key in ACCEPTED:
                ACCEPTED_USED.add(key)
                return
            rows.append({"lesson": lesson, "severity": severity,
                         "check": check, "item": item, "why": why,
                         "field": label, "text": text})

        check_blocked(doc, found)
        check_age(doc, found)
        check_unrated(doc, found)
        check_judged(doc, found)
        check_pseudowords(doc, found)
        check_names(doc, found, corpus_words, corpus_lessons)
        check_feelings(doc, found)
        check_topics(doc, found)
        check_context(doc, found)
        check_notes(doc, found)
        check_register(doc, found)
        check_sense(doc, found)
        check_literal(doc, found)
        check_failure(doc, found)
        check_agency(doc, found)
        check_event(doc, found)

        # One finding per (check, item) per lesson, carrying how many times it
        # occurs. A teacher fixes the word, not each line separately.
        first, order = {}, []
        for r in rows:
            k = (r["check"], r["item"])
            if k in first:
                first[k]["times"] += 1
                continue
            r["times"] = 1
            first[k] = r
            order.append(k)
        all_findings += [first[k] for k in order]

    # Checks that no single item can fail. Reported against lesson 0 -- they
    # belong to the instrument, not to any one page.
    corpus_rows = []

    def found_corpus(severity, check, item, why, label, text):
        key = "0:%s:%s" % (check, item)
        if key in ACCEPTED:
            ACCEPTED_USED.add(key)
            return
        corpus_rows.append({"lesson": 0, "severity": severity, "check": check,
                            "item": item, "why": why, "field": label,
                            "text": text, "times": 1})

    if whole_set:
        corpus_checks(docs, found_corpus)
        all_findings += corpus_rows

    all_findings.sort(key=lambda r: (SEVERITIES[r["severity"]], r["lesson"]))
    return all_findings


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("lessons", nargs="*", type=int,
                    help="lesson numbers; default every file in the folder")
    ap.add_argument("--dir", default=str(HERE / "data"))
    ap.add_argument("--strict", action="store_true",
                    help="REVIEW findings fail the run too")
    ap.add_argument("--check", help="only this check (blocked, age, unrated, "
                                    "judged, pseudoword, names, feelings, "
                                    "topics, context)")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--table", action="store_true",
                    help="one line per lesson: CLEAN, or the counts")
    args = ap.parse_args(argv)

    folder = pathlib.Path(args.dir)
    paths = sorted(folder.glob("lesson-*.json"))
    if args.lessons:
        paths = [p for p in paths
                 if int(re.search(r"(\d+)", p.stem).group(1)) in args.lessons]
    if not paths:
        print("no lesson files in %s" % folder)
        return 2

    findings = audit(paths, whole_set=not args.lessons)
    if args.check:
        findings = [f for f in findings if f["check"] == args.check]

    if args.json:
        print(json.dumps(findings, indent=2))
    elif args.table:
        print("%-8s %-6s %s" % ("lesson", "total", "BLOCK / HIGH / REVIEW"))
        for p in paths:
            n = int(re.search(r"(\d+)", p.stem).group(1))
            mine = [f for f in findings if f["lesson"] == n]
            if not mine:
                print("%-8d %-6s CLEAN" % (n, "0"))
                continue
            c = {s: sum(1 for f in mine if f["severity"] == s)
                 for s in ("BLOCK", "HIGH", "REVIEW")}
            print("%-8d %-6d %d / %d / %d"
                  % (n, len(mine), c["BLOCK"], c["HIGH"], c["REVIEW"]))
    else:
        print("THE CHILD -- %d lessons in %s\n" % (len(paths), folder))
        if not findings:
            print("  clean: every word known, every idea one they should meet")
        current = None
        for f in findings:
            if f["severity"] != current:
                current = f["severity"]
                print("\n%s\n%s" % (current, "-" * len(current)))
            times = "" if f.get("times", 1) == 1 else "  (x%d)" % f["times"]
            print("  L%-3d %-11s %-24s %s%s"
                  % (f["lesson"], f["check"], f["item"][:24], f["why"], times))
            print("       %s: %s" % (f["field"], f["text"][:88]))

        counts = {}
        for f in findings:
            counts[f["severity"]] = counts.get(f["severity"], 0) + 1
        print("\n%d findings: %s" % (len(findings), ", ".join(
            "%s %d" % (s, counts[s]) for s in ("BLOCK", "HIGH", "REVIEW")
            if s in counts) or "none"))

    fails = [f for f in findings
             if f["severity"] in ("BLOCK", "HIGH")
             or (args.strict and f["severity"] == "REVIEW")]

    # A sign-off that silences nothing is a claim nobody is checking. This runs
    # on the whole set only: auditing a single lesson naturally leaves the
    # other lessons' sign-offs unused, and failing on that would be noise.
    dead = dead_signoffs() if not args.lessons else []
    if dead:
        print("\nDEAD SIGN-OFFS -- listed in ACCEPTED, matched no finding:")
        for k in dead:
            print("  %s" % k)
        print("Either the content was fixed and the entry should go, or the "
              "key is wrong and a real finding is NOT being suppressed.\n"
              "found() builds its key as 'lesson:check:item'.")
    return 1 if (fails or dead) else 0


if __name__ == "__main__":
    raise SystemExit(main())
