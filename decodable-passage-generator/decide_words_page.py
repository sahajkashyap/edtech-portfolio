#!/usr/bin/env python3
"""Decide which lessons need their warm-up words on a page of their own.

The story is never broken across pages -- a child should meet it as one whole
thing, and turning a page mid-story costs them the thread. Every story fits on
a page by itself. What does not always fit is the story WITH the warm-up strip
and heart-word cards above it.

So the story never gives way; the furniture does. This renders every sheet with
the warm-up sharing the story's page, finds the ones that overflow, and moves
those lessons' warm-up onto its own page. Then it renders again to confirm.

Run:  python3 decide_words_page.py   -> writes words-page.json
"""

import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).parent
OUT = HERE / "words-page.json"


def write(lessons):
    OUT.write_text(json.dumps(
        {"what": "lessons whose warm-up words and heart cards need a page of "
                 "their own, because they do not fit above the story",
         "lessons": sorted(lessons)}, indent=1) + "\n")


def render():
    subprocess.run([sys.executable, "build_sheet.py", "--all"],
                   cwd=HERE, capture_output=True, check=True)
    # check_all exits non-zero when anything overflows, which is the state
    # this is looking for, so its status is ignored.
    subprocess.run([sys.executable, "check_all.py"], cwd=HERE,
                   capture_output=True)
    return json.loads((HERE / "page-check.json").read_text())


def main():
    lessons = set()
    write(lessons)
    for rnd in (1, 2, 3):
        heights = render()
        moved = 0
        for key, rec in heights.items():
            n = int(key.split("-")[1])
            over = rec.get("overflowing") or []
            # page 2 is the reading page while the warm-up shares it
            if 2 in over and n not in lessons:
                lessons.add(n)
                moved += 1
        write(lessons)
        still = sum(len(r.get("overflowing") or []) for r in heights.values())
        print(f"  round {rnd}: {moved} lesson(s) moved to a words page; "
              f"{still} page(s) were overflowing")
        if not moved:
            break
    print(f"settled: {len(lessons)} of 123 lessons need a separate words page")


if __name__ == "__main__":
    sys.exit(main())
