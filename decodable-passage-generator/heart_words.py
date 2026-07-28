#!/usr/bin/env python3
"""Heart words, and how to draw them so a child can actually map them.

A "heart word" is not a word to be memorised whole. That is the old
look-say approach, and it is the thing structured literacy replaced. In
orthographic mapping (Ehri), a child stores a word by connecting its *sounds*
to its *letters* — so a high-frequency word is taught by mapping the parts that
behave normally and marking only the part that does not. That irregular part is
the bit you learn "by heart", which is where the name comes from.

So `the` is not "a word to memorise". It is:

        ┌────┬────┐
        │ th │  e │      th says /th/ as always.
        └────┴──♥─┘      Only the e is odd — it says /u/. That is the heart.

Storing it that way takes one or two exposures. Memorising it whole takes
dozens, and does not transfer.

Each entry below is:
    word     the word itself
    boxes    its graphemes, one per SOUND, in order
    heart    which box indexes are irregular (0-based)

A word with an empty `heart` list is fully decodable and is included only
because it is very frequent — it gets taught as a regular word, not a heart
word, and the sheet says so.
"""


class HeartWord:
    __slots__ = ("word", "boxes", "heart", "lesson")

    def __init__(self, word, boxes, heart, lesson):
        assert "".join(boxes) == word, f"{boxes} does not spell {word!r}"
        assert all(0 <= i < len(boxes) for i in heart), f"bad heart index in {word!r}"
        self.word, self.boxes, self.heart, self.lesson = word, boxes, heart, lesson

    @property
    def regular(self):
        return not self.heart

    def __repr__(self):
        marked = "".join(f"[{b}]" if i in self.heart else b
                         for i, b in enumerate(self.boxes))
        return f"<{self.word} {marked} L{self.lesson}>"


def svg(hw: HeartWord, box=34, pad=3):
    """One word drawn as sound boxes, with a heart under the irregular part."""
    n = len(hw.boxes)
    w = n * box + (n - 1) * pad
    h = box + 16
    parts = []
    for i, g in enumerate(hw.boxes):
        x = i * (box + pad)
        odd = i in hw.heart
        parts.append(
            f'<rect x="{x}" y="0" width="{box}" height="{box}" rx="3" '
            f'fill="{"#fdf0f0" if odd else "#fff"}" '
            f'stroke="{"#b23f28" if odd else "#1a1a1a"}" stroke-width="1.5"/>')
        parts.append(
            f'<text x="{x + box/2:.0f}" y="{box*0.68:.0f}" text-anchor="middle" '
            f'font-family="Century Gothic, Verdana, sans-serif" font-size="17" '
            f'fill="#1a1a1a">{g}</text>')
        if odd:
            cx, cy = x + box / 2, box + 9
            parts.append(
                f'<path transform="translate({cx:.0f},{cy:.0f}) scale(0.55)" '
                f'd="M0,4 C-6,-3 -11,-8 -6,-11 C-3,-13 0,-10 0,-7 '
                f'C0,-10 3,-13 6,-11 C11,-8 6,-3 0,4 z" fill="#b23f28"/>')
    return (f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'role="img" aria-label="{hw.word}, with a heart under the tricky part">'
            f'{"".join(parts)}</svg>')


# ---------------------------------------------------------------------------
# The words. Lessons are filled in from research; see build_sound_list.py.
# Nothing here is copied from any published programme — these are ordinary
# English words, and which part of each is irregular is a fact about English
# spelling.
# ---------------------------------------------------------------------------
WORDS = []


def add(word, boxes, heart, lesson):
    WORDS.append(HeartWord(word, boxes, heart, lesson))


def by_lesson(n):
    """Words introduced at exactly this lesson."""
    return [w for w in WORDS if w.lesson == n]


def available(n):
    """Every heart word a child has by this lesson."""
    return [w for w in WORDS if w.lesson <= n]


if __name__ == "__main__":
    print(f"{len(WORDS)} heart words defined")
    for w in WORDS[:20]:
        print(" ", w)
