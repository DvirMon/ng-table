import type { FilterOptions } from '../../api/features/with-filtering/types';

// This file ↔ `api/features/with-filtering/types.ts` is a deliberate type-only import cycle —
// see that file's header comment.

/**
 * Structural handle fabricated per path property access.
 * @internal
 */
export interface FilterHandle<
  TRow,
  K extends Extract<keyof TRow, string> = Extract<keyof TRow, string>
> {
  readonly id: K;
}

/**
 * One `anyOf` sibling — its own path + predicate, OR'd against the group's shared criterion.
 * @internal
 */
export interface FilterGroupChild<TCell = unknown, TCriterion = unknown> {
  readonly path: string;
  readonly predicate: (cell: TCell, criterion: TCriterion) => boolean;
}

/**
 * Context `FilterOptions.when` reads other filters' current criterion values through, not row
 * data.
 * @internal
 */
export interface FilterValueOfContext<TRow> {
  // Untyped per-path (`unknown`): the criterion shape behind a path depends on which rule
  // registered it, which this context has no way to recover statically.
  /** Generic in the handle: `TRow` is the default only, and a handle from any row is accepted. */
  valueOf<R = TRow, K extends Extract<keyof R, string> = Extract<keyof R, string>>(
    path: FilterHandle<R, K>
  ): unknown;
}

// `kind: 'group'` (anyOf) carries `children` instead of using `predicate`/`paths` directly —
// `paths` is still populated (`children.map(c => c.path)`) so path-uniqueness validation
// stays uniform across kinds. Gating lives on `options.when`, read by the rule's own record —
// there is no separate node kind for it.
/**
 * Compiled form of one declared filter — returned by every rule function and consumed to
 * build root/child state.
 * @internal
 */
export interface FilterRuleRecord<TRow, TCell = unknown, TCriterion = unknown> {
  readonly key: string;
  readonly paths: readonly string[];
  readonly predicate: (cell: TCell, criterion: TCriterion) => boolean;
  readonly isEmpty: (criterion: TCriterion) => boolean;
  readonly emptyValue: TCriterion;
  readonly options?: FilterOptions<TCriterion, TRow>;
  readonly kind: 'single' | 'group';
  /** `kind: 'group'` only. */
  readonly children?: readonly FilterGroupChild<TCell, TCriterion>[];
}

// `__row` exists because `TRow` is otherwise unrecoverable: `FilterRuleRecord<TRow>` mentions
// it only in the optional `condition`, whose `valueOf` is generic in its own handle, so
// nothing else distinguishes two rules built from different rows.
/**
 * A rule's static inference channel — phantom `__criterion`/`__row` members read by `StateOf`.
 * Omits `key`: a rule carries no key of its own until `build.ts` stamps one from the
 * schema object's property name.
 * @internal
 */
export interface FilterRule<TCriterion, TRow = unknown>
  extends Omit<FilterRuleRecord<TRow>, 'key'> {
  readonly __criterion?: TCriterion;
  readonly __row?: TRow;
}

/**
 * `anyOf`'s return type — a `FilterRule` narrowed to `kind: 'group'`.
 * @internal
 */
export interface GroupRule<TCriterion, TRow = unknown> extends FilterRule<TCriterion, TRow> {
  readonly kind: 'group';
}

/**
 * The union of every rule shape a schema object's values may hold.
 * @internal
 */
export type AnyRule = FilterRule<unknown> | GroupRule<unknown>;

/** The criterion type carried by a rule's phantom `__criterion` member. */
export type CriterionOf<R> = R extends FilterRule<infer C> ? C : never;

/** The row type carried by a rule's phantom `__row` member. */
export type RowOfRule<R> = R extends FilterRule<unknown, infer TRow> ? TRow : never;

/**
 * Element type of an array-valued cell, `unknown` otherwise — lets `hasAny`/`hasNone` default
 * their criterion to the cell's element type instead of `unknown[]`.
 * @internal
 */
export type ItemOf<TCell> = TCell extends readonly (infer E)[] ? E : unknown;

/**
 * The schema-wide criterion map — one entry per declared filter or `anyOf` group, keyed by the
 * schema object's own property names.
 */
export type StateOf<S> = { [K in keyof S]: CriterionOf<S[K]> };
