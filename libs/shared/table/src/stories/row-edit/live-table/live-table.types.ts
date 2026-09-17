import type { EditRow } from '../fixtures/types';

/** Editable fields on `EditRow`, excluding `id`. */
export type EditableField = 'name' | 'dept';

/** One row's field change between two `data()` emissions — `watchFieldCommits`'s report shape. */
export interface FieldCommit {
  readonly row: EditRow;
  readonly previousRow: EditRow;
  readonly field: EditableField;
}
