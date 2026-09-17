# Step 1: Wire column state as derivation — the atomic production swap

**PR scope:** `engine/core.ts`, `engine/types.ts`, `engine/compose-table.ts`, `api/update-columns.ts`, `api/column-rules.ts`, `api/column-schema.types.ts`, `api/features/with-columns-schema/wiring.ts`, `api/features/with-columns-schema/feature.ts`, `apps/demo/src/app/table-demo/table-demo.store.ts`.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/design-system/src/ui/table/engine/core.ts` (edit)
- `libs/shared/design-system/src/ui/table/engine/types.ts` (edit)
- `libs/shared/design-system/src/ui/table/engine/compose-table.ts` (edit)
- `libs/shared/design-system/src/ui/table/api/update-columns.ts` (edit)
- `libs/shared/design-system/src/ui/table/api/column-rules.ts` (edit)
- `libs/shared/design-system/src/ui/table/api/column-schema.types.ts` (edit)
- `libs/shared/design-system/src/ui/table/api/features/with-columns-schema/wiring.ts` (edit)
- `libs/shared/design-system/src/ui/table/api/features/with-columns-schema/feature.ts` (edit)
- `apps/demo/src/app/table-demo/table-demo.store.ts` (edit)

## Why This Step Exists

Issue #50 is the atomic swap that delivers effect-free column reactivity end-to-end (per
`4-architecture.md`, `3-spec.md`). `columns` stops being a single writable signal three sources
fight over, and becomes a derivation: a writable `baseColumns`, a `columnRules` registry folded
via `foldColumnRules` (landed in #49), and a derived `columns` overlaying one on the other. The
two `effect()`s in `with-columns-schema/wiring.ts` disappear as a consequence of the split, not
as a separately-targeted deletion.

This is one step, not several, because none of these files compile independently mid-swap:
`engine/core.ts` changing `TableCore.columns` from `WritableSignal` to `Signal` immediately
breaks every direct writer (`update-columns.ts`, `wiring.ts`'s `patchColumnVisible`), so the
write-path retargeting has to land in the same change that removes the old write path.

**Ground truth override:** `4-architecture.md`'s `ColumnRuleRegistry<TRow>` sketch (`{ readonly
visible: ColumnRuleEntry[] }`, entry without `kind`) is stale — #49 shipped a different, already-
merged shape: `ColumnRuleRegistry<TRow> = readonly ColumnRuleEntry<TRow>[]` (a flat array) with
`ColumnRuleEntry.kind: 'visible'` as the discriminant (`engine/columns.ts`). Build against the
actual shipped types, not the doc's sketch. `foldColumnRules` itself is already correct and
needs no changes here.

## What To Do

### `engine/core.ts` (`createTableCore()`)

- Replace the single `columns = signal(...)` with:
  ```ts
  const baseColumns = signal<ColumnDef<TRow>[]>(resolveColumnDefs(config.columns));
  const columnRules: ColumnRuleEntry<TRow>[] = [];
  const columns = computed(() => foldColumnRules(baseColumns(), columnRules));
  ```
  (`columnRules` is a plain mutable array — `compose-table.ts` pushes into it in Step-internal
  `foldFeatures()`; `foldColumnRules` reads it at evaluation time, same evaluation-time contract
  as `PipelineStages`.)
- `TableCoreHandle<TRow>` gains `readonly columnRules: ColumnRuleEntry<TRow>[]` alongside
  `stages` — same rationale as the handle's existing doc comment (features registering during
  the fold must be visible before any consumer's first read).
- `core: TableCore<TRow>` now includes both `columns` (the derived one) and `baseColumns`.
- Import `foldColumnRules` and `ColumnRuleEntry` from `./columns`.

### `engine/types.ts`

- `TableCore<TRow>.columns`: `WritableSignal<ColumnDef<TRow>[]>` → `Signal<ColumnDef<TRow>[]>`.
- `TableCore<TRow>` gains `readonly baseColumns: WritableSignal<ColumnDef<TRow>[]>` with the same
  "engine-internal only" annotation `data` already carries.
- `TableFeatureSpec.columnRules` already exists from #49 (`columnRules?: ColumnRuleRegistry<TRow>`)
  — update its doc comment: it's no longer "unused by any feature yet," it's now read by
  `composeTable()`'s `foldFeatures()`. Leave the field itself unchanged.

### `engine/compose-table.ts` (`foldFeatures()`)

- After `Object.assign(composed, spec.members)`, merge `spec.columnRules` into
  `handle.columnRules` by concatenation (push each entry) — additive, like `members`, **not**
  through `SlotRegistry`. Two features contributing rules to the same column must both apply
  (they already AND together inside `foldColumnRules`), so this is never a claim/collision check.

### `api/update-columns.ts`

- Retarget the cast and the structural overload at `baseColumns` instead of `columns`:
  `table: { baseColumns: WritableSignal<ColumnDef<TRow>[]> }`, and the write goes to
  `.baseColumns.update(updater)`.
- `setColumns` / `reorderColumns` / `toggleColumnVisibility` (the pure updater factories) are
  **unchanged** — only what they're applied to moves.

### `api/column-rules.ts`

- `VisibleAsyncOpts.onError` loses its `?` — becomes required:
  `onError: (error: unknown) => boolean`.
- Correct the JSDoc that currently describes the optional/fallback behavior.

### `api/column-schema.types.ts`

- `VisibleAsyncRule.onError` loses its `?` to match `VisibleAsyncOpts`.
- Narrow `ColumnsSchemaStore` to what rule wiring actually reads now — the wiring no longer
  writes at all (it returns rule entries instead), so drop the `WritableSignal` requirement;
  replace with whatever read-only shape `buildReactiveVisibleEntries`/`buildAsyncVisibleEntry`
  need (at minimum a way to read `baseColumns`).
- Add a doc comment on `ColumnRuleContext` noting it resolves to `baseColumns`, never the derived
  `columns` — rules observe declared and imperatively-updated column state, never another rule's
  output (D8, breaks the `columns → ruleResults → params → resource → ruleResults` cycle).

### `api/features/with-columns-schema/wiring.ts`

- Delete both `effect()` blocks and `patchColumnVisible`.
- `groupRulesByColumnId` is no longer needed here — grouping moved into `foldColumnRules`
  (already landed in #49). Delete it too, unless still needed for building entries (check before
  deleting — one entry per rule is fine, no grouping needed at this layer).
- Rename and rewrite the two wiring functions to build `ColumnRuleEntry[]` values instead of
  performing writes:
  - `wireReactiveVisibleRules` → `buildReactiveVisibleEntries<TRow>(ctx, rules)`: one
    `ColumnRuleEntry` per rule, `result: computed(() => rule.when(ctx))`, `kind: 'visible'`.
  - `wireAsyncVisibleRule` → `buildAsyncVisibleEntry<TRow>(ctx, rule)`: constructs the resource
    (still requires an injection context, so still called from `onInit` — D3), `result` is the D5
    retention cell:
    ```ts
    const result = linkedSignal<ResourceStatus, boolean | undefined>({
      source: () => resourceRef.status(),
      computation: (status, previous) => {
        if (status === 'resolved' || status === 'local') {
          const value = resourceRef.value();
          return value === undefined ? previous?.value : rule.onSuccess(value);
        }
        if (status === 'error') return rule.onError(resourceRef.error());
        return previous?.value; // loading / reloading / idle → hold
      },
    });
    ```
    `onError` is now required (Step 1's `column-rules.ts` change), so the `status === 'error'`
    branch calls it unconditionally — no more `resolveErrorVisible`'s `undefined`-means-hold
    special case.
- The context passed in now resolves to `baseColumns`, not `columns`:
  `const ctx: ColumnRuleContext<TRow> = { columns: () => core.baseColumns() }` (D8).

### `api/features/with-columns-schema/feature.ts`

- `withColumnsSchemaAsync` builds its entries in `onInit` (resource construction needs the
  injection context — D3) and returns them via the feature spec's `columnRules`, instead of
  calling the wiring functions for their side effects:
  ```ts
  return (core: ColumnsSchemaStore<TRow>): TableFeatureSpec<TRow> => {
    const columnRules: ColumnRuleEntry<TRow>[] = [];
    return {
      columnRules,
      onInit(): void {
        columnRules.push(...buildReactiveVisibleEntries(ctx, reactiveRules));
        for (const rule of asyncRules) {
          columnRules.push(buildAsyncVisibleEntry(ctx, rule));
        }
      },
    };
  };
  ```
  Exact shape is a judgment call inside the constraint that `columnRules` must be populated
  before `composeTable()`'s `foldFeatures()` reads `spec.columnRules` — check the timing against
  `compose-table.ts`'s existing `onInit` hook-running order (hooks run *after* every feature is
  folded, per its own doc comment) and adjust: if `foldFeatures()` reads `spec.columnRules`
  synchronously at fold time (before `onInit` runs), the array must be populated by the time the
  feature factory *returns*, not inside `onInit` — resource construction's injection-context
  requirement then forces `buildAsyncVisibleEntry` to run at feature-factory time instead, which
  the engine already guarantees runs under an injection context (`composeTable()`'s own
  requirement). Resolve this ordering question by reading `compose-table.ts` (this step's own
  edit) before finalizing this file — don't guess separately from Step 1's own compose-table
  change.

### `apps/demo/src/app/table-demo/table-demo.store.ts`

- Add the now-required `onError` to the existing `applyVisibleAsync(schema.age, {...})` call.
  Fail-closed default (`onError: () => false`) unless the demo's product intent says otherwise —
  this is a permission check.

## Implementation Notes

- `foldColumnRules` (from #49) is a flat-array fold over `ColumnRuleEntry<TRow>[]` with
  `kind: 'visible'` as the only branch today — nothing in this step touches `engine/columns.ts`.
- `TableStore.columns` (`api/types.ts`) is already a readonly `Signal` in the public type — no
  public type changes ripple from this step.
- `api/types.ts`, `api/update-columns.spec.ts`, `engine/slots.ts`, `engine/pipeline.ts`,
  `directives/` are untouched by this step.

## Risks / Watchouts

- The `foldFeatures()` timing question above (when `columnRules` must be populated relative to
  `onInit`) is the one real ordering hazard in this step — get it wrong and async rules silently
  never register. Verify against `compose-table.ts`'s actual hook-running order before writing
  `feature.ts`.
- `feature.spec.ts` (existing) will fail after this step lands — that's expected and fixed in
  Step 2, not here. Don't hold this step's acceptance checks to the full existing test suite
  passing; hold it to typecheck passing and the specific behaviors below.
- The demo store's `onError` choice is a product call, not mechanical — flag it explicitly in
  your report rather than silently picking a default.

## Non-Goals

- Rewriting or extending `feature.spec.ts` — Step 2.
- `CLAUDE.md` / ADR-0003 corrections — Step 3.
- Any change to `engine/columns.ts`, `engine/columns.spec.ts`, `api/update-columns.spec.ts`,
  `engine/slots.ts`, `engine/pipeline.ts`, `directives/`.

## Acceptance Checks

- `columns` is a derived `Signal`, `baseColumns` is the writable source; no `effect()` remains in
  `with-columns-schema/wiring.ts`.
- Imperative visibility toggle on a rule-governed column loses to the rule (D2); imperative
  reorder and visibility of unruled columns survive rule re-evaluation.
- Async rule holds its last-resolved value while a refetch is in flight; before first resolution
  the column's declared visibility applies (D5).
- `onError` required on `applyVisibleAsync` (compile-time — TypeScript rejects a call site
  omitting it).
- Rule callbacks (`ColumnRuleContext.columns()`) read `baseColumns`, never derived `columns` — no
  cycle.
- Demo store compiles with the required `onError`.
- Typecheck passes across the touched files (existing `feature.spec.ts` failures are expected and
  deferred to Step 2 — don't fix them here).

---
[Step 2: `feature.spec.ts` — D2/D5/D8/D9 cases and the required-`onError` rewrite](step-2-feature-spec-tests.plan.md) →
