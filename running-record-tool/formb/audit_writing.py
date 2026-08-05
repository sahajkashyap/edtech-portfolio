#!/usr/bin/env python3
"""THE WRITING RULES, EXECUTED.

    python3 audit_writing.py              # every lesson
    python3 audit_writing.py 22 31        # just these
    python3 audit_writing.py --selftest   # prove every check can still refuse
    python3 audit_writing.py --strict     # REVIEW findings fail too

Why this file exists
--------------------
WRITING-RULES.md was written on 2026-08-04 out of an exhaustive audit of all 294
sentences. It contains 53 numbered rules, 18 of them marked **[MECHANICAL]**,
and each mechanical rule ships with the check that would enforce it. It even
says where those checks belong.

Nobody built them. For one day the document sat in the repo enforced by nothing,
and a session rewrote twelve passages without opening it -- reintroducing, among
other things, the exact `tug the tub` defect that rule 3.1 names by lesson
number. Then an independent sweep held all 36 lessons against the document and
found 337 problems, most of them older than that session: the standard had been
a diagnosis of this corpus from the day it was written, and the diagnosis was
never acted on.

A rule that depends on somebody remembering is not a rule. This file turns the
mechanical ones into checks that cannot be forgotten, using the document's own
suggested implementations. The judgement rules (story shape, register, sense)
stay human, and are listed at the bottom of a run so nobody mistakes a green
mechanical pass for a green page.

Severity
--------
  BLOCK   the child cannot read it as written, or it corrupts the score
  HIGH    a real defect a reader will hit
  REVIEW  a judgement call, printed, never fails unless --strict
"""

import argparse
import collections
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE / "data"
GENERATOR = HERE.parent.parent / "decodable-passage-generator"

sys.path.insert(0, str(HERE))
from audit_child import CAST                      # noqa: E402
from audit_curriculum import FUNCTION_WORDS       # noqa: E402

# Rule 4.1 whitelists these: they are unique in the child's world and take
# `the` (or a bare name) on first mention without confusing anyone.
# Rule 4.1 whitelists Mom, Dad and the sun. The reason those three are exempt
# is that they have ONE referent in a child's world, so `the` on first mention
# raises no "which one?" -- and that reason applies identically to uncountable
# nouns. "Sid is in the fog" is ordinary English; "Sid is in a fog" is not. You
# cannot count mud, and a child never wonders WHICH mud.
#
# This is a linguistic class, not a convenience: every word below is a mass noun
# with no plural in this vocabulary. Count nouns stay under the rule, which is
# where all six of the document's own examples (nuts, jug, bus, mat, cobs, log)
# sit.
DEFINITE_OK = {"mom", "dad", "sun", "i",
               "mud", "fog", "jam", "wax", "gum", "ham", "fun", "mist", "dust",
               "grass", "sand", "rain", "wind", "milk", "air", "wet"}

# Rule 1.2's replacement list, kept here so the message can suggest one.
IRREGULAR_PASTS = ("sat got had fed set cut put let hid bit ran dug was hit "
                   "met fit did").split()

PARTICLES = ("up", "down", "in", "out", "off", "on")

# The noun ledger has to skip adjectives, or "a red tin" registers the noun as
# `red` and every later "the red ..." is reported as an unintroduced noun. The
# vocabulary below Lesson 41 is tiny and closed, so listing them is exact rather
# than a guess.
ADJECTIVES = {"big", "red", "tan", "hot", "wet", "sad", "mad", "dim", "fat",
              "bad", "top", "six", "ten", "wee", "old", "new", "fun", "hot",
              "big", "little", "lots", "his", "her", "its"}

SIBILANT_END = re.compile(r"(s|z|ss|zz|ce|se)$")

# Sign-off, same contract as audit_child.ACCEPTED: a finding listed here has
# been read by a person and kept, with the measurement written beside it. Keyed
# "lesson:rule:item". dead_signoffs() below fails if an entry stops matching, so
# an exemption cannot outlive the thing it exempts.
ACCEPTED = {
    "22:target:k": (
        "Arithmetically forced, and measured rather than argued. Lesson 22 is "
        "named k /k/; the entire decodable vocabulary at that lesson contains "
        "exactly two k words, 'kid' and 'kids'; Form A lesson 22 spends both, "
        "plus the name 'Kip'. Putting either back into Form B was tried and "
        "gate 3 refuses it: 'kids' scores 9% content-word overlap against a 5% "
        "ceiling. So 'exercise the taught sound' and 'do not re-read what the "
        "child practised' cannot both hold here. The score for Lesson 22 "
        "therefore measures short-vowel decoding, NOT /k/ — an examiner reading "
        "it as a k check is reading it wrong. Fixing this needs a k word added "
        "to the curriculum data upstream, which is a separate decision."),
    "6:4.1:the map": (
        "Forced by the curriculum, not by the writing. Rule 4.1 says a first "
        "mention takes 'a' -- but 'a' is not a taught word at Lesson 6. The "
        "heart words are 'and', 'I' and 'the'; 'a' arrives at Lesson 7. So at "
        "this one lesson every first mention must take 'the' or take no article "
        "at all, and the legal vocabulary (am at map mat pat sat tap) offers no "
        "article-free sentence that is not also a 9.1 rhyme. Resolved at L7 and "
        "everywhere after."),
    "6:4.1:the mat": (
        "Same as 6:4.1:the map -- 'a' is not taught until Lesson 7."),
    "34:target:z": (
        "The same arithmetic as Lesson 22, measured the same way. Lesson 34 is "
        "named z /z/; the decodable vocabulary there contains exactly two z "
        "words, 'zip' and 'zips'; Form A lesson 34 spends both, plus 'zig' and "
        "'zag'. The only other z on the page is in the names Liz and Zeb, and a "
        "name is not evidence a child decoded a sound. So Lesson 34's score "
        "measures short-vowel decoding, NOT /z/, and an examiner reading it as "
        "a z check is reading it wrong. Fixing it means adding a z word to the "
        "curriculum data upstream, which is a separate decision."),
}
ACCEPTED_USED = set()


def dead_signoffs():
    return sorted(set(ACCEPTED) - ACCEPTED_USED)


def words(text):
    return re.findall(r"[a-z']+", text.lower())


def content(text):
    return [w for w in words(text) if w not in FUNCTION_WORDS and w not in CAST]


def sentences(text):
    """Split on terminal punctuation, keeping quoted sentences whole enough."""
    return [s.strip() for s in re.split(r"(?<=[.!?])[\"']?\s+", text) if s.strip()]


def hamming1(a, b):
    return len(a) == len(b) and sum(x != y for x, y in zip(a, b)) == 1


def rhymes(a, b):
    return (len(a) == 3 and len(b) == 3 and a[1:] == b[1:] and a[0] != b[0])


# ---------------------------------------------------------------------------
# per-passage checks
# ---------------------------------------------------------------------------
def rule_1_2(doc, add):
    """`did` + base verb as plain narrative past. Expected count: zero."""
    for i, line in enumerate(doc["lines"]):
        # `did the wax` is did + NOUN PHRASE ("performed the waxing"), which is
        # ordinary English. The rule is about did + BASE VERB used as the plain
        # past ("did cut"), so anything that cannot be a bare verb is skipped.
        NOT_A_VERB = {"not", "a", "an", "the", "it", "this", "that", "his",
                      "her", "my", "so", "too", "well", "you", "he", "she"}
        for m in re.finditer(r"\bdid (?!not\b)([a-z]+)\b", line, re.I):
            if m.group(1).lower() in NOT_A_VERB:
                continue
            add("BLOCK", "1.2", m.group(0),
                "`did %s` is the emphatic, not the plain past. Use an irregular "
                "past that is already decodable (%s)."
                % (m.group(1), ", ".join(IRREGULAR_PASTS[:8])), i, line)


def rule_1_5(doc, add):
    """Inverted subject and verb: a particle opening straight into a verb."""
    for i, line in enumerate(doc["lines"]):
        for s in sentences(line):
            w = words(s)
            if len(w) >= 2 and w[0] in PARTICLES and w[1].endswith("s"):
                add("HIGH", "1.5", " ".join(w[:2]),
                    "inverted subject and verb. Beginning readers parse "
                    "subject-verb-object and stall on anything else.", i, line)


def rule_3_2(doc, add):
    """Objects do not `sit`. The subject of sit/sits must be a person or animal."""
    animals = {"dog", "dogs", "pup", "pups", "cat", "cats", "rat", "rats", "pig",
               "pigs", "hen", "hens", "fox", "cub", "cubs", "bug", "bugs", "ox",
               "hog", "hogs", "kid", "kids", "man", "men", "lad", "lads", "it"}
    for i, line in enumerate(doc["lines"]):
        for m in re.finditer(r"\b([a-z]+)\s+(sits?)\b", line, re.I):
            subj = m.group(1).lower()
            if subj in CAST or subj in animals or subj in ("and", "who"):
                continue
            if subj in FUNCTION_WORDS:
                continue
            add("HIGH", "3.2", m.group(0),
                "'%s' is not a person or an animal, and objects do not sit."
                % m.group(1), i, line)


def rule_4_1(doc, add):
    """A noun ledger in reading order. `the X` before X exists; `a X` after."""
    seen = set()
    for i, line in enumerate(doc["lines"]):
        for m in re.finditer(r"\b(a|an|the)\s+((?:[a-z]+\s+){0,2}?[a-z]+)\b",
                             line, re.I):
            det = m.group(1).lower()
            phrase = [w for w in m.group(2).lower().split()
                      if w not in ADJECTIVES]
            if not phrase:
                continue
            noun = phrase[0]
            if noun in DEFINITE_OK or noun in CAST:
                continue
            if det == "the" and noun not in seen:
                add("HIGH", "4.1", "the %s" % noun,
                    "first mention takes 'a'. `the %s` says the reader has "
                    "already met it, and they have not." % noun, i, line)
            elif det in ("a", "an") and noun in seen:
                add("REVIEW", "4.1", "%s %s" % (det, noun),
                    "`%s %s` for a noun already introduced reads as a SECOND "
                    "one. The child cannot tell how many there are." % (det, noun),
                    i, line)
            seen.add(noun)
        # The ledger has to record every noun the reader has MET, not only the
        # ones that arrived behind an article. "Bob and Sid pop buns in a bag"
        # introduces buns with no determiner at all; without this line the next
        # "the buns" reads as a first mention and the check reports a defect
        # that the reader does not experience.
        seen.update(words(line))


def rule_agreement(doc, add):
    """`a` before a plural noun. Not in WRITING-RULES.md because no human writer
    does it -- but an automated article fix did it eight times in one pass, and
    no check in the suite could see it. Machine edits need machine grammar."""
    from audit_curriculum import NOT_PLURALS
    safe = {"is", "was", "has", "its", "this", "us", "yes", "gas", "bus", "less"}
    for i, line in enumerate(doc["lines"]):
        for m in re.finditer(r"\b([Aa]n?)\s+([a-z]+s)\b", line):
            noun = m.group(2)
            if noun in NOT_PLURALS or noun in safe:
                continue
            add("BLOCK", "agreement", m.group(0),
                "singular article on a plural noun. This is not English and a "
                "child reading it aloud has no correct answer to give.", i, line)


def rule_7_6(doc, add):
    """A title may not be a verbatim line, nor a content-word subset of one."""
    title = doc.get("title") or ""
    tw = set(content(title))
    if len(tw) < 2:
        # Too few content words for a subset test to be meaningful -- but a
        # title can still be a line with the articles shuffled. Compare the
        # full word sets instead of giving up.
        twords = set(words(title))
        if len(twords) >= 4:
            for i, line in enumerate(doc["lines"]):
                lw = set(words(line))
                if twords <= lw:
                    add("HIGH", "7.6", title,
                        "every word of the title is in line %d, so the child "
                        "decodes that sentence as a title and then RECALLS it "
                        "as their first scored line." % (i + 1), i, line)
                    return
        return
    if False:
        # A single-content-word title ("The Pot") is a subset of nearly every
        # line by arithmetic, not by spoiling anything. Rule 7.6 is about a
        # title that hands the child a whole line before they read it.
        return
    flat = [re.sub(r"[^a-z ]", "", l.lower()).strip() for l in doc["lines"]]
    if re.sub(r"[^a-z ]", "", title.lower()).strip() in flat:
        add("BLOCK", "7.6", title, "the title is a verbatim line of the passage.",
            0, title)
        return
    for i, line in enumerate(doc["lines"]):
        if tw and tw <= set(content(line)):
            add("HIGH", "7.6", title,
                "the title's content words are a subset of line %d, so the "
                "title tells the child the line before they read it." % (i + 1),
                i, line)
            return


# `the` is excluded from the collision checks. The harm rules 9.1/9.2 describe
# is an UNATTRIBUTABLE miscue -- the teacher cannot tell a decoding failure from
# an eye-slip. `the` is taught as a sight word and appears in nearly every
# sentence in the corpus, so a slip on it is not a decoding datum either way,
# and including it would fire on almost every line while saying nothing. `see`
# and `she` stay in: the document names that pair at L33 by hand.
SIGHT_ONLY = {"the"}


def rule_9_1_9_2_9_3(doc, add):
    """Rhyme, one-phoneme neighbours, and sibilant pile-up, per sentence."""
    for i, line in enumerate(doc["lines"]):
        for s in sentences(line):
            w = [x for x in words(s) if len(x) >= 2 and x not in SIGHT_ONLY]
            for a, b in ((a, b) for j, a in enumerate(w) for b in w[j + 1:]):
                if a == b:
                    continue
                if rhymes(a, b):
                    add("HIGH", "9.1", "%s/%s" % (a, b),
                        "rhyme inside one sentence. A chanting child stops "
                        "decoding and starts predicting.", i, line)
                elif hamming1(a, b) and len(a) >= 3:
                    sev = "BLOCK" if (a in CAST or b in CAST) else "HIGH"
                    add(sev, "9.2", "%s/%s" % (a, b),
                        "one phoneme apart in one sentence%s. A miscue between "
                        "them cannot be attributed."
                        % (" — and one is a character name" if sev == "BLOCK" else ""),
                        i, line)
            sib = [x for x in w if SIBILANT_END.search(x)]
            if len(sib) >= 4:
                add("REVIEW", "9.3", " ".join(sib[:4]),
                    "%d sibilant endings in one sentence; it becomes a "
                    "tongue-twister rather than a decoding task." % len(sib),
                    i, line)


def rule_10_1(doc, add):
    """Near-duplicate lines: >=4 shared content words with <=3 differing."""
    sets = [set(content(l)) for l in doc["lines"]]
    for a in range(len(sets)):
        for b in range(a + 1, len(sets)):
            shared = sets[a] & sets[b]
            differ = (sets[a] | sets[b]) - shared
            if len(shared) >= 4 and len(differ) <= 3:
                add("BLOCK", "10.1", "lines %d & %d" % (a + 1, b + 1),
                    "near-duplicate lines (%d shared content words, %d "
                    "differing). The child recites the second from memory and "
                    "the accuracy score is inflated."
                    % (len(shared), len(differ)), b, doc["lines"][b])


def rule_10_2(doc, add):
    """A plot turn that rides on `not` alone.

    Character names are kept here, unlike everywhere else in this file. content()
    strips them, and that made the check blind to the commonest real resolution
    in the set -- a second character joining in. 'Pip can not tip it up.' and
    'Nan and Pip tip it up.' are not the same line turned by `not`; one of them
    has Nan in it, and Nan is the whole point.
    """
    keep = lambda l: {w for w in words(l) if w not in FUNCTION_WORDS} - {"not"}
    sets = [(keep(l), "not" in words(l)) for l in doc["lines"]]
    for a in range(len(sets)):
        for b in range(a + 1, len(sets)):
            (wa, na), (wb, nb) = sets[a], sets[b]
            if na != nb and len(wa) >= 2 and wa == wb:
                add("BLOCK", "10.2", "lines %d & %d" % (a + 1, b + 1),
                    "the turn rides on the word `not` alone: the two lines are "
                    "identical in content words. `not` is an unstressed "
                    "monosyllable and the commonest thing a tiring reader drops.",
                    b, doc["lines"][b])


def rule_10_3(doc, add):
    """A line is one marking unit: <=10 words, <3 sentences."""
    for i, line in enumerate(doc["lines"]):
        n = len(words(line))
        ns = len(sentences(line))
        if n > 10:
            add("REVIEW", "10.3", "%d words" % n,
                "a line is the teacher's marking unit and the child's return "
                "sweep. Over ten words, both get harder.", i, line)
        if ns >= 3:
            add("REVIEW", "10.3", "%d sentences" % ns,
                "three or more sentences on one line.", i, line)


def rule_target_sound(doc, add):
    """The lesson must contain the sound it is named for.

    Not in WRITING-RULES.md, but the same class: audit_curriculum's target check
    runs only on word lists, so lessons 15-41 have never been asked. Lesson 22
    is named 'k /k/' and contains no k at all.
    """
    skill = (doc.get("skill") or "").lower()
    m = re.match(r"^([a-z]{1,3})\s*/", skill)
    if not m:
        return
    target = m.group(1)
    text = " ".join([doc.get("title", "")] + doc["lines"]).lower()
    hits = {w for w in words(text) if target in w and w not in CAST}
    if not hits:
        add("BLOCK", "target", target,
            "the lesson is named %r and no non-name word in it contains %r. "
            "A child can score full marks having decoded nothing this lesson "
            "is for." % (doc.get("skill"), target), 0, doc.get("title", ""))


PASSAGE_RULES = (rule_1_2, rule_1_5, rule_3_2, rule_4_1, rule_agreement,
                 rule_7_6,
                 rule_9_1_9_2_9_3, rule_10_1, rule_10_2, rule_10_3,
                 rule_target_sound)


# ---------------------------------------------------------------------------
# corpus checks
# ---------------------------------------------------------------------------
def corpus_rules(docs, add_corpus):
    passages = [d for d in docs if d["instrument"] == "passage"]
    if not passages:
        return
    cap = max(1, int(len(passages) * 0.15))

    def frame(line, n=2):
        w = [x for x in words(line) if x not in CAST]
        return " ".join(w[:n])

    for label, pick, rule in (("opening", lambda d: d["lines"][0], "6.8"),
                              ("ending", lambda d: d["lines"][-1], "6.5")):
        counts = collections.Counter(frame(pick(d)) for d in passages)
        for pattern, n in counts.most_common():
            if n > cap and pattern:
                where = [d["lesson"] for d in passages if frame(pick(d)) == pattern]
                add_corpus("HIGH", rule, pattern[:24],
                           "%d of %d passages open the same way (%r) — over the "
                           "15%% cap of %d. L%s."
                           % (n, len(passages), pattern, cap,
                              ",".join(str(x) for x in where))
                           if rule == "6.8" else
                           "%d of %d passages end the same way (%r) — over the "
                           "15%% cap of %d. L%s."
                           % (n, len(passages), pattern, cap,
                              ",".join(str(x) for x in where)))

    # 8.2 -- no Form B sentence may appear anywhere in Form A
    form_a = set()
    sheets = GENERATOR / "sheets"
    if sheets.exists():
        import html as H
        for p in sheets.glob("lesson-*.html"):
            s = p.read_text()
            for m in re.finditer(r'class="ln"[^>]*>(.*?)</', s, re.S):
                line = H.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
                for sent in sentences(line):
                    key = " ".join(words(sent))
                    if len(key.split()) >= 3:
                        form_a.add(key)
    if form_a:
        for d in docs:
            for line in (d.get("lines") or []) + (d.get("sentences") or []):
                for sent in sentences(line):
                    key = " ".join(words(sent))
                    if len(key.split()) >= 3 and key in form_a:
                        add_corpus("BLOCK", "8.2", key[:40],
                                   "L%d ships a sentence that appears verbatim "
                                   "in Form A: %r. A child who practised it is "
                                   "reciting, not decoding." % (d["lesson"], sent))


# ---------------------------------------------------------------------------
def audit(paths):
    docs = [json.loads(p.read_text()) for p in paths]
    found = []
    ACCEPTED_USED.clear()
    for doc in docs:
        # Word lists were skipped entirely -- nine of 36 items, a quarter of the
        # instrument, never met the writing rules. Their `sentences` are read
        # aloud and scored exactly like a passage line, and running rule 9.1
        # over them fires seven times. A checker that silently covers three
        # quarters of the material is worse than none, because the green run
        # says "checked".
        if doc["instrument"] != "passage":
            probe = dict(doc, lines=list(doc.get("sentences") or []),
                         title=doc.get("title") or "")
            if not probe["lines"]:
                continue

            def add_wl(sev, rule, item, why, i, line, _d=doc):
                key = "%d:%s:%s" % (_d["lesson"], rule, item)
                if key in ACCEPTED:
                    ACCEPTED_USED.add(key)
                    return
                found.append({"lesson": _d["lesson"], "severity": sev,
                              "rule": rule, "item": item,
                              "why": "word-list sentence: " + why,
                              "line": i + 1, "text": line})
            for fn in (rule_1_2, rule_1_5, rule_3_2, rule_4_1, rule_agreement,
                       rule_9_1_9_2_9_3, rule_10_3):
                fn(probe, add_wl)
            continue

        def add(sev, rule, item, why, i, line, _d=doc):
            key = "%d:%s:%s" % (_d["lesson"], rule, item)
            if key in ACCEPTED:
                ACCEPTED_USED.add(key)
                return
            found.append({"lesson": _d["lesson"], "severity": sev, "rule": rule,
                          "item": item, "why": why, "line": i + 1, "text": line})
        for fn in PASSAGE_RULES:
            fn(doc, add)

    def add_corpus(sev, rule, item, why):
        found.append({"lesson": 0, "severity": sev, "rule": rule, "item": item,
                      "why": why, "line": 0, "text": ""})
    corpus_rules(docs, add_corpus)

    order = {"BLOCK": 0, "HIGH": 1, "REVIEW": 2}
    found.sort(key=lambda f: (order[f["severity"]], f["lesson"], f["rule"]))
    return found


HUMAN_ONLY = """1.7 invented predicates · 2.1-2.5 pronoun reference · 3.1 the verb
must be what that thing does · 3.3-3.5 sense and physical possibility · 4.2-4.3
props and one-word-one-meaning · 5.1-5.7 story shape · 6.1-6.4, 6.6, 6.7 register
and dialogue · 7.1-7.5 titles · 8.1, 8.3, 8.4 reuse · 9.2 across sentences"""


def selftest():
    """Every check must prove it can still refuse. A green run means nothing
    from a check that cannot fail."""
    P = lambda **kw: dict({"lesson": 99, "instrument": "passage", "skill": "t /t/",
                           "title": "A Title", "lines": []}, **kw)
    cases = [
        ("1.2", P(lines=["Nan did cut up a nut."])),
        ("1.5", P(lines=["Up hops the cat!"])),
        ("3.2", P(lines=["The cap sits on the tub."])),
        ("4.1", P(lines=["Sid tugs the bin."])),
        ("7.6", P(title="The Big Log", lines=["The big log is hot."])),
        ("agreement", P(lines=["Nan sees a bugs on a mat."])),
        ("9.1", P(lines=["The cat is on a mat."])),
        ("9.2", P(lines=["Sid can sit on it."])),
        ("10.1", P(lines=["Nan tips a big red pot up on a hot mat.",
                          "Nan tips a big red pot up on a hot bin."])),
        ("10.2", P(lines=["The pup is on the rug.", "The pup is not on the rug."])),
        ("10.3", P(lines=["Sid and Nan and Bob and Meg and Dot ran up the big hot log."])),
        ("target", P(skill="k /k/", lines=["The bug is on a bud."])),
    ]
    bad = []
    for rule, doc in cases:
        hits = []
        for fn in PASSAGE_RULES:
            fn(doc, lambda s, r, i, w, ln, t: hits.append(r))
        if rule not in hits:
            bad.append("%s did NOT fire on its own example (fired: %s)"
                       % (rule, ", ".join(sorted(set(hits))) or "nothing"))
    # got/hot DO rhyme, so the old "clean" example was not clean. Rule 9.1
    # is right and the example was wrong.
    # "Nan and the Red Tin" was NOT clean: rule 7.6 correctly spotted that the
    # title contains every content word of line 1. The check was right and the
    # example was wrong -- which is the whole reason a self-test exists.
    clean = P(lines=["Nan has a red tin.", "The sun is up."], skill="t /t/",
              title="A Day at the Bin")
    hits = []
    for fn in PASSAGE_RULES:
        fn(clean, lambda s, r, i, w, ln, t: hits.append(r))
    if hits:
        bad.append("a clean passage was flagged by: %s" % ", ".join(sorted(set(hits))))
    print("SELF-TEST: %d checks" % len(cases))
    for b in bad:
        print("  FAIL  %s" % b)
    if not bad:
        print("  every check fired on its own example, and none fired on a clean passage.")
    return 1 if bad else 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("lessons", nargs="*", type=int)
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--table", action="store_true")
    args = ap.parse_args(argv)

    if args.selftest:
        return selftest()

    paths = sorted(DATA.glob("lesson-*.json"))
    if args.lessons:
        paths = [p for p in paths
                 if int(re.search(r"(\d+)", p.stem).group(1)) in args.lessons]
    found = audit(paths)

    if args.table:
        per = collections.Counter(f["lesson"] for f in found)
        for p in paths:
            n = int(re.search(r"(\d+)", p.stem).group(1))
            print("%-6d %s" % (n, per.get(n, 0) or "CLEAN"))
        return 0

    print("THE WRITING RULES -- %d passages\n" % sum(1 for p in paths))
    cur = None
    for f in found:
        if f["severity"] != cur:
            cur = f["severity"]
            print("\n%s\n%s" % (cur, "-" * len(cur)))
        where = "L%-3d" % f["lesson"] if f["lesson"] else "SET "
        print("  %s rule %-6s %-22s %s" % (where, f["rule"], f["item"][:22], f["why"]))
        if f["text"]:
            print("        line %d: %s" % (f["line"], f["text"][:84]))

    c = collections.Counter(f["severity"] for f in found)
    print("\n%d findings: %s" % (len(found), ", ".join(
        "%s %d" % (s, c[s]) for s in ("BLOCK", "HIGH", "REVIEW") if s in c) or "none"))
    print("\nMECHANICAL ONLY. These rules stay human and are NOT checked here:\n  %s"
          % HUMAN_ONLY.replace("\n", "\n  "))

    dead = dead_signoffs() if not args.lessons else []
    if dead:
        print("\nDEAD SIGN-OFFS -- in ACCEPTED, matched no finding: %s"
              % ", ".join(dead))

    # BLOCK fails on its own: the child cannot read it, or the score is wrong.
    # HIGH is a real backlog of 100+ that predates this checker existing, so it
    # is REPORTED here and guarded by verify_all against growing. Silently
    # failing on day one would only teach the next person to stop running it.
    fails = [f for f in found if f["severity"] == "BLOCK"
             or (args.strict and f["severity"] in ("HIGH", "REVIEW"))]
    return 1 if (fails or dead) else 0


if __name__ == "__main__":
    raise SystemExit(main())
