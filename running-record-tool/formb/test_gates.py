"""Prove the gates can refuse.

A quality gate that has never rejected anything is decoration, not a gate. So
before generating a single real assessment passage, each gate is handed a
passage built to break it, and must catch its own failure.

SCOPE WARNING — this file covers gates 1, 2 and 3 only, using a hand-written
Form A that is NOT the real Lesson 41 sheet. It therefore proves nothing about
gate 4 (story quality), gate 5 (age + blocked) or gate 6 (title), and nothing
about production data. Four of gate 2's five sub-metrics are untested here too.
Reading this file as "the gates are proven" is exactly how a gate stayed
decoration for four audits.

The complete falsification harness — every gate, every sub-check, against the
real Form A — lives in verify_all.py section 8. Run that:

    python3 verify_all.py
"""

import pathlib

import gates

HERE = pathlib.Path(__file__).resolve().parent

LESSON = 41

# Form A — the published parent sheet, Lesson 41 "Mud Pig"
FORM_A = """Sam has a big pig and a red tub.
The pig naps in the hot sun.
It gets up and runs to the mud.
"Not the mud!" said Sam.
Sam gets the tub and a big rag.
He rubs and rubs. The pig sits in it.
The pig is wet. Sam is wet!
"You can nap in the sun," said Sam."""

# Form B — same world, different story. Should clear all three gates.
FORM_B = """Sam let the pig dig in a pit.
The pig got a bug on its leg.
Sam ran and fed the pig a fig.
"Bad pig!" said Sam.
The pig hid in a bin of jam.
Sam had to tug and tug.
Sam did not win. Sam is sad.
"Hop up, pig," said Sam."""

# Deliberately broken, one per gate.
BAD_DECODABLE = """Sam and the pig ate a green cake.
The pig made a huge mess in the shade.
"Please stop," said Sam. He got a broom.
The pig ate more cake and smiled at Sam.
Sam and the pig sat by the lake.
They were happy in the bright sun.
The cake was gone. The pig slept.
"Good night," said Sam."""

BAD_LENGTH = """Sam let the pig dig."""

BAD_OVERLAP = """Sam has a big pig and a red tub.
The pig naps in the hot sun and runs.
Sam gets the tub and a big rag.
"Not the mud!" said Sam.
The pig sits and rubs in the mud.
Sam gets up. The pig is wet.
The pig naps. Sam gets the rag.
"You can nap," said Sam."""

CAST = {"sam", "pig"}   # the cast is declared, not guessed

CASES = [
    ("Form B — same world, new story", FORM_B, True,  None),
    ("Broken: untaught sounds",        BAD_DECODABLE, False, "1 decodable"),
    ("Broken: far too short",          BAD_LENGTH,    False, "2 equivalent"),
    ("Broken: reuses Form A's words",  BAD_OVERLAP,   False, "3 distinct"),
]


def sense_and_signoff_checks():
    """Two rules that replaced blanket ones, proved able to refuse.

    A conditional check is only a safe replacement for a blanket check if it
    still says no to the thing the blanket one existed for. Both of these
    replaced a rule that fired on everything, so both are tested here against
    a corpus built to violate them.
    """
    import audit_child as A
    out = []

    fox = {"lesson": 40, "instrument": "passage", "title": "The Fox Den",
           "lines": ["\"A fox has cubs in a den,\" said Dad."]}
    room = {"lesson": 22, "instrument": "passage", "title": "In the Den",
            "lines": ["Mom naps in the den."]}
    clean = {"lesson": 22, "instrument": "passage", "title": "Bugs",
             "lines": ["Mom naps in the sun."]}

    def senses(docs):
        hits = []
        A.corpus_checks(docs, lambda s, c, i, w, l, t: hits.append((c, i)))
        return [h for h in hits if h == ("polysemy", "den")]

    if not senses([fox, room]):
        out.append("SENSE_KEYS no longer catches 'den' in two senses — the "
                   "hand-written blanket rule must not have been removed")
    if senses([fox, clean]):
        out.append("SENSE_KEYS flags 'den' when only the fox sense is present")

    saved = dict(A.ACCEPTED)
    try:
        A.ACCEPTED["99:topics:nothing"] = "signs off a finding that cannot occur"
        A.audit(sorted((HERE / "data").glob("lesson-*.json")))
        if "99:topics:nothing" not in A.dead_signoffs():
            out.append("dead_signoffs() did not notice a sign-off that "
                       "matched nothing")
    finally:
        A.ACCEPTED.clear()
        A.ACCEPTED.update(saved)
    return out


def main():
    print("Form A: %d words\n" % gates.profile(FORM_A, LESSON)["total_words"])
    failures = sense_and_signoff_checks()
    for f in failures:
        print("  FAIL  %s" % f)
    if not failures:
        print("  ok    SENSE_KEYS refuses two senses of 'den' and passes one")
        print("  ok    dead_signoffs() catches a sign-off that silences nothing\n")
    for title, text, should_pass, should_trip in CASES:
        res = gates.check(FORM_A, text, LESSON, characters=CAST)
        print(gates.report(res, title))
        if res["passed"] != should_pass:
            failures.append("%s: expected %s" %
                            (title, "PUBLISH" if should_pass else "REFUSED"))
        if should_trip:
            tripped = [r["gate"] for r in res["results"] if not r["passed"]]
            if should_trip not in tripped:
                failures.append("%s: expected gate %s to catch it, caught %s"
                                % (title, should_trip, tripped or "nothing"))
        print()

    print("-" * 62)
    if failures:
        print("TEST FAILED")
        for f in failures:
            print("  " + f)
        return 1
    print("ALL GATES BEHAVE: the good passage publishes, and each broken one")
    print("is caught by the gate built to catch it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
