---
title: UI Layer — Virtual Scroll (CDK Integration)
type: architecture
version: 0.2
date: 2026-07-31
status: draft — drilled; iterates renderRows() (implemented 2026-08-07); one open dependency (itemSize)
audience: developers
---

# UI Layer — Virtual Scroll (CDK Integration)

## Executive Summary

Full native `<table>`, single `<thead>`/`<tbody>` — no table-splitting, no flex-based fake-table escape hatch. CDK's own `<cdk-virtual-scroll-viewport>` + `*cdkVirtualFor` wraps only the `<tbody>` rows; the header stays outside the viewport and uses CSS `position: sticky`. Confirmed against `overview.md`'s locked "UI layer only, CDK `ScrollingModule`, no store feature" decision.

---

## Decision & Rejected Alternatives

**Rejected: NGP owning virtualization itself** (a directive the consumer applies instead of `*cdkVirtualFor`, so CDK is invisible). Virtualization is inherently insert/remove-DOM-as-you-scroll behavior — any directive that does that is a structural directive by definition, and `overview.md` locked _"every NGP Table directive is an attribute directive only... it never inserts or removes DOM itself"_ specifically to keep iteration explicit in the consumer's template. Owning virtualization this way would be an architectural reversal, not a complexity tradeoff.

**Rejected: thin `ngpTableVirtualScroll` convenience wrapper** around CDK's viewport (auto-binding `itemSize`/`trackBy` from the store, consumer still writes `*cdkVirtualFor`). Viable and lower-risk than full ownership, but superseded once the decision was made to go with plain CDK directly — parked as unnecessary rather than wrong.

**Rejected: Material's `display: flex` fake-table alternative** — verified directly in Angular Material's own docs to exist specifically for multi-directional Safari sticky-jitter edge cases (e.g. sticky header + sticky first column together), not required for virtual scroll itself. Adopting it would contradict the native-semantic-table foundation `accessibility.md` and `sort.md` depend on (implicit table/row/cell roles, free accessible names).

**Rejected: splitting into two separate `<table>` elements** (one for header, one for body) — verified this is a third-party/legacy workaround pattern (seen in libraries like `ng-table-virtual-scroll`), not what CDK/Material's own current implementation does. CSS `position: sticky` on a header row inside one `<table>` has been the supported approach since early Material 9+.

---

## Implementation

```html
<table [ngpTable]="table" style="table-layout: fixed;">
  <thead>
    <tr style="position: sticky; top: 0;">
      <!-- header row carries no ngpTableRow — see core.md -->
      @for (col of visibleColumns(); track col.id) {
      <th [ngpTableColumn]="col.id" ngpTableSort>…</th>
      }
    </tr>
  </thead>
  <cdk-virtual-scroll-viewport [itemSize]="40" style="height: 400px;">
    <tbody>
      <tr
        [ngpTableRow]="renderRow"
        *cdkVirtualFor="let renderRow of table.renderRows(); trackBy: trackRenderRow"
      >
        @for (col of visibleColumns(); track col.id) {
        <td [ngpTableCell]="col.id">{{ renderRow.data ? col.accessor(renderRow.data) : '' }}</td>
        }
      </tr>
    </tbody>
  </cdk-virtual-scroll-viewport>
</table>
```

**`table-layout: fixed`:** maps to CDK's `fixedLayout` concept — column widths can be cached/reused reliably for sticky-style calculations, reducing rendering latency as row count grows.

**`trackBy`:** the viewport iterates `RenderRow<TRow>`, not `TRow`, so it tracks by `renderRow.id` rather than reusing `table.trackBy` directly:

```ts
protected readonly trackRenderRow = (_: number, row: RenderRow<Person>) => row.id;
```

That id is still single-sourced — for `kind: 'row'` the render layer populates it with `trackBy(row)` (the normalized `TrackByFn<TRow>` the store builds once at construction, `normalizeTrackBy()` in `api/create-table.ts`), and for `kind: 'group'` it is the synthetic group id. Tracking by `id` therefore covers both without a second tracking function, and without the template needing to know which kind it's looking at.

**Cell values:** rendered through the column's own `accessor`, not by indexing the row with a field name — `accessor` is the store's data contract for a column, defaulting to `(row) => row[id]` when not given. See `columns.md`. `renderRow.data` is `null` on group headers, hence the guard; what a group header actually renders in its cells (aggregates, a single spanning label) is `with-grouping.md`'s concern and not yet drilled at the UI layer.

---

## How This Composes With Everything Already Locked

- **Store DI (`core.md`):** unaffected — wrapping body rows in a viewport doesn't change the injector tree.
- **Directive stacking (`core.md`):** `ngpTableRow` on the `*cdkVirtualFor` `<tr>` — Angular permits a structural directive (CDK's) and attribute directives (NGP's) on the same element with no conflict; `ngpTableRow` doesn't know or care whether its host row exists because of `@for` or `*cdkVirtualFor`.
- **`ngpTableColumn`/`ngpTableSort` (`columns.md`, `sort.md`):** entirely outside the viewport (they live in `<thead>`), unaffected by virtualization.
- **No per-cell `aria-live` (`accessibility.md`):** this decision, made _before_ virtual scroll was drilled, turned out to be a direct prerequisite — CDK recycles `<td>` DOM nodes as the user scrolls, which is exactly the scenario that decision was protecting against.

---

## Known Version-Specific Issue (Not This Architecture's Bug)

Angular Material 21.1 has an open, acknowledged regression (`angular/components#32715`) where native-table + virtual-scroll scrolling shifts/jumps. Documented workaround: `appendOnly` on the viewport, at the cost of losing "scroll anywhere" behavior. Unrelated to table-splitting or any decision in this document — flagged for awareness if referencing that Material version, not something NGP Table's design needs to solve.

---

## Open Questions

- [ ] **Must support detail panels** (`0-product/expansion.md` OQ-exp-8 part 4, E12/E42,
      2026-10-01). A `withExpansion()` panel is consumer markup, not a `renderRows()` entry (E12,
      ADR-0012), with variable height — the fixed-`itemSize` `*cdkVirtualFor` over `renderRows()` above
      can neither size nor unmount one. Required: variable-height items, or a panel that takes a slot in
      the virtual list without being a render row. Settled when this design is drilled.
- [ ] **Row height / `itemSize` value** — CDK requires a concrete pixel number; no decision yet exists in this architecture. Depends on the styling/tokens spec (`styling-tokens.md`), which hasn't been started. This is the one blocking dependency for this file to be considered fully closed.
