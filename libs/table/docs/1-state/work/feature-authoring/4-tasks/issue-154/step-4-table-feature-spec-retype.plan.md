---
step: 4
type: code
commit: refactor
depends_on: [1]
files:
  - libs/table/src/engine/types.ts (edit)
---

# Step 4 — TableFeatureSpec retype

This step retypes `TableFeatureSpec.stages` and `.renderStages`
from the keyed object form to the new `StageRule[]` array form.
It leaves fixing every broken call site to steps 5-9.

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
stages?: PipelineStages<TRow>;
renderStages?: RenderStages<TRow>;

// after
stages?: readonly StageRule<RowTransform<TRow>>[];
renderStages?: readonly StageRule<RenderNodeTransform<TRow>>[];
```

The exact generic wrapper name may differ slightly depending on
what `stageSchema()` actually returns in step 1 — read step 1's
landed file and match its actual export.

## Watch out

- This breaks `compose-table.ts`, `compose-features.ts`, and all
  four `with-*` feature files, which still use the object form —
  those don't get fixed until steps 5-9. Per the user's own
  decision, this is an accepted red-typecheck-mid-sequence:
  `nx run shared-table:typecheck`/`typecheck-spec` stay red from
  this step through step 9, first green again at step 9. Don't
  try to keep this step green in isolation.
- Fix the stale `RENDER_ORDER` mention in this file's own
  comment (around the `renderStages` doc comment) while editing
  it.
- This is a type-only edit — no runtime logic, no spec file
  changes of its own (confirmed: "no seam" from test-plan
  review).

## Out of scope

- Don't touch `compose-table.ts`/`compose-features.ts`/the
  feature files here — that's steps 5-9.

## Done when

`engine/types.ts`'s `TableFeatureSpec.stages`/`.renderStages`
are retyped; typecheck is expected to be red until step 9
(documented, not a failure of this step).

---

← [Step 3: Render-stage anchors + registry](step-3-render-stage-anchors-registry.plan.md) | [Step 5: core.ts + compose-table.ts fold](step-5-core-compose-table-fold.plan.md) →
