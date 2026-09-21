---
title: State Layer Reference — withTree()
type: architecture
version: 1.0
date: 2026-09-21
capability: tree
spec: drilled
code: shipped
audience: developers
parent: ../architecture.md
---

# withTree()

The **tree-grid** feature — a real row tree: expanding a parent reveals its children as rows
with the same columns, at any depth. Split from the detail-panel case by
[ADR-0012](../../adr/0012-split-expansion-into-panel-and-tree.md) (`accepted`); the panel half
is [`withExpansion()`](expansion.md).

## Executive Summary

Multi-expand, hierarchical row expansion: sub-rows share columns with their parent, unlike a
detail panel's arbitrary markup. Real-row parents only — no invented parents, no path-derived
levels (that's `withGrouping()`'s mechanism). Claims the `'tree'` render stage only when a
`childrenAccessor` is supplied; omitted gives a collapse-only instance (the shape
`withGrouping()` composes for collapsible groups) that claims no stage at all.

## State Shape

`table.tree` is one callable slice (ADR-0015), the same shape as `table.expansion`:

```ts
interface TreeSlice {
  (): ReadonlySet<RowId>;
  readonly changed: Observable<ExpansionChange>; // { added: RowId[]; removed: RowId[] }
  readonly state: Signal<'all' | 'some' | 'none'>;
  toggle(id: RowId, options?: ExpansionWriteOptions): void;
  expand(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  collapse(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  set(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
}
```

No `everExpanded` here — that lazy-mount ledger is the panel's alone
([`withExpansion()`](expansion.md)).

## Config

```ts
interface WithTreeConfig<TRow> {
  childrenAccessor?: (row: TRow) => TRow[] | undefined;
  isExpandable?: (row: TRow) => boolean;
  initial?: readonly RowId[];
}
```

`childrenAccessor` reads a row's nested children. **Omitted: collapse-only** — no row tree, no
`'tree'` render stage claimed, and no `row.children` fallback (E6/E16 — the old default
`(row) => row.children` is gone; a consumer wanting the tree behavior always passes the
accessor explicitly).

`isExpandable` decides whether a row renders the expand toggle independently of whether its
children are loaded — for lazy-loaded children, where `childrenAccessor` legitimately returns
`undefined`/`[]` until the row has been opened once. Defaults to "non-empty array from
`childrenAccessor`".

`initial` seeds the open set at construction, same contract as `withExpansion()`'s — a plain
array, read once, emits nothing on `changed`.

## Behavior

- **Real-row parents only (E5).** Every tree node, at any depth, is an entry in the flat
  `data()` array — there is no `getDataPath`-style invented-parent support. A tree built from
  paths is filed against `withGrouping()` as a variable-depth level source, never against this
  feature.
- **Collapse-only shape.** Omit `childrenAccessor` and the feature is pure open/closed id
  tracking with no row synthesis — no `'tree'` render stage claimed, so it composes freely
  alongside `withGrouping()`'s `'group'` stage on the same table. This is exactly what
  collapsible grouping is: `createTable(config, withGrouping(schema), withTree())`.
- **Discovery walk.** `expand()` with no `ids` walks `childrenAccessor` recursively to collect
  every expandable row's id (only recursing into rows whose children are already loaded — a
  lazy row still expands, its own descendants just aren't discoverable until fetched), unioned
  with any `ids` passed explicitly (e.g. `table.groupIds()` from `withGrouping()`).
- **`state` — tri-state.** `'all'` when every expandable row (per the same discovery walk) is
  open, `'none'` when none is — including "nothing is expandable," which is what a
  collapse-only instance always reads. Answers "are all rows expanded?" without a consumer
  re-walking the tree themselves.
- **Degrading callbacks (ADR-0014).** A throwing `childrenAccessor` or `isExpandable` is a
  runtime, data-dependent failure — it degrades rather than throws. The affected row renders
  without children / without a toggle for that evaluation, and the failure is reported once per
  evaluation (not once per row), in production as well as dev.

## Methods

| Method | Description |
|---|---|
| `table.tree.toggle(rowId, options?)` | Toggle a single row's open state. Emits `changed` once. |
| `table.tree.expand(ids?, options?)` | Adds. Omitted `ids`: every expandable row found by the discovery walk, unioned with what's already open. |
| `table.tree.collapse(ids?, options?)` | Removes. Omitted `ids`: everything currently open. |
| `table.tree.set(ids, options?)` | Atomic replace — the restore path. |

Every write verb takes `options?: ExpansionWriteOptions` (`{ emitEvent?: boolean }`) — see
`expansion.md`'s [Silent writes](expansion.md#silent-writes-emitevent-false); the shape and
reasoning are identical.

## Compile-Time Dependencies

None. Composes with `withGrouping()` and `withExpansion()`, in any order — each is a
separately-keyed `createExpansionStore()` instance, so `claimMember()` never collides
(ADR-0007) and neither feature reads the other's state.

## Render Layer

Claims the `'tree'` render stage ([ADR-0011](../../adr/0011-chained-render-stages.md)) **only
when `childrenAccessor` is supplied** — a collapse-only instance leaves the single-claim stage
free for `withGrouping()`'s `'group'` stage or a future claimant. The stage nests a row's
children beneath it in the tree IR (`RenderNode.children`); it does not itself decide
visibility.

**Visibility is `engine/flatten.ts`'s `flattenVisible` walk**, not this stage — it is the only
place in `src` that reads the unioned `expandedRows` slot and derives `depth`, `parentId`,
`hasChildren`, and `isExpanded` from a node's position in the tree (ADR-0023). `withTree()`
contributes unconditionally to that union (accessor or not — a collapse-only instance is
exactly what hides a group header's members, and the walk needs a defined set to do it).

**G6 is closed as impossible, not fixed.** `indexById` is built from `data()`, and under the
real-row contract every tree node is already an entry there — so a nested child at any depth
resolves a `sourceIndex` and edits write through by construction. ADR-0012's original Decision 6
assumed the fix belonged to the `'tree'` render stage; it does not, because `sourceIndex` was
never stamped by a render stage in the first place.

## Events Owned

- `table.tree.changed: Observable<ExpansionChange>` (`{ added: RowId[]; removed: RowId[] }`) —
  one emission per write, carrying the whole symmetric difference. Same contract as
  `table.expansion.changed`; see [expansion.md](expansion.md#events-owned).

## Open Questions

- [ ] **Cycle guarding on `childrenAccessor`.** A row that reaches itself still overflows;
  noted on #105 and unchanged here.
- [ ] **A tree built from paths** (`getDataPath`, invented parents). Filed against grouping as
  a variable-depth level source if a consumer ever needs it, never against `withTree()`.
- [ ] Precise lazy-load UX contract (e.g. a per-row loading indicator) not addressed.

---

## Competitive position

**Verdict: on par.** Sub-rows and tree data match TanStack (`getSubRows`) and Material React
Table; the real-row-only contract matches AG Grid's Tree Data stance of taking flat `rowData`
rather than requiring nesting. See [expansion.md](expansion.md#competitive-position) for the
panel-side verdict.

Full reasoning: [gap-analysis.md](../work/meta/archive/state-feature-competitive-audit/gap-analysis.md).
