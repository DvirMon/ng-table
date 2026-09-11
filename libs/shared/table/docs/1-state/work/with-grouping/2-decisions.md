---
title: Decisions — withGrouping()
type: decisions
status: drilling — D1–D15 settled, 2 open (both deferred out of scope, not blocking a spec)
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

- **D11 (2026-09-10) — Nested-group collapse is grouping's own subtree walk.**
  `'group'` runs *before* `'tree'` in `RENDER_ORDER`, so grouping cannot lean on
  `withExpansion()`'s tree-walking — by the time `'tree'` runs, grouping has already emitted its
  rows. Skipping descendants of a collapsed group id is the `'group'` stage's own logic.

  Group collapse state still reads `expandedRows` **optionally** (`store.expandedRows?.()`, as
  `grouping.md` specifies) rather than declaring a hard dependency. That member belongs to
  `withExpansion()` today and moves to `withTree()` under
  [ADR-0012](../../../adr/0012-split-expansion-into-panel-and-tree.md) (**proposed**, not
  implemented) — an optional read stays correct on both sides of that split.

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

## Open

- **`manual: true`.** Structurally blocked the same way filtering was: a manual-mode feature whose
  state must feed the request that produces `data` cannot live inside a feature composed on
  `createTable(data, ...)`. See [research-grouping-state-ownership.md](research-grouping-state-ownership.md)
  — no competitor API to borrow, since none of them face this construction order. Do not lock a
  design against it.
- **Header click on the grouped column.** D5 makes it a no-op. Routing it to `groupOrder` instead
  is a directive-level convenience — UI layer, not store.
