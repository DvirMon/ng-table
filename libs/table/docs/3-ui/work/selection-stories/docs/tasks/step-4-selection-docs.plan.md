---
title: 'Step 4 — re-derive selection coverage marks and clear the doc drift'
type: task-step
plan: ../../1-gap-analysis.md
node: I
---

# Step 4 — re-derive selection coverage marks, clear the doc drift

**PR scope:** Docs only.

**Task type:** docs

**Skills used:** audit-docs

**Depends on:** Step 2, Step 3, **and `filtering-stories/` Step 6** (`selection-filtering/`)
**Parallel-safe with:** —

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/docs/0-product/selection.md` (edit)
- `libs/table/docs/0-product/filtering.md` (edit — F-S1 bullet 1)
- `libs/table/docs/0-product/grouping.md` (edit — X-G1 story body)
- `libs/table/docs/1-state/features/selection.md` (edit — open questions)
- `libs/table/docs/1-state/work/with-selection/2-decisions.md` (edit — open questions)
- `libs/table/docs/1-state/state-persistence.md` (edit)
- `libs/table/docs/3-ui/work/selection-stories/1-gap-analysis.md` (edit — status line)
- `libs/table/docs/status.md` (regenerate, if any frontmatter moves)

## Why This Step Exists

Node I. A mark cannot flip before the story it measures renders — **wherever that story is built**,
which is why this step also waits on the filtering plan's `selection-filtering/`. The same pass
clears the doc drift catalogued in `research-selection-internal-coverage.md` §3/§5, since it touches
the same files.

## What To Do

1. **`0-product/selection.md`** — re-derive all 22 story marks from the shipped stories. ✅ only
   where the behavior _and_ its failure path render. Replace the blanket "every story is ❌, verified
   2026-09-12" paragraph and the 2026-09-13 correction note. Marks that must stay explicit:
   - §1.3 shift-click range and §4.2 Shift+Arrow — ❌, **blocked on node H** (the undrilled selection
     directive), not skipped. 4 of 5 peers ship shift-click; H's priority rises accordingly.
   - §4.1 — the Space half is covered; the roving-focus/Tab-containment model is not (U3/U4).
   - §1.5 select-every-unfetched-row — ❌, deliberately out of scope (S3).
   - §1.4 / §2.3 / §2.4 / §2.5 — credited to `selection-filtering/` under the **filtering** plan,
     measured in that plan's tables; reference them, do not re-count them.
   - §3.1 / X-G1 group-header select — owned by grouping, closed by grouping's D16.
2. **Doc drift, same pass:**
   - `0-product/filtering.md`'s F-S1 bullet 1 — answered by D59 (`selectAllIds()`).
   - `0-product/grouping.md`'s X-G1 story body — still says "undecided" while its own changelog says
     D16 closed it.
   - `1-state/features/selection.md` and `with-selection/2-decisions.md` open-question sections —
     same stale "undecided" for D16.
   - `1-state/state-persistence.md` — points at a precondition that no longer holds; D19 answers it.
   - `0-architecture-seam.md:83` — superseded by D5.
   - `with-selection/docs/tasks/progress.md` Step 7 — marked in progress; its tests exist and pass.
3. Update `1-gap-analysis.md`'s `status:` from "open — proposal, nothing here built yet" to built.
4. If any frontmatter `status`/`code` field moves, the registry needs regenerating:
   `npm run table:status`. **Name it as pending; do not run it from an automated step.**

## Implementation Notes

- Verify every drift item against the file before editing — several were already corrected between
  the research snapshot and now, and re-fixing a fixed line is how a doc gains contradictions.
- Product voice stays product voice.

## Risks / Watchouts

- Don't flip §2.5 (hidden-selection count) to covered: the notice in `selection-filtering/` states a
  **missing** signal; it is 🟡 at best until the computed-state work ships it.

## Non-Goals

- Node H (drilling `3-ui/directives/selection.md`) is not part of this plan — it is spec work for
  `/grill-with-docs`, gating the deferred range-select / keyboard-model / SR stories.
- No `3-ui/stories.md` edit here; the filtering plan's Step 10 registers all new folders, including
  this cluster's, in one pass.

## Acceptance Checks

- [ ] All 22 product stories carry a mark derived from a rendered story.
- [ ] Every drift item is either fixed or verified already-correct, with none re-fixed.
- [ ] The gap analysis status reflects what shipped, and node H is named as the remaining blocker.

---

← [Step 3: single-selection/](step-3-single-selection-story.plan.md)
