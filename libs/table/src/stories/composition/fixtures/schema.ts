import type { ColumnDefInput, TableConfig } from '../../../api/types';
import type { CompositionRow } from './types';

export const compositionColumns: ColumnDefInput<CompositionRow>[] = [
  { id: 'name' },
  { id: 'dept' },
];

export const derivedStateConfig: TableConfig<CompositionRow> = {
  trackBy: 'id',
  columns: compositionColumns,
};
