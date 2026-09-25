# #142 — table-level `renderColumns` — decisions

Grill log for [#142](https://github.com/DvirMon/ng-table/issues/142).
Capability log: [`docs/decisions/columns.md`](../../../../../decisions/columns.md).

## Decisions

- 2026-09-25 — Workspace lives at `1-state/work/columns/active/render-columns/`,
  not inside `single-value-source` (which tracks #128).
- 2026-09-25 — **Q1 sequencing:** #142 ships before #128. `renderColumns`'s
  contract is "visible columns, in render order" and never names `order`; the
  order read is one internal engine line that #128 retargets to the id slice.
  Consequence: #128's story-host migration ("roughly ten story hosts change
  their visible-column loop") moves into #142, and #128 no longer touches
  story hosts.
- 2026-09-25 — **Q2 shape:** `renderColumns` returns
  `Signal<ColumnDef<TRow, ColumnIdIn<TValues>>[]>` — same element type as
  `columns()`, filtered to `visible` and sorted into render order. No
  `RenderColumn` projection: hosts read only `id`/`label`, and the typed id
  union keeps `row.cells[column.id]` narrow. `order` still riding on
  `ColumnDef` is #128's to remove. A projection (`{ id, label, index }` for
  `aria-colindex`) is revisited only when a cell directive needs a column
  index.
- 2026-09-25 — **Q3 owner + claim:** `renderColumns` is built in
  `createTableCore()` (`engine/core.ts`) beside `renderRows`, as a `computed`
  over `columns()`; the filter+sort is a pure function in `engine/columns.ts`
  (plain-vitest testable). It is engine-claimed — added to the claimed-member
  list in `engine/slots.ts:27`, exposed on `TableCore` (`engine/types.ts`) and
  `TableStore` (`api/types.ts`); a feature declaring it throws (ADR-0007). Not
  overridable like `totalRowCount`: future column pinning/virtualization gets
  a column render-stage seam designed then, not a member override.
- 2026-09-25 — **Q4 name:** `renderColumns`, parallel to `renderRows` — "what
  the template iterates". Rejected `visibleColumns` (the hosts' local field
  name): it names only the filter and goes stale once a later stage (pinning,
  virtualization) reshapes the list.
- 2026-09-25 — **Q5 grouped-column disposition:** stays consumer-side.
  `grouping-columns-story-host` replaces its `layoutColumns` with
  `table.renderColumns()`; its `displayColumns` (hide / move-to-front grouped
  columns via `groupedColumnMode`) stays the host's own `computed` on top. The
  library does not own this step; no issue opened.
- 2026-09-25 — **Q6 migration scope:** every story host renders from
  `table.renderColumns()` — the 8 grouping hosts that hand-roll filter+sort
  (`grouping-basic`, `-aggregates`, `-async-rule`, `-collapsible`, `-keys`,
  `-order`, `-selection`, `-when`) plus `grouping-columns`' `layoutColumns`
  (Q5), **and** the 3 hosts that loop unfiltered `table.columns()`:
  `filtering/server-filtering`, `filtering/client-filtering`,
  `selection/filtering-selection`. Spec files that filter on `.visible`
  (`columns.spec`, `create-table.spec`, `update-columns.spec`,
  `wire-columns-schema.spec`, `compose-features.spec`) assert visibility
  itself and are not migrated.
- 2026-09-25 — **Spec is required (correction):** an earlier call to skip
  `/to-spec` is reversed. `renderColumns` adds an exported `TableStore`
  member, which is the pipeline contract's `needs:spec` trigger. The spec's
  acceptance criteria must include these doc edits: amend ADR-0007 to add
  `renderColumns` to `CORE_MEMBER_KEYS` (`adr/0007-feature-member-claims.md:88-118`);
  rewrite `3-ui/directives/columns.md:101-115`, which says presentation order
  and visibility are "the template's job", and close its open question at
  line 129 by linking #142; add the member to `1-state/columns.md`; add it to
  `libs/table/CLAUDE.md`'s list of engine-claimed core members; regenerate
  `llms.txt`. No new ADR: the "template's job" position lived in a spec with
  an open question, not in an ADR.

## Failure modes (swept 2026-09-25)

- **All columns hidden** → `renderColumns()` is `[]`. No guard, same
  reasoning as COL15.
- **Order ties** → `Array.prototype.sort` is stable, so tied columns keep
  declaration order. No tie-break rule added.
- **In-place mutation** → the selector sorts the fresh array `filter`
  returns, never `columns()` itself. Spec asserts `columns()` order is
  untouched after a `renderColumns()` read.
- **`visibleAsync` still loading** → inherited, not new:
  `buildAsyncMetadataEntry` (`engine/columns-schema/wiring.ts:65-75`) holds
  the previous value, and before first resolution defers to the declared
  `visible`. `renderColumns` reads the folded `columns()`, so it follows the
  same rule.
- **Recompute cost** → `renderColumns` recomputes whenever `columns()` does
  (a fresh array each time). Cost is O(columns), negligible; the
  O(rows × columns) cost in COL4 is `renderRows`' and stays #128's.
- **Hidden columns in `RenderRow.cells`** → unchanged. `cells` is documented
  order-independent (`api/types.ts:79`) and keyed by id; trimming it to
  render columns is out of scope.
- **Feature declares `renderColumns`** → throws at construction (Q3,
  ADR-0007). Covered by a core claim test.
- **No consumer callback involved** → nothing to wrap under ADR-0014; the
  filter and sort read resolved fields only.
