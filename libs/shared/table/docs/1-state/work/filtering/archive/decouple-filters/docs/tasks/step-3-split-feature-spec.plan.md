# Step 3 — Split `with-filtering.spec.ts` by ownership

**PR scope:** one PR. **Depends on: Step 2.** Parallel-safe with Step 1, Step 4.
**Task type:** `test`
**Stack:** angular
**Skills used:** `unit-test`
**Scaffolding agent:** `test-implementer`

## Files

| File | Action |
|---|---|
| `libs/shared/table/src/api/features/with-filtering.spec.ts` | rewrite in place — never deleted |

## Why This Step Exists

Reading a test file should tell you which domain it belongs to. Today the feature's spec asserts
facts about the *filter model* — OR within an `anyOf` group, empty-criterion skipping, a throwing
filter record, the criterion map's typing, and whether a mismatched row type is accepted — none of
which is table behavior. A test that builds a filter schema in order to check table behavior is the
exact defect this issue removes.

Every case named for deletion below already has a home: Step 2 moved the criterion-map typing, and
`create-filters.spec.ts` already owned the rest before this issue started. Nothing loses coverage;
the file is not deleted.

## What To Do

Rewrite the file so it asserts **table behavior only**, plus exactly one integration case.

### Keep — promoted from `describe('a predicate list')` to top level

The block at `:232-426` already covers the table's contract on predicates. Lift its cases to the
top level of `describe('withFiltering')`, since they stop being "the other input" and become the
only input the feature is tested through:

| Case | Now at | Covers |
|---|---|---|
| narrows `rows()` with a plain predicate | `:233` | composition + narrowing |
| combines separate terms with AND | `:245` | AND across terms |
| recomputes when a signal read in the thunk changes | `:262` | reactivity |
| calls the thunk once per pass, not once per row | `:284` | one call = one evaluation |
| contributes no members | `:298` | member surface |
| trailing block sees post-predicate rows | `:311` | stage ordering |
| manual mode never calls the thunk | `:351` | `manual` |
| a throwing term is dropped, sibling narrows | `:368` | per-term degradation |
| a term throwing on a later row is dropped from the whole pass | `:397` | catch unit is the term |

Add the one case the current file lacks on the predicate path: **composes into `createTable()` with
`Row` inferred from the data slot** (the predicate twin of `:59`), and **never narrows while the
term list is empty** — `:303` already composes `predicates: () => []`; make its assertion the
no-op one if it is not already.

### Delete — filter-model behavior, already covered elsewhere

| Delete | At | Already covered by |
|---|---|---|
| composes into `createTable()` via `{ filters }` | `:59` | replaced by its predicate twin above |
| narrows via an active filter | `:72` | `create-filters.spec.ts:541` |
| combines separate filters with AND | `:87` | `create-filters.spec.ts:602` |
| ORs siblings within one `anyOf` group | `:106` | `create-filters.spec.ts:587` |
| never narrows while every criterion is empty | `:126` | `create-filters.spec.ts:575` |
| contributes no members (filter-model build) | `:142` | predicate twin at `:298` |
| manual mode with a filter model | `:157` | predicate twin at `:351` |
| a throwing *filter* deactivates only that filter | `:177` | `create-filters.spec.ts:415`, `:460` |
| trailing block sees post-filter rows (filter model) | `:212` | predicate twin at `:311` |
| `describe('a concretely-typed Filters')` | `:515-552` | moved in Step 2 |

### Delete — type assertions that are filter-model facts

| Delete | At | Reason |
|---|---|---|
| `withFiltering({ filters })` contributes `{}` | `:435` | replace with the predicate form; the store-type fact is the table's, the `{ filters }` spelling is not |
| `filters: TRow is consumed — a Filters<OtherRow> is rejected` | `:451` | `create-filters.spec.ts:709` owns row-type rejection |
| `either input alone is accepted` | `:466` | asserts the transitional two-field config; `#105` deletes one of the two fields |

Keep `trailing block: withComputed adds visibleCount …` (`:488`), rewritten to `predicates`.

### Keep — exactly one integration case

`:335` (`ANDs the filter model with the predicate terms when both are supplied`) becomes the single
seam test, rewritten to compose **through the wiring expression** rather than through the old
field:

```ts
it('composes with a filter model through matcher()', () => {
  const filters = buildFilters((path) => equals(path.status));
  const store = inContext(() =>
    createTable(
      signal<Row[]>(makeRows()),
      { trackBy: 'id', columns: makeColumns() },
      withFiltering({ predicates: () => [filters().matcher(), (row: Row) => row.category === 'b'] })
    )
  );

  filters['status']().value.set('open');

  expect(store.rows().map((row) => row.id)).toEqual(['r3']);
});
```

One case, not a suite. Its purpose is to prove the wiring expression works — not to re-test either
side through the other.

### Prune the file's imports and helpers

Once the above lands, `buildOtherFilters` (`:49`) and the `OtherRow` interface (`:19`) have no
callers — delete both, along with the `anyOf` / `contains` / `filter` rule imports and the
`FiltersPath` type import if nothing else uses them. `createFilters`, `equals`, `Filters` and
`buildFilters` (`:45`) survive **only** to serve the one integration case; the comment at `:40-44`
that points at the "concretely-typed Filters" block must be deleted or rewritten, since that block
is gone.

## Implementation Notes

- Order the final file: composition → narrowing → AND → no-op → members → reactivity → one-call-per-pass
  → trailing block → `describe('manual mode')` → `describe('errors')` → the integration case →
  `describe('types')`. Flat, with the two sub-describes the current file already uses.
- Keep the type-assertion banner comment (`:428-433`) — it is still the only place stating that
  `expectTypeOf` is enforced by `tsc`, not by the executor.
- Do not rename surviving cases beyond dropping "predicate list" scoping words made redundant by
  the promotion; a diff that renames everything hides what actually moved.
- The `filters` config field still exists through this issue. The build stays green whether or not
  a stray reference survives — so the grep in Acceptance Checks, not the compiler, is what proves
  this step done.

## Risks / Watchouts

- **Silent coverage loss is the whole risk here.** Before deleting each filter-model case, confirm
  the named replacement exists at the cited line in `create-filters.spec.ts` — that file has moved
  under this branch and line numbers drift.
- `filters['status']` uses bracket access deliberately: `filters` is callable, so `filters['name']`
  would collide with `Function.prototype.name`. Preserve that in the integration case.
- Deleting `buildOtherFilters` while a `@ts-expect-error` still references its result turns the
  directive into an *unused* `@ts-expect-error`, which is itself a type error. Delete the case and
  the helper in the same pass.

## Non-Goals

- Deleting the file, or deleting `create-filters.spec.ts`'s existing cases.
- Removing the `filters` field from `WithFilteringConfig` — `#105`.
- Touching `api/filters/matchers.spec.ts` or `api/filters/state.spec.ts`.
- Adding a second integration case, however tempting the AND-across-both shape is.

## Acceptance Checks

- [ ] `with-filtering.spec.ts` builds no `createFilters()` schema except in the one integration case
- [ ] No filter-model type facts remain in it — no `Filters<OtherRow>`, no criterion-map typing
- [ ] Exactly one integration case, composing through `predicates: () => [filters().matcher()]`
- [ ] Every case listed under "Delete" has its named replacement verified present elsewhere
- [ ] No unused imports, helpers, or `@ts-expect-error` directives remain
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` is clean
- [ ] `npx nx test shared-table` passes

---
← [Step 2: Move the criterion-map typing assertions](step-2-move-criterion-map-typing.plan.md) | [Step 4: Cross-feature specs narrow with bare predicates](step-4-cross-feature-specs.plan.md) →
