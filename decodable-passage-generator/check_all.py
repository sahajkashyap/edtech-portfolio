#!/usr/bin/env python3
"""Measure every built sheet in one pass. Writes page-check.json.

One browser launch per sheet, not one per page: the probe walks every .page
elements and reports every height at once. Runs several sheets concurrently.

Run:  python3 check_all.py
"""

import concurrent.futures as cf
import json
import pathlib
import re
import subprocess
import sys
import tempfile

CHROME = "/Users/sahajkashyap/.claude/bin/chrome"
BUDGET = 940.8          # usable height of a letter page at 0.6in margins, in px
HERE = pathlib.Path(__file__).parent
SHEETS = HERE / "sheets"
OUT = HERE / "page-check.json"
WORKERS = 6

# Measures every .page at once and hands the numbers back through the title,
# which is the only channel --dump-dom gives us.
PROBE = """
<script>
window.addEventListener('load', function () {
  var out = [];
  document.querySelectorAll('.page').forEach(function (p) {
    var cs = getComputedStyle(p), used = 0;
    for (var i = 0; i < p.children.length; i++) {
      var b = p.children[i].getBoundingClientRect().bottom;
      if (b > used) used = b;
    }
    var top = p.getBoundingClientRect().top + parseFloat(cs.paddingTop);
    out.push(Math.round(used - top));
  });
  document.title = 'H:' + out.join(',');
});
</script>
"""


def measure(sheet: pathlib.Path, tmp: pathlib.Path):
    src = sheet.read_text()
    probe = tmp / f"{sheet.stem}.html"
    probe.write_text(src.replace("</body>", PROBE + "</body>"))
    dom = subprocess.run(
        [CHROME, "--headless", "--disable-gpu", "--virtual-time-budget=4000",
         "--dump-dom", f"file://{probe}"],
        capture_output=True, text=True, timeout=90).stdout
    m = re.search(r"<title>H:([\d,\-]+)</title>", dom)
    if not m:
        return sheet.stem, None
    return sheet.stem, [int(x) for x in m.group(1).split(",") if x]


def main():
    sheets = sorted(SHEETS.glob("lesson-*.html"))
    if not sheets:
        sys.exit(f"No sheets in {SHEETS}")
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="checkall-"))
    results, done = {}, 0

    with cf.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(measure, s, tmp): s for s in sheets}
        for fut in cf.as_completed(futures):
            try:
                name, heights = fut.result()
            except Exception as e:
                name, heights = futures[fut].stem, None
                print(f"  {name}: {type(e).__name__}", flush=True)
            over = ([] if not heights
                    else [i + 1 for i, h in enumerate(heights) if h > BUDGET])
            results[name] = {"heights": heights, "overflowing": over,
                             "measured": heights is not None}
            done += 1
            if done % 25 == 0:
                print(f"  {done}/{len(sheets)}", flush=True)

    OUT.write_text(json.dumps(dict(sorted(results.items())), indent=1) + "\n")
    bad = {k: v for k, v in results.items() if v["overflowing"]}
    unmeasured = [k for k, v in results.items() if not v["measured"]]

    print(f"\n{len(results)} sheets measured")
    print(f"  fitting cleanly : {len(results) - len(bad) - len(unmeasured)}")
    print(f"  overflowing     : {len(bad)}")
    print(f"  unmeasured      : {len(unmeasured)}")
    for k, v in sorted(bad.items()):
        print(f"    {k}: page(s) {v['overflowing']}  heights={v['heights']}")
    for k in sorted(unmeasured):
        print(f"    {k}: could not measure")
    sys.exit(1 if bad or unmeasured else 0)


if __name__ == "__main__":
    main()
