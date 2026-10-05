---
title: 'Step 2 — with-expansion.ts: withExpansion<In>(config?, derive?) on the Feature<In, Out> contract'
type: task-step
issue: 73
---

# Step 2 — `with-expansion.ts`: `withExpansion<In>(config?, derive?)` on the `Feature<In, Out>` contract

**PR scope:** One feature file. Spec in Step 4.

**Task type:** code

**Skills used:** typescript-conventions, declarative-naming, extract-encapsulated-logic

**Depends on:** —
**Parallel-safe with:** Step 1

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/with-expansion.ts` (edit)

## Why This Step Exists

Same contract change as Step 1. Issue #39: expansion predicates (`childrenAccessor`,
`isExpandable`) receive the consumer's row type without annotation; trailing block; removal
reconciliation of `expandedRows` (not `everExpanded`) unchanged. Grouping (#38 Step 3) reads this
feature's `expandedRows` lazily off the shared store in either order — nothing to do here for
that, but the member name and signal shape must not change.

## What To Do

1. **Input slice, F-bounded**, replacing `ExpansionInput<TRow> = Pick<TableCore<TRow>, 'rows' | 'trackBy'>`:

   ```ts
   type ExpansionInput<In> = Pick<TableStore<RowOf<In>>, 'rows' | 'trackBy'>;
   ```

   Imports as in Step 1; drop `TableCore`.

2. **Extract the factory body** into
   `buildExpansionSpec<TRow>(input: Pick<TableStore<TRow>, 'rows' | 'trackBy'>, config: WithExpansionConfig<TRow>): TableFeatureSpec<TRow, ExpansionMembers>`
   — today's inner arrow (`expandedRows`/`everExpanded` signals, `emitChanged`, verbs,
   `onRowsRemoved`, `renderStages.tree` via `buildTreeStage`, `onDestroy`), `core` → `input`.
   Resolve `childrenAccessor`/`isExpandable` defaults inside it (they are `TRow`-typed).

3. **Overloads, this exact order:**

   ```ts
   export function withExpansion<In extends ExpansionInput<In>, D extends DerivedDict>(
     derive: Feature<NoInfer<In> & ExpansionMembers, D>,
   ): Feature<In, ExpansionMembers & D>;
   export function withExpansion<In extends ExpansionInput<In>>(
     config?: WithExpansionConfig<RowOf<In>>,
   ): Feature<In, ExpansionMembers>;
   export function withExpansion<In extends ExpansionInput<In>, D extends DerivedDict>(
     config: WithExpansionConfig<RowOf<In>> | undefined,
     derive: Feature<NoInfer<In> & ExpansionMembers, D>,
   ): Feature<In, ExpansionMembers & D>;
   ```

4. **Implementation:** the Step 1 shape — `isDeriveFirst = typeof a === 'function'`, generic
   `factory` over `In extends ExpansionInput<In>` delegating to `buildExpansionSpec`,
   `const feature: Feature<any, any> = derive ? createTableFeature(factory, derive) : createTableFeature(factory)`,
   `Object.assign(feature, { displayName: 'withExpansion' })`.

5. **Doc comment**: keep the ADR-0011 `'tree'` render-stage claim; replace "reads only core
   members" with the store-handed-in line.

## Implementation Notes

- `buildTreeStage`, `collectExpandableRowIds`, `defaultChildrenAccessor`, `hasNonEmptyChildren`,
  `toChildRenderRow` are already pure module-level helpers — unchanged.
- `WithExpansionConfig` is weak (all-optional) — same overload fall-through as selection.

## Risks / Watchouts

- Do not rename `expandedRows` or change it from `Signal<Set<RowId>>` — grouping's guarded read
  and `isExpandedRowsSignal` depend on the key and callability.

## Non-Goals

- No spec (Step 4). No panel/tree split (spec "Out of Scope").

## Acceptance Checks

- [ ] `withExpansion({ childrenAccessor: (row) => row.nested })` in a slot: `row` is the slot's
      row type without annotation.
- [ ] `withExpansion(withComputed((s) => ({ openCount: computed(() => s.expandedRows().size) })))`
      compiles; `store.openCount` is `Signal<number>`.
- [ ] `keyof` of a table with `withExpansion()` alone is `keyof TableStore<Row> | keyof ExpansionMembers`.
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` clean for `with-expansion.ts`.

---

← [Step 1: with-selection.ts](step-1-with-selection.plan.md) | [Step 3: with-selection.spec.ts + selection.utils.spec.ts](step-3-with-selection-spec.plan.md) →
