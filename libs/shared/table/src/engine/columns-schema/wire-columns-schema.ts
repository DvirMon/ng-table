import type {
  ColumnRule,
  ColumnRuleContext,
  ColumnsSchemaStore,
} from '../../schema/column-schema.types';
import type { ColumnRuleEntry } from '../columns';
import type { TableFeatureSpec } from '../types';
import {
  buildAsyncMetadataEntry,
  buildMetadataEntries,
  isMetadataAsyncRule,
  isMetadataRule,
} from './wiring';

/**
 * Feature that turns compiled reactive/async column-schema rules into `ColumnRuleEntry`
 * values the engine folds onto `baseColumns` (`foldColumnRules`) — declares, never mutates
 * the store.
 *
 * Entries are built at feature-factory time, not inside `setup`: `composeTable()`'s
 * `foldFeatures()` reads `spec.columnRules` synchronously right after this factory returns,
 * before any `setup` hook runs, so an async rule's `resource()` (built here) must already
 * exist by then. This is safe because `createTable()` already wraps the whole
 * `composeTable()` call in `runInInjectionContext()`.
 *
 * With an empty `rules` list (the legacy no-`columnsSchema` path), both filters produce empty
 * arrays: zero entries, and the feature contributes no members at all.
 *
 * Auto-composed by `createTable()`, unlike every other `with-*()` feature.
 */
export function wireColumnsSchemaAsync<TRow>(
  rules: readonly ColumnRule<TRow>[]
): (core: ColumnsSchemaStore<TRow>) => TableFeatureSpec<TRow> {
  const metadataRules = rules.filter(isMetadataRule);
  const metadataAsyncRules = rules.filter(isMetadataAsyncRule);

  return (core: ColumnsSchemaStore<TRow>): TableFeatureSpec<TRow> => {
    // Resolves to `baseColumns`, never the derived `columns` — see `ColumnRuleContext`'s doc
    // comment (D8).
    const ctx: ColumnRuleContext<TRow> = { columns: () => core.baseColumns() };

    const columnRules: ColumnRuleEntry<TRow>[] = [
      ...buildMetadataEntries(ctx, metadataRules),
      ...metadataAsyncRules.map((rule) => buildAsyncMetadataEntry(ctx, rule)),
    ];

    return { columnRules };
  };
}
