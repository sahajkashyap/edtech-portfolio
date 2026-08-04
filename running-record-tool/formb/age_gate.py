"""Gate 5 — words a child can sound out AND actually knows.

The project's own standing rule: decodable does not mean understood. The
generator already had `word_age.py` for this, and Form B was built without ever
calling it — which is how `nip` (learned at 7.9), `hut` (8.1) and `jogs` (6.2)
reached assessment texts for five-year-olds.

It also checks `core_vocabulary.BLOCKED`, the list of words never to put in
front of a child. `build_wordlists.py` checked BLOCKED for word lists; nothing
checked it for passages, which is how "A fat bug pops up!" got published.
"""
import sys, pathlib
HERE = pathlib.Path(__file__).resolve().parent
GENERATOR = HERE.parents[1] / "decodable-passage-generator"
sys.path.insert(0, str(GENERATOR))
import word_age                       # noqa: E402
import core_vocabulary as cv          # noqa: E402
import gates                          # noqa: E402

BLOCKED = {w.lower() for w in cv.BLOCKED}


def judge(text: str, lesson: int, characters=frozenset()) -> dict:
    names = tuple(sorted({c.lower() for c in characters} |
                         {n.lower() for n in gates.character_names(text)}))
    problems = []

    blocked_hits = sorted({w for w in gates.bare_words(text) if w in BLOCKED})
    if blocked_hits:
        problems.append("on the BLOCKED list: " + ", ".join(blocked_hits))

    try:
        bad = word_age.scan(text, names=names)
    except Exception as e:                       # never let the gate crash open
        return {"gate": "5 age + blocked", "passed": False,
                "detail": "age check failed to run: %s" % e}

    # word_age.scan returns whatever it flags; normalise to (word, reason)
    flagged = []
    for item in (bad or []):
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            flagged.append("%s (%s)" % (item[0], item[1]))
        else:
            flagged.append(str(item))
    if flagged:
        problems.append("too late for K-2: " + "; ".join(flagged[:8]))

    return {"gate": "5 age + blocked", "passed": not problems,
            "detail": "every word known by K-2 and none blocked" if not problems
                      else "; ".join(problems)}
