# Step 1 test plan — Context-row engine slot + central `isContextRow` stamp

Step: [step-1-context-rows-slot.plan.md](step-1-context-rows-slot.plan.md)
Spec file: `libs/table/src/engine/core.spec.ts`
(plus `engine/compose-table.spec.ts` for seam F, `api/types.types.spec.ts` and `engine/render-stages.types.spec.ts` for the types phase)

## Stubs (red phase)

No new functions — the step adds fields only, so "stub" means declared but unread:

- `engine/types.ts`: `TableFeatureSpec<TRow>.contextRows?: Signal<ReadonlySet<RowId>>` declared; `compose-table.ts` does not push it yet.
- `engine/core.ts`: `TableCoreHandle<TRow>.contextSources: Signal<ReadonlySet<RowId>>[]` declared and returned as `[]`; nothing unions or stamps from it.
- `api/types.ts`: `RenderRow<TRow>.isContextRow?: boolean` declared.
- `engine/render-stages.ts`: `'isContextRow'` added to `RenderNode`'s `Omit` list (the types phase needs it in red).

## Seams — in red-green order

### A. One contributor `{r2}` → data rows stamped `[false, true, false]`

- Test: `it('stamps isContextRow true for ids in a contributed set and false for every other data row')`
- Asserts: `createTableCore<Row>` over `makeRows()`, then `contextSources.push(signal(new Set<RowId>(['r2'])))` after construction; `renderRows().map((r) => r.isContextRow)` equals `[false, true, false]`.
- Why this seam: the base stamp — catches membership never stamped, or stamped off the wrong key (`sourceIndex`/`index` instead of `row.id`). Pushing after construction, as the fold does, also catches a zero-contributor gate evaluated once at construction instead of at read time.
- Order reason: independent (base case).

### B. Two contributors `{r1}` and `{r3}` → `[true, false, true]`

- Test: `it('unions every contributed context-row set')`
- Asserts: both sets pushed onto `contextSources`; per-row `isContextRow` equals `[true, false, true]`.
- Why this seam: catches a union that reads only the first or only the last source — neither set alone produces the expected array.
- Order reason: builds on A (stamping must work before the union is observable).

### C. Zero contributors → `isContextRow` is `undefined` on every row — guard: passes in red by design

- Test: `it('leaves isContextRow undefined on every row when no feature contributes context rows')`
- Asserts: nothing pushed; `renderRows().every((r) => r.isContextRow === undefined)` — via `toBeUndefined` per row or `toEqual([undefined, undefined, undefined])`, never `toBeFalsy`.
- Why this seam: libs/table/CLAUDE.md "RenderRow field ownership" — a feature-contributed field stays `undefined` when the feature isn't composed. Catches green stamping `false` unconditionally (`set?.has(id) ?? false`), which would make a directive binding the field lie "not context" on every table.
- Order reason: builds on A (the defined/undefined branch A introduced). **Expected to pass in red** — today's code never sets the field; it guards against green overreaching, not a plan defect, so red lists it separately instead of stopping.

### D. One contributor with an empty set → `[false, false, false]`, not `undefined`

- Test: `it('stamps false, not undefined, when a contributor exists but its set is empty')`
- Asserts: `contextSources.push(signal(new Set<RowId>()))`; every row's `isContextRow` is `toBe(false)`.
- Why this seam: catches the gate written as "union is empty" instead of "no contributors" — that turns "filter active, nothing is context" into "filter not composed". Mirrors `expanded`'s "a defined, possibly empty, Set once at least one has contributed".
- Order reason: builds on C (together they pin both sides of the zero-contributor branch).

### E. Synthesized group row → `undefined`; data rows under it still stamped

- Test: `it('leaves isContextRow undefined on a synthesized group row while stamping its data rows')`
- Asserts: a `'group'` render stage wraps every node in `{ id: 'group-1', kind: 'group', data: null, children }` (same fixture shape as the existing `sourceIndex` test); `contextRows` is `{'r2'}`; the group row's `isContextRow` is `toBeUndefined()`; data rows equal `[false, true, false]`.
- Why this seam: catches stamping `set.has(row.id)` on every row, which yields `false` for the group — a group is not a filter subject, so the table can't claim it is "not context". Follows `sourceIndex` being `undefined` for `data === null`.
- Order reason: builds on A.

### F. Fold: every feature's `contextRows` reaches the engine

- Test (in `compose-table.spec.ts`, new `describe('contextRows contributions', ...)` beside the `expandedRows` block): `it('collects a contextRows contribution from every feature in the fold')`
- Asserts: `composeWithRows(makeRows(), [withFirst, withSecond])`; `withFirst` contributes `{'r1'}`, `withSecond` contributes `{'unrelated'}`; store `renderRows()` `isContextRow` equals `[true, false]`; composing does not throw.
- Why this seam: catches `compose-table.ts` never pushing `spec.contextRows` (every row `undefined`), a claim via `SlotRegistry` (throws on the second contributor), and overwrite-instead-of-push (loses `r1`). The first-folded contributor holds the real id, like the neighbouring `expandedRows` test.
- Order reason: builds on A and B (only observable through the core stamp and union).

## Types phase (written in red, proven by green's typecheck)

- `expectTypeOf<RenderRow<Row>['isContextRow']>().toEqualTypeOf<boolean | undefined>()` in `api/types.types.spec.ts`, beside the `RenderRow.parentId` block. Pins the public field as an optional `boolean` — not `true | undefined`, not required.
- `expectTypeOf<RenderNode<Row>>().not.toHaveProperty('isContextRow')` in `engine/render-stages.types.spec.ts`. Pins the field as engine-stamped only, like `sourceIndex`/`index`.

## Not tested

- `TableFeatureSpec.contextRows` type shape: internal slot; the test would only restate the declaration. Seam F already exercises it.
- `renderRows` recomputing when a contributed signal changes: Angular's `computed` dependency tracking ("the framework itself").
- `composeFeatures` inner merge and `PIPELINE_BEHAVIOR_KEYS`: step 2.
- `withFiltering()` contributing the set, and `createTable()` store-level `isContextRow`: step 4.
- `index`/`sourceIndex`/`cells` still stamped: existing `core.spec.ts` tests cover them.

## Resolved

- Group row value → `undefined` (seam E, following `sourceIndex`).
- Engine-level seams A–E pushing onto `handle.contextSources` directly → accepted; step 4's `createTable()` tests cover the store-level behaviour the spec requires.
