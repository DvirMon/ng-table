import type { Signal } from '@angular/core';
import type { ColumnMetaKey } from '../columns-schema/types';
import type { ColumnDef, ColumnDefInput } from '../api/types';

// `ColumnMetaKey` is type-only and `columns-schema/types.ts` has no import back into
// `engine/`, so this reverse (engine -> columns-schema) edge doesn't close a cycle — it's just
// the one place `engine/` needs a `columns-schema/` type to describe what it's folding.

/**
 * Pure `ColumnDef[]` transforms. No signals, no Angular — the store's column methods are thin
 * `signal.update()` wrappers around these, so column behavior is testable without a live store.
 */

// Angular's global dev-mode flag. Declared locally because `tsconfig.lib.json` sets
// `"types": []`, so no ambient declaration is in scope. Module-scoped, so it cannot
// collide with another file's declaration.
declare const ngDevMode: boolean | undefined;

// Narrows `unknown` to an indexable object before a default accessor reads `def.id` off it —
// `TRow` is unconstrained here, so nothing guarantees `row` is actually object-shaped.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Guards against two columns silently colliding on `id`, e.g. in a keyed record like
// `RenderRow.cells`. Deterministic and construction-time, so it throws (ADR-0014).
function assertUniqueColumnIds<TRow>(defs: ColumnDefInput<TRow>[]): void {
  const seen = new Set<string>();
  for (const def of defs) {
    if (seen.has(def.id)) {
      throw new Error(
        `[createTable] Duplicate column id provided: "${def.id}" — ensure all column ids are unique.`
      );
    }
    seen.add(def.id);
  }
}

/**
 * Fills in `accessor`/`visible`/`order`/`label` for any column def that omitted them, so the
 * resolved state (`store.columns()`) is always a full `ColumnDef[]` regardless of how sparse
 * the author-facing `ColumnDefInput[]` was.
 *
 * @remarks
 * Note: throws on a duplicate `id` in dev mode — two columns sharing an id would collide in
 * `RenderRow.cells`, a record keyed by id.
 */
export function resolveColumnDefs<TRow>(
  defs: ColumnDefInput<TRow>[]
): ColumnDef<TRow>[] {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    assertUniqueColumnIds(defs);
  }
  return defs.map((def, index) => ({
    ...def,
    accessor:
      def.accessor ?? ((row: TRow) => (isRecord(row) ? row[def.id] : undefined)),
    visible: def.visible ?? true,
    order: def.order ?? index,
    label: def.label ?? def.id,
  }));
}

/** Rewrites `order` from the given id list. Columns absent from `ids` keep their current order. */
export function applyColumnOrder<TRow>(
  columns: ColumnDef<TRow>[],
  ids: string[]
): ColumnDef<TRow>[] {
  const orderById = new Map(ids.map((id, index) => [id, index]));
  return columns.map((column) => ({
    ...column,
    order: orderById.get(column.id) ?? column.order,
  }));
}

/** Sets `visible` on one column by id. Unknown ids are a no-op. */
export function setColumnVisible<TRow>(
  columns: ColumnDef<TRow>[],
  id: string,
  visible: boolean
): ColumnDef<TRow>[] {
  return columns.map((column) =>
    column.id === id ? { ...column, visible } : column
  );
}

/** Flips `visible` on one column by id. Unknown ids are a no-op. */
export function toggleColumnVisible<TRow>(
  columns: ColumnDef<TRow>[],
  id: string
): ColumnDef<TRow>[] {
  return columns.map((column) =>
    column.id === id ? { ...column, visible: !column.visible } : column
  );
}

/**
 * Internal metadata key `applyVisible()`/`applyVisibleAsync()` (`columns-schema/rules.ts`) write
 * to — never exported, so consumers can't read or collide with it via `readColumnMeta()`.
 * `foldColumnRules` special-cases it: unlike every other metadata key (single-writer, enforced
 * by `resolve.ts`), multiple entries targeting `VISIBLE` on the same column are allowed and
 * AND-combined.
 */
export const VISIBLE: ColumnMetaKey<boolean> = { kind: 'column-meta-key' };

/**
 * Internal metadata key `applySortNulls()` (`columns-schema/rules.ts`) writes to — the per-column
 * null-ordering override consumed by `withSorting()`'s `sortRows`. Unlike `VISIBLE`, single-
 * writer: two `applySortNulls()` calls on the same column throw at resolve time, so it needs no
 * special case in `foldColumnRules` — it flows through the generic `meta` map like any consumer
 * key.
 */
export const SORT_NULLS: ColumnMetaKey<{
  readonly order?: 'first' | 'last';
  readonly emptyString?: 'is-empty';
}> = { kind: 'column-meta-key' };

/**
 * One rule's contribution to the fold: which column and metadata key it targets, and a live
 * signal of its current result. `undefined` means the rule hasn't resolved (e.g. an async rule
 * before first resolution) and contributes nothing.
 */
export interface ColumnRuleEntry<TRow = unknown> {
  readonly columnId: string;
  readonly key: ColumnMetaKey<unknown>;
  readonly result: Signal<unknown>;
}

/**
 * The full set of registered rule entries a table folds over. Static for the table's lifetime —
 * only the entries' `result` signals and the `columns` they're folded against change.
 */
export type ColumnRuleRegistry<TRow = unknown> = readonly ColumnRuleEntry<TRow>[];

/**
 * Folds registered rules onto `columns` — the single resolution path for both `visible` and
 * consumer metadata, grouped by `(columnId, key)`. `VISIBLE`-keyed entries on the same column
 * are ANDed together; a group with no *defined* result yet contributes nothing, so the base
 * column's `visible` stands. Every other key is single-writer (guaranteed by `resolve.ts`) and
 * lands in `column.meta`. Entries whose `columnId` isn't in `columns` are silently skipped.
 * Columns with no registered rules pass through by identity.
 */
export function foldColumnRules<TRow>(
  columns: ColumnDef<TRow>[],
  registry: ColumnRuleRegistry<TRow>
): ColumnDef<TRow>[] {
  const valuesByColumnId = new Map<string, Map<ColumnMetaKey<unknown>, unknown[]>>();

  for (const entry of registry) {
    const value = entry.result();
    if (value === undefined) continue;
    const byKey = valuesByColumnId.get(entry.columnId) ?? new Map<ColumnMetaKey<unknown>, unknown[]>();
    const values = byKey.get(entry.key);
    if (values) values.push(value);
    else byKey.set(entry.key, [value]);
    valuesByColumnId.set(entry.columnId, byKey);
  }

  return columns.map((column) => {
    const byKey = valuesByColumnId.get(column.id);
    if (!byKey) return column;

    const visibleValues = byKey.get(VISIBLE);
    const isEveryVisibleValueTrue =
      visibleValues !== undefined && visibleValues.every((value) => value === true);
    const visible = visibleValues ? isEveryVisibleValueTrue : column.visible;

    let meta: Map<ColumnMetaKey<unknown>, unknown> | undefined;
    for (const [key, values] of byKey) {
      if (key === VISIBLE) continue;
      meta ??= new Map();
      meta.set(key, values[values.length - 1]);
    }

    const withVisible = visible === column.visible ? column : { ...column, visible };
    return meta ? { ...withVisible, meta } : withVisible;
  });
}
