import {
  hasAnyOf,
  hasNoneOf,
  isContaining,
  isEqual,
} from '../../../api/features/with-filtering/matchers';
import { STATUS_OPTIONS } from './mock';
import type { DateRangeCriterion, InvoiceStatus, RangeCriterion, TagCriterion } from './types';

export const EMPTY_RANGE: RangeCriterion = { min: null, max: null };
export const EMPTY_TAG_CRITERION: TagCriterion = { include: [], exclude: [] };

/** The compound tags predicate. An empty `include` must not narrow, so it is checked before
 * `hasAnyOf` — `hasAnyOf(cell, [])` is `false`, which would hide every row. */
export function matchesTagCriterion(cell: string[], criterion: TagCriterion): boolean {
  const isIncluded = criterion.include.length === 0 || hasAnyOf(cell, criterion.include);
  const isNotExcluded = hasNoneOf(cell, criterion.exclude);
  return isIncluded && isNotExcluded;
}

export function isEmptyTagCriterion(criterion: TagCriterion): boolean {
  return criterion.include.length === 0 && criterion.exclude.length === 0;
}

/**
 * The status select's predicate. `equals()` is not used here: its criterion always carries the
 * rule's own `null` empty, and a native `<select>` writes `''` — so `filter()` with an explicit
 * `string` criterion is what lets `[formField]` bind straight to the control with no accessor.
 * `{ emptyValue: '' }` is still what makes `<option value="">` deactivate the filter.
 */
export function matchesStatus(cell: InvoiceStatus, criterion: string): boolean {
  return isEqual<string>(cell, criterion);
}

/** The quick filter's numeric leg. The library never stringifies a cell for you — the
 * conversion is the consumer's, written once, in the open. */
export function matchesInvoiceNumber(cell: number, criterion: string): boolean {
  return isContaining(String(cell), criterion);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isDateOrNull(value: unknown): value is Date | null {
  return value === null || value instanceof Date;
}

export function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return STATUS_OPTIONS.some((status) => status === value);
}

export function isRangeCriterion(value: unknown): value is RangeCriterion {
  return (
    isRecord(value) &&
    'min' in value &&
    'max' in value &&
    isNumberOrNull(value['min']) &&
    isNumberOrNull(value['max'])
  );
}

export function isDateRangeCriterion(value: unknown): value is DateRangeCriterion {
  return (
    isRecord(value) &&
    'from' in value &&
    'to' in value &&
    isDateOrNull(value['from']) &&
    isDateOrNull(value['to'])
  );
}

export function isTagCriterion(value: unknown): value is TagCriterion {
  return (
    isRecord(value) &&
    'include' in value &&
    'exclude' in value &&
    isStringArray(value['include']) &&
    isStringArray(value['exclude'])
  );
}

/** `<input type="date">` binds `Date | null` natively through Signal Forms, so this is only for
 * *rendering* a bound as text — a cell label, a summary chip. */
export function toDateInputValue(date: Date | null): string {
  return date === null ? '' : date.toISOString().slice(0, 10);
}

function formatDateBound(date: Date | null): string {
  return date === null ? '∗' : toDateInputValue(date);
}

/** One-line label for a summary-row entry. Reads a criterion whose shape the row does not know
 * statically — `filters().criteria()` is keyed by name, not by rule kind. */
export function formatCriterion(value: unknown): string {
  if (isRangeCriterion(value)) {
    return `${value.min ?? '∗'} – ${value.max ?? '∗'}`;
  }
  if (isDateRangeCriterion(value)) {
    return `${formatDateBound(value.from)} – ${formatDateBound(value.to)}`;
  }
  if (isTagCriterion(value)) {
    const include = value.include.length > 0 ? `any of ${value.include.join(', ')}` : '';
    const exclude = value.exclude.length > 0 ? `none of ${value.exclude.join(', ')}` : '';
    return [include, exclude].filter((part) => part !== '').join(' · ');
  }
  if (isStringArray(value)) {
    return value.join(', ');
  }
  return String(value);
}

/** Toggles one option in a multi-select list, preserving the declared option order. */
export function toggleOption(
  selected: readonly string[],
  option: string,
  options: readonly string[],
): readonly string[] {
  const isSelected = selected.includes(option);
  const next = isSelected ? selected.filter((entry) => entry !== option) : [...selected, option];
  return options.filter((entry) => next.includes(entry));
}
