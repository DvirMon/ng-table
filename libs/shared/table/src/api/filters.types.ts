import type { WritableSignal } from '@angular/core';

/**
 * Rejects a widened `string` while passing any string literal (or literal union) through
 * unchanged — `string extends T` is only true once `T` has been widened to the base type,
 * which happens exactly when the caller passed a plain `string`-typed variable instead of a
 * literal. Resolves R32: `TAs` is inferred per rule call from `FilterOptions.as` itself, so no
 * schema-wide `TState` derivation is needed to enforce this.
 */
type EnforceLiteralKey<T extends string> = string extends T ? never : T;

/**
 * Per-filter override — a default the user can subsequently edit (`source`), and a rename for
 * the borrowed path key (`as`). See `docs/1-state/filters.md`'s "Sources" and "Keys".
 */
export interface FilterOptions<TSource = unknown, TAs extends string = string> {
  readonly source?: () => TSource;
  readonly as?: EnforceLiteralKey<TAs>;
}

/**
 * One filter's reactive state. `active()` returns `undefined` when the criterion is empty —
 * the primitive `Filters<TRow>.active()` (root) composes into "empties omitted".
 */
export interface FilterNode<TCriterion> {
  value: WritableSignal<TCriterion>;
  active(): TCriterion | undefined;
  reset(value?: TCriterion | null): void;
  dirty(): boolean;
}

/**
 * Root filter-set state — read by calling `filters()`, not by property access. `TState` is the
 * flat criterion map compiled from a schema's rule calls: one entry per declared filter or
 * `anyOf` group.
 *
 * See the "Typing the root" note on `Filters` below for why `TState` is a caller-supplied type
 * parameter rather than something inferred from the schema function.
 */
export interface FiltersRoot<TState extends Record<string, unknown> = Record<string, unknown>> {
  /**
   * The complete criterion model, and a real `WritableSignal` — a view over the child nodes,
   * which remain the single storage location. Reading is `filters().value()` as before; a
   * write fans out per key. Being writable is what makes `form(filters().value, schema)` work
   * with no adapter and no sync effect (R18).
   */
  value: WritableSignal<TState>;
  active(): Partial<TState>;
  /**
   * `Partial<TState>`, not `TState`: a key the object omits is reset to its declared source,
   * which is what makes restoring a partial snapshot a complete state. Matches what the
   * runtime has always done per key.
   */
  reset(value?: Partial<TState> | null): void;
  dirty(): boolean;
}

/**
 * Callable + indexable, mirroring Signal Forms: a call reads root state, a property access
 * reaches a child filter node. `TState` is caller-supplied rather than inferred from `schema`
 * — see `filters.md`'s Signature section and R32 for why.
 */
export type Filters<
  TRow,
  TState extends Record<string, unknown> = Record<string, unknown>
> = (() => FiltersRoot<TState>) & {
  readonly [K in keyof TState]: () => FilterNode<TState[K]>;
};

/** @internal */
export const FILTER_RECORDER: unique symbol = Symbol('FILTER_RECORDER');

/**
 * Recorder every rule call (Step 5) writes into. Deliberately separate from
 * `schema/column-schema.types.ts`'s `ColumnSchemaRecorder` — filters carry no `ColumnDef`/
 * `baseColumns` in scope (server mode: filters exist before any table exists), so reusing that
 * recorder would widen it to a rule union it has no reason to know about, coupling an
 * already-shipped, unrelated feature to this one.
 * @internal
 */
export interface FilterSchemaRecorder<TRow> {
  record(rule: FilterRuleRecord<TRow>): void;
}

/**
 * Structural handle fabricated per path property access, carrying its own recorder rather than
 * sharing `schema/column-schema.types.ts`'s `ColumnHandle`/`COLUMN_RECORDER`.
 * @internal
 */
export interface FilterHandle<
  TRow,
  K extends Extract<keyof TRow, string> = Extract<keyof TRow, string>
> {
  readonly id: K;
  /** @internal */
  readonly [FILTER_RECORDER]: FilterSchemaRecorder<TRow>;
}

/**
 * Structural `path` proxy handed to a filters schema function — the `get` trap fabricates a
 * `FilterHandle<TRow, K>` per string property, same shape as `ColumnsPath<TRow>`.
 * @internal
 */
export type FiltersPath<TRow> = {
  readonly [K in Extract<keyof TRow, string>]: FilterHandle<TRow, K>;
};

/**
 * One `anyOf` sibling: its own path + predicate, OR'd against the group's single shared
 * criterion (no key/emptyValue of its own — the group record carries those).
 * @internal
 */
export interface FilterGroupChild<TCell = unknown, TCriterion = unknown> {
  readonly path: string;
  readonly predicate: (cell: TCell, criterion: TCriterion) => boolean;
}

/**
 * Context `applyWhen`'s `condition` reads other filters' *current criterion values* through —
 * not row data. Untyped per-path (`unknown`) because the criterion shape behind a path depends
 * on which rule registered it, which this context has no way to recover statically.
 * @internal
 */
export interface FilterValueOfContext<TRow> {
  valueOf(path: FilterHandle<TRow, Extract<keyof TRow, string>>): unknown;
}

/**
 * Compiled form of one declared filter, pushed into the recorder by every rule function
 * (Step 5) and consumed by `create-filters.ts` (Step 4) to build root/child state.
 *
 * `kind: 'group'` (anyOf) carries `children` instead of using `predicate`/`paths` directly —
 * `paths` is still populated (`children.map(c => c.path)`) so path-uniqueness validation stays
 * uniform across kinds. `kind: 'conditional'` (applyWhen) is structurally a 'single' (or,
 * unsupported today, 'group') record with `condition` attached — rules.ts re-tags the wrapped
 * rule's own record rather than nesting an `inner` field, so no separate unwrapping step is
 * needed at evaluation time.
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
