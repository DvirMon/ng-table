import type { RowId } from '../../api/types';

/** Editable fields on `EditRow`, excluding `id`. */
export type EditableField = 'name' | 'dept';

/** Snapshot of the last committed field value, restorable via Ctrl+Z/Cmd+Z (§1.3) — the only
 * recovery path in live mode, which has no Cancel session to fall back on. */
export interface FieldCommit {
  readonly id: RowId;
  readonly field: EditableField;
  readonly previousValue: string;
}
