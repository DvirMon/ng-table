import type { RowId } from '../../../api/types';
import type { SelectionRow } from './types';

export const SELECTION_ROWS_MOCK: SelectionRow[] = [
  { id: 's1', name: 'Ada Lovelace', dept: 'Engineering', locked: false },
  { id: 's2', name: 'Alan Turing', dept: 'Research', locked: false },
  { id: 's3', name: 'Katherine Johnson', dept: 'Operations', locked: true },
  { id: 's4', name: 'Grace Hopper', dept: 'Engineering', locked: false },
  { id: 's5', name: 'Barbara Liskov', dept: 'Research', locked: false },
  { id: 's6', name: 'Margaret Hamilton', dept: 'Engineering', locked: false },
  { id: 's7', name: 'Annie Easley', dept: 'Operations', locked: true },
  { id: 's8', name: 'Jean Bartik', dept: 'Research', locked: false },
  { id: 's9', name: 'Mary Jackson', dept: 'Operations', locked: false },
  { id: 's10', name: 'Dorothy Vaughan', dept: 'Engineering', locked: false },
];

export const SELECTION_DEPT_OPTIONS = ['Engineering', 'Research', 'Operations'] as const;

/** "Restore a saved selection" payload for `multi-selection/`. `s99` is deliberately absent from
 * `SELECTION_ROWS_MOCK` — the unloaded-id case. */
export const SAVED_SELECTION_IDS: RowId[] = ['s2', 's5', 's99'];

/** "Restore a 2-id saved selection" payload for `single-selection/` — two ids that both exist,
 * so a single-select table has to resolve the conflict rather than skip a missing row. */
export const SAVED_CONFLICTING_SELECTION_IDS: RowId[] = ['s1', 's4'];
