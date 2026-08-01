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
        if href in seen or href.startswith(("http", "mailto:")):
            continue  # external links are out of scope for this checker
        if "${" in href:
            continue  # a JavaScript template that builds links at runtime, not a link itself
        seen.add(href)

        if href.startswith("#"):
            if f'id="{href[1:]}"' not in source_html:
                failures.append(f"{start_rel} -> {href}: jump target id missing")
            checked += 1
            continue

        target_rel = (Path(start_rel).parent / href).as_posix()
        target_rel = re.sub(r"[^/]+/\.\./", "", target_rel)  # resolve ../

        if live:
            status, html = fetch_live(LIVE_BASE + target_rel)
            if status != 200:
                failures.append(f"{start_rel} -> {href}: live site says {status}")
                continue
        else:
            p = ROOT / target_rel
            if not p.exists():
                failures.append(f"{start_rel} -> {href}: file does not exist")
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
