---
step: 5
type: docs
commit: docs
depends_on: [2]
files:
  - libs/table/CLAUDE.md
---

# Step 5 — Drop stale #155 notes

Removes the "execution lands in #155" status note from
`CLAUDE.md` now that a declared stage runs end-to-end.

## Do

In "Feature plugin pattern" → "Claiming a stage", remove
"execution of a declared stage lands in #155, not yet wired
end-to-end." State the durable rule only: a declared stage runs
at its resolved position.

## Out of scope

- The "Rules" bullets, ADR-0004/0011, and the guide — those
  belong to #157.

## Done when

- [ ] `CLAUDE.md` carries no #155 status text.

---

← [Step 2: Run the resolved order](step-2-run-resolved-order.plan.md)
