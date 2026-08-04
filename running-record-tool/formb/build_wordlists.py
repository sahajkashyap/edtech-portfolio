#!/usr/bin/env python3
"""Form B word lists for Lessons 6-14.

At these lessons a distinct story is arithmetically impossible — Lesson 6 has
five decodable content words in existence and Form A spends four of them. Every
program in the field uses word-level measures here instead, so we do too.

Structure mirrors UFLI's own progress monitoring:

    5 real words          drawn from the lesson's available pool
    5 nonsense words      decodable pseudowords (the NWF measure)
    5 high-frequency      the lesson's own heart words
    2 controlled sentences

Nonsense words are generated, not invented by hand, and then filtered hard:
must be decodable at the lesson, must NOT be a real English word, must not be
in the generator's BLOCKED list, and must not be one letter away from anything
blocked. A practice sheet is the last place anyone thinks to look for a word
that generates a parent phone call.
"""

import json
import pathlib
import sys
from itertools import product

HERE = pathlib.Path(__file__).resolve().parent
GENERATOR = HERE.parents[1] / "decodable-passage-generator"
sys.path.insert(0, str(GENERATOR))
sys.path.insert(0, str(HERE))

import audit_passage as ap          # noqa: E402
import core_vocabulary as cv        # noqa: E402
import gates                        # noqa: E402

WORD_BANK = json.loads((GENERATOR / "word-bank.json").read_text())
AVAILABLE = WORD_BANK["availableByLesson"]

# Words the system dictionary does not know, because /usr/share/dict/words on a
# Mac is Webster's Second International — 1934. That is how "mic" was published
# as a nonsense word: it is not in a dictionary printed before the microphone
# was called one. Every entry below was found by an auditor reading the output
# aloud, which is the only test that catches this class of defect.
MODERN = set("""
app apps mic mics gif jpg pdf url wifi blog vlog meme emo dev pro
nick rick mick dick vic ric tik tok pic pics vid vids fam bro sis
ok okay yep yup nope dude mom dad pop nan gran
""".split())

# A pseudoword is contaminated if DOUBLING its final consonant makes a real
# word — a child reads "ap" as "app", "mis" as "miss", "tif" as "tiff".
def doubles_to_real(word, real):
    return len(word) >= 2 and (word + word[-1]) in real


# Every real English word we can lay hands on, so a "nonsense" word is never
# accidentally a real one.
def real_words():
    words = set(MODERN)
    for p in ("/usr/share/dict/words", "/usr/dict/words"):
        f = pathlib.Path(p)
        if f.exists():
            words |= {w.strip().lower() for w in f.read_text(errors="ignore").splitlines()}
            break
    for lst in AVAILABLE.values():
        words |= {w.lower() for w in lst}
    words |= {w.lower() for w in cv.CORE} if hasattr(cv, "CORE") else set()
    return words


REAL = real_words()
BLOCKED = {w.lower() for w in cv.BLOCKED}


def one_edit_from_blocked(word: str) -> bool:
    """Reject near-misses too: a child reading aloud turns a near-miss into the
    real thing often enough that it isn't worth the risk."""
    for b in BLOCKED:
        if abs(len(b) - len(word)) > 1:
            continue
        if b == word:
            return True
        if len(b) == len(word):
            if sum(x != y for x, y in zip(b, word)) <= 1:
                return True
        else:
            longer, shorter = (b, word) if len(b) > len(word) else (word, b)
            for i in range(len(longer)):
                if longer[:i] + longer[i + 1:] == shorter:
                    return True
    return False


USED_PSEUDO = {}      # word -> last lesson used; no reuse within 3 lessons
USED_REAL = set()     # and consecutive lessons must not repeat a word list


# Exhaustive count of legal pseudowords per lesson (decodable, not a real word
# or name, FLSZ-legal, no bare final c, not real when its final letter doubles):
#   L6=0  L7=1  L8-11=5-6  L12=12  L13=15  L14=16
# A nonsense-word subtest needs five items a child has genuinely never seen. It
# is therefore NOT VIABLE before Lesson 12, and pretending otherwise is how the
# first version shipped "mic", "ap" and eighteen spellings English never uses.
NWF_FROM_LESSON = 12


def nonsense_candidates(lesson: int, limit: int = 5):
    if lesson < NWF_FROM_LESSON:
        return []
    """Build pseudowords from the lesson's own graphemes and keep the ones the
    real audit calls decodable."""
    L = ap.load(lesson)
    graphemes = sorted(L["allowedGraphemes"])
    vowels = [g for g in graphemes if g in set("aeiou")]
    consonants = [g for g in graphemes if g not in set("aeiou")]
    if not vowels or not consonants:
        return []

    out = []
    seen = set()
    # CVC first, then VC — the shapes a child at this stage can actually attack.
    shapes = [(consonants, vowels, consonants), (vowels, consonants)]
    for shape in shapes:
        for parts in product(*shape):
            w = "".join(parts)
            if w in seen:
                continue
            seen.add(w)
            if w in REAL or w in BLOCKED or one_edit_from_blocked(w):
                continue
            # FLSZ: English doubles f, l, s and z after a short vowel in a
            # one-syllable word (off, fuss, bell, buzz). This curriculum teaches
            # that rule at Lesson 42, so a pseudoword like "maf" or "fos" trains
            # the eye on a spelling the child will later be told is wrong.
            if w[-1] in "flsz":
                continue
            # English never spells final /k/ with a bare c: it is -ck or -k.
            # "noc" and "nic" are not possible English words, so a child has no
            # orthographic basis to attack them and the item measures nothing.
            if w.endswith("c"):
                continue
            if doubles_to_real(w, REAL):
                continue
            if not ap.audit(w, lesson)["clean"]:
                continue
            out.append(w)
            if len(out) >= limit * 6:
                break
        if len(out) >= limit * 6:
            break

    # Put pseudowords containing a recently-taught grapheme first: those are
    # the ones that actually test the new sound.
    fresh_graphemes = set()
    for back in range(0, 3):
        L2 = ap.load(max(1, lesson - back))
        fresh_graphemes |= set(L2["allowedGraphemes"])
        if back == 2:
            fresh_graphemes -= set(ap.load(max(1, lesson - 3))["allowedGraphemes"])
    out.sort(key=lambda w: (not any(g in w for g in fresh_graphemes), w))

    # Rotate the pool by lesson so consecutive lessons don't share a list.
    if out:
        off = (lesson * 7) % len(out)
        out = out[off:] + out[:off]

    out = [w for w in out if lesson - USED_PSEUDO.get(w, -99) >= 3]
    picked, used_first, used_vowel = [], set(), set()
    for w in out:
        v = next((c for c in w if c in "aeiou"), "")
        if w[0] in used_first or v in used_vowel:
            continue
        picked.append(w); used_first.add(w[0]); used_vowel.add(v)
        if len(picked) >= limit:
            break
    for w in out:                       # top up if diversity was too strict
        if len(picked) >= limit:
            break
        if w not in picked:
            picked.append(w)
    for w in picked: USED_PSEUDO[w] = lesson
    return picked[:limit]


NEW_AT = WORD_BANK["newAtLesson"]


def real_word_picks(lesson: int, form_a_text: str, limit: int = 5):
    """Priority order: words that became readable AT this lesson (they test the
    thing just taught), then anything Form A hasn't spent, then the rest.
    Without the first rule consecutive lessons hand a child the same five
    words and the assessment stops telling you anything new."""
    pool = [w.lower() for w in AVAILABLE.get(str(lesson), [])]
    pool = [w for w in pool if w not in gates.FUNCTION_WORDS and w not in BLOCKED]
    used = gates.content_words(form_a_text, lesson)

    brand_new, recent = [], []
    for back in range(0, 4):
        for w in NEW_AT.get(str(lesson - back), []):
            w = w.lower()
            if w in pool and w not in gates.FUNCTION_WORDS:
                (brand_new if back == 0 else recent).append(w)

    # The lesson is named for a sound; its real words must contain it. Lesson 7
    # was the /f/ lesson and its five real words had no f in them at all.
    import re as _re
    m = _re.match(r"^(qu|[a-z]{1,2})\b", ap.load(lesson)["skill"].lower())
    target = m.group(1) if m else ""
    on_target = [w for w in pool if target and target in w]

    fresh = lambda g: [w for w in g if w not in USED_REAL]
    picks = []
    for group in (
            fresh([w for w in brand_new if w in on_target]),
            fresh(on_target),
            fresh(brand_new),
            fresh([w for w in pool if w not in used]),
            [w for w in brand_new if w in on_target],
            [w for w in recent if w in on_target],
            on_target,
            brand_new, recent, [w for w in pool if w not in used], pool):
        for w in group:
            if w not in picks:
                picks.append(w)
            if len(picks) >= limit:
                USED_REAL.update(picks)
                return picks[:limit]
    USED_REAL.update(picks)
    return picks[:limit]


def heart_picks(lesson: int, limit: int = 5):
    """The pronoun I is a capital letter. Nine word lists printed it as "i",
    which is not a word."""
    L = ap.load(lesson)
    out = sorted({w for w in L["allowedHeartWords"]}, key=lambda w: w.lower())
    return [("I" if w.lower() == "i" else w.lower()) for w in out][:limit]


def form_a_text(lesson: int) -> str:
    import re, html
    p = GENERATOR / "sheets" / f"lesson-{lesson:03d}.html"
    if not p.exists():
        return ""
    s = p.read_text()
    return "\n".join(
        html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
        for m in re.finditer(r'<[^>]*class="ln"[^>]*>(.*?)</', s, re.S)
    )


# Written by hand, then audited against the lesson. Slot-filling templates were
# tried first and produced "Sam and Pam man." and "It is a dad." - a template
# has no way to know which of a lesson's five words is a verb.
HAND_SENTENCES = {
    6:  ["I tap the mat.", "Sam and Pam sat."],
    7:  ["I pat the map.", "Sam sat and Pam sat."],
    8:  ["I sit and sip.", "Tim sat at the pit."],
    9:  ["The pin is in the tin.", "Nan and Tim nap."],
    10: ["The tan man sat.", "I fit the pin in it."],
    11: ["I am Nan.", "The man is tan."],
    12: ["The pot is on top.", "I mop the pot."],
    13: ["Dad is not mad.", "The dot is dim."],
    14: ["The cat is on the cot.", "I can pat the cat."],
}


def controlled_sentences(lesson: int, words=None, hearts=None):
    """Two short sentences using only this lesson's own words. Specified in the
    original design and never built - all nine files carried "sentences": []
    while still claiming audit_clean."""
    return list(HAND_SENTENCES.get(lesson, []))


def _build_uncached(lesson: int, sentences=None) -> dict:
    L = ap.load(lesson)
    fa = form_a_text(lesson)
    rec = {
        "lesson": lesson,
        "skill": L["skill"],
        "form": "B",
        "instrument": "word list",
        "real_words": real_word_picks(lesson, fa),
        "nonsense_words": nonsense_candidates(lesson),
        "high_frequency": heart_picks(lesson),
        "sentences": sentences if sentences is not None else [],
    }
    checks = []
    for w in rec["real_words"] + rec["nonsense_words"]:
        r = ap.audit(w, lesson)
        if not r["clean"]:
            checks.append(f"{w}: {r['violations'][:1]}")
    for s in rec["sentences"]:
        r = ap.audit(s, lesson)
        if not r["clean"]:
            checks.append(f"sentence {s!r}: {r['violations'][:2]}")
    rec["audit_clean"] = not checks
    rec["audit_problems"] = checks
    return rec


def build(lesson: int, sentences=None) -> dict:
    """Deterministic regardless of call order — always computed through the full
    pass. The bare version is _build_uncached and must not be called directly."""
    return build_all()[lesson]


def build_all(first: int = 6, last: int = 14) -> dict:
    """Build the whole range in one deterministic pass.

    USED_REAL and USED_PSEUDO are cross-lesson state — a lesson's answer depends
    on what earlier lessons already spent. Exposing a bare build(n) made that
    state invisible and the result order-dependent, so no single lesson could be
    re-verified. Always go through here.
    """
    USED_REAL.clear(); USED_PSEUDO.clear()
    out = {}
    for n in range(first, last + 1):
        rec = _build_uncached(n)
        rec["sentences"] = controlled_sentences(n)
        probs = [f"{i!r}: {ap.audit(i, n)['violations'][:1]}"
                 for i in rec["real_words"] + rec["nonsense_words"] + rec["sentences"]
                 if not ap.audit(i, n)["clean"]]
        rec["audit_clean"] = not probs
        rec["audit_problems"] = probs
        out[n] = rec
    return out


def build_one(lesson: int) -> dict:
    """A single lesson, but computed through the full deterministic pass so the
    answer never depends on call order."""
    return build_all()[lesson]


if __name__ == "__main__":
    for n in range(6, 15):
        rec = build(n)
        flag = "OK " if rec["audit_clean"] else "FAIL"
        print(f"{flag} Lesson {n:>3} — {rec['skill']}")
        print(f"      real     : {' '.join(rec['real_words'])}")
        print(f"      nonsense : {' '.join(rec['nonsense_words'])}")
        print(f"      heart    : {' '.join(rec['high_frequency'])}")
        if rec["audit_problems"]:
            for p in rec["audit_problems"]:
                print("      !! " + p)
