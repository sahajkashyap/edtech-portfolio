"""Prove the gates can refuse.

A quality gate that has never rejected anything is decoration, not a gate. So
before generating a single real assessment passage, each gate is handed a
passage built to break it, and must catch its own failure.
"""

import gates

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


def main():
    print("Form A: %d words\n" % gates.profile(FORM_A, LESSON)["total_words"])
    failures = []
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
