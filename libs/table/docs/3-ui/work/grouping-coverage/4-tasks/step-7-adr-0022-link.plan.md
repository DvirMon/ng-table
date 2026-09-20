# Step 7 — ADR-0022's dead story link

**Task type:** docs
**Parallel-safe with:** Steps 1, 2, 3, 4

## Why

A sweep of `libs/table/docs/` for the three deleted story folders found exactly one **permanent**
doc still linking one: `adr/0022-render-row-cell-values.md:18` cites `grouping-static/`.

Everything else that names `grouping-static/`, `grouping-regressions/` or `grouping-crud/` is
either an episodic work/task plan (`1-state/work/**`, `3-ui/work/**/docs/tasks/**`) or
`3-lesson-audit.md`, the document that *decided* the deletions. Those references are historical
by design and are left alone — rewriting a task plan to match a later decision destroys the
record of what was true when it ran.

## Files

- `libs/table/docs/adr/0022-render-row-cell-values.md`

## What to do

Read line 18 in context and re-point the citation at whichever current story demonstrates the
claim the ADR is making about `RenderRow.cells`. Likely `grouping-basic/` (the baseline grouped
table) or `grouping-aggregates/` (if the line is about aggregate cells specifically) — read
before choosing; do not guess from the folder name.

If the claim no longer has a story that demonstrates it, say so in the ADR rather than pointing
at an approximation. A wrong citation in a permanent doc is worse than an acknowledged gap —
that is the finding that started this whole workstream.

## Acceptance checks

- [ ] `grep -rn "grouping-static/\|grouping-regressions/\|grouping-crud/" libs/table/docs/adr/`
      returns nothing.
- [ ] The new citation points at a folder that exists under
      `libs/table/src/stories/grouping/`.
- [ ] No episodic work doc or task plan was edited.
