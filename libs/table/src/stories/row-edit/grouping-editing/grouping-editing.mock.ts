import type { GroupEditRow } from './grouping-editing.types';

export const CATEGORY_OPTIONS = ['Hardware', 'Services', 'Licences'] as const;

/** Most rows already carry a category; a few start blank — the "hasn't been grouped yet" case
 * the live dropdown edit resolves. Names are deliberately out of alphabetical order, so sorting
 * by name visibly reorders rows inside each group.
 * Trimmed to 7 active rows, one per category (Hardware/Licences/Services) plus 4 with no
 * category yet — the rest are commented out below, not deleted. Grace Hopper is already the
 * sole Services row, so a single-row group's exit/enter can be tested with no setup step. */
export const GROUP_EDIT_ROWS_MOCK: GroupEditRow[] = [
  { id: 'r1', name: 'Ada Lovelace', category: 'Hardware' },
  // { id: 'r2', name: 'Alan Turing', category: 'Hardware' },
  { id: 'r3', name: 'Grace Hopper', category: 'Services' },
  { id: 'r4', name: 'Katherine Johnson', category: null },
  { id: 'r5', name: 'Margaret Hamilton', category: null },
  // { id: 'r6', name: 'Tim Berners-Lee', category: 'Services' },
  { id: 'r7', name: 'Barbara Liskov', category: 'Licences' },
  // { id: 'r8', name: 'Dennis Ritchie', category: 'Hardware' },
  // { id: 'r9', name: 'Frances Allen', category: 'Licences' },
  // { id: 'r10', name: 'Edsger Dijkstra', category: 'Services' },
  { id: 'r11', name: 'Radia Perlman', category: null },
  // { id: 'r12', name: 'Ken Thompson', category: 'Hardware' },
  // { id: 'r13', name: 'Donald Knuth', category: 'Licences' },
  // { id: 'r14', name: 'Hedy Lamarr', category: 'Hardware' },
  // { id: 'r15', name: 'Linus Torvalds', category: 'Services' },
  { id: 'r16', name: 'Adele Goldberg', category: null },
  // { id: 'r17', name: 'John von Neumann', category: 'Hardware' },
  // { id: 'r18', name: 'Shafi Goldwasser', category: 'Licences' },
  // { id: 'r19', name: 'Claude Shannon', category: 'Services' },
  // { id: 'r20', name: 'Karen Spärck Jones', category: 'Licences' },
];
