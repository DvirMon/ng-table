import type { CompositionRow } from './types';

export const COMPOSITION_ROWS_MOCK: CompositionRow[] = [
  { id: 'c1', name: 'Ada Lovelace', dept: 'Engineering' },
  { id: 'c2', name: 'Alan Turing', dept: 'Research' },
  { id: 'c3', name: 'Katherine Johnson', dept: 'Operations' },
  { id: 'c4', name: 'Grace Hopper', dept: 'Engineering' },
  { id: 'c5', name: 'Barbara Liskov', dept: 'Research' },
  { id: 'c6', name: 'Margaret Hamilton', dept: 'Engineering' },
  { id: 'c7', name: 'Annie Easley', dept: 'Operations' },
  { id: 'c8', name: 'Jean Bartik', dept: 'Research' },
  { id: 'c9', name: 'Mary Jackson', dept: 'Operations' },
  { id: 'c10', name: 'Dorothy Vaughan', dept: 'Engineering' },
];

export const COMPOSITION_DEPT_OPTIONS = ['Engineering', 'Research', 'Operations'] as const;
