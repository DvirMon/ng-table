import type { Resource, Signal } from '@angular/core';
import type { GroupOrder, GroupWhen } from '../../types';
import { PATH_RECORDER, type PathRecorder } from '../../../schema/path-proxy';

/**
 * One `applyGrouping()` declaration — `enable` contributes level activation,
 * `when` gates per-column admission. See field docs for the abstain-vs-inactive distinction.
 */
export interface GroupingRule<TRow = unknown> {
  readonly kind: 'grouping';
  readonly columnId: string;
  /** Omit to carry only `when` (no activation contribution). Present-and-`undefined` (pending)
   * still makes the whole rule set abstain. */
  readonly enable?: () => boolean | undefined;
  /** Admission for this column only, AND'd with the table-wide `when`. */
  readonly when?: GroupWhen<TRow>;
}

/**
 * Resource-backed counterpart to `GroupingRule` — owns fetching (`params`/`factory`); both
 * `onSuccess`/`onError` are required. `factory` returns `Resource<T>`, not `ResourceRef<T>` —
 * this rule only reads `.status()`/`.value()`/`.error()`, never mutates.
 */
export interface GroupingAsyncRule<TRow = unknown, TParams = unknown, TResult = unknown> {
  readonly kind: 'grouping-async';
  readonly columnId: string;
  readonly params: () => TParams | undefined;
  // Method-shorthand syntax (not a `readonly factory: (…) => …` property) deliberately, so
  // `TParams`/`TResult` check bivariantly here — this member is reached only through
  // `PathRecorder.record(rule: TRule)` (`schema/path-proxy.ts`), where `TRule` is
  // `AnyGroupingRule<TRow>`, whose `GroupingAsyncRule` member is erased to this type's default
  // `<unknown, unknown>` instantiation; a property-typed function would reject a
  // concretely-typed `factory`/`onSuccess` under strict contravariance.
  factory(params: Signal<TParams | undefined>): Resource<TResult | undefined>;
  onSuccess(result: TResult): boolean;
  readonly onError: (error: unknown) => boolean;
  /** Admission for this column only, AND'd with the table-wide `when`. */
  readonly when?: GroupWhen<TRow>;
}

/** One field's `applyGroupOrder(path.x, cmp)` declaration — never activates/deactivates a
 * level, only orders that level's siblings once active. */
export interface GroupOrderRule<TRow = unknown> {
  readonly kind: 'group-order';
  readonly columnId: string;
  readonly comparator: GroupOrder<TRow>;
}

/** One `applyGroupKey(path.x, extractValue)` declaration — key derivation only, never
 * activation/ordering. The engine does not defensively normalize, stringify or deep-compare
 * keys — the extractor must return a primitive. */
export interface GroupKeyRule<TRow = unknown> {
  readonly kind: 'grouping-key';
  readonly columnId: string;
  readonly extractValue: (fieldValue: unknown) => unknown;
}

/** One `applyAggregate(path.x, aggregateFn)` declaration — computes one
 * summary value per cluster per column, over that cluster's own leaves at
 * every depth. */
export interface GroupAggregateRule<TRow = unknown> {
  readonly kind: 'grouping-aggregate';
  readonly columnId: string;
  readonly aggregateFn: (rows: TRow[]) => unknown;
}

export type AnyGroupingRule<TRow = unknown> =
  | GroupingRule<TRow>
  | GroupingAsyncRule<TRow>
  | GroupOrderRule<TRow>
  | GroupKeyRule<TRow>
  | GroupAggregateRule<TRow>;

/** One `initial` entry — static level config: which column, and its display label.
 * Resolves explicit `label`, else falls back to the matching column's own `label`. */
export interface GroupingLevel<TId extends string = string> {
  readonly columnId: TId;
  readonly label?: string;
}

/**
 * Handle fabricated by `GroupingPath`'s `get` trap for one declared column id — NOT a
 * `ColumnHandle`. Same recorder shape (`schema/path-proxy.ts` is key-space agnostic, shared with
 * columns) but a distinct type: it records `AnyGroupingRule`, not `ColumnRule`.
 */
export interface GroupingHandle<TRow, K extends string = string> {
  readonly id: K;
  /** @internal */
  readonly [PATH_RECORDER]: PathRecorder<TRow, AnyGroupingRule<TRow>>;
}

/**
 * Structural `path` proxy for a grouping schema fn — a property access fabricates a
 * `GroupingHandle` per declared column id. Mirrors `ColumnsPath<TRow, TId>`
 * (`columns-schema/types.ts`), keying grouping by the same declared-id space columns use.
 */
export type GroupingPath<TRow, TId extends string = string> = {
  readonly [K in TId]: GroupingHandle<TRow, K>;
};

/** Schema fn passed as `WithGroupingConfig.schema`. */
export type GroupingSchemaFn<TRow, TId extends string = string> = (
  path: GroupingPath<TRow, TId>
) => void;
