---
step: 3
type: docs
commit: docs
depends_on: []
files:
  - libs/table/docs/adr/0004-table-source-layout.md
---
# Step 3 — Amend ADR-0004: anchors and registries replace the order array

Adds a dated note to ADR-0004 recording that stage keys now
come from a registry and a fixed anchor list, not from editing
an order array.

Decisions: [ADR-0020](../../../../../adr/0020-open-stage-registration-for-third-party-features.md)
Decision 1; [spec](../../2-spec.md) § Implementation Decisions
"Registries".

## Do

Under the "`PipelineStages` is now derived from
`PIPELINE_ORDER`" bullet, add a dated note (2026-09-30):

- Stage keys now derive from `PipelineStageRegistry` and
  `RenderStageRegistry`.
- `PIPELINE_ANCHORS` and `RENDER_ANCHORS` are fixed anchor
  lists. A new stage is declared with `stage()` next to an
  anchor, not added to an array (ADR-0020).
- The object form `stages: { sort: fn }` is gone; features use
  `stageSchema`.

## Watch out

- Keep the Context section's history (the double-declared array
  defect) unchanged.

## Out of scope

- Other ADRs.

## Done when

- [ ] ADR-0004 no longer reads, unamended, as "add a stage by
      editing an array."

---
← [Step 2: Amend ADR-0011: adding a stage is not reordering](step-2-amend-adr-0011.plan.md) | [Step 4: Register the effort and link the guide](step-4-register-guide.plan.md) →
