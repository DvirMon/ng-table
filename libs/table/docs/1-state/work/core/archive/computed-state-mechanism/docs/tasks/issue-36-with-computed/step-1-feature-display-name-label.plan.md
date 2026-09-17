---
title: "Step 1 — engine/types.ts + slots.ts + compose-table.ts: optional Feature.displayName, fold label appends it"
type: task-step
issue: 70
---

# Step 1 — `engine/types.ts` + `slots.ts` + `compose-table.ts`: optional `Feature.displayName`, fold label appends it

**PR scope:** Engine only. A feature may carry a name; the fold's claimant label shows it.
No feature sets it yet — Step 2's `withComputed()` is the first. One new case in
`slots.spec.ts`; `compose-table.spec.ts` untouched.

**Task type:** code

**Skills used:** typescript-conventions, declarative-naming, general-mechanism-over-enumerated-cases

**Depends on:** — (first step; #35 landed: `Feature<In, Out>`, store-only fold, `labelFeatures()`)
**Parallel-safe with:** —

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/engine/types.ts` (edit)
- `libs/shared/table/src/engine/slots.ts` (edit)
- `libs/shared/table/src/engine/compose-table.ts` (edit)
- `libs/shared/table/src/engine/slots.spec.ts` (edit — one case)

## Why This Step Exists

Spec "Derived state": derived members are claimed through the existing registry "with a
claimant label naming the feature and the block rather than a bare argument position".
Architecture, `slots.ts` row: labels "name a derive block distinctly". Today the label is
`feature N` only. The general mechanism is a name any feature may declare — not a
derive-specific branch in the fold (D28: the fold never special-cases a derive feature).
Decided at `/to-tasks` 2026-09-13 over a `key in input` pre-check inside `withComputed()`,
which would have made the block a second collision authority next to the registry (ADR-0007).

## What To Do

1. **`engine/types.ts`** — the `Feature` interface gains one optional property:

   ```ts
   export interface Feature<In extends Shape, Out extends object> {
     (input: In): TableFeatureSpec<RowOf<In>, Out>;
     /** Shown in collision messages after the argument position, e.g. `feature 3 (withComputed)`. */
     readonly displayName?: string;
   }
   ```

2. **`engine/slots.ts`** — `describeFeature(position, displayName?)`:

   ```ts
   export function describeFeature(position: number, displayName?: string): string {
     const base = `feature ${position}`;
     return displayName ? `${base} (${displayName})` : base;
   }
   ```

   `describeInternalFeature` unchanged.

3. **`engine/compose-table.ts`** — `labelFeatures()` passes `feature.displayName` through to
   `describe`. The `describe` parameter type becomes
   `(position: number, displayName?: string) => string`; `describeInternalFeature` still fits
   (extra argument ignored).

4. **`slots.spec.ts`** — one case: `describeFeature(3, 'withComputed')` is
   `'feature 3 (withComputed)'`; the existing no-name case stays.

## Implementation Notes

- A `Feature` is a function; `displayName` is an own property on it, set by the factory that
  returns it (`Object.assign(fn, { displayName })` — no cast needed, the assigned object type
  satisfies the interface).
- `createTableFeature(factory, derive)` (#35 Step 5) returns a new function when a derive
  block is supplied; it does **not** propagate a name in this issue. A shipped feature that
  wants a name sets it itself when converted (#38–#40). Say nothing about that in code.
- No change to the collision message templates in `SlotRegistry` — the label already flows
  through `claimMember`/`claimStage`/`claimRenderStage` verbatim.

## Risks / Watchouts

- `AnyTableFeature` is `Feature<any, any>` — `displayName` must remain optional or every
  synthetic feature in the specs stops compiling.
- Do not read `fn.name`: minified builds and arrow functions make it meaningless.

## Non-Goals

- No `withComputed()` (Step 2). No name on any shipped feature.

## Acceptance Checks

- [ ] `Feature.displayName` is optional and `readonly`.
- [ ] `describeFeature(2)` → `feature 2`; `describeFeature(3, 'withComputed')` →
      `feature 3 (withComputed)`.
- [ ] A synthetic feature carrying `displayName: 'x'` composed at position 1 that collides
      with a core key produces a message containing `feature 1 (x)` (scratch check; the
      committed runtime case is Step 3).
- [ ] `engine/` compiles; existing `slots.spec.ts` and `compose-table.spec.ts` cases unchanged.

---
[Step 2: with-computed.ts + index.ts — withComputed()](step-2-with-computed.plan.md) →
