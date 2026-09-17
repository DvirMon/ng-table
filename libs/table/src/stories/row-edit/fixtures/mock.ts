import type { EditRow } from './types';

export const EDIT_ROWS_MOCK: EditRow[] = [
  { id: 'r1', name: 'Ada Lovelace', dept: 'Engineering' },
  { id: 'r2', name: 'Alan Turing', dept: 'Research' },
  { id: 'r3', name: 'Katherine Johnson', dept: 'Operations' },
];

export const DEPT_OPTIONS = ['Engineering', 'Research', 'Operations'] as const;
