# Spec — open stage registration for in-house features (#102)

Contract: [ADR-0020](../../../adr/0020-open-stage-registration-for-third-party-features.md)
(amended 2026-09-25). Decisions: [`plan.md`](plan.md) (Q1–Q4 settled 2026-09-25).
Architecture: [`3-architecture.md`](3-architecture.md).

## Problem Statement

A team using `@ngp/table` wants to write its own `with-*()` feature — row pinning, a second
filter pass, a separate aggregation feature — and ship it into the same tables other teams
use. Today it cannot, for two reasons:

- The pipeline and render stage lists are closed. A feature may only fill one of the
  built-in slots (`filter`, `group`, `sort`, `expand`; `group`, `tree`). A feature that
  declares any other stage gets a compile error, and an untyped caller's extra stage is
  silently dropped — never run, never reported.
- The types and helpers every in-repo feature uses to build itself — the feature spec
  type, `Feature`/`Shape`/`RowOf`, `WritableView`, `pruneByIds`, `RenderNode`/`mapNodes`,
  the stage transform types — are internal. A feature author outside the library cannot
  name them, and ADR-0006's "store row ids → declare `onRowsRemoved` and prune with
  `pruneByIds`" rule points at a helper they cannot import.

"Third party" here means the consumer's own teams (a design-system team and an app team in
one company), not an external publisher. Both sides of any conflict can edit their code.

## Solution

A feature declares its stages through a stage schema, using one rule, `stage`:

- **Claim** a built-in slot: `stage(s.tree, { run })` — no name.
- **Declare** a new stage next to an anchor:
  `stage(s.tree, { name: 'pin', placement: 'after', run })`. A declared stage can itself
  be an anchor for another declared stage.

The engine collects every feature's rules at the end of composition and resolves one
execution order per layer. Wiring mistakes — unknown anchor, cycle, duplicate name or
claim, two stages tied on the same anchor with nothing ordering them, a row-synthesizing
stage placed before `'group'` — throw in development, naming both features, and the tie
error names the fix. At runtime, a stage that emits duplicate row ids or invents real row
ids is reported once per stage per evaluation and the table keeps rendering.

Stage names a team declares stay checked literals: the name registry is an interface
teams extend by declaration merging, so `s.tre` is a compile error and `s.pin` compiles
once the declaring team's code is in scope.

The feature-author surface is exported from the public barrel, and a feature-authoring
guide shows the whole shape with `withRowPinning` as the worked example.

The four shipped stage-claiming features move to the same rule form with unchanged
behaviour.

## User Stories

1. As a feature author on an app team, I want to add a render stage after `'tree'`, so
   that I can hoist pinned rows without a library release.
2. As a feature author, I want to add a pipeline stage next to `'filter'`, so that I can
   run a second, client-side filter pass after a server filter.
3. As a feature author, I want to add a render stage after `'group'`, so that I can ship
   aggregation as its own feature instead of inside `withGrouping()`.
4. As a feature author, I want to claim a built-in slot and declare a new stage with the
   same `stage` rule, so that there is one shape to learn.
5. As a feature author, I want `s.tre` to be a compile error, so that a typo in an anchor
   never reaches runtime.
6. As a feature author, I want the stage name I declare to be a checked literal, so that
   another team anchoring on it gets autocomplete and typo errors.
7. As a feature author, I want to anchor my stage on another team's declared stage, so
   that I can state "run after pinning" explicitly.
8. As a feature author, I want an error when I anchor on a stage no composed feature
   declares, so that a missing upstream feature is caught at construction.
9. As a feature author, I want an error naming both features when two of us declare the
   same stage name, so that I know who to talk to.
10. As a feature author, I want an error naming both features when two of us claim the
    same built-in slot, so that the existing collision guarantee survives the new form.
11. As a feature author, I want an error when two declared stages form a cycle, so that
    order is never guessed.
12. As a feature author, I want an error when my stage and another sit on the same anchor
    and placement with nothing ordering them, so that execution order never depends on
    argument order.
13. As a feature author hitting that tie error, I want it to tell me to anchor one stage
    on the other, so that I can fix it in my own code.
14. As a feature author, I want an error when a stage marked `synthesizesRows: true` is
    placed before render `'group'`, so that grouping never receives synthesized rows.
15. As a consumer composing features, I want execution order to stay independent of
    argument order, so that reordering `createTable()` arguments never changes rows.
16. As a consumer, I want a table that composes no declared stage to run exactly the
    built-in order it runs today, so that the change is invisible to me.
17. As a consumer, I want construction checks stripped from production builds, so that
    they cost nothing there (ADR-0014 amendment).
18. As a consumer, I want a deterministic order even if a tie slips into production, so
    that two page loads never render differently.
19. As a consumer, I want a stage that emits duplicate row ids to be reported, not to
    crash the table, so that one bad feature doesn't blank the screen.
20. As a consumer, I want a stage that emits a real row id its input never had to be
    reported, so that a stage inventing data is visible.
21. As a consumer, I want those runtime reports in production too, so that the failures I
    can't reproduce locally still reach me.
22. As a consumer, I want each runtime report once per stage per evaluation, not per row,
    so that the console stays readable.
23. As a feature author, I want declared stages to work inside `composeFeatures()`, so
    that bundling features to beat the arity cap doesn't change stage behaviour.
24. As a feature author, I want to import `TableFeatureSpec`, `Feature`, `Shape` and
    `RowOf` from `@ngp/table`, so that I can type a `buildXSpec()` helper and overloads
    the way in-repo features do.
25. As a feature author, I want `WritableView` and `createWritableView`, so that my feature
    can expose a writable slice like `table.grouping`.
26. As a feature author storing row ids, I want `pruneByIds` exported, so that I can
    follow ADR-0006's `onRowsRemoved` rule.
27. As a feature author, I want `resolveIndex` exported, so that my id-keyed writes
    through `value.update` use the same lookup as built-in features.
28. As a feature author, I want `RenderNode` and `mapNodes` exported, so that my render
    stage nests children correctly instead of hand-writing recursion.
29. As a feature author, I want the stage transform types exported, so that I can type a
    stage-builder helper.
30. As a feature author, I want `ColumnRuleEntry`/`ColumnRuleRegistry` exported, so that I
    can type `columnRules` on my spec.
31. As a feature author, I want a guide showing the whole feature shape with a worked
    `withRowPinning`, so that I don't reverse-engineer in-repo features.
32. As a feature author, I want the guide to say that an inert stage must return its
    input unchanged, so that I know the contract nobody asserts.
33. As a feature author, I want the guide to document `displayName`, so that collision
    messages name my feature instead of its argument position.
34. As a library maintainer, I want `withSorting`, `withFiltering`, `withGrouping` and
    `withTree` on the same rule form, so that there is one stage-declaration mechanism.
35. As a library maintainer, I want their existing specs to pass unchanged after the
    move, so that the refactor is proven behaviour-neutral.
36. As a library maintainer, I want the unclaimed pipeline `'expand'` slot removed, so
    that no author puts child-row injection in the wrong phase.
37. As a library maintainer, I want the ordering rules in one pure function, so that the
    whole throw/order matrix is testable without building a table.
38. As a library maintainer, I want the repo docs (CLAUDE.md, ADR-0004, ADR-0011) to stop
    saying "edit `RENDER_ORDER` — nothing else", so that nobody adds a stage the old way.

## Implementation Decisions

- **Authoring shape.** `TableFeatureSpec.stages` and `.renderStages` take a stage schema
  built by `stageSchema(fn)`; the object form (`renderStages: { tree: fn }`) is removed,
  not kept alongside. One rule, `stage(handle, opts)`: no `name` = claim a built-in slot;
  `name` + `placement: 'before' | 'after'` = declare. Optional `synthesizesRows: boolean`
  on a declared stage. `placement` is a position, so it stays a string union.
- **Schema form.** `stageSchema` is a **recording-form** schema (ADR-0027 Rule 2): it runs
  through the shared recording body and the shared path proxy in the schema folder, not
  filtering's declaring body. Consequence: CLAUDE.md's `schema/run.ts` row, which says the
  declaring form keeps its own body "until `stageSchema` is a second caller", is wrong —
  `stageSchema` never becomes a caller of the declaring form. Correct the row.
- **Registries.** Stage names come from two exported interfaces, one per layer
  (`PipelineStageRegistry`, `RenderStageRegistry`), extended by declaration merging. The
  `*_ORDER` const arrays become fixed anchor lists; the stage-key types derive from the
  registries.
- **Anchor set.** Pipeline: `'filter'`, `'sort'` (with `'group'` still a claimable
  built-in that shapes `table.rows()`). Render: `'group'`, `'tree'`. Pipeline `'expand'`
  is removed. No post-flatten anchor in v1.
- **Resolution.** A new pure ordering module takes a layer's built-in anchors plus every
  recorded rule and returns one ordered list. It runs once per layer, at the end of the
  fold, in both `composeTable`'s fold and `composeFeatures`' inner fold. The core reads the
  resolved order instead of the const arrays.
- **Construction checks** (throw, dev-only, each gated on `ngDevMode` inside its own body,
  each naming both parties): unknown anchor, cycle, duplicate declared name, duplicate
  claim of a built-in slot, ambiguous tie, `synthesizesRows: true` placed before render
  `'group'`. The tie message names both stages and the fix (anchor one on the other).
- **Production tie fallback.** With the dev check stripped, tied stages order by name.
  Deterministic; never documented as an ordering mechanism.
- **Runtime checks** (degrade + report, never throw, production too — ADR-0014): per render
  evaluation, row-id uniqueness, and real-row id containment (a stage's non-synthesized
  output ids ⊆ its input ids). Reported once per stage per evaluation; the offending
  stage's output is passed through. The inert-stage contract (return input unchanged) is
  documented, not asserted.
- **Slot collisions.** The existing slot registry keeps naming both parties; its keys
  widen from the closed stage unions to the registry keys.
- **Refactor.** `withSorting` (`s.sort`), `withFiltering` (`s.filter`), `withGrouping`
  (`s.group`, both layers, render stage marked `synthesizesRows: true`), `withTree`
  (`s.tree`) move to the rule form. Behaviour unchanged.
- **Exports.** The public barrel adds, type-only where possible: `TableFeatureSpec`,
  `Feature`, `Shape`, `RowOf`, `WritableView`, `createWritableView`, `pruneByIds`,
  `resolveIndex`, `RenderNode`, `mapNodes`, the pipeline/render stage and transform types,
  `ColumnRuleEntry`, `ColumnRuleRegistry`, plus the new `stageSchema`, `stage`,
  `PipelineStageRegistry`, `RenderStageRegistry`. "Nothing in `engine/` is exported"
  becomes "`engine/` exports only what the barrel lists for feature authors".
- **Derive-block guard.** The hand-maintained spec-key list in `createTableFeature`
  (`PIPELINE_BEHAVIOR_KEYS`) is unchanged — the keys keep their names.
- **Compile probe gates the literal typing.** Before the registry typing lands, a
  throwaway probe checks that declaration merging on the registries survives `ngc`, the
  barrel and the overload generator. If it fails, a declared `name` widens to `string`;
  claim handles stay typed either way. Result is recorded in ADR-0020's open item.
- **No consumer-side override in v1** (Q4). `provideTableStages()` stays deferred.

## Testing Decisions

A good test here asserts what a feature author or consumer can observe — rows out, the
error thrown and its message, what is reported — never the internal shape of recorded
rules or the resolver's intermediate graph.

Three seams (confirmed 2026-09-26):

1. **`composeTable` / `composeFeatures` (existing seam).** End-to-end through a table
   built from test features: a declared stage runs after `'tree'`; the same inside
   `composeFeatures()`; a duplicate built-in claim throws naming both; runtime id checks
   report once and pass rows through, never throw. Prior art: the existing
   `compose-table.spec.ts` and `compose-features.spec.ts` collision and fold tests.
2. **The pure ordering function (new seam, plain vitest).** The whole order/throw matrix:
   unknown anchor, cycle, duplicate name, ambiguous tie with the edge-fix hint,
   `synthesizesRows` before `'group'`, a tie resolved by anchoring one declared stage on
   the other, name-sort fallback with the dev gate off, and zero declared stages = today's
   built-in order (regression guard). Prior art: `engine/pipeline.spec.ts`,
   `schema/validate.spec.ts` (dev-gated throws).
3. **Type assertions (`*.types.spec.ts`).** `s.tre` is `@ts-expect-error`; `s.pin`
   compiles after a registry merge. Enforced only by `typecheck-spec`, not the test run.
   Prior art: `with-sorting/feature.types.spec.ts`.

`stageSchema`/`stage` and the runtime checks get no spec files of their own — they are
covered through seams 1 and 2. The existing `with-*` specs for the four refactored features
must pass unchanged; they are the behaviour guard for the refactor.

## Out of Scope

- A post-flatten anchor — pagination and virtual-window stay out of reach until
  pagination's own issue decides the flat layer.
- `provideTableStages()` / any consumer-side ordering override (ADR-0020 D6). Revisit when
  a feature ships as a versioned package another team consumes and cannot edit.
- Reordering built-in stages (ADR-0011's rejection stands; adding ≠ reordering).
- Opening `RenderRow` to feature-contributed fields (plan Finding 2c).
- Documenting or exposing the `totalRowCount` override beyond today.
- A `rowCount` direction declarable and `preservesEmissionOrder` — both dropped.
- Storybook stories — nothing previewable.

## Further Notes

- Pipeline order and argument order stay independent; this spec only lets features add
  to the fixed order, never let argument order decide it.
- Signal Forms' reducer model does not transfer: a row-transform chain is
  non-commutative, so explicit ordering is required. ADR-0020 records this so nobody
  "fixes" it later.
- Docs owed alongside the code: ADR-0011 (adding ≠ reordering), ADR-0004 and CLAUDE.md's
  "Rules" bullets (the `*_ORDER` edit rule, the object form), CLAUDE.md's `schema/run.ts`
  row, the registration entry in `docs/1-state/architecture.md`, and the new
  feature-authoring guide.
