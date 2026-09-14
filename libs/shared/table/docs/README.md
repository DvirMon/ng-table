# NGP Table Documentation

Stream map and navigation for table architecture. Docs are organized by implementation layer.

**[status.md](status.md)** — **Start here.** Every capability's spec and code maturity, state and
UI layer side by side, in one table. Generated from the specs' own frontmatter
(`npm run table:status`) — never hand-edited, so it can't drift from what the specs say.

## Layers

**[overview.md](overview.md)** — High-level architecture map, dependency order, key concepts.

### 1. State Layer — `[1-state/](1-state/)`

Core store, types, and state-management plugins.

- **[PRD](1-state/prd.md)** — Requirements and acceptance criteria
- **[Architecture](1-state/architecture.md)** — State machine, design, public API
- **Engine** — how features compose: `engine/types.ts` (the `TableFeatureSpec` contract) and [ADR-0003](adr/0003-in-house-table-store-engine.md)
- **Source layout** — folders by lifecycle phase (`api/` / `engine/` / `directives/`): [ADR-0004](adr/0004-table-source-layout.md) and the code-layout table in [`../CLAUDE.md`](../CLAUDE.md)
- **[Columns config](1-state/columns.md)** — Required core config (`createTable()` input)
- **[Row mutations](1-state/row-mutations.md)** — Core API, not a plugin: `table.value.update()` and the row updater verbs (D8)
- **[State persistence](1-state/state-persistence.md)** — Cross-feature, not a plugin: one atomic round-trippable snapshot of sort + columns + filters + pagination
- **Features** `[1-state/features/](1-state/features/)` — Opt-in plugins (mirror `with-*.ts` files):
  - [Sorting](1-state/features/sorting.md)
  - [Filtering](1-state/features/filtering.md)
  - [Grouping](1-state/features/grouping.md)
  - [Selection](1-state/features/selection.md)
  - [Expansion](1-state/features/expansion.md)
  - [Pagination](1-state/features/pagination.md)
  - [Column sizing](1-state/features/column-sizing.md)
  - [Column pinning](1-state/features/column-pinning.md)
  - [Infinite scroll](1-state/features/infinite-scroll.md)
  - [Drag & drop](1-state/features/drag-drop.md)
  - [Virtual scroll](1-state/features/virtual-scroll.md)

### 2. Columns Schema Layer — `[2-columns/](2-columns/)`

Column type system: intrinsic metadata, layout primitives, feature config.

- **[Architecture](2-columns/architecture.md)** — Schema patterns, tier hierarchy, derivation flow
- **Reference** `[2-columns/reference/](2-columns/reference/)` — Deep dives:
  - [Ownership model](2-columns/reference/ownership-model.md) — Signals vs. plain data
  - [Data-derived patterns](2-columns/reference/data-derived.md) — Recomputation, side effects
  - [Signal forms & techniques](2-columns/reference/signal-forms-techniques.md)
  - [Tier 1: Intrinsic](2-columns/reference/tier-1-intrinsic.md) — Base column metadata
  - [Tier 2: Layout](2-columns/reference/tier-2-layout.md) — Width, alignment, overflow
  - [Tier 3: Feature config](2-columns/reference/tier-3-feature-config.md) — Per-feature metadata

### 3. UI Layer — `[3-ui/](3-ui/)`

Directives, templates, rendering pipeline, and cross-cutting concerns.

- **[Architecture](3-ui/architecture.md)** — Component hierarchy, primitive wiring, rendering flow
- **Directives** `[3-ui/directives/](3-ui/directives/)` — Template API and lifecycle:
  - [Core](3-ui/directives/core.md) — `ngpTable`, `ngpTableRow`, `ngpTableCell`
  - [Columns](3-ui/directives/columns.md) — `ngpTableColumn`
  - [Sort control](3-ui/directives/sort.md)
  - [Expansion control](3-ui/directives/expansion.md)
  - [Grouping](3-ui/directives/grouping.md)
  - [Selection](3-ui/directives/selection.md)
  - [Drag & drop](3-ui/directives/drag-drop.md)
  - [Column resizing](3-ui/directives/resizing.md)
- **Cross-cutting** `[3-ui/cross-cutting/](3-ui/cross-cutting/)` — Horizontal concerns:
  - [Accessibility](3-ui/cross-cutting/accessibility.md)
  - [Styling tokens](3-ui/cross-cutting/styling-tokens.md)
  - [Virtual scroll integration](3-ui/cross-cutting/virtual-scroll.md)

## Work Efforts

In-progress work is tracked in `work/` folders at each layer. Each effort has stages 1–5 (ticket → grill → spec → issues → tasks).

- **[1-state/work/](1-state/work/)** — State layer efforts
  - [drop-ngrx-engine](1-state/work/drop-ngrx-engine/) — Replaced `@ngrx/signals` with the in-house `composeTable()` engine (✅ landed, ADR-0003)
  - [state-feature-competitive-audit](1-state/work/state-feature-competitive-audit/) — State-layer feature comparison against TanStack Table, AG Grid, Material React Table and PrimeNG, the resulting [gap analysis](1-state/work/state-feature-competitive-audit/gap-analysis.md), and the build priority it ranked (✅ audit landed; the features it identifies are not built)
- **[3-ui/work/](3-ui/work/)** — UI layer efforts
  - [core-directives](3-ui/work/core-directives/) — Core directive implementation (🔄 in progress)

## Entry Points by Role

- **Implementing a feature?** Start at the PRD and architecture for your layer, then find your work effort.
- **Reviewing directives?** Read [3-ui/architecture.md](3-ui/architecture.md) and [3-ui/directives/core.md](3-ui/directives/core.md).
- **Adding a state plugin?** See [1-state/architecture.md](1-state/architecture.md) and a sibling feature doc like [1-state/features/sorting.md](1-state/features/sorting.md).
- **Debugging column config?** See [1-state/columns.md](1-state/columns.md) and [2-columns/architecture.md](2-columns/architecture.md).
- **Styling or accessibility?** See [3-ui/cross-cutting/](3-ui/cross-cutting/).
