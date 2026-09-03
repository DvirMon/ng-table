import type { RowId } from '../../api/types';
import type { EditRow } from '../row-edit.types';

/** Editable fields on `EditRow`, excluding `id`. */
export type EditableField = 'name' | 'dept';

/** Snapshot of the last committed field value, restorable via Ctrl+Z/Cmd+Z (§1.3) — the only
 * recovery path in live mode, which has no Cancel session to fall back on. */
export interface FieldCommit {
  readonly kind: 'commit';
  readonly id: RowId;
  readonly field: EditableField;
  readonly previousValue: string;
}

/** Snapshot of a discarded row plus the index it sat at, restorable via Undo/Ctrl+Z (§3.2) —
 * live mode holds it host-side because no editing feature (and so no restore point) is composed
 * here (D29). */
export interface RowDiscard {
  readonly kind: 'discard';
  readonly row: EditRow;
  readonly at: number;
}

/** The single undo slot the live table keeps — last field commit *or* last discarded row,
 * whichever happened most recently. */
export type UndoableAction = FieldCommit | RowDiscard;
