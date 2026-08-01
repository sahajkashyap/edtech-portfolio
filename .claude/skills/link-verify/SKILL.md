---
name: link-verify
description: >
  Verify that every link in a finished web page or tool (1) functionally works
  and (2) actually shows what it is supposed to show — not a blank page, not a
  copy of the page the link was on, not the wrong lesson. Use at the END of any
  project or change that adds, moves, renames, or restyles pages or links, and
  BEFORE telling Sahaj a build is "done and working." Run it as part of the
  final review, ideally by a separate reviewing agent.
---

# Link verify — "it opens" is not the same as "it's right"

> This root copy is the editable source (Claude's sessions cannot write inside
> `.claude/skills/`). After editing it here, deploy it with:
> `! cp LINK-VERIFY-SKILL.md .claude/skills/link-verify/SKILL.md`

## Why this exists

Established Aug 1, 2026, after the decodable passages index shipped with a
report that a lesson link "opens a blank page or the same page again." The
links had been checked for existence (files on disk, 200s on the live site) —
but existence checks cannot catch a blank page, a stale duplicate, or a link
pointing at the wrong lesson. Sahaj's standing rule from that day:

> At the end of any project, the reviewing agent should verify that each link
> one, functionally works, and two, actually shows what it's supposed to show.

## The three checks, in plain terms

1. **FOUND** — the target exists: the file is on disk, and the live URL
   answers 200.
2. **NOT BLANK** — the target renders real visible text (threshold: 20+
   words after stripping tags, styles, and scripts).
3. **RIGHT PAGE** — the target is not byte-identical to the page the link
   was on ("the same page again"), and if the link's filename promises
   specific content (e.g. `lesson-095.html`), the visible text must actually
   deliver it (the page says "Lesson 95").

## How to run it

The checker lives at the repo root: `check_links.py`.

    python3 check_links.py            # all three checks, against local files
    python3 check_links.py --live     # same checks against the live GitHub Pages site

Exit code 0 means every link passed; anything else prints exactly which link
failed and why. Run BOTH modes: local catches problems before a push, live
catches deployment problems after one (give GitHub Pages a couple of minutes
after pushing before trusting a live failure).

## Extending it

- **New start pages:** add them to `DEFAULT_STARTS` in `check_links.py` when a
  new tool or index page joins the portfolio.
- **New content rules:** the lesson-number rule is one example of "the page
  must deliver what the filename promises." When a new page type appears,
  add a matching rule — a link checker that only checks existence is a
  checker that checks nothing.
- **Links built by JavaScript** (template literals like `${url}`) are skipped
  by the static checker. Verify one of each such link by resolving what the
  generating function produces — in this repo, the phonics tool's
  `readingPracticeURL()` produces the same `sheets/lesson-NNN.html` paths the
  index already covers.

## What the machine cannot see (the human half)

The checker proves the right page opens. It cannot see how the click *feels*.
Known example: on the passages index, clicking a card's body expands an
in-place story preview (and clicking again collapses it) — only the blue
"Print this sheet" button opens the sheet. To a user expecting navigation,
the preview toggle can read as "nothing happened" or "the same page again."
When a link report can't be reproduced by the checker, ask exactly WHERE the
person clicked before concluding the links are fine.
