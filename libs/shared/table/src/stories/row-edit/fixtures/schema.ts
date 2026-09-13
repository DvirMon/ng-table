import { applyEach, debounce, schema } from '@angular/forms/signals';
import { createTableSchema } from '../../../api/table-schema';
import { withOptimistic } from '../../../api/features/with-optimistic';
import { withRowEdit, type WithRowEditConfig } from '../../../api/features/with-row-edit';
import { withSorting } from '../../../api/features/with-sorting';
import type { ColumnDefInput } from '../../../api/types';
import type { EditRow } from './types';

const columns: ColumnDefInput<EditRow>[] = [{ id: 'name' }, { id: 'dept' }];

// S1 — no *session* feature (D29 stands: `withRowEdit()` still buys nothing here, since live
// mode has no open/close to manage). `withOptimistic()` is composed for its rollback verbs only
// — a real create/edit/delete round trip now needs somewhere to hold a restore point and,
// on create, somewhere for `swapRowId` to re-key.
export const liveTableSchema = createTableSchema(columns, {
  features: [withSorting(), withOptimistic()],
});

// S6 — always editable *and* rollback-capable (D39). No `withRowEdit()`: the edit session is
// delimited by focus, so nothing ever opens. `withOptimistic()` alone supplies the restore
// points, and `pending()` is exactly the set of in-flight saves.
export const liveOptimisticSchema = createTableSchema(columns, {
  features: [withOptimistic()],
});

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
