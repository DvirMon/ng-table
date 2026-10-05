# Spec — the render IR becomes a tree; flattening replaces the prune (#105)

Source: [`1-decisions.md`](1-decisions.md) (grilled 2026-09-20) ·
prototype [`alt-tree-shaped-stages.md`](alt-tree-shaped-stages.md) ·
supersedes [ADR-0017](../../../../../adr/0017-engine-owned-descendant-prune.md) **D2 only**.
Architecture (types, file layout, call sites): [`3-architecture.md`](3-architecture.md).

## Problem Statement

A consumer of this library never sees the problem directly. A **feature author** —
the person writing `withGrouping()`, `withExpansion()`, or a third-party
`withPinning()` once [#102](https://github.com/DvirMon/ng-table/issues/102) opens
stage registration — sees all of it.

Today a render stage receives a flat array of render rows and must hand back a flat
array. Anything that nests — a group header over its members, a parent row over its
children — has to flatten the nesting itself and re-describe it in fields: stamp
`depth`, stamp `parentId`, and emit a parent immediately before its own descendants.
A later engine-owned `'prune'` stage then reads those fields back and deletes the
rows the author just emitted.

Four things go wrong with that, none of them checked:

1. **`parentId` is a stamp, not a fact.** A stage that forgets it emits rows that can
   never be hidden. Nothing compiles differently; nothing fails.
2. **Emission order is load-bearing and invisible.** The prune is one forward pass
   over a `hidden` accumulator, correct only because a parent precedes its
   descendants. A stage that sorts, or that inserts rows anywhere, silently breaks
   collapse. ADR-0017 records this as a known, unchecked invariant, and
   `render-stages.spec.ts` carries a test whose only job is to _document_ the broken
   case.
3. **Four constructs exist to say "this entry is not a feature"** — the `'prune'`
   entry in `RENDER_ORDER`, `Exclude<RenderStage, 'prune'>`, `CLAIMABLE_RENDER_STAGES`,
   and a `stage === 'prune'` branch inside the fold's own reduce.
4. **`'prune'` must be positioned last** among claimable stages — a rule held by
   nothing but where someone typed it in a hand-written array.

For a consumer the visible symptom is narrower but real: group headers and tree rows
report expansion two different ways. A group header has no `isExpanded`, so a template
reaches past the row into `table.expandedRows().has(row.id)`; a tree row reads
`row.isExpanded`. The same question, two spellings, decided by `row.kind`.

## Solution

Stop flattening between stages. Render stages exchange a **nested** `RenderNode` tree,
and one engine-owned walk — `flattenVisible` — turns the tree into the flat
`RenderRow[]` the template consumes.

Hiding stops being an operation. A collapsed node is simply not descended into. Every
field that was a stamp becomes a derivation:

| Was                                                               | Becomes                                             |
| ----------------------------------------------------------------- | --------------------------------------------------- |
| `parentId` stamped by each stage; forget it ⇒ unprunable row      | derived by the walk from position                   |
| `depth` stamped by each stage; can disagree with `parentId`       | derived; cannot disagree                            |
| "parent emitted immediately before its descendants"               | structural — a child is _inside_ its parent         |
| `'prune'` + `Exclude` + `CLAIMABLE_RENDER_STAGES` + reduce branch | deleted                                             |
| `hasChildren` a stage must remember to set                        | derived from `children`, overridable for lazy trees |
| `isExpanded` on tree rows only; group headers read the store      | stamped uniformly on every node that has children   |

The public contract does not move. A consumer still passes flat `data`, still reads a
flat `RenderRow<TRow>[]` off `renderRows()`, with the same `id` / `depth` / `kind` /
`parentId` / `index` / `sourceIndex` / `cells` fields. `RenderNode` is engine-internal
and never exported from `index.ts`. This is a change of intermediate representation.

It also removes work from #102 rather than adding it: with nesting structural, there is
no emission order for a third-party stage to preserve, so the `preservesEmissionOrder`
flag ADR-0020 proposed — a boolean whose author can get it wrong — is not built.

## User Stories

**Feature author (first-party)**

1. As a feature author, I want to declare nesting by putting a node inside another
   node's `children`, so that I never hand-compute `depth` or `parentId`.
2. As a feature author, I want the engine to derive `parentId`, so that forgetting to
   stamp it is not a class of bug that exists.
3. As a feature author, I want my stage's output order to carry no hidden meaning, so
   that reordering nodes inside a level cannot silently break collapse.
4. As a feature author writing the `'tree'` stage, I want a supplied walk helper
   (`mapNodes`) that reaches every node at every depth, so that I do not hand-write a
   recursion that has to descend through another feature's group nodes.
5. As a feature author, I want "my stage forgot to recurse, so grouped rows were
   silently skipped" to be unrepresentable rather than documented.
6. As the author of `withGrouping()`, I want to emit a header with its members nested
   inside it, so that admitted and non-admitted clusters differ only in whether a
   header node wraps them.
7. As the author of `withExpansion()`, I want my render stage to stop reading expansion
   state entirely, so that the "read the signal inside the transform, not at declaration
   time" trap disappears with it.
8. As a feature author, I want a lazy-loading tree row to declare `hasChildren`
   explicitly, so that a row whose children have not been fetched still renders its
   toggle.
9. As a feature author, I want the zero-contributor case ("no expansion feature is
   composed") to stay distinct from the empty-set case ("a feature is composed and
   nothing is open"), so that composing grouping alone still shows every row.

**Feature author (third-party, #102)**

10. As a third-party stage author, I want to receive the same `RenderNode[]` the
    built-in stages receive, so that I am not a second-class stage with extra rules.
11. As a third-party stage author, I do not want to declare a `preservesEmissionOrder`
    boolean, because there is no emission order to preserve and a wrong declaration
    would break collapse silently.
12. As a third-party stage author, I want the engine's anchor set to contain only names
    it actually runs, so that I cannot anchor against a reserved name nobody designed.

**Consumer (template author)**

13. As a template author, I want `row.isExpanded` to answer "is this row open" for a
    group header and a tree row alike, so that I write one expression, not a branch on
    `row.kind`.
14. As a template author, I want `row.hasChildren` to tell me whether to render a toggle
    at all, for both row kinds.
15. As a template author, I want the rows I receive to be exactly the rows that are
    visible, so that `index` and `aria-rowindex` match what renders.
16. As a template author, I want `row.depth` to keep meaning indentation level, so that
    existing indentation markup is untouched.
17. As a template author of a lazily-loaded tree, I want a row with unfetched children to
    still show its toggle, so that a person can open it to trigger the fetch.
18. As a consumer composing only `withGrouping()`, I want every group open by default,
    exactly as today.
19. As a consumer composing `withExpansion()` with nothing currently expanded, I want
    nested rows hidden — not shown — because a feature did claim the slot.
20. As a consumer, I want `renderRows()` to stay a flat array, so that virtual scroll and
    `@for` are unaffected.
21. As a consumer, I want `sourceIndex` to keep resolving by trackBy id, so that row edits
    still write to the right `data()` entry.

**Maintainer**

22. As a maintainer, I want `RENDER_ORDER` to mean exactly "stages a feature may claim",
    so that reading it tells me the truth with no exclusion list beside it.
23. As a maintainer, I want the prune's four supporting constructs deleted rather than
    relocated, so that the next reader has less to hold.
24. As a maintainer, I want one spec file that owns the visibility rule, so that "why is
    this row hidden" has exactly one place to look.
25. As a maintainer, I want the grouping stage's spec to assert the tree it builds and not
    the depths someone else derives, so that the spec states which domain owns what.
26. As a maintainer, I want a written record of which ADR text this supersedes and which
    still stands, so that ADR-0017 D1/D3/D4 are not read as retired.

## Implementation Decisions

Decision ids in **bold** trace to [`1-decisions.md`](1-decisions.md).

### The intermediate representation

- **A1 — the tree IR is settled.** Render stages exchange nested `RenderNode`s. The two
  rejected alternatives are recorded: _alt-1 terminal finalize_ (fold the prune into
  `core.ts`'s terminal pass) and _keep ADR-0017 as shipped_. Both relocate the
  emission-order invariant instead of removing it.
- **`RenderNode` is engine-internal.** Not exported from `index.ts`. A consumer never
  constructs or receives one.
- `RenderNode` carries `id`, `kind`, `data`, `groupKey`, `aggregates`, an optional
  `hasChildren`, and `children`. It does **not** carry `depth`, `parentId`, `index`,
  `sourceIndex`, `cells` or `isExpanded` — each of those is derived or stamped later.
- **C3 — `hasChildren` is an explicit optional override**, set by the producing stage;
  the walk falls back to `children.length > 0` when it is unset. Derived from
  `children.length` alone it would break lazy trees: `withExpansion()`'s `isExpandable`
  exists precisely so a row renders its toggle before its children load, and
  `childrenAccessor` legitimately returns `[]` until then. Handing the walk an
  `isExpandable` predicate instead was rejected — it hard-codes a config shape
  [#101](https://github.com/DvirMon/ng-table/issues/101) lists as undecided. An opaque
  boolean on the node survives either outcome.

### The stage contract

- `RenderNodeTransform<TRow>` — `readonly RenderNode<TRow>[]` in, `readonly
RenderNode<TRow>[]` out — replaces `RenderRowTransform`. `StagedRow` is deleted.
- **B1 — `RENDER_ORDER` becomes `['group', 'tree']`.** `'prune'` is gone because the
  stage is gone. `'paginate'` is **dropped**, not kept: it has no claimant today (only
  fakes in `render-stages.spec.ts`). The post-flatten phase question is deferred, not
  answered — it returns when pagination is actually built, and it will no longer be free
  then.
- **G4 — concrete deletions.** `CLAIMABLE_RENDER_STAGES`, `Exclude<RenderStage, 'prune'>`
  in `RenderStages`, the `stage === 'prune'` branch in `runRenderStages`, the `expanded`
  parameter on `runRenderStages`, and `pruneUnexpandedDescendants` itself. Both fold sites
  iterate `RENDER_ORDER` directly.
- **C1 — the engine owns the recursion.** It ships `mapNodes(nodes, fn)`; a stage supplies
  a per-node function and never hand-writes a tree walk. This closes a gap the prototype
  missed: `'tree'` runs _after_ `'group'`, so under a nested IR it must descend through
  group nodes to reach data leaves — a walk it does not have today, and one every
  third-party stage author would otherwise inherit.
- **C2 —** this also makes "a stage forgot to recurse, so grouped rows were silently
  skipped" unrepresentable, rather than a new silent bug traded for the old one.
- `mapNodes` visits **post-order**: a node's `children` are already mapped when `fn` sees
  it, and `fn`'s return value is used as-is and never re-descended.
- `fn` returns exactly one node, not a node array. A stage that wants to add rows nests
  them; sibling-splitting is the flat-emission shape this migration removes. Revisit only
  if a concrete stage needs a true sibling insert.

### The flatten

- `flattenVisible(nodes, expanded)` is the single place expansion state is read, and the
  only producer of `depth` and `parentId`. It returns the flat rows `core.ts` then stamps
  `index`, `sourceIndex` and `cells` onto.
- **X1 — zero contributors stays distinct from an empty set.** `expanded === undefined`
  (no feature claimed the slot) means everything is open; a defined-but-empty `Set` means
  a feature claimed it and nothing is open, so every nested row hides. Never collapse the
  two into a `size === 0` check.
- **D1 — `isExpanded` is stamped uniformly** on every node that has children, group rows
  included. `undefined` for a leaf. This reverses the 2026-09-16 rejection, whose stated
  cost — a new "collect every feature's open ids" field on `TableFeatureSpec` — was
  already paid by ADR-0017 D3.
- **D1a (refinement, new here).** `isExpanded` is stamped only when a feature actually
  contributed the slot (`expanded !== undefined`). With no expansion feature composed, a
  group header keeps `isExpanded: undefined` exactly as today, even though the walk treats
  it as open. Stamping `true` there would invent expansion state for a table that has
  none, and would blur the same two states X1 keeps apart.
- Descent is governed by open-ness alone: when a node is open the walk iterates `children`
  (an empty array is a no-op). `hasChildren` governs only the stamped flag, so an explicit
  `hasChildren: true` on an unloaded lazy row renders a toggle without claiming children
  exist.
- **D2 — a group row's `hasChildren` changes source**: `node.items.length > 0` (all leaves
  under the cluster) becomes `node.children.length > 0` (child nodes, derived by the walk).
  Equivalent on every shape reachable today. Called out so a reviewer does not read it as a
  silent change.
- **C4 — a childless data row's `isExpanded` flips from `false` to `undefined`.** Today
  `buildTreeStage` stamps `isExpanded: expanded.has(row.id)` on every data row, childless
  ones included. Additive, but a consumer testing `row.isExpanded !== undefined` flips.
- **X4 — `sourceIndex` is unchanged**: stamped in `core.ts` from the same `indexById`
  lookup, `undefined` for a synthesized row. Nested children still get `data` but no
  `sourceIndex`; that is #101's G6, unchanged by this migration.
- **X2 / X3 / X6 — unchanged.** Duplicate row ids in different subtrees still open together
  (ADR-0020 D5's id-uniqueness check owns that). Stale ids left in `expanded` are never
  matched; `onRowsRemoved` still prunes them. `buildGroupRenderRows`' "group stage must run
  first" throw survives — grouping still runs first, still on a flat seed whose every node
  has `data !== null`.
- **X5 — allocation roughly doubles**: one `RenderNode` per row plus the flat output.
  Accepted. Prior-art discovery found no reported tree-vs-flat IR cost below ~10k rows, and
  every measured regression was breadth or per-node array ops, never recursion depth.
- **C5 — a cyclic `children` array overflows the stack** today and still will. Explicitly
  not in scope: not a regression, not a fix. Note it on #101, which owns the data contract
  that could admit a cycle.

### Modules changed

| Module                                                        | Change                                                                                                                                                   |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/render-stages.ts`                                     | Owns `RenderNode`, `RenderNodeTransform`, `RENDER_ORDER`, `RenderStages`, `runRenderStages`, `mapNodes`. Loses the prune and its four support constructs |
| `engine/flatten.ts` (new)                                     | `flattenVisible` — the whole visibility rule, and the only producer of `depth`/`parentId`                                                                |
| `engine/rows.ts`                                              | The seed becomes a node seed (no `depth`)                                                                                                                |
| `engine/core.ts`                                              | `renderRows` runs stages over nodes, then flattens, then stamps `index`/`sourceIndex`/`cells` as today                                                   |
| `engine/compose-table.ts`, `api/features/compose-features.ts` | Both folds iterate `RENDER_ORDER` instead of `CLAIMABLE_RENDER_STAGES`                                                                                   |
| `engine/grouping/render.ts`                                   | Emits nested header nodes instead of a flat header-then-members sequence; stops stamping `depth`, `parentId`, `hasChildren`                              |
| `api/features/with-expansion.ts`                              | The `'tree'` stage nests children via `mapNodes` and **stops reading `expandedRows` entirely**; keeps stamping `hasChildren` from `isExpandable`         |
| `api/types.ts`                                                | `RenderRow` unchanged in shape; the `isExpanded` and `hasChildren` field comments rewritten to say uniform and derived                                   |

### Docs and ADRs

- **G1 — ship a new ADR**, superseding **ADR-0017 §Decision D2 only**, using this repo's
  `supersedes:` front-matter plus inline `*(Superseded <date> by …)*` convention. ADR-0017
  D1 (`parentId` exists), D3 (contributed read-only signal) and D4 (accumulating slot) all
  stand — though D1's `parentId` changes from _stamped by each stage_ to _derived by the
  walk_.
- **G2 —** the new ADR also amends **ADR-0011**: the render-stage signature changes from
  `RenderRowTransform` to `RenderNodeTransform`, so "chained render stages" now chains node
  transforms, and D2's `RENDER_ORDER` literal changes.
- **G3 / E3 / B2 — ADR-0020 is edited in place**, not superseded: it is still `proposed` and
  nothing depends on it. Three edits — drop **D3** (`preservesEmissionOrder`), drop the
  emission-order half of **D5**, and remove `'paginate'` and `'prune'` from **D2**'s anchor
  set. D2 justified keeping `'paginate'` as "the only way for a future stage to say _before
  the window is cut_"; with the name gone there is **no** post-flatten anchor at all. Either
  add one deliberately or state that there is none — do not inherit a reserved name nobody
  designed.
- **D3 — the migration is additively non-neutral.** Group rows gain a field that was
  `undefined` before, so "behaviour-neutral, every grouping/expansion spec passes unchanged"
  is no longer the whole gate. The collapsible grouping story host and its MDX are updated in
  the same slice.
- **F1 — #105 lands before #101.** The tree IR goes in against today's `withExpansion()`;
  #101 then _moves_ an already-nesting stage into `withTree()` rather than rewriting it.
- **F2 —** group collapse delegates to `withExpansion()`, not `withTree()` (ADR-0012 scope
  item 5). Both still contribute `expandedRows`, so `core.ts`'s union is unchanged by the
  split and #105 needs no allowance for it.
- **G5 —** #101's body links ADR-0012 at an `acme` URL, not at this repo. Not #105's to
  settle; re-point it when #101 is grilled.

## Testing Decisions

A good test here asserts what a stage or the walk **produces**, never how it walks. No test
may assert a recursion order, a call count, or an intermediate array identity. Ownership is
the second rule: a spec asserts its own domain only — if breaking an assertion would require
changing a _different_ module, the assertion is in the wrong file.

**Seams — four existing, one new.**

| Seam                                  | Owns                                                                                                                                                                                          | Change                                                                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/flatten.spec.ts`              | **new** — the entire visibility rule: descent, `depth`, `parentId`, `hasChildren` resolution, `isExpanded` stamping, the zero-contributor vs. empty-set distinction                           | New file. Inherits the prune behaviour cases from `render-stages.spec.ts`                                                                                   |
| `engine/render-stages.spec.ts`        | Stage fold order, unclaimed-stage pass-through, `mapNodes` reach                                                                                                                              | Rewritten: prune cases move out, and the "documents the emit-order contract" case is **deleted, not ported** — it documented a hazard that no longer exists |
| `engine/grouping/render.spec.ts`      | The node tree grouping builds: one header node per admitted cluster, members nested, non-admitted clusters inlined at the parent level, aggregates, labels, the throwing-`aggregateFn` policy | Assertions on `depth` and `parentId` move to `flatten.spec.ts` — those are the walk's facts, not grouping's                                                 |
| `api/features/with-expansion.spec.ts` | End-to-end through `table.renderRows()`: what is visible after a toggle, at what depth, with what `parentId`                                                                                  | Mostly unchanged — it already asserts at the highest seam. Adds the `hasChildren` lazy-override case and the C4 `isExpanded: undefined` flip                |
| `engine/core.spec.ts`                 | The union of contributed `expandedRows`, `sourceIndex`, `cells`                                                                                                                               | Unchanged                                                                                                                                                   |

**Prior art to follow.** `render-stages.spec.ts`'s existing fake-stage helpers (a
trace-pushing transform, a minimal row literal) carry over to node transforms directly.
`grouping/render.spec.ts` already builds its input through a local helper rather than a live
store — keep that; it is why the file stays a unit seam and not an integration one.
`with-expansion.spec.ts`'s store-level `createTable(...)` + `renderRows()` pattern is the
model for anything needing two features composed.

**Explicitly not tested.** `mapNodes` gets no separate spec file — it is proven through the
stages that call it and through `render-stages.spec.ts`'s reach case. Recursion depth limits
(**C5**) are not tested; a cyclic `children` array is out of scope.

**The gate.** Every grouping and expansion spec passes, with exactly the diffs D2, D3 and C4
name. `nx run shared-table:typecheck` clean — and clean on a **second, source-clean run**,
since `ngc` stops at the first `.ts` error and never reaches the templates.

## Out of Scope

- **ADR-0017 D1, D3, D4.** The decoupling itself — `parentId` exists, collapse state stays
  in the feature behind a read-only contributed signal, the `expandedRows` slot accumulates
  — is settled and not revisited. Only D2 (the terminal prune stage) is superseded.
- **Pagination.** `'paginate'` is dropped as an unclaimed reserved name. Building
  `withPagination()`, and deciding whether a post-flatten phase exists, is separate work.
- **#102 / ADR-0020 itself.** This spec records the three edits that ADR owes; opening stage
  registration to third parties remains #102's.
- **#101 / ADR-0012.** The `withExpansion()` / `withTree()` split runs _after_ this. This
  spec neither performs nor blocks it.
- **Cycle guarding.** A cyclic `children` array still overflows the stack. Unchanged
  behaviour, noted on #101.
- **Duplicate row ids across subtrees.** Still open together. ADR-0020 D5's id-uniqueness
  check owns it.
- **Public API surface.** No export is added to or removed from `index.ts`. `RenderNode` and
  `RenderNodeTransform` are internal.
- **Detail panels.** Never were render rows; consumer-gated through `everExpanded`. They
  never entered the prune and do not enter the flatten.

## Further Notes

- The one genuinely new question the prototype left open — _does any future stage need to run
  between synthesis and flatten, on already-flat rows?_ — is answered by **C1**: such a stage
  sees the tree and uses `mapNodes`. With `'paginate'` dropped (**B1**) no stage wants a flat
  view today, and the first one that does reopens the post-flatten-phase question deliberately.
- Reading `1-decisions.md` alongside this spec is worth it for **E1/E2**, which record _why_
  the alternative was picked: #102 is a real destination, and a structural guarantee beats a
  declared boolean at a third-party boundary.
- The biggest reviewer trap is **D1a**. Uniform `isExpanded` stamping is the headline consumer
  win, and it is tempting to stamp it whenever a node has children. Doing that makes a
  grouping-only table report every header as expanded, inventing state a table with no
  expansion feature does not have.
