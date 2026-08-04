#!/usr/bin/env python3
"""Everything a writer needs before drafting Form B for a lesson.

    python3 lesson_info.py 23
"""
import sys, pathlib, json
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
GENERATOR = HERE.parents[1] / "decodable-passage-generator"
sys.path.insert(0, str(GENERATOR))

import audit_passage as ap
import gates, check_formb

WB = json.loads((GENERATOR / "word-bank.json").read_text())


def main(n):
    L = ap.load(n)
    fa = check_formb.form_a(n)
    cast = check_formb.cast_of(n)
    prof = gates.profile(fa, n)
    used = gates.content_words(fa, n, cast)
    pool = [w.lower() for w in WB["availableByLesson"].get(str(n), [])]
    pool = [w for w in pool if w not in gates.FUNCTION_WORDS]
    free = sorted(set(pool) - used - cast)

    print(f"LESSON {n} — {L['skill']}")
    print(f"\nFORM A ({prof['total_words']} words, {prof['sentences']} sentences, "
          f"mean sentence {prof['mean_sentence_len']:.1f} words):")
    for line in fa.split("\n"):
        print("   " + line)
    print(f"\nCAST (may reuse): {', '.join(sorted(cast)) or 'none'}")
    print(f"\nFORM A SPENDS these — DO NOT REUSE ({len(used)}):")
    print("   " + " ".join(sorted(used)))
    print(f"\nFREE TO USE ({len(free)} words):")
    for i in range(0, len(free), 12):
        print("   " + " ".join(free[i:i + 12]))
    print(f"\nHEART WORDS (free, taught by sight): {' '.join(sorted(L['allowedHeartWords']))}")
    print(f"\nTARGET: {prof['total_words']} words (+/-15% = "
          f"{int(prof['total_words']*0.85)}-{int(prof['total_words']*1.15)}), "
          f"{prof['sentences']} sentences, max 14 words per sentence.")


if __name__ == "__main__":
    main(int(sys.argv[1]))
