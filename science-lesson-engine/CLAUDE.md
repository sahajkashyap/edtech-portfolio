# Science Lesson Engine — Output Contract (the "recipe")

This file is the **shared rule set** every agent in the lesson-generation pipeline
must follow. It is version-controlled on purpose: the packet standard used to live
only inside chat sessions, and a disconnect lost it. It lives here now so it cannot
disappear again. When the orchestrator is built, every agent reads this contract and
produces packets that conform to it — no reminding required.

## Guiding principle

**Give more, not less — and let the teacher decide.** When there is a reasonable
choice between providing more material or less, provide more. When you can produce
both forms of something (e.g. an all-in-one master *and* ready-to-print per-tier
stacks), produce both. The teacher is the last mile; hand them options, not
constraints.

## What every lesson produces: a packet SET (never a single file)

For a standard 3-tier lesson, the engine outputs **four files**:

| File | Pages | Purpose |
|------|-------|---------|
| `Science-Notebook-Day-NN.pdf`        | ~9 | **Master.** Teacher cover + every page. The reference/archive copy. |
| `Science-Notebook-Day-NN-Tier-A.pdf` | ~4 | Ready-to-print student stack — **most support**. |
| `Science-Notebook-Day-NN-Tier-B.pdf` | ~4 | Ready-to-print student stack — **grade-level / medium support**. |
| `Science-Notebook-Day-NN-Tier-C.pdf` | ~4 | Ready-to-print student stack — **most challenge / least support**. |

The teacher prints the **one tier stack** each student needs (~4 pages), not the
whole master. The master exists so a teacher can see the entire lesson in one place
and so the set has an archival reference.

## Tiers

Tiers are the **same task at different support levels**, never different tasks:

- **Tier A — most support:** most scaffolding, controlled vocabulary, shortest text,
  most of the graph pre-drawn with guides.
- **Tier B — grade level:** standard scaffolding, grade-level text, student builds
  the full graph from the data.
- **Tier C — most challenge:** least scaffolding, richer text that may require
  inference, student sets up more of the graph independently.

## What is TIERED vs SHARED

Only two materials change between tiers. Two are identical for everyone.

- **Tiered:** the **graph** (amount of scaffolding) and the **reading** (readability).
- **Shared (identical for all tiers):** the **data table** and the **writing frame**.

Everyone graphs the same data and writes the same kind of response; the ramp is in
*how much support* the graph and reading give.

## THE TIER-GROUPING RULE  (curriculum-wide — applies to EVERYTHING)

> Keep each tier's pieces **contiguous**: all of A together, then all of B, then all
> of C. **Never** group by material type (all graphs, then all readings). A teacher
> pulling one tier's materials must find them in one place.

This is not specific to one lesson. It governs every packet, worksheet, slide set,
or bundle the generator ever produces. If a future material has more than one tiered
component, those components still travel together by tier.

### Page order — per-tier stack (the ~4-page student file)

1. Data table  *(shared)*
2. That tier's **graph**
3. That tier's **reading**
4. Writing frame  *(shared, includes Spanish)*

### Page order — master (the ~9-page file), tier-grouped

1. Teacher cover note
2. Data table  *(shared)*
3–4. **Tier A block** — graph + reading (together)
5–6. **Tier B block** — graph + reading (together)
7–8. **Tier C block** — graph + reading (together)
9. Writing frame  *(shared)*

## Teacher cover note (page 1 of the master) must:

- Explain the three tiers are the **same task at different support levels**.
- Tell the teacher to print **~4 pages per student** (the right tier), **not all 9**.
- Give **which-tier-fits-whom** guidance.
- End with a **page guide** (table of contents) matching the tier-grouped order above.

## Accessibility

- Writing frames include **Spanish** alongside English.
- Prefer plain fonts, high contrast, and generous write-on space.

## File naming

- Master: `Science-Notebook-Day-NN.pdf`
- Tiers:  `Science-Notebook-Day-NN-Tier-A.pdf` (and `-B`, `-C`)
- `NN` is the zero-padded day number (`05`, not `5`).

## Definition of done for a lesson

- [ ] All four files exist and open.
- [ ] Master is **tier-grouped** (A block, B block, C block — not all-graphs-then-all-readings).
- [ ] Data table and writing frame are **identical** across all tiers.
- [ ] Cover explains tiers, says print ~4 pp/student, gives tier guidance + page guide.
- [ ] Writing frame includes Spanish.
- [ ] Committed and pushed — never left only in a chat session.
