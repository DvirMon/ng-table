import type { ResourceRef, Signal } from '@angular/core';
import type { ColumnDef } from '../api/types';

/**
 * Read-only reactive context handed to a rule's `when`/`params` callback.
 * Minimal by design (Tier 1 only needs the current resolved columns) —
 * mirrors how `with-sorting.ts` reads `store.columns()`.
 *
 * Resolves to `baseColumns`, never the derived `columns` — rules observe declared and
 * imperatively-updated column state, never another rule's own output. Reading `columns`
 * here would close the `columns → ruleResults → params → resource → ruleResults` cycle.
 */
export interface ColumnRuleContext<TRow> {
  readonly columns: () => ColumnDef<TRow>[];
}

/** @internal */
export const COLUMN_RECORDER: unique symbol = Symbol('COLUMN_RECORDER');

/**
 * Internal recorder every `apply*` call writes into. One instance per
 * `columnSchema()` / inline-fn execution — collects rules for later
 * resolution by `resolveColumnsConfig()`.
 *
 * Generic on `TRule`, defaulting to `ColumnRule<TRow>` so every existing caller (which names
 * zero type arguments) keeps resolving to exactly the same type. A session is homogeneous — one
 * rule family per session — instantiated differently at different call sites (e.g. a future
 * grouping session at `TRule = AnyGroupingRule<TRow>`), never widened to `unknown` here.
 * @internal
 */
export interface ColumnSchemaRecorder<TRow, TRule = ColumnRule<TRow>> {
  /**
   * Generic on `TParams`/`TResult`/`T` (not just `ColumnRule<TRow>`'s default-`unknown` shape)
   * so a caller building a `MetadataRule<TRow, T>`/`MetadataAsyncRule<TRow, TParams, TResult,
   * T>` at its own instantiated types can pass the literal straight through — contextual typing
   * checks it directly, no erasing cast needed at the call site. A structurally-typed `rule:
   * TRule` parameter can't accept this: `MetadataAsyncRule`'s `factory`/`onSuccess` occupy
   * contravariant positions, so `MetadataAsyncRule<TRow, TParams, TResult, T>` is not assignable
   * to `MetadataAsyncRule<TRow, unknown, unknown, unknown>` by ordinary assignability — only a
   * cast (see `column-schema.ts`) bridges it, same as before this type gained `TRule`.
   */
  /**
   * `| TRule` covers a session instantiated at a non-default `TRule` (e.g. a grouping session at
   * `TRule = AnyGroupingRule<TRow>`) — those rule families don't need the
   * `MetadataRule`/`MetadataAsyncRule` contextual-typing shape the rest of this union exists for,
   * so they record straight through as `TRule`. Kept as one signature (not a second overload) so
   * `createRecorderSession`'s single generic implementation satisfies it directly — no
   * `TRule`-shaped default (`ColumnRule<TRow>`) call site changes behavior, since
   * `ColumnRule<TRow>` is already covered by the `Metadata*` arm.
   */
  record<TParams = unknown, TResult = unknown, T = unknown>(
    rule: MetadataRule<TRow, T> | MetadataAsyncRule<TRow, TParams, TResult, T> | TRule
  ): void;
}

/**
 * Structural proxy mirroring Signal Forms' `FieldPathNode` — the `get` trap
 * fabricates a `ColumnHandle<TRow, K, TRule>` for any string property accessed. It
 * does not read actual column data; typing is 100% compile-time.
 */
export type ColumnsPath<TRow, TRule = ColumnRule<TRow>> = {
  readonly [K in Extract<keyof TRow, string>]: ColumnHandle<TRow, K, TRule>;
};

export interface ColumnHandle<
  TRow,
  K extends Extract<keyof TRow, string> = Extract<keyof TRow, string>,
  TRule = ColumnRule<TRow>
> {
  readonly id: K;
  /** @internal */
  readonly [COLUMN_RECORDER]: ColumnSchemaRecorder<TRow, TRule>;
}

export type ColumnsSchemaFn<TRow> = (path: ColumnsPath<TRow>) => void;

/** Opaque, compiled form of a schema fn — the standalone-reuse value. */
export interface ColumnSchema<TRow> {
  readonly kind: 'column-schema';
  readonly rules: readonly ColumnRule<TRow>[];
}

/**
 * Unique typed key for a consumer-registered column metadata entry. Object identity is the
 * actual key — `_type` is a phantom, never-assigned carrier so `T` flows through
 * `metadata()`/`readColumnMeta()` at compile time only. Mirrors Signal Forms'
 * `createMetadataKey()`.
 */
export interface ColumnMetaKey<T> {
  readonly kind: 'column-meta-key';
  /** @internal phantom type carrier — never assigned, compile-time only */
  readonly _type?: T;
}

/**
 * Consumer-defined side-channel data attached to a column, plus the internal shape
 * `applyVisible()` (`schema/column-rules.ts`) records under the unexported `VISIBLE` key
 * (`engine/columns.ts`) — both go through the same recorder/resolve/wiring/fold path.
 * `logic` is either a plain value or a closure over `ColumnRuleContext<TRow>`, discriminated
 * at wiring time. Single-writer only for consumer keys: `resolve.ts` throws if two
 * `metadata()` calls target the same `(columnId, key)` pair — no reducer/combine story there
 * (see `docs/2-columns/reference/column-metadata.md`). `VISIBLE` is exempted from that check
 * since multiple `applyVisible()` calls on one column AND-combine (`engine/columns.ts`'s
 * `foldColumnRules`), mirroring Signal Forms' constraint-validator reducers.
 */
export interface MetadataRule<TRow, T = unknown> {
  readonly kind: 'metadata';
  readonly columnId: string;
  readonly key: ColumnMetaKey<T>;
  readonly logic: T | ((ctx: ColumnRuleContext<TRow>) => T);
}

/**
 * Resource-backed counterpart to `MetadataRule`, generalized from the old `visible-async`
 * shape to carry an arbitrary `key` — used internally by `applyVisibleAsync()`
 * (`schema/column-rules.ts`) to write to `VISIBLE`. Not part of the public `metadata()` surface
 * (no async story there yet); kept as its own rule kind because resource construction
 * (`factory(params)`) must happen once at wiring time, not on every fold, so it can't be
 * expressed as `MetadataRule`'s plain-value-or-closure `logic`.
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
 * The slice of a table store `wireColumnsSchemaAsync`'s rule wiring reads, and the feature's
 * declared input. Read-only — the wiring builds `ColumnRuleEntry` values instead of writing
 * columns directly (`engine/compose-table.ts` folds them in). `TableCore<TRow>` satisfies it
 * structurally.
 */
export interface ColumnsSchemaStore<TRow> {
  readonly baseColumns: Signal<ColumnDef<TRow>[]>;
}
