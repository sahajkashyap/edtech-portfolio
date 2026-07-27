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
from core_vocabulary import AMBIGUOUS, word_list

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
    words = word_list()
    bank, never, overrides = {}, [], 0

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
        "placed": sum(len(v) for v in bank.values()),
        "humanTagOverrides": overrides,
        "neverDecodable": sorted(never),
        "newAtLesson": {str(k): sorted(v) for k, v in sorted(bank.items())},
        "availableByLesson": {str(k): v for k, v in cumulative.items()},
    }
    OUT.write_text(json.dumps(doc, indent=1) + "\n")

    print(f"wrote {OUT}")
    print(f"  {len(words)} words in; {doc['placed']} placed; {len(never)} never decodable")
    print(f"  {overrides} placed by human sound-tag rather than by rule\n")
    for n in (5, 10, 19, 41, 53, 62, 76, 88, 97, 128):
        avail = cumulative[n]
        print(f"  by lesson {n:>3}: {len(avail):>4} words   e.g. {', '.join(avail[:9])}")
    if never:
        print(f"\n  never decodable by rule ({len(never)}): {', '.join(never[:20])}")


if __name__ == "__main__":
    build()
