#!/usr/bin/env python3
"""Build the cumulative sound list for all 128 lessons.

This is the rulebook every decodable passage is checked against. Nothing else
in the generator matters if this file is wrong, so it is generated from the
assessment tool's own curriculum rather than typed by hand, and every judgement
call is written down in NEW_GRAPHEMES below where a human can argue with it.

The model, confirmed by the teacher (July 2026): lessons are taught in NUMBER
order. A child on Lesson 41 has had 1-40. So "allowed at lesson N" is the union
of everything introduced in lessons 1..N.

Run:  python3 build_sound_list.py        -> writes sound-list.json
"""

import json
import pathlib
import re
import sys

TOOL = pathlib.Path("../phonics-assessment-tool/index.html")
OUT = pathlib.Path("sound-list.json")

# ---------------------------------------------------------------------------
# What each lesson INTRODUCES.
#
# Key = lesson number. Value = dict with any of:
#   "graphemes" : letter patterns a child can now decode
#   "suffixes"  : word endings
#   "prefixes"  : word beginnings
#   "patterns"  : structural permissions (blends, silent-e, open syllables...)
#   "note"      : why, when the call wasn't obvious
#
# A lesson absent from this table introduces nothing new (reviews, practice).
# ---------------------------------------------------------------------------
NEW_GRAPHEMES = {
    # ---- Unit 1: single letters, short vowels -------------------------------
    1:  {"graphemes": ["a"]},
    2:  {"graphemes": ["m"]},
    3:  {"graphemes": ["s"]},
    4:  {"graphemes": ["t"]},
    5:  {"patterns": ["vc", "cvc"], "note": "VC & CVC word shapes become readable."},
    6:  {"graphemes": ["p"]},
    7:  {"graphemes": ["f"]},
    8:  {"graphemes": ["i"]},
    9:  {"graphemes": ["n"]},
    10: {"note": "CVC practice with a and i. No new graphemes."},
    11: {"patterns": ["nasalized_am_an"], "note": "am/an as a chunk; no new letters."},
    12: {"graphemes": ["o"]},
    13: {"graphemes": ["d"]},
    14: {"graphemes": ["c"]},
    15: {"graphemes": ["u"]},
    16: {"graphemes": ["g"]},
    17: {"graphemes": ["b"]},
    18: {"graphemes": ["e"]},
    20: {"suffixes": ["-s"], "note": "plural/verb -s said /s/."},
    21: {"suffixes": ["-s"], "note": "same -s said /z/."},
    22: {"graphemes": ["k"]},
    23: {"graphemes": ["h"]},
    24: {"graphemes": ["r"]},
    26: {"graphemes": ["l"]},
    27: {"note": "l practice. UFLI lists no second item here; ai is Lesson 84."}, 
    28: {"graphemes": ["w"]},
    29: {"graphemes": ["j"]},
    30: {"graphemes": ["y"], "note": "consonant y as in yes."},
    31: {"graphemes": ["x"]},
    32: {"graphemes": ["qu"]},
    33: {"graphemes": ["v"]},
    34: {"graphemes": ["z"]},

    # ---- Unit 3: digraphs ---------------------------------------------------
    42: {"graphemes": ["ff", "ll", "ss", "zz"]},
    43: {"patterns": ["-all", "-oll", "-ull"]},
    44: {"graphemes": ["ck"]},
    45: {"graphemes": ["sh"]},
    46: {"graphemes": ["th"], "note": "voiced th; unvoiced at 47."},
    47: {"note": "unvoiced th; both th sounds are now safe."},
    48: {"graphemes": ["ch"]},
    50: {"graphemes": ["wh", "ph"]},
    51: {"graphemes": ["ng"]},
    52: {"graphemes": ["nk"]},
    53: {"patterns": ["blends"],
         "note": "'Digraphs Review 2 (incl. CCCVC)' — consonant blends are only "
                 "explicitly practised here. Before 53, no blends. This is the "
                 "conservative reading and it is what keeps early passages honest."},

    # ---- Unit 4: VCe --------------------------------------------------------
    54: {"patterns": ["a_e"]},
    55: {"patterns": ["i_e"]},
    56: {"patterns": ["o_e"]},
    57: {"patterns": ["e_e"]},
    58: {"patterns": ["u_e"], "graphemes": ["u_e_yoo"], "note": "u_e also says /yu/ as in cube."},
    62: {"patterns": ["vce_exceptions"],
         "note": "have, give, live, come, some — VCe words where the vowel "
                 "stays short. Real teaching point, not just review."},
    60: {"patterns": ["_ce"]},
    61: {"patterns": ["_ge"]},

    # ---- Endings and syllables ---------------------------------------------
    63: {"suffixes": ["-es"]},
    64: {"suffixes": ["-ed"]},
    65: {"suffixes": ["-ing"]},
    66: {"patterns": ["open_syllable", "closed_syllable"]},
    67: {"patterns": ["compound_words", "closed_closed"]},
    68: {"patterns": ["open_closed"]},
    69: {"graphemes": ["tch"]},
    70: {"graphemes": ["dge"]},
    72: {"patterns": ["-ild", "-old", "-ind", "-olt", "-ost"]},
    73: {"graphemes": ["y_long_i"], "note": "y saying long i, as in my."},
    74: {"graphemes": ["y_long_e"], "note": "y saying long e, as in happy."},
    75: {"patterns": ["-le"]},

    # ---- R-controlled -------------------------------------------------------
    77: {"graphemes": ["ar"]},
    78: {"graphemes": ["or", "ore"]},
    80: {"graphemes": ["er"]},
    81: {"graphemes": ["ir", "ur"]},
    82: {"patterns": ["w+or"]},

    # ---- Vowel teams --------------------------------------------------------
    84: {"graphemes": ["ai", "ay"]},
    85: {"graphemes": ["ee", "ea", "ey"]},
    86: {"graphemes": ["oa", "oe", "ow"],
         "note": "ow (snow) shares its spelling with ow (cow) at 96, so this "
                 "lesson requires an approved word list."},
    87: {"graphemes": ["ie", "igh"]},
    89: {"graphemes": ["oo"],
         "note": "oo (moon) shares its spelling with oo (book) at 90, so this "
                 "lesson requires an approved word list."},
    90: {"note": "second oo sound; both are now safe."},
    91: {"graphemes": ["ew", "ui", "ue"]},
    93: {"graphemes": ["au", "aw", "augh"]},
    94: {"graphemes": ["ea_short_e", "a_short_o"],
         "note": "UFLI teaches short e spelled ea (head, bread) and short o "
                 "spelled a (want, wash) here. The tool had a schwa lesson, "
                 "which UFLI does not have."},
    95: {"graphemes": ["oi", "oy"]},
    96: {"graphemes": ["ou"], "note": "ou as in out; second sound at 115."},
    98: {"graphemes": ["kn", "wr", "mb"], "patterns": ["silent_letters"],
         "note": "UFLI teaches exactly three silent-letter patterns here. "
                 "mn is not taught anywhere in the 128, and talk/calm/half "
                 "are not part of this lesson."},

    # ---- Unit 8: affixes and advanced --------------------------------------
    99:  {"suffixes": ["-s", "-es"]},
    100: {"suffixes": ["-er", "-est"]},
    101: {"suffixes": ["-ly"]},
    102: {"suffixes": ["-less", "-ful"]},
    103: {"prefixes": ["un-"]},
    104: {"prefixes": ["pre-", "re-"]},
    105: {"prefixes": ["dis-"]},
    107: {"patterns": ["doubling_rule_ed_ing"]},
    108: {"patterns": ["doubling_rule_er_est"]},
    109: {"patterns": ["drop_e_rule"]},
    110: {"patterns": ["y_to_i_rule"]},
    111: {"suffixes": ["-ar", "-or", "-er"]},
    112: {"graphemes": ["air", "are", "ear_air"]},
    113: {"graphemes": ["ear_er"]},
    114: {"graphemes": ["ei", "ey", "eigh", "ea_long_a", "aigh"],
          "note": "The tool's 'high' is a mistyping of 'aigh' (straight). It "
                  "was previously dropped, so aigh was never taught at all."},
    115: {"graphemes": ["eu"], "note": "ou saying long u (soup) is safe now too."},
    116: {"graphemes": ["ough"]},
    117: {"patterns": ["signal_vowels"], "note": "c=/s/ and g=/j/ only; UFLI has no s=/z/ here."},
    118: {"graphemes": ["ch_sh", "ch_k", "gn", "gh"], "patterns": ["silent_t"]},
    119: {"suffixes": ["-sion", "-tion"]},
    120: {"suffixes": ["-ture"]},
    121: {"suffixes": ["-er", "-or", "-ist"]},
    122: {"suffixes": ["-ish"]},
    123: {"suffixes": ["-y"]},
    124: {"suffixes": ["-ness"]},
    125: {"suffixes": ["-ment"]},
    126: {"suffixes": ["-able", "-ible"]},
    127: {"prefixes": ["uni-", "bi-", "tri-"]},
}

# Multi-letter spellings a child must NOT meet before the lesson that teaches
# them. Checked against raw spelling, because a word like "ship" is made of
# letters a Lesson-41 reader knows but is still unreadable to them.
LETTER_PATTERN_TAUGHT_AT = {
    # Only true GRAPHEMES belong here — letter teams that spell one sound.
    # Letter SEQUENCES that merely cross a syllable break (lk in milk, mb in
    # number, gn in magnet) must NEVER be gated: doing so blocked milk, self,
    # elf and film for 45 lessons. Silent-letter words are handled by an
    # explicit word list in audit_passage.py instead.
    #
    # Doubled consonants are likewise not gated: egg/add/odd are legitimate
    # one-syllable words at Lessons 42-43, and rabbit/kitten are already caught
    # by the syllable rule.
    "ff": 42, "ll": 42, "ss": 42, "zz": 42,
    "ck": 44, "sh": 45, "th": 46, "ch": 48, "wh": 50, "ph": 50,
    "ng": 51, "nk": 52, "tch": 69, "dge": 70, "qu": 32,

    "ar": 77, "or": 78, "ore": 78, "er": 80, "ir": 81, "ur": 81,

    # Vowel teams are gated at the lesson that FIRST teaches the spelling, so
    # each lesson can use its own practice words. Where a spelling has a second
    # sound taught later (ea in eat vs ea in head), the lesson is marked
    # requiresWordBank rather than being made unwritable.
    "ai": 84, "ay": 84, "ee": 85, "ea": 85, "ey": 85,
    "oa": 86, "oe": 86, "ow": 86, "ie": 87, "igh": 87,
    "oo": 89, "ew": 91, "ui": 91, "ue": 91,
    "au": 93, "aw": 93, "augh": 93,
    "oi": 95, "oy": 95, "ou": 96,
    "ei": 114, "eigh": 114, "aigh": 114, "ough": 116,

    "air": 112, "are": 112, "ear": 112,
    "kn": 98, "wr": 98, "gn": 118,
}

# A taught spelling whose OTHER sound arrives later. Such a lesson can be
# written, but only from an approved word list — the checker cannot tell
# "snow" from "down" by spelling alone.
SECOND_SOUND_LATER = {
    46:  [("th", 47, "th in this vs th in thin")],
    58:  [("u_e", 58, "u_e in tube vs u_e in cube")],
    85:  [("ea", 94, "ea in eat vs ea in head (94) vs ea in great (114)"),
          ("ey", 114, "ey in key vs ey in they")],
    86:  [("ow", 96, "ow in snow vs ow in cow")],
    89:  [("oo", 90, "oo in book (89) vs oo in moon (90)")],
    96:  [("ou", 115, "ou in out vs ou in soup")],
    112: [("ear", 113, "ear in bear vs ear in earn")],
}




# ---------------------------------------------------------------------------
# Corrections, verified against UFLI Foundations' published Toolbox and Scope &
# Sequence (ufli.education.ufl.edu), July 2026.
#
# The assessment tool's curriculum object carries typos. We keep READING from
# that tool so lesson names and order can never drift -- but we correct the
# known errors here, in the open, rather than silently importing them.
#
# THE SAME FIXES ARE STILL NEEDED IN phonics-assessment-tool/index.html.
# Until they are made there, this layer is what stands between a typo and a
# child. Every entry cites what the tool says and what UFLI actually teaches.
# ---------------------------------------------------------------------------
CURRICULUM_CORRECTIONS = {
    10:  ("CVC Practice (a, i)",       "tool says '(g, i)'; UFLI has (a, i). The letter g is Lesson 16."),
    11:  ("Nasalized A (am, an)",      "tool says '(am, on)'; UFLI has am/an."),
    27:  ("l /l/ Part 2",              "tool says 'l /l/ Part 2, ai'. UFLI lists no second item; the "
                                       "stray letters are the -al ending misread as 'ai'. The vowel "
                                       "team ai is Lesson 84, and is NOT taught here."),
    51:  ("ng /ŋ/",                   "notation only; tool wrote /n/."),
    52:  ("nk /ŋk/",                  "notation only; tool wrote /nk/."),
    58:  ("u_e /ū/, /yū/",             "tool says 'u /u/, /u/'. It is the VCe pattern u_e, and it "
                                       "carries a second sound /yu/ (cube) the tool lost."),
    67:  ("Compound Words, Closed/Closed",
                                       "tool says 'Closed/Closed'. UFLI splits this into 67a Compound "
                                       "Words and 67b Closed/Closed; compound words were missing."),
    90:  ("oo /ū/ (moon)",            "tool wrote a breve, which is the book sound. UFLI Lesson 90 is "
                                       "the long oo. Lesson 89 is the other one."),
    93:  ("au, aw, augh /aw/",         "tool says 'ugh'; UFLI has augh (caught, taught)."),
    94:  ("ea /ĕ/ (head), a /ŏ/ (want)",
                                       "tool says 'schwa'. UFLI has no schwa lesson. Lesson 94 teaches "
                                       "short e spelled ea, and short o spelled a. This was the single "
                                       "largest error: it omitted two real sound-spellings and admitted "
                                       "one UFLI does not teach."),
    98:  ("Silent Letters (kn, wr, mb)",
                                       "tool says '(kn, wr, mb, m)'. UFLI teaches THREE patterns here. "
                                       "The stray 'm' is the /m/ of 'mb /m/' split off in typing. It is "
                                       "not 'mn' -- mn is not taught anywhere in the 128."),
    111: ("ar /ər/, or /ər/",          "tool says '-ar, -or, -er/'; the third item is spurious."),
    113: ("ear /ir/ (hear)",          "tool wrote the /er/ sound. UFLI Lesson 113 is the 'hear' sound, "
                                       "not the 'her' sound."),
    114: ("Alternate /ā/ (ei, eigh, ey, ea, aigh)",
                                       "tool says 'high'; UFLI has 'aigh'. Previously dropped, so aigh "
                                       "was never taught at all."),
    116: ("ough /aw/, /ō/",            "tool wrote schwa for the second sound; UFLI has long o."),
    117: ("Signal Vowels (c /s/, g /j/)",
                                       "tool adds 's /z/'; UFLI's signal-vowel lesson is c and g only."),
    127: ("bi-, tri-, uni-",           "tool drops the hyphen on 'tri'."),
}

# UFLI's real units are strictly contiguous blocks. The tool's 8 units are not
# UFLI's and are not in numeric order -- Lesson 98 sits under "VCe", and 84-88
# is placed before 77-83. Anything grouping by the tool's units shows lessons
# out of teaching order.
UFLI_UNITS = [
    (1, 34, "Unit 1: Alphabet"),
    (35, 41, "Unit 2: Alphabet Review & Longer Words"),
    (42, 53, "Unit 3: Digraphs"),
    (54, 62, "Unit 4: VCe"),
    (63, 68, "Unit 5: Reading Longer Words"),
    (69, 76, "Unit 6: Ending Spelling Patterns"),
    (77, 83, "Unit 7: R-Controlled Vowels"),
    (84, 88, "Unit 8: Long Vowel Teams"),
    (89, 94, "Unit 9: Other Vowel Teams"),
    (95, 98, "Unit 10: Diphthongs and Silent Letters"),
    (99, 106, "Unit 11: Suffixes and Prefixes"),
    (107, 110, "Unit 12: Suffix Spelling Changes"),
    (111, 118, "Unit 13: Low Frequency Spelling"),
    (119, 128, "Unit 14: Additional Affixes"),
]


def ufli_unit(n):
    for lo, hi, name in UFLI_UNITS:
        if lo <= n <= hi:
            return name
    raise ValueError(n)


def parse_curriculum(html: str):
    """Pull unit -> lessons + heart words straight out of the tool."""
    start = html.index('  "Unit 1: Alphabet & Sounds"')
    block = html[start:start + 20000]
    units = re.findall(
        r'"(Unit \d+[^"]*)":\s*\{\s*lessons:\s*\[(.*?)\],\s*heartWords:\s*\[(.*?)\]',
        block, re.S)
    lessons, heart_by_unit = {}, {}
    for uname, lesson_src, heart_src in units:
        pairs = re.findall(r'\{\s*name:\s*"([^"]+)",\s*skill:\s*"([^"]+)"\s*\}', lesson_src)
        words = re.findall(r'"([^"]+)"', heart_src)
        nums = []
        for name, skill in pairs:
            n = int(name.split()[1])
            lessons[n] = {"name": name, "skill": skill, "unit": uname}
            nums.append(n)
        heart_by_unit[uname] = {"words": words, "firstLesson": min(nums)}
    return lessons, heart_by_unit


def build():
    if not TOOL.exists():
        sys.exit(f"Cannot find the assessment tool at {TOOL}")
    lessons, heart_by_unit = parse_curriculum(TOOL.read_text())

    if sorted(lessons) != list(range(1, 129)):
        sys.exit(f"Expected lessons 1-128, got {len(lessons)}")

    # Heart words unlock at the lowest-numbered lesson of the unit that owns them.
    heart_unlock = {}
    for info in heart_by_unit.values():
        heart_unlock.setdefault(info["firstLesson"], []).extend(info["words"])

    out, graphemes, suffixes, prefixes, patterns, hearts, flags = [], [], [], [], [], [], []
    for n in range(1, 129):
        intro = NEW_GRAPHEMES.get(n, {})
        for key, bucket in (("graphemes", graphemes), ("suffixes", suffixes),
                            ("prefixes", prefixes), ("patterns", patterns)):
            for item in intro.get(key, []):
                if item not in bucket:
                    bucket.append(item)
        for w in heart_unlock.get(n, []):
            if w not in hearts:
                hearts.append(w)

        corrected, why = CURRICULUM_CORRECTIONS.get(n, (None, None))
        # Only report a correction the tool still needs. Once the typo is fixed
        # at source the entry stays here as a record, but stops being a warning.
        if corrected and lessons[n]["skill"] != corrected:
            flags.append({"lesson": n, "toolSays": lessons[n]["skill"],
                          "ufliTeaches": corrected, "note": why})
        out.append({
            "lesson": n,
            "name": lessons[n]["name"],
            "skill": corrected or lessons[n]["skill"],
            "toolSays": lessons[n]["skill"] if corrected else None,
            "unit": ufli_unit(n),
            "toolUnit": lessons[n]["unit"],
            "introduces": intro,
            "allowedGraphemes": sorted(graphemes),
            "allowedSuffixes": sorted(suffixes),
            "allowedPrefixes": sorted(prefixes),
            "allowedPatterns": sorted(patterns),
            "allowedHeartWords": sorted(hearts),
            "requiresWordBank": [
                {"spelling": sp, "secondSoundAt": at, "why": why}
                for L2, items in SECOND_SOUND_LATER.items() if L2 <= n
                for sp, at, why in items if at > n
            ],
            "forbiddenLetterPatterns": sorted(
                p for p, taught in LETTER_PATTERN_TAUGHT_AT.items() if taught > n),
        })

    doc = {
        "model": "cumulative by lesson number: a child at lesson N has had 1..N",
        "heartWordContract": "allowedHeartWords are EXEMPT from "
                             "forbiddenLetterPatterns. 'the' contains th and is "
                             "legal from lesson 1 because it is learned by sight, "
                             "not sounded out. Any checker must test heart-word "
                             "membership BEFORE testing letter patterns.",
        "source": "phonics-assessment-tool/index.html curriculum object",
        "totalLessons": len(out),
        "correctedAgainstUFLI": flags,
        "correctionsStillNeededInTheAssessmentTool":
            ("phonics-assessment-tool/index.html still carries these typos."
             if flags else
             "None. The assessment tool was corrected at source, 2026-07-28."),
        "letterPatternTaughtAt": LETTER_PATTERN_TAUGHT_AT,
        "lessons": out,
    }
    OUT.write_text(json.dumps(doc, indent=1) + "\n")

    print(f"wrote {OUT}  ({len(out)} lessons)")
    print(f"lesson 41 allows {len(out[40]['allowedGraphemes'])} graphemes, "
          f"{len(out[40]['allowedHeartWords'])} heart words")
    print(f"lesson 128 allows {len(out[127]['allowedGraphemes'])} graphemes, "
          f"{len(out[127]['allowedHeartWords'])} heart words")
    print(f"\n{len(flags)} lesson(s) corrected against UFLI:")
    for f in flags:
        print(f"  Lesson {f['lesson']:>3}: {f['toolSays']!r} -> {f['ufliTeaches']!r}")


if __name__ == "__main__":
    build()
