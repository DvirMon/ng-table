import type {
  ConditionalRule,
  CriterionOf,
  FilterHandle,
  FilterOptions,
  FilterRule,
  FilterRuleRecord,
  FilterValueOfContext,
  FiltersPath,
  GroupRule,
  ItemOf,
  RowOfRule,
} from './types';
import { equalsCriterion } from './state';
import {
  hasAnyOf,
  hasNoneOf,
  isContaining,
  isEqual,
  isInDateRange,
  isInRange,
} from './matchers';

/**
 * The declaration rules a consumer calls inside a `createFilters()` schema body. Each rule
 * builds and *returns* its own `FilterRule` — the schema's return value is the inference
 * channel `StateOf` folds into the criterion map. Bare verbs (`equals`, `contains`, …), as
 * opposed to the boolean-guard-prefixed matchers (`isEqual`, `isContaining`, …) they default
 * to, which *return* a boolean.
 *
 * Every rule erases its matcher/criterion generics to `FilterRuleRecord<TRow>`'s `unknown`
 * storage shape via `as` — the same generic-erasure boundary documented on `FilterRuleRecord`:
 * the erased type only ever round-trips through the record's own `key`/`paths` at read time
 * (`create-filters.ts`), never re-derived structurally, so collapsing to `unknown` here is
 * sound even though TS can't prove it at this storage step.
 */

/**
 * The static key a rule reports, mirroring the runtime `options?.as ?? path.id`: the `as`
 * literal when one is given, the path key otherwise. `TAs` defaults to `never` — the one type
 * for which no `as` was passed — so this resolves to `K` exactly when the default held.
 */
type RuleKey<K extends string, TAs extends string> = [TAs] extends [never] ? K : TAs;

export type RangeCriterion = { min: number | null; max: number | null };
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

/**
 * Resolves what "empty" means for one filter. Precedence: `isEmpty` replaces; `emptyValue`
 * extends the rule's check (`fallback.isEmpty(v) || equalsCriterion(v, override)`) and seeds
 * the empty value; with neither, the rule's own holds.
 */
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

export function equals<
  TRow,
  K extends Extract<keyof TRow, string>,
  const TAs extends string = never,
  const TEmpty = never
>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<TRow[K] | null | TEmpty, TAs> & { readonly emptyValue?: TEmpty }
): FilterRule<RuleKey<K, TAs>, TRow[K] | null | TEmpty, TRow> {
  const { isEmpty, emptyValue } = resolveEmptiness(options, {
    isEmpty: (v: unknown) => v == null,
    emptyValue: null,
  });
  return {
    kind: 'single',
    paths: [path.id],
    key: options?.as ?? path.id,
    predicate: isEqual as (cell: unknown, criterion: unknown) => boolean,
    isEmpty,
    emptyValue,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies FilterRuleRecord<TRow> as FilterRule<
    RuleKey<K, TAs>,
    TRow[K] | null | TEmpty,
    TRow
  >;
}

export function contains<
  TRow,
  K extends Extract<keyof TRow, string>,
  const TAs extends string = never
>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<string, TAs>
): FilterRule<RuleKey<K, TAs>, string, TRow> {
  const { isEmpty, emptyValue } = resolveEmptiness(options, {
    isEmpty: (v: unknown) => v === '',
    emptyValue: '',
  });
  return {
    kind: 'single',
    paths: [path.id],
    key: options?.as ?? path.id,
    predicate: isContaining as (cell: unknown, criterion: unknown) => boolean,
    isEmpty,
    emptyValue,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies FilterRuleRecord<TRow> as FilterRule<RuleKey<K, TAs>, string, TRow>;
}

export function inRange<
  TRow,
  K extends Extract<keyof TRow, string>,
  const TAs extends string = never
>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<RangeCriterion, TAs>
): FilterRule<RuleKey<K, TAs>, RangeCriterion, TRow> {
  const { isEmpty, emptyValue } = resolveEmptiness(options, {
    isEmpty: (v: unknown) => isEmptyRange(v as RangeCriterion),
    emptyValue: { min: null, max: null } as RangeCriterion,
  });
  return {
    kind: 'single',
    paths: [path.id],
    key: options?.as ?? path.id,
    predicate: isInRange as unknown as (cell: unknown, criterion: unknown) => boolean,
    isEmpty,
    emptyValue,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies FilterRuleRecord<TRow> as FilterRule<RuleKey<K, TAs>, RangeCriterion, TRow>;
}

export function inDateRange<
  TRow,
  K extends Extract<keyof TRow, string>,
  const TAs extends string = never
>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<DateRangeCriterion, TAs>
): FilterRule<RuleKey<K, TAs>, DateRangeCriterion, TRow> {
  const { isEmpty, emptyValue } = resolveEmptiness(options, {
    isEmpty: (v: unknown) => isEmptyDateRange(v as DateRangeCriterion),
    emptyValue: { from: null, to: null } as DateRangeCriterion,
  });
  return {
    kind: 'single',
    paths: [path.id],
    key: options?.as ?? path.id,
    predicate: isInDateRange as unknown as (cell: unknown, criterion: unknown) => boolean,
    isEmpty,
    emptyValue,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies FilterRuleRecord<TRow> as FilterRule<RuleKey<K, TAs>, DateRangeCriterion, TRow>;
}

export function hasAny<
  TRow,
  K extends Extract<keyof TRow, string>,
  const TAs extends string = never,
  TItem = ItemOf<TRow[K]>
>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<readonly TItem[], TAs>
): FilterRule<RuleKey<K, TAs>, readonly TItem[], TRow> {
  const { isEmpty, emptyValue } = resolveEmptiness(options, {
    isEmpty: (v: unknown) => Array.isArray(v) && v.length === 0,
    emptyValue: [] as readonly TItem[],
  });
  return {
    kind: 'single',
    paths: [path.id],
    key: options?.as ?? path.id,
    predicate: hasAnyOf as (cell: unknown, criterion: unknown) => boolean,
    isEmpty,
    emptyValue,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies FilterRuleRecord<TRow> as FilterRule<RuleKey<K, TAs>, readonly TItem[], TRow>;
}

export function hasNone<
  TRow,
  K extends Extract<keyof TRow, string>,
  const TAs extends string = never,
  TItem = ItemOf<TRow[K]>
>(
  path: FilterHandle<TRow, K>,
  options?: FilterOptions<readonly TItem[], TAs>
): FilterRule<RuleKey<K, TAs>, readonly TItem[], TRow> {
  const { isEmpty, emptyValue } = resolveEmptiness(options, {
    isEmpty: (v: unknown) => Array.isArray(v) && v.length === 0,
    emptyValue: [] as readonly TItem[],
  });
  return {
    kind: 'single',
    paths: [path.id],
    key: options?.as ?? path.id,
    predicate: hasNoneOf as (cell: unknown, criterion: unknown) => boolean,
    isEmpty,
    emptyValue,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies FilterRuleRecord<TRow> as FilterRule<RuleKey<K, TAs>, readonly TItem[], TRow>;
}

// `TCriterion` has two inference sites — the predicate's second parameter and
// `options.isEmpty`. A mismatch between the two is a hard `TS2322` at the `options` argument,
// not a silent widening to a union or to `unknown` — the predicate site is inferred first and
// wins; `NoInfer` on `FilterOptions.isEmpty` keeps the callback from contributing back.
/**
 * A general, predicate-driven filter rule — a peer of the named rules (`equals`, `contains`,
 * …), not a layer beneath them. `cell` arrives **unguarded**, unlike the named rules' shipped
 * matchers, so a custom predicate can itself choose to match nulls.
 *
 * @remarks
 * Emptiness can't be inferred for an arbitrary criterion shape, so `options.isEmpty` /
 * `options.emptyValue` opt this rule into the same skip-when-empty behavior the named rules
 * get for free. Precedence: `isEmpty` replaces; `emptyValue` extends and seeds; with neither,
 * this filter is never empty — it always participates once its value diverges from
 * `undefined`.
 */
export function filter<
  TRow,
  K extends Extract<keyof TRow, string>,
  TCriterion,
  const TAs extends string = never
>(
  path: FilterHandle<TRow, K>,
  predicate: (cell: TRow[K], criterion: TCriterion) => boolean,
  options?: FilterOptions<TCriterion, TAs>
): FilterRule<RuleKey<K, TAs>, TCriterion, TRow> {
  const { isEmpty, emptyValue } = resolveEmptiness(options, {
    isEmpty: () => false,
    emptyValue: undefined,
  });
  return {
    kind: 'single',
    paths: [path.id],
    key: options?.as ?? path.id,
    predicate: predicate as (cell: unknown, criterion: unknown) => boolean,
    isEmpty,
    emptyValue,
    options: options as FilterOptions<unknown> | undefined,
  } satisfies FilterRuleRecord<TRow> as FilterRule<RuleKey<K, TAs>, TCriterion, TRow>;
}

/**
 * Groups sibling rules under one shared key and one shared criterion, OR'd. The key is
 * positional — a group has no single path to borrow one from. `children` arrive already built
 * (each its own `equals(...)`/`contains(...)`/… call) rather than through a nested schema
 * callback: the non-empty tuple constraint makes an empty group a compile error, and the
 * homogeneity check on `children` makes a mixed-criterion group one. The runtime throw stays as
 * a backstop for a caller that reaches this from untyped JS.
 *
 * The group's own `isEmpty`/`emptyValue` are borrowed from its first child, and so are its
 * criterion and row types — every later child is checked against `CriterionOf<C[0]>` and
 * `RowOfRule<C[0]>`. The borrow is what makes the check necessary rather than decorative: the
 * group owns one criterion signal, so a child whose predicate expects a different shape would
 * silently receive the first child's and match every row. Do not "improve" the borrow into a
 * merge.
 *
 * `C` is inferred from a bare `unknown` tuple and the homogeneity check is applied as an
 * intersection, never as the inference constraint — constraining `C` to a rule type would
 * contextually type the elements and widen every child's key.
 */
export function anyOf<TKey extends string, C extends readonly [unknown, ...unknown[]]>(
  key: TKey,
  children: C & {
    readonly [I in keyof C]: FilterRule<string, CriterionOf<C[0]>, RowOfRule<C[0]>>;
  }
): GroupRule<TKey, CriterionOf<C[0]>> {
  const records = children as readonly FilterRuleRecord<unknown>[];
  if (records.length === 0) {
    throw new Error(`[createFilters] anyOf("${key}", …) declared no rules.`);
  }
  const [first] = records;

  return {
    kind: 'group',
    key,
    paths: records.map((child) => child.paths[0]),
    predicate: first.predicate,
    isEmpty: first.isEmpty,
    emptyValue: first.emptyValue,
    children: records.map((child) => ({ path: child.paths[0], predicate: child.predicate })),
  } satisfies FilterRuleRecord<unknown> as GroupRule<TKey, CriterionOf<C[0]>>;
}

// `ConditionalRule<S>`'s *type* is a pure `{ kind, children }` carrier — it does not extend
// `FilterRuleRecord` and has no `condition` field. The returned node carries `condition` as a
// runtime-only field alongside `kind`/`children` (present at runtime, absent from the static
// type — the same erasure boundary the rest of this file uses), since re-tagging each child's
// record to `kind: 'conditional'` here would mean mutating a child `anyOf`/other combinators
// may also hold a reference to. `create-filters.ts`'s flattener reads `condition` off the raw
// node when it recurses into a `ConditionalRule` and re-tags each leaf record it finds inside.
//
// Not spreadable: a plain object has no `[Symbol.iterator]`, so `...applyWhen(…)` is a compile
// error rather than the silent drop a forgotten spread on an array-returning version once was.
//
// `path` is neither read nor an inference anchor — `TRow` resolves to `unknown` here. Retained
// for call-site symmetry with the rule functions.
/**
 * Gates a group of filters on other filters' current criterion values. `condition` reads
 * through `valueOf`, never row data. Returns one node, not an array — place it directly in
 * the schema array; each gated child keeps its own top-level key.
 */
export function applyWhen<TRow, S extends readonly [unknown, ...unknown[]]>(
  path: FiltersPath<TRow>,
  condition: (ctx: FilterValueOfContext<TRow>) => boolean,
  children: S
): ConditionalRule<S> {
  void path;
  if (children.length === 0) {
    throw new Error('[createFilters] applyWhen(...) declared no rules.');
  }
  // Assigned before returning: an inline return would trip excess-property checking on
  // `condition`, which `ConditionalRule<S>` deliberately does not declare.
  const node = { kind: 'conditional' as const, children, condition };
  return node;
}
