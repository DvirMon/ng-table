---
title: "Step 5 — with-filtering.spec.ts: positional form, {} contribution asserted, trailing block"
type: task-step
issue: 72
---

# Step 5 — `with-filtering.spec.ts`: positional form, `{}` contribution asserted, trailing block

**PR scope:** One spec file (red today: array/thunk form, deleted `TableStoreConfig`).

**Task type:** test

**Skills used:** unit-test

**Depends on:** Step 2
**Parallel-safe with:** Step 4, Step 6

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/features/with-filtering.spec.ts` (edit)

## Why This Step Exists

Same as Step 4 (spec "Testing Decisions", issue #72 acceptance). This file additionally owns the
`{}`-not-`object` acceptance line: filtering is the only member-less shipped feature.

## What To Do

1. Replace `makeStore`/`AnyTableFeature`/`TableStoreConfig` with the `inContext(build)` wrapper
   (Step 4, item 1) and rewrite every case to
   `createTable(signal<Row[]>(rows), { trackBy: 'id', columns: makeColumns() }, withFiltering({ filters }))`.
   The existing case titled "composes into createTable(), TRow inferred from the enclosing
   config" is retitled "…, Row inferred from the data slot".

2. **New type cases** (`describe('types')`, `expectTypeOf`):
   - `withFiltering({ filters })` alone: `expectTypeOf(store).toEqualTypeOf<TableStore<Row>>()` —
     exactly, no `& {}` / `& object`; `expectTypeOf(store).not.toBeAny()`.
   - `filters` parameter typed `Filters<Row>` from the slot: passing a `Filters<OtherRow>` is a
     `@ts-expect-error`.
   - trailing block: `withFiltering({ filters }, withComputed((s) => ({ visibleCount: computed(() => s.rows().length) })))`
     — `expectTypeOf(store.visibleCount).toEqualTypeOf<Signal<number>>()`;
     `expectTypeOf<keyof typeof store>().toEqualTypeOf<keyof TableStore<Row> | 'visibleCount'>()`.

3. **New runtime case:** the trailing block sees post-filter rows — set the filter to match one
   row, `visibleCount()` is 1; clear it, 3.

## Implementation Notes

- `buildFilters` (one type argument, `TState` defaulted) stays — it is `createFilters`'s own
  contract, unrelated to the feature contract.
- `manual: true` case unchanged.

## Risks / Watchouts

- `Filters<Row>` is callable (`filters['name']` collides with `Function.prototype.name` — see
  `selection.utils.spec.ts`'s note); keep filtering on `status`/`category`.

## Non-Goals

- No evaluator/matcher cases (own specs).

## Acceptance Checks

- [ ] `grep -c "withFiltering<" with-filtering.spec.ts` → 0; no array-form imports remain.
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` clean for this file.
- [ ] Runtime green (`vitest run …/with-filtering.spec.ts`) — the user runs it.

---
← [Step 4: with-sorting.spec.ts](step-4-with-sorting-spec.plan.md) | [Step 6: with-grouping.spec.ts — either-order expansion, pipeline-order permutation](step-6-with-grouping-spec.plan.md) →
