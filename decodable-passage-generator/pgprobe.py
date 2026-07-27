#!/usr/bin/env python3
"""scratch: same measurement as check-pages.py but in a private temp dir.

check-pages.py writes page1.html..pageN.html into one shared job temp dir, so
two agents running it at the same time overwrite each other's files and get
another lesson's numbers back. This copy uses a per-process dir.
"""
import os, re, subprocess, sys, time, pathlib

CHROME = "/Users/sahajkashyap/.claude/bin/chrome"
BUDGET = 940.8
TMP = pathlib.Path("/tmp/pgprobe-%d" % os.getpid())
TMP.mkdir(parents=True, exist_ok=True)

PROBE = """
<script>
window.addEventListener('load', function () {
  var p = document.querySelector('.page');
  var cs = getComputedStyle(p);
  var used = 0;
  for (var i = 0; i < p.children.length; i++) {
    var b = p.children[i].getBoundingClientRect().bottom;
    if (b > used) used = b;
  }
  var top = p.getBoundingClientRect().top + parseFloat(cs.paddingTop);
  document.title = 'H:' + Math.round(used - top);
});
</script>
"""

for path in sys.argv[1:]:
    src = pathlib.Path(path).read_text()
    marks = [m.start() for m in re.finditer(r'<!-- =+ PAGE ', src)]
    head = src[: marks[0]]
    print(path)
    bad = False
    for i in range(len(marks)):
        body = src[marks[i]: (marks[i + 1] if i + 1 < len(marks) else src.index("</body>"))]
        f = TMP / f"page{i}.html"
        f.write_text(head + body + PROBE + "</body></html>")
        used = None
        for attempt in range(4):
            out = subprocess.run(
                [CHROME, "--headless", "--disable-gpu", "--virtual-time-budget=6000",
                 "--dump-dom", f"file://{f}"], capture_output=True, text=True).stdout
            m = re.search(r"<title>H:(-?\d+)</title>", out)
            if m:
                used = int(m.group(1))
                break
            time.sleep(1)
        status = "?" if used is None else ("fits" if used <= BUDGET else "OVERFLOWS")
        if status != "fits":
            bad = True
        print(f"  sheet {i+1}: {used} / {int(BUDGET)}  {status}")
    if bad:
        sys.exit(1)
