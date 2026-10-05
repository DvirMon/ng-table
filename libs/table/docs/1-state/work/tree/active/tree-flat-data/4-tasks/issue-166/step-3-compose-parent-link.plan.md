---
step: 3
type: code
commit: feat
depends_on: [2]
files:
  - libs/table/src/api/features/compose-features.ts
  - libs/table/src/api/create-table-feature.ts
  - libs/table/src/api/features/compose-features.spec.ts
  - libs/table/src/api/create-table.spec.ts
---

# Step 3 — parentLink through composeFeatures() and derive blocks

This step forwards a `parentLink` contribution through
`composeFeatures()` and through a feature's derive block.
It closes the last two paths a `parentLink` can travel
through before reaching the engine.

Decisions: [A3](../../3-architecture.md), [ADR-0028](../../../../../../../adr/0028-tree-parent-link-slot.md).

## Do

- In `foldInnerFeatures`, claim `parentLink` against a
  private registry (two inner links throw), then forward the
  single link as the composite's `parentLink` via a
  conditional spread, so the outer fold claims it again (an
  inner-vs-outer clash throws). The key must stay absent when
  no inner feature contributes one.
- Add `'parentLink'` to `PIPELINE_BEHAVIOR_KEYS` in
  `create-table-feature.ts`, so a derive block declaring it
  throws.
- Make `mergeDerivedSpec` forward the feature's own
  `parentLink` when the feature has a derive block.

## Watch out

- Never emit `parentLink: undefined` from the composite — the
  key must be absent, not present-with-undefined.

## Out of scope

- Any new behavior in the engine fold or registry — those are
  step 2's.

## Done when

- [ ] An inner `parentLink` in `composeFeatures()` reaches an
      outer stage.
- [ ] Two inner links throw, naming both.
- [ ] An inner link clashing with an outer one throws.
- [ ] A derive block declaring `parentLink` throws, naming it.
- [ ] A feature with a derive block keeps its own
      `parentLink`.

---

← [Step 2: `parentLink` slot, claimed once](step-2-parent-link-slot.plan.md)
