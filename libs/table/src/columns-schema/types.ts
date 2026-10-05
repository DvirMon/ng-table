import type { ResourceRef, Signal } from '@angular/core';
import type { ColumnDef } from '../api/types';
import { PATH_RECORDER, type PathRecorder } from '../schema/path-proxy';

// Resolves to `baseColumns`, never the derived `columns` — rules observe declared and
// imperatively-updated column state, never another rule's own output. Reading `columns` here
// would close the `columns → ruleResults → params → resource → ruleResults` cycle. `stateOf`
// resolves the same way.
/** Read-only reactive context handed to a rule's `when`/`params` callback. */
export interface ColumnRuleContext<TRow> {
  readonly columns: () => ColumnDef<TRow>[];
  /** Another column's current declared state, named by handle instead of a string-keyed lookup. */
  stateOf<K extends string>(
    handle: ColumnHandle<TRow, K, unknown>,
  ): Pick<ColumnDef<TRow>, 'visible' | 'label' | 'meta'>;
}

/**
 * Structural proxy — the `get` trap fabricates a `ColumnHandle<TRow, K, TRule>` for any string
 * property accessed; typing is purely compile-time. Keyed by `TId` — the ids declared in
 * `TableConfig.columns`, not `keyof TRow` — so a derived column (id absent from `TRow`) is
 * nameable too.
 */
// docs/adr/0019-columns-path-keyed-by-declared-column-ids.md
export type ColumnsPath<TRow, TId extends string, TRule = ColumnRule<TRow>> = {
  readonly [K in TId]: ColumnHandle<TRow, K, TRule>;
};

export interface ColumnHandle<TRow, K extends string = string, TRule = ColumnRule<TRow>> {
  readonly id: K;
  /** @internal */
  readonly [PATH_RECORDER]: PathRecorder<TRow, TRule>;
}

export type ColumnsSchemaFn<TRow, TId extends string = string> = (
  path: ColumnsPath<TRow, TId>,
) => void;

/** Opaque, compiled form of a schema fn — the standalone-reuse value. */
export interface ColumnSchema<TRow> {
  readonly kind: 'column-schema';
  readonly rules: readonly ColumnRule<TRow>[];
}

/**
 * Unique typed key for a consumer-registered column metadata entry — object identity is the
 * key; `_type` is a phantom carrier so `T` flows through `metadata()`/`readColumnMeta()` at
 * compile time only.
 */
export interface ColumnMetaKey<T> {
  readonly kind: 'column-meta-key';
  /** @internal phantom type carrier — never assigned, compile-time only */
  readonly _type?: T;
}

/**
 * Consumer-defined side-channel data attached to a column. Single-writer only for consumer
 * keys — see `docs/2-columns/reference/column-metadata.md` for the `VISIBLE`-key exemption and
 * the full write-path.
 */
export interface MetadataRule<TRow, T = unknown> {
  readonly kind: 'metadata';
  readonly columnId: string;
  readonly key: ColumnMetaKey<T>;
  readonly logic: T | ((ctx: ColumnRuleContext<TRow>) => T);
}

// Kept as its own rule kind (not `MetadataRule`'s plain-value-or-closure `logic`) because
// resource construction (`factory(params)`) must happen once at wiring time, not on every fold.
/**
 * Resource-backed counterpart to `MetadataRule`. Not part of the public `metadata()` surface —
 * used internally by `visibleAsync()` (`columns-schema/rules.ts`).
 */
export interface MetadataAsyncRule<TRow, TParams = unknown, TResult = unknown, T = unknown> {
  readonly kind: 'metadata-async';
  readonly columnId: string;
  readonly key: ColumnMetaKey<T>;
  readonly params: (ctx: ColumnRuleContext<TRow>) => TParams | undefined;
  // Method-shorthand syntax (not `readonly factory: (…) => …`) so `TParams`/`TResult`/`T`
  // check bivariantly — this member is reached only through `PathRecorder.record(rule: TRule)`,
  // where `TRule` is `ColumnRule<TRow>`, whose `MetadataAsyncRule` member erases to its
  // `<unknown, unknown, unknown>` default. Property-typed functions would reject a
  // concretely-typed `factory`/`onSuccess` under strict contravariance. Same shape and reason
  // as `GroupingAsyncRule`.
  factory(params: Signal<TParams | undefined>): ResourceRef<TResult | undefined>;
  onSuccess(result: TResult): T;
  readonly onError: (error: unknown) => T;
}

export type ColumnRule<TRow> = MetadataRule<TRow> | MetadataAsyncRule<TRow>;

// --- Store-shape contracts shared across wire-columns-schema.ts -----------

/**
 * The slice of a table store `wireColumnsSchemaAsync`'s rule wiring reads. Read-only — the
 * wiring builds `ColumnRuleEntry` values instead of writing columns directly. `TableCore<TRow>`
 * satisfies it structurally.
 */
export interface ColumnsSchemaStore<TRow> {
  readonly baseColumns: Signal<ColumnDef<TRow>[]>;
}
