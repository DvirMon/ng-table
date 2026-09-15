import type { WritableSignal } from '@angular/core';

/**
 * Rejects a widened `string` while passing any string literal (or literal union) through
 * unchanged — `string extends T` is only true once `T` has been widened to the base type,
 * which happens exactly when the caller passed a plain `string`-typed variable instead of a
 * literal. `TAs` is inferred per rule call from `FilterOptions.as` itself; `StateOf` (see
 * `FilterRule` below) is the separate mechanism that folds every rule's inferred key into the
 * schema-wide criterion map.
 */
type EnforceLiteralKey<T extends string> = string extends T ? never : T;

/**
 * Per-filter override — a default the user can subsequently edit (`source`), a rename for the
 * borrowed path key (`as`), and the criterion that counts as *no filter* (`emptyValue`). See
 * `docs/1-state/filters.md`'s "Sources", "Keys" and "Empty criteria".
 */
export interface FilterOptions<TSource = unknown, TAs extends string = string> {
  readonly source?: () => TSource;
  readonly as?: EnforceLiteralKey<TAs>;
  /**
   * The criterion that counts as *no filter*, replacing the rule's own — used by `reset(null)`
   * and by the skip-when-empty check, which becomes structural equality with this value.
   * A native `<select>` can only express empty as `''`.
   */
  readonly emptyValue?: TSource;
}

/**
 * One filter's reactive state. `criterion()` returns `undefined` when the criterion is empty —
 * the root's `criteria()` composes those into "empties omitted" (R49).
 */
export interface FilterNode<TCriterion> {
  value: WritableSignal<TCriterion>;
  /** The effective criterion — what the engine applies, or `undefined` when this filter is inert. */
  criterion(): TCriterion | undefined;
  /** Whether this filter currently narrows. The same gate `criterion()` reads, as a boolean. */
  isActive(): boolean;
  reset(value?: TCriterion | null): void;
  dirty(): boolean;
}

/**
 * Root filter-set state — read by calling `filters()`, not by property access. `TState` is the
 * flat criterion map compiled from a schema's rule calls: one entry per declared filter or
 * `anyOf` group, folded by `StateOf` (see `FilterRule` below) — `createFilters` infers it from
 * the schema's return value; the caller never supplies it.
 */
export interface FiltersRoot<TRow, TState extends Record<string, unknown>> {
  /**
   * The complete criterion model, and a real `WritableSignal` — a view over the child nodes,
   * which remain the single storage location. Reading is `filters().value()` as before; a
   * write fans out per key. Being writable is what makes `form(filters().value, schema)` work
   * with no adapter and no sync effect (R18).
   */
  value: WritableSignal<TState>;
  /** Every active filter's effective criterion, empties omitted — the request-param shape. */
  criteria(): Partial<TState>;
  /** Whether any filter currently narrows. */
  isActive(): boolean;
  /**
   * `Partial<TState>`, not `TState`: a key the object omits is reset to its declared source,
   * which is what makes restoring a partial snapshot a complete state. Matches what the
   * runtime has always done per key.
   */
  reset(value?: Partial<TState> | null): void;
  dirty(): boolean;
  /**
   * A row predicate compiled from the criteria current at the moment it was requested — usable
   * with no table. **One call = one evaluation**: ADR-0014's once-per-filter reporting is scoped
   * to the returned predicate, so request one per pass, never one per row.
   */
  matcher(): (row: TRow) => boolean;
}

/**
 * Callable + indexable, mirroring Signal Forms: a call reads root state, a property access
 * reaches a child filter node. `TState` is `StateOf<S>` — inferred from the schema's returned
 * rule array, never caller-supplied. See `filters.md`'s Signature section.
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
 * Structural `path` proxy handed to a filters schema function — the `get` trap fabricates a
 * `FilterHandle<TRow, K>` per string property, same shape as `ColumnsPath<TRow>`. Branded on
 * `TRow` extends `never` (the empty carrier `createFilters([], …)` produces) so the error blames
 * the empty carrier that caused it, not the schema function that merely inherited it.
 * @internal
 */
export type FiltersPath<TRow> = [TRow] extends [never]
  ? {
      readonly __rowTypeCouldNotBeInferred_useRowOf: 'createFilters: the first argument is empty, so the row type is unknown. Pass rowOf<Row>() instead.';
    }
  : { readonly [K in Extract<keyof TRow, string>]: FilterHandle<TRow, K> };

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
  /** Generic in the handle: `TRow` is the default only, and a handle from any row is accepted. */
  valueOf<R = TRow, K extends Extract<keyof R, string> = Extract<keyof R, string>>(
    path: FilterHandle<R, K>
  ): unknown;
}

/**
 * Compiled form of one declared filter — returned by every rule function and consumed by
 * `create-filters.ts` to build root/child state.
 *
 * `kind: 'group'` (anyOf) carries `children` instead of using `predicate`/`paths` directly —
 * `paths` is still populated (`children.map(c => c.path)`) so path-uniqueness validation stays
 * uniform across kinds. `kind: 'conditional'` (applyWhen) is structurally a 'single' (or,
 * unsupported today, 'group') record with `condition` attached — `create-filters.ts`'s flattener
 * re-tags each gated rule's own record rather than nesting an `inner` field, so no separate
 * unwrapping step is needed at evaluation time.
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

/**
 * A rule's static inference channel — carries its key, criterion and row type statically, on top
 * of the runtime `FilterRuleRecord` shape it extends. All three `__`-members are phantom
 * (optional, never assigned at runtime): `Flatten`/`StateOf` below read them off a schema's
 * returned array.
 *
 * `__row` exists because `TRow` is otherwise unrecoverable — `FilterRuleRecord<TRow>` mentions it
 * only in the optional `condition`, whose `valueOf` is generic in its own handle, so nothing
 * distinguishes two rules built from different rows.
 * @internal
 */
export interface FilterRule<TKey extends string, TCriterion, TRow = unknown>
  extends FilterRuleRecord<TRow> {
  readonly __key?: TKey;
  readonly __criterion?: TCriterion;
  readonly __row?: TRow;
}

/**
 * `anyOf`'s return type — a `FilterRule` narrowed to `kind: 'group'`. The key is positional
 * (passed to `anyOf(key, children)`, not borrowed from a path), matching the runtime record.
 * @internal
 */
export interface GroupRule<TKey extends string, TCriterion, TRow = unknown>
  extends FilterRule<TKey, TCriterion, TRow> {
  readonly kind: 'group';
}

/**
 * `applyWhen`'s return type — one nestable node, not an array. Carries its children in `S` so
 * `Flatten` (and the runtime flattener in `create-filters.ts`) can recurse into it, folding the
 * node to its children's keys when it sits directly in a schema array. Not spreadable — no
 * `[Symbol.iterator]` — so `...applyWhen(…)` fails to compile instead of silently dropping the
 * gated filters the way a forgotten spread on an array-returning `applyWhen` did.
 * @internal
 */
export interface ConditionalRule<S extends readonly unknown[]> {
  readonly kind: 'conditional';
  readonly children: S;
}

/**
 * The union `StateOf` extracts against — whatever `Flatten` is allowed to resolve to a keyed
 * entry: a single rule or an `anyOf` group.
 * @internal
 */
export type AnyRule = FilterRule<string, unknown> | GroupRule<string, unknown>;

/** The criterion type carried by a rule's phantom `__criterion` member. */
export type CriterionOf<R> = R extends FilterRule<string, infer C> ? C : never;

/** The row type carried by a rule's phantom `__row` member. */
export type RowOfRule<R> = R extends FilterRule<string, unknown, infer TRow> ? TRow : never;

/**
 * Element type of an array-valued cell, `unknown` for anything else. Lets `hasAny`/`hasNone`
 * default their criterion to the cell's own element type instead of discarding it — without it a
 * `string[]` column yields `readonly unknown[]`, which no consumer can write back through.
 * @internal
 */
export type ItemOf<TCell> = TCell extends readonly (infer E)[] ? E : unknown;

/** `true` for `any` alone — the only type assignable to both `0` and `1 & T`. @internal */
type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Resolves a schema's returned array down to its leaf rules, recursing through nested arrays and
 * through a `ConditionalRule`'s `children`. Terminates on any item that is neither.
 *
 * `any` is discarded first, and must stay first. `any` satisfies `readonly unknown[]`, and
 * `Flatten<any>` is `FlattenItem<any>` again — an infinite recursion the compiler reports as
 * `TS2589` at the whole `createFilters()` call, burying the real error that produced the `any`.
 * @internal
 */
type FlattenItem<Item> = IsAny<Item> extends true
  ? never
  : Item extends ConditionalRule<infer C>
    ? Flatten<C>
    : Item extends readonly unknown[]
      ? Flatten<Item>
      : Item;

/** @internal */
export type Flatten<T extends readonly unknown[]> = FlattenItem<T[number]>;

/**
 * The schema-wide criterion map: one entry per declared filter or `anyOf` group, keyed by each
 * rule's statically carried key. Constrained to `readonly unknown[]`, never a rule-typed array —
 * naming the key type in the constraint would contextually widen every rule's key to `string`
 * before inference runs.
 */
export type StateOf<T extends readonly unknown[]> = {
  [R in Extract<Flatten<T>, AnyRule> as NonNullable<R['__key']>]: CriterionOf<R>;
};
