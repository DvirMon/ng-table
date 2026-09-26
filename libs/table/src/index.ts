// Note: the only barrel. `api/`, `schema/`, `mutations/`, `engine/` and `directives/` have
// none, so anything not exported here is internal. From `engine/`, only the feature-author
// surface at the bottom of this file is public.
// libs/table/docs/adr/0004-table-source-layout.md
export * from './api/create-table';
export * from './api/create-columns';
export * from './api/types';
export * from './directives/table.tokens';
export * from './directives/ngp-table.directive';
export * from './directives/ngp-table-row.directive';
export * from './directives/ngp-table-row-animation.directive';
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
export type { WithExpansionConfig, ExpansionMembers } from './api/features/with-expansion';
export { withTree } from './api/features/with-tree';
export type { WithTreeConfig, TreeMembers } from './api/features/with-tree';
export type { ExpansionChange, ExpansionWriteOptions } from './api/features/expansion/state';
export { withRowEdit } from './api/features/with-row-edit';
export type { WithRowEditConfig, RowEditMembers } from './api/features/with-row-edit';
export { withOptimistic } from './api/features/with-optimistic';
export type { OptimisticMembers } from './api/features/with-optimistic';
export { withGrouping } from './api/features/with-grouping';
export type { WithGroupingConfig, GroupingMembers } from './api/features/with-grouping';
export { withSelection } from './api/features/with-selection';
export type {
  WithSelectionConfig,
  SelectionChange,
  SelectionWriteOptions,
  SelectionMembers,
} from './api/features/with-selection';
export { selectAllIds } from './api/features/with-selection/utils';
export type {
  EditingState,
  EditingUpdater,
  EditingUpdaterContext,
  PendingOp,
  RowRestorePoint,
  RowSnapshot,
  SnapshotMap,
} from './api/features/editing/state';
export { createTableFeature } from './api/create-table-feature';
export { withComputed } from './api/features/with-computed';
export { composeFeatures } from './api/features/compose-features';
export { columnSchema } from './columns-schema/schema';
export { visible, visibleAsync } from './columns-schema/rules';
export { createColumnMetaKey, metadata, readColumnMeta } from './columns-schema/metadata';
export { sortNulls, sortFn, sortable, sortingSchema } from './api/features/with-sorting/schema';
export type {
  SortingHandle,
  SortingPath,
  SortingSchemaFn,
  SortNullsOpts,
  SortableOpts,
} from './api/features/with-sorting/types';
export {
  aggregate,
  grouping,
  groupingAsync,
  groupKey,
  groupOrder,
} from './api/features/with-grouping/schema';
export type { GroupingAsyncOpts } from './api/features/with-grouping/schema';
export type {
  AnyGroupingRule,
  GroupAggregateRule,
  GroupingAsyncRule,
  GroupingLevel,
  GroupingRule,
  GroupingSchemaFn,
} from './api/features/with-grouping/types';
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
} from './columns-schema/types';
export type { TableFeatureSpec, Feature, Shape, RowOf } from './engine/types';
export type { WritableView } from './engine/writable-view';
export { createWritableView } from './engine/writable-view';
export { pruneByIds, resolveIndex } from './engine/rows';
export type { RenderNode } from './engine/render-stages';
export { mapNodes } from './engine/render-stages';
export type { ColumnRuleEntry, ColumnRuleRegistry } from './engine/columns';
