---
title: Research — internal grouping coverage audit, prior to the product user-stories doc
type: research
status: complete
date: 2026-09-10
audience: product, developers
issue: null
---

# What this repo already says about grouping, and what it can already show

Evidence file for the writing of `docs/0-product/grouping.md`. It states what exists and where;
it proposes no API and writes no user stories.

Paths are relative to `libs/shared/table/` unless written out in full. Every claim carries a file
path, and a line number wherever it is a specific statement.

**One correction to the brief up front:** a spec already exists —
[`docs/1-state/work/with-grouping/3-spec.md`](3-spec.md), `status: ready`, dated 2026-09-10. It
synthesizes D1–D15 into a written contract (24 developer-voice user stories at
`3-spec.md:75-140`, a public surface sketch at `:157-187`, testing decisions at `:330-369`, and an
explicit Out of Scope list at `:371-391`). The product doc has to sit *beside* it, not upstream of
it. Also present and unmentioned in the brief: three research files backing the decisions
(`research-group-ordering.md`, `research-grouping-state-ownership.md`,
`research-generic-grouping-utilities.md`, all `status: complete`, 2026-09-09).

---

## 1. Settled grouping decisions — D1–D15

Source: [`2-decisions.md`](2-decisions.md), frontmatter `status: drilling — D1–D15 settled, 2 open`
(`:4`). Tag = whether a person sitting in front of the table could perceive the difference.

| D | One line | Tag | Lines |
|---|---|---|---|
| D1 | Writes go through `table.grouping.update(updater)` with pure updater factories (`setGroupLevels`, `addGroupLevel`, `removeGroupLevel`, `reorderGroupLevels`), replacing `setGrouping`/`clearGrouping` | `[internal-only]` — but the verb set names four product affordances: set, add, remove, **reorder** a level | `:21-28` |
| D2 | Grouping state lives on the feature, never on `ColumnDef`; `ColumnDef` keeps only static predicates (`sortFn`, `aggregateFn`, `filterFn`) | `[internal-only]` | `:30-38` |
| D3 | Shape is `grouping: string[]`, ordered, index 0 = outermost level | `[product-visible]` — nesting exists and has an order the person can change | `:40-41` |
| D4 | Group *order* is a `groupOrder` comparator over group **contents** (`GroupSummary` = key + rows), not over keys | `[product-visible]` — "order categories by row count" or by a pinned list is expressible | `:43-61` |
| D5 | Group order and row sort stay fully decoupled — `groupOrder` orders clusters, `sorting` only reorders rows inside one | `[product-visible]` — and its accepted consequence is on-screen: **sorting by the grouped column is a visible no-op** (`:74-76`) | `:63-76` |
| D6 | State is a base signal + optional rule overlay folded in a `computed`; no `effect()` anywhere | `[internal-only]` | `:77-88` |
| D7 | `groupingRule: () => string[] \| undefined`; `[]` = grouped by nothing, `undefined` = abstain and hold the base | `[product-visible]` — the abstain branch is what stops first paint flashing flat then jumping (`:98-100`); its accepted cost is that a late-resolving rule can clobber the person's own choice (`:106-109`) | `:90-109` |
| D8 | Declarative sugar ships as three subtractable layers (schema fn → rules array → lambda), reusing `createRecorderSession()` | `[internal-only]` | `:111-130` |
| D9 | Full multi-level grouping ships; **grand totals and pivoting do not** | `[product-visible]` — reopens and supersedes the single-level scope; aggregates always compute over a cluster's leaf rows, `groupOrder` orders siblings within a parent | `:132-152` |
| D10 | `TRow` stays inferable; `withGrouping<TRow>()` is not baked into the contract (deferred `ctx` fix) | `[internal-only]` | `:154-159` |
| D11 | Nested-group collapse is grouping's **own** subtree walk — `'group'` runs before `'tree'`, so it cannot lean on `withExpansion()`; it reads `expandedRows` optionally | `[product-visible]` — whether a group can collapse at all depends on `withExpansion()` being composed | `:161-170` |
| D12 | Multi-level performance is a design constraint decided up front, not a later benchmark | `[product-visible]` indirectly — it is the only decision guarding "does a 3-level report stay usable" | `:172-176` |
| D13 | A pending rule makes the **whole set** abstain; an errored rule is never abstention (`onError` required); `applyGrouping` vs `applyGroupingAsync` splits on who owns the value at runtime | `[product-visible]` for the abstain half — the rejected alternative made the same page load show `['category']` on one run and `['status']` on another (`:189-192`) | `:178-220` |
| D14 | Column ids are `ColumnId<TRow>`; a bad id in **construction config throws**, a bad id arriving as **runtime data skips that level and groups by the rest** | `[product-visible]` — a stale saved grouping or an odd server preference degrades instead of blanking the table | `:222-247` |
| D15 | Consumer-callback fallbacks: a throwing `groupOrder` falls back to stable first-occurrence order; a throwing `when` makes that level not apply | `[product-visible]` — the person sees groups unordered, or sees grouping by less, rather than a dead page | `:249-260` |

### The two deferred items (`2-decisions.md:262-271`)

- **`manual: true` (server-side grouping)** — deferred because it is *structurally* blocked, not
  unresolved: a manual-mode feature whose state must feed the request that produces `data` cannot
  live inside a feature composed on `createTable(data, …)`. Filtering hit the same wall and was
  pushed out into a standalone primitive. No competitor API to borrow, because none of them share
  this construction order (`research-grouping-state-ownership.md`, findings table). Instruction is
  "do not lock a design against it" (`2-decisions.md:264-268`; restated `3-spec.md:373-378`).
- **Header click on the grouped column** — D5 makes it a visible no-op; routing that click to
  `groupOrder` instead is judged a directive-level convenience, UI layer not store, and is
  deliberately not designed (`2-decisions.md:269-271`; restated `3-spec.md:379-381`).

`3-spec.md:371-391` adds three more out-of-scope items the decisions file does not list as such:
grand totals + pivoting, the superseded `compareGroups` key comparator, per-column
`enableGrouping` opt-out (carried over unresolved, **not** newly scoped out), and auto-wiring a
header collapse-all/expand-all UI.

---

## 2. The state-layer reference — `docs/1-state/features/grouping.md`

Frontmatter: `version: 1.1`, `spec: drafted`, `code: none` (`:1-11`). Supersession banner at
`:15-26`.

**The banner is itself stale.** It says "D1–D12 settles the API surface" (`:17`) — the decisions
file now runs to D15, and D13–D15 (async rule semantics, id validity, callback fallbacks) are not
mentioned. It also names only two superseded sections, Methods and single-level; three further
statements in the file are contradicted and are *not* covered by it.

Contradicted by D1–D15 and flagged by the banner:

| Statement | Line | Contradicted by |
|---|---|---|
| "Single-level grouping (one active group-by column at a time)" | `:30` | D9 |
| `interface GroupingState { grouping: string \| null }` | `:34-38` | D3 |
| "Note: this diverges from the `string[]` shape … confirmed **single-level only**" | `:40` | D3, D9 |
| "**Single-level only** — one group-by column active at a time. No nested/hierarchical multi-level grouping." | `:44` | D9 |
| `setGrouping(columnId \| null)` / `clearGrouping()` methods table | `:51-56` | D1 |

Contradicted and **not** flagged by the banner — these are the ones most likely to mislead:

| Statement | Line | Problem |
|---|---|---|
| "Competitive position … the single-level scope **deliberately** sidesteps TanStack's unresolved depth-0 aggregation-correctness bug by not attempting depth at all in v1 — **do not 'fix' the scope by adding depth**" | `:154` | This is exactly what D9 did. The sentence now instructs a reader against the settled decision. |
| The whole `manual` contract section (`setGrouping` updates state, pipeline skips the client stage, `groupChanged` fires, consumer's own `effect()` refetches) | `:58-67` | `manual: true` is now an open/deferred item, and the consumer-`effect()` idiom is against D6's no-`effect()` posture. |
| "Events Owned — `groupChanged`, fires on every grouping state change" | `:143-145` | No decision D1–D15 and no line of `3-spec.md` mentions `groupChanged`. Grouping's event surface is currently *undesignated*, while shipped siblings do have one (`selectionChanged`, `filterChanged`, `rowExpanded`). |
| `RenderRow.groupKey?: { columnId: string; value: unknown }` in the render-layer sketch | `:108` | **No such field exists in code.** `src/api/types.ts:38-65` has no `groupKey`. |

Still current, per both the banner (`:24-26`) and `3-spec.md:17-20`: the pipeline stage as
clustering rather than tree-building (`:85-95`), the `renderRows`/`RenderRow` render-layer design
(`:97-131`), the aggregation contract (`:69-78`), and the optional `withExpansion()` coupling
(`:80-83`) — the last refined by D11 (grouping walks its own subtree; the `expandedRows` read
stays optional).

Two further things in that file that no decision touches, so they are still live for the product
doc:

- **"No per-column opt-out — every column can be grouped by; there is no `enableGrouping` flag
  (explicitly decided against, unlike `enableSorting`/`enableFiltering`)"** (`:49`). `3-spec.md:388`
  confirms this was carried over unresolved rather than re-decided.
- **The UI-layer split** (`:47`): store-level optionality is only half — a group row only gets a
  collapse affordance if the consumer's template wires one.

---

## 3. Grouping scenarios already written down elsewhere

### 3.1 The two that must be linked to, not rewritten

`docs/0-product/row-editing.md` §5, under "Owned by grouping *(unbuilt)*" (`:662-688`). That
file's own ownership rule (`:592-596`): "**Each story below belongs to the feature that has to
change its behavior to resolve the collision**", and its header rule (`:20-22`): "State-layer
efforts should **link** to it, not rewrite it — coverage marks here are updated from the product
side as capabilities land."

Quoted verbatim:

> ### G-1 — Changing the grouping field moves my row to another group — ❌ not covered (forward-looking)
>
> > As someone changing a person's department in a table grouped by department, I expect the row to
> > move to the new group — but I want to see it happen, and I do not want my next keystroke to land
> > in a different row.
>
> **Acceptance criteria**
>
> - The row moves to its new group, is scrolled into view, and is briefly highlighted.
> - Focus follows the row, or is explicitly released — it never silently lands on whichever row
>   slid into that screen position.
> - The move is announced.
> - A dropdown commits immediately, so this happens the instant the selection changes. That is
>   intended, and the announcement is what makes it survivable.
>
> ### G-2 — Adding a row while grouped — ❌ not covered (forward-looking)
>
> > As someone adding a row to a grouped table, I want to say which group it joins, or add it from
> > inside a group header.
>
> **Acceptance criteria**
>
> - Add is available per group, and the new row appears inside that group already carrying the
>   group's value in the grouped column.
> - Adding into a collapsed group expands it rather than filling an invisible row.

(`row-editing.md:664-688`.) Note the G-1 scenario is also described in prose from the state side at
`docs/1-state/features/row-editing.md:78` — "A dropdown commits on change and the row jumps groups
immediately".

### 3.2 Every other place a grouping scenario is already described

| Path | Line(s) | What it says |
|---|---|---|
| `docs/1-state/prd.md` | `:57-64` | **End-user-voice grouping stories already exist** (stories 20–25): group rows by a *single* column into collapsible categories; per-column aggregated summary; custom `aggregateFn`; `withGrouping()` requiring `withExpansion()` at compile time; `manual: true`; `setGrouping()`/`clearGrouping()`. Stories 20, 23, 24, 25 are now wrong (D9, D11/ADR-0012, deferred `manual`, D1). Restated as scope at `:103`. |
| `docs/1-state/features/selection.md` | `:128`, `:134-137` | Group-header select-all: a checkbox on a group header plausibly means "select every row in this group"; undecided whether library API or consumer code; not blocking selection. |
| `docs/1-state/work/with-selection/2-decisions.md` | `:168-173` | Same question, with an explicit instruction: "**Must be represented in the product use-cases / story set either way.**" Also `:225` — a third set-owning feature (`withGrouping()`) is what would justify promoting a shared change-event type. |
| `docs/1-state/work/row-editing/archive/with-mutations/2-decisions.md` | `:331-343` | "Deferred — insertion under grouping": add a row **to this group** is neither a `data` index nor a flat display index; the inserted row must carry the field values that place it in that group or the pipeline regroups it elsewhere. Recorded so the insertion API is not locked to flat indices. Same scenario as G-2, from the state side. |
| `docs/1-state/features/sorting.md` | `:167-169` | S9 — an empty row may have no value in the grouping column, so it has no group to belong to; where it renders under `withGrouping()` is undefined. |
| `docs/1-state/features/expansion.md` | `:76`, `:270` | Dual use: `expandedRows` holds synthetic `group:${columnId}:${value}` ids alongside real row ids; those synthetic ids are deliberately never pruned by `onRowsRemoved`. |
| `docs/1-state/features/filtering.md` | `:66-67`, `:144-146` | Filtering runs first, so `aggregateFn` never sees unfiltered rows — the filter × aggregation question is already resolved. |
| `docs/1-state/features/virtual-scroll.md` | `:17`, `:29`, `:31`, `:47` | Virtual scroll reads `renderRows()` only, so a group header and a leaf row are equally addressable; open question whether variable-height group headers break CDK's fixed `itemSize`. |
| `docs/3-ui/cross-cutting/virtual-scroll.md` | `:64`, `:66` | Tracking by `id` covers group rows and data rows with one function; `renderRow.data` is `null` on a group header, and *what a group header renders in its cells* is explicitly not yet drilled. |
| `docs/3-ui/directives/grouping.md` | whole file, `spec: stub` | **The UI-layer grouping file.** Scope decided 2026-08-07: a file but **no new directive** (`:16`), because `data-row-kind`, `data-depth`, `ngpTableExpandToggle` and `renderRows()` already cover it (`:20-27`); an `ngpTableGroupBy` header directive was rejected (`:29`). Five open items at `:41-45`: group-row cell structure (one spanning `<td>` vs one per column — "mutually exclusive layouts"), where the aggregate value comes from, `data-depth` → indentation, virtual-scroll row-height interaction, and group-label formatting for an `unknown` value. |
| `docs/3-ui/architecture.md` | `:21`, `:49`, `:82`, `:128` | Grouping is "drillable on paper, not verifiable" until `withGrouping()` exists; no directive; reuses `ngpTableExpandToggle`. |
| `docs/0-product/performance.md` | `:44-48` | Grouping is named as **where performance bites first** — recursive clustering + per-cluster aggregation at every depth, re-run whenever data, grouping or filters change. Two axes: 10k rows, and heavy cell UI (a real case that took seconds at 30–40 rows). |
| `docs/1-state/state-persistence.md` | `:90` | `TableSnapshot.grouping?: string \| null` — **contradicts D3**; a restored snapshot cannot express a multi-level grouping. `:236` — keep-unknown on restore matches how synthetic `group:*` ids already live in `expandedRows`. |
| `docs/2-columns/reference/tier-3-feature-config.md` | `:49-81` | An `applyGroup(path, …)` column-schema rule that seeds/toggles `withGrouping()` state, with a reactive `{ when }` form driven by "a store `effect()`" (`:57-58`), and a resolved decision that `applyGroup` with no `withGrouping()` composed is a **compile error** (`:80-81`). Note the naming and mechanism both diverge from D8's `applyGrouping` and D6's no-`effect()` fold. |
| `docs/1-state/work/meta/archive/state-feature-competitive-audit/gap-analysis.md` | `:49`, `:60-68`, `:127` | Grouping is "the feature that prompted this audit"; records the sort × grouping bug class as something to explicitly test for *once grouping ships*. |
| `docs/1-state/work/meta/archive/state-feature-competitive-audit/audit.md` | `:94-116`, `:205-206` | Competitor grouping/aggregation comparison; grouping correctness and performance **especially nested** listed as a top differentiation opportunity. |
| `docs/adr/0011-chained-render-stages.md` | `:37`, `:121-123`, `:163` | Grouping is the ADR's motivating case; `'group'` runs before `'tree'` because grouping is the outer structure; the ADR is what made `withGrouping()` buildable at all. |
| `docs/adr/0012-split-expansion-into-panel-and-tree.md` | `:99-101`, `:121`, `:135` | Group collapse delegates to the *panel* half of expansion, not the tree half; panel-only tables compose freely with grouping; ADR is `proposed`, not implemented. |
| `docs/3-ui/work/row-edit-stories/2-gap-analysis.md` | `:147` | G-1/G-2 have nothing to story yet because the feature is unbuilt. |

**Not the same concept, do not fold in:** `docs/1-state/features/column-pinning.md:150-152` and
`audit.md:42` are about *column* groups (header groups / `colgroup`), not row grouping.

---

## 4. What exists in code today that a grouping story would touch

| Thing | Where | Gives grouping for free | Does **not** give |
|---|---|---|---|
| `RENDER_ORDER = ['group','tree','paginate']` + `runRenderStages()` | `src/engine/render-stages.ts:8`, `:24-32` | The `'group'` slot is declared, ordered first, and free; the fold is a one-line reduce; collision is per named stage so grouping and expansion co-exist (ADR-0011) | Any clustering, header synthesis, or aggregation. Nothing registers `renderStages.group` outside test doubles (`src/engine/compose-table.spec.ts:146-168`, `render-stages.spec.ts:19-29`). |
| `PIPELINE_ORDER = ['filter','group','sort','expand']` | `src/engine/pipeline.ts:6` | The `'group'` **pipeline** slot is free too, and its position guarantees clusters see post-filter rows and are re-sorted only within themselves | Nothing claims it. |
| Render-row seed + central stamping | `src/engine/core.ts:44`, `:65-76` | `index` is assigned centrally after the whole chain, and `sourceIndex` is `undefined` for any row with `data === null` — i.e. group headers are already safe to emit | Nothing knows a group header from any other synthesized row. |
| `RenderRow<TRow>` | `src/api/types.ts:38-65` | `kind: 'row' \| 'group'` (`:36`), `depth` (`:42`), `data: TRow \| null` (`:44`), optional `aggregates?: Record<string, unknown>` (`:53`), `hasChildren?` (`:59`) — the whole shape multi-level grouping needs, unchanged by D9 | **No `groupKey` field**, though `features/grouping.md:108` specifies one. `aggregates` is typed but written by nobody; its doc comment even names a non-existent `withAggregation()` (`:52`). |
| `ColumnDef.aggregateFn` | `src/api/types.ts:77` | The per-column aggregation contract is already typed and already public | No reader anywhere in `src/` — it is a typed field with zero consumers. |
| `withExpansion()` | `src/api/features/with-expansion.ts:143` | Claims `'tree'` only, leaving `'group'` free; its tree stage passes any `data === null` row through untouched (`:91-93`), so group headers survive it; supplies `expandedRows`/`everExpanded`/`toggleExpanded`/`expandAll`/`collapseAll` and ADR-0006 pruning (`:204-209`) | Any group awareness: `expandAll()` walks `childrenAccessor` over real `TRow`s (`:119-135`), so it cannot discover, expand or collapse a group. Collapsing a group is grouping's own walk (D11). |
| `withSorting()` | `src/api/features/with-sorting.ts:145` | D5's decoupling holds in code: the sort stage is `[...rows].sort(...)` (`:125`), a stable sort, so it cannot break contiguity of clusters an earlier stage produced | Any notion of a grouped column. `toggleSort` will happily accept the grouped column and produce D5's visible no-op (`:161-172`). Its bare setters are pre-D30 and grandfathered (D1). |
| `withSelection()` | `src/api/features/with-selection.ts:50` | Selection never claims a render stage and never stamps a `RenderRow` field (`:46-48`), so it composes with grouping without contention | Group-header select-all. `selectedRows` is a flat id set; `selectionStateOf(ids)` (`:139-146`) could back a tri-state group checkbox, but nothing maps a group id to its member ids. |
| `withFiltering()` | `src/api/features/with-filtering.ts:113` — **untracked in git today** | Claims the `filter` stage (`:161-166`), which is what makes `aggregateFn` over filtered rows true in practice | It is the *superseded* imperative shape. `docs/1-state/features/filtering.md:15-20` says so, and also claims it was "committed in `be39054`" — the working tree says otherwise (untracked file; `src/index.ts:13` exports it). Also: no D25-style "row filtered out while grouped" behavior exists. |
| Grouping's own code | — | — | **Zero.** `src/` mentions grouping only as: the `RowKind` union and doc comments (`api/types.ts:33-36`, `:98`), `isGroupHeader` on the row directive (`directives/ngp-table-row.directive.ts:28`), test fixtures (`table.mock.ts:37-41`), a spec asserting the 1:1 wrap "when no grouping is composed" (`api/create-table.spec.ts:70`), and stage-order test doubles. There is no `with-grouping.ts`, no `mutations/update-grouping.ts`, no clustering function. |

---

## 5. Story coverage

Read from each `*-story-host.component.ts` (and its `.html` where the composition mattered), not
from the `.mdx`. Nine folders under `src/stories/`, same nine `row-editing.md:48-53` last verified.

| Folder | What it demonstrates |
|---|---|
| `external-write/` | Gated table; a simulated server push while a row is open stages a `RowConflict` and offers Keep mine / Take theirs / merge field-by-field; a push to a row you are *not* editing applies quietly (`external-write-story-host.component.ts:16-25`). |
| `form-write-mutations/` | Add/remove rows written straight through the Signal Forms root value instead of the table's verbs, to isolate what that skips — no snapshot, so no rollback (`:14-23`). |
| `gated-bulk-optimistic/` | `createRow`'s array overload opens N blank rows in one call; "Save batch" sends all pending rows in one request with one all-or-nothing rollback unit (`:15-32`). |
| `gated-multiple-optimistic/` | Gated editing with several rows open at once + optimistic save, `saveAll()` as N independent requests with per-row failure (`:22`). |
| `gated-single-optimistic/` | Gated, single open row, optimistic save; add / duplicate / delete / errors+retry / keyboard (`:22`). |
| `gated-single-pessimistic/` | Same surface, pessimistic save — the row waits for the server (`:22`). |
| `live-optimistic/` | Live mode, focus-delimited session, no `withRowEdit()`; `withOptimistic()`'s three rollback verbs, a 6-second Ctrl+Z undo window on delete, `beforeunload` guard, per-row errors + retry (`:19-34`). |
| `live-table/` | Live mode with no session at all; commit-on-blur instrumented by a commit counter; create/update/delete all real round trips; one combined local undo slot (`:30-54`). |
| `sorting-editing/` | The only cross-feature story: `withSorting()` + `withRowEdit()`, deliberately demonstrating S-1's unimplemented row-hold as a live regression, and S-2's shipped `applySortNulls()` (`:16-23`). The only story that renders through the core directives — `[ngpTable]` / `[ngpTableRow]` (`sorting-editing-story-host.component.html:28`, `:40`). |

**Could any host a grouping story?** Not as they stand, and the reason is not template plumbing:

- All nine already iterate `table.renderRows()` (e.g. `live-table-story-host.component.html:51`,
  `gated-single-optimistic-story-host.component.html:38`), so a `kind: 'group'` row would flow
  into every one of them the moment a `'group'` render stage existed.
- `*ngpTableRowField` already renders nothing for a synthesized row — it guards on
  `sourceIndex === undefined` (`src/directives/ngp-table-row-field.directive.spec.ts:75-78`), so a
  group header would not explode a story's cells.
- But **no story branches on `row.kind`**, none binds `aggregates`, and only `sorting-editing/`
  applies `[ngpTableRow]` — which is what supplies `data-row-kind` / `data-depth`
  (`src/directives/ngp-table-row.directive.ts:28`). Everything a person would *see* about a group
  — a header row, a label, an aggregate, an indent, a collapse toggle — is absent everywhere.
- The nearest structural fit for extension is `sorting-editing/`, because it is already the
  cross-feature story and already uses the directives; the nearest data fit is the shared
  `EDIT_ROWS_MOCK` / `DEPT_OPTIONS` fixture (`src/stories/row-edit.mock.ts`), which has a
  `dept` field that is exactly a group-by candidate — and which G-1 already uses as its scenario.

**Grouping coverage today is zero.** No story composes `withGrouping()` (it does not exist), no
story renders a group row, and a repo-wide search for grouping in `src/` returns only type
unions, doc comments, mock fixtures and stage-order test doubles (§4, last row).

---

## 6. The house shape of a product user-stories doc

Extracted from `docs/0-product/row-editing.md` as a reusable skeleton. Structure only.

```
---
title: Product — <Feature> User Stories
type: product
status: <live prose: what's resolved, what was re-verified and when, what genuinely remains>
date: <YYYY-MM-DD>
audience: product, design, engineering
---

# <Feature> — user stories

<Two lines: what a person in front of the table needs, and one sentence establishing
 direction of authority — "Engineering derives API from this document, not the reverse.">

> **Ownership.** <Who maintains it; that other efforts link rather than rewrite; that
>  coverage marks are updated from the product side as capabilities land.>

## Scope
<What the feature means in product terms. Explicitly dissolve implementation splits the
 person cannot perceive.>
<A mode table when the feature has genuinely different products inside it:
 | Mode | What the person sees |
 plus one line saying that where modes need different answers they get separate stories.>

## Coverage marks
| Mark | Meaning |
| ✅ covered      | demonstrable today in src/stories/ or a demo app, failure path included |
| 🟡 partly       | the mechanism exists but the person's experience of it does not |
| ❌ not covered  | nothing on screen anywhere; or structurally impossible with what ships |
<Then a provenance paragraph: marks were verified by reading every *-story-host.component.ts
 directly, naming the folders, not the .mdx or story names — "those drift". Plus: coverage is
 not a scope limit — the uncovered stories are the point of the document.>

---

# 1. <Top-level need>            ← sections are `# N.`, numbered, ordered by how badly
                                    the person is hurt if the thing is missing
## 1.1 — <Need, in the person's words> *(mode qualifier)* — <mark>

> As someone <concrete situation>, I want <outcome>, so that/without <consequence>.
   ← always second person, always a specific person doing a specific thing;
     never "As a developer" (that voice belongs in the spec, not here)

**Acceptance criteria**
- <observable, on-screen, testable; per-mode bullets where modes differ>

**Failure behavior**              ← its own block, never folded into acceptance criteria
- <what the person sees when the server refuses, is slow, or someone else got there first>

**Mode note.** <only when the modes' mental models differ; states the difference plainly>

**Coverage — <verified date>:** <mark, the exact story folders that demonstrate it, and
what is still missing to reach the next mark; correct an earlier wrong mark out loud.>

---

# 5. Cross-feature interactions
<One line establishing the rule: each story belongs to the feature that has to change its
 behavior to resolve the collision, not to this one.>

## Owned by <feature> *(built | unbuilt)*
### <PREFIX>-1 — <story title> — <mark> (forward-looking)
> As someone …
**Acceptance criteria** …
   ← prefixes are per owning feature: S-1/S-2 sorting, F-1 filtering, G-1/G-2 grouping,
     D-1/D-2 drag-drop, P-1 pagination/virtual-scroll, X-1 selection, E-1 expansion

---

# 6. Open questions
<One line: each carries a recommendation and what would settle it. None silently picked.>

**OQ-N — <question>? — <RESOLVED YYYY-MM-DD: the answer> | <open>**
<The reasoning. Then, as applicable:>
*What this costs, stated plainly:* …
*Recommendation:* …            ← when still open
*To decide:* …                 ← the fact that would settle it
*Sequencing:* …                ← what blocks it / what it unblocks
*Action:* …                    ← a concrete doc/code follow-up the resolution owes
<Resolved entries are kept in place and struck through where overturned, never deleted.>

---

# 7. Not user-facing
<One line: real problems, but the integrating developer's, not the person using the table.
 Listed so they are not mistaken for missing stories.>
- **<Thing>** — <why the person cannot perceive it, and the condition under which it would
  become user-facing.>
```

Structural properties worth copying deliberately:

- **Ordering within a section is by harm, not by API surface** (`row-editing.md:69`).
- **A coverage mark is an assertion about a screen**, and the doc corrects its own past marks in
  writing rather than silently (`:162`, `:222`, `:252`, `:312`, `:389` all say "was wrongly marked").
- **Failure behavior is a first-class block on every story**, not an appendix.
- **Cross-feature stories are keyed by the owning feature**, so an unbuilt feature's stories sit
  in the doc of the feature that surfaced them until that feature gets its own doc — which is
  precisely the relationship G-1/G-2 have to `0-product/grouping.md`.
- **Open questions never get pre-drafted in bulk**; each carries a recommendation and the fact
  that would settle it.
- **§7 exists to defend the boundary** — it lists things that look like gaps and says why they are
  not stories.
