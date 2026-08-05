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
CLAIM_OPEN = "const WORDLIST_CLAIM = "
CLAIM_CLOSE = ";"


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
        # rejected_pseudowords is examiner-only and must NEVER reach the page.
        #
        # scoring_note joins it here. A word list's sentences carry the same
        # uncontracted forms the passages do, so the examiner needs the same
        # warning; carrying only ONE of the two notes would silently drop
        # whichever came second. The scoring warning goes FIRST because it is
        # the one that is acted on while the child is reading — the subtest
        # note is read once, at the top of the lesson.
        # supply_note was the THIRD field with this same bug. Lesson 7 teaches
        # f /f/ and ships no f word; supply_note is the only thing that explains
        # why, and it reached nobody. An unexplained gap in an assessment reads
        # as a broken tool, and the teacher's next move is to distrust the
        # score rather than the curriculum that caused it.
        #
        # Ordered by when the examiner needs it: the scoring warning is acted on
        # while the child reads, the other two are read once at the top.
        notes = [n for n in (d.get("scoring_note"), d.get("nwf_note"),
                             d.get("supply_note")) if n]
        if notes:
            out["note"] = "\n\n".join(notes)
        # instrument_claim is deliberately NOT here. It is the same 261
        # characters on all nine word lists, because it describes the
        # INSTRUMENT, not the lesson. Repeating it per lesson is what pushed
        # every word list over the note-length bar, and prose an examiner has
        # already read eight times is prose they stop reading. It renders once,
        # as standing copy, from WORDLIST_CLAIM below.
        return out
    out = {"skill": d["skill"], "title": d["title"],
           "kind": "passage", "lines": list(d["lines"])}
    # Same failure as nwf_note above, one field over: scoring_note lived only
    # in the JSON and never reached the screen, so on every passage lesson the
    # teacher panel was empty. That note is the ONLY thing telling the examiner
    # not to score "don't" for "do not" as a substitution -- without it the
    # instrument marks down the child who is reading for meaning. It is carried
    # only on the passages that actually contain a contractible form; the other
    # ten carried it as boilerplate and now carry nothing.
    if d.get("scoring_note"):
        out["note"] = d["scoring_note"]
    return out


def build() -> str:
    lessons = {}
    for p in lesson_files():
        d = json.loads(p.read_text())
        lessons[str(d["lesson"])] = entry(d)
    return json.dumps(lessons, indent=1, ensure_ascii=False)


def build_claim() -> str:
    """The one instrument_claim shared by every word list, as a JS string.

    Stating it once is only honest if the nine files actually agree. If they
    ever diverge, printing one of them as though it spoke for all nine would
    quietly attach the wrong claim to a score -- so this refuses instead.
    """
    claims = {}
    for p in lesson_files():
        d = json.loads(p.read_text())
        if d["instrument"] == "word list" and d.get("instrument_claim"):
            claims.setdefault(d["instrument_claim"].strip(), []).append(d["lesson"])
    if not claims:
        return '""'
    if len(claims) > 1:
        raise SystemExit(
            "REFUSED: the word lists no longer share one instrument_claim, so "
            "it cannot be stated once for all of them:\n" + "\n".join(
                "  L%s: %.70s..." % (",".join(str(n) for n in sorted(ls)), c)
                for c, ls in claims.items()))
    return json.dumps(next(iter(claims)), ensure_ascii=False)


def current(html: str) -> str:
    i = html.index(OPEN)
    j = html.index(CLOSE, i)
    return html[i + len("const LESSONS = "):j + 2]


def current_claim(html: str) -> str:
    i = html.index(CLAIM_OPEN)
    j = html.index(CLAIM_CLOSE, i)
    return html[i + len(CLAIM_OPEN):j]


def write_claim(html: str, want: str) -> str:
    i = html.index(CLAIM_OPEN)
    j = html.index(CLAIM_CLOSE, i)
    return html[:i + len(CLAIM_OPEN)] + want + html[j:]


def main(argv):
    html = INDEX.read_text()
    have, want = current(html), build()
    have_claim, want_claim = current_claim(html), build_claim()
    if "--write" in argv:
        if have == want and have_claim == want_claim:
            print("index.html already matches data/ — nothing to write.")
            return 0
        if have_claim != want_claim:
            html = write_claim(html, want_claim)
        if have != want:
            i = html.index(OPEN)
            j = html.index(CLOSE, i)
            html = html[:i + len("const LESSONS = ")] + want + html[j + 2:]
        INDEX.write_text(html)
        print("index.html regenerated from formb/data/ (LESSONS%s)."
              % ("" if have_claim == want_claim else " and WORDLIST_CLAIM"))
        return 0

    if have_claim != want_claim:
        print("DRIFT: index.html's WORDLIST_CLAIM no longer matches formb/data/.")
        print("  index.html: %s" % have_claim[:90])
        print("  data/     : %s" % want_claim[:90])
        print("\nFix with:  python3 sync_index.py --write")
        return 1

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
