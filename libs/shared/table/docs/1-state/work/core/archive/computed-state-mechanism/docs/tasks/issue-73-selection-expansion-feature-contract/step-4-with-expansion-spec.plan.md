---
title: "Step 4 — with-expansion.spec.ts: positional form, typed predicates, trailing block; strip the interim type args in with-grouping.spec.ts"
type: task-step
issue: 73
---

# Step 4 — `with-expansion.spec.ts`: positional form, typed predicates, trailing block; strip the interim type args in `with-grouping.spec.ts`

**PR scope:** One spec file rewritten; plus, if #72 Step 6 landed first with
`withExpansion<GroupingMockRow>()` / `withSelection<GroupingMockRow>()` interim calls in
`with-grouping.spec.ts`, remove those type arguments (search the `// #73 strips` markers).

**Task type:** test

**Skills used:** unit-test

**Depends on:** Step 2 (and Step 1 for the `withSelection<…>` strip)
**Parallel-safe with:** Step 3

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/features/with-expansion.spec.ts` (edit)
- `libs/shared/table/src/api/features/with-grouping.spec.ts` (edit — type-argument strip only, if present)

## Why This Step Exists

Issue #73 acceptance: expansion predicates receive the consumer's row type without annotation;
trailing block; reconciliation prunes `expandedRows` on both write paths; no explicit row type
argument in the spec.

## What To Do

1. **Helpers.** Replace `makeStore`/`AnyTableFeature`/`TableStoreConfig` with `inContext(build)`;
   every case calls `createTable(signal<Row[]>(rows), { trackBy: 'id', columns: makeColumns() }, withExpansion(...))`.

2. **Mechanical rewrite** of every case; zero `withExpansion<` afterwards. The
   `CustomChildrenRow` case keeps `childrenAccessor: (row) => row.nested` — now the acceptance
   evidence for "no annotation": add `expectTypeOf(row).toEqualTypeOf<CustomChildrenRow>()` inside
   the callback. Retitle "composes with zero other features present — createTable({ features: […] })
   alone" to the positional wording.

3. **Types describe:** `withExpansion()` alone → `keyof` exactly
   `keyof TableStore<Row> | keyof ExpansionMembers`; `not.toBeAny()`;
   `expectTypeOf(store.expandedRows).toEqualTypeOf<Signal<Set<RowId>>>()`.

4. **Trailing block:** `withExpansion({ isExpandable: (row) => row.id === 'r1' }, withComputed((s) => ({ openCount: computed(() => s.expandedRows().size) })))`
   — types: `store.openCount` is `Signal<number>`; runtime: 0 → `toggleExpanded('r1')` → 1 →
   `collapseAll()` → 0. Also the derive-first form compiles (`withExpansion(withComputed(...))`).

5. **Reconciliation, second write path:** the existing ADR-0006 case uses `data.update(filter)`;
   add `store.value.update(removeRow('r1'))` + `TestBed.tick()` → gone from `expandedRows()`,
   kept in `everExpanded()`.

6. **`with-grouping.spec.ts` strip** (conditional, see PR scope): remove `<GroupingMockRow>` from
   `withExpansion`/`withSelection` calls and the marker comments; nothing else.

## Implementation Notes

- `expandAll`/`collapseAll`/`rowExpanded`/`emitEvent: false` cases: composition rewrite only.
- `import { expectTypeOf } from 'vitest'`; `removeRow` from `../../mutations/row-mutations`.

## Risks / Watchouts

- Grouping's either-order cases (#72 Step 6) live in `with-grouping.spec.ts`, not here — do not
  duplicate them.

## Non-Goals

- No `everExpanded` semantic change.

## Acceptance Checks

- [ ] `grep -c "withExpansion<"` → 0 in `with-expansion.spec.ts` and `with-grouping.spec.ts`;
      `withSelection<` → 0 in `with-grouping.spec.ts`.
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` clean for the touched files.
- [ ] Runtime green (`vitest run …/with-expansion.spec.ts`) — the user runs it.

---
← [Step 3: with-selection.spec.ts + selection.utils.spec.ts](step-3-with-selection-spec.plan.md)
