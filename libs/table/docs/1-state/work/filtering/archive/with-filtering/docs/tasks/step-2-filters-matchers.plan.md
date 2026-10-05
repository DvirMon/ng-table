---
title: 'Step 2 — Matchers'
type: task-step
issue: 61
---

# Step 2 — Matchers

**PR scope:** Parallel-safe with Step 1 — pure functions, no dependency on the recorder/session
types. Merge order doesn't matter between the two; both must land before Step 4/5.

**Task type:** code

**Skills used:** typescript-conventions

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/filters/matchers.ts` (new)

## Why This Step Exists

`filters.md`'s Matchers table pairs every declaration rule with a plain binary predicate,
exported so a custom `filter()` call can compose from shipped parts (R30) instead of writing
matching logic from scratch. Rule functions (Step 5) use these as their default predicates.

## What To Do

1. Implement each matcher per `filters.md`'s Matchers table and Semantics section:

   ```ts
   export function isEqual<T>(cell: T, criterion: T): boolean {
     return notNullish(cell) && cell === criterion;
   }

   export function isContaining(cell: string, criterion: string): boolean {
     return notNullish(cell) && cell.toLowerCase().includes(criterion.toLowerCase());
   }

   export function isInRange(
     cell: number,
     criterion: { min: number | null; max: number | null },
   ): boolean {
     if (!notNullish(cell)) return false;
     if (criterion.min != null && cell < criterion.min) return false;
     if (criterion.max != null && cell > criterion.max) return false;
     return true;
   }

   export function isInDateRange(
     cell: Date,
     criterion: { from: Date | null; to: Date | null },
   ): boolean {
     if (!notNullish(cell)) return false;
     if (criterion.from != null && cell < criterion.from) return false;
     if (criterion.to != null && cell > criterion.to) return false;
     return true;
   }

   export function hasAnyOf<T>(cell: readonly T[], criterion: readonly T[]): boolean {
     return notNullish(cell) && criterion.some((c) => cell.includes(c));
   }

   export function hasNoneOf<T>(cell: readonly T[], criterion: readonly T[]): boolean {
     return cell == null || !criterion.some((c) => cell.includes(c));
   }
   ```

2. **Null/undefined cell policy (R27), guarded per-matcher, never centrally:** every positive
   matcher (`isEqual`, `isContaining`, `isInRange`, `isInDateRange`, `hasAnyOf`) returns `false`
   for a `null`/`undefined` cell; `hasNoneOf` returns `true`. A small shared `notNullish` helper
   is fine (it's a one-line guard, not shared matching logic), but each matcher calls it itself —
   don't hoist the null check into a caller/runner, since `filters.md` is explicit that a custom
   `filter()` predicate receives the cell **unguarded** and may match nulls itself.

3. `''` has no special status (per Semantics) — `isContaining('', 'x')` is just an ordinary
   string comparison, not treated as empty here. Emptiness is a separate concern (each rule's
   `isEmpty`, Step 5), not the matcher's job.

## Implementation Notes

- Pure functions only — no signals, no Angular imports. Same "everything in `engine/` except
  `compose-table.ts` is pure" testing discipline applies here by extension: test with plain
  `vitest`, no `TestBed`.
- Generic type parameters (`<T>`) over `unknown`/`any` per `typescript-conventions.md`.

## Risks / Watchouts

- Don't let `isInRange`/`isInDateRange` throw on a criterion shaped `{min:null,max:null}` — that
  shape is what `isEmpty` (Step 5) exists to filter out _before_ the matcher runs, but the
  matcher itself should still degrade gracefully (both bounds `null` → matches everything) rather
  than assume it's unreachable.

## Non-Goals

- No emptiness tests (`isEmpty` lives with each rule in Step 5, since emptiness is per-predicate
  by declaration, not a property of the matcher alone).

## Acceptance Checks

- [ ] All six matchers exported, generic where the criterion type varies
- [ ] Every positive matcher returns `false` for a null/undefined cell; `hasNoneOf` returns `true`
- [ ] No matcher throws on a fully-empty criterion (`{min:null,max:null}`, `[]`, `''`)
- [ ] No signals/Angular imports in this file

---

← [Step 1: Filter types](step-1-filters-types.plan.md) | [Step 3: Matchers spec](step-3-filters-matchers-spec.plan.md) →
