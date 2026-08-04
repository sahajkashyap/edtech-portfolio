"""Gate 4 — the story-quality judge.

ENGINEERING.md lists this as "Not built", and it is the gap that matters most
when generating a long run: the first three gates all pass happily on word
soup. A passage can be perfectly decodable, exactly the right difficulty, and
share no vocabulary with Form A, while being a list of unrelated sentences no
child would want to read.

It is also where quality decays across a batch. The twenty-seventh passage
written in a sitting is the one at risk, and nothing else in the pipeline would
notice.

This gate is deliberately mechanical and conservative. It cannot judge whether
a story is charming. It can catch the specific ways these passages go wrong:

  * no character doing anything (word soup)
  * the same sentence pattern over and over
  * a sentence that is just a list of words with no verb
  * repeating one word into the ground to hit the length target
  * no ending — the passage stops rather than finishes
  * sentences too long for the grade band

Anything it cannot measure stays out, rather than being faked with a number.
"""

import re
import sys
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
GENERATOR = HERE.parents[1] / "decodable-passage-generator"
sys.path.insert(0, str(GENERATOR))

import core_vocabulary as cv      # noqa: E402
import gates                      # noqa: E402

VERBS = {w.lower() for w in getattr(cv, "VERBS", set())}
# Common decodable verbs the curated list may not carry in every inflection.
# Widened after all four writers on the first batch independently reported
# false "no verb" failures on ordinary decodable verbs. A gate that rejects
# good writing trains the writer to write worse.
_VERB_STEMS = """
be is was were am are has have had do does did can will must let lets
run ran sit sat set get got give gave go went see saw say said look
dig dug nap hop hug tug rub tap pat pop sip dip tip fit nod wag hum yap
nip beg mop mix fix zip jog tag win cut hit put met fed led hid bat bit
pin dab jab lap lick kick pick pack tuck rock lock nab tan wet mop nab
""".split()
EXTRA_VERBS = set(_VERB_STEMS)
for _v in list(_VERB_STEMS):
    EXTRA_VERBS.add(_v + "s")
    if len(_v) > 2:
        EXTRA_VERBS.add(_v + "ed")
ALL_VERBS = VERBS | EXTRA_VERBS


def sentences(text):
    return gates.sentences(text)


def judge(text: str, lesson: int) -> dict:
    problems = []
    sents = sentences(text)
    words = gates.bare_words(text)
    if not sents or not words:
        return {"gate": "4 story quality", "passed": False, "detail": "empty"}

    # 1. Somebody has to do something in most sentences.
    verbless = [s for s in sents
                if not any(w.lower().strip(".,!?\"'") in ALL_VERBS
                           for w in re.findall(r"[A-Za-z']+", s))]
    if len(verbless) > max(1, len(sents) // 4):
        problems.append("%d of %d sentences have no verb — reads as a word list"
                        % (len(verbless), len(sents)))

    # 2. Sentence openings should vary. Six sentences all starting "The" is a
    #    pattern a child stops attending to.
    firsts = [re.findall(r"[A-Za-z']+", s)[0].lower() for s in sents
              if re.findall(r"[A-Za-z']+", s)]
    if firsts:
        top = max(set(firsts), key=firsts.count)
        share = firsts.count(top) / len(firsts)
        if share > 0.6 and len(firsts) >= 4:
            problems.append("%.0f%% of sentences start with '%s'"
                            % (share * 100, top))

    # 3. No single word should carry the passage.
    content = [w for w in words if w not in gates.FUNCTION_WORDS]
    if content:
        top = max(set(content), key=content.count)
        if content.count(top) / len(content) > 0.22 and content.count(top) > 3:
            problems.append("'%s' used %d times of %d content words"
                            % (top, content.count(top), len(content)))

    # 4. Sentence length suits the grade band.
    lens = [len(re.findall(r"[A-Za-z']+", s)) for s in sents]
    if lens and max(lens) > 14:
        problems.append("longest sentence is %d words (max 14 for K-2)" % max(lens))
    if lens and sum(lens) / len(lens) > 10:
        problems.append("mean sentence length %.1f words is long for K-2"
                        % (sum(lens) / len(lens)))

    # 5. Enough sentences to be a story at all.
    if len(sents) < 4:
        problems.append("only %d sentences — too short to be a story" % len(sents))

    # 6. Someone should be in it. A passage with no name and no pronoun is
    #    almost always word soup.
    has_actor = bool(gates.character_names(text)) or any(
        w in {"he", "she", "they", "i", "we", "it"} for w in words)
    if not has_actor:
        problems.append("no character or pronoun — nobody is in this story")

    return {
        "gate": "4 story quality",
        "passed": not problems,
        "detail": "reads as a story" if not problems else "; ".join(problems),
        "sentences": len(sents),
        "mean_sentence_len": round(sum(lens) / len(lens), 1) if lens else 0,
    }
