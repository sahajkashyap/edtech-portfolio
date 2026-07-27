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
# How many syllables a word may have, by lesson. Before 66 no syllable
# division has been taught at all. Lessons 66-68 teach two-syllable words.
# From 99 the affix lessons legitimately build longer words.
def syllable_limit(lesson: int) -> int:
    if lesson < 66:
        return 1
    if lesson < 99:
        return 2
    return 99


MULTISYLLABLE_LESSON = 66

# Words whose vowel or silent letter cannot be worked out from spelling.
# Each maps to the lesson from which it is safe (999 = never decodable, it
# must be taught as a heart word). This list is the honest place for English
# irregularity; a substring gate cannot do this job.
IRREGULAR_WORDS = {
    # o saying /u/
    "son": 999, "ton": 999, "won": 999, "some": 999, "come": 999, "done": 999,
    "none": 999, "love": 999, "above": 999, "month": 999, "mother": 999,
    "other": 999, "brother": 999, "nothing": 999, "money": 999,
    # u saying /oo/
    "put": 999, "pull": 999, "full": 999, "push": 999, "bush": 999, "bull": 999,
    # a saying short o -- UFLI teaches this at Lesson 94 (a /o/, as in want)
    "wash": 94, "want": 94, "watch": 94, "swan": 94, "wasp": 94, "wand": 94,
    "was": 999, "what": 999, "water": 999,
    # mb IS taught at Lesson 98
    "climb": 98, "comb": 98, "lamb": 98, "thumb": 98, "numb": 98, "limb": 98,
    # silent letters UFLI does NOT teach anywhere in the 128. Verified against
    # the published Toolbox: Lesson 98 covers kn, wr and mb only.
    "talk": 999, "walk": 999, "chalk": 999, "calf": 999, "half": 999,
    "calm": 999, "palm": 999, "folk": 999, "yolk": 999, "could": 999,
    "would": 999, "should": 999, "island": 999, "listen": 999, "castle": 999,
    "often": 999, "whistle": 999, "autumn": 999, "column": 999,
    "sign": 118, "design": 118, "gnat": 118,
    # other irregulars
    "two": 999, "who": 999, "whose": 999, "does": 999, "goes": 999,
    "sugar": 999, "sure": 999, "sword": 999, "stomach": 999, "eye": 999,
}

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
        print(f"Lesson must be 1-{doc['totalLessons']}, got {lesson}")
        sys.exit(2)
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
        # "hundred" is not "hundr" + ed: a root ending in an odd consonant
        # cluster is not a real word, so do not peel.
        tail = root
        for d in CONSONANT_DIGRAPHS:
            tail = tail.replace(d, "#")
        tail = re.sub(r"([^aeiou])\1", r"\1", tail)
        if len(tail) >= 3 and all(c not in VOWELS and c != "#" for c in tail[-3:]):
            continue
        # bl, cr, dr, fl... only ever START a syllable in English, so a "root"
        # ending in one is not a word: "sibling" is not "sibl" + ing.
        if re.search(r"[bcdfgkpstv][lr]$", tail):
            continue
        # A plural -s never follows another s/x/z, and never follows a
        # consonant cluster (bus, lens, gas keep their s).
        if suf == "s":
            if root[-1] in "sxz":
                continue
            # Digraphs and doubles count as ONE consonant, else "ducks",
            # "kings" and "bells" read as cluster-final and lose their plural.
            m = root
            for d in CONSONANT_DIGRAPHS:
                m = m.replace(d, "#")
            m = re.sub(r"([^aeiou])\1", r"\1", m)
            if len(m) >= 2 and m[-1] not in VOWELS and m[-1] != "#" and m[-2] not in VOWELS:
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


def mask_longest(word: str, units, placeholder: str = "#") -> str:
    """Replace known units with a placeholder, longest match first, left to right.

    Sequential str.replace() is wrong here: masking "ue" before "qu" turns
    "queen" into "qen" and leaves a bare q, which made every q word fail.
    """
    ordered = sorted((u for u in units if u.isalpha()), key=len, reverse=True)
    out, i = [], 0
    while i < len(word):
        for u in ordered:
            if word.startswith(u, i):
                out.append(placeholder)
                i += len(u)
                break
        else:
            out.append(word[i])
            i += 1
    return "".join(out)


def mask_digraphs(root: str) -> str:
    # A doubled consonant spells one sound (egg, odd, bell), so collapse it
    # before looking for blends.
    collapsed = re.sub(r"([bcdfgklmnprstvz])\1", r"\1", root)
    return mask_longest(collapsed, CONSONANT_DIGRAPHS)


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

        root, peeled = strip_suffix(bare, L["allowedSuffixes"])

        # 2. a letter the child has not met yet.
        # Multi-letter graphemes are masked out first: q is only ever taught as
        # part of "qu", so checking raw characters rejected every q word at
        # every lesson.
        multi = [g for g in allowed if len(g) > 1]
        masked = mask_longest(root, multi)
        unknown = sorted({ch for ch in masked if ch != "#" and ch not in single_letters})
        if unknown:
            flag("untaught letter", f"uses {', '.join(repr(c) for c in unknown)}")
            continue

        # 2b. an irregular word whose sound cannot be read off its spelling.
        # Check the root too, so "sons" is caught along with "son".
        irr = bare if bare in IRREGULAR_WORDS else (
              root if root in IRREGULAR_WORDS else None)
        if irr:
            need = IRREGULAR_WORDS[irr]
            if lesson < need:
                where = ("never decodable — it has to be taught as a heart word"
                         if need == 999 else f"not decodable until Lesson {need}")
                flag("irregular word", f"'{irr}' is {where}")
                continue

        # 3. more syllables than the lesson allows. Counted on the WHOLE word,
        # so peeling a suffix cannot shrink a long word under the limit
        # ("hundred" is not "hundr" + ed).
        limit = syllable_limit(lesson)
        # A taught ending may legitimately add a syllable: Lesson 65 IS the
        # -ing lesson, so "running" must be allowed there. The bonus is only
        # granted when a suffix was actually peeled -- "hundred" is not
        # "hundr" + ed, so it earns nothing.
        if peeled and peeled in ("ing", "es", "ed", "er", "est", "ly", "ness",
                                 "ment", "able", "ible", "less", "ful", "ish",
                                 "ist", "y", "ture", "sion", "tion"):
            limit += 1
        n = syllable_count(bare)
        if n > limit:
            flag("too many syllables",
                 f"'{bare}' has {n} syllables; Lesson {lesson} allows "
                 f"{limit}. Splitting words starts at Lesson "
                 f"{MULTISYLLABLE_LESSON}.")
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
        for run in re.findall(r"[aeiou]{2,}", mask_longest(root, multi)):
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

        # 3d. a doubled consonant ENDING a word is the FLSZ family's territory
        # (Lesson 42). Doubles in the middle of a word are fine — those live in
        # two-syllable words, which the syllable rule already governs.
        if lesson < 42 and re.search(r"([bcdgkmnprtvz])\1$", root):
            flag("doubled ending",
                 f"'{root}' ends in a doubled consonant; that spelling rule "
                 f"starts at Lesson 42")
            continue

        # 4. silent e (VCe) before it is taught
        if (len(root) >= 3 and root.endswith("e") and root[-2] not in VOWELS
                and any(c in VOWELS for c in root[:-2])):
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

        # 5b. long-vowel VCC families (-old, -ind, -ild, -olt, -ost) taught at 72.
        # These were sitting unused in allowedPatterns while "cold" and "kind"
        # passed at Lesson 53 as short-vowel words.
        vcc = next((pat for pat in ("-old", "-ind", "-ild", "-olt", "-ost")
                    if root.endswith(pat.lstrip("-")) and len(root) >= 4), None)
        if vcc and vcc not in patterns:
            flag("long vowel VCC",
                 f"'{root}' ends in {vcc}, where the vowel says its long sound; "
                 f"that starts at Lesson 72")
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
    (53, "talk", False, "silent l; UFLI never teaches lk"),
    (128, "talk", False, "and still not at the last lesson"),
    (94, "want", True, "a saying short o is taught at Lesson 94"),
    (93, "want", False, "but not the lesson before"),
    (98, "lamb", True, "mb IS taught at 98"),
    (98, "autumn", False, "mn is not taught anywhere in the 128"),
    (41, "bus", True, "b-u-s: all taught, one syllable, no blend — a lesson 41 child reads this"),
    (41, "gets", True, "get is hard g, and -s is taught at 20"),
    (41, "gem", False, "gem really is soft g"),
    (87, "night", True, "igh is the grapheme; gh must not be flagged separately"),
    (116, "thought", True, "ough taught at 116"),
    (96, "down", True, "ow diphthong taught at 96"),
    (86, "down", True, "ow is gated at 86 so the lesson is writable; separating "
                       "down from snow is the word bank's job, and lesson 86 "
                       "carries requiresWordBank"),
    # --- bugs found by the adversarial agent, round 2 ---
    (32, "quit", True, "q is only ever taught as qu; no q word passed at ANY lesson"),
    (128, "queen", True, "same bug, at the last lesson"),
    (60, "milk", True, "lk is a plain blend, not a silent-l grapheme"),
    (60, "self", True, "lf likewise"),
    (80, "number", True, "mb across a syllable break is not a silent b"),
    (66, "number", False, "er is r-controlled, not taught until 80"),
    (85, "eat", True, "Lesson 85 must be able to use its own ea words"),
    (85, "sea", True, "same"),
    (44, "ducks", True, "plural of a ck root; -s is taught at 20"),
    (51, "kings", True, "plural of an ng root"),
    (43, "egg", True, "one syllable, belongs beside off/all/ill"),
    (41, "mitt", False, "doubled ending is the Lesson 42 rule"),
    (41, "butt", False, "same"),
    (41, "sons", False, "irregular root must be caught through the plural too"),
    (32, "quit", True, "still fine after the doubled-ending rule"),
    (43, "odd", True, "same"),
    (65, "running", True, "Lesson 65 IS the -ing lesson"),
    (65, "sitting", True, "same"),
    (64, "hundred", False, "not 'hundr' + ed — suffix peeling must not shrink it"),
    (65, "sibling", False, "not 'sibl' + ing"),
    (53, "cold", False, "-old says long o; taught at 72"),
    (53, "kind", False, "-ind likewise"),
    (72, "cold", True, "and legal once 72 teaches it"),
    (48, "ache", False, "VCCe still carries a silent e"),
    (53, "taste", False, "same"),
    (41, "was", False, "irregular vowel; must be a heart word"),
    (41, "son", False, "o saying /u/"),
    (41, "put", False, "u saying /oo/"),
    (53, "want", False, "a saying /o/ after w"),
    (66, "photograph", False, "3 syllables at the 2-syllable lesson"),
    (66, "hospital", False, "same — Lesson 66 was a cliff with no limit at all"),
    (66, "napkin", True, "2 syllables is exactly what Lesson 66 teaches"),
    (99, "photograph", True, "affix lessons legitimately build longer words"),
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
    ("lens", 41,
     "'lens' IS a violation at Lesson 41 — the final -ns is a root blend the "
     "child must cluster, and blends start at 53. It passes because 'lens' and "
     "'gets' have identical spelling shapes (vowel, consonant, s) and only a "
     "dictionary knows that one -s is a suffix and the other is not. The word "
     "bank settles it; no spelling rule can."),
    ("down", 86,
     "ow is gated at 86 so Lesson 86 can use snow/grow/low. That also lets "
     "down/cow/now through 10 lessons early. Every lesson in this position "
     "carries requiresWordBank in sound-list.json — see also th (46), ea and "
     "ey (85), oo (89), ou (96), ear (112)."),
    ("head", 85,
     "RESOLVED at Lesson 94 -- UFLI does teach short e spelled ea there. "
     "Between 85 and 93 the ea gate is open for the long-e sound, so head-type "
     "words in that window still need the word bank."),
    ("irregular words", 0,
     "was, son, put, want, talk and their kind are handled by an explicit "
     "IRREGULAR_WORDS list, because English does not spell them by rule. That "
     "list is hand-maintained and therefore certainly incomplete."),
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
        where = f" at Lesson {lesson}" if lesson else ""
        print(f"  {word!r}{where}: {why}")
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
        if not path.is_file():
            print(f"Not a readable file: {path}")
            sys.exit(2)
        try:
            path.read_text()
        except UnicodeDecodeError:
            print(f"{path} is not a text file — point this at the .html, not the PDF")
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
