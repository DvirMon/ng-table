# ADR-0017 — `RenderRow.parentId` + an engine-owned terminal prune replace feature-side descendant hiding

**Status:** accepted — decided 2026-09-16, implemented in `#132`.
**Related:** [ADR-0011](0011-chained-render-stages.md) (stage allocation — partially superseded:
not every render stage is feature-claimable), [ADR-0012](0012-split-expansion-into-panel-and-tree.md)
(proposed — forces the accumulating slot, and is made cheaper by it), [ADR-0006](0006-row-id-state-reconciliation.md)
(the feature keeps its `onRowsRemoved` obligation). Closes
[D11](../1-state/work/with-grouping/2-decisions.md). Research:
[`spec-132.md`](../1-state/work/grouping-expansion-coupling/spec-132.md),
[`prior-art.md`](../1-state/work/grouping-expansion-coupling/prior-art.md).

`withGrouping()` read `withExpansion()`'s state to skip a collapsed group's members, because a
render row knew its `depth` but not its parent — so the only code that *could* hide was the code
already holding the parent/child relation at emit time. `RenderRow` now carries `parentId?: RowId`,
stamped on creation by whichever stage synthesizes the row, and hiding moves into a terminal,
engine-owned `'prune'` stage: `RENDER_ORDER` becomes `['group', 'tree', 'prune', 'paginate']`,
after every claimable stage and before `engine/core.ts` assigns `index`/`sourceIndex`, so a
reported position matches what renders. `'prune'` is unclaimable at the type level —
`RenderStages<TRow>` derives from `RENDER_ORDER` keyed on `Exclude<RenderStage, 'prune'>`, so a
feature declaring it fails at its own `createTableFeature` call.

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
breaks the prune silently.

## Alternatives considered

- **Prune by `depth` alone, no `parentId`.** Makes emitted-row contiguity load-bearing; breaks on any post-group reorder. CDK, the one library accepting a depth-only input, rebuilds a private parent map anyway.
- **Contribute an inverted *collapsed* set.** Needs the full universe of expandable ids before the pass that produces them; no feature has it.
- **Keep `'prune'` single-claim.** Throws on ADR-0012's own required case.
- **Runtime reject of a `prune` claim in `compose-table.ts`.** The type-level exclusion reports at the offending call site instead, and needs no registry code.

## Consequences

- Nothing checks that a new synthesizing stage stamps `parentId`; forgetting it yields silently unprunable rows.
- The accumulating-slot exception needs a comment on the field saying why, or a future reader "fixes" it into a `SlotRegistry` claim and reintroduces the ADR-0012 throw.
- That justification rests on ADR-0012, still **proposed** — if the split is abandoned, single-claim is correct again and this should be revisited.
- This slice is behavior-neutral: grouping keeps its own prune, so hiding runs twice (idempotent) until `#133` deletes it and the cross-feature read.
