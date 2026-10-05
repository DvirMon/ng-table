---
step: 2
type: code
commit: feat
depends_on: [1]
files:
  - libs/table/src/api/features/compose-features.ts
  - libs/table/src/api/create-table-feature.ts
  - libs/table/src/api/features/compose-features.spec.ts
  - libs/table/src/api/create-table.spec.ts
---

# Step 2 — Compose context rows

This step makes `composeFeatures` merge inner `contextRows` into one composite signal.
It also lets a feature's own `contextRows` survive a derive block, and rejects one declared by a derive block.
Core stamping stays in step 1.

Decisions: [A2](../../3-architecture.md)

## Do

- In `foldInnerFeatures`, collect the inner `contextRows` signals and union them in one composite `computed`.
- Emit the `contextRows` key only when at least one inner feature contributes. This is the same pattern as `expandedRowsSignals`.
- In `create-table-feature.ts`, add `'contextRows'` to `PIPELINE_BEHAVIOR_KEYS`.
- In `mergeDerivedSpec`, pass `contextRows: spec.contextRows` through.

## Watch out

- Build the union inside the `computed`, not at fold time.
- Emit no key when nothing contributes. Case 14 depends on it.

## Out of scope

- Stamping `isContextRow` in the core (step 1).

## Done when

- [ ] The composite unions inner sets reactively.
- [ ] A derive block that declares `contextRows` throws.
- [ ] A feature's own `contextRows` survives a derive block.

---

← [Step 1: Context-rows engine slot](step-1-context-rows-slot.plan.md) | [Step 3: Tree retention](step-3-tree-retention.plan.md) →
