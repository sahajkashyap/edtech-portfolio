#!/usr/bin/env python3
"""Find, per lesson, the most story lines its reading page can hold.

A per-band constant forces the worst lesson in a band on every lesson in it.
When the picture came off the reading page the constants were left far too low,
and Lesson 45 split a nine-line story across two pages, leaving the first 40%
empty. Turning a page mid-story costs a child the thread, so it should happen
only when the story genuinely does not fit.

Approach from ABOVE. Start with a cap no page can meet, render, and shrink only
the lessons that overflow, by exactly as many lines as they overflowed by.
Repeat until nothing overflows.

Approaching from below does not work and the failure is instructive: measuring
a page that just fits suggests room to grow, filling it overflows, and the next
measurement shrinks it again -- the caps ping-pong and never settle. Shrinking
only is monotone, so it always terminates, and it stops at the true maximum
rather than somewhere safe below it.

Run:  python3 measure_capacity.py   -> writes page-capacity.json
"""

import json
import math
import pathlib
import subprocess
import sys

import build_sheet as B

HERE = pathlib.Path(__file__).parent
OUT = HERE / "page-capacity.json"
BUDGET = 940.8          # usable height of a letter page, in px
START = 26              # more lines than any story has, so nothing is capped
MAX_ROUNDS = 16


def write(caps):
    OUT.write_text(json.dumps(
        {"what": "story lines each lesson's reading page holds, found by "
                 "rendering and shrinking until nothing overflows",
         "budgetPx": BUDGET, "linesByLesson": caps}, indent=1) + "\n")


def main():
    lessons = {}
    for f in sorted((HERE / "passages").glob("lesson-*.json")):
        s = json.loads(f.read_text())
        lessons[s["lesson"]] = len(s["lines"])
    caps = {str(n): START for n in lessons}
    write(caps)

    for rnd in range(1, MAX_ROUNDS + 1):
        subprocess.run([sys.executable, "build_sheet.py", "--all"],
                       cwd=HERE, capture_output=True, check=True)
        # check_all exits non-zero when anything overflows, which is the
        # state this loop exists to work through -- so its status is ignored.
        subprocess.run([sys.executable, "check_all.py"],
                       cwd=HERE, capture_output=True)
        heights = json.loads((HERE / "page-check.json").read_text())
        shrunk = 0
        for n in lessons:
            rec = heights.get(f"lesson-{n:03d}")
            if not rec or 2 not in rec.get("overflowing", []):
                continue
            px, line_h = B.type_for(n)[0], B.type_for(n)[1]
            over = rec["heights"][1] - BUDGET
            drop = max(1, math.ceil(over / (px * line_h)))
            # Shrink from the lines ACTUALLY on the page, not from the cap. A
            # cap of 14 on an eight-line story does nothing until it falls
            # below eight, so subtracting from the cap burns rounds changing a
            # number with no effect -- which is exactly how the first version
            # ran out of rounds with 24 pages still overflowing.
            on_page = len(B.split_story(n, json.loads(
                (HERE / f"passages/lesson-{n:03d}.json").read_text())["lines"])[0])
            caps[str(n)] = max(4, on_page - drop)
            shrunk += 1
        write(caps)
        print(f"  round {rnd}: {shrunk} lesson(s) still overflowing")
        if not shrunk:
            break

    # a cap above the story's own length just means "never splits"
    effective = {n: min(caps[str(n)], lessons[n]) for n in lessons}
    v = sorted(effective.values())
    splits = sum(1 for n in lessons if lessons[n] > caps[str(n)])
    print(f"settled: lines per reading page min {v[0]}, median "
          f"{v[len(v)//2]}, max {v[-1]}; {splits} of {len(lessons)} stories "
          f"need a second reading page")


if __name__ == "__main__":
    sys.exit(main())
