#!/usr/bin/env python3
"""The gate. Nothing becomes a sheet until it passes every check here.

audit_passage.py answers "can this word be decoded?". This answers the wider
question: "is this a usable passage?" — every word provably in the bank, warm-up
words that actually appear in the story, enough sentences to be a story, three
questions, nothing missing.

Run:  python3 validate_passage.py passages/lesson-041.json
      python3 validate_passage.py --all
"""

import json
import pathlib
import re
import sys

import audit_passage as A
import props
import word_age
from core_vocabulary import BLOCKED

HERE = pathlib.Path(__file__).parent
BANK = HERE / "word-bank.json"
SOUND_LIST = HERE / "sound-list.json"
PASSAGES = HERE / "passages"

MAX_LINES, MAX_WORDS = 12, 90

# How long a story may be depends on how much language exists yet. At Lesson 6
# a child can sound out eight words; demanding six lines and twenty-five words
# from those forces every word to appear six times, and the padding is what
# makes those sheets read like instructions rather than a story. A four-line
# story that does one thing beats an eight-line one that repeats itself.
#
# (pool of words to sound out) -> (min lines, min words, warm-up count)
LENGTH_BANDS = [
    (12, (4, 14, 4)),
    (30, (5, 20, 5)),
    (10 ** 9, (6, 25, 6)),
]


def limits_for(pool_size):
    for ceiling, band in LENGTH_BANDS:
        if pool_size < ceiling:
            return band
    return LENGTH_BANDS[-1][1]


def bank_for(lesson):
    doc = json.loads(BANK.read_text())
    return set(doc["availableByLesson"][str(lesson)])


def hearts_for(lesson):
    doc = json.loads(SOUND_LIST.read_text())
    return {w.lower() for w in doc["lessons"][lesson - 1]["allowedHeartWords"]}


def words_in(text):
    return [w.lower().strip(".,!?;:\"'") for w in re.findall(r"[A-Za-z']+", text)]


def validate(spec):
    """Return a list of problems. Empty list means it may be rendered."""
    problems = []
    n = spec.get("lesson")

    for field in ("lesson", "title", "lines", "warmup", "questions"):
        if field not in spec:
            problems.append(f"missing field: {field}")
    if problems:
        return problems
    if not isinstance(n, int) or not 1 <= n <= 128:
        return [f"lesson must be 1-128, got {n!r}"]

    bank = bank_for(n)
    hearts = hearts_for(n)
    lines = spec["lines"]
    story = " ".join(lines)
    story_words = words_in(story)

    # 1. shape, scaled to how much language the lesson actually has
    soundable = [w for w in bank if w not in hearts]
    min_lines, min_words, warmup_count = limits_for(len(soundable))
    if not min_lines <= len(lines) <= MAX_LINES:
        problems.append(f"{len(lines)} lines; needs {min_lines}-{MAX_LINES} "
                        f"({len(soundable)} words can be sounded out at this lesson)")
    if not min_words <= len(story_words) <= MAX_WORDS:
        problems.append(f"{len(story_words)} words; needs {min_words}-{MAX_WORDS}")
    if len(spec["questions"]) != 3:
        problems.append(f"{len(spec['questions'])} questions; needs exactly 3")
    for i, q in enumerate(spec["questions"], 1):
        if not q.get("ask") or not q.get("listenFor"):
            problems.append(f"question {i} needs both 'ask' and 'listenFor'")
    if len(spec["warmup"]) != warmup_count:
        problems.append(f"{len(spec['warmup'])} warm-up words; needs exactly "
                        f"{warmup_count} at this lesson")

    # 2a. Words that must never reach a child, however decodable they are.
    #     This lived only in the word bank, which meant a writer could still use
    #     one as long as the letters happened to be legal. The gate is where it
    #     belongs -- the bank is a suggestion, the gate is the rule.
    # Everything a parent or child lays eyes on, including the grown-up answer
    # notes -- two blocked words were hiding in those, which nothing checked.
    visible = set(story_words) | {t.lower() for t in words_in(spec["title"])}
    visible |= {x.lower() for x in spec["warmup"]}
    for q in spec["questions"]:
        visible |= set(words_in(q.get("ask", ""))) | set(words_in(q.get("listenFor", "")))
    for w in sorted(visible):
        if w in BLOCKED:
            problems.append(f"NOT FOR CHILDREN {w!r} — on the blocked list; "
                            f"choose another word with the same sounds")

    # 2b. Decodable is not the same as understood. A child can sound out `cod`
    #     perfectly at Lesson 18 and have no idea what it means -- it is learned
    #     at age 11.5. This gate asks the other question.
    names = props.find_names(story)
    for w, why in sorted(word_age.scan(
            " ".join([story, spec["title"]] + spec["warmup"]), names).items()):
        problems.append(f"TOO OLD {w!r} — {why}")

    # 2. every word must be decodable by the rules
    report = A.audit(story, n)
    for v in report["violations"]:
        problems.append(f"UNDECODABLE {v['word']!r}: {v['reason']} — {v['detail']}")

    # 3. Words whose spelling says more than one sound MUST come from the
    #    approved bank -- that is the only thing that separates snow from down,
    #    or eat from head. Everything else only has to survive the rules.
    ambiguous = {w["spelling"] for w in
                 (json.loads(SOUND_LIST.read_text())["lessons"][n - 1]
                  .get("requiresWordBank") or [])}
    for w in sorted(set(story_words)):
        if not w or w in hearts or w in bank:
            continue
        risky = sorted(sp for sp in ambiguous if sp in w)
        if risky:
            problems.append(
                f"NOT IN BANK {w!r} — it contains {', '.join(repr(r) for r in risky)}, "
                f"which says more than one sound at Lesson {n}. Only approved words "
                f"may use it.")
        elif not A.audit(w, n)["clean"]:
            problems.append(f"NOT DECODABLE {w!r} at Lesson {n}")

    # 4. warm-up words must come from the story, and be in the bank
    for w in spec["warmup"]:
        lw = w.lower()
        if lw not in story_words:
            problems.append(f"warm-up word {w!r} does not appear in the story")
        if lw not in bank and lw not in hearts:
            problems.append(f"warm-up word {w!r} is not an approved word for Lesson {n}")
        if lw in hearts:
            problems.append(f"warm-up word {w!r} is a heart word; warm-ups are for "
                            f"words that get sounded out")

    # 5. the title has to be readable too
    for w in words_in(spec["title"]):
        if w and w not in bank and w not in hearts and not A.audit(w, n)["clean"]:
            problems.append(f"title word {w!r} is not decodable at Lesson {n}")

    # 6. a story needs something to happen
    if len(set(lines)) < len(lines):
        problems.append("a line is repeated verbatim")
    distinct = len(set(story_words))
    floor = min(12, max(6, len(soundable) + len(hearts) - 2))
    if distinct < floor:
        problems.append(f"only {distinct} distinct words — needs {floor} to be a "
                        f"story rather than a chant")

    return problems


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    paths = sorted(PASSAGES.glob("lesson-*.json")) if args[0] == "--all" \
        else [pathlib.Path(a) for a in args]
    if not paths:
        sys.exit(f"No passage specs found in {PASSAGES}")

    failed = 0
    for path in paths:
        spec = json.loads(path.read_text())
        problems = validate(spec)
        if problems:
            failed += 1
            print(f"\n{path.name}  —  {len(problems)} PROBLEM(S)")
            for p in problems:
                print(f"    {p}")
        else:
            print(f"{path.name}  OK")
    if len(paths) > 1:
        print(f"\n{len(paths) - failed}/{len(paths)} passages valid")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
