---
title: Architecture & Organization Overview — NGP Table
type: architecture
version: 0.2
date: 2026-07-19
status: draft
audience: developers
---

# Architecture & Organization Overview — NGP Table

## Executive Summary

The NGP Table is a two-layer composable architecture: a directive-based UI layer that consumers write directly on native HTML elements, and an abstracted signal-based state layer built on NgRx Signal Store. Consumers own the markup and create the store **instance** at the component field level via `createTable(data, optsFn)` — no DI provider registration, no `inject()`. NgRx Signal Store is an internal implementation detail; the public API is `createTable()`, which returns a live store instance (see ADR-0002).

---

## Technology Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Angular 17+ | Signal-native, directive composition |
| Language | TypeScript | Type-safe feature dependencies |
| State layer | In-house `composeTable()` engine over Angular signals | Zero runtime dependencies; features declare `members`/`stages`/`renderRows` rather than mutating shared slots. See ADR-0003 |
| State API | `createTable()` factory (internal abstraction) | Consumers hold a store instance; the engine never crosses the public boundary |
| Forms (inline edit) | Angular Signal Forms | Signal-native, consistent with stack |
| Virtual scroll | Angular CDK `ScrollingModule` | UI layer only — no store feature needed |
| Reference pattern | TanStack Table v8 | Row model pipeline, `manual{X}` flag pattern |

---

## Architecture: Two Layers

### Layer 1 — UI Layer (Directives)

Consumers write native HTML. Directives are applied to HTML elements to enhance them. No monolithic table component exists. This follows Angular Material's composable directive pattern.

**Rendering philosophy — no custom structural directives.** All row/child iteration and conditional rendering uses Angular's native control flow (`@for`, `@if`) directly in the consumer's template, reading store signals. Every NGP Table directive is an **attribute directive only** — it decorates an element that's already in the DOM (via `@for`/`@if`), it never inserts or removes DOM itself. This keeps iteration/recursion fully explicit and visible in the consumer's template rather than hidden inside a custom structural directive (e.g. no `*ngpTableRow`-style directive).

> **Scope of "attribute-only" (clarified 2026-08-07).** The rule constrains **DOM structure**, not UI effect. A directive may drive appearance — host classes, `data-*` attributes, CSS custom properties — and may own enter/leave motion on the element it sits on (e.g. `ngpTableExpandable`, see `3-ui/directives/expansion.md`). What it may not do is create, remove, or reorder elements. Angular CDK's `cdkDrag` is the reference model: the directive class itself only toggles classes and drives transforms, while the preview and placeholder DOM come from the `DragRef` engine and from consumer-authored `cdkDragPreview` / `cdkDragPlaceholder` directives — that DOM-creating half is the part NGP Table does not do.

```html
<!-- Consumer owns all markup, including iteration via native control flow -->
<table ngpTable>
  <thead>
    <tr>
      <th ngpTableColumn="name" ngpTableSort>Name</th>
      <th ngpTableColumn="status">Status</th>
    </tr>
  </thead>
  <tbody>
    @for (row of store.rows(); track row.id) {
      <tr ngpTableRow>
        <td>{{ row.name }}</td>
        <td>{{ row.status }}</td>
      </tr>

      <!-- Nested/expanded rows: also native control flow, no structural directive -->
      @if (store.expandedRows().has(row.id)) {
        @for (child of row.children; track child.id) {
          <tr ngpTableRow>
            <td>{{ child.name }}</td>
          </tr>
        }
      }
    }
  </tbody>
</table>
```

**Directives find the store** by injecting it from Angular's DI tree — the consumer provides it in their component. Directives never instantiate the store themselves.

**Directives own UI/interaction events** — e.g. `rowClicked`, `cellFocused`, drag handle interactions.

**Styling** is applied via CSS tokens on directives. Consumers can override tokens. No component-scoped styles that bleed into consumer markup.

> **Revision note (2026-07-19):** an earlier draft of this section showed `<tr *ngpTableRow="let row">` as a custom **structural** directive handling row iteration. This was superseded — see "Rendering philosophy" above. The state layer decisions in `1-state/architecture.md` are unaffected by this change; only how directives read/render that state in the template changed.

---

### Layer 2 — State Layer (`createTable`)

The state layer is exposed via our own factory function. Consumers compose only the features they need — tree-shakeable by design.

```ts
@Component({ /* no providers — the store is a field-level instance */ })
export class ProductsComponent {
  // Data source — the single source of truth; the pipeline reads it directly.
  private readonly products = signal<Product[]>([]);

  // Field-level instance; `optsFn` runs once, `data` stays reactive.
  readonly store = createTable(this.products, () => ({
    trackBy: 'id',
    columns,
    features: [
      withSorting(),
      withSelection(),
      withPagination({ manual: true }),
    ],
  }));

  constructor() {
    // `data` is the single source of truth — the pipeline reads it directly.
    this.products.set(seedRows);

    // Server-side: consumer reacts to state and pushes fresh data straight
    // into their own `data` signal — the store holds no internal copy.
    effect(() => {
      const page = this.store.pagination();
      const sort = this.store.sorting();
      this.service.load({ page, sort }).then(data => this.products.set(data));
    });
  }
}
```

**NgRx Signal Store is never imported by consumers.** All feature composition happens inside `createTable()`, and it returns a live instance — there is no DI token to provide or inject. This allows us to swap the internal implementation without a breaking change (see ADR-0002).

**The store owns data/state events** — e.g. `selectionChanged`, `sortChanged`, `pageChanged`.

---

## State Layer: Feature Registration

Features are tree-shakeable. Consumers pay only for what they use.

| Public Feature | Internal Split | State Shape |
|---|---|---|
| `withSorting()` | — | `{ sorting: SortingState[] }` |
| `withGrouping()` | — | `{ grouping: string[] }` |
| `withSelection()` | `withSingleSelection` / `withMultiSelection` (internal) | `{ selection: Record<id, bool>, mode: 'single'\|'multi' }` |
| `withPagination()` | — | `{ pageIndex, pageSize, totalRows }` |
| `withInfiniteScroll()` | — | `{ hasMore, isLoading }` |
| `withExpansion()` | — | `{ expandedRows: Set<id> }` |
| `withFiltering()` | — | `{ filters: FilterState[] }` |
| `withDragDrop()` | — | `{ dragState }` |

> Virtual scroll is **UI layer only** (CDK `ScrollingModule`). No store feature needed.

---

## State Layer: Client vs Server

Each feature supports a `manual` flag (inspired by TanStack Table v8). When `manual: true`, the store skips that pipeline stage and assumes data is already processed by the server.

```ts
// All client-side (default)
createTable(data, () => ({ trackBy: 'id', columns, features: [withSorting(), withPagination()] }))

// Server-side pagination, client-side sort
createTable(data, () => ({ trackBy: 'id', columns, features: [withSorting(), withPagination({ manual: true })] }))

// All server-side
createTable(data, () => ({ trackBy: 'id', columns, features: [
  withSorting({ manual: true }),
  withPagination({ manual: true }),
  withFiltering({ manual: true }),
]}))
```

**Server-side handler pattern:** The store emits state signals. The consumer reacts to state changes — via their own `effect()` / `httpResource()` — and delivers fresh data by writing into the `data` signal passed to `createTable()`; the pipeline reads it directly. No loader abstraction exists in the store.

---

## State Layer: Reactive Pipeline

Data flows through a composable pipeline. Each stage is skipped when `manual: true`.

```
data (WritableSignal, single source of truth)
  → withFiltering   (skip if manualFiltering)
  → withGrouping    (skip if manualGrouping)
  → withSorting     (skip if manualSorting)
  → withExpansion
  → withPagination  (skip if manualPagination)
  → Rendered Rows   (directives read via signals)
```

---

## State Layer: Row Identity

```ts
createTable(data, () => ({
  columns,
  trackBy: 'id',                    // string shorthand
  // or
  trackBy: (row) => row.org + row.userId,  // function for composite keys
}))
```

Internally, string shorthand is normalized to a function **once at store initialization**: `(row) => row['id']`. Zero branching at runtime.

---

## State Layer: Feature Dependencies

Features declare required state slices using NgRx's `type<>` helper. Missing dependencies are caught at **compile time** — TypeScript throws if a consumer uses a feature without its required dependencies.

Example: `withGrouping()` declares a compile-time dependency on `withExpansion()` (it delegates collapse state there). `columns`, by contrast, is **core config** — required on every `createTable()` call, like `trackBy` — so column-reading features (`withSorting()`, `withGrouping()`, `withFiltering()`) simply read the always-present `columns` config rather than declaring a feature dependency on it. See `1-state/architecture.md` (Dependency Graph) and `1-state/columns.md`.

---

## Store Lifecycle & Scope

`createTable(data, optsFn)` returns a live store **instance**, owned by the injection context it is called in. Called in a component field initializer ⇒ **component-scoped**: the instance (and its internal data effect) tear down with the component via that context's `DestroyRef`. This is the only built-in scope — see ADR-0002.

```ts
// Component-scoped (the store dies with the component) — no providers, no inject()
@Component({ /* ... */ })
export class ProductsComponent {
  readonly store = createTable(this.data, () => ({ trackBy: 'id', columns, features: [...] }));
}

// Outside an injection context (a service, a test): pass an injector explicitly.
createTable(data, optsFn, { injector });
```

**Trade:** there is no DI token, so route-scoped or `root`-scoped *shared* table state is not offered — the instance belongs to its owner. Multiple tables on one page = multiple independent instances (the default anyway). No shared global state.

---

## Event Ownership

| Layer | Owns |
|---|---|
| Store (state layer) | `selectionChanged`, `sortChanged`, `pageChanged`, `groupChanged`, `filterChanged`, `rowExpanded`, `dataLoaded` |
| Directives (UI layer) | `rowClicked`, `cellFocused`, `dragStarted`, `dragDropped`, `rowHovered` |

---

## Open Questions & Next Steps

- [x] **Structural vs. native control flow for rendering** — Resolved 2026-07-19: no custom structural directives; native `@for`/`@if` everywhere, all NGP Table directives are attribute-only. See Layer 1 above.
- [ ] **Directive-to-store connection pattern** — How directives find the store (directive input vs host-directive parent injection). Owned by the UI-directive spec session (in progress). Note: ADR-0002 makes the store a plain **instance** with no DI token, so directives cannot `inject()` the store class — they receive the instance by input / host-directive, not by providing-and-injecting a token.
- [x] **Column definitions** — Resolved: `columns` is **core config** on `createTable()` (required, like `trackBy`), not an opt-in `withColumns()` feature. A declarative schema DX layers on top via the optional `columnsSchema` config field — see `2-columns/architecture.md` + `2-columns/reference/`. Behavior fields (`sortFn`/`filterFn`/`accessor`) feed the row pipeline; presentation fields (`visible`/`order`) feed the template.
- [ ] **Feature-by-feature deep drill** — Each feature needs its own state shape, methods, outputs, and `manual` contract fully specified. Planned for next session.
- [ ] **Styling spec** — CSS token naming, which tokens each directive exposes, override mechanism. Not yet started.
- [ ] **UI layer directives spec** — Full directive API surface (inputs, outputs, host bindings). Not yet started.
- [ ] **Accessibility contract** — Keyboard navigation per feature, ARIA wiring. Not yet started.
- [ ] **Testing strategy** — Unit, integration, a11y testing approach. Not yet decided.

---

**Generated by:** Claude Project Spec Interview
**Last Updated:** 2026-07-19
**Status:** Draft — state layer architecture fully drilled for 4/8 features (see `1-state/architecture.md`); UI layer rendering philosophy decided (native control flow, attribute-only directives); remaining state features and full UI layer spec pending
