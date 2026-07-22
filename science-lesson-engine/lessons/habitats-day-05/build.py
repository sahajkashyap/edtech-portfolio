#!/usr/bin/env python3
"""
Build the Day 5 packet set — "When a Habitat Changes: The Return of the Frogs."

Follows science-lesson-engine/CLAUDE.md (the output contract):
  - Tiered:  graph (scaffolding) + reading (readability)
  - Shared:  data table + writing frame (identical for every tier)
  - Master is TIER-GROUPED: cover, data table, A block, B block, C block, frame.

Renders HTML -> PDF with the headless Chromium already present in this environment.
Run:  python3 build.py
Out:  out/Science-Notebook-Day-05.pdf  and  -Tier-A/-B/-C.pdf
"""
import os
import glob
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

DAY = "05"
LESSON_TITLE = "When a Habitat Changes: The Return of the Frogs"

# ---------------------------------------------------------------- shared data
DATA = [("2022", 12), ("2023", 28), ("2024", 45), ("2025", 60)]
Y_MAX = 70            # top of scale
Y_STEP = 10           # gridline every 10 frogs
PX_PER_UNIT = 5       # 350px plot for 70 frogs

# ------------------------------------------------------------------------ CSS
CSS = """
* { box-sizing: border-box; }
@page { size: letter; margin: 0.55in 0.6in; }
html, body { margin: 0; padding: 0; }
body {
  font-family: "Segoe UI", Helvetica, Arial, sans-serif;
  color: #1a2233; font-size: 12.5pt; line-height: 1.5;
}
.page { page-break-after: always; position: relative; min-height: 9.0in; }
.page:last-child { page-break-after: auto; }
.eyebrow { font-size: 10pt; letter-spacing: .12em; text-transform: uppercase;
  color: #2f6f57; font-weight: 700; }
h1 { font-size: 21pt; margin: 2px 0 2px; }
h2 { font-size: 16pt; margin: 0 0 10px; color: #123; }
.namebar { display:flex; justify-content:space-between; gap:16px;
  font-size:10.5pt; color:#33404f; border-bottom:2px solid #cdd7e0;
  padding-bottom:6px; margin-bottom:14px; }
.namebar .fill { border-bottom:1.5px solid #97a6b5; flex:1; margin-left:6px;
  min-width:120px; }
.tierbadge { display:inline-block; padding:3px 12px; border-radius:14px;
  font-size:10pt; font-weight:700; color:#fff; }
.tA { background:#2f7d5b; } .tB { background:#2f6aa0; } .tC { background:#8a4bab; }
.tShared { background:#6b7684; }

/* data table */
table.data { border-collapse: collapse; width: 62%; margin: 10px 0 14px; }
table.data th, table.data td { border:1.5px solid #33404f; padding:9px 12px;
  text-align:center; font-size:13pt; }
table.data th { background:#eef4f1; }
.caption { font-size:10.5pt; color:#4a5766; font-style:italic; }

/* bar graph */
.plotwrap { display:flex; align-items:flex-end; margin-top:16px; }
.yaxis { display:flex; flex-direction:column-reverse; justify-content:space-between;
  height:350px; margin-right:8px; text-align:right; width:34px; font-size:10pt;
  color:#33404f; }
.plot { position:relative; height:350px; border-left:2.5px solid #33404f;
  border-bottom:2.5px solid #33404f; flex:1; }
.gridline { position:absolute; left:0; right:0; border-top:1px dashed #d5dde4; }
.bars { position:absolute; left:0; right:0; bottom:0; top:0; display:flex;
  align-items:flex-end; justify-content:space-around; }
.slot { width:16%; text-align:center; height:100%; display:flex;
  flex-direction:column; justify-content:flex-end; }
.bar-solid { background:#3f9b73; border:1.5px solid #2b6d50; }
.bar-ghost { background:repeating-linear-gradient(45deg,#eaf4ef,#eaf4ef 6px,#dcece4 6px,#dcece4 12px);
  border:2px dashed #4f9c79; }
.bar-ghost .trace { font-size:8.5pt; color:#2f7d5b; padding-top:3px; }
.xlab { margin-top:6px; font-size:10.5pt; font-weight:600; }
.axis-title-y { writing-mode: vertical-rl; transform: rotate(180deg);
  text-align:center; font-size:10.5pt; font-weight:600; color:#33404f;
  margin-right:2px; }
.axis-title-x { text-align:center; font-size:10.5pt; font-weight:600;
  color:#33404f; margin-top:4px; }
.blankline { display:inline-block; border-bottom:1.5px solid #97a6b5;
  min-width:150px; }

/* readings */
.reading p { margin: 0 0 11px; }
.reading .lead { font-weight:600; }
b { color:#173a29; }
.wordbox { border:1.5px dashed #6b7684; border-radius:8px; padding:8px 12px;
  background:#f7faf8; font-size:11pt; margin:10px 0; }

/* write-on lines */
.lines { margin-top:10px; }
.lines .l { border-bottom:1.5px solid #b9c3cd; height:30px; }

/* writing frame */
.frame-step { margin:0 0 14px; }
.frame-step .k { font-weight:700; color:#2f6f57; }
.stem { margin:4px 0 2px; }
.es { color:#5a6672; font-style:italic; }  /* spanish */

/* cover */
.cover-note { background:#f3f7f5; border:1.5px solid #cdddd4; border-radius:12px;
  padding:16px 20px; margin:14px 0; }
.cover-note h3 { margin:0 0 6px; color:#2f6f57; font-size:12.5pt; }
ul.tight { margin:6px 0; padding-left:20px; }
ul.tight li { margin:4px 0; }
table.guide { border-collapse:collapse; width:100%; margin-top:6px; font-size:11pt; }
table.guide th, table.guide td { border:1px solid #cdd7e0; padding:6px 9px;
  text-align:left; }
table.guide th { background:#eef4f1; }
.small { font-size:10.5pt; color:#4a5766; }
"""

# ------------------------------------------------------------- page fragments
def namebar():
    return ('<div class="namebar"><div>Name <span class="fill"></span></div>'
            '<div>Date <span class="fill" style="min-width:80px"></span></div></div>')

def data_table_page():
    rows = "".join(f"<tr><td>{y}</td><td>{v}</td></tr>" for y, v in DATA)
    return f"""
<section class="page">
  {namebar()}
  <div class="eyebrow">Day 5 &middot; Science Notebook &middot; <span class="tierbadge tShared">Everyone</span></div>
  <h1>The Return of the Frogs</h1>
  <h2>Step 1 &middot; Read the data</h2>
  <p>Volunteers restored the wetland at Marsh Creek. Every May, the 4th-grade class
     counted the frogs. Here is what they found.</p>
  <table class="data">
    <tr><th>Year</th><th>Frogs counted</th></tr>
    {rows}
  </table>
  <p class="caption">Data collected each May at Marsh Creek Wetland, 2022&ndash;2025.</p>
  <p><b>Talk it over:</b> What do you notice about the numbers from 2022 to 2025?</p>
</section>"""

def _yaxis(show_numbers=True):
    ticks = list(range(0, Y_MAX + 1, Y_STEP))
    cells = "".join(f"<div>{t if show_numbers else '&nbsp;'}</div>" for t in ticks)
    return f'<div class="yaxis">{cells}</div>'

def _gridlines():
    out = []
    for t in range(0, Y_MAX + 1, Y_STEP):
        bottom = t * PX_PER_UNIT
        out.append(f'<div class="gridline" style="bottom:{bottom}px"></div>')
    return "".join(out)

def _bars(mode):
    """mode: 'A' (first two solid, last two ghost), 'B'/'C' (all empty to draw)."""
    slots = []
    for i, (year, val) in enumerate(DATA):
        h = val * PX_PER_UNIT
        if mode == "A" and i < 2:
            bar = f'<div class="bar-solid" style="height:{h}px"></div>'
        elif mode == "A":
            bar = (f'<div class="bar-ghost" style="height:{h}px">'
                   f'<div class="trace">trace &amp; fill</div></div>')
        else:
            bar = ""  # student draws
        slots.append(f'<div class="slot">{bar}<div class="xlab">{year}</div></div>')
    return f'<div class="bars">{"".join(slots)}</div>'

def graph_page(tier):
    badge = {"A": "tA", "B": "tB", "C": "tC"}[tier]
    if tier == "A":
        instr = ("Two bars are done for you. <b>Trace and fill</b> the two dashed "
                 "bars to match the data table.")
        show_numbers, show_titles = True, True
    elif tier == "B":
        instr = "Use the data table to <b>draw all four bars</b> at the right height."
        show_numbers, show_titles = True, True
    else:
        instr = ("<b>Draw all four bars</b> from the data. Then <b>write the graph "
                 "title and label both axes</b> yourself.")
        show_numbers, show_titles = True, False

    title = ("Frogs at Marsh Creek Wetland" if show_titles
             else '<span class="blankline"></span> <span class="small">(write a title)</span>')
    ytitle = "Frogs counted" if show_titles else "&nbsp;"
    xtitle = "Year" if show_titles else '<span class="blankline"></span> (label this axis)'

    return f"""
<section class="page">
  {namebar()}
  <div class="eyebrow">Day 5 &middot; Step 2 &middot; Graph &middot; <span class="tierbadge {badge}">Tier {tier}</span></div>
  <h2 style="text-align:center">{title}</h2>
  <p>{instr}</p>
  <div class="plotwrap">
    <div class="axis-title-y">{ytitle}</div>
    {_yaxis(show_numbers)}
    <div class="plot">
      {_gridlines()}
      {_bars(tier)}
    </div>
  </div>
  <div class="axis-title-x">{xtitle}</div>
</section>"""

READINGS = {
    "A": """
  <p class="lead">A <b>wetland</b> is a habitat. It has water, plants, and food.</p>
  <p>For years the wetland was <b>dirty</b>. Only a few frogs could live there.</p>
  <p>Then people <b>cleaned</b> it. The water got clean. New plants grew.
     Bugs came back for the frogs to eat.</p>
  <p>Now many frogs live in the wetland. The frogs came back because the habitat
     gave them what they need: <b>food, water, shelter, and space</b>.</p>""",
    "B": """
  <p class="lead">A wetland is a habitat where water meets land.</p>
  <p>Years ago, this wetland was polluted, and only a few frogs could survive there.
     Then a group of volunteers cleaned up the trash and planted native reeds along
     the water. As the water grew cleaner, <b>insects</b> returned &mdash; and insects
     are <b>food</b> for frogs. The new plants gave frogs <b>shelter</b> to hide from
     herons and a safe place to lay eggs.</p>
  <p>Little by little, the frog population grew. The frogs came back because the
     habitat once again met their needs: <b>food, water, shelter, and space</b>.</p>""",
    "C": """
  <p>For decades, runoff from nearby roads left this wetland polluted and choked with
     litter. Frogs are especially sensitive to pollution because they breathe partly
     through their skin, so as the water quality fell, the frog population
     collapsed &mdash; only a dozen remained.</p>
  <p>In 2022, volunteers began restoring the wetland: hauling out trash, replanting
     native reeds, and slowing the polluted runoff. Cleaner water let aquatic insects
     return, rebuilding the frogs' food supply, while the new reeds offered shelter
     from predators and a protected place to lay eggs. One by one, each habitat
     need &mdash; <b>food, water, shelter, and space</b> &mdash; was restored, and the
     data shows the result.</p>""",
}

def reading_page(tier):
    badge = {"A": "tA", "B": "tB", "C": "tC"}[tier]
    return f"""
<section class="page">
  {namebar()}
  <div class="eyebrow">Day 5 &middot; Step 3 &middot; Read &middot; <span class="tierbadge {badge}">Tier {tier}</span></div>
  <h2>Why did the frogs come back?</h2>
  <div class="reading">{READINGS[tier]}</div>
  <p><b>Underline</b> the four things every habitat must give an animal.</p>
</section>"""

def frame_page():
    return f"""
<section class="page">
  {namebar()}
  <div class="eyebrow">Day 5 &middot; Step 4 &middot; Write &middot; <span class="tierbadge tShared">Everyone</span></div>
  <h2>Make a claim from the evidence</h2>
  <p>What happened to the frog population, and why? Write a <b>claim</b>, support it
     with <b>evidence</b> from the data and the reading, and explain your
     <b>reasoning</b>.</p>

  <div class="frame-step">
    <div class="k">Claim</div>
    <div class="stem">The frog population <span class="blankline"></span> from 2022 to 2025.</div>
    <div class="stem es">La poblaci&oacute;n de ranas <span class="blankline"></span> de 2022 a 2025.</div>
  </div>

  <div class="frame-step">
    <div class="k">Evidence</div>
    <div class="stem">I know this because the data shows <span class="blankline"></span>.</div>
    <div class="stem">The reading says <span class="blankline"></span>.</div>
    <div class="stem es">Lo s&eacute; porque los datos muestran <span class="blankline"></span>. La lectura dice <span class="blankline"></span>.</div>
  </div>

  <div class="frame-step">
    <div class="k">Reasoning</div>
    <div class="stem">This happened because the habitat gave the frogs
      <span class="blankline" style="min-width:90px"></span>,
      <span class="blankline" style="min-width:90px"></span>,
      <span class="blankline" style="min-width:90px"></span>, and
      <span class="blankline" style="min-width:90px"></span>.</div>
    <div class="stem es">Esto pas&oacute; porque el h&aacute;bitat les dio a las ranas comida, agua, refugio y espacio.</div>
  </div>

  <div class="wordbox"><b>Word bank:</b> food / water / shelter / space
     &nbsp;&middot;&nbsp; <span class="es">comida / agua / refugio / espacio</span></div>

  <div class="lines">
    <div class="l"></div><div class="l"></div><div class="l"></div>
  </div>
</section>"""

def cover_page():
    return f"""
<section class="page">
  <div class="eyebrow">Teacher cover &middot; Science &middot; Habitats unit</div>
  <h1>Day 5 &mdash; When a Habitat Changes</h1>
  <p class="small">"The Return of the Frogs" &middot; students read wetland frog-count
     data, graph it, read why the frogs came back, and write a claim with evidence.</p>

  <div class="cover-note">
    <h3>Three tiers, one task</h3>
    <p style="margin:0">Tiers A, B, and C are the <b>same lesson at different support
      levels</b> &mdash; not different work. Every student reads the same data and writes
      the same kind of claim; only the <b>graph scaffolding</b> and the <b>reading
      level</b> change. The <b>data table</b> and the <b>writing frame</b> are identical
      for everyone.</p>
  </div>

  <div class="cover-note">
    <h3>Print ~4 pages per student &mdash; not all 9</h3>
    <p style="margin:0 0 6px">This master holds every page so you can see the whole
      lesson. For students, print the <b>single tier stack</b> that fits each child
      (about 4 pages each): <code>Day-05-Tier-A / -B / -C.pdf</code>.</p>
    <ul class="tight">
      <li><b>Tier A</b> &mdash; most support. Two bars pre-drawn; shortest reading with
        key words bolded. For emerging readers / graphers and many MLL students.</li>
      <li><b>Tier B</b> &mdash; grade level. Student graphs all four bars; one-paragraph
        reading. The default for most of the class.</li>
      <li><b>Tier C</b> &mdash; most challenge. Student titles and labels the graph;
        longer reading that asks them to infer cause and effect.</li>
    </ul>
    <p class="small" style="margin:6px 0 0">The writing frame includes Spanish stems for
      every student.</p>
  </div>

  <div class="cover-note">
    <h3>Page guide (this master is grouped by tier)</h3>
    <table class="guide">
      <tr><th>Page</th><th>Content</th></tr>
      <tr><td>1</td><td>This cover</td></tr>
      <tr><td>2</td><td>Data table &mdash; <i>shared by all tiers</i></td></tr>
      <tr><td>3&ndash;4</td><td><b>Tier A</b> &mdash; graph + reading</td></tr>
      <tr><td>5&ndash;6</td><td><b>Tier B</b> &mdash; graph + reading</td></tr>
      <tr><td>7&ndash;8</td><td><b>Tier C</b> &mdash; graph + reading</td></tr>
      <tr><td>9</td><td>Writing frame &mdash; <i>shared by all tiers</i></td></tr>
    </table>
  </div>
</section>"""

# --------------------------------------------------------------- assemble docs
def document(title, body):
    return (f"<!doctype html><html><head><meta charset='utf-8'>"
            f"<title>{title}</title><style>{CSS}</style></head>"
            f"<body>{body}</body></html>")

def master_html():
    body = (cover_page() + data_table_page()
            + graph_page("A") + reading_page("A")
            + graph_page("B") + reading_page("B")
            + graph_page("C") + reading_page("C")
            + frame_page())
    return document(f"Science Notebook Day {DAY} — Master", body)

def tier_html(tier):
    body = data_table_page() + graph_page(tier) + reading_page(tier) + frame_page()
    return document(f"Science Notebook Day {DAY} — Tier {tier}", body)

# ------------------------------------------------------------------- rendering
def find_chrome():
    for p in sorted(glob.glob("/opt/pw-browsers/chromium-*/chrome-linux/chrome")):
        return p
    for p in ("/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"):
        if os.path.exists(p):
            return p
    raise SystemExit("No Chromium binary found.")

def render(html, pdf_path):
    chrome = find_chrome()
    html_path = pdf_path.replace(".pdf", ".html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)
    subprocess.run(
        [chrome, "--headless", "--no-sandbox", "--disable-gpu",
         "--no-pdf-header-footer", f"--print-to-pdf={pdf_path}",
         f"file://{html_path}"],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    os.remove(html_path)
    print(f"  wrote {os.path.relpath(pdf_path, HERE)}")

def main():
    print("Building Day 5 packet set...")
    render(master_html(), os.path.join(OUT, f"Science-Notebook-Day-{DAY}.pdf"))
    for tier in ("A", "B", "C"):
        render(tier_html(tier), os.path.join(OUT, f"Science-Notebook-Day-{DAY}-Tier-{tier}.pdf"))
    print("Done.")

if __name__ == "__main__":
    main()
