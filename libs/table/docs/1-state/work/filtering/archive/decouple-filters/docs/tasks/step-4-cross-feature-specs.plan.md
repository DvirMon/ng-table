# Step 4 — Cross-feature specs narrow with bare predicates

**PR scope:** one PR. Parallel-safe with Step 1, Step 2, Step 3.
**Task type:** `test`
**Stack:** angular
**Skills used:** `unit-test`
**Scaffolding agent:** `test-implementer`

## Files

| File                                                         | Sites                                                                                        | Action |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------ |
| `libs/shared/table/src/api/features/selection.utils.spec.ts` | helpers `:22-35`, cases `:41`, `:54`                                                         | edit   |
| `libs/shared/table/src/api/features/with-grouping.spec.ts`   | schemas `:194`, `:476`, `:522`, `:849`; compose sites `:208`, `:489`, `:535`, `:863`, `:875` | edit   |

## Why This Step Exists

Neither of these files is testing filtering. Both declare whole `createFilters()` schemas purely to
narrow some rows before asserting something else entirely — selection scope in one, pipeline order
and group aggregates in the other. That is a spec asserting a domain it does not own, and it makes
both files longer and more fragile than the thing they actually cover.

A bare predicate narrows identically with no schema, no criterion signal and no imports from the
filters domain.

## What To Do

### `selection.utils.spec.ts`

Replace `buildFilters` (`:23`) and `makeFilteredStore` (`:27`) with one helper that composes a
predicate directly:

```ts
function makeFilteredStore(): TableStore<MockRow> {
  return inContext(() =>
    createTable(
      signal<MockRow[]>(mockRows),
      { trackBy: mockTrackBy, columns: makeColumns() },
      withFiltering({ predicates: () => [(row: MockRow) => row.id === 1] }),
    ),
  );
}
```

Both cases (`:38`, `:53`) then drop their `buildFilters(...)` line and their
`filters['id']().value.set(1)` line — the narrowing is now fixed at composition, which is all
either case ever needed. The sanity assertions at `:47-48` stay; they are what prove `rows()` is a
strict subset of `value()` before `selectAllIds` is asserted on.

Drop the now-dead imports: `createFilters` (`:4`), `equals` (`:6`), and the `Filters` /
`FiltersPath` type import (`:11`). Delete the comment at `:22` (it points at
`with-filtering.spec.ts`'s `buildFilters`, which Step 3 may also remove) and the comment at
`:39-40` about `Function.prototype.name`, which stops applying once no filter object exists.

### `with-grouping.spec.ts`

Four `createFilters()` declarations, each wrapping the same rule — `filter(path.amount, (cell, criterion) => cell !== criterion, …)`
driven by `filters['amount']().value.set(300)` (or `40` at `:510`). Each collapses to one term:

```ts
withFiltering({ predicates: () => [(row: GroupingMockRow) => row.amount !== 300] });
```

Apply per site:

| Declaration | Compose site(s) | Criterion set at | Predicate            |
| ----------- | --------------- | ---------------- | -------------------- |
| `:194`      | `:208`          | `:213` → 300     | `row.amount !== 300` |
| `:476`      | `:489`          | `:510` → 40      | `row.amount !== 40`  |
| `:522`      | `:535`          | `:540` → 300     | `row.amount !== 300` |
| `:849`      | `:863`, `:875`  | `:879` → 300     | `row.amount !== 300` |

The `:849` declaration feeds **two** stores built in the same case (`filterGroupSort` and
`sortGroupFilter`, proving argument order does not change pipeline order). Give each its own
`withFiltering({ predicates: … })`, or hoist one shared `const amountPredicate = (row: GroupingMockRow) => row.amount !== 300`
and pass it to both — the second reads better and keeps the two stores provably identical.

Delete the `createFilters` import (`:9`) and the `filter` rule import (`:11`) once no site uses
them. Keep the inline comments that explain _which row the filter drops_ (`:213`, `:540`, `:879`) —
they are what make the aggregate assertions readable; rewrite them to name the predicate rather
than the criterion.

## Implementation Notes

- **The narrowing must stay identical.** The old rule is `cell !== criterion` with the criterion set
  after construction, so rows whose `amount` equals the criterion are dropped. The predicate spells
  the same thing directly. Assert the same row ids come back — if a case's expectations change, the
  predicate is wrong, not the expectations.
- The old schemas set their criterion _after_ the store was built, exercising reactivity the
  grouping spec never cared about. Fixing the predicate at composition removes a timing detail
  these cases were never testing; no case relies on the pre-set-criterion state, so no assertion
  needs a new position.
- Keep `withFiltering`'s argument position in each `createTable()` call exactly as it is —
  `:863` / `:875` deliberately differ in order, and that difference _is_ the test.

## Risks / Watchouts

- `:510` sets `40`, not `300`. Copy-pasting the 300 predicate into that case silently changes what
  the grouping assertions are measuring, and the case may still pass for the wrong rows.
- `selection.utils.spec.ts` filters on `id`, not `name`. Keep the field.
- `mockRows` / `mockGroupingRows` are shared fixtures — do not edit them to make a predicate
  simpler.

## Non-Goals

- Changing any grouping, sorting or selection assertion.
- Touching `with-filtering.spec.ts` (Step 3) or `create-filters.spec.ts` (Step 2).
- Adding filtering coverage to either file — both should end up testing _less_ of filtering, not
  more.

## Acceptance Checks

- [ ] Neither file imports `createFilters`, `equals`, `filter`, `Filters` or `FiltersPath`
- [ ] Every `withFiltering(...)` in both files takes `predicates`
- [ ] All grouping, pipeline-order and selection assertions are byte-identical to before
- [ ] Both files are shorter than they were
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` is clean
- [ ] `npx nx test shared-table` passes for both files

---

← [Step 3: Split the feature spec by ownership](step-3-split-feature-spec.plan.md) | [Step 5: Update the prose describing the old config shape](step-5-update-prose.plan.md) →
