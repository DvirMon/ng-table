# ADR-0023 — Render stages exchange a tree-shaped IR; `flattenVisible` replaces the `'prune'` stage

**Status:** accepted — decided 2026-09-20, implemented in `#107`.
**Supersedes:** [ADR-0017](0017-engine-owned-descendant-prune.md) **§Decision D2 only**. D1
(`RenderRow.parentId` exists), D3 (a feature contributes a read-only `expandedRows` signal) and
D4 (`expandedRows` is the engine's one accumulating slot) all stand.
**Amends:** [ADR-0011](0011-chained-render-stages.md) decision 2 — the render-stage signature
becomes `RenderNodeTransform`, so "chained render stages" now chains node transforms, and
`RENDER_ORDER` drops to `['group', 'tree']`.
**Related:** [ADR-0020](0020-open-stage-registration-for-third-party-features.md) (proposed,
edited in place for this change — drops `preservesEmissionOrder` and the `'paginate'`/`'prune'`
anchors), [ADR-0006](0006-row-id-state-reconciliation.md) (`onRowsRemoved`, unaffected),
[ADR-0012](0012-split-expansion-into-panel-and-tree.md) (proposed — this change lands first,
on purpose; see Consequences).
**Source:** [`docs/1-state/work/core/active/prune-stage-revisit/`](../1-state/work/core/active/prune-stage-revisit/)
— `1-decisions.md` (D1–D3, C1–C5, X1–X6, G1–G5), `3-architecture.md` (exact types and
call sites), `alt-1-terminal-finalize.md` and `alt-tree-shaped-stages.md` (the two rejected
alternatives).

## Context

ADR-0017 moved descendant-hiding out of feature code and into an engine-owned, terminal
`'prune'` render stage: `RENDER_ORDER` became `['group', 'tree', 'prune', 'paginate']`, with
`'prune'` unclaimable at the type level (`Exclude<RenderStage, 'prune'>`). It paid for that with
four constructs whose only job was to say "this entry is not a feature" —
`CLAIMABLE_RENDER_STAGES` (derived from `RENDER_ORDER` minus `'prune'`, for the two fold sites
that must skip it), the `Exclude<…>` itself, a `stage === 'prune'` branch inside
`runRenderStages`'s own reduce, and `pruneUnexpandedDescendants` — plus one unchecked, load-bearing
invariant: `pruneUnexpandedDescendants` is only correct because every synthesizing stage emits a
parent immediately before its descendants, a fact nothing enforces.

[#102](https://github.com/DvirMon/ng-table/issues/102) (ADR-0020) made this a live cost rather
than a historical one: open, third-party stage registration needs that emission-order invariant
to be *checkable*, not merely documented, which is what ADR-0020 D3's declared
`preservesEmissionOrder: boolean` existed to buy. A declared boolean a stage author can get
wrong is today's silent bug with more ceremony, not a fix.

## Decision

**Render stages exchange a nested node tree instead of a flat row list, and hiding stops being
an operation.** A collapsed node is simply not descended into.

```ts
// engine/render-stages.ts
export interface RenderNode<TRow> {
  readonly id: RowId;
  readonly kind: RowKind;
  readonly data: TRow | null;
  readonly groupKey?: { columnId: string; value: unknown; label: string };
  readonly aggregates?: Record<string, unknown>;
  readonly hasChildren?: boolean;      // overrides children.length > 0 — the lazy-row escape hatch
  readonly children: readonly RenderNode<TRow>[];
}

export const RENDER_ORDER = ['group', 'tree'] as const;   // claimable stages only
export type RenderNodeTransform<TRow> =
  (nodes: readonly RenderNode<TRow>[]) => readonly RenderNode<TRow>[];
export type RenderStages<TRow> = Partial<Record<RenderStage, RenderNodeTransform<TRow>>>;

export function mapNodes<TRow>(
  nodes: readonly RenderNode<TRow>[],
  fn: (node: RenderNode<TRow>) => RenderNode<TRow>
): readonly RenderNode<TRow>[]; // post-order — fn sees already-mapped children
```

```ts
// engine/flatten.ts — the only reader of expansion state, the only producer of depth/parentId
export function flattenVisible<TRow>(
  nodes: readonly RenderNode<TRow>[],
  expanded: ReadonlySet<RowId> | undefined
): FlatRenderRow<TRow>[];
```

`RenderNode` and `RenderNodeTransform` are engine-internal, never exported from `index.ts`. The
public contract does not move: `createTable()` still takes flat `data`, `renderRows()` still
returns flat `RenderRow<TRow>[]` with the same fields.

Every field a synthesizing stage used to stamp by hand becomes something `flattenVisible` derives
from tree position instead:

| Was | Becomes |
|---|---|
| `parentId` stamped by each stage; forgetting it yields a silently unprunable row | derived from position; cannot be forgotten |
| `depth` stamped by each stage; can disagree with `parentId` | derived; cannot disagree |
| "parent emitted immediately before its descendants" — load-bearing, unchecked | structural — a child is *inside* its parent, not a neighbor after it |
| `hasChildren` a stage must remember to set | derived (`children.length > 0`), with an explicit `RenderNode.hasChildren` override for a lazy row whose children have not loaded yet |

All four `'prune'`-support constructs — the `'prune'` entry itself, `Exclude<RenderStage,
'prune'>`, `CLAIMABLE_RENDER_STAGES`, and the `stage === 'prune'` reduce branch — are **deleted**,
not relocated. Both fold sites (`engine/compose-table.ts`, `api/features/compose-features.ts`)
iterate `RENDER_ORDER` directly, since every entry is now claimable.

`mapNodes` is the engine-owned recursion a stage supplies a per-node function to, rather than
hand-writing its own walk — closing a gap neither rejected alternative fixes: `'tree'` runs after
`'group'`, so under a nested IR it must descend through group headers to reach data leaves, which
today's flat version cannot do. This is also what makes "a stage forgot to recurse, so nested
rows were silently skipped" unrepresentable rather than a new silent bug traded for the old one.

**`isExpanded` is stamped only when a feature contributed the `expanded` slot *and* the node has
children** — never merely because a node has children. Dropping the first condition would make a
grouping-only table (no `withExpansion()` composed) report every header as expanded, inventing
state a table without an expansion feature does not have. `expanded === undefined` (zero
contributors) stays distinct from a defined-but-empty `Set` (a contributor with nothing open) —
never collapsed into a `size === 0` check. Descent itself is gated on `isOpen` alone, never
`isOpen && hasChildren`: an explicit `hasChildren: true` on a lazy row with `children: []` must
not suppress a no-op descent, and must not gate a later-loaded array either.

## Two additive behaviour diffs, both deliberate

- **D2 — a group row's `hasChildren` changes source.** `node.items.length > 0` (every leaf under
  the cluster, stamped by the old `emitGroupRows`) becomes `node.children.length > 0` (child
  nodes, derived by the walk). Equivalent on every shape reachable today.
- **C4 — a childless data row's `isExpanded` flips `false` → `undefined`.** The old
  `buildTreeStage` stamped `isExpanded: expanded.has(row.id)` on every data row, childless ones
  included, so a leaf read `false`. The walk now leaves a leaf's `isExpanded` `undefined`.

Nothing else changes. A consumer reading `table.expandedRows().has(row.id)` on a group header to
work around the header never having `isExpanded` (`grouping-collapsible-story-host`) can now read
`row.isExpanded` directly — the same expression a detail row already used.

## Alternatives considered

- **Alt 1 — fold the prune into `core.ts`'s terminal pass** (`alt-1-terminal-finalize.md`).
  Deletes the same four `'prune'`-support constructs by moving `pruneUnexpandedDescendants` beside
  the existing `index`/`sourceIndex` stamping pass instead of running it as a named stage. Smaller
  diff, behavior-neutral. Rejected: it *relocates* the emission-order invariant rather than
  removing it — the prune is still one unchecked forward pass over a `hidden` accumulator, still
  correct only because a parent is emitted before its children. It also forces pagination to join
  the same terminal step the moment it is built, pre-deciding a #102 question this ADR leaves
  open. Under ADR-0020's open, third-party stage registration, an invariant that can only be
  *documented* is exactly the gap #102 exists to close — a stranger's stage would inherit the same
  silent failure mode Alt 1 does nothing to prevent.
- **Keep ADR-0017 as shipped**, and answer #102's `preservesEmissionOrder` need by making the
  boolean checkable at construction time. Rejected for the same reason: a declared invariant a
  stage author can get wrong is today's bug with more ceremony. The tree IR makes the invariant
  structural — a nested child cannot be emitted above its own parent — so there is nothing left to
  declare, check, or get wrong.

Both rejected alternatives keep `RenderRow` flat between stages; this decision is the one that
changes the intermediate representation itself, which is what removes the invariant instead of
relocating or policing it.

## Consequences

**Gained**
- The four `'prune'`-support constructs are gone, not renamed or moved.
- The parent-before-child emission invariant becomes structural rather than an unchecked,
  load-bearing assumption — closing ADR-0020's `preservesEmissionOrder` gap for free rather than
  building a construction-time check for it (see ADR-0020's edit, same date).
- A render stage can no longer forget to recurse into nested output from an earlier stage
  (`mapNodes` owns the walk), and can no longer forget to stamp `parentId` (nothing stamps it).
- [#105](https://github.com/DvirMon/ng-table/issues/105) lands before
  [#101](https://github.com/DvirMon/ng-table/issues/101)/ADR-0012 on purpose: the tree IR goes in
  against today's `withExpansion()`, so #101 later *moves* an already-nesting stage into
  `withTree()` instead of rewriting it, and #101's own open question (`childrenAccessor` vs. a
  `getDataPath()`-style flat contract) becomes "two ways to build the same node tree" rather than
  two different engine shapes.

**Cost**
- Allocation roughly doubles: one `RenderNode` per row, plus the flat `FlatRenderRow` output
  `flattenVisible` produces. Accepted — prior-art discovery
  (`tree-ir-pitfalls.md`) found no reported tree-vs-flat IR cost below roughly 10k rows (cited
  regressions start at 18k, 50k and 200k rows), and every measured regression was breadth or
  per-node array operations, never recursion depth.
- A cyclic `children` array still overflows the stack (`expandRow` recursed unguarded before this
  change and still does under `mapNodes`/`flattenVisible`). Not a regression, not a fix — the data
  contract that could admit a cycle belongs to #101.
- Two additive behaviour diffs reach consumers (D2, C4 above) — `spec-132`'s "behavior-neutral,
  story 21 passes unchanged" gate is no longer the whole story for this slice; both diffs are
  named so a reviewer does not read either as accidental.
- `RenderStages<TRow>` no longer needs `Exclude<RenderStage, 'prune'>` — every `RENDER_ORDER`
  entry is claimable, which also means a *third*-party render stage (ADR-0020) has one fewer
  reserved name to avoid colliding with.
- ADR-0020 D2's anchor set loses `'paginate'` and `'prune'` both, leaving no post-flatten anchor
  at all — whether to reintroduce one deliberately, once pagination is actually built, is #102's
  call (flagged there, not answered here).
