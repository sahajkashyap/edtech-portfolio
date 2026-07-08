# Multiplication Quest ✖️

A free, self-contained multiplication practice generator for kids — four
mini-games plus a printable worksheet maker. Everything runs in a single
`index.html` file with **no dependencies, no server, and no API keys**, so it
works offline and can be hosted as a static page anywhere.

## Play

Open `index.html` in any browser, or serve the folder as a static site. The
⚙️ gear sets which times tables to practice, the highest factor, and the
difficulty. Stars and your Speed Run best are saved in your browser.

## What's inside

| Mode | What it does |
| --- | --- |
| 🃏 **Digit Drop** | Tap number cards to build the product, place value by place value, with a base-ten-blocks hint (flats / rods / cubes) and an across-vs-down addition breakdown. |
| 🔍 **Mystery Factor** | One factor is hidden (`? × 7 = 42`). Enter the missing number, with a skip-counting hint. |
| ⚡ **Speed Run** | Answer as many as you can in 60 seconds. Every 3 correct in a row adds a bigger bonus. Tracks a personal best. |
| 🔢 **Array Builder** | See multiplication as rows × columns of dots. *Count it* animates a count-along; *Build it* lets kids construct the array themselves. |
| 🖨️ **Worksheet Maker** | Generate a printable sheet (standard, missing-factor, or mixed) with an answer key. **Share links reproduce the exact same sheet** — a seed is encoded in the URL, so a teacher can hand out identical worksheets. |
| 📊 **My Progress** | Stars earned, Speed Run best, and which tables you're practicing. |

## How it works

- **Problems are generated algorithmically** from the tables you choose — the
  app never stores a fixed list of worksheets.
- **Reproducible worksheets** use a small seeded RNG (mulberry32). The same
  seed always produces the same sheet, which is what makes share links work.
- **Offline & printable** — one file, browser-only. Use the Print button (or
  your browser's "Save as PDF") for a clean, control-free printout.

## On originality

This tool was inspired by the general, widely-used teaching idea of
number-card multiplication practice — an approach and pedagogical method, which
are not protectable by copyright. Everything here is original by construction:

- Every problem is produced by code at runtime, never copied from any existing
  worksheet or answer set.
- The branding, mode names, layout, colors, and hints are our own.
- It does not use any other author's name, product names, problem sets, or
  visual designs, and is not affiliated with or compatible with any specific
  commercial product.

## Deploying

Because it's a single static file, it drops straight onto any static host
(GitHub Pages, Netlify, etc.). No build step is required.
