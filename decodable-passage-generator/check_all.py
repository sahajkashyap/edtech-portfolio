#!/usr/bin/env python3
"""Measure every built sheet. Writes page-check.json."""
import json, pathlib, re, subprocess, tempfile, sys
CHROME = "/Users/sahajkashyap/.claude/bin/chrome"
BUDGET = 940.8
PROBE = """<script>window.addEventListener('load',function(){
var p=document.querySelector('.page'),cs=getComputedStyle(p),used=0;
for(var i=0;i<p.children.length;i++){var b=p.children[i].getBoundingClientRect().bottom;
if(b>used)used=b;}
document.title='H:'+Math.round(used-(p.getBoundingClientRect().top+parseFloat(cs.paddingTop)));});</script>"""
tmp = pathlib.Path(tempfile.mkdtemp(prefix="checkall-"))
out = {}
sheets = sorted(pathlib.Path("sheets").glob("lesson-*.html"))
for i, f in enumerate(sheets, 1):
    src = f.read_text()
    marks = [m.start() for m in re.finditer(r'<!-- =+ PAGE ', src)]
    head = src[:marks[0]]
    heights = []
    for j, start in enumerate(marks):
        end = marks[j+1] if j+1 < len(marks) else src.index("</body>")
        probe = tmp / f"{f.stem}-{j}.html"
        probe.write_text(head + src[start:end] + PROBE + "</body></html>")
        dom = subprocess.run([CHROME,"--headless","--disable-gpu",
            "--virtual-time-budget=3000","--dump-dom",f"file://{probe}"],
            capture_output=True, text=True).stdout
        m = re.search(r"<title>H:(-?\d+)</title>", dom)
        heights.append(int(m.group(1)) if m else None)
    over = [k+1 for k,h in enumerate(heights) if h is None or h > BUDGET]
    out[f.stem] = {"heights": heights, "overflowing": over}
    if i % 20 == 0: print(f"  checked {i}/{len(sheets)}", flush=True)
pathlib.Path("page-check.json").write_text(json.dumps(out, indent=1))
bad = {k:v for k,v in out.items() if v["overflowing"]}
print(f"\n{len(out)} sheets checked; {len(bad)} with an overflowing page")
for k,v in sorted(bad.items()): print(f"  {k}: pages {v['overflowing']} — {v['heights']}")
