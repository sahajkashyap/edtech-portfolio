#!/usr/bin/env python3
"""Turn an approved passage into the printable packet.

Four sheets normally: the grown-up sheet, the story, the drawing page and the
optional questions. A story too long for one page takes a second story page
rather than smaller type, so the late lessons print five.

The CSS is lifted straight out of example-lesson-41.html — the sheet the teacher
reviewed and signed off — so 128 packets cannot drift away from the one design
that was actually approved.

A passage spec is:
    {"lesson": 41, "title": "Mud Pig",
     "lines": ["Sam has a pig.", ...],
     "warmup": ["pig","mud","sun","tub","rag","wet"],
     "questions": [{"ask": "...", "listenFor": "..."}, ...]}

Run:  python3 build_sheet.py passages/lesson-041.json
      python3 build_sheet.py --all
"""

import html
import json
import pathlib
import re
import sys

import heart_words as HEART

HERE = pathlib.Path(__file__).parent

# Story type shrinks as the reader advances, which is what real readers do and
# what makes room for longer stories. With no picture on the reading page (the
# child builds the picture in their head and draws it after — a printed one
# turns the drawing page into copying) the whole page belongs to the words, so
# every band runs as large as the page and the line lengths allow.
# The ceiling on each size is not page height but line WIDTH: every passage was
# written up to the width of the old, narrower column, and a story line must
# never wrap — the line is the unit a beginner points along. These are the
# largest sizes at which the widest line in each band still fits the 694px
# column (measured across all 123 sheets, with a few px of safety).
#   lesson ceiling -> (font px, line-height)
TYPE_BANDS = [
    (45,  (25, 1.66)),
    (65,  (24, 1.62)),
    (90,  (21, 1.58)),
    (128, (21, 1.54)),
]


def type_for(lesson):
    for ceiling, band in TYPE_BANDS:
        if lesson <= ceiling:
            return band
    return TYPE_BANDS[-1][1]


# The story is never split, so the only question left is whether the warm-up
# words and heart cards can share its page. When they cannot, they get a page
# of their own ahead of it. words-page.json lists the lessons where that is
# needed, found by rendering rather than guessed -- see decide_words_page.py.
_WORDS_PAGE = None


def _words_page_set():
    global _WORDS_PAGE
    if _WORDS_PAGE is None:
        f = HERE / "words-page.json"
        _WORDS_PAGE = (set(str(x) for x in json.loads(f.read_text())["lessons"])
                       if f.exists() else set())
    return _WORDS_PAGE


TEMPLATE = HERE / "example-lesson-41.html"
SOUND_LIST = HERE / "sound-list.json"
PASSAGES = HERE / "passages"
SHEETS = HERE / "sheets"


def css():
    """The approved stylesheet, verbatim."""
    m = re.search(r"<style>(.*?)</style>", TEMPLATE.read_text(), re.S)
    if not m:
        sys.exit("Could not find the <style> block in the approved template")
    return m.group(1)


def lesson_info(n):
    doc = json.loads(SOUND_LIST.read_text())
    L = doc["lessons"][n - 1]
    return L, doc


def esc(s):
    return html.escape(str(s), quote=False)


def pick_dictation(lines):
    """The one sentence the parent reads aloud for the child to write.

    Chosen in code, deterministically, so the same lesson always gives the same
    sentence and the parent never has to decide. Preference order: no dialogue
    punctuation (a child writing by hand does not need quotation marks), five
    to seven words (widened only if nothing qualifies), a single calm sentence
    over an exclamation or a double sentence, and a line from the middle of the
    story over the first or last.
    """
    n = len(lines)
    center = (n - 1) / 2
    plain = [i for i, l in enumerate(lines)
             if '"' not in l and "“" not in l and "”" not in l]
    pool = plain or list(range(n))

    def key(i):
        l = lines[i].strip()
        words = len(l.split())
        return (
            0 if 5 <= words <= 7 else abs(words - 6),   # 5-7 words first
            l.count(".") + l.count("!") + l.count("?"), # one sentence, calm
            1 if l.endswith("!") else 0,
            0 if 0 < i < n - 1 else 1,                  # not first or last
            abs(i - center), i)                         # middle of the story

    return lines[min(pool, key=key)].strip()


# Now that a story has a page to itself, its type is no longer a band constant
# -- it grows until the story fills the page. A nine-line story at Lesson 45 was
# leaving a third of the sheet blank at 25px; there is no reason a child should
# read small type on an empty page.
#
# Two ceilings, and the tighter one wins:
#   height -- the lines have to fit between the header and the fluency stars
#   width  -- a line must NEVER wrap. The line is the unit a child points
#             along, so the widest line in the story sets the limit.
PAGE_PX = 940.8         # usable height of a letter sheet
COLUMN_PX = 690         # usable width inside the passage box
HEADER_PX = 150         # banner, name line, "Read the story" heading
TAIL_PX = 62            # the read-it-3-times row under the story
BOX_PX = 34             # the passage box's own padding and border
CHAR_EM = 0.655         # width of a character at 1em, with headroom. The
                        # sheets name several faces so they still look right
                        # on a machine that lacks the first one, and those
                        # faces are not the same width. Measuring the
                        # narrowest and sizing to it would wrap on somebody
                        # else's printer, so this leaves room for a wider
                        # fallback -- a slightly smaller line beats a broken one.
TYPE_CEILING = 38       # past this it stops looking like a book to a child


def story_type(lesson, lines):
    """The largest type this story can be set in on a page of its own."""
    base_px, line_h = type_for(lesson)
    # 14px of slack: the header varies a little with title length, and a
    # story page that misses by two pixels is as broken as one that misses
    # by fifty.
    room = PAGE_PX - HEADER_PX - TAIL_PX - BOX_PX - 14
    # title sits above the lines and scales with them, at about 1.75x
    by_height = room / (len(lines) * line_h + 1.75)
    widest = max(len(l) for l in lines)
    by_width = COLUMN_PX / (widest * CHAR_EM)
    # 18px is the floor -- the smallest a seven-year-old should be asked to
    # read. The band size is where a story STARTS, not a floor: the longest
    # stories genuinely need to come down to 18 to keep the story whole on one
    # page, and keeping the story whole is worth more than three points of type.
    px = max(18, int(min(by_height, by_width, TYPE_CEILING)))
    # A short story is capped by line WIDTH, not height, so growing the type
    # cannot fill the page and the sheet ends up two-thirds empty. Spend what
    # is left on leading instead: more air between lines is easier for a young
    # reader to track along, and it is space the child gets rather than loses.
    fits = (room / px - 1.75) / len(lines)
    return px, round(max(line_h, min(fits, 2.5)), 2)


def build_html(spec):
    n = spec["lesson"]
    L, doc = lesson_info(n)
    title = spec["title"]
    lines = spec["lines"]
    warm = spec["warmup"]
    questions = spec["questions"]
    hearts = L["allowedHeartWords"]
    story_words = " ".join(lines).split()
    word_count = len(story_words)

    prereq = (f"It uses only sounds already taught in Lessons 1&ndash;{n - 1}."
              if n > 1 else "It is the very first one, so any beginning reader can try it.")

    wb = L.get("requiresWordBank") or []
    wb_note = ""
    if wb:
        spellings = ", ".join(f"<code>{esc(w['spelling'])}</code>" for w in wb)
        wb_note = (f" The spelling {spellings} can say more than one sound in English; "
                   f"every word here uses only the one taught so far.")

    warm_html = "".join(f"<div>{esc(w)}</div>" for w in warm)
    # Heart words get mapped, not memorised. Show the newest few as sound boxes
    # with a heart under whatever is odd AT THIS LESSON -- "the" carries two
    # hearts until th is taught, then one. Older words are listed plainly for a
    # quick read; a child who has known "the" for ninety lessons does not need
    # to map it again.
    new_here = [w for w in HEART.available(n) if w.lesson > n - 6]
    new_here = new_here[-2:] if len(new_here) > 2 else new_here
    mapped_words = {w.word for w in new_here}
    older = [w for w in hearts if w not in mapped_words]

    if new_here:
        # Name the word under its boxes. The stylesheet always had .hwword and
        # nothing ever filled it, so a parent saw a strip of letter boxes with
        # no idea which word they spelled -- and two cards side by side read as
        # one long nonsense word.
        cards = "".join(
            f'<div class="hwcard">{HEART.svg(hw, n)}'
            f'<div class="hwword">{esc(hw.word)}</div></div>' for hw in new_here)
        heart_block = (
            # Naming each card cost height, so the instruction line folds into
            # the heading rather than the child losing anything. Adult text is
            # what gets cut when a page runs short -- never the reader's space.
            f'<h2>Heart words <span style="font-weight:400;font-size:.75em;'
            f'color:#444;letter-spacing:0">&mdash; this week&rsquo;s words, not '
            f'always in the story; the '
            f'<span style="color:#b23f28">&hearts;</span> part is learned by '
            f'heart</span></h2>'
            f'<div class="hwrow">{cards}</div>')
    elif older:
        heart_block = (
            f'<p class="rowlab" style="margin-top:6px">Heart words &mdash; read each one, '
            f'then check the box.</p>'
            f'<div class="hearts">' + "".join(
                f'<span class="hw"><span class="ubox"></span>{esc(w)}</span>'
                for w in older[-6:]) + '</div>')
    else:
        heart_block = ""
    # The story is never broken across pages. The teacher's reason: a child
    # should see it as one whole thing, and turning a page mid-story costs them
    # the thread. Every one of the 123 stories fits on a page on its own at the
    # current type sizes -- what does not always fit is the story WITH the
    # warm-up words and heart cards above it, so those move to their own page
    # when they have to. The story never gives way; the furniture does.
    def story_block():
        body = "\n      ".join(f'<span class="ln">{esc(l)}</span>' for l in lines)
        return (f'<div class="passage">\n    <div class="ptitle">{esc(title)}</div>'
                f'\n    <p>\n      {body}\n    </p>\n  </div>')

    # Always its own page now. Once the practice words and heart words run
    # down the page at reading size they cannot share with the story, and a
    # packet with the same shape every time beats one that varies.
    words_own_page = True

    # Three stars for three readings belong on the last page of the story --
    # a child has not read it until they have read all of it.
    fluency_block = (
        '<div class="fluency">\n'
        '    <span class="lbl">Read it 3 times</span>\n'
        '    <span class="star"></span><span class="star"></span><span class="star"></span>\n'
        '    <span class="note">Color one circle each time.</span>\n'
        '  </div>')

    # One dictated sentence, written right under the story while the words are
    # still warm. The sentence itself is printed only on the grown-up sheet --
    # the child writes it from hearing it. Three-line handwriting rules (top
    # line, dotted midline, baseline) because the midline is what tells a child
    # how tall an "a" is against an "h"; a bare underline tells them nothing.
    dictation = pick_dictation(lines)
    dictation_block = (
        '<h2>Write the sentence you hear</h2>\n'
        '  <p class="sub">Your grown-up will say one sentence from the story. '
        'Say it back, then write it.</p>\n'
        '  <div class="ruled"><span class="mid"></span></div>\n'
        '  <div class="ruled"><span class="mid"></span></div>')

    # The dictation no longer sits under the story. Order of work is now
    # read it, draw it, then write the sentence you hear -- so the writing
    # lives on the lower half of the drawing page, after the drawing.

    # A words page only exists when the warm-up cannot share with the story.
    words_page = f"""
<!-- ================= PAGE 2 &mdash; WORDS BEFORE THE STORY ================= -->
<div class="page">

  <div class="band">
    <div>
      <span class="owner child" style="margin-bottom:3px">For the reader</span>
      <div class="tag">Words first</div>
      <h1>{esc(title)}</h1>
    </div>
    <div class="nameline"><span class="lbl">Name</span><span class="rule"></span></div>
  </div>

  <h2>Say these first</h2>
  <div class="warm">{warm_html}</div>

  {heart_block}

  <p class="artcap" style="text-align:right;margin-top:10px">The story is on the next page &rarr;</p>

</div>
""" if words_own_page else ""

    page_count = 4 + (1 if words_own_page else 0)
    page_note = (f"Prints as {page_count} pages: 1 grown-up sheet, then "
                 f"{page_count - 1} child sheets.")

    # Say what it actually takes. The sequence is now three readings PLUS a
    # written sentence PLUS a drawing — promising five minutes would set a
    # parent up to feel behind before they start.
    minutes = 15 if word_count < 140 else 20
    q_child = "\n  ".join(
        f'<div class="q"><span class="qtext">{i}. {esc(q["ask"])}</span>'
        f'<span class="qline"></span><span class="qline"></span></div>'
        for i, q in enumerate(questions, 1))
    def trim(note, n=150):
        note = " ".join(note.split())
        if len(note) <= n:
            return note
        cut = note[:n].rsplit(". ", 1)[0]
        return (cut + ".") if len(cut) > 40 else note[:n].rsplit(" ", 1)[0] + "..."

    q_adult = "\n    ".join(
        f'<p class="qa"><span class="qq">{i}. {esc(q["ask"])}</span><br>'
        f'<span class="aa">{esc(trim(q["listenFor"]))}</span></p>'
        for i, q in enumerate(questions, 1))

    font_px, line_h = story_type(n, lines)
    scale_css = f"\n  .passage p {{ font-size: {font_px}px; line-height: {line_h}; }}"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Decodable Passage &mdash; Lesson {n}, {esc(L['skill'])}</title>
<style>{css()}{scale_css}</style>
</head>
<body>

<div class="toolbar">
  <button onclick="window.print()">Print / Save as PDF</button>
  <span>{page_note} Choose &ldquo;Save as PDF&rdquo; to keep a copy.</span>
</div>

<!-- ================= PAGE 1 — GROWN-UP SHEET ================= -->
<div class="page">

  <span class="owner adult">Grown-up sheet &mdash; keep this one</span>
  <div class="band">
    <div>
      <div class="tag">Decodable Passage &middot; Reading Foundations</div>
      <h1>{esc(title)}</h1>
    </div>
    <div class="flagged">Lesson {n}<br>{esc(L['skill'])}</div>
  </div>

  <div class="prereq">
    <p style="margin:0"><strong>Before you start: this is Lesson {n}. {prereq}</strong> If they
    have not done those yet it will feel too hard &mdash; ask their teacher where to start.</p>
  </div>

  <h2>About {minutes} minutes, in this order</h2>
  <div class="tip">
    <p><strong>1. Say the practice words on the words page,</strong> then the heart words.
    A heart word has one part that cannot be sounded out &mdash; the little heart marks the
    bit to just remember.</p>
    <p><strong>2. Read the story on the next page. If they get stuck, don&rsquo;t say the
    word.</strong> Point under the letters and say: &ldquo;Say each sound, then say them
    fast&rdquo; &mdash; &ldquo;mmm &ndash; aaa &ndash; p &hellip; map!&rdquo;</p>
    <p><strong>3. Read it three times</strong> &mdash; they color a circle each time.</p>
    <p><strong>4. They draw what happened,</strong> on the top half of the next page. No
    picture to copy &mdash; their drawing is how you see what they understood.</p>
    <p><strong>5. They write one sentence,</strong> on the lines under their drawing. The
    sentence to read aloud is in the box below.</p>
  </div>

  <h2>The writing sentence &middot; read this aloud to them</h2>
  <div class="tip">
    <p class="say">&ldquo;{esc(dictation)}&rdquo;</p>
    <p>Once at normal speed, once slowly, and have them <strong>say it back</strong> before
    they write. If they get stuck on a word, say its sounds together &mdash; don&rsquo;t spell
    it letter by letter.</p>
    <p><strong>Practice, not a test &mdash; don&rsquo;t mark it wrong.</strong> If a word is
    misspelled, read it back exactly as they wrote it and let them hear the difference.</p>
  </div>

  <h2>When it does not go smoothly</h2>
  <div class="tip">
    <p><strong>A wrong word, or a guess?</strong> Don&rsquo;t say &ldquo;no&rdquo; &mdash; point
    at the word: &ldquo;Try that one again &mdash; say each sound.&rdquo; Fixing it themselves
    is the win.</p>
    <p><strong>Sounded it out twice, still stuck?</strong> Tell them the word and carry on.
    A few told words do no harm.</p>
    <p><strong>Stuck on nearly every line, or fed up?</strong> Stop &mdash; that is fine. Try an
    easier lesson, or this one tomorrow. Five happy minutes beat twenty cross ones.</p>
  </div>

  <h2>If they want the questions <span class="h2note">&mdash; the questions page is extra;
  these work just as well out loud</span></h2>
  <div class="answers">
    {q_adult}
  </div>

  <div class="audit">
    <p style="margin:0;"><strong>Checked word by word:</strong> all {word_count} words in this
    story use only sounds taught by Lesson {n}, plus heart words already learned. Nothing here
    needs guessing.{wb_note}</p>
  </div>

  <div class="foot">
    <span>Grown-up sheet &mdash; Lesson {n}, {esc(L['skill'])}</span>
    <span>Original text. Public-domain sight words only.</span>
  </div>

</div>

{words_page}
<!-- ================= PAGE 3 &mdash; THE STORY ================= -->
<div class="page">

  <div class="band">
    <div>
      <span class="owner child" style="margin-bottom:3px">For the reader</span>
      <div class="tag">My reading page</div>
      <h1>{esc(title)}</h1>
    </div>
    <div class="nameline"><span class="lbl">Name</span><span class="rule"></span></div>
  </div>

  {"" if words_own_page else '<h2>Say these first</h2>'}
  {"" if words_own_page else f'<div class="warm">{warm_html}</div>'}

  {"" if words_own_page else heart_block}

  <h2>Read the story</h2>
  {story_block()}
  {fluency_block}

</div>

<!-- ============ PAGE 4 &mdash; DRAW IT, THEN WRITE IT ============ -->
<div class="page">

  <div class="band" style="margin-bottom:4px;">
    <div>
      <span class="owner child" style="margin-bottom:4px;">For the reader</span>
      <div class="tag">My drawing page</div>
      <h1 style="font-size:18px;">{esc(title)}</h1>
    </div>
    <div class="nameline"><span class="lbl">Name</span><span class="rule"></span></div>
  </div>

  <h2 style="margin-top:12px;">Draw the story</h2>
  <p class="sub">Read it again if you need to. Then draw what happened.</p>
  <div class="drawbox"><span class="dlab">Your picture</span></div>

  {dictation_block}

</div>

<!-- ============ PAGE 5 &mdash; QUESTIONS, ONLY IF THEY WANT THEM ============ -->
<div class="page">

  <div class="band" style="margin-bottom:4px;">
    <div>
      <span class="owner extra" style="margin-bottom:4px;">If you want more</span>
      <div class="tag">Talk about it</div>
      <h1 style="font-size:18px;">{esc(title)}</h1>
    </div>
    <div class="nameline"><span class="lbl">Name</span><span class="rule"></span></div>
  </div>

  <div class="optional">
    <strong>This page is extra.</strong> Reading the story and drawing the picture is the
    work. If your reader has had enough, stop there &mdash; they have done it. These are
    for a child who wants more, and they are just as good asked out loud as written down.
  </div>

  {q_child}

</div>

</body>
</html>
"""


def write_sheet(spec_path):
    spec = json.loads(pathlib.Path(spec_path).read_text())
    SHEETS.mkdir(exist_ok=True)
    out = SHEETS / f"lesson-{spec['lesson']:03d}.html"
    out.write_text(build_html(spec))
    return out


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    if args[0] == "--all":
        specs = sorted(PASSAGES.glob("lesson-*.json"))
        if not specs:
            sys.exit(f"No passage specs found in {PASSAGES}")
        for sp in specs:
            print(f"  {write_sheet(sp).name}")
        print(f"\n{len(specs)} sheets written to {SHEETS}")
    else:
        print(write_sheet(args[0]))


if __name__ == "__main__":
    main()
