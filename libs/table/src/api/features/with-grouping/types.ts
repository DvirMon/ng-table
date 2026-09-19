import type { Resource, Signal } from '@angular/core';
import type { ColumnId, GroupOrder, GroupWhen } from '../../types';
import { PATH_RECORDER, type PathRecorder } from '../../../schema/path-proxy';

/**
 * One `applyGrouping()` declaration. `enable`, when present, contributes whether this field is an
 * active grouping level; `undefined` (pending) makes the whole rule set abstain — never "this
 * level doesn't apply", that's `false`, and never "the value hasn't loaded", that's also
 * `undefined` but resolved to abstain at the fold, not at this rule. Omitting `enable` means this
 * rule contributes no level activation at all — it carries only `when`.
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
 * Resource-backed counterpart — the rule owns fetching (`params`/`factory`) and both outcomes
 * (`onSuccess`/`onError`, both required, same contract as `MetadataAsyncRule`'s `onError`).
 * `factory` returns `Resource<T>` (Angular's read-only structural interface), not
 * `ResourceRef<T>` — this rule only ever reads `.status()`/`.value()`/`.error()`, never mutates.
 */
export interface GroupingAsyncRule<TRow = unknown, TParams = unknown, TResult = unknown> {
  readonly kind: 'grouping-async';
  readonly columnId: string;
  readonly params: () => TParams | undefined;
  // Method-shorthand syntax (not a `readonly factory: (…) => …` property) deliberately, so
  // `TParams`/`TResult` check bivariantly here — this member is reached only through
  // `PathRecorder.record()`'s generic `| TRule` catch-all arm (`schema/path-proxy.ts`), which
  // erases to this type's default `<unknown, unknown>` instantiation; a property-typed
  // function would reject a concretely-typed `factory`/`onSuccess` under strict contravariance.
  factory(params: Signal<TParams | undefined>): Resource<TResult | undefined>;
  onSuccess(result: TResult): boolean;
  readonly onError: (error: unknown) => boolean;
  /** Admission for this column only, AND'd with the table-wide `when`. */
  readonly when?: GroupWhen<TRow>;
}

/** One field's `applyGroupOrder(path.x, cmp)` declaration. Unlike `GroupingRule`/
 * `GroupingAsyncRule`, this kind never activates or deactivates a level — it only orders that
 * level's siblings once it's active. */
export interface GroupOrderRule<TRow = unknown> {
  readonly kind: 'group-order';
  readonly columnId: string;
  readonly comparator: GroupOrder<TRow>;
}

/** One `applyGroupKey(path.x, extractValue)` declaration (D9) — key derivation only, never
 * activation/ordering. The engine does not defensively normalize, stringify or deep-compare
 * keys — this must return a primitive (D7). */
export interface GroupKeyRule<TRow = unknown> {
  readonly kind: 'grouping-key';
  readonly columnId: string;
  readonly extractValue: (fieldValue: unknown) => unknown;
}

export type AnyGroupingRule<TRow = unknown> =
  | GroupingRule<TRow>
  | GroupingAsyncRule<TRow>
  | GroupOrderRule<TRow>
  | GroupKeyRule<TRow>;

/** One `initial` entry (D9) — static level config: which field, and its display label.
 * Resolves explicit `label` -> a column whose id matches `key` -> the raw field name (D7a). */
export interface GroupingLevel<TRow> {
  readonly key: ColumnId<TRow>;
  readonly label?: string;
}

/**
 * Handle fabricated by `GroupingPath`'s `get` trap for one row field — NOT a `ColumnHandle`.
 * Same recorder shape (`schema/path-proxy.ts`'s proxy machinery is key-space agnostic and
 * shared with columns, not owned by either), but a distinct type: a grouping schema fn never
 * sees a declared column id (D7).
 */
export interface GroupingHandle<TRow, K extends string = string> {
  readonly id: K;
  /** @internal */
  readonly [PATH_RECORDER]: PathRecorder<TRow, AnyGroupingRule<TRow>>;
}

/**
 * Structural `path` proxy handed to a grouping schema fn — a property access fabricates a
 * `GroupingHandle` per row field. Keyed by `Extract<keyof TRow, string>`, not a declared column
 * id: grouping partitions data, and the identifier a consumer writes should name the thing being
 * partitioned (D7, `2-decisions.md`). Same shape `FiltersPath<TRow>` already uses.
 */
export type GroupingPath<TRow> = {
  readonly [K in Extract<keyof TRow, string>]: GroupingHandle<TRow, K>;
};

/** Schema fn passed as `WithGroupingConfig.schema`. */
export type GroupingSchemaFn<TRow> = (path: GroupingPath<TRow>) => void;
