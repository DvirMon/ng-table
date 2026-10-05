---
title: 'Step 4 — compose-table.spec.ts: base-store-before-fold, core-key collision, unshifted labels'
type: task-step
issue: 68
---

# Step 4 — compose-table.spec.ts: base-store-before-fold, core-key collision, unshifted labels

**PR scope:** Test-only. Adds cases to the existing compose spec; no source edits.

**Task type:** test

**Skills used:** unit-test

**Depends on:** Step 3

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/engine/compose-table.spec.ts` (edit)

## Why This Step Exists

Issue AC: "Compose spec covers base-store-before-fold ordering" and "collision messages … name
the consumer's feature by its real position, not shifted by the internal splice." Spec Testing
Decisions: assert what a feature can observe at factory time and the errors thrown at
construction — not how the fold is implemented.

## What To Do

Add a `describe('base store before the fold (D4/D8)')` block using the existing
`compose` / `composeWithRows` helpers (extend `compose` to forward an optional
`internalFeatures` argument):

- **core members are present at factory time** — a feature records
  `typeof composed['renderRows']` and `typeof composed['totalRowCount']` in its factory; both are
  `'function'` (signals), and calling `composed['totalRowCount']()` with two seeded rows returns
  `2`.
- **a feature declaring a core key throws naming core and its position** — `it.each` over
  `CORE_MEMBER_KEYS` (imported) with a factory returning `members: { [key]: 'shadow' }` as the
  first consumer feature throws `/core and feature 1 both provide the "<key>" store member/`.
- **`totalRowCount` is overridable (ADR-0005)** — a feature returning
  `members: { totalRowCount: signal(99) }` composes; `store['totalRowCount']()` is `99`.
- **internal features do not shift consumer positions** — two consumer features both claiming
  the `sort` stage, composed with one internal feature that claims nothing, throw
  `/feature 1 and feature 2 both provide the "sort" pipeline stage/` (not 2 and 3).
- **an internal feature collision names it as internal** — an internal feature and consumer
  feature 1 both claiming `sort` throw
  `/internal feature 1 and feature 1 both provide the "sort" pipeline stage/`.
- **fold order: internal before consumer** — an internal feature and a consumer feature each
  push a marker in their factory; the internal marker comes first.

## Implementation Notes

- Keep the `Record<string, unknown>` cast in the helper — the spec deliberately stays untyped
  against `ComposedFeatureMembers` (existing comment explains why).
- For the "present at factory time" case, read from the _second_ argument (`composed`), not
  `core` — the point is that the store object handed to features already carries them.

## Risks / Watchouts

- Do not assert on how many times a factory ran or on registry internals.
- `signal()` needs no injection context, but `composeTable` does — keep going through the
  `TestBed.runInInjectionContext` helper.

## Non-Goals

- No `createTable()`-level (public factory) cases — those arrive with the positional API in #35
  and the derive block in #36, where the type-assertion seam is introduced.

## Acceptance Checks

- [ ] All new cases pass; no existing case removed.
- [ ] Per-key core collision case covers all five `CORE_MEMBER_KEYS` (imported, not
      re-listed).
- [ ] `totalRowCount` override case passes.

---

← [Step 3: Fold — base store before features](step-3-fold-base-store-before-features.plan.md)
