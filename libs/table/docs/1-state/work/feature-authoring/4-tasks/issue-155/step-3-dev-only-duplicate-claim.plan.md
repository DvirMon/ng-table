---
step: 3
type: code
commit: fix
depends_on: [2]
files:
  - libs/table/src/engine/slots.ts
  - libs/table/src/engine/compose-table.spec.ts
  - libs/table/src/ng-dev-mode.testing.ts
---

# Step 3 — Duplicate stage claim is dev-only

Gates the duplicate-claim throw in `SlotRegistry` on
`ngDevMode`. In production the later claim wins instead of
throwing.

Decisions: [Q8, Checks](../../plan.md)

## Do

Gate `SlotRegistry.claimStage` and `claimRenderStage`, each
inside its own method body, not inside the shared private
`claim()` helper. With the gate off, the later claim replaces
the earlier one and no throw happens.

## Watch out

- `claimMember` stays ungated — member collisions still throw
  regardless of `ngDevMode`.
- Update the `ng-dev-mode.testing.ts` header comment to list
  `slots.ts` among the files reading `ngDevMode`.

## Out of scope

- Member collisions.
- Declared-name duplicates — that's the resolver, Step 1.

## Done when

- [ ] The old "still throws … when ngDevMode is false (ungated)"
      test is replaced, not kept beside the new ones, per
      [step-3-dev-only-duplicate-claim.test-plan.md](step-3-dev-only-duplicate-claim.test-plan.md).

---

← [Step 2: Run the resolved order](step-2-run-resolved-order.plan.md) | [Step 4: Declared names typed to the registries](step-4-declared-name-typing.plan.md) →
