# Step 1 test plan — Carry the owning feature's label on each resolved stage

Step: [step-1-resolved-stage-label.plan.md](step-1-resolved-stage-label.plan.md)
Spec file: `libs/table/src/engine/stage-order.spec.ts`

## Stubs (red phase)
- None. The step adds no new symbol. It adds one field,
  `readonly label: string`, to the existing `ResolvedStage`.
  The red phase adds the field to the interface only. `assemble`
  still emits `{ name, run }`, so the test below fails at
  runtime (`label` is `undefined`), not at compile time.

## Seams, in red-green order
### A. Claims and declares resolve carrying their owning feature's label
- Test: `it('a resolved claim and a resolved declare each carry their owning feature\'s label')`
- Input: `resolveStageOrder('pipeline', [claim('withFilter', 'filter'), claim('withSort', 'sort'), declare('withAudit', 'audit', 'filter', 'after')])`
- Asserts: `resolved.map(s => [s.name, s.label])` `toEqual`
  `[['filter', 'withFilter'], ['audit', 'withAudit'], ['sort', 'withSort']]`.
- Why this seam: claims and declares build their resolved entry
  in two separate branches of `assemble`. The claims map stores
  only `run` today, and the declare branch drops
  `DeclareEntry.label`. One input with both kinds catches either
  branch forgetting the label. Two claims with different labels
  also catch a bug that gives every stage one label.
- Order reason: independent. The only seam.

Put the test in a new `describe('carries the owning feature label')`
block next to the existing ones. Use the file's existing
`claim` / `declare` fixtures. No new fixtures.

## Types phase (written in red, proven by green's typecheck)
None. `ResolvedStage` is engine-internal: not re-exported from
`src/index.ts`, and nothing is inferred from it.

## Not tested
- Existing assertions in `stage-order.spec.ts`: nothing to
  update. `assertResolvesTo` compares names with `toEqual` and
  each `run` with `toBe`; an extra `label` breaks none of them.
- Adding a label check to `assertResolvesTo`: rejected. Every
  `it.each` row would fail on the same bug as seam A, and it
  mixes label checks into rows that test ordering.
- Two features claiming the same anchor: the map stores
  `{ label, run }` in one `set`, so they can't come from
  different claims. Throwing on a duplicate claim belongs to
  `SlotRegistry`.
- Dev-off duplicate declared name keeps the later label: the
  label travels with its `DeclareEntry`; existing test T covers
  which entry survives.
- `runPipeline` / `runRenderStages` passing `label` along: no
  logic added there in this step.

Trimmed: the planner's separate claim-only seam was folded into
seam A (the declare seam already asserted a claim's label).
