#!/usr/bin/env python3
"""A page for the teacher to review the heart-word design before it ships.

Shows the mapping as a child sees it, the fact that the heart moves as they
learn, and every word with the lesson it arrives at.

Run:  python3 build_heart_preview.py   -> writes heart-words-preview.html
"""

import json
import pathlib

import heart_words as HEART

HERE = pathlib.Path(__file__).parent
OUT = HERE / "heart-words-preview.html"

CSS = """
:root{--ink:#17212B;--paper:#F3F5F6;--card:#fff;--line:#DCE2E6;--muted:#5F6B77;
 --accent:#1F5C8B;--heart:#B23F28;
 --serif:"Iowan Old Style",Georgia,serif;--sans:system-ui,-apple-system,sans-serif;
 --mono:ui-monospace,Menlo,monospace}
@media (prefers-color-scheme:dark){:root{--ink:#E3E9ED;--paper:#111820;--card:#19212B;
 --line:#2A343F;--muted:#93A0AC;--accent:#79B2DF;--heart:#E58067}}
:root[data-theme="dark"]{--ink:#E3E9ED;--paper:#111820;--card:#19212B;--line:#2A343F;
 --muted:#93A0AC;--accent:#79B2DF;--heart:#E58067}
:root[data-theme="light"]{--ink:#17212B;--paper:#F3F5F6;--card:#fff;--line:#DCE2E6;
 --muted:#5F6B77;--accent:#1F5C8B;--heart:#B23F28}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);line-height:1.6}
.wrap{max-width:54rem;margin:0 auto;padding:2.5rem 1.25rem 5rem}
h1,h2,h3{font-family:var(--serif);font-weight:600;margin:0;text-wrap:balance}
h1{font-size:clamp(1.9rem,4.5vw,2.8rem);line-height:1.15}
h2{font-size:1.4rem;margin:0 0 .3rem}
h3{font-size:1rem;margin:0 0 .2rem}
p{margin:.7rem 0}
.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:700}
.lede{color:var(--muted);font-size:1.05rem;max-width:36em}
header{border-bottom:2px solid var(--ink);padding-bottom:1.6rem}
section{margin-top:2.6rem}
.sub{color:var(--muted);font-size:.92rem;max-width:40em}
.panel{background:var(--card);border:1px solid var(--line);border-radius:4px;padding:1.1rem 1.25rem;margin-top:1rem}
.asheet{background:var(--card);border:1px solid var(--line);border-radius:4px;padding:1.2rem 1.4rem;margin-top:1rem}
.asheet .lab{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:700;margin-bottom:.5rem}
.asheet h3{border-left:4px solid var(--ink);padding-left:8px;font-family:var(--sans);font-size:.95rem;font-weight:700}
.asheet .hint{font-size:.82rem;color:var(--muted);margin:.2rem 0 .5rem 12px}
.row{display:flex;flex-wrap:wrap;gap:.9rem 1.4rem;align-items:flex-start;margin-left:12px}
.mv{display:grid;grid-template-columns:auto auto;gap:.5rem 1rem;align-items:center;margin-top:.6rem}
.mv .when{font-family:var(--mono);font-size:.8rem;color:var(--muted);white-space:nowrap}
table{width:100%;border-collapse:collapse;margin-top:.8rem;font-size:.88rem}
th,td{text-align:left;padding:.4rem .5rem;border-bottom:1px solid var(--line);vertical-align:middle}
th{font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
td.n{font-family:var(--mono);color:var(--muted);width:3.2rem}
td.w{font-weight:600;width:6rem}
td.y{color:var(--muted);font-size:.84rem}
.scroll{overflow-x:auto}
.note{border-left:3px solid var(--heart);padding-left:1rem;margin:1rem 0;color:var(--muted)}
footer{margin-top:3rem;border-top:1px solid var(--line);padding-top:1rem;font-size:.84rem;color:var(--muted)}
"""


def build():
    sounds = json.loads((HERE / "sound-list.json").read_text())["lessons"]

    def skill(n):
        return sounds[n - 1]["skill"]

    # a few lessons that show the routine well
    samples = [(13, "said"), (23, "he"), (45, "she"), (46, "they"), (58, "one")]
    sample_html = ""
    for n, _ in samples:
        new = [w for w in HEART.available(n) if w.lesson == n]
        if not new:
            continue
        cards = "".join(f"<div>{HEART.svg(w, n, box=34)}</div>" for w in new)
        why = "; ".join(f"<strong>{w.word}</strong> — {w.note}" for w in new)
        sample_html += (f'<div class="panel"><h3>Lesson {n} · {skill(n)}</h3>'
                        f'<div class="row" style="margin-left:0">{cards}</div>'
                        f'<p class="sub" style="margin:.6rem 0 0">{why}</p></div>')

    the = next(w for w in HEART.WORDS if w.word == "the")
    moves = "".join(
        f'<div class="when">at Lesson {n}</div><div>{HEART.svg(the, n, box=34)}</div>'
        for n in (1, 20, 46, 90))

    rows = "".join(
        f'<tr><td class="n">{w.lesson}</td><td class="w">{w.word}</td>'
        f'<td>{HEART.svg(w, w.lesson, box=22)}</td>'
        f'<td class="y">{w.note}</td></tr>' for w in HEART.WORDS)

    counts = "".join(
        f'<tr><td class="n">{n}</td><td class="w">{len(HEART.available(n))}</td>'
        f'<td class="y" colspan="2">{", ".join(w.word for w in HEART.available(n))}</td></tr>'
        for n in (7, 13, 19, 25, 33, 41, 46, 53))

    page = f"""<title>Heart words &mdash; how they will be taught</title>
<style>{CSS}</style>
<div class="wrap">

<header>
  <div class="eyebrow">Decodable passages &middot; for review before it ships</div>
  <h1>A heart word is mapped, not memorised</h1>
  <p class="lede">The old sheet listed heart words with a checkbox, which teaches
  nothing. This is what replaces it. Have a look and tell me if it is right before
  I rewrite sixty stories around it.</p>
</header>

<section>
  <h2>What a child sees</h2>
  <p class="sub">One box per <em>sound</em>. The boxes that behave normally are plain.
  Only the part that misbehaves gets a heart &mdash; that is the bit learned by heart,
  and it is usually one box out of three.</p>
  {sample_html}
</section>

<section>
  <h2>The heart moves as the child learns</h2>
  <p class="sub">This is the part I think matters most. A box is odd to a child either
  because it genuinely breaks the rules, or simply because they have not been taught it
  yet. At Lesson 1 a child has never met <code>th</code>, so <strong>the</strong> is a
  complete mystery and carries two hearts. Once Lesson 46 teaches <code>th</code>, that
  heart disappears and only the <code>e</code> stays odd.</p>
  <div class="panel"><div class="mv">{moves}</div></div>
  <p class="note">So a heart is not a fact about a word. It is a fact about a word
  <em>at a lesson</em>, and the sheet works it out fresh each time.</p>
</section>

<section>
  <h2>On the child's page it looks like this</h2>
  <div class="asheet">
    <div class="lab">My reading page &middot; Lesson 45</div>
    <h3>Say these first</h3>
    <div class="row"><span style="font-size:1.15rem;letter-spacing:.04em">fish&nbsp;&nbsp;
      shop&nbsp;&nbsp; dish&nbsp;&nbsp; shed&nbsp;&nbsp; shuts&nbsp;&nbsp; picks</span></div>
    <h3 style="margin-top:1rem">Heart words</h3>
    <p class="hint">Say it. Say each sound. The <span style="color:var(--heart)">&hearts;</span>
      box is the part to learn by heart.</p>
    <div class="row">{"".join(HEART.svg(w, 45, box=30) for w in HEART.available(45) if w.lesson == 45)}</div>
    <h3 style="margin-top:1rem">Read the story</h3>
    <p class="hint" style="font-size:1rem;color:var(--ink);margin-left:12px">
      Kim has a fish shop.<br>Kim sells fish in a dish.<br>A cat runs in the shop.</p>
  </div>
</section>

<section>
  <h2>What this unlocks</h2>
  <p class="sub">The old list gave three heart words per unit &mdash; 24 in all. This gives
  72, arriving when a child is actually taught them. The difference is that a story can
  finally say <em>she</em>.</p>
  <div class="scroll"><table>
    <tr><th>By lesson</th><th>Words</th><th colspan="2">Which ones</th></tr>
    {counts}
  </table></div>
</section>

<section>
  <h2>Every word, and why it is odd</h2>
  <p class="sub">All 72 are from the public-domain Dolch list (1936). Each is shown as it
  appears at the lesson it arrives, so some carry hearts that later disappear.</p>
  <div class="scroll"><table>
    <tr><th>Lesson</th><th>Word</th><th>As the child first meets it</th><th>Why it is odd</th></tr>
    {rows}
  </table></div>
</section>

<footer>
  Words from the public-domain Dolch list (1936). Which part of a word is irregular is a
  fact about English spelling. The teaching routine &mdash; map the regular parts, mark the
  irregular one &mdash; comes from orthographic mapping research and is used across
  structured-literacy programmes. No published programme's wording, page design or word
  list has been reproduced.
</footer>
</div>
"""
    OUT.write_text(page)
    print(f"wrote {OUT}  ({len(HEART.WORDS)} words)")


if __name__ == "__main__":
    build()
