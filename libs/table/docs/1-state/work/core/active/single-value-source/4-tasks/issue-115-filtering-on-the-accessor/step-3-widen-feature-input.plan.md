# Step 3 — Widen `withFiltering`'s input and check ids at construction

**PR scope:** standalone, and **breaking** on the feature's own
contract. **Depends on:** Step 1 (types), Step 2 (`buildFilterModel`'s
columns getter).

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/features/with-filtering/feature.ts` (edit)

## Why This Step Exists

`withFiltering<In extends Shape>` sees rows only; its `_input` is unused.
Grouping already takes `Pick<TableStore, 'columns' | 'rows'>`
(`with-grouping/feature.ts:41`). Filtering must widen the same way to
resolve an accessor and to recover the value map for `path`.

## What To Do

**1. The input slice** — copy grouping's shape and its comment on why
`ColumnValuesOf<In>` and not `Record<ColumnIdOf<In>, unknown>` (the
latter self-references under the F-bound):

```ts
type FilteringInput<In> = Pick<TableStore<RowOf<In>, ColumnValuesOf<In>>, 'columns' | 'rows'>;
```

**2. Config and all four overloads** take the map:

```ts
export interface WithFilteringConfig<
  TRow,
  TValues extends ColumnValueMap,
  S extends Record<string, AnyRule> = {},
> {
  manual?: boolean;
  schema?: (path: FiltersPath<TRow, TValues>) => S;
}
```

Every overload becomes `<In extends FilteringInput<In>, …>` with
`WithFilteringConfig<RowOf<In>, ColumnValuesOf<In>, S>`. Keep the
`derive` overloads' `NoInfer<In>` exactly as they are.

**3. Factory** — extract a `buildFilteringSpec(input, config)` like
`buildGroupingSpec`:

- `buildFilterModel(schemaFn, () => input.columns())`
- then `assertDeclarationsAreKnown(<every recorded path>,
input.columns().map((c) => c.id), 'withFiltering')`. Paths come off
  the built model's records (`pathsOf`), so `anyOf` children are checked
  too. The check is dev-gated inside its own body — do not gate at the
  call site.

The `filter` stage body is unchanged.

## Implementation Notes

- `WithFilteringConfig` is exported through `with-filtering/index.ts`;
  its new required `TValues` parameter is a public break, recorded in
  Step 8.
- The unknown-id check needs the records before gating; expose them
  from `buildFilterModel`'s internal or run the check inside
  `buildFilterModel` with a passed-in id list — pick whichever keeps
  `feature.ts` the only caller that knows column ids.

## Risks / Watchouts

- **Composition inference.** `withFiltering` is often composed with
  `withGrouping`/`withSorting`/`withSelection`. Grouping and sorting are
  already F-bounded on the same slice, so this should compose; Step 6
  pins it. If a story fails to infer `In`, check this before touching
  the story.
- `with-grouping/feature.spec.ts` and `with-selection/utils.spec.ts`
  spell `FiltersPath<Row>` — red until Step 5.

## Non-Goals

- No story or fixture edits — Step 7.
- No writer-path check: filtering has no id-carrying writer (criteria
  are keyed by schema key, not column id).

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean on `src/api/**`,
      `src/engine/**` (`src/stories/**` expected red until Step 7).
- [ ] `feature.ts` has no `_input` and no `In extends Shape`.
- [ ] Inline `withFiltering({ schema: (path) => … })` inside a
      `createTable()` autocompletes declared column ids on `path`.

---

← [Step 2: The engine reads the accessor](step-2-engine-reads-accessor.plan.md) | [Step 4: Engine specs](step-4-engine-specs.plan.md) →
