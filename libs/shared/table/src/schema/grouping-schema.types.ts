import type { Resource, Signal } from '@angular/core';
import type { ColumnsPath } from './column-schema.types';

/**
 * One schema-fn/rules-array level: `when` contributes whether this column is an active grouping
 * level. `undefined` (pending) makes the whole rule set abstain (D13) — never "this level doesn't
 * apply", that's `false`, and never "the value hasn't loaded", that's also `undefined` but
 * resolved to abstain at the fold, not at this rule.
 */
export interface GroupingRule<TRow = unknown> {
  readonly kind: 'grouping';
  readonly columnId: string;
  readonly when: () => boolean | undefined;
}

/**
 * Resource-backed counterpart — the rule owns fetching (`params`/`factory`) and both outcomes
 * (`onSuccess`/`onError`, both required per D13/D15, mirroring `MetadataAsyncRule`'s
 * `onError`-required contract). `factory` returns `Resource<T>` (Angular's read-only structural
 * interface), not `ResourceRef<T>` — this rule only ever reads `.status()`/`.value()`/`.error()`,
 * never mutates, same reasoning as D9 of `effect-free-column-reactivity`.
 */
export interface GroupingAsyncRule<TRow = unknown, TParams = unknown, TResult = unknown> {
  readonly kind: 'grouping-async';
  readonly columnId: string;
  readonly params: () => TParams | undefined;
  // Method-shorthand syntax (not a `readonly factory: (…) => …` property) deliberately, so
  // `TParams`/`TResult` check bivariantly here — this member is reached only through
  // `ColumnSchemaRecorder.record()`'s generic `| TRule` catch-all arm (`column-schema.ts`),
  // which erases to this type's default `<unknown, unknown>` instantiation; a property-typed
  // function would reject a concretely-typed `factory`/`onSuccess` under strict contravariance.
  factory(params: Signal<TParams | undefined>): Resource<TResult | undefined>;
  onSuccess(result: TResult): boolean;
  readonly onError: (error: unknown) => boolean;
}

export type AnyGroupingRule<TRow = unknown> = GroupingRule<TRow> | GroupingAsyncRule<TRow>;

/** Schema fn passed to `withGrouping()`/Step 4's rules-array normalization (D8). */
export type GroupingSchemaFn<TRow> = (path: ColumnsPath<TRow, AnyGroupingRule<TRow>>) => void;
