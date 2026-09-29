---
title: State Layer Reference — withTree()
type: architecture
version: 1.1
date: 2026-09-29
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
levels (that's `withGrouping()`'s mechanism). Input is flat: every node, at any depth, is its own
entry in `data()`, linked to its parent by a declared `parentId` (#167) — there is no nested
`children` array to build first. Claims the `'tree'` render stage only when `parentId` is
supplied; omitted gives a collapse-only instance (the shape `withGrouping()` composes for
collapsible groups) that claims no stage at all.

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
  parentOf(id: RowId): RowId | null;
  descendantsOf(id: RowId): RowId[];
}
```

No `everExpanded` here — that lazy-mount ledger is the panel's alone
([`withExpansion()`](expansion.md)).

`parentOf` and `descendantsOf` (#167) are read-only lookups resolved over **all of `data()`**,
not the pipeline's `rows()` view — a row a filter dropped still counts. `parentOf(id)` returns the
id's declared parent, or `null` for a root or an id not present in `data()`. `descendantsOf(id)`
returns every descendant at any depth, depth-first in `data()` order (parent before child),
never including `id` itself, or `[]` when `id` has none or isn't present. Neither ever reports —
only the `'tree'` render stage reports broken links. With no `parentId` configured, both are
unconditionally `null` / `[]`.

## Config

```ts
interface WithTreeConfig<TRow> {
  isExpandable?: (row: TRow) => boolean;
  initial?: readonly RowId[];
  parentId?: (row: TRow) => RowId | null | undefined;
  revealContextRow?: (row: TRow) => boolean;
}
```

`parentId` reads a flat row's declared parent id. `null` and `undefined` both mean root.
**Omitted: collapse-only** — no row tree, no `'tree'` render stage claimed, and no fallback to a
conventional field (E6/E16/D1 — there is no default `parentId`; a consumer wanting the tree
behavior always passes the accessor explicitly). `childrenAccessor` — the old nested-`children`
path — was removed with no deprecation window (#167, D1/D3); see
[Migration: nested `children` → flat `parentId`](#migration-nested-children--flat-parentid) below.

`isExpandable` decides whether a row renders the expand toggle independently of whether its
children are loaded — for lazy-loaded children, where a row's children legitimately don't exist
in `data()` yet until the row has been opened once. Defaults to "some other row's `parentId`
resolves to this row."

`initial` seeds the open set at construction, same contract as `withExpansion()`'s — a plain
array, read once, emits nothing on `changed`.

## Behavior

- **Real-row parents only (E5).** Every tree node, at any depth, is an entry in the flat
  `data()` array — there is no `getDataPath`-style invented-parent support. A tree built from
  paths is filed against `withGrouping()` as a variable-depth level source, never against this
  feature.
- **Collapse-only shape.** Omit `parentId` and the feature is pure open/closed id tracking with
  no row synthesis — no `'tree'` render stage claimed, so it composes freely alongside
  `withGrouping()`'s `'group'` stage on the same table. This is exactly what collapsible grouping
  is: `createTable(config, withGrouping(schema), withTree())`.
- **Sibling order follows sort.** The `'tree'` stage nests over its own input order — already
  pipeline-sorted — so a sibling list at any depth follows the table's active sort, not id order
  or declaration order.
- **Composes with grouping.** Group headers (`data === null`) pass through the `'tree'` stage
  unchanged; nesting happens only inside each header's own member list — a child never crosses
  into a sibling group. Grouping a tree groups **roots only** (TR16): each level's value is read
  from the row's root, so a subtree never splits across groups. Group counts, `rowsOf` and
  `aggregateFn` include descendants; rows keep input order inside a bucket (TR17, TR18, TR29).
- **Broken-link degrade (D4/D12, ADR-0014).** A self-parent, a parent id absent from `data()`, or
  a cycle (the first row of the cycle in input order) degrades that row to a root with its own
  subtree intact — never dropped, never orphaned silently. A throwing `parentId` degrades the same
  way. Each kind is reported once per evaluation (not once per row), through `console.error`, in
  production as well as dev — and only by the `'tree'` render stage; `expand()`/`state()`'s own
  discovery walk (below) degrades identically but never reports, to avoid logging the same data
  problem twice. Removing a parent from `data()` is not special-cased (D12): its children simply
  resolve as roots on the next evaluation.
- **Discovery walk.** `expand()` with no `ids` scans flat `data()` for every row some other row's
  `parentId` names as parent, unioned with any `ids` passed explicitly (e.g. `table.groupIds()`
  from `withGrouping()`). Broken links degrade the same way as the render stage but are never
  reported here.
- **`state` — tri-state.** `'all'` when every expandable row (per the same discovery walk) is
  open, `'none'` when none is — including "nothing is expandable," which is what a
  collapse-only instance always reads. Answers "are all rows expanded?" without a consumer
  re-walking the tree themselves.
- **Degrading callbacks (ADR-0014).** A throwing `isExpandable` is a runtime, data-dependent
  failure — it degrades rather than throws. The affected row renders without a toggle for that
  evaluation, and the failure is reported once per evaluation (not once per row), in production as
  well as dev. `parentId` has its own degrade rule, above.
- **Silent parent link for other stages (ADR-0028).** `withTree({ parentId })` also contributes a
  total, silent `parentLink` to every pipeline/render stage's context (`ctx.parentOf`) — a throw
  or `undefined` return maps to `null`, same as the tree stage, but this contribution never
  reports; only the `'tree'` stage does. This is the seam `withFiltering()` and
  `withGrouping()` read to see the hierarchy without each re-deriving it. Feature factories
  receive the same context as their second argument, `(input, ctx)` (TR26).

## Methods

| Method | Description |
|---|---|
| `table.tree.toggle(rowId, options?)` | Toggle a single row's open state. Emits `changed` once. |
| `table.tree.expand(ids?, options?)` | Adds. Omitted `ids`: every expandable row found by the discovery walk over the filtered view, unioned with what's already open. `options.includeHidden` scans all of `data()` instead (D8, D26). |
| `table.tree.state(options?)` | Read-only. `'all'`, `'some'` or `'none'` over the expandable rows of the filtered view; `{ includeHidden: true }` reads all of `data()` (D26). |
| `table.tree.contextRowIds()` | Read-only signal. Every row a filter retains as context, including rows hidden under a collapsed parent. Empty when nothing contributes. |
| `table.tree.collapse(ids?, options?)` | Removes. Omitted `ids`: everything currently open. |
| `table.tree.set(ids, options?)` | Atomic replace — the restore path. |
| `table.tree.parentOf(id)` | Read-only. The id's declared parent, or `null` for a root or an unknown id. Never reports. |
| `table.tree.descendantsOf(id)` | Read-only. Every descendant at any depth, depth-first in `data()` order, never including `id` itself. Never reports. |

Every write verb takes `options?: ExpansionWriteOptions` (`{ emitEvent?: boolean }`) — see
`expansion.md`'s [Silent writes](expansion.md#silent-writes-emitevent-false); the shape and
reasoning are identical.

### Cascade delete

`table.tree` has no delete method of its own — deleting a subtree is one
`table.value` write built from `descendantsOf` (see
[Row Mutations](../row-mutations.md#shipped-updaters)):

```ts
table.value.update(removeRow([id, ...table.tree.descendantsOf(id)]));
```

Removing only the parent (`removeRow(id)`) is not a cascade — its children stay in `data()` and
resolve as roots on the next read (D12).

## Compile-Time Dependencies

None. Composes with `withGrouping()` and `withExpansion()`, in any order — each is a
separately-keyed `createExpansionStore()` instance, so `claimMember()` never collides
(ADR-0007) and neither feature reads the other's state.

## Render Layer

Claims the `'tree'` render stage ([ADR-0011](../../adr/0011-chained-render-stages.md)) **only
when `parentId` is supplied** — a collapse-only instance leaves the single-claim stage free for
`withGrouping()`'s `'group'` stage or a future claimant. The stage resolves every row's parent
over its own input nodes (`engine/tree-links.ts`'s `resolveTreeLinks`) and nests a row's children
beneath it in the tree IR (`RenderNode.children`); it does not itself decide visibility. It also
claims the parent link slot ([ADR-0028](../../adr/0028-tree-parent-link-slot.md)) — a second
feature contributing either the `'tree'` stage or the parent link throws at construction
(ADR-0007).

**Visibility is `engine/flatten.ts`'s `flattenVisible` walk**, not this stage — it is the only
place in `src` that reads the unioned `expandedRows` slot and derives `depth`, `parentId`,
`hasChildren`, and `isExpanded` from a node's position in the tree (ADR-0023). `withTree()`
contributes unconditionally to that union (accessor or not — a collapse-only instance is
exactly what hides a group header's members, and the walk needs a defined set to do it).

**`hasChildren` follows the filtered view (D9).** The walk reads the pipeline's `rows()`, not
`data()`, so a parent whose children were all filtered out renders `hasChildren: false` — no
toggle for a branch with nothing to show. `isExpandable` still overrides it, as for lazy loading.

**G6 is closed as impossible, not fixed.** `indexById` is built from `data()`, and under the
real-row contract every tree node is already an entry there — so a nested child at any depth
resolves a `sourceIndex` and edits write through by construction. ADR-0012's original Decision 6
assumed the fix belonged to the `'tree'` render stage; it does not, because `sourceIndex` was
never stamped by a render stage in the first place.

## Context rows

A filtered tree keeps each match's ancestors so the match renders under its path (see
[filtering.md](filtering.md#trees--matches-keep-their-ancestors)). An ancestor kept only for
that reason is a **context row** (D18):

- **`RenderRow.isContextRow`** — `true` on a context row, `false` on any other data row once a
  feature contributes the engine's accumulating `contextRows` slot (today, `withFiltering()`).
  `undefined` when nothing contributes, and always `undefined` on a synthesized group row.
  Stamped centrally by the core, beside `index` and `sourceIndex`.
- **`ngpTableTreeRow`** — an opt-in directive on the row host
  (`tr[ngpTableRow][ngpTableTreeRow]`, `div[ngpTableRow][ngpTableTreeRow]`) that reflects the
  flag as a presence-only `data-context-row` attribute (D21, ADR-0026 rule 1): `""` on a context
  row, absent otherwise, removed when the row stops being one. It reads the row from
  `ngpTableRow` and takes no input of its own; the core row directive is unchanged.

```html
<tr [ngpTableRow]="row" ngpTableTreeRow>…</tr>
```
```css
tr[data-context-row] { opacity: 0.6; }
```

Tree indentation, `aria-level` and the toggle are out of this directive's scope.

### Reveal

While a filter is active, context rows render expanded so no match hides under a collapsed
parent (D20). Reveal is a derived visibility source: the tree's contributed open set is
(open set ∪ revealed context rows) − closed-while-revealed. It never writes the open set, so
`table.tree()` is unchanged and `changed` does not fire; clearing the filter restores the
person's own open set exactly.

- **`revealContextRow`** — `(row) => boolean` on the `withTree()` config picks which context
  rows reveal. Default: all. `() => false` turns reveal off. A throw reveals that row and reports
  once per evaluation (ADR-0014, D28).
- **Closing a revealed row** — `toggle(id)` on a revealed row closes it without writing the open
  set or firing `changed`. The id stays closed only while its row is a context row, so it clears
  itself when the row stops being context or the filter clears.
- **Open-set writes** — `expand(ids)`, `expand()` and `set(ids)` also drop the ids they name from
  the closed set, so the row shows open. `collapse` writes only the open set (D28).

```ts
const table = createTable(data, { trackBy: 'id', columns }, withFiltering(...), withTree({
  parentId: (row) => row.parentId,
  revealContextRow: (row) => row.kind === 'folder',
}));

table.tree.contextRowIds();                        // ReadonlySet<RowId>
table.tree.expand();                               // filtered view only
table.tree.expand(undefined, { includeHidden: true }); // all of data()
table.tree.state({ includeHidden: true });         // 'all' | 'some' | 'none'
```

## Events Owned

- `table.tree.changed: Observable<ExpansionChange>` (`{ added: RowId[]; removed: RowId[] }`) —
  one emission per write, carrying the whole symmetric difference. Same contract as
  `table.expansion.changed`; see [expansion.md](expansion.md#events-owned).

## Migration: nested `children` → flat `parentId`

`childrenAccessor` was removed with no deprecation window (#167, D1/D3). Every node must be its
own flat entry in `data()`, carrying its own parent id:

```ts
// before (removed)
withTree({ childrenAccessor: (row) => row.children })

// after
withTree({ parentId: (row) => row.parentId })
```

```ts
// before: nested rows
const rows = [{ id: 'r1', children: [{ id: 'c1' }] }];

// after: flat rows, parent linked by id
const rows = [
  { id: 'r1', parentId: null },
  { id: 'c1', parentId: 'r1' },
];
```

## Open Questions

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
