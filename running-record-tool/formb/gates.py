"""Quality gates for Form B — the unpublished assessment passages.

Form A is the published parent sheet. Form B is what a teacher assesses with.
For the two to be interchangeable as a measurement, Form B must clear three
gates, and a passage that fails any of them is refused rather than published.

    Gate 1  DECODABLE   every word uses only sounds taught through lesson N.
                        Already solved: decodable-passage-generator/audit_passage.py
                        handles syllable limits, heart words, y-as-vowel,
                        open syllables, soft c/g. Reused unchanged.

    Gate 2  EQUIVALENT  Form B is the same difficulty as Form A. If it isn't,
                        the two scores can't be compared and the whole exercise
                        is theatre.

    Gate 3  DISTINCT    Form B does not reuse Form A's content words. This is
                        the gate that makes it an assessment rather than a
                        variation, and it has to be mechanical: a human writer
                        reuses vocabulary without noticing, and nobody could
                        catch it by eye across 128 pairs.

Which words are allowed to repeat is not a list we invent. It is the lesson's
own heart words (taught by sight, so recognising them proves nothing about
decoding) plus the character names. Everything else is a content word and is
being measured.
"""

import re
import sys
import pathlib

GENERATOR = pathlib.Path(__file__).resolve().parents[2] / "decodable-passage-generator"
sys.path.insert(0, str(GENERATOR))
import audit_passage as ap  # noqa: E402


# --- tolerances -------------------------------------------------------------
# Lessons 6-12 are the pinch point: stories exist but the legal vocabulary is
# still tiny, so a little more overlap is unavoidable there. It tightens as
# the sound inventory opens up.
def overlap_allowance(lesson: int) -> float:
    return 0.15 if lesson <= 12 else 0.05


EQUIV = {
    "total_words_pct": 0.15,      # within 15% of Form A's length
    "mean_word_len": 0.6,         # within 0.6 letters
    "mean_sentence_len_pct": 0.25,
    "heart_share_points": 0.12,   # within 12 percentage points
    "mean_syllables": 0.25,
}

# mean_syllables is a real measure of difficulty and a dead one before Lesson
# 66. Gate 1 refuses any word of more than one syllable until syllable division
# is taught, so mean_syllables is exactly 1.000 in both forms at every lesson
# this tool covers, and the tolerance above could never be exceeded. It was
# printing PASS on a comparison it was arithmetically unable to fail, which is
# the same defect the fourth audit found in cast_of. The tolerance stays,
# because it becomes meaningful the moment the tool reaches Lesson 66; it is now
# only APPLIED where it can bite, and skipped explicitly rather than silently.
SYLLABLES_MEANINGFUL_FROM = ap.MULTISYLLABLE_LESSON      # 66


# Any run of text inside straight or curly double quotes. Dialogue punctuation
# lives in here and must not be treated as a sentence boundary.
QUOTED = re.compile('["“”][^"“”]*["“”]')


def sentences(text: str):
    """Split into sentences without breaking inside quoted dialogue.

    '"It is fun!" said Ted.' is one sentence. Splitting on every . ! ? made it
    two, the second a verbless fragment, which quietly inflated the sentence
    count and tripped the story-quality gate on perfectly good writing. Found
    independently by all four writers on the first batch.
    """
    protected, quotes = [], []

    def stash(m):
        quotes.append(m.group(0))
        return "\x00%d\x00" % (len(quotes) - 1)

    masked = QUOTED.sub(stash, text)
    for part in re.split(r"[.!?]+", masked):
        part = part.strip()
        if not part:
            continue
        for i, q in enumerate(quotes):
            part = part.replace("\x00%d\x00" % i, q)
        if re.search(r"[a-z]", part, re.I):
            protected.append(part)
    return protected


def bare_words(text: str):
    """Lowercased words with punctuation stripped, using the generator's own
    tokeniser so Form B is measured exactly the way Form A was."""
    return [b for _, b in ap.words_of(text) if b]


# Closed-class words: determiners, prepositions, conjunctions, pronouns and
# auxiliaries. You cannot write English without them, so they are structural
# rather than content and are exempt from the overlap gate. This is the
# grammatical distinction, not a convenience list — content words are the
# nouns, verbs, adjectives and adverbs, and those are what we measure.
FUNCTION_WORDS = frozenset("""
a an the this that these those
and or but so if then than as
in on at to of by for from with into onto off out up down over under
i me my we us our you your he him his she her it its they them their
is am are was were be been being do does did have has had
no not yes here there where when who what why how
""".split())


def character_names(text: str):
    """A capitalised word that is not simply the first word of a sentence.
    Catches Sam. Does NOT catch a lowercase character like 'the pig' — those
    are declared explicitly by whoever writes Form B, because only a person
    knows the cast."""
    names = set()
    for sent in sentences(text):
        toks = re.findall(r"[A-Za-z']+", sent)
        for i, t in enumerate(toks):
            if i > 0 and t[0].isupper():
                names.add(t.lower())
    return names


def profile(text: str, lesson: int) -> dict:
    L = ap.load(lesson)
    hearts = {w.lower() for w in L["allowedHeartWords"]}
    words = bare_words(text)
    sents = sentences(text)
    n = len(words) or 1
    syl = [ap.syllable_count(w) for w in words]
    return {
        "total_words": len(words),
        "unique_words": len(set(words)),
        "mean_word_len": sum(len(w) for w in words) / n,
        "sentences": len(sents),
        "mean_sentence_len": len(words) / (len(sents) or 1),
        "heart_share": sum(1 for w in words if w in hearts) / n,
        "mean_syllables": sum(syl) / n,
    }


def content_words(text: str, lesson: int, characters=frozenset()):
    """Everything being measured: not a heart word, not a function word, not a
    character. What is left are the nouns, verbs and adjectives — the words a
    child has to actually decode."""
    L = ap.load(lesson)
    hearts = {w.lower() for w in L["allowedHeartWords"]}
    cast = character_names(text) | {c.lower() for c in characters}
    return {
        w for w in bare_words(text)
        if w not in hearts and w not in FUNCTION_WORDS and w not in cast
    }


# --- the gates --------------------------------------------------------------
def gate1_decodable(form_b: str, lesson: int) -> dict:
    r = ap.audit(form_b, lesson)
    return {
        "gate": "1 decodable",
        "passed": bool(r["clean"]) and not r["empty"],
        "detail": ("every word decodable at lesson %d" % lesson) if r["clean"]
                  else "untaught: " + "; ".join(str(v) for v in r["violations"][:6]),
    }


def gate2_equivalent(form_a: str, form_b: str, lesson: int) -> dict:
    # Refuse to judge rather than judge against nothing. profile("") is all
    # zeros, and comparing to zero produces confident-looking numbers about a
    # document that was never read.
    if not form_a.strip():
        return {"gate": "2 equivalent", "passed": False,
                "detail": "cannot judge equivalence: Form A for lesson %d is empty or "
                          "could not be read" % lesson,
                "profile_a": {}, "profile_b": {}}
    a, b = profile(form_a, lesson), profile(form_b, lesson)
    problems = []
    skipped = []

    def pct(key, tol, label):
        if a[key] == 0:
            return
        d = abs(b[key] - a[key]) / a[key]
        if d > tol:
            problems.append("%s %.1f vs %.1f (%.0f%% off, max %.0f%%)"
                            % (label, b[key], a[key], d * 100, tol * 100))

    def absolute(key, tol, label):
        d = abs(b[key] - a[key])
        if d > tol:
            problems.append("%s %.2f vs %.2f (off by %.2f, max %.2f)"
                            % (label, b[key], a[key], d, tol))

    pct("total_words", EQUIV["total_words_pct"], "length")
    pct("mean_sentence_len", EQUIV["mean_sentence_len_pct"], "sentence length")
    absolute("mean_word_len", EQUIV["mean_word_len"], "word length")
    absolute("heart_share", EQUIV["heart_share_points"], "heart-word share")
    if lesson >= SYLLABLES_MEANINGFUL_FROM:
        absolute("mean_syllables", EQUIV["mean_syllables"], "syllables per word")
    else:
        skipped.append("syllables per word (every word is one syllable before "
                       "lesson %d, so the measure cannot vary)"
                       % SYLLABLES_MEANINGFUL_FROM)

    detail = "same difficulty as Form A" if not problems else "; ".join(problems)
    if skipped and not problems:
        detail += "  [not measured: %s]" % "; ".join(skipped)
    return {
        "gate": "2 equivalent",
        "passed": not problems,
        "detail": detail,
        "profile_a": a, "profile_b": b,
        "skipped": skipped,
    }


def stem_of(word: str, lesson: int) -> str:
    """The word with one taught ending peeled off, using the generator's own
    rule for which endings a child has met by this lesson. 'sits' and 'sit' are
    the same item to a child who has been taught -s; treating them as different
    words is how a reused vocabulary passes a distinctness gate."""
    L = ap.load(lesson)
    got = ap.strip_suffix(word, L.get("allowedSuffixes") or [])
    root = got[0] if isinstance(got, (tuple, list)) else got
    return root or word


# FIXED (was a KNOWN LIMITATION carried in this file as a comment): gate 3
# compared exact word forms, so "sit" in Form B slipped past "sits" in Form A
# even though a child who can read one can read the other. Across the 27 shipped
# passages that blind spot hid 14 reuses, five of them in Lesson 22 alone — a
# passage the gate was passing at 4.8% against a 5% allowance. The comment said
# "whoever writes Form B watches for it by eye"; nobody can watch 128 pairs by
# eye, which is the whole reason the gate exists.
def gate3_distinct(form_a: str, form_b: str, lesson: int,
                   characters=frozenset()) -> dict:
    if not form_a.strip():
        # An empty Form A shares no words with anything, so every Form B looked
        # distinct. The gate approved everything and said "no reused content
        # words" while doing it. Refuse to judge instead.
        return {"gate": "3 distinct", "passed": False,
                "detail": "cannot judge distinctness: Form A for lesson %d is empty "
                          "or could not be read" % lesson,
                "shared": [], "ratio": 0.0}

    ca = content_words(form_a, lesson, characters)
    cb = content_words(form_b, lesson, characters)

    exact = sorted(ca & cb)
    stems_a = {stem_of(w, lesson) for w in ca}
    shared = sorted({w for w in cb if w in ca or stem_of(w, lesson) in stems_a})
    inflected = [w for w in shared if w not in exact]

    allowance = overlap_allowance(lesson)
    ratio = len(shared) / (len(cb) or 1)
    ok = ratio <= allowance
    return {
        "gate": "3 distinct",
        "passed": ok,
        "exact": exact,
        "inflected": inflected,
        "detail": ("no reused content words" if not shared else
                   "reuses %d of %d content words (%.0f%%, max %.0f%%)%s%s"
                   % (len(shared), len(cb), ratio * 100, allowance * 100,
                      (": " + ", ".join(exact)) if exact else "",
                      ("%s same word in another form: %s"
                       % ("," if exact else ":", ", ".join(inflected)))
                      if inflected else "")),
        "shared": shared,
        "ratio": ratio,
    }


def check(form_a: str, form_b: str, lesson: int, characters=frozenset()) -> dict:
    results = [
        gate1_decodable(form_b, lesson),
        gate2_equivalent(form_a, form_b, lesson),
        gate3_distinct(form_a, form_b, lesson, characters),
    ]
    return {"lesson": lesson, "passed": all(r["passed"] for r in results),
            "results": results}


def report(res: dict, title: str = "") -> str:
    out = []
    if title:
        out.append(title)
    for r in res["results"]:
        out.append("  %s  gate %s — %s"
                   % ("PASS" if r["passed"] else "FAIL", r["gate"], r["detail"]))
    out.append("  => %s" % ("PUBLISH" if res["passed"] else "REFUSED"))
    return "\n".join(out)
