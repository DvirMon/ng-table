import type { RowId } from '../../../api/types';

/** Outcome of the multi-selection story's lock/restore/delete-externally demo actions. */
export type SelectionNotice =
  | { kind: 'locked'; id: RowId }
  | { kind: 'restored'; ids: readonly RowId[] }
  | { kind: 'deleted'; id: RowId }
  | { kind: 'need-unlocked' }
  | { kind: 'need-any' };
