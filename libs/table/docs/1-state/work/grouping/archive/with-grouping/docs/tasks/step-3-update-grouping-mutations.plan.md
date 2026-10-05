---
title: 'Step 3 — mutations/update-grouping.ts'
type: task-step
issue: 6
---

# Step 3 — `mutations/update-grouping.ts`

**PR scope:** Parallel-safe with Step 2 (both depend only on Step 1's types, no edge between
them). Only needs `ColumnId<TRow>`/`GroupingUpdater<TRow>` from Step 1 — nothing from the
clustering engine.

**Task type:** code

**Skills used:** angular-developer, file-organization

**Scaffolding agent:** angular-implementer

**Depends on:** Step 1
**Parallel-safe with:** Step 2

## Files

- `libs/shared/table/src/mutations/update-grouping.ts` (new)
- `libs/shared/table/src/mutations/update-grouping.spec.ts` (new)

## Why This Step Exists

D1's write surface is `table.grouping.update(updater)` — pure updater factories, not bare
setters, matching `mutations/update-columns.ts`'s existing shape (`setColumns`,
`reorderColumns`, `toggleColumnVisibility`). This step is that file's grouping counterpart:
`setGroupLevels`, `addGroupLevel`, `removeGroupLevel`, `reorderGroupLevels`.

Spec: `../../3-spec.md`, "Public surface" (D1). Testing Decisions: "Setting, adding, removing,
and reordering group levels each produce the expected `grouping` array; removing an id not
present, and adding one already present, are no-ops."

## What To Do

Follow `mutations/update-columns.ts`'s file shape exactly — a flat list of small exported
functions, each returning a `GroupingUpdater<TRow>` closure, no shared internal state:

```ts
import type { ColumnId, GroupingUpdater } from '../api/types';

/** Replaces the full ordered level list. */
export function setGroupLevels<TRow>(levels: ColumnId<TRow>[]): GroupingUpdater<TRow> {
  return () => levels as string[];
}

/** Appends (or inserts at `index`) a level. Already-present id is a no-op — a level can only
 * be active once. */
export function addGroupLevel<TRow>(id: ColumnId<TRow>, index?: number): GroupingUpdater<TRow> {
  return (grouping) => {
    if (grouping.includes(id as string)) {
      return grouping;
    }
    const next = [...grouping];
    next.splice(index ?? next.length, 0, id as string);
    return next;
  };
}

/** Removes a level by id. Id not present is a no-op. */
export function removeGroupLevel<TRow>(id: ColumnId<TRow>): GroupingUpdater<TRow> {
  return (grouping) => grouping.filter((level) => level !== (id as string));
}

/** Moves the level at `from` to `to`. Out-of-range indices are a no-op — never throws (this is
 * a runtime write path, not construction-time config; D14's throw/degrade split does not apply
 * to index bounds, only to column ids). */
export function reorderGroupLevels<TRow>(from: number, to: number): GroupingUpdater<TRow> {
  return (grouping) => {
    const inBounds = from >= 0 && from < grouping.length && to >= 0 && to < grouping.length;
    if (!inBounds) {
      return grouping;
    }
    const next = [...grouping];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  };
}
```

Write `update-grouping.spec.ts` calling each factory directly against plain `string[]` inputs —
no store, no `createTable()` needed (mirrors `mutations/update-columns.spec.ts`'s style). Cover:

- `setGroupLevels` replaces wholesale.
- `addGroupLevel` appends by default, inserts at `index` when given, no-ops when the id is
  already present.
- `removeGroupLevel` removes a present id, no-ops on an absent one.
- `reorderGroupLevels` moves an element from one index to another; no-ops on an out-of-range
  `from`/`to`.

## Implementation Notes

- These are **not** wired to a store here — no `withGrouping()` import, no `createTable()`. Pure
  array-in, array-out functions, consumed later via `table.grouping.update(setGroupLevels([...]))`
  once Step 4 exists. This mirrors how `update-columns.ts` has zero dependency on
  `with-sorting.ts`/`api/create-table.ts`.
- `ColumnId<TRow>` values are cast to `string` at the boundary (`as string`) — same pattern
  `ColumnDefInput`/`setColumns` already accept string ids without re-deriving a narrower type.
  Not a bare unchecked assertion in the sense `typescript-conventions.md` warns against: `string
& {}` in `ColumnId<TRow>`'s definition already collapses to `string` structurally, this is a
  widening cast, not a narrowing one.

## Risks / Watchouts

- Don't special-case `addGroupLevel`'s `index` clamping beyond what `Array.prototype.splice`
  already does (an out-of-range `index` splices at the nearest valid end) — no extra bounds
  logic needed there, unlike `reorderGroupLevels`, which must explicitly no-op instead of
  letting `splice` silently do something unintended with an invalid `from`/`to`.

## Non-Goals

- No `groupingRule`/rules-array/schema-fn config layer (#26) — these four are the entire write
  surface for this issue.
- No validation against a live `columns` list here — an updater is a pure `string[] =>
string[]` function with no store access; the unknown-id degrade (D14) happens downstream, in
  the pipeline/render stages (Step 1/2), not in the updater itself.

## Acceptance Checks

- [ ] `setGroupLevels`, `addGroupLevel`, `removeGroupLevel`, `reorderGroupLevels` all exported,
      typed `GroupingUpdater<TRow>`.
- [ ] Removing an absent id and adding a present id are both no-ops (return semantically
      equivalent arrays).
- [ ] `reorderGroupLevels` no-ops on out-of-range indices rather than throwing or corrupting the
      array.
- [ ] `tsc --noEmit` passes; `update-grouping.spec.ts` passes under plain `vitest`.

---

← [Step 2: Render-stage group headers + aggregates](step-2-render-stage-aggregates.plan.md) | [Step 4: with-grouping.ts feature plugin + barrel export](step-4-with-grouping-feature.plan.md) →
