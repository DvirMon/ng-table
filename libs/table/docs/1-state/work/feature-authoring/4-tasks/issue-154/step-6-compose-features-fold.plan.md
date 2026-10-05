---
step: 6
type: code
commit: refactor
depends_on: [5]
files:
  - libs/table/src/api/features/compose-features.ts (edit)
  - libs/table/src/api/features/compose-features.spec.ts (edit)
---

# Step 6 — compose-features.ts fold

This step mirrors step 5's treatment for the inner fold, so an
outer feature and this composite's inner feature can still
collide over the same built-in stage. It leaves resolver logic
and declared-stage forwarding out of scope, same as step 5.

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

`claimInnerStages`/`claimInnerRenderStages` collect claim rules
into the same keyed object as today (still calling
`registry.claimStage`/`claimRenderStage` with "composeFeatures
inner feature N" labels, unchanged). The composite then converts
that keyed object back into a `StageRule[]` (one claim-form
entry per occupied key) to return as its own
`TableFeatureSpec.stages`/`.renderStages` — this is what lets
the outer fold (step 5) still catch a cross-boundary collision
(an outer feature and this composite's inner feature claiming
the same built-in), naming the composite as `"composeFeatures"`.

## Watch out

- No render-layer mirror of test E needed — test D already
  fails if the render conversion drops rules or leaves them
  keyed; the outer render claim is step 5's own seam.
- No fixture claims `'expand'` in this spec today — nothing to
  migrate there.
- Same scope boundary as step 5: no resolver, no declared-stage
  forwarding/placement.

## Test plan (fold into this step, migrate the existing spec)

Migrate `compose-features.spec.ts` in place:

- Migrate stage fixtures (`fFilterFirstTwo`, `fSortByNameDesc`,
  `fGroupRenderStage`, `fParentsSecondRow`) from object form to
  `stage()` calls.
- Test A (migrated, "case 7"): two inner features claim
  pipeline `'filter'` — throws naming both inner positions.
- Test B (migrated, "case 8"): two inner features claim render
  `'group'` — throws naming both inner positions.
- Test C (migrated, "case 12", renamed from "...in
  PIPELINE_ORDER..."): inner `sort` + inner `filter` — both
  apply, in anchor order not inner argument order —
  `store.rows().map(r => r.name)` equals `['Bea', 'Ada']`.
- Test D (migrated, "case 18"): inner `'tree'` render claim
  reaches the outer engine's flatten —
  `store.renderRows().map(r => r.id)` equals `[1, 3]`.
- Test E (new, "case 10b", beside case 10): outer feature claims
  `'filter'`, composite's inner feature also claims `'filter'` —
  outer registry throws, naming the composite:
  `/feature 1 \(fOuterFilter\) and feature 2 \(composeFeatures\)
both provide the "filter" pipeline stage/`.
- Leave unchanged: cases 1-6, 9-11, 13-17, 19 (no stage rules
  involved, or already proven equivalent either way — e.g. case
  19's union result holds regardless).

## Out of scope

- Same as step 5: `resolveStageOrder`, declared-stage execution,
  ties/cycles/unknown-anchor checks (#155). Runtime row-id
  checks (#156).

## Done when

All seams A-E pass; typecheck still expected red until steps
7-9 land.

---

← [Step 5: core.ts + compose-table.ts fold](step-5-core-compose-table-fold.plan.md) | [Step 7: Refactor withSorting + withFiltering](step-7-refactor-sorting-filtering.plan.md) →
