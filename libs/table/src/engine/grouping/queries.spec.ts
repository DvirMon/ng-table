import { createColumns } from '../../api/create-columns';
import type { ColumnBuilder } from '../../api/types';
import { noData } from '../../table.mock';
import { resolveColumnDefs } from '../columns';
import { orderColumns as columns, orders, type Order } from './grouping.mock';
import { collectAppliedLevels, collectGroupIds, rowsBeneathGroup } from './queries';

describe('rowsBeneathGroup', () => {
  // Type-enforced, not runtime-asserted: `rowsBeneathGroup` takes `TRow[]` (the pipeline's raw
  // rows) and never accepts `expandedRows` or `renderRows()` output — there is no collapse-
  // related parameter to even pass, which is the whole point of D17's rewrite.

  it("a depth-0 group id returns every leaf under all of its sub-clusters", () => {
    const result = rowsBeneathGroup(
      orders,
      ['region', 'category'],
      columns,
      'group:>region:string:US'
    );

    expect(result.map((row) => row.id).sort()).toEqual([1, 3, 4]);
  });

  it("a depth-1 (nested) group id returns only its own sub-cluster's leaves, never a sibling sub-cluster's", () => {
    const result = rowsBeneathGroup(
      orders,
      ['region', 'category'],
      columns,
      'group:>region:string:US>category:string:Electronics'
    );

    expect(result.map((row) => row.id).sort()).toEqual([1, 4]);
    expect(result.map((row) => row.id)).not.toContain(3);
  });

  it('an id matching no cluster returns [], no throw', () => {
    expect(() =>
      rowsBeneathGroup(orders, ['region', 'category'], columns, 'group:nope')
    ).not.toThrow();
    expect(rowsBeneathGroup(orders, ['region', 'category'], columns, 'group:nope')).toEqual([]);
  });

  it('a malformed/non-group id returns [], no throw', () => {
    expect(rowsBeneathGroup(orders, ['region', 'category'], columns, 1)).toEqual([]);
    expect(rowsBeneathGroup(orders, ['region', 'category'], columns, 'not-a-group-id')).toEqual(
      []
    );
  });
});

describe('collectGroupIds — stability across a row reorder', () => {
  // The fact `grouping-collapsible/`'s sort toggles rest on: a group id is built from the
  // cluster's own value (`buildGroupPath`), never from its position, so re-sorting the rows
  // underneath cannot make an id drift. That is what lets `expandedRows` survive a sort —
  // withTree never hears about the sort, it just keeps matching the same ids.
  const resorted: Order[] = [...orders].reverse();

  it('the same ids come back after the rows are reordered', () => {
    const before = collectGroupIds(orders, ['region', 'category'], columns);
    const after = collectGroupIds(resorted, ['region', 'category'], columns);

    expect(after.length).toBe(before.length);
    expect([...after].sort()).toEqual([...before].sort());
  });

  it('a collapsed id still resolves to its rows after the reorder', () => {
    const collapsed = 'group:>region:string:US';

    expect(
      rowsBeneathGroup(resorted, ['region', 'category'], columns, collapsed)
        .map((row) => row.id)
        .sort()
    ).toEqual([1, 3, 4]);
  });
});

describe('the three readers resolve levels through the accessor (Step 6, case 6)', () => {
  interface Sale {
    id: number;
    amount: number;
  }

  function tierColumn(col: ColumnBuilder<Sale>) {
    return col('tier', { accessor: (row) => (row.amount > 100 ? 'high' : 'low') });
  }

  const salesColumns = resolveColumnDefs(
    [...createColumns(noData<Sale>(), (col) => [tierColumn(col)]).columns],
    'queries.spec'
  );

  const sales: Sale[] = [
    { id: 1, amount: 50 },
    { id: 2, amount: 150 },
    { id: 3, amount: 80 },
    { id: 4, amount: 200 },
  ];

  it('rowsBeneathGroup resolves a derived-accessor level', () => {
    const result = rowsBeneathGroup(sales, ['tier'], salesColumns, 'group:>tier:string:high');

    expect(result.map((row) => row.id).sort()).toEqual([2, 4]);
  });

  it('collectGroupIds resolves a derived-accessor level', () => {
    const ids = collectGroupIds(sales, ['tier'], salesColumns);

    expect([...ids].sort()).toEqual(
      ['group:>tier:string:high', 'group:>tier:string:low'].sort()
    );
  });

  it('collectAppliedLevels resolves a derived-accessor level', () => {
    const applied = collectAppliedLevels(sales, ['tier'], salesColumns);

    expect(applied).toEqual(['tier']);
  });
});
