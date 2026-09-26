# ADR-0020 — Anchor-based stage declaration for third-party pipeline/render stages

**Status:** proposed
**Date:** 2026-09-18
**Related:** [ADR-0011](0011-chained-render-stages.md) (`RENDER_ORDER`/`PIPELINE_ORDER`
mechanism this ADR opens up), [ADR-0023](0023-tree-shaped-render-ir.md) (`'prune'` deleted
outright, not merely reclassified — the parent-before-child emission invariant this ADR
built `preservesEmissionOrder` around no longer exists), [ADR-0007](0007-feature-member-claims.md)
(construction-time collision precedent), [ADR-0012](0012-split-expansion-into-panel-and-tree.md)
(`withTree()`/`withExpansion()` split — see the flagged item under `'expand'` below),
[ADR-0021](0021-column-concerns-and-data-concerns-are-separate-surfaces.md) (its capability
test stands; its path-vocabulary rule does not — per
[ADR-0019](0019-columns-path-keyed-by-declared-column-ids.md)'s Amendment 2026-09-20, **every
schema fn names declared columns**, a third-party feature's included)

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

1. **A feature declares stage placement by anchor, using a schema with a bare-named `stage` rule.**

   All four shipped stage-declaring features refactor to a uniform recording-form DSL
   (ADR-0027 Rule 2: every schema form is recorded when a member has a name but no UI-bound state):

   ```ts
   // claim a built-in anchor (no name; all features using this stage set record it)
   renderStages: stageSchema((s) => {
     stage(s.tree, { run: buildTreeStage(...) });
   }),

   // declare a new stage relative to an anchor (name + placement; third-party feature)
   renderStages: stageSchema((s) => {
     stage(s.tree, { name: 'pin', placement: 'after', run: hoistPinned(...) });
   }),

   // pipeline layer, same rule and schema body
   stages: stageSchema((s) => {
     stage(s.sort, { run: (rows) => sortRows(rows, ...) });
   }),
   ```

   `s` is a typed proxy over the stage-name registry interface (Decision 3); `s.tre` is a
   compile error. The engine topologically resolves declared stages. Unknown anchor, cycle,
   duplicate claim/name, or ambiguous tie — all throw at construction (dev-only, each gate
   gates `ngDevMode` inside its own body). Both parties are named; ties receive an edge-fix hint.
   Ambiguous-tie production fallback: deterministic name-sort, never documented.

2. **Anchor set:**
   - Pipeline: `'filter'`, `'sort'`.
   - Render: `'group'`, `'tree'`.
   - **`'expand'` (pipeline) is removed.** Confirmed after #101 (#119 `withTree()`, #121
     `withExpansion()`): no feature claims it; child rows are structurally injected by render
     `'tree'`. Keeping it misleads a third-party author to use the wrong phase.
   - **No post-flatten anchor in v1.** `'paginate'` (#106) and `'prune'` (ADR-0023) left no
     unclaimed post-flatten slot. Pagination owns its own flat-layer decision (#102).
   - `'group'` (pipeline) stays fixed — it orders `table.rows()`; render re-clusters identically.

3. **The stage-name registry is a TypeScript `interface`, not a derived `const` array
   union**, mirroring MUI X's `GridPipeProcessingLookup`. A third-party package
   augments the interface via declaration merging, so its stage name stays a checked
   literal rather than widening to a bare `string`. Built-in anchor names are
   unaffected — they keep today's closed union.

   > **Resolved 2026-09-26 (#153): merging works; the `name: string` fallback is not
   > needed.** A compile probe augmented a stand-in registry via
   > `declare module '@ngp/table'` and checked it through `ngc`, the `index.ts` barrel
   > (which re-exports the interface via `export type { … }`), and a real `createTable()`
   > call through the generated overloads — the merged literal was accepted, a missing
   > one rejected, and the literal member type survived. Run twice: against source (the
   > in-repo `@ngp/table` alias points at `src/`) and against `ngc`-emitted `.d.ts`,
   > the latter being what a third-party consumer sees. Both passed.

4. **Runtime invariants** (data-dependent, stage evaluation): row-id uniqueness and
   real-row id containment (output's non-synthesized ids ⊆ input's). Violations degrade +
   report once per stage per evaluation, in production too (ADR-0014 Decision). Never throw.

5. **Construction-checked declarable:** `synthesizesRows: boolean` (a `true` stage cannot
   anchor before `'group'`). Row-count direction (`'preserves' | 'may-shrink' | 'may-grow'`)
   is dropped — its only check was "may-grow cannot sit after `'paginate'`", which no longer
   exists (Decision 2).

6. **DI-based placement override (`provideTableStages()`) is deferred.** When added, it
   must be an edit function (`(order) => order`). Placement knowledge belongs with the
   feature author; a consumer-facing config surface should not replicate it. Revisit when
   a feature ships as a versioned package that another team consumes and cannot edit.

## Amendment (2026-09-25)

**Scope:** ADR-0020's premise survived; all three resolving decisions (Q1–Q3) landed on the core mechanism (anchors + registry interface + no post-flatten v1). Amendments record them and close open items.

**Shape authoring:** Recording-form DSL via `stageSchema(fn)` + bare-named `stage` rule (Decision 1), per ADR-0027 Rule 2. Unifies all four shipped features and third-party declarations. Object form `renderStages: { tree: fn }` removed; four features refactor (withSorting, withFiltering, withGrouping, withTree).

**Anchor set & checks:** Confirmed `'expand'` unclaimed (ADR-0012's #119/#121 split); removed. No post-flatten anchor in v1 (pagination owns #102). Construction checks (unknown anchor, cycle, duplicate, tie, `synthesizesRows` before `'group'`) are dev-only, each gates `ngDevMode` inside its own body (ADR-0014's 2026-09-24 amendment). Ambiguous tie names both stages + edge-fix hint. Production fallback: deterministic name-sort.

**Invariants:** Decision 4's runtime check claim verified against ADR-0014's Decision section directly — reported in production too, once per stage per evaluation, never thrown. Decision 5's row-count direction dropped (no post-`'paginate'` anchor). Decision 6 stays deferred; Q4 revisit trigger recorded.

**Remaining open:** none — declaration merging survives this repo's build (work item 4, closed by #153; see Decision 3).

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
  adopted (decision 3) — that part is a strictly better answer than a derived union.
- **Leaning on Angular Signal Forms' reducer model** (this library's stated structural
  reference) — does not transfer. Signal Forms has no ordering primitive at all, but
  only because every multi-contributor slot is commutative (`list`/`min`/`max`/`or`/
  `and`). A row-transform chain is non-commutative (filter-then-sort ≠
  sort-then-filter), so no reducer can absorb the ordering question here.

## Consequences

**Gained**
- Third-party features (consumer's own teams) add pipeline/render stages positioned relative to
  fixed anchors, with construction-time errors naming both parties on any conflict.
- Stage names for third-party stages stay checked via interface augmentation rather than `string`.

**Cost & flag**
- Topological resolution introduces debuggable-but-nonlocal cycles across independently-authored
  features.
- CLAUDE.md's `schema/run.ts` row is contradictory: it says the declaring form keeps its own body
  "until ADR-0020's `stageSchema` is a second caller", but `stageSchema` is the recording form.
  Correct it when the engine work lands.
- Interface declaration merging survives this repo's build + barrel + `tools/generate-overloads.ts`
  (work item 4, #153), so third-party stage names stay literals; the `name: string` fallback is unused.

## Open before acceptance

None. The compile probe (work item 4) resolved 2026-09-26 in #153 — merging holds; see Decision 3.
