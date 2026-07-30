#!/usr/bin/env python3
"""Heart words, and how to draw them so a child can actually map them.

A "heart word" is not a word to be memorised whole. That is look-say, the thing
structured literacy replaced. In orthographic mapping (Ehri), a child stores a
word by bonding its *sounds* to its *letters* — so a high-frequency word is
taught by mapping the parts that behave normally and marking only the part that
does not. That part is the bit learned "by heart".

    the  ->  [ th ][ e ]        th says /th/ as always; only the e is odd.
                     ♥          It says /u/. That is the heart.

THE HEART MOVES. This is the part most implementations get wrong. A grapheme is
"odd" to a child either because it genuinely breaks the rules — `ai` in *said*
always will — or simply because they have not been taught it yet. At Lesson 1 a
child has not met `th`, so *the* carries TWO hearts. From Lesson 46, when `th`
is taught, the `th` heart goes away and only the `e` remains. So a heart is a
property of a word AT A LESSON, not a fixed fact about the word.

Each grapheme therefore carries the lesson from which it behaves normally:
    ("th", 46)      regular once Lesson 46 teaches th
    ("e",  None)    never regular; a permanent heart

WHERE THE WORDS COME FROM. Every word here is on the **Dolch list (1936)**,
which is public domain and which this project is already cleared to use. The
lesson each is introduced at is chosen to match the sequence the child's school
teaches, so home and school agree. Nothing is copied from any published
programme's materials — these are ordinary English words, and which part of each
behaves oddly is a fact about English spelling.
"""


class HeartWord:
    __slots__ = ("word", "graphemes", "lesson", "note")

    def __init__(self, word, graphemes, lesson, note=""):
        spelled = "".join(g for g, _ in graphemes)
        assert spelled == word, f"{spelled!r} does not spell {word!r}"
        self.word, self.graphemes, self.lesson, self.note = word, graphemes, lesson, note

    def hearts_at(self, n):
        """Indexes of the graphemes a child at lesson n would find odd."""
        return [i for i, (_, regular_from) in enumerate(self.graphemes)
                if regular_from is None or regular_from > n]

    def boxes(self):
        return [g for g, _ in self.graphemes]

    def fully_regular_at(self, n):
        return not self.hearts_at(n)

    def __repr__(self):
        return f"<{self.word} L{self.lesson}>"


# One consequence of the state-dependent model, worth stating because it looks
# like an omission next to a printed card deck: `is` and `as` heart their `s`
# (it says /z/), but `was`, `goes` and `always` do not. Those arrive after
# Lesson 21, which is where a child is taught that s can say /z/ -- so by then
# it is no longer a surprise. A static card cannot make that distinction; this
# can, and the whole point of a heart is to mark what the child does not yet
# know.
WORDS = []


def add(word, graphemes, lesson, note=""):
    WORDS.append(HeartWord(word, graphemes, lesson, note))


# ---------------------------------------------------------------------------
# ( grapheme, lesson it becomes regular — or None for a permanent heart )
#
# Introduced early, on purpose: a heart word exists precisely so a child can
# read it BEFORE they could decode it. That is what lets a real sentence happen
# in the first thirty lessons.
# ---------------------------------------------------------------------------
add("the",  [("th", 46), ("e", None)], 1, "e says /u/")
add("I",    [("I", 66)], 3, "open syllable; i says its name")
add("and",  [("a", 1), ("n", 9), ("d", 13)], 5, "fully regular once n and d are taught")
add("a",    [("a", None)], 7, "schwa")
add("is",   [("i", 8), ("s", 21)], 9, "s says /z/")
add("as",   [("a", 1), ("s", 21)], 11, "s says /z/")
add("said", [("s", 3), ("ai", None), ("d", 13)], 13, "ai says /e/")
add("to",   [("t", 4), ("o", None)], 15, "o says /oo/")
add("do",   [("d", 13), ("o", None)], 15, "o says /oo/")
add("of",   [("o", None), ("f", None)], 17, "o says /u/ and f says /v/")
add("see",  [("s", 3), ("ee", 85)], 19, "regular once ee is taught")
add("he",   [("h", 23), ("e", 66)], 23, "open syllable")
add("be",   [("b", 17), ("e", 66)], 23, "open syllable")
add("me",   [("m", 2), ("e", 66)], 23, "open syllable")
add("she",  [("sh", 45), ("e", 66)], 23,
    "open syllable; sh is not taught until 45, so it is a heart too for now")
add("from", [("f", 7), ("r", 24), ("o", None), ("m", 2)], 25, "o says /u/")
add("look", [("l", 26), ("oo", 89), ("k", 22)], 26, "regular once oo is taught")
add("are",  [("are", None)], 27, "the whole thing says /ar/; the e on the end does nothing")
add("was",  [("w", 28), ("a", None), ("s", 21)], 29, "a says /u/ and s says /z/")
add("you",  [("y", 30), ("ou", 115)], 31, "ou says /oo/")
add("what", [("wh", 50), ("a", 94), ("t", 4)], 33,
    "a says /o/, and wh has not been taught yet")
add("have", [("h", 23), ("a", 1), ("ve", 62)], 33, "no English word ends in v")
add("your", [("y", 30), ("our", None)], 42, "our says /or/")
add("want", [("w", 28), ("a", 94), ("n", 9), ("t", 4)], 42, "a says /o/ after w")
add("go",   [("g", 16), ("o", 66)], 43, "open syllable")
add("no",   [("n", 9), ("o", 66)], 43, "open syllable")
add("so",   [("s", 3), ("o", 66)], 43, "open syllable")
add("goes", [("g", 16), ("oe", 86), ("s", 21)], 44, "oe says /o/, s says /z/")
add("we",   [("w", 28), ("e", 66)], 28, "open syllable")
add("they", [("th", 46), ("ey", 114)], 46, "ey says /a/")
add("their",[("th", 46), ("eir", None)], 46, "eir says /air/")
add("were", [("w", 28), ("ere", None)], 47, "ere says /er/")
add("walk", [("w", 28), ("al", None), ("k", 22)], 48,
    "al together says /aw/ — the l is silent and hides inside it. Careful: the l in \"always\" IS said.")
add("could",[("c", 14), ("oul", None), ("d", 13)], 50, "oul says /oo/")
add("would",[("w", 28), ("oul", None), ("d", 13)], 50, "oul says /oo/")
add("or",   [("or", 78)], 51, "regular once or is taught")
add("for",  [("f", 7), ("or", 78)], 51, "regular once or is taught")
add("there",[("th", 46), ("ere", None)], 52, "ere says /air/")
add("where",[("wh", 50), ("ere", None)], 52, "ere says /air/")
add("who",  [("wh", None), ("o", None)], 54, "wh says /h/, o says /oo/")
add("my",   [("m", 2), ("y", 73)], 55, "y says its name")
add("by",   [("b", 17), ("y", 73)], 55, "y says its name")
add("one",  [("o", None), ("ne", 9)], 58,
    "the o does two jobs at once — it makes the /w/ AND the /u/. Nothing else in English does this")
add("once", [("o", None), ("n", 9), ("ce", 60)], 58,
    "like one — the o does two jobs, making the /w/ and the /u/")
add("two",  [("t", 4), ("wo", None)], 63, "wo together says /oo/ — the w is silent")
add("does", [("d", 13), ("oe", None), ("s", 21)], 63, "oe says /u/, s says /z/")
add("any",  [("a", None), ("n", 9), ("y", 74)], 64, "a says /e/")
add("many", [("m", 2), ("a", None), ("n", 9), ("y", 74)], 64, "a says /e/")
add("been", [("b", 17), ("ee", None), ("n", 9)], 65,
    "ee says /i/ here, not /ee/ (in British English it does say /ee/)")
add("into", [("i", 8), ("n", 9), ("t", 4), ("o", None)], 65, "o says /oo/")
add("because", [("b", 17), ("e", 66), ("c", 14), ("au", None), ("se", None)], 67,
    "au says /aw/, se says /z/")
add("come", [("c", 14), ("o", None), ("me", None)], 62, "o says /u/; the e does not lengthen")
add("some", [("s", 3), ("o", None), ("me", None)], 62, "o says /u/; the e does not lengthen")
add("woman", [("w", 28), ("o", None), ("m", 2), ("a", None), ("n", 9)], 69,
    "o says /oo/, a is a schwa")
add("both", [("b", 17), ("o", None), ("th", 46)], 72, "o says its name")
add("four", [("f", 7), ("our", None)], 73, "our says /or/")
add("pretty", [("p", 6), ("r", 24), ("e", None), ("tt", 66), ("y", 74)], 77, "e says /i/")
add("other", [("o", None), ("th", 46), ("er", 80)], 80, "o says /u/")
add("mother", [("m", 2), ("o", None), ("th", 46), ("er", 80)], 81, "o says /u/")
add("brother", [("b", 17), ("r", 24), ("o", None), ("th", 46), ("er", 80)], 81, "o says /u/")
add("father", [("f", 7), ("a", None), ("th", 46), ("er", 80)], 83, "a says /o/")
add("water", [("w", 28), ("a", None), ("t", 4), ("er", 80)], 83, "a says /o/")
add("today", [("t", 4), ("o", None), ("d", 13), ("ay", 84)], 84,
    "the o is a lazy little /u/ sound")
add("very", [("v", 33), ("er", None), ("y", 74)], 84,
    "here er sounds like air, not like the /er/ in her")
add("again", [("a", None), ("g", 16), ("ai", None), ("n", 9)], 86, "a is a schwa, ai says /e/")
add("always", [("a", None), ("l", 26), ("w", 28), ("ay", 84), ("s", 21)], 87, "a says /aw/")
add("door", [("d", 13), ("oor", None)], 89, "oor says /or/")
add("floor", [("f", 7), ("l", 26), ("oor", None)], 89, "oor says /or/")
add("son", [("s", 3), ("o", None), ("n", 9)], 90, "o says /u/")
add("eye", [("eye", None)], 96, "the whole word says /i/")
add("about", [("a", None), ("b", 17), ("ou", 96), ("t", 4)], 98, "a is a schwa")
add("laugh", [("l", 26), ("au", None), ("gh", None)], 110, "au says /a/, gh says /f/")


def by_lesson(n):
    return [w for w in WORDS if w.lesson == n]


def available(n):
    return [w for w in WORDS if w.lesson <= n]


def svg(hw: HeartWord, lesson: int, box=58, pad=5):
    """One word as sound boxes, hearts under whatever is odd AT THIS LESSON.

    Everything scales off `box` so the card can be sized in one place. The
    default is big on purpose: a parent and child practising together need to
    see at a glance which letters the heart sits under.
    """
    hearts = set(hw.hearts_at(lesson))
    boxes = hw.boxes()
    w = len(boxes) * box + (len(boxes) - 1) * pad
    font = round(box * 0.56)          # letter size inside each box
    heart_scale = 0.48 * box / 25     # the heart grows with the box
    heart_y = box + round(9 * box / 25)
    h = box + round(16 * box / 25)
    parts = []
    for i, g in enumerate(boxes):
        x, odd = i * (box + pad), i in hearts
        parts.append(
            f'<rect x="{x}" y="0" width="{box}" height="{box}" rx="3" '
            f'fill="{"#fdf0f0" if odd else "#fff"}" '
            f'stroke="{"#b23f28" if odd else "#1a1a1a"}" stroke-width="1.5"/>')
        parts.append(
            f'<text x="{x + box/2:.0f}" y="{box*0.68:.0f}" text-anchor="middle" '
            f'font-family="Century Gothic, Verdana, sans-serif" font-size="{font}" '
            f'fill="#1a1a1a">{g}</text>')
        if odd:
            parts.append(
                f'<path transform="translate({x + box/2:.0f},{heart_y}) '
                f'scale({heart_scale:.2f})" '
                f'd="M0,4 C-6,-3 -11,-8 -6,-11 C-3,-13 0,-10 0,-7 '
                f'C0,-10 3,-13 6,-11 C11,-8 6,-3 0,4 z" fill="#b23f28"/>')
    return (f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img" aria-label="{hw.word}, with a heart under each tricky part">'
            f'{"".join(parts)}</svg>')


if __name__ == "__main__":
    print(f"{len(WORDS)} heart words, all from the public-domain Dolch list\n")
    for n in (1, 19, 41, 46, 66):
        got = available(n)
        print(f"  by lesson {n:>3}: {len(got):>2} words — {', '.join(w.word for w in got)}")
    print("\nthe heart moves as the child learns:")
    the = next(w for w in WORDS if w.word == "the")
    for n in (1, 45, 46):
        marked = "".join(f"[{g}]" if i in the.hearts_at(n) else g
                         for i, g in enumerate(the.boxes()))
        print(f"  at lesson {n:>2}: {marked}")
