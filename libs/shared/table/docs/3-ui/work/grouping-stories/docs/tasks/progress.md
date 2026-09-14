# Implementation Progress — Grouping stories

**Plan:** [`../../1-gap-analysis.md`](../../1-gap-analysis.md)
**Issue:** — (no tracked issue; the gap analysis is the spec)
**Status:** 7 / 8 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | Export the four group-level updaters from `index.ts` (C2) | ✅ done | — |
| 2 | `grouping/fixtures/schema.ts` — three table configs (A) | ✅ done | — |
| 3 | `grouping/fixtures/handlers.ts` + `http.ts` (A) | ✅ done | — |
| 4 | `grouping-static/` (B) | ✅ done | — |
| 5 | `grouping-collapsible/` (D) | ✅ done | — |
| 6 | `grouping-selection/` (E) | ✅ done | — |
| 7 | Async grouping rule on the static story (F) | ✅ done | — |
| 8 | Coverage marks + `stories.md` registration | ⬚ pending | — |

**Parallel-safe:** [1, 2, 3] start now; [4, 5, 6] once their fixture deps land (4 ← 1+2, 5 ← 2+3,
6 ← 2); 7 ← 3+4; 8 ← 4+5+6+7.

**Already done before this plan (re-derived from `src/` 2026-09-13):** node C1
(`RenderRow.groupKey`, commit `f1cf36b`), `fixtures/types.ts`, `fixtures/mock.ts` and
`grouping-story.css` (commit `a1b96fc`).

**Tracked, not blocking:** C3 (S4 signal + group-aware expand/collapse verb, OQ-3) — Step 5 ships
an honest regression until it lands. C4 (issue #60 steps 5–6). C5 (null/empty group-key policy,
S7/OQ-5) — Step 4 carries it as a regression demo.

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
