---
step: 9
type: code
commit: refactor
depends_on: [6]
files:
  - libs/table/src/api/features/with-tree.ts (edit)
  - libs/table/src/api/features/with-tree.spec.ts (edit)
  - libs/table/src/api/create-table.spec.ts (edit)
---

> **Plan amendment (post-step-6):** step 6's report surfaced two
> generic `createTableFeature()` test fixtures in
> `api/create-table.spec.ts` (lines ~90/98, ~311) —
> `withReversibleSort`'s `stages: { sort: ... }` and
> `withStagingBlock`'s `stages: { sort: ... }` — still on the
> object form. Neither belongs to any shipped `with-*` feature
> (they're inline test-only fixtures for the core
> `createTableFeature()` mechanism itself), so no step 1-8 file
> list named them, and left unfixed they would keep
> `typecheck-spec` red past this step. Since step 9 is this
> plan's own designated closing step (the one expected to bring
> typecheck green again), its scope now also covers converting
> both fixtures to `stage()`/`stageSchema()` form, byte-identical
> `it` bodies/assertions otherwise.

# Step 9 — Refactor withTree

This step converts `withTree`'s conditional render-stage claim
to the claim form of `stage()`. It leaves the conditional on
`config.childrenAccessor` and every other behavior unchanged,
and closes out the atomic red-typecheck window opened in step 4.

Decisions: none (no capability decisions log for this
cross-cutting engine feature — `state.json`'s
`capabilityLogPath` is `null`; the record is
`libs/table/docs/1-state/work/feature-authoring/plan.md` and
ADR-0020)

> **Scope note:** This issue (#154) ships only the **claim**
> form's execution path — the same built-in stages, same fixed
> anchor order, as today. The **declare** form (`name`+
> `placement`) compiles at the type level (step 1) but nothing
> in this issue's fold resolves or executes it — that's issue
> #155 (`resolveStageOrder()`, the full throw matrix,
> declared-stage end-to-end tests, and the `s.tre`/`s.pin`
> types-spec). Do not add resolver logic, ordering-by-placement,
> cycle/tie/unknown-anchor checks, or declared-stage tests in
> this issue — flag any such temptation as out of scope for
> #155 instead.

## Do

```ts
// was: renderStages: config.childrenAccessor ? { tree: buildTreeStage(...) } : undefined
renderStages: config.childrenAccessor
  ? stageSchema('render', (s) => { stage(s.tree, { run: buildTreeStage(input.trackBy, config) }); })
  : undefined,
```

Still conditional on `config.childrenAccessor` — unchanged
behavior (a collapse-only instance leaves `'tree'` free for a
future claimant).

## Watch out

- `with-tree.spec.ts:109-111`'s `claimsTreeStage` fixture uses
  the object form
  (`renderStages: { tree: (nodes) => nodes }`) — convert it to
  `stageSchema('render', (s) => { stage(s.tree, { run: (nodes) => nodes }); })`,
  keeping the `it` bodies and assertions byte-identical. This is
  the only object-form fixture conversion this step owns.
- Fix the stale `RENDER_ORDER` comment at `with-tree.spec.ts:586`.
- The collision message this fixture pins (`'feature 2
(withTree) both provide the "tree" render stage'`) must still
  match step 5's unchanged wording — if it doesn't, that's step
  5's regression, not this step's.
- Same behavior-unchanged guard: the full existing
  `with-tree.spec.ts` suite (toggle/expand/nesting, grouping+tree
  composition, throwing-accessor reporting) passes unchanged.
- This is the last step in the interlocked group — typecheck
  (`nx run shared-table:typecheck` and `typecheck-spec`) is
  expected to go green again after this step lands (steps 4-9 as
  a whole are the atomic unit; this is where it resolves).

## Out of scope

- `resolveStageOrder`, declared-stage execution, ties/cycles/
  unknown-anchor checks (#155). Runtime row-id checks (#156).

## Done when

`with-tree.spec.ts` passes with only the one fixture conversion
plus one comment fix; `nx run shared-table:typecheck` and
`typecheck-spec` are clean (first time since step 4 — call this
out explicitly as this step's own done-when, since it's the
group's closing step).

---

← [Step 8: Refactor withGrouping](step-8-refactor-grouping.plan.md) | [Step 10: Barrel export](step-10-barrel-stage-exports.plan.md) →
