// Public API of the table. This file is the only definition of the consumer surface —
// `api/`, `engine/` and `directives/` have no barrels of their own, so anything not listed
// here is internal (mirrors Angular Signal Forms' `public_api.ts`).
export * from './api/create-table';
export * from './api/types';
export * from './api/table-schema';
export * from './directives/table.tokens';
export * from './directives/ngp-table.directive';
export * from './directives/ngp-table-row.directive';
export * from './directives/ngp-table-header-cell.directive';
export * from './directives/ngp-table-cell.directive';
export * from './api/features/with-sorting';
export { withExpansion } from './api/features/with-expansion';
export type { WithExpansionConfig } from './api/features/with-expansion';
export { withRowEdit } from './api/features/with-row-edit';
export type { WithRowEditConfig, RowEditMembers } from './api/features/with-row-edit';
export { withOptimistic } from './api/features/with-optimistic';
export type { OptimisticMembers } from './api/features/with-optimistic';
export type {
  EditingState,
  EditingUpdater,
  EditingUpdaterContext,
  RowRestorePoint,
  RowSnapshot,
  SnapshotMap,
} from './api/features/editing-state';
export { createTableFeature } from './api/create-table-feature';
export { columnSchema } from './api/column-schema';
export { applySortNulls, applyVisible, applyVisibleAsync } from './api/column-rules';
export type { SortNullsOpts } from './api/column-rules';
export { createColumnMetaKey, metadata, readColumnMeta } from './api/column-metadata';
export { insertRow, removeRow, patchRow } from './api/row-mutations';
export { beginEdit, clearEdit, endEdit } from './api/row-edit-mutations';
export type { BeginEditOptions } from './api/row-edit-mutations';
export {
  captureEdit,
  discardEdit,
  patchEdit,
  releaseEdit,
  removeEdit,
  revertEdit,
} from './api/optimistic-mutations';
export type { PatchEditOptions } from './api/optimistic-mutations';
export {
  setColumns,
  reorderColumns,
  toggleColumnVisibility,
} from './api/update-columns';
export type {
  ColumnHandle,
  ColumnMetaKey,
  ColumnRule,
  ColumnRuleContext,
  ColumnSchema,
  ColumnsPath,
  ColumnsSchemaFn,
} from './api/column-schema.types';
