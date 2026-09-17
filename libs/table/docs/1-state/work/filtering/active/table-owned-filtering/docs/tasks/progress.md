# Implementation Progress — table-owned-filtering (`#89`)

**Epic:** [#89](https://github.com/DvirMon/ng-table/issues/89)
**Status:** 11 / 11 complete

Steps 1–6 cover [`#90`](https://github.com/DvirMon/ng-table/issues/90) — spec steps 1–6, one PR.
Nothing outside `src/filters/`, `src/api/features/with-filtering.ts` and `src/index.ts` changes.
**That issue does not stay green on its own**: call sites break at Step 5 and migrate in `#91`.
Steps 7–11 cover [`#91`](https://github.com/DvirMon/ng-table/issues/91) — spec steps 7–8, one PR.
Issues `#92`–`#93` get their own plans and continue the step numbering.

## `#90` — `withFiltering` owns the filter model · PR 1 of 1

| Step | Title | Type | Status | PR |
|---|---|---|---|---|
| 1 | [`when` moves into `FilterOptions`; `applyWhen` deleted](step-1-when-in-filter-options.plan.md) | `code` | ✅ done | — |
| 2 | [Object-literal schema; delete the key-derivation layer](step-2-object-literal-schema.plan.md) | `code` | ✅ done | — |
| 3 | [`withFiltering(config, schema)` owns the model; carrier deleted](step-3-with-filtering-owns-model.plan.md) | `code` | ✅ done | — |
| 4 | [Member audit: `matcher()`/`dirty()` internal, `predicates` deleted](step-4-member-audit.plan.md) | `code` | ✅ done | — |
| 5 | [Barrels: drop the standalone surface, add `FiltersPath`](step-5-barrels.plan.md) | `code` | ✅ done | — |
| 6 | [Rewrite the compile-time probe for `StateOf` inference](step-6-inference-probe.plan.md) | `test` | ✅ done | — |

## `#91` — Migrate every filtering call site and spec · PR 1 of 1

| Step | Title | Type | Status | PR |
|---|---|---|---|---|
| 7 | [Client-filtering host takes the owned model](step-7-client-filtering-host.plan.md) | `code` | ✅ done | — |
| 8 | [Server-filtering host: the filters move into the table](step-8-server-filtering-host.plan.md) | `code` | ✅ done | — |
| 9 | [Remaining call sites; delete the predicate story](step-9-remaining-call-sites.plan.md) | `code` | ✅ done | — |
| 10 | [Migrate `state.spec.ts`, rewrite `with-filtering.spec.ts`](step-10-specs.plan.md) | `test` | ✅ done | — |
| 11 | [`filtering.mdx` prose and the green gate](step-11-mdx-and-green-gate.plan.md) | `docs` | ✅ done | — |

Status values: `⬚ pending`, `▶ in progress`, `✅ done`, `⏭ skipped`.

## Dependency graph — `#91`

```
 7 ─┐
 8 ─┼──> 11
 9 ─┘
10      (no edge)
```

- **Parallel-safe:** `[7, 8, 9, 10]` — disjoint file sets, all on the frontier at start.
- **Dependency:** `[7,8,9] → 11`. One MDX file describes all three filtering stories; four steps
  editing it is a merge conflict, not a graph edge. Step 11 also carries the whole-lib gate, which
  cannot pass until every call site has landed.
- **Frontier at start:** `[7, 8, 9, 10]`.

## Notes carried from planning — `#91`

- **`schema` nests inside config.** `#91`'s body shows `withFiltering(config, schema)`. What `#90`
  actually shipped is `withFiltering({ manual: true, schema })` — `with-filtering.ts:7-19`. Every
  step file uses the shipped form.
- **Three items in the issue's spec list are already done**, verified against the tree:
  `create-filters.types.spec.ts` was rewritten as `api/features/with-filtering.types.spec.ts` by
  Step 6; `create-filters.spec.ts` is already on `buildFilterModel` + object schema; the server host
  already uses `rxResource` with no `effect`/`untracked` loop. What is left in `#91` is the
  ownership move, not the loop unwind the body describes.
- **Two call sites the issue's list omits**, found by grep: `stories/grouping/grouping-selection/`
  composes `withFiltering({ predicates })` and reaches the model through
  `grouping/fixtures/utils.ts`; the issue's "`selection-filtering/`" is
  `stories/selection/filtering-selection/`.
- **Two silent breakages, not migrations.** `filter-report-log.ts` matches `'[createFilters]'` while
  `evaluator.ts:29` now emits `'[withFiltering]'`, so the client story's ADR-0014 panel renders
  empty while appearing to work (Step 7). `server-filtering-toolbar.component.ts:36` calls
  `.dirty()`, now `@internal` (Step 8).
- **The predicate story is deleted, not rewritten.** Decided by the user. R54's replacement —
  express a scope by narrowing the rows signal — therefore ships with no demo, and `#92` picks up
  the coverage mark in `docs/0-product/filtering.md` and the reference in `docs/3-ui/stories.md`.
- **Steps 9 and 3–5 of `#90` were merged on the user's call** (coarser grain): selection,
  composition and grouping call sites plus the deletion are one step, because their "What To Do" is
  the same three lines four times over.
- **The lib is red for the whole issue until Step 11.** No step in `#91` leaves the tree compiling
  on its own — the acceptance is a gate, not a per-step property. Steps 7–10 each verify only that
  no error originates in their own files.
- **`StateOf` stays off the public barrel.** Stories import it from `filters/types`, as
  `grouping/fixtures/utils.ts` already does for `FilterNode`. The barrel is `#90` Step 5's settled
  surface; widening it is not this issue's call.
- **`dirty()` is `@internal`, not deleted.** It is still on `FiltersRoot`, so `state.spec.ts` keeps
  its source-reconciliation case; only the story stops reading it.
- **Uncommitted grouping work is in the tree** (`with-grouping.ts`, `engine/grouping.ts`,
  `with-grouping.spec.ts`, the `grouping-static` story host). Step 9 touches `grouping/fixtures/`
  and `grouping-selection/` only — no overlap, but rebase before starting.
- **Not in this issue:** every doc under `libs/table/docs/` (`#92`) and relocating
  `src/filters/` into `api/features/with-filtering/` + `engine/filters/` (`#93`).
