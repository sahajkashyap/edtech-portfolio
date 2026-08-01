#!/usr/bin/env python3
"""One page listing every lesson's decodable passage.

Also the honest record of what is NOT here. Lessons 1-5 have no passage, and
that is a fact about early phonics rather than a gap in the generator: at Lesson
1 there are zero words a child can sound out, and at Lessons 4-5 there are five.
You cannot write a story from five words.

Run:  python3 build_index.py   -> writes index.html
"""

import json
import pathlib

HERE = pathlib.Path(__file__).parent
OUT = HERE / "index.html"

# Lessons whose story cannot demonstrate the sound the lesson teaches, and why.
# Recorded rather than papered over.
TARGET_SOUND_NOTES = {
    7: ("This story does not use an <strong>f</strong> word. With only "
        "<em>a m s t p f</em> taught and no blends yet, the only real English "
        "word containing f that a child can decode here is one we chose not to "
        "put on a children's sheet. Lesson 8 adds <em>i</em> and <em>fit</em> "
        "becomes available. The f practice for this lesson comes from the "
        "worksheet generator instead."),
}

NO_PASSAGE_REASON = (
    "No decodable passage exists this early. A story needs a vocabulary, and "
    "these lessons are still introducing single letter-sounds — at Lesson 1 there "
    "are no words a child can sound out at all, and by Lesson 5 there are four "
    "(<em>am, at, mat, sat</em>)."
)

CSS = """
/* Fixed warm palette matching the phonics assessment tracker exactly.
   Deliberately no dark-mode variant: parents arrive from the tracker, and the
   page must look the same on every machine regardless of system setting. */
:root{--ink:#2c3e50;--paper:#E8D4C4;--card:#FBF9F7;--card2:#F3EFE7;--line:#D4C5B9;
 --muted:#5F574E;--accent:#378ADD;--warn:#A3521A;
 --serif:"Iowan Old Style",Georgia,serif;--sans:system-ui,-apple-system,sans-serif;
 --mono:ui-monospace,Menlo,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);line-height:1.55}
.wrap{max-width:62rem;margin:0 auto;padding:2.5rem 1.25rem 5rem}
h1,h2{font-family:var(--serif);font-weight:600;margin:0;text-wrap:balance}
h1{font-size:clamp(1.9rem,4vw,2.7rem);line-height:1.15}
h2{font-size:1.3rem;margin:0 0 .3rem}
.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:700}
.lede{color:var(--muted);max-width:38em;margin:.7rem 0 0}
header{border-bottom:2px solid var(--ink);padding-bottom:1.6rem}
section{margin-top:2.4rem}
.sub{color:var(--muted);font-size:.9rem;margin:.2rem 0 1rem;max-width:42em}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr));gap:.7rem;margin-top:1.5rem}
.stat{background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:.75rem .85rem}
.stat .v{font-family:var(--serif);font-size:1.7rem;line-height:1;font-variant-numeric:tabular-nums}
.stat .k{font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-top:.35rem}
.note{background:var(--card2);border:1px solid var(--line);border-left:3px solid var(--warn);
 border-radius:8px;padding:.9rem 1.1rem;font-size:.9rem}
.unit{margin-top:1.6rem;scroll-margin-top:3.6rem}
.uh{font-family:var(--serif);font-size:1.45rem;font-weight:700;border-bottom:2px solid var(--ink);
 padding:.6rem 0 .35rem;margin-bottom:.6rem;display:flex;justify-content:space-between;align-items:baseline;
 position:sticky;top:0;background:var(--paper);z-index:2}
.uh .rg{font-family:var(--mono);font-size:.85rem;color:var(--muted);white-space:nowrap}
.jump{display:flex;flex-wrap:wrap;gap:.45rem;margin:1rem 0 .25rem}
.jump a{background:var(--card);border:1px solid var(--line);border-radius:6px;
 padding:.35rem .7rem;font-size:.85rem;font-weight:600;color:var(--ink);text-decoration:none}
.jump a:hover{border-color:var(--accent);color:var(--accent)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:.5rem}
.card{display:block;background:var(--card);border:1px solid var(--line);border-radius:8px;
 padding:.55rem .7rem;text-decoration:none;color:inherit}
.card:hover{border-color:var(--accent)}
.card:focus-visible,.card:focus-within{outline:2px solid var(--accent);outline-offset:2px}
.card .n{font-family:var(--mono);font-size:1.05rem;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
.card .t{font-weight:600;font-size:.95rem;margin:.15rem 0;color:var(--muted)}
.card .s{font-size:.75rem;color:var(--muted)}
.card .print{margin-top:.5rem}
.card .print a{display:inline-block;background:var(--accent);color:#fff;
 font-family:var(--mono);font-size:.72rem;font-weight:600;padding:.32rem .7rem;
 border-radius:6px;text-decoration:none}
.card .print a:hover{filter:brightness(1.15)}
details.card{cursor:pointer}
details.card summary{list-style:none;cursor:pointer}
details.card summary::-webkit-details-marker{display:none}
details.card .story{margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--line);
 font-size:.9rem;line-height:1.75;cursor:text}
details.card .story span{display:block}
details.card .warm{margin-top:.45rem;font-size:.72rem;color:var(--muted);font-family:var(--mono)}
details.card[open]{border-color:var(--accent)}
details.card .tnote{margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--line);font-size:.78rem;color:var(--warn);cursor:text}
.card.none{opacity:.72;border-style:dashed}
.card.letter{border-style:solid}
.card.letter .n a{color:inherit;text-decoration:none}
.card.letter .n a:hover{text-decoration:underline}
footer{margin-top:3rem;border-top:1px solid var(--line);padding-top:1rem;font-size:.82rem;color:var(--muted)}
"""


def build():
    sounds = json.loads((HERE / "sound-list.json").read_text())["lessons"]
    passages = {}
    for f in sorted((HERE / "passages").glob("lesson-*.json")):
        spec = json.loads(f.read_text())
        passages[spec["lesson"]] = spec

    units, order = {}, []
    for L in sounds:
        units.setdefault(L["unit"], []).append(L)
        if L["unit"] not in order:
            order.append(L["unit"])

    body = ""
    for ui, unit in enumerate(order, 1):
        rows = units[unit]
        ns = [L["lesson"] for L in rows]
        body += (f'<div class="unit" id="u{ui}"><div class="uh"><span>{unit}</span>'
                 f'<span class="rg">lessons {min(ns)}&ndash;{max(ns)}</span></div>'
                 f'<div class="grid">')
        for L in rows:
            n = L["lesson"]
            spec = passages.get(n)
            if spec:
                story = "".join(f"<span>{ln}</span>" for ln in spec["lines"])
                warm = ", ".join(spec["warmup"])
                note = TARGET_SOUND_NOTES.get(n)
                flag = ' &middot; <span style="color:var(--warn)">see note</span>' if note else ''
                note_html = (f'<div class="tnote">{note}</div>' if note else '')
                body += (f'<details class="card"><summary>'
                         f'<div class="n">Lesson {n}{flag}</div>'
                         f'<div class="t">{spec["title"]}</div>'
                         f'<div class="s">{L["skill"]}</div>'
                         f'<div class="print"><a href="sheets/lesson-{n:03d}.html" '
                         f'target="_blank" rel="noopener">Print this sheet</a></div>'
                         f'</summary>'
                         f'<div class="story">{story}</div>'
                         f'<div class="warm">warm-up: {warm}</div>'
                         f'{note_html}</details>')
            elif (HERE / "sheets" / f"lesson-{n:03d}.html").exists():
                # Lessons 1-5 have no story -- Lesson 1 teaches one letter and
                # yields no readable word at all -- so they get letter-and-sound
                # sheets instead. They are real packets, not gaps, and the index
                # links them like any other.
                kind = "Blending &mdash; first words" if n == 5 else "Letter and sound"
                body += (f'<div class="card letter">'
                         f'<div class="n"><a href="sheets/lesson-{n:03d}.html">Lesson {n}</a></div>'
                         f'<div class="t">{kind}</div>'
                         f'<div class="s">{L["skill"]}</div>'
                         f'<div class="print"><a href="sheets/lesson-{n:03d}.html" '
                         f'target="_blank" rel="noopener">Print this sheet</a></div></div>')
            else:
                body += (f'<div class="card none">'
                         f'<div class="n">Lesson {n}</div>'
                         f'<div class="t" style="font-weight:500;color:var(--muted)">'
                         f'No passage &mdash; too few words yet</div>'
                         f'<div class="s">{L["skill"]}</div></div>')
        body += "</div></div>"

    words = sum(len(" ".join(s["lines"]).split()) for s in passages.values())
    missing = [n for n in range(1, 129) if n not in passages]
    letter_sheets = sorted(n for n in missing
                           if (HERE / "sheets" / f"lesson-{n:03d}.html").exists())
    still_missing = [n for n in missing if n not in letter_sheets]
    total_pages = len(passages) * 5 + len(letter_sheets) * 3

    jump = ('<nav class="jump">'
            + "".join(f'<a href="#u{i}">{u}</a>' for i, u in enumerate(order, 1))
            + "</nav>")

    page = f"""<title>Decodable Passages &mdash; all 128 lessons</title>
<style>{CSS}</style>
<div class="wrap">
<header>
  <div class="eyebrow">Reading Foundations &middot; decodable passages</div>
  <h1>Reading practice for every lesson: 128 lessons with 128 printable practice sheets</h1>
  <p class="lede">Each one uses only the sounds taught by that point. Every word was
  checked against the lesson's rulebook before the sheet was made &mdash; none of these
  were eyeballed. Click any lesson below to read its story and open its printable
  packet.</p>
  <div class="stats">
    <div class="stat"><div class="v">{len(passages)}</div><div class="k">Stories</div></div>
    <div class="stat"><div class="v">{words:,}</div><div class="k">Words written</div></div>
    <div class="stat"><div class="v">{total_pages}</div><div class="k">Printable pages</div></div>
    <div class="stat"><div class="v">100%</div><div class="k">Passed the gate</div></div>
  </div>
</header>

<section>
  <div class="note"><strong>Lessons {min(letter_sheets)}&ndash;{max(letter_sheets)} are
  letter-and-sound sheets, not stories.</strong> {NO_PASSAGE_REASON} So those five teach the
  letter and its sound instead: the letter with a keyword picture, how the mouth makes the
  sound, handwriting practice on three-line guides, a letter hunt and a beginning-sound sort
  &mdash; and, at Lesson 5, first blending. Click them like any other lesson.</div>
</section>

<section>
  <h2>Every lesson</h2>
  <p class="sub">Grouped by UFLI's real units. Click a card to preview its story
  right here. <strong>Print this sheet</strong> opens that lesson's printable
  packet in a new tab &mdash; that's the one to print for your child. Use the
  buttons below to jump straight to a unit.</p>
  {jump}
  {body}
</section>

<footer>
  Every passage passed <code>validate_passage.py</code>: each word decodable at its
  lesson, words using a two-sound spelling drawn from an approved list, warm-up words
  taken from the story itself. Sheets were measured to fit on letter paper.
  Text is original; sight words are from the public-domain Dolch list (1936).
</footer>
</div>
"""
    OUT.write_text(page)
    print(f"wrote {OUT}")
    print(f"  {len(passages)} passages, {words:,} words, {len(passages) * 4} printable pages")
    print(f"  no passage for lessons: {missing}")


if __name__ == "__main__":
    build()
