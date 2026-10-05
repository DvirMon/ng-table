import { assertUniqueColumnIds, VISIBLE } from '../engine/columns';
import { columnSchema } from '../columns-schema/schema';
import type { ColumnRule, ColumnSchema, ColumnsSchemaFn } from '../columns-schema/types';
import { assertDeclarationsAreKnown } from '../schema/validate';
import type {
  ColumnBuilder,
  ColumnDecl,
  ColumnDefInput,
  ColumnIdIn,
  ColumnSet,
  ColumnValues,
  Presentation,
} from './types';

// Angular's global dev-mode flag. Declared locally because `tsconfig.lib.json` sets
// `"types": []`, so no ambient declaration is in scope. Module-scoped, so it cannot
// collide with another file's declaration.
declare const ngDevMode: boolean | undefined;

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
export function createColumns<TRow, TCols extends readonly ColumnDecl<TRow, string, unknown>[]>(
  data: () => readonly TRow[] | undefined,
  build: (col: ColumnBuilder<TRow>) => TCols,
  schema?: ColumnsSchemaFn<TRow, ColumnIdIn<ColumnValues<TRow, TCols>>> | ColumnSchema<TRow>,
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
  columns: TCols,
) => TCols;

export function createColumns<TRow>(
  data?: () => readonly TRow[] | undefined,
  build?: (col: ColumnBuilder<TRow>) => readonly ColumnDecl<TRow, string, unknown>[],
  schema?: ColumnsSchemaFn<TRow, string> | ColumnSchema<TRow>,
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
  assertColumnSetIsWellFormed(columns, rules);

  return { columns, rules };
}

function resolveColumnRules<TRow>(
  schema: ColumnsSchemaFn<TRow, string> | ColumnSchema<TRow> | undefined,
): readonly ColumnRule<TRow>[] {
  if (schema === undefined) {
    return [];
  }

  const isSchemaFn = typeof schema === 'function';
  return isSchemaFn ? columnSchema(schema).rules : schema.rules;
}

// Runs every construction-time check a declared column set must pass: no
// duplicate column id, every rule's columnId names a declared column, no
// duplicate metadata() key per column. Each check gates itself in dev
// mode — nothing here gates a second time.
function assertColumnSetIsWellFormed<TRow>(
  columns: readonly ColumnDecl<TRow, string, unknown>[],
  rules: readonly ColumnRule<TRow>[],
): void {
  assertUniqueColumnIds(columns, 'createColumns');
  assertRuleColumnIdsAreKnown(rules, columns);
  assertMetadataKeysAreUnique(rules);
}

function assertRuleColumnIdsAreKnown<TRow>(
  rules: readonly ColumnRule<TRow>[],
  columns: readonly ColumnDecl<TRow, string, unknown>[],
): void {
  assertDeclarationsAreKnown(
    rules.map((rule) => rule.columnId),
    columns.map((column) => column.id),
    'createColumns',
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
  if (typeof ngDevMode !== 'undefined' && !ngDevMode) return;

  const seenKeysByColumnId = new Map<string, Set<unknown>>();
  for (const rule of rules) {
    if (rule.kind !== 'metadata' && rule.kind !== 'metadata-async') continue;
    if (rule.key === VISIBLE) continue;
    const seenKeys = seenKeysByColumnId.get(rule.columnId) ?? new Set<unknown>();
    if (seenKeys.has(rule.key)) {
      throw new Error(
        `[createColumns] Duplicate metadata() registration for column "${rule.columnId}" — ` +
          'call metadata() at most once per key per column; metadata has no reducer/combine.',
      );
    }
    seenKeys.add(rule.key);
    seenKeysByColumnId.set(rule.columnId, seenKeys);
  }
}

function createColumnBuilder<TRow>(): ColumnBuilder<TRow> {
  function col(id: string, opts?: Presentation & { accessor?: (row: TRow) => unknown }) {
    // `resolveColumnDefs` keeps owning the default `(row) => row[id]` accessor — the builder
    // sets none, so a re-declared id still resolves against its own field.
    return { id, ...opts };
  }

  function from(
    decl: ColumnDecl<TRow, string, unknown>,
    opts: Presentation & { id?: string; accessor?: (row: TRow) => unknown },
  ) {
    return { ...decl, ...opts };
  }

  // The brand is type-only: the runtime object never carries `[COLUMN_DECL]`. One cast for the
  // whole builder — same shape as `buildColumnsPath`'s single proxy cast
  // (`columns-schema/schema.ts`).
  return Object.assign(col, { from }) as ColumnBuilder<TRow>;
}
