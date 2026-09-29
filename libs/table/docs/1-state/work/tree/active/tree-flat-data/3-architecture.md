---
title: tree-flat-data — architecture (#163)
type: architecture
date: 2026-09-27
ticket: "#163"
spec: 2-spec.md
decisions: 1-decisions.md
---

# tree-flat-data — architecture

Consumed by `/to-issues` and `/to-tasks`. Paths are under
`libs/table/src/` unless stated. Grounded against `origin/main` at
`6e66ae0`'s successor (the #155 merge, PR #162).

## Settled — not open for relitigation

D-numbers are `1-decisions.md`; E-numbers the capability log.

| # | Decision | Source |
|---|---|---|
| S1 | `childrenAccessor` removed; `parentId?: (row) => RowId \| null \| undefined`; omitted = collapse-only, no `'tree'` claim | D1, D3, E13 |
| S2 | Parent link is an engine slot contributed by `withTree()`; filter, group and tree stages read the slot, never feature members | D6, ADR-0028 |
| S3 | Broken links (throw, self, cycle, absent id) degrade to root, subtree intact, report once per evaluation per kind | D4, D12 |
| S4 | Filter keeps match + ancestors; `includeDescendants` on `withFiltering()` | D5 |
| S5 | Reveal = derived source: (open ∪ revealed) − closedWhileRevealed; `revealContextRow` predicate; closed ids live only while context | D20 |
| S6 | `hasChildren` from the filtered view; `expand()`/`state` scan filtered view, `includeHidden` → `data()` | D8, D9 |
| S7 | Grouping clusters roots only; subtree follows root; count and `aggregateFn` rows include every node | D13–D15 |
| S8 | `totalRowCount`, `selectAllIds()` count every node after filter | D11 |
| S9 | `table.tree.parentOf/descendantsOf/contextRowIds` read-only | D12, D20 |
| S10 | `RenderRow.isContextRow`; `ngpTableTreeRow` binds `data-context-row` (presence) | D18, D21 |

## Current source — what changes where

### Engine contribution model

- `TableFeatureSpec` (`engine/types.ts:67-106`) fields: `members`,
  `stages`, `renderStages`, `expandedRows` (line 89, accumulating),
  `columnRules`, `setup`, `onDestroy`, `onRowsRemoved`.
- Collection: `engine/compose-table.ts:117-119` pushes
  `spec.expandedRows` into `handle.expandedSources`; union in
  `engine/core.ts:67-78`; consumed by `flattenVisible` at `core.ts:103`.
- Also touched by any new slot: `api/features/compose-features.ts:76,121-137`
  (merges inner specs) and `api/create-table-feature.ts:62`
  (`PIPELINE_BEHAVIOR_KEYS` — a derive block declaring the key throws).
- **Gap:** stages receive only rows (`RowTransform = (rows) => rows`,
  `engine/pipeline.ts:24`; `RenderNodeTransform`, `engine/render-stages.ts:33`).
  No context object reaches a stage. See A1.

### Filter

- `api/features/with-filtering/feature.ts:81-108`. Stage at 94-105:
  `if (manual || !filters) return rows;` then `rows.filter(matcher)`.
- Changes: when the parent link is present, keep matches plus their
  ancestors (plus descendants under `includeDescendants`); contribute
  the context-row id set to the engine (A2). Order of output = input
  order restricted to kept rows, so sort still carries.

### Grouping

- Pipeline `group` stage: `clusterRows` (`engine/grouping/pipeline.ts:9`)
  only reorders rows so each cluster is contiguous.
- Render `group` stage: `buildGroupRenderRows` (`engine/grouping/render.ts:170`).
  Aggregates at `render.ts:75` (`aggregateFn(rows)`), called at
  `render.ts:141-145` with the cluster's leaf items (`clusters.ts:104-123`).
- `rowsOf` (`api/features/with-grouping/feature.ts:188-189`) →
  `rowsBeneathGroup(input.rows(), …)`; group count in stories comes from
  `rowsOf(row).length` (`stories/grouping/grouping-story.pipes.ts:41-48`).
- Changes: with the parent link present, cluster by the **root's** value;
  descendants join their root's cluster, in input order (D25) — the
  `'tree'` render stage owns hierarchy order. Bucket items
  (hence `aggregateFn` rows and `rowsOf`) then include descendants by
  construction.

### Tree stage and flatten

- `api/features/with-tree.ts` (≈290 lines): `buildTreeStage` (137-158)
  and `toChildNode` (116-131) read nested children; discovery walk
  `collectExpandableRowIds` (163-181); `expandedRows` contributed at 264
  unconditionally.
- `flattenVisible` (`engine/flatten.ts:21-49`) derives `depth`,
  `parentId`, `hasChildren = node.hasChildren ?? children.length > 0`,
  `isExpanded` from tree position. Unchanged by this work.
- Central stamping `engine/core.ts:98-114` (`index`, `sourceIndex`,
  `cells`). `indexById` from `data()` — children resolve once they are
  rows. Add `isContextRow` here from the context-row slot.

### Types

```ts
// api/types.ts RenderRow (28-69) — add:
readonly isContextRow?: boolean;

// engine/render-stages.ts RenderNode (8-17) — add 'isContextRow' to the Omit list.

// api/features/with-tree.ts
export interface WithTreeConfig<TRow> {
  parentId?: (row: TRow) => RowId | null | undefined;
  isExpandable?: (row: TRow) => boolean;
  revealContextRow?: (row: TRow) => boolean; // default () => true
  initial?: readonly RowId[];
}

export interface TreeSlice {
  (): ReadonlySet<RowId>;
  readonly changed: Observable<ExpansionChange>;
  readonly state: Signal<'all' | 'some' | 'none'>;
  toggle(id: RowId, options?: ExpansionWriteOptions): void;
  expand(ids?: readonly RowId[], options?: TreeWriteOptions): void;
  collapse(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  set(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
  parentOf(id: RowId): RowId | null;
  descendantsOf(id: RowId): RowId[];
  readonly contextRowIds: Signal<ReadonlySet<RowId>>;
}
// TreeWriteOptions = ExpansionWriteOptions & { includeHidden?: boolean }
// (state's includeHidden variant: see A4)

// with-filtering config — add:
includeDescendants?: boolean;
```

`TreeSlice` is not exported today (`index.ts:42-44` exports
`withTree`, `WithTreeConfig`, `TreeMembers`, `ExpansionChange`,
`ExpansionWriteOptions`).

## Architecture decisions made here

- **A1 — stages read engine slots through a context argument.**
  Recommended: `RowTransform<TRow> = (rows, ctx: StageContext<TRow>) => rows`
  and the same for `RenderNodeTransform`, with
  `StageContext = { parentOf?: (row: TRow) => RowId | null }` resolved
  by the engine from the single `withTree()` contribution. Additive —
  existing `(rows) => …` lambdas ignore `ctx`, as `RowUpdater`
  (`api/types.ts:237`) already does. Rejected: reading the shared
  store lazily from a stage closure (`compose-table.ts:69-71`) — that is
  a feature reading another feature's members, which ADR-0028 forbids.
- **A2 — context-row ids are an accumulating engine slot.**
  `TableFeatureSpec.contextRows?: Signal<ReadonlySet<RowId>>`, contributed
  by `withFiltering()` (the only feature that knows what matched: kept
  rows minus matcher-passing rows), unioned in core like `expandedRows`.
  Core stamps `RenderRow.isContextRow` from it; `withTree()` reads it for
  reveal and `contextRowIds()`. Same principle as ADR-0028; recorded as
  E37 and as an ADR-0028 consequence.
- **A3 — parent link is single-claim.** Two `withTree({ parentId })`
  in one table is a construction error (throw, naming both), per
  `classify-errors-construction-vs-runtime`; `expandedRows` stays
  accumulating.
- **A4 — `state` with `includeHidden`.** `state` is a signal and takes no
  arguments; the `includeHidden` variant for the tri-state is left to
  `/to-tasks` (a second signal vs. a method). `expand(ids?, { includeHidden })`
  is settled.

## File layout for implementation

| File | Change |
|---|---|
| `engine/types.ts` | `contextRows?`, `parentLink?` on `TableFeatureSpec`; `StageContext` |
| `engine/pipeline.ts`, `engine/render-stages.ts` | transforms take `ctx`; `RenderNode` Omit gains `isContextRow` |
| `engine/compose-table.ts`, `engine/core.ts` | collect both slots; resolve `parentOf` (single claim); union context rows; pass `ctx`; stamp `isContextRow` |
| `api/create-table-feature.ts`, `api/features/compose-features.ts` | new keys in `PIPELINE_BEHAVIOR_KEYS` and in the merge |
| `api/types.ts` | `RenderRow.isContextRow?` |
| `api/features/with-tree.ts` → likely `api/features/with-tree/` | flat nesting stage, broken-link degradation + reports, reveal source, closed-while-revealed set, reads; grows past one concern — split per `file-organization` (e.g. `feature.ts`, `nest.ts`, `reveal.ts`) only if it does |
| `api/features/with-filtering/feature.ts` | ancestor/descendant retention via `ctx.parentOf`; `includeDescendants`; `contextRows` contribution |
| `engine/grouping/pipeline.ts`, `clusters.ts`, `render.ts` | cluster by root value when `ctx.parentOf` is present |
| `directives/ngp-table-tree-row.directive.ts` (new) + `index.ts` | `tr[ngpTableRow][ngpTableTreeRow]`, `div[…]`; binds `data-context-row` |
| `api/features/with-tree.spec.ts` | flat fixture; seam 1 cases |
| `directives/ngp-table-tree-row.directive.spec.ts` (new) | seam 2 |
| `stories/grouping/fixtures/{mock,types,handlers,http}.ts`, `grouping-collapsible-story-host.component.ts` | nested `children` → flat `parentId`; own-value parent amounts |
| `docs/1-state/features/tree.md`, filtering feature doc | contract text; nested-to-flat snippet; drop cycle open question |

## Open questions

- ~~**OQ-A1**~~ — resolved 2026-09-29 as B2 (D22): the engine passes
  `ctx` to every feature factory as a required second argument
  `(input, ctx)`; nothing is injected into `input`.
- **OQ-A4** — tri-state `includeHidden` surface (above).
- Product-level opens (OQ-1 selection cascade, OQ-3 pagination, OQ-4 lazy
  indicator, OQ-5 server filtering) stay in `0-product/tree.md`.
