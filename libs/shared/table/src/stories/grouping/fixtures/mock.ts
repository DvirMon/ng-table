import type { DealOwner, DealRow } from './types';

export const REGION_OPTIONS = ['North East', 'Midwest', 'South'] as const;

export const CATEGORY_OPTIONS = ['Hardware', 'Services', 'Licences'] as const;

const ADA: DealOwner = { name: 'Ada Lovelace', email: 'ada@example.com' };
const GRACE: DealOwner = { name: 'Grace Hopper', email: 'grace@example.com' };
const ALAN: DealOwner = { name: 'Alan Turing', email: 'alan@example.com' };

/**
 * Covers, in one dataset: three levels of nesting (`region` → `category` → `rep`), a
 * multi-row and a single-row group, an aggregated numeric column, a `Date` and an object
 * column to group by, a row carrying `children`, and the three blank group keys — `null`,
 * `undefined` and `''`, which currently render as separate unlabelled groups.
 */
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
  },
  {
    id: 'd2',
    region: 'North East',
    category: 'Hardware',
    rep: 'Ada',
    amount: 6200,
    closedAt: new Date('2026-05-21'),
    owner: ADA,
  },
  {
    id: 'd3',
    region: 'North East',
    category: 'Hardware',
    rep: 'Grace',
    amount: 9750,
    closedAt: new Date('2026-06-02'),
    owner: GRACE,
  },
  // North East / Services — one row with children: 'group' and 'tree' both run on the same row.
  {
    id: 'd4',
    region: 'North East',
    category: 'Services',
    rep: 'Grace',
    amount: 42000,
    closedAt: new Date('2026-06-15'),
    owner: GRACE,
    children: [
      {
        id: 'd4-a',
        region: 'North East',
        category: 'Services',
        rep: 'Grace',
        amount: 25000,
        closedAt: new Date('2026-06-15'),
        owner: GRACE,
      },
      {
        id: 'd4-b',
        region: 'North East',
        category: 'Services',
        rep: 'Grace',
        amount: 17000,
        closedAt: new Date('2026-07-01'),
        owner: GRACE,
      },
    ],
  },
  {
    id: 'd5',
    region: 'North East',
    category: 'Services',
    rep: 'Alan',
    amount: 3100,
    closedAt: new Date('2026-07-08'),
    owner: ALAN,
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
  },
  {
    id: 'd7',
    region: 'Midwest',
    category: 'Licences',
    rep: 'Ada',
    amount: 12300,
    closedAt: new Date('2026-08-03'),
    owner: ADA,
  },
  {
    id: 'd8',
    region: 'Midwest',
    category: 'Hardware',
    rep: 'Alan',
    amount: 5400,
    closedAt: new Date('2026-08-14'),
    owner: ALAN,
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
  },
  {
    id: 'd11',
    category: 'Hardware',
    rep: 'Alan',
    amount: 1450,
    closedAt: new Date('2026-09-04'),
    owner: ALAN,
  },
  {
    id: 'd12',
    region: '',
    category: 'Licences',
    rep: 'Grace',
    amount: 640,
    closedAt: new Date('2026-09-09'),
    owner: GRACE,
  },
];
