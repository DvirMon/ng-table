---
title: Decisions — split withExpansion() into panel + withTree()
type: decisions
capability: expansion
ticket: "101"
date: 2026-09-20
audience: developers
---

# Decisions — panel/tree split (#101, ADR-0012)

Grill record for [#101](https://github.com/DvirMon/ng-table/issues/101).
Contract under discussion: [ADR-0012](../../../../adr/0012-split-expansion-into-panel-and-tree.md).
Capability log: [`docs/decisions/expansion.md`](../../../../decisions/expansion.md)
— created 2026-09-20, carrying E5–E17. Prior expansion decisions live in
[`archive/with-expansion/2-decisions.md`](../../archive/with-expansion/2-decisions.md),
[`expansion-state-audit.md`](../../archive/with-expansion/expansion-state-audit.md)
and the spec's own Open Questions.
Written contract: [`2-spec.md`](2-spec.md) · [`3-architecture.md`](3-architecture.md).

## Node graph (step 0)

Sub-features of #101, edges between nodes (not against existing code):

| Node | What it settles | Rank |
|---|---|---|
| **D** `withTree()` data contract | nested `childrenAccessor` vs flat + path/subRows | core |
| **S** store surface | what `createExpansionStore()` owns: `everExpanded`, multi-id write / `setExpanded` | core |
| **A** `createExpansionStore()` extraction | the factory itself | dependent (S) |
| **B** `withExpansion()` narrowed to panel | what is left, incl. `expandAll` without an accessor | dependent (S, A) |
| **C** `withTree()` built | config, `'tree'` stage, `isExpandable` | dependent (D, A) |
| **F** `expansionState` tri-state | which feature, built when | dependent (D, C) |
| **H** G6 — nested rows have no `sourceIndex` | where the fix lands | dependent (C) |
| **I** group-collapse delegation to panel | already true in code; confirm the surface it needs | dependent (B) |
| **J** docs split + ADR accept | spec split, PRD stories 10/23/31, ADR → accepted | leaf |

```
D ──► C ──► F
        └─► H
S ──► A ──┬► B ──► I
          └► C
J (leaf)
```

- **Parallel-safe:** D and S (grilled first, independently). J throughout.
- **Sequenced:** D → C → {F, H}; S → A → {B, C}; B → I.

## Findings that change the ADR's premises

The ADR is dated 2026-09-03; ADR-0022/0023 landed after it.

1. **`depth` is no longer feature-owned.** `engine/flatten.ts` is "the only
   producer of `depth` and `parentId`". ADR-0012 Decision 2 ("`withTree()`
   owns … `depth`") is stale — `withTree()` owns *nesting* (`RenderNode.children`),
   the engine owns depth.
2. **`sourceIndex` is stamped centrally.** `engine/core.ts`'s `renderRows`
   resolves it from `indexById`, built from top-level `config.data()` only. So
   G6 cannot be fixed inside the `'tree'` render stage as Decision 6 assumes —
   the fix is an engine/IR change, not a stage change.
3. **The prune is not a render stage.** `flattenVisible(tree, expanded())` is
   the single reader of expansion state; docs still say "engine-owned `'prune'`
   render stage".
4. **`expandAll(ids)` already exists** on `withExpansion()` (#97), so grouping's
   delegation needs no new verb — but its auto-discovery half dies with the
   accessor.

## Decisions

<!-- appended one line per settled question, dated -->

### D1 — `withTree()` accepts real-row parents only (2026-09-20)

**Decided.** Every node of the tree must exist as an entry in the flat
`data()` array. `withTree()` takes `childrenAccessor` and nothing else;
it never invents a parent.

Consumer data is **always a flat array** (user's standing rule), so the
shape is parent-pointer:

```ts
readonly byParent = computed(() =>
  Map.groupBy(this.data(), (r) => r.parentId));

withTree({ childrenAccessor: (row) => this.byParent().get(row.id) })
```

**Why.** A path-derived tree (`getDataPath`, rows carrying
`['Docs','2024','q1.pdf']` with no row for the folders) is not a
different config key — it is `withGrouping()`'s mechanism. Both
partition a flat array and invent `data: null` parents with no cells,
no `sourceIndex` and no editability; they differ only in that grouping's
depth is fixed by declared levels while a path's varies per row. Giving
`withTree()` that shape would duplicate `buildClusters` under a second
feature name.

What grouping structurally *cannot* do is the parent-pointer shape: a
group header is synthetic by definition, and here the parent is a real
row that renders its own cells, resolves a `sourceIndex` and is
editable. That is `withTree()`'s whole reason to exist.

**Rejected:** `getDataPath` on `withTree()`. Additive if ever wanted —
an optional key changes nothing written against `childrenAccessor` —
but it belongs to grouping (variable-depth levels), not here.

**Follows from D1, not separately asked:** `childrenAccessor` keeps its
one-argument shape. A second `rows` argument was considered and dropped
— with flat data the consumer must index once in a `computed()`, and an
argument arriving per call gives an index nowhere to live, so it would
only make the O(N²) `rows.filter(...)` spelling look blessed.

### D2 — `childrenAccessor` is required; no `row.children` fallback (2026-09-20)

**Decided.** `withTree()` cannot be called bare.

```ts
interface WithTreeConfig<TRow> {
  childrenAccessor: (row: TRow) => TRow[] | undefined;
  isExpandable?: (row: TRow) => boolean;
}
```

**Why.** The fallback `(row) => row.children` is the only thing that
admits nested data, and nested children are never entries in `data()`.

**Consequence — G6 is closed as impossible, not fixed.** `indexById`
(`engine/core.ts`) is built from `config.data()`, so `sourceIndex`
resolves for any row present there. Under D1 + D2 every tree node is,
at any depth. The "nested child resolves a `null` field tree and edits
silently no-op" bug therefore cannot occur under the supported
contract. **Node H leaves the #101 graph**, and ADR-0012's Decision 6
is superseded — it assumed the fix belonged to the `'tree'` render
stage, which is no longer where `sourceIndex` is stamped anyway.

**Cost accepted:** no zero-config `withTree()`; four `childrenAccessor`
lines added to the existing tree specs. No production call site is
affected — the only in-repo `withExpansion()` call is a grouping story
using group collapse, which has no accessor either way.

### D3 — `everExpanded` is panel-only (2026-09-20)

**Decided.** `createExpansionStore()` holds the plain open-id
machinery; `withExpansion()` adds `everExpanded` on top of it.
`withTree()` does not expose the member.

```
createExpansionStore()   expandedRows, rowExpanded,
                         toggleExpanded, collapseAll
withExpansion()          + everExpanded
withTree()               —
```

**Why.** `everExpanded` exists so a collapsed detail panel stays
mounted and its collapse is a class flip rather than a teardown. A
tree child *is* a row, and collapsing it is meant to destroy it — the
member would carry no tree meaning. Follows the editing precedent
(`api/features/editing/state.ts`): the shared store stops at the
common state, and each feature adds its own on top.

**Doc correction:** `1-state/features/expansion.md` says `everExpanded`
is "specced, not yet implemented" and sets the spec's `code:` axis to
`partial` on that basis. It is implemented in `with-expansion.ts`
today. Fix in the docs pass (node J).

### D4 — two store verbs; `setExpanded()` is the general write (2026-09-20)

**Decided.** `createExpansionStore()` exposes one general write plus
the single-id flip:

```ts
toggleExpanded(id: RowId, options?): void;          // flip one
setExpanded(ids: readonly RowId[], options?): void; // replace the set
```

`expandAll(ids)` and `collapseAll()` stop being store verbs — both were
already `setExpanded` in disguise (`expandAll` ends in
`expandedRows.set(new Set(ids))`, `collapseAll` in `set(new Set())`).
`withTree()` keeps its own `expandAll(options?)`, which is a genuinely
different operation: the `childrenAccessor` discovery walk.

**Why.** The "the open set is exactly these ids" write is what
`state-persistence.md`'s snapshot slice needs and no current verb
expresses. Adding it while keeping two wrappers over it would be four
verbs for two operations.

**Call sites this breaks** (all in-repo, all grouping):

| Site | Today | After |
|---|---|---|
| `grouping-collapsible-story-host.component.ts:83` | `table.expandAll(table.groupIds())` | `table.setExpanded(table.groupIds())` |
| `grouping-collapsible-story-host.component.ts:87` | `table.collapseAll()` | `table.setExpanded([])` |
| `with-grouping/feature.spec.ts:866` | `store.collapseAll()` | `store.setExpanded([])` |
| `with-grouping/feature.ts:68` (JSDoc) | names `expandAll(table.groupIds())` | re-point |
| `grouping.mdx:422-424`, story host JSDoc + template copy | same | re-point |

Public API break beyond the repo: `expandAll`/`collapseAll` are
exported members of `withExpansion()`. Same breaking-change budget the
ADR already accepts for `childrenAccessor`.

**Open, deferred to the panel node:** whether `withExpansion()` re-adds
`collapseAll()` as named sugar for readability. Kept out of the store
either way.

### D5 — `expansionState` belongs to `withTree()` and ships with it (2026-09-20)

**Decided.** `readonly expansionState: Signal<'all' | 'some' | 'none'>`
is a `withTree()` member, built in this issue.

**Placement was settled by D1/D2, not chosen here.** The member answers
"are all expandable rows open?", which needs the
`collectExpandableRowIds` walk through `childrenAccessor`. Only
`withTree()` has an accessor. On the panel side every row can hold a
panel, so a consumer writes `expandedRows().size === rows().length`
themselves — nothing for the feature to own. The spec's justification
("a consumer cannot compute it cheaply") holds for tree only.

**Timing.** Ships with `withTree()`. The walk already exists for
`expandAll()`, so the marginal cost is one `computed()` — it adds a
member to the `withTree()` slice rather than a slice of its own.

Closes the spec's open question *"Does `expansionState` land here or in
`withTree()`?"* and the issue's second open question.

### D6 — both features ship as ADR-0015 slices, in this issue (2026-09-20)

**Decided.** `withExpansion()` exposes `table.expansion`, `withTree()`
exposes `table.tree`. ADR-0015's slice shape is pulled forward for
these two features only; the other four stay on flat members until #50.

**Why.** `claimMember()` throws when two features provide the same key,
and both features want `expandedRows`/`toggleExpanded`/`rowExpanded`.
ADR-0012 says each declares "its own keys" but never names them, while
its verification plan requires `[withExpansion(), withTree()]` to
construct. The alternative — inventing `treeExpandedRows`,
`toggleTreeExpanded` — ships names that #50 deletes weeks later, so
consumers absorb two breaking changes instead of one.

**Deviates from the issue's sequencing note**, which put all slicing in
#50. Still correct in spirit: #50 slices *four settled features* rather
than tearing a freshly-split one in half. These two arrive sliced.

ADR-0015's own table assigns one `expansion` slice returning
`Set<RowId>`; the split makes that two slices. Amend the ADR in the
docs pass (node J).

### D7 — named verbs outside, one primitive inside; `*All` merges into an optional argument (2026-09-20)

**Amends D4.** D4 removed `expandAll`/`collapseAll` because they
duplicated `setExpanded`. That deleted the readable names along with
the duplication. The internal/external split keeps both.

```ts
// internal to createExpansionStore() — the only writer of the signal
function setExpanded(ids: readonly RowId[], options?): void;

// public
toggle(id, opts?)
expand(ids?, opts?)     // omit ids = all
collapse(ids?, opts?)   // omit ids = all
set(ids, opts?)         // replace — the restore path
```

`expand()` with no ids means every row in `rows()` on the panel, and
the `childrenAccessor` discovery walk on the tree — so `expandAll()`
disappears as a name while keeping its behavior. `collapse()` with no
ids replaces `collapseAll()`.

`set(ids)` stays public: restore needs one atomic replace, and
`collapse()` then `expand(ids)` is two writes with two emission passes.

Full surface:

```ts
table.expansion()              // Set<RowId>
table.expansion.everExpanded()
table.expansion.changed        // Observable<RowId>
table.expansion.toggle/expand/collapse/set

table.tree()                   // Set<RowId>
table.tree.changed
table.tree.toggle/expand/collapse/set
table.tree.state()             // 'all' | 'some' | 'none'
```

**Why the merge:** `general-mechanism-over-enumerated-cases` asks for
one general primitive with sugar on top, not a public API shaped like
its internals. Precedent in the codebase: today's `expandAll(ids?)`
already treats an omitted argument as the broad case.

### D8 — grouping stays static; collapse comes from `withTree()` (2026-09-20)

**Decided. Reverses ADR-0012 Decision 5.** `withGrouping()` renders a
static grouping UI and owns no open-id state. A consumer who wants
collapsible group headers composes `withTree()`:

```ts
createTable(config, withGrouping(schema), withTree());
```

Collapsing a group header is tree-shaped UI — a chevron that hides
descendants — so it belongs with the feature that owns descendant
visibility, not with the detail-panel feature.

**`withExpansion()` contributes nothing to the render pipeline.** It no
longer registers a set in `expandedSources`. It is pure consumer-facing
state plus `onRowsRemoved` pruning; panel markup is gated on
`table.expansion()` / `.everExpanded()` directly.

**This is what fixes the collision the ADR claimed was already
handled.** ADR-0012's alternatives table argues separate store
instances keep panel and tree state from colliding. They do not —
`engine/core.ts` unions every contributed set before
`flattenVisible` reads it, so with both composed, opening a panel on
row X would reveal X's tree children. With the panel out of the union
there is one contributor and the case cannot arise. Correct the ADR's
alternatives table in the docs pass.

**Consequences:**

- `isExpanded` on a `RenderRow` is stamped only where `withTree()`
  contributes. Panel state is read from the slice, never from
  `RenderRow`.
- ADR-0012's verification plan changes: the pair that must construct
  and collapse correctly is `[withGrouping(), withTree()]`, not
  `[withExpansion(), withGrouping()]`.
- The grouping story (`grouping-collapsible-story-host`) swaps
  `withExpansion()` for `withTree()`, and its toolbar calls move to
  `table.tree.expand(table.groupIds())` / `table.tree.collapse()`.
- `withGrouping()` alone renders every group open, since nothing
  contributes a set and `expanded` stays `undefined`. That is the
  static UI, as intended.

### D9 — `childrenAccessor` is optional with no fallback (2026-09-20)

**Amends D2.** D2 made the accessor required to kill the
`row.children` fallback. Under D8 a collapse-only consumer has no row
tree at all, and requiring the accessor would force
`childrenAccessor: () => undefined` as dead config.

```ts
interface WithTreeConfig<TRow> {
  childrenAccessor?: (row: TRow) => TRow[] | undefined;  // omitted = no row tree
  isExpandable?: (row: TRow) => boolean;
}

withTree()                          // collapse only — group headers
withTree({ childrenAccessor: fn })  // row tree
```

D2's goal is preserved: **nothing reads `row.children` anywhere**, so
nested data never enters and G6 remains impossible.

**Follows, not separately asked:** `withTree()` declares the `'tree'`
render stage **only when an accessor is supplied**. A collapse-only
instance has no nodes to nest, so claiming the stage would block a
future stage claimant for no benefit.

### D10 — `initialExpanded` ships with the split (2026-09-20)

**Decided.** The construction-time seed specced in
`features/expansion.md` (2026-09-07, never built) lands in
`createExpansionStore()` as part of this issue.

`readonly RowId[]`, read once, emits no `rowExpanded`. Both features
accept it. The panel additionally seeds `everExpanded`, since a
restored-open row has been opened and its panel should mount at once.

The factory is being written from scratch here, so the marginal cost is
a few lines; deferring means a second issue reopening the same file.

### D11 — tree has no declared levels (2026-09-20)

**Recorded for the spec, not a fork.** Raised while comparing the two
features' configuration surfaces.

| | grouping | tree |
|---|---|---|
| hierarchy comes from | declared levels (config) | the rows themselves |
| depth | fixed by the declaration | varies per row |
| reorderable at runtime | yes (`setGroupLevels`) | no — would mean rewriting data |
| configuration | "group by what?" | "how do I read the parent link?" |

`withTree()` therefore has no levels API and never gains one — a
declared-axis hierarchy *is* `withGrouping()` (D1). The only
row-selection knob is `isExpandable`, whose default (accessor returned
a non-empty array) covers the normal case; it exists for lazy children,
where the accessor honestly returns `undefined` but the chevron must
still render so the fetch can be triggered.

Collapse-only `withTree()` declares nothing: group headers derive
`hasChildren` from `node.children.length` in `flattenVisible`.

### D12 — a throwing `childrenAccessor` degrades, it does not propagate (2026-09-20)

**Follows from [ADR-0014](../../../../adr/0014-runtime-error-policy.md),
recorded rather than asked.** `childrenAccessor` is a consumer callback
invoked per node inside the `renderRows` computed — a runtime,
data-dependent failure, so it degrades rather than throws.

Fallback: treat the row as having no children (it renders, without a
chevron) — visibly wrong beats hiding rows. Reported once per
evaluation, not once per row, matching `computeAggregates`'
`reportedColumns` dedupe in `engine/grouping/render.ts`. Reported in
production too, not dev-only.

No guard exists today; absence is omission, not precedent.

## Graph after the grill

Node **H** (G6) is gone — closed as impossible by D1/D2/D9, not fixed.
Node **I** inverted: grouping delegates to `withTree()`, not the panel.

```
D1,D2,D9 ─► C (withTree)  ─► F (expansionState, D5)
S (D3,D4,D7,D10) ─► A (createExpansionStore) ─┬► B (withExpansion)
                                              └► C
D8 ─► I (grouping composes withTree)
D6 ─► both features ship sliced
J (docs) — leaf
```

## Docs owed (node J)

Beyond the list already on #101:

- **ADR-0012** — Decision 2 drops `depth` (engine-owned since ADR-0023);
  Decision 5 reverses (D8); Decision 6 is superseded (G6 impossible, and
  `sourceIndex` is no longer stamped by a render stage); the
  alternatives table's "separate instances prevent collision" claim is
  wrong and must say why (the engine unions contributed sets).
  Verification plan swaps `[withExpansion(), withGrouping()]` for
  `[withGrouping(), withTree()]`. Then `proposed` → `accepted`.
- **ADR-0015** — its slice table lists one `expansion` slice; the split
  makes it two (`expansion`, `tree`), and these two arrive sliced ahead
  of #50.
- **`features/expansion.md`** — splits in two. Also carries three stale
  claims to drop on the way: `everExpanded` "not yet implemented" (it
  is), the `code: partial` axis that rested on it, and the "engine-owned
  `'prune'` render stage" (it is `flattenVisible`, not a stage).
- **`features/grouping.md`** — the delegation note points at `withTree()`
  now, and grouping alone renders every group open.
