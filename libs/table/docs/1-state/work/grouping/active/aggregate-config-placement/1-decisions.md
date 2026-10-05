# Decisions — aggregate config placement (#100 slice: `aggregateFn`)

- 2026-09-19 — Scope: this grill narrows #100 to the `aggregateFn` field only
  (not `sortFn`/`enableSorting`/`applySortNulls`/`visible`, which #100 also
  covers but which are separate decisions).
- 2026-09-19 — Aggregation stays a grouping-owned concept. No separate
  `withAggregation()` feature. Rationale: `computeAggregates`
  (`engine/grouping.ts:169-178`) is the only producer/consumer of aggregates
  in `src/` today; every "footer" hit in this repo's own
  `research-grouping-community-pain.md` is about a grouped-footer row, not a
  standalone whole-table footer; no open issue or backlog doc asks for
  non-grouped aggregation. No roadmap intent for a whole-table footer either
  (confirmed with user). Revisit if that ever becomes a real ask — the
  reducer signature (`(rows) => T`) doesn't change on extraction, only where
  it's declared.
- 2026-09-19 — `applyAggregate` is declared through `GroupingPath` (row-field
  keyed), inside `withGrouping()`'s own schema fn — same channel as
  `applyGrouping`/`applyGroupOrder`/`applyGroupKey`, not through
  `columnSchema()`'s column-id-keyed `ColumnsPath`. Consistent with D7
  (ADR-0019 amendment): a feature's schema fn names row fields, only
  `TableConfig.columnsSchema` names declared column ids.
  Reopened and reconfirmed same day: an initial counter-example
  (`{ id: 'commission', accessor: row => row.amount * 0.1 }` — a derived
  column with no backing row field) was raised, since it can't be named via
  `GroupingPath` at all, and since `buildGroupCells` (`engine/cells.ts`)
  spreads `aggregates` straight into column-id-keyed `cells` with no
  accessor call, so a row-field-keyed aggregate also needs a
  field→column-id translation with no existing mechanism (ADR-0021 Open
  #1). Resolved: a value worth aggregating is a business computation, and
  those belong materialized onto the row data before it reaches the table,
  not synthesized inside `accessor` — so "a derived column with no backing
  row field" is not a legitimate aggregation target, not a gap the API
  needs to cover. Explicit accepted trade-off: `applyAggregate` only works
  when the row already carries the summarized field; a value only ever
  produced inside `accessor` can never be aggregated.
  Side finding, not resolved here (out of this slice's scope): ADR-0019's
  own canonical derived-column example (`{ id: 'fullName', accessor: r =>
r.first + ' ' + r.last }`) is itself a computation, not a bare
  extraction — in tension with "accessor extracts, template computes" if
  that becomes a stated rule. Flagged for a separate, project-wide
  decision on `accessor`'s contract; not litigated here.
- 2026-09-19 — `ColumnDef.aggregateFn` is deleted outright (breaking change
  to `ColumnDef`/`ColumnDefInput`, not deprecated-and-kept). Rationale:
  #100's own blast-radius audit counted 1 production author
  (`stories/grouping/fixtures/schema.ts:35`) and 1 read site
  (`engine/grouping.ts:186`) — small enough for a single-PR migration, no
  external consumers to protect with a deprecation window.
- 2026-09-19 — `applyAggregate` does not validate its field against
  declared columns at construction. Matches existing grouping precedent
  (`applyGrouping`/`applyGroupOrder`/`applyGroupKey` are all unchecked
  against columns today — see `MISSING_GROUPING_LEVEL` fixture, D7a).
  Accepted consequence: an aggregate naming a field no column displays
  computes successfully but has nowhere to render (`buildGroupCells`
  produces a `cells[field]` entry no `ngpTableCell` binds to) — silently
  orphaned, not a construction-time error. Consistency with every other
  grouping rule won out over catching this one case early.
- 2026-09-19 — Sequencing with related issues: this migration
  (#100's `aggregateFn` slice) lands **before** #47 (typed
  `createAggregateKey`/`readAggregate` identity-key channel), which lands
  before #45 (wrapping the aggregate reducer in try/catch). #47's body
  currently assumes `ColumnDef`-declared `aggregateFn`; it needs a
  cross-reference update once this lands, since the reducer's declaration
  site is moving to `withGrouping()`'s schema fn instead. Not done in this
  grill — out of this slice's scope — but flagged so it isn't lost.
