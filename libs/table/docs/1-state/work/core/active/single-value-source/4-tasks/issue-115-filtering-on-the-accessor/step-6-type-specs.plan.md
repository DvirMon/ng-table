# Step 6 — Type specs

**PR scope:** standalone. **Depends on:** Step 3.
**Parallel-safe with:** Steps 4, 5, 7.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/features/with-filtering/feature.types.spec.ts` (edit)

## Why This Step Exists

The blast radius of a mistake here is the consumer's own types, and it
degrades silently: a widened map turns `path` into an index signature
and every criterion into `unknown`, with no error. Only
`typecheck-spec` enforces a `*.types.spec.ts` — a green `nx test` proves
nothing about it.

## What To Do

Migrate the existing cases (`FiltersPath<Invoice>` → two-argument form,
or inline under `createTable()`), then add:

1. **Accessor-typed criterion.** Over
   `col('owner', { accessor: (r) => r.owner.name })`,
   `equals(path.owner)` → `StateOf<S>['owner']` is `string | null`, not
   the row's `owner` object.
2. **Defaulted column** keeps its field type (`equals(path.status)` →
   `Status | null`).
3. **Misspelled id** — `path.custmer` is `@ts-expect-error`, inline and
   in the schema-as-its-own-variable form.
4. **One-argument `FiltersPath<Row>` is rejected** —
   `@ts-expect-error`. Pins the "required `TValues`" ruling.
5. **`hasAny` over an array-valued accessor** infers the element type.
6. **Composition infers** — `withFiltering` with `withGrouping`, and
   with `withSorting`, in both argument orders, inside
   `createTable()`: `table.filters` present and typed, the other
   feature's members present. One case inside `composeFeatures()`.
7. **`StateOf<S>` unchanged** for a schema with no derived accessors —
   the existing state-shape cases carry over unmodified.

## Non-Goals

- No runtime assertions.
- No re-derivation of #113/#125's literal-union guards — they live in
  `create-table.types.spec.ts`; reference them, don't copy.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] Deleting Step 1's `V` phantom (reverting to `unknown`) makes
      case 1 fail.
- [ ] Adding a default to `FiltersPath`'s `TValues` makes case 4 fail.

---

← [Step 5: Feature spec](step-5-feature-spec.plan.md) | [Step 7: Stories and fixtures migrate](step-7-stories-and-fixtures.plan.md) →
