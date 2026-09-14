# Implementation Progress — Filtering stories

**Plan:** [`../../1-gap-analysis.md`](../../1-gap-analysis.md)
**Issue:** — (no tracked issue; the gap analysis is the spec)
**Status:** 6 / 10 complete (Steps 7–10 are the held-back merged docs pass)

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | `filtering/fixtures/filters.ts` — `createFilters()` factories (A) | ✅ done | — |
| 2 | `filtering/fixtures/schema.ts` — configs + `filterFormSchema` (A) | ✅ done | — |
| 3 | `filtering/fixtures/handlers.ts` + `http.ts` (A) | ✅ done | — |
| 4 | `client-filtering/` (B) | ✅ done | — |
| 5 | `server-filtering/` (C) | ✅ done | — |
| 6 | `selection-filtering/` (D) — **cross-plan blocker** | ✅ done | — |
| 7 | `1-state/filters.md` code status + `status.md` (E) | ⬚ pending | — |
| 8 | `3-ui/architecture.md` U5 method names (G) | ⬚ pending | — |
| 9 | `0-product/filtering.md` coverage marks (F) | ⬚ pending | — |
| 10 | `3-ui/stories.md` registration (I) | ⬚ pending | — |

**Parallel-safe:** [1, 3, 7, 8] start now; 2 ← 1; [4, 5, 6] once their fixture deps land (4 ← 1+2,
5 ← 1+2+3, 6 ← 1+2); [9, 10] ← 4+5+6.

**Cross-plan edge:** `selection-stories/` Step 4 (coverage marks) cannot flip §1.4 / §2.3 / §2.4 /
§2.5 until **Step 6** here renders.

## Post-implementation revision (2026-09-14)

Steps 1–6 shipped, then were **reworked in review**. The plan's layout for node A is superseded;
what is in `src/` now is authoritative. Review:
[`../../2-review-criterion-control.md`](../../2-review-criterion-control.md).

| Change | Effect on this plan |
|---|---|
| `fixtures/filters.ts` **deleted**; each host declares its own `createFilters<TRow, TState>()` inline | Step 1's artifact no longer exists; Steps 4–6 own their declarations |
| `TState` supplied per story (`fixtures/types.ts`) | Removed the `CriterionControl` wrapper and all six `as*` narrowers Step 4 had introduced |
| Signal Forms bound to the criterion model (`form(filters().value)`) | Step 5's separate `searchModel` + sync effect deleted; `filterFormSchema` → `serverFilterFormSchema`, applied to the filter model |

Three library gaps were fixed to make the above possible — root `value` is now a
`WritableSignal`, `withFiltering()` carries `TState`, and `reset()` takes a `Partial<TState>`.
None of them were anticipated by this plan.

**Already done before this plan (re-derived from `src/` 2026-09-13):** `fixtures/types.ts`,
`fixtures/mock.ts` and `filtering-story.css` (commit `a1b96fc` — including the active-marker and
summary-row styling node A called for).

**Parked, never upstream:** node H (hidden-selection read-side count signal), owned by
`1-state/work/computed-state-mechanism/`. Step 6 ships without it and its notice is deleted when H
lands.

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
