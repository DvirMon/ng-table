# Implementation Progress — Selection stories

**Plan:** [`../../1-gap-analysis.md`](../../1-gap-analysis.md)
**Issue:** — (no tracked issue; the gap analysis is the spec)
**Status:** 3 / 4 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | `selection/fixtures/schema.ts` — multi + single configs (B) | ✅ done | — |
| 2 | `multi-selection/` (C) | ✅ done | — |
| 3 | `single-selection/` (D) | ✅ done | — |
| 4 | Coverage marks + doc-drift cleanup (I) | ⬚ pending | — |

**Parallel-safe:** [2, 3] after 1. **Dependency:** 1 → {2, 3} → 4.

**Cross-plan edge:** Step 4 also waits on `filtering-stories/` **Step 6** (`selection-filtering/`) —
a §1.4 / §2.3 / §2.4 / §2.5 mark cannot flip until that story renders, and it is built there, not
here.

**Already done before this plan (re-derived from `src/` 2026-09-13):** node A
(`fixtures/types.ts`, `fixtures/mock.ts`, including `SAVED_SELECTION_IDS`'s absent `s99` and
`SAVED_CONFLICTING_SELECTION_IDS`) and node G (`selection-story.css` — count banner, control column,
aria-disabled styling, visible locked-row treatment), both commit `a1b96fc`.

**Not in this plan:** node H — drill `3-ui/directives/selection.md` (`spec: stub, code: none`). Spec
work for `/grill-with-docs`, parallel-safe with everything here, and the blocker on shift-click
range select (4 of 5 peers ship it), the roving-focus/Tab-containment model, and SR announcements.

## Cross-plan write edges (added 2026-09-13, parallel run)

The three story plans run in parallel for their code/story steps — the source trees are disjoint,
and the only shared `src/` edit is `grouping-stories/` Step 1 (`index.ts`). **The docs steps are
not disjoint** and are held back for one merged, serialized pass:

| File | Written by |
|---|---|
| `docs/3-ui/stories.md` | grouping Step 8, filtering Step 10 |
| `docs/0-product/grouping.md` | grouping Step 8, selection Step 4 (X-G1 body) |
| `docs/0-product/filtering.md` | filtering Step 9, selection Step 4 (F-S1 bullet 1) |
| `docs/status.md` (regen) | filtering Step 7, grouping Step 8, selection Step 4 |

Plus the already-recorded hard edge: selection Step 4 waits on filtering Step 6.

Do not run a docs step from inside a per-plan implementation run.
