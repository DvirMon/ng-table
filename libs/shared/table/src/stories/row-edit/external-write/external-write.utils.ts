import { DEPT_OPTIONS } from '../fixtures/mock';
import type { EditRow } from '../fixtures/types';
import type { EditableField, FieldDiff } from './external-write.types';

const EDITABLE_FIELDS: readonly EditableField[] = ['name', 'dept'];

/** Compares two versions of the same row and returns only the fields that differ. */
export function diffEditableFields(mine: EditRow, theirs: EditRow): FieldDiff[] {
  return EDITABLE_FIELDS.filter((field) => mine[field] !== theirs[field]).map((field) => ({
    field,
    mineValue: mine[field],
    theirsValue: theirs[field],
  }));
}

/** Cycles `dept` to the next option, wrapping — the mock's stand-in for "the server changed
 * this row." */
export function nextDept(current: string): string {
  const at = DEPT_OPTIONS.indexOf(current as (typeof DEPT_OPTIONS)[number]);
  return DEPT_OPTIONS[(at + 1) % DEPT_OPTIONS.length];
}
