---
title: "Step 1 — slots.ts: core-key pre-claim API and positional claimant labels"
type: task-step
issue: 68
---

# Step 1 — slots.ts: core-key pre-claim API and positional claimant labels

**PR scope:** Additive change to `SlotRegistry` only. Nothing calls the new method yet, so no
existing spec changes and no runtime behavior changes. Lands green on its own.

**Task type:** code

**Skills used:** typescript-conventions, file-organization, declarative-naming

**Depends on:** none (foundational for this issue)

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/engine/slots.ts` (edit)

## Why This Step Exists

D4 (`3-decisions.md`): `SlotRegistry` claims `rows`, `value`, `columns`, `trackBy`, `renderRows`
before the fold, so a feature declaring one throws at construction like any other member
collision (ADR-0007). `totalRowCount` stays unclaimed because `TableStore`'s own doc comment
promises pagination/virtualization may override it (ADR-0005). The registry is pure and already
unit-tested standalone, so the claim vocabulary lands here first and the fold (Step 3) only
calls it.

The same file owns `describeFeature()`, whose `features[${index}]` text is the off-by-one the
issue names: `create-table.ts` splices the column-schema wiring as array entry 0, so a consumer's
first feature reports as `features[1]`. Decision at `/to-tasks` (2026-09-12): labels become
**1-based argument positions** now (`feature 1`), matching the positional `createTable()` #69
lands immediately after, rather than fixing the 0-based index and relabeling a second time.

## What To Do

1. Add the core-key vocabulary, typed against the public store so the list cannot drift from
   `TableStore` (`file-organization.md`: splitting must not duplicate a declaration):

   ```ts
   import type { TableStore } from '../api/types';

   /** ADR-0005: the one core member a feature may override. */
   type OverridableCoreKey = 'totalRowCount';
   type ClaimedCoreKey = Exclude<keyof TableStore<unknown>, OverridableCoreKey>;

   /** D4: pre-claimed before the fold. `totalRowCount` is deliberately absent (ADR-0005). */
   export const CORE_MEMBER_KEYS = [
     'columns',
     'rows',
     'trackBy',
     'value',
     'renderRows',
   ] as const satisfies readonly ClaimedCoreKey[];

   // Completeness guard: fails to compile if `TableStore` grows a non-overridable member
   // that the list above does not claim.
   type MissingCoreKey = Exclude<ClaimedCoreKey, (typeof CORE_MEMBER_KEYS)[number]>;
   const _everyCoreKeyIsClaimed: MissingCoreKey extends never ? true : never = true;

   export const CORE_CLAIMANT = 'core';
   ```

2. Add the pre-claim method to `SlotRegistry`, reusing `claimMember` so the collision message
   is the existing ADR-0007 one with `core` as the current owner:

   ```ts
   /** D4: claims every non-overridable core member key under the `core` label. */
   claimCoreMembers(): void {
     for (const key of CORE_MEMBER_KEYS) {
       this.claimMember(key, CORE_CLAIMANT);
     }
   }
   ```

3. Relabel `describeFeature` to a 1-based argument position, and add a sibling for the internal
   wiring `composeTable()` folds before consumer features (Step 3 introduces that channel):

   ```ts
   /** Names a consumer feature by its 1-based argument position, for collision messages. */
   export function describeFeature(position: number): string {
     return `feature ${position}`;
   }

   /** Names an engine-internal feature (e.g. column-schema wiring) that never has a consumer position. */
   export function describeInternalFeature(position: number): string {
     return `internal feature ${position}`;
   }
   ```

   Update the two existing `features\[N\]` regex assertions in `slots.spec.ts` and
   `compose-table.spec.ts` only if they fail to compile or pass — they pass a literal label
   string into the registry, so most stay untouched. The `describeFeature` unit test's expected
   string does change: `'feature 2'` for input `2`.

## Implementation Notes

- The `_everyCoreKeyIsClaimed` sentinel is the one place a type-only assertion is used as a
  runtime const; prefix it with `_` and mark it `// eslint-disable-next-line
  @typescript-eslint/no-unused-vars` if the linter objects. A `satisfies` alone only checks that
  each entry is a valid key; the sentinel is what checks the list is *complete*.
- `TableStore<unknown>` is the right instantiation for `keyof` — the member names do not depend
  on `TRow`.
- Keep the generic collision message. D4 says "like any other member collision"; a dedicated
  core-specific sentence is not owed and would fork the message format.

## Risks / Watchouts

- **Do not claim `totalRowCount`.** The ADR-0005 override path is a stated contract on
  `TableStore` and Step 2/4 assert it composes without throwing.
- `slots.ts` importing from `../api/types` is type-only; keep it `import type` so the engine
  stays free of a runtime dependency on the api layer.
- Changing `describeFeature`'s text does not change which index the fold passes — that is
  Step 3. Until Step 3 lands, `composeTable` still reports 0-based `feature 0` for the first
  entry; acceptable for the intermediate commit since the fold is engine-internal.

## Non-Goals

- No call to `claimCoreMembers()` from the fold — Step 3.
- No change to `claimStage` / `claimRenderStage` semantics.
- No derive-block label (`withComputed` naming) — #70.

## Acceptance Checks

- [ ] `tsc --noEmit` passes for `libs/shared/table`.
- [ ] `CORE_MEMBER_KEYS` contains exactly `columns`, `rows`, `trackBy`, `value`, `renderRows`;
      adding a member to `TableStore` without listing it here is a compile error.
- [ ] `SlotRegistry.claimCoreMembers()` exists and a second `claimMember('rows', 'feature 1')`
      after it throws with `core and feature 1 both provide the "rows" store member`.
- [ ] `describeFeature(1)` returns `feature 1`; `describeInternalFeature(1)` returns
      `internal feature 1`.

---
[Step 2: Registry spec — core-key pre-claim →](step-2-slots-spec-core-key-preclaim.plan.md)
