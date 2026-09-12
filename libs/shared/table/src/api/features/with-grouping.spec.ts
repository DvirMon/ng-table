import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { mockGroupingRows, mockGroupingTrackBy, type GroupingMockRow } from '../../table.mock';
import { setGroupLevels } from '../../mutations/update-grouping';
import { createFilters } from '../create-filters';
import { createTable } from '../create-table';
import { filter } from '../filters/rules';
import { withExpansion } from './with-expansion';
import { withFiltering } from './with-filtering';
import { withGrouping } from './with-grouping';
import { withSelection } from './with-selection';
import { withSorting } from './with-sorting';
import type {
  AnyTableFeature,
  ColumnDef,
  ComposedFeatureMembers,
  RenderRow,
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

/** `[kind, depth, id-if-a-row]` per render row — the shape shared by the `groupOrder` ordering
 * assertions below. */
function toShape(
  rows: readonly { kind: string; depth: number; data: GroupingMockRow | null }[]
): [string, number, number | undefined][] {
  return rows.map((row) => [row.kind, row.depth, row.data?.id]);
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
    const filters = TestBed.runInInjectionContext(() =>
      createFilters<GroupingMockRow>((path) => {
        filter<GroupingMockRow, 'amount', number | null>(
          path.amount,
          (cell, criterion) => cell !== criterion,
          { isEmpty: (v) => v == null, emptyValue: null }
        );
      })
    );

    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [
          withFiltering<GroupingMockRow>({ filters }),
          withGrouping<GroupingMockRow>({ initialGrouping: ['region', 'category'] }),
        ],
      }),
      mockGroupingRows
    );

    filters['amount']().value.set(300); // drops id 2 (US > Electronics, amount 300)

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

  it('groupOrder omitted preserves first-occurrence cluster order (regression, unchanged from issue #6)', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [withGrouping<GroupingMockRow>({ initialGrouping: ['region'] })],
      }),
      mockGroupingRows
    );

    const groupIds = store
      .renderRows()
      .filter((row) => row.kind === 'group')
      .map((row) => row.id);

    expect(groupIds).toEqual(['group:>region:string:US', 'group:>region:string:EU']);
  });

  it('groupOrder reorders group headers by their contents without disturbing row order within a cluster', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [
          withGrouping<GroupingMockRow>({
            initialGrouping: ['region', 'category'],
            groupOrder: (a, b) => b.rows.length - a.rows.length,
          }),
        ],
      }),
      mockGroupingRows
    );

    const rows = store.renderRows();

    // Region siblings (US, EU) are tied at 3 rows each — unaffected, first-occurrence order.
    // Within EU, Furniture (2 rows: id 5, 6) now sorts ahead of Electronics (1 row: id 4) —
    // reordered from insertion order. Within US the count-descending order already matched
    // insertion order, so it's unchanged. Row order within every cluster stays input order.
    expect(toShape(rows)).toEqual([
      ['group', 0, undefined], // US
      ['group', 1, undefined], // US > Electronics
      ['row', 2, 1],
      ['row', 2, 2],
      ['group', 1, undefined], // US > Furniture
      ['row', 2, 3],
      ['group', 0, undefined], // EU
      ['group', 1, undefined], // EU > Furniture (reordered ahead of Electronics)
      ['row', 2, 5],
      ['row', 2, 6],
      ['group', 1, undefined], // EU > Electronics
      ['row', 2, 4],
    ]);
  });

  it('a groupOrder that reorders one depth never reorders sub-clusters at a different depth, or mixes them across parents', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [
          withGrouping<GroupingMockRow>({
            initialGrouping: ['region', 'category'],
            // Ascending alphabetical by key — reorders the region level (EU < US) but is a
            // no-op on category order within either region (Electronics < Furniture already).
            groupOrder: (a, b) => String(a.key).localeCompare(String(b.key)),
          }),
        ],
      }),
      mockGroupingRows
    );

    const rows = store.renderRows();

    expect(toShape(rows)).toEqual([
      ['group', 0, undefined], // EU (reordered ahead of US)
      ['group', 1, undefined], // EU > Electronics
      ['row', 2, 4],
      ['group', 1, undefined], // EU > Furniture
      ['row', 2, 5],
      ['row', 2, 6],
      ['group', 0, undefined], // US
      ['group', 1, undefined], // US > Electronics
      ['row', 2, 1],
      ['row', 2, 2],
      ['group', 1, undefined], // US > Furniture
      ['row', 2, 3],
    ]);
  });

  it('sorting the grouped column is a no-op on cluster order when groupOrder is not supplied (D5)', () => {
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

    const unsortedClusterOrder = store
      .renderRows()
      .filter((row) => row.kind === 'group')
      .map((row) => row.id);

    store.setSorting([{ columnId: 'region', direction: 'desc' }]);

    const sortedClusterOrder = store
      .renderRows()
      .filter((row) => row.kind === 'group')
      .map((row) => row.id);

    expect(sortedClusterOrder).toEqual(unsortedClusterOrder);
  });

  it('a throwing groupOrder falls back to stable order instead of throwing through renderRows()', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const store = makeStore(
        () => ({
          trackBy: mockGroupingTrackBy,
          columns: makeColumns(),
          features: [
            withGrouping<GroupingMockRow>({
              initialGrouping: ['region'],
              groupOrder: () => {
                throw new Error('boom');
              },
            }),
          ],
        }),
        mockGroupingRows
      );

      expect(() => store.renderRows()).not.toThrow();

      const groupIds = store
        .renderRows()
        .filter((row) => row.kind === 'group')
        .map((row) => row.id);
      expect(groupIds).toEqual(['group:>region:string:US', 'group:>region:string:EU']);
      expect(reportSpy).toHaveBeenCalled();
    } finally {
      reportSpy.mockRestore();
    }
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

/** Finds a `kind: 'group'` render row by id — the recipe every `rowsOf` test below shares. */
function findHeader(
  rows: readonly RenderRow<GroupingMockRow>[],
  id: string
): RenderRow<GroupingMockRow> | undefined {
  return rows.find((row) => row.kind === 'group' && row.id === id);
}

const US_HEADER_ID = 'group:>region:string:US';
const US_ELECTRONICS_HEADER_ID = 'group:>region:string:US>category:string:Electronics';
const EU_ELECTRONICS_HEADER_ID = 'group:>region:string:EU>category:string:Electronics';

describe('rowsOf', () => {
  it('depth: the outer header returns every leaf under both inner clusters; an inner header returns only its own', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [withGrouping<GroupingMockRow>({ initialGrouping: ['region', 'category'] })],
      }),
      mockGroupingRows
    );

    const rows = store.renderRows();
    const usHeader = findHeader(rows, US_HEADER_ID)!;
    const usElectronicsHeader = findHeader(rows, US_ELECTRONICS_HEADER_ID)!;

    expect(store.rowsOf(usHeader).map((row) => row.id)).toEqual([1, 2, 3]);
    expect(store.rowsOf(usElectronicsHeader).map((row) => row.id)).toEqual([1, 2]);
  });

  it('stale header: a header captured before a new render pass still resolves the same leaves by id', () => {
    const data = signal<GroupingMockRow[]>([...mockGroupingRows]);
    const store = TestBed.runInInjectionContext(() =>
      createTable(data, () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [
          withGrouping<GroupingMockRow>({ initialGrouping: ['region'] }),
          withSorting<GroupingMockRow>(),
        ],
      }))
    );

    const staleHeader = findHeader(store.renderRows(), US_HEADER_ID)!;

    // Force a new render pass unrelated to the header's own cluster contents.
    store.setSorting([{ columnId: 'amount', direction: 'desc' }]);
    TestBed.tick();

    const freshHeader = findHeader(store.renderRows(), US_HEADER_ID)!;
    // The trigger must actually rebuild the RenderRow objects — otherwise this test proves
    // nothing about "stale" resolution.
    expect(staleHeader).not.toBe(freshHeader);

    expect(store.rowsOf(staleHeader).map((row) => row.id).sort()).toEqual([1, 2, 3]);
  });

  it('reactivity: a computed() reading rowsOf recomputes after a data write, a filter change, and a grouping change', () => {
    const data = signal<GroupingMockRow[]>([...mockGroupingRows]);
    const filters = TestBed.runInInjectionContext(() =>
      createFilters<GroupingMockRow>((path) => {
        filter<GroupingMockRow, 'amount', number | null>(
          path.amount,
          (cell, criterion) => cell !== criterion,
          { isEmpty: (v) => v == null, emptyValue: null }
        );
      })
    );
    const store = TestBed.runInInjectionContext(() =>
      createTable(data, () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [
          withFiltering<GroupingMockRow>({ filters }),
          withGrouping<GroupingMockRow>({ initialGrouping: ['region'] }),
        ],
      }))
    );

    const usLeafIds = computed(() => {
      const header = findHeader(store.renderRows(), US_HEADER_ID);
      return header ? store.rowsOf(header).map((row) => row.id) : [];
    });

    expect(usLeafIds()).toEqual([1, 2, 3]);

    // Data write: a new US row joins the cluster.
    data.update((rows) => [
      ...rows,
      { id: 7, region: 'US', category: 'Electronics', amount: 40 },
    ]);
    TestBed.tick();
    expect(usLeafIds()).toEqual([1, 2, 3, 7]);

    // Filter change: excludes the row just added.
    filters['amount']().value.set(40);
    TestBed.tick();
    expect(usLeafIds()).toEqual([1, 2, 3]);

    // Grouping change: adding a nested level leaves the region-level header id unchanged, but
    // is a distinct trigger from the data/filter writes above.
    store.grouping.update(setGroupLevels(['region', 'category']));
    TestBed.tick();
    expect(usLeafIds()).toEqual([1, 2, 3]);
  });

  it('post-filter: a row excluded by a predicate never appears in rowsOf() for its group', () => {
    const filters = TestBed.runInInjectionContext(() =>
      createFilters<GroupingMockRow>((path) => {
        filter<GroupingMockRow, 'amount', number | null>(
          path.amount,
          (cell, criterion) => cell !== criterion,
          { isEmpty: (v) => v == null, emptyValue: null }
        );
      })
    );
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [
          withFiltering<GroupingMockRow>({ filters }),
          withGrouping<GroupingMockRow>({ initialGrouping: ['region', 'category'] }),
        ],
      }),
      mockGroupingRows
    );

    filters['amount']().value.set(300); // excludes id 2 (US > Electronics)

    const usElectronicsHeader = findHeader(store.renderRows(), US_ELECTRONICS_HEADER_ID)!;
    expect(store.rowsOf(usElectronicsHeader).map((row) => row.id)).toEqual([1]);
  });

  it('missing group: holding a header after every row in its cluster is removed returns [], no throw', () => {
    const data = signal<GroupingMockRow[]>([...mockGroupingRows]);
    const store = TestBed.runInInjectionContext(() =>
      createTable(data, () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [withGrouping<GroupingMockRow>({ initialGrouping: ['region', 'category'] })],
      }))
    );

    const euElectronicsHeader = findHeader(store.renderRows(), EU_ELECTRONICS_HEADER_ID)!;
    expect(store.rowsOf(euElectronicsHeader).map((row) => row.id)).toEqual([4]);

    data.update((rows) => rows.filter((row) => row.id !== 4)); // sole member of EU > Electronics
    TestBed.tick();

    expect(() => store.rowsOf(euElectronicsHeader)).not.toThrow();
    expect(store.rowsOf(euElectronicsHeader)).toEqual([]);
  });

  it('cascade recipe: rowsOf -> trackBy -> selectionStateOf -> select/deselect selects exactly the leaf ids, no group: id', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [
          withGrouping<GroupingMockRow>({ initialGrouping: ['region'] }),
          withSelection<GroupingMockRow>(),
        ],
      }),
      mockGroupingRows
    );

    const usHeader = findHeader(store.renderRows(), US_HEADER_ID)!;
    const ids = store.rowsOf(usHeader).map((row) => store.trackBy(row));
    expect(ids.sort()).toEqual([1, 2, 3]);

    expect(store.selectionStateOf(ids)).toBe('none');

    store.select(ids);
    expect(store.selectionStateOf(ids)).toBe('all');
    expect([...store.selectedRows()].sort()).toEqual([1, 2, 3]);
    expect([...store.selectedRows()].some((id) => String(id).startsWith('group:'))).toBe(false);

    store.deselect([ids[0]]);
    expect(store.selectionStateOf(ids)).toBe('some');

    // Second run of the recipe deselects the rest.
    store.deselect(ids);
    expect(store.selectionStateOf(ids)).toBe('none');
    expect(store.selectedRows().size).toBe(0);
  });
});

const EU_HEADER_ID = 'group:>region:string:EU';
const US_FURNITURE_HEADER_ID = 'group:>region:string:US>category:string:Furniture';

describe('collapse/expand (#59)', () => {
  it('no withExpansion() composed: every cluster renders flat and fully expanded (regression, unchanged from #6)', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [withGrouping<GroupingMockRow>({ initialGrouping: ['region'] })],
      }),
      mockGroupingRows
    );

    const rows = store.renderRows();
    expect(rows.filter((row) => row.kind === 'group')).toHaveLength(2); // US, EU
    expect(rows.filter((row) => row.kind === 'row')).toHaveLength(6); // every source row present
  });

  it('withExpansion() composed, nothing toggled: every group renders collapsed by default — descendants omitted', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [
          withGrouping<GroupingMockRow>({ initialGrouping: ['region', 'category'] }),
          withExpansion<GroupingMockRow>(),
        ],
      }),
      mockGroupingRows
    );

    const rows = store.renderRows();
    // Only the two depth-0 headers render — no category headers, no leaves.
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.kind === 'group' && row.depth === 0)).toBe(true);
  });

  it('toggleExpanded(headerId) reveals that header\'s descendants; sibling headers stay collapsed', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [
          withGrouping<GroupingMockRow>({ initialGrouping: ['region'] }),
          withExpansion<GroupingMockRow>(),
        ],
      }),
      mockGroupingRows
    );

    store.toggleExpanded(US_HEADER_ID);

    const rows = store.renderRows();
    const usLeafIds = rows
      .filter((row) => row.kind === 'row' && (row.data as GroupingMockRow).region === 'US')
      .map((row) => (row.data as GroupingMockRow).id);
    expect(usLeafIds.sort()).toEqual([1, 2, 3]);
    // EU was never toggled — still just its header, no leaves.
    expect(rows.some((row) => row.kind === 'row' && (row.data as GroupingMockRow).region === 'EU')).toBe(
      false
    );
  });

  it('two-level grouping, expand outer only: the outer header\'s own child headers appear, but their leaves stay hidden until individually toggled', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [
          withGrouping<GroupingMockRow>({ initialGrouping: ['region', 'category'] }),
          withExpansion<GroupingMockRow>(),
        ],
      }),
      mockGroupingRows
    );

    store.toggleExpanded(US_HEADER_ID);

    const rows = store.renderRows();
    expect(findHeader(rows, US_ELECTRONICS_HEADER_ID)).toBeDefined();
    expect(findHeader(rows, US_FURNITURE_HEADER_ID)).toBeDefined();
    // Neither inner category header was itself toggled — no leaves anywhere yet.
    expect(rows.filter((row) => row.kind === 'row')).toHaveLength(0);
    // EU was never toggled — not even its own category headers appear.
    expect(findHeader(rows, EU_HEADER_ID)).toBeDefined();
    expect(rows.some((row) => row.kind === 'group' && row.id.toString().startsWith(EU_HEADER_ID + '>'))).toBe(
      false
    );
  });

  it('feature array order does not affect collapse behavior', () => {
    function buildRows(features: readonly AnyTableFeature[]): readonly [string, number][] {
      const store = TestBed.runInInjectionContext(() =>
        createTable(signal<GroupingMockRow[]>(mockGroupingRows), () => ({
          trackBy: mockGroupingTrackBy,
          columns: makeColumns(),
          features,
        }))
      );
      store.toggleExpanded(US_HEADER_ID);
      return store
        .renderRows()
        .map((row: RenderRow<GroupingMockRow>) => [String(row.id), row.depth]);
    }

    const groupingFirst = buildRows([
      withGrouping<GroupingMockRow>({ initialGrouping: ['region'] }),
      withExpansion<GroupingMockRow>(),
    ]);
    const expansionFirst = buildRows([
      withExpansion<GroupingMockRow>(),
      withGrouping<GroupingMockRow>({ initialGrouping: ['region'] }),
    ]);

    expect(expansionFirst).toEqual(groupingFirst);
  });

  it('composing withGrouping() without withExpansion() never throws or warns, at construction or on renderRows()', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const store = makeStore(
        () => ({
          trackBy: mockGroupingTrackBy,
          columns: makeColumns(),
          features: [withGrouping<GroupingMockRow>({ initialGrouping: ['region'] })],
        }),
        mockGroupingRows
      );

      expect(() => store.renderRows()).not.toThrow();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('rowsOf() on a collapsed group still returns the full leaf set, not [] (D17 regression)', () => {
    const store = makeStore(
      () => ({
        trackBy: mockGroupingTrackBy,
        columns: makeColumns(),
        features: [
          withGrouping<GroupingMockRow>({ initialGrouping: ['region'] }),
          withExpansion<GroupingMockRow>(),
        ],
      }),
      mockGroupingRows
    );

    // Header captured while collapsed (default: nothing toggled).
    const collapsedHeader = findHeader(store.renderRows(), US_HEADER_ID)!;
    expect(store.rowsOf(collapsedHeader).map((row) => row.id).sort()).toEqual([1, 2, 3]);

    // Same resolution holds for a header captured after an expand/collapse round-trip.
    store.toggleExpanded(US_HEADER_ID);
    store.toggleExpanded(US_HEADER_ID);
    const reCollapsedHeader = findHeader(store.renderRows(), US_HEADER_ID)!;
    expect(store.rowsOf(reCollapsedHeader).map((row) => row.id).sort()).toEqual([1, 2, 3]);
  });
});
