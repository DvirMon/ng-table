# ADR-0012 — Split `withExpansion()` into a detail-panel feature and a `withTree()` feature

**Status:** accepted
**Date:** 2026-09-03
**Related:** [ADR-0011](0011-chained-render-stages.md) (supplies the render stage `withTree()`
claims), [ADR-0006](0006-row-id-state-reconciliation.md) (`onRowsRemoved` pruning),
[ADR-0007](0007-feature-member-claims.md) (member claims)

## Context

"Expansion" names two different features that happen to share one word in the UI.

```
TREE-GRID (sub-rows)                DETAIL PANEL (master/detail)
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ ▼ Electronics │ 1200 │ 2024  │    │ ▼ Order #401  │ $90  │ Sent  │
│   ▼ Laptops   │  800 │ 2024  │    ├──────────────────────────────┤
│     MacBook   │  500 │ 2024  │    │  ┌────────────────────────┐  │
│   Phones      │  400 │ 2024  │    │  │  Shipping timeline     │  │
│ ▶ Furniture   │  600 │ 2024  │    │  └────────────────────────┘  │
└──────────────────────────────┘    └──────────────────────────────┘
 children = MORE ROWS                expanded = ARBITRARY UI
 same columns, indented              one wide cell, no columns
```

The distinguishing test: **does the expanded content have the same columns as its parent?**
Yes → it is a row (tree). No → it is markup (panel).

That test maps onto sharply different state-layer footprints:

| | Tree-grid | Detail panel |
|---|---|---|
| Expanded content is | rows in the row model | consumer's markup |
| Table must sort / filter / edit it | **yes** | no |
| Data lives in | the table's `data()` | consumer's own state, fetched on demand |
| Needs `depth` | yes | no |
| Needs `sourceIndex` to write edits | **yes** | no |
| State layer needs | open ids **+ children accessor + row synthesis** | open ids **only** |

Both need identical open/closed-id machinery. Only tree needs to synthesize rows.

### What we actually shipped

`withExpansion()` today is the **tree** feature, despite `features/expansion.md` describing it as
serving both. It takes `childrenAccessor?: (row: TRow) => TRow[] | undefined` (defaulting to
`row.children`) and declares a `renderRows` builder that recursively flattens expanded children
at `depth + 1`. The spec is explicit that panels are *not* part of it:

> **Hierarchical/tree support:** rows may carry a `children: Row[]` property; expanding a row
> reveals its nested children recursively (tree-grid style), not just a flat detail panel.

…and that panel content "never enters `renderRows()`" — it is consumer markup gated on
`everExpanded`.

So the panel case is already, correctly, a UI concern needing nothing but open-id tracking. But a
consumer who wants **only** panels must still compose the tree feature to get that tracking — and
in doing so burns the single `renderRows` slot (pre-ADR-0011) on a recursive walk they never
invoke, permanently blocking `withGrouping()` on that table.

Two further facts sharpen this:

- **Nothing composes the tree path outside tests.** No story composes `withExpansion()`;
  `buildDefaultRenderRows` hardcodes `depth: 0`; `depth > 0` appears only in
  `with-expansion.spec.ts`, `compose-table.spec.ts`, `core.spec.ts`, and `table.mock.ts`.
- **Tree data is not required to arrive nested.** AG Grid's Tree Data takes *flat* `rowData` plus
  `getDataPath(): string[]`; TanStack takes root rows plus `getSubRows`, which may scan a flat
  array. Nested-in is a convenience, never the contract — so `childrenAccessor` being the only
  accepted shape is itself a narrowing we should not bake into the feature's identity.

### Prior art disagrees, and the engine breaks the tie

- **TanStack** unifies: one `getExpandedRowModel()`, forked by config — `getSubRows` for tree vs
  `getRowCanExpand: () => true` plus consumer-rendered detail UI. It has no single-slot
  constraint to respect.
- **AG Grid** splits: Tree Data and Master/Detail are separate features with separate options
  (`treeData`/`getDataPath` vs `masterDetail`/`getDetailRowData`), and are not combinable.
- **Angular CDK** has only the panel case — `multiTemplateDataRows`, flat data, fully
  consumer-owned, no table-side state at all.

Our engine has AG Grid's constraint (named render stages are single-claim even after ADR-0011),
so it takes AG Grid's split.

## Decision

1. **`withExpansion()` becomes the detail-panel feature.** Open/closed id tracking only —
   members, no render stage, no `childrenAccessor`. It keeps the existing exported name because
   panel expansion is the common case and the name reads correctly for it.
2. **`withTree()` is new** and owns everything tree-specific: `childrenAccessor`, `isExpandable`,
   and the `'tree'` render stage from ADR-0011. `depth` itself is engine-owned since ADR-0023 —
   derived by `flattenVisible`'s walk from a node's position, not stamped by any feature's stage.
3. **Shared open-id machinery is extracted to `createExpansionStore()`** — a factory, **not a
   feature**, following the `api/features/editing-state.ts` precedent (D37/A2): `withOptimistic()`
   and `withRowEdit()` each call `createEditingStore()`, so neither reads the other's signal and
   composition never depends on `features` order. Each of `withExpansion()` and `withTree()` calls
   the factory independently and declares its own members under its own keys, so composing both on
   one table does not trip `claimMember()` (ADR-0007).
4. **Both features declare `onRowsRemoved`** and prune their id sets via `pruneByIds()`, per
   ADR-0006. This is the substantive reason panel state lives in the store at all rather than in a
   consumer's own `Set`.
5. ~~**Group collapse delegates to `withExpansion()`**, not `withTree()`. `features/expansion.md`'s
   "dual use" note — group ids sharing the `expandedRows` set — stops being a hack: a collapsed
   group is open-id tracking with no row synthesis, which is exactly the panel feature's job.~~
   **Reversed.** The panel declares no `renderStages` and no `expandedRows` contribution
   (D8/E12) — it is deliberately invisible to the flatten walk, so it cannot carry collapse
   state for anything the walk renders. Group collapse delegates to **`withTree()`** instead:
   `createTable(config, withGrouping(schema), withTree())`. `features/expansion.md`'s "dual
   use" note is retired, not resolved as originally framed here — see
   [`2-spec.md` §Grouping](../1-state/work/expansion/active/panel-tree-split/2-spec.md).
6. ~~**[G6](../1-state/work/row-editing/active/with-row-editing/5-gaps.md) is `withTree()`'s to fix.** Nested children
   get `data` but no `sourceIndex` (`indexById` is built from top-level `data()` only), so
   `ngp-table-row-field.resolve.ts` returns `null` and edits silently no-op on them. Under
   ADR-0011 this is a property of the `'tree'` render stage, and G6 is neither invalid nor a
   state-layer overreach into UI — it is a correctness bug in a feature nothing currently composes.~~
   **Superseded — closed as impossible, not fixed.** `withTree()` ships real-row parents only
   (E5): every tree node, at any depth, is already an entry in `data()`, so `indexById` resolves
   a `sourceIndex` for it by construction. There is no invented-parent case left for a render
   stage to stamp, and `sourceIndex` was never something a render stage stamps in the first
   place. See [`2-spec.md` §Further Notes, "G6 is closed as impossible, not
   fixed"](../1-state/work/expansion/active/panel-tree-split/2-spec.md).

## Alternatives considered

| Option | Why not |
|---|---|
| One feature, two modes — tree when `childrenAccessor` is passed, panel when omitted (TanStack's shape) | Claims a render stage conditionally on config, so whether the table can also compose `withGrouping()` depends on an options object rather than on which features are listed. Panel-only consumers still ship the recursive walk |
| Keep `withExpansion()` as tree, name the new one `withRowDetail()` | Rejected in discussion. Panel expansion is the far more common consumer need; the widely-understood reading of "expansion" is the panel, and tree tables are the specialist case that deserves the explicit name |
| Drop the tree feature entirely; support only flat data + consumer panels | Considered and rejected — tree-grid is a stated goal. Also inconsistent to keep the recursive flatten in the codebase while declaring the contract panel-only: that leaves a feature rendering children it cannot edit |
| Leave panel state entirely to the consumer (CDK's approach — no feature at all) | Loses `onRowsRemoved` pruning (ADR-0006), so deleting an open row orphans its id, and loses `data-*` wiring on the row directive. This is the weakest part of the case for a panel feature, but pruning alone earns it |
| Share one `createExpansionStore()` instance between both features (the editing-state pattern verbatim) | Editing shares one store so the two features see each other's state. Here a tree-expanded row and an open detail panel are semantically different states that should not collide in one set — so each feature gets its own instance. What actually prevents the two states from colliding on render is the **union `flattenVisible` reads**, not instance separation: the panel declares no `renderStages` and no `expandedRows` contribution at all (D8/E12), so it has nothing to contribute to that union regardless of how many store instances exist. Separate instances keep the two id sets from overwriting each other's writes; the union contract is what keeps an open panel from revealing rows |

## Consequences

**Gained**
- Panel-only tables claim no render stage, so they compose freely with `withGrouping()` and
  `withPagination()`.
- Tree-shaking: panel consumers do not ship the recursive flatten.
- `features/expansion.md`'s "dual use" ambiguity is resolved structurally rather than by note.
- G6's scope collapses from "the engine's index model is wrong" to "one render stage must carry
  `sourceIndex`."

**Cost**
- **Consumer-breaking.** Anyone passing `childrenAccessor` / `isExpandable` to `withExpansion()`,
  or reading `expandedRows` / `rowExpanded` / `everExpanded` expecting tree semantics, must move
  to `withTree()`. No in-repo consumer does — no story composes `withExpansion()` — but it is a
  public `index.ts` export, so it is a breaking change on paper.
- `features/expansion.md` splits into two specs; `features/grouping.md`'s delegation note
  re-points at the panel feature. `docs/1-state/prd.md` still carries the superseded
  "`withGrouping()` requires `withExpansion()` at compile time" framing in user stories 10, 23 and
  31 — already downgraded to optional runtime composition on 2026-07-31 — and should be corrected
  in the same pass.
- Ordering: this ADR depends on ADR-0011 for the `'tree'` render stage. Sequence is ADR-0011
  first, then this, then G6 nearly falls out.

**Verification plan**
- Composing `[withGrouping(), withTree()]` constructs without throwing, in either argument
  order — the collapsible-grouping composition this ADR settles on.
- Composing `[withExpansion(), withTree()]` constructs without throwing (no `claimMember()`
  collision between the two id sets).
- `withExpansion()` alone declares no render stage: `renderRows()` is 1:1 with `rows()` and every
  row has `depth === 0`.
- `withTree()` reproduces the existing `with-expansion.spec.ts` tree assertions (`r1 → c1 → g1`,
  `depth` 1 and 2) unchanged.
- Deleting an open row prunes its id from both features' sets (ADR-0006 regression).
- After G6: a `depth > 0` row resolves a non-`null` field tree in
  `ngp-table-row-field.resolve.ts`, and an edit to a nested child writes through.
