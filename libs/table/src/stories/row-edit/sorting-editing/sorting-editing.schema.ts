import { applyEach, debounce, schema } from '@angular/forms/signals';
import { createColumns } from '../../../api/create-columns';
import type { TableConfig } from '../../../api/types';
import type { SortEditRow } from './sorting-editing.types';

// `createColumns()`'s data witness is never read (`void data`, create-columns.ts) — only its
// type binds `TRow` for the builder below.
const sortEditData = (): readonly SortEditRow[] | undefined => undefined;

const columns = createColumns(sortEditData, (col) => [col('name'), col('dueDate')]);

export const sortEditTableConfig: TableConfig<SortEditRow> = { trackBy: 'id', columns };

/** Text commits on blur for both columns — the shared commit boundary that keeps the row-hold
 * demo reproducible regardless of which column is edited. */
export const sortEditRowsSchema = schema<SortEditRow[]>((path) =>
  applyEach(path, (row) => {
    debounce(row.name, 'blur');
    // `dueDate` (`string | null`) binds via `NullableTextFieldDirective` — Signal Forms' native
    // `<input>` binding only supports `string` or `number | null`, not a nullable string
    // (angular/angular#65839).
    debounce(row.dueDate, 'blur');
  })
);
