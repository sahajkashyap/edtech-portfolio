#!/usr/bin/env python3
"""Verify that every link on a page works AND shows what it promises.

Three checks per link, in plain terms:
  1. FOUND    - the target exists (file on disk, or 200 on the live site)
  2. NOT BLANK - the target renders real visible text (not an empty shell)
  3. RIGHT PAGE - the target is not just a copy of the page the link was on,
                  and if the link names a lesson (lesson-095.html), the target
                  must actually say "Lesson 95" in its visible text.

Usage:
  python3 check_links.py                          # check the default start pages, locally
  python3 check_links.py path/to/page.html ...    # check specific pages
  python3 check_links.py --live                   # same checks against the live site

Exit code 0 = every link passed. Anything else = failures were printed.
"""

import hashlib
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
LIVE_BASE = "https://sahajkashyap.github.io/edtech-portfolio/"
DEFAULT_STARTS = [
    "decodable-passage-generator/index.html",
    "phonics-assessment-tool/index.html",
    "running-record-tool/index.html",
    # A new page joins this list in the same commit that creates it, or the
    # standing rule verifies everything except the thing that just changed.
    "running-record-tool/all-lessons.html",
    "running-record-tool/worked-example.html",
]
MIN_VISIBLE_WORDS = 20  # fewer than this and a page counts as blank


def visible_text(html: str) -> str:
    html = re.sub(r"<style.*?</style>|<script.*?</script>", " ", html, flags=re.S)
    html = re.sub(r"<[^>]+>", " ", html)
    return " ".join(html.split())


def fetch_live(url: str):
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except Exception as e:
        return getattr(e, "code", 0), ""


def check_page(start_rel: str, live: bool):
    failures = []
    start_path = ROOT / start_rel
    if live:
        status, source_html = fetch_live(LIVE_BASE + start_rel)
        if status != 200:
            return [f"{start_rel}: start page itself unreachable ({status})"]
    else:
        if not start_path.exists():
            return [f"{start_rel}: start page missing on disk"]
        source_html = start_path.read_text()

    source_fp = hashlib.md5(source_html.encode()).hexdigest()
    hrefs = re.findall(r'href="([^"]+)"', source_html)
    seen = set()
    checked = 0

    for href in hrefs:
        if href in seen or href.startswith(("http", "mailto:", "tel:")):
            continue  # external links are out of scope for this checker
        if href.startswith("data:"):
            continue  # an inline image or icon carried in the page itself, not a link out
        if "${" in href:
            continue  # a JavaScript template that builds links at runtime, not a link itself
        seen.add(href)

        if href.startswith("#"):
            if f'id="{href[1:]}"' not in source_html:
                failures.append(f"{start_rel} -> {href}: jump target id missing")
            checked += 1
            continue

        # A link may carry BOTH a file and a fragment: index.html#L24. The
        # fragment was being left on the path, so every deep link was reported
        # as "file does not exist" — the checker failing a link that works.
        path_part, _, fragment = href.partition("#")

        target_rel = (Path(start_rel).parent / path_part).as_posix()
        target_rel = re.sub(r"[^/]+/\.\./", "", target_rel)  # resolve ../

        if live:
            status, html = fetch_live(LIVE_BASE + target_rel)
            if status != 200:
                failures.append(f"{start_rel} -> {href}: live site says {status}")
                continue
            # A .md target returns 200 and reads fine here, but the browser
            # DOWNLOADS it instead of opening it, because GitHub serves it as
            # text/markdown. This checker used to pass such a link — status 200,
            # plenty of words — while a real visitor got a file in their
            # Downloads folder. Link to the .html Jekyll renders instead.
            if target_rel.endswith(".md"):
                failures.append(f"{start_rel} -> {href}: DOWNLOADS instead of opening "
                                f"(served as markdown; link to {href[:-3]}.html)")
                continue
        else:
            p = ROOT / target_rel
            # GitHub Pages runs Jekyll, which renders every .md file to a
            # matching .html page. So DESIGN.html is a real page live even
            # though only DESIGN.md exists on this computer. Without this, the
            # checker fails the CORRECT link and tempts somebody to change it
            # back to the .md one that downloads.
            if not p.exists() and p.suffix == ".html" and p.with_suffix(".md").exists():
                p = p.with_suffix(".md")
            if not p.exists():
                failures.append(f"{start_rel} -> {href}: file does not exist")
                continue
            if target_rel.endswith(".md"):
                failures.append(f"{start_rel} -> {href}: DOWNLOADS instead of opening "
                                f"(served as markdown; link to {href[:-3]}.html)")
                continue
            html = p.read_text()

        text = visible_text(html)
        if len(text.split()) < MIN_VISIBLE_WORDS:
            failures.append(f"{start_rel} -> {href}: BLANK ({len(text.split())} visible words)")
            continue

        if hashlib.md5(html.encode()).hexdigest() == source_fp:
            failures.append(f"{start_rel} -> {href}: SAME PAGE AGAIN (identical to source)")
            continue

        m = re.search(r"lesson-0*(\d+)\.html", href)
        if m and f"Lesson {int(m.group(1))}" not in text:
            failures.append(f"{start_rel} -> {href}: WRONG CONTENT (page never says 'Lesson {int(m.group(1))}')")
            continue

        # The fragment has to land somewhere. Either the target has that id, or
        # it routes on the hash in script. A page with neither silently drops
        # the reader at the top and the link reads as broken to a teacher who
        # clicked "Lesson 24" and got Lesson 6.
        if fragment and f'id="{fragment}"' not in html and "location.hash" not in html:
            failures.append(f"{start_rel} -> {href}: fragment #{fragment} lands nowhere "
                            f"(no id and no hash routing on the target page)")
            continue

        checked += 1

    print(f"{start_rel}: {checked} links checked, {len(failures)} problems")
    return failures


def main():
    args = [a for a in sys.argv[1:] if a != "--live"]
    live = "--live" in sys.argv[1:]
    starts = args or DEFAULT_STARTS
    where = "LIVE SITE" if live else "local files"
    print(f"Checking links against {where}\n" + "-" * 40)
    all_failures = []
    for s in starts:
        all_failures += check_page(s, live)
    print("-" * 40)
    if all_failures:
        print(f"FAILED: {len(all_failures)} problem(s)")
        for f in all_failures:
            print("  " + f)
        sys.exit(1)
    print("ALL LINKS PASS: found, not blank, and showing the right content.")


if __name__ == "__main__":
    main()
