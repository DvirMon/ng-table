import type { WritableSignal } from '@angular/core';

// Note: `string extends T` is only true once `T` has widened to the base type, which happens
// when the caller passed a plain `string` instead of a literal. Rejects that, passes any
// literal (or literal union) through unchanged.
type EnforceLiteralKey<T extends string> = string extends T ? never : T;

/**
 * Per-filter override: editable default (`source`), key rename (`as`), extra/total emptiness
 * (`emptyValue`/`isEmpty`). See `docs/1-state/filters.md`.
 */
export interface FilterOptions<TSource = unknown, TAs extends string = string> {
  readonly source?: () => TSource;
  readonly as?: EnforceLiteralKey<TAs>;
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
  dirty(): boolean;
}

/**
 * Root filter-set state, read by calling `filters()`. `TState` is the criterion map compiled
 * from the schema's rule calls — inferred by `createFilters`, never caller-supplied.
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
  dirty(): boolean;
  /**
   * A row predicate compiled from the current criteria, usable with no table. One call = one
   * evaluation — request fresh per pass, not per row.
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
export type FiltersPath<TRow> = [TRow] extends [never]
  ? {
      readonly __rowTypeCouldNotBeInferred_useRowOf: 'createFilters: the first argument is empty, so the row type is unknown. Pass rowOf<Row>() instead.';
    }
  : { readonly [K in Extract<keyof TRow, string>]: FilterHandle<TRow, K> };

/**
 * One `anyOf` sibling — its own path + predicate, OR'd against the group's shared criterion.
 * @internal
 */
export interface FilterGroupChild<TCell = unknown, TCriterion = unknown> {
  readonly path: string;
  readonly predicate: (cell: TCell, criterion: TCriterion) => boolean;
}

/**
 * Context `applyWhen`'s `condition` reads other filters' current criterion values through,
 * not row data.
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
// stays uniform across kinds. `kind: 'conditional'` (applyWhen) is structurally a 'single'
// (or 'group') record with `condition` attached — the flattener in create-filters.ts re-tags
// each gated rule's own record rather than nesting, so no separate unwrapping step is needed.
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
  readonly options?: FilterOptions<TCriterion>;
  readonly kind: 'single' | 'group' | 'conditional';
  /** `kind: 'group'` only. */
  readonly children?: readonly FilterGroupChild<TCell, TCriterion>[];
  /** `kind: 'conditional'` only. */
  readonly condition?: (ctx: FilterValueOfContext<TRow>) => boolean;
}

// `__row` exists because `TRow` is otherwise unrecoverable: `FilterRuleRecord<TRow>` mentions
// it only in the optional `condition`, whose `valueOf` is generic in its own handle, so
// nothing else distinguishes two rules built from different rows.
/**
 * A rule's static inference channel — phantom `__key`/`__criterion`/`__row` members read by
 * `Flatten`/`StateOf`, never assigned at runtime.
 * @internal
 */
export interface FilterRule<TKey extends string, TCriterion, TRow = unknown>
  extends FilterRuleRecord<TRow> {
  readonly __key?: TKey;
  readonly __criterion?: TCriterion;
  readonly __row?: TRow;
}

/**
 * `anyOf`'s return type — a `FilterRule` narrowed to `kind: 'group'`, with a positional key
 * rather than one borrowed from a path.
 * @internal
 */
export interface GroupRule<TKey extends string, TCriterion, TRow = unknown>
  extends FilterRule<TKey, TCriterion, TRow> {
  readonly kind: 'group';
}

/**
 * `applyWhen`'s return type — one nestable node, not an array. Not spreadable (no
 * `[Symbol.iterator]`), so `...applyWhen(…)` fails to compile instead of silently dropping
 * the gated filters, as a forgotten spread on an array-returning version once did.
 * @internal
 */
export interface ConditionalRule<S extends readonly unknown[]> {
  readonly kind: 'conditional';
  readonly children: S;
}

/**
 * The union `StateOf` extracts against — a single rule or an `anyOf` group.
 * @internal
 */
export type AnyRule = FilterRule<string, unknown> | GroupRule<string, unknown>;

/** The criterion type carried by a rule's phantom `__criterion` member. */
export type CriterionOf<R> = R extends FilterRule<string, infer C> ? C : never;

/** The row type carried by a rule's phantom `__row` member. */
export type RowOfRule<R> = R extends FilterRule<string, unknown, infer TRow> ? TRow : never;

/**
 * Element type of an array-valued cell, `unknown` otherwise — lets `hasAny`/`hasNone` default
 * their criterion to the cell's element type instead of `unknown[]`.
 * @internal
 */
export type ItemOf<TCell> = TCell extends readonly (infer E)[] ? E : unknown;

/** `true` for `any` alone — the only type assignable to both `0` and `1 & T`. @internal */
type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Resolves a schema's returned array to its leaf rules, recursing through nested arrays and
 * `ConditionalRule.children`.
 * @internal
 */
type FlattenItem<Item> =
  // Note: `any` must be checked first. `any` satisfies `readonly unknown[]`, so `Flatten<any>`
  // recurses into `FlattenItem<any>` again — the compiler reports this as TS2589 at the whole
  // `createFilters()` call site, burying the real error that produced the `any`.
  IsAny<Item> extends true
    ? never
    : Item extends ConditionalRule<infer C>
      ? Flatten<C>
      : Item extends readonly unknown[]
        ? Flatten<Item>
        : Item;

/** Flattens a schema's rule array to its leaf entries. @internal */
export type Flatten<T extends readonly unknown[]> = FlattenItem<T[number]>;

// Constrained to `readonly unknown[]`, not a rule-typed array — naming the key type in the
// constraint would contextually widen every rule's key to `string` before inference runs.
/**
 * The schema-wide criterion map — one entry per declared filter or `anyOf` group, keyed by
 * each rule's statically carried key.
 */
export type StateOf<T extends readonly unknown[]> = {
  [R in Extract<Flatten<T>, AnyRule> as NonNullable<R['__key']>]: CriterionOf<R>;
};
