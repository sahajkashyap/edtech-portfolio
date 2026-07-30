#!/usr/bin/env python3
"""Confirm no story line wraps.

The line is the unit a child points along, so a wrapped line is worse than
small type. Story type is now sized per lesson to fill its page, and the width
ceiling in build_sheet.story_type is an estimate -- this checks the estimate
against what the browser actually does.

Run:  python3 wrap_check.py
"""
import pathlib
import re
import subprocess
import sys
import tempfile

CHROME = "/Users/sahajkashyap/.claude/bin/chrome"
PROBE = """
<script>window.addEventListener('load',function(){
  var n=0;
  document.querySelectorAll('.passage .ln').forEach(function(s){
    var r=s.getClientRects();
    if(r.length>1) n++;
  });
  document.title='W:'+n;
});</script>
"""
tmp = pathlib.Path(tempfile.mkdtemp(prefix="wrapcheck-"))
bad = 0
for f in sorted(pathlib.Path("sheets").glob("lesson-*.html")):
    src = f.read_text()
    probe = tmp / f.name
    probe.write_text(src.replace("</body>", PROBE + "</body>"))
    out = subprocess.run(
        [CHROME, "--headless", "--disable-gpu", "--virtual-time-budget=3000",
         "--dump-dom", f"file://{probe}"], capture_output=True, text=True).stdout
    m = re.search(r"<title>W:(\d+)</title>", out)
    n = int(m.group(1)) if m else -1
    if n != 0:
        bad += 1
        print(f"{f.stem}: {n} story line(s) wrap" if n > 0 else
              f"{f.stem}: could not measure")
print(f"\n{bad} sheet(s) with a wrapped story line")
sys.exit(1 if bad else 0)
