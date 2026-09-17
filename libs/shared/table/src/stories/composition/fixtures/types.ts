import type { RowId } from '../../../api/types';

/** Fixture row for the composition stories. No `locked` — this story proves derived-state
 * composition, not row selectability. */
export interface CompositionRow {
  id: RowId;
  name: string;
  dept: string;
}
