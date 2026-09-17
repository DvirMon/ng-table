// Public API of the table. `api/`, `schema/`, `mutations/`, `engine/` and `directives/` are
// phases of one domain and have no barrels of their own, so anything under them not listed here
// is internal (mirrors Angular Signal Forms' `public_api.ts`). `filters/` was a second domain
// with its own barrel until R50 (ADR-0004, 2026-09 amendment) closed the standalone trajectory
// that justified it — the filters surface now folds into `withFiltering`'s own feature folder,
// so this file is once again the only one defining the public surface.
export * from './api/create-table';
export * from './api/types';
export * from './directives/table.tokens';
export * from './directives/ngp-table.directive';
export * from './directives/ngp-table-row.directive';
export * from './directives/ngp-table-header-cell.directive';
export * from './directives/ngp-table-cell.directive';
export * from './api/features/with-sorting';
export * from './api/features/with-filtering';
export type {
  Filters,
  FilterNode,
  FilterOptions,
  FiltersPath,
} from './api/features/with-filtering/types';
export {
  anyOf,
  contains,
  equals,
  filter,
  hasAny,
  hasNone,
  inDateRange,
  inRange,
} from './api/features/with-filtering/rules';
export {
  hasAnyOf,
  hasNoneOf,
  isContaining,
  isEqual,
  isInDateRange,
  isInRange,
} from './api/features/with-filtering/matchers';
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
export { applyGrouping, applyGroupingAsync, applyGroupOrder } from './schema/grouping-rules';
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
