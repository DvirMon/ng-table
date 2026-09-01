import type { RowId } from '../../api/types';
import type { EditRow } from '../row-edit.types';

/** Fields the person can edit, excluding the identity column. */
export type EditableField = keyof Omit<EditRow, 'id'>;

/** One field that differs between the person's in-progress value and an external push. */
export interface FieldDiff {
  field: EditableField;
  mineValue: string;
  theirsValue: string;
}

/**
 * A live conflict on an open row (§1.5): `fields` lists what's still unresolved. `merging`
 * switches the banner from the three-way choice into the per-field toggle list. The conflict is
 * cleared the moment `fields` empties, at which point the restore point moves forward (D40).
 */
export interface RowConflict {
  id: RowId;
  fields: FieldDiff[];
  merging: boolean;
}

/** Brief notice shown when a row with an open editor was deleted externally. */
export interface DeletedRowNotice {
  id: RowId;
  name: string;
}
