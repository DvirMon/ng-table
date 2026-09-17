# Implementation Progress — table-owned-filtering (`#123`)

**Epic:** [#123](https://github.com/DvirMon/acme/issues/123)
**Status:** 0 / 6 complete

Steps 1–6 cover [`#124`](https://github.com/DvirMon/acme/issues/124) — spec steps 1–6, one PR.
Nothing outside `src/filters/`, `src/api/features/with-filtering.ts` and `src/index.ts` changes.
**This issue does not stay green on its own**: call sites break at Step 5 and migrate in `#125`.
Issues `#125`–`#127` get their own plans and continue the step numbering.

## `#124` — `withFiltering` owns the filter model · PR 1 of 1

| Step | Title | Type | Status | PR |
|---|---|---|---|---|
| 1 | [`when` moves into `FilterOptions`; `applyWhen` deleted](step-1-when-in-filter-options.plan.md) | `code` | ✅ done | — |
| 2 | [Object-literal schema; delete the key-derivation layer](step-2-object-literal-schema.plan.md) | `code` | ✅ done | — |
| 3 | [`withFiltering(config, schema)` owns the model; carrier deleted](step-3-with-filtering-owns-model.plan.md) | `code` | ✅ done | — |
| 4 | [Member audit: `matcher()`/`dirty()` internal, `predicates` deleted](step-4-member-audit.plan.md) | `code` | ✅ done | — |
| 5 | [Barrels: drop the standalone surface, add `FiltersPath`](step-5-barrels.plan.md) | `code` | ✅ done | — |
| 6 | [Rewrite the compile-time probe for `StateOf` inference](step-6-inference-probe.plan.md) | `test` | ✅ done | — |

Status values: `⬚ pending`, `▶ in progress`, `✅ done`, `⏭ skipped`.

## Dependency graph

```
1 ──> 2 ──> 3 ──> 4 ──> 5 ──> 6
```

- **Parallel-safe:** none. Stated plainly rather than claimed — see below.
- **Dependency:** `1 → 2` (an object literal has nowhere to put an `applyWhen` node, so the gate
  must move onto rule options while the array schema still exists); `2 → 3` (the feature's
  `schema: (path) => S` signature is only expressible once `S` is an object of rules);
  `3 → 4` (`predicates` cannot be deleted before the owned matcher replaces it); `4 → 5` (a barrel
  states a surface, and the surface is not settled until the member audit lands); `5 → 6` (the probe
  imports through the barrel it is asserting).
- **Frontier at start:** `[1]`.

## Notes carried from planning

- **The spec's graph is a discussion ordering, not an execution one.** `spec.md` marks `[3,4,5]`
  parallel-safe after `1–2`; at file grain they are not. Spec steps 2, 3 and 4 all rewrite
  `types.ts`, and spec 2's `flattenRules` rewrite collides with spec 3's conditional branch inside
  the same function. Re-mapped per `dependency-task-graph`; claimed parallelism here would be false.
- **Spec steps 3 and 2 are swapped.** `when` lands first. Ordering object-schema before `when`
  produces an intermediate where `applyWhen` returns a node with no object key to be keyed by.
- **Spec steps 1 and 4 are merged into Step 3.** "`TRow` is `RowOf<In>`" and "delete the carrier"
  are the same edit from two sides — `rowOf()` exists only because `createFilters` had no table to
  ask. Split, Step 1 would ship a builder taking a `rows` anchor it no longer reads.
- **Step 3 carries the one real open question**: `withFiltering` already has a trailing
  `derive: Feature<NoInfer<In>, D>` overload, and adding `schema` creates two 2-argument forms. The
  step says to decide explicitly and flag it, not guess.
- **Step 3 drops the builder's injection plumbing.** `createTable` already composes inside the
  owner's injection context (`api/create-table.ts:53`), so the builder's `inject(Injector)` +
  `runInInjectionContext` is redundant.
- **`ngc` aborts before the template phase on a `.ts` error.** Every acceptance check says run
  twice; only the second, source-clean run says anything about templates.
- **Step 6 is `test`, not part of Step 5.** `/implement` routes on `Task type`, and folding the probe
  into a `code` step means the testing conventions never load.
- Unchanged throughout, by decision: criterion semantics, `source` defaults and the late-default
  race, the null-cell policy, ADR-0014 per-filter/per-evaluation degradation, `anyOf` OR semantics
  and its homogeneous-criterion compile check, the duplicate-**path** throw, and
  `form(filters().value, schema)` binding with no adapter.
- **Not in this issue:** relocating `src/filters/` into `api/features/with-filtering/` +
  `engine/filters/` (spec step 10) — deliberately last so a churning rename does not inflate every
  other diff.
