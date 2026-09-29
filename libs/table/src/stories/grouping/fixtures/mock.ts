import type { DealOwner, DealRow } from './types';

export const REGION_OPTIONS = ['North East', 'Midwest', 'South'] as const;

export const CATEGORY_OPTIONS = ['Hardware', 'Services', 'Licences'] as const;

const ADA: DealOwner = { name: 'Ada Lovelace', email: 'ada@example.com' };
const GRACE: DealOwner = { name: 'Grace Hopper', email: 'grace@example.com' };
const ALAN: DealOwner = { name: 'Alan Turing', email: 'alan@example.com' };

/** Grouping-story fixture covering three nesting levels, `parentId`-linked rows, and the three
 *  blank group keys (`null`/`undefined`/`''`), which render as separate unlabelled groups. */
export const GROUPING_ROWS_MOCK: DealRow[] = [
  // North East / Hardware — two reps, one of them with two deals.
  {
    id: 'd1',
    region: 'North East',
    category: 'Hardware',
    rep: 'Ada',
    amount: 18400,
    closedAt: new Date('2026-05-04'),
    owner: ADA,
    parentId: null,
  },
  {
    id: 'd2',
    region: 'North East',
    category: 'Hardware',
    rep: 'Ada',
    amount: 6200,
    closedAt: new Date('2026-05-21'),
    owner: ADA,
    parentId: null,
  },
  {
    id: 'd3',
    region: 'North East',
    category: 'Hardware',
    rep: 'Grace',
    amount: 9750,
    closedAt: new Date('2026-06-02'),
    owner: GRACE,
    parentId: null,
  },
  // North East / Services — d4 has two line items linked via parentId: 'group' and 'tree'
  // both run on the same row. Group total: 8000 + 25000 + 17000 = 50000.
  {
    id: 'd4',
    region: 'North East',
    category: 'Services',
    rep: 'Grace',
    amount: 8000,
    closedAt: new Date('2026-06-15'),
    owner: GRACE,
    parentId: null,
  },
  {
    id: 'd4-a',
    region: 'North East',
    category: 'Services',
    rep: 'Grace',
    amount: 25000,
    closedAt: new Date('2026-06-15'),
    owner: GRACE,
    parentId: 'd4',
  },
  {
    id: 'd4-b',
    region: 'North East',
    category: 'Services',
    rep: 'Grace',
    amount: 17000,
    closedAt: new Date('2026-07-01'),
    owner: GRACE,
    parentId: 'd4',
  },
  {
    id: 'd5',
    region: 'North East',
    category: 'Services',
    rep: 'Alan',
    amount: 3100,
    closedAt: new Date('2026-07-08'),
    owner: ALAN,
    parentId: null,
  },
  // Midwest / Licences, Midwest / Hardware.
  {
    id: 'd6',
    region: 'Midwest',
    category: 'Licences',
    rep: 'Alan',
    amount: 76500,
    closedAt: new Date('2026-07-19'),
    owner: ALAN,
    parentId: null,
  },
  {
    id: 'd7',
    region: 'Midwest',
    category: 'Licences',
    rep: 'Ada',
    amount: 12300,
    closedAt: new Date('2026-08-03'),
    owner: ADA,
    parentId: null,
  },
  {
    id: 'd8',
    region: 'Midwest',
    category: 'Hardware',
    rep: 'Alan',
    amount: 5400,
    closedAt: new Date('2026-08-14'),
    owner: ALAN,
    parentId: null,
  },
  // South — a single-row group at every level.
  {
    id: 'd9',
    region: 'South',
    category: 'Services',
    rep: 'Grace',
    amount: 2250,
    closedAt: new Date('2026-08-27'),
    owner: GRACE,
    parentId: null,
  },
  // Three blank group keys, three distinct groups today.
  {
    id: 'd10',
    region: null,
    category: 'Hardware',
    rep: 'Ada',
    amount: 8800,
    closedAt: new Date('2026-09-01'),
    owner: ADA,
    parentId: null,
  },
  {
    id: 'd11',
    category: 'Hardware',
    rep: 'Alan',
    amount: 1450,
    closedAt: new Date('2026-09-04'),
    owner: ALAN,
    parentId: null,
  },
  {
    id: 'd12',
    region: '',
    category: 'Licences',
    rep: 'Grace',
    amount: 640,
    closedAt: new Date('2026-09-09'),
    owner: GRACE,
    parentId: null,
  },
];
