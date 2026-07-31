#!/usr/bin/env python3
"""Take-home letter-and-sound sheets for Lessons 1-5.

Lessons 6-128 get decodable-story packets from build_sheet.py. Lessons 1-4
teach the first four letters (a, m, s, t) when there is almost nothing to
read yet, and Lesson 5 teaches blending — so these five need a different
kind of sheet: a letter-and-sound sheet, not a thin story sheet.

Each lesson prints as three pages:
  1. grown-up sheet — the clean-sound warning, the mouth cue, how to run
     the letter formation, and two no-materials games
  2. the letter — keyword picture drawn into the letter's shape, then the
     formation block: model with numbered strokes and three practice rows
  3. practice — letter hunt (distractors are letters already taught),
     beginning-sound picture sort, and (from Lesson 2) a word line
Lesson 5 swaps pages 2-3 for a sound strip, blend-and-read lines, sound
boxes, a first-spelling frame, a one-letter-change chain, and read-and-do.

Only two kinds of drawing appear anywhere: the keyword anchor and the
beginning-sound sort pictures. Nothing decorative — the rest of this
project deliberately has no pictures at all.

The CSS comes from example-lesson-41.html via build_sheet.css(), the same
stylesheet all 123 story sheets use, so the family look cannot drift.

Run:  python3 build_letter_sheet.py --all
      python3 build_letter_sheet.py 3
"""

import random
import sys

from build_sheet import css, lesson_info, esc, SHEETS
from props import PROPS, STROKE

INK = "#1a1a1a"
ACCENT = "#b23f28"   # the heart-word red the family already uses

# ---------------------------------------------------------------------------
# Letter geometry. y=0 is the top handwriting line, y=50 the dotted midline,
# y=100 the baseline — the same three lines the .ruled class draws, so a
# letter drawn in these units drops straight onto the practice rows.
# Each stroke: the path, where its start dot goes, a small accent arrow
# showing direction (model letter only), and where its number sits.
# ---------------------------------------------------------------------------
LETTERS = {
    # the a's bowl is drawn a touch narrower than its stick position, so in
    # the dotted tracing row the stick reads as its own stroke instead of
    # vanishing into the bowl's right edge
    "a": dict(w=62, strokes=[
        dict(d="M44 60 A21 21 0 1 0 44 90 A21 21 0 0 0 44 60", dot=(44, 60),
             arr="M38 44 C28 36 14 40 8 50", num=(48, 36)),
        dict(d="M54 50 L54 100", dot=(54, 50),
             arr="M68 58 L68 82", num=(76, 52)),
    ]),
    "m": dict(w=88, strokes=[
        dict(d="M14 50 L14 100", dot=(14, 50),
             arr="M5 58 L5 84", num=(5, 46)),
        dict(d="M14 74 C14 52 44 52 44 74 L44 100", dot=(14, 74),
             arr="M17 56 C22 44 36 44 41 56", num=(29, 34)),
        dict(d="M44 74 C44 52 74 52 74 74 L74 100", dot=(44, 74),
             arr="M47 56 C52 44 66 44 71 56", num=(59, 34)),
    ]),
    "s": dict(w=56, strokes=[
        dict(d="M42 58 C38 51 20 51 16 59 C13 66 24 70 30 74 "
               "C38 79 42 84 38 91 C33 98 16 96 12 89", dot=(42, 58),
             arr="M46 48 C38 40 24 40 16 48", num=(52, 42)),
    ]),
    "t": dict(w=48, strokes=[
        dict(d="M22 20 L22 90 C22 99 31 102 38 96", dot=(22, 20),
             arr="M32 32 L32 74", num=(32, 22)),
        dict(d="M8 58 L38 58", dot=(8, 58),
             arr="M14 49 L32 49", num=(3, 44)),
    ]),
}

# The keyword anchor: extra marks that turn the display letter into its
# keyword picture. Only on the meet-the-letter display, never on the
# practice rows — a child traces a letter, not an apple.
ANCHOR_ART = {
    # the bowl of the a IS the apple: stem and leaf grow from its top,
    # leaning left so they never tangle with the letter's stick
    "a": ('<path d="M30 52 C30 44 28 39 24 33"/>'
          '<path d="M24 33 q-15 -9 -21 1 q13 10 21 -1 z" fill="#fff"/>'),
    # the two humps ARE the peaks: a pointed summit inside each hump,
    # tips just clear of the stroke so they read as mountains, not blobs
    "m": ('<path d="M20 70 L29 57 L38 70"/>'
          '<path d="M50 70 L59 57 L68 70"/>'
          '<path d="M25 63 l4 4 l4 -4" stroke-width="2"/>'
          '<path d="M55 63 l4 4 l4 -4" stroke-width="2"/>'),
    # the s IS the snake: head at the top end, tongue out
    "s": ('<circle cx="44" cy="56" r="8" fill="#fff"/>'
          f'<circle cx="46" cy="54" r="1.8" fill="{INK}" stroke="none"/>'
          '<path d="M52 58 l8 3" stroke-width="2"/>'
          '<path d="M60 61 l6 -2 M60 61 l2 6" stroke-width="2"/>'),
    # t: the embedded version (t as tent pole) rendered as a jumble — the
    # crossbar poked through the tent walls and it read as a mast, not a
    # tent. A legible letter matters more than a clever one, so t falls
    # back to a plain letter with the tent picture beside it (SIDE_PIC).
    "t": "",
}

# letters whose keyword is shown as a separate picture next to the letter
# instead of drawn into it
SIDE_PIC = {"t": "tent"}

# viewBox for the meet-the-letter display, per letter (the art extends
# past the letter box). Same unit scale for all so x-heights match.
MEET_VB = {"a": (-4, 22, 72, 84), "m": (4, 40, 82, 66),
           "s": (4, 42, 68, 62), "t": (-2, 12, 50, 94)}
MEET_SCALE = 1.7

UPPER = {
    "A": ("M8 100 L34 16 L60 100 M18 72 L50 72", 68),
    "M": ("M8 100 L8 18 L37 60 L66 18 L66 100", 74),
    "S": ("M56 30 C50 16 20 16 14 30 C8 44 26 50 34 56 "
          "C46 64 48 78 38 88 C28 97 10 93 6 82", 64),
    "T": ("M6 16 L62 16 M34 16 L34 100", 68),
}

# ---------------------------------------------------------------------------
# Sort pictures. Reused from props.py where one exists; the rest drawn here
# in the same 100x100, feet-on-y=100 convention. Every picture must be one
# a five-year-old names instantly — an ambiguous drawing teaches the wrong
# sound, so anything that renders unclear gets replaced, not kept.
# ---------------------------------------------------------------------------
NEW_PROPS = {
    "apple": ('<circle cx="50" cy="64" r="30" fill="#fff"/>'
              '<path d="M50 36 C50 28 53 24 58 20"/>'
              '<path d="M58 20 q16 -8 22 2 q-14 10 -22 -2 z" fill="#fff"/>'),
    "ant": ('<circle cx="22" cy="80" r="11" fill="#fff"/>'
            '<ellipse cx="46" cy="78" rx="10" ry="9" fill="#fff"/>'
            '<circle cx="70" cy="74" r="12" fill="#fff"/>'
            '<circle cx="74" cy="71" r="2" fill="#1a1a1a"/>'
            '<path d="M76 63 q4 -9 12 -11"/><path d="M70 62 q0 -10 5 -15"/>'
            '<path d="M40 85 L32 98"/><path d="M46 87 L46 99"/>'
            '<path d="M52 85 L60 98"/>'),
    "moon": ('<path d="M60 12 A43 43 0 1 0 60 96 A34 34 0 1 1 60 12 z" '
             'fill="#fff"/>'),
    "mountain": ('<path d="M4 96 L34 32 L52 68 L68 42 L96 96 z" fill="#fff"/>'
                 '<path d="M27 47 l7 6 l7 -6" stroke-width="2.4"/>'
                 '<path d="M62 51 l6 5 l6 -5" stroke-width="2.4"/>'),
    "sock": ('<path d="M34 12 L62 12 L62 52 Q62 66 74 74 Q86 82 78 92 '
             'Q68 100 56 90 L40 76 Q34 70 34 56 z" fill="#fff"/>'
             '<line x1="34" y1="24" x2="62" y2="24"/>'),
    # a snake was drawn and rendered here first, but it read as a squiggle
    # a child might call a worm — /w/, not /s/ — so the sorts use the star
    # from props.py instead; the only snake left is the s-anchor itself
    "tooth": ('<path d="M28 34 C28 14 46 12 50 20 C54 12 72 14 72 34 '
              'C72 48 66 52 64 62 C62 76 60 90 54 90 C49 90 51 68 50 62 '
              'C49 68 51 90 46 90 C40 90 38 76 36 62 C34 52 28 48 28 34 z" '
              'fill="#fff"/>'),
    "tent": ('<path d="M50 14 L6 96 L94 96 z" fill="#fff"/>'
             '<line x1="50" y1="14" x2="50" y2="96"/>'
             '<path d="M38 96 L50 68 L62 96" fill="#fff"/>'),
    # (a spinning top was tried and rendered too ambiguous — it could be
    # named "kite" or "funnel" — so /t/ uses tent, tooth and ten instead)
    "ten":('<text x="50" y="86" text-anchor="middle" font-size="66" '
            'font-weight="bold" fill="#1a1a1a" stroke="none" '
            'font-family="Century Gothic, Verdana, sans-serif">10</text>'),
}
ALL_PROPS = {**PROPS, **NEW_PROPS}


# ---------------------------------------------------------------------------
# Per-lesson content. Every sentence original — no program's wording.
# ---------------------------------------------------------------------------
DATA = {
    1: dict(
        letter="a", sound="/&#259;/", say="aaa (as in apple)", keyword="apple",
        teaches=("Today your child meets the letter <strong>a</strong> and the sound it makes: "
                 "<strong>/&#259;/</strong>, the first sound in <em>apple</em>. When we read, it is the "
                 "<strong>sound</strong> that does all the work, not the letter&rsquo;s name. The name "
                 "(&ldquo;ay&rdquo;) never appears inside words like <em>mat</em> or <em>sat</em> &mdash; "
                 "the sound /&#259;/ does. So practise the sound far more than the name."),
        clean=("Say the short sound <strong>&ldquo;a&rdquo; as in apple</strong> &mdash; not the letter "
               "name &ldquo;ay,&rdquo; and not &ldquo;ah-uh.&rdquo; Keep it short and clean. In a few "
               "lessons your child will push sounds together to read whole words, and every stray "
               "sound they learn now has to be un-learned then."),
        mouth=("<strong>a</strong> &mdash; open your mouth wide, tongue low and flat, and say "
               "<strong>/&#259;/</strong>, the first sound in <em>apple</em>. Short and open &mdash; "
               "like the little gasp at the start of &ldquo;apple.&rdquo;"),
        mouthcheck=("<strong>Mouth check:</strong> say <strong>a&nbsp;&ndash;&nbsp;a&nbsp;&ndash;&nbsp;apple</strong>. "
                    "Is your mouth open wide? Look in a mirror with your grown-up."),
        thumbs="<em>apple, ant, add, ax</em> &mdash; and some that do not: <em>sun, moon, ball</em>",
        hunt_distractors=["o", "c", "e"],
        hunt_note=("In the letter hunt, the other shapes (o, c, e) have not been taught &mdash; "
                   "your child only needs to spot the <strong>a</strong>&rsquo;s, not name the rest."),
        sort=[("apple", True), ("sun", False), ("ant", True),
              ("sock", False), ("tent", False), ("moon", False)],
        words=[],
    ),
    2: dict(
        letter="m", sound="/m/", say="mmm", keyword="mountains",
        teaches=("Today your child meets the letter <strong>m</strong> and its sound "
                 "<strong>/m/</strong> &mdash; a hum, like the start of <em>mountain</em>. Remember: "
                 "it is the <strong>sound</strong> that matters when reading, not the letter&rsquo;s "
                 "name (&ldquo;em&rdquo;). And today something big happens: with <strong>a</strong> and "
                 "<strong>m</strong> your child can read their first word &mdash; <strong>am</strong>."),
        clean=("Say <strong>&ldquo;mmm,&rdquo; not &ldquo;muh.&rdquo;</strong> Hold the hum with your "
               "lips closed and stop &mdash; no &ldquo;uh&rdquo; on the end. A child who learns "
               "&ldquo;muh&rdquo; will later try to read <em>mat</em> as &ldquo;muh-a-tuh,&rdquo; and "
               "blending becomes much harder. Clean sounds now make reading easy later."),
        mouth=("<strong>m</strong> &mdash; press your lips together and hum: <strong>mmm</strong>. "
               "The sound comes down your nose &mdash; touch the side of your nose and feel it buzz."),
        mouthcheck=("<strong>Mouth check:</strong> say <strong>mmm</strong>. Are your lips pressed "
                    "together? Can you feel your nose buzz? Look in a mirror with your grown-up."),
        thumbs="<em>moon, mop, milk, mud</em> &mdash; and some that do not: <em>sun, dog, apple</em>",
        hunt_distractors=["a"],
        hunt_note=("In the letter hunt, all the other letters are <strong>a</strong> &mdash; last "
                   "lesson&rsquo;s letter &mdash; so the hunt quietly reviews it."),
        # The mouse was dropped after two attempts at drawing it. Rendered, it
        # read as a lump a child could as easily call a snail or a rock, and a
        # picture a child names wrongly does not just fail -- in a /m/ sort it
        # teaches the wrong sound. Two clear targets beat three where one is a
        # guess. Moon and mountain are unmistakable.
        sort=[("moon", True), ("sun", False), ("mountain", True),
              ("apple", False), ("sock", False), ("star", False)],
        words=["am"],
    ),
    3: dict(
        letter="s", sound="/s/", say="sss", keyword="snake",
        teaches=("Today your child meets the letter <strong>s</strong> and its sound "
                 "<strong>/s/</strong> &mdash; the hiss at the start of <em>snake</em>. As always, "
                 "the <strong>sound</strong> is what reading uses; the name (&ldquo;ess&rdquo;) is "
                 "just what we call the letter. With a, m and s your child can now read "
                 "<strong>am</strong> and <strong>Sam</strong>."),
        clean=("Say <strong>&ldquo;sss,&rdquo; not &ldquo;suh.&rdquo;</strong> Let the hiss trail off "
               "to nothing &mdash; no &ldquo;uh&rdquo; on the end. That stray &ldquo;uh&rdquo; is the "
               "single biggest thing that makes blending hard later, because &ldquo;suh-a-m&rdquo; "
               "does not sound like <em>Sam</em>."),
        mouth=("<strong>s</strong> &mdash; teeth almost closed, lips in a small smile, and let the "
               "air hiss out like a snake: <strong>sss</strong>."),
        mouthcheck=("<strong>Mouth check:</strong> say <strong>sss</strong>. Are your teeth almost "
                    "closed? Can you feel the air hiss? Look in a mirror with your grown-up."),
        thumbs="<em>sun, sock, soup, sand</em> &mdash; and some that do not: <em>moon, apple, dog</em>",
        hunt_distractors=["a", "m"],
        hunt_note=("In the letter hunt, the other letters are <strong>a</strong> and <strong>m</strong> "
                   "from the last two lessons, so the hunt doubles as review."),
        sort=[("sun", True), ("moon", False), ("sock", True),
              ("apple", False), ("star", True), ("tent", False)],
        words=["am", "Sam"],
    ),
    4: dict(
        letter="t", sound="/t/", say="t", keyword="tent",
        teaches=("Today your child meets the letter <strong>t</strong> and its sound "
                 "<strong>/t/</strong> &mdash; a quick, quiet tap, like the start of <em>tent</em>. "
                 "The <strong>sound</strong> is what reading uses, never the name (&ldquo;tee&rdquo;). "
                 "With a, m, s and t your child can now read five real words: <strong>am, at, mat, "
                 "sat</strong> and <strong>Sam</strong>."),
        clean=("Say <strong>&ldquo;t,&rdquo; not &ldquo;tuh.&rdquo;</strong> It is the quietest sound "
               "so far &mdash; just a tap of air, then stop. &ldquo;Tuh&rdquo; feels easier to say "
               "loudly, but a child who learns it will read <em>at</em> as &ldquo;a-tuh,&rdquo; and "
               "un-learning that is much harder than learning it right today."),
        mouth=("<strong>t</strong> &mdash; tap your tongue just behind your top teeth: "
               "<strong>t</strong>. Quick and quiet, and no &ldquo;uh&rdquo; after it."),
        mouthcheck=("<strong>Mouth check:</strong> say <strong>t&nbsp;&ndash;&nbsp;t&nbsp;&ndash;&nbsp;t</strong>. "
                    "Did your tongue tap behind your top teeth? Look in a mirror with your grown-up."),
        thumbs="<em>tent, top, ten, toes</em> &mdash; and some that do not: <em>sun, moon, apple</em>",
        hunt_distractors=["a", "m", "s"],
        hunt_note=("In the letter hunt, the other letters are <strong>a</strong>, <strong>m</strong> "
                   "and <strong>s</strong> &mdash; every letter learned so far, all in review."),
        sort=[("tent", True), ("sun", False), ("tooth", True),
              ("moon", False), ("ten", True), ("star", False)],
        words=["am", "at", "mat", "sat", "Sam"],
    ),
}

SORT_NAMES = {
    "apple": "an apple", "sun": "the sun", "ant": "an ant", "sock": "a sock",
    "tent": "a tent", "moon": "the moon", "mountain": "a mountain",
    "mouse": "a mouse", "star": "a star", "tooth": "a tooth",
    "ten": "the number ten",
}

# a mouse is not in props.py and not in the teacher's icon list, but m-words
# a five-year-old can name from a picture are scarce; drawn as the classic
# hump-backed silhouette with one big round ear. Judged on render.
NEW_PROPS["mouse"] = (
    '<path d="M26 96 Q22 62 54 58 Q84 56 96 92 L96 96 z" fill="#fff"/>'
    '<circle cx="58" cy="52" r="14" fill="#fff"/>'
    '<circle cx="58" cy="52" r="6" fill="none" stroke-width="1.8"/>'
    '<circle cx="86" cy="74" r="2.4" fill="#1a1a1a"/>'
    '<path d="M96 86 L104 80 M96 90 L104 92" stroke-width="1.8"/>'
    '<path d="M26 94 Q6 92 6 74 Q6 60 18 58" stroke-width="2.6" fill="none"/>')
ALL_PROPS["mouse"] = NEW_PROPS["mouse"]


# ---------------------------------------------------------------------------
# SVG builders
# ---------------------------------------------------------------------------
def guides(x0, x1):
    """The three handwriting lines, in letter units."""
    return (f'<line x1="{x0}" y1="0" x2="{x1}" y2="0" stroke="{INK}" stroke-width="1.6"/>'
            f'<line x1="{x0}" y1="50" x2="{x1}" y2="50" stroke="#8a8a8a" '
            f'stroke-width="1.6" stroke-dasharray="6 6"/>'
            f'<line x1="{x0}" y1="100" x2="{x1}" y2="100" stroke="{INK}" stroke-width="1.6"/>')


def model_svg(letter, height=168):
    """The big model letter: strokes, start dots, numbered direction arrows."""
    L = LETTERS[letter]
    w = L["w"]
    pad = 30
    parts = [f'<defs><marker id="ah-{letter}" viewBox="0 0 10 10" refX="8" refY="5" '
             f'markerWidth="5" markerHeight="5" orient="auto-start-reverse">'
             f'<path d="M0 0 L10 5 L0 10 z" fill="{ACCENT}"/></marker></defs>',
             guides(-pad + 4, w + pad - 4)]
    for i, s in enumerate(L["strokes"], 1):
        parts.append(f'<path d="{s["d"]}" fill="none" stroke="{INK}" stroke-width="7" '
                     f'stroke-linecap="round" stroke-linejoin="round"/>')
        parts.append(f'<path d="{s["arr"]}" fill="none" stroke="{ACCENT}" stroke-width="2.5" '
                     f'stroke-linecap="round" marker-end="url(#ah-{letter})"/>')
        dx, dy = s["dot"]
        parts.append(f'<circle cx="{dx}" cy="{dy}" r="5" fill="{ACCENT}"/>')
        nx, ny = s["num"]
        parts.append(f'<circle cx="{nx}" cy="{ny}" r="8.5" fill="{ACCENT}"/>'
                     f'<text x="{nx}" y="{ny + 4.5}" text-anchor="middle" font-size="12" '
                     f'font-weight="bold" fill="#fff">{i}</text>')
    vb_w = w + pad * 2
    return (f'<svg viewBox="-{pad} -20 {vb_w} 142" height="{height}" '
            f'width="{height * vb_w / 142:.0f}" role="img" '
            f'aria-label="How to write the letter {letter}">{"".join(parts)}</svg>')


def trace_row(letter, mode, n=4, row_units=880):
    """One practice row inside a .ruled guide. mode: solid | dotted | empty."""
    L = LETTERS[letter]
    w = L["w"]
    step = row_units / n
    letters = []
    for i in range(n):
        x = step * i + (step - w) / 2
        g = [f'<g transform="translate({x:.0f},0)">']
        for j, s in enumerate(L["strokes"]):
            if mode == "solid":
                g.append(f'<path d="{s["d"]}" fill="none" stroke="{INK}" stroke-width="7" '
                         f'stroke-linecap="round" stroke-linejoin="round"/>')
            elif mode == "dotted":
                g.append(f'<path d="{s["d"]}" fill="none" stroke="#666" stroke-width="5.5" '
                         f'stroke-linecap="round" stroke-dasharray="0.5 8"/>')
            dx, dy = s["dot"]
            r = 5 if j == 0 else 3
            g.append(f'<circle cx="{dx}" cy="{dy}" r="{r}" fill="{ACCENT}"/>')
        g.append('</g>')
        letters.append("".join(g))
    svg = (f'<svg viewBox="0 0 {row_units} 100" preserveAspectRatio="xMidYMid meet">'
           f'{"".join(letters)}</svg>')
    return f'<div class="ruled trace"><span class="mid"></span>{svg}</div>'


def meet_block(letter):
    """Big lowercase letter with the keyword drawn into its shape, plus the
    capital beside it, clearly secondary."""
    L = LETTERS[letter]
    x0, y0, vw, vh = MEET_VB[letter]
    strokes = "".join(
        f'<path d="{s["d"]}" fill="none" stroke="{INK}" stroke-width="7" '
        f'stroke-linecap="round" stroke-linejoin="round"/>' for s in L["strokes"])
    art = (f'<g fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round" '
           f'stroke-linejoin="round">{ANCHOR_ART[letter]}</g>')
    lc = (f'<svg viewBox="{x0} {y0} {vw} {vh}" height="{vh * MEET_SCALE:.0f}" '
          f'width="{vw * MEET_SCALE:.0f}" role="img" '
          f'aria-label="The letter {letter} drawn as {DATA_KEYWORD[letter]}">'
          f'{strokes}{art}</svg>')
    up = letter.upper()
    ud, uw = UPPER[up]
    uc = (f'<svg viewBox="0 8 {uw + 8} 100" height="86" width="{(uw + 8) * 0.86:.0f}">'
          f'<path d="{ud}" fill="none" stroke="#777" stroke-width="5" '
          f'stroke-linecap="round" stroke-linejoin="round"/></svg>')
    side = ""
    if letter in SIDE_PIC:
        name = SIDE_PIC[letter]
        side = (f'<div>{pic_svg(name, 140)}'
                f'<div class="mcap">{SORT_NAMES[name]}</div></div>')
    return (f'<div class="meet">'
            f'<div>{lc}<div class="mcap"><strong>small {letter}</strong> &mdash; the one you write</div></div>'
            f'{side}'
            f'<div>{uc}<div class="mcap">capital {up} &mdash; just to know it</div></div>'
            f'</div>')


def pic_svg(name, size=92):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 100 100" role="img" '
            f'aria-label="{SORT_NAMES.get(name, name)}"><g {STROKE}>{ALL_PROPS[name]}</g></svg>')


def slide_arrow(w):
    return (f'<svg width="{w}" height="16" viewBox="0 0 {w} 16">'
            f'<g fill="none" stroke="{INK}" stroke-width="2.5" stroke-linecap="round" '
            f'stroke-linejoin="round"><line x1="3" y1="8" x2="{w - 14}" y2="8"/>'
            f'<path d="M{w - 15} 2 L{w - 3} 8 L{w - 15} 14"/></g></svg>')


def sound_dots(word, px):
    """A dot under each sound, spaced to sit beneath its own letter.

    This is the touch-and-sweep routine: the child touches each dot as they say
    its sound, then sweeps along the arrow and says the whole word. The dots
    matter for a reason a grown-up would not guess -- a small finger moves much
    faster than a beginner can sound a letter out, so without landing places the
    finger outruns the eye and the tracking stops helping.

    The dots say WHERE each sound lives; the arrow underneath says do not stop
    between them. Both are needed: dots alone invite "/m/ ... /a/ ... /t/",
    which does not sound like mat.

    One dot per GRAPHEME, not per letter -- at these lessons every grapheme is a
    single letter, but a later sheet using sh or ck must give the pair one dot.
    """
    step = px * 0.62          # matches the letter-spacing of .bwd
    w = int(len(word) * step) + 16
    dots = "".join(
        f'<circle cx="{8 + step * (i + 0.5):.0f}" cy="9" r="{px * 0.075:.1f}" '
        f'fill="{INK}"/>'
        for i in range(len(word)))
    return f'<svg width="{w}" height="20" viewBox="0 0 {w} 20">{dots}</svg>'


def word_item(word, px=84):
    aw = max(int(len(word) * px * 0.72) + 24, 120)
    return (f'<div class="bw"><div class="bwd" style="font-size:{px}px">{esc(word)}</div>'
            f'{sound_dots(word, px)}{slide_arrow(aw)}</div>')


def hunt_grid(n, letter, distractors, total=24, targets=9):
    rng = random.Random(n * 7 + 3)
    pool = [letter] * targets + [distractors[i % len(distractors)]
                                 for i in range(total - targets)]
    rng.shuffle(pool)
    cells = "".join(f'<div>{c}</div>' for c in pool)
    return targets, f'<div class="lhunt">{cells}</div>'


def sort_row(items):
    pics = "".join(f'<div class="pic">{pic_svg(name)}</div>' for name, _ in items)
    return f'<div class="sortrow">{pics}</div>'


def elkonin_row(word, boxes, write=False, label=""):
    cells = "".join('<span class="ebox"></span>' for _ in range(boxes))
    aw = boxes * 77 + (boxes - 1) * 10
    lead = (f'<span class="enum">{label}</span>' if write
            else f'<span class="eword">{esc(word)}</span>')
    return (f'<div class="erow">{lead}'
            f'<div class="ecol"><div class="eboxes">{cells}</div>{slide_arrow(aw)}</div>'
            f'</div>')


DATA_KEYWORD = {"a": "an apple", "m": "mountains", "s": "a snake", "t": "a tent"}


# ---------------------------------------------------------------------------
# Pages, Lessons 1-4
# ---------------------------------------------------------------------------
def head(n, skill, page_note):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Letter &amp; Sound Sheet &mdash; Lesson {n}, {esc(skill)}</title>
<style>{css()}
  /* Scoped to the five letter sheets only -- the other 123 keep the
     stylesheet exactly as it is. The blend words were made much larger
     on the teacher's request, so the room comes out of the gaps between
     blocks rather than out of anything the child uses. */
  h2 {{ margin-top: 10px; }}
  .sub {{ margin-bottom: 4px; }}
  .doit {{ margin: 2px 0; }}
  .chain {{ margin-bottom: 2px; }}
  /* The words page holds only words, so they get room to breathe --
     air between them is what stops a small finger sliding on to the
     next word before the child has finished the one they are on. */
  .wline {{ gap: 54px 40px; margin-top: 26px; }}
  .tip {{ padding: 4px 11px; margin: 2px 0 3px; }}
  .tip p {{ margin: 1px 0; }}
  .audit {{ padding: 4px 12px; margin-top: 6px; }}
</style>
</head>
<body>

<div class="toolbar">
  <button onclick="window.print()">Print / Save as PDF</button>
  <span>{page_note} Choose &ldquo;Save as PDF&rdquo; to keep a copy.</span>
</div>
"""


def adult_page_letter(n, skill, d):
    letter = d["letter"]
    words_help = ""
    if d["words"]:
        words_help = """
  <h2>How to run the words page</h2>
  <div class="tip">
    <p><strong>Two kinds of dot.</strong> The <strong>red</strong> dot on the writing
    page is where the pencil starts. The dots under a word are its <strong>sounds</strong>
    &mdash; touch each one, say its sound, then slide along the arrow and say the word.
    Fuller instructions are on the words page itself.</p>
  </div>
"""
    if n == 1:
        ready = ("<strong>This is Lesson 1 &mdash; the very beginning.</strong> Nothing comes "
                 "before it, so any child who is ready to start reading can start here.")
    else:
        taught = ", ".join(DATA[i]["letter"] for i in range(1, n))
        ready = (f"<strong>This is Lesson {n}. It assumes your child has met the letters from "
                 f"Lessons 1&ndash;{n - 1} ({taught}).</strong> If not, start at Lesson 1 &mdash; "
                 f"each sheet takes only a few minutes.")
    return f"""
<!-- ================= PAGE 1 — GROWN-UP SHEET ================= -->
<div class="page">

  <span class="owner adult">Grown-up sheet &mdash; keep this one</span>
  <div class="band">
    <div>
      <div class="tag">Letter &amp; Sound &middot; Reading Foundations</div>
      <h1>The letter {letter} says {d["sound"]}</h1>
    </div>
    <div class="flagged">Lesson {n}<br>{esc(skill)}</div>
  </div>

  <div class="prereq">
    <p style="margin:0">{ready}</p>
  </div>

  <h2>What this lesson teaches</h2>
  <div class="tip">
    <p>{d["teaches"]}</p>
  </div>

  <div class="prereq">
    <div class="h">The one thing to get right &mdash; say the sound clean</div>
    <p>{d["clean"]}</p>
  </div>

  <h2>The mouth cue &mdash; say it together at a mirror</h2>
  <div class="tip">
    <p>{d["mouth"]}</p>
    <p>Watch each other&rsquo;s mouths in a mirror. Seeing what the mouth does makes the
    sound stick far better than hearing it alone.</p>
  </div>

  <h2>How to run the writing page</h2>
  <div class="tip">
    <p><strong>Big first, small last.</strong> Sky-write it huge in the air, then
    finger-trace the big letters, then pick up a pencil. <strong>Always start at the red
    dot,</strong> and say &ldquo;{d["say"]}&rdquo; each time a letter is finished, so hand
    and sound get glued together.</p>
    <p><strong>Backwards letters are completely normal at this age.</strong> Point at the
    start dot and try again &mdash; it fixes itself with practice.</p>
  </div>

{words_help}
  <h2>Two games &mdash; no pencil, no paper</h2>
  <div class="tip">
    <p><strong>1. Thumbs up.</strong> Say words one at a time; thumbs up if the word starts
    with {d["sound"]}. Try: {d["thumbs"]}.</p>
    <p><strong>2. Robot talk.</strong> Say a word in two robot pieces, they snap it
    together: &ldquo;I say <em>c&hellip;at</em> &mdash; you say <em>cat</em>!&rdquo; No
    letters needed &mdash; this one works in the car.</p>
  </div>

  <div class="audit">
    <p style="margin:0 0 4px"><strong>Five minutes a day beats twenty on Saturday. Stop while
    it is still fun.</strong></p>
    <p style="margin:0">{d["hunt_note"]} On the picture page, name the pictures together
    first: {", ".join(SORT_NAMES[name] for name, _ in d["sort"])}.</p>
  </div>

  <div class="foot">
    <span>Grown-up sheet &mdash; Lesson {n}, {esc(skill)}</span>
    <span>Original text and drawings.</span>
  </div>

</div>
"""


def letter_page(n, d):
    letter = d["letter"]
    return f"""
<!-- ================= PAGE 2 — MY LETTER ================= -->
<div class="page">

  <div class="band">
    <div>
      <span class="owner child" style="margin-bottom:3px">For the reader</span>
      <div class="tag">My letter page</div>
      <h1>{letter} is for {d["keyword"]}</h1>
    </div>
    <div class="nameline"><span class="lbl">Name</span><span class="rule"></span></div>
  </div>

  {meet_block(letter)}

  <p class="mouthline">{d["mouthcheck"]}</p>

  <h2>Write it <span class="h2note">&mdash; start at the dot every time, and say
  &ldquo;{d["say"]}&rdquo; each time you finish one</span></h2>
  <div class="wmodel">
    {model_svg(letter)}
  </div>

  <p class="rowlab">1. Trace the big letters with your <strong>finger</strong>.</p>
  {trace_row(letter, "solid")}
  <p class="rowlab">2. Trace the dotted letters with a <strong>pencil</strong>. Start at the dot.</p>
  {trace_row(letter, "dotted")}
  <p class="rowlab">3. Now write it on your own. Start at each dot.</p>
  {trace_row(letter, "empty")}

</div>
"""


def practice_page(n, d):
    letter = d["letter"]
    targets, grid = hunt_grid(n, letter, d["hunt_distractors"])
    return f"""
<!-- ================= PAGE 3 — MY PRACTICE ================= -->
<div class="page">

  <div class="band">
    <div>
      <span class="owner child" style="margin-bottom:3px">For the reader</span>
      <div class="tag">My practice page</div>
      <h1>Find {letter}, hear {d["sound"]}</h1>
    </div>
    <div class="nameline"><span class="lbl">Name</span><span class="rule"></span></div>
  </div>

  <h2>Letter hunt</h2>
  <p class="sub">Circle every <strong>{letter}</strong>. There are {targets} to find.</p>
  {grid}

  <h2>Circle the ones that start with {d["sound"]}</h2>
  <p class="sub">Name each picture out loud with your grown-up first. Then circle the ones
  that start with {d["sound"]}.</p>
  {sort_row(d["sort"])}

</div>
"""


def word_page(n, d):
    """The read-the-words page. Only exists once there are words."""
    if not d["words"]:
        return ""
    items = "".join(word_item(w) for w in d["words"])
    plural = "s" if len(d["words"]) > 1 else ""
    return f"""
<!-- ================= PAGE 4 &mdash; READ THE WORDS ================= -->
<div class="page">

  <div class="band">
    <div>
      <span class="owner child" style="margin-bottom:3px">For the reader</span>
      <div class="tag">My words page</div>
      <h1>Read the word{plural}</h1>
    </div>
    <div class="nameline"><span class="lbl">Name</span><span class="rule"></span></div>
  </div>

  <h2>Touch, then slide</h2>
  <p class="sub">Touch each dot and say its sound. Then slide along the arrow
  without stopping &mdash; and say the word.</p>
  <div class="wline">{items}</div>

  <div class="optional" style="margin-top:26px">
    <strong>For the grown-up.</strong> The dots under each word are its
    <strong>sounds</strong> &mdash; one dot per sound. Your child touches each dot and
    says that sound, then slides a finger along the arrow and says the whole word.
    <strong>The arrow matters as much as the dots:</strong> the dots show <em>where</em>
    the sounds are, the arrow says <strong>do not stop between them</strong>. Said with
    gaps, &ldquo;/m/ &hellip; /a/ &hellip; /t/&rdquo; does not sound like <em>mat</em>;
    stretched together, &ldquo;mmmaaat&rdquo; does. The dots exist because a small finger
    moves faster than a beginner can sound a letter out &mdash; they give it somewhere to
    land. If your child gets stuck, you slide and stretch it first and let them copy you.
  </div>

</div>
"""


# ---------------------------------------------------------------------------
# Lesson 5 — blending
# ---------------------------------------------------------------------------
def adult_page_blend(n, skill):
    return f"""
<!-- ================= PAGE 1 — GROWN-UP SHEET ================= -->
<div class="page">

  <span class="owner adult">Grown-up sheet &mdash; keep this one</span>
  <div class="band">
    <div>
      <div class="tag">Letter &amp; Sound &middot; Reading Foundations</div>
      <h1>Putting sounds together</h1>
    </div>
    <div class="flagged">Lesson {n}<br>{esc(skill)}</div>
  </div>

  <div class="prereq">
    <p style="margin:0"><strong>This is Lesson 5. It assumes your child knows the sounds for
    a, m, s and t</strong> (Lessons 1&ndash;4). If any of those are shaky, spend a few minutes
    back on that letter&rsquo;s sheet first &mdash; blending only works when the sounds
    underneath it are solid.</p>
  </div>

  <h2>What this lesson teaches</h2>
  <div class="tip">
    <p>Today the sounds turn into <strong>words</strong>. Pushing /s/ /&#259;/ /m/ together and
    hearing <em>Sam</em> is the single biggest step in learning to read &mdash; everything after
    this is more letters, but the same move. It is called <strong>blending</strong>, and how you
    model it matters, so please read the box below before you start.</p>
  </div>

  <div class="prereq">
    <div class="h">How to blend &mdash; the one thing to get right today</div>
    <p><strong>Slide your finger under the word and stretch the sounds together with no gaps:</strong>
    &ldquo;mmmaaat&rdquo; &mdash; then say it fast: <em>mat</em>. One long connected sound, like
    stretching a rubber band, not three separate pieces: choppy &ldquo;/m/ &hellip; /a/ &hellip;
    /t/&rdquo; is much harder for a beginner to glue back together.</p>
    <p>If your child is stuck, <strong>you</strong> stretch the word slowly and they copy you.
    That is teaching, not cheating. And keep the sounds clean &mdash; &ldquo;mmm,&rdquo; never
    &ldquo;muh.&rdquo;</p>
  </div>

  <h2>How to run the pages, in order</h2>
  <div class="tip">
    <p><strong>1. The sound strip.</strong> They touch each letter and say its sound. Quick
    and confident before any words.</p>
    <p><strong>2. Slide and read.</strong> They touch each dot below the word and say that sound, then slide a finger along the arrow &mdash; without stopping &mdash; and say the word fast. The dots show where the sounds are; the arrow says do not stop between them,
    then fast. The two-letter words come first. Words starting with m and s come before the
    t-words on purpose &mdash; you can stretch &ldquo;mmm&rdquo; and &ldquo;sss,&rdquo; but a
    /t/ cannot be held, which makes t-first words the hardest kind.</p>
    <p><strong>3. Sound boxes.</strong> Say the word slowly; they touch one box for each sound
    they hear, then sweep a finger under the boxes and say it fast.</p>
    <p><strong>4. Their first spelling.</strong> You say <strong>&ldquo;at&rdquo;</strong> for
    the two empty boxes and <strong>&ldquo;sat&rdquo;</strong> for the three. They say it slowly,
    touch a box per sound, then write one letter in each box. This is the first time they write
    a word &mdash; make a fuss.</p>
    <p><strong>5. The changing word.</strong> They read the chain and point at what changed
    each time &mdash; one letter changing makes a whole new word.</p>
    <p><strong>6. Read it and do it.</strong> They read the word and act it out. Reading that
    <em>does</em> something is the best joke a five-year-old knows.</p>
  </div>

  <div class="audit">
    <p style="margin:0"><strong>Five minutes a day beats twenty on Saturday. Stop while it is
    still fun.</strong> If today is hard, shrink it: just the sound strip and <em>am</em> is a
    perfectly good day.</p>
  </div>

  <div class="foot">
    <span>Grown-up sheet &mdash; Lesson {n}, {esc(skill)}</span>
    <span>Original text and drawings.</span>
  </div>

</div>
"""


def blend_read_page():
    rows = "".join(word_item(w, 46) for w in ["am", "at", "mat", "sat", "Sam"])
    return f"""
<!-- ================= PAGE 2 — SLIDE AND READ ================= -->
<div class="page">

  <div class="band">
    <div>
      <span class="owner child" style="margin-bottom:3px">For the reader</span>
      <div class="tag">My reading page</div>
      <h1>My first words</h1>
    </div>
    <div class="nameline"><span class="lbl">Name</span><span class="rule"></span></div>
  </div>

  <h2>Touch and say</h2>
  <p class="sub">Touch each box. Say its sound &mdash; clean and clear.</p>
  <div class="sstrip"><div>a</div><div>m</div><div>s</div><div>t</div></div>

  <h2>Slide and read</h2>
  <p class="sub">Touch each dot and say its sound. Then slide along the arrow without stopping,
  then say the word fast.</p>
  <div class="blendrows">{rows}</div>


</div>
"""


DOIT_BLOCK = """
  <h2>Read it and do it</h2>
  <p class="sub">Read the word. Your grown-up reads the job.</p>
  <div class="doit"><span class="dw">sat</span><span class="da">&mdash; now sit down!</span></div>
  <div class="doit"><span class="dw">mat</span><span class="da">&mdash; now touch the floor!</span></div>
"""


def sound_box_page():
    return f"""
<!-- ================= PAGE 3 — SOUND BOXES ================= -->
<div class="page">

  <div class="band">
    <div>
      <span class="owner child" style="margin-bottom:3px">For the reader</span>
      <div class="tag">My sound boxes</div>
      <h1>Touch it, sweep it, say it</h1>
    </div>
    <div class="nameline"><span class="lbl">Name</span><span class="rule"></span></div>
  </div>

  <h2>Touch the sound boxes</h2>
  <p class="sub">Read the word. Say it slowly and touch one box for each sound you hear.
  Then sweep your finger along the arrow and say it fast.</p>
  {elkonin_row("am", 2)}
  {elkonin_row("mat", 3)}

  <h2>Your first spelling</h2>
  <p class="sub">Your grown-up says a word. Say it slowly, touch a box for each sound &mdash;
  then write one letter in each box.</p>
  {elkonin_row("", 2, write=True, label="1.")}
  {elkonin_row("", 3, write=True, label="2.")}

</div>
"""


def chain_page():
    return f"""
<!-- ================= PAGE 4 &mdash; THE CHANGING WORD ================= -->
<div class="page">

  <div class="band">
    <div>
      <span class="owner child" style="margin-bottom:3px">For the reader</span>
      <div class="tag">My words page</div>
      <h1>One letter changes</h1>
    </div>
    <div class="nameline"><span class="lbl">Name</span><span class="rule"></span></div>
  </div>

  <h2>The changing word</h2>
  <p class="sub">Read across. What changed each time? Point at the new letter.</p>
  <div class="chain">
    <span>am</span><span class="chev">&#9654;</span>
    <span>at</span><span class="chev">&#9654;</span>
    <span>mat</span><span class="chev">&#9654;</span>
    <span>sat</span>
  </div>

{DOIT_BLOCK}

</div>
"""


# ---------------------------------------------------------------------------
def build_html(n):
    L, _ = lesson_info(n)
    skill = L["skill"]
    if n == 5:
        body = (adult_page_blend(n, skill) + blend_read_page()
                + sound_box_page() + chain_page())
    else:
        d = DATA[n]
        body = (adult_page_letter(n, skill, d) + letter_page(n, d)
                + practice_page(n, d) + word_page(n, d))
    pages = body.count('<div class="page">')
    note = (f"Prints as {pages} pages: 1 grown-up sheet, then "
            f"{pages - 1} child sheets.")
    return head(n, skill, note) + body + "\n</body>\n</html>\n"


def write_sheet(n):
    SHEETS.mkdir(exist_ok=True)
    out = SHEETS / f"lesson-{n:03d}.html"
    out.write_text(build_html(n))
    return out


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    lessons = range(1, 6) if args[0] == "--all" else [int(a) for a in args]
    for n in lessons:
        print(f"  {write_sheet(n).name}")
    print(f"\n{len(list(lessons))} letter sheets written to {SHEETS}")


if __name__ == "__main__":
    main()
