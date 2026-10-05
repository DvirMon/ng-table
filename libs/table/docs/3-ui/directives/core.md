---
title: UI Layer — Core Structural Directives
type: architecture
version: 0.3
date: 2026-07-31
capability: core
spec: drilled
code: partial
audience: developers
---

# UI Layer — Core Structural Directives

## Executive Summary

Always-present, one-per-element directives (`ngpTable`, `ngpTableRow`, `ngpTableCell`) and the store-connection mechanism they all rely on. These exist on every NGP Table instance regardless of which optional features are composed in.

**Revised 2026-07-31:** the store connection was reworked for `createTable()` (which returns an instance, not a class), and `ngpTableRow` now carries a `RenderRow` rather than a raw row or a bare `RowId`. Both revisions are recorded in their own sections below.

**What is shipped vs. specced here:** `ngpTable` and `ngpTableRow` match this spec. `ngpTableCell` exists but diverges — the shipped directive takes a **0-based column index** and writes `role`/`aria-colindex` only, not the `[ngpTableCell]="columnId"` + `data-column-id` + token-driven styling described below. A `ngpTableHeaderCell` directive also ships without being specced in this file.

---

## Store Connection Pattern

**Decision (revised 2026-07-31):** the store instance enters the template through a **single required input on `ngpTable`**. `NgpTableDirective` self-provides under the `NGP_TABLE_STORE` token via `useExisting`, so every descendant directive injects the token and reads `.store()`.

**Why:** `createTable(data, config, ...features)` returns a **live store instance**, not a class — it is a component field, owned by the component's injection context and torn down with it (see `../1-state/architecture.md` and `createTable()`'s own JSDoc: "There is no DI token to provide or inject; consumers hold the returned instance directly"). An instance created at field level cannot appear in that same component's `providers: []`, so the class-provider approach is structurally impossible. Handing the instance to `ngpTable` as an input, and letting the _directive_ be the DI anchor, gets the instance into DI without asking the consumer to write any provider wiring at all.

```ts
export const NGP_TABLE_STORE = new InjectionToken<NgpTableDirective>('NGP_TABLE_STORE');

@Directive({
  selector: 'table[ngpTable]',
  providers: [{ provide: NGP_TABLE_STORE, useExisting: NgpTableDirective }],
})
export class NgpTableDirective {
  // `unknown` row type at the directive boundary — directives never touch row shape,
  // only `columns()` / `rows()` identity. Consumers keep their own narrow type on the
  // instance they hold.
  readonly store = input.required<TableStore<unknown>>({ alias: 'ngpTable' });
}
```

```ts
// Consumer — no providers block, no store class, no token
@Component({
  /* ... */
})
export class ProductsComponent {
  protected readonly data = signal(products);
  protected readonly table = createTable(
    this.data,
    { trackBy: 'id', columns: createColumns(this.data, (col) => [col('name'), col('status')]) },
    withSorting(),
  );
}
```

```html
<table [ngpTable]="table">
  …
</table>
```

```ts
// Any NGP directive
@Directive({ selector: '...' })
export class NgpTableXDirective {
  private readonly table = inject(NGP_TABLE_STORE);
  protected readonly columns = computed(() => this.table.store().columns());
}
```

**Rejected:**

- `provideTableStore(StoreClass)` + class-aliasing token — the original decision here, invalidated when `createTable()` moved from returning a generated class to returning an instance (commit `58bc7bc`). There is no class to provide.
- Consumer-authored `{ provide: NGP_TABLE_STORE, useValue: … }` — the instance is a field of the very component that would declare the provider; needs a factory + holder component to work at all. Pushes real wiring burden onto every consumer.
- `[store]` input on _every_ directive — maximum explicitness, but repeats the store on every `<th>`/`<td>`. The root-only input above gets the same explicitness at one site.

---

## Directive Granularity Principle

Structural elements get one coarse directive each, always present. Interactive/optional behaviors (see [`sort.md`](sort.md), future `selection.md`/`resizing.md`/`drag-drop.md`) get one fine-grained directive each, stacked on top only when needed.

No `*`-prefixed (Angular structural) directives anywhere in NGP Table — locked in `overview.md`. "Structural" in this document means _always-present, one-per-element_, unrelated to Angular's DOM-insertion sense of the word.

---

## Directive: `ngpTable`

| Element | `<table>`                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Role    | Root directive and **store anchor**. Takes the `createTable()` instance as its input and provides _itself_ under `NGP_TABLE_STORE` (see Store Connection Pattern above), so descendants resolve the store through DI without any consumer-authored providers. Also the anchor selector for `table[ngpTable]`-scoped styling. Instantiates nothing — the store's lifetime belongs to the component field that created it. |
| Inputs  | `[ngpTable]="table"` — required, the `createTable()` instance                                                                                                                                                                                                                                                                                                                                                            |
| Notes   | Coexists with `style="table-layout: fixed;"` when virtual scroll is in use (see `virtual-scroll.md`)                                                                                                                                                                                                                                                                                                                     |

---

## Directive: `ngpTableRow`

| Element | `<tr>`                                                                                                                                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Role    | Row identity anchor. Carries the row's `RenderRow` and republishes it under `NGP_TABLE_ROW` so any row-scoped feature directive (selection, expansion, drag-drop) resolves the row through DI instead of taking its own duplicate input.                     |
| Inputs  | `[ngpTableRow]="renderRow"` — required on data rows (see below for header rows)                                                                                                                                                                              |
| Notes   | Applies uniformly whether the row was rendered via native `@for` or CDK's `*cdkVirtualFor` — Angular permits a structural directive (CDK's) and attribute directives (`ngpTableRow`) stacked on the same element with no conflict (see `virtual-scroll.md`). |

**Decision (2026-07-31):** binds to `RenderRow<TRow>`, not to the raw `TRow` and not to a bare `RowId`.

**Why `RenderRow` and not the row object:** `with-grouping.md` already commits the UI layer to consuming `renderRows()` rather than `rows()`, and group header rows are _not_ `TRow`s — their `id` is synthesized (`` `group:${columnId}:${value}` ``) and their `data` is `null`. A directive that took `TRow` and derived `store.trackBy(row)` internally could not represent a group header at all, foreclosing `withGrouping()`'s render layer as specced.

**Why `RenderRow` and not a bare `RowId`:** the id alone handles synthetic group ids fine, but drops `depth` and `kind` — pushing grouping indentation and group-vs-data branching back into every consumer's template, and forcing feature directives that need the row object to look it up themselves.

```ts
export const NGP_TABLE_ROW = new InjectionToken<NgpTableRowDirective>('NGP_TABLE_ROW');

@Directive({
  selector: 'tr[ngpTableRow]',
  providers: [{ provide: NGP_TABLE_ROW, useExisting: NgpTableRowDirective }],
  host: {
    '[attr.data-row-kind]': 'renderRow().kind',
    '[attr.data-depth]': 'renderRow().depth',
    '[style.--ngp-table-row-depth]': 'renderRow().depth',
  },
})
export class NgpTableRowDirective {
  readonly renderRow = input.required<RenderRow<unknown>>({ alias: 'ngpTableRow' });

  readonly rowId = computed(() => this.renderRow().id);
  readonly isGroupHeader = computed(() => this.renderRow().kind === 'group');
}
```

`data-row-kind` / `data-depth` follow `styling-tokens.md`'s convention (state as `data-*`), so group headers and nesting indentation are styleable without a second input. `--ngp-table-row-depth` carries the same depth as a CSS custom property, so one `calc(var(--ngp-table-row-depth) * <step>)` rule indents any depth and inherits into cells and buttons. The row's attribute set is `role`, `data-row-kind`, `data-depth`, `aria-rowindex` and `--ngp-table-row-depth`. It carries no `aria-expanded`: ARIA allows that on a row only inside a `treegrid`, and the table stays `role="table"` — expansion state lives on the toggle button.

Row-scoped feature directives then read the row from DI — no repeated binding per directive:

```ts
@Directive({ selector: '[ngpTableExpandToggle]' })
export class NgpTableExpandToggleDirective {
  private readonly row = inject(NGP_TABLE_ROW);
  private readonly table = inject(NGP_TABLE_STORE);

  onActivate(): void {
    this.table.store().toggleExpanded(this.row.rowId()); // RowId — real or synthetic
  }
}
```

**Header rows:** the `<tr>` inside `<thead>` has no `RenderRow`. It carries no `ngpTableRow` at all — it is not a data row, nothing row-scoped is ever nested in it, and giving it a sentinel `RenderRow` would be a lie the type system can't catch. Header `<th>`s are addressed by `ngpTableColumn` (see `columns.md`).

---

## Directive: `ngpTableCell`

| Element                             | `<td>`                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role                                | Data cell. Applies token-driven default styling + `data-*` attributes (e.g. `data-column-id`). No behavior logic yet (no click handling, no value formatting).                                                                                                          |
| Inputs                              | `[ngpTableCell]="columnId"`                                                                                                                                                                                                                                             |
| Why a directive and not bare markup | Kept minimal deliberately, so it's queryable/extensible later (e.g. via `@ContentChildren` or host injection) without a breaking template change — a future `ngpTableCellEdit` or `ngpTableDragHandle` could target it without altering the consumer's existing markup. |
| Accessibility                       | No default `aria-label` (see `accessibility.md` — text content is the accessible name). No `aria-live` (see `accessibility.md` and `virtual-scroll.md` — CDK recycles `<td>` nodes; per-cell live regions would fire spurious announcements on scroll).                 |

```html
<td [ngpTableCell]="col.id" [attr.data-column-id]="col.id">
  {{ renderRow.data ? col.accessor(renderRow.data) : '' }}
</td>
```

---

## Open Questions

None outstanding for this file specifically — see `3-ui/architecture.md` for cross-cutting open items (row height/`itemSize`, testing strategy).
