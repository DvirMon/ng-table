import { VISIBLE } from '../columns';
import { columnSchema } from '../../columns-schema/schema';
import type {
  ColumnRule,
  ColumnSchema,
  ColumnsSchemaFn,
} from '../../columns-schema/types';
import type { ColumnDefInput } from '../../api/types';

/** Compile phase: turns author-facing schema input into a validated flat `ColumnRule[]`. */

function isColumnSchema<TRow, TId extends string>(
  value: ColumnsSchemaFn<TRow, TId> | ColumnSchema<TRow>
): value is ColumnSchema<TRow> {
  return typeof value === 'object' && value !== null && value.kind === 'column-schema';
}

function assertRuleColumnIdsAreKnown<TRow, TId extends string>(
  rules: readonly ColumnRule<TRow>[],
  columns: ColumnDefInput<TRow, TId>[]
): void {
  const knownColumnIds = new Set<string>(columns.map((column) => column.id));
  for (const rule of rules) {
    if (!knownColumnIds.has(rule.columnId)) {
      throw new Error(
        `[columnsSchema] Unknown column id "${rule.columnId}" — no column with ` +
          'this id exists in the `columns` array.'
      );
    }
  }
}

/**
 * `metadata()` is single-writer only (no reducer — see
 * `docs/2-columns/reference/column-metadata.md`), so two calls targeting the same
 * `(columnId, key)` pair is an authoring error, not a case to combine. Keys are compared by
 * object identity, matching `createColumnMetaKey()`'s identity-is-the-key design.
 *
 * `VISIBLE` (`engine/columns.ts`) is exempted: `applyVisible()`/`applyVisibleAsync()`
 * (`columns-schema/rules.ts`) are allowed to target the same column multiple times, AND-combined
 * by `foldColumnRules` — the one deliberate multi-writer key in the table.
 */
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
 * Normalizes `columns` + an optional `columnsSchema` (inline fn or a
 * standalone `columnSchema()` value) into a resolved column list plus the
 * flat rule set `wireColumnsSchemaAsync` wires up. Validates every rule's
 * `columnId` exists in `columns`, throwing synchronously — this is the one
 * place both `columns` and the schema are available together.
 *
 * Tier 1 has no static/seed rules to fold into initial column state
 * (`applyVisible`/`applyVisibleAsync` are both reactive/async-only per the
 * ownership model), so `columns` is returned unchanged.
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
