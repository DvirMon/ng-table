---
step: 5
type: docs
commit: docs
depends_on: []
files:
  - libs/table/src/api/features/with-grouping/feature.ts
  - libs/table/src/api/features/with-grouping/feature.spec.ts
  - libs/table/src/engine/grouping/pipeline.ts
---

# Step 5 — Rename stale order-array mentions in source comments

Renames three source comments that still say `PIPELINE_ORDER`
to the current name, `PIPELINE_ANCHORS`.

Decisions: [ADR-0020](../../../../../adr/0020-open-stage-registration-for-third-party-features.md)
Decision 1.

## Do

Replace `PIPELINE_ORDER` with `PIPELINE_ANCHORS` in three
comments, comment text only:

- `with-grouping/feature.ts:67`
- `with-grouping/feature.spec.ts:288`
- `engine/grouping/pipeline.ts:5`

## Watch out

- Leave `engine/grouping/render.spec.ts:85` alone; it asserts a
  message does not contain `RENDER_ORDER`.

## Out of scope

- Any code change.
- Docs under `docs/0-product/` that name `PIPELINE_ORDER` as a
  fact about ordering.

## Done when

- [ ] `grep -rn PIPELINE_ORDER libs/table/src` finds nothing.

---

← [Step 4: Register the effort and link the guide](step-4-register-guide.plan.md)
