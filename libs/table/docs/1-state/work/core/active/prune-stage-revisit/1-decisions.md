# Decisions — prune-stage revisit (#105)

Grilled 2026-09-20. Revisits [ADR-0017](../../../../../adr/0017-engine-owned-descendant-prune.md)
**D2 only** — the decoupling (D1, D3, D4) is settled and not in scope.

## Node ranking (decompose-by-dependency-graph)

- **Core:** A — which alternative (alt-1 terminal finalize / alt-2 tree IR / keep as shipped).
- **Independent:** H — ticket + workspace hygiene.
- **Dependent on A:** B `'paginate'` ownership · C stage IR shape · D group-row `isExpanded` ·
  E ADR-0020 (#102) collision · F ADR-0012 (#101) sequencing · G ADR-0017 amend vs. supersede.

## Decisions

- **2026-09-20 · H1** — Issue [#105](https://github.com/DvirMon/ng-table/issues/105) opened for
  this revisit. The workspace's previous `ticketRef` (`135`) resolved to nothing and its
  `ticketUrl` pointed at #101, a different epic; both corrected.
- **2026-09-20 · H2** — `state.json` migrated to `schemaVersion: 1`. The removed `checklist` key
  dropped; `runId`, `domainPath`, `createdAt`, `updatedAt` added; `decisionsPath` set to this
  file. `workspaceRoot` keeps this repo's own `docs/1-state/work/<capability>/active/<slug>`
  layout rather than the schema's generic `<domainPath>/docs/work/<slug>`.
- **2026-09-20 · E1** — Open registration for third-party render stages
  ([ADR-0020](../../../../../adr/0020-open-stage-registration-for-third-party-features.md), #102)
  is a **real destination**, not speculative. This reverses the node ranking: E is _upstream_ of
  A, not downstream. The emission-order invariant must hold against stages the library did not
  author, so "how is it held" is the question that picks the alternative.
- **2026-09-20 · E2** — `preservesEmissionOrder` (ADR-0020 D3) is a declared boolean an author can
  get wrong: a stage that reorders and declares `true` breaks the prune silently — today's bug
  with added ceremony. A structural guarantee beats a declared one at this boundary.
- **2026-09-20 · A1** — **Settled: the tree-shaped IR**
  (`alt-tree-shaped-stages.md`). Render stages exchange nested
  `RenderNode`s; one engine-owned `flattenVisible` walk replaces
  `pruneUnexpandedDescendants` and derives `depth` / `parentId` /
  `hasChildren` from position. `alt-1-terminal-finalize.md` and
  "keep ADR-0017 as shipped" are both rejected: they relocate the
  emission-order rule instead of removing it.
  Not re-litigated — this was the premise of the workspace, not an
  open fork.
- **2026-09-20 · E3** — Consequence for #102: ADR-0020 **D3**
  (`preservesEmissionOrder`) and the emission-order half of **D5**
  should be _dropped, not built_. A nested child cannot be emitted
  above its own parent, so there is no order for a third-party stage
  to preserve and no flag for its author to get wrong. Record this on
  #102 before it moves to `accepted`.
- **2026-09-20 · B1** — **Drop `'paginate'`.** It has no claimant today
  (only fakes in `render-stages.spec.ts`), so `RENDER_ORDER` becomes
  `['group', 'tree']` — claimable node stages only. The post-flatten
  phase question is deferred, not answered: it returns when pagination
  is actually built, and it will no longer be free then.
- **2026-09-20 · B2** — Consequence for #102: ADR-0020 **D2**'s anchor
  set loses `'paginate'` and `'prune'` both. D2 justified keeping
  `'paginate'` as "the only way for a future stage to say _before the
  window is cut_" — with the name gone there is no post-flatten anchor
  at all, so a third-party stage can only run on nested nodes. Update
  D2 before ADR-0020 moves to `accepted`; if a post-flatten anchor is
  wanted, that is the moment to add it back deliberately rather than
  inheriting a reserved name nobody designed.
- **2026-09-20 · D1** — **`flattenVisible` stamps `isExpanded`
  uniformly** on every node with children (`undefined` for a leaf),
  group rows included. Templates read `row.isExpanded` everywhere; the
  `kind === 'group'` → `table.expandedRows().has(row.id)` split goes
  away. This **reverses the 2026-09-16 rejection**, whose stated cost
  was a new "collect every feature's open ids" field on the generic
  `TableFeatureSpec` that only 2 of 6+ features would fill. ADR-0017
  D3 shipped that field for its own reasons and `core.ts` already
  unions it, so the rejection's premise no longer holds.
- **2026-09-20 · D2** — `hasChildren` for a group row changes source:
  `node.items.length > 0` (all leaves under the cluster, stamped by
  `emitGroupRows`) becomes `node.children.length > 0` (child nodes,
  derived by the walk). Equivalent on every shape reachable today; call
  it out in the spec so a reviewer does not read it as a silent change.
- **2026-09-20 · D3** — D1 makes the migration **additively**
  non-neutral: group rows gain a field that was `undefined` before.
  Nothing breaks, but "behaviour-neutral, spec-132 story 21 passes
  unchanged" is no longer the whole gate. Story templates that read
  `table.expandedRows().has(row.id)` are updated in the same slice.
- **2026-09-20 · C1** — **The engine owns the recursion.** It ships a
  `mapNodes(nodes, fn)` walk helper; a render stage supplies a
  per-node function and never hand-writes a tree walk. Closes a gap
  `alt-tree-shaped-stages.md` missed: `'tree'` runs _after_ `'group'`,
  so under a nested IR it must descend through group nodes to reach
  data leaves — a walk it does not have today, and one every
  third-party stage author (#102) would otherwise inherit.
- **2026-09-20 · C2** — This also makes "a stage forgot to recurse, so
  grouped rows were silently skipped" unrepresentable, rather than a
  new silent bug traded for the old one. Same reasoning as A1: prefer
  the shape where the mistake cannot be made over the shape where it
  is merely documented.
- **2026-09-20 · C3** — **`RenderNode` carries an explicit
  `hasChildren?: boolean`**, set by the producing stage; the walk falls
  back to `children.length > 0` only when it is unset. Derived from
  `children.length` alone it would break lazy trees: `withExpansion()`'s
  `isExpandable` exists precisely so a row renders its toggle before
  its children load, and `childrenAccessor` legitimately returns
  `[]` until then — so the toggle would never render, and the row could
  never be opened to load them.
  Not asked as a fork: reviewing #101 killed the alternative. Handing
  the walk an `isExpandable` predicate hard-codes a config shape #101
  lists as **undecided** ("`childrenAccessor` being the only accepted
  shape is itself a narrowing we should not bake into the feature's
  identity" — AG Grid uses flat rows + `getDataPath()`). An opaque
  boolean on the node survives either outcome.
- **2026-09-20 · C4** — Today `buildTreeStage` stamps
  `isExpanded: expanded.has(row.id)` on **every** data row, childless
  ones included, so a leaf currently reads `false`. Under the walk a
  leaf reads `undefined`. Additive, but flag it — a consumer testing
  `row.isExpanded !== undefined` flips.
- **2026-09-20 · C5** — A cyclic `children` array overflows the stack
  today (`expandRow` recurses unguarded) and still will. Explicitly
  **not** in scope for #105: not a regression, not a fix. Note it on
  #101, which owns the data contract that could admit a cycle.
- **2026-09-20 · F1** — **#105 lands before #101.** The tree IR goes in
  against today's `withExpansion()`; #101 then _moves_ an
  already-nesting stage into `withTree()` rather than rewriting it.
  This makes #101's own open question cheaper: under a nested IR,
  `childrenAccessor` vs. `getDataPath()` is two ways to build the same
  node tree and stops touching the engine at all.
- **2026-09-20 · F2** — From ADR-0012/#101 scope item 5, group collapse
  delegates to `withExpansion()` (the panel feature), not `withTree()`.
  Both still contribute `expandedRows`, so `core.ts`'s union is
  unchanged by the split and #105 needs no allowance for it.

## Failure modes swept

Derived for what this actually is — a recursive walk feeding a
signal-based render pipeline with a plugin contract, not a generic
refactor.

- **2026-09-20 · X1** — Zero contributors stays distinct from an empty
  set. `expanded === undefined` (no feature claimed the slot) means
  everything open; a defined-but-empty `Set` means a feature claimed it
  and nothing is open, so every nested row hides. `render-stages.ts`
  guards this deliberately today and the walk must keep the two apart
  — never collapse them into a `size === 0` check.
- **2026-09-20 · X2** — Duplicate row ids in different subtrees open
  together, since the walk tests `expanded.has(node.id)`. True today
  too. Out of scope for #105; ADR-0020 D5's id-uniqueness check is
  where it belongs.
- **2026-09-20 · X3** — Stale ids left in `expanded` after a row leaves
  `data()` are simply never matched by the walk. `onRowsRemoved`
  (ADR-0006) still prunes them. No change.
- **2026-09-20 · X4** — Nested children get `data` but no
  `sourceIndex`, so edits silently no-op. That is #101's G6, unchanged
  by this migration — the walk stamps `sourceIndex` from the same
  `indexById` lookup `core.ts` uses today.
- **2026-09-20 · X5** — Allocation roughly doubles: one `RenderNode`
  per row plus the flat output. Accepted. `tree-ir-pitfalls.md` found
  no reported tree-vs-flat IR cost below ~10k rows (numbers start at
  18k / 50k / 200k), and every measured regression it found was
  breadth or per-node array ops, never recursion depth.
- **2026-09-20 · X6** — `buildGroupRenderRows`' "group stage must run
  first" throw survives: grouping still runs first, still on a flat
  seed whose every node has `data !== null`.

## Docs and mechanics

- **2026-09-20 · G1** — Ship a **new ADR**, not an edit to ADR-0017.
  This repo's convention is a `supersedes:` front-matter field naming
  the exact superseded section (ADR-0001, ADR-0003, ADR-0004,
  ADR-0005 all do this), plus inline `*(Superseded <date> by …)*`
  markers on the replaced text (ADR-0002). The new ADR supersedes
  **ADR-0017 §Decision D2 only** — D1 (`parentId` exists), D3
  (contributed read-only signal) and D4 (accumulating slot) all stand,
  though D1's `parentId` changes from _stamped by each stage_ to
  _derived by the walk_.
- **2026-09-20 · G2** — It also amends **ADR-0011**: the render-stage
  signature changes from `RenderRowTransform` to `RenderNodeTransform`,
  so "chained render stages" now chains node transforms.
- **2026-09-20 · G3** — **ADR-0020 is edited in place**, not
  superseded — it is still `proposed` and nothing depends on it. Three
  edits: drop D3 (`preservesEmissionOrder`), drop the emission-order
  half of D5, and remove `'paginate'` and `'prune'` from D2's anchor
  set per B1/B2.
- **2026-09-20 · G4** — Concrete deletions once `'prune'` leaves
  `RENDER_ORDER`: `CLAIMABLE_RENDER_STAGES` becomes identical to
  `RENDER_ORDER`, so both fold sites (`engine/compose-table.ts:104`,
  `api/features/compose-features.ts:51`) iterate `RENDER_ORDER`
  directly and the derived constant goes. Also gone:
  `Exclude<RenderStage, 'prune'>` in `RenderStages`, the
  `stage === 'prune'` branch in `runRenderStages`, the `expanded`
  parameter on `runRenderStages`, and `pruneUnexpandedDescendants`
  itself.
- **2026-09-20 · G5** — #101's body links ADR-0012 at a
  `DvirMon/acme/blob/feat/table/libs/shared/table/...` URL, not at this
  repo. ADR-0020's own "Not yet verified" section flags the same
  ambiguity ("which of the two current repo copies is canonical …
  nothing states which one future work edits"). Not #105's to settle,
  but re-point the link when #101 is grilled.

## Complexity

- **2026-09-20 · Z1** — `isComplex: true`. New exported-internal types
  (`RenderNode`, `RenderNodeTransform`), two new engine functions
  (`mapNodes`, `flattenVisible`), a file-layout question under
  `engine/` (ADR-0004's grouping), and a design that has to be grounded
  against `core.ts`, `render-stages.ts`, `grouping/render.ts` and
  `with-expansion.ts` before anyone writes code. `/to-spec` writes
  `3-architecture.md`.
