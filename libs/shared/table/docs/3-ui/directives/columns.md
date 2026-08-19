---
title: UI Layer — Column Identity (ngpTableColumn)
type: architecture
version: 0.2
date: 2026-07-31
status: draft — revised (synced to createTable()/ColumnDefInput/columnsSchema)
audience: developers
---

# UI Layer — Column Identity (`ngpTableColumn`)

## Executive Summary

`ngpTableColumn` resolves a template-referenced column id against the store's column config, and is the boundary directive between store-owned data contract and directive-local presentation overrides.

---

## Where Column Definitions Live

**Decision:** Store owns the data contract. Template/directive layer may override **presentation-only** properties, via plain `@Input()`s that never write back to the store.

`columns` is core config on `createTable()` (locked in `1-state/architecture.md` — required on every call, like `trackBy`), not a template-scattered definition and not a separate opt-in feature.

Authored as `ColumnDefInput<TRow>[]` — only `id` is required; `accessor` / `visible` / `order` are resolved at store construction (`accessor` defaults to `(row) => row[id]`, `visible` to `true`, `order` to array index). `store.columns()` is always a fully resolved `ColumnDef<TRow>[]`.

```ts
createTable(data, () => ({
  trackBy: 'id',
  columns: [
    { id: 'name' },                                    // accessor/visible/order defaulted
    { id: 'status', enableSorting: true },
    { id: 'fullName', accessor: (row) => `${row.first} ${row.last}` },
  ],
  features: [withSorting<Person>()],
}));
```

An opt-in declarative layer, `columnsSchema`, can drive `visible`/`order` reactively on top of this config (`applyVisible(path.status, { when: … })`) — see `../2-columns/architecture.md`. It writes through the store's own `updateColumns()`, so from the UI layer's point of view nothing changes: schema-driven columns arrive through `store.columns()` exactly like statically-configured ones.

## The Override Boundary

| Owned by | Examples | Overridable from template? |
|---|---|---|
| Store (logical — drives behavior) | `id`, `accessor`, `visible`, `order`, `sortFn`, `enableSorting`, `filterFn`, `enableFiltering`, `aggregateFn` | No |
| Directive (presentation — drives appearance only) | `width`, header label / custom header + cell templates | Yes, local only |

**Rule of thumb:** if a property affects *what data flows through the pipeline or how it's computed*, it's store-owned with no override. If it only affects *how something looks/renders in this particular template usage*, it's a directive-local input.

Note the current `ColumnDef` carries **no presentation fields at all** — no `width`, no `label`. So today every presentation property is directive-only, with no store-side fallback to fall back *to*; the "store's copy is an unused default" framing from v0.1 describes fields that were never implemented. See Open Questions.

```ts
@Directive({ selector: '[ngpTableColumn]' })
export class NgpTableColumnDirective {
  readonly columnId = input.required<string>({ alias: 'ngpTableColumn' });
  readonly width = input<number | undefined>(undefined, { alias: 'ngpColumnWidth' });

  private readonly table = inject(NGP_TABLE_STORE);
  readonly column = computed(() =>
    this.table.store().columns().find((c) => c.id === this.columnId())
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

A template override never writes back to the store — `accessor`, `visible`, `order`, sortability, and `sortFn` stay locked to the store (or to its `columnsSchema` rules) regardless of any local override present.

---

## Rendering — No Structural Directive

Columns are rendered via native `@for` over the store's columns, per `overview.md`'s rendering philosophy (no custom NGP structural directives). `col.id` from the loop variable is the single source of truth referenced everywhere the column needs identifying — in `[ngpTableColumn]`, in sort activation (see `sort.md`), in cell rendering (see `core.md`) — avoiding string-literal duplication.

The consumer's own template holds the `createTable()` instance directly (it's a component field), so it reads `table.columns()` — it does not go through `NGP_TABLE_STORE`; that token exists for *directives* nested inside the table (see `core.md`).

**`store.columns()` is unfiltered and unsorted** — it holds every column in author order, including `visible: false` ones. Presentation order and visibility are the template's job:

```ts
protected readonly visibleColumns = computed(() =>
  this.table.columns()
    .filter((col) => col.visible)
    .sort((a, b) => a.order - b.order)
);
```

```html
<table [ngpTable]="table">
  <thead>
    <tr>   <!-- header row carries no ngpTableRow — it has no RenderRow, see core.md -->
      @for (col of visibleColumns(); track col.id) {
        <th [ngpTableColumn]="col.id">…</th>
      }
    </tr>
  </thead>
</table>
```

---

## Open Questions

- [ ] Custom header/cell template mechanism (`ngpColumnHeader`-style `@ContentChild`) shown above as illustrative — exact API (input vs. structural template ref, naming) not yet finalized.
- [ ] **Presentation fields on `ColumnDef`** — `width` and a header `label` are referenced throughout this file but exist nowhere in `api/types.ts`. Decide: keep presentation strictly directive-local (status quo, template must supply labels itself), or add optional presentation fields to `ColumnDefInput` so a column can carry its own default label/width. Blocks `resizing.md`, which needs to know whether `[ngpColumnWidth]` overrides a store value or *is* the only value.
- [ ] **Should the DS ship the visible/order derivation?** Every consumer writing the same `filter(visible).sort(order)` computed is a papercut; a store-side `visibleColumns` computed or a UI-layer helper would remove it. Not decided — see `1-state/columns.md`.
