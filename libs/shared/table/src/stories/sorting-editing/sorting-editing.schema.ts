import { applyEach, debounce, schema } from '@angular/forms/signals';
import { withRowEdit } from '../../api/features/with-row-edit';
import { withSorting } from '../../api/features/with-sorting';
import { createTableSchema } from '../../api/table-schema';
import type { ColumnDefInput } from '../../api/types';
import type { SortEditRow } from './sorting-editing.types';

const columns: ColumnDefInput<SortEditRow>[] = [{ id: 'name' }, { id: 'dueDate' }];

/**
 * Composes `withSorting()` + `withRowEdit()` — the cross-feature pipeline interaction
 * (`0-product/row-editing.md` §5, S-1/S-2) no other story exercises.
 *
 * `withRowEdit()` over `withOptimistic()`: this story is about the sort/edit collision at the
 * row's commit boundary, not save reliability, so a gated pessimistic Save (same shape as
 * `gated-edit/`) is the simplest host that still exposes the boundary S-1 cares about.
 *
 * No `columnsSchema`/`applySortNulls()` override on `dueDate` — the shipped default
 * (`order: 'last'`, `''` stays a real value — `docs/1-state/work/sorting-null-ordering/1-handoff.md`)
 * is exactly the behavior this story demonstrates.
 */
export const sortEditTableSchema = createTableSchema(columns, {
  features: [withSorting<SortEditRow>(), withRowEdit<SortEditRow>()],
});

// Text commits on blur (D24) for both columns — `name` via a native `<input>`, `dueDate`
// (`string | null`) via `NullableTextFieldComponent` (a `FormValueControl`, since Signal Forms'
// native `<input>` binding only supports `string` or `number | null`, not a nullable string —
// angular/angular#65839). Same commit boundary on both keeps the S-1 row-hold demo reproducible
// regardless of which column is being edited.
export const sortEditRowsSchema = schema<SortEditRow[]>((path) =>
  applyEach(path, (row) => {
    debounce(row.name, 'blur');
    debounce(row.dueDate, 'blur');
  })
);
