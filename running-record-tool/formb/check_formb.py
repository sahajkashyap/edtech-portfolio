#!/usr/bin/env python3
"""Check a candidate Form B passage against every gate.

    python3 check_formb.py 23 "Sam ran to the pond. ..."
    python3 check_formb.py 23 --file draft.txt

Exit 0 = publishable, 1 = refused. Prints exactly what failed and why, so the
writer can fix it and run again. This is the generate -> audit -> fix ->
re-audit loop in one command.
"""

import sys
import re
import html
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
GENERATOR = HERE.parents[1] / "decodable-passage-generator"

import gates                      # noqa: E402
import quality                    # noqa: E402


def form_a(lesson: int) -> str:
    p = GENERATOR / "sheets" / f"lesson-{lesson:03d}.html"
    if not p.exists():
        return ""
    s = p.read_text()
    return "\n".join(
        html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
        for m in re.finditer(r'<[^>]*class="ln"[^>]*>(.*?)</', s, re.S)
    )


def cast_of(lesson: int):
    """Who the story is about. Characters may repeat between Form A and Form B —
    they are names, not vocabulary being measured.

    Two sources: capitalised names (Sam), and any content word the Form A story
    leans on three or more times. A word used that heavily is the subject of
    the story, not a word being tested — "pig" in Mud Pig appears five times.
    """
    fa = form_a(lesson)
    cast = {w.lower() for w in gates.character_names(fa)}
    words = [w for w in gates.bare_words(fa) if w not in gates.FUNCTION_WORDS]
    for w in set(words):
        if words.count(w) >= 3:
            cast.add(w)
    return cast


def run(lesson: int, text: str, verbose: bool = True):
    fa = form_a(lesson)
    cast = cast_of(lesson)
    res = gates.check(fa, text, lesson, characters=cast)
    q = quality.judge(text, lesson)
    res["results"].append(q)
    res["passed"] = res["passed"] and q["passed"]
    if verbose:
        print("Lesson %d  |  Form A cast: %s" % (lesson, ", ".join(sorted(cast)) or "none"))
        print(gates.report(res))
    return res


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    lesson = int(argv[0])
    if argv[1] == "--file":
        text = pathlib.Path(argv[2]).read_text()
    else:
        text = " ".join(argv[1:])
    return 0 if run(lesson, text)["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
