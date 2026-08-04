#!/usr/bin/env python3
"""ONE command that verifies the whole Form B system.

    python3 verify_all.py            # everything; exit 0 only if all clean
    python3 verify_all.py --quiet    # failures only
    python3 verify_all.py --update-manifest   # re-stamp evidence after a clean run

WHY THIS FILE EXISTS
--------------------
Four successive audits of this tool each found NEW defects. Not the same ones
again — new ones. That is not bad luck, it is a structural property of how the
checking was arranged:

  * The checks were scattered. gates.py, quality.py, age_gate.py,
    check_formb.py, corpus_check.py, build_wordlists.py and test_gates.py each
    had to be run by hand, from the right directory, with the right arguments.
    Nothing ran them all. So "did it pass?" had no single answer, and each audit
    happened to run a different subset.
  * The checks were opt-in. check_formb.py only judged a title if you passed
    --title. Nothing ever fed the 36 shipped files back through the gates at
    all — the gates ran on drafts, then the draft became a file and was never
    re-examined.
  * The quality flags were self-asserted. `"gates_passed": true` and
    `"audit_clean": true` are strings in a file. Hand-edit the passage and the
    claim stays true. There was no evidence, no timestamp, no content hash.
  * Some gates could not fail. `cast_of`'s widening rule was one, found on the
    fourth pass. `EQUIV["mean_syllables"]` is another, still shipping: every
    word in lessons 6-41 is one syllable by construction, so that tolerance can
    never be exceeded. A gate nobody has watched reject anything is decoration.
  * Nothing checked whole-corpus properties, so "13 of 27 stories end on It is
    fun" was invisible to a per-passage judge, and still is for anything
    corpus_check.py does not happen to count.
  * The data existed twice. formb/data/*.json and the LESSONS object inside
    index.html held the same content with no build step between them.

So each audit was really a different sample of an unsampled space. This file
turns the space into a fixed, complete, repeatable list, and adds the one thing
that was always missing: a self-test that proves each gate can still REJECT.

WHAT IT RUNS
------------
  1  environment          the gates' own dependencies are present and working
  2  schema + hygiene     every field of every file, plus formatting
  3  passage gates        all 27 passages back through gates 1-6
  4  word-list checks     all 9 lists: decodable, aged, counted, on-target
  5  evidence             self-asserted flags recomputed against reality
  6  index.html drift     the page must be derivable from data/
  7  corpus               properties no per-item gate can see
  8  gate self-test       every gate handed an input it MUST refuse
  9  sibling audits       audit_curriculum.py / audit_child.py, if present
"""

import collections
import contextlib
import hashlib
import importlib
import io
import json
import pathlib
import re
import subprocess
import sys
from itertools import product

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE / "data"
INDEX = HERE.parent / "index.html"
GENERATOR = HERE.parents[1] / "decodable-passage-generator"
MANIFEST = HERE / "verified.json"

sys.path.insert(0, str(HERE))
sys.path.insert(0, str(GENERATOR))

import audit_passage as ap            # noqa: E402
import core_vocabulary as cv          # noqa: E402
import gates                          # noqa: E402
import quality                        # noqa: E402
import age_gate                       # noqa: E402
import check_formb                    # noqa: E402
import build_wordlists as bw          # noqa: E402
import sync_index                     # noqa: E402

LESSON_RANGE = range(6, 42)
CURLY = re.compile(r"[\u2018\u2019\u201c\u201d\u2013\u2014\u2026]")


# ---------------------------------------------------------------------------
# reporting
# ---------------------------------------------------------------------------
class Report:
    def __init__(self, quiet=False):
        self.fails = []
        self.notes = []
        self.quiet = quiet
        self.section = ""

    def start(self, name):
        self.section = name
        if not self.quiet:
            print("\n%s\n%s" % (name, "-" * len(name)))

    def ok(self, msg):
        if not self.quiet:
            print("  ok    " + msg)

    def info(self, msg):
        self.notes.append(msg)
        if not self.quiet:
            print("  ..    " + msg)

    def fail(self, msg):
        self.fails.append("[%s] %s" % (self.section, msg))
        print("  FAIL  " + msg)


def load_all():
    out = []
    for p in sorted(DATA.glob("lesson-*.json"), key=lambda q: int(q.stem.split("-")[1])):
        out.append((p, json.loads(p.read_text())))
    return out


# ---------------------------------------------------------------------------
# 1  environment
# ---------------------------------------------------------------------------
def check_environment(R):
    R.start("1  environment")

    # The nonsense-word filter's strength depends on an OS dictionary file. On a
    # machine without it, REAL collapses to a few hundred words and real English
    # words start passing as pseudowords — silently, with no warning anywhere.
    if not any(pathlib.Path(p).exists()
               for p in ("/usr/share/dict/words", "/usr/dict/words")):
        R.fail("no system dictionary (/usr/share/dict/words). The nonsense-word "
               "filter cannot tell a pseudoword from a real word on this machine.")
    elif len(bw.REAL) < 50000:
        R.fail("dictionary loaded but only %d words — too small to trust the "
               "nonsense-word filter" % len(bw.REAL))
    else:
        R.ok("system dictionary present (%d real words known)" % len(bw.REAL))

    # Form A is read by scraping class="ln" out of the generator's sheets. If a
    # sheet is restyled the scrape returns empty text for a file that exists,
    # and gate 3 then passes everything (see the crash-open test below).
    empty = [n for n in LESSON_RANGE if not check_formb.form_a(n).strip()]
    if empty:
        R.fail("Form A extraction returned nothing for lessons %s — gates 2 and 3 "
               "would be comparing against an empty document" % empty)
    else:
        R.ok("Form A extractable for all %d lessons" % len(list(LESSON_RANGE)))

    missing = [n for n in LESSON_RANGE if not (DATA / ("lesson-%03d.json" % n)).exists()]
    if missing:
        R.fail("no Form B data file for lessons %s" % missing)
    else:
        R.ok("a Form B file exists for every lesson 6-41")


# ---------------------------------------------------------------------------
# 2  schema + hygiene
# ---------------------------------------------------------------------------
PASSAGE_FIELDS = {"lesson", "skill", "form", "instrument", "title", "lines",
                  "gates_passed"}
WORDLIST_FIELDS = {"lesson", "skill", "form", "instrument", "real_words",
                   "nonsense_words", "high_frequency", "sentences",
                   "audit_clean", "audit_problems"}
WORDLIST_OPTIONAL = {"nwf_note", "supply_note", "instrument_claim"}

# --- accepted limits -------------------------------------------------------
# A finding is silenced ONLY with a written reason beside it, the same pattern
# word_age.APPROVED and audit_child.ACCEPTED use. The point is that a limit the
# language genuinely imposes gets recorded as a decision, while an unexplained
# failure stays loud. Never add to this to make a run go green.
ACCEPTED = {
    "L7 f-supply":
        "Lesson 7 teaches f /f/ and no real word containing f is legal at that "
        "lesson: the taught letters are a f m p s t, and the only decodable f "
        "word in English is 'fat', which is on core_vocabulary.BLOCKED. The word "
        "bank stocks zero f words here. Recorded rather than worked around; the "
        "/f/ sound is first assessable at Lesson 8. Fixing it means adding a "
        "word to the curriculum data, which is a separate decision.",
    "wordlist alternate-form impossible":
        "Below Lesson 13 the two requirements 'exercise the lesson's own sound' "
        "and 'do not reuse Form A's words' are mathematically incompatible. "
        "Measured: at Lessons 7, 8, 10, 11 and 12 Form A spends EVERY on-target "
        "word that exists in English at that lesson, leaving nothing; at Lesson "
        "6 only 'map' remains. So a word list here is not a clean alternate "
        "form and must not be read as one. It is a decoding check on the taught "
        "sound, and every file states that in its instrument_claim field. A "
        "child who practised Form A will have met some of these words.",
    "wordlist hand-corrections":
        "Lessons 6-14 were hand-corrected after four audits (pseudoword "
        "contamination, age-of-acquisition, name collisions, target-sound "
        "coverage), so the shipped files deliberately differ from what "
        "build_wordlists produces. The generator is the starting point, not the "
        "source of truth, and every shipped item is re-verified from disk by "
        "sections 2 and 4 of this file rather than trusted.",
}


def accepted(key, report=None):
    """True if this limit has a written sign-off. Announces it, so an accepted
    limit stays visible in every run rather than silently absent."""
    reason = ACCEPTED.get(key)
    if reason:
        msg = "ACCEPTED %s — %s" % (key, reason)
        if report is not None:
            report.info(msg)
        else:
            print("  ..    " + msg)
    return bool(reason)


def check_schema(R, items):
    R.start("2  schema and formatting")
    bad = 0
    for p, d in items:
        n = d.get("lesson")
        tag = p.name

        stem = int(p.stem.split("-")[1])
        if stem != n:
            R.fail("%s: filename says lesson %d, field says %r" % (tag, stem, n)); bad += 1
        if d.get("form") != "B":
            R.fail("%s: form is %r, expected 'B'" % (tag, d.get("form"))); bad += 1
        if d.get("instrument") not in ("passage", "word list"):
            R.fail("%s: instrument %r is not a known kind" % (tag, d.get("instrument"))); bad += 1
            continue

        want = PASSAGE_FIELDS if d["instrument"] == "passage" else WORDLIST_FIELDS
        got = set(d)
        if got - want - WORDLIST_OPTIONAL:
            extra = sorted(got - want - WORDLIST_OPTIONAL)
            if extra:
                R.fail("%s: unexpected fields %s" % (tag, extra)); bad += 1
        if want - got:
            R.fail("%s: missing fields %s" % (tag, sorted(want - got))); bad += 1

        real_skill = ap.load(n)["skill"]
        if d.get("skill") != real_skill:
            R.fail("%s: skill %r does not match the curriculum's %r"
                   % (tag, d.get("skill"), real_skill)); bad += 1

        if d["instrument"] == "passage":
            if not isinstance(d.get("lines"), list) or not d["lines"]:
                R.fail("%s: lines is empty or not a list" % tag); bad += 1
            if not (d.get("title") or "").strip():
                R.fail("%s: no title" % tag); bad += 1

        # ---- raw-text hygiene -----------------------------------------------
        txt = p.read_text()
        if not txt.endswith("\n"):
            R.fail("%s: no trailing newline (written by a different code path "
                   "than the passage files)" % tag); bad += 1
        if "\t" in txt:
            R.fail("%s: contains a tab" % tag); bad += 1
        if re.search(r"[ \t]+\n", txt):
            R.fail("%s: trailing whitespace on a line" % tag); bad += 1
        if txt != json.dumps(d, indent=2, ensure_ascii=False) + "\n":
            R.fail("%s: not canonical JSON (json.dumps indent=2, ensure_ascii=False, "
                   "trailing newline) — key order or spacing has drifted" % tag); bad += 1

        for s in (d.get("lines") or []) + (d.get("sentences") or []):
            if CURLY.search(s):
                R.fail("%s: curly punctuation in %r — the running record splits on "
                       "straight quotes" % (tag, s)); bad += 1
            if "  " in s:
                R.fail("%s: double space in %r (index.html splits lines on a single "
                       "space and would emit an empty token)" % (tag, s)); bad += 1
            if s != s.strip():
                R.fail("%s: untrimmed whitespace in %r" % (tag, s)); bad += 1
            if s.count('"') % 2:
                R.fail("%s: unbalanced double quotes in %r" % (tag, s)); bad += 1
            if not re.search(r'[.!?]["\u201d]?$', s.strip()):
                R.fail("%s: %r does not end in terminal punctuation, so joining the "
                       "lines merges two sentences" % (tag, s)); bad += 1

        # Every gate measures " ".join(lines). The child reads the lines one at a
        # time. If those two disagree about how many sentences there are, the
        # gates measured something the child never sees.
        if d["instrument"] == "passage":
            per_line = sum(len(gates.sentences(l)) for l in d["lines"])
            joined = len(gates.sentences(" ".join(d["lines"])))
            if per_line != joined:
                R.fail("%s: %d sentences read line by line but %d when joined — "
                       "gates.sentences() loses a sentence that sits entirely inside "
                       "quotation marks" % (tag, per_line, joined)); bad += 1

    if not bad:
        R.ok("all %d files: fields, types, skills, encoding and formatting clean" % len(items))


# ---------------------------------------------------------------------------
# 3  passage gates
# ---------------------------------------------------------------------------
def check_passages(R, items):
    R.start("3  passage gates (1 decodable, 2 equivalent, 3 distinct, 4 story, 5 age, 6 title)")
    n_ok = 0
    for p, d in items:
        if d["instrument"] != "passage":
            continue
        text = " ".join(d["lines"])
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            res = check_formb.run(d["lesson"], text, verbose=False, title=d["title"])
        if res["passed"]:
            n_ok += 1
        else:
            for r in res["results"]:
                if not r["passed"]:
                    R.fail("L%d %r — gate %s: %s"
                           % (d["lesson"], d["title"], r["gate"], r["detail"][:200]))
    R.ok("%d passages clear all six gates" % n_ok)

    # Gate 3 used to compare exact word forms only, so "sits" in Form B slipped
    # past "sit" in Form A. It is stem-aware now; prove the stem half is live
    # rather than trusting that it is, and report what it is catching.
    inflected = collections.defaultdict(list)
    for p, d in items:
        if d["instrument"] != "passage":
            continue
        n = d["lesson"]
        r = gates.gate3_distinct(check_formb.form_a(n), " ".join(d["lines"]), n,
                                 check_formb.cast_of(n))
        if r.get("inflected"):
            inflected[n] = r["inflected"]
    if inflected:
        R.info("gate 3's stem matching is catching reuse the old exact-form gate could "
               "not see: %s" % "; ".join("L%d %s" % (k, ",".join(v))
                                         for k, v in sorted(inflected.items())))
    else:
        R.fail("gate 3's stem matching found nothing anywhere in the corpus — check it "
               "is still wired up, because it is the half that was missing")


# ---------------------------------------------------------------------------
# 4  word lists
# ---------------------------------------------------------------------------
def target_letters(skill: str):
    """The grapheme(s) a lesson is named for, or None where the lesson is a
    review and has no single target. Deliberately conservative: it returns None
    rather than guessing, because the old one-line regex silently returned ""
    for every review lesson and the on-target rule then did nothing at all."""
    s = skill.strip()
    m = re.match(r"^(qu|[A-Za-z]{1,3})\s*/", s)          # "f /f/", "ck /k/"
    if m:
        return [m.group(1).lower()]
    m = re.match(r"^[A-Za-z ]*\(([a-z, ]+)\)\s*$", s)     # "Nasalized A (am, an)"
    if m and "review" not in s.lower() and "practice" not in s.lower():
        parts = [x.strip() for x in m.group(1).split(",") if x.strip()]
        if parts and all(len(x) >= 2 for x in parts):
            return parts
    return None


def legal_pseudowords(lesson: int):
    L = ap.load(lesson)
    g = sorted(L["allowedGraphemes"])
    vowels = [x for x in g if x in set("aeiou")]
    cons = [x for x in g if x not in set("aeiou")]
    out = []
    if not vowels or not cons:
        return out
    for shape in ((cons, vowels, cons), (vowels, cons)):
        for parts in product(*shape):
            w = "".join(parts)
            if w in out:
                continue
            if w in bw.REAL or w in bw.BLOCKED or bw.one_edit_from_blocked(w):
                continue
            if w[-1] in "flsz" or w.endswith("c") or bw.doubles_to_real(w, bw.REAL):
                continue
            if not ap.audit(w, lesson)["clean"]:
                continue
            out.append(w)
    return out


def check_wordlists(R, items):
    R.start("4  word lists")
    lists = [(p, d) for p, d in items if d["instrument"] == "word list"]
    seen_real = {}

    for p, d in lists:
        n = d["lesson"]
        tag = "L%d" % n

        # decodable
        for key in ("real_words", "nonsense_words"):
            for w in d[key]:
                r = ap.audit(w, n)
                if not r["clean"]:
                    R.fail("%s %s %r is not decodable: %s" % (tag, key, w, r["violations"][:1]))
        for s in d["sentences"]:
            r = ap.audit(s, n)
            if not r["clean"]:
                R.fail("%s sentence %r is not decodable: %s" % (tag, s, r["violations"][:2]))

        # age + blocked — nothing has ever run gate 5 over a word list
        for key in ("real_words", "sentences"):
            for w in d[key]:
                probe = w if w.strip().endswith((".", "!", "?")) else w + "."
                r = age_gate.judge(probe, n)
                if not r["passed"]:
                    R.fail("%s %s %r fails gate 5: %s" % (tag, key, w, r["detail"]))

        # counts — the design says five of each
        if len(d["real_words"]) != 5:
            R.fail("%s has %d real words, the design says 5" % (tag, len(d["real_words"])))
        if d["nonsense_words"] and len(d["nonsense_words"]) != 5:
            R.fail("%s has %d nonsense words, the design says 5 or none"
                   % (tag, len(d["nonsense_words"])))
        hearts = {w.lower() for w in ap.load(n)["allowedHeartWords"]}
        got = {w.lower() for w in d["high_frequency"]}
        if not got <= hearts:
            R.fail("%s high_frequency contains non-heart words: %s" % (tag, sorted(got - hearts)))
        if len(got) < 5 and len(hearts) >= 5:
            R.fail("%s lists only %d high-frequency words although %d heart words are "
                   "taught by this lesson" % (tag, len(got), len(hearts)))
        if not d["sentences"]:
            R.fail("%s has no controlled sentences" % tag)

        # the pronoun I
        for w in d["high_frequency"]:
            if w.lower() == "i" and w != "I":
                R.fail("%s prints the pronoun I as %r, which is not a word" % (tag, w))

        # on-target: the lesson is named for a sound, its real words must show it
        targets = target_letters(d["skill"])
        if targets:
            hits = [w for w in d["real_words"] if any(t in w for t in targets)]
            if not hits:
                pool = [w.lower() for w in bw.AVAILABLE.get(str(n), [])]
                pool = [w for w in pool if any(t in w for t in targets)]
                if not pool and accepted("L7 f-supply", R):
                    continue
                R.fail("%s is the %r lesson but not one of its real words (%s) contains "
                       "%s. %s"
                       % (tag, d["skill"], " ".join(d["real_words"]), " or ".join(targets),
                          ("The word bank offers %s at this lesson, so this is a picking "
                           "bug." % " ".join(pool)) if pool else
                          ("The word bank offers NO word containing %s at this lesson, so a "
                           "distinct on-target list is impossible here and the lesson should "
                           "not ship a word list." % " or ".join(targets))))

        # no two lessons may hand a child the same list
        key = tuple(sorted(d["real_words"]))
        if key in seen_real:
            R.fail("%s real words are identical to L%d (%s) — administering both "
                   "measures the same thing twice" % (tag, seen_real[key], " ".join(key)))
        else:
            seen_real[key] = n

        # nwf_note must be true, not just present
        note = d.get("nwf_note", "")
        legal = legal_pseudowords(n)
        if not d["nonsense_words"]:
            if not note:
                R.fail("%s has no nonsense words and no note explaining why" % tag)
            elif "fewer than five" in note and len(legal) >= 5:
                R.fail("%s's note claims fewer than five legal pseudowords exist, but %d "
                       "do (%s). The subtest is missing for another reason — the "
                       "three-lesson reuse cooldown starved it — and the note is a "
                       "fabricated explanation." % (tag, len(legal), " ".join(legal)))
        elif note:
            R.fail("%s carries a no-subtest note but also lists nonsense words" % tag)

        # every shipped pseudoword must still survive today's filters
        for w in d["nonsense_words"]:
            if w in bw.REAL:
                R.fail("%s nonsense word %r is a real English word" % (tag, w))
            if w in bw.BLOCKED or bw.one_edit_from_blocked(w):
                R.fail("%s nonsense word %r is on, or one letter from, the BLOCKED list" % (tag, w))
            if w[-1] in "flsz":
                R.fail("%s nonsense word %r breaks the FLSZ rule taught at Lesson 42" % (tag, w))
            if w.endswith("c"):
                R.fail("%s nonsense word %r ends in a bare c, a spelling English never uses" % (tag, w))
            if bw.doubles_to_real(w, bw.REAL):
                R.fail("%s nonsense word %r becomes a real word if its last letter doubles" % (tag, w))

    # near-duplicate neighbours
    for (pa, a), (pb, b) in zip(lists, lists[1:]):
        sa, sb = set(a["real_words"]), set(b["real_words"])
        if sa and sa != sb and len(sa & sb) >= 4:
            R.fail("L%d and L%d share %d of 5 real words (%s)"
                   % (a["lesson"], b["lesson"], len(sa & sb), " ".join(sorted(sa & sb))))

    # build_wordlists is order-dependent, so a single lesson cannot be re-verified
    fresh = subprocess.run([sys.executable, "-c",
                            "import sys; sys.path[:0]=[%r,%r]; import build_wordlists as B; "
                            "import json; print(json.dumps(B.build(14)))"
                            % (str(HERE), str(GENERATOR))],
                           capture_output=True, text=True, cwd=str(HERE))
    if fresh.returncode == 0:
        alone = json.loads(fresh.stdout)
        shipped = json.loads((DATA / "lesson-014.json").read_text())
        if alone["nonsense_words"] != shipped["nonsense_words"] or \
                alone["real_words"] != shipped["real_words"]:
            if not accepted("wordlist hand-corrections", R):
                R.fail("build_wordlists.build(14) run on its own gives real=%s nwf=%s but the "
                   "shipped file has real=%s nwf=%s. USED_REAL and USED_PSEUDO are module "
                   "globals, so a lesson's answer depends on which lessons were built "
                   "before it in the same process. No single lesson can be re-verified."
                   % (alone["real_words"], alone["nonsense_words"],
                      shipped["real_words"], shipped["nonsense_words"]))
        else:
            R.ok("build_wordlists reproduces lesson 14 identically on its own")


# ---------------------------------------------------------------------------
# 5  evidence behind the self-asserted flags
# ---------------------------------------------------------------------------
def check_evidence(R, items):
    R.start("5  evidence for self-asserted flags")
    for p, d in items:
        if d["instrument"] == "passage":
            if d.get("gates_passed") is not True:
                R.fail("%s claims gates_passed=%r" % (p.name, d.get("gates_passed")))
        else:
            checks = []
            for w in d["real_words"] + d["nonsense_words"]:
                r = ap.audit(w, d["lesson"])
                if not r["clean"]:
                    checks.append(w)
            for s in d["sentences"]:
                if not ap.audit(s, d["lesson"])["clean"]:
                    checks.append(s)
            if d.get("audit_clean") != (not checks):
                R.fail("%s claims audit_clean=%r but recomputing gives %r (%s)"
                       % (p.name, d.get("audit_clean"), not checks, checks))
            if bool(d.get("audit_problems")) != bool(checks):
                R.fail("%s audit_problems=%r disagrees with a fresh audit (%s)"
                       % (p.name, d.get("audit_problems"), checks))

    # A boolean in a file is not evidence. Record what was verified, when, and
    # over exactly which bytes, so a later hand-edit shows up as a stale claim
    # instead of a claim that quietly stays true.
    now = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p, _ in items}
    if not MANIFEST.exists():
        R.info("no verified.json yet — the gates_passed/audit_clean flags in the data "
               "files have no timestamp and no content hash behind them. Run "
               "verify_all.py --update-manifest after a clean run to create one.")
        return
    man = json.loads(MANIFEST.read_text())
    stale = [k for k, v in now.items() if man.get("files", {}).get(k) != v]
    gone = [k for k in man.get("files", {}) if k not in now]
    if stale or gone:
        R.fail("verified.json was stamped at %s but %s changed since "
               "(%s). Their gates_passed/audit_clean flags are unproven until this "
               "run's result is stamped again."
               % (man.get("verified_at", "?"), len(stale) + len(gone),
                  ", ".join(sorted(stale + gone))[:200]))
    else:
        R.ok("all %d files unchanged since they were last proven (%s)"
             % (len(now), man.get("verified_at", "?")))


def write_manifest(items):
    payload = {
        "verified_at": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "verifier": "verify_all.py",
        "gates": ["1 decodable", "2 equivalent", "3 distinct", "4 story quality",
                  "5 age + blocked", "6 title", "corpus", "schema"],
        "files": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p, _ in items},
    }
    MANIFEST.write_text(json.dumps(payload, indent=2) + "\n")
    print("stamped %s over %d files" % (MANIFEST.name, len(payload["files"])))


# ---------------------------------------------------------------------------
# 6  index.html drift
# ---------------------------------------------------------------------------
def check_index(R):
    R.start("6  index.html drift")
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        rc = sync_index.main([])
    if rc:
        for line in buf.getvalue().splitlines():
            if line.strip():
                R.fail(line.strip())
    else:
        R.ok("index.html LESSONS is exactly what formb/data/ generates")


# ---------------------------------------------------------------------------
# 7  corpus
# ---------------------------------------------------------------------------
def corpus_problems(passages):
    """Properties no per-item gate can ever see. Takes a list of passage dicts
    so the self-test can hand it a deliberately bad corpus."""
    probs = []
    if not passages:
        return ["corpus is EMPTY — nothing was checked. (corpus_check.py used a "
                "relative glob and reported success over zero passages when run from "
                "any directory but formb/.)"]
    N = len(passages)
    texts = {d["lesson"]: " ".join(d["lines"]) for d in passages}

    names = set()
    for d in passages:
        names |= {w for w in gates.character_names(texts[d["lesson"]])
                  if w not in gates.FUNCTION_WORDS}

    # a. endings — every one of them, not just the top three
    ends = collections.Counter()
    for d in passages:
        last = gates.sentences(texts[d["lesson"]])[-1]
        ends[re.sub(r"[^a-z ]", "", last.lower()).strip()] += 1
    for phrase, k in ends.items():
        if k > 3:
            probs.append('%d of %d passages end on "%s"' % (k, N, phrase))

    # b. last WORD, a weaker signal the phrase check misses entirely
    lastw = collections.Counter()
    for d in passages:
        w = gates.bare_words(gates.sentences(texts[d["lesson"]])[-1])
        if w:
            lastw[w[-1]] += 1
    for w, k in lastw.items():
        if k > max(3, N * 0.25) and w not in names:
            probs.append('%d of %d passages end on the word "%s"' % (k, N, w))

    # c. over-used vocabulary. Counting raw mentions is the wrong measure — one
    #    story about a cat legitimately says "cat" six times. What matters is how
    #    many DIFFERENT passages lean on the same word, and the same word with an
    #    -s on it is not a different word to a child.
    def stem(w):
        for suf in ("ing", "ed", "s"):
            if len(w) > len(suf) + 2 and w.endswith(suf):
                return w[:-len(suf)]
        return w

    pres, spres, ment = collections.Counter(), collections.Counter(), collections.Counter()
    for d in passages:
        ws = [w for w in gates.bare_words(texts[d["lesson"]])
              if w not in gates.FUNCTION_WORDS and w != "said" and w not in names]
        for w in set(ws):
            pres[w] += 1
        for w in {stem(x) for x in ws}:
            spres[w] += 1
        for w in ws:
            ment[w] += 1
    for w, k in pres.items():
        if k > max(4, N * 0.40):
            probs.append('"%s" is in %d of %d passages (%d mentions)' % (w, k, N, ment[w]))
    for w, k in spres.items():
        if k > max(5, N * 0.50) and pres.get(w, 0) <= max(4, N * 0.40):
            probs.append('the word family "%s-" is in %d of %d passages' % (w, k, N))

    # d. over-used characters
    inpass = collections.Counter()
    for d in passages:
        for nm in gates.character_names(texts[d["lesson"]]) & names:
            inpass[nm] += 1
    for nm, k in inpass.items():
        if k > max(4, N * 0.3):
            probs.append("the character %r appears in %d of %d passages"
                         % (nm, k, N))
    if inpass and len(inpass) < max(4, N * 0.4):
        probs.append("only %d distinct characters across %d passages" % (len(inpass), N))

    # e. titles — exact duplicates AND near ones
    titles = [(d["lesson"], d["title"]) for d in passages]
    seen = {}
    for n, t in titles:
        k = t.lower().strip()
        if k in seen:
            probs.append("L%d and L%d have the same title %r" % (seen[k], n, t))
        seen[k] = n
    stop = gates.FUNCTION_WORDS
    keyed = [(n, frozenset(w for w in re.findall(r"[a-z']+", t.lower()) if w not in stop))
             for n, t in titles]
    for i in range(len(keyed)):
        for j in range(i + 1, len(keyed)):
            a, b = keyed[i][1], keyed[j][1]
            if a and b and (a == b or (len(a & b) >= 2 and len(a & b) >= min(len(a), len(b)))):
                probs.append("titles L%d and L%d are near-duplicates: %r / %r"
                             % (keyed[i][0], keyed[j][0],
                                dict(titles)[keyed[i][0]], dict(titles)[keyed[j][0]]))
    tw = collections.Counter()
    for _, t in titles:
        for w in set(re.findall(r"[a-z']+", t.lower())):
            if w not in stop:
                tw[w] += 1
    for w, k in tw.items():
        if k > max(3, N * 0.2):
            probs.append('"%s" appears in %d of %d titles' % (w, k, N))

    # f. opening word
    firsts = collections.Counter()
    for d in passages:
        s = gates.sentences(texts[d["lesson"]])
        w = gates.bare_words(s[0])
        if w:
            firsts[w[0]] += 1
    for w, k in firsts.items():
        if k > max(3, N * 0.25):
            probs.append('%d of %d passages open with "%s"' % (k, N, w))

    # g. verbatim reuse of a whole line
    lines = collections.Counter()
    for d in passages:
        for l in d["lines"]:
            lines[l.strip()] += 1
    for l, k in lines.items():
        if k > 1:
            probs.append("the line %r appears in %d passages" % (l, k))

    # h. pacing between neighbouring lessons
    lens = sorted((d["lesson"], len(gates.bare_words(texts[d["lesson"]]))) for d in passages)
    for (a, la), (b, lb) in zip(lens, lens[1:]):
        if la and abs(lb - la) / la > 0.45:
            probs.append("L%d=%dw then L%d=%dw — a %.0f%% step"
                         % (a, la, b, lb, abs(lb - la) / la * 100))

    # i. sentence-length spread. A corpus where every sentence is the same
    #    length is monotonous however good each passage looks alone.
    sl = []
    for d in passages:
        for s in gates.sentences(texts[d["lesson"]]):
            sl.append(len(re.findall(r"[A-Za-z']+", s)))
    if sl:
        c = collections.Counter(sl)
        top, k = c.most_common(1)[0]
        if k / len(sl) > 0.45:
            probs.append("%.0f%% of all %d sentences are exactly %d words long"
                         % (k / len(sl) * 100, len(sl), top))
        at_ceiling = sum(1 for x in sl if x >= 14)
        if at_ceiling > max(2, len(sl) * 0.05):
            probs.append("%d sentences sit on the 14-word ceiling — the writing is "
                         "being fitted to the gate rather than to the child" % at_ceiling)
    return probs


def check_corpus(R, items):
    R.start("7  corpus")
    passages = [d for _, d in items if d["instrument"] == "passage"]
    probs = corpus_problems(passages)
    for p in probs:
        R.fail(p)
    if not probs:
        R.ok("%d passages: no repeated endings, characters, titles, openings, lines "
             "or pacing jumps" % len(passages))

    # How much room is left in each gate-2 tolerance. Items crowding a boundary
    # are the sign of writing to the gate, which is how a corpus passes every
    # check and still reads wrong.
    crowd = collections.Counter()
    for d in passages:
        n = d["lesson"]
        a = gates.profile(check_formb.form_a(n), n)
        b = gates.profile(" ".join(d["lines"]), n)
        m = {
            "length": (abs(b["total_words"] - a["total_words"]) / (a["total_words"] or 1),
                       gates.EQUIV["total_words_pct"]),
            "sentence length": (abs(b["mean_sentence_len"] - a["mean_sentence_len"])
                                / (a["mean_sentence_len"] or 1),
                                gates.EQUIV["mean_sentence_len_pct"]),
            "word length": (abs(b["mean_word_len"] - a["mean_word_len"]),
                            gates.EQUIV["mean_word_len"]),
            "heart share": (abs(b["heart_share"] - a["heart_share"]),
                            gates.EQUIV["heart_share_points"]),
            "syllables": (abs(b["mean_syllables"] - a["mean_syllables"]),
                          gates.EQUIV["mean_syllables"]),
        }
        for k, (v, tol) in m.items():
            if tol and v / tol > 0.9:
                crowd[k] += 1
    for k, v in crowd.items():
        R.info("%d of %d passages sit within 10%% of the '%s' tolerance" % (v, len(passages), k))
    if any(v > len(passages) * 0.5 for v in crowd.values()):
        R.fail("more than half the corpus is pressed against the same tolerance — the "
               "passages are being written to the number, not to the child")


# ---------------------------------------------------------------------------
# 8  the self-test: every gate must still be able to refuse
# ---------------------------------------------------------------------------
L = 41                       # the richest lesson, so bad inputs are constructible
FA = None                    # filled in at run time from the real Form A


def _bad_cases():
    """(name, kind, payload, the wording the gate must produce).

    Each payload is built to break exactly one check. If a gate ever stops
    producing its message, this list goes red — which is the only way to notice
    that a gate has quietly become decoration.
    """
    return [
        # gate 1
        ("gate 1 decodable", "passage",
         'Sam and the pig ate a green cake. The pig made a huge mess. '
         '"Please stop," said Sam. The pig slept.', "untaught"),

        # gate 2, one case per sub-metric
        ("gate 2 / length", "passage", "Sam let the pig dig.", "length"),
        ("gate 2 / sentence length", "passage",
         "Ben ran. Ben hid. Ben sat. Meg ran. Meg hid. Meg sat. Gus ran. Gus hid. "
         "Gus sat. Ned ran. Ned hid. Ned sat. Deb ran. Deb hid. Deb sat. Tom ran. "
         "Tom hid. Tom sat. Sal ran. Sal hid.", "sentence length"),
        ("gate 2 / word length", "passage",
         "It is on. It is up. He is in. It is at. We do it. He is on. It is up. "
         "We do it. He is in. It is at. We do it. He is up. It is on. It is in. "
         "We do it. He is at. It is up. He is on. We do it. It is in.", "word length"),
        ("gate 2 / heart share", "passage",
         "You and I do see what she said. You and I do see what he said. "
         "You and I do see what we said. You and I do see what they said. "
         "You and I do see what she said. You and I do see what he said.",
         "heart-word share"),

        # gate 3 — the bluntest possible violation: Form A handed back verbatim
        ("gate 3 distinct", "self", "", "reuses"),

        # gate 4, one case per sub-check
        ("gate 4 / no verb", "quality",
         "The red cat. The big dog. A hot pot. A sad kid. The tin cup. The top bun.",
         "no verb"),
        ("gate 4 / same opening", "quality",
         "The cat is red. The dog is big. The pot is hot. The kid is sad. "
         "The cup is tin. The bun is on top.", "start with"),
        ("gate 4 / one word carries it", "quality",
         "Sam has a cat. The cat is on a cat mat. Sam pats the cat. The cat naps. "
         "Sam and the cat sit. The cat is fun and the cat is red.", "used"),
        ("gate 4 / sentence too long", "quality",
         "Sam and Meg and Ben and Gus and Ned and Deb and Tom and Sal ran up the big "
         "hot hill. Sam ran. Meg sat. Ben hid.", "longest sentence"),
        ("gate 4 / mean sentence too long", "quality",
         "Sam and Meg ran up the hill to get the big red pot of jam. "
         "Ben and Gus ran up the hill to get the big red pot of ham. "
         "Ned and Deb ran up the hill to get the big red pot of jam. "
         "Tom and Sal ran up the hill to get the big red pot of ham.", "mean sentence"),
        ("gate 4 / too few sentences", "quality",
         "Sam ran to the big pot. Meg sat on it. Ben hid.", "too short to be a story"),
        ("gate 4 / nobody in it", "quality",
         "The cat is red. The dog is big. The pot is hot. The bun is on top. "
         "The mug is tan. The rag is wet.", "nobody is in this story"),

        # gate 5
        ("gate 5 / blocked word", "age", "Sam has a gun in the tub.", "BLOCKED"),
        ("gate 5 / word learned too late", "age", "Sam has a nip in the tub.", "too late"),

        # gate 6
        ("gate 6 / apostrophe in title", "title", "Sam's Pig", "apostrophe"),
        ("gate 6 / undecodable title", "title", "The Cake", "untaught"),
        ("gate 6 / title word too late", "title", "The Nip", "too late"),
    ]


def check_self_test(R):
    global FA
    R.start("8  gate self-test — can each gate still REFUSE?")
    FA = check_formb.form_a(L)
    cast = check_formb.cast_of(L)

    # The control. Every rejection below proves nothing unless a genuinely good
    # passage still gets through, so use the real shipped Lesson 41 text rather
    # than a hand-written stand-in. test_gates.py compared against a FABRICATED
    # Form A, which meant its "the good one publishes" claim was never a claim
    # about anything in production.
    shipped = json.loads((DATA / "lesson-041.json").read_text())
    good = " ".join(shipped["lines"])
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        res = check_formb.run(L, good, verbose=False, title=shipped["title"])
    if not res["passed"]:
        R.fail("CONTROL: the shipped Lesson 41 passage is being refused — %s"
               % "; ".join(r["detail"] for r in res["results"] if not r["passed"]))
    else:
        R.ok("control: the real shipped Lesson 41 passage still publishes")

    for name, kind, payload, must_say in _bad_cases():
        if kind == "self":                       # Form A judged against itself
            r = gates.check(FA, FA, L, characters=cast)
            details = " ".join(x["detail"] for x in r["results"] if not x["passed"])
            refused = not r["passed"]
        elif kind == "passage":
            r = gates.check(FA, payload, L, characters=cast)
            details = " ".join(x["detail"] for x in r["results"] if not x["passed"])
            refused = not r["passed"]
        elif kind == "quality":
            x = quality.judge(payload, L)
            details, refused = x["detail"], not x["passed"]
        elif kind == "age":
            x = age_gate.judge(payload, L, characters=cast)
            details, refused = x["detail"], not x["passed"]
        else:                                    # title
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                r = check_formb.run(L, good, verbose=False, title=payload)
            t = [q for q in r["results"] if q["gate"] == "6 title"][0]
            details, refused = t["detail"], not t["passed"]

        if not refused:
            R.fail("%s did NOT refuse an input designed to break it — this gate is "
                   "decoration" % name)
        elif must_say.lower() not in details.lower():
            R.fail("%s refused, but for the wrong reason: expected %r, got %r"
                   % (name, must_say, details[:160]))
        else:
            R.ok("%s refuses" % name)

    # ---- a check that cannot fail must be declared, not left to look busy ----
    # EQUIV["mean_syllables"] is a real tolerance and a dead one below Lesson 66:
    # gate 1 forbids a second syllable until syllable division is taught, so
    # mean_syllables is exactly 1.000 on both sides of every comparison this tool
    # can make. It used to be applied anyway and print PASS. It is now skipped
    # explicitly, and this asserts the skip is honest in both directions.
    multi = [w for w in ("cabin", "napkin", "sunset", "picnic", "rabbit", "zigzag")
             if ap.audit(w, L)["clean"]]
    r = gates.gate2_equivalent(FA, good, L)
    if multi:
        R.fail("multisyllabic words are decodable at lesson %d after all (%s), so "
               "mean_syllables must be measured here, not skipped" % (L, multi))
    elif not any("syllable" in s for s in r.get("skipped", [])):
        R.fail("gate 2 is still applying the mean_syllables tolerance at lesson %d, "
               "where every word is one syllable by construction and the check can "
               "never fail. A tolerance that has never judged anything is decoration."
               % L)
    elif gates.SYLLABLES_MEANINGFUL_FROM != ap.MULTISYLLABLE_LESSON:
        R.fail("gates.SYLLABLES_MEANINGFUL_FROM (%d) has drifted from the generator's "
               "own MULTISYLLABLE_LESSON (%d)"
               % (gates.SYLLABLES_MEANINGFUL_FROM, ap.MULTISYLLABLE_LESSON))
    else:
        R.ok("mean_syllables is declared unmeasurable below lesson %d instead of "
             "silently passing" % gates.SYLLABLES_MEANINGFUL_FROM)

    # ---- crash-open paths --------------------------------------------------
    crash = []
    if gates.gate3_distinct("", good, L)["passed"]:
        crash.append("gate 3 PASSES when Form A is missing or unreadable — "
                     "check_formb.form_a() returns '' for an absent or restyled sheet, "
                     "and an empty Form A shares no words with anything")
    if gates.gate2_equivalent("", good, L)["passed"]:
        crash.append("gate 2 PASSES when Form A is missing")
    if gates.gate1_decodable("", L)["passed"]:
        crash.append("gate 1 passes empty text")
    if quality.judge("", L)["passed"]:
        crash.append("gate 4 passes empty text")
    if age_gate.judge("", L)["passed"] is False:
        pass                                   # an empty string has no bad words; fine
    if corpus_problems([]) == []:
        crash.append("the corpus check reports success over an empty corpus")
    for c in crash:
        R.fail(c)
    if not crash:
        R.ok("nothing crashes open: gates 1-4 and the corpus check all refuse to "
             "judge missing or empty input rather than approving it")

    # ---- word-list filters -------------------------------------------------
    if bw.nonsense_candidates(6):
        R.fail("nonsense words are being generated below lesson %d" % bw.NWF_FROM_LESSON)
    if not bw.doubles_to_real("ap", bw.REAL):
        R.fail("doubles_to_real no longer catches 'ap' -> 'app'")
    if not bw.one_edit_from_blocked(sorted(bw.BLOCKED)[0]):
        R.fail("one_edit_from_blocked no longer catches an exact blocked word")
    if target_letters("f /f/") != ["f"] or target_letters("Short Vowels Review (all)") is not None:
        R.fail("target_letters() no longer reads a lesson's own name correctly")
    R.ok("word-list filters refuse: sub-lesson-12 pseudowords, ap/app, blocked near-misses")

    # ---- corpus checks -----------------------------------------------------
    synth = [{"lesson": 100 + i, "title": "The Big Bug", "instrument": "passage",
              "lines": ["Sam ran to the pot.", "Sam sat on the mat.",
                        "The pot is hot.", "It is fun."]}
             for i in range(6)]
    got = corpus_problems(synth)
    for expect in ("end on", "same title", "appears in", "open with", "appears in %d passages" % 6):
        if not any(expect.split("%")[0].strip() in g for g in got):
            R.fail("corpus check missed %r on a corpus built to show it: %s" % (expect, got))
    if len(got) < 4:
        R.fail("corpus check found only %d problems in a corpus that is six copies of "
               "the same story: %s" % (len(got), got))
    else:
        R.ok("corpus check refuses a corpus of six near-identical stories (%d problems)"
             % len(got))


# ---------------------------------------------------------------------------
# 9  sibling audits
# ---------------------------------------------------------------------------
def check_siblings(R):
    R.start("9  sibling audits")
    found = False
    for name in ("audit_curriculum", "audit_child"):
        path = HERE / (name + ".py")
        if not path.exists():
            R.info("%s.py not present — skipped" % name)
            continue
        found = True
        p = subprocess.run([sys.executable, str(path)], capture_output=True,
                           text=True, cwd=str(HERE))
        out = (p.stdout or "") + (p.stderr or "")
        if p.returncode != 0:
            R.fail("%s.py exited %d:\n%s" % (name, p.returncode,
                                             "\n".join("      " + l for l in out.splitlines()[-25:])))
        else:
            R.ok("%s.py clean" % name)
            if not R.quiet and out.strip():
                print("\n".join("        " + l for l in out.splitlines()[-8:]))
    if not found:
        R.info("neither sibling audit exists yet; verify_all will pick them up "
               "automatically when they land in formb/")


# ---------------------------------------------------------------------------
def main(argv):
    quiet = "--quiet" in argv
    R = Report(quiet=quiet)
    items = load_all()

    check_environment(R)
    check_schema(R, items)
    check_passages(R, items)
    check_wordlists(R, items)
    check_evidence(R, items)
    check_index(R)
    check_corpus(R, items)
    check_self_test(R)
    check_siblings(R)

    print("\n" + "=" * 72)
    if R.fails:
        print("VERIFY FAILED — %d problem(s)\n" % len(R.fails))
        for i, f in enumerate(R.fails, 1):
            print("%3d. %s" % (i, f))
        print("\nNothing here is a style opinion. Every line is a check that ran and "
              "said no.")
        return 1

    print("VERIFY PASSED — %d files, every gate ran, every gate proved it can still "
          "refuse." % len(items))
    if "--update-manifest" in argv:
        write_manifest(items)
    else:
        print("Stamp the evidence with:  python3 verify_all.py --update-manifest")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
