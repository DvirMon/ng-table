# Step 7 — Delete the coupled filtering surface and the filters side channel

**PR scope:** PR 1 of 3 (`#71`). **Depends on: Step 6.** **Blocks Step 8, Step 9.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `angular-developer`, `typescript-conventions`
**Scaffolding agent:** `angular-implementer`

## Files

| File                                                   | Line                       | Action                                                                     |
| ------------------------------------------------------ | -------------------------- | -------------------------------------------------------------------------- |
| `libs/shared/table/src/api/features/with-filtering.ts` | `:2`, `:4`                 | delete — both filters-domain imports                                       |
| `libs/shared/table/src/api/features/with-filtering.ts` | `:9-23`                    | edit — `WithFilteringConfig<TRow>`; drop `TState` and `filters`            |
| `libs/shared/table/src/api/features/with-filtering.ts` | `:25-31`                   | delete — `applyFilterModel`                                                |
| `libs/shared/table/src/api/features/with-filtering.ts` | `:68-82`                   | edit — drop `TState` from both overloads                                   |
| `libs/shared/table/src/api/features/with-filtering.ts` | `:88-99`                   | edit — stage body applies terms only                                       |
| `libs/shared/table/src/api/filters/evaluator.ts`       | `:4-6`, `:14-21`, `:23-26` | delete — `FILTERS_INTERNAL`, `attachFiltersInternal`, `getFiltersInternal` |
| `libs/shared/table/src/api/filters/evaluator.ts`       | `:104-112`                 | delete — `createFilterEvaluator`                                           |
| `libs/shared/table/src/api/filters/evaluator.ts`       | `:114-120`                 | edit — `createFilterEvaluatorFrom` doc comment                             |
| `libs/shared/table/src/api/create-filters.ts`          | `:2`                       | edit — drop `attachFiltersInternal` from the import                        |
| `libs/shared/table/src/api/create-filters.ts`          | `:8`                       | delete — the `createFilterEvaluator` re-export                             |
| `libs/shared/table/src/api/create-filters.ts`          | `:72`                      | delete — the `attachFiltersInternal(filters, internal)` call               |

## Why This Step Exists

This is the contract half of expand–contract. `#68`–`#70` added `matcher()`, added `predicates`,
and migrated every caller. The old surface now has no consumers, and until it is deleted the
decoupling is a convention rather than a fact.

Two deletions, one in each direction:

- **Table side** — the feature stops naming a filter type. Removing the criterion-map type
  parameter also removes the two undiscoverable call-site rules it carried (`TState` had to be a
  `type` and not an `interface`; `In` must never be passed explicitly). Neither was diagnosable —
  the compile error named neither cause — and after this step neither can be violated, because
  there is nothing left to pass.
- **Filters side** — the symbol-based side channel goes. `createFilterEvaluatorFrom` takes the
  compiled state directly and is the only entry point left, private to the domain.

## What To Do

**`with-filtering.ts`:**

1. Delete the imports at `:2` (`createFilterEvaluator`) and `:4` (`type Filters`).
2. Collapse the config to the target shape — the doc comment at `:9-16` goes with the type
   parameter it explains:
   ```ts
   export interface WithFilteringConfig<TRow> {
     /** One call = one evaluation. Terms AND'd; a term that throws is dropped for that pass. */
     predicates: () => readonly ((row: TRow) => boolean)[];
     manual?: boolean;
   }
   ```
   `predicates` becomes **required** — with `filters` gone it is the feature's only input, and an
   optional sole input means composing the feature to do nothing.
3. Delete `applyFilterModel` (`:25-31`).
4. Drop `TState` from both overload signatures (`:68-72`, `:73-82`), leaving `In` on the first and
   `In, D` on the second.
5. Simplify the stage body to `applyPredicateTerms(rows, config.predicates())` under the existing
   `manual` guard.

**`evaluator.ts`:** delete the symbol, both accessors, and `createFilterEvaluator`. Rewrite the
`createFilterEvaluatorFrom` doc comment — its current text (`"the path FiltersRoot.matcher() takes,
rather than through a built Filters object"`) contrasts it with an overload that will no longer
exist. State plainly that it is the domain's only evaluator entry point and is not exported past
the domain.

**`create-filters.ts`:** drop `attachFiltersInternal` from the `:2` import (keep
`buildValueOfContext` and `type FiltersInternal`), delete the `:8` re-export, and delete the
`:72` call. `buildFiltersObject(internal)` at `:71` already carries everything the root needs.

## Implementation Notes

- `index.ts:13` is `export * from './api/features/with-filtering'` — no barrel edit is needed here,
  and `WithFilteringConfig<TRow>` stays exported under the same name with one fewer parameter.
- Removing a defaulted type parameter is not source-breaking for callers who never passed it, and
  no caller does — `#70` verified the inventory. It **is** a public API change and Step 8 records
  it.
- Keep `applyPredicateTerms` and `reportPredicateError` exactly as they are. The per-term catch
  unit is settled (ADR-0014, and restated in ADR-0016); this step deletes, it does not redesign.
- `FiltersInternal<TRow>` stays exported from `evaluator.ts` — `state.ts:16` and `create-filters.ts`
  both import the type. It is domain-internal because nothing outside the domain imports it, not
  because the `export` keyword is removed.

## Risks / Watchouts

- **`Filters` may still be referenced elsewhere in the feature folder.** Grep
  `src/api/features/` for `filters.types` before assuming `with-filtering.ts` is the only site.
- **`matcher()` must not regress.** `state.ts:194` calls `createFilterEvaluatorFrom(internal)` —
  that call site is the one path through the evaluator that survives. If the whole evaluator file
  is pruned too aggressively, `matcher()` breaks and every filtering story goes silently
  unfiltered.
- The story hosts and specs already pass `predicates`, so making it required should produce zero
  errors. If `tsc` reports one, a caller was missed in `#70` — fix the caller, do not re-widen
  the field back to optional.

## Non-Goals

- Moving any file — Step 9 owns the relocation.
- Writing ADR-0016 — Step 8.
- Changing evaluation semantics: emptiness skipping, conditional gating, OR within a group, AND
  across filters, the null-cell policy and per-filter dedup all stay byte-for-byte.
- Touching `docs/` — PR 3 owns every document.

## Acceptance Checks

- [ ] `WithFilteringConfig` exposes only `predicates` and `manual`
- [ ] `with-filtering.ts` imports nothing from the filters domain — verifiable by reading its import list
- [ ] No criterion-map type parameter on the config interface or on either overload
- [ ] `FILTERS_INTERNAL`, `attachFiltersInternal`, `getFiltersInternal` and `createFilterEvaluator` do not exist anywhere in `src/`
- [ ] `createFilterEvaluatorFrom` is not re-exported from `create-filters.ts` and is absent from `index.ts`
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` and `…/tsconfig.spec.json --noEmit` are clean
- [ ] `npx nx test shared-table` passes
- [ ] Filtering stories behave identically — client, server, predicate, selection and both grouping hosts

---

← [Step 6: Migrate `create-filters.spec.ts` off `createFilterEvaluator(filters)`](step-6-migrate-evaluator-spec-to-matcher.plan.md) | [Step 8: ADR-0016](step-8-adr-0016.plan.md) →
