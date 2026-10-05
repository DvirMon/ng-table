---
step: 3
type: docs
commit: docs
depends_on: []
files:
  - libs/table/docs/1-state/work/feature-authoring/plan.md
  - libs/table/docs/adr/0020-open-stage-registration-for-third-party-features.md
---

# Step 3 — Record the made-up-row ruling

Records the 2026-09-30 ruling on what counts as a made-up row
for the runtime containment check, so it stops being an implicit
choice in the engine code.

## Do

In `plan.md`, add a resolved question (Q11, decided
2026-09-30): the runtime containment check treats a row as made
up when `data === null`. `synthesizesRows` stays a
construction-only flag and is not read at runtime. The report
names the stage, its feature label and the first offending id.

Under ADR-0020 Decision 4, add a one-line note pointing to Q11:
its "non-synthesized ids" means `data !== null` rows.

## Out of scope

- The feature-authoring guide (#157).
- Any code.

## Done when

- [ ] `plan.md` holds the ruling as Q11.
- [ ] ADR-0020 Decision 4 links to it.

---

← [Step 2: Runtime row-id checks on render stages](step-2-runtime-row-id-checks.plan.md)
