#!/usr/bin/env python3
"""Check a passage word by word against the sound list for a given lesson.

This is the mechanical half of the auditor. It does not write passages and has
no opinion about them — it only reports what a child at lesson N could not read.

Deliberately strict: when it cannot prove a word is safe, it reports it. A false
alarm costs a rewrite; a miss puts an unreadable word in a child's hands.

Run:  python3 audit_passage.py 41 "Sam has a pig. The pig is big."
      python3 audit_passage.py 41 --file passage.txt
      python3 audit_passage.py 41 --html example-lesson-41.html
      python3 audit_passage.py --selftest

Exit codes: 0 clean, 1 violations found, 2 bad usage.

REVISION HISTORY — every rule below was added because an adversarial agent
found a word that slipped past the previous version. See selftest() for the
cases; they are regression tests, not examples.
"""

import json
import pathlib
import re
import sys

VOWELS = set("aeiou")
SOUND_LIST = pathlib.Path(__file__).parent / "sound-list.json"

# Digraphs that act as ONE consonant unit, so they never count as a blend.
CONSONANT_DIGRAPHS = ["tch", "dge", "sh", "th", "ch", "wh", "ph", "ng", "nk",
                      "ck", "kn", "wr", "gn", "qu", "ff", "ll", "ss", "zz"]

# Multisyllable reading is explicitly taught at Lesson 66 (Closed & Open
# Syllables). Before that a passage must stay to one syllable per word --
# this single rule is what stops "picnic", "basket", "rabbit" and "little"
# from being called readable at Lesson 41.
MULTISYLLABLE_LESSON = 66

# y only says its consonant sound (yes, yum) at Lesson 30. y as a VOWEL --
# long i in "my" (73) and long e in "happy" (74) -- comes much later. Before
# 73, y is therefore only legal as the first letter of a word.
Y_AS_VOWEL_LESSON = 73

# Soft c and soft g (c/g before e, i or y) are only taught at Lesson 117,
# except word-final _ce / _ge which arrive at 60 / 61.
SOFT_C_G_LESSON = 117
FINAL_CE_LESSON = 60
FINAL_GE_LESSON = 61

# g before e/i/y is soft only *sometimes* — "gem" is soft, "get" is hard. There
# is no rule, only a word list. These are the hard-g words a K-2 decodable would
# realistically use; flagging them was a false alarm that failed a passage the
# teacher had already approved. c before e/i/y is near-always soft, so c needs
# no such list.
HARD_G_WORDS = {
    "get", "gets", "getting", "give", "gives", "given", "girl", "girls",
    "gift", "gifts", "gill", "gig", "giggle", "giggles", "gear", "geese",
    "geck", "tiger", "tigers", "begin", "begins", "forget", "forgets",
    "target", "targets", "anger", "finger", "fingers", "longer", "bigger",
    "digger", "gully", "guess", "guest",
}

_CACHE = {}


def load_doc() -> dict:
    if "doc" not in _CACHE:
        _CACHE["doc"] = json.loads(SOUND_LIST.read_text())
    return _CACHE["doc"]


def load(lesson: int) -> dict:
    doc = load_doc()
    if not 1 <= lesson <= doc["totalLessons"]:
        raise SystemExit(f"Lesson must be 1-{doc['totalLessons']}, got {lesson}")
    return doc["lessons"][lesson - 1]


def words_of(text: str):
    for token in re.findall(r"[A-Za-z']+", text):
        yield token, token.lower().replace("'", "")


def strip_suffix(word: str, allowed_suffixes):
    """Peel one taught suffix so the root can be judged on its own.

    Only peels when the result still looks like a word. Never peels an -s that
    is part of the root (bus, gas, lens): those keep their final cluster and
    get judged on it.
    """
    for suf in sorted((s.lstrip("-") for s in allowed_suffixes), key=len, reverse=True):
        if not suf or not word.endswith(suf):
            continue
        root = word[: -len(suf)]
        if len(root) < 2 or not any(c in VOWELS or c == "y" for c in root):
            continue
        # A plural -s never follows another s/x/z, and never follows a
        # consonant cluster (bus, lens, gas keep their s).
        if suf == "s":
            if root[-1] in "sxz":
                continue
            if len(root) >= 2 and root[-1] not in VOWELS and root[-2] not in VOWELS:
                continue
        return root, suf
    return word, None


def syllable_count(root: str) -> int:
    """Rough count: vowel groups, minus a silent final e, plus a final -le."""
    w = root
    groups = len(re.findall(r"[aeiouy]+", w))
    if w.endswith("e") and len(w) > 2 and w[-2] not in VOWELS:
        groups -= 1                       # silent e
        if w.endswith("le") and w[-3:-2] not in VOWELS:
            groups += 1                   # ... unless it is a -le syllable
    return max(groups, 1)


def mask_digraphs(root: str) -> str:
    masked = root
    for d in CONSONANT_DIGRAPHS:
        masked = masked.replace(d, "#")
    return masked


def consonant_clusters(root: str):
    """Every maximal consonant run in the word, not just the two at the edges."""
    masked = mask_digraphs(root)
    return [len(run) for run in re.findall(r"[^aeiouy]+", masked) if run]


def scan_untaught_pattern(word: str, taught_at: dict, lesson: int):
    """Longest-match scan for a spelling the child has not met yet.

    Longest-match matters: 'night' contains 'gh', but the real grapheme there
    is 'igh'. Flagging the shorter one would forbid the very words Lesson 87
    exists to teach.
    """
    patterns_by_len = sorted(taught_at, key=len, reverse=True)
    i = 0
    while i < len(word):
        for p in patterns_by_len:
            if word.startswith(p, i):
                if taught_at[p] > lesson:
                    return p, taught_at[p]
                i += len(p)               # taught: consume it and move on
                break
        else:
            i += 1
    return None, None


def audit(text: str, lesson: int):
    L = load(lesson)
    doc = load_doc()
    taught_at = doc["letterPatternTaughtAt"]

    allowed = set(L["allowedGraphemes"])
    hearts = {w.lower() for w in L["allowedHeartWords"]}
    patterns = set(L["allowedPatterns"])
    single_letters = {g for g in allowed if len(g) == 1}

    violations, checked = [], 0

    for original, bare in words_of(text):
        if not bare:
            continue
        checked += 1
        if bare in hearts:                # heart words are exempt by definition
            continue

        def flag(reason, detail):
            violations.append({"word": original, "reason": reason, "detail": detail})

        # 1. a multi-letter spelling the child has not met yet
        hit, when = scan_untaught_pattern(bare, taught_at, lesson)
        if hit:
            flag("untaught letter pattern",
                 f"contains '{hit}', not taught until Lesson {when}")
            continue

        root, _ = strip_suffix(bare, L["allowedSuffixes"])

        # 2. a plain letter the child has not met yet
        unknown = sorted({ch for ch in root if ch not in single_letters})
        if unknown:
            flag("untaught letter", f"uses {', '.join(repr(c) for c in unknown)}")
            continue

        # 3. more than one syllable before syllable division is taught
        if lesson < MULTISYLLABLE_LESSON:
            n = syllable_count(root)
            if n > 1:
                flag("too many syllables",
                     f"'{root}' has {n} syllables; splitting words starts at "
                     f"Lesson {MULTISYLLABLE_LESSON}")
                continue

        # 3b. y used as a vowel before that is taught
        if lesson < Y_AS_VOWEL_LESSON and "y" in root[1:]:
            flag("y as a vowel",
                 f"'{root}' uses y as a vowel; that starts at Lesson "
                 f"{Y_AS_VOWEL_LESSON}. Before then y only says /y/ at the "
                 f"start of a word.")
            continue

        # 3c. two vowels side by side that are not a taught vowel team.
        # Catches 'lion', 'dial', 'bias' -- two syllables that the vowel-group
        # counter reads as one, and vowel pairs no lesson ever teaches.
        bad_pair = None
        for run in re.findall(r"[aeiou]{2,}", root):
            taught_here = taught_at.get(run)
            if taught_here is None or taught_here > lesson:
                bad_pair = (run, taught_here)
                break
        if bad_pair:
            run, when = bad_pair
            detail = (f"'{run}' is not a vowel team taught by Lesson {lesson}"
                      if when is None else
                      f"'{run}' is not taught until Lesson {when}")
            flag("untaught vowel pair", f"'{root}' contains {detail}")
            continue

        # 4. silent e (VCe) before it is taught
        if len(root) >= 3 and root.endswith("e") and root[-2] not in VOWELS and root[-3] in VOWELS:
            if not any(p.endswith("_e") for p in patterns):
                flag("silent e", f"'{root}' is a VCe word; silent e starts at Lesson 54")
                continue

        # 5. soft c / soft g
        soft = None
        for m in re.finditer(r"[cg](?=[eiy])", root):
            if m.group(0) == "g" and (root in HARD_G_WORDS or bare in HARD_G_WORDS):
                continue
            ch, at = m.group(0), m.start()
            final_ce_ge = root.endswith(ch + "e") and at == len(root) - 2
            need = (FINAL_CE_LESSON if ch == "c" else FINAL_GE_LESSON) if final_ce_ge \
                else SOFT_C_G_LESSON
            if lesson < need:
                soft = (ch, need)
                break
        if soft:
            flag("soft c/g",
                 f"'{root}' has {soft[0]} before e/i/y, which says its soft sound; "
                 f"not taught until Lesson {soft[1]}")
            continue

        # 6. consonant blends anywhere in the word, before blends are taught
        if "blends" not in patterns:
            runs = consonant_clusters(root)
            if any(r >= 2 for r in runs):
                flag("consonant blend",
                     f"'{root}' contains a consonant blend; blends start at Lesson 53")
                continue

        # 7. a root with no vowel at all is not decodable
        if not any(ch in VOWELS or ch == "y" for ch in root):
            flag("no vowel", f"'{root}' has no vowel to build a syllable on")

    return {
        "lesson": lesson,
        "lessonName": L["name"],
        "skill": L["skill"],
        "wordsChecked": checked,
        "violations": violations,
        # zero words checked is never a pass -- it means the input was empty
        # or an extractor broke, and silence must not read as approval.
        "clean": checked > 0 and not violations,
        "empty": checked == 0,
    }


# ---------------------------------------------------------------------------
# Regression tests. Every case here is a word an adversarial agent used to
# sneak past an earlier version of this file.
# ---------------------------------------------------------------------------
SELFTEST = [
    # (lesson, text, must_be_clean, why)
    (41, "Sam has a pig. The pig is big. Sam and the pig sit in the sun. "
         "The pig runs to the mud. The pig sits in the mud. Sam gets a rag "
         "and a tub. Sam rubs the pig in the tub. The pig is wet. Sam is wet! "
         "The pig naps in the sun.", True, "the confirmed Mud Pig passage"),
    (41, "ship", False, "sh not taught until 45"),
    (41, "cake", False, "silent e not until 54"),
    (41, "stop", False, "blend not until 53"),
    (41, "picnic", False, "medial blend + 2 syllables"),
    (41, "basket", False, "medial blend + 2 syllables"),
    (41, "napkin", False, "2 syllables"),
    (41, "rabbit", False, "2 syllables, doubled b"),
    (41, "little", False, "-le syllable, 2 syllables"),
    (41, "apple", False, "2 syllables"),
    (6,  "pasta", False, "st blend + 2 syllables at lesson 6"),
    (12, "potato", False, "3 syllables at lesson 12"),
    (14, "panic", False, "2 syllables at lesson 14"),
    (26, "candle", False, "-le at lesson 26"),
    (34, "vein", False, "ei vowel team at lesson 34"),
    (30, "buy", False, "uy at lesson 30"),
    (41, "gem", False, "soft g"),
    (41, "acid", False, "soft c + 2 syllables"),
    (53, "talk", False, "silent l"),
    (41, "bus", True, "b-u-s: all taught, one syllable, no blend — a lesson 41 child reads this"),
    (41, "gets", True, "get is hard g, and -s is taught at 20"),
    (41, "gem", False, "gem really is soft g"),
    (87, "night", True, "igh is the grapheme; gh must not be flagged separately"),
    (116, "thought", True, "ough taught at 116"),
    (96, "down", True, "ow diphthong taught at 96"),
    (86, "down", False, "ow at 86 is the /o/ sound; 'down' needs 96"),
    (41, "lion", False, "li-on is two syllables hiding in one vowel group"),
    (41, "dial", False, "di-al, same hiatus problem"),
    (41, "type", False, "y as a vowel before Lesson 73"),
    (41, "lyre", False, "y as a vowel before Lesson 73"),
    (41, "yes", True, "y at the start is the consonant sound, taught at 30"),
    (41, "yum", True, "same — consonant y is fine"),
    (74, "happy", True, "y saying long e is taught at 74"),
]


# Words this checker cannot judge from spelling alone. Each needs a human or a
# word bank to settle. They are listed, not silently ignored.
KNOWN_LIMITATIONS = [
    ("lens", 41, "final -ns is part of the root, not a plural, so it is a blend. "
                 "Structurally identical to 'gets', which is legal. Needs a word bank."),
    ("snow", 86, "ow says /o/ here, but the ow gate sits at 96 to keep 'down' out. "
                 "Lesson 86's own practice words need a word bank to be allowed."),
    ("head", 85, "ea says short e here; that sound is taught nowhere in the 128. "
                 "The ea gate sits at 114, so lesson 85 words need a word bank."),
]


def selftest() -> int:
    failures = 0
    for lesson, text, want_clean, why in SELFTEST:
        r = audit(text, lesson)
        got = r["clean"]
        if got != want_clean:
            failures += 1
            print(f"FAIL  L{lesson:<4} {text[:34]!r:<38} expected "
                  f"{'clean' if want_clean else 'violation'} — {why}")
            for v in r["violations"][:2]:
                print(f"        got: {v['word']} — {v['reason']}: {v['detail']}")
            if want_clean is False and not r["violations"]:
                print("        got: no violations at all")
    total = len(SELFTEST)
    print(f"\nself-test: {total - failures}/{total} passed")
    print(f"\n{len(KNOWN_LIMITATIONS)} known limitation(s) — spelling alone "
          f"cannot settle these, a word bank is needed:")
    for word, lesson, why in KNOWN_LIMITATIONS:
        print(f"  {word!r} at Lesson {lesson}: {why}")
    return failures


def main():
    argv = sys.argv[1:]
    if argv and argv[0] == "--selftest":
        sys.exit(1 if selftest() else 0)
    if len(argv) < 2:
        print(__doc__)
        sys.exit(2)

    try:
        lesson = int(argv[0])
    except ValueError:
        print(f"First argument must be a lesson number 1-128, not {argv[0]!r}")
        sys.exit(2)

    mode = argv[1]
    if mode in ("--file", "--html"):
        if len(argv) < 3:
            print(f"{mode} needs a file path after it")
            sys.exit(2)
        path = pathlib.Path(argv[2])
        if not path.exists():
            print(f"No such file: {path}")
            sys.exit(2)
        if mode == "--file":
            text = path.read_text()
        else:
            # Only the story: the title and the lines a child actually decodes.
            # Instructions and labels on the page are read by the grown-up.
            html = path.read_text()
            title = re.search(r'<div class="ptitle">(.*?)</div>', html, re.S)
            lines = re.findall(r'<span class="ln">(.*?)</span>', html, re.S)
            if not lines:
                print('No <span class="ln"> story lines found in that file')
                sys.exit(2)
            raw = " ".join(([title.group(1)] if title else []) + lines)
            text = re.sub(r"&[a-z]+;", " ", re.sub(r"<[^>]+>", " ", raw))
    else:
        text = " ".join(argv[1:])

    r = audit(text, lesson)
    print(f"Lesson {r['lesson']} — {r['skill']}")
    print(f"{r['wordsChecked']} words checked")
    if r["empty"]:
        print("NOT CHECKED — no words found. Empty input is not a pass.")
        sys.exit(1)
    if r["clean"]:
        print("CLEAN — 0 untaught sounds")
    else:
        print(f"{len(r['violations'])} VIOLATION(S):")
        for v in r["violations"]:
            print(f"  {v['word']:<14} {v['reason']}: {v['detail']}")
    sys.exit(0 if r["clean"] else 1)


if __name__ == "__main__":
    main()
