---
step: 3
type: code
commit: refactor
depends_on: []
files:
  - libs/table/src/engine/render-stages.ts (edit)
---
# Step 3 — Render-stage anchors + registry

This step renames `RENDER_ORDER` to `RENDER_ANCHORS` and
derives `RenderStage` from a new extensible registry interface.
It leaves every render-stage runtime behavior unchanged.

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
export const RENDER_ORDER = ['group','tree'] as const;
export type RenderStage = (typeof RENDER_ORDER)[number];

// after
export const RENDER_ANCHORS = ['group', 'tree'] as const;  // same two members, unchanged
export interface RenderStageRegistry { group: true; tree: true }
export type RenderStage = keyof RenderStageRegistry & string;
```

`RenderNodeTransform<TRow>`, `RenderStages<TRow>`,
`runRenderStages()`'s body, `RenderNode<TRow>`, and `mapNodes`
are all unchanged — this is a pure rename plus a type-derivation
change, since `RENDER_ANCHORS` has the exact same members as
today's `RENDER_ORDER`. No runtime behavior changes at all in
this file. Do not add the runtime row-id uniqueness/containment
checks — those are issue #156.

## Watch out

- This step plausibly has zero new runtime seam (confirmed by
  test-plan review) — it's a rename plus a types-phase check.
- Migrate `render-stages.spec.ts`: rename the import and the
  first test's title (`RENDER_ORDER` to `RENDER_ANCHORS`),
  replace the `[...RENDER_ANCHORS]` expected-value assertion
  with the literal `['group', 'tree']` (asserting against the
  constant under test is tautological — the literal is the
  independent source of truth that grouping must run before
  tree, per `engine/grouping/render.ts:184`). Leave the other
  three `runRenderStages` tests and the `mapNodes` describe
  block unchanged.
- Add `engine/render-stages.types.spec.ts` (new): a
  `@ts-expect-error` on
  `const bad: RenderStages<Row> = { pinned: (n) => n }` — pins
  that `RenderStage` is still a closed union (catches an
  accidental widen to `string`). Use a key name (`pinned`) that
  no later issue will merge into the registry, so this stays
  valid once declaration merging lands elsewhere.
- Callers importing `RENDER_ORDER` (`engine/compose-table.ts`,
  `api/features/compose-features.ts`) are not this step's job —
  that's steps 5/6.
- Stale `RENDER_ORDER` mentions in `engine/types.ts` (comment),
  `engine/grouping/render.ts` (comments plus thrown message plus
  its own spec regex), `with-tree.spec.ts` (comment),
  `compose-table.spec.ts` (comment/title) are not this step's
  job either — owned by steps 4, 8, 9, 5 respectively (each of
  those step files notes this in its own "Watch out").

## Out of scope

- `resolveStageOrder()`, placement resolution, and any declared-
  stage handling. Runtime row-id checks (#156).

## Done when

- `render-stages.spec.ts`'s renamed/migrated tests pass.
- `render-stages.types.spec.ts` (new) type-checks.
- `RENDER_ANCHORS` has exactly `['group', 'tree']`.

---
← [Step 2: Pipeline anchors + registry](step-2-pipeline-anchors-registry.plan.md) | [Step 4: TableFeatureSpec retype](step-4-table-feature-spec-retype.plan.md) →
