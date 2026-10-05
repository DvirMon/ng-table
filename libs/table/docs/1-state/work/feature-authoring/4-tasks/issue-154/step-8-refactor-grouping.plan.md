---
step: 8
type: code
commit: refactor
depends_on: [6]
files:
  - libs/table/src/api/features/with-grouping/feature.ts (edit)
  - libs/table/src/engine/grouping/render.ts (edit)
  - libs/table/src/engine/grouping/render.spec.ts (edit)
---

# Step 8 — Refactor withGrouping

This step converts both of `withGrouping`'s stage claims to the
claim form of `stage()` and rewords the render self-check away
from the now-renamed `RENDER_ORDER` constant. It leaves the
`run` bodies and every other behavior unchanged.

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
// was: stages: { group: (rows) => clusterRows(...) }, renderStages: { group: (rows) => buildGroupRenderRows(...) }
stages: stageSchema('pipeline', (s) => {
  stage(s.group, { run: (rows) => clusterRows(rows, ...) });
}),
renderStages: stageSchema('render', (s) => {
  stage(s.group, { run: (rows) => buildGroupRenderRows(rows, ...) });
}),
```

Reword the self-check in `engine/grouping/render.ts:184` from:

`"...the 'group' render stage must run first in RENDER_ORDER,
before anything can synthesize a null-data row."`

to anchor wording, e.g.:

`"...render anchor 'group' must run before any stage that
synthesizes rows."`

Also reword the code comment at `render.ts:15` and the doc
comment at `render.ts:164` (both currently say "...since it
runs first in RENDER_ORDER..." / "runs first") to the same
anchor vocabulary. Also fix the comment at
`with-grouping/feature.ts:144` (currently says "stages.group" —
object-form wording).

## Watch out

- The claim form (`{ anchor, run }`, no `name`) has no
  `synthesizesRows` field per step 1 — that field only exists on
  the declare form. Grouping's render claim of the built-in
  `'group'` anchor does not need `synthesizesRows: true`: the
  check that field exists for ("a synthesizing stage placed
  before render `'group'`") can't fire against `'group'`'s own
  claim anyway. Drop `synthesizesRows` from grouping's claim
  call entirely — don't add it to the claim-form type.
- Update `render.spec.ts:67,71`'s regex from
  `/must run first in RENDER_ORDER/` to match the new message
  wording, and add
  `expect(message).not.toMatch(/RENDER_ORDER/)` — this is the
  issue's own explicit acceptance criterion.
- Same behavior-unchanged guard as step 7:
  `with-grouping/feature.spec.ts` must pass unchanged (including
  its "pipeline and render stages agree on row order once
  withSorting() is composed" cross-feature test at line
  ~2040).

## Out of scope

- `resolveStageOrder`, declared-stage execution, ties/cycles/
  unknown-anchor checks (#155). Runtime row-id checks (#156).

## Done when

`with-grouping/feature.spec.ts` passes unchanged;
`render.spec.ts`'s reworded assertion passes and confirms
`RENDER_ORDER` no longer appears in the message.

---

← [Step 7: Refactor withSorting + withFiltering](step-7-refactor-sorting-filtering.plan.md) | [Step 9: Refactor withTree](step-9-refactor-tree.plan.md) →
