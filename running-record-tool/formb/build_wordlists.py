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

# Every real English word we can lay hands on, so a "nonsense" word is never
# accidentally a real one.
def real_words():
    words = set()
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


def nonsense_candidates(lesson: int, limit: int = 5):
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

    picks = []
    for group in (brand_new, recent, [w for w in pool if w not in used], pool):
        for w in group:
            if w not in picks:
                picks.append(w)
            if len(picks) >= limit:
                return picks[:limit]
    return picks[:limit]


def heart_picks(lesson: int, limit: int = 5):
    L = ap.load(lesson)
    return sorted({w.lower() for w in L["allowedHeartWords"]})[:limit]


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


def build(lesson: int, sentences=None) -> dict:
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
        "sentences": sentences or [],
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
