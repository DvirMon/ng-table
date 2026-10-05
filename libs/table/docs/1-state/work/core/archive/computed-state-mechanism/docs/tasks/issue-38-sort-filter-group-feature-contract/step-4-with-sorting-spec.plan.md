---
title: 'Step 4 — with-sorting.spec.ts: positional form, no row type argument, type assertions, trailing block'
type: task-step
issue: 72
---

# Step 4 — `with-sorting.spec.ts`: positional form, no row type argument, type assertions, trailing block

**PR scope:** One spec file. Turns a spec that is red today (imports the deleted
`TableStoreConfig`, uses the array/thunk form) green against the positional `createTable`.

**Task type:** test

**Skills used:** unit-test

**Depends on:** Step 1
**Parallel-safe with:** Step 5, Step 6

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/features/with-sorting.spec.ts` (edit)

## Why This Step Exists

Spec "Testing Decisions": feature-level specs stay one per feature and are updated in the same
pass as the feature; type assertions live alongside runtime cases via `expectTypeOf`. Issue #38
acceptance: "Each feature's spec passes with the positional form and contains no explicit row
type argument"; the trailing-block return type includes the block's members.

## What To Do

1. **Drop the array-form helper.** Remove `makeStore<const F extends readonly AnyTableFeature[]>`
   and the `AnyTableFeature`/`TableStoreConfig` imports. Replace with a context wrapper that
   preserves the inferred store type:

   ```ts
   function inContext<T>(build: () => T): T {
     return TestBed.runInInjectionContext(build);
   }
   ```

   Every case builds its store as
   `inContext(() => createTable(signal<Row[]>(rows), { trackBy: 'id', columns: makeColumns() }, withSorting(...)))`.
   Do **not** reintroduce a per-arity `MakeStore` overload set (the `with-computed.spec.ts`
   pattern) — passing the features straight to `createTable` is what gives the slot context.

2. **Mechanical rewrite** of every existing case: `features: [withSorting<Row>(cfg)]` →
   `withSorting(cfg)` as the third argument; `() => ({ trackBy, columns })` thunk → plain
   object. Assertions unchanged. Grep the file: zero occurrences of `withSorting<` afterwards.

3. **New cases:**
   - _types_ — inside a `describe('types')` block (mirroring `create-table.spec.ts`'s comment that
     `expectTypeOf` is enforced only by `tsc -p tsconfig.spec.json`):
     - `withSorting()` alone: `expectTypeOf(store.sorting).toEqualTypeOf<Signal<SortRule[]>>()`;
       `expectTypeOf<keyof typeof store>().toEqualTypeOf<keyof TableStore<Row> | keyof SortingMembers>()`
       — no index signature (research trap #3), `expectTypeOf(store).not.toBeAny()`.
     - trailing block: `withSorting({ multi: true }, withComputed((s) => ({ ruleCount: computed(() => s.sorting().length) })))`
       — `expectTypeOf(store.ruleCount).toEqualTypeOf<Signal<number>>()`; inside the block,
       `expectTypeOf(s.sorting).toEqualTypeOf<Signal<SortRule[]>>()` and
       `expectTypeOf(s.columns).toEqualTypeOf<Signal<ColumnDef<Row>[]>>()` (read-only projection).
     - derive-first form: `withSorting(withComputed(...))` compiles and contributes the member.
   - _runtime_ — the trailing block recomputes: `toggleSort('name')` → `ruleCount()` goes 0 → 1;
     `clearSorting()` → 0.
   - _runtime_ — `setSorting`/`sortChanged`/`clearSorting` behaviour cases already present pass
     unchanged (the "behaviour unchanged" acceptance line).

## Implementation Notes

- `import { expectTypeOf } from 'vitest'` as `create-table.spec.ts` does.
- `trackBy: 'id'` literal in a plain object is inferred against `TrackByConfig<Row>` from the
  slot's `TRow` — no `as const` needed; if an existing case used `mockTrackBy`-style functions,
  keep them.
- Keep the existing `applySortNulls` cases; they exercise the `columnsSchema` config field
  (`createTable(data, { trackBy, columns, columnsSchema: (c) => [...] }, withSorting())`).

## Risks / Watchouts

- A case that composes another feature (none expected in this file — verify) would need that
  feature converted; otherwise keep its explicit `<Row>` and note it for the owning issue.

## Non-Goals

- No type assertions duplicated into `create-table.spec.ts`.

## Acceptance Checks

- [ ] `grep -c "withSorting<" with-sorting.spec.ts` → 0; no `TableStoreConfig`, `AnyTableFeature`,
      `ComposedFeatureMembers` imports.
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` clean for this file (type cases).
- [ ] Runtime: `npx vitest run libs/shared/table/src/api/features/with-sorting.spec.ts` green —
      the user runs it.

---

← [Step 3: with-grouping.ts](step-3-with-grouping.plan.md) | [Step 5: with-filtering.spec.ts](step-5-with-filtering-spec.plan.md) →
