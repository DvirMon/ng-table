import type { ResourceRef, Signal } from '@angular/core';
import type { ColumnDef } from './types';

/**
 * Read-only reactive context handed to a rule's `when`/`params` callback.
 * Minimal by design (Tier 1 only needs the current resolved columns) —
 * mirrors how `with-sorting.ts` reads `store.columns()`.
 *
 * Resolves to `baseColumns`, never the derived `columns` — rules observe declared and
 * imperatively-updated column state, never another rule's own output. Reading `columns`
 * here would close the `columns → ruleResults → params → resource → ruleResults` cycle (D8).
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
 * @internal
 */
export interface ColumnSchemaRecorder<TRow> {
  record(rule: ColumnRule<TRow>): void;
}

/**
 * Structural proxy mirroring Signal Forms' `FieldPathNode` — the `get` trap
 * fabricates a `ColumnHandle<TRow, K>` for any string property accessed. It
 * does not read actual column data; typing is 100% compile-time.
 */
export type ColumnsPath<TRow> = {
  readonly [K in Extract<keyof TRow, string>]: ColumnHandle<TRow, K>;
};

export interface ColumnHandle<
  TRow,
  K extends Extract<keyof TRow, string> = Extract<keyof TRow, string>
> {
  readonly id: K;
  /** @internal */
  readonly [COLUMN_RECORDER]: ColumnSchemaRecorder<TRow>;
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
 * `applyVisible()` (`api/column-rules.ts`) records under the unexported `VISIBLE` key
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
 * (`api/column-rules.ts`) to write to `VISIBLE`. Not part of the public `metadata()` surface
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

// --- Store-shape contracts shared across with-columns-schema.ts -----------

/**
 * The slice of a table store `withColumnsSchemaAsync`'s rule wiring reads, and the feature's
 * declared input. Read-only — the wiring builds `ColumnRuleEntry` values instead of writing
 * columns directly (`engine/compose-table.ts` folds them in). `TableCore<TRow>` satisfies it
 * structurally.
 */
export interface ColumnsSchemaStore<TRow> {
  readonly baseColumns: Signal<ColumnDef<TRow>[]>;
}
