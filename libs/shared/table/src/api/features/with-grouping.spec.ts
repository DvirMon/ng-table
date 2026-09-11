import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { mockGroupingRows, mockGroupingTrackBy, type GroupingMockRow } from '../../table.mock';
import { setGroupLevels } from '../../mutations/update-grouping';
import { createTable } from '../create-table';
import { withFiltering } from './with-filtering';
import { withGrouping } from './with-grouping';
import { withSorting } from './with-sorting';
import type {
  AnyTableFeature,
  ColumnDef,
  ComposedFeatureMembers,
  TableStore,
  TableStoreConfig,
} from '../types';

function makeColumns(): ColumnDef<GroupingMockRow>[] {
  return [
    { id: 'region', accessor: (row) => row.region, visible: true, order: 0, label: 'Region' },
    { id: 'category', accessor: (row) => row.category, visible: true, order: 1, label: 'Category' },
    {
      id: 'amount',
      accessor: (row) => row.amount,
      visible: true,
      order: 2,
      label: 'Amount',
      aggregateFn: (rows) => rows.reduce((sum, row) => sum + row.amount, 0) / rows.length,
    },
  ];
}

/** Same shape as `makeColumns()` plus a `filterFn` on `amount`, used only by the filter→group
 * interaction case — kept separate so the other cases' columns stay exactly what the step's
 * plan specifies. */
function makeFilterableColumns(): ColumnDef<GroupingMockRow>[] {
  const columns = makeColumns();
  return columns.map((column) =>
    column.id === 'amount'
      ? { ...column, filterFn: (value: unknown, filterValue: unknown) => value !== filterValue }
      : column
  );
}

// Mirrors `with-selection.spec.ts`: rows are seeded at construction via the `data` signal —
// pass `rows` for tests that need them, omit for state-only tests.
function makeStore<const F extends readonly AnyTableFeature[]>(
  cfg: () => TableStoreConfig<GroupingMockRow, F>,
  rows: GroupingMockRow[] = []
): TableStore<GroupingMockRow> & ComposedFeatureMembers<F> {
  return TestBed.runInInjectionContext(() => createTable(signal<GroupingMockRow[]>(rows), cfg));
}

describe('withGrouping', () => {
  it('grouping() starts empty; setGroupLevels updates it and re-clusters renderRows()', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [withGrouping<GroupingMockRow>()],
      }),
      mockGroupingRows
    );

    expect(store.grouping()).toEqual([]);
    expect(store.renderRows().every((row) => row.kind === 'row')).toBe(true);

    store.grouping.update(setGroupLevels(['region']));

    expect(store.grouping()).toEqual(['region']);
    expect(store.renderRows().filter((row) => row.kind === 'group')).toHaveLength(2); // US, EU
  });

  it('two-level grouping produces nested group headers at correct depths, leaves contiguous', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [withGrouping<GroupingMockRow>({ initialGrouping: ['region', 'category'] })],
      }),
      mockGroupingRows
    );

    const rows = store.renderRows();
    expect(rows).toHaveLength(12); // 2 region + 4 category headers + 6 leaves

    expect(rows.map((row) => [row.kind, row.depth])).toEqual([
      ['group', 0], // US
      ['group', 1], // US > Electronics
      ['row', 2], // id 1
      ['row', 2], // id 2
      ['group', 1], // US > Furniture
      ['row', 2], // id 3
      ['group', 0], // EU
      ['group', 1], // EU > Electronics
      ['row', 2], // id 4
      ['group', 1], // EU > Furniture
      ['row', 2], // id 5
      ['row', 2], // id 6
    ]);

    // Every leaf appears exactly once, in original order within its cluster — confirms
    // contiguity and correct cluster membership together.
    const leafIds = rows
      .filter((row) => row.kind === 'row')
      .map((row) => (row.data as GroupingMockRow).id);
    expect(leafIds).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('depth-correctness: a parent header aggregates its true leaves, not an average of its children\'s averages', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [withGrouping<GroupingMockRow>({ initialGrouping: ['region', 'category'] })],
      }),
      mockGroupingRows
    );

    // Depth-0 headers are emitted US-then-EU — US is the first region encountered while
    // walking `mockGroupingRows` in order (see the two-level-grouping case above).
    const [usHeader, euHeader] = store.renderRows().filter(
      (row) => row.kind === 'group' && row.depth === 0
    );

    // True leaf average across all 3 US rows: (100 + 300 + 50) / 3 = 150. A naive average of
    // the two category averages (200, 50) would give 125 — the bug this case catches.
    expect(usHeader.aggregates?.['amount']).toBe(150);
    expect(euHeader.aggregates?.['amount']).toBe(40); // (20 + 10 + 90) / 3
  });

  it('composed alone (no expansion feature), renders every cluster fully expanded', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [withGrouping<GroupingMockRow>({ initialGrouping: ['region', 'category'] })],
      }),
      mockGroupingRows
    );

    const rows = store.renderRows();
    expect(rows.filter((row) => row.kind === 'row')).toHaveLength(6); // every source row present
    expect(rows.filter((row) => row.kind === 'group')).toHaveLength(6); // 2 region + 4 category, none hidden
  });

  it('composes with withSorting(): sort reorders rows within each cluster, cluster boundaries stay intact', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [
          withGrouping<GroupingMockRow>({ initialGrouping: ['region'] }),
          withSorting<GroupingMockRow>(),
        ],
      }),
      mockGroupingRows
    );

    store.setSorting([{ columnId: 'amount', direction: 'desc' }]);

    const rows = store.renderRows();

    // 1 US header + 3 US leaves, then 1 EU header + 3 EU leaves — sorting the grouped column's
    // leaves must never merge, split, or reorder the clusters themselves.
    expect(rows.map((row) => row.kind)).toEqual([
      'group', 'row', 'row', 'row',
      'group', 'row', 'row', 'row',
    ]);

    const usLeafIds = rows.slice(1, 4).map((row) => (row.data as GroupingMockRow).id);
    const euLeafIds = rows.slice(5, 8).map((row) => (row.data as GroupingMockRow).id);

    // US leaves (id 1: 100, id 2: 300, id 3: 50) sorted desc by amount within the cluster.
    expect(usLeafIds).toEqual([2, 1, 3]);
    // EU leaves (id 4: 20, id 5: 10, id 6: 90) sorted desc by amount within the cluster.
    expect(euLeafIds).toEqual([6, 4, 5]);
  });

  it('filter -> group pipeline order: group aggregates reflect only post-filter rows', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeFilterableColumns(),
        features: [
          withFiltering<GroupingMockRow>(),
          withGrouping<GroupingMockRow>({ initialGrouping: ['region', 'category'] }),
        ],
      }),
      mockGroupingRows
    );

    store.setColumnFilter('amount', 300); // drops id 2 (US > Electronics, amount 300)

    const usHeader = store
      .renderRows()
      .find((row) => row.kind === 'group' && row.depth === 0);

    // Without the filter, the US average is 150 (see the depth-correctness case). With id 2
    // excluded, the remaining US rows (100, 50) average to 75 — proving `aggregateFn` only
    // ever sees post-filter rows, per the fixed filter -> group -> sort -> expand order.
    expect(usHeader?.aggregates?.['amount']).toBe(75);
  });

  it('initialGrouping naming an unknown column throws synchronously when composed', () => {
    expect(() =>
      TestBed.runInInjectionContext(() =>
        createTable(signal<GroupingMockRow[]>(mockGroupingRows), () => ({
          trackBy: mockGroupingTrackBy,
          columns: makeColumns(),
          features: [withGrouping<GroupingMockRow>({ initialGrouping: ['not-a-column'] })],
        }))
      )
    ).toThrow();
  });

  it('an unknown level passed to setGroupLevels does not throw — it is dropped, not the whole grouping', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [withGrouping<GroupingMockRow>()],
      }),
      mockGroupingRows
    );

    expect(() =>
      store.grouping.update(setGroupLevels(['region', 'not-a-column']))
    ).not.toThrow();

    // The raw level list is stored as given — resolution against known columns happens at
    // pipeline/render read time, not at write time.
    expect(store.grouping()).toEqual(['region', 'not-a-column']);

    const rows = store.renderRows();
    expect(rows.filter((row) => row.kind === 'group')).toHaveLength(2); // region only
    expect(rows.every((row) => row.kind !== 'group' || row.depth === 0)).toBe(true); // no second level
  });

  it("removing a cluster's sole members removes that cluster from renderRows() with no residual", () => {
    const data = signal<GroupingMockRow[]>([...mockGroupingRows]);
    const store = TestBed.runInInjectionContext(() =>
      createTable(data, () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [withGrouping<GroupingMockRow>({ initialGrouping: ['region', 'category'] })],
      }))
    );

    expect(store.renderRows()).toHaveLength(12);

    data.update((rows) => rows.filter((row) => row.id !== 4)); // sole member of EU > Electronics
    TestBed.tick();

    const rows = store.renderRows();
    expect(rows).toHaveLength(10); // the EU > Electronics header and its one leaf are both gone
    expect(rows.filter((row) => row.kind === 'group')).toHaveLength(5); // 2 region + 3 remaining category
    // aggregates.amount === 20 was unique to the removed EU > Electronics header.
    expect(rows.some((row) => row.aggregates?.['amount'] === 20)).toBe(false);
  });
});
