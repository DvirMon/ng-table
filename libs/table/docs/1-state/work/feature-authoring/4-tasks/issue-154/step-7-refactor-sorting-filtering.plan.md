---
step: 7
type: code
commit: refactor
depends_on: [6]
files:
  - libs/table/src/api/features/with-sorting/feature.ts (edit)
  - libs/table/src/api/features/with-filtering/feature.ts (edit)
---
# Step 7 — Refactor withSorting + withFiltering

This step converts both features' `stages` from the object form
to the claim form of `stage()`. It leaves every `run` body and
behavior unchanged — a pure syntax conversion.

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
// with-sorting/feature.ts, was: stages: { sort: (rows) => ... }
stages: stageSchema('pipeline', (s) => {
  stage(s.sort, { run: (rows) => manual ? rows : sortRows(rows, ...) });
}),

// with-filtering/feature.ts, was: stages: { filter: (rows) => ... }
stages: stageSchema('pipeline', (s) => {
  stage(s.filter, { run: (rows) => { ... } });
}),
```

Both are pure claim-form conversions — same `run` bodies, no
behavior change.

## Watch out

- No new test file — the existing `with-sorting/feature.spec.ts`
  and `with-filtering/feature.spec.ts` are the behavior guard,
  run unchanged (confirmed by test-plan review against every
  plausible refactor bug: sort body dropped, `manual` branch
  lost, matcher rebuilt per row, claim pointed at wrong slot,
  claim written as declare — all already caught by existing
  assertions, including cross-feature composition tests in
  `with-grouping/feature.spec.ts`'s "pipeline order (story 22)"
  test).
- This is the last step whose typecheck is still expected red
  until step 9 lands (grouping + tree also need to move off the
  object form).

## Out of scope

- `resolveStageOrder`, declared-stage execution, ties/cycles/
  unknown-anchor checks (#155).

## Done when

`with-sorting/feature.spec.ts` and `with-filtering/feature.spec.ts`
pass with zero edits to either spec file.

---
← [Step 6: compose-features.ts fold](step-6-compose-features-fold.plan.md) | [Step 8: Refactor withGrouping](step-8-refactor-grouping.plan.md) →
