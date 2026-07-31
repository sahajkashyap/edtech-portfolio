#!/usr/bin/env python3
"""Catch heart words used before the lesson that teaches them.

Some words are letter-decodable and still wrong. "as" is a and s, which the
auditor happily approves from Lesson 3 -- but its s says /z/, so a child
applying the only s-sound they have been taught reads /ass/. The curriculum
knows this: it teaches "as" as a heart word at Lesson 11. Nothing consulted
that, so "as" sat in the Lesson 7 story and "is" in Lesson 8, on sheets that
print "nothing here needs guessing".

That sentence was false on exactly those sheets, which is why this exists.

A word listed in heartWordDetail is allowed at lesson n only if:
  * n has reached the lesson that teaches it as a heart word, or
  * every one of its parts has become regular by n -- at which point it is an
    ordinary word and needs no special permission.

Run:  python3 early_hearts.py
"""

import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).parent
SOUND_LIST = HERE / "sound-list.json"
_DETAIL = None


def detail():
    global _DETAIL
    if _DETAIL is None:
        _DETAIL = json.loads(SOUND_LIST.read_text()).get("heartWordDetail") or {}
    return _DETAIL


def allowed_from(word):
    """First lesson this word may be read, or None if it is not a heart word."""
    d = detail().get(word) or detail().get(word.capitalize())
    if not d:
        return None
    taught = d.get("lesson")
    regular = d.get("regularFrom") or []
    # regular everywhere -> an ordinary word from the last part to be taught
    if regular and all(isinstance(r, int) for r in regular):
        return min(taught, max(regular))
    return taught


def check(spec):
    n = spec.get("lesson")
    text = " ".join(spec.get("lines", [])) + " " + spec.get("title", "")
    out, seen = [], set()
    for w in re.findall(r"[A-Za-z']+", text):
        lw = w.lower()
        if lw in seen:
            continue
        seen.add(lw)
        first = allowed_from(lw)
        if first is not None and n < first:
            why = (detail().get(lw) or detail().get(lw.capitalize()) or {}).get("why", "")
            out.append(f"TOO EARLY {lw!r} — a heart word not taught until Lesson "
                       f"{first} ({why}). Sounding it out with what has been "
                       f"taught by Lesson {n} gives the wrong word.")
    return out


if __name__ == "__main__":
    total = 0
    for f in sorted((HERE / "passages").glob("lesson-*.json")):
        spec = json.loads(f.read_text())
        for p in check(spec):
            total += 1
            print(f"L{spec['lesson']}: {p}")
    print(f"\n{total} heart words used before they are taught")
    sys.exit(1 if total else 0)
