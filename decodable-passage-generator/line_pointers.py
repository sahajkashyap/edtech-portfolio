#!/usr/bin/env python3
"""Check that an answer note pointing at "line four" points at the right one.

Answer notes tell a parent where to find the answer. Rewriting a story moves
every line, and nothing noticed: after the Lesson 91 rewrite its note still
said "three days" was in line two, which by then read "He built a bird from
the sticks and glue". A parent following that reads the wrong line aloud.

The test is that the words of the answer appear on the line it names. Notes
that cannot work that way -- open ones ("Either.") and definition questions,
which paraphrase on purpose -- are exempt rather than flagged.

Run:  python3 line_pointers.py
"""

import json
import pathlib
import re
import sys
ORD = {w: i+1 for i, w in enumerate(
    "one two three four five six seven eight nine ten eleven twelve "
    "thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split())}
ORD.update({w: i+1 for i, w in enumerate(
    "first second third fourth fifth sixth seventh eighth ninth tenth".split())})
# Number words are NOT noise here -- "Ten." is the whole answer at Lesson 20.
STOP = set("the a an it is in of and to that this they them he she her his i you "
           "was were are be been for on at as with says say said it's its there "
           "here have has had do does did line lines their your my me not but "
           "so then than which what who how why when where all any".split())

def nums(tok):
    tok = tok.lower()
    return ORD.get(tok) or (int(tok) if tok.isdigit() else None)

CITE = re.compile(
    r"\blines?\s+(\w+)(?:\s*(?:and|to|,|through)\s*(\w+))?|\bthe\s+(\w+)\s+line\b", re.I)

def cited(note):
    """Every line number an answer note points at, ranges expanded."""
    out = set()
    for m in CITE.finditer(note):
        a = nums(m.group(1) or m.group(3) or "")
        b = nums(m.group(2) or "")
        if not a:
            continue
        if b and b >= a:
            out.update(range(a, b + 1))
        else:
            out.add(a)
    return out

def content(text):
    return {w for w in re.findall(r"[a-z']+", text.lower())
            if w not in STOP and len(w) > 1}

def check(spec):
    bad = []
    for qi, q in enumerate(spec["questions"], 1):
        note = q["listenFor"]
        ls = cited(note)
        # strip the pointer itself, or "line four" matches the word "four"
        note = CITE.sub(" ", note)
        if not ls:
            continue
        over = [k for k in ls if k > len(spec["lines"])]
        if over:
            bad.append(f"Q{qi} points at line {over[0]}, but the story has "
                       f"{len(spec['lines'])} lines")
            continue
        # the words of the answer should actually be on the line it names
        said = content(note) - content(" ".join(
            spec["lines"][k-1] for k in ls))
        # Only a note that ASSERTS A FACT can be checked this way. An open
        # note ("Either." / "Any idea.") cites lines as reference, and a
        # definition question paraphrases on purpose -- neither shares words
        # with the line by design, so both are exempt rather than flagged.
        if re.match(r"\s*(any|either|both|some|their own|no right|whatever)\b",
                    q["listenFor"], re.I):
            continue
        if re.search(r"\bmean\b|what does|what is a\b|\blook like\b|which part|"
                     r"what would you|have you ever", q["ask"], re.I):
            continue
        overlap = content(CITE.sub(" ", q["listenFor"])) & content(
            " ".join(spec["lines"][k-1] for k in ls))
        if not overlap:
            bad.append(f"Q{qi} points at line {sorted(ls)} but none of the "
                       f"answer's words are on it: {note[:60]}")
    return bad

if __name__ == "__main__":
    tot = 0
    for f in sorted(pathlib.Path("passages").glob("*.json")):
        s = json.loads(f.read_text())
        for b in check(s):
            tot += 1; print(f"L{s['lesson']}: {b}")
    print(f"\n{tot} answer notes point at a line that does not support them")
