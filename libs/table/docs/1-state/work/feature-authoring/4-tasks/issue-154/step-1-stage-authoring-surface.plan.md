---
step: 1
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/schema/stage-schema.ts (new)
  - libs/table/src/schema/stage-rules.ts (new)
---

# Step 1 — Stage authoring surface (stageSchema + stage)

This step adds the recording-form schema and rule that a
feature author uses to claim or declare a stage. It leaves
resolving or executing a declared stage to a later issue.

Decisions: none (no capability decisions log for this
cross-cutting engine feature — `state.json`'s
`capabilityLogPath` is `null`; the record is
`libs/table/docs/1-state/work/feature-authoring/plan.md` and
ADR-0020)

> **Scope note:** This issue (#154) ships only the **claim**
> form's execution path — the same built-in stages, same fixed
> anchor order, as today. The **declare** form (`name`+
> `placement`) compiles at the type level (this step) but
> nothing in this issue's fold resolves or executes it — that's
> issue #155 (`resolveStageOrder()`, the full throw matrix,
> declared-stage end-to-end tests, and the `s.tre`/`s.pin`
> types-spec). Do not add resolver logic, ordering-by-placement,
> cycle/tie/unknown-anchor checks, or declared-stage tests in
> this issue — flag any such temptation as out of scope for
> #155 instead.

## Do

`stage-schema.ts`: `stageSchema(layer, fn)` is a recording-form
schema (ADR-0027 Rule 2) built over the shared `schema/run.ts`
`runRecordedSchema()` and `schema/path-proxy.ts`
`createPathProxy()`/`createRecorderSession()` — the same
mechanism `api/features/with-grouping/schema.ts` uses (closest
prior art, read it first). `layer` is an explicit first
argument, one of `'pipeline' | 'render'`. It picks which
registry (`PipelineStageRegistry` from step 2, or
`RenderStageRegistry` from step 3) the fabricated path proxy is
typed against, resolved via two overloads keyed on the literal.

```ts
stages: stageSchema('pipeline', (s) => {
  stage(s.sort, { run });
});

renderStages: stageSchema('render', (s) => {
  stage(s.group, { run, synthesizesRows: true });
});
```

`stage-rules.ts` defines one rule, `stage(handle, opts)`. No
`name` in `opts` means **claim** a built-in slot (`{ run }`
only). `name` + `placement: 'before' | 'after'` means
**declare** a new stage next to the anchor `handle` (optional
`synthesizesRows?: boolean`, declare form only — the claim form
has no such field). It records via
`recorderOf(handle).record(rule)`, mirroring
`grouping()`/`groupKey()` in `with-grouping/schema.ts`.

Recorded rule shape:

```ts
type StageRule<TTransform> =
  | { anchor: string; run: TTransform }
  | {
      anchor: string;
      name: string;
      placement: 'before' | 'after';
      synthesizesRows?: boolean;
      run: TTransform;
    };
```

## Watch out

- Only the claim form is functionally exercised anywhere in
  this issue (steps 7-9's feature refactors). The declare form
  must still compile and record correctly — issue #155 is what
  actually resolves/executes it.
- `PipelineStageRegistry`/`RenderStageRegistry` come from steps
  2/3, which this step depends on for its layer-typed proxy —
  the `depends_on: []` above reflects that steps 2/3 are
  independent, parallel-safe siblings, not upstream of this one.
  If the actual generic bound needs those registry types
  imported, use `depends_on: [2, 3]` instead — pick whichever is
  actually true once you look at how the layer overloads are
  typed, and say which you picked.

## Out of scope

- `resolveStageOrder()`, placement resolution, cycle/tie/
  unknown-anchor checks, and any declared-stage execution.

## Done when

`stage()`'s claim form (no `name`) and declare form (`name`+
`placement`) both compile and record correctly through a
throwaway local check. No dedicated spec file — this step's own
tdd-planner review concluded "no seam of its own," covered
later through the fold plus the refactored features.

---

[Step 2: Pipeline anchors + registry](step-2-pipeline-anchors-registry.plan.md) →
