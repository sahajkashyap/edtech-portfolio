#!/usr/bin/env python3
"""Does a six-year-old know this word?

The auditor already answers "can this be sounded out?". That is not the same
question, and the gap between them is where `cod` got in. A child can decode
`cod` perfectly at Lesson 18 and have no idea what it means — the word is
learned at age 11.5. For scale: dog 2.8, cat 3.7, pig 3.8, mud 4.1.

So this is the second gate. A word passes if:

  1. it is learned by age 6.0, or
  2. a person has explicitly approved it (APPROVED below), or
  3. it is a character's name.

Everything else is rejected, with the age shown so the reason is obvious.

WHERE THE AGES COME FROM. `aoa-lookup.csv` holds the age-of-acquisition rating
for the 1,269 words these stories actually use, from:

    Kuperman, V., Stadthagen-Gonzalez, H., & Brysbaert, M. (2012).
    Age-of-acquisition ratings for 30 thousand English words.
    Behavior Research Methods, 44(4), 978-990.

Only the subset we use is stored, not the 51,715-word source, which has no
clean redistribution licence. Individual ratings are facts; the database is
someone's work.
"""

import csv
import functools
import pathlib
import re

HERE = pathlib.Path(__file__).parent
LOOKUP = HERE / "aoa-lookup.csv"

# A six-year-old is the audience.
#
# One rating alone is not enough to judge on. Age-of-acquisition is adults
# recalling when they learned a word, which is fine for concrete nouns and
# unreliable for the abstract, high-frequency words a child uses daily without
# ever "learning" as vocabulary -- `then` is rated 6.7, `just` 7.0, `as` 6.1.
# No teacher would call those hard.
#
# So two signals. Dale-Chall is different evidence: it asks whether fourth
# graders actually know the word. A word passes on a strong signal (learned by
# six) or on two moderate ones (familiar to most fourth graders AND learned by
# about seven and a half). It fails if neither holds -- which is where `bog`,
# `yam`, `chum` and `hedge` sit, absent from the familiar list entirely -- or if
# it is simply learned far too late, like `cod` at 11.5.
MAX_AGE = 6.0
MAX_AGE_IF_FAMILIAR = 7.6

# Words above the line that a person has looked at and kept. Each needs a why:
# usually that the story or picture makes the meaning plain, which is exactly
# how published decodables handle their few hard words.
APPROVED = {
    "hen": "shown in the picture, and a staple of early readers",
    "hens": "as hen",
    "log": "shown in the picture; concrete and pointable-at",
    "logs": "as log",
    "pit": "used 26 times in UFLI's own passages at these lessons",
    "pits": "as pit",
    "den": "an animal's den; used 12 times in UFLI's passages",
    "dens": "as den",
    "cot": "used 7 times in UFLI's passages at this exact lesson",
    "cots": "as cot",
    "vet": "the story establishes it as the place a sick pet goes",
    "vets": "as vet",
    "net": "concrete, shown in the picture",
    "nets": "as net",
    "pond": "concrete and pointable-at; standard in early readers",
    "ponds": "as pond",
    "tin": "kept at one lesson only, where the story makes it a container",
    "shed": "shown in the picture",
    "sheds": "as shed",
}


@functools.lru_cache(maxsize=1)
def _table():
    """(age by word, words on the Dale-Chall familiar list)."""
    ages, known = {}, set()
    if not LOOKUP.exists():
        return ages, known
    for row in csv.DictReader(LOOKUP.open()):
        w = row["word"].strip().lower()
        if row.get("aoa"):
            try:
                ages[w] = float(row["aoa"])
            except ValueError:
                pass
        if row.get("dale_chall") == "yes":
            known.add(w)
    return ages, known


def _stems(word):
    """The word, then plausible base forms, so `cats` finds `cat`."""
    yield word
    for suf, repl in (("s", ""), ("es", ""), ("ies", "y"), ("ed", ""),
                      ("ed", "e"), ("ing", ""), ("ing", "e"), ("er", ""),
                      ("est", ""), ("ly", "")):
        if word.endswith(suf) and len(word) - len(suf) >= 2:
            yield word[: -len(suf)] + repl
    if len(word) > 3 and word[-1] == word[-2]:      # running -> run
        yield word[:-1]


def age_of(word):
    """Age this word is learned, or None if we have no rating for it.

    Takes the LOWEST rating across the word and its base forms. An inflection
    cannot really be learned later than its base -- a child who knows `tap`
    knows `taps` -- and where the data says otherwise it is usually a homograph
    catching the raters out. `taps` is rated 8.9 because they thought of
    faucets; `tap` is 5.8.
    """
    ages, _ = _table()
    found = [ages[f] for f in _stems(word.lower()) if f in ages]
    return min(found) if found else None


def is_familiar(word):
    """On the Dale-Chall list: known by 80% of US fourth graders."""
    _, known = _table()
    return any(form in known for form in _stems(word.lower()))


def check(word, names=()):
    """(ok, reason). Reason explains a rejection, or why it was let through."""
    w = word.lower().strip("'")
    if not w:
        return True, ""
    if w in {n.lower() for n in names}:
        return True, "a character's name"
    if w in APPROVED:
        return True, f"approved: {APPROVED[w]}"
    age = age_of(w)
    if age is None:
        return True, "no rating available"
    if age <= MAX_AGE:
        return True, f"learned by {age:.1f}"
    if is_familiar(w) and age <= MAX_AGE_IF_FAMILIAR:
        return True, f"rated {age:.1f} but familiar to most fourth graders"
    if is_familiar(w):
        return False, f"learned at age {age:.1f} — too late even though it is a familiar word"
    return False, f"learned at age {age:.1f}, and not a word most fourth graders know"


def scan(text, names=()):
    """Every word in the text a six-year-old would not know."""
    out = {}
    for w in re.findall(r"[a-z']+", text.lower()):
        ok, why = check(w, names)
        if not ok and w not in out:
            out[w] = why
    return out


if __name__ == "__main__":
    ages, dale = _table()
    print(f"{len(ages)} words rated, {len(dale)} on the Dale-Chall familiar list")
    print(f"cut-off: age {MAX_AGE}, plus {len(APPROVED)} approved by hand\n")
    for w in ("dog", "cat", "pig", "mud", "hat", "cod", "bog", "yam", "chum",
              "hedge", "kits", "colt", "spade", "hen"):
        ok, why = check(w)
        print(f"  {w:<7} {'pass' if ok else 'REJECT':<7} {why}")
