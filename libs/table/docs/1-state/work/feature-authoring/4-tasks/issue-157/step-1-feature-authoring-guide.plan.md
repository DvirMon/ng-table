---
step: 1
type: docs
commit: docs
depends_on: []
files:
  - libs/table/docs/1-state/feature-authoring.md (new)
---

# Step 1 — The feature-authoring guide

Writes a new guide for an in-house feature author: the
`with-*()` shape, the exported surface, stage claiming and
declaring, and a worked example. Steps 2-4 amend the ADRs and
architecture doc that this guide points back to.

Decisions: [spec](../../2-spec.md) user stories 31-33 and
§ Further Notes; [ADR-0020](../../../../../adr/0020-open-stage-registration-for-third-party-features.md)
Decision and Amendment; [plan.md](../../plan.md) Q11.

## Do

Create `libs/table/docs/1-state/feature-authoring.md` with
these sections, in order.

**1. The `with-*()` shape.** An outer config function returns
`createTableFeature((store: In, ctx) => spec)`. The row type is
recovered as `RowOf<In>`, never written at the call site. List
the spec keys: `members`, `stages`, `renderStages`, `setup`,
`onRowsRemoved`.

**2. The exported surface.** List every symbol an author
imports from `@ngp/table`: `createTableFeature`,
`composeFeatures`, `TableFeatureSpec`, `Feature`, `Shape`,
`RowOf`, `StageContext`, `WritableView`, `createWritableView`,
`pruneByIds`, `resolveIndex`, `RenderNode`, `mapNodes`,
`PipelineStageRegistry`, `RenderStageRegistry`,
`ColumnRuleEntry`, `ColumnRuleRegistry`, `stageSchema`,
`stage`.

**3. Claiming vs declaring a stage.**

```ts
renderStages: stageSchema('render', (s) => {
  stage(s.tree, { run });                                         // claim a built-in anchor
  stage(s.tree, { name: 'pin', placement: 'after', run: pinRows }); // declare a new stage
}),
```

Register the new key so `s.pin` is a legal handle:

```ts
declare module '@ngp/table' {
  interface RenderStageRegistry {
    pin: true;
  }
}
```

Anchors: pipeline `filter`, `group`, `sort`; render `group`,
`tree`. Set `synthesizesRows: true` on a render stage that adds
rows not present in the data; it must land at or after
`'group'`. A declared stage can itself be an anchor for another.

**4. What throws vs what is reported.** At construction (dev
only): unknown anchor, a cycle, a duplicate name or claim, an
ambiguous tie (fix by anchoring one stage on the other), and
`synthesizesRows` placed before `'group'`. At runtime
(production too, reported once per stage per evaluation, output
passed through unchanged): duplicate row ids, and a made-up
real-row id — a row counts as made up when `data === null`.

**5. `RenderNode` and `mapNodes`.** A render stage receives and
returns `RenderNode<TRow>[]`. Nest a row under another with
`mapNodes`, never by pushing it in as a sibling.

**6. `onRowsRemoved` and `pruneByIds`.** A feature that stores
row ids declares `onRowsRemoved` and prunes its own state with
`pruneByIds`.

**7. `displayName`.** Set it with
`Object.assign(feature, { displayName: 'withX' })` so a
collision message names the feature.

**8. The inert-stage contract.** A stage with nothing to do
returns its input array unchanged, same reference. This is
documented, not asserted by the engine.

**9. Testing a feature on its own.** Build a table with
`createTable(data, { trackBy }, withX())` in a spec and assert
on the rows it produces. Point to
`with-selection/feature.spec.ts` as prior art.

**10. Worked example: `withRowPinning`.** A pinned-id set
(`signal<ReadonlySet<RowId>>`), `pin`/`unpin` members, a
declared render stage `pin` placed after `'tree'` that hoists
pinned nodes to the top, `onRowsRemoved` pruning with
`pruneByIds`, and a `displayName`. Every import comes from
`@ngp/table`.

## Watch out

- Every symbol the guide imports must be exported from
  `libs/table/src/index.ts`. Verify each one before writing it.
- Type `run` inline in snippets — the stage transform types
  (`RowTransform`, `RenderNodeTransform`) are not exported yet
  (#188).
- Verify signatures against source before writing:
  `src/schema/stage-schema.ts`, `src/schema/stage-rules.ts`,
  `src/engine/types.ts`, `src/engine/render-stages.ts`,
  `src/engine/rows.ts`.
- The guide is prose for a consumer team. Keep engine-internal
  file paths out of it, except in the prior-art pointer.

## Out of scope

- Exporting the stage transform types (#188).
- Any source change.
- The ADR amendments (Steps 2, 3) and the architecture
  registration (Step 4).

## Done when

- [ ] The guide covers all ten sections above.
- [ ] Every import used in `withRowPinning` appears in
      `src/index.ts`.

---

[Step 2: Amend ADR-0011: adding a stage is not reordering](step-2-amend-adr-0011.plan.md) →
