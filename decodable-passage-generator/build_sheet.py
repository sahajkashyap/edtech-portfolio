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


# When a story outgrows its page the story gets a second page. It does not get
# smaller type. That is the teacher's standing rule for this project -- a
# child's space is never shrunk to fit the paper; cut adult text or add a page
# -- and type size is the child's space just as much as a drawing box is.
# A second story page is always preferred over smaller type.
#
# These caps are the largest line counts measured as fitting at each type size,
# with the warm-up strip and heart-word cards above them.
#   lesson ceiling -> lines that fit on the first reading page
FIRST_PAGE_LINES = [(45, 7), (65, 8), (90, 9), (128, 10)]


# Measured capacity beats a guessed constant. page-capacity.json records, per
# lesson, how many story lines that reading page actually holds -- taken from
# the rendered height, not estimated. The band constants below are the fallback
# for when it has not been generated yet.
_CAPACITY = None


def _measured():
    global _CAPACITY
    if _CAPACITY is None:
        f = HERE / "page-capacity.json"
        _CAPACITY = (json.loads(f.read_text())["linesByLesson"]
                     if f.exists() else {})
    return _CAPACITY


def first_page_lines(lesson):
    measured = _measured().get(str(lesson))
    if measured:
        return measured
    for ceiling, cap in FIRST_PAGE_LINES:
        if lesson <= ceiling:
            return cap
    return FIRST_PAGE_LINES[-1][1]


def split_story(lesson, lines):
    """Break a story into per-page chunks, first page smallest.

    A continuation page carries no picture, warm-up or heart words, so it holds
    more lines than the first one. Splitting evenly across the pages we need
    beats filling page one to the brim and leaving two lines stranded alone.
    """
    cap = first_page_lines(lesson)
    if len(lines) <= cap:
        return [lines]
    # A page with nothing above the story holds roughly half again as much.
    later_cap = cap + cap // 2
    pages = 1 + -(-(len(lines) - cap) // later_cap)
    per = -(-len(lines) // pages)
    per = min(per, cap)
    out = [lines[:per]]
    rest = lines[per:]
    while rest:
        out.append(rest[:later_cap])
        rest = rest[later_cap:]
    return out
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
            f'color:#444;letter-spacing:0">&mdash; say each sound; the '
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
    story_pages = split_story(n, lines)
    of_n = len(story_pages)

    def story_block(chunk, idx):
        """The story itself. Titled on page one, marked 'keep going' after."""
        head = (f'<div class="ptitle">{esc(title)}</div>' if idx == 0 else
                f'<div class="ptitle">{esc(title)} '
                f'<span style="font-weight:400;font-size:.8em">&mdash; page {idx + 1}'
                f'</span></div>')
        body = "\n      ".join(f'<span class="ln">{esc(l)}</span>' for l in chunk)
        return f'<div class="passage">\n    {head}\n    <p>\n      {body}\n    </p>\n  </div>'

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

    # Everything that follows the story's final line, wherever that line falls.
    end_matter = f"{fluency_block}\n\n  {dictation_block}"

    turn_over = ('\n  <p class="artcap" style="text-align:right;margin-top:2px">'
                 'Keep going on the next page &rarr;</p>')

    continuation_pages = "".join(f"""
<!-- ================= PAGE {i + 2} &mdash; STORY CONTINUED ================= -->
<div class="page">

  <div class="band" style="margin-bottom:4px;">
    <div>
      <span class="owner child" style="margin-bottom:4px;">For the reader</span>
      <div class="tag">Keep reading</div>
      <h1 style="font-size:18px;">{esc(title)}</h1>
    </div>
    <div class="nameline"><span class="lbl">Name</span><span class="rule"></span></div>
  </div>

  {story_block(chunk, i)}
  {end_matter if i == of_n - 1 else turn_over.strip()}

</div>
""" for i, chunk in enumerate(story_pages) if i > 0)

    page_count = 3 + of_n
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

    font_px, line_h = type_for(n)
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
    <p><strong>1. Say the practice words at the top of the story page,</strong> then the heart
    words. A heart word has one part that cannot be sounded out &mdash; the little heart marks
    the bit to just remember.</p>
    <p><strong>2. Read the story. If they get stuck, don&rsquo;t say the word.</strong> Point
    under the letters and say: &ldquo;Say each sound, then say them fast&rdquo; &mdash;
    &ldquo;mmm &ndash; aaa &ndash; p &hellip; map!&rdquo;</p>
    <p><strong>3. Read it three times</strong> &mdash; they color a circle each time.</p>
    <p><strong>4. They write one sentence</strong> on the lines under the story &mdash; the
    words to say are in the box below.</p>
    <p><strong>5. They draw what happened.</strong> No picture to copy &mdash; their picture of
    the story shows you what they understood.</p>
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

<!-- ================= PAGE 2 — CHILD'S READING SHEET ================= -->
<div class="page">

  <div class="band">
    <div>
      <span class="owner child" style="margin-bottom:3px">For the reader</span>
      <div class="tag">My reading page</div>
      <h1>{esc(title)}</h1>
    </div>
    <div class="nameline"><span class="lbl">Name</span><span class="rule"></span></div>
  </div>

  <h2>Say these first</h2>
  <div class="warm">{warm_html}</div>

  {heart_block}

  <h2>Read the story</h2>
  {story_block(story_pages[0], 0)}
  {end_matter if of_n == 1 else turn_over.strip()}

</div>
{continuation_pages}
<!-- ================= PAGE 3 — DRAW WHAT HAPPENED ================= -->
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

</div>

<!-- ============ PAGE 4 — QUESTIONS, ONLY IF THEY WANT THEM ============ -->
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
