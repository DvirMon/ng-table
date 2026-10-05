# Step 1: `withExpansion()` feature + `RenderRow` fields

## PR scope

Adds the `withExpansion()` composable feature to `createTable()` — multi-expand,
tree-capable row expansion, standalone (no compile-time dependency on any other feature).

## Task type

code

## Skills used

angular-developer

## Scaffolding agent

angular-implementer

## Files

- `libs/shared/design-system/src/ui/table/table.types.ts` (edit)
- `libs/shared/design-system/src/ui/table/with-expansion.ts` (new)

## Why This Step Exists

Issue #5. `withExpansion()` was blocked on `RenderRow`/`renderRows()` existing on the core
store — that landed via #10 (2026-08-07). Nothing else blocks this now. See
`libs/shared/design-system/src/ui/table/docs/1-state/features/expansion.md` for the full spec.

## What To Do

### 1. `table.types.ts` — extend `RenderRow<TRow>`

Add two optional fields, matching the shape `with-grouping.md`'s Render Layer section
already specs (only the expansion-relevant subset — `groupKey`/further grouping fields are
out of scope here):

```ts
export interface RenderRow<TRow> {
  readonly id: RowId;
  readonly depth: number;
  readonly kind: 'row' | 'group';
  readonly data: TRow | null;
  readonly aggregates?: Record<string, unknown>;
  readonly isExpanded?: boolean; // new — only meaningful if withExpansion() composed
  readonly hasChildren?: boolean; // new
}
```

### 2. `with-expansion.ts` — new file

Follow `with-sorting.ts`'s feature-factory shape exactly: `signalStoreFeature({state, props},
withState(...), withProps(...), withMethods(...))`, reading/mutating `store.rows()` /
`store.trackBy` / `store._buildRenderRows` directly.

```ts
export interface WithExpansionConfig<TRow> {
  /** Reads a row's nested children. Default: `(row as { children?: TRow[] }).children`. */
  childrenAccessor?: (row: TRow) => TRow[] | undefined;
}

interface ExpansionState {
  expandedRows: Set<RowId>;
}
```

**State:** `expandedRows: Set<RowId>`, initial `new Set()`.

**Props:** `rowExpanded: Observable<RowId>` + `_rowExpandedSource: Subject<RowId>` — same
`Subject`-then-`asObservable()` pattern as `with-sorting.ts`'s `sortChanged`/
`_sortChangedSource`. Single event, no separate expand/collapse variant (direction is
inferable from `expandedRows` after the change) — see spec's Events Owned.

**Methods:**

- `toggleExpanded(rowId: RowId): void` — flip membership in `expandedRows` (new `Set` via
  `patchState`, not a mutation — `@ngrx/signals` needs a new reference to detect the change),
  then `store._rowExpandedSource.next(rowId)`.
- `expandAll(): void` — recursively walk `store.rows()` via `childrenAccessor`, collect the id
  (via `store.trackBy`) of every row that has a non-empty children array, at any depth, and set
  `expandedRows` to that full set.
- `collapseAll(): void` — `patchState(store, { expandedRows: new Set() })`.

**Render layer — override `store._buildRenderRows`:**

Assigned directly inside `withMethods`'s factory function body, before the `return { ... }`,
exactly where `with-sorting.ts` assigns `store._pipeline.sort = ...`. Do **not** touch
`store._pipeline.expand` — the revised render-layer design (noted directly in issue #5's body)
routes expansion through `_buildRenderRows`, not the `PipelineStages.expand` stage; that field
stays unused (pre-existing, out of scope for this step).

Recursive builder, reading `store.expandedRows()` and the configured `childrenAccessor` at
call time (so it reflects current expansion state on every recompute):

```ts
function buildExpansionRenderRows<TRow>(
  rows: TRow[],
  trackBy: TrackByFn<TRow>,
  expandedRows: Set<RowId>,
  childrenAccessor: (row: TRow) => TRow[] | undefined,
  depth = 0,
): RenderRow<TRow>[] {
  return rows.flatMap((row) => {
    const id = trackBy(row);
    const children = childrenAccessor(row);
    const hasChildren = !!children && children.length > 0;
    const isExpanded = expandedRows.has(id);
    const self: RenderRow<TRow> = { id, depth, kind: 'row', data: row, hasChildren, isExpanded };
    const nested =
      hasChildren && isExpanded
        ? buildExpansionRenderRows(children!, trackBy, expandedRows, childrenAccessor, depth + 1)
        : [];
    return [self, ...nested];
  });
}
```

Set once, read live signals inside:

```ts
store._buildRenderRows = (rows) =>
  buildExpansionRenderRows(rows, store.trackBy, store.expandedRows(), childrenAccessor);
```

## Implementation Notes

- `childrenAccessor` default: `(row) => (row as { children?: TRow[] }).children` — the one
  contained, documented cast (see ticket `decisions.md`), not spread anywhere else.
- No `manual` config (see `decisions.md` — spec's manual contract describes no behavior
  difference from default for this feature).
- `expandAll()`/`collapseAll()` must go through `patchState`, matching every other method in
  this store — never mutate `store.expandedRows()`'s `Set` in place.

## Risks / Watchouts

- If a future session composes `withExpansion()` with `withGrouping()` (not yet built),
  whichever feature runs later in the `features` array wins `_buildRenderRows` outright (plain
  prop assignment, last write wins) — `with-grouping.md`'s own design expects to _read_
  `store.expandedRows?.()` rather than fully own the builder, so that composition needs its own
  care when grouping actually lands. Not this step's problem, just flagging so it isn't a
  surprise later.

## Non-Goals

- `withGrouping()` (#7) — separate ticket.
- Any UI-layer directive (`ngpTableExpandToggle`, `docs/3-ui/directives/expansion.md`) — separate, UI-layer
  work, unblocked but not part of this state-layer step.
- Lazy-load UX / per-row loading state — spec explicitly leaves this unassigned (Open Questions).

## Acceptance Checks

- [ ] `expandedRows` signal reflects a `Set<RowId>`
- [ ] `toggleExpanded()`, `expandAll()`, `collapseAll()` work correctly
- [ ] Multiple rows can be expanded simultaneously; expanding one does not collapse others
- [ ] `rowExpanded` fires on every expand and every collapse
- [ ] `renderRows()` reflects `RenderRow<TRow>` with `isExpanded`/`hasChildren` as specced
- [ ] Rows with a `children` array expose their children in `renderRows()` output only when
      expanded (default: not expanded)
- [ ] Feature works with `createTable({ features: [withExpansion()] })` alone
- [ ] `nx typecheck shared-design-system` passes

---

[Step 2: index.ts barrel export](step-2-barrel-export.plan.md) →
