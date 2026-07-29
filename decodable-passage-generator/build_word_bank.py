#!/usr/bin/env python3
"""Work out, for every word, the earliest lesson a child could read it.

This is the piece that makes the writer reliable. A writer handed *rules* has to
reason its way to a legal word and will sometimes get it wrong. A writer handed
a list of words already proven legal for its lesson mostly cannot get it wrong.

It also resolves the auditor's known limitations: `snow` and `down` are the same
spelling to a rule but different words to a list.

Run:  python3 build_word_bank.py   -> writes word-bank.json
"""

import json
import pathlib

import audit_passage as A
import word_age
from core_vocabulary import (AMBIGUOUS, ADJECTIVES, BLOCKED, FUNCTION_WORDS,
                             NOUNS_NO_PLURAL, VERBS, word_list)

# Suffix -> the lesson that teaches it. Inflected forms are generated so the
# lesson that teaches a suffix can actually use words carrying it: before this,
# the -er/-est lesson had no -er/-est word in its own bank.
SUFFIXES = {"s": 20, "es": 63, "ed": 64, "ing": 65, "er": 100, "est": 100,
            "ly": 101}
DOUBLING_LESSON = 107   # running, bigger  -- the doubling rule
DROP_E_LESSON = 109     # making, hoping   -- the drop-e rule
VOWELS = set("aeiou")


def inflect(base):
    """Inflected forms of a base word, with the lesson each becomes legal.

    Only words tagged as verbs or adjectives are inflected. Without that check
    the generator produces "alled" and "aboutly" -- confidently wrong English
    that would end up on a child's page.
    """
    out = {}
    is_verb = base in VERBS
    is_adj = base in ADJECTIVES
    pluralisable = not (is_verb or is_adj or base in NOUNS_NO_PLURAL
                        or base in FUNCTION_WORDS or len(base) < 3)

    def add(form, lesson):
        out.setdefault(form, lesson)

    def stems(suf, suf_lesson):
        """(form, lesson) for plain, doubled and drop-e spellings."""
        if base.endswith("e") and suf[0] in "aeiou":
            add(base[:-1] + suf, max(suf_lesson, DROP_E_LESSON))
        else:
            add(base + suf, suf_lesson)
        if (len(base) >= 3 and base[-1] not in VOWELS and base[-2] in VOWELS
                and base[-3] not in VOWELS and base[-1] not in "wxy"):
            add(base + base[-1] + suf, max(suf_lesson, DOUBLING_LESSON))

    if (is_verb or pluralisable) and base not in FUNCTION_WORDS:
        if base.endswith(("s", "x", "z", "ch", "sh")):
            add(base + "es", 63)
        else:
            add(base + "s", 20)

    if is_verb:
        stems("ed", 64)
        stems("ing", 65)

    if is_adj:
        stems("er", 100)
        stems("est", 100)
        add(base + "ly", 101)

    return out


OUT = pathlib.Path(__file__).parent / "word-bank.json"
TOTAL = 128


def earliest_lesson(word: str):
    """First lesson at which the auditor calls this word clean, or None."""
    lo, hi = 1, TOTAL
    if not A.audit(word, TOTAL)["clean"]:
        return None
    while lo < hi:                       # binary search: legality is monotone
        mid = (lo + hi) // 2
        if A.audit(word, mid)["clean"]:
            hi = mid
        else:
            lo = mid + 1
    return lo


def build():
    # The bank is what a writer picks from, so it should not offer words the
    # gate will reject. Filtering here means "fern" and "herd" never reach a
    # writer at all, rather than being suggested and then refused.
    words = [w for w in word_list() if word_age.check(w)[0]]
    dropped = [w for w in word_list() if not word_age.check(w)[0]]
    bank, never, overrides = {}, [], 0
    generated = 0

    # inflected forms, each only as early as BOTH its base and its suffix allow
    extra = {}
    for base in words:
        base_lesson = earliest_lesson(base)
        if base_lesson is None:
            continue
        for form, suf_lesson in inflect(base).items():
            if form in words or form in BLOCKED or form in extra:
                continue
            lesson = max(base_lesson, suf_lesson)
            if A.audit(form, lesson)["clean"]:
                extra[form] = lesson
    generated = len(extra)

    for w in words:
        rule_lesson = earliest_lesson(w)
        tagged = AMBIGUOUS.get(w)

        if tagged is not None:
            # A human said which sound this word uses. That beats the rule, in
            # both directions: it can hold a word back (down waits for 96) and
            # it can release one the rule cannot prove (snow is fine at 86).
            lesson = tagged
            if rule_lesson != tagged:
                overrides += 1
        elif rule_lesson is None:
            never.append(w)
            continue
        else:
            lesson = rule_lesson

        bank.setdefault(lesson, []).append(w)

    for form, lesson in extra.items():
        bank.setdefault(lesson, []).append(form)

    cumulative, running = {}, []
    for n in range(1, TOTAL + 1):
        running.extend(sorted(bank.get(n, [])))
        cumulative[n] = sorted(running)

    doc = {
        "what": "Words a child can read by each lesson, cumulative.",
        "how": "Every word run through audit_passage.py; the earliest clean "
               "lesson wins. Words whose spelling has two sounds carry a human "
               "tag in core_vocabulary.AMBIGUOUS, which overrides the rule.",
        "totalWords": len(words),
        "generatedInflections": generated,
        "placed": sum(len(v) for v in bank.values()),
        "humanTagOverrides": overrides,
        "neverDecodable": sorted(never),
        "newAtLesson": {str(k): sorted(v) for k, v in sorted(bank.items())},
        "availableByLesson": {str(k): v for k, v in cumulative.items()},
    }
    OUT.write_text(json.dumps(doc, indent=1) + "\n")

    print(f"wrote {OUT}")
    print(f"  {len(words)} base words + {generated} inflected forms; "
          f"{doc['placed']} placed; {len(never)} never decodable")
    print(f"  {len(dropped)} words held back as too old for a six-year-old")
    print(f"  {overrides} placed by human sound-tag rather than by rule\n")
    for n in (5, 10, 19, 41, 53, 62, 76, 88, 97, 128):
        avail = cumulative[n]
        print(f"  by lesson {n:>3}: {len(avail):>4} words   e.g. {', '.join(avail[:9])}")
    if never:
        print(f"\n  never decodable by rule ({len(never)}): {', '.join(never[:20])}")


if __name__ == "__main__":
    build()
