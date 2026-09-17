# Step 3 — Accumulating `collapsedRows` slot + feature plumbing

**PR scope:** The new feature-contract slot, its collection during the fold, and
`withExpansion()` declaring it. Registered but unread — the prune arrives in Step 4.
**Depends on:** Step 1 (the ADR settles the slot's polarity, which fixes its type and name).
**Task type:** `code`
**Skills used:** `angular-developer`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Action |
|---|---|
| `libs/shared/table/src/engine/types.ts` | edit — add the slot to `TableFeatureSpec` |
| `libs/shared/table/src/engine/compose-table.ts` | edit — collect contributions during the fold |
| `libs/shared/table/src/engine/core.ts` | edit — hold the contributions on `TableCoreHandle` |
| `libs/shared/table/src/api/create-table-feature.ts` | edit — add to `PIPELINE_BEHAVIOR_KEYS`, pass through |
| `libs/shared/table/src/api/features/with-expansion.ts` | edit — declare the slot |

## Why This Step Exists

The prune (Step 4) needs a source for its collapsed set, and that source is a new kind of slot —
the engine's first accumulating one. Landing the registration path separately from the pass that
consumes it keeps two distinct review questions apart: *is this the right contract shape* here,
and *is the pass correct* in Step 4.

Gated on Step 1 because the ADR decides whether features contribute an **expanded** set or a
**collapsed** one. That answer changes the member's name, its type, and the prune's rule.

## What To Do

**Read the ADR first.** Everything below assumes the polarity candidate in Step 1 was adopted —
features contribute `expandedRows` as-is. If the ADR chose otherwise, follow the ADR and adjust
the name and semantics accordingly; the structure of this step is unchanged either way.

### `engine/types.ts` — `TableFeatureSpec` (lines 53-68)

Add beside `renderStages` (line 68):

```ts
// Ids whose descendants the terminal prune keeps visible. Read-only — the engine never writes
// a feature's state; the feature keeps owning the set, its verbs, and its `onRowsRemoved`
// obligation. UNLIKE every other slot this one ACCUMULATES rather than single-claims: ADR-0012
// gives the panel and tree features independent open-id sets and requires both to compose on
// one table. See ADR-0017.
collapsedRows?: Signal<ReadonlySet<RowId>>;
```

Name and doc wording follow the ADR. If the ADR adopts expanded-set polarity, consider whether
`collapsedRows` is still the honest name — `expandedRows` or `visibleParents` may read truer. The
ADR decides; do not leave the name at odds with its semantics.

### `engine/compose-table.ts` (around lines 103-110)

The render-stage loop claims through `SlotRegistry`. This slot does **not** claim — it appends.
Collect each feature's contribution into an array on the handle, in fold order. No collision check,
no `SlotRegistry` involvement.

### `engine/core.ts`

`TableCoreHandle` (around lines 11-20) gains the array — `readonly collapsedSources:
Signal<ReadonlySet<RowId>>[]` — initialized empty at line ~40 beside `renderStages`, mutated
additively by `composeTable()`'s fold, exactly as `columnRules` already is.

**Do not wire it into the `renderRows` computed yet.** That is Step 4.

### `api/create-table-feature.ts`

`PIPELINE_BEHAVIOR_KEYS` (line 62) is the list a derive block may not declare. The new slot is a
pipeline behavior, so add it — a `withComputed()` block must not be able to contribute one. Pass it
through at line ~88 alongside `renderStages`.

### `api/features/with-expansion.ts`

Declare the slot in the returned `TableFeatureSpec`. The feature already holds the signal it needs;
this is handing over a read-only reference, not building new state.

Nothing about the feature's existing members, verbs, or `onRowsRemoved` changes.

## Implementation Notes

The slot is deliberately not a `SlotRegistry` claim. That registry exists for single-occupancy
collisions, and using it here would produce the throw ADR-0012's verification plan forbids
(composing `[withExpansion(), withTree()]` must construct cleanly).

`columnRules` is the existing precedent for an additively-populated array on the handle — follow
its shape rather than inventing a different one.

## Risks / Watchouts

- **Do not reach for `SlotRegistry`.** Every other slot claims; this one is the documented
  exception, and the reason belongs in the code comment so the next reader does not "fix" it.
- **The engine must never write the set.** The declared type is `Signal`, not `WritableSignal`.
  Keep it that way.
- Adding a key to `TableFeatureSpec` widens a contract that `create-table-feature.ts` mirrors. Both
  must move together or a feature's contribution is silently dropped.
- `api/types.ts` ↔ `engine/types.ts` is a deliberate **type-only** import cycle. If `Signal` or
  `RowId` needs importing, keep it `import type`; a value import breaks the build.

## Non-Goals

- No prune, no `RENDER_ORDER` change, no `runRenderStages` signature change.
- `withGrouping()` declares nothing here — group collapse is the panel feature's job per ADR-0012
  decision 5, and today `withExpansion()` is that feature.
- No tests — Step 5 covers two contributors composing.

## Acceptance Checks

- [ ] Slot on `TableFeatureSpec`, read-only `Signal`, with a comment naming ADR-0012 as the reason it accumulates.
- [ ] Contributions collected in fold order on `TableCoreHandle`; no `SlotRegistry` claim.
- [ ] Added to `PIPELINE_BEHAVIOR_KEYS` and passed through in `create-table-feature.ts`.
- [ ] `withExpansion()` declares it; its members and hooks are otherwise unchanged.
- [ ] Nothing reads the array yet — `renderRows` in `core.ts` is untouched.
- [ ] Name and semantics match what the ADR settled.
- [ ] `nx run shared-table:typecheck` clean — re-run after fixing any `.ts` error.

---
← [Step 2: `RenderRow.parentId`](step-2-parent-id.plan.md) | [Step 4: `'prune'` stage](step-4-prune-stage.plan.md) →
