import { applyEach, debounce, schema } from '@angular/forms/signals';
import type { ColumnDefInput, TableConfig } from '../../../api/types';
import type { EditRow } from './types';

const columns: ColumnDefInput<EditRow>[] = [{ id: 'name' }, { id: 'dept' }];

export const editTableConfig: TableConfig<EditRow> = { trackBy: 'id', columns };

// Shared commit-boundary schema (D24): text commits on blur, select commits immediately.
export const editRowsSchema = schema<EditRow[]>((path) =>
  applyEach(path, (row) => {
    debounce(row.name, 'blur');
    debounce(row.dept, 0);
  })
);
