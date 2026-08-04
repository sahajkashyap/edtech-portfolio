#!/usr/bin/env python3
"""Make index.html's LESSONS block a DERIVED artefact of formb/data/.

The problem this closes
-----------------------
The 36 JSON files in formb/data/ and the `const LESSONS = {...}` object baked
into index.html held the same content twice, maintained by hand, with nothing
comparing them. A fix applied to one side and not the other was invisible: the
gates only ever read data/, and the child only ever reads index.html. That is a
silent-divergence bug waiting to happen, and it is the kind of bug an audit
finds only by accident.

There is exactly one source of truth now — formb/data/*.json — and index.html
is generated from it.

    python3 sync_index.py            # CHECK: exit 1 if index.html has drifted
    python3 sync_index.py --write    # regenerate the LESSONS block in place

verify_all.py runs the check, so drift can no longer ship quietly.

The generated block is byte-identical in shape to what was there before
(json.dumps(indent=1, ensure_ascii=False)), so `--write` produces no cosmetic
churn — only real content changes show up in a diff.
"""

import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE / "data"
INDEX = HERE.parent / "index.html"

OPEN = "const LESSONS = {"
CLOSE = "\n};"


def lesson_files():
    return sorted(DATA.glob("lesson-*.json"), key=lambda p: int(p.stem.split("-")[1]))


def entry(d: dict) -> dict:
    """One lesson, in the shape index.html's renderer expects.

    Word lists become labelled groups; a group with nothing in it is dropped
    rather than printed as an empty heading, which is why lessons with no
    nonsense-word subtest show three groups instead of four.
    """
    if d["instrument"] == "word list":
        groups = []
        for label, key in (("Real words", "real_words"),
                           ("Nonsense words", "nonsense_words"),
                           ("Heart words", "high_frequency"),
                           ("Sentences", "sentences")):
            if d.get(key):
                groups.append([label, list(d[key])])
        out = {"skill": d["skill"], "title": "Word list",
               "kind": "wordlist", "groups": groups}
        # The teacher has to be told WHY a subtest is absent, or the omission
        # reads as a bug in the tool. This note lived only in the JSON and was
        # never carried to the screen.
        if d.get("nwf_note"):
            out["note"] = d["nwf_note"]
        return out
    return {"skill": d["skill"], "title": d["title"],
            "kind": "passage", "lines": list(d["lines"])}


def build() -> str:
    lessons = {}
    for p in lesson_files():
        d = json.loads(p.read_text())
        lessons[str(d["lesson"])] = entry(d)
    return json.dumps(lessons, indent=1, ensure_ascii=False)


def current(html: str) -> str:
    i = html.index(OPEN)
    j = html.index(CLOSE, i)
    return html[i + len("const LESSONS = "):j + 2]


def main(argv):
    html = INDEX.read_text()
    have, want = current(html), build()
    if "--write" in argv:
        if have == want:
            print("index.html LESSONS already matches data/ — nothing to write.")
            return 0
        i = html.index(OPEN)
        j = html.index(CLOSE, i)
        INDEX.write_text(html[:i + len("const LESSONS = ")] + want + html[j + 2:])
        print("index.html LESSONS regenerated from formb/data/.")
        return 0

    if have == want:
        print("index.html LESSONS matches formb/data/ exactly.")
        return 0

    print("DRIFT: index.html no longer matches formb/data/.")
    a, b = json.loads(have), json.loads(want)
    for k in sorted(set(a) | set(b), key=lambda s: int(s)):
        if k not in a:
            print("  L%s missing from index.html" % k)
        elif k not in b:
            print("  L%s in index.html but has no data file" % k)
        elif a[k] != b[k]:
            for f in sorted(set(a[k]) | set(b[k])):
                if a[k].get(f) != b[k].get(f):
                    print("  L%s field %r:\n     index.html: %r\n     data/    : %r"
                          % (k, f, a[k].get(f), b[k].get(f)))
    print("\nFix with:  python3 sync_index.py --write")
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
