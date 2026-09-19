import type { ResourceRef, Signal } from '@angular/core';
import type { ColumnDef } from '../api/types';

// Resolves to `baseColumns`, never the derived `columns` — rules observe declared and
// imperatively-updated column state, never another rule's own output. Reading `columns` here
// would close the `columns → ruleResults → params → resource → ruleResults` cycle.
/** Read-only reactive context handed to a rule's `when`/`params` callback. */
export interface ColumnRuleContext<TRow> {
  readonly columns: () => ColumnDef<TRow>[];
}

/** @internal */
export const COLUMN_RECORDER: unique symbol = Symbol('COLUMN_RECORDER');

// Generic on `TRule`, defaulting to `ColumnRule<TRow>` so every existing caller (naming zero
// type arguments) keeps resolving to the same type. A session is homogeneous — one rule
// family per session — instantiated differently at different call sites (e.g. a future
// grouping session at `TRule = AnyGroupingRule<TRow>`), never widened to `unknown` here.
/**
 * Internal recorder every `apply*` call writes into. One instance per `columnSchema()` /
 * inline-fn execution.
 * @internal
 */
export interface ColumnSchemaRecorder<TRow, TRule = ColumnRule<TRow>> {
  // Generic on `TParams`/`TResult`/`T` so a caller building a `MetadataRule`/`MetadataAsyncRule`
  // at its own instantiated types can pass the literal straight through — contextual typing
  // checks it directly, no erasing cast needed at the call site (a structurally-typed `rule:
  // TRule` parameter can't accept this, since `MetadataAsyncRule`'s `factory`/`onSuccess`
  // occupy contravariant positions). `| TRule` covers a session instantiated at a non-default
  // `TRule` (e.g. a grouping session), recording straight through since those rule families
  // don't need the `Metadata*` contextual-typing shape.
  /** Records one rule into this session for later resolution by `resolveColumnsConfig()`. */
  record<TParams = unknown, TResult = unknown, T = unknown>(
    rule: MetadataRule<TRow, T> | MetadataAsyncRule<TRow, TParams, TResult, T> | TRule
  ): void;
}

/**
 * Structural proxy — the `get` trap fabricates a `ColumnHandle<TRow, K, TRule>` for any string
 * property accessed; typing is 100% compile-time. Keyed by `TId`, the literal ids declared in
 * `TableConfig.columns` — not `keyof TRow` — so a derived column (id absent from `TRow`) is
 * nameable too (ADR-0019).
 */
export type ColumnsPath<TRow, TId extends string, TRule = ColumnRule<TRow>> = {
  readonly [K in TId]: ColumnHandle<TRow, K, TRule>;
};

export interface ColumnHandle<TRow, K extends string = string, TRule = ColumnRule<TRow>> {
  readonly id: K;
  /** @internal */
  readonly [COLUMN_RECORDER]: ColumnSchemaRecorder<TRow, TRule>;
}

export type ColumnsSchemaFn<TRow, TId extends string = string> = (
  path: ColumnsPath<TRow, TId>
) => void;

/** Opaque, compiled form of a schema fn — the standalone-reuse value. */
export interface ColumnSchema<TRow> {
  readonly kind: 'column-schema';
  readonly rules: readonly ColumnRule<TRow>[];
}

/**
 * Unique typed key for a consumer-registered column metadata entry — object identity is the
 * actual key; `_type` is a phantom carrier so `T` flows through `metadata()`/`readColumnMeta()`
 * at compile time only.
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
 * used internally by `applyVisibleAsync()` (`schema/column-rules.ts`).
 */
export interface MetadataAsyncRule<TRow, TParams = unknown, TResult = unknown, T = unknown> {
  readonly kind: 'metadata-async';
  readonly columnId: string;
  readonly key: ColumnMetaKey<T>;
  readonly params: (ctx: ColumnRuleContext<TRow>) => TParams | undefined;
  readonly factory: (
    params: Signal<TParams | undefined>
  ) => ResourceRef<TResult | undefined>;
  readonly onSuccess: (result: TResult) => T;
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
