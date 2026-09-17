---
title: Spec — withGrouping()
type: spec
status: ready
date: 2026-09-10
audience: developers
---

# Spec — `withGrouping()`

Synthesized from [`2-decisions.md`](2-decisions.md) (D1–D15, all settled), with supporting
research in [research-group-ordering.md](research-group-ordering.md),
[research-grouping-state-ownership.md](research-grouping-state-ownership.md), and
[research-generic-grouping-utilities.md](research-generic-grouping-utilities.md). No decision
below is open for relitigation here.

**Supersedes** [`features/grouping.md`](../../../../features/grouping.md) (v1.1) — its **Methods**
section (D1) and single-level scope (D9). Still current from that file: the pipeline stage
(clustering, not tree-building), the `renderRows`/`RenderRow` render-layer design, and the
optional `withExpansion()` coupling; this spec does not restate them.

Two items from `2-decisions.md`'s Open section — `manual: true` and header-click routing to
`groupOrder` — are deliberately **not settled here**. Both are out of scope for this spec; see
Out of Scope.

## Problem Statement

`features/grouping.md` commits to single-level grouping via `setGrouping(columnId | null)`,
decided 2026-07-31 specifically to avoid the depth>0 aggregation-correctness bugs three
researched competitors carry (TanStack #3323/#3232; MUI X #16540/#12684/#8493). That scope-out
traded away a real product need — multi-level grouping, e.g. region then category — for a bug
class this library's own pipeline never had: aggregation runs downstream of a pure
`TRow[] → TRow[]` clustering stage over already-fixed clusters, not inside a row-model pass over
wrapper objects where "which rows does this aggregate see" is ambiguous at depth (D9).

Three further gaps sit on top of the depth question:

- **The write surface predates D30.** `setGrouping`/`clearGrouping` are bare setters, the
  pre-`WritableView` shape `table.value`/`table.columns` have since moved past.
- **No group-order control.** Today's spec only defines stable first-occurrence clustering, with
  no way to order clusters by an external list or a computed criterion (row count per group).
  Three of four researched libraries have no dedicated concept for this at all — they reuse
  column sort, entangling group order with row order, a documented bug source elsewhere
  (TanStack; MUI X #16540/#12684/#8493; AG Grid #7850).
- **No declarative story for grouping driven by async or conditional sources** (a feature flag, a
  user preference, a server-seeded default) — every other reactive surface in this library
  (`applyVisible`/`applyVisibleAsync`) already has one.

Multi-level grouping is also the first table feature with a plausible super-linear shape —
recursive clustering plus per-cluster aggregation at every depth
([`0-product/performance.md`](../../../../../0-product/performance.md), D12) — so it cannot be
specced the way single-level grouping was, as a shape first and a performance concern later.

## Solution

`withGrouping()` — an opt-in feature plugin owning an ordered list of group-by columns
(`grouping: string[]`, index 0 = outermost level), the verbs that change it, and the render-stage
logic that turns clustered rows into `RenderRow`s with group headers and per-cluster aggregates
at every depth.

State is a base-plus-overlay fold, the same shape `effect-free-column-reactivity` established for
`columns`: a writable base that updater writes land on, an optional async-capable rule layer that
can override it, and a derived read exposed through a `WritableView` — no `effect()` anywhere in
the feature. Declarative sugar (a schema function, a rules array, a bare lambda) sits on top of
the same fold as three deletable layers, reusing the `columnSchema()` machinery already shipped
for column rules rather than inventing a parallel mechanism.

Group order and row sort stay fully decoupled by construction: `groupOrder` orders clusters,
`sorting` reorders rows only within a cluster, and the fixed `filter → group → sort → expand`
pipeline order plus sort stability is what keeps that true with no coordination code between the
two stages.

## User Stories

1. As a developer, I want to compose `withGrouping()` into an existing table, so that adding
   multi-level grouping does not require restructuring the table I already built.
2. As a developer, I want to write grouping state through `table.grouping.update(updater)`, so
   that grouping's write surface matches `table.value`/`table.columns` instead of introducing a
   third pattern.
3. As a developer, I want pure updater factories — set, add, remove, reorder a level — so that a
   "group by category then status" UI action is one call, not hand-rolled array surgery.
4. As a developer, I want grouping state to live on the feature, not smeared across `ColumnDef`,
   so that "which columns are active group-by levels, in what order" stays a single, ordered
   source of truth instead of N independent booleans I have to reconcile myself.
5. As a developer, I want to group by more than one column at a time, so that a region-then-
   category report is expressible without building my own tree on top of the table.
6. As a developer, I want aggregates to always compute over a cluster's own leaf rows — never
   over a child cluster's already-computed aggregate — so that a parent-level total is correct
   regardless of how deep the grouping goes.
7. As a developer, I want group order to be configurable independently of row sort, so that I can
   pin a category ordering (or order by row count) without that choice leaking into how rows sort
   inside each cluster.
8. As a developer, I want `groupOrder` to order siblings within a parent, not globally across
   depths, so that a nested grouping is orderable per level rather than only at the root.
9. As a developer, I want group order to default to stable first-occurrence when I supply no
   `groupOrder`, so that composing `withGrouping()` with no extra config changes nothing about
   today's clustering behavior.
10. As a developer, I want sorting a table by the currently-grouped column to be a visible no-op
    rather than a silent behavior change, so that I understand why nothing moves without reading
    an issue tracker first.
11. As a developer, I want to declare a static grouping with a plain array, so that the common
    case — "group by this column" — costs one line and no async ceremony.
12. As a developer, I want a declarative schema function that reuses the same `path` proxy
    columns already use, so that authoring a grouping rule feels like authoring a column rule and
    gets the same compile-time id checking.
13. As a developer, I want a rules array form as an alternative to the schema function, so that I
    can assemble grouping rules programmatically when the schema-fn shape does not fit my call
    site.
14. As a developer, I want to drive grouping from a conditional or async source — a feature flag,
    a fetched user preference — so that "group by the server's default, unless the user picked
    something" is expressible without a hand-rolled `effect()`.
15. As a developer, I want an unresolved async grouping source to hold my last explicit choice
    rather than flash to ungrouped and back, so that first paint under a slow network is not
    visually broken.
16. As a developer, I want to be explicit that "actively grouped by nothing" and "no opinion yet"
    are different states, so that a source that hasn't resolved cannot be mistaken for a user who
    deliberately cleared grouping.
17. As a developer, I want an async grouping source's failure path to be a required decision, not
    an implicit default, so that I cannot ship a rule whose error behavior I never considered.
18. As a developer, I want a nested group to be collapsible when `withExpansion()` is composed,
    and to render fully flat and expanded when it is not, so that grouping is useful standalone
    and gains progressive behavior when paired with expansion.
19. As a developer, I want an unknown column id in my grouping config to throw at construction,
    so that a typo in a level I authored is caught on first render, not discovered by a support
    ticket.
20. As a developer, I want a bad column id arriving at runtime — from a rule, a restored snapshot,
    a server preference — to degrade by dropping that level rather than taking the table down, so
    that a stale saved grouping or an unexpected response does not blank the screen.
21. As a developer, I want a `groupOrder` callback that throws to fall back to stable
    first-occurrence order rather than crashing the table, so that a bug in my comparator is
    visible as unordered groups, not a dead page.
22. As a developer, I want a rule predicate that throws to make that level simply not apply,
    rather than being treated as "abstain" or crashing, so that a bug in my rule reads as grouping
    by less, never as a hang or a false level I never asked for.
23. As a maintainer, I want multi-level grouping explored against row-count and cell-cost budgets
    before it ships, so that a report with several active levels does not become the table's first
    unbounded-cost feature.
24. As a maintainer, I want the feature specced to accept a typed column-context parameter later
    without redesigning its schema-fn layer, so that adopting the deferred `TRow`-inference fix
    does not force a breaking rework of grouping's declarative sugar.

## Implementation Decisions

### Module

One new feature plugin under `api/features/`, following the established plugin contract (a
`with-*()` factory returning a spec that declares members; features declare, never mutate), plus
new files for the pure engine-side pieces (clustering already exists; this feature adds the fold
and the `'group'` render stage) and colocated unit specs. Exported from the single public barrel.
`mutations/update-grouping.ts` holds the updater factories, alongside `update-columns.ts` and
`row-mutations.ts`.

### Public surface

Shape settled across D1, D3, D4, D6, D7, D8, D14; amended by #118.

```ts
type ColumnId<TRow> = Extract<keyof TRow, string> | (string & {});   // D14

interface ClusterSummary<TRow> {
  readonly columnId: string;
  readonly key: GroupKey;
  readonly rows: readonly TRow[];
}

interface GroupSummary<TRow> extends ClusterSummary<TRow> {
  readonly admitted: boolean;   // false ⇒ emits flat, no header — #119
}

type GroupWhen<TRow> = (cluster: ClusterSummary<TRow>) => boolean;

interface WithGroupingConfig<TRow> {
  initial?: ColumnId<TRow>[];                                       // D14
  groupWhen?: GroupWhen<TRow>;                                      // #119 — table-wide admission
  groupingRule?: () => string[] | undefined;                        // D6, D7 — abstain contract
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number;  // D4
  schema?: (path: ColumnsPath<TRow, AnyGroupingRule<TRow>>) => void; // D8, #118
  rules?: AnyGroupingRule<TRow>[];                                  // D8, rules-array layer
}

// D8 — schema-fn layer, now a config member rather than an either/or first positional (#118)
withGrouping({
  initial: ['region'],
  schema: (path) => {
    applyGrouping(path.category, { when: () => boolean | undefined });
  },
});

interface GroupingMembers<TRow> {
  readonly grouping: WritableView<string[], GroupingUpdater<TRow>>;  // D1, D6
  readonly rowsOf: (group: RenderRow<TRow>) => readonly TRow[];      // D16, D16.1
  readonly groupIds: Signal<RowId[]>;  // issue #131
}

type GroupingUpdater<TRow> = (grouping: string[]) => string[];

// mutations/update-grouping.ts — D1
function setGroupLevels<TRow>(levels: ColumnId<TRow>[]): GroupingUpdater<TRow>;
function addGroupLevel<TRow>(id: ColumnId<TRow>, index?: number): GroupingUpdater<TRow>;
function removeGroupLevel<TRow>(id: ColumnId<TRow>): GroupingUpdater<TRow>;
function reorderGroupLevels<TRow>(from: number, to: number): GroupingUpdater<TRow>;
```

**`groupWhen` (#119), three facts the signature doesn't state:** dissolution — dropping a
rejected cluster's header and re-parenting its rows to the parent's depth — happens **after**
`groupOrder` runs, so the position a comparator gives a dissolved cluster is the position its flat
rows occupy; with no `groupOrder` supplied, the default is a stable partition (admitted siblings
first-occurrence, then dissolved siblings first-occurrence); a throwing `groupWhen` admits the
cluster and reports once per column per evaluation. Full mechanism and rejected alternatives:
[design-group-admission.md](design-group-admission.md).

### Decisions

- **Write surface is `table.grouping.update(updater)` (D1).** Pure updater factories consumed
  through the `WritableView` shape `table.value`/`table.columns` already use (D30). Supersedes
  `grouping.md`'s `setGrouping`/`clearGrouping` methods. `withSorting()`'s bare setters are
  pre-D30 and grandfathered, not a model to copy going forward.
- **Grouping state lives on the feature, never on `ColumnDef` (D2).** `ColumnDef` carries only
  static predicates supplied at column-definition time. Active runtime state referencing columns
  lives on the owning feature, matching `withSorting`'s `sorting: Signal<SortRule[]>`. Rejected:
  `ColumnDef.groupBy` + `groupIndex` (an AG Grid-shaped mirror) — it scatters a cross-column
  invariant (contiguous, unique indices) across N independent objects that one ordered array
  already holds by construction.
- **`grouping: string[]`, ordered, index 0 = outermost level (D3).** Not `string | null` — see
  D9 for the multi-level scope this shape exists to serve.
- **Group order is `groupOrder`, over group contents, not keys (D4).** Runs inside the existing
  `group` pipeline stage: bucket by key → sort buckets → flatten. Omitted, it is today's stable
  first-occurrence order — unchanged behavior. Takes `GroupSummary<TRow>` (key + that cluster's
  rows), not a bare key, because a key alone cannot express "order by row count" — confirmed
  against d3-array's `groupSort`, the only generic-utility precedent for computed group ordering,
  which also operates on each group's member values rather than its key alone. Precedent among
  table libraries is thin and that is deliberate: only AG Grid ships a comparator-shaped hook
  (`initialGroupOrderComparator`, Enterprise-gated); three of four table libraries ship nothing.
- **Group order and row sort stay fully decoupled (D5).** No shared state, no composition API.
  `groupOrder` orders clusters; `sorting` reorders rows within a cluster only, guaranteed by the
  fixed pipeline order plus sort stability. Three of four researched libraries instead reuse
  `sortingFn` recursively for group order, and that entanglement is a documented bug source
  (TanStack; MUI X #16540/#12684/#8493; AG Grid #7850) — our pipeline gets AG Grid's *opt-in*
  `groupMaintainOrder: true` behavior as its only behavior, for free, by construction. Accepted
  consequence: sorting by the grouped column is a visible no-op.
- **Base + overlay fold; async needs no `effect()` (D6).** `baseGrouping = signal<string[]>([])`
  holds updater writes; `groupingRule = computed(() => config.groupingRule?.())` is
  async-capable; `grouping = computed(() => groupingRule() ?? baseGrouping())` is the fold,
  exposed as a `WritableView` that reads the fold and writes through to base. This is
  [`effect-free-column-reactivity`](../../../core/archive/effect-free-column-reactivity/2-decisions.md) D1–D3
  applied verbatim: D1's "one signal, three write sources" is the failure avoided, D2 supplies
  the base/overlay split, D3 establishes that reading a `resource()` is ordinary signal
  composition — no new mechanism invented for grouping.
- **`groupingRule: () => string[] | undefined` is the contract (D7).** `['category']` groups by
  category; `[]` is actively grouped by nothing; `undefined` abstains and holds `baseGrouping`.
  `[]` ≠ `undefined` — the abstain branch is load-bearing for server-seeded initial values, so the
  table holds its seed instead of flashing flat and jumping. Mirrors `applyVisible`'s
  `boolean | undefined` contract. Retention while loading belongs at the resource boundary in
  consumer code (`linkedSignal`, `resource`'s own retention), never in the fold, which stays a
  pure function of `{ baseGrouping, ruleResult }`. Accepted consequence: base writes are shadowed
  while the rule returns a value, so a user's updater write can be clobbered when a
  late-resolving rule stops abstaining — "pick one mode per table" is guidance, not an enforced
  invariant.
- **Declarative sugar ships as three deletable layers (D8).** Schema fn → rules array → bare
  lambda, each removable without breaking the layer below. The schema fn reuses
  `createRecorderSession()` (`schema/column-schema.ts`), which already collects `apply*` calls
  into an ordered array in call order and hands out typed `ColumnHandle`s via the `ColumnsPath`
  proxy. Call order = group level order; no separate index config. Follows the standing "general
  mechanism + convenience, not contract" criterion (the `updateRows` reference case) rather than a
  per-column rule registry with indices and mutual exclusion.
- **Full multi-level ships; grand totals and pivoting do not (D9).** Reopens and supersedes
  `grouping.md`'s single-level decision. That scope-out was calibrated against competitors' own
  architecture — aggregation computed inside row-model passes over wrapper objects with `subRows`,
  where "which rows does this aggregate see" is ambiguous at depth. This library's `group` stage
  is pure `TRow[] → TRow[]` clustering with aggregation downstream over already-fixed clusters, so
  the bug class the scope-out was avoiding does not apply here. Two invariants make depth
  mechanical: aggregates always compute over a cluster's leaf rows, never over descendant
  aggregates; `groupOrder` orders siblings within a parent, not globally across depths. Nothing in
  the existing `RenderRow.depth`/`RenderRow.aggregates` shape needs reshaping — `aggregateFn`'s
  signature is unchanged. Scoped out: grand totals and pivoting, the genuinely larger AG Grid
  Enterprise machinery, with no current use case.
- **`TRow` stays inferable; `withGrouping<TRow>()` is not baked into the contract (D10).** Every
  feature call site repeats the row type today; the fix (`features: (ctx) => [...]`) is
  implementable but deferred (ADR-0003, `architecture.md`'s "Known DX cost"). D8's schema fn needs
  a typed `path` proxy, and `ctx` is where that would come from — grouping is specced to accept it
  rather than needing rework when it lands.
- **Nested-group collapse is grouping's own subtree walk (D11) — shipped, issue #59.** `'group'`
  runs before `'tree'` in `RENDER_ORDER`, so grouping cannot lean on `withExpansion()`'s
  tree-walking — by the time `'tree'` runs, grouping has already emitted its rows. Skipping
  descendants of a collapsed group id is the `'group'` stage's own logic. Group collapse state
  still reads `expandedRows` **optionally** (via the `composed` feature-to-feature seam) rather
  than declaring a hard dependency — that member moves to `withTree()` under
  [ADR-0012](../../../../../adr/0012-split-expansion-into-panel-and-tree.md) (`proposed`, not
  implemented), and an optional read stays correct on both sides of that split.
- **`rowsOf` stays correct under collapse (D17) — shipped, issue #59.** See `2-decisions.md` D17
  for the full rationale — `rowsBeneathGroup` re-derives the cluster tree from `rows()` (pipeline
  output, never collapse-affected) instead of scanning `renderRows()`, so a collapsed group still
  resolves its full leaf set.
- **Multi-level performance is a design constraint, not a later concern (D12).** Recursive
  clustering plus per-cluster aggregation at every depth is the first table feature with a
  plausible super-linear shape. Depth behavior must be explored with row-count and cell-cost
  budgets in hand before shipping, per
  [`0-product/performance.md`](../../../../../0-product/performance.md)'s two stress axes — not
  benchmarked after the fact.
- **Pending abstains as a set; failure is explicit; two rule variants split on runtime ownership
  (D13).** `when: () => boolean | undefined`, uniformly across both variants: pending/unresolved
  contributes `undefined` (the whole rule set abstains, fold holds `baseGrouping`); resolved
  contributes its boolean; errored contributes whatever `onError` returns — an explicit decision,
  never abstention. Rejected: "an unresolved rule contributes nothing while others apply" — with N
  async sources that makes the intermediate state race-dependent, and re-clusters twice at depth
  (the expensive path, D12). Borrowed wholesale from `effect-free-column-reactivity` D5, which made
  `onError` required for the same reason.

  Which variant to use is about **who owns the value at runtime**, not whether the value happened
  to be fetched:

  | | `applyGrouping` (sync) | `applyGroupingAsync` (resource-backed) |
  |---|---|---|
  | Use when | the value is settled by the time it matters, however it was obtained | the server owns it at runtime and it can change; the rule must re-query |
  | Owns fetching | consumer | the rule (`params`/`factory`) |
  | Owns success/error | consumer, upstream | the rule (`onSuccess`/`onError`, both required) |
  | Pending | consumer returns `undefined` from `when` | rule returns `undefined` until first resolution |

  A value fetched once at init is the sync case, not the async one — it is async only in *how* it
  was obtained, and nothing re-queries it. Default to the sync rule; reach for the async variant
  only when the rule itself must own re-querying. The same criterion applies to the shipped
  `applyVisible`/`applyVisibleAsync` pair and is backported to
  [`2-columns/architecture.md`](../../../../../2-columns/architecture.md) in this change (see
  Documentation updates this work owes).
- **Column ids are `ColumnId<TRow>`; an unknown id throws at construction and degrades at runtime
  (D14).** `Extract<keyof TRow, string> | (string & {})` — known row keys autocomplete, any other
  string still compiles, so derived columns (`accessor`-only, no matching `keyof TRow`) stay
  expressible. Runtime behavior splits on [ADR-0014](../../../../../adr/0014-runtime-error-policy.md)'s
  own construction/runtime axis rather than being one rule: a bad id in feature config at
  construction (e.g. `initialGrouping` naming no column) throws — a wiring error, directly
  parallel to ADR-0014's existing "a `trackBy` that names no field" throw site. A bad id arriving
  at runtime — a rule result, an updater write, a restored snapshot, a server preference — skips
  that level and groups by the rest: sane degraded behavior exists, and no type reaches across the
  network, so a dev-mode throw here would flag a data condition as a code defect.
- **Consumer-callback fallbacks, per ADR-0014's naming requirement (D15).** Both new callbacks
  wrap per callback, never per row, and report once per evaluation:

  | Callback | Fallback when it throws | Why |
  |---|---|---|
  | `groupOrder` (D4) | falls back to stable first-occurrence — the documented default when the hook is omitted | visibly unordered beats silently mis-ordered; the reasoning ADR-0014 gives for `sortFn` |
  | `when` (D8 rule predicate) | that level does not apply | grouping by *less* is obvious and recoverable; grouping by something unasked-for is neither. Consistent with D13: a throw is a failure, never abstention |

  `aggregateFn` already has its fallback in ADR-0014's own table (*"that aggregate reads
  `undefined`; the group still renders"*), unchanged by multi-level (D9) since it wraps per
  callback and a deeper cluster is just another call.
- **A group header is a view over rows; the library ships no selection cascade (D16, D16.1).**
  `rowsOf(group)` returns every leaf row beneath a header, at any depth, resolved by `group.id`
  (never object identity) and reading `rows()` (pipeline output, independent of collapse state —
  see D17). Rows, not ids — row→id is `trackBy(row)`, pure and total; the reverse needs
  engine-internal `indexById`. Nothing is materialized or cached; a group that no longer exists
  returns `[]`. See `2-decisions.md` for the full rationale and rejected alternatives
  (a `rowIds` field on every group `RenderRow`, an id-returning surface).

### Documentation updates this work owes

- **`2-columns/architecture.md`** gains D13's sync-vs-async criterion, applied to the shipped
  `applyVisible`/`applyVisibleAsync` pair, which the file currently describes as counterparts
  with no stated criterion for choosing between them.
- The state-layer feature spec (`features/grouping.md`): frontmatter moves off `spec: drafted` /
  `code: none` once implementation lands; the superseded-sections banner is removed once this
  spec's contract is the only one described there.
- Regenerate the generated status roll-up rather than hand-editing it, once `code` moves past
  `none`.

## Testing Decisions

**What makes a good test here.** Only external behavior, through the public store. A test
composes the feature into a real table via the table factory and asserts on the public members
(`table.grouping`, `table.renderRows`). No test reaches into the fold's internals, asserts on
which signal primitive backs a value, or counts recomputations. Structural and DOM tests belong to
the directive layer, not here — the engine-side clustering and render-stage logic (everything
except the feature factory itself) is pure and gets plain `vitest` cases with no `TestBed`,
matching the table's own rule that pure engine code needing a harness is a sign it landed in the
wrong file.

**Coverage:**

- Setting, adding, removing, and reordering group levels each produce the expected `grouping`
  array; removing an id not present, and adding one already present, are no-ops.
- Multi-level clustering nests correctly: leaf-level clusters are contiguous, and a `groupOrder`
  supplied at one level orders only its siblings, not clusters at a different depth.
- Aggregates at every depth compute over that cluster's own leaf rows, verified by a case where a
  parent aggregate would differ if it read child aggregates instead.
- `groupOrder` omitted preserves first-occurrence order; supplied, it reorders clusters without
  disturbing row order within a cluster; a `sort` on the grouped column is confirmed to be a
  no-op on cluster order.
- The base/overlay fold: a `groupingRule` returning a value overrides `baseGrouping`; returning
  `undefined` falls back to it; returning `[]` is grouped by nothing, distinct from the abstain
  case.
- The schema-fn, rules-array, and lambda config layers each produce the same resulting fold for an
  equivalent rule, and call order in the schema fn determines level order.
- A pending rule (returns `undefined`) makes the whole rule set abstain; a resolved rule
  contributes its boolean; an errored rule's `onError` result is never treated as abstention.
- `applyGroupingAsync` without an `onError` is a compile error; with one, an errored resource
  applies the declared fallback rather than freezing.
- An unknown column id in feature config throws at construction; an unknown id from a rule
  result, an updater write, or a restored snapshot drops that level and groups by the rest.
- A `groupOrder` callback that throws falls back to stable order and reports once, not once per
  comparison; a `when` predicate that throws makes that level not apply and reports once, not
  once per evaluation.
- With `withExpansion()` composed, collapsing a group id omits its descendant rows; without it,
  all rows render flat and expanded.
- `rowsOf` on a collapsed group still returns the full leaf set, not `[]` (D17) — resolved by
  re-deriving the cluster tree from `rows()`, never affected by `expandedRows`.
- Removing rows that were the sole members of a cluster removes that cluster from `renderRows`
  without residual state.
- `rowsOf` returns every leaf beneath a header at any depth; a header captured from an earlier
  `renderRows()` pass still resolves correctly (id, not object identity); a group that no longer
  exists returns `[]`, no throw.
- `rowsOf` reflects post-filter membership — with `withFiltering()` composed, an excluded row
  never appears in a group's `rowsOf()`.
- The documented selection-cascade recipe (`table.rowsOf(g).map(table.trackBy)` →
  `selectionStateOf` → `select`/`deselect`) puts exactly the leaf ids into `selectedRows`, never
  a `group:` id.

## Out of Scope

- **`manual: true` (server-side grouping).** Open in `2-decisions.md`. Structurally blocked the
  same way filtering was: a manual-mode feature whose state must feed the request that produces
  `data` cannot live inside a feature composed on `createTable(data, ...)` — see
  [research-grouping-state-ownership.md](research-grouping-state-ownership.md). No competitor API
  to borrow the shape from, since none of them share this construction-order constraint. This
  spec does not lock a design against it, but does not settle it either.
- **Header-click routing to `groupOrder`.** Open in `2-decisions.md`. D5 makes clicking the
  grouped column's header a no-op by construction; routing that click to `groupOrder` instead is a
  UI-layer/directive convenience, not a store decision, and is not designed here.
- **Grand totals and pivoting (D9).** The genuinely larger AG Grid Enterprise-shaped machinery,
  with no current use case.
- **A `compareGroups`/comparator over bare `GroupKey` (superseded by D4).** Rejected during
  drilling — a key-only comparator cannot express count-based ordering; `groupOrder` over
  `GroupSummary` replaces it.
- **Per-column `enableGrouping` opt-out.** Not raised in this drill; carried over unresolved from
  `grouping.md`'s prior state, not newly scoped out here.
- **Auto-wiring a header collapse-all/expand-all UI.** UI-layer concern, tracked wherever the
  directive layer specs grouping's template affordances, which this spec's store contract
  unblocks but does not itself design.

## Further Notes

**Competitive grounding.** Read from published sources, not memory, across four libraries
(TanStack Table v8/v9, Material React Table, AG Grid, PrimeNG). Group order: three of four reuse
column sort recursively for group order (documented bug source elsewhere); only AG Grid treats
group order as its own concept, gated behind Enterprise and an opt-in flag whose *unflagged*
default this library gets for free from its fixed pipeline order. Grouping state ownership: none
of the four model group-by choice as a standalone domain object outside the table instance — but
none of them share this repo's `createTable(data, optsFn)` construction-order constraint either,
so their silence on a standalone primitive doesn't settle whether `manual: true` needs one here.
Generic grouping utilities (Lodash, `Object.groupBy`/`Map.groupBy`, d3-array, RxJS): none treat
group order as a first-class output of grouping itself — it's always first-occurrence, or (d3
only) a separate composed function operating on group values, not keys. That separation is direct
precedent for `groupOrder` as its own config surface rather than a flag folded into the grouping
key logic.

**A correction surfaced during drilling, worth stating plainly.** The `compareGroups?: (a:
GroupKey, b: GroupKey) => number` shape sketched before this drill cannot express "order by row
count" — a bare key carries no row data. `groupOrder`'s `GroupSummary<TRow>` (key + rows) shape
fixes this before it shipped as a gap.
