---
title: "Step 2 — slots.spec.ts: registry unit spec for the core-key pre-claim"
type: task-step
issue: 68
---

# Step 2 — slots.spec.ts: registry unit spec for the core-key pre-claim

**PR scope:** Test-only. Adds cases to the existing registry spec; no source edits.

**Task type:** test

**Skills used:** unit-test

**Depends on:** Step 1
**Parallel-safe with:** Step 3

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/engine/slots.spec.ts` (edit)

## Why This Step Exists

Spec "Testing Decisions": the registry keeps its own unit spec for the new core-key claims,
since it is pure and already tested standalone. Issue AC: "Registry unit spec covers the
core-key pre-claim and the unclaimed `totalRowCount`."

## What To Do

Add a `describe('core member keys (D4)')` block:

- **every listed core key collides after pre-claim** — iterate `CORE_MEMBER_KEYS`; for each,
  a fresh registry, `claimCoreMembers()`, then `claimMember(key, 'feature 1')` throws matching
  `/core and feature 1 both provide the "<key>" store member/`.
- **`totalRowCount` stays claimable (ADR-0005)** — after `claimCoreMembers()`,
  `claimMember('totalRowCount', 'feature 1')` does not throw.
- **double pre-claim throws** — `claimCoreMembers()` called twice throws (`core` vs `core`), so
  a future fold refactor cannot double-claim silently.
- **a non-core member is unaffected** — `claimMember('editing', 'feature 1')` after pre-claim
  does not throw.

Update the existing `describeFeature` case to the new text (`'feature 2'` for `2`) and add one
for `describeInternalFeature`.

## Implementation Notes

- Use `it.each(CORE_MEMBER_KEYS)` for the per-key case; importing the constant ties the spec to
  the source list, so a key added to the list is covered automatically.
- Match on the message regex, not on `Error` identity — same style as the existing cases.

## Risks / Watchouts

- Do not assert on the *order* keys are claimed; only that each collides.
- Keep the stage / render-stage cases untouched — this step is about members.

## Non-Goals

- No fold-level tests (a feature spec returning `members: { rows }`) — Step 4.

## Acceptance Checks

- [ ] New cases pass; existing cases pass with only the `describeFeature` expectation edited.
- [ ] `totalRowCount` non-throw case exists and passes.

---
← [Step 1: slots.ts core-key pre-claim](step-1-slots-core-key-preclaim.plan.md) | [Step 3: Fold — base store before features →](step-3-fold-base-store-before-features.plan.md)
