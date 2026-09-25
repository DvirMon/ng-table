import type { WritableSignal } from '@angular/core';
import type { FilterHandle, FilterValueOfContext } from '../../../engine/filters/types';
import type { ColumnIdIn, ColumnValueMap } from '../../types';

// This file ↔ `engine/filters/types.ts` is a deliberate type-only import cycle, same shape as
// `api/types.ts` ↔ `engine/types.ts` (ADR-0004): `FilterOptions.when` reads through the
// engine's `FilterValueOfContext`, `FiltersPath` is a mapped type over the engine's
// `FilterHandle`, and `FilterRuleRecord.options` (engine-internal) is typed as `FilterOptions`
// (this file, public). Both sides must stay `import type`.

/**
 * Per-filter override: editable default (`source`), extra/total emptiness
 * (`emptyValue`/`isEmpty`), gating (`when`). See `docs/1-state/features/filtering.md`.
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
 * node. See `docs/1-state/features/filtering.md`'s State section.
 */
export type Filters<TRow, TState extends Record<string, unknown>> = (() => FiltersRoot<
  TRow,
  TState
>) & {
  readonly [K in keyof TState]: () => FilterNode<TState[K]>;
};

/**
 * Structural `path` proxy for a filters schema function — a property access fabricates a
 * `FilterHandle` per declared column id, typed to that column's resolved value. An inline
 * schema (`withFiltering({ schema })`) infers `TValues` from the composed columns; a schema
 * written as its own variable spells it explicitly:
 * `FiltersPath<Row, ColumnValues<Row, typeof set.columns>>`. See `docs/1-state/features/filtering.md`.
 */
export type FiltersPath<TRow, TValues extends ColumnValueMap> = {
  readonly [K in ColumnIdIn<TValues>]: FilterHandle<TRow, K, TValues[K]>;
};
