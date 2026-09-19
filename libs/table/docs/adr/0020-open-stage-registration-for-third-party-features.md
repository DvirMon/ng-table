# ADR-0020 — Anchor-based stage declaration for third-party pipeline/render stages

**Status:** proposed
**Date:** 2026-09-18
**Related:** [ADR-0011](0011-chained-render-stages.md) (`RENDER_ORDER`/`PIPELINE_ORDER`
mechanism this ADR opens up), [ADR-0017](0017-engine-owned-descendant-prune.md)
(`'prune'` reclassified here as a boundary), [ADR-0007](0007-feature-member-claims.md)
(construction-time collision precedent), [ADR-0012](0012-split-expansion-into-panel-and-tree.md)
(`withTree()`/`withExpansion()` split — see the flagged item under `'expand'` below),
[ADR-0021](0021-column-concerns-and-data-concerns-are-separate-surfaces.md) (a third-party feature
declaring a schema names **row fields**, not columns — the column path belongs to
`TableConfig.columnsSchema` alone)

**Source:** discovery findings —
[`discovery-open-stage-registration.md`](../1-state/work/feature-authoring/discovery-open-stage-registration.md)
(three passes, 2026-09-17/18). This ADR restates the decision only; the doc holds the
full evidence, comparison tables, and worked counterexamples.

## Context

`PIPELINE_ORDER` and `RENDER_ORDER` (ADR-0011) are closed `const` arrays: the stage-key
union derives from them, so no third party can register a new pipeline or render stage
today — an unlisted key in a feature's spec is silently dropped, never reported.

No surveyed table library solves this: TanStack and AG Grid both hard-code their stage
sequence and tell you to fork. The closest prior art is plugin-ordering systems (Rollup,
Vite, tapable, Babel) and MUI X DataGrid's pipe-processor registry — see Alternatives.

## Decision

1. **A feature declares stage placement by anchor, not by position.**

   ```ts
   interface StageDeclaration<TRow> {
     readonly name: string;              // claimed via SlotRegistry, throws on collision
     readonly after?: StageAnchor;        // exactly one of after/before, else throw at construction
     readonly before?: StageAnchor;
     readonly run: RowTransform<TRow>;
   }
   ```

   The engine topologically resolves declared stages against a fixed set of built-in
   anchors. An unknown anchor, a cycle, or an ambiguous tie throws at construction,
   naming both parties — the same bargain ADR-0007 and ADR-0012's `claimMember()`
   already strike for member claims.

2. **Anchor set:**
   - Pipeline: `'filter'`, `'sort'`.
   - Render: `'group'`, `'tree'`, `'paginate'`, with `'prune'` as a **boundary**, not
     an anchor — `'prune'` stays engine-owned and terminal (ADR-0017).

   `'expand'` (pipeline) is **removed**, not kept as a reserved anchor. It is unclaimed
   today (`withExpansion()` declares only `renderStages.tree`, no pipeline stage), and
   its intended job — injecting child rows — is already handled structurally by the
   render `'tree'` stage. Keeping it would teach a third-party author the wrong phase
   for exactly the case the two-layer split (pipeline vs. render) exists to route into
   render.

   > **⚑ Open item — flag before accepting.** This conclusion was reasoned against
   > today's `withExpansion()` shape. [Issue #101](https://github.com/DvirMon/ng-table/issues/101)
   > (ADR-0012) splits it into `withExpansion()` (detail panel, no render stage) and a
   > new `withTree()` (owns `childrenAccessor`, `depth`, the `'tree'` render stage).
   > Under that split, pipeline `'expand'` is still unclaimed by either feature, so the
   > removal call does not change — but this was not verified against a panel-shaped
   > second consumer of "expand" semantics, and #101 was not open when the discovery
   > ran. Re-confirm against #101's final shape before this ADR moves to `accepted`.

   `'paginate'` stays as a reserved, unclaimed anchor (unlike `'expand'`) — it remains
   the only way for a future stage (e.g. virtual-scroll window, row pinning) to say
   "before the window is cut."

3. **Render-stage declarations additionally carry `preservesEmissionOrder: boolean`.**
   The engine refuses a `false` declaration positioned before the `'prune'` boundary —
   this is the parent-before-child emission invariant ADR-0017 calls "load-bearing and
   unchecked," now made a checkable, construction-time rule instead of an unstated
   assumption.

4. **The stage-name registry is a TypeScript `interface`, not a derived `const` array
   union**, mirroring MUI X's `GridPipeProcessingLookup`. A third-party package
   augments the interface via declaration merging, so its stage name stays a checked
   literal rather than widening to a bare `string`. Built-in anchor names are
   unaffected — they keep today's closed union.

   > **⚑ Open item.** Whether declaration merging on an exported `interface` survives
   > this repo's build and public-API extraction (`index.ts` barrel, `ngc`, the
   > generated `*.overloads.ts`) was not checked here — MUI proves the pattern works in
   > a plain TS package, nothing was verified against this repo's own tooling.

5. **Three invariants the engine checks at evaluation time** (not construction, since
   they are data-dependent): parent-before-child emission order (one forward pass),
   row-id uniqueness, and real-row id containment (output's non-synthesized ids are a
   subset of input's). Violations degrade + report once per stage per evaluation
   (ADR-0014's policy), never throw at runtime.

   > **⚑ Open item.** The runtime error-policy citation ("throw at construction,
   > degrade at runtime, report in production too") is read from this library's
   > `CLAUDE.md` restatement, not verified against
   > [ADR-0014](0014-runtime-error-policy.md)'s Decision section directly. Confirm
   > before relying on it here.

6. **Two invariants are declarable only, checked positionally at construction, not
   inferred:** `synthesizesRows: boolean` (a `true` stage cannot anchor before
   `'group'`) and a row-count-direction declaration (`'preserves' | 'may-shrink' |
   'may-grow'`) — a `'may-grow'` stage cannot sit after `'paginate'`.

7. **DI-based placement override (`provideTableStages()`) is deferred**, and when
   added, must be an edit function over the already-resolved order
   (`(order) => order`), never a replacement array or the definition site. Placement
   knowledge belongs with the feature author, who knows a stage's ordering
   constraints; a consumer-facing config surface only knows it wants the feature.

## Alternatives considered

- **DI (`provideTableStages()`) as the definition site** — rejected. Fails
  self-containment: `withPinning()` would still need the consumer to also edit an
  order array, which is precisely the wiring a plugin exists to remove. Angular's own
  interceptor docs concede DI-registration ordering is "very hard to predict" and
  steer consumers toward functional/positional ordering instead.
- **Numeric priority / `enforce` bucket (Rollup/Vite/tapable/Babel-style)** — rejected.
  Every surveyed system ties on registration order when priorities collide — the exact
  property ADR-0011's "unordered append list" rejection exists to eliminate. tapable's
  own `_insert` algorithm (read from published source) additionally shows that where a
  system carries *both* a named and a numeric constraint, the named one (`before`)
  overrides the numeric one (`stage`) — supporting anchors over priorities specifically.
- **`stageOrder` config on `TableConfig`, or a full order-array override** — rejected,
  same self-containment failure as DI; also not statically typed against the derived
  stage union.
- **Fixed pre/post slots (Vite's `enforce` bands)** — rejected. Multiple claims within
  one slot fall back to fold/registration order, reintroducing the collision this
  mechanism exists to close.
- **MUI X-style pipe-processor groups (accumulate, `Map`-insertion order, random
  per-instance ids)** — rejected as the ordering model. No deterministic order, no
  collision detection by construction. Its `interface`-based group registry *is*
  adopted (decision 4) — that part is a strictly better answer than a derived union.
- **Leaning on Angular Signal Forms' reducer model** (this library's stated structural
  reference) — does not transfer. Signal Forms has no ordering primitive at all, but
  only because every multi-contributor slot is commutative (`list`/`min`/`max`/`or`/
  `and`). A row-transform chain is non-commutative (filter-then-sort ≠
  sort-then-filter), so no reducer can absorb the ordering question here.

## Consequences

**Gained**
- Third-party features can add a pipeline or render stage without a library release,
  positioned relative to fixed anchors, with construction-time errors naming both
  parties on any conflict.
- `'prune'`'s parent-before-child invariant becomes checkable instead of an unstated
  assumption a stranger's stage can silently break.
- Stage names for third-party stages stay statically checked via interface
  augmentation rather than degrading to `string`.

**Cost**
- The stage-key set is no longer a single closed `const`-derived union for the
  *extension* surface — built-in stages are unaffected, but a third-party name's
  compile-time safety moves from "impossible to declare wrong" to "throws at
  construction if wrong." This is a real trade, not a strict improvement: per
  `architecture.md`'s own standard, a general mechanism no consumer ever extends is
  cost without payoff, and no shipped consumer requests this today (candidate list is
  from `pagination.md`'s gap analysis, not from a request).
- Topological resolution introduces a debuggable-but-nonlocal failure mode: a cycle
  across independently-authored features produces an error not local to any one
  feature.
- Touches both fold sites (`engine/compose-table.ts`, `api/features/compose-features.ts`)
  and the `*.overloads.ts` generators. No line-level migration estimate exists yet.

## Not yet verified before this ADR is accepted

- The two flagged open items above (`'expand'` vs. #101/`withTree()`; interface
  declaration merging through this repo's build).
- Whether removing pipeline `'group'`'s current effect (limited to `table.rows()`
  ordering, per the render layer's independent re-clustering) is confirmed by a test
  run, not just by reading `grouping.ts` — no probe was run.
- Which of the two current repo copies (`acme`, `ng-table`) is canonical before this
  mechanism is implemented anywhere — they agree today but nothing states which one
  future work edits.
