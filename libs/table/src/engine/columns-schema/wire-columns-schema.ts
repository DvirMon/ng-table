import type {
  ColumnRule,
  ColumnRuleContext,
  ColumnsSchemaStore,
} from '../../columns-schema/types';
import type { ColumnRuleEntry } from '../columns';
import type { TableFeatureSpec } from '../types';
import { assertDeclarationsAreKnown } from '../../schema/validate';
import {
  buildAsyncMetadataEntry,
  buildMetadataEntries,
  isMetadataAsyncRule,
  isMetadataRule,
} from './wiring';

/**
 * Compiles column-schema rules into `ColumnRuleEntry` values the engine folds onto
 * `baseColumns`. Declares only — never mutates the store directly.
 *
 * @remarks
 * Built synchronously at factory time, not inside `setup`: `composeTable()` reads
 * `spec.columnRules` right after the factory returns, so an async rule's `resource()` must
 * already exist (safe — `createTable()` wraps the call in `runInInjectionContext()`).
 * Auto-composed by `createTable()`, unlike other `with-*()` features.
 */
export function wireColumnsSchemaAsync<TRow>(
  rules: readonly ColumnRule<TRow>[]
): (core: ColumnsSchemaStore<TRow>) => TableFeatureSpec<TRow> {
  const metadataRules = rules.filter(isMetadataRule);
  const metadataAsyncRules = rules.filter(isMetadataAsyncRule);

  return (core: ColumnsSchemaStore<TRow>): TableFeatureSpec<TRow> => {
    // Fixed at this factory's construction time — the same list `createColumns()`'s
    // `assertRuleColumnIdsAreKnown` validated `rules` against. Never rebuilt from a later,
    // live `core.baseColumns()` read; that's `stateOf`'s lookup below, which is what lets
    // a column removed via `setColumns()` degrade instead of throw.
    const knownIds = new Set(core.baseColumns().map((column) => column.id));

    // Resolves to `baseColumns`, never the derived `columns` — see `ColumnRuleContext`'s doc
    // comment for why.
    const ctx: ColumnRuleContext<TRow> = {
      columns: () => core.baseColumns(),
      stateOf(handle) {
        assertDeclarationsAreKnown([handle.id], knownIds, 'createColumns');
        const column = core.baseColumns().find((c) => c.id === handle.id);
        return {
          visible: column?.visible ?? true,
          label: column?.label ?? handle.id,
          meta: column?.meta,
        };
      },
    };

    const columnRules: ColumnRuleEntry<TRow>[] = [
      ...buildMetadataEntries(ctx, metadataRules),
      ...metadataAsyncRules.map((rule) => buildAsyncMetadataEntry(ctx, rule)),
    ];

    return { columnRules };
  };
}
