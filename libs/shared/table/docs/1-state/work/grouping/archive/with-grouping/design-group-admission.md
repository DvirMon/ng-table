---
title: Design — group admission (`groupWhen`)
type: design
status: settled shape, 2026-09-15 — config + `schema` fn, `withComputed` unchanged in slot 2.
  3 open questions (Q1–Q3), none blocking the shape. Q1 decided 2026-09-16, Q3 confirmed by test
  2026-09-17. Surface half (`initial` + `schema` in one config, either/or overload deleted) shipped
  in #118. Table-wide `groupWhen` shipped in #119. Per-column `groupWhen` (AND-combined) and
  `applyGroupOrder` remain proposed, not implemented — that is #120 and #121.
date: 2026-09-15
audience: developers
---

# Group admission — does this cluster earn a header?

Proposes one predicate, at two scopes, that decides whether a built cluster becomes a rendered
group or dissolves back into flat rows. Closes the mechanism half of
[`0-product/grouping.md`](../../../../../0-product/grouping.md)'s **OQ-5** (§4.2, missing values) and
**OQ-6** (§4.3, single-row groups) — both of which are today "no mechanism, no stated decision".

## What exists today

`buildClusters` (`engine/grouping.ts`) partitions **every** row into exactly one cluster per
level, unconditionally:

- `toGroupKey` maps `null → 'null'` and `undefined → 'undefined'` as two distinct, real groups.
  A row with no value for the grouping column gets its own header, labelled by whatever the
  consumer's template makes of `groupKey.value === undefined`.
- There is no size threshold. A cluster of one renders as an ordinary group, costing an expand
  click for one row (`0-product/grouping.md:734`).

Both behaviors are *consistent by construction* and *stated nowhere*. Neither is configurable.

## Why this is engine work, not a directive

A UI-level "don't render this header" is not the same feature. The cluster still exists, so:

- its rows keep the child `depth`, and read as indented under a header that isn't there;
- `expandedRows` still holds a synthetic `group:` id nothing renders (ADR-0006 never prunes);
- `computeAggregates` still runs for a group with no consumer;
- `rowsOf(group)` still resolves it.

Admission changes row *structure* — depth, ids, aggregates, `rowsOf`. It belongs in
`engine/grouping.ts`, applied in `buildClusters`/`emitGroupRows` **and** in the `clusterRows`
pipeline stage, or pipeline order and render order describe two different tables.

## The mechanism

One predicate over a cluster's own contents — the same vocabulary the group comparator already
takes (D4):

```ts
interface ClusterSummary<TRow> {
  readonly columnId: string;          // which level is being judged
  readonly key: GroupKey;
  readonly rows: readonly TRow[];
}

type GroupWhen<TRow> = (cluster: ClusterSummary<TRow>) => boolean;
```

`GroupSummary<TRow>` — `groupOrder`'s argument — becomes
`ClusterSummary<TRow> & { readonly admitted: boolean }`. The split is not cosmetic:
`groupWhen` **decides** admission, so it cannot be handed a summary that already states it.

Returning `false` ⇒ no header, no group id, no aggregates; the cluster's rows emit flat at the
**parent's** depth, in whatever position `groupOrder` gave the cluster.

### Why one predicate rather than named flags

`minGroupSize`, `groupNulls`, `groupEmptyString`, `skipUnknownValues` are four spellings of one
question. The predicate expresses all of them, plus the ones we have not thought of, without a
config key each:

```ts
(g) => g.key != null                    // missing values stay flat
(g) => g.rows.length >= 3               // only repeated values group
(g) => g.key !== '' && g.key != null    // blanks stay flat
(g) => g.rows.length >= 3 && g.key != null
```

Per `general-mechanism-over-enumerated-cases`: the library ships the primitive, the consumer
composes their product's definition of "worth grouping".

## The surface

Nothing lands on `ColumnDef` (D2). Everything lives under `withGrouping()`: table-wide data in
the config object, per-column rules in a `schema` fn **inside** that object, computed members
through `withComputed()` in slot 2 exactly as today.

```ts
interface WithGroupingConfig<TRow> {
  /** Seeds `grouping`. Unknown column id throws at construction (D14). */
  initial?: ColumnId<TRow>[];

  /** Table-wide admission — every active level. AND'd with any per-column `groupWhen`. */
  groupWhen?: GroupWhen<TRow>;

  /** Declarative per-column rules. Records by side effect; returns nothing. */
  schema?: (path: ColumnsPath<TRow, AnyGroupingRule<TRow>>) => void;
}

export function withGrouping<In extends GroupingInput<In>>(
  config?: WithGroupingConfig<RowOf<In>>,
): Feature<In, GroupingMembers<RowOf<In>>>;

export function withGrouping<In extends GroupingInput<In>, D extends DerivedDict>(
  config: WithGroupingConfig<RowOf<In>> | undefined,
  computed: Feature<NoInfer<In> & GroupingMembers<RowOf<In>>, D>,
): Feature<In, GroupingMembers<RowOf<In>> & D>;
```

`initialGrouping` is renamed `initial`; `groupOrder` leaves the config entirely (see **Ordering**).
Slot 2 is unchanged from every other feature (`with-sorting.ts:199`).

```ts
withGrouping(
  {
    initial: ['region', 'rep'],
    groupWhen: (c) => c.rows.length >= 2,

    schema: (path) => {
      applyGrouping(path.region, {
        when: () => this.groupByRegion(),
        groupWhen: (c) => c.key != null,          // no region ⇒ stays flat
      });
      applyGroupOrder(path.region, (a, b) => String(a.key).localeCompare(String(b.key)));

      applyGroupingAsync(path.rep, {
        params: () => ({ userId: this.userId() }),
        factory: (p) => groupingPreferenceResource(p),
        onSuccess: (pref) => pref.groupByRep,
        onError: () => false,
        groupWhen: (c) => c.rows.length >= 3,     // AND'd with table-wide >= 2
      });
      applyGroupOrder(path.rep, (a, b) => b.rows.length - a.rows.length);
    },
  },

  withComputed((store) => ({
    flatRowCount: computed(
      () => store.renderRows().filter((r) => r.kind === 'row' && r.depth === 0).length,
    ),
  })),
)
```

### Why the schema fn stays store-free and returns `void`

An earlier draft gave the schema fn the store and had it **return** a computed dict, so one
argument slot carried rules and computed state together. Rejected. The return was not stylistic
— a side-effecting call inside a `void` arrow contributes nothing to the enclosing signature, so
typed members can only arrive by being returned. Keeping computed state in `withComputed()`
removes the need for the return, and with it:

- **the store in the schema fn.** `runColumnsSchemaFn` runs `fn(path)` eagerly at call time
  (`schema/column-schema.ts:113-121`), before any store exists. Supplying one means moving the
  schema run inside the factory, over a prototype-chained input — the same `Object.create(input)`
  trick `createTableFeature` needs for slot 2 (`create-table-feature.ts:51-53`), because
  `compose-table.ts:76-77` merges members as features run, so a factory sees core plus *earlier*
  features only. A second site needing that trick for that reason is a second place to get it
  wrong.
- **an unverified inference route.** A fn that both side-effects and returns `D`, resolved
  against an overload set that already holds a callable `Feature` — never spiked.
  `config-vs-functional-extensibility` §5 is about precisely this class of failure.
- **a silent two-tier schema surface.** `columnSchema<TRow>(fn)` (`column-schema.ts:132`) has no
  store at its call site. A schema fn touching the store stops being portable, with nothing in
  the type saying which tier was written.

Cost of the chosen shape: one nesting level (`schema:` inside the object) rather than a two-arg
`with-*(config, schemaFn)` form. That is the whole trade, and it buys back all three points above.

Terminology: **computed**, not derive. The code still spells the type `DerivedDict` and the
helpers `wrapDerivedMembers`/`mergeDerivedSpec` — renaming those is a separate pass, not this
design's scope.

### Rules

```ts
function applyGrouping<TRow, K extends Extract<keyof TRow, string>>(
  path: ColumnHandle<TRow, K, AnyGroupingRule<TRow>>,
  opts: {
    when: () => boolean | undefined;      // level activation — unchanged
    groupWhen?: GroupWhen<TRow>;          // new — admission, this column only
  },
): void;
```

Same `groupWhen` member on `applyGroupingAsync`'s opts. The async rule's `onSuccess`/`onError`
decide *level activation*; `groupWhen` decides *admission*. Orthogonal, and a `groupWhen` on a
column that is not an active level is a silent no-op by construction.

### Combining the two scopes

**AND.** Per-column narrows table-wide; it never widens it. A cluster is admitted only if both
predicates pass.

Precedent: `foldColumnRules` AND-combines same-column `VISIBLE` entries (`engine/columns.ts`).
Rejected: per-column *overrides* table-wide — it makes the effective rule for any level
unreadable without knowing both, and "the table's floor" is the more useful table-wide semantic.

Table-wide `groupWhen` stays in the config because the path proxy is keyed by `keyof TRow`
(`schema/column-schema.ts:88-103`) — there is no wildcard node to hang "every level" on.

### `groupWhen` does not flow through `foldGroupingRules`

Recorded on the same rule object, folded by a different function. `foldGroupingRules` resolves
`string[] | undefined` level order and abstains for the whole set when any `when` is pending
(D13) — none of which applies to a row-data predicate. Admission needs a plain
`Map<columnId, GroupWhen>` collected off the same rules array (`collectGroupPredicates`), read at
cluster time. A pending `when` has nothing to say about `groupWhen`.

## Failure handling

`groupWhen` is a consumer callback evaluated against row data — runtime class, per ADR-0014 and
`classify-errors-construction-vs-runtime`:

- **Throws ⇒ admit the cluster** (group it). The fallback must be the *visible* direction;
  dissolving on error hides structure a person configured.
- Reported once per column per evaluation, matching `computeAggregates`' `reportedColumns`
  dedupe rather than the comparator's once-per-evaluation flag.

Construction-time errors stay throws: a rule naming an unknown column already throws through the
existing `rules name unknown column id(s)` guard.

## Ordering — no placement config; the group comparator already owns this

A dissolved cluster is **not** removed from its sibling list. It stays an ordering participant
carrying its own `key` and `rows`, flagged:

```ts
interface GroupSummary<TRow> extends ClusterSummary<TRow> {
  readonly admitted: boolean;   // false ⇒ this cluster emits flat, no header
}
```

`sortClusters` orders admitted and dissolved siblings together. Dissolution — dropping the
header and re-parenting the rows to the parent's depth — happens in `emitGroupRows`, **after**
ordering, so whatever position the comparator gave a dissolved cluster is the position its flat
rows occupy.

This is what keeps the mechanism from needing an `ungroupedPlacement: 'first' | 'last'` key. A
comparator expresses every arrangement:

```ts
// tail (the default, spelled explicitly)
(a, b) => (a.admitted === b.admitted ? 0 : a.admitted ? -1 : 1)

// ungrouped first
(a, b) => (a.admitted === b.admitted ? 0 : a.admitted ? 1 : -1)

// admission ignored — small groups and their rows sort in among the big ones by key
(a, b) => compareKeys(a.key, b.key)

// tail, and ordered by size within the level
(a, b) =>
  a.admitted !== b.admitted ? (a.admitted ? -1 : 1) : b.rows.length - a.rows.length
```

**Default with no comparator: stable partition — admitted siblings in first-occurrence order,
then dissolved siblings in first-occurrence order.** Tail falls out as a default, not as a rule.
Today's `groupOrder` has no default at all (`if (!groupOrder) return nodes` in `sortClusters`),
so this is a new, narrower default that applies only once a level declares admission.

### `groupOrder` moves to the schema, per column

Today `groupOrder` is one comparator on `WithGroupingConfig`, applied at **every** level
(`sortClusters` recurses with the same function). That is strictly less expressive than the slot
deserves: `sortClusters` only ever compares **siblings**, and siblings always share a `columnId`
— so the comparator is already per-level in everything but where it is declared. A consumer
wanting regions alphabetical and reps by size has to branch on `a.columnId` inside one function.

It belongs beside `applyGrouping`, keyed by the column whose level it orders:

```ts
applyGroupOrder(path.region, (a, b) => String(a.key).localeCompare(String(b.key)));
applyGroupOrder(path.rep, (a, b) => b.rows.length - a.rows.length);
```

Unlike `groupWhen`, there is **no table-wide counterpart to keep**. A comparator over
`GroupSummary` has no meaning spanning levels — it never receives two clusters from different
columns — so the config-level slot is not a "default", it is the same per-level operation
declared in a place that hides which level it applies to. `WithGroupingConfig.groupOrder` is
therefore **replaced**, not supplemented.

### Migration

`grouping-regressions/` is the only consumer supplying a comparator. `WithGroupingConfig.groupOrder`
is removed in the same change that adds `applyGroupOrder` — pre-1.0, one call site, no deprecation
window. D4 is amended rather than superseded: the *shape* (a comparator over `GroupSummary`,
siblings only, decoupled from row sort) is unchanged; only its declaration site moves.

### Multiple dissolved clusters at one level stay separate

Each keeps its own entry rather than merging into one residual node. Merging is expressible with
a comparator that ties them (the default does); un-merging is not recoverable once the engine
has collapsed them. Under the default they land adjacent anyway, which is the "one flat tail"
a person pictures.

### Row sorting is unaffected

`sort` runs after `group` in `PIPELINE_ORDER` and the `'group'` render stage re-clusters after
it, so rows inside the flat region sort exactly like grouped rows do (S-G2). D5's decoupling
holds unchanged: the group comparator arranges clusters — admitted or not — and `withSorting()`
arranges rows within them.

## Open questions

**Q1 — Does a dissolved cluster's rows still group by the *next* level?** — **DECIDED
2026-09-16: exit entirely.** Recorded in [2-decisions.md](2-decisions.md). The recommendation
below stands; the counter-case was checked and rejected. Note the question is only observable
where `groupWhen` is non-monotone in size (a value predicate, or a per-column threshold looser at
a deeper level) — under a size threshold a rejected cluster's sub-clusters are all rejected too,
so both answers render identically.
Level 1 rejects a cluster — do its rows cluster by level 2 inside the flat region, or exit the
grouping tree entirely?
*Recommendation:* exit entirely. "Stays flat" is the stated promise; a row that escaped level 1
reappearing under a level-2 header is the confusing outcome, and re-entering the tree makes depth
arithmetic depend on which level rejected it.
*Counter-case worth checking before closing:* grouping by region then rep, where a region with
two deals dissolves — its two rows arguably still want their rep headers. If that reads better,
the alternative is "dissolve this level only, keep descending", which is a one-line change in
`emitGroupRows` but a different stated promise.

**Q2 — Is the flat region labellable?**
Nothing marks where admitted groups end and dissolved rows begin. A consumer wanting an
"Ungrouped (12)" heading has no row to hang it on, since a dissolved cluster emits no header by
definition.
*Recommendation:* ship nothing in v1. The escape hatch is admitting the cluster and styling its
header differently — which the consumer can already do, since `groupWhen` is their predicate and
they know which clusters it rejects. Revisit if the flat region turns out to need a divider more
often than not.

**Q3 — Does `rowsOf()` see dissolved rows? — DECIDED, confirmed by test 2026-09-17: yes, via the
parent.** `rowsBeneathGroup` re-derives the cluster tree; a dissolved cluster itself has no group
id to resolve, so `rowsOf` on anything resolving to it returns `[]` with no throw — but the
*parent* group's `rowsOf` still includes those rows, since dissolution changes depth, not
membership. Landed as recommended below; `with-grouping.spec.ts` (#119 Step 4) asserts both
halves through the public surface.

## Out of scope

Two things were raised while shaping this and deliberately do **not** belong to it:

- **A schema fn that receives the store and declares computed members** — `(path, store) => D`.
  Its driver is the `withComputed()`/slot-2 question across all five features, not grouping. It
  is an ADR and should open with a typing spike, the way `computed-state-mechanism/2-research.md`
  probed every route before D19-D22 landed.
- **OQ-5's display half** — what a header *shows* for a missing or non-primitive value. A
  consumer who admits `null` clusters still needs a stated label, and
  [#114](https://github.com/DvirMon/acme/issues/114) still owns the accessor contract. Admission
  only offers the escape hatch of not creating the group at all.
