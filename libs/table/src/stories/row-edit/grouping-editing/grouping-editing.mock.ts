import type { GroupEditRow } from './grouping-editing.types';

export const CATEGORY_OPTIONS = ['Hardware', 'Services', 'Licences'] as const;

/** Three rows already carry a category; two start blank — the "hasn't been grouped yet" case
 * the live dropdown edit resolves. */
export const GROUP_EDIT_ROWS_MOCK: GroupEditRow[] = [
  { id: 'r1', name: 'Ada Lovelace', category: 'Hardware' },
  { id: 'r2', name: 'Alan Turing', category: 'Hardware' },
  { id: 'r3', name: 'Grace Hopper', category: 'Services' },
  { id: 'r4', name: 'Katherine Johnson', category: null },
  { id: 'r5', name: 'Margaret Hamilton', category: null },
];
