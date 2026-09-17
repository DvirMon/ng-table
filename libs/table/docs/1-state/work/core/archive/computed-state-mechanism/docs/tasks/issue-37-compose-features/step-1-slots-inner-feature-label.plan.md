---
title: "Step 1 — engine/slots.ts: describeInnerFeature() label for a composite's inner positions"
type: task-step
issue: 71
---

# Step 1 — `engine/slots.ts`: `describeInnerFeature()` label for a composite's inner positions

**PR scope:** Engine only — one exported label helper next to `describeFeature` /
`describeInternalFeature`. Nothing calls it yet; Step 2's `composeFeatures()` is the first
caller. No spec change here (Step 3 adds the `slots.spec.ts` case).

**Task type:** code

**Skills used:** typescript-conventions, declarative-naming

**Depends on:** — (first step; #35 and #36 landed: `Feature<In, Out>`, `Feature.displayName`,
`describeFeature(position, displayName?)`)
**Parallel-safe with:** —

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/engine/slots.ts` (edit)

## Why This Step Exists

Issue AC 6: a member/stage/render-stage collision *inside* a composite must throw "with a
label naming the composite and the inner position". The registry's collision messages take
the claimant label verbatim, so the only new piece is a third label shape. It lives with the
other two so the three claimant vocabularies (`feature N`, `internal feature N`,
`composeFeatures inner feature N`) are defined in one place.

## What To Do

1. Add to `engine/slots.ts`, after `describeInternalFeature`:

   ```ts
   /** Names a feature nested inside `composeFeatures()` by its 1-based position within the
    * composite. The composite's own argument position is not known at runtime — a `Feature`
    * receives only the store — so the label names the composite by kind. */
   export function describeInnerFeature(position: number, displayName?: string): string {
     const base = `composeFeatures inner feature ${position}`;
     return displayName ? `${base} (${displayName})` : base;
   }
   ```

2. Leave `describeFeature` / `describeInternalFeature` / `SlotRegistry` untouched.

## Implementation Notes

- Same `(position, displayName?)` shape as `describeFeature` so a composite can label its
  inner features with the same `labelFeatures`-style loop (`index + 1`, `feature.displayName`).
- Do not try to thread the outer position in. The `Feature` call contract is `(input: In)`
  (#35, settled); widening it for a message is out of scope. The outer registry still names
  the composite's slot (`feature 2 (composeFeatures)`) for any collision that crosses the
  composite boundary.

## Risks / Watchouts

- Nested composites: an inner composite's own inner collisions read
  `composeFeatures inner feature 1 (…)` with no depth marker. Accepted; recorded for #44.

## Non-Goals

- No `composeFeatures()` (Step 2). No message template changes in `SlotRegistry`.

## Acceptance Checks

- [ ] `describeInnerFeature(2)` → `composeFeatures inner feature 2`.
- [ ] `describeInnerFeature(1, 'withSorting')` → `composeFeatures inner feature 1 (withSorting)`.
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` passes.

---
[Step 2: compose-features.ts + index.ts — composeFeatures()](step-2-compose-features.plan.md) →
