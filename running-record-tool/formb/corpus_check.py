#!/usr/bin/env python3
"""Corpus-level check. quality.py judges one passage at a time and therefore
could never see that 13 of 27 stories ended on "It is fun"."""
import json, glob, collections, re, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gates

def main():
    items = [json.load(open(f)) for f in sorted(glob.glob("data/lesson-*.json"))]
    ps = [d for d in items if d["instrument"] == "passage"]
    probs = []

    ends = collections.Counter()
    for d in ps:
        last = gates.sentences(" ".join(d["lines"]))[-1]
        ends[re.sub(r"[^a-z ]", "", last.lower()).strip()] += 1
    for phrase, n in ends.most_common(3):
        if n > 3:
            probs.append(f'{n} of {len(ps)} passages end on "{phrase}"')

    words = collections.Counter()
    for d in ps:
        for w in gates.bare_words(" ".join(d["lines"])):
            if w not in gates.FUNCTION_WORDS and w != "said":
                words[w] += 1
    for w, n in words.most_common(6):
        if n > len(ps) * 0.7:
            probs.append(f'"{w}" appears {n} times across {len(ps)} passages')

    titles = [d["title"].lower() for d in ps]
    dup = [t for t, n in collections.Counter(titles).items() if n > 1]
    if dup: probs.append("duplicate titles: " + ", ".join(dup))

    lens = [(d["lesson"], len(" ".join(d["lines"]).split())) for d in ps]
    for (a, la), (b, lb) in zip(lens, lens[1:]):
        if la and abs(lb - la) / la > 0.45:
            probs.append(f"L{a}={la}w then L{b}={lb}w — a {abs(lb-la)/la:.0%} step")

    print(f"corpus check over {len(ps)} passages")
    if probs:
        print("PROBLEMS:")
        for p in probs: print("  " + p)
        return 1
    print("  no corpus-level repetition or pacing problems")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
