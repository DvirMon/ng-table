# What does this repo already decide, document and demonstrate about filtering a tree grid (`withFiltering()` × `withTree()`, and × `withGrouping()`)?

**Date:** 2026-09-27 · **Mode:** internal-coverage

> ⚠ **Superseded in part** — `tree.md`, ADR-0012 Decision 6 and `decisions/expansion.md` E5/E6
> all state that every tree node is an entry in `data()`. Shipped `with-tree.ts` does not do that
> (nested `childrenAccessor`). #163 / TFD D1 (E20) is the fix, not yet in code. Several grouping
> docs still describe a `'prune'` stage and an `expand` pipeline stage. ADR-0023 and
> `engine/pipeline.ts` win for both. See Findings §B.

## Answer

- **The orphan rule has no settled position anywhere in the repo.** TFD D2 marks it open.
  No product doc has a filtering × tree story.
- **Shipped behavior is already one orphan rule, and nobody chose it.** The filter sees root
  rows only. A matching parent shows _all_ its children, including ones that don't match.
  A parent that doesn't match hides _all_ its children, including ones that do match.
- **The nearest settled position is grouping's.** "Filter before group" is recorded as
  deliberately ruling out AG Grid's `groupAggFiltering` failure: "a passing group dragging in
  all its descendants". Applied to trees, that argues against a "matching parent keeps every
  child" mode.
- **Flat data will change grouping and counts on screen.** Children join `rows()`. They get
  clustered by their own values, counted by `rowsOf()` and `totalRowCount`, and included in
  aggregates. No doc covers any of this yet.
- **Story coverage for tree + filter is zero.** The only `withTree()` story composes no
  filter. The only grouping + filter story composes no tree.

## Method and source reliability

- Read-only, 2026-09-27, working tree of branch `docs/tree-flat-data-163`. Every claim below
  comes from reading the file itself.
- Issue #163 was read by WebFetch of `github.com/DvirMon/ng-table/issues/163`. `gh` was not
  available in this session. The fetch returned a model summary, not the raw body. Treat
  quotes from it as **secondary**: it reported state Open, opened 2026-09-27, no comments.
- Story coverage comes from host `.component.ts` / `.html` files, never from `.mdx` wrappers or
  story names.
- "Product-visible" means a person at the screen can see the difference. "Internal-only" means
  only a developer or maintainer can.
- `TFD D2` was appended to `1-decisions.md` by another writer while this ran
  (`1-decisions.md:33`). It is quoted as read at that time.
- ADR-0014 and ADR-0020 read `Status: proposed` (`adr/0014-runtime-error-policy.md:3`,
  `adr/0020-...:3`). Code follows 0014 anyway. ADR-0020 Decision 4 is **not implemented**:
  grepping `src/engine` for a containment check finds nothing.

## Findings

### A. Settled decisions touching filtering × tree / expansion / grouping

| #   | Decision (one line)                                                                                                                                       | Tag                                  | Source                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| A1  | Pipeline order is fixed `filter → group → sort`, whatever the argument order                                                                              | product-visible                      | `src/engine/pipeline.ts:4`; `libs/table/CLAUDE.md` "Feature plugin pattern"            |
| A2  | Render order is fixed `group → tree`. Grouping is the outer structure                                                                                     | product-visible                      | `src/engine/render-stages.ts:20`; `adr/0011-chained-render-stages.md:65-68`            |
| A3  | Filter runs first, so `aggregateFn` never sees unfiltered rows                                                                                            | product-visible                      | `1-state/features/filtering.md:415-417`, `:676-677`                                    |
| A4  | Filter before group makes an empty group unrepresentable, and rules out AG Grid's `groupAggFiltering` ("a passing group dragging in all its descendants") | product-visible                      | `0-product/grouping.md:1058-1059`, `:819-822`                                          |
| A5  | `withTree()` takes real-row parents only: every node is in `data()`, no `getDataPath`                                                                     | internal-only (contract)             | `decisions/expansion.md:48` (E5)                                                       |
| A6  | `childrenAccessor` → `parentId: (row) => RowId \| null \| undefined`. Nullish means root. Omitted means collapse-only                                     | internal-only                        | `decisions/expansion.md:63` (E20); TFD `1-decisions.md:32` (D1)                        |
| A7  | Orphan rule **not decided**. Candidate modes: promote to root, drop, keep ancestors, filter children only. Blocks N3, N4, N5                              | product-visible                      | TFD `1-decisions.md:33` (D2)                                                           |
| A8  | Hard break: `childrenAccessor` is deleted, no `flattenTree` helper, flattening is the consumer's job                                                      | internal-only                        | TFD `1-decisions.md:34` (D3)                                                           |
| A9  | Omitted accessor means collapse-only: no `'tree'` stage, still contributes `expandedRows`                                                                 | product-visible (collapsible groups) | `decisions/expansion.md:56` (E13); `src/api/features/with-tree.ts:255-264`             |
| A10 | Collapsible groups = `withGrouping()` + `withTree()`. The panel contributes nothing to visibility                                                         | product-visible                      | `decisions/expansion.md:55` (E12); `adr/0012-...:100-108`                              |
| A11 | `withTree()` never gets declared levels. A declared-axis hierarchy is `withGrouping()`                                                                    | internal-only                        | `decisions/expansion.md:58` (E15)                                                      |
| A12 | A throwing tree callback degrades to "no children" / "no toggle" and reports once per evaluation                                                          | product-visible                      | `decisions/expansion.md:59` (E16); `with-tree.ts:91-116`                               |
| A13 | Restored ids that no longer match a row are kept, not dropped. Staleness is the caller's to handle                                                        | internal-only                        | `decisions/expansion.md:47` (E4)                                                       |
| A14 | Collapse is engine-owned. `flattenVisible` is the only reader of expansion state and derives `depth`/`parentId`                                           | internal-only                        | `adr/0023-tree-shaped-render-ir.md:38-107`; `src/engine/flatten.ts:12-20`              |
| A15 | A group header is a view over rows. `rowsOf()` is post-filter and ignores collapse                                                                        | product-visible                      | `decisions/grouping.md:60`, `:62` (G18, G20)                                           |
| A16 | A cluster rejected by `when` renders flat at depth 0                                                                                                      | product-visible                      | `decisions/grouping.md:64` (G22)                                                       |
| A17 | Aggregates compute over a cluster's own leaf rows at every depth                                                                                          | product-visible                      | `1-state/features/grouping.md:232-236`; `0-product/grouping.md:1053`                   |
| A18 | "Select all" defaults to `rows()` (post-filter). `includeHidden` covers all of `data()`                                                                   | product-visible                      | `0-product/filtering.md:503-506`; `with-selection/utils.ts:10-16`                      |
| A19 | No parent/child selection cascade in state (D13). The consumer owns it via `rowsOf()`                                                                     | product-visible                      | `0-product/selection.md:731-734`                                                       |
| A20 | A feature storing `RowId`s declares `onRowsRemoved`. The engine diffs `indexById` keys, which come from `data()`                                          | internal-only                        | `libs/table/CLAUDE.md` "Feature plugin pattern"; `src/engine/compose-table.ts:205-217` |
| A21 | Runtime render-stage invariant (proposed): output real-row ids ⊆ input ids, degrade + report                                                              | internal-only                        | `adr/0020-...:86-88`                                                                   |

### B. Doc claims contradicted by current code

**B-flagged**: the doc itself, or a newer decision, says it is superseded.

| Claim                    | Where                             | Code says                         | Flag                                                 |
| ------------------------ | --------------------------------- | --------------------------------- | ---------------------------------------------------- |
| `childrenAccessor` shape | `decisions/expansion.md:44,49,56` | still shipped (`with-tree.ts:20`) | flagged, superseded by E20, which is not in code yet |
| `'prune'` render stage   | `adr/0017-...:26-31`              | gone (`render-stages.ts:20`)      | flagged (`adr/0017-...:13-19`)                       |

**B-unflagged**: the dangerous half.

| #   | Claim                                                                                                                       | Where                                                                                                                                                                                        | Code says                                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | "Every tree node, at any depth, is an entry in the flat `data()` array"                                                     | `1-state/features/tree.md:72-73`                                                                                                                                                             | Children come from `childrenAccessor(row)` and are nested at render time (`with-tree.ts:156-162`, `:124-140`). `rows()` holds roots only: spec asserts `rows()` = `['r1','r2']`, and children render only after expanding (`with-tree.spec.ts:537-540`). #163 states the same (secondary).                   |
| B2  | "G6 is closed as impossible … a nested child at any depth resolves a `sourceIndex`"                                         | `tree.md:126-130`; `adr/0012-...:114-119`; `decisions/expansion.md:49` (E6 "closes G6")                                                                                                      | `indexById` comes from `data()` only (`core.ts:84-88`). `sourceIndex` is `byId.get(row.id)` (`core.ts:108`). A nested child not in `data()` gets `undefined`, and `ngp-table-row-field.resolve.ts:17-21` then renders no field. `0-product/row-editing.md:703-712` (E-1, ❌) still describes the real state. |
| B3  | Tree rows are ones the "table must sort / filter / edit"                                                                    | `adr/0012-...:34-37`                                                                                                                                                                         | Filter and sort run on `rows()` (`core.ts:60`), which holds no nested children. Children are never filtered or sorted and have no `sourceIndex`.                                                                                                                                                             |
| B4  | Removing a row prunes its open id (ADR-0006)                                                                                | `adr/0012-...:97-99`; `tree.md:108-110`                                                                                                                                                      | True for roots only. The diff reads `indexById` keys (`compose-table.ts:206-209`), so a nested child's open id is never announced as removed.                                                                                                                                                                |
| B5  | `sort → expand` pipeline stage                                                                                              | `1-state/features/grouping.md:182`; `1-state/architecture.md:150`; `0-product/grouping.md:794`; `0-product/sorting.md:656`; `1-state/features/filtering.md:415` ("before group/sort/expand") | `PIPELINE_ANCHORS = ['filter','group','sort']` (`pipeline.ts:4`)                                                                                                                                                                                                                                             |
| B6  | Collapse goes through "the engine-owned `'prune'` render stage"                                                             | `1-state/features/grouping.md:210-211`, `:266`; `0-product/grouping.md:272-274`, `:895-897`; `decisions/grouping.md:65` (G23, "shipped"); `3-ui/directives/grouping.md:36`                   | `flattenVisible` walk (`flatten.ts:21-49`, `core.ts:102-103`)                                                                                                                                                                                                                                                |
| B7  | Grouping render "stamps every header and leaf with its parent's id"                                                         | `1-state/features/grouping.md:198-199`                                                                                                                                                       | No stage stamps `parentId`. `flattenVisible` derives it (`flatten.ts:27-43`); `render.ts:132-158` sets no `parentId`.                                                                                                                                                                                        |
| B8  | `grouping-collapsible/` composes `withGrouping()` + `withExpansion()`                                                       | `0-product/grouping.md:77`; also `:269` ("no story composes `withExpansion()` with `withSelection()`")                                                                                       | Host composes `withTree({ childrenAccessor })` (`grouping-collapsible-story-host.component.ts:57-62`)                                                                                                                                                                                                        |
| B9  | E-G1 design status: ADR-0012 "would re-home the row chevron; the affordance question is unresolved"                         | `0-product/grouping.md:898-900`                                                                                                                                                              | ADR-0012 shipped. The row chevron is `table.tree.toggle` (`grouping-collapsible-story-host.component.html:106-114`).                                                                                                                                                                                         |
| B10 | PRD: pipeline `… → expansion`; `withExpansion()` owns `children`; `withGrouping()` reads `withExpansion()`'s `expandedRows` | `1-state/prd.md:99-104`. No supersession banner (`prd.md:1-16`). Story 23 alone carries an inline correction (`:62`).                                                                        | All contradicted: `pipeline.ts:4`; `with-tree.ts`; E12.                                                                                                                                                                                                                                                      |

### C. Stories already written elsewhere: link, don't rewrite

| Story                                                      | Owner doc                                                                     | What it says that bears on tree × filter                                                                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-G1: filtering a grouped table (🟡)                       | [`0-product/grouping.md:798-822`](../../../../../0-product/grouping.md)       | Counts follow surviving rows. An emptied group disappears. "Clearing the filter restores … my expand/collapse state" is **not demonstrated**: no story composes expansion with filtering (`:815-817`) |
| F-G2: filter by a group's summary (❌, out of scope)       | [`0-product/grouping.md:824-832`](../../../../../0-product/grouping.md)       | Group-level filter is a separate operation from row filtering                                                                                                                                         |
| X-G1: ticking a collapsed group under a filter (✅ recipe) | [`0-product/grouping.md:695-734`](../../../../../0-product/grouping.md)       | "never select rows I cannot see". Post-filter `rowsOf()`                                                                                                                                              |
| E-G1: collapsible groups + expandable rows (✅)            | [`0-product/grouping.md:875-900`](../../../../../0-product/grouping.md)       | Group chevron and row chevron are independent. Collapse state survives                                                                                                                                |
| Filtering §5 cross-feature index                           | [`0-product/filtering.md:429-465`](../../../../../0-product/filtering.md)     | Links F-G1/F-G2/X-G1 to grouping. **No tree or expansion entry**                                                                                                                                      |
| F-S1: select all under a filter (🟡)                       | [`0-product/filtering.md:468-506`](../../../../../0-product/filtering.md)     | Scope = `rows()`. Under flat data that set gains collapsed children (see D6)                                                                                                                          |
| E-1: editing a child row (❌)                              | [`0-product/row-editing.md:703-712`](../../../../../0-product/row-editing.md) | Resolved by #163's "child rows retain `sourceIndex`" criterion                                                                                                                                        |
| Grouping 8.4 "filter before group"                         | [`0-product/grouping.md:1058-1059`](../../../../../0-product/grouping.md)     | The only settled position on "match pulls in descendants"                                                                                                                                             |

Tree × filter has **no story in any product doc**. `grep` for tree, child, descendant, orphan
or ancestor near "filter" across `docs/0-product` finds only grouping.md:1059.

### D. What shipped code gives for free, and what it doesn't

| #   | Mechanism                                                                                                                                                                                                                                                                                                                                                                                          | Free?             | Evidence                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| D1  | Filtering never writes `data()`. It only drops rows from `rows()` (`with-filtering/feature.ts:93-106`). So `onRowsRemoved` never fires on a filter change, and an open id of a filtered-out parent or group **survives**. It re-opens when the filter clears.                                                                                                                                      | free              | `compose-table.ts:205-217` diffs `indexById` (from `data()`, `core.ts:84-88`)               |
| D2  | Empty groups: headers are built from post-filter render nodes (`render.ts:170-211`), so a group with no survivors gets no header. Covered by a data-removal test, not a filter-specific one.                                                                                                                                                                                                       | free              | `with-grouping/feature.spec.ts:545-550`; A4                                                 |
| D3  | `rowsOf()` and `groupIds()` read `input.rows()` (post-filter), ignoring collapse                                                                                                                                                                                                                                                                                                                   | free              | `with-grouping/feature.ts:188-193`; `queries.ts:31-50`, `:65-81`                            |
| D4  | `flattenVisible` derives `depth`/`parentId`/`hasChildren`/`isExpanded` from tree position. A render stage that nests children correctly gets all four for free.                                                                                                                                                                                                                                    | free              | `flatten.ts:21-49`                                                                          |
| D5  | `mapNodes` walks into group headers, so `'tree'` reaches rows nested under a group                                                                                                                                                                                                                                                                                                                 | free              | `render-stages.ts:42-49`; `with-tree.spec.ts:573-619`                                       |
| D6  | `totalRowCount` = `rows().length` feeds `aria-rowcount` and "N of M match". `selectAllIds` reads `rows()`. **Today** nested children are excluded from all three. After flat data they are **included, collapsed or not**.                                                                                                                                                                         | changes on screen | `compose-table.ts:54`; `directives/ngp-table.directive.ts:22`; `with-selection/utils.ts:14` |
| D7  | `sourceIndex` for flat child rows: `indexById` already covers every `data()` row, so #163 gets it with no engine change                                                                                                                                                                                                                                                                            | free after #163   | `core.ts:84-88`, `:108`                                                                     |
| D8  | Orphan handling: **nothing**. The tree stage receives `rows()` via the seed (`core.ts:102`; `rows.ts:26-31`). It has no ancestor lookup, and `TreeInput` picks only `rows`/`trackBy` (`with-tree.ts:49`). A "keep ancestors" mode needs `value()`/`data()` access. It would emit real rows that are not in `rows()`, which breaks proposed A21 and desyncs D6.                                     | not free          | as cited                                                                                    |
| D9  | Expandability discovery: `expand()` / `state` walk `input.rows()` (`with-tree.ts:211`, `:232`). After flat data, a filtered-out parent is not discoverable, and a surviving child is judged on its own.                                                                                                                                                                                            | open, owned by N3 | as cited                                                                                    |
| D10 | Group × tree after flat data: children are clustered by **their own** values in both the pipeline (`grouping/pipeline.ts:9-33`) and the render group stage (`render.ts:181-189`). That happens _before_ `'tree'` runs. A child whose group value differs from its parent's lands in another cluster. That is the "scatter" ADR-0011 cites as the reason for `group → tree` (`adr/0011-...:66-68`). | open, owned by N4 | as cited                                                                                    |
| D11 | Aggregates after flat data: parent and children become leaves of one cluster, so `aggregateFn` sums both. The shipped fixture parent `d4` (`amount: 42000`) equals `d4-a` + `d4-b` (25000 + 17000). A sum would double-count, and the header count would rise by 2 (`grouping-story.pipes.ts:41-48` reads `rowsOf().length`).                                                                      | changes on screen | `stories/grouping/fixtures/mock.ts:47-75`; A17                                              |

### E. Real story and demo coverage (read from host code)

| Host                                                                                           | Composes                                                                    | Tree?                                                             | Filter?   | Evidence                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grouping-collapsible/`                                                                        | `withGrouping` + `withTree({ childrenAccessor: row => row.children })`      | yes, one parent `d4` with 2 nested children                       | **no**    | `grouping-collapsible-story-host.component.ts:57-62`; `.html:105-114`                                                                                                                       |
| `grouping-selection/`                                                                          | `withGrouping` + `withSelection` + `withFiltering({ schema: dealFilters })` | **no**. `d4.children` never render because no `'tree'` stage runs | yes (rep) | `grouping-selection-story-host.component.ts:37-43`                                                                                                                                          |
| `client-filtering/`, `server-filtering/`, `filtering-selection/`, `composition/derived-state/` | `withFiltering` + others                                                    | no                                                                | yes       | `client-filtering-story-host.component.ts:97`; `server-filtering-story-host.component.ts:104`; `filtering-selection-story-host.component.ts:38`; `derived-state-story-host.component.ts:36` |

- No host composes `withTree()` with `withFiltering()`. A grep for `withTree(` under
  `src/stories` finds only `grouping-collapsible`.
- No spec composes them either. `withFiltering` appears in five spec files, none of them
  `with-tree.spec.ts`.
- The only tree fixture (`DealRow.children`, `fixtures/types.ts:22`) is nested. It is also
  re-nested by the MSW handler (`fixtures/handlers.ts:18-21`) and the HTTP reviver
  (`fixtures/http.ts:20-38`). All three need flattening under D3/N7.

## Synthesis — where they disagree

- **E5 vs. the code.** Four docs (A5, B1, B2, B3) describe a tree whose nodes live in `data()`.
  The code builds one outside `data()`, and none of the four is flagged. #163 exists because of
  this. Until it lands, any orphan-rule reasoning that starts from "children are already
  filtered" is wrong about today.
- **Shipped behavior vs. grouping's stated position.** Grouping rules out "a passing group
  dragging in all its descendants" (A4). The shipped tree does exactly that: a matching root
  shows all its children unfiltered. It also does the reverse: a non-matching root hides
  children that do match. So the current behavior is "keep the subtree of a matching root,
  drop the subtree of a failing root". It was never decided. It falls out of `childrenAccessor`
  bypassing the pipeline.
- **"Keep ancestors" vs. ADR-0020 and `rows()`.** A mode that shows a filtered-out ancestor
  above a matching child has to put back a real row that `rows()` excluded. That contradicts
  ADR-0020's proposed containment invariant (A21). It also splits `totalRowCount`,
  `selectAllIds` and `rowsOf()` (all from `rows()`) from what renders. Promote-to-root and
  drop keep `rows()` and the render in agreement. Keep-ancestors does not, unless it happens
  in the pipeline `filter` stage instead of in `'tree'`.
- **`group → tree` order vs. flat data.** ADR-0011 put `group` first so tree children would not
  scatter away from their value cluster. Under flat data, the group stage itself scatters them,
  because each child is clustered on its own values (D10). The orphan rule (N2) and group
  composition (N4) touch the same code path: a child whose parent is in another cluster is an
  orphan _within its cluster_ even with no filter active.
- **Leaf-only aggregates vs. real-row parents.** Grouping's invariant (A17) assumes clusters hold
  independent leaves. A tree parent that summarizes its children breaks that on the one
  shipped fixture (D11). Nothing decides whether parents, children or both count.
- **Collapse persistence is the one thing all docs and code agree on.** Open ids survive a
  filter (D1). F-G1's unproven "clearing restores expand/collapse" criterion holds by
  construction. It is just not on any canvas.

## Not researched

- `3-ui/directives/expansion.md`, and any UI-layer doc other than `3-ui/directives/grouping.md:36`.
- `docs/status.md` (generated): not checked for `tree` row values.
- Work-folder records behind E5/E6 (`panel-tree-split/2-spec.md`), other than through the
  ADR and the log.
- `row-editing` and `sorting` feature specs. Sorting siblings under #163 was not examined.
- The `apps/site` docs app. The `withTree` grep excluded nothing, but no site file matched.

## Unverified

- The #163 body wording. It came from a WebFetch summary. `gh issue view 163` would confirm it.
- "A filter-emptied group gets no header" is an inference from construction (`render.ts`
  clusters its input) plus a data-removal test. No filter-specific spec asserts it.
- B4 (a nested child's open id is never pruned) is inferred from the diff source. No spec
  exercises it.
- D10 and D11 describe behavior **after** #163 and are inferences from current clustering
  code. They are not observed.

## Sources

| Claim                                            | Source                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Pipeline anchors                                 | `libs/table/src/engine/pipeline.ts:4`                                                                         |
| Render anchors, `mapNodes`                       | `libs/table/src/engine/render-stages.ts:20`, `:42-49`                                                         |
| `rows`, `indexById`, `sourceIndex`, render chain | `libs/table/src/engine/core.ts:60`, `:84-88`, `:98-114`                                                       |
| Render seed                                      | `libs/table/src/engine/rows.ts:26-31`                                                                         |
| Flatten walk                                     | `libs/table/src/engine/flatten.ts:12-49`                                                                      |
| `onRowsRemoved` diff                             | `libs/table/src/engine/compose-table.ts:205-217`                                                              |
| `totalRowCount`                                  | `libs/table/src/engine/compose-table.ts:54`                                                                   |
| `aria-rowcount`                                  | `libs/table/src/directives/ngp-table.directive.ts:22`                                                         |
| Row-field resolve                                | `libs/table/src/directives/ngp-table-row-field.resolve.ts:17-21`                                              |
| Tree stage, callbacks, discovery, input          | `libs/table/src/api/features/with-tree.ts:20`, `:49`, `:91-116`, `:124-166`, `:211`, `:232`, `:255-264`       |
| Tree roots-only `rows()`                         | `libs/table/src/api/features/with-tree.spec.ts:537-540`                                                       |
| Tree through group nodes                         | `libs/table/src/api/features/with-tree.spec.ts:573-619`                                                       |
| Filter stage                                     | `libs/table/src/api/features/with-filtering/feature.ts:93-106`                                                |
| Grouping stages, `rowsOf`, `groupIds`            | `libs/table/src/api/features/with-grouping/feature.ts:188-193`, `:224-233`                                    |
| Pipeline clustering                              | `libs/table/src/engine/grouping/pipeline.ts:9-33`                                                             |
| Group render                                     | `libs/table/src/engine/grouping/render.ts:118-211`                                                            |
| Group queries                                    | `libs/table/src/engine/grouping/queries.ts:31-81`                                                             |
| Group emptied by removal                         | `libs/table/src/api/features/with-grouping/feature.spec.ts:545-550`                                           |
| Post-filter `rowsOf`                             | `libs/table/src/api/features/with-grouping/feature.spec.ts:894-906`                                           |
| `selectAllIds`                                   | `libs/table/src/api/features/with-selection/utils.ts:10-16`                                                   |
| Collapsible host                                 | `libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.ts:57-62`     |
| Collapsible template                             | `libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.html:105-114` |
| Grouping-selection host                          | `libs/table/src/stories/grouping/grouping-selection/grouping-selection-story-host.component.ts:37-43`         |
| Filtering hosts                                  | `libs/table/src/stories/filtering/client-filtering/client-filtering-story-host.component.ts:97`               |
| Server filtering host                            | `libs/table/src/stories/filtering/server-filtering/server-filtering-story-host.component.ts:104`              |
| Filtering-selection host                         | `libs/table/src/stories/selection/filtering-selection/filtering-selection-story-host.component.ts:38`         |
| Derived-state host                               | `libs/table/src/stories/composition/derived-state/derived-state-story-host.component.ts:36`                   |
| Group count pipe                                 | `libs/table/src/stories/grouping/grouping-story.pipes.ts:41-48`                                               |
| Fixture `d4` children                            | `libs/table/src/stories/grouping/fixtures/mock.ts:47-75`                                                      |
| Fixture type                                     | `libs/table/src/stories/grouping/fixtures/types.ts:22`                                                        |
| Fixture re-nesting                               | `libs/table/src/stories/grouping/fixtures/handlers.ts:18-21`                                                  |
| Fixture reviver                                  | `libs/table/src/stories/grouping/fixtures/http.ts:20-38`                                                      |
| E-log rows                                       | `libs/table/docs/decisions/expansion.md:44-63`                                                                |
| G-log rows                                       | `libs/table/docs/decisions/grouping.md:60-65`                                                                 |
| TFD D1–D3                                        | `libs/table/docs/1-state/work/tree/active/tree-flat-data/1-decisions.md:32-34`                                |
| Tree spec E5 / G6 claims                         | `libs/table/docs/1-state/features/tree.md:72-73`, `:126-130`                                                  |
| ADR-0011 order rationale                         | `libs/table/docs/adr/0011-chained-render-stages.md:65-68`                                                     |
| ADR-0012 table and D6                            | `libs/table/docs/adr/0012-split-expansion-into-panel-and-tree.md:34-37`, `:97-119`                            |
| ADR-0017 supersession banner                     | `libs/table/docs/adr/0017-engine-owned-descendant-prune.md:13-19`                                             |
| ADR-0020 containment invariant                   | `libs/table/docs/adr/0020-open-stage-registration-for-third-party-features.md:86-88`                          |
| ADR-0023                                         | `libs/table/docs/adr/0023-tree-shaped-render-ir.md:38-107`                                                    |
| Grouping spec stale stages                       | `libs/table/docs/1-state/features/grouping.md:182`, `:198-199`, `:210-211`, `:266`                            |
| Filtering spec stale `expand`                    | `libs/table/docs/1-state/features/filtering.md:415`                                                           |
| Architecture stale `expand`                      | `libs/table/docs/1-state/architecture.md:150`                                                                 |
| PRD stale pipeline                               | `libs/table/docs/1-state/prd.md:99-104`                                                                       |
| UI grouping stale prune                          | `libs/table/docs/3-ui/directives/grouping.md:36`                                                              |
| Product grouping stories                         | `libs/table/docs/0-product/grouping.md:77`, `:272-274`, `:695-734`, `:798-832`, `:875-900`, `:1053-1059`      |
| Product filtering cross-feature                  | `libs/table/docs/0-product/filtering.md:429-506`                                                              |
| Product row-editing E-1                          | `libs/table/docs/0-product/row-editing.md:703-712`                                                            |
| Product selection D13                            | `libs/table/docs/0-product/selection.md:731-734`                                                              |
| Product sorting stale `expand`                   | `libs/table/docs/0-product/sorting.md:656`                                                                    |
| Issue #163 (secondary)                           | https://github.com/DvirMon/ng-table/issues/163                                                                |
