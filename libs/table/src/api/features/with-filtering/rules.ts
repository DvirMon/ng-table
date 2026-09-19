import type {
  CriterionOf,
  FilterHandle,
  FilterRule,
  FilterRuleRecord,
  GroupRule,
  ItemOf,
  RowOfRule,
} from '../../../engine/filters/types';
import type { FilterOptions } from './types';
import { equalsCriterion } from '../../../engine/filters/state';
import {
  hasAnyOf,
  hasNoneOf,
  isContaining,
  isEqual,
  isInDateRange,
  isInRange,
} from './matchers';

// The declaration rules called inside a `withFiltering` schema body. Each builds and *returns*
// its own `FilterRule`, keyed later by the object property it's assigned to — bare verbs
// (`equals`, `contains`, …), as opposed to the boolean-guard-prefixed matchers (`isEqual`,
// `isContaining`, …) they default to.
//
// Every rule erases its generics to `FilterRuleRecord<TRow>`'s `unknown` storage shape via
// `as` — sound because the erased type only ever round-trips through the record's own
// `key`/`paths` at read time (`build.ts`), never re-derived structurally. `key` itself
// is never part of the returned literal; `build.ts` stamps it from the schema
// object's own property name.

/** A closed numeric range — either bound `null` for unbounded. */
export type RangeCriterion = { min: number | null; max: number | null };
/** A closed date range — either bound `null` for unbounded. */
export type DateRangeCriterion = { from: Date | null; to: Date | null };

function isEmptyRange(criterion: RangeCriterion): boolean {
  return criterion.min == null && criterion.max == null;
}

function isEmptyDateRange(criterion: DateRangeCriterion): boolean {
  return criterion.from == null && criterion.to == null;
}

interface Emptiness {
  readonly isEmpty: (criterion: unknown) => boolean;
  readonly emptyValue: unknown;
}

// Precedence: `isEmpty` replaces the rule's own check; `emptyValue` extends it
// (`fallback.isEmpty(v) || equalsCriterion(v, override)`) and seeds the empty value; with
// neither, the rule's own check holds.
function resolveEmptiness(
  options: { readonly emptyValue?: unknown; readonly isEmpty?: unknown } | undefined,
  fallback: Emptiness
): Emptiness {
  const explicit = options?.isEmpty as ((v: unknown) => boolean) | undefined;
  const override = options?.emptyValue;
  if (explicit) {
    return {
      emptyValue: override === undefined ? fallback.emptyValue : override,
      isEmpty: explicit,
    };
  }
  if (override === undefined) {
    return fallback;
  }
  return {
    emptyValue: override,
    isEmpty: (v: unknown): boolean => fallback.isEmpty(v) || equalsCriterion(v, override),
  };
}

export function equals<TRow, K extends Extract<keyof TRow, string>, const TEmpty = never>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<TRow[K] | null | TEmpty, TRow> & { readonly emptyValue?: TEmpty }
): FilterRule<TRow[K] | null | TEmpty, TRow> {
  const { isEmpty, emptyValue } = resolveEmptiness(options, {
    isEmpty: (v: unknown) => v == null,
    emptyValue: null,
  });
  return {
    kind: 'single',
    paths: [path.id],
    predicate: isEqual as (cell: unknown, criterion: unknown) => boolean,
    isEmpty,
    emptyValue,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies Omit<FilterRuleRecord<TRow>, 'key'> as FilterRule<TRow[K] | null | TEmpty, TRow>;
}

export function contains<TRow, K extends Extract<keyof TRow, string>>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<string, TRow>
): FilterRule<string, TRow> {
  const { isEmpty, emptyValue } = resolveEmptiness(options, {
    isEmpty: (v: unknown) => v === '',
    emptyValue: '',
  });
  return {
    kind: 'single',
    paths: [path.id],
    predicate: isContaining as (cell: unknown, criterion: unknown) => boolean,
    isEmpty,
    emptyValue,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies Omit<FilterRuleRecord<TRow>, 'key'> as FilterRule<string, TRow>;
}

export function inRange<TRow, K extends Extract<keyof TRow, string>>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<RangeCriterion, TRow>
): FilterRule<RangeCriterion, TRow> {
  const { isEmpty, emptyValue } = resolveEmptiness(options, {
    isEmpty: (v: unknown) => isEmptyRange(v as RangeCriterion),
    emptyValue: { min: null, max: null } as RangeCriterion,
  });
  return {
    kind: 'single',
    paths: [path.id],
    predicate: isInRange as unknown as (cell: unknown, criterion: unknown) => boolean,
    isEmpty,
    emptyValue,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies Omit<FilterRuleRecord<TRow>, 'key'> as FilterRule<RangeCriterion, TRow>;
}

export function inDateRange<TRow, K extends Extract<keyof TRow, string>>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<DateRangeCriterion, TRow>
): FilterRule<DateRangeCriterion, TRow> {
  const { isEmpty, emptyValue } = resolveEmptiness(options, {
    isEmpty: (v: unknown) => isEmptyDateRange(v as DateRangeCriterion),
    emptyValue: { from: null, to: null } as DateRangeCriterion,
  });
  return {
    kind: 'single',
    paths: [path.id],
    predicate: isInDateRange as unknown as (cell: unknown, criterion: unknown) => boolean,
    isEmpty,
    emptyValue,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies Omit<FilterRuleRecord<TRow>, 'key'> as FilterRule<DateRangeCriterion, TRow>;
}

export function hasAny<TRow, K extends Extract<keyof TRow, string>, TItem = ItemOf<TRow[K]>>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<readonly TItem[], TRow>
): FilterRule<readonly TItem[], TRow> {
  const { isEmpty, emptyValue } = resolveEmptiness(options, {
    isEmpty: (v: unknown) => Array.isArray(v) && v.length === 0,
    emptyValue: [] as readonly TItem[],
  });
  return {
    kind: 'single',
    paths: [path.id],
    predicate: hasAnyOf as (cell: unknown, criterion: unknown) => boolean,
    isEmpty,
    emptyValue,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies Omit<FilterRuleRecord<TRow>, 'key'> as FilterRule<readonly TItem[], TRow>;
}

export function hasNone<TRow, K extends Extract<keyof TRow, string>, TItem = ItemOf<TRow[K]>>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<readonly TItem[], TRow>
): FilterRule<readonly TItem[], TRow> {
  const { isEmpty, emptyValue } = resolveEmptiness(options, {
    isEmpty: (v: unknown) => Array.isArray(v) && v.length === 0,
    emptyValue: [] as readonly TItem[],
  });
  return {
    kind: 'single',
    paths: [path.id],
    predicate: hasNoneOf as (cell: unknown, criterion: unknown) => boolean,
    isEmpty,
    emptyValue,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies Omit<FilterRuleRecord<TRow>, 'key'> as FilterRule<readonly TItem[], TRow>;
}

// `TCriterion` has two inference sites — the predicate's second parameter and
// `options.isEmpty`. A mismatch between the two is a hard `TS2322` at the `options` argument,
// not a silent widening to a union or to `unknown` — the predicate site is inferred first and
// wins; `NoInfer` on `FilterOptions.isEmpty` keeps the callback from contributing back.
/**
 * A predicate-driven filter rule, peer to the named rules — `cell` arrives unguarded, so a
 * custom predicate can itself choose to match nulls.
 *
 * @remarks
 * Emptiness isn't inferable for an arbitrary criterion, so `isEmpty`/`emptyValue` opt in to
 * the named rules' skip-when-empty behavior. With neither, this filter is never empty.
 */
export function filter<TRow, K extends Extract<keyof TRow, string>, TCriterion>(
  path: FilterHandle<TRow, K>,
  predicate: (cell: TRow[K], criterion: TCriterion) => boolean,
  options?: FilterOptions<TCriterion, TRow>
): FilterRule<TCriterion, TRow> {
  const { isEmpty, emptyValue } = resolveEmptiness(options, {
    isEmpty: () => false,
    emptyValue: undefined,
  });
  return {
    kind: 'single',
    paths: [path.id],
    predicate: predicate as (cell: unknown, criterion: unknown) => boolean,
    isEmpty,
    emptyValue,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies Omit<FilterRuleRecord<TRow>, 'key'> as FilterRule<TCriterion, TRow>;
}

/**
 * Groups sibling rules under one shared, OR'd criterion — the schema key it's assigned to
 * names the group, same as any rule.
 *
 * @remarks
 * `children` are pre-built rule calls, not a nested schema. The group borrows criterion, row
 * type and emptiness from the first child; a mismatched later child is a compile error
 * (`CriterionOf`/`RowOfRule`), not a silent merge.
 */
// `C` infers from a bare `unknown` tuple; the homogeneity check applies as an intersection,
// never the inference constraint — constraining `C` to a rule type would contextually type
// the elements and widen every child's key.
export function anyOf<C extends readonly [unknown, ...unknown[]]>(
  children: C & {
    readonly [I in keyof C]: FilterRule<CriterionOf<C[0]>, RowOfRule<C[0]>>;
  }
): GroupRule<CriterionOf<C[0]>> {
  const records = children as readonly Omit<FilterRuleRecord<unknown>, 'key'>[];
  if (records.length === 0) {
    throw new Error('[withFiltering] anyOf(…) declared no rules.');
  }
  const [first] = records;

  // Borrowed, not merged, from the first child — the group owns one criterion signal, so a
  // child expecting a different shape would otherwise silently inherit the first child's and
  // match every row. The homogeneity check above is what makes this safe.
  return {
    kind: 'group',
    paths: records.map((child) => child.paths[0]),
    predicate: first.predicate,
    isEmpty: first.isEmpty,
    emptyValue: first.emptyValue,
    children: records.map((child) => ({ path: child.paths[0], predicate: child.predicate })),
  } satisfies Omit<FilterRuleRecord<unknown>, 'key'> as GroupRule<CriterionOf<C[0]>>;
}
