#!/usr/bin/env python3
"""Catch words where sounding out correctly produces the WRONG word.

This is the cruellest failure a decodable can contain. A child taught that ea
says /ee/ meets "read" in the past tense, applies the rule they were taught,
says /reed/, and is corrected. They did everything right. Nothing in the two
existing gates can see this: the word is decodable and a six-year-old knows it.
Only the *sense used here* is unreachable.

Found by reading all 123 stories aloud. Six were live at the time -- "read"
twice, "close" twice, "live" twice -- and every one of them sat in a lesson
that had just taught the rule that mislead the child.

A word on this list is refused unless APPROVED says which sense is meant and
why sounding it out lands on that sense rather than the other one.

Run:  python3 homographs.py
"""

import json
import pathlib
import re
import sys

# word -> what a child produces by rule, and why that is the wrong word
RISKY = {
    # Only the bare form traps. "reads" is always /reedz/ -- there is no past
    # tense spelled that way -- so it is safe and deliberately not listed.
    "read": "taught ea = /ee/, so the past tense reads as /reed/",
    "close": "taught magic e, so it reads as /klohz/ when /klohs/ is meant",
    "live": "taught magic e, so it reads as /lyve/ when /liv/ is meant",
    "lives": "as live -- and /lyvz/ is itself a word, so nothing feels wrong",
    "lead": "reads as /leed/ when the metal /led/ is meant",
    "bow": "ow says two sounds; /boh/ and /bow/ are different words",
    "bows": "as bow",
    "sow": "as bow",
    "row": "as bow",
    "dove": "taught magic e, so the bird reads as /dohv/",
    "wound": "ou; the injury and the winding are different words",
    "minute": "the sixty seconds and the tiny thing are different words",
    "use": "the noun /yoos/ and the verb /yooz/ end differently",
    "present": "stress moves; the gift and the verb are different words",
    "record": "as present",
    "object": "as present",
    "subject": "as present",
    "desert": "as present -- and the other one is a different word entirely",
    "content": "as present",
    "refuse": "as present",
    "produce": "as present",
    "bass": "the fish and the sound are spelled the same",
}

# Where the word is fine, and why sounding it out reaches the right sense.
APPROVED = {
    "wind": "the breeze. Short i is what the rules give and it is correct; "
            "only the winding-up sense would mislead, and it is not used here",
    "winds": "as wind",
    "does": "a heart word, learned whole. The deer would be /dohz/, but the "
            "verb is the only sense a child meets at this age",
    "tear": "a rip, at the lesson that teaches ear saying /air/. The rule the "
            "child has just been taught gives exactly the right sound here",
    "tears": "as tear",
}


def check(spec):
    """Problems with this passage's homographs. Empty list means fine."""
    text = " ".join(spec.get("lines", [])) + " " + spec.get("title", "")
    words = {w.lower() for w in re.findall(r"[A-Za-z']+", text)}
    out = []
    for w in sorted(words & set(RISKY)):
        if w in APPROVED:
            continue
        out.append(f"HOMOGRAPH {w!r} — {RISKY[w]}. Sounding it out correctly "
                   f"gives the wrong word, so the child is right and still "
                   f"told they are wrong. Use a different word.")
    return out


if __name__ == "__main__":
    total = 0
    for f in sorted(pathlib.Path("passages").glob("*.json")):
        spec = json.loads(f.read_text())
        for p in check(spec):
            total += 1
            print(f"L{spec['lesson']}: {p}")
    print(f"\n{total} misleading homographs across the passages")
    sys.exit(1 if total else 0)
