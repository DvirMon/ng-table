# ADR-0017 — `RenderRow.parentId` + an engine-owned terminal prune replace feature-side descendant hiding

**Status:** accepted — decided 2026-09-16, implemented in `#98`.
**Related:** [ADR-0011](0011-chained-render-stages.md) (stage allocation — partially superseded:
not every render stage is feature-claimable), [ADR-0012](0012-split-expansion-into-panel-and-tree.md)
(proposed — forces the accumulating slot, and is made cheaper by it), [ADR-0006](0006-row-id-state-reconciliation.md)
(the feature keeps its `onRowsRemoved` obligation), [ADR-0023](0023-tree-shaped-render-ir.md)
(**supersedes D2 only** — see note below). Closes
[D11](../1-state/work/with-grouping/2-decisions.md). Research:
[`spec-132.md`](../1-state/work/grouping-expansion-coupling/spec-132.md),
[`prior-art.md`](../1-state/work/grouping-expansion-coupling/prior-art.md).

**§Decision D2 superseded 2026-09-20 by [ADR-0023](0023-tree-shaped-render-ir.md).** D2 is the
`'prune'` stage itself — the terminal, engine-owned render stage and its `RENDER_ORDER` /
`Exclude<RenderStage, 'prune'>` mechanism. ADR-0023 deletes it outright rather than relocating
it: a collapsed node is simply not descended into by the flatten walk, so there is no separate
pruning pass left to own. **D1, D3 and D4 stand** — `RenderRow` still carries `parentId?: RowId`,
a feature still contributes collapse state through the same read-only, accumulating
`TableFeatureSpec.expandedRows` slot. Only D1's _mechanism_ changes, noted inline below.

`withGrouping()` read `withExpansion()`'s state to skip a collapsed group's members, because a
render row knew its `depth` but not its parent — so the only code that _could_ hide was the code
already holding the parent/child relation at emit time. `RenderRow` now carries `parentId?: RowId`
**(D1** — _originally_ stamped on creation by whichever stage synthesizes the row; **as of
ADR-0023, derived from position by the flatten walk instead — the field and its meaning are
unchanged, only who computes it)**, and hiding moves into a terminal, engine-owned `'prune'`
stage **(D2, superseded — see note above)**: `RENDER_ORDER` becomes
`['group', 'tree', 'prune', 'paginate']`, after every claimable stage and before
`engine/core.ts` assigns `index`/`sourceIndex`, so a reported position matches what renders.
`'prune'` is unclaimable at the type level — `RenderStages<TRow>` derives from `RENDER_ORDER`
keyed on `Exclude<RenderStage, 'prune'>`, so a feature declaring it fails at its own
`createTableFeature` call.

The engine stores no collapse state. A feature contributes a read-only
`Signal<ReadonlySet<RowId>>` through `TableFeatureSpec.expandedRows` — its own set, uninverted.
A row is hidden iff `parentId` is set and absent from every contributed set, **provided at least
one feature contributed the slot**; zero contributors is a no-op (today's "no expansion feature
⇒ everything expanded"), which is a construction-time fact, not an empty-set-at-runtime one.
`expandedRows` is the engine's only accumulating slot — every other throws on a second claimant —
because ADR-0012 requires `[withExpansion(), withTree()]` to compose. Union needs no precedence:
group ids and row ids are disjoint universes, so a `parentId` matches at most one contributor.

Both emit sites already emit a parent immediately before its descendants, so the prune is one
forward pass over a `hidden` accumulator, `O(n)` rather than an `O(depth)` climb per row. **That
invariant is load-bearing and unchecked** — a stage inserted before `'prune'` that reorders rows
breaks the prune silently. _(Moot as of [ADR-0023](0023-tree-shaped-render-ir.md), 2026-09-20 —
a nested child cannot be emitted above its own parent in a tree-shaped IR, so there is no
emission order left to preserve or break.)_

## Alternatives considered

- **Prune by `depth` alone, no `parentId`.** Makes emitted-row contiguity load-bearing; breaks on any post-group reorder. CDK, the one library accepting a depth-only input, rebuilds a private parent map anyway.
- **Contribute an inverted _collapsed_ set.** Needs the full universe of expandable ids before the pass that produces them; no feature has it.
- **Keep `'prune'` single-claim.** Throws on ADR-0012's own required case.
- **Runtime reject of a `prune` claim in `compose-table.ts`.** The type-level exclusion reports at the offending call site instead, and needs no registry code.

## Consequences

- Nothing checks that a new synthesizing stage stamps `parentId`; forgetting it yields silently unprunable rows. _(Resolved by [ADR-0023](0023-tree-shaped-render-ir.md), 2026-09-20 — `parentId` is derived by the flatten walk from tree position, not stamped by the synthesizing stage, so it cannot be forgotten.)_
- The accumulating-slot exception needs a comment on the field saying why, or a future reader "fixes" it into a `SlotRegistry` claim and reintroduces the ADR-0012 throw.
- That justification rests on ADR-0012, still **proposed** — if the split is abandoned, single-claim is correct again and this should be revisited.
- This slice is behavior-neutral: grouping keeps its own prune, so hiding runs twice (idempotent) until `#99` deletes it and the cross-feature read.
