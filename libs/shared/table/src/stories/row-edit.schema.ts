import { applyEach, debounce, schema } from '@angular/forms/signals';
import { createTableSchema } from '../api/table-schema';
import { withRowEdit, type WithRowEditConfig } from '../api/features/with-row-edit';
import type { ColumnDefInput } from '../api/types';
import type { EditRow } from './row-edit.types';

const columns: ColumnDefInput<EditRow>[] = [{ id: 'name' }, { id: 'dept' }];

// S1 — no editing feature composed at all (D29): the live table needs nothing.
export const liveTableSchema = createTableSchema(columns);

// S2/S4/S5 — the gated table. `config.multiple` may be a signal/accessor (`withRowEdit()`
// wraps it in `computed()` and reacts live), so the Storybook `multiple` arg can drive it
// without rebuilding the schema.
export const gatedTableSchema = (config: WithRowEditConfig = {}) =>
  createTableSchema(columns, { features: [withRowEdit<EditRow>(config)] });

// Shared commit-boundary schema (D24): text commits on blur, select commits immediately.
export const editRowsSchema = schema<EditRow[]>((path) =>
  applyEach(path, (row) => {
    debounce(row.name, 'blur');
    debounce(row.dept, 0);
  })
);
