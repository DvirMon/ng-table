---
step: 4
type: docs
commit: docs
depends_on: [1]
files:
  - libs/table/docs/1-state/architecture.md
  - libs/table/CLAUDE.md
---

# Step 4 — Register the effort and link the guide

Links the new feature-authoring guide from `architecture.md`
and `CLAUDE.md`, and fixes a stale line in `architecture.md`
that still names the old pipeline order array.

Decisions: [spec](../../2-spec.md) § Further Notes
(registration entry).

## Do

In `libs/table/docs/1-state/architecture.md`, add a short
"Feature authoring" section after "Composition: argument order
sets member visibility, not execution order", linking
`feature-authoring.md`, ADR-0020, and the work folder
`work/feature-authoring/`.

In the same file, fix the line that still says the pipeline
runs in `PIPELINE_ORDER` (`filter → group → sort → expand`): it
now runs the fixed anchor order `filter → group → sort`, plus
any stages a feature declares.

In `libs/table/CLAUDE.md`, under "Feature plugin pattern," add
one line pointing to the guide. In the "Claiming a stage"
bullet, the `#154` reference may drop, keeping `(ADR-0020)`.

## Watch out

- CLAUDE.md holds invariants, never status — no "#N
  landed/pending" wording anywhere in the edit.

## Out of scope

- Rewriting CLAUDE.md's other rule bullets; they already
  describe anchors and registries.

## Done when

- [ ] `architecture.md` links the guide and ADR-0020.
- [ ] `architecture.md` no longer names `PIPELINE_ORDER` as the
      current pipeline order.
- [ ] `CLAUDE.md` links the guide.
- [ ] `npm run llms:check` clean.

---

← [Step 3: Amend ADR-0004: anchors and registries replace the order array](step-3-amend-adr-0004.plan.md) | [Step 5: Rename stale order-array mentions in source comments](step-5-stale-order-comments.plan.md) →
