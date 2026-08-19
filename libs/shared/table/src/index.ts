// Public API of the table. This file is the only definition of the consumer surface —
// `api/`, `engine/` and `directives/` have no barrels of their own, so anything not listed
// here is internal (mirrors Angular Signal Forms' `public_api.ts`).
export * from './api/create-table';
export * from './api/types';
export * from './api/table-schema';
export * from './directives/tokens';
export * from './directives/ngp-table.directive';
export * from './directives/ngp-table-row.directive';
export * from './directives/ngp-table-header-cell.directive';
export * from './directives/ngp-table-cell.directive';
export * from './api/features/with-sorting';
export { withExpansion } from './api/features/with-expansion';
export type { WithExpansionConfig } from './api/features/with-expansion';
export { withRowEdit, ABSENT } from './api/features/with-row-edit';
export type {
  WithRowEditConfig,
  RowEditMembers,
  EditingMap,
  RowSnapshot,
} from './api/features/with-row-edit';
export { createTableFeature } from './api/create-table-feature';
export { columnSchema } from './api/column-schema';
export { applyVisible, applyVisibleAsync } from './api/column-rules';
export { createColumnMetaKey, metadata, readColumnMeta } from './api/column-metadata';
export { updateRows, addRow, removeRow, patchRow } from './api/row-mutations';
export {
  updateEditing,
  beginEdit,
  endEdit,
  clearEditing,
  revertEdit,
  setSnapshot,
} from './api/row-edit-mutations';
export {
  updateColumns,
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
