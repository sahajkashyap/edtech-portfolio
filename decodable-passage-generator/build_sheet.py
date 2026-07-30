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
import props

HERE = pathlib.Path(__file__).parent

# Story type shrinks as the reader advances, which is what real readers do and
# what makes room for longer stories. 24px is right for a five-year-old sounding
# out "Sam sat"; a seven-year-old at Lesson 100 reads comfortably smaller, and
# the alternative is a story that cannot grow past sixty words.
#   lesson ceiling -> (font px, line-height, picture width in inches)
TYPE_BANDS = [
    (45,  (24, 1.66, 3.8)),
    (65,  (22, 1.62, 3.5)),
    (90,  (20, 1.58, 3.2)),
    (128, (18, 1.54, 2.9)),
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
# 18px is the floor for a seven-year-old, so beyond about 120 words the only
# honest way to reach a real reader's length is to turn the page.
#
# These caps are the largest line counts already measured as fitting at each
# type size, with the picture, warm-up strip and heart words above them.
#   lesson ceiling -> lines that fit on the first reading page
FIRST_PAGE_LINES = [(45, 9), (65, 10), (90, 12), (128, 15)]


def first_page_lines(lesson):
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

    art = props.scene(story_words)
    picture_block = (
        f'<div class="art">{art}</div>\n'
        f'  <p class="artcap">Talk about the picture first &mdash; then cover it up and read.</p>'
        if art else
        '<div class="art" style="border-style:dashed;min-height:1.5in;position:relative">'
        '<span style="position:absolute;top:10px;left:14px;font-size:11px;color:#999;'
        'text-transform:uppercase;letter-spacing:.1em">Draw the story here first</span></div>\n'
        '  <p class="artcap">Nothing is drawn for you &mdash; read the story, then draw it.</p>')

    prereq = (f"It assumes your child has already worked through Lessons 1&ndash;{n - 1}."
              if n > 1 else "This is the very first lesson, so nothing comes before it.")

    wb = L.get("requiresWordBank") or []
    wb_note = ""
    if wb:
        spellings = ", ".join(f"<code>{esc(w['spelling'])}</code>" for w in wb)
        wb_note = (f'<p style="margin-top:6px">This lesson uses {spellings}, which can say '
                   f'more than one sound. Every word here was picked from an approved list '
                   f'so only the sound taught by Lesson {n} appears.</p>')

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
        cards = "".join(
            f'<div class="hwcard">{HEART.svg(hw, n)}</div>' for hw in new_here)
        heart_block = (
            f'<h2>Heart words</h2>'
            f'<p class="rowlab">Say it. Say each sound. The '
            f'<span style="color:#b23f28">&hearts;</span> box is the part to learn by heart.</p>'
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

    turn_over = ('\n  <p class="artcap" style="text-align:right;margin-top:2px">'
                 'Keep going on the next page &rarr;</p>')

    continuation_pages = "".join(f"""
<!-- ================= PAGE {i + 2} &mdash; STORY CONTINUED ================= -->
<div class="page">

  <div class="band" style="margin-bottom:4px;">
    <div>
      <span class="owner child" style="margin-bottom:4px;">For the reader</span>
      <h1 style="font-size:18px;">{esc(title)} &mdash; keep reading</h1>
    </div>
    <div class="nameline"><span class="lbl">Name</span><span class="rule"></span></div>
  </div>

  {story_block(chunk, i)}
  {fluency_block if i == of_n - 1 else turn_over.strip()}

</div>
""" for i, chunk in enumerate(story_pages) if i > 0)

    page_count = 3 + of_n
    page_note = (f"Prints as {page_count} pages: 1 grown-up sheet, then "
                 f"{page_count - 1} child sheets.")

    # "Five minutes" was honest at sixty words. A Lesson 120 story is three
    # times that and gets read three times, so promising five minutes sets a
    # parent up to feel behind. Say what it actually takes.
    minutes = 5 if word_count < 90 else 8 if word_count < 140 else 10
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

    font_px, line_h, art_in = type_for(n)
    scale_css = (f"\n  .passage p {{ font-size: {font_px}px; line-height: {line_h}; }}"
                 f"\n  .art {{ max-width: {art_in}in; }}")

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
    <div class="h">Before you start &middot; is your child ready for this one?</div>
    <p><strong>This is Lesson {n}. {prereq}</strong> Each lesson only uses sounds taught in the
    ones before it. If your child has not had those yet, this story will be too hard &mdash; not
    because of anything they did, but because the sounds have not been introduced yet. Ask their
    teacher which sheet to start with.</p>
  </div>

  <h2>About {minutes} minutes, in this order</h2>
  <div class="tip">
    <p><strong>1. Look at the picture together.</strong> Ask &ldquo;What do you see? What do you
    think happens?&rdquo; This puts the story in their head before their eyes do the hard work.</p>
    <p><strong>2. Cover the picture while they read.</strong> It is there for understanding, not
    for guessing words. Uncover it when they finish.</p>
    <p><strong>3. Warm up on the words,</strong> check off the heart words, then read the story.</p>
    <p><strong>4. If they get stuck, don&rsquo;t say the word.</strong> Ask them to <strong>sound it
    out</strong> or <strong>use their sound spelling</strong> &mdash; the words their teacher uses.
    Tap under each letter as they go.</p>
    <p><strong>5. Read it three times,</strong> then <strong>draw what happened.</strong> The
    drawing is the comprehension check at this age &mdash; no writing needed, and the picture shows
    you what they understood.</p>
    <p style="margin-top:6px; padding-top:5px; border-top:1px dotted #d9c7a8;"><strong>The last
    sheet of questions is extra.</strong> Reading and drawing is the work &mdash; stopping there is
    finishing.</p>
  </div>

  <h2>If they want the questions</h2>
  <p class="sub">Optional. They work just as well asked out loud over the drawing.</p>
  <div class="answers">
    {q_adult}
  </div>

  <div class="audit">
    <div class="h">Why you can trust this page &middot; checked, word by word</div>
    <p style="margin:0 0 5px;"><strong>Every one of the {word_count} words in this story can be
    sounded out with what your child has already been taught.</strong> Nothing here needs guessing.
    If they get stuck, the answer is always &ldquo;sound it out&rdquo; or &ldquo;use your sound
    spelling&rdquo; &mdash; never &ldquo;let me tell you.&rdquo;</p>
    <p style="margin:0;">The only words not sounded out are the {len(hearts)} heart words
    taught so far &mdash; and even those are mostly regular. Only the marked part of each
    is learned by heart. The newest are
    {" ".join(f"<code>{esc(w)}</code>" for w in hearts[-6:])}.{wb_note}</p>
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

  {picture_block}

  <h2>Say these first</h2>
  <div class="warm">{warm_html}</div>

  {heart_block}

  <h2>Read the story</h2>
  {story_block(story_pages[0], 0)}
  {fluency_block if of_n == 1 else turn_over.strip()}

</div>
{continuation_pages}
<!-- ================= PAGE 3 — DRAW WHAT HAPPENED ================= -->
<div class="page">

  <div class="band" style="margin-bottom:4px;">
    <div>
      <span class="owner child" style="margin-bottom:4px;">For the reader</span>
      <h1 style="font-size:18px;">{esc(title)} &mdash; my drawing page</h1>
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
      <h1 style="font-size:18px;">{esc(title)} &mdash; talk about it</h1>
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
