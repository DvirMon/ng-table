# Implementation Progress — Table: convert withSelection, withExpansion to the Feature<In, Out> contract

**Issue:** #39
**Status:** 4 / 4 complete

| Step | Title                                                                                                          | Status  | PR  |
| ---- | -------------------------------------------------------------------------------------------------------------- | ------- | --- |
| 1    | with-selection.ts: `withSelection<In>(config?, derive?)`, F-bounded input                                      | ✅ done | —   |
| 2    | with-expansion.ts: `withExpansion<In>(config?, derive?)`, F-bounded input                                      | ✅ done | —   |
| 3    | with-selection.spec.ts + selection.utils.spec.ts: positional, `hiddenSelected`, reconciliation                 | ✅ done | —   |
| 4    | with-expansion.spec.ts: positional, typed predicates, trailing block; strip interim args in with-grouping.spec | ✅ done | —   |

Graph: `1 → 3`, `2 → 4` (4 also touches with-grouping.spec for Step 1's `withSelection<>` strip).
Parallel-safe: `[1, 2]`; `[3, 4]` after their code steps. Dependency: `1 → 3`, `2 → 4`.

```
  1 ──── 3
  2 ──── 4
```

Typing mechanism verified by probe: `../../../probe-r5-feature-conversion.ts.txt` (cases 1–3, 10
are selection). Cross-issue: Step 3's specs compose `withSorting()`/`withFiltering()` (#38);
with-grouping.spec (#38 Step 6) composes this issue's features — interim explicit type args on
those calls are marked `// #7N strips the type argument` and removed by the owning issue.
Docs are #44.

## Step 4 — `with-grouping.spec.ts` strip deferred to #38

#38 has not landed: `with-grouping.spec.ts` is still the pre-migration array-form spec and carries
no `// #39 strips` markers, so there was nothing to strip. Its `withExpansion<`/`withSelection<`
type arguments go away when #38 Step 6 rewrites that file. Step 4's second acceptance box stays
unticked here and is #38's to satisfy.

## Step 3 — `selection.utils.spec.ts` carries a cast until #38 lands

`withSorting()` structurally satisfies a slot unchanged (its `SortingInput` only picks `columns`,
which `TableStore` has), so `with-selection.spec.ts` needed only the interim
`withSorting<MockRow>()` type argument. `withFiltering()` does **not**: its parameter is the full
internal `TableCore<TRow>`, which needs `baseColumns`. `selection.utils.spec.ts` bridges it in one
helper (`makeFilteredStore`) with a local `CreateTableVariadic` view and a single
`as unknown as AnyTableFeature` — the same static/dynamic seam `compose-features.spec.ts` already
bridges. Both the cast and the `<MockRow>` arguments go when #38 converts `withFiltering()`;
the `// #38 strips the type argument` markers locate them.

## /code-review outcome (applied)

Standards axis, fixed in place: relative import groups alphabetized in all four feature files;
the `probe case 11` narration replaced with what the annotation actually does (no task-plan
reference in source); overload-implementation params renamed `a`/`b` → `configOrDerive`/
`maybeDerive`; `inContext`'s JSDoc no longer claims to mirror files that don't define it;
`editing-state.ts`'s header no longer implies the two features share one store when composed
(composing both throws).

Standards axis, **not** applied — needs its own issue: the six-line overload-dispatch prologue
(`isDeriveFirst` → `config`/`derive` → ternary → `Object.assign(displayName)`) is verbatim in
`withSelection`, `withExpansion`, `withRowEdit` and near-verbatim in `withOptimistic`. One
`defineFeature(displayName, factory, derive?)` in `create-table-feature.ts` absorbs all four.
Out of scope for #39/#74 — both plans specify the current shape literally.
