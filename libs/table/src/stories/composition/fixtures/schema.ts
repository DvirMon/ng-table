import { createColumns } from '../../../api/create-columns';
import type { TableConfig } from '../../../api/types';
import type { CompositionRow } from './types';

// `createColumns()`'s data witness is never read (`void data`, create-columns.ts) — only its
// type binds `TRow` for the builder below.
const compositionData = (): readonly CompositionRow[] | undefined => undefined;

export const compositionColumns = createColumns(compositionData, (col) => [
  col('name'),
  col('dept'),
]);

export const derivedStateConfig: TableConfig<CompositionRow> = {
  trackBy: 'id',
  columns: compositionColumns,
};
