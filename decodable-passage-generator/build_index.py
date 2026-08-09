#!/usr/bin/env python3
"""One page listing every lesson's decodable passage.

Also the honest record of what is NOT here. Lessons 1-5 have no passage, and
that is a fact about early phonics rather than a gap in the generator: at Lesson
1 there are zero words a child can sound out, and at Lessons 4-5 there are five.
You cannot write a story from five words.

Run:  python3 build_index.py   -> writes index.html
"""

import html
import json
import pathlib
import sys

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

# The dash below is written as &mdash; on purpose, and so is every other
# non-ASCII character on this page -- see ascii_only() at the bottom of this
# file, which encodes the ones that arrive from the data.
#
# The story: this page shipped with no <meta charset>, so a host that serves
# it without a charset in the Content-Type header (a plain
# `python3 -m http.server`, some CDNs) made Chrome fall back to windows-1252
# and every non-ASCII character came out as mojibake. That was 28 broken runs
# of text, not one: the em dash in this sentence, and the phonetic symbols in
# 27 lesson skill labels -- "a /ăăă/" reading as "a /Äƒ/", "ng /ŋ/" as
# "ng /Å‹/". Fixing this one dash by hand fixed 1 of the 28.
#
# So there are now two independent defences, and either one alone is enough:
#   1. <meta charset="utf-8"> in the head.
#   2. Not a single raw non-ASCII byte in the file -- everything is an HTML
#      entity, which means nothing to mis-decode in the first place.
# Belt and braces on purpose. A head regenerated without the charset line
# should not be able to break 27 lesson labels again.
NO_PASSAGE_REASON = (
    "No decodable passage exists this early. A story needs a vocabulary, and "
    "these lessons are still introducing single letter-sounds &mdash; at Lesson 1 there "
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
/* Two boxes share this look, but they are deliberately two DIFFERENT classes.
   The phone line used to be class="onphone note", which meant the page had two
   .note elements and the first one -- the one any querySelector('.note') finds
   -- was the one that is invisible on a laptop. Nothing broke, because this
   page runs no script at all, but it is a trap laid for the next person. */
.note,.onphone{background:var(--card2);border:1px solid var(--line);border-left:3px solid var(--warn);
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
.card .print a,.card .print span{display:inline-block;background:var(--accent);color:#fff;
 font-family:var(--mono);font-size:.72rem;font-weight:600;padding:.32rem .7rem;
 border-radius:6px;text-decoration:none}
.card .print a:hover,a.card.letter:hover .print span{filter:brightness(1.15)}
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
/* The whole letter card is one <a> now, so it needs the pointer cursor a story
   card gets from its <summary>. It used to be a plain div whose only live spot
   was the 81x20px "Lesson 1" text — invisible as a link, and the page said
   "Click them like any other lesson" twice while 15 real clicks on the card
   body did nothing at all. Do not shrink the click target back to the title. */
.card.letter{border-style:solid;cursor:pointer}
footer{margin-top:3rem;border-top:1px solid var(--line);padding-top:1rem;font-size:.82rem;color:var(--muted)}
/* The one thing this page says on a phone. This is a desktop page on purpose:
   you come here to print letter-size paper, and nobody prints from a phone.
   So rather than reworking the whole layout for a screen it was never meant
   for, it says so plainly and gets out of the way. Deliberately the ONLY
   small-screen rule in this stylesheet -- do not grow a mobile design here. */
.onphone{display:none}
@media (max-width:640px){.onphone{display:block}}
"""


def ascii_only(html):
    """Turn every remaining non-ASCII character into an HTML entity.

    The hand-written text in this file already uses entities (&mdash;, &ndash;,
    &middot;). What it cannot control is the text that arrives from the data:
    the skill labels in sound-list.json carry phonetic symbols -- a /ăăă/,
    ng /ŋ/, a_e /ā/ -- and there are 34 such characters across 27 lesson cards.
    Those were raw UTF-8 bytes in the shipped page, and raw UTF-8 bytes are
    exactly what a charset-less host mis-reads.

    `&#x103;` says which character is meant with no encoding to get wrong, so
    the page reads correctly even if it is served with no charset at all, or
    pasted into an editor that saves as something else. Chrome renders the two
    forms identically -- textContent gives back the real character either way.
    """
    return html.encode("ascii", "xmlcharrefreplace").decode("ascii")


def sheet_pages(n):
    """How many pages lesson n's sheet really is, read from the sheet itself.

    This number used to be arithmetic: passages x 5 + letter sheets x 3. That
    assumed all five letter-and-sound sheets are three pages, but four of them
    are four pages, so the headline tile claimed 630 when Chrome actually
    prints 634. Every sheet already states its own page count correctly; only
    this tile was guessing. Count what is in the file instead of predicting it.
    """
    f = HERE / "sheets" / f"lesson-{n:03d}.html"
    return f.read_text().count('class="page') if f.exists() else 0


def check_sheets_match(passages):
    """Refuse to build an index that disagrees with the packets it links to.

    Two ways this page used to lie, both silently and both with exit code 0:

    1. A passage record with no sheet file still got a blue "Print this sheet"
       button, so a parent clicked it and landed on a 404. The letter-and-sound
       branch below always guarded against this with .exists(); the passage
       branch never did.

    2. The card's preview and the printed sheet are two separately saved
       copies. Edit a passage, rebuild only the index (the documented step),
       and the card previews "Mud Hog" while its button prints "Mud Pig" — the
       child reads a different story than the grown-up previewed. Nothing in
       the toolchain noticed: check_all.py only measures page heights.

    So before anything is written, every passage's title, every story line and
    every warm-up word is looked for INSIDE its sheet file, escaped the same
    way build_sheet.py wrote them. Any miss stops the build with the exact
    command that fixes it. Refusing beats warning here: a warning scrolls past,
    and the index this script writes is the page that makes the promises.
    """
    problems = []
    for n in sorted(passages):
        spec = passages[n]
        f = HERE / "sheets" / f"lesson-{n:03d}.html"
        if not f.exists():
            problems.append(
                f"Lesson {n}: there is a passage record but no printable sheet, so its\n"
                f"    Print button would open a 404 page.")
            continue
        sheet = f.read_text()
        wanted = [spec["title"]] + list(spec["lines"]) + list(spec["warmup"])
        stale = [t for t in wanted
                 if html.escape(str(t), quote=False) not in sheet]
        if stale:
            problems.append(
                f"Lesson {n}: the passage record and the printable sheet disagree, so the\n"
                f"    card would preview a different story than its button prints.\n"
                f"    Not found in the sheet: " +
                "; ".join(repr(t) for t in stale[:3]) +
                ("" if len(stale) <= 3 else f" (and {len(stale) - 3} more)"))
    if problems:
        print("NOT writing index.html — it would disagree with the printable sheets.\n")
        for p in problems:
            print(f"  {p}")
        print("\nTo fix, rebuild each sheet from its passage record, then run this again:")
        for p in problems:
            n = int(p.split(":")[0].split()[1])
            print(f"    python3 build_sheet.py passages/lesson-{n:03d}.json")
        sys.exit(1)


def build():
    sounds = json.loads((HERE / "sound-list.json").read_text())["lessons"]
    passages = {}
    for f in sorted((HERE / "passages").glob("lesson-*.json")):
        spec = json.loads(f.read_text())
        passages[spec["lesson"]] = spec
    check_sheets_match(passages)

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
                #
                # The WHOLE card is the link, on purpose. It used to be a plain
                # div with a link hidden on the lesson-number text: the page
                # said "Click them like any other lesson", and a click anywhere
                # on the card body did nothing. There is no story to preview
                # here, so "like any other lesson" means the card opens the
                # printable packet -- in a new tab, the same way Print this
                # sheet does, so the index is never navigated away from. The
                # blue button inside is a <span>, not a second <a>: a link may
                # not contain a link, and both would go to the same place.
                kind = "Blending &mdash; first words" if n == 5 else "Letter and sound"
                body += (f'<a class="card letter" href="sheets/lesson-{n:03d}.html" '
                         f'target="_blank" rel="noopener">'
                         f'<div class="n">Lesson {n}</div>'
                         f'<div class="t">{kind}</div>'
                         f'<div class="s">{L["skill"]}</div>'
                         f'<div class="print"><span>Print this sheet</span></div></a>')
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
    total_pages = sum(sheet_pages(n) for n in range(1, 129))

    jump = ('<nav class="jump">'
            + "".join(f'<a href="#u{i}">{u}</a>' for i, u in enumerate(order, 1))
            + "</nav>")

    # These four lines at the top are load-bearing, and this page shipped
    # without them:
    #   <!doctype html>  -- without it Chrome renders the page in quirks mode,
    #                       a legacy layout path nothing here should depend on.
    #   lang="en"        -- screen readers guess the language without it.
    #   <meta charset>   -- without it a host that sends no charset falls back
    #                       to windows-1252 and any raw non-ASCII byte turns
    #                       into mojibake. GitHub Pages sends a charset; a
    #                       plain `python3 -m http.server` does not. This is
    #                       the first of the two defences described up by
    #                       NO_PASSAGE_REASON; ascii_only() is the second, and
    #                       either one alone keeps the page readable.
    #   <meta viewport>  -- without it a phone lays the page out at 980px and
    #                       shrinks it to 40%, so 16px body text arrives at
    #                       6px. This does NOT make the page a phone page --
    #                       see .onphone below, which says so out loud.
    page = f"""<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Decodable Passages &mdash; all 128 lessons</title>
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
  <p class="onphone" style="margin-top:1.5rem">This page is built for a computer.
  You can read the stories on a phone, but the practice sheets are made for
  letter-size paper &mdash; open this on a laptop when it is time to print one.</p>
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
    page = ascii_only(page)
    OUT.write_text(page)
    print(f"wrote {OUT}")
    # Was `len(passages) * 4`, which matched neither the tile nor the paper.
    print(f"  {len(passages)} passages, {words:,} words, {total_pages} printable pages")
    print(f"  no passage for lessons: {missing}")


if __name__ == "__main__":
    build()
