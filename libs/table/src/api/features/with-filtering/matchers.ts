/**
 * Plain binary predicates behind each declaration rule (see `features/filtering.md`'s Matchers
 * table).
 * Exported so a custom `filter()` predicate composes from shipped parts instead of writing
 * matching logic from scratch. Pure functions only — no signals, no Angular imports.
 */

/** Every positive matcher guards its own cell — never hoisted into a caller/runner. */
function notNullish<T>(value: T | null | undefined): value is T {
  return value != null;
}

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
