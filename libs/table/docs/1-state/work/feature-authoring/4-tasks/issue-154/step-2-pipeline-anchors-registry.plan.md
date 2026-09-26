---
step: 2
type: code
commit: refactor
depends_on: []
files:
  - libs/table/src/engine/pipeline.ts (edit)
---
# Step 2 — Pipeline anchors + registry

This step renames `PIPELINE_ORDER` to `PIPELINE_ANCHORS`,
drops the `'expand'` member, and derives `PipelineStage` from a
new extensible registry interface. It leaves `runPipeline()`'s
behavior and signature unchanged.

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
// before
export const PIPELINE_ORDER = ['filter','group','sort','expand'] as const;
export type PipelineStage = (typeof PIPELINE_ORDER)[number];

// after
export const PIPELINE_ANCHORS = ['filter', 'group', 'sort'] as const;
export interface PipelineStageRegistry { filter: true; group: true; sort: true }
export type PipelineStage = keyof PipelineStageRegistry & string;
```

`RowTransform<TRow>`, `PipelineStages<TRow>`, and
`runPipeline()`'s body are unchanged — `runPipeline` still takes
the same `Partial<Record<PipelineStage, RowTransform<TRow>>>`
keyed lookup and reduces over the anchor array, just reading
`PIPELINE_ANCHORS` instead of `PIPELINE_ORDER`. There is no
"resolved ordered list" concept here (see scope note).

## Watch out

- `PipelineStageRegistry` is exported so a team can later extend
  it via declaration merging — not exercised here, but the type
  must exist now.
- Migrate `pipeline.spec.ts`: rename `PIPELINE_ORDER` to
  `PIPELINE_ANCHORS` in the import and the first test's title/
  assertion, drop the `stages.expand = ...` line from that test,
  keep the other three tests (`threads each stage output into
  the next`, `skips unregistered stages`, `is a pass-through
  with no stages registered`) unchanged.
- Add `engine/pipeline.types.spec.ts` (new):
  `expectTypeOf<PipelineStage>().toEqualTypeOf<'filter' | 'group' | 'sort'>()`
  — pins the registry-derived key type and confirms `'expand'`
  is gone.
- This step is independently green (unlike steps 4-9) —
  `runPipeline`'s call sites (`core.ts`) don't need to change
  since its signature is unchanged.

## Out of scope

- `resolveStageOrder()`, placement resolution, and any declared-
  stage handling.

## Done when

- `pipeline.spec.ts`'s renamed/migrated tests pass.
- `pipeline.types.spec.ts` (new) type-checks.
- `PIPELINE_ANCHORS` has exactly `['filter', 'group', 'sort']`,
  no `'expand'`.

---
← [Step 1: Stage authoring surface](step-1-stage-authoring-surface.plan.md) | [Step 3: Render-stage anchors + registry](step-3-render-stage-anchors-registry.plan.md) →
