#!/usr/bin/env python3
"""Corpus-level check. quality.py judges one passage at a time and therefore
could never see that 13 of 27 stories ended on "It is fun".

Two things were wrong with the first version and are fixed here.

  1. It globbed "data/lesson-*.json" — a RELATIVE path. Run from anywhere but
     formb/ it found nothing, printed "corpus check over 0 passages / no
     corpus-level repetition or pacing problems", and exited 0. A check that
     reports success when it has checked nothing is worse than no check, because
     it is quoted as evidence. Paths are absolute now and an empty corpus is a
     failure, not a pass.
  2. It looked only at the top 3 endings and top 6 words, counted raw mentions
     rather than how many different passages leaned on a word, treated a
     character name as vocabulary, and matched titles only exactly. The rules
     live in verify_all.corpus_problems() now, alongside checks for repeated
     openings, repeated lines, near-duplicate titles, over-used characters and
     sentence-length spread.

This file stays as the corpus-only entry point. `python3 verify_all.py` runs it
along with everything else.
"""
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from verify_all import DATA, corpus_problems      # noqa: E402


def main():
    items = [json.loads(p.read_text()) for p in sorted(DATA.glob("lesson-*.json"))]
    ps = [d for d in items if d.get("instrument") == "passage"]
    probs = corpus_problems(ps)
    print("corpus check over %d passages" % len(ps))
    if probs:
        print("PROBLEMS:")
        for p in probs:
            print("  " + p)
        return 1
    print("  no corpus-level repetition or pacing problems")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
