# Expansion state & events: what four table libraries expose to consumers

Research date: 2026-09-06. Narrow follow-up to
[state-feature-competitive-audit/audit.md](../../../meta/archive/state-feature-competitive-audit/audit.md),
scoped to one question: **what expansion state does a table library hand its consumer, and
how does it notify them when that state changes — especially on bulk expand/collapse?**

Prompted by the `rowExpanded` bulk-verb gap: `expandAll()`/`collapseAll()` mutated
`expandedRows` without emitting, so a consumer subscribed to `rowExpanded` missed every bulk
change. Contract resolved as **emit once per affected id** — this audit is the supporting
context, gathered after the decision, and it does not overturn it.

## Inventory

| Library              | State exposed                                                                       | Change notification                                                                                       | Bulk expand/collapse notification                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| TanStack Table v8    | `state.expanded: ExpandedState` = `true \| Record<string, boolean>`                 | `onExpandedChange?: OnChangeFn<ExpandedState>` — **whole-state only**, no per-row event                   | `toggleAllRowsExpanded(expanded?: boolean)` fires `onExpandedChange` **once**, with the whole new state                                       |
| Material React Table | `state.expanded: Record<string, boolean> \| boolean` (TanStack's, re-exposed)       | `onExpandedChange` — whole-state only                                                                     | Same as TanStack. `enableExpandAll` (default `true`) only adds the header button                                                              |
| AG Grid              | Per-node: `node.expanded`, `node.setExpanded()`, walked via `api.forEachNode()`     | `rowGroupOpened` — "A row group was opened or closed", fires **per row**                                  | **Separate bulk event.** `expandOrCollapseAll` — "Fired when calling either of the API methods `expandAll()` or `collapseAll()`" — fires once |
| PrimeNG `p-table`    | `[(expandedRowKeys)]: {[key: string]: boolean}` keyed by `dataKey`; `rowExpandMode` | `onRowExpand` / `onRowCollapse` — **two separate events**, each `{ originalEvent: Event; data: RowData }` | No first-party bulk verb. Expand-all is consumer code writing `expandedRowKeys` through the two-way binding — which fires neither event       |

Sources: TanStack expanding API reference; Material React Table "Expanding Sub Rows" guide;
AG Grid Grid Events reference + master/detail master-rows page; PrimeNG
`primeng/table/table.interface.d.ts` (published package) for the event payload shapes.

### Verification notes

- PrimeNG's `TableRowExpandEvent` requires a non-optional `originalEvent: Event`, and
  `TableRowCollapseEvent extends TableRowExpandEvent` with no additions. A programmatic bulk
  path has no browser event to supply, which is the structural reason its expand-all cannot
  emit these. The bulk code path itself was not read — the claim rests on the interface, not
  on the implementation.
- AG Grid's per-row vs. once-per-batch split is quoted from the events reference; the exact
  interleaving (whether `rowGroupOpened` also fires for each node during `expandAll()`) was
  not confirmed.

## The read surface: what a consumer can _ask_, not just be told

The table above covers notification. The other half of the question is what state a consumer
can read, and at what granularity. The four libraries diverge more here than on events.

| Read concern                         | TanStack v8                                         | MRT                      | AG Grid                                                | PrimeNG                                                         | `libs/shared/table`                                   |
| ------------------------------------ | --------------------------------------------------- | ------------------------ | ------------------------------------------------------ | --------------------------------------------------------------- | ----------------------------------------------------- |
| Canonical container                  | `state.expanded: true \| Record<string, boolean>`   | same (TanStack's)        | none — state lives on each `RowNode` (`node.expanded`) | `expandedRowKeys: {[key: string]: boolean}`, keyed by `dataKey` | `expandedRows: Signal<Set<RowId>>`                    |
| "Is _this_ row expanded?"            | `row.getIsExpanded(): boolean`                      | same                     | `node.expanded`                                        | index `expandedRowKeys[key]`                                    | `expandedRows().has(id)`, plus `RenderRow.isExpanded` |
| "_Can_ this row expand?"             | `row.getCanExpand(): boolean`                       | `getRowCanExpand` option | `isRowMaster` callback                                 | template-driven, no predicate                                   | `isExpandable` config → `RenderRow.hasChildren`       |
| Expand-everything predicates         | `getIsAllRowsExpanded()`, `getIsSomeRowsExpanded()` | same                     | none documented                                        | none                                                            | **none**                                              |
| Override the derived answer          | `getIsRowExpanded?: (row) => boolean`               | same                     | `isMasterOpenByDefault`, `masterDefaultExpanded`       | —                                                               | **none**                                              |
| "Has this row _ever_ been expanded?" | —                                                   | —                        | —                                                      | —                                                               | `everExpanded: Signal<Set<RowId>>`                    |
| Ready-made toggle binding            | `row.getToggleExpandedHandler(): () => void`        | same                     | `node.setExpanded()`                                   | template `[pRowToggler]`                                        | `toggleExpanded(rowId)`                               |
| Server/manual mode                   | `manualExpanding`                                   | via TanStack             | SSRM (Enterprise)                                      | `[lazy]` + `onLazyLoad`                                         | **none**                                              |
| Expansion × pagination               | `paginateExpandedRows`                              | same                     | —                                                      | —                                                               | **none** (no pagination feature yet)                  |

Three things fall out of that grid:

- **Everyone but AG Grid exposes one keyed container, and we match.** `Set<RowId>` vs.
  `Record<id, boolean>` is cosmetic — both answer membership in O(1) and both are ergonomic
  to persist. Nobody exposes per-row state objects as the public surface except AG Grid, whose
  `RowNode` model is its whole architecture, not an expansion decision.
- **`everExpanded` has no counterpart anywhere.** All four force a consumer that wants
  lazy-then-persist detail panels to keep that ledger themselves. This is the one place the
  feature is genuinely ahead, and it is a direct consequence of the ADR-0012 panel/tree split
  being recognized here and not there (MRT keeps detail panels as a separate concept precisely
  because TanStack's expanded state can't express "opened once").
- **The two real gaps are derived predicates and an override hook.** `getIsAllRowsExpanded()`
  / `getIsSomeRowsExpanded()` exist in TanStack and MRT because a toolbar's expand-all button
  needs tri-state (all / some / none) to render correctly — ours has to recompute it by
  comparing `expandedRows().size` against a re-walk of the tree, which is exactly the
  duplicated derivation a store should own. `getIsRowExpanded` (TanStack) /
  `isMasterOpenByDefault` (AG Grid) let a consumer seed or override expansion from row data
  without imperatively calling `expandAll()` on load; we have no equivalent, so
  "expand the first level by default" is consumer boilerplate.

Neither gap blocks the event fix, and neither is being added here. Both belong to ADR-0012's
redesign of this surface — noted there rather than bolted on now.

## What this shows

**Three different answers exist, and each library is internally consistent about which one
it picked.**

1. **Whole-state, one notification** — TanStack, MRT. Works because the payload _is_ the
   state: a consumer diffs old vs. new to find what changed. The "which ids changed" question
   is pushed to the consumer.
2. **Per-row event plus a separate bulk event** — AG Grid. The per-row event stays
   per-row-honest, and bulk gets its own name rather than being flattened into N emissions.
3. **Per-interaction only** — PrimeNG. The event is a _UI event_ (it carries `originalEvent`),
   not a state-change event. Programmatic state writes deliberately notify nothing.

Nobody emits N per-row events from a bulk verb. That is worth naming plainly: the chosen
contract (option 1 of the three offered — emit once per affected id from
`expandAll()`/`collapseAll()`) is **not** what any of the four do.

## Why the choice still holds

The audit changes the framing, not the outcome, for three reasons specific to this codebase:

- **`rowExpanded` emits an id, not a state.** TanStack can notify once because its payload is
  the entire `ExpandedState`; a single `RowId` cannot carry a bulk change. Copying TanStack's
  "notify once" would mean changing the payload type, not just the emission count — that is
  ADR-scale, and `Observable<RowId>` is already shipped and consumed.
- **The documented purpose is lazy-loading children** (PRD #29: "so that I can lazy-load a
  row's children on first expand"). Both demo hosts subscribe to `rowExpanded` and fetch per
  id. A once-per-bulk event with no ids in it cannot drive that; the consumer would have to
  re-derive the id set from `expandedRows` — exactly the work the event exists to save.
- **PrimeNG's option 3 is closed to us.** `rowExpanded` has no `originalEvent`; it is already
  a state-change event, not a UI event. Narrowing it to "per-row interaction only" would
  leave programmatic expansion silently unobservable, which is the bug just fixed.

## Worth reconsidering later

AG Grid's shape (option 2 — keep the per-row event, add a distinct bulk event) is the one
that would age best if either of these becomes true:

- Bulk expansion grows large enough that N sequential `next()` calls are a real cost. A
  consumer can `bufferTime`/`debounce` today, but that is a workaround for a missing signal,
  not a design.
- A consumer needs to distinguish "the user opened this row" from "a toolbar opened
  everything" — currently indistinguishable, since both arrive as bare ids.

Neither is true yet, and adding `expandedAllChanged` before there is a consumer for it is
enumerated surface area with no payoff. Revisit as part of
[ADR-0012](../../../../../adr/0012-split-expansion-into-panel-and-tree.md), which is already
reopening this feature's public surface — a panel/tree split is the natural moment to decide
whether the event is one event or two.
