#!/usr/bin/env python3
"""Print how tall each .page is, so we know which sheet overflows before printing.

A letter page at 0.6in margins gives 9.8in of usable height = 940.8px at 96dpi.
Chrome renders each .page in isolation and we read back its measured height.
"""
import re
import subprocess
import sys
import pathlib
import json
import tempfile

CHROME = "/Users/sahajkashyap/.claude/bin/chrome"
BUDGET = 940.8  # px of usable height on one letter sheet at 0.6in margins
# A private directory per run. A hardcoded shared path meant two agents
# measuring different sheets at the same time overwrote each other's probe
# files, so check-pages reported another lesson's heights -- the same sheet
# measuring 980 then 900 with no change in between.
TMP = pathlib.Path(tempfile.mkdtemp(prefix="checkpages-"))

src_path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "example-lesson-41.html")
src = src_path.read_text()

# Measure by rendering one page at a time in screen mode, where .page grows
# past its 11in min-height when content overflows.
marks = [m.start() for m in re.finditer(r'<!-- =+ PAGE ', src)]
head = src[: marks[0]]
bodies = [src[marks[i] : (marks[i + 1] if i + 1 < len(marks) else src.index("</body>"))]
          for i in range(len(marks))]

probe = """
<script>
window.addEventListener('load', function () {
  var p = document.querySelector('.page');
  var cs = getComputedStyle(p);
  var pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  var used = 0;
  for (var i = 0; i < p.children.length; i++) {
    var r = p.children[i].getBoundingClientRect();
    var bottom = r.bottom;
    if (bottom > used) used = bottom;
  }
  var top = p.getBoundingClientRect().top + parseFloat(cs.paddingTop);
  document.title = 'H:' + Math.round(used - top);
});
</script>
"""

results = []
for i, body in enumerate(bodies, start=1):
    f = TMP / f"page{i}.html"
    f.write_text(head + body + probe + "</body></html>")
    out = subprocess.run(
        [CHROME, "--headless", "--disable-gpu", "--virtual-time-budget=3000",
         "--dump-dom", f"file://{f}"],
        capture_output=True, text=True,
    ).stdout
    m = re.search(r"<title>H:(-?\d+)</title>", out)
    used = int(m.group(1)) if m else None
    results.append((i, used))

print(f"{'sheet':<7}{'used px':>10}{'budget':>10}{'over by':>10}   status")
ok = True
for i, used in results:
    if used is None:
        print(f"{i:<7}{'?':>10}{BUDGET:>10.0f}{'?':>10}   could not measure")
        ok = False
        continue
    over = used - BUDGET
    status = "fits" if over <= 0 else "OVERFLOWS"
    if over > 0:
        ok = False
    print(f"{i:<7}{used:>10}{BUDGET:>10.0f}{over:>10.0f}   {status}")
sys.exit(0 if ok else 1)
