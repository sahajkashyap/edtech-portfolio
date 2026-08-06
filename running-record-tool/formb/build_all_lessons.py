#!/usr/bin/env python3
"""Generate ../all-lessons.html from formb/data/, and refuse to let it drift.

    python3 build_all_lessons.py            # CHECK: exit 1 if the page is stale
    python3 build_all_lessons.py --write    # regenerate it

Why this file exists
--------------------
all-lessons.html was built once, by hand, from the data — and then eight
passages were reverted and it silently kept showing the old text. The page said
"generated from formb/data/ so this page cannot drift from the tool", which was
true of the moment it was written and of no moment after.

That is defect class A12 in DEFECT-CLASS-CATALOGUE.md, committed the same day
the catalogue entry was written: *duplicated data with no build step*. sync_index
already exists for exactly this reason, for index.html. This is the same thing
for the review page, and verify_all runs it.

Derive, never duplicate.
"""

import html
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE / "data"
PAGE = HERE.parent / "all-lessons.html"


def esc(s):
    return html.escape(s)


def build() -> str:
    items = [json.loads(p.read_text())
             for p in sorted(DATA.glob("lesson-*.json"),
                             key=lambda p: int(p.stem.split("-")[1]))]
    rows = []
    for d in items:
        n, skill = d["lesson"], esc(d["skill"])
        notes = "".join(
            '<p class="note">%s</p>' % esc(d[k])
            for k in ("scoring_note", "nwf_note", "supply_note") if d.get(k))
        if d["instrument"] == "passage":
            body = "".join("<p>%s</p>" % esc(l) for l in d["lines"])
            words = len(" ".join(d["lines"]).split())
            kind = "passage"
            meta = "%d words &middot; %d lines" % (words, len(d["lines"]))
            title = esc(d["title"])
        else:
            groups = []
            for label, key in (("Real words", "real_words"),
                               ("Nonsense words", "nonsense_words"),
                               ("Heart words", "high_frequency"),
                               ("Sentences", "sentences")):
                if d.get(key):
                    groups.append('<div class="grp"><h4>%s</h4><p>%s</p></div>'
                                  % (label, esc(" &middot; ".join(d[key]))
                                     .replace("&amp;middot;", "&middot;")))
            body = "".join(groups)
            n_items = sum(len(d.get(k) or []) for k in
                          ("real_words", "nonsense_words", "high_frequency",
                           "sentences"))
            kind, meta = "wordlist", "%d items" % n_items
            title = "Word list"
        rows.append(
            '\n<article class="item %s" id="L%d">\n'
            '  <header>\n    <span class="num">Lesson %d</span>\n'
            '    <h3>%s</h3>\n    <span class="skill">%s</span>\n'
            '    <span class="meta">%s</span>\n  </header>\n'
            '  <div class="body">%s</div>\n  %s\n'
            '  <a class="mark" href="index.html#L%d">Mark this one &rarr;</a>\n'
            '</article>' % (kind, n, n, title, skill, meta, body, notes, n))

    jump = " ".join('<a href="#L%d">%d</a>' % (d["lesson"], d["lesson"])
                    for d in items)
    n_pass = sum(1 for d in items if d["instrument"] == "passage")
    n_wl = len(items) - n_pass
    # Must mirror index.html's tokenList(): every clickable item, passages AND
    # word lists, with sentences split into words. The old sum counted passages
    # only and under-reported the set by more than a hundred words.
    def tokens(d):
        if d["instrument"] == "passage":
            return sum(len(l.split()) for l in d["lines"])
        n = 0
        for label, key in (("Real words", "real_words"),
                           ("Nonsense words", "nonsense_words"),
                           ("Heart words", "high_frequency"),
                           ("Sentences", "sentences")):
            for v in d.get(key) or []:
                n += len(v.split()) if label == "Sentences" else 1
        return n
    total = sum(tokens(d) for d in items)

    return TEMPLATE % {
        "rows": "".join(rows), "jump": jump, "n": len(items),
        "n_pass": n_pass, "n_wl": n_wl, "total": total,
    }


TEMPLATE = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Form B &mdash; every lesson</title>
<style>
 :root{--ink:#1a1a1a;--cream:#faf6ee;--paper:#fffdf8;--rule:#d9c7a8;--blue:#378ADD;--muted:#8a6d3b}
 *{box-sizing:border-box}
 body{margin:0;background:var(--cream);color:var(--ink);
   font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
 .wrap{max-width:900px;margin:0 auto;padding:2rem 1.25rem 4rem}
 h1{font-size:1.6rem;margin:0 0 .25rem}
 .sub{color:var(--muted);margin:0 0 1.5rem;max-width:62ch}
 .counts{display:flex;gap:1.5rem;flex-wrap:wrap;padding:1rem 0;border-top:2px solid var(--rule);
   border-bottom:2px solid var(--rule);margin-bottom:1.5rem}
 .counts div{font-size:.85rem;color:var(--muted)}
 .counts b{display:block;font-size:1.5rem;color:var(--ink)}
 .jump{font-size:.85rem;line-height:2;margin-bottom:2rem}
 .jump a{display:inline-block;min-width:2.1em;text-align:center;padding:1px 4px;
   border:1px solid var(--rule);border-radius:5px;text-decoration:none;color:var(--ink);background:var(--paper)}
 .jump a:hover{border-color:var(--blue);color:var(--blue)}
 .item{background:var(--paper);border:1px solid var(--rule);border-radius:10px;
   padding:1.1rem 1.25rem;margin-bottom:1.1rem;scroll-margin-top:1rem}
 .item header{display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap;
   border-bottom:1px solid var(--rule);padding-bottom:.5rem;margin-bottom:.75rem}
 .num{font-weight:700;color:var(--blue);font-size:.8rem;letter-spacing:.04em;text-transform:uppercase}
 .item h3{margin:0;font-size:1.05rem}
 .skill{font-size:.8rem;color:var(--muted);background:var(--cream);
   padding:1px 7px;border-radius:20px;border:1px solid var(--rule)}
 .meta{margin-left:auto;font-size:.75rem;color:var(--muted)}
 .body p{margin:.25rem 0}
 .wordlist .body{display:grid;gap:.6rem}
 .grp h4{margin:0;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
 .grp p{margin:.1rem 0;font-family:ui-monospace,Menlo,monospace;font-size:.95rem}
 .note{margin:.75rem 0 0;font-size:.8rem;color:var(--muted);border-left:3px solid var(--rule);padding-left:.7rem}
 .mark{display:inline-block;margin-top:.8rem;font-size:.82rem;color:var(--blue);text-decoration:none}
 .mark:hover{text-decoration:underline}
 .kicker{margin:0 0 .3rem;font-size:.8rem;color:var(--muted);letter-spacing:.03em}
 .kicker a{color:var(--blue);text-decoration:none;font-weight:bold}
 .kicker a:hover{text-decoration:underline}
 @media print{.jump,.mark{display:none} .item{break-inside:avoid}}
</style></head><body><div class="wrap">
<p class="kicker"><a href="index.html">Word by Word</a> &middot; a running record tool</p>
<h1>Form B &mdash; every lesson we built</h1>
<p class="sub">All %(n)d assessment items, exactly as the child sees them. This page is
GENERATED from <code>formb/data/</code> by <code>formb/build_all_lessons.py</code>, and
<code>verify_all.py</code> fails if it falls out of step &mdash; so what you read here is
what the tool serves. Word lists come first (word-level measures), then passages.</p>
<div class="counts">
  <div><b>%(n)d</b>items</div>
  <div><b>%(n_wl)d</b>word lists</div>
  <div><b>%(n_pass)d</b>passages</div>
  <div><b>%(total)d</b>words a child reads</div>
  <div><b>6&ndash;41</b>lesson range</div>
</div>
<p class="sub" style="margin-top:-.6rem"><a href="worked-example.html">See a finished
record</a> &middot; <a href="index.html">the marking tool</a> &middot;
<a href="https://github.com/sahajkashyap/edtech-portfolio">source</a></p>
<nav class="jump">%(jump)s</nav>
%(rows)s
</div></body></html>
"""


def main(argv):
    want = build()
    have = PAGE.read_text() if PAGE.exists() else ""
    if "--write" in argv:
        if have == want:
            print("all-lessons.html already matches formb/data/.")
            return 0
        PAGE.write_text(want)
        print("all-lessons.html regenerated from formb/data/.")
        return 0
    if have == want:
        print("all-lessons.html matches formb/data/ exactly.")
        return 0
    print("DRIFT: all-lessons.html no longer matches formb/data/.\n"
          "It is the page a reviewer reads to check the content, so a stale copy "
          "shows them text the tool is not serving.\n\nFix with:  "
          "python3 build_all_lessons.py --write")
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
