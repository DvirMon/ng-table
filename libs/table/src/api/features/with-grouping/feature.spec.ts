import { computed, signal, type Resource, type ResourceStatus, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import {
  mockGroupingRows,
  mockGroupingTrackBy,
  mockGroupWhenRows,
  mockGroupWhenTrackBy,
  mockRepRows,
  mockRepTrackBy,
  type GroupingMockRow,
  type GroupWhenMockRow,
  type RepMockRow,
} from '../../../table.mock';
import { setColumns } from '../../../mutations/update-columns';
import { setGroupLevels } from '../../../mutations/update-grouping';
import { applyGrouping, applyGroupingAsync, applyGroupOrder } from './schema';
import type { GroupingHandle } from './types';
import type { WritableView } from '../../../engine/writable-view';
import { filter } from '../with-filtering/rules';
import type { FiltersPath } from '../with-filtering/types';
import { createTable } from '../../create-table';
import { withComputed } from '../with-computed';
import { withExpansion } from '../with-expansion';
import { withFiltering } from '../with-filtering';
import { withGrouping, type WithGroupingConfig } from './feature';
import { withSelection } from '../with-selection';
import { withSorting } from '../with-sorting';
import type {
  ColumnDef,
  ColumnId,
  GroupingUpdater,
  RenderRow,
  RowId,
  TableStore,
} from '../../types';

// Grouping reads row fields directly, never a column's `accessor` (D7) — no literal-id
// inference is needed here, so a plain `ColumnDef<GroupingMockRow>[]` annotation is enough.
function makeColumns(): ColumnDef<GroupingMockRow>[] {
  return [
    {
      id: 'region',
      accessor: (row) => row.region,
      visible: true,
      order: 0,
      label: 'Region',
    },
    {
      id: 'category',
      accessor: (row) => row.category,
      visible: true,
      order: 1,
      label: 'Category',
    },
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
 * assertions below and the `when` cases (#85). Generic over any row shape carrying a
 * numeric `id`, so it also serves the local `when`-only fixtures below. */
function toShape<TRow extends { id: number }>(
  rows: readonly { kind: string; depth: number; data: TRow | null }[]
): [string, number, number | undefined][] {
  return rows.map((row) => [row.kind, row.depth, row.data?.id]);
}

/** Runs a `createTable()` build inside an Angular injection context. */
function inContext<T>(build: () => T): T {
  return TestBed.runInInjectionContext(build);
}

/** Drops id 2 (US > Electronics, amount 300) — shared so stores that must be provably identical
 * (pipeline-order argument swap) reuse one schema instead of two independently-constant ones. */
const excludeAmount300 = (path: FiltersPath<GroupingMockRow>) => ({
  amount: filter(path.amount, (cell) => cell !== 300, { emptyValue: null, isEmpty: () => false }),
});

describe('withGrouping', () => {
  it('grouping() starts empty; setGroupLevels updates it and re-clusters renderRows()', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping()
      )
    );

    expect(store.grouping()).toEqual([]);
    expect(store.renderRows().every((row) => row.kind === 'row')).toBe(true);

    store.grouping.update(setGroupLevels(['region']));

    expect(store.grouping()).toEqual(['region']);
    expect(store.renderRows().filter((row) => row.kind === 'group')).toHaveLength(2); // US, EU
  });

  it('a trailing withComputed() block reads grouping().length; setGroupLevels updates it', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping(
          { initial: ['region'] },
          withComputed((s) => ({ levels: computed(() => s.grouping().length) }))
        )
      )
    );

    expect(store.levels()).toBe(1);

    store.grouping.update(setGroupLevels(['region', 'category']));

    expect(store.levels()).toBe(2);
  });

  it('two-level grouping produces nested group headers at correct depths, leaves contiguous', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] })
      )
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
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] })
      )
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
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] })
      )
    );

    const rows = store.renderRows();
    expect(rows.filter((row) => row.kind === 'row')).toHaveLength(6); // every source row present
    expect(rows.filter((row) => row.kind === 'group')).toHaveLength(6); // 2 region + 4 category, none hidden
  });

  it('composes with withSorting(): sort reorders rows within each cluster, cluster boundaries stay intact', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] }),
        withSorting()
      )
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
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withFiltering({ schema: excludeAmount300 }),
        withGrouping({ initial: ['region', 'category'] })
      )
    );

    const usHeader = store
      .renderRows()
      .find((row) => row.kind === 'group' && row.depth === 0);

    // Without the filter, the US average is 150 (see the depth-correctness case). With id 2
    // excluded, the remaining US rows (100, 50) average to 75 — proving `aggregateFn` only
    // ever sees post-filter rows, per the fixed filter -> group -> sort -> expand order.
    expect(usHeader?.aggregates?.['amount']).toBe(75);
  });

  it('initial naming a field no row carries degrades to one phantom cluster, never a throw (D7)', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['not-a-column'] })
      )
    );

    expect(store.grouping()).toEqual(['not-a-column']);
    expect(store.renderRows().filter((row) => row.kind === 'group')).toHaveLength(1);
  });

  it('an unknown level passed to setGroupLevels does not throw — it degrades to one phantom cluster per parent, never dropped (D7)', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping()
      )
    );

    expect(() =>
      store.grouping.update(setGroupLevels(['region', 'not-a-column']))
    ).not.toThrow();

    // The raw level list is stored as given — resolution against known columns happens at
    // pipeline/render read time, not at write time.
    expect(store.grouping()).toEqual(['region', 'not-a-column']);

    // 'not-a-column' names no row field, so every row shares the same `undefined` value at that
    // level — one uninformative phantom cluster per region, but still rendered (D7: an unknown
    // field degrades to a phantom cluster, it is never silently dropped).
    const rows = store.renderRows();
    const headerRows = rows.filter((row) => row.kind === 'group');
    expect(headerRows).toHaveLength(4); // 2 region headers + 1 phantom child each
    expect(headerRows.filter((row) => row.depth === 0)).toHaveLength(2); // US, EU
    expect(headerRows.filter((row) => row.depth === 1)).toHaveLength(2); // phantom 'not-a-column' cluster per region
    expect(rows.every((row) => row.kind !== 'row' || row.depth === 2)).toBe(true); // every leaf nested one level deeper
  });

  it('groupOrder omitted preserves first-occurrence cluster order (regression, unchanged from issue #7)', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] })
      )
    );

    const groupIds = store
      .renderRows()
      .filter((row) => row.kind === 'group')
      .map((row) => row.id);

    expect(groupIds).toEqual(['group:>region:string:US', 'group:>region:string:EU']);
  });

  it('groupOrder reorders group headers by their contents without disturbing row order within a cluster', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({
          initial: ['region', 'category'],
          schema: (path) => applyGroupOrder(path.category, (a, b) => b.rows.length - a.rows.length),
        })
      )
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
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({
          initial: ['region', 'category'],
          // Ascending alphabetical by key — reorders the region level (EU < US). Applied only to
          // `path.region`, never to `path.category` — category never has a comparator, so it
          // stays on the stable admission-partition default at every depth.
          schema: (path) =>
            applyGroupOrder(path.region, (a, b) => String(a.key).localeCompare(String(b.key))),
        })
      )
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
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] }),
        withSorting()
      )
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
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({
            initial: ['region'],
            schema: (path) =>
              applyGroupOrder(path.region, () => {
                throw new Error('boom');
              }),
          })
        )
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

  it('two levels with different comparators order independently in the same renderRows() output (#87 AC2)', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({
          initial: ['region', 'category'],
          schema: (path) => {
            applyGroupOrder(path.region, (a, b) => String(a.key).localeCompare(String(b.key)));
            applyGroupOrder(path.category, (a, b) => b.rows.length - a.rows.length);
          },
        })
      )
    );

    const rows = store.renderRows();

    // Region: ascending by key reorders EU ahead of US (insertion order was US, EU).
    // Category: descending by rows.length reorders EU's own children (Furniture, 2 rows, ahead
    // of Electronics, 1 row) — a genuinely different rule than region's, applied only within its
    // own level, proving the two comparators order independently in one output.
    expect(toShape(rows)).toEqual([
      ['group', 0, undefined], // EU (reordered ahead of US)
      ['group', 1, undefined], // EU > Furniture (reordered ahead of Electronics)
      ['row', 2, 5],
      ['row', 2, 6],
      ['group', 1, undefined], // EU > Electronics
      ['row', 2, 4],
      ['group', 0, undefined], // US
      ['group', 1, undefined], // US > Electronics (already matches descending-count order)
      ['row', 2, 1],
      ['row', 2, 2],
      ['group', 1, undefined], // US > Furniture
      ['row', 2, 3],
    ]);
  });

  it('applyGroupOrder on a column with no active level is a silent no-op — no reordering, no throw', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({
          initial: ['region'],
          schema: (path) =>
            // 'amount' is never grouped by (not in `initial`, never named by `applyGrouping`) —
            // this comparator has no active level to attach to and must never run.
            applyGroupOrder(path.amount, (a, b) => String(b.key).localeCompare(String(a.key))),
        })
      )
    );

    expect(() => store.renderRows()).not.toThrow();

    const groupIds = store
      .renderRows()
      .filter((row) => row.kind === 'group')
      .map((row) => row.id);

    expect(groupIds).toEqual(['group:>region:string:US', 'group:>region:string:EU']);
  });

  it("removing a cluster's sole members removes that cluster from renderRows() with no residual", () => {
    const data = signal<GroupingMockRow[]>([...mockGroupingRows]);
    const store = inContext(() =>
      createTable(
        data,
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] })
      )
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

  it("a cluster member's parentId is its header's id", () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] })
      )
    );

    const rows = store.renderRows();
    const usHeader = rows.find((row) => row.kind === 'group' && row.groupKey?.value === 'US')!;
    const usLeaves = rows.filter(
      (row) => row.kind === 'row' && (row.data as GroupingMockRow).region === 'US'
    );

    expect(usLeaves.length).toBeGreaterThan(0);
    expect(usLeaves.every((row) => row.parentId === usHeader.id)).toBe(true);
  });

  it("a nested header's parentId is its parent header's id, at two levels of grouping", () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] })
      )
    );

    const rows = store.renderRows();
    const usHeader = rows.find(
      (row) => row.kind === 'group' && row.depth === 0 && row.groupKey?.value === 'US'
    )!;
    const usChildHeaders = rows.filter((row) => row.kind === 'group' && row.depth === 1);

    expect(usChildHeaders).toHaveLength(4); // 2 under US, 2 under EU
    const usOwnChildHeaders = usChildHeaders.filter((row) => row.parentId === usHeader.id);
    expect(usOwnChildHeaders).toHaveLength(2); // Electronics, Furniture
  });

  it('a top-level header has parentId === undefined', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] })
      )
    );

    const topLevelHeaders = store
      .renderRows()
      .filter((row) => row.kind === 'group' && row.depth === 0);

    expect(topLevelHeaders).toHaveLength(2); // US, EU
    expect(topLevelHeaders.every((row) => row.parentId === undefined)).toBe(true);
  });

  it("an ungrouped table's rows all have parentId === undefined", () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping()
      )
    );

    const rows = store.renderRows();
    expect(rows.every((row) => row.kind === 'row')).toBe(true);
    expect(rows.every((row) => row.parentId === undefined)).toBe(true);
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
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] })
      )
    );

    const rows = store.renderRows();
    const usHeader = findHeader(rows, US_HEADER_ID)!;
    const usElectronicsHeader = findHeader(rows, US_ELECTRONICS_HEADER_ID)!;

    expect(store.rowsOf(usHeader).map((row) => row.id)).toEqual([1, 2, 3]);
    expect(store.rowsOf(usElectronicsHeader).map((row) => row.id)).toEqual([1, 2]);
  });

  it('stale header: a header captured before a new render pass still resolves the same leaves by id', () => {
    const data = signal<GroupingMockRow[]>([...mockGroupingRows]);
    const store = inContext(() =>
      createTable(
        data,
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] }),
        withSorting()
      )
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
    const store = inContext(() =>
      createTable(
        data,
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withFiltering({
          // `emptyValue: null` keeps the rule inactive until a criterion is written — the
          // criterion itself (`filters.amount().value`) is the signal read that exercises
          // "a filter change" as one of this case's three reactivity triggers.
          schema: (path) => ({
            amount: filter(path.amount, (cell, criterion) => cell !== criterion, {
              emptyValue: null as number | null,
            }),
          }),
        }),
        withGrouping({ initial: ['region'] })
      )
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
    store.filters.amount().value.set(40);
    TestBed.tick();
    expect(usLeafIds()).toEqual([1, 2, 3]);

    // Grouping change: adding a nested level leaves the region-level header id unchanged, but
    // is a distinct trigger from the data/filter writes above.
    store.grouping.update(setGroupLevels(['region', 'category']));
    TestBed.tick();
    expect(usLeafIds()).toEqual([1, 2, 3]);
  });

  it('post-filter: a row excluded by a predicate never appears in rowsOf() for its group', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withFiltering({ schema: excludeAmount300 }),
        withGrouping({ initial: ['region', 'category'] })
      )
    );

    const usElectronicsHeader = findHeader(store.renderRows(), US_ELECTRONICS_HEADER_ID)!;
    expect(store.rowsOf(usElectronicsHeader).map((row) => row.id)).toEqual([1]);
  });

  it('missing group: holding a header after every row in its cluster is removed returns [], no throw', () => {
    const data = signal<GroupingMockRow[]>([...mockGroupingRows]);
    const store = inContext(() =>
      createTable(
        data,
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] })
      )
    );

    const euElectronicsHeader = findHeader(store.renderRows(), EU_ELECTRONICS_HEADER_ID)!;
    expect(store.rowsOf(euElectronicsHeader).map((row) => row.id)).toEqual([4]);

    data.update((rows) => rows.filter((row) => row.id !== 4)); // sole member of EU > Electronics
    TestBed.tick();

    expect(() => store.rowsOf(euElectronicsHeader)).not.toThrow();
    expect(store.rowsOf(euElectronicsHeader)).toEqual([]);
  });

  it('cascade recipe: rowsOf -> trackBy -> selectionStateOf -> select/deselect selects exactly the leaf ids, no group: id', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] }),
        withSelection()
      )
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
const EU_FURNITURE_HEADER_ID = 'group:>region:string:EU>category:string:Furniture';

describe('groupIds', () => {
  it('single-level grouping: returns exactly the ids of every kind: "group" render row', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] })
      )
    );

    const headerIds = store
      .renderRows()
      .filter((row) => row.kind === 'group')
      .map((row) => row.id);

    expect([...store.groupIds()].sort()).toEqual([...headerIds].sort());
    expect(store.groupIds().sort()).toEqual([EU_HEADER_ID, US_HEADER_ID].sort());
  });

  it('multi-level grouping: includes every header at every depth, matching findHeader for each', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] })
      )
    );

    const rows = store.renderRows();
    const expectedIds = [
      US_HEADER_ID,
      US_ELECTRONICS_HEADER_ID,
      US_FURNITURE_HEADER_ID,
      EU_HEADER_ID,
      EU_ELECTRONICS_HEADER_ID,
      EU_FURNITURE_HEADER_ID,
    ];

    for (const id of expectedIds) {
      expect(findHeader(rows, id)).toBeDefined();
    }
    expect(store.groupIds().sort()).toEqual([...expectedIds].sort());
  });

  it('ungrouped table: returns []', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping()
      )
    );

    expect(store.groupIds()).toEqual([]);
  });

  it('collapse-independent: collapsing a group via toggleExpanded does not remove its id', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] }),
        withExpansion()
      )
    );

    // withExpansion() starts every group collapsed by default — groupIds() must already see
    // every header before anything is toggled, and must keep seeing them after collapseAll().
    expect(store.groupIds().sort()).toEqual(
      [
        US_HEADER_ID,
        US_ELECTRONICS_HEADER_ID,
        US_FURNITURE_HEADER_ID,
        EU_HEADER_ID,
        EU_ELECTRONICS_HEADER_ID,
        EU_FURNITURE_HEADER_ID,
      ].sort()
    );

    store.toggleExpanded(US_HEADER_ID);
    store.collapseAll();

    expect(store.groupIds().sort()).toEqual(
      [
        US_HEADER_ID,
        US_ELECTRONICS_HEADER_ID,
        US_FURNITURE_HEADER_ID,
        EU_HEADER_ID,
        EU_ELECTRONICS_HEADER_ID,
        EU_FURNITURE_HEADER_ID,
      ].sort()
    );
  });
});

describe('groupingLevels (#81)', () => {
  it('returns the level columns in level order, outermost first, carrying real labels', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] })
      )
    );

    expect(store.groupingLevels().map((column) => column.id)).toEqual(['region', 'category']);
    expect(store.groupingLevels().map((column) => column.label)).toEqual(['Region', 'Category']);
  });

  it('ungrouped table: returns []', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping()
      )
    );

    expect(store.groupingLevels()).toEqual([]);
  });

  it('dropped level (D4/D7): a level naming no known column has no ColumnDef, but isGroupedBy still agrees with what renderRows() actually emits', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] })
      )
    );

    store.grouping.update(setGroupLevels(['region', 'ghost']));
    TestBed.tick();

    // groupingLevels() can only report a ColumnDef for a real column — 'ghost' has none, so it's
    // absent here even though it is still an active grouping level.
    expect(store.groupingLevels().map((column) => column.id)).toEqual(['region']);
    // isGroupedBy agrees with what actually renders below, not with groupingLevels()'s
    // column-only view: 'ghost' produces a real (if uninformative) header per region, so it
    // reads as grouped.
    expect(store.isGroupedBy('ghost')).toBe(true);

    // Agreement with the pipeline: "ghost" still clusters — one phantom header per region
    // (every row in a region shares the same `undefined` "ghost" value), it is never dropped
    // (D7). Depth 0 = region headers, depth 1 = the phantom "ghost" cluster nested under each.
    const headerRows = store.renderRows().filter((row) => row.kind === 'group');
    expect(headerRows.filter((row) => row.depth === 0).map((row) => row.id).sort()).toEqual(
      [EU_HEADER_ID, US_HEADER_ID].sort()
    );
    expect(headerRows.filter((row) => row.depth === 1)).toHaveLength(2); // phantom "ghost" cluster per region
    expect(store.groupIds().sort()).toEqual(headerRows.map((row) => row.id).sort());
  });

  it('reactivity: a computed() reading groupingLevels recomputes after grouping.update and after a level column is removed via setColumns', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] })
      )
    );

    const levelIds = computed(() => store.groupingLevels().map((column) => column.id));
    expect(levelIds()).toEqual(['region']);

    store.grouping.update(setGroupLevels(['region', 'category']));
    TestBed.tick();
    expect(levelIds()).toEqual(['region', 'category']);

    store.columns.update(setColumns(makeColumns().filter((column) => column.id !== 'region')));
    TestBed.tick();
    expect(levelIds()).toEqual(['category']);
  });

  it('overlay-decided levels: reflects an async rule masking a declared level, including while still pending', () => {
    const control = makeControllableResource<unknown>();
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({
          initial: ['region'],
          schema: (path) => applyAsyncGroupingRule(path.region, control),
        })
      )
    );

    // Pending: abstains, holding the declared array unmasked.
    expect(store.groupingLevels().map((column) => column.id)).toEqual(['region']);

    control.resolve(false);
    TestBed.tick();
    expect(store.groupingLevels().map((column) => column.id)).toEqual([]);
  });
});

describe('isGroupedBy (#81)', () => {
  it('true for every level id, false for a non-level column and an unknown id', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] })
      )
    );

    expect(store.isGroupedBy('region')).toBe(true);
    expect(store.isGroupedBy('category')).toBe(false);
    expect(store.isGroupedBy('does-not-exist')).toBe(false);
  });

  it('ungrouped table: always false', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping()
      )
    );

    expect(store.isGroupedBy('region')).toBe(false);
  });

  it('reactivity: agrees with groupingLevels after a grouping.update, inside a computed()', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] })
      )
    );

    const isCategoryGrouped = computed(() => store.isGroupedBy('category'));
    expect(isCategoryGrouped()).toBe(false);

    store.grouping.update(setGroupLevels(['region', 'category']));
    TestBed.tick();
    expect(isCategoryGrouped()).toBe(true);
  });
});

describe('groupingLevels/isGroupedBy composition order (#81)', () => {
  it('withGrouping() before withSorting(): both members present and correct', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] }),
        withSorting()
      )
    );

    expect(store.groupingLevels().map((column) => column.id)).toEqual(['region']);
    expect(store.isGroupedBy('region')).toBe(true);
    expect(store.isGroupedBy('category')).toBe(false);
  });

  it('withSorting() before withGrouping(): both members present and correct', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withSorting(),
        withGrouping({ initial: ['region'] })
      )
    );

    expect(store.groupingLevels().map((column) => column.id)).toEqual(['region']);
    expect(store.isGroupedBy('region')).toBe(true);
    expect(store.isGroupedBy('category')).toBe(false);
  });
});

describe('collapse/expand (#25)', () => {
  it('no withExpansion() composed: every cluster renders flat and fully expanded (regression, unchanged from #7)', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] })
      )
    );

    const rows = store.renderRows();
    expect(rows.filter((row) => row.kind === 'group')).toHaveLength(2); // US, EU
    expect(rows.filter((row) => row.kind === 'row')).toHaveLength(6); // every source row present
  });

  it('withExpansion() composed, nothing toggled: every group renders collapsed by default — descendants omitted', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] }),
        withExpansion()
      )
    );

    const rows = store.renderRows();
    // Only the two depth-0 headers render — no category headers, no leaves.
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.kind === 'group' && row.depth === 0)).toBe(true);
  });

  it('toggleExpanded(headerId) reveals that header\'s descendants; sibling headers stay collapsed', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] }),
        withExpansion()
      )
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
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] }),
        withExpansion()
      )
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

  it('argument order does not affect collapse behaviour', () => {
    const groupingFirst = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] }),
        withExpansion()
      )
    );
    groupingFirst.toggleExpanded(US_HEADER_ID);
    const groupingFirstShape = groupingFirst
      .renderRows()
      .map((row) => [String(row.id), row.depth]);

    const expansionFirst = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withExpansion(),
        withGrouping({ initial: ['region'] })
      )
    );
    expansionFirst.toggleExpanded(US_HEADER_ID);
    const expansionFirstShape = expansionFirst
      .renderRows()
      .map((row) => [String(row.id), row.depth]);

    expect(expansionFirstShape).toEqual(groupingFirstShape);
  });

  it('composing withGrouping() without withExpansion() never throws or warns, at construction or on renderRows()', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({ initial: ['region'] })
        )
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
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] }),
        withExpansion()
      )
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

  it('a collapsed group nested inside a collapsed group stays hidden when only the outer one opens', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] }),
        withExpansion()
      )
    );

    const outerHeader = store
      .renderRows()
      .find((row) => row.kind === 'group' && row.depth === 0 && row.groupKey?.value === 'US')!;

    store.toggleExpanded(outerHeader.id);

    const rows = store.renderRows();
    const innerHeaders = rows.filter((row) => row.kind === 'group' && row.parentId === outerHeader.id);

    // The outer header's own children (the category headers) are revealed once it opens...
    expect(innerHeaders).toHaveLength(2); // Electronics, Furniture

    // ...but neither inner header was itself toggled, so anything nested beneath either of them
    // stays hidden — the transitive hidden-accumulator case (ADR-0017 decision 8).
    const innerHeaderIds = innerHeaders.map((row) => row.id);
    const revealedUnderInner = rows.filter(
      (row) => row.parentId !== undefined && innerHeaderIds.includes(row.parentId)
    );
    expect(revealedUnderInner).toHaveLength(0);
  });

  describe('either order (D25)', () => {
    it('expansion composed first: nothing toggled shows two depth-0 headers; toggling US reveals its leaves, EU stays collapsed', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withExpansion(),
          withGrouping({ initial: ['region'] })
        )
      );

      const collapsed = store.renderRows();
      expect(collapsed).toHaveLength(2);
      expect(collapsed.every((row) => row.kind === 'group' && row.depth === 0)).toBe(true);

      store.toggleExpanded(US_HEADER_ID);

      expect(toShape(store.renderRows())).toEqual([
        ['group', 0, undefined], // US
        ['row', 1, 1],
        ['row', 1, 2],
        ['row', 1, 3],
        ['group', 0, undefined], // EU, never toggled
      ]);
    });

    it('grouping composed first: identical shape to expansion-first, both before and after toggling US', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({ initial: ['region'] }),
          withExpansion()
        )
      );

      const collapsed = store.renderRows();
      expect(collapsed).toHaveLength(2);
      expect(collapsed.every((row) => row.kind === 'group' && row.depth === 0)).toBe(true);

      store.toggleExpanded(US_HEADER_ID);

      expect(toShape(store.renderRows())).toEqual([
        ['group', 0, undefined], // US
        ['row', 1, 1],
        ['row', 1, 2],
        ['row', 1, 3],
        ['group', 0, undefined], // EU, never toggled
      ]);
    });

    // -----------------------------------------------------------------------------------
    // Type-level half. The vitest executor does NOT typecheck `expectTypeOf`/
    // `@ts-expect-error` — inert at runtime, only enforced by
    // `tsc -p libs/table/tsconfig.spec.json --noEmit`.
    // -----------------------------------------------------------------------------------
    it('a trailing derive on grouping sees expandedRows only when expansion is composed first (D25 — types stricter than runtime)', () => {
      // Expansion first: grouping's trailing block sees expandedRows off the accumulated `In`.
      inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withExpansion(),
          withGrouping(
            { initial: ['region'] },
            withComputed((s) => {
              expectTypeOf(s.expandedRows).toEqualTypeOf<Signal<Set<RowId>>>();
              return {};
            })
          )
        )
      );

      // Grouping first: the same read is a compile error — this slot's `In` doesn't carry
      // ExpansionMembers yet. The runtime store does have `expandedRows` once expansion
      // composes after (any deferred read off the shared object, e.g. a trailing
      // `withComputed()` block, would see it) — this restriction is type-level only.
      // `withGrouping()` itself no longer performs such a read at all (#99) — grouping's own
      // render stage has zero knowledge of expansion; the engine-owned `'prune'` stage governs
      // collapse/expand visibility regardless of argument order (ADR-0017).
      inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping(
            { initial: ['region'] },
            withComputed((s) => {
              // @ts-expect-error — expandedRows is declared by withExpansion(), composed after
              // grouping in this order (D25).
              expectTypeOf(s.expandedRows).toEqualTypeOf<Signal<Set<RowId>>>();
              return {};
            })
          ),
          withExpansion()
        )
      );
    });
  });
});

describe('pipeline order (story 22)', () => {
  it('filter -> group -> sort executes in the same fixed order regardless of feature argument order', () => {
    const filterGroupSort = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withFiltering({ schema: excludeAmount300 }),
        withGrouping({ initial: ['region'] }),
        withSorting()
      )
    );

    const sortGroupFilter = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withSorting(),
        withGrouping({ initial: ['region'] }),
        withFiltering({ schema: excludeAmount300 })
      )
    );

    filterGroupSort.toggleSort('amount');
    sortGroupFilter.toggleSort('amount');

    expect(filterGroupSort.rows().map((row) => row.id)).toEqual(
      sortGroupFilter.rows().map((row) => row.id)
    );
    expect(toShape(filterGroupSort.renderRows())).toEqual(toShape(sortGroupFilter.renderRows()));

    // The filtered-out row is absent from every group, and leaves inside a group are sorted —
    // pipeline order (filter -> group -> sort) is observable, not just an argument-order
    // invariant between the two stores above.
    const leafIds = filterGroupSort
      .renderRows()
      .filter((row) => row.kind === 'row')
      .map((row) => (row.data as GroupingMockRow).id);
    expect(leafIds).not.toContain(2);
    expect(leafIds.length).toBeGreaterThan(0);
  });
});

/**
 * Minimal controllable `Resource` test double — mirrors `engine/grouping-rules.spec.ts`'s
 * `makeControllableResource`/`makeAsyncRule` (Step 3), reused here for public-surface
 * (`schema`-recorded `applyGroupingAsync`) coverage rather than inventing a second harness. Only
 * the subset `buildAsyncGroupingRuleEntry` actually reads (`status`, `value`, `error`).
 */
function makeControllableResource<TResult>(): {
  resource: Resource<TResult | undefined>;
  resolve(value: TResult): void;
  reject(error: unknown): void;
} {
  const value = signal<TResult | undefined>(undefined);
  const status = signal<ResourceStatus>('idle');
  const error = signal<unknown>(undefined);
  const resource = { value, status, error } as unknown as Resource<TResult | undefined>;

  return {
    resource,
    resolve(next: TResult): void {
      value.set(next);
      status.set('resolved');
    },
    reject(nextError: unknown): void {
      error.set(nextError);
      status.set('error');
    },
  };
}

function applyAsyncGroupingRule(
  path: GroupingHandle<GroupingMockRow, 'region'>,
  control: { resource: Resource<unknown> },
  onError: (error: unknown) => boolean = () => false
): void {
  applyGroupingAsync(path, {
    params: () => 'p',
    factory: () => control.resource,
    onSuccess: (result) => Boolean(result),
    onError,
  });
}

describe('grouping declarative sugar (#26)', () => {
  // `applyGroupingAsync` without `onError` is a `@ts-expect-error` compile-time case, already
  // covered by `schema.spec.ts` (Step 3, "applyGroupingAsync without onError is a compile
  // error") — not duplicated here.

  describe('enable masks the declared array: no-introduce / hold / off', () => {
    // Intent, not current behavior. `initial` declares which columns group and in what nesting
    // order; a rule only gates one of them. Introducing a level the array never declared is
    // exactly what the old replace-fold allowed and the mask model removes.
    it('a rule cannot introduce a level absent from initial', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({
            initial: ['region'],
            schema: (path) => {
              applyGrouping(path.category, { enable: () => true });
            },
          })
        )
      );

      expect(store.grouping()).toEqual(['region']);
    });

    it('enable returning undefined (pending) holds the declared array unmasked', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({
            initial: ['region'],
            schema: (path) => {
              applyGrouping(path.region, { enable: () => undefined });
            },
          })
        )
      );

      expect(store.grouping()).toEqual(['region']);
    });

    it('enable false on every declared level groups by nothing', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({
            initial: ['region'],
            schema: (path) => {
              applyGrouping(path.region, { enable: () => false });
            },
          })
        )
      );

      expect(store.grouping()).toEqual([]);
      expect(store.renderRows().every((row) => row.kind === 'row')).toBe(true);
    });
  });

  describe('schema fold', () => {
    it('folds every recorded rule into one mask, all active', () => {
      const regionActive = signal(true);
      const categoryActive = signal(true);

      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({
            initial: ['region', 'category'],
            schema: (path) => {
              applyGrouping(path.region, { enable: () => regionActive() });
              applyGrouping(path.category, { enable: () => categoryActive() });
            },
          })
        )
      );

      expect(store.grouping()).toEqual(['region', 'category']);
    });

    it('call order in the schema fn carries no meaning - initial fixes level order', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({
            initial: ['region', 'category'],
            // Deliberately recorded in the opposite order to `initial`.
            schema: (path) => {
              applyGrouping(path.category, { enable: () => true });
              applyGrouping(path.region, { enable: () => true });
            },
          })
        )
      );

      expect(store.grouping()).toEqual(['region', 'category']);
    });

    it('multiple schema-recorded rules mask the same declared order (D8)', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({
            initial: ['region', 'category'],
            schema: (path) => {
              applyGrouping(path.category, { enable: () => true });
              applyGrouping(path.region, { enable: () => false });
            },
          })
        )
      );

      // Neither rule contributes ordering — masking only ever narrows `initial`.
      expect(store.grouping()).toEqual(['category']);
    });
  });

  describe('initial + schema in one call (#84)', () => {
    it('a schema rule gates a declared level and is inert for an undeclared one — initial is the floor', () => {
      const categoryActive = signal(false);

      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({
            initial: ['region'],
            schema: (path) => {
              applyGrouping(path.category, { enable: () => categoryActive() });
            },
          })
        )
      );

      // `category` is not declared, so its rule cannot introduce it either way.
      expect(store.grouping()).toEqual(['region']);

      categoryActive.set(true);
      expect(store.grouping()).toEqual(['region']);
    });

    it('a pending schema rule abstains to initial when given, and to [] when not — proves initial reaches baseGrouping through the new key name', () => {
      const withSeed = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({
            initial: ['region'],
            schema: (path) => {
              applyGrouping(path.category, { enable: () => undefined });
            },
          })
        )
      );

      const withoutSeed = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({
            schema: (path) => {
              applyGrouping(path.category, { enable: () => undefined });
            },
          })
        )
      );

      expect(withSeed.grouping()).toEqual(['region']);
      expect(withoutSeed.grouping()).toEqual([]);
    });
  });

  describe('pending / resolved / errored rule contributions', () => {
    it('a pending rule (enable returns undefined) makes the whole rule set abstain', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({
            initial: ['region'],
            schema: (path) => {
              applyGrouping(path.category, { enable: () => undefined });
            },
          })
        )
      );

      expect(store.grouping()).toEqual(['region']); // abstain -> falls back to baseGrouping
    });

    it('a resolved rule contributes its boolean to the fold', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({
            initial: ['region', 'category'],
            schema: (path) => {
              applyGrouping(path.region, { enable: () => true });
              applyGrouping(path.category, { enable: () => false });
            },
          })
        )
      );

      expect(store.grouping()).toEqual(['region']);
    });

    it("an errored async rule's onError result is never treated as abstention", () => {
      const control = makeControllableResource<boolean>();
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({
            initial: ['region'],
            schema: (path) => applyAsyncGroupingRule(path.region, control, () => false),
          })
        )
      );

      // Before settle: the entry is pending -> the whole mask abstains -> declared array
      // passes through unmasked.
      expect(store.grouping()).toEqual(['region']);

      control.reject(new Error('boom'));
      TestBed.tick();

      // onError resolved to a real `false` contribution, masking the level off — never
      // re-treated as still-pending (pending would have left `region` unmasked).
      expect(store.grouping()).toEqual([]);
    });
  });

  describe('a throwing enable predicate (ADR-0014)', () => {
    it('excludes that level and reports once per evaluation, not once per row', () => {
      const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const store = inContext(() =>
          createTable(
            signal<GroupingMockRow[]>(mockGroupingRows),
            { trackBy: mockGroupingTrackBy, columns: makeColumns() },
            withGrouping({
              initial: ['region', 'category'],
              schema: (path) => {
                applyGrouping(path.region, { enable: () => true });
                applyGrouping(path.category, {
                  enable: () => {
                    throw new Error('boom');
                  },
                });
              },
            })
          )
        );

        expect(() => store.renderRows()).not.toThrow();
        // The throwing level is excluded from the fold — the whole rule set does not abstain.
        expect(store.grouping()).toEqual(['region']);

        store.renderRows();
        store.renderRows();
        expect(reportSpy).toHaveBeenCalledTimes(1); // once per evaluation, not once per row
      } finally {
        reportSpy.mockRestore();
      }
    });
  });

  describe('a rule declaring neither enable nor when', () => {
    it('throws at construction, naming the offending column', () => {
      expect(() =>
        inContext(() =>
          createTable(
            signal<GroupingMockRow[]>(mockGroupingRows),
            { trackBy: mockGroupingTrackBy, columns: makeColumns() },
            withGrouping({
              initial: ['region'],
              schema: (path) => {
                applyGrouping(path.category, {});
              },
            })
          )
        )
      ).toThrow(
        "[withGrouping] applyGrouping on field 'category' declares neither enable nor when."
      );
    });
  });

  it('a when-only rule (no enable) never masks — it coexists with an unrelated activating rule', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({
          initial: ['region', 'category'],
          schema: (path) => {
            // `when`-only: contributes no entry, so it can never mask `region` off.
            applyGrouping(path.region, { when: () => true });
            applyGrouping(path.category, { enable: () => false });
          },
        })
      )
    );

    expect(store.grouping()).toEqual(['region']);
  });

  // Intent, not current behavior, and the reason D7's accepted shadowing consequence goes away:
  // a rule masks whatever the array currently holds, so it can switch a level off but can never
  // replace the array. An updater write is therefore always respected.
  it('an updater write to grouping is respected, then masked — never replaced', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({
          initial: ['region'],
          schema: (path) => {
            applyGrouping(path.region, { enable: () => true });
          },
        })
      )
    );

    expect(store.grouping()).toEqual(['region']);

    store.grouping.update(setGroupLevels(['category']));

    // The write lands and holds: `region`'s rule has no say over a level the array no longer
    // declares, and `category` carries no rule, so nothing masks it.
    expect(store.grouping()).toEqual(['category']);
  });

  it('grouping by a real row field with no declared column works — the case D7 exists for', () => {
    // `id` is never registered as a column (`makeColumns()` only declares
    // region/category/amount) — D7 reads a grouping level straight off the row, with no
    // column-existence guard, so the level is active anyway.
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['id'] })
      )
    );

    expect(store.grouping()).toEqual(['id']);
    // No `ColumnDef` names 'id', so it can't appear in the column-shaped projection — still
    // correct, since `id` is an active level regardless (proven above).
    expect(store.groupingLevels()).toEqual([]);

    const headers = store.renderRows().filter((row) => row.kind === 'group');
    expect(headers.length).toBe(new Set(mockGroupingRows.map((row) => row.id)).size);
  });

  it('no rules configured: renderRows() is unaffected by the mask — regression for initial + updater writes', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] })
      )
    );

    expect(store.grouping()).toEqual(['region']);
    expect(store.renderRows().filter((row) => row.kind === 'group')).toHaveLength(2); // US, EU

    store.grouping.update(setGroupLevels(['region', 'category']));

    expect(store.grouping()).toEqual(['region', 'category']);
    // Same 12-row shape as the "two-level grouping" case in the `withGrouping` describe above —
    // the mask is a pure pass-through when no rules are configured.
    expect(store.renderRows()).toHaveLength(12);
  });
});

function groupWhenColumns(
  aggregateFn?: (rows: GroupWhenMockRow[]) => unknown
): ColumnDef<GroupWhenMockRow>[] {
  return [
    { id: 'region', accessor: (row) => row.region, visible: true, order: 0, label: 'Region' },
    {
      id: 'amount',
      accessor: (row) => row.amount,
      visible: true,
      order: 1,
      label: 'Amount',
      ...(aggregateFn ? { aggregateFn } : {}),
    },
  ];
}

const EU_GROUP_ID = 'group:>region:string:EU';

describe('when (#85 table-wide admission)', () => {
  it('rows with no region render flat at depth 0; regions with a value keep their header (headline scenario)', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupWhenMockRow[]>(mockGroupWhenRows),
        { trackBy: mockGroupWhenTrackBy, columns: groupWhenColumns() },
        withGrouping({ initial: ['region'], when: (c) => c.key != null })
      )
    );

    const rows = store.renderRows();

    expect(toShape(rows)).toEqual([
      ['group', 0, undefined], // US
      ['row', 1, 1],
      ['row', 1, 2],
      ['group', 0, undefined], // EU
      ['row', 1, 3],
      ['row', 0, 4], // null region — flat, no header
      ['row', 0, 5], // undefined region — flat, no header
    ]);
  });

  it('a size-threshold when dissolves single-row clusters and keeps the rest (OQ-6)', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupWhenMockRow[]>(mockGroupWhenRows),
        { trackBy: mockGroupWhenTrackBy, columns: groupWhenColumns() },
        withGrouping({ initial: ['region'], when: (c) => c.rows.length >= 2 })
      )
    );

    const rows = store.renderRows();

    expect(toShape(rows)).toEqual([
      ['group', 0, undefined], // US (2 rows — admitted)
      ['row', 1, 1],
      ['row', 1, 2],
      ['row', 0, 3], // EU (1 row — dissolved)
      ['row', 0, 4], // null (1 row — dissolved)
      ['row', 0, 5], // undefined (1 row — dissolved)
    ]);
  });

  it('a dissolved cluster contributes no group id and no group: row in renderRows()', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupWhenMockRow[]>(mockGroupWhenRows),
        { trackBy: mockGroupWhenTrackBy, columns: groupWhenColumns() },
        withGrouping({ initial: ['region'], when: (c) => c.rows.length >= 2 })
      )
    );

    expect(store.groupIds()).not.toContain(EU_GROUP_ID);
    expect(
      store.renderRows().some((row) => row.kind === 'group' && row.id === EU_GROUP_ID)
    ).toBe(false);
  });

  // The state surface reports the *observed* result, not declared intent: a level whose every
  // cluster `when` rejects is not an applied grouping level, so it is absent from `grouping()`,
  // `isGroupedBy()` and `groupingLevels()`. Partial rejection is not the same thing — one
  // surviving cluster keeps the level applied. See grouping's decisions doc.
  describe('when rejects every cluster at a level', () => {
    it('drops the level from grouping() entirely, matching the flat render output', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupWhenMockRow[]>(mockGroupWhenRows),
          { trackBy: mockGroupWhenTrackBy, columns: groupWhenColumns() },
          // Largest cluster is US at 2 rows, so no cluster clears the threshold.
          withGrouping({ initial: ['region'], when: (c) => c.rows.length >= 3 })
        )
      );

      // Render side: entirely flat, no header anywhere.
      expect(store.groupIds()).toEqual([]);
      expect(store.renderRows().every((row) => row.kind === 'row')).toBe(true);
      expect(store.renderRows().every((row) => row.depth === 0)).toBe(true);

      // State side agrees: nothing is grouped.
      expect(store.grouping()).toEqual([]);
      expect(store.isGroupedBy('region')).toBe(false);
      expect(store.groupingLevels()).toEqual([]);
    });

    it('re-applies and un-applies the level as data crosses the threshold', () => {
      const data = signal<GroupWhenMockRow[]>([
        { id: 1, region: 'US', amount: 100 },
        { id: 2, region: 'US', amount: 200 },
        { id: 3, region: 'US', amount: 300 },
      ]);
      const store = inContext(() =>
        createTable(
          data,
          { trackBy: mockGroupWhenTrackBy, columns: groupWhenColumns() },
          withGrouping({ initial: ['region'], when: (c) => c.rows.length >= 3 })
        )
      );

      expect(store.groupIds()).toHaveLength(1);
      expect(store.grouping()).toEqual(['region']);

      // One row leaves; the sole cluster drops under the threshold and dissolves.
      data.set([
        { id: 1, region: 'US', amount: 100 },
        { id: 2, region: 'US', amount: 200 },
      ]);

      expect(store.groupIds()).toEqual([]);
      expect(store.renderRows().every((row) => row.kind === 'row')).toBe(true);
      expect(store.grouping()).toEqual([]);
      expect(store.isGroupedBy('region')).toBe(false);

      // And back again — the declared array is untouched, so the level returns.
      data.set([
        { id: 1, region: 'US', amount: 100 },
        { id: 2, region: 'US', amount: 200 },
        { id: 3, region: 'US', amount: 300 },
      ]);

      expect(store.grouping()).toEqual(['region']);
      expect(store.isGroupedBy('region')).toBe(true);
    });

    // The boundary: rejection must be total. One surviving cluster keeps the level applied,
    // so a threshold that dissolves some regions but not others changes nothing in state.
    it('a partially dissolved level stays applied', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupWhenMockRow[]>(mockGroupWhenRows),
          { trackBy: mockGroupWhenTrackBy, columns: groupWhenColumns() },
          // US (2 rows) survives; EU, null and undefined (1 row each) dissolve.
          withGrouping({ initial: ['region'], when: (c) => c.rows.length >= 2 })
        )
      );

      expect(store.groupIds()).toHaveLength(1);
      expect(store.grouping()).toEqual(['region']);
      expect(store.isGroupedBy('region')).toBe(true);
    });

    // `enable` reaches the same end state by a different route — it removes the level from the
    // fold rather than from the cluster tree. Both surfaces must agree either way.
    it('an async enable resolving false also empties grouping()', () => {
      const control = makeControllableResource<unknown>();
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({
            initial: ['region'],
            schema: (path) => applyAsyncGroupingRule(path.region, control),
          })
        )
      );

      control.resolve(false);
      TestBed.tick();

      expect(store.grouping()).toEqual([]);
      expect(store.groupIds()).toEqual([]);
      expect(store.isGroupedBy('region')).toBe(false);
    });
  });

  it('never calls aggregateFn for a dissolved cluster — proven by a throw that never fires', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const throwingAggregateFn = (rows: GroupWhenMockRow[]): number => {
        if (rows.length < 2) {
          throw new Error('aggregateFn must never be called for a dissolved (single-row) cluster');
        }
        return rows.reduce((sum, row) => sum + row.amount, 0) / rows.length;
      };
      const store = inContext(() =>
        createTable(
          signal<GroupWhenMockRow[]>(mockGroupWhenRows),
          { trackBy: mockGroupWhenTrackBy, columns: groupWhenColumns(throwingAggregateFn) },
          withGrouping({ initial: ['region'], when: (c) => c.rows.length >= 2 })
        )
      );

      const usHeader = store.renderRows().find((row) => row.kind === 'group')!;
      expect(usHeader.aggregates?.['amount']).toBe(200); // (100 + 300) / 2 — computed without error
      expect(reportSpy).not.toHaveBeenCalled();
    } finally {
      reportSpy.mockRestore();
    }
  });

  it('pipeline and render stages agree on row order once withSorting() is composed', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupWhenMockRow[]>(mockGroupWhenRows),
        { trackBy: mockGroupWhenTrackBy, columns: groupWhenColumns() },
        withGrouping({ initial: ['region'], when: (c) => c.rows.length >= 2 }),
        withSorting()
      )
    );

    store.setSorting([{ columnId: 'amount', direction: 'desc' }]);

    const pipelineIds = store.rows().map((row) => row.id);
    const renderLeafIds = store
      .renderRows()
      .filter((row) => row.kind === 'row')
      .map((row) => (row.data as GroupWhenMockRow).id);

    expect(renderLeafIds).toEqual(pipelineIds);
  });

  it('a groupOrder that places dissolved clusters first puts their flat rows first too', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupWhenMockRow[]>(mockGroupWhenRows),
        { trackBy: mockGroupWhenTrackBy, columns: groupWhenColumns() },
        withGrouping({
          initial: ['region'],
          when: (c) => c.rows.length >= 2,
          schema: (path) =>
            applyGroupOrder(path.region, (a, b) => Number(a.admitted) - Number(b.admitted)),
        })
      )
    );

    const rows = store.renderRows();

    // EU, null, undefined (all dissolved, first-occurrence order among themselves) come first as
    // flat rows; the admitted US cluster (header + its two leaves) comes last — the assertion
    // that no separate `ungroupedPlacement` config is needed.
    expect(toShape(rows)).toEqual([
      ['row', 0, 3],
      ['row', 0, 4],
      ['row', 0, 5],
      ['group', 0, undefined],
      ['row', 1, 1],
      ['row', 1, 2],
    ]);
  });

  it('omitting when leaves renderRows() byte-identical to the pre-#85 shape (regression gate for the whole slice)', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] })
      )
    );

    const rows = store.renderRows();

    expect(rows.map((row) => [row.kind, row.depth, row.id])).toEqual([
      ['group', 0, 'group:>region:string:US'],
      ['group', 1, 'group:>region:string:US>category:string:Electronics'],
      ['row', 2, 1],
      ['row', 2, 2],
      ['group', 1, 'group:>region:string:US>category:string:Furniture'],
      ['row', 2, 3],
      ['group', 0, 'group:>region:string:EU'],
      ['group', 1, 'group:>region:string:EU>category:string:Electronics'],
      ['row', 2, 4],
      ['group', 1, 'group:>region:string:EU>category:string:Furniture'],
      ['row', 2, 5],
      ['row', 2, 6],
    ]);
  });
});

function repColumns(): ColumnDef<RepMockRow>[] {
  return [
    { id: 'region', accessor: (row) => row.region, visible: true, order: 0, label: 'Region' },
    { id: 'rep', accessor: (row) => row.rep, visible: true, order: 1, label: 'Rep' },
  ];
}

describe('when Q1 through the public surface (#85)', () => {
  it('a null-region row escapes flat at depth 0, never nested under a rep header', () => {
    const store = inContext(() =>
      createTable(
        signal<RepMockRow[]>(mockRepRows),
        { trackBy: mockRepTrackBy, columns: repColumns() },
        withGrouping({ initial: ['region', 'rep'], when: (c) => c.key != null })
      )
    );

    const rows = store.renderRows();

    expect(toShape(rows)).toEqual([
      ['group', 0, undefined], // US
      ['group', 1, undefined], // US > Alice
      ['row', 2, 1],
      ['group', 1, undefined], // US > Bob
      ['row', 2, 2],
      ['row', 0, 3], // null region — escapes flat, once
    ]);

    expect(rows.some((row) => row.kind === 'group' && row.groupKey?.value === 'Carol')).toBe(
      false
    );
    expect(rows.filter((row) => row.data && (row.data as RepMockRow).id === 3)).toHaveLength(1);
  });
});

describe('rowsOf and when (Q3, #85)', () => {
  it("a parent's rowsOf still includes rows from a dissolved child cluster", () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({
          initial: ['region', 'category'],
          when: (c) => c.columnId !== 'category' || c.rows.length >= 2,
        })
      )
    );

    const usHeader = findHeader(store.renderRows(), US_HEADER_ID)!;
    // US > Furniture (id 3 alone) dissolves under the size-2 threshold, yet the region header's
    // rowsOf still returns every leaf beneath it, dissolved or not.
    expect(store.rowsOf(usHeader).map((row) => row.id).sort()).toEqual([1, 2, 3]);
  });

  // `rowsOf`/`rowsBeneathGroup` never receive `when` (no `ClusterOpts` is threaded through
  // that path) — they rebuild the raw cluster tree and resolve purely by path, so a *dissolved*
  // cluster's own id still resolves to its real leaves, same as before #85. Only an id matching
  // no cluster at all returns `[]`; that guarantee already holds without `when`, and this case
  // confirms composing `when` doesn't change it.
  it('rowsOf on an id matching no cluster at all returns [], no throw — unaffected by a configured when', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({
          initial: ['region', 'category'],
          when: (c) => c.columnId !== 'category' || c.rows.length >= 2,
        })
      )
    );

    const bogusHeader: RenderRow<GroupingMockRow> = {
      id: 'group:nope',
      depth: 0,
      kind: 'group',
      data: null,
      index: 0,
    };

    expect(() => store.rowsOf(bogusHeader)).not.toThrow();
    expect(store.rowsOf(bogusHeader)).toEqual([]);
  });
});

// -------------------------------------------------------------------------------------
// Type-level assertions. The vitest executor does NOT typecheck `expectTypeOf`/
// `@ts-expect-error` — they are inert at runtime. These are only enforced by
// `tsc -p libs/table/tsconfig.spec.json --noEmit`, which is the verification step
// for this describe block.
// -------------------------------------------------------------------------------------
describe('types', () => {
  it('withGrouping({ initial }) compiles with a known column id; store.grouping/rowsOf keep their exact declared shape', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] })
      )
    );

    expectTypeOf(store.grouping).toEqualTypeOf<
      WritableView<string[], GroupingUpdater<GroupingMockRow>>
    >();
    expectTypeOf(store.rowsOf).toEqualTypeOf<
      (group: RenderRow<GroupingMockRow>) => readonly GroupingMockRow[]
    >();
    expectTypeOf(store.groupIds).toEqualTypeOf<Signal<RowId[]>>();
    expectTypeOf(store).not.toBeAny();
  });

  it('a positional schema fn is a compile error — the deleted overload does not come back (#84)', () => {
    // @ts-expect-error — the either/or first positional is gone (#84); a schema fn belongs in
    // `config.schema`.
    withGrouping((path) => {
      applyGrouping(path.region, { enable: () => true });
    });
  });

  // `ColumnId<TRow>` is `Extract<keyof TRow, string> | (string & {})` (`api/types.ts`, D14): the
  // `string & {}` arm keeps editor autocomplete on `initial` while leaving any string
  // assignable — `initial` names a level with no runtime existence guard either way (D7, the
  // "grouping by a real row field" case above). `schema`'s `path`, by contrast, is keyed by
  // `keyof TRow` and rejects a genuinely unknown field at the call site, below.
  it('recovers the row type from the slot — config is row-typed with no explicit type argument', () => {
    expectTypeOf<Parameters<typeof withGrouping<TableStore<GroupingMockRow>>>[0]>().toEqualTypeOf<
      WithGroupingConfig<GroupingMockRow> | undefined
    >();
    expectTypeOf<keyof GroupingMockRow & string>().toMatchTypeOf<ColumnId<GroupingMockRow>>();
  });

  it('a field not on the row is a compile error, never a runtime throw (D7)', () => {
    withGrouping<TableStore<GroupingMockRow>>({
      schema: (path) => {
        // @ts-expect-error 'notAField' is not a key of GroupingMockRow.
        applyGrouping(path.notAField, { enable: () => true });
      },
    });
  });
});
