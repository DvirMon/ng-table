---
step: 10
type: code
commit: feat
depends_on: [1, 2, 3]
files:
  - libs/table/src/index.ts (edit)
---

# Step 10 — Barrel export

This step exports `stageSchema`, `stage`,
`PipelineStageRegistry`, and `RenderStageRegistry` from the
public barrel. It leaves every other already-exported symbol
untouched.

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

Add four exports, type-only where possible:

```ts
export { stageSchema } from './schema/stage-schema';
export { stage } from './schema/stage-rules';
export type { PipelineStageRegistry } from './engine/pipeline';
export type { RenderStageRegistry } from './engine/render-stages';
```

Merge `RenderStageRegistry` into the existing
`export type { RenderNode }` line (both come from
`./engine/render-stages`) so that module has one type-export
line, not two.

## Watch out

- Everything else in the spec's larger Exports list
  (`TableFeatureSpec`, `Feature`, `Shape`, `RowOf`,
  `WritableView`, `pruneByIds`, `resolveIndex`, `RenderNode`,
  `mapNodes`, `ColumnRuleEntry`, `ColumnRuleRegistry`) is already
  exported (issue #152, merged) — don't re-add.
- The spec's Exports list also mentions "the pipeline/render
  stage and transform types" (`RowTransform`,
  `RenderNodeTransform`, `PipelineStage`, `RenderStage`) — these
  are out of scope for this issue's barrel (not named in this
  issue's own acceptance criteria; a feature author's `run`
  param type is inferred contextually through `stage()`, no
  export needed).

## Out of scope

- Exporting anything not in this issue's own four-name
  acceptance criterion.

## Done when

`nx run shared-table:typecheck` clean (a barrel re-export has no
logic of its own — this is enforcement, not a spec file).

---

← [Step 9: Refactor withTree](step-9-refactor-tree.plan.md) | [Step 11: CLAUDE.md doc fix](step-11-claude-md-doc-fix.plan.md) →
