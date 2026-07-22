# Science Lesson Engine

Generates differentiated elementary-science notebook packets. Each lesson comes out
as a **packet set**: a teacher-facing **master** plus **ready-to-print per-tier
stacks** (A / B / C). The rules every packet follows live in [`CLAUDE.md`](./CLAUDE.md)
— that file is the durable "recipe."

## Why this exists in version control

The packet standard was originally worked out live in a chat session and never
committed. When the session disconnected, the work was lost. The standard now lives
here so it survives, and so an automated pipeline can read it directly.

## Layout

```
science-lesson-engine/
  CLAUDE.md                     # the output contract (packet standard + tier-grouping rule)
  README.md                     # this file
  lessons/
    habitats-day-05/
      build.py                  # builds this lesson's packet set (HTML -> PDF via headless Chromium)
      out/                      # generated PDFs (master + Tier A/B/C)
```

## Building a lesson

Each lesson has a self-contained `build.py`. It writes HTML pages and renders them to
PDF with the headless Chromium already present in this environment. From the lesson
folder:

```
python3 build.py
```

Output lands in `out/`:

- `Science-Notebook-Day-NN.pdf`         — master (teacher cover + everything, tier-grouped)
- `Science-Notebook-Day-NN-Tier-A.pdf`  — most support
- `Science-Notebook-Day-NN-Tier-B.pdf`  — grade level
- `Science-Notebook-Day-NN-Tier-C.pdf`  — most challenge

## Current lessons

- **habitats-day-05** — "When a Habitat Changes: The Return of the Frogs." Students
  read frog-count data from a restored wetland, graph it, read a tiered passage on
  why the frogs came back (food, water, shelter, space), and write a claim with
  evidence.
