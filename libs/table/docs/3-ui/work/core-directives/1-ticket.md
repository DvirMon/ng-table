# NGP Table — core structural directives

## Summary

The NGP Table state layer ships (`createTable()`, `withSorting()`, columns schema, `renderRows()`), but no template layer exists — there is no way to render a table from a store. Build the four always-present directives that connect a `createTable()` instance to native `<table>` markup.

## Context

Backfilled 2026-08-07. This ticket documents work whose spec already exists: the UI layer was drilled across several architecture sessions rather than through `/to-ticket` → `/grill-with-docs` → `/to-spec`, so the pipeline had no ticket or workspace to thread through. The specs are real and complete — this ticket exists to give `/to-issues` and `/to-tasks` an anchor, not to re-open decisions already made.

Everything blocking this work has cleared. [#10](https://github.com/DvirMon/ng-table/issues/10) landed `RenderRow` + `renderRows()` on the core store, which was the last dependency — `ngpTableRow` binds a `RenderRow` and could not be built before it.

Every other UI-layer feature (sort, selection, expansion, drag & drop, resizing, grouping) injects `NGP_TABLE_STORE` or `NGP_TABLE_ROW`, so none of them can start until this lands.

## Rough scope

- `ngpTable` on `<table>` — takes the `createTable()` instance as a required input, self-provides under `NGP_TABLE_STORE` so descendants resolve the store through DI with no consumer-authored providers
- `ngpTableRow` on `<tr>` — binds a `RenderRow`, republishes under `NGP_TABLE_ROW`, emits `data-row-kind` / `data-depth`
- `ngpTableCell` on `<td>` — minimal by design; `data-column-id`, no behavior yet
- `ngpTableColumn` on `<th>` — resolves a column id against `store.columns()`
- Public API exports from the table barrel

Out of scope, deliberately:

- **`[ngpColumnWidth]`** on `ngpTableColumn` — `columns.md` sketches it, but `ColumnDef` has no `width` field, so the input has no defined semantics. Blocked on the presentation-fields decision (`3-ui/architecture.md` Next Steps 7).
- **Any feature directive** — sort, selection, expansion, drag & drop, resizing, grouping. Each has its own blocker or its own drilling session pending.
- **Styling** — `styling-tokens.md`'s token catalog is unstarted. Directives emit the `data-*` attributes; what those attributes *look like* is a separate session.

## Spec

Already written — do not re-derive:

- `docs/3-ui/directives/core.md` — `ngpTable`, `ngpTableRow`, `ngpTableCell`, store connection pattern, rejected alternatives
- `docs/3-ui/directives/columns.md` — `ngpTableColumn`, the store-vs-directive override boundary
- `docs/3-ui/architecture.md` — index, cross-cutting open questions, ordered next steps
- `docs/overview.md` — the locked constraint that every NGP directive is attribute-only and never inserts or removes DOM
