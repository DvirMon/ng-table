import { applyEach, apply, debounce, schema, validate } from '@angular/forms/signals';
import { createColumns } from '../../../api/create-columns';
import type { TableConfig } from '../../../api/types';
import type { EditRow } from './types';

// `createColumns()`'s data witness is never read (`void data`, create-columns.ts) — only its
// type binds `TRow` for the builder below.
const editData = (): readonly EditRow[] | undefined => undefined;

const columns = createColumns(editData, (col) => [col('name'), col('dept')]);

export const editTableConfig: TableConfig<EditRow> = { trackBy: 'id', columns };

/** Text commits on blur, select commits immediately — the shared commit-boundary schema
 * (`docs/decisions/row-editing.md`, RE14). */
export const editRowsSchema = schema<EditRow[]>((path) =>
  applyEach(path, (row) => {
    debounce(row.name, 'blur');
    debounce(row.dept, 0);
  })
);

/**
 * `editRowsSchema` plus a `name` uniqueness rule, for hosts whose `duplicateRow()` can produce
 * a collision. Warns only, never blocks Save — mirrors prior copy-row behavior.
 */
export const editRowsWithUniqueNameSchema = schema<EditRow[]>((path) => {
  apply(path, editRowsSchema);
  applyEach(path, (row) => {
    validate(row.name, (ctx) => {
      const name = ctx.value();
      if (name === '') {
        return undefined;
      }
      const isDuplicate = ctx.valueOf(path).filter((candidate) => candidate.name === name).length > 1;
      return isDuplicate
        ? { kind: 'duplicateName', message: 'Another row already uses this name.' }
        : undefined;
    });
  });
});
