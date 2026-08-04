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
import age_gate                   # noqa: E402


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

    Capitalised names ONLY. An earlier version also promoted any content word
    Form A used three or more times, on the theory that a heavily-repeated word
    is the subject rather than a word under test. The fourth audit showed that
    reasoning backwards: Form A correctly leans on the grapheme the lesson
    teaches, so the rule exempted `quit`, `yaps`, `van`, `zip`, `hen`, `box`,
    `nut` and `cup` — the exact words being measured. Gate 3 had been widened
    until it could not fail.
    """
    return {w.lower() for w in gates.character_names(form_a(lesson))}


def run(lesson: int, text: str, verbose: bool = True, title: str = ''):
    fa = form_a(lesson)
    cast = cast_of(lesson)
    res = gates.check(fa, text, lesson, characters=cast)
    q = quality.judge(text, lesson)
    a = age_gate.judge(text, lesson, characters=cast)
    res["results"] += [q, a]
    res["passed"] = res["passed"] and q["passed"] and a["passed"]
    if title:
        t1 = gates.gate1_decodable(title, lesson)
        t5 = age_gate.judge(title + ".", lesson, characters=cast)
        ok = t1["passed"] and t5["passed"] and "'" not in title
        res["results"].append({
            "gate": "6 title", "passed": ok,
            "detail": "title is decodable and known" if ok else
                      ("apostrophe not taught here" if "'" in title else
                       (t1["detail"] if not t1["passed"] else t5["detail"]))})
        res["passed"] = res["passed"] and ok
    if verbose:
        print("Lesson %d  |  Form A cast: %s" % (lesson, ", ".join(sorted(cast)) or "none"))
        print(gates.report(res))
    return res


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 2
    lesson = int(argv[0])
    title = ""
    if "--title" in argv:
        i = argv.index("--title"); title = argv[i + 1]; argv = argv[:i] + argv[i + 2:]
    if argv[1] == "--file":
        text = pathlib.Path(argv[2]).read_text()
    else:
        text = " ".join(argv[1:])
    return 0 if run(lesson, text, title=title)["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
