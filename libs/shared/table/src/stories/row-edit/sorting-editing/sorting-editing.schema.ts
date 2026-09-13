import { applyEach, debounce, schema } from '@angular/forms/signals';
import type {
  ColumnDefInput,
  TableConfig
} from '../../../api/types';
import type { SortEditRow } from './sorting-editing.types';

const columns: ColumnDefInput<SortEditRow>[] = [{ id: 'name' }, { id: 'dueDate' }];

export const sortEditTableConfig: TableConfig<SortEditRow> = { trackBy: 'id', columns };

// Text commits on blur (D24) for both columns — `name` binds `[formField]` natively, `dueDate`
// (`string | null`) via `NullableTextFieldDirective` (a directive-hosted `FormValueControl`,
// since Signal Forms' native `<input>` binding only supports `string` or `number | null`, not a
// nullable string — angular/angular#65839). Same commit boundary on both keeps the S-1 row-hold
// demo reproducible regardless of which column is being edited.
export const sortEditRowsSchema = schema<SortEditRow[]>((path) =>
  applyEach(path, (row) => {
    debounce(row.name, 'blur');
    debounce(row.dueDate, 'blur');
  })
);
