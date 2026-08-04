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
CAST = {
    "sam", "pam", "tim", "nan", "dot", "gus", "bob", "meg", "ben", "sid",
    "ted", "kim", "deb", "reg", "ron", "ned", "hal", "raj", "sal", "tom",
    "max", "liz", "zac", "dan", "jen", "mom", "dad", "i",
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
    (r"\bden\b",
     "REVIEW", "'den' is a fox's home in one lesson and a room in the house in "
               "another. One instrument should not teach two senses."),
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
    ("sharps", r"\bpins?\b|\btacks?\b",
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
    "a pet": r"\b(cat|dog|pet|pets|rat|rats|hen)\b",
    "a farm": r"\b(pig|pigs|hog|hogs|ox|hen|pen|cob|cobs|barn)\b",
    "food that is always there": r"\b(bun|buns|ham|jam|nut|nuts|cob|cobs)\b",
}

# ---------------------------------------------------------------------------
# Sign-off. A finding listed here has been read by a person and kept, with the
# reason written down next to it. Key is "lesson:check:item".
# ---------------------------------------------------------------------------
ACCEPTED = {
    "17:feelings:sad":
        "Bob's sadness is answered by the plot -- the bat is found, the dog is "
        "forgiven, Bob pats the dog. Teacher-approved as resolved without the "
        "word 'glad' appearing.",
    "40:topics:a child handling a farm or wild animal.":
        "Lesson 40 is the model, not the problem: the fox is watched from a "
        "log, with a grown-up, and Dad says 'do not run'. Nobody touches it.",
}

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


def audit(paths):
    docs = [json.loads(p.read_text()) for p in paths]
    corpus_words, corpus_lessons = corpus_index(docs)
    all_findings = []

    for doc in docs:
        lesson = doc["lesson"]
        rows = []

        def found(severity, check, item, why, label, text):
            key = "%d:%s:%s" % (lesson, check, item)
            if key in ACCEPTED:
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

    findings = audit(paths)
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
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
