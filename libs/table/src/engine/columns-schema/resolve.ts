import { VISIBLE } from '../columns';
import { columnSchema } from '../../columns-schema/schema';
import type {
  ColumnRule,
  ColumnSchema,
  ColumnsSchemaFn,
} from '../../columns-schema/types';
import type { ColumnDecl, ColumnDefInput, ColumnSet } from '../../api/types';
import { assertDeclarationsAreKnown } from '../../schema/validate';

function isColumnSchema<TRow, TId extends string>(
  value: ColumnsSchemaFn<TRow, TId> | ColumnSchema<TRow>
): value is ColumnSchema<TRow> {
  return typeof value === 'object' && value !== null && value.kind === 'column-schema';
}

function assertRuleColumnIdsAreKnown<TRow, TId extends string>(
  rules: readonly ColumnRule<TRow>[],
  columns: ColumnDefInput<TRow, TId>[]
): void {
  assertDeclarationsAreKnown(
    rules.map((rule) => rule.columnId),
    columns.map((column) => column.id),
    'columnsSchema'
  );
}

// `metadata()` is single-writer only (no reducer) — two calls targeting the same
// `(columnId, key)` pair is an authoring error, not a case to combine. Keys compare by object
// identity, matching `createColumnMetaKey()`'s identity-is-the-key design.
//
// `VISIBLE` (`engine/columns.ts`) is exempted: `visible()`/`visibleAsync()` are
// allowed to target the same column multiple times, AND-combined by `foldColumnRules` — the
// one deliberate multi-writer key in the table.
function assertMetadataKeysAreUnique<TRow>(rules: readonly ColumnRule<TRow>[]): void {
  const seenKeysByColumnId = new Map<string, Set<unknown>>();
  for (const rule of rules) {
    if (rule.kind !== 'metadata' && rule.kind !== 'metadata-async') continue;
    if (rule.key === VISIBLE) continue;
    const seenKeys = seenKeysByColumnId.get(rule.columnId) ?? new Set<unknown>();
    if (seenKeys.has(rule.key)) {
      throw new Error(
        `[columnsSchema] Duplicate metadata() registration for column "${rule.columnId}" — ` +
          'call metadata() at most once per key per column; metadata has no reducer/combine.'
      );
    }
    seenKeys.add(rule.key);
    seenKeysByColumnId.set(rule.columnId, seenKeys);
  }
}

/**
 * Normalizes `columns` plus an optional `columnsSchema` into a resolved column list and the
 * flat rule set `wireColumnsSchemaAsync` wires up.
 *
 * @remarks
 * Validates every rule's `columnId` exists in `columns`, throwing synchronously — this is
 * the one place both are available together. Tier 1 has no static/seed rules to fold into
 * initial column state, so `columns` is returned unchanged.
 */
export function resolveColumnsConfig<TRow, TId extends string>(
  columns: ColumnDefInput<TRow, TId>[],
  schema?: ColumnsSchemaFn<TRow, TId> | ColumnSchema<TRow>
): { columns: ColumnDefInput<TRow, TId>[]; rules: readonly ColumnRule<TRow>[] } {
  if (!schema) {
    return { columns, rules: [] };
  }

  const resolvedSchema = isColumnSchema(schema) ? schema : columnSchema(schema);
  assertRuleColumnIdsAreKnown(resolvedSchema.rules, columns);
  assertMetadataKeysAreUnique(resolvedSchema.rules);

  return { columns, rules: resolvedSchema.rules };
}

/**
 * Normalizes `TableConfig.columns` intake — a plain array or a `createColumns()` `ColumnSet`
 * — into the one shape `resolveColumnsConfig` validates.
 *
 * @remarks
 * A plain array carries no rules — `columnsSchema` is not a config property. A `ColumnSet`'s
 * rules are already resolved by `createColumns()`, so they're wrapped rather than re-derived;
 * this branch never reads `columnsSchema` or the set's `data`.
 */
export function resolveColumnsIntake<TRow>(
  columnsInput:
    | readonly ColumnDefInput<TRow, string>[]
    | ColumnSet<TRow, readonly ColumnDecl<TRow, string, unknown>[]>
): { columns: ColumnDefInput<TRow, string>[]; rules: readonly ColumnRule<TRow>[] } {
  if (Array.isArray(columnsInput)) {
    return resolveColumnsConfig([...columnsInput]);
  }

  // Note: `Array.isArray` narrows the array arm but can't exclude the readonly-array union
  // member from the `else` arm here — `ReadonlyArray` isn't assignable to the `any[]`
  // predicate it guards on, so TS can't prove the array case impossible.
  const set = columnsInput as ColumnSet<TRow, readonly ColumnDecl<TRow, string, unknown>[]>;
  return resolveColumnsConfig([...set.columns], { kind: 'column-schema', rules: set.rules });
}
