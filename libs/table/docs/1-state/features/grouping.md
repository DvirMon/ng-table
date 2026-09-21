---
title: State Layer Reference — withGrouping()
type: architecture
version: 2.1
date: 2026-09-21
capability: grouping
spec: drilled
code: shipped
audience: developers
parent: ../architecture.md
---

# withGrouping()

**Decision history: [`decisions/grouping.md`](../../decisions/grouping.md).** That log is the
first thing to read before changing anything here — it carries every decision, what superseded
what, and what is still open. This file is the contract only: what grouping does today.

`manual: true` (server-side grouping) stays out of scope — see "Not in scope" below.

## What it does

An opt-in feature plugin owning an ordered list of group-by levels, the verbs that change it, and
the render-stage logic that turns clustered rows into `RenderRow`s with headers and per-cluster
aggregates at every depth.

Multi-level from v1. `initial` declares the levels **and** their nesting order; declarative rules
can only gate a declared level on or off, never introduce or reorder one (G32). Group order and
row sort are decoupled by construction (G5). No `effect()` anywhere in the feature.

## Public surface

Verified against `src/api/features/with-grouping/` on 2026-09-21.

```ts
interface WithGroupingConfig<TRow, TId extends string = string> {
  // Declared levels, outermost first — array order IS nesting order (G32).
  // Every id is validated against `columns` at construction (ADR-0024) — an
  // unknown id throws, it never silently degrades.
  initial?: (TId | GroupingLevel<TId>)[];

  // Table-wide admission, judged at every active level. AND'd with any per-column `when`.
  when?: GroupWhen<TRow>;

  // The single declarative entry. Records by side effect; returns nothing.
  // Call order carries no meaning — nesting comes from `initial` alone (G33).
  // Path is keyed by declared column id, the same space `columns` declares (ADR-0024).
  schema?: GroupingSchemaFn<TRow, TId>;
}

interface GroupingLevel<TId extends string = string> {
  readonly columnId: TId;
  readonly label?: string;          // resolves: explicit -> matching column's own label
}

interface GroupingMembers<TRow> {
  // Reads APPLIED levels; writes DECLARED ones (G37) — a gated-off level survives a round-trip.
  readonly grouping: WritableView<string[], GroupingUpdater<TRow>>;
  readonly rowsOf: (group: RenderRow<TRow>) => readonly TRow[];
  readonly groupIds: Signal<RowId[]>;
  readonly groupingLevels: Signal<ColumnDef<TRow>[]>;   // applied levels as ColumnDefs
  readonly isGroupedBy: (columnId: string) => boolean;  // O(1), against applied levels
}
```

**There is no `rules` member.** The rules-array layer was removed; `schema` is the only
declarative entry.

**`ColumnId<TRow>` no longer exists.** Every id-shaped slot in this feature — `initial`, a
`GroupingLevel`, `schema`'s `path` — is the declared column-id union (`TId`), recovered from
`createTable()`'s `columns` argument, not a loose `keyof TRow | string`.

**Grouping reads every value through the column's `accessor`** — `readAccessor(column, row)`,
the same single value source cells and sorting read (ADR-0024). A level's value is never a raw
`row[key]` bracket read. This reverses the feature's original design (D7): a column and the group
it sits under can no longer legitimately disagree, because grouping partitions on the same value
the cell renders.

### Declarators — one per concern (G39)

Each is declared inside `schema`, against a `GroupingPath` keyed by declared column id:

| Declarator | Concern |
|---|---|
| `applyGrouping(path.x, { enable?, when? })` | activation and per-column admission |
| `applyGroupingAsync(path.x, { params, factory, onSuccess, onError })` | activation from a resource |
| `applyGroupKey(path.x, extractValue)` | key derivation — must return a primitive |
| `applyGroupOrder(path.x, cmp)` | sibling order at that level |
| `applyAggregate(path.x, aggregateFn)` | one summary value per cluster per column |

`applyGrouping` declaring neither `enable` nor `when` throws at construction. A second
`applyGroupKey` on one column is a duplicate registration and throws.

**`applyGroupKey`'s extractor receives the column's `accessor` output, not the raw row.** A
column whose accessor already computes the group-relevant value needs no `applyGroupKey` at all;
one like `closedAt: Date` still needs one to key a month out of what the accessor returns.

### Write surface

`table.grouping.update(updater)` — never bare setters (G1). Updater factories:
`setGroupLevels`, `addGroupLevel`, `removeGroupLevel`, `reorderGroupLevels`.

State stays `string[]`, so it round-trips through `JSON.stringify` (G39). Labels are a registry
lookup off `initial`, never part of the state.

### Unknown column ids throw — one rule, two construction-time paths

A declaration naming an id absent from `columns` throws, naming both the declaring surface
(`[withGrouping]`) and the offending id — whether the id came from `initial`, from a `schema`
rule (any declarator, including `applyAggregate`), or from `table.grouping.update(updater)`'s
resulting array. The writer runs the updater, validates its result, then commits — so
`addGroupLevel('nope')` throws exactly like an unknown id in `initial` would. This is deliberate:
without it, `groupingLevels()` would need to silently drop an orphaned level again (see below).

**Index bounds still degrade.** `reorderGroupLevels` with an out-of-range index is a no-op, not a
throw — only an *unknown column id* throws; a bad index is not that.

**One runtime exception: a column removed later via `setColumns()`.** The throw above only fires
at the two write paths it guards; a `columns` write does not re-validate the grouping array
already in place. Removing a still-active level's column (an ordinary column-picker interaction)
is therefore a runtime, data-dependent condition, not a construction/writer contract violation —
`groupingLevels()` omits the orphaned level and the render layer falls back to the raw id as its
label, each reporting once via `console.error` (ADR-0014), rather than throwing.

### Carrier columns

A value the table groups by but never renders is declared as a column with `visible: false` and
an `accessor` — `{ id: 'region', accessor: (row) => row.meta.region, visible: false }`. Grouping
partitions on it like any other declared column. `visible` is not enforced by the library; a
consumer filters it out of its own column list for rendering.

### Declared vs. applied (G37)

| | Source | Consumers |
|---|---|---|
| **declared** | `maskGroupingLevels(baseGrouping(), ruleEntries)` | clustering, `groupIds`, `rowsOf` |
| **applied** | levels with ≥1 admitted cluster, read off the cluster tree | `grouping()`, `groupingLevels`, `isGroupedBy` |

A level that admits no cluster is not a grouping level — the public read follows what renders.
Applied derives *from* the clustered tree, so there is no cycle.

### Rule resolution

| Entry state | `result()` | Effect on other levels |
|---|---|---|
| never resolved, pending | `undefined` | whole set abstains — declared passes through unmasked |
| resolved, now pending | its last boolean | none (G51) |
| resolved | that boolean | none |
| threw | `false`, reported once | none |

A rule naming an undeclared field is inert (G34). A rule with no `enable` contributes no entry,
so a `when`-only rule can never mask or abstain.

## Group admission (`when`)

Every built cluster renders as a group unless a `when` predicate rejects it. A rejected cluster's
rows exit the grouping tree entirely — no header, no group id, no aggregates — and render flat at
the parent's depth. They do not re-enter at a deeper level (G22).

Three facts the signature does not state: dissolution happens **after** ordering, so a comparator's
position for a dissolved cluster is where its flat rows land; with no comparator the default is a
stable partition, admitted siblings first; a throwing `when` **admits** the cluster and reports
once per column per evaluation.

Mechanism and rejected alternatives:
[`design-group-admission.md`](../work/grouping/archive/with-grouping/design-group-admission.md).

## Pipeline stage — clustering, not tree-building

The `group` pipeline stage stays `TRow[] → TRow[]`, matching `PipelineStages<TRow>`. It performs
**stable clustering**: same-key rows gathered into contiguous runs, order otherwise preserved.

`sort` runs after `group` in the fixed `filter → group → sort → expand` order, so a stable sort
keeps clusters contiguous and the two stages need no coordination. Headers and aggregates are not
produced here — the render layer synthesizes them downstream, which is also why `aggregateFn`
always receives post-filter rows.

**A row sort does move group headers.** The `'group'` render stage re-clusters the *sorted* rows,
so with no comparator supplied, first-occurrence group order follows the sort. Rows within a group
stay contiguous. G5's decoupling is `applyGroupOrder`-only — supply one to pin group order across
sort changes.

## Render layer — `renderRows`

`withGrouping()` claims the `'group'` render stage ([ADR-0011](../../adr/0011-chained-render-stages.md);
`withTree()` claims `'tree'` when composed with a `childrenAccessor`, leaving `'group'` free).
It walks the clustered `rows()`,
inserts a `kind: 'group'` header at each cluster boundary with `id` synthesized as
`group:${columnId}:${value}`, computes `aggregates` over that cluster's leaves, and stamps every
header and leaf with its parent's id — emitting the full tree **unconditionally**.

`store.renderRows` is always present on the core store, degenerating to a 1:1 wrap of `rows()`
when no grouping is composed — zero behavior change for tables that predate the feature.

**Consumer split:** logic-layer code (exports, `effect()`s, aggregate inputs) reads `rows()` —
pure `TRow[]`, unaffected by grouping or collapse. Template and virtual-scroll code reads
`renderRows()`.

## Collapse/expand is not grouping's code

Collapsing a group omits its descendants through the **engine-owned `'prune'` render stage**
([ADR-0017](../../adr/0017-engine-owned-descendant-prune.md)), which unions every composed
feature's `expandedRows`. `withGrouping()` reads no expansion state at all and composes in any
argument order (G23). The header itself always still renders. Collapsible grouping is
`createTable(config, withGrouping(schema), withTree())` — `withExpansion()` (the detail panel)
declares no `expandedRows` contribution at all and cannot drive group collapse
([ADR-0012](../../adr/0012-split-expansion-into-panel-and-tree.md)).

Without `withTree()` composed, everything renders flat and expanded — valid standalone use.

`rowsOf(group)` stays correct under collapse: it re-derives the cluster tree from `rows()`
(pipeline output) rather than scanning `renderRows()` (G20).

## Aggregation

`applyAggregate(path.x, aggregateFn)` declares one summary value per group per declared column,
recomputed reactively when membership changes. Aggregation is a grouping declaration, keyed by
declared column id like every other data concern `schema` records — **not** a `ColumnDef` option.
`ColumnDef.aggregateFn` does not exist. This is what lets a column with no row field of its own —
a carrier column, or one whose accessor derives its value — carry a total: `computeAggregates`
reads purely from the declared `aggregateByColumn` map, never from the column's own shape.

Two invariants make depth mechanical:

1. **Aggregates always compute over a cluster's own leaf rows** — never over a descendant's
   already-computed aggregate.
2. **Ordering compares siblings within a parent** — not globally across depths.

A throwing `aggregateFn` yields `undefined` for that column only; the group still renders. All
grouping callbacks wrap per callback, never per row, and report once per evaluation
([ADR-0014](../../adr/0014-runtime-error-policy.md)).

## Group selection

A group header is a **view over rows, not a row** (G18). It never enters `selectedRows` and never
counts toward a selection total. `rowsOf(group)` returns every leaf beneath a header at any depth;
the consumer owns any cascade:

```ts
const ids = table.rowsOf(group).map(table.trackBy);
table.selectionStateOf(ids) === 'all' ? table.deselect(ids) : table.select(ids);
```

A group's row count is `rowsOf(group).length` — there is no count field on `RenderRow`. Resolve a
group by `id`, never by object identity: `renderRows()` rebuilds its objects every pass (G19).

The one deliberate exception is `expandedRows`, which does hold synthetic `group:` ids — that set
holds *toggles*, not records, which is what makes group expansion survive a refetch for free.

## ADRs that constrain this feature

In descending order of how badly this goes wrong without them.

| ADR | What it constrains |
|---|---|
| [0024](../../adr/0024-single-value-source-accessor.md) | The column `accessor` is the single value source; grouping's schema and `initial` key by declared column id, same space `columnsSchema` uses |
| [0017](../../adr/0017-engine-owned-descendant-prune.md) | Collapse is engine-owned. Grouping emits unconditionally and reads no expansion state |
| [0018](../../adr/0018-when-vs-enable-predicate-naming.md) | `when` vs `enable` — grouping is the only feature carrying both predicates |
| [0011](../../adr/0011-chained-render-stages.md) | The `'group'` render stage claim; `RenderStages` derives from `RENDER_ORDER` |
| [0014](../../adr/0014-runtime-error-policy.md) | Consumer callbacks degrade and report; they never throw |
| [0019](../../adr/0019-columns-path-keyed-by-declared-column-ids.md) | `ColumnsPath`-style keying by declared ids — grouping is now one of its consumers, per ADR-0024's amendment |
| [0022](../../adr/0022-render-row-cell-values.md) | `buildGroupCells` spreads `aggregates` into column-id-keyed `cells` |
| [0021](../../adr/0021-column-concerns-and-data-concerns-are-separate-surfaces.md) | Superseded for grouping by ADR-0024 — kept for its still-standing capability test on other surfaces |
| [0012](../../adr/0012-split-expansion-into-panel-and-tree.md), [0006](../../adr/0006-row-id-state-reconciliation.md) | Background: stage allocation, and group ids as synthetic `RowId`s |

## Not in scope

- **`manual: true`** (server-side grouping) — structurally blocked, not merely unbuilt: a
  manual-mode feature whose state feeds the request producing `data` cannot live inside a feature
  composed on `createTable(data, …)`. No competitor API to borrow (G16).
- **Header-click routing to group order** — a directive-layer convenience, not a store decision (G17).
- **Grand totals and pivoting** — the larger AG Grid Enterprise machinery, no current use case (G9).
- **Per-column `enableGrouping` opt-out** — never scoped in.

## Prior art

`renderRows` follows the MUI X / AG Grid separation — a derived tree layer over flat data, with
`rows: Signal<TRow[]>` left untouched — rather than TanStack's always-wrap `Row<TData>`, which
would force every consumer, including ungrouped tables, to unwrap `.original`.

The depth>0 aggregation-correctness bugs three competitors carry (TanStack #3323/#3232; MUI X
#16540/#12684/#8493) come from computing aggregates inside row-model passes over wrapper objects
with `subRows`, where "which rows does this aggregate see" is ambiguous at depth. This library
clusters in a pure `TRow[] → TRow[]` stage and aggregates downstream over already-fixed clusters,
so that bug class does not apply — which is why G9 could reopen the single-level scope-out.

On group ordering, three of four researched libraries reuse column sort recursively, a documented
bug source (TanStack; MUI X; AG Grid #7850). Only AG Grid treats group order as its own concept,
Enterprise-gated behind `groupMaintainOrder: true` — whose *unflagged* behavior this library gets
for free from its fixed pipeline order.

Full competitive reasoning:
[gap-analysis.md](../work/meta/archive/state-feature-competitive-audit/gap-analysis.md).
