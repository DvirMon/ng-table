---
title: Decisions — withGrouping()
type: decisions
status: drilling — D1–D17 settled, 2 open (both deferred out of scope, not blocking a spec).
  D16 (group selection) came from the product pass, not the grill, and its call-site form is
  pending ADR-0015.
date: 2026-09-10
audience: developers
---

# withGrouping() — decisions

Supersedes the API surface described in [`features/grouping.md`](../../features/grouping.md)
(v1.0, 2026-07-19). The pipeline/render-layer design in that file still stands; its **Methods**
section and single-level scope do not — see D1 and D9.

Research backing these: [research-group-ordering.md](research-group-ordering.md) ·
[research-grouping-state-ownership.md](research-grouping-state-ownership.md) ·
[research-generic-grouping-utilities.md](research-generic-grouping-utilities.md).

## Settled

- **D1 (2026-09-10) — Write surface is `table.grouping.update(updater)`, not bare setters.**
  Pure updater factories in `mutations/update-grouping.ts` (`setGroupLevels`, `addGroupLevel`,
  `removeGroupLevel`, `reorderGroupLevels`), consumed through a `WritableView` — the D30
  convention already used by `table.value` / `table.columns`.

  **Supersedes** `grouping.md`'s `setGrouping(columnId | null)` / `clearGrouping()` methods.
  `withSorting()`'s bare `toggleSort`/`setSorting`/`clearSorting` are pre-D30 and grandfathered,
  not a model to copy.

- **D2 (2026-09-10) — Grouping state lives on `withGrouping()`, never on `ColumnDef`.**
  `ColumnDef` carries only *static predicates* supplied at column-definition time (`sortFn`,
  `aggregateFn`, `filterFn`). Active runtime state that *references* columns lives on the owning
  feature — precedent: `withSorting` owns `sorting: Signal<SortRule[]>`, a list of columnId
  references, not fields smeared across column defs.

  Rejected: `ColumnDef.groupBy: boolean` + `groupIndex: number` (an AG Grid-shaped mirror). It
  scatters a cross-column invariant (contiguous, unique indices) across N independent objects
  that a single ordered array holds by construction.

- **D3 (2026-09-10) — Shape is `grouping: string[]`, ordered, index 0 = outermost level.**
  Not `string | null`. See D9 for why the multi-level scope is open from v1.

- **D4 (2026-09-10) — Group ordering is `groupOrder` on the feature config, over group *contents*.**

  ```ts
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number
  interface GroupSummary<TRow> { key: GroupKey; rows: readonly TRow[] }
  ```

  Runs inside the existing `group` pipeline stage: bucket by key → sort buckets → flatten.
  Omitted → today's stable first-occurrence order (unchanged behavior).

  **Supersedes** an earlier sketch of `ColumnDef.compareGroups?: (a: GroupKey, b: GroupKey) =>
  number`, rejected for two reasons: a key-only comparator cannot express count-based ordering
  ("order categories by how many rows each holds"), and it would sit as dead config on every
  column that is not the active group-by.

  Precedent is thin and that is deliberate: only AG Grid ships a comparator-shaped hook
  (`initialGroupOrderComparator`, Enterprise-gated), and only d3-array ships a generic one
  (`groupSort()`, a separate composable function, not a flag on `group()`). Both take full group
  contents, not keys. Three of four table libraries ship nothing.

- **D5 (2026-09-10) — Group order and row sort stay fully decoupled.**
  No shared state, no composition API between them. `groupOrder` orders clusters; `sorting`
  reorders rows *within* a cluster only, guaranteed by the fixed `filter → group → sort → expand`
  order plus sort stability.

  Three of four researched libraries instead reuse `sortingFn` recursively for group order, and
  that entanglement is a documented bug source (TanStack; MUI X #16540/#12684/#8493; AG Grid
  #7850). Our pipeline gives AG Grid's *opt-in* `groupMaintainOrder: true` behavior as its only
  behavior — worth stating in the spec as a deliberate consequence, not an accident.

  Consequence, accepted: sorting by the *grouped* column is a visible no-op (every row in a
  cluster shares that value). Routing that header click to `groupOrder` instead is a UI-layer
  question — see Open.

- **D6 (2026-09-10) — Base + overlay fold; async needs no `effect()`.**

  ```ts
  const baseGrouping = signal<string[]>([]);                       // D1 updater writes land here
  const groupingRule = computed(() => config.groupingRule?.());    // async-capable
  const grouping     = computed(() => groupingRule() ?? baseGrouping());
  ```

  Exposed as a `WritableView`: reads the fold, writes through to base. This is
  [`effect-free-column-reactivity`](../effect-free-column-reactivity/2-decisions.md) D1–D3 applied
  verbatim — D1's "one signal, three write sources" is the failure being avoided, D2 supplies the
  base/overlay split, D3 establishes that reading a `resource()` is ordinary signal composition.

- **D7 (2026-09-10) — `groupingRule: () => string[] | undefined` is the contract.**

  | Returns | Means |
  |---|---|
  | `['category']` | group by category |
  | `[]` | actively grouped by **nothing** |
  | `undefined` | **abstain** — hold `baseGrouping` |

  `[]` ≠ `undefined`. The abstain branch is load-bearing for server-seeded initial values: before
  the source resolves, the table holds its seed instead of flashing flat and then jumping. Mirrors
  `applyVisible`'s `boolean | undefined` (effect-free-column-reactivity D5).

  Retention while loading belongs at the **resource boundary** in consumer code (`linkedSignal`,
  `resource`'s own retention), never in the fold — D5 again. The fold stays a pure function of
  `{ baseGrouping, ruleResult }`.

  Consequence, accepted: base writes are shadowed *while the rule returns a value*. A user's
  updater write can be clobbered when a late-resolving rule stops abstaining. Same flavor as D5's
  accepted tenant-switch limitation. "Pick one mode per table" is guidance, not an enforced
  invariant.

- **D8 (2026-09-10) — Declarative sugar ships on top, subtractable.**
  Three layers, each deletable without breaking the one below:

  | Layer | Shape |
  |---|---|
  | Schema fn | `withGrouping(path => { applyGrouping(path.category, when) })` |
  | Rules array | `withGrouping({ rules: [applyGrouping('category', when)] })` |
  | Lambda | `withGrouping({ groupingRule: () => [...] })` |

  The schema fn reuses shipped machinery — `createRecorderSession()` in
  `schema/column-schema.ts` already collects `apply*` calls into an ordered array in **call
  order**, hands out typed `ColumnHandle`s via the `ColumnsPath` proxy, and guards stale handles.
  Call order = group level order; no index config. `path.category` is compile-checked where a
  string id is not.

  This follows the standing "general mechanism + convenience, not contract" criterion — the
  `updateRows` reference case. An earlier position in this drill rejected `applyGrouping()`
  outright on combinator-cost grounds; that objection was calibrated against a per-column rule
  *registry* with indices and mutual exclusion, and does not survive at this shape, where the fold
  is `rules.filter(r => r.when()).map(r => r.id)`.

- **D9 (2026-09-10) — Full multi-level ships. Grand totals and pivoting do not.**
  **Reopens and supersedes** `grouping.md`'s single-level decision (2026-07-31).

  That scope-out was made to avoid competitors' depth>0 aggregation-correctness bugs (TanStack
  #3323/#3232; MUI X #16540/#12684/#8493). Those bugs are architectural to *their* design —
  aggregation computed inside row-model passes over `Row` wrappers with `subRows`, where "which
  rows does this aggregate see" is ambiguous at depth. Our `group` stage is pure
  `TRow[] → TRow[]` clustering with aggregation downstream in the render stage over already-fixed
  clusters, and the fixed pipeline order already resolves the filtered-rows question
  structurally.

  Two invariants make depth mechanical, and both belong in the spec:
  1. **Aggregates always compute over a cluster's leaf rows** — never over descendant aggregates.
  2. **`groupOrder` orders siblings within a parent** — not globally across depths.

  Nothing in the existing API needs reshaping for depth: `RenderRow.depth` and
  `RenderRow.aggregates` are already per-render-row, and `aggregateFn(rows: TRow[])` receives that
  cluster's leaves with its signature unchanged.

  Scoped out: **grand totals** and **pivoting** — the genuinely-larger AG Grid Enterprise
  machinery, with no current use case.

- **D10 (2026-09-10) — `TRow` stays inferable; do not bake `withGrouping<TRow>()` into the contract.**
  Every feature call site repeats the row type today (`withSorting<Row>()`), and the fix
  (`features: (ctx) => [...]`) is implementable but deferred — ADR-0003, "Deferred", and
  `architecture.md`'s "Known DX cost". D8's schema fn needs a typed `path` proxy, and `ctx` is
  where that would come from, so grouping should be specced to accept it rather than needing
  rework when it lands. Handoff written for that work.

- **D11 (2026-09-10) — Nested-group collapse is grouping's own subtree walk — shipped, issue #59.**
  `'group'` runs *before* `'tree'` in `RENDER_ORDER`, so grouping cannot lean on
  `withExpansion()`'s tree-walking — by the time `'tree'` runs, grouping has already emitted its
  rows. Skipping descendants of a collapsed group id is the `'group'` stage's own logic.

  Group collapse state still reads `expandedRows` **optionally** (`store.expandedRows?.()`, as
  `grouping.md` specifies) rather than declaring a hard dependency. That member belongs to
  `withExpansion()` today and moves to `withTree()` under
  [ADR-0012](../../../adr/0012-split-expansion-into-panel-and-tree.md) (**proposed**, not
  implemented) — an optional read stays correct on both sides of that split.

  **Superseded by [ADR-0017](../../../adr/0017-engine-owned-descendant-prune.md) (2026-09-16,
  issue #132).** The stage-order constraint cited above was real — `'group'` does run before
  `'tree'` — but it was a consequence of `RenderRow` carrying no parent link, not an independent
  reason to couple the two features. With `RenderRow.parentId` and an engine-owned terminal
  `'prune'` stage, grouping stops reading `withExpansion()`'s state at all (#133 deletes the read
  this decision documented). This slice (#132) lands the replacement while grouping's own prune
  stays in place per ADR-0017 D6; #133 is what actually removes the code this decision describes.

- **D17 (2026-09-12) — `rowsOf` resolves by re-deriving the cluster tree from `rows()`, not by
  scanning `renderRows()` — shipped, issue #59.** D16 shipped `rowsOf` before collapse existed,
  reading `renderRows()` between a header and the next row at or above its depth. Once D11 makes
  `renderRows()` omit a collapsed group's descendants, that scan finds nothing for a collapsed
  header and silently returns `[]` — breaking the selection-cascade recipe the moment a group is
  collapsed. `0-product/grouping.md` X-G1 specs the correct behavior directly: "I never select
  rows I cannot see and was never told about" describes what I *can* select, not what currently
  renders. `rowsBeneathGroup` now re-clusters `rows()` (pipeline output, never collapse-affected)
  and locates the target group by its synthetic id path, matching `emitGroupRows`'s own id
  construction. Cost model unchanged from D16 (derived on call, no library-side cache).

- **D12 (2026-09-10) — Multi-level performance is a design constraint, not a later concern.**
  Recursive clustering plus per-cluster aggregation at every depth is the first table feature with
  a plausible super-linear shape. Depth behavior must be explored with row-count and cell-cost
  budgets in hand, not benchmarked after the fact. Standing requirement and both stress axes:
  [`0-product/performance.md`](../../../0-product/performance.md).

- **D13 (2026-09-10) — Pending abstains as a set; failure is explicit. Two rule variants, and the
  choice is about *who owns the value at runtime*.**

  **Abstain semantics.** `when: () => boolean | undefined`, uniformly across both variants.

  | Rule state | Contributes |
  |---|---|
  | pending / not yet resolved | `undefined` → **the whole set abstains**, fold holds `baseGrouping` |
  | resolved | its boolean |
  | errored | whatever `onError` returns — an explicit decision, never abstention |

  Rejected: "an unresolved rule contributes nothing while the others apply." With N async
  sources the intermediate state becomes **race-dependent** — the same page load shows
  `['category']` on one run and `['status']` on another, and re-clusters twice at depth (the
  expensive path, D12). Its only real argument was that one dead source freezes the table
  forever, and that argument dissolves once pending and failed are separated: a failed source is
  not pending, and `onError` is **required** so the author has already said what failure means.
  Borrowed wholesale from effect-free-column-reactivity D5, which made `onError` required for
  exactly this reason.

  **Which variant to use — the criterion is runtime ownership, not "is the value fetched".**

  | | `applyGrouping` (sync) | `applyGroupingAsync` (resource-backed) |
  |---|---|---|
  | Use when | the value is **settled by the time it matters**, however it was obtained | the **server owns it at runtime** and it can change; the rule must re-query |
  | Owns fetching | consumer | the rule (`params` / `factory`) |
  | Owns success/error | consumer, upstream | the rule (`onSuccess` / `onError`, both required) |
  | Pending | consumer returns `undefined` from `when` | rule returns `undefined` until first resolution |

  **A value fetched once at init is the sync case, not the async one.** It is async only in how
  it was obtained; nothing re-queries it. The consumer resolves it, handles its own failure, and
  exposes a signal — typically `linkedSignal(() => prefs.value()?.groupBy ?? …)` so a late
  arrival seeds it and the user can still override afterward. `applyGroupingAsync` there is
  strictly heavier: a resource re-created, params tracked, `onError` demanded, for a value that
  never changes.

  **Default to the sync rule.** Reach for the async variant only when the rule itself must own
  re-querying.

  **Backport owed:** the same criterion is undocumented for the shipped
  `applyVisible`/`applyVisibleAsync` pair — `2-columns/architecture.md` describes them as
  counterparts but never says when to choose which. Same rule applies there; worth stating in
  that file rather than only here.

- **D14 (2026-09-10) — Column ids are `ColumnId<TRow>`; an unknown id throws at construction and
  degrades at runtime.**

  ```ts
  type ColumnId<TRow> = Extract<keyof TRow, string> | (string & {});
  ```

  Known row keys autocomplete; any other string still compiles. Rejected: bare
  `Extract<keyof TRow, string>`, which buys typo-catching in hand-written literals but **rejects
  derived columns** (`{ id: 'fullName', accessor: r => r.first + ' ' + r.last }` — `ColumnDef.id`
  is `string`, deliberately not constrained to `keyof TRow`), forces an unverified
  `as keyof TRow` cast at the server boundary, and cannot see columns added later by
  `setColumns()`. Also rejected: typing against the *declared* column ids via literal capture —
  it could never stay authoritative, because D30's `setColumns()` replaces the list at runtime.

  **Runtime behavior splits on [ADR-0014](../../../adr/0014-runtime-error-policy.md)'s own axis**
  (`proposed`), rather than being one rule:

  | Where the bad id comes from | Behavior | Why |
  |---|---|---|
  | Feature config at construction (e.g. an `initialGrouping` naming no column) | **throw** | wiring error; directly parallel to ADR-0014's existing "a `trackBy` that names no field" throw site |
  | Runtime — a rule result, an updater write, a restored snapshot, a server preference | **skip that level, group by the rest** | sane degraded behavior exists, and no type reaches across the network; a dev-mode throw here would flag a data condition as a code defect |

  This refines the plain "never throw" reading: it holds for every id that arrives as *data*,
  which is the case that motivated the question, but construction-time config stays a throw to
  match the policy the rest of the library just adopted.

- **D15 (2026-09-10) — Consumer-callback fallbacks, per ADR-0014's naming requirement.**
  ADR-0014 requires every new feature taking a consumer callback to name its own fallback. This
  feature adds two; both wrap per callback, never per row, and report once per evaluation.

  | Callback | Fallback when it throws | Why |
  |---|---|---|
  | `groupOrder` (D4) | group order falls back to stable first-occurrence — the documented default when the hook is omitted | visibly unordered beats silently mis-ordered; the reasoning ADR-0014 gives for `sortFn` |
  | `when` (D8 rule predicate) | that level does not apply | parallel to ADR-0014's filter predicate — grouping by *less* is obvious and recoverable; grouping by something unasked-for is neither. Consistent with D13: a throw is a failure, never abstention, so it must not read as `undefined` |

  `aggregateFn` already has its fallback in ADR-0014's table (*"that aggregate reads `undefined`;
  the group still renders"*) — unchanged by multi-level (D9), since it wraps per callback and a
  deeper cluster is just another call.

- **D16 (2026-09-12) — A group header is a *view over rows*, not a row. The library exposes a
  group's member rows; the consumer owns any cascade.**

  ```ts
  rowsOf(group: RenderRow<TRow>): readonly TRow[]   // leaf rows beneath this group header
  ```

  **Derived on call, never materialized.** Walks the current cluster when asked and holds nothing.
  The rejected alternative was a `rowIds?: readonly RowId[]` field stamped on every group
  `RenderRow`: it costs N ids × every depth on every render even for the majority of grouped tables
  that never select, and a new array identity per render breaks `@for` track and rebuilds every
  group cell. Nothing held also means nothing to prune when rows are removed or a regroup happens —
  which is the exact bug TanStack shipped ([#5822](https://github.com/TanStack/table/issues/5822):
  a pinned group id outliving its group).

  **Rows, not ids.** The asymmetry decides it: row→id is `trackBy(row)` — pure, total, available to
  every consumer. id→row needs `indexById`, which is engine-internal. Returning ids optimizes for
  selection and taxes every other consumer (export, bulk edit, custom aggregation). Selection pays
  one `.map(trackBy)`. Also keeps one concept with D4's `GroupSummary.rows`.

  **Leaf rows, not immediate children** — same shape as D9's aggregate invariant, so ticking a
  parent reaches every leaf beneath it regardless of depth.

  **What this settles beyond grouping.** A group header is a view: it never enters `selectedRows`,
  never holds an id another feature stores, never counts toward "3 of 40 selected". The one
  deliberate exception is `withExpansion()`'s `expandedRows`, which holds synthetic
  `group:${columnId}:${value}` ids — principled because that set holds *toggles*, not records, and
  load-bearing because it is what makes group expansion survive a refetch for free (ADR-0006 never
  prunes them).

  **The cascade is consumer code.** AG Grid needs `groupSelects: 'self' | 'descendants' |
  'filteredDescendants'` because it owns the behavior; we own none of it, so we default none of it:

  ```ts
  // 'descendants' — and 'filteredDescendants' is the same call, because `filter`
  // precedes `group` in PIPELINE_ORDER, so rowsOf() is post-filter by construction
  const ids = table.rowsOf(group).map(table.trackBy);
  table.selectionStateOf(ids) === 'all' ? table.deselect(ids) : table.select(ids);
  ```

  Tri-state needs no new API: `selectionStateOf(ids)` already returns `'none' | 'some' | 'all'`
  (`with-selection.ts:139-146`).

  **Consequences.** The group row count is `rowsOf(group).length` — not a new `RenderRow` field and
  not an `aggregates` entry, since it exists whether or not any column defines an `aggregateFn`
  (resolves `0-product/grouping.md` OQ-2). The filtered-vs-unfiltered question in OQ-1 dissolves:
  there is no unfiltered set to hand out. OQ-1 itself narrows from "what are the semantics" to
  nothing — we ship no semantics.

  **Accepted costs.** (1) A consumer can select unfiltered ids while a header shows a filtered
  count; the directive layer should ship the correct wiring as its default so most people never
  hold it wrong. (2) `rowsOf` is O(n) per call, called twice per checkbox in the naive template —
  fine at 50 groups, not at 5,000. Documented recipe is a `computed()` keyed by group id, not a
  library-side cache. Belongs with D12 / `0-product/performance.md` axis 1. (3) A bulk operation
  can never be addressed to a group as an object, because no such object is selectable.

  **Call-site form is not settled here.** Whether this reads `table.rowsOf(g)` or
  `table.grouping.rowsOf(g)` is [ADR-0015](../../../adr/0015-feature-member-namespacing.md)
  (`proposed`) — this feature's first behavior function is what opened it.

  **D16.1 (2026-09-12) — two implementation constraints, both part of the contract rather than
  details left to whoever builds it.**

  1. **Resolve the group by id, never by object identity.** `renderRows()` rebuilds its
     `RenderRow` objects every render pass, so a consumer holding a header across renders passes a
     stale object — but `RenderRow.id` (`types.ts:39`) is the stable
     `group:${columnId}:${value}`, so the stale object still carries the right key. An
     implementation doing `renderRows().find(r => r === group)` returns `[]` for a group that is
     plainly still on screen; `.find(r => r.id === group.id)` is correct regardless of which pass
     the argument came from. **This is the constraint that matters. The parameter type is a
     secondary ergonomics call** — `RowId` would remove the identity trap from the surface and let
     a consumer ask from a saved id with no header in hand, while `RenderRow` reads better in a
     template that already has the row (`rowsOf(row)` vs `rowsOf(row.id)`). Taking `RenderRow`;
     either works once resolution is by id.

  2. **It must read `renderRows()`, so it composes inside `computed()`.** The motivating case is a
     consumer deriving one group's rows reactively:

     ```ts
     readonly categoryRows = computed(() => {
       const header = this.table.renderRows().find(
         (r) => r.kind === 'group' && r.groupKey?.value === this.category(),
       );
       return header ? this.table.rowsOf(header) : [];
     });
     ```

     That tracks both the consumer's own signal and every pipeline change — data, filter, grouping
     — because `renderRows()` is read. An implementation closing over an already-materialized
     cluster would be silently non-reactive inside a `computed()`, which is the kind of defect that
     surfaces as "my totals stopped updating" weeks later. Stated here so it is specced, not
     discovered.

     Accepted cost: `renderRows()` also changes on a sort, so such a `computed()` recomputes even
     when the group's membership did not, and returns a fresh array each time. Over-triggering, not
     incorrect — same bucket as D16's O(n) note.

  **A group that no longer exists returns `[]`** — the category was deleted, grouping switched
  columns. Correct degrade per D14, and independent of both constraints above.

## Open

- **`manual: true`.** Structurally blocked the same way filtering was: a manual-mode feature whose
  state must feed the request that produces `data` cannot live inside a feature composed on
  `createTable(data, ...)`. See [research-grouping-state-ownership.md](research-grouping-state-ownership.md)
  — no competitor API to borrow, since none of them face this construction order. Do not lock a
  design against it.
- **Header click on the grouped column.** D5 makes it a no-op. Routing it to `groupOrder` instead
  is a directive-level convenience — UI layer, not store.
- **Group admission (`groupWhen`) — shape settled 2026-09-15, not yet built.** Whether a built
  cluster earns a header at all: missing values and small clusters stay flat instead of grouping.
  One predicate, two scopes — `config.groupWhen` table-wide, `applyGrouping(path.x, { groupWhen })`
  per column, AND-combined. Dissolved clusters stay ordering participants (`GroupSummary.admitted`)
  so the comparator places the flat region; default is a stable partition with the flat rows last.
  Closes the mechanism half of `0-product/grouping.md`'s OQ-5 and OQ-6. Carries two amendments:
  **D4's `groupOrder` moves from the config to `applyGroupOrder(path.x, cmp)`** (siblings always
  share a `columnId`, so the slot was already per-level), and `initialGrouping` is renamed
  `initial` under a `withGrouping(config, withComputed(...))` shape where `config.schema` holds the
  rules fn. Q1 resolved 2026-09-16 (below); Q2 and Q3 remain open, neither blocking:
  [design-group-admission.md](design-group-admission.md).
- **A dissolved cluster exits the grouping tree entirely — decided 2026-09-16 (Q1).** Rows whose
  cluster was rejected at level N do not re-enter at level N+1; they render flat at depth 0.
  "Stays flat" is the promise as stated, and re-entry would make a row's depth depend on which
  level rejected it. Note the question is only observable where `groupWhen` is non-monotone in
  size — a value predicate (`region != null`) or a per-column threshold looser at a deeper level —
  since a size threshold that rejects a cluster necessarily rejects every sub-cluster of it. A
  consumer wanting the other behaviour admits the cluster and styles its header, the same escape
  hatch Q2 relies on.
