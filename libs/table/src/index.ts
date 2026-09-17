// Public API of the table. This file defines the table's own consumer surface and re-exports
// the filters domain's barrel (`./filters`) wholesale — one barrel per domain, not one per repo
// (ADR-0004's 2026-09 amendment). The filters barrel supplies rules and types only; a consumer
// reaches filtering itself through `withFiltering` (below), not through the filters domain
// directly. `api/`, `schema/`, `mutations/`, `engine/` and `directives/` are phases of this
// domain and still have no barrels of their own, so anything under them not listed here is
// internal (mirrors Angular Signal Forms' `public_api.ts`).
export * from './api/create-table';
export * from './api/types';
export * from './directives/table.tokens';
export * from './directives/ngp-table.directive';
export * from './directives/ngp-table-row.directive';
export * from './directives/ngp-table-header-cell.directive';
export * from './directives/ngp-table-cell.directive';
export * from './api/features/with-sorting';
export * from './api/features/with-filtering';
export { withExpansion } from './api/features/with-expansion';
export type { WithExpansionConfig } from './api/features/with-expansion';
export { withRowEdit } from './api/features/with-row-edit';
export type { WithRowEditConfig, RowEditMembers } from './api/features/with-row-edit';
export { withOptimistic } from './api/features/with-optimistic';
export type { OptimisticMembers } from './api/features/with-optimistic';
export { withGrouping } from './api/features/with-grouping';
export type { WithGroupingConfig, GroupingMembers } from './api/features/with-grouping';
export type { ColumnId } from './api/types';
export { withSelection } from './api/features/with-selection';
export type {
  WithSelectionConfig,
  SelectionChange,
  SelectionWriteOptions,
  SelectionMembers,
} from './api/features/with-selection';
export { selectAllIds } from './api/features/selection.utils';
export type {
  EditingState,
  EditingUpdater,
  EditingUpdaterContext,
  PendingOp,
  RowRestorePoint,
  RowSnapshot,
  SnapshotMap,
} from './api/features/editing-state';
export { createTableFeature } from './api/create-table-feature';
export { withComputed } from './api/features/with-computed';
export { composeFeatures } from './api/features/compose-features';
export { columnSchema } from './schema/column-schema';
export { applySortNulls, applyVisible, applyVisibleAsync } from './schema/column-rules';
export type { SortNullsOpts } from './schema/column-rules';
export { createColumnMetaKey, metadata, readColumnMeta } from './schema/column-metadata';
export { applyGrouping, applyGroupingAsync } from './schema/grouping-rules';
export type { GroupingAsyncOpts } from './schema/grouping-rules';
export type {
  AnyGroupingRule,
  GroupingAsyncRule,
  GroupingRule,
  GroupingSchemaFn,
} from './schema/grouping-schema.types';
export { insertRow, removeRow, patchRow } from './mutations/row-mutations';
export { beginEdit, clearEdit, createRow, endEdit } from './mutations/row-edit-mutations';
export type { BeginEditOptions } from './mutations/row-edit-mutations';
export {
  captureEdit,
  discardEdit,
  patchEdit,
  releaseEdit,
  removeEdit,
  revertEdit,
  swapRowId,
} from './mutations/optimistic-mutations';
export type { PatchEditOptions } from './mutations/optimistic-mutations';
export {
  setColumns,
  reorderColumns,
  toggleColumnVisibility,
} from './mutations/update-columns';
export {
  setGroupLevels,
  addGroupLevel,
  removeGroupLevel,
  reorderGroupLevels,
} from './mutations/update-grouping';
export type {
  ColumnHandle,
  ColumnMetaKey,
  ColumnRule,
  ColumnRuleContext,
  ColumnSchema,
  ColumnsPath,
  ColumnsSchemaFn,
} from './schema/column-schema.types';
export * from './filters';
