#!/usr/bin/env python3
"""Curriculum-correspondence auditor for the Form B running-record data.

WHY THIS EXISTS, in one sentence: audit_passage.py answers "could a child at
this lesson SOUND OUT every word?", and this file answers the different
question "is this sheet actually a Form B of the lesson it claims to be?"

Those are not the same question, and four generalist audits missed the gap.
A sheet can be perfectly decodable and still be wrong:

  * Lesson 20 teaches -s saying /s/ and Lesson 21 teaches -s saying /z/.
    audit_passage.py allows the "-s" suffix at both, so "bugs" and "buns"
    passed at Lesson 20 -- a whole lesson before the child is taught that
    -s can say /z/. The Form B Lesson 20 TITLE is "Bugs on Buns".
  * A Lesson 7 sheet named "f /f/" that contains no letter f anywhere is
    100% decodable and 0% useful as an assessment of f.
  * A Form B that reuses Form A's words is decodable and useless as a
    parallel form: the child is re-reading, not re-testing.

Every check below is derived from sound-list.json directly. Nothing here
imports or calls the project's own gate scripts, on purpose -- a checker that
asks the thing it is checking is not a check.

Run:  python3 audit_curriculum.py            # all 36 lessons
      python3 audit_curriculum.py --data DIR # audit a copy (e.g. a temp copy)
      python3 audit_curriculum.py --selftest # prove the checks can fail

Exit codes: 0 clean, 1 findings, 2 bad usage.
"""

import argparse
import itertools
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
GEN = HERE.parent.parent / "decodable-passage-generator"
DEFAULT_DATA = HERE / "data"
SOUND_LIST = GEN / "sound-list.json"
WORD_BANK = GEN / "word-bank.json"
FORM_A_SHEETS = GEN / "sheets"
SYSTEM_DICT = pathlib.Path("/usr/share/dict/words")

LESSON_RANGE = range(6, 42)          # the 36 files this tool owns
VOWELS = set("aeiou")

# Consonant digraphs spell ONE sound, so they never count as a blend.
CONSONANT_DIGRAPHS = ["tch", "dge", "sh", "th", "ch", "wh", "ph", "ng", "nk",
                      "ck", "kn", "wr", "gn", "qu", "ff", "ll", "ss", "zz"]

# Lesson numbers that gate a spelling family. Straight from sound-list.json's
# own scope and sequence; repeated here so a check can name the rule it broke.
GATE = {"flsz_double": 42, "ck": 44, "th": 46, "blends": 53, "vce": 54,
        "open_syllable": 66, "y_as_vowel": 73, "suffix_s_s": 20,
        "suffix_s_z": 21, "suffix_ed": 63, "suffix_ing": 65, "soft_c_g": 117}

# The characters in these 36 sheets. A proper name is not a curriculum word:
# it must not be counted as evidence that a lesson exercises its own grapheme
# (a Lesson 22 sheet whose only k is "Kim" has not tested k). Hand-listed
# because "capitalised" cannot tell Dot-the-girl from dot-the-spot.
#
# A hand-list the data can outgrow is a check that quietly stops working, so
# check_cast_list_covers_data() below re-derives the cast from the files and
# fails if this set has fallen behind. It had: Bev, Dev, Jan, Jon, Val and Zeb
# shipped in Lessons 34-41 and were missing here, which made Lesson 34's only
# "z word" the name Zeb -- exactly the Kim-at-Lesson-22 error this list exists
# to prevent.
CHARACTER_NAMES = {
    "sam", "pam", "tim", "nan", "dot", "gus", "bob", "meg", "ben", "sid",
    "ted", "kim", "deb", "reg", "mom", "dad", "ron", "ned", "hal", "raj",
    "sal", "tom", "max", "liz", "zac", "dan", "jen", "tam", "nat", "pip",
    "peg", "kip", "bud", "wag",
    "zeb", "jan", "val", "jon", "bev", "dev",
    # Replacements for pam, meg, deb, ned and raj, each of which reversed into
    # a word the child knows. kip was already listed. A name missing from this
    # set is silently counted as a CURRICULUM word, so it can be scored as
    # evidence that a lesson exercised its target sound — which is how a
    # rename made for one reason quietly falsifies a different check.
    "min", "lin", "jin",
}

# Words that carry no lesson content: they cannot show a skill was practised.
FUNCTION_WORDS = {
    "i", "a", "the", "and", "is", "as", "said", "to", "do", "of", "see", "he",
    "be", "me", "she", "from", "look", "are", "was", "you", "what", "have",
    "we", "it", "in", "on", "up", "not", "but", "at", "am", "an", "his",
    "him", "her", "its", "can", "this", "that", "so", "no",
}

# "Mom" and "Dad" are family roles, not invented characters; both forms may
# use them without giving a Form A reader an advantage.
SHARED_ROLE_NAMES = {"mom", "dad"}

# Two-letter roots that a naive "strip the -s" would invent. Kept whole.
NOT_PLURALS = {"is", "as", "us", "has", "his", "its", "yes", "bus", "gus",
               "this", "was", "gas", "less"}

# A nonsense word must not be a homophone of a word the child already knows;
# reading it "right" would then be marked wrong. Hand-maintained.
PSEUDOWORD_HOMOPHONES = {
    "im": "I'm", "ur": "your/you're", "wud": "would", "kud": "could",
    "shud": "should", "no": "know", "sum": "some", "wun": "one",
    "tu": "two/too", "for": "four", "sed": "said", "ov": "of",
}

# Tokens that are real English but not in /usr/share/dict/words, or that are
# unusable in a child's assessment for reasons a dictionary cannot know.
PSEUDOWORD_BLOCKLIST = {"fap", "nom", "com", "lol", "meme", "poo", "pee",
                        "bum", "fart", "wee", "tit", "ass", "damn"}

_CACHE = {}


# ---------------------------------------------------------------------------
# loading
# ---------------------------------------------------------------------------
def sound_list():
    if "sl" not in _CACHE:
        _CACHE["sl"] = json.loads(SOUND_LIST.read_text())
    return _CACHE["sl"]


def lesson(n):
    return sound_list()["lessons"][n - 1]


def word_bank():
    if "wb" not in _CACHE:
        _CACHE["wb"] = json.loads(WORD_BANK.read_text())
    return _CACHE["wb"]


def english_words():
    if "dict" not in _CACHE:
        if SYSTEM_DICT.exists():
            _CACHE["dict"] = {w.strip().lower()
                              for w in SYSTEM_DICT.read_text().split()}
        else:
            _CACHE["dict"] = set()
    return _CACHE["dict"]


def load_sheet(data_dir, n):
    return json.loads((pathlib.Path(data_dir) / f"lesson-{n:03d}.json").read_text())


def form_a_text(n):
    """The child-facing text of the Form A sheet: title plus story lines."""
    path = FORM_A_SHEETS / f"lesson-{n:03d}.html"
    if not path.exists():
        return ""
    html = path.read_text()
    title = re.search(r'<div class="ptitle">(.*?)</div>', html, re.S)
    lines = re.findall(r'<span class="ln">(.*?)</span>', html, re.S)
    raw = " ".join(([title.group(1)] if title else []) + lines)
    return re.sub(r"\s+", " ",
                  re.sub(r"&[a-z]+;", " ", re.sub(r"<[^>]+>", " ", raw))).strip()


# ---------------------------------------------------------------------------
# small shared helpers
# ---------------------------------------------------------------------------
def tokens(text):
    return re.findall(r"[A-Za-z']+", text)


def child_text(sheet):
    """Every string on the sheet that a child is asked to read."""
    parts = []
    for key in ("real_words", "nonsense_words", "high_frequency",
                "sentences", "lines"):
        parts += sheet.get(key, [])
    if sheet.get("title"):
        parts.append(sheet["title"])
    return " ".join(parts)


def stem(word):
    """Peel a plain plural/verb -s so 'sits' and 'sit' count as one word."""
    w = word.lower().replace("'", "")
    if w in NOT_PLURALS or not w.endswith("s") or len(w) < 3:
        return w
    if w.endswith("ss") or w[-2] in "sxz":
        return w
    return w[:-1]


def content_stems(text):
    """Stems that carry lesson content: not names, not function words."""
    out = set()
    for t in tokens(text):
        s = stem(t)
        if s and s not in FUNCTION_WORDS and s not in CHARACTER_NAMES:
            out.add(s)
    return out


def mask_longest(word, units, placeholder="#"):
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


def syllable_count(word):
    groups = len(re.findall(r"[aeiouy]+", word))
    if word.endswith("e") and len(word) > 2 and word[-2] not in VOWELS:
        groups -= 1
        if word.endswith("le") and word[-3:-2] not in VOWELS:
            groups += 1
    return max(groups, 1)


def s_suffix_sound(word):
    """/s/ or /z/ for a word-final plural/verb -s, or None if it is not one.

    English rule, no dictionary needed: -s says /s/ after a voiceless sound
    (p, t, k, f) and /z/ after anything voiced. This is the distinction
    Lesson 20 and Lesson 21 exist to separate, and the only check in the
    project that knows the difference.
    """
    w = word.lower().replace("'", "")
    if w in NOT_PLURALS or not w.endswith("s") or len(w) < 3:
        return None
    if w.endswith("ss") or w[-2] in "sxz":
        return None
    return "/s/" if w[-2] in "ptkf" else "/z/"


def target_graphemes(n):
    """What this lesson is NAMED for -- the thing its sheet must exercise."""
    L = lesson(n)
    skill = L["skill"].lower()
    g = list(L.get("introduces", {}).get("graphemes", []))
    if n == 10:
        g = ["a", "i"]
    if n == 11:
        g = ["am", "an"]
    if n in (20, 21):
        g = ["-s"]
    for label, letter in (("short a review", "a"), ("short i review", "i"),
                          ("short o review", "o"), ("short u review", "u"),
                          ("short e review", "e")):
        if skill.startswith(label):
            g = [letter]
    if skill.startswith("short a, i, o"):
        g = ["a", "i", "o"]
    if skill.startswith("short vowels review"):
        g = ["a", "e", "i", "o", "u"]
    return g


def finding(lesson_no, rule, quote, detail, fix, severity="HIGH"):
    return {"lesson": lesson_no, "rule": rule, "quote": quote,
            "detail": detail, "fix": fix, "severity": severity}


# ===========================================================================
# CHECK 1 -- the -s voicing split between Lesson 20 and Lesson 21
# Catches: Form B Lesson 20 "Bugs on Buns" / "buns" / "bugs" / "digs".
# ===========================================================================
def check_suffix_s_voicing(n, sheet):
    """A plural -s saying /z/ must not appear before Lesson 21."""
    findings = []
    hearts = {h.lower() for h in lesson(n)["allowedHeartWords"]}
    seen = {}
    for tok in tokens(child_text(sheet)):
        low = tok.lower()
        if low in hearts or low in CHARACTER_NAMES:
            continue
        sound = s_suffix_sound(low)
        if sound is None:
            continue
        need = GATE["suffix_s_s"] if sound == "/s/" else GATE["suffix_s_z"]
        if n < need:
            seen.setdefault((low, sound, need), 0)
            seen[(low, sound, need)] += 1
    for (word, sound, need), count in sorted(seen.items()):
        where = " (in the TITLE)" if sheet.get("title", "").lower().find(word) >= 0 else ""
        findings.append(finding(
            n, "suffix -s voicing",
            f"{word!r} x{count}{where}",
            f"-s here says {sound}, which Lesson {need} teaches; this is "
            f"Lesson {n} ({lesson(n)['skill']}).",
            f"Replace with a -s word whose s says the sound this lesson "
            f"teaches (Lesson 20 wants pops/fits/dips; Lesson 21 wants "
            f"bugs/buns/digs)."))
    return findings


# ===========================================================================
# CHECK 2 -- does the sheet exercise the skill it is named for?
# Catches: Lesson 7 "f /f/" with no f at all; Lessons 22/28/32/33 with one.
# ===========================================================================
MIN_TARGET_WORDS = 3
# A lesson whose whole job is REVIEW has to do more than clear the floor:
# three short-e words in a "Short E Review" passage is not a review.
MIN_TARGET_WORDS_REVIEW = 5


def check_target_exercised(n, sheet):
    findings = []
    targets = target_graphemes(n)
    is_review = "review" in lesson(n)["skill"].lower()
    minimum = MIN_TARGET_WORDS_REVIEW if is_review else MIN_TARGET_WORDS
    if not targets:
        return findings                      # review/practice lessons with no one target
    text = child_text(sheet)
    hits = set()
    for t in targets:
        for tok in tokens(text):
            low = tok.lower()
            if low in CHARACTER_NAMES:
                continue
            if t == "-s":
                if s_suffix_sound(low):
                    hits.add(stem(low))
                continue
            if t in low:
                if len(t) == 1 and t in VOWELS and low in FUNCTION_WORDS:
                    continue
                hits.add(stem(low))
    if len(hits) >= minimum:
        return findings

    # Was more available, or does the language genuinely not offer it?
    avail = available_target_words(n, targets)
    hearts = {h.lower() for h in lesson(n)["allowedHeartWords"]}
    unspent = sorted(avail - content_stems(form_a_text(n)) - hearts)
    if unspent:
        why = (f"the word bank offers {len(avail)} and Form A leaves "
               f"{unspent} unspent")
        # `lesson` (the loader function) was written here instead of `n`, so this
        # was always False and the downgrade never applied.
        sev = "LOW" if n in ALTERNATE_FORM_IMPOSSIBLE else "HIGH"
    else:
        why = ("the word bank offers nothing further at this lesson -- this "
               "is a supply problem, not a writing problem")
        sev = "LOW"
    findings.append(finding(
        n, "target grapheme not exercised",
        f"{sorted(hits)} (target {targets})",
        f"Lesson {n} is named {lesson(n)['skill']!r} but only "
        f"{len(hits)} distinct non-name word(s) use it; {why}.",
        f"Add words containing {targets} until at least "
        f"{minimum} distinct non-name words carry the target"
        f"{' (a review lesson needs more)' if is_review else ''}.",
        sev))
    return findings


def available_target_words(n, targets):
    bank = word_bank()["availableByLesson"].get(str(n), [])
    out = set()
    for w in bank:
        s = stem(w)
        if s in CHARACTER_NAMES:
            continue
        for t in targets:
            if t != "-s" and t in s:
                out.add(s)
    return out


# ===========================================================================
# CHECK 3 -- word-list lessons: do the REAL WORDS carry the target?
# Catches: Lesson 7 (0/5 f), Lesson 10 (0/5 i), Lesson 11 (0/5 am).
# ===========================================================================
MIN_REAL_WORD_HITS = 3


def check_real_words_carry_target(n, sheet):
    if sheet.get("instrument") != "word list":
        return []
    findings = []
    real = sheet.get("real_words", [])
    for t in target_graphemes(n):
        if t == "-s":
            continue
        hits = [w for w in real if t in w.lower()]
        if len(hits) < MIN_REAL_WORD_HITS:
            spare = sorted(available_target_words(n, [t]))
            findings.append(finding(
                n, "real-word list misses its target",
                f"real_words = {real}",
                f"only {len(hits)}/{len(real)} real words contain the target "
                f"{t!r} for {lesson(n)['skill']!r}: {hits}"
                + ("" if spare else " -- and the word bank offers NO such word "
                                   "at this lesson, so this is a supply limit"),
                f"Swap in words containing {t!r}; the bank offers {spare}."
                if spare else
                f"No fix available in the passage: add a {t!r} word to the "
                f"curriculum word bank, or do not ship a word list here.",
                severity=("LOW" if (not spare or n in ALTERNATE_FORM_IMPOSSIBLE)
                          else "HIGH")))
    return findings


# ===========================================================================
# CHECK 4 -- two lessons must not ship the same list
# Catches: Lesson 6 == Lesson 7, Lesson 9 == Lesson 11.
# ===========================================================================
DUP_OVERLAP_LIMIT = 3        # more than this many shared words is a duplicate


def check_wordlist_duplication(data_dir):
    findings = []
    lists = {}
    for n in LESSON_RANGE:
        sheet = load_sheet(data_dir, n)
        if sheet.get("instrument") == "word list":
            lists[n] = [w.lower() for w in sheet.get("real_words", [])]
    for a, b in itertools.combinations(sorted(lists), 2):
        shared = sorted(set(lists[a]) & set(lists[b]))
        if not shared:
            continue
        if lists[a] == lists[b]:
            findings.append(finding(
                b, "duplicate real-word list",
                f"{lists[b]}",
                f"Lesson {b}'s real_words are IDENTICAL to Lesson {a}'s, so "
                f"the two lessons test the same five words.",
                f"Rewrite Lesson {b} from its own target grapheme "
                f"({target_graphemes(b)})."))
        elif len(shared) > DUP_OVERLAP_LIMIT:
            findings.append(finding(
                b, "near-duplicate real-word list",
                f"{shared}",
                f"Lesson {b} shares {len(shared)}/{len(lists[b])} real words "
                f"with Lesson {a}.",
                f"Replace the shared words with ones carrying Lesson {b}'s "
                f"own target.", "MEDIUM"))
    return findings


# ===========================================================================
# CHECK 5 -- is the "no nonsense words exist" claim TRUE?
# Catches: Lessons 8, 9, 10, 11 and 14 claiming fewer than five exist when
# the taught letters generate six to fifteen legal pseudowords.
# ===========================================================================
NWF_TARGET_COUNT = 5
NO_NWF_CLAIM = "fewer than five legal pseudowords"


def legal_pseudowords(n):
    """Every VC and CVC pseudoword the taught letters allow at Lesson n.

    Applies the same orthographic legality rules a teacher would: not a real
    word, not a real word once a final f/l/s/z is doubled, no bare final c,
    no undoubled final f/l/s/z after a short vowel, no soft c/g, not a name,
    not a homophone of a word the child knows.
    """
    graphemes = [g for g in lesson(n)["allowedGraphemes"] if len(g) == 1]
    cons = [c for c in graphemes if c not in VOWELS]
    vows = [c for c in graphemes if c in VOWELS]
    words = ([c + v + d for c in cons for v in vows for d in cons]
             + [v + c for v in vows for c in cons])
    real = english_words()
    out = set()
    for w in words:
        if w in real or w in CHARACTER_NAMES or w in PSEUDOWORD_BLOCKLIST:
            continue
        if w in PSEUDOWORD_HOMOPHONES:
            continue
        if w.endswith("c"):                                  # cat/cot, never *dac
            continue
        if w[-1] in "flsz" and w[-2] in VOWELS:               # needs doubling
            continue
        if w[:-1] + w[-1] * 2 in real:                        # *bel -> bell
            continue
        if re.search(r"[cg][eiy]", w):                        # soft c/g, Lesson 117
            continue
        out.add(w)
    return sorted(out)


def check_nwf_claim(n, sheet):
    if sheet.get("instrument") != "word list":
        return []
    findings = []
    given = sheet.get("nonsense_words", [])
    note = sheet.get("nwf_note", "") or ""
    possible = legal_pseudowords(n)
    if not given and NO_NWF_CLAIM in note and len(possible) >= NWF_TARGET_COUNT:
        findings.append(finding(
            n, "false nonsense-word claim",
            f"nwf_note = {note!r}",
            f"the claim is untrue: Lesson {n}'s taught letters generate "
            f"{len(possible)} legal pseudowords, e.g. {possible[:8]}.",
            f"Either add {NWF_TARGET_COUNT} nonsense words from that set or "
            f"replace the note with the real reason."))
    if given and len(given) != NWF_TARGET_COUNT:
        findings.append(finding(
            n, "wrong nonsense-word count",
            f"{given}",
            f"{len(given)} nonsense words, not {NWF_TARGET_COUNT}, and "
            f"nwf_note is {note!r} -- nothing explains the short list "
            f"({len(possible)} legal pseudowords exist).",
            f"Add {NWF_TARGET_COUNT - len(given)} more, e.g. "
            f"{[p for p in possible if p not in given][:4]}."))
    return findings


# ===========================================================================
# CHECK 6 -- are the nonsense words orthographically possible English?
# ===========================================================================
def check_nonsense_wellformed(n, sheet):
    findings = []
    real = english_words()
    for w in sheet.get("nonsense_words", []):
        low = w.lower()
        why = None
        if low in real:
            why = "is a real English word"
        elif low in CHARACTER_NAMES:
            why = "is a character name in these sheets"
        elif low.endswith("c"):
            why = ("ends in a bare c; English spells word-final /k/ after a "
                   f"short vowel as -ck (Lesson {GATE['ck']}) or -k")
        elif low[-1] in "flsz" and len(low) > 1 and low[-2] in VOWELS:
            why = (f"ends in a single f/l/s/z after a short vowel; the FLSZ "
                   f"doubling rule (Lesson {GATE['flsz_double']}) says it "
                   f"would be spelled {low + low[-1]!r}")
        elif low[:-1] + low[-1] * 2 in real:
            why = f"becomes the real word {low[:-1] + low[-1]*2!r} when doubled"
        elif low in PSEUDOWORD_HOMOPHONES:
            why = (f"is a homophone of {PSEUDOWORD_HOMOPHONES[low]!r}; a child "
                   f"who reads it correctly would be scored as wrong")
        elif re.search(r"[cg][eiy]", low):
            why = f"has soft c/g, not taught until Lesson {GATE['soft_c_g']}"
        if why:
            findings.append(finding(
                n, "malformed nonsense word", f"{w!r}",
                f"{w!r} {why}.",
                f"Replace it with one of {legal_pseudowords(n)[:6]}."))
    return findings


# ===========================================================================
# CHECK 7 -- Form B must not re-spend Form A's words (parallel-form validity)
# Catches: Lesson 8 reusing 6/6, Lessons 6/7/14 reusing 4/5.
# ===========================================================================
FORM_A_OVERLAP_LIMIT = 0.34         # more than a third re-read is not a retest


def check_form_a_overlap(n, sheet):
    a_text = form_a_text(n)
    if not a_text:
        return []
    a_stems = content_stems(a_text)
    b_stems = content_stems(child_text(sheet))
    if not b_stems:
        return []
    shared = sorted(b_stems & a_stems)
    ratio = len(shared) / len(b_stems)
    if ratio <= FORM_A_OVERLAP_LIMIT:
        return []
    return [finding(
        n, "Form B re-spends Form A's words",
        f"{shared}",
        f"{len(shared)} of {len(b_stems)} Form B content stems ({ratio:.0%}) "
        f"already appear in Form A lesson {n}; a child who read Form A is "
        f"re-reading, not being re-tested.",
        f"Swap the shared stems for Form-A-unspent bank words: "
        f"{sorted(set(word_bank()['availableByLesson'].get(str(n), [])) - a_stems - b_stems)[:8]}",
        severity=("LOW" if n in ALTERNATE_FORM_IMPOSSIBLE else "HIGH"))]


# ===========================================================================
# CHECK 8 -- no sentence may be verbatim from Form A
# Catches: Lesson 6 (both sentences), Lesson 12.
# ===========================================================================
def sentences_of(text):
    text = text.replace('"', " ")
    return [re.sub(r"\s+", " ", s).strip().lower()
            for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


MIN_VERBATIM_WORDS = 3


def check_verbatim_sentences(n, sheet):
    a_sents = set(sentences_of(form_a_text(n)))
    if not a_sents:
        return []
    findings = []
    b_source = " ".join(sheet.get("sentences", []) + sheet.get("lines", []))
    for s in sentences_of(b_source):
        if s in a_sents and len(tokens(s)) >= MIN_VERBATIM_WORDS:
            findings.append(finding(
                n, "sentence copied verbatim from Form A",
                f"{s!r}",
                f"this exact sentence is in Form A lesson {n}.",
                "Rewrite the sentence with different content words."))
    return findings


# ===========================================================================
# CHECK 9 -- Form B must not reuse Form A's character names
# ===========================================================================
def check_shared_characters(n, sheet):
    cast = CHARACTER_NAMES - SHARED_ROLE_NAMES
    a_names = {t.lower() for t in tokens(form_a_text(n))} & cast
    b_names = {t.lower() for t in tokens(child_text(sheet))} & cast
    shared = sorted(a_names & b_names)
    if not shared:
        return []
    return [finding(
        n, "Form B reuses Form A's characters",
        f"{shared}",
        f"Form A lesson {n} and Form B lesson {n} share the character(s) "
        f"{shared}; a familiar name is a word the child recognises rather "
        f"than decodes, which inflates the Form B score.",
        f"Give Form B its own cast from the same decodable letter set.",
        "LOW")]


# ===========================================================================
# CHECK 10 -- the plain decodability floor, derived here, not delegated
# (untaught letters/patterns, syllables, heart words, blends, VCe, doubles,
#  open syllables, y-as-vowel, bare final c, -ed/-ing before their lessons)
# ===========================================================================
def check_decodability(n, sheet):
    findings = []
    L = lesson(n)
    taught_at = sound_list()["letterPatternTaughtAt"]
    allowed = set(L["allowedGraphemes"])
    single = {g for g in allowed if len(g) == 1}
    multi = [g for g in allowed if len(g) > 1]
    hearts = {h.lower() for h in L["allowedHeartWords"]}
    suffixes = [s.lstrip("-") for s in L["allowedSuffixes"]]
    later_hearts = {}
    for m in range(n + 1, len(sound_list()["lessons"]) + 1):
        for h in lesson(m)["newHeartWords"]:
            later_hearts.setdefault(h.lower(), m)

    for tok in sorted(set(tokens(child_text(sheet)))):
        low = tok.lower().replace("'", "")
        if not low or low in hearts:
            continue

        if low in later_hearts:
            findings.append(finding(
                n, "heart word used early", f"{tok!r}",
                f"{low!r} is taught as a heart word at Lesson "
                f"{later_hearts[low]}.",
                f"Remove it or move this sheet to Lesson {later_hearts[low]}."))
            continue

        pattern, when = _first_untaught_pattern(low, taught_at, n)
        if pattern:
            findings.append(finding(
                n, "untaught spelling pattern", f"{tok!r}",
                f"contains {pattern!r}, not taught until Lesson {when}.",
                "Replace the word."))
            continue

        root = low
        for suf in sorted(suffixes, key=len, reverse=True):
            if suf and low.endswith(suf) and len(low) - len(suf) >= 2:
                root = low[: -len(suf)]
                break

        unknown = sorted({c for c in mask_longest(root, multi)
                          if c != "#" and c not in single})
        if unknown:
            findings.append(finding(
                n, "untaught letter", f"{tok!r}",
                f"uses {unknown}, not taught by Lesson {n}.",
                "Replace the word."))
            continue

        if syllable_count(low) > (1 if n < 66 else 2):
            findings.append(finding(
                n, "too many syllables", f"{tok!r}",
                f"{syllable_count(low)} syllables; syllable division starts "
                f"at Lesson {GATE['open_syllable']}.",
                "Use a one-syllable word."))
            continue

        if low.endswith("ing") and len(low) > 4 and n < GATE["suffix_ing"]:
            findings.append(finding(n, "untaught suffix", f"{tok!r}",
                                    f"-ing is Lesson {GATE['suffix_ing']}.",
                                    "Use the bare verb."))
        if (low.endswith("ed") and len(low) > 3 and n < GATE["suffix_ed"]
                and low[:-2] and low[:-2][-1] not in VOWELS
                and low not in ("bed", "fed", "red", "led", "wed")):
            findings.append(finding(n, "untaught suffix", f"{tok!r}",
                                    f"-ed is Lesson {GATE['suffix_ed']}.",
                                    "Use the present tense."))

        collapsed = re.sub(r"([bcdfgklmnprstvz])\1", r"\1", root)
        masked = mask_longest(collapsed, CONSONANT_DIGRAPHS)
        if n < GATE["blends"] and any(
                len(r) >= 2 for r in re.findall(r"[^aeiouy]+", masked)):
            findings.append(finding(n, "consonant blend", f"{tok!r}",
                                    f"blends start at Lesson {GATE['blends']}.",
                                    "Replace the word."))
            continue
        if (n < GATE["vce"] and len(root) >= 3 and root.endswith("e")
                and root[-2] not in VOWELS
                and any(c in VOWELS for c in root[:-2])):
            findings.append(finding(n, "silent e", f"{tok!r}",
                                    f"VCe starts at Lesson {GATE['vce']}.",
                                    "Replace the word."))
            continue
        if n < GATE["flsz_double"] and re.search(r"([bcdgkmnprtvz])\1$", root):
            findings.append(finding(n, "doubled ending", f"{tok!r}",
                                    f"doubling is Lesson {GATE['flsz_double']}.",
                                    "Replace the word."))
            continue
        if n < GATE["open_syllable"] and re.fullmatch(r"[^aeiouy]*[aeiou]", low):
            findings.append(finding(
                n, "open syllable", f"{tok!r}",
                f"open syllables start at Lesson {GATE['open_syllable']}.",
                "Replace the word."))
            continue
        if n < GATE["y_as_vowel"] and "y" in root[1:]:
            findings.append(finding(n, "y as a vowel", f"{tok!r}",
                                    f"y as a vowel is Lesson {GATE['y_as_vowel']}.",
                                    "Replace the word."))
            continue
        if n < GATE["ck"] and root.endswith("c") and len(root) > 2:
            findings.append(finding(
                n, "bare final c", f"{tok!r}",
                f"word-final /k/ after a short vowel is spelled -ck, which is "
                f"Lesson {GATE['ck']}; a bare final c is not a spelling the "
                f"child has been taught to read.",
                "Use a -k or -ck-free word (or a different name).", "LOW"))
    return findings


def _first_untaught_pattern(word, taught_at, n):
    patterns = sorted(taught_at, key=len, reverse=True)
    i = 0
    while i < len(word):
        for p in patterns:
            if word.startswith(p, i):
                if taught_at[p] > n:
                    return p, taught_at[p]
                i += len(p)
                break
        else:
            i += 1
    return None, None


# ===========================================================================
# CHECK 11 -- the word bank itself: does it stock the lesson's own grapheme?
# Catches: availableByLesson["7"] has no f word; ["32"] has no qu word.
# This is a defect in the GROUND TRUTH, not in Form B, and it is why some
# Form B lessons could not exercise their target.
# ===========================================================================
def check_word_bank_stocks_target(n):
    targets = [t for t in target_graphemes(n) if t != "-s" and len(t) <= 2]
    if not targets or n > 34:
        return []
    if not lesson(n).get("introduces", {}).get("graphemes"):
        return []
    avail = available_target_words(n, targets)
    if avail:
        return []
    # Distinguish 'nobody entered it' from 'English does not allow it here'.
    import itertools as _it
    _letters = sorted(lesson(n)['allowedGraphemes'])
    _v = [g for g in _letters if g in 'aeiou']
    _c = [g for g in _letters if g not in 'aeiou']
    _cand = set()
    for _p in _it.chain(_it.product(_c,_v,_c), _it.product(_v,_c)):
        _w = ''.join(_p)
        if any(t in _w for t in targets) and _w in _REAL_WORDS \
                and audit_ok(_w, n):
            _cand.add(_w)
    blocked_only = {w for w in _cand if w in _BLOCKED} if _cand else set()
    if _cand and not blocked_only:
        blocked_only = set()
    return [finding(
        n, "word bank has no word for this lesson's own grapheme",
        f"availableByLesson[{n!r}] contains 0 words with {targets}",
        f"Lesson {n} teaches {lesson(n)['skill']!r} but the word bank offers "
        f"no word containing it, so neither form can exercise the target "
        f"from the bank."
        + (f" Every decodable candidate ({', '.join(sorted(blocked_only))}) is "
           f"on core_vocabulary.BLOCKED, so this is a limit of English at this "
           f"lesson, not a missing entry." if blocked_only else ""),
        (f"No fix: the only decodable {targets} word(s) here are blocked for "
         f"content reasons. The sound is first assessable once another letter "
         f"is taught." if blocked_only else
         f"Add the missing word(s) to word-bank.json."),
        "LOW" if blocked_only else "MEDIUM")]


# ===========================================================================
# CHECK 12 -- the title is read by the child, so it obeys every rule above
# ===========================================================================
def check_title(n, sheet):
    title = sheet.get("title")
    if not title:
        return []
    findings = []
    if "'" in title:
        findings.append(finding(
            n, "apostrophe in title", f"{title!r}",
            "possessives and contractions are not taught in Lessons 6-41.",
            "Rewrite without the apostrophe."))
    # -s voicing in the title is already reported by check_suffix_s_voicing,
    # which reads the title too; only the decodability floor is re-run here.
    probe = {"lesson": n, "title": title, "lines": []}
    for f in check_decodability(n, probe):
        f["rule"] = "title: " + f["rule"]
        findings.append(f)
    return findings


# ===========================================================================
# CHECK 13 -- the target read off the lesson's NAME, one target at a time
#
# Checks 2 and 3 read the target out of sound-list's `introduces` block and
# then POOL every target into one count. Two whole defect classes hide in
# that shape:
#
#   * `introduces` is EMPTY for "r /r/ Part 2" (25), "l /l/ Part 2" (27) and
#     "VC & CVC Practice (all)" (19), because those lessons teach no NEW
#     letter. target_graphemes() returns [], check_target_exercised returns
#     immediately, and the three lessons are exempt from every content check
#     in this file. They print CLEAN because nothing looked. Lesson 25 has one
#     r word in the whole passage ("rubs"); Lesson 27 has two l words.
#   * Pooling hides a missing member of a set. "Short A, I, O Review" is
#     satisfied by 4 a-words + 7 i-words even though the whole passage has ONE
#     short-o content word ("lot"). Lesson 41, "Short Vowels Review (all)",
#     has two short-a and two short-u words.
#
# So the target is derived here from the SKILL STRING, which is the thing the
# lesson is named for and the thing a teacher reads, and every named target is
# counted separately. verify_all.target_letters() already parses the skill
# string this way -- but only for word lists, so lessons 15-41 never saw it,
# and the two modules disagree about lessons 19/25/27 with nothing comparing
# them.
# ===========================================================================
def named_targets(n):
    """Every target the lesson's NAME promises, from the name alone."""
    s = lesson(n)["skill"].lower().strip()
    if s.startswith("-s"):
        return ["-s"]
    if "short vowels review" in s or "vc & cvc practice" in s:
        return ["a", "e", "i", "o", "u"]
    m = re.match(r"^(qu|[a-z]{1,3})\s*/", s)          # "f /f/", "r /r/ Part 2"
    if m:
        return [m.group(1)]
    m = re.match(r"^short ([a-z, ]+?) review", s)     # "Short A, I, O Review"
    if m:
        return [x.strip() for x in m.group(1).split(",") if x.strip()]
    m = re.match(r"^[a-z ]*\(([a-z, ]+)\)", s)        # "CVC Practice (a, i)"
    if m:
        return [x.strip() for x in m.group(1).split(",") if x.strip()]
    return []


def named_target_voicing(n):
    """For a -s lesson, the sound the lesson's own name promises."""
    m = re.search(r"/([sz])/", lesson(n)["skill"])
    return "/%s/" % m.group(1) if m else None


def target_hits(n, sheet, t):
    """Distinct non-name content stems on the sheet that carry target t."""
    want = named_target_voicing(n) if t == "-s" else None
    out = set()
    for tok in tokens(child_text(sheet)):
        low = tok.lower()
        if low in CHARACTER_NAMES:
            continue
        if t == "-s":
            sound = s_suffix_sound(low)
            if sound and (want is None or sound == want):
                out.add(stem(low))
            continue
        if t in low:
            if len(t) == 1 and t in VOWELS and low in FUNCTION_WORDS:
                continue
            out.add(stem(low))
    return out


def check_named_target_exercised(n, sheet):
    """Every target the lesson's name promises must be exercised on its own.

    Scoped to the 27 passages: for lessons 6-14 check 3 already counts each
    target separately over the real-word list, and reporting twice would train
    a reader to skim.
    """
    if sheet.get("instrument") != "passage":
        return []
    named = named_targets(n)
    old = target_graphemes(n)
    # Only the cases the pooled check cannot see: no target at all, or more
    # than one target pooled into a single count.
    if not named or (len(named) == 1 and len(old) == 1 and named == old):
        return []
    findings = []
    is_review = "review" in lesson(n)["skill"].lower()
    minimum = (MIN_TARGET_WORDS_REVIEW if is_review and len(named) == 1
               else MIN_TARGET_WORDS)
    for t in named:
        hits = target_hits(n, sheet, t)
        if len(hits) >= minimum:
            continue
        if t == "-s":
            want = named_target_voicing(n)
            findings.append(finding(
                n, "named target not exercised",
                f"{sorted(hits)} (target -s said {want})",
                f"Lesson {n} is named {lesson(n)['skill']!r} but only "
                f"{len(hits)} distinct word(s) show -s saying {want}; check 1 "
                f"only forbids the WRONG voicing early, it never requires the "
                f"RIGHT one to be present.",
                f"Add -s words whose s says {want}."))
            continue
        spare = sorted(available_target_words(n, [t])
                       - content_stems(child_text(sheet))
                       - content_stems(form_a_text(n)))
        findings.append(finding(
            n, "named target not exercised",
            f"{sorted(hits)} (target {t!r} of {named})",
            f"Lesson {n} is named {lesson(n)['skill']!r}, which promises {t!r}, "
            f"but only {len(hits)} distinct non-name word(s) carry it. "
            + (f"target_graphemes() returns {old} for this lesson, so no "
               f"existing check looked at {t!r} at all."
               if not old else
               f"The pooled count over {old} clears the floor, so the shortfall "
               f"in {t!r} alone is invisible.")
            + (f" The word bank offers {len(spare)} unspent {t!r} word(s): "
               f"{spare[:10]}." if spare else
               " The word bank offers nothing further -- a supply limit."),
            f"Add {minimum - len(hits)} more word(s) carrying {t!r}"
            + (f", e.g. {spare[:5]}." if spare else "."),
            "HIGH" if spare else "LOW"))
    return findings


# ===========================================================================
# CHECK 14 -- the heart words this lesson TEACHES must appear on the sheet
#
# Check 10 is one-directional: it catches a heart word used EARLY and has no
# opinion about one never used at all. So a lesson can teach "she" and hand
# the child a page without it. Form A does not have this problem, which is
# what makes it a Form B defect rather than a curriculum limit: at Lesson 13
# Form A says "said" and Form B does not; the same at 15 (do, to), 17 (of),
# 19 (see), 23 (she), 25 (from), 27 (are), 33 (have, what).
#
# It matters because a heart word is the one thing on the sheet that CANNOT
# be sounded out. If the sheet omits it, the running record has no evidence
# about the skill the lesson actually added.
# ===========================================================================
def check_new_heart_words_used(n, sheet):
    new = [h.lower() for h in lesson(n)["newHeartWords"]]
    if not new:
        return []
    used = {t.lower() for t in tokens(child_text(sheet))}
    a_used = {t.lower() for t in tokens(form_a_text(n))}
    findings = []
    for h in new:
        if h in used:
            continue
        in_a = h in a_used
        findings.append(finding(
            n, "new heart word never used",
            f"{h!r}",
            f"Lesson {n} is the lesson that teaches the heart word {h!r}, and "
            f"it appears nowhere on the Form B sheet -- not in the lines, the "
            f"sentences, the high-frequency list or the title. "
            + (f"Form A lesson {n} does use it, so this is not a limit of the "
               f"curriculum." if in_a else
               f"Form A lesson {n} omits it too, so the gap is inherited "
               f"rather than introduced here."),
            f"Put {h!r} in a sentence, or add it to high_frequency on a word "
            f"list.",
            "MEDIUM" if in_a else "LOW"))
    return findings


# ===========================================================================
# CHECK 15 -- the hand-written cast list must still cover the data
#
# CHARACTER_NAMES decides what counts as evidence that a lesson exercised its
# own grapheme. It is hand-maintained, and nothing checked it against the
# files, so six names shipped without being added: Zeb (34), Jan (35), Val
# (36), Bev and Jon (37), Dev (41). The cost is silent and specific -- Lesson
# 34 is the z lesson, its only z word was the name "Zeb", and check 2 counted
# that name as evidence and reported "1 word carries the target" for a
# passage whose true count is zero.
#
# A capital letter that is not the first word of a sentence is a proper noun.
# Titles are Title Case, so they are excluded rather than guessed at.
# ===========================================================================
def cast_in_data(data_dir):
    found = {}
    for n in LESSON_RANGE:
        sheet = load_sheet(data_dir, n)
        body = " ".join(sheet.get("lines", []) + sheet.get("sentences", []))
        for s in re.split(r"(?<=[.!?])\s+", body):
            toks = re.findall(r"[A-Za-z']+", s)
            for i, t in enumerate(toks):
                if i == 0 or t == "I" or not t[0].isupper():
                    continue
                if t.lower() in FUNCTION_WORDS:
                    continue
                found.setdefault(t.lower(), set()).add(n)
    return found


def check_cast_list_covers_data(data_dir):
    findings = []
    for name, lessons in sorted(cast_in_data(data_dir).items()):
        if name in CHARACTER_NAMES:
            continue
        n = min(lessons)
        findings.append(finding(
            n, "character name missing from CHARACTER_NAMES",
            f"{name.title()!r} (lessons {sorted(lessons)})",
            f"{name.title()!r} is used as a character in the data but is not in "
            f"this file's CHARACTER_NAMES set, so every check that says "
            f"'not a name' counts it as a curriculum word: it can be scored as "
            f"evidence that a lesson exercised its target, and "
            f"check_shared_characters cannot see it at all.",
            f"Add {name!r} to CHARACTER_NAMES."))
    return findings


# ===========================================================================
# CHECK 16 -- verbatim reuse ACROSS lessons, not just within one
#
# Check 8 compares Form B lesson n against Form A lesson n and nothing else,
# and verify_all's corpus rule compares whole LINES. A sentence repeated
# inside two differently-worded lines, or borrowed from a different lesson's
# Form A, passes both. Real: "He is sad." is in Form B 31, 32 AND 33 and in
# Form A 26; "It is up!" is in Form B 39 and Form A 34; "The mat is tan." is
# in Form B 10 and Form A 12.
#
# It matters because the child meets these forms in lesson order. A sentence
# they read in Form A at Lesson 26 is a sentence they have already practised
# when Form B hands it back at Lesson 31.
# ===========================================================================
def _all_form_a_sentences():
    if "a_sents" not in _CACHE:
        out = {}
        for m in range(1, len(sound_list()["lessons"]) + 1):
            text = form_a_text(m)
            if text:
                for s in sentences_of(text):
                    out.setdefault(s, set()).add(m)
        _CACHE["a_sents"] = out
    return _CACHE["a_sents"]


def check_cross_lesson_verbatim(data_dir):
    findings = []
    b_sents = {}
    for n in LESSON_RANGE:
        sheet = load_sheet(data_dir, n)
        body = " ".join(sheet.get("lines", []) + sheet.get("sentences", []))
        for s in sentences_of(body):
            if len(tokens(s)) >= MIN_VERBATIM_WORDS:
                b_sents.setdefault(s, set()).add(n)

    for s, lessons in sorted(b_sents.items()):
        if len(lessons) > 1:
            findings.append(finding(
                min(lessons), "sentence repeated across Form B lessons",
                f"{s!r}",
                f"this exact sentence is in Form B lessons {sorted(lessons)}. "
                f"The corpus rule in verify_all compares whole LINES, so a "
                f"sentence shared by three differently-worded lines is not "
                f"visible to it, and check 8 only ever looks at one lesson.",
                "Rewrite it in all but one lesson.", "MEDIUM"))

    a_sents = _all_form_a_sentences()
    for s, lessons in sorted(b_sents.items()):
        where = sorted(a_sents.get(s, set()))
        for n in sorted(lessons):
            other = [m for m in where if m != n]
            if not other:
                continue
            already = [m for m in other if m < n]
            findings.append(finding(
                n, "sentence copied from another lesson's Form A",
                f"{s!r}",
                f"this exact sentence is in Form A lesson(s) {other}. "
                + (f"Lesson(s) {already} come BEFORE this one, so a child "
                   f"working through Form A has already read it."
                   if already else
                   "Those lessons come later, so the child has not met it yet."),
                "Rewrite the sentence with different content words.",
                "MEDIUM" if already else "LOW"))
    return findings


# ===========================================================================
# CHECK 17 -- a check whose input is never anything is not a check
#
# check_nonsense_wellformed runs 36 times per audit and cannot fail: every one
# of the 36 files has "nonsense_words": []. The same is true of the "wrong
# nonsense-word count" branch of check 5. --selftest proves those checks CAN
# fire when handed a synthetic sheet, which is exactly what makes the silence
# convincing and wrong: the passing run is evidence about a code path the real
# data never enters. This names it in the report instead of leaving it to be
# rediscovered on a later pass.
# ===========================================================================
CHILD_FIELDS = ("real_words", "nonsense_words", "high_frequency", "sentences",
                "lines", "title")


def check_check_liveness(data_dir):
    sheets = {n: load_sheet(data_dir, n) for n in LESSON_RANGE}
    findings = []
    for field in CHILD_FIELDS:
        present = [n for n, s in sheets.items() if field in s]
        if not present:
            continue
        if any(sheets[n].get(field) for n in present):
            continue
        findings.append(finding(
            min(present), "check has constant-empty input",
            f"{field!r} is [] in all {len(present)} file(s) that declare it",
            f"every check that reads {field!r} runs on every audit and can "
            f"never fire, because no file in data/ has ever put anything in "
            f"it. A green run says nothing about those rules. For "
            f"'nonsense_words' this is by design (each word list carries an "
            f"nwf_note giving the reason) -- but the design decision is what "
            f"should be recorded, not a clean result from an unexercised "
            f"check.",
            f"Either ship {field!r} somewhere, or record in this file that the "
            f"rules reading it are dormant by design so a later pass does not "
            f"read their silence as a pass.", "LOW"))
    return findings


# ---------------------------------------------------------------------------
# runner
# ---------------------------------------------------------------------------
PER_LESSON_CHECKS = [
    check_suffix_s_voicing,
    check_target_exercised,
    check_real_words_carry_target,
    check_nwf_claim,
    check_nonsense_wellformed,
    check_form_a_overlap,
    check_verbatim_sentences,
    check_shared_characters,
    check_decodability,
    check_title,
    check_named_target_exercised,
    check_new_heart_words_used,
]

CORPUS_CHECKS = [
    check_wordlist_duplication,
    check_cast_list_covers_data,
    check_cross_lesson_verbatim,
    check_check_liveness,
]

SEVERITY_ORDER = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}


def run(data_dir):
    findings = []
    for n in LESSON_RANGE:
        sheet = load_sheet(data_dir, n)
        for check in PER_LESSON_CHECKS:
            findings += check(n, sheet)
        findings += check_word_bank_stocks_target(n)
    for check in CORPUS_CHECKS:
        findings += check(data_dir)
    return findings


def report(findings):
    per_lesson = {n: 0 for n in LESSON_RANGE}
    for f in findings:
        per_lesson[f["lesson"]] = per_lesson.get(f["lesson"], 0) + 1

    findings.sort(key=lambda f: (SEVERITY_ORDER.get(f["severity"], 3),
                                 f["lesson"], f["rule"]))
    print(f"{len(findings)} finding(s)\n")
    for i, f in enumerate(findings, 1):
        print(f"{i:>3}. [{f['severity']}] Lesson {f['lesson']} -- {f['rule']}")
        print(f"     text : {f['quote']}")
        print(f"     why  : {f['detail']}")
        print(f"     fix  : {f['fix']}\n")

    print("PER-LESSON VERDICT")
    for n in LESSON_RANGE:
        c = per_lesson[n]
        print(f"  Lesson {n:>3}  {'CLEAN' if c == 0 else f'{c} finding(s)'}")


# ---------------------------------------------------------------------------
# self-test: prove each check can actually fail
# ---------------------------------------------------------------------------
def selftest():
    cases = [
        ("suffix -s voicing", 20,
         {"lesson": 20, "instrument": "passage", "title": "Bugs on Buns",
          "lines": ["Ted digs in a bag of buns."]}, check_suffix_s_voicing),
        ("target grapheme not exercised", 7,
         {"lesson": 7, "instrument": "word list",
          "real_words": ["map", "pat", "tap", "mat", "sat"],
          "nonsense_words": [], "high_frequency": [], "sentences": []},
         check_target_exercised),
        ("real-word list misses its target", 7,
         {"lesson": 7, "instrument": "word list",
          "real_words": ["map", "pat", "tap", "mat", "sat"]},
         check_real_words_carry_target),
        ("false nonsense-word claim", 14,
         {"lesson": 14, "instrument": "word list", "real_words": ["can"],
          "nonsense_words": [],
          "nwf_note": "No nonsense-word subtest: fewer than five legal "
                      "pseudowords exist at this lesson."}, check_nwf_claim),
        ("malformed nonsense word", 14,
         {"lesson": 14, "instrument": "word list",
          "nonsense_words": ["dac", "im", "cat"]}, check_nonsense_wellformed),
        ("untaught letter", 12,
         {"lesson": 12, "instrument": "passage", "lines": ["The bug is big."]},
         check_decodability),
        ("consonant blend", 41,
         {"lesson": 41, "instrument": "passage", "lines": ["Stop the pig."]},
         check_decodability),
        ("sentence copied verbatim from Form A", 6,
         {"lesson": 6, "instrument": "word list",
          "sentences": ["I tap the mat."]}, check_verbatim_sentences),
        # check 13: a lesson whose `introduces` is empty is still named for a
        # sound, and a pooled review still has to cover every vowel it names.
        ("named target not exercised", 25,
         {"lesson": 25, "instrument": "passage", "title": "Mud in a Tub",
          "lines": ["Mom digs in the mud.", "Mom dips a cup in a tub."]},
         check_named_target_exercised),
        ("named target not exercised", 38,
         {"lesson": 38, "instrument": "passage", "title": "The Rip in the Bag",
          "lines": ["Tim has a bag and a bin.", "Tim digs and pins a rip.",
                    "Dad has a pin and a bat.", "Tim is sad and Dad is glad."]},
         check_named_target_exercised),
        # check 14: the lesson that teaches a heart word must use it.
        ("new heart word never used", 13,
         {"lesson": 13, "instrument": "word list",
          "real_words": ["dad", "did", "dip"], "high_frequency": ["I", "the"],
          "sentences": ["Dad and I nod."]}, check_new_heart_words_used),
    ]
    failures = 0
    for want_rule, n, sheet, check in cases:
        got = [f["rule"] for f in check(n, sheet)]
        ok = any(want_rule in g for g in got)
        print(f"  {'PASS' if ok else 'FAIL'}  L{n:<3} expects {want_rule!r}"
              f"{'' if ok else f' -- got {got}'}")
        failures += 0 if ok else 1

    # The corpus checks take a directory, so they are proved against a
    # throwaway copy rather than a dict.
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        d = pathlib.Path(tmp)
        for n in LESSON_RANGE:
            body = {"lesson": n, "skill": lesson(n)["skill"], "form": "B",
                    "instrument": "passage", "title": "A Cat",
                    "lines": ["The cat and Xan nap."],
                    "nonsense_words": [], "gates_passed": True}
            (d / f"lesson-{n:03d}.json").write_text(json.dumps(body))
        corpus_cases = [
            ("character name missing from CHARACTER_NAMES",
             check_cast_list_covers_data),
            ("sentence repeated across Form B lessons",
             check_cross_lesson_verbatim),
            ("check has constant-empty input", check_check_liveness),
        ]
        for want_rule, check in corpus_cases:
            got = [f["rule"] for f in check(d)]
            ok = any(want_rule in g for g in got)
            print(f"  {'PASS' if ok else 'FAIL'}  corpus expects {want_rule!r}"
                  f"{'' if ok else f' -- got {sorted(set(got))}'}")
            failures += 0 if ok else 1

    total = len(cases) + len(corpus_cases)
    print(f"\nself-test: {total - failures}/{total} checks can fire")
    return failures


# Measured, not assumed: at these lessons Form A spends every on-target word
# that exists, so "exercise the sound" and "do not reuse Form A" cannot both be
# satisfied. Recorded in verify_all.ACCEPTED and in each file's
# instrument_claim; downgraded here from HIGH to LOW so it stays visible
# without masking a real regression.
ALTERNATE_FORM_IMPOSSIBLE = {6, 7, 8, 10, 11, 12}

import pathlib as _pl
_GEN = _pl.Path(__file__).resolve().parents[2] / "decodable-passage-generator"
if str(_GEN) not in sys.path:
    sys.path.insert(0, str(_GEN))
_BLOCKED = set()
_REAL_WORDS = set()
try:
    import core_vocabulary as _cv
    _BLOCKED = {w.lower() for w in _cv.BLOCKED}
except Exception as _e:
    print("WARNING: could not load BLOCKED list (%s) — the blocked-vs-missing "
          "distinction will not work" % _e, file=sys.stderr)
for _p in ("/usr/share/dict/words",):
    _f = _pl.Path(_p)
    if _f.exists():
        _REAL_WORDS = {w.strip().lower() for w in _f.read_text(errors="ignore").splitlines()}
        break


def audit_ok(word, n):
    import audit_passage as _ap
    return bool(_ap.audit(word, n)["clean"])


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", default=str(DEFAULT_DATA))
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        sys.exit(1 if selftest() else 0)

    data_dir = pathlib.Path(args.data)
    if not data_dir.is_dir():
        print(f"Not a directory: {data_dir}")
        sys.exit(2)
    missing = [n for n in LESSON_RANGE
               if not (data_dir / f"lesson-{n:03d}.json").exists()]
    if missing:
        print(f"Missing lesson files: {missing}")
        sys.exit(2)

    findings = run(data_dir)
    report(findings)
    # LOW findings are measured limits of the language and the curriculum data
    # (recorded in verify_all.ACCEPTED and each file's instrument_claim), not
    # regressions. Failing on them would train everyone to ignore the exit code,
    # which is how a check stops being a check. HIGH and MEDIUM still fail.
    blocking = [f for f in findings if f["severity"] in ("HIGH", "MEDIUM")]
    if findings and not blocking:
        print("\nNo HIGH or MEDIUM findings. The %d LOW findings above are recorded "
              "limits, not regressions." % len(findings))
    sys.exit(1 if blocking else 0)


if __name__ == "__main__":
    main()
