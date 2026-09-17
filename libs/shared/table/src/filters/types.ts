import type { WritableSignal } from '@angular/core';

/**
 * Per-filter override: editable default (`source`), extra/total emptiness
 * (`emptyValue`/`isEmpty`), gating (`when`). See `docs/1-state/filters.md`.
 */
export interface FilterOptions<TSource = unknown, TRow = unknown> {
  readonly source?: () => TSource;
  /**
   * Extra empty criterion: joins the rule's own empty set and seeds `reset(null)`/the initial
   * value. `isEmpty` replaces the check instead of extending it; with neither, the rule's own
   * empty check holds.
   */
  readonly emptyValue?: TSource;
  /**
   * Total emptiness override — the only way to subtract from the rule's empty set. Wins over
   * the rule's own check and over `emptyValue`.
   */
  readonly isEmpty?: (criterion: NoInfer<TSource>) => boolean;
  /** Gated off: `criterion()` and `isActive()` go dark. `value` and `reset` do not. */
  readonly when?: (ctx: FilterValueOfContext<TRow>) => boolean;
}

/**
 * One filter's reactive state — `criterion()` returns `undefined` when empty; the root's
 * `criteria()` composes active filters, empties omitted.
 */
export interface FilterNode<TCriterion> {
  value: WritableSignal<TCriterion>;
  /** The effective criterion — what the engine applies, or `undefined` when this filter is inert. */
  criterion(): TCriterion | undefined;
  /** Whether this filter currently narrows. The same gate `criterion()` reads, as a boolean. */
  isActive(): boolean;
  /**
   * `reset()` reverts to `source` (or empty with no source). `reset(null)` is a sentinel for
   * the empty value, not the literal — write literal `null` via `value.set(null)`.
   */
  reset(value?: TCriterion | null): void;
  /** @internal */
  dirty(): boolean;
}

/**
 * Root filter-set state, read by calling `filters()`. `TState` is the criterion map compiled
 * from the schema's rule calls — inferred from `withFiltering`'s `schema` config, never
 * caller-supplied.
 */
export interface FiltersRoot<TRow, TState extends Record<string, unknown>> {
  /**
   * The full criterion model as a writable view over the child nodes — reading is
   * `filters().value()`, writing fans out per key.
   */
  value: WritableSignal<TState>;
  /** Every active filter's effective criterion, empties omitted — the request-param shape. */
  criteria(): Partial<TState>;
  /** Whether any filter currently narrows. */
  isActive(): boolean;
  /**
   * `Partial<TState>` — an omitted key resets to its declared source. `reset(null)` is a
   * sentinel: every filter goes to its empty value, not the literal — write a literal `null`
   * per filter via `filters.<key>().value.set(null)`.
   */
  reset(value?: Partial<TState> | null): void;
  /** @internal */
  dirty(): boolean;
  /**
   * A row predicate compiled from the current criteria, usable with no table. One call = one
   * evaluation — request fresh per pass, not per row.
   * @internal
   */
  matcher(): (row: TRow) => boolean;
}

/**
 * Callable + indexable: calling reads root state, property access reaches a child filter
 * node. See `docs/1-state/filters.md`'s Signature section.
 */
export type Filters<TRow, TState extends Record<string, unknown>> = (() => FiltersRoot<
  TRow,
  TState
>) & {
  readonly [K in keyof TState]: () => FilterNode<TState[K]>;
};

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
 * Structural `path` proxy handed to a filters schema function — a property access fabricates
 * a `FilterHandle` per key.
 * @internal
 */
export type FiltersPath<TRow> = {
  readonly [K in Extract<keyof TRow, string>]: FilterHandle<TRow, K>;
};

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
 * Omits `key`: a rule carries no key of its own until `create-filters.ts` stamps one from the
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
