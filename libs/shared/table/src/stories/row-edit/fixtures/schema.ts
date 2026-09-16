import { applyEach, apply, debounce, schema, validate } from '@angular/forms/signals';
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

/**
 * `editRowsSchema` plus a real `name` uniqueness rule — for the hosts that let a person copy a
 * row (`duplicateRow()`) and so can produce a collision. A warning only, never blocking Save:
 * this mirrors the copy-me hosts' prior behavior, which flagged but never enforced.
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
