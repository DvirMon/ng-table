# Step 8 — `with-filtering.spec.ts`

**PR scope:** PR 2 of 2 (`#77`). **Parallel-safe with: Steps 1, 2, 3, 4, 5, 6, 7.** **Blocks Step 9.**
**Task type:** `test`
**Stack:** angular
**Skills used:** `unit-test`, `typescript-conventions`
**Scaffolding agent:** `test-implementer`

## Files

| File | Action |
|---|---|
| `libs/shared/table/src/api/features/with-filtering.spec.ts` | edit — one helper, one schema |

The table feature's own spec. Two lines of real change; it is here as its own step because it lives
outside `src/filters/` and is the one place a filters change reaches the table's test surface.

## Why This Step Exists

`withFiltering()` takes a predicate list and imports nothing from the filters domain — ADR-0016,
and `#76` did not touch it. But this spec builds a real filter set to prove the two compose, so it
inherits the signature change:

```ts
function buildFilters(schema: (path: FiltersPath<Row>) => void): Filters<Row> {
  return TestBed.runInInjectionContext(() => createFilters<Row>(schema));
}
```

Three separate breaks: `createFilters<Row>(schema)` names a type argument and passes no carrier,
the schema returns `void`, and `Filters<Row>` no longer compiles because `#76`'s R41 removed the
`= Record<string, unknown>` default from the criterion map parameter.

## What To Do

1. Rewrite the helper, dropping the return annotation entirely:

   ```ts
   function buildFilters<S extends readonly unknown[]>(schema: (path: FiltersPath<Row>) => S) {
     return TestBed.runInInjectionContext(() => createFilters(rowOf<Row>(), schema));
   }
   ```

   `rowOf<Row>()`: the spec declares filters with no row data in hand, exactly as
   `create-filters.spec.ts` does.

2. Rewrite the one schema (~253):

   ```ts
   const filters = buildFilters((path) => [equals(path.status)]);
   ```

3. `filters['status']().value.set('open')` at ~262 can become `filters.status().value.set('open')` —
   the bracket was there because the default criterion map made property access `unknown`. Property
   access now works. Optional, but it is the whole point of the epic showing up in a test.

4. Drop the `Filters` import if the annotation was its only use. Keep `FiltersPath`.

## Implementation Notes

- The comment above the helper points at `create-filters.spec.ts` as the place filters behaviour is
  covered. Still true — leave it.
- `expect('filters' in store).toBe(false)` at ~112 asserts the table exposes no filters member. It
  is about the decoupling, not the signature. Untouched.
- Nothing in `src/api/features/with-filtering.ts` changes. `architecture.md` is explicit: a step
  proposing to edit it is wrong.

## Risks / Watchouts

- **Do not reintroduce a filter schema anywhere else in `src/api/`.** `selection.utils.spec.ts` and
  `with-grouping.spec.ts` stopped building filter sets when the decoupling landed. This spec is the
  one sanctioned cross-domain use, because composition is what it tests.
- Dropping the `Filters<Row>` return annotation means the helper's type is inferred from
  `createFilters`. If `StateOf<S>` folds to `{}` the file still compiles and `filters.status`
  becomes an error at the *call* site, not the helper. Read the error's location before assuming
  the schema is wrong.

## Non-Goals

- `src/api/features/with-filtering.ts` — unchanged.
- Any other spec under `src/api/` — none builds a filter set.
- `create-filters.spec.ts` (Step 6), `state.spec.ts` (Step 7).

## Acceptance Checks

- [ ] `buildFilters` passes `rowOf<Row>()` and carries no return annotation
- [ ] `createFilters` names no type argument
- [ ] The schema returns `[equals(path.status)]`
- [ ] No file under `src/api/` other than this spec builds a filter schema
- [ ] `src/api/features/with-filtering.ts` is unmodified
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` reports no error in this file
- [ ] `nx test shared-table -- with-filtering` passes

---
← [Step 7: `state.spec.ts`](step-7-state-spec.plan.md) | [Step 9: Restore green](step-9-green-gate.plan.md) →
