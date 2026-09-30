---
step: 2
type: docs
commit: docs
depends_on: []
files:
  - libs/table/docs/adr/0011-chained-render-stages.md
---
# Step 2 — Amend ADR-0011: adding a stage is not reordering

Adds a dated note to ADR-0011 that ties its `RENDER_ORDER`
chain to the anchor model ADR-0020 introduced, and states that
adding a stage is not the same as reordering one.

Decisions: [ADR-0020](../../../../../adr/0020-open-stage-registration-for-third-party-features.md)
Decision and Amendment; [spec](../../2-spec.md) § Out of Scope
("Reordering built-in stages").

## Do

Add a dated note block (2026-09-30) at the top of ADR-0011,
beside the existing supersession notes, following that ADR's
own note style. State:

- `RENDER_ORDER` is now the fixed anchor list
  `RENDER_ANCHORS`. A feature adds a stage by declaring it next
  to an anchor (ADR-0020), not by editing the order.
- Adding a stage is not reordering: the built-in order stays
  fixed, and ADR-0011's rejection of a consumer-configurable
  `RENDER_ORDER` still stands.

In Consequences, add an inline pointer on the "One declaration
per fact: `RENDER_ORDER` is the only list" bullet: the stage
keys now derive from `RenderStageRegistry`.

## Watch out

- Amend in place. Don't rewrite the original Decision text.

## Out of scope

- ADR-0020 itself, ADR-0023, ADR-0017.

## Done when

- [ ] ADR-0011 states that adding a stage is not reordering and
      links ADR-0020.
- [ ] The consumer-configurable-order rejection is stated as
      still standing.

---
← [Step 1: The feature-authoring guide](step-1-feature-authoring-guide.plan.md) | [Step 3: Amend ADR-0004: anchors and registries replace the order array](step-3-amend-adr-0004.plan.md) →
