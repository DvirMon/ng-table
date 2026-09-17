import { DEPT_OPTIONS } from '../fixtures/mock';
import type { EditRow } from '../fixtures/types';
import type { EditableField, FieldDiff } from './external-write.types';

const EDITABLE_FIELDS: readonly EditableField[] = ['name', 'dept'];

type Dept = (typeof DEPT_OPTIONS)[number];

function isDept(value: string): value is Dept {
  return DEPT_OPTIONS.some((option) => option === value);
}

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
  const at = isDept(current) ? DEPT_OPTIONS.indexOf(current) : -1;
  return DEPT_OPTIONS[(at + 1) % DEPT_OPTIONS.length];
}

/** Builds a row patch from resolved field diffs, taking each field's `theirsValue`. Replaces
 * inline `as Partial<EditRow>` casts at the two "take theirs" call sites (whole-conflict and
 * single-field). */
export function toPatch(fields: readonly FieldDiff[]): Partial<EditRow> {
  const patch: Partial<EditRow> = {};
  for (const fieldDiff of fields) {
    patch[fieldDiff.field] = fieldDiff.theirsValue;
  }
  return patch;
}
