import { columnSchema } from '../columns-schema/schema';
import type { ColumnRule, ColumnSchema, ColumnsSchemaFn } from '../columns-schema/types';
import type {
  ColumnBuilder,
  ColumnDecl,
  ColumnDefInput,
  ColumnIdIn,
  ColumnSet,
  ColumnValues,
  Presentation,
} from './types';

/**
 * Declares a table's columns — and, optionally, their column-schema rules — in one call.
 *
 * @remarks
 * The `col` builder feeds `ColumnValues<>`'s per-column type: an explicit `accessor` types by
 * its return value, an omitted one by the matching `TRow` field. `data` binds `TRow` only and
 * is never read. `schema` accepts an inline `(path) => void` or `columnSchema(...)`; omitted,
 * the set carries no rules.
 *
 * @example
 * ```ts
 * const cols = createColumns(data, (col) => [
 *   col('name'),
 *   col('total', { accessor: (row) => row.amount * row.qty }),
 * ]);
 * ```
 */
export function createColumns<
  TRow,
  TCols extends readonly ColumnDecl<TRow, string, unknown>[],
>(
  data: () => readonly TRow[] | undefined,
  build: (col: ColumnBuilder<TRow>) => TCols,
  schema?:
    | ColumnsSchemaFn<TRow, ColumnIdIn<ColumnValues<TRow, TCols>>>
    | ColumnSchema<TRow>
): ColumnSet<TRow, TCols>;

/**
 * Curried capture form, superseded by the data-first overload above — do not add new callers.
 *
 * @remarks
 * Call with the row type first, then the column array inside the second call —
 * `createColumns<TRow>()([...])` — so TypeScript's `const` modifier applies to the literal.
 */
export function createColumns<TRow>(): <
  const TCols extends readonly ColumnDefInput<TRow, string>[],
>(
  columns: TCols
) => TCols;

export function createColumns<TRow>(
  data?: () => readonly TRow[] | undefined,
  build?: (col: ColumnBuilder<TRow>) => readonly ColumnDecl<TRow, string, unknown>[],
  schema?: ColumnsSchemaFn<TRow, string> | ColumnSchema<TRow>
): unknown {
  const isCurriedForm = build === undefined;
  if (isCurriedForm) {
    return <const TCols extends readonly ColumnDefInput<TRow, string>[]>(columns: TCols): TCols =>
      columns;
  }

  // `data` binds TRow only — never read, not even to validate.
  void data;

  const columns = build(createColumnBuilder<TRow>());
  const rules = resolveColumnRules(schema);

  return { columns, rules };
}

function resolveColumnRules<TRow>(
  schema: ColumnsSchemaFn<TRow, string> | ColumnSchema<TRow> | undefined
): readonly ColumnRule<TRow>[] {
  if (schema === undefined) {
    return [];
  }

  const isSchemaFn = typeof schema === 'function';
  return isSchemaFn ? columnSchema(schema).rules : schema.rules;
}

function createColumnBuilder<TRow>(): ColumnBuilder<TRow> {
  function col(id: string, opts?: Presentation & { accessor?: (row: TRow) => unknown }) {
    // `resolveColumnDefs` keeps owning the default `(row) => row[id]` accessor — the builder
    // sets none, so a re-declared id still resolves against its own field.
    return { id, ...opts };
  }

  function from(
    decl: ColumnDecl<TRow, string, unknown>,
    opts: Presentation & { id?: string; accessor?: (row: TRow) => unknown }
  ) {
    return { ...decl, ...opts };
  }

  // The brand is type-only: the runtime object never carries `[COLUMN_DECL]`. One cast for the
  // whole builder — same shape as `buildColumnsPath`'s single proxy cast
  // (`columns-schema/schema.ts`).
  return Object.assign(col, { from }) as ColumnBuilder<TRow>;
}
