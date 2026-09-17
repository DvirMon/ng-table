# Step 5 — Engine tests: prune position, no-op, two contributors

**PR scope:** Engine-seam coverage for the new stage and the accumulating slot.
**Depends on:** Step 4.
**Parallel-safe with:** Step 6.
**Task type:** `test`
**Skills used:** `unit-test`
**Scaffolding agent:** `test-implementer`

## Files

| File | Action |
|---|---|
| `libs/shared/table/src/engine/render-stages.spec.ts` | edit — prune ordering and pass behavior |
| `libs/shared/table/src/engine/compose-table.spec.ts` | edit — two contributors compose |

## Why This Step Exists

The prune's position relative to `'paginate'` and to the central `index` assignment has no
consumer-visible expression that the feature specs already cover — and it cannot be covered
through a real pagination feature, because **none exists**. `grep -rln paginate src/` hits only
`render-stages.ts` and its own spec.

`render-stages.spec.ts` already registers fake stage transforms to prove ordering (see its
existing "runs stages in RENDER_ORDER regardless of registration order" case). That is the right
seam, and the only one available for this assertion.

The accumulating slot likewise has no consumer-visible expression until two features contribute,
and `compose-table.spec.ts` is where multi-feature fold behavior is already tested.

## What To Do

### `engine/render-stages.spec.ts`

Follow the file's existing shape — plain `vitest`, no `TestBed`, a local `Row` type and a `makeRow`
helper already defined at the top. Extend `makeRow` (or add a sibling) to take a `parentId`.

Cases:

- **Prune runs between `'tree'` and `'paginate'`.** Extend the existing trace-based ordering test:
  with a fake `paginate` transform registered, the trace shows the prune's effect has already been
  applied by the time `paginate` receives its input. Assert on what `paginate` *sees*, not on a
  trace string — the prune is not a registered stage and will not push to the trace.
- **Empty set is a no-op.** `runRenderStages(rows, {}, new Set())` returns the input rows
  unchanged, including rows that carry a `parentId`.
- **A collapsed parent drops its children.**
- **Descendants of a dropped row are dropped too** — a grandchild whose parent was itself removed,
  proving the `hidden` set works and not just a direct membership check.
- **A row with no `parentId` is never dropped**, whatever the set contains.
- **Union across two sets** — a row is hidden when either contributed set collapses its parent.
  Assert at whatever boundary does the unioning; if `core.ts` owns it, this case may belong there
  instead. Do not duplicate it in both places.
- **The emit-order dependency is real.** A case where a child appears *before* its parent in the
  input and is therefore not pruned. This documents the invariant as a known limitation rather
  than leaving a future reader to discover it — mark it clearly as asserting the contract, not a
  bug.

### `engine/compose-table.spec.ts`

Follow the existing fake-feature style in that file (features declared inline with `renderStages`,
around lines 129-190).

- **Two features each contributing a collapsed set both fold**, with no throw — the ADR-0012
  verification case. Contrast with the existing render-stage collision test, which *does* throw:
  making both behaviors visible in one file is what stops someone "fixing" the accumulating slot
  into a claiming one.
- **Contributions are collected in fold order**, and both reach the prune.

## Implementation Notes

`engine/` is pure except `compose-table.ts` — bare `vitest` for `render-stages.spec.ts`. Reaching
for `TestBed` there means logic ended up in the wrong file.

Use `table.mock.ts` fixtures where a real row shape is needed rather than inlining new ones. The
existing local `Row` / `makeRow` helpers in `render-stages.spec.ts` are fine to extend — they
predate the mock file's conventions and the file is self-contained.

Assert on observable output: which row ids come back, in what order. Do not assert that the prune
ran, how many passes occurred, or the internal shape of the slot.

## Risks / Watchouts

- **Do not edit existing cases to make them pass.** Every current `render-stages.spec.ts` and
  `compose-table.spec.ts` case must pass unedited — that is #98's primary acceptance criterion.
  A failure here means Step 4 is wrong.
- Do not test pagination itself. The fake `paginate` transform exists only to prove ordering.
- The union case may belong in a `core.ts` spec rather than here, depending on where Step 4 put the
  unioning. Put it in one place; a duplicated assertion drifts.

## Non-Goals

- No feature-level `parentId` assertions — Step 6.
- No compile-time type assertions — Step 6.
- No pagination feature, and no test that assumes one.

## Acceptance Checks

- [ ] Prune position proven relative to a fake `paginate` transform.
- [ ] Empty-set no-op, direct-child drop, grandchild drop, `parentId`-less row never dropped.
- [ ] Union across two contributed sets asserted exactly once, at whichever boundary owns it.
- [ ] Emit-order dependency documented as a contract case.
- [ ] Two contributing features fold without throwing, in `compose-table.spec.ts`.
- [ ] Every pre-existing case in both files passes **unedited**.
- [ ] `nx test shared-table` green for these two files.

---
← [Step 4: `'prune'` stage](step-4-prune-stage.plan.md) | [Step 6: Feature + type tests](step-6-feature-tests.plan.md) →
