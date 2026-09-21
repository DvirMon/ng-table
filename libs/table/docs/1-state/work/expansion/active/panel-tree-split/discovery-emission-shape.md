# How do other table/grid libraries emit row-expansion change events — one per row id, or one batched event per action?

**Date:** 2026-09-20 · **Depth:** standard

## Answer

**No surveyed library emits N events for one batch expand/collapse action.** Eight of eight emit
at most one callback per user action; the majority carry a **full snapshot** of the open set
[S1][S11][S22], and AG Grid goes further by dispatching a batch action as a *single, id-less*
event that deliberately bypasses its own per-row event path [S6]. The repo's current
`Observable<RowId>` fan-out — `expandAll()` firing once per id [R1] — is the one shape nothing in
the category uses. **Angular CDK is a direct `{ added, removed }` precedent**: CDK Tree stores
expansion in a `SelectionModel`, whose `changed` stream is
`{ source, added: T[], removed: T[] }` — the same shape as this repo's `SelectionChange` [S15][R2]
— and `expandAll()` produces exactly one of them [S18]. Adopt the batched shape; CDK also shows
the per-row view event is *derived from* the batch, never the source of it [S18].

## Method

- Versions pinned from `registry.npmjs.org/<pkg>/latest` unless noted: `@tanstack/table-core@9.2.4`
  [S4], `ag-grid-community@36.2.0` [S24], `@mui/x-data-grid@9.14.0` [S25], `primeng@22.1.1` [S26],
  `antd@6.6.5` → `@rc-component/table@~1.11.1` [S27], `primereact@11.1.0` [S28].
- `@angular/cdk@22.1.7` read from the **installed** `node_modules` copy, which equals registry
  latest [S15][S16][S17][S18].
- **The brief says "TanStack v8"; registry latest is v9.** v9 ships no `src/`, so behavior was read
  from the v8.21.3 published source [S1][S2] and the shape re-confirmed against v9 `dist` types
  [S3]. Both lines agree.
- **PrimeReact v11.1.0 is a headless-primitive rewrite** whose DataTable props no longer live in
  `primereact/datatable`. The classic API was read at an explicit `primereact@10.9.7` pin [S21] —
  say "v10 line", not "PrimeReact", when citing it.
- Doc pages were used only where they add semantics the types don't carry [S13]; every
  per-row-vs-batch verdict comes from published source or `.d.ts`, never from a docs summary.

## Comparison

| Axis | TanStack 8/9 | AG Grid 36.2.0 | MUI X 9.14.0 (detail panel) | MUI X 9.14.0 (tree/group) | Angular CDK 22.1.7 | PrimeNG 22.1.1 | PrimeReact 10.9.7 | antd 6.6.5 / rc-table 1.11.1 |
|---|---|---|---|---|---|---|---|---|
| State is an explicit open-set | yes — `true \| Record<string, boolean>` [S1] | yes — `expandedRowGroupIds: string[]` [S9] | yes — `Set<GridRowId>` [S11] | no — per-node flag on `GridGroupNode` [S12] | yes — `SelectionModel<K>` [S17] | yes — `{ [key: string]: boolean }` [S19] | yes — array or key map [S21] | yes — `readonly Key[]` [S22] |
| Change event shape | snapshot (`Updater<ExpandedState>`) [S1][S2] | per-row `RowGroupOpenedEvent` [S5] + id-less `ExpandOrCollapseAllEvent` [S5] | snapshot `Set<GridRowId>` [S11] | per-row `GridGroupNode` [S12] | **diff `{ source, added, removed }`** [S15] | per-row `{ originalEvent, data }` [S20] | per-row + snapshot `onRowToggle` [S21] | per-row `onExpand` + snapshot `onExpandedRowsChange` [S22] |
| Batch action → how many events | 1 [S1] | 1, and **no** per-row events [S6] | n/a — no batch API found [S11] | n/a — no batch API [S13] | 1 [S18] | n/a — no expand-all API [S19] | n/a — controlled, silent [S21] | n/a — `defaultExpandAllRows` seeds silently [S23] |
| Emits N per-id events for a batch | no | no | no | no | no | no | no | no |

## TanStack Table — verdict: batched snapshot

- State is `type ExpandedState = true | Record<string, boolean>`; the table state slot is
  `expanded: ExpandedState` [S1]. v9 keeps it identical and adds
  `type ExpandedStateList = Record<string, boolean>` [S3].
- `onExpandedChange?: OnChangeFn<ExpandedState>` [S1], and
  `OnChangeFn<T> = (updaterOrValue: Updater<T>) => void` with
  `Updater<T> = T | ((old: T) => T)` [S2] — one invocation carrying the whole next state.
- `table.setExpanded = updater => table.options.onExpandedChange?.(updater)` — the change callback
  is the *only* thing a write does [S1].
- `toggleAllRowsExpanded` calls `setExpanded(true)` or `setExpanded({})` — one call, and
  expand-all never enumerates ids at all [S1].
- v9 documents `setExpanded` as "Updates expanded state with `true`, a row-id map, or an updater
  function" [S3].

## AG Grid — verdict: per-row for per-row actions, id-less action event for batch

- Two distinct events exist: `RowGroupOpenedEvent extends RowEvent<'rowGroupOpened'>` with
  `expanded: boolean` (one node), and
  `ExpandOrCollapseAllEvent extends AgGlobalEvent<'expandOrCollapseAll'>` with only
  `source: string` [S5].
- `setExpanded()` on one node dispatches one `rowGroupOpened`
  (`_createGlobalRowEvent(rowNode, this.gos, 'rowGroupOpened')`) [S7].
- **`expandAll(expand)` writes `rowNode._expanded = expand` directly inside a recursive walk, then
  dispatches exactly one `{ type: 'expandOrCollapseAll', source: expand ? 'expandAll' : 'collapseAll' }`** —
  it never routes through `setExpanded`, so **zero** `rowGroupOpened` events fire for an
  expand-all [S6]. This is the clearest deliberate avoidance of per-id emission found.
- Per-row events are additionally **queued and debounced**: `dispatchExpandedEvent` pushes onto
  `this.events`, and `dispatchExpandedEvents` later loops the queue dispatching one event per node
  plus one `dispatchStateUpdatedEvent()` [S6]. Batching is a delivery optimization; the payload
  stays per-row.
- The state slice is snapshot-shaped: `RowGroupExpansionState { expandedRowGroupIds: string[];
  collapsedRowGroupIds?: string[] }`, reachable as `GridState.rowGroupExpansion` [S9][S10].
  `RowGroupBulkExpansionState { expandAll: boolean | undefined; invertedRowGroupIds: string[] }`
  is the SSRM inverted form — "expand everything except these" [S9].
- `StateUpdatedEvent` carries `state: GridState` plus `sources: (keyof GridState | ...)[]` — a
  whole-state snapshot with a *provenance* list, not a diff [S5].
- Public API is verbs only, no expansion getter: `expandAll()`, `collapseAll()`,
  `setRowNodeExpanded(rowNode, expanded, expandParents?, forceSync?)`,
  `resetRowGroupExpansion()` [S8].

## MUI X Data Grid — verdict: batched snapshot (detail panel), per-row (tree/grouping)

- Detail panel is a controlled full set: `detailPanelExpandedRowIds?: Set<GridRowId>` with
  `onDetailPanelExpandedRowIdsChange?: (ids: Set<GridRowId>, details) => void`, documented as
  "Callback fired when the detail panel of a row is opened or closed" — one call, whole set [S11].
- Tree/grouping expansion is per-row: the grid event is
  `rowExpansionChange: { params: GridGroupNode }`, "Fired when the expansion of a row is changed"
  [S12]. Batch changes are expressed declaratively instead —
  `defaultGroupingExpansionDepth` ("If equal to -1, all the row children will be expanded") and
  `isGroupExpandedByDefault?: (node: GridGroupNode) => boolean` [S11], both applied at node
  creation, not as an action.
- The only programmatic write is per row: `apiRef.current.setRowChildrenExpansion()`, and the docs
  state it "emits a `rowExpansionChange` event" [S13]. No expand-all API is documented [S13].
- `rowGroupingModel` is **not** expansion — it is the grouping *criteria*; its callback
  `onRowGroupingModelChange?: (model: GridRowGroupingModel, details) => void` is documented as
  "Columns used as grouping criteria" and is itself a full-model snapshot [S14].

## Angular CDK Tree / Material — verdict: **batched diff `{ added, removed }`**

- `TreeControl.expansionModel: SelectionModel<K>` — CDK models expansion as a *selection* [S17].
  The new `CdkTree` without a `treeControl` builds its own: `this._expansionModel ??= new
  SelectionModel(true)` [S18].
- The event is a diff:
  ```ts
  readonly changed: Subject<SelectionChange<T>>;

  interface SelectionChange<T> {
    /** Model that dispatched the event. */
    source: SelectionModel<T>;
    /** Options that were added to the model. */
    added: T[];
    /** Options that were removed from the model. */
    removed: T[];
  }
  ```
  [S15]
- One emission per write call, carrying the accumulated diff — `_select`/`_deselect`/`_setSelection`
  each mark every value, then call `_emitChangeEvent()` once, which fires
  `this.changed.next({ source: this, added: this._selectedToEmit, removed: this._deselectedToEmit })`
  and clears both queues [S16].
- Batch actions are therefore one event each:
  `expandAll() { this.expansionModel.select(...this.dataNodes.map(...)) }` [S18],
  `collapseAll() { this.expansionModel.clear() }` [S18],
  `expandDescendants` / `collapseDescendants` likewise take one bulk `select(...)`/`deselect(...)`
  [S18].
- **The per-row event is derived from the batch, not the other way round.** `CdkTree` subscribes
  once to `expansionModel.changed` and fans it out:
  ```js
  _emitExpansionChanges(expansionChanges) {
    for (const added of expansionChanges.added) { nodes.get(added)?._emitExpansionState(true); }
    for (const removed of expansionChanges.removed) { ... }
  }
  ```
  feeding each `CdkTreeNode.expandedChange: EventEmitter<boolean>` [S18].
- There is also an explicit bulk-API carve-out for large sets:
  `readonly bulk: Readonly<{ select; deselect; setSelection }>`, added because the spread-based
  `select(...values)` hits browser argument limits [S15].
- A `SelectionModel` can be constructed with `_emitChanges = false`, suppressing `changed` for
  seeded/restored state; the constructor also clears `_selectedToEmit` after seeding
  `initiallySelectedValues` [S16] — the same intent as this repo's `emitEvent: false` [R1][R2].

## PrimeNG Table — verdict: per-row callback only, consumer-owned state, batch is silent

- State is a consumer-supplied map, one-way in: `expandedRowKeysInput: InputSignal<{ [s: string]:
  boolean }>` mirrored to a plain field `expandedRowKeys` [S19]. The published `.d.ts` declares
  **no** `expandedRowKeysChange` output — there is no two-way binding and no change stream for the
  set as a whole [S19].
- Events are per row and carry the row, not ids:
  `interface TableRowExpandEvent<RowData> { originalEvent: Event; data: RowData }`, with
  `TableRowCollapseEvent extends TableRowExpandEvent` [S20]; the outputs are
  `onRowExpand: OutputEmitterRef<TableRowExpandEvent<RowData>>` and
  `onRowCollapse: OutputEmitterRef<TableRowCollapseEvent>` [S19].
- The only expansion verbs are `toggleRow(rowData, event?)` and `isRowExpanded(rowData)` — **no
  expand-all/collapse-all method exists** [S19]. A consumer "expand all" means assigning
  `expandedRowKeys` wholesale, which fires neither output.
- `rowExpandMode: InputSignal<TableRowExpandMode>` ("multiple" / "single") is the only
  set-level rule [S19].

## PrimeReact DataTable (v10 line) — verdict: per-row **and** batched snapshot, same action

- Controlled state is the whole collection:
  `expandedRows?: DataTableValueArray | DataTableExpandedRows`, "A collection of rows or a map
  object row data keys that are expanded", where
  `interface DataTableExpandedRows { [key: string]: boolean }` [S21].
- `onRowToggle?(event: DataTableRowToggleEvent)` and
  `interface DataTableRowToggleEvent { /** Expanded rows. */ data: any[] | DataTableExpandedRows }`
  — the callback hands back the **entire new collection**, not the toggled row [S21].
- Alongside it, per-row `onRowExpand` / `onRowCollapse` take
  `DataTableRowEvent { originalEvent; data: DataTableValue }` [S21].
- Because the state is fully controlled, a consumer expand-all is a `setState` of the whole
  collection and invokes nothing [S21].

## Ant Design Table / rc-table — verdict: per-row **and** batched snapshot, same action

- `ExpandableConfig` carries both:
  `onExpand?: (expanded: boolean, record: RecordType) => void` and
  `onExpandedRowsChange?: (expandedKeys: readonly Key[]) => void`, with
  `expandedRowKeys?: readonly Key[]` / `defaultExpandedRowKeys?: readonly Key[]` /
  `defaultExpandAllRows?: boolean` [S22].
- There is exactly **one** trigger path, and it is single-record:
  ```js
  const onTriggerExpand = React.useCallback(record => {
    const key = getRowKey(record, mergedData.indexOf(record));
    ...
    setInnerExpandedKeys(newExpandedKeys);
    if (onExpand) { onExpand(!hasKey, record); }
    if (onExpandedRowsChange) { onExpandedRowsChange(newExpandedKeys); }
  }, [...]);
  ```
  Both callbacks fire once, for the same one-row action [S23].
- `defaultExpandAllRows` is applied only in the `useState` initializer via
  `findAllChildrenKeys(...)` — the bulk seed runs **outside** `onTriggerExpand` and fires neither
  callback [S23]. Same intent as an `emitEvent: false` restore [R1].
- No expand-all action API exists; a consumer sets `expandedRowKeys` wholesale [S22].

## Synthesis

- **Per-action, not per-id, is unanimous (8/8).** The disagreement is only about *payload*:
  snapshot (TanStack, MUI detail panel, rc-table, PrimeReact) vs. diff (CDK) vs. no payload at all
  (AG Grid's `expandOrCollapseAll`). Nobody disagrees about cardinality — which is the axis this
  repo is actually deciding.
- **AG Grid is the sharpest evidence**, because it *had* a per-row event and chose to skip it for
  batches: `expandAll` mutates `_expanded` directly and emits one id-less action event [S6][S7].
  A library with per-row semantics everywhere still refused per-row emission on a batch.
- **Angular CDK is the only `{ added, removed }` diff precedent — and it is an exact match.** Same
  framework, same ecosystem, and it reaches the shape by the same route this repo did: *expansion
  is modelled as a selection*, so the expansion event is literally `SelectionChange` [S15][S17].
  This repo already has `SelectionChange { added, removed }` on `withSelection()` [R2]; adopting
  it for expansion converges with the closest, most authoritative neighbour rather than diverging.
- **Two libraries ship both shapes at once** (rc-table, PrimeReact v10): a per-row event for "what
  did the user click" plus a set-level event for "what is open now" [S21][S22][S23]. That is a
  live counter-model to "pick one" — but in both, the set-level payload is a *snapshot*, and both
  fire together only because their only trigger is a single row.
- **CDK settles the per-row-directive worry.** A batched diff does not cost a per-row consumer
  anything: `CdkTree` subscribes once to the diff and re-emits per node from `added`/`removed`
  [S18]. The derivation is one-directional and cheap; the reverse (recovering "what one action
  did" from N per-id events) is not expressible at all.
- **Snapshot vs. diff, honestly:** a snapshot needs no mirror on the consumer side, which is why
  the React-shaped libraries pick it — their state is controlled. This repo is signal-shaped:
  current state is already readable from `expandedRows()` [R3], exactly as `selectedRows()` is
  [R2], so the stream's job is the *delta*, and the snapshot's advantage does not apply.
- **One shape worth stealing regardless:** TanStack's `ExpandedState = true | Record<...>` [S1]
  and AG Grid's `RowGroupBulkExpansionState { expandAll; invertedRowGroupIds }` [S9] both encode
  "all expanded" without enumerating ids. Neither is needed for the event, but both matter for
  `expandAll()` over lazily-loaded children, where the full id set is not knowable [R3].

## Against

- The majority payload is a **snapshot, not a diff** (5 of 8 that carry any payload) [S1][S11][S21][S22].
  If the goal were "match the category", the answer would be `Observable<ReadonlySet<RowId>>`, not
  `{ added, removed }`.
- AG Grid's batch event carries **no ids at all** [S5][S6] — a defensible third option: emit one
  event saying "a bulk expansion happened, re-read `expandedRows()`". Cheapest for very large sets.
- rc-table and PrimeReact keep a per-row event *alongside* the set-level one [S21][S22]. Dropping
  `Observable<RowId>` entirely removes a shape two shipped libraries still consider worth having —
  though both emit it only for genuinely single-row actions.

## Not researched

- PrimeVue 5.0.1 (Vue) — registry version obtained, API not read. Expected to mirror PrimeReact's
  `expandedRows` / `onRowToggle`, but unverified.
- Kendo UI for Angular, Syncfusion EJ2 TreeGrid, DevExtreme DataGrid, Handsontable NestedRows,
  SlickGrid grouping — no expansion-event claim rests on them.
- Whether AG Grid's debounced `rowGroupOpened` queue can ever coalesce, rather than dispatch one
  event per queued node — the loop in `dispatchExpandedEvents` dispatches per node [S6], but the
  enterprise SSRM expansion service was not read.
- Performance numbers for N-events-vs-1 at scale. No benchmark was found or run.

## Unverified

- MUI X detail panels have **no** expand-all API: inferred from the absence of one in the Pro props
  [S11] and the absence of any mention in the grouping docs [S13]. An `apiRef` method could exist;
  `gridDetailPanelApi.d.ts` returned 404 at the guessed path and was not located.
- PrimeNG has **no** `expandedRowKeysChange` output: a negative result from reading the published
  `types/primeng-table.d.ts` [S19]. Confirmed absent from that file; not cross-checked against the
  `fesm2022` bundle, which exceeded fetch limits.
- AG Grid's `dispatchStateUpdatedEvent()` inside `dispatchExpandedEvents` [S6] is assumed to emit
  the `StateUpdatedEvent` typed in [S5]; the method body itself was not read.

## Sources

| | Source | Version | Verified |
|---|---|---|---|
| S1 | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/RowExpanding.ts | 8.21.3 | yes — source read; `toggleAllRowsExpanded` calls `setExpanded` once, disproving any per-row fan-out |
| S2 | https://unpkg.com/@tanstack/table-core@8.21.3/src/types.ts | 8.21.3 | yes — source read (`Updater`, `OnChangeFn`) |
| S3 | https://unpkg.com/@tanstack/table-core@9.2.4/dist/features/row-expanding/rowExpandingFeature.types.d.ts | 9.2.4 | yes — types read; confirms the v8 shape survived the v9 rewrite |
| S4 | https://registry.npmjs.org/@tanstack/table-core/latest | 9.2.4 | yes — registry read; corrected the brief's "v8" framing |
| S5 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/events.d.ts | 36.2.0 | yes — types read (`RowGroupOpenedEvent`, `ExpandOrCollapseAllEvent`, `StateUpdatedEvent`) |
| S6 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-enterprise/src/rowHierarchy/csrmExpansionService.ts | b36.2.0 | yes — source read; showed `expandAll` bypasses `setExpanded` entirely, which the docs page [S13-equivalent] does not state |
| S7 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-enterprise/src/rowHierarchy/baseExpansionService.ts | b36.2.0 | yes — source read; one `rowGroupOpened` per `setExpanded` call |
| S8 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/api/gridApi.d.ts | 36.2.0 | yes — types read; no expansion getter on the public API |
| S9 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/interfaces/iExpansionService.d.ts | 36.2.0 | yes — types read; `gridState.d.ts` only imports these, it does not define them |
| S10 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/interfaces/gridState.d.ts | 36.2.0 | yes — types read (`rowGroupExpansion`, `ssrmRowGroupExpansion`) |
| S11 | https://unpkg.com/@mui/x-data-grid-pro@9.14.0/models/dataGridProProps.d.ts | 9.14.0 | yes — types read; `detailPanelExpandedRowIds` is `Set<GridRowId>`, and the doc comment's `@param {GridRowId[]}` contradicts its own signature |
| S12 | https://unpkg.com/@mui/x-data-grid@9.14.0/models/events/gridEventLookup.d.ts | 9.14.0 | yes — types read; `rowExpansionChange` params is a single `GridGroupNode` |
| S13 | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/row-grouping/row-grouping.md | v9.14.0 | yes — docs read at tag; states `setRowChildrenExpansion` emits `rowExpansionChange`, and documents no expand-all |
| S14 | https://unpkg.com/@mui/x-data-grid-premium@9.14.0/models/dataGridPremiumProps.d.ts | 9.14.0 | yes — types read; establishes `rowGroupingModel` is criteria, not expansion |
| S15 | node_modules/@angular/cdk/types/_selection-model-chunk.d.ts | 22.1.7 | yes — installed package read; `SelectionChange { source, added, removed }` and the `bulk` carve-out |
| S16 | node_modules/@angular/cdk/fesm2022/_selection-model-chunk.mjs | 22.1.7 | yes — bundle read; `_emitChangeEvent` fires once per write with accumulated queues — the types alone do not show cardinality |
| S17 | node_modules/@angular/cdk/types/tree.d.ts | 22.1.7 | yes — installed package read; `expansionModel: SelectionModel<K>` |
| S18 | node_modules/@angular/cdk/fesm2022/tree.mjs | 22.1.7 | yes — bundle read; `expandAll`/`collapseAll` are single bulk writes, and `_emitExpansionChanges` derives per-node events from the diff |
| S19 | https://unpkg.com/primeng@22.1.1/types/primeng-table.d.ts | 22.1.1 | yes — published types read; no expand-all verb, no `expandedRowKeysChange` |
| S20 | https://unpkg.com/primeng@22.1.1/types/primeng-types-table.d.ts | 22.1.1 | yes — published types read (`TableRowExpandEvent`, `TableRowCollapseEvent`) |
| S21 | https://unpkg.com/primereact@10.9.7/datatable/datatable.d.ts | 10.9.7 | yes — published types read; v11.1.0 moved these types out of this path, so the pin is the v10 line, not latest |
| S22 | https://unpkg.com/@rc-component/table@1.11.1/lib/interface.d.ts | 1.11.1 | yes — published types read (`ExpandableConfig`) |
| S23 | https://unpkg.com/@rc-component/table@1.11.1/lib/hooks/useExpand.js | 1.11.1 | yes — published source read; `defaultExpandAllRows` seeds state silently, which the type alone does not reveal |
| S24 | https://registry.npmjs.org/ag-grid-community/latest | 36.2.0 | yes — registry read |
| S25 | https://registry.npmjs.org/@mui/x-data-grid/latest | 9.14.0 | yes — registry read |
| S26 | https://registry.npmjs.org/primeng/latest | 22.1.1 | yes — registry read |
| S27 | https://registry.npmjs.org/antd/latest | 6.6.5 | yes — registry read; dependency is `@rc-component/table`, not `rc-table` |
| S28 | https://registry.npmjs.org/primereact/latest | 11.1.0 | yes — registry read |
| S29 | https://registry.npmjs.org/@angular/cdk/latest | 22.1.7 | yes — registry read; equals the installed copy |
| R1 | libs/table/src/api/features/expansion/state.ts | — | yes — read; `setExpanded` ends `added.forEach(id => changedSource.next(id))` plus the same for `removed` |
| R2 | libs/table/src/api/features/with-selection/feature.ts | — | yes — read; `SelectionChange`, `applyNextSelection` emits once per write |
| R3 | libs/table/src/api/features/with-expansion.ts | — | yes — read; `rowExpanded: Observable<RowId>` is the public member name, `expandAll`/`collapseAll` route through the store |
