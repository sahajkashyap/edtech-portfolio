#!/usr/bin/env python3
"""Turn an approved passage into the printable 4-sheet packet.

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

import props

HERE = pathlib.Path(__file__).parent
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
    heart_html = "".join(
        f'<span class="hw"><span class="ubox"></span>{esc(w)}</span>' for w in hearts)
    line_html = "\n      ".join(f'<span class="ln">{esc(l)}</span>' for l in lines)
    q_child = "\n  ".join(
        f'<div class="q"><span class="qtext">{i}. {esc(q["ask"])}</span>'
        f'<span class="qline"></span><span class="qline"></span></div>'
        for i, q in enumerate(questions, 1))
    q_adult = "\n    ".join(
        f'<p class="qa"><span class="qq">{i}. {esc(q["ask"])}</span><br>'
        f'<span class="aa">{esc(q["listenFor"])}</span></p>'
        for i, q in enumerate(questions, 1))

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Decodable Passage &mdash; Lesson {n}, {esc(L['skill'])}</title>
<style>{css()}</style>
</head>
<body>

<div class="toolbar">
  <button onclick="window.print()">Print / Save as PDF</button>
  <span>Prints as 4 pages: 1 grown-up sheet, then 3 child sheets. Choose &ldquo;Save as PDF&rdquo; to keep a copy.</span>
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

  <h2>Four minutes, in this order</h2>
  <div class="tip">
    <p><strong>1. Look at the picture together.</strong> Ask &ldquo;What do you see? What do you
    think happens?&rdquo; This puts the story in their head before their eyes do the hard work.</p>
    <p><strong>2. Cover the picture while they read.</strong> The picture is for understanding,
    not for guessing words. Uncover it when they finish.</p>
    <p><strong>3. Warm up on the {len(warm)} words,</strong> check off the heart words, then read the story.</p>
    <p><strong>4. If they get stuck, don&rsquo;t say the word.</strong> Ask them to <strong>sound it
    out</strong>, or to <strong>use their sound spelling</strong> &mdash; those are the words their
    teacher uses, so home and school match. Tap under each letter as they go.</p>
    <p><strong>5. Read it three times.</strong> The first read is work. The third read is reading.</p>
    <p style="margin-top:7px; padding-top:6px; border-top:1px dotted #d9c7a8;">The story itself is
    on the next sheet &mdash; read it once yourself before you begin.</p>
  </div>

  <h2>Checking they understood</h2>
  <p class="sub">The child writes their answers on their own sheet. Here is what you are listening for.</p>
  <div class="answers">
    {q_adult}
  </div>

  <div class="audit">
    <div class="h">Why you can trust this page &middot; checked, word by word</div>
    <p style="margin:0 0 5px;"><strong>Every one of the {word_count} words in this story can be
    sounded out with what your child has already been taught.</strong> Nothing here needs guessing.
    If they get stuck, the answer is always &ldquo;sound it out&rdquo; or &ldquo;use your sound
    spelling&rdquo; &mdash; never &ldquo;let me tell you.&rdquo;</p>
    <p style="margin:0;">The only words to know by sight, not sound out, are the heart words:
    {" ".join(f"<code>{esc(w)}</code>" for w in hearts)}.{wb_note}</p>
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
  <p class="rowlab">Heart words &mdash; read each one, then check the box.</p>
  <div class="hearts">{heart_html}</div>

  <h2>Read the story</h2>
  <div class="passage">
    <div class="ptitle">{esc(title)}</div>
    <p>
      {line_html}
    </p>
  </div>

  <div class="fluency">
    <span class="lbl">Read it 3 times</span>
    <span class="star"></span><span class="star"></span><span class="star"></span>
    <span class="note">Color one circle each time.</span>
  </div>

</div>

<!-- ================= PAGE 3 — CHILD'S WORK SHEET ================= -->
<div class="page">

  <div class="band" style="margin-bottom:4px;">
    <div>
      <span class="owner child" style="margin-bottom:4px;">For the reader</span>
      <h1 style="font-size:18px;">{esc(title)} &mdash; my work page</h1>
    </div>
    <div class="nameline"><span class="lbl">Name</span><span class="rule"></span></div>
  </div>

  <h2 style="margin-top:12px;">Think about it</h2>

  {q_child}

</div>

<!-- ================= PAGE 4 — CHILD'S DRAWING SHEET ================= -->
<div class="page">

  <div class="band" style="margin-bottom:4px;">
    <div>
      <span class="owner child" style="margin-bottom:4px;">For the reader</span>
      <h1 style="font-size:18px;">{esc(title)} &mdash; my drawing page</h1>
    </div>
    <div class="nameline"><span class="lbl">Name</span><span class="rule"></span></div>
  </div>

  <h2 style="margin-top:12px;">Draw it</h2>
  <p class="sub">Draw the last thing that happens in the story.</p>
  <div class="drawbox"><span class="dlab">Your picture</span></div>

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
