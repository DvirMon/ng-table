import { columnSchema } from '../../columns-schema/schema';
import type {
  ColumnRule,
  ColumnSchema,
  ColumnsSchemaFn,
} from '../../columns-schema/types';
import type { ColumnDecl, ColumnDefInput, ColumnSet } from '../../api/types';

function isColumnSchema<TRow, TId extends string>(
  value: ColumnsSchemaFn<TRow, TId> | ColumnSchema<TRow>
): value is ColumnSchema<TRow> {
  return typeof value === 'object' && value !== null && value.kind === 'column-schema';
}

/**
 * Normalizes `columns` plus an optional `columnsSchema` into a resolved column list and the
 * flat rule set `wireColumnsSchemaAsync` wires up.
 *
 * @remarks
 * Does not check rule column ids or metadata-key uniqueness — `createColumns()` runs both
 * checks when a schema is declared. `resolveColumnsIntake`'s `ColumnSet` branch passes an
 * already-checked schema through here, so re-running either check would check it twice.
 */
export function resolveColumnsConfig<TRow, TId extends string>(
  columns: ColumnDefInput<TRow, TId>[],
  schema?: ColumnsSchemaFn<TRow, TId> | ColumnSchema<TRow>
): { columns: ColumnDefInput<TRow, TId>[]; rules: readonly ColumnRule<TRow>[] } {
  if (!schema) {
    return { columns, rules: [] };
  }

  const resolvedSchema = isColumnSchema(schema) ? schema : columnSchema(schema);

  return { columns, rules: resolvedSchema.rules };
}

/**
 * Normalizes `TableConfig.columns` intake — a plain array or a `createColumns()` `ColumnSet`
 * — into the one shape `resolveColumnsConfig` normalizes.
 *
 * @remarks
 * A plain array carries no rules — `columnsSchema` is not a config property. A `ColumnSet`'s
 * rules are already resolved and checked by `createColumns()`, so they're wrapped rather than
 * re-derived; this branch never reads `columnsSchema` or the set's `data`.
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
