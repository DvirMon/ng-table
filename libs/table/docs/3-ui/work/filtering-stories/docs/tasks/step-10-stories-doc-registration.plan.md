---
title: "Step 10 — 3-ui/stories.md: register the filtering cluster and folders"
type: task-step
plan: ../../1-gap-analysis.md
node: I
---

# Step 10 — `3-ui/stories.md`: register the filtering cluster and folders

**PR scope:** Docs only.

**Task type:** docs

**Skills used:** audit-docs

**Depends on:** Step 4, Step 5, Step 6
**Parallel-safe with:** Step 9

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/docs/3-ui/stories.md` (edit)

## Why This Step Exists

Node I. The conventions doc documents exactly one fixture cluster and describes the story set as
"the 8 stories in `src/stories/`".

## What To Do

1. Add `filtering/fixtures/*` to the shared-fixtures table, one row per file, with the same
   "Contents" grain the `row-edit/fixtures/*` rows use.
2. Add `client-filtering/`, `server-filtering/` and `selection-filtering/` to Reference
   implementations, each with the one-line reason it is standalone.
3. Correct the story count in the frontmatter `status:` and in the file-layout section (the grouping
   and selection plans add more folders — count what is actually on disk when this step runs, don't
   predict).
4. Record the two decisions this cluster settles, so they are not re-litigated:
   - the server story composes **no filtering feature** (R10/R23);
   - a debounce belongs to the server story, not the client one.

## Risks / Watchouts

- If the grouping/selection plans have already registered their folders, merge into the same tables
  rather than adding parallel sections.

## Non-Goals

- No coverage marks (Step 9). No new conventions — this step records practice, it does not invent
  it.

## Acceptance Checks

- [ ] The filtering fixtures cluster and all three folders appear, with accurate counts.
- [ ] No stale "8 stories" claim remains.

---
← [Step 9: product coverage marks](step-9-filtering-coverage-marks.plan.md)
