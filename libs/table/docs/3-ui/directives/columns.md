---
title: UI Layer — Column Identity (ngpTableColumn)
type: architecture
version: 0.2
date: 2026-07-31
capability: columns
spec: drafted
code: none
audience: developers
---

# UI Layer — Column Identity (`ngpTableColumn`)

## Executive Summary

`ngpTableColumn` resolves a template-referenced column id against the store's column config, and is the boundary directive between store-owned data contract and directive-local presentation overrides.

**Revised 2026-07-31** to sync with `createTable()`, `ColumnDefInput` and the schema argument — see "Where Column Definitions Live" below.

**Not implemented.** No `NgpTableColumnDirective` exists in `src/directives/`, and nothing is exported for it from `index.ts`. Every directive that names it as a dependency (`sort.md`, `resizing.md`) is blocked on this file shipping first.

---

## Where Column Definitions Live

**Decision:** Store owns the data contract. Template/directive layer may override **presentation-only** properties, via plain `@Input()`s that never write back to the store.

`columns` is core config on `createTable()` (locked in `1-state/architecture.md` — required on every call, like `trackBy`), not a template-scattered definition and not a separate opt-in feature.

Authored via `createColumns(data, build, schema?)` — only `id` is required on each `col()`;
`accessor` / `visible` / `order` are resolved at store construction (`accessor` defaults to
`(row) => row[id]`, `visible` to `true`, `order` to builder-array index). `store.columns()` is
always a fully resolved `ColumnDef<TRow>[]`.

```ts
createTable(
  data,
  {
    trackBy: 'id',
    columns: createColumns(data, (col) => [
      col('name'), // accessor/visible/order defaulted
      col('status'),
      col('fullName', { accessor: (row) => `${row.first} ${row.last}` }),
    ]),
  },
  withSorting({ schema: (path) => sortable(path.status, { enable: () => false }) }),
);
```

Per-column sorting config (`sortNulls`/`sortFn`/`sortable`) is never a `col()` option — it's
declared through `withSorting({ schema })`, not `ColumnDef` at all (#100). `col()`'s `opts` only
ever types `accessor`/`visible`/`order`/`label`.

An opt-in declarative layer, the schema argument of `createColumns`, can drive `visible`
reactively on top of this config (`visible(path.status, { when: … })`) — see
`../2-columns/architecture.md`. It writes through the store's own `updateColumns()`, so from the
UI layer's point of view nothing changes: schema-driven columns arrive through `store.columns()`
exactly like statically-configured ones. (`order` is no longer schema-drivable at all — dropped
entirely, see [columns.md COL4](../../decisions/columns.md).)

## The Override Boundary

| Owned by                                          | Examples                                                                                                                                                                                             | Overridable from template? |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Store (logical — drives behavior)                 | `id`, `accessor`, `visible`, `order`, `label`, `meta` — `ColumnDef` carries no per-feature config at all (#100); sorting/filtering/grouping behavior is declared through each feature's own `schema` | No                         |
| Directive (presentation — drives appearance only) | `width`, header label / custom header + cell templates                                                                                                                                               | Yes, local only            |

**Rule of thumb:** if a property affects _what data flows through the pipeline or how it's computed_, it's store-owned with no override. If it only affects _how something looks/renders in this particular template usage_, it's a directive-local input.

Note the current `ColumnDef` carries **no presentation fields at all** — no `width`, no `label`. So today every presentation property is directive-only, with no store-side fallback; the "store's copy is an unused default" framing from v0.1 describes fields that were never implemented. See Open Questions.

```ts
@Directive({ selector: '[ngpTableColumn]' })
export class NgpTableColumnDirective {
  readonly columnId = input.required<string>({ alias: 'ngpTableColumn' });
  readonly width = input<number | undefined>(undefined, { alias: 'ngpColumnWidth' });

  private readonly table = inject(NGP_TABLE_STORE);
  readonly column = computed(() =>
    this.table
      .store()
      .columns()
      .find((c) => c.id === this.columnId()),
  );
}
```

```html
<!-- Width override, this template instance only -->
<th [ngpTableColumn]="col.id" [ngpColumnWidth]="300">Status</th>

<!-- Custom header content instead of store's default label -->
<th [ngpTableColumn]="col.id">
  <ng-template ngpColumnHeader><mat-icon>info</mat-icon> Status</ng-template>
</th>
```

A template override never writes back to the store — `accessor`, `visible`, `order`, sortability, and `sortFn` stay locked to the store (or to its schema rules) regardless of any local override present.

---

## Rendering — No Structural Directive

Columns are rendered via native `@for` over the store's columns, per `overview.md`'s rendering philosophy (no custom NGP structural directives). `col.id` from the loop variable is the single source of truth referenced everywhere the column needs identifying — in `[ngpTableColumn]`, in sort activation (see `sort.md`), in cell rendering (see `core.md`) — avoiding string-literal duplication.

The consumer's own template holds the `createTable()` instance directly (it's a component field), so it reads `table.columns()` — it does not go through `NGP_TABLE_STORE`; that token exists for _directives_ nested inside the table (see `core.md`).

**`store.columns()` is unfiltered and unsorted** — it holds every column in author order, including `visible: false` ones. Presentation order and visibility are the store's job, not the template's: `table.renderColumns()` is the visible columns in render order, the column-side twin of `renderRows` ([#142](https://github.com/DvirMon/ng-table/issues/142)). A template renders straight from it — no filter, no sort:

```html
<table [ngpTable]="table">
  <thead>
    <tr>
      <!-- header row carries no ngpTableRow — it has no RenderRow, see core.md -->
      @for (col of table.renderColumns(); track col.id) {
      <th [ngpTableColumn]="col.id">…</th>
      }
    </tr>
  </thead>
</table>
```

`table.columns()` stays useful on its own — declaration-order, unfiltered — for anything that needs every column regardless of visibility (a column-visibility settings panel, say). Per the signal-plumbing convention, a component either calls `table.renderColumns()` directly in its template or wraps it in its own `computed()` to shape it further (e.g. hiding/reordering grouped columns); it never assigns the signal reference to a field.

---

## Open Questions

- [ ] Custom header/cell template mechanism (`ngpColumnHeader`-style `@ContentChild`) shown above as illustrative — exact API (input vs. structural template ref, naming) not yet finalized.
- [ ] **Presentation fields on `ColumnDef`** — `width` and a header `label` are referenced throughout this file but exist nowhere in `api/types.ts`. Decide: keep presentation strictly directive-local (status quo, template must supply labels itself), or add optional presentation fields to `ColumnDefInput` so a column can carry its own default label/width. Blocks `resizing.md`, which needs to know whether `[ngpColumnWidth]` overrides a store value or _is_ the only value.
- [x] **Should the DS ship the visible/order derivation?** Yes — `table.renderColumns()`, shipped in [#142](https://github.com/DvirMon/ng-table/issues/142)/[#143](https://github.com/DvirMon/ng-table/issues/143). See `1-state/columns.md`.
