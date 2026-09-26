---
step: 5
type: code
commit: refactor
depends_on: [1, 2, 3, 4]
files:
  - libs/table/src/engine/core.ts (edit)
  - libs/table/src/engine/compose-table.ts (edit)
  - libs/table/src/engine/compose-table.spec.ts (edit)
---
# Step 5 — core.ts + compose-table.ts fold

This step makes `foldFeatures` read `spec.stages`/
`spec.renderStages` as `readonly StageRule[]` instead of a keyed
object, converting claim rules back into the same keyed shape
`runPipeline`/`runRenderStages` already consume. It leaves
declared-stage handling undefined, per the scope note below.

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

For each rule in `spec.stages`/`spec.renderStages`:

- **Claim** (no `name`): call
  `registry.claimStage(rule.anchor, label)` /
  `claimRenderStage(...)` exactly as today (same message, same
  ungated throw), then write `rule.run` into the same kind of
  `Partial<Record<PipelineStage, RowTransform<TRow>>>` keyed
  object `runPipeline`/`runRenderStages` already accept,
  unchanged.
- **Declare** (`name`+`placement`): no shipped feature in this
  issue produces one. A declare-form rule reaching this fold has
  undefined/unhandled behavior in this issue — #155 replaces
  this fold's internals with the real resolver.

`core.ts`/`runPipeline`/`runRenderStages` signatures do not
change — same keyed-object shape as today, just sourced from the
array-collection loop instead of the old
`for (const stage of PIPELINE_ANCHORS)` per-key lookup on
`spec.stages[stage]`.

## Watch out

- Fix the stale `RENDER_ORDER`/`PIPELINE_ORDER` imports in
  `compose-table.ts` (now `RENDER_ANCHORS`/`PIPELINE_ANCHORS`).
- Don't design anything around `resolveStageOrder`, anchor
  placement, ties, or a declared stage actually running — flag
  as #155 if tempted.
- A feature calling `stage()` twice for the same anchor inside
  one `stageSchema` throws
  `'feature 1 and feature 1 both provide...'` via the same
  `SlotRegistry` call — accept this as today's natural behavior,
  not a new check to build.

## Test plan (fold into this step, migrate the existing spec)

Migrate `compose-table.spec.ts` in place — no new stub, no new
spec file:

- Migrate the `taggingStage(stage, tag)` test helper to
  `{ stages: stageSchema('pipeline', (s) => stage(s[anchor], { run })) }`
  form (narrow its param to `'filter' | 'group' | 'sort'` —
  `'expand'` is gone).
- Test A (migrated): `'folds claimed stages in fixed anchor
  order regardless of features array order'` — features
  `[sort, group, filter]` tagging stages give
  `rows()[0].name === 'Ann-filter-group-sort'`.
- Test B (migrated): `'composes render stages in RENDER_ANCHORS
  order regardless of registration order'` — forward vs
  reversed registration give equal `renderRows()`.
- Test C (migrated): one feature recording two render claims
  (`s.group` + `s.tree`) in one `stageSchema` — both must run,
  `renderRows().map(r => r.index)` equals `[0, 1]`, plus
  `expect(rows).toHaveLength(2)` and
  `expect(rows[0]).toMatchObject({ kind: 'group' })` so dropping
  either stage fails.
- Test D (new): one feature claims `s.group` in both `stages`
  and `renderStages` (mirrors `withGrouping`'s real shape) —
  compose does not throw, both run.
- Test E (migrated): two features claim the same pipeline
  anchor — throws the full existing message string:
  `'[createTable] feature 1 and feature 2 both provide the
  "sort" pipeline stage. Only one feature may provide each
  stage.'`
- Test F (migrated): two features claim the same render anchor
  — throws the full existing message, `"tree" render stage`
  wording.
- Test G (new): same as E, but wrapped in
  `setNgDevMode(false)` / `finally { setNgDevMode(previous) }`
  (pattern from `schema/validate.spec.ts`, import
  `../ng-dev-mode.testing`) — still throws the same full
  message. This is the acceptance criterion that duplicate-claim
  stays ungated, unlike #155's new dev-gated checks.
- Migrate the existing `'expand'`-using test (lines ~65, 110,
  119) — drop the `expand` stage, expected literal becomes
  `'Ann-filter-group-sort'` (no trailing `-expand`).
- Leave unchanged: the `expandedRows` accumulation test, the two
  "zero claims = pass-through" tests (`'passes rows through
  untouched'`, `'1:1-wraps rows'`) — they already guard the
  regression case and this step doesn't touch that path.

## Out of scope

- `resolveStageOrder`, declared-stage execution, ties/cycles/
  unknown-anchor checks (#155). Runtime row-id checks (#156).

## Done when

All seams A-G pass; typecheck still expected red until steps
6-9 land (per the user's accepted mid-sequence red).

---
← [Step 4: TableFeatureSpec retype](step-4-table-feature-spec-retype.plan.md) | [Step 6: compose-features.ts fold](step-6-compose-features-fold.plan.md) →
