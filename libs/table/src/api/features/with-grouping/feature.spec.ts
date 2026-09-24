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
import { insertRow, patchRow, removeRow } from '../../../mutations/row-mutations';
import { setColumns } from '../../../mutations/update-columns';
import { getNgDevMode, setNgDevMode } from '../../../ng-dev-mode.testing';
import {
  addGroupLevel,
  reorderGroupLevels,
  setGroupLevels,
} from '../../../mutations/update-grouping';
import { aggregate, grouping, groupingAsync, groupOrder } from './schema';
import type { GroupingHandle } from './types';
import type { WritableView } from '../../../engine/writable-view';
import { filter } from '../with-filtering/rules';
import type { FiltersPath } from '../with-filtering/types';
import { createTable } from '../../create-table';
import { withComputed } from '../with-computed';
import { withFiltering } from '../with-filtering';
import { withGrouping, type GroupingMembers, type WithGroupingConfig } from './feature';
import { withSelection } from '../with-selection';
import { withSorting } from '../with-sorting';
import { withTree } from '../with-tree';
import type {
  ColumnDef,
  GroupingUpdater,
  RenderRow,
  RowId,
  TableStore,
} from '../../types';

// Grouping is now keyed by declared column id space (ADR-0024) — `path.<id>` in every `schema`
// callback below is dot-notation, which needs the literal id union, not `string`. No return-type
// annotation + `id: '…' as const` + `satisfies` keeps it literal (`create-table.spec.ts:20-36`);
// an annotated `ColumnDef<GroupingMockRow>[]` return type would widen every id to `string` and
// turn every `path.<id>` access into an index-signature access (TS4111).
function makeColumns() {
  return [
    {
      id: 'region' as const,
      accessor: (row: GroupingMockRow) => row.region,
      visible: true,
      order: 0,
      label: 'Region',
    },
    {
      id: 'category' as const,
      accessor: (row: GroupingMockRow) => row.category,
      visible: true,
      order: 1,
      label: 'Category',
    },
    {
      id: 'amount' as const,
      accessor: (row: GroupingMockRow) => row.amount,
      visible: true,
      order: 2,
      label: 'Amount',
    },
  ] satisfies ColumnDef<GroupingMockRow>[];
}

/** Average `amount` across a cluster's own leaves — declared via `aggregate` in `schema`
 * now that `ColumnDef` no longer carries `aggregateFn` (Step 4). */
const avgAmount = (rows: GroupingMockRow[]): number =>
  rows.reduce((sum, row) => sum + row.amount, 0) / rows.length;

/** `makeColumns()`'s declared-id union, named once so a helper's return-type annotation doesn't
 * have to spell it out. */
type MockColumnId = 'region' | 'category' | 'amount';

/** Widened on purpose (explicit `ColumnDef<GroupingMockRow>[]` return type, no `as const`) — the
 * "unknown column ids throw" cases below need a `TId` of plain `string` so an out-of-union id
 * compiles at all, to prove the *runtime* check rather than relying on the compile-time rejection
 * `makeColumns()`'s literal ids already give a real caller for free. Mirrors
 * `create-table.types.spec.ts`'s `makeWidenedColumns()`. */
function makeWidenedColumns(): ColumnDef<GroupingMockRow>[] {
  return makeColumns();
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
        withGrouping({
          initial: ['region', 'category'],
          schema: (path) => aggregate(path.amount, avgAmount),
        })
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
        withGrouping({
          initial: ['region', 'category'],
          schema: (path) => aggregate(path.amount, avgAmount),
        })
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

  it('filter -> group pipeline order: cluster order ranks by post-filter size, not raw size', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withFiltering({ schema: excludeAmount300 }),
        withGrouping({
          initial: ['region'],
          schema: (path) =>
            groupOrder(path.region, (a, b) => b.rows.length - a.rows.length),
        })
      )
    );

    // Unfiltered, US and EU are tied at 3 rows each, so a comparator ranking by raw size would
    // keep first-occurrence order (US, EU). With id 2 excluded, US drops to 2 rows while EU
    // stays at 3 — EU must now rank ahead of US, proving the comparator saw post-filter cluster
    // sizes. `renderRows()`'s group headers re-derive their own order from the post-pipeline row
    // *set* (buildGroupRenderRows rebuilds the whole cluster tree), so header order is the same
    // regardless of which stage produced that set — it can't tell filter-then-group apart from
    // group-then-filter. `rows()`, the flat pipeline output, is what `PIPELINE_ORDER` actually
    // governs: `group`'s own sortClusters call runs against whatever `filter` has (or hasn't)
    // already removed at that point in the fixed order.
    const groupIds = store
      .renderRows()
      .filter((row) => row.kind === 'group')
      .map((row) => row.id);
    expect(groupIds).toEqual(['group:>region:string:EU', 'group:>region:string:US']);

    const rowIds = store.rows().map((row) => (row as GroupingMockRow).id);
    expect(rowIds).toEqual([4, 5, 6, 1, 3]);
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
          schema: (path) => groupOrder(path.category, (a, b) => b.rows.length - a.rows.length),
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
            groupOrder(path.region, (a, b) => String(a.key).localeCompare(String(b.key))),
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

  it('groupOrder pins header order across a sort on a non-grouped column (G5)', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({
          initial: ['region'],
          schema: (path) => {
            groupOrder(path.region, (a, b) => String(b.key).localeCompare(String(a.key)));
          },
        }),
        withSorting()
      )
    );
    const headerKeys = (): unknown[] =>
      store
        .renderRows()
        .filter((row) => row.kind === 'group')
        .map((row) => row.groupKey?.value);

    expect(headerKeys()).toEqual(['US', 'EU']);

    // amount asc puts EU's id 5 (10) first — without the comparator, first-occurrence would
    // flip the headers to EU, US.
    store.setSorting([{ columnId: 'amount', direction: 'asc' }]);

    expect(headerKeys()).toEqual(['US', 'EU']);
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
              groupOrder(path.region, () => {
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
            groupOrder(path.region, (a, b) => String(a.key).localeCompare(String(b.key)));
            groupOrder(path.category, (a, b) => b.rows.length - a.rows.length);
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

  it('groupOrder on a column with no active level is a silent no-op — no reordering, no throw', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({
          initial: ['region'],
          schema: (path) =>
            // 'amount' is never grouped by (not in `initial`, never named by `grouping`) —
            // this comparator has no active level to attach to and must never run.
            groupOrder(path.amount, (a, b) => String(b.key).localeCompare(String(a.key))),
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
        withGrouping({
          initial: ['region', 'category'],
          schema: (path) => aggregate(path.amount, avgAmount),
        })
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

describe('unknown column ids throw (AC #4)', () => {
  it('an unknown id in initial throws at construction, naming both withGrouping and the id', () => {
    // `makeWidenedColumns()`, not `makeColumns()` — a literal-id `columns` array would reject
    // 'nope' at compile time (see `feature.types.spec.ts`); this proves the *runtime* check a
    // dynamically-built `columns` array (TId widened to `string`) still needs.
    expect(() =>
      inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeWidenedColumns() },
          withGrouping({ initial: ['nope'] })
        )
      )
    ).toThrow(/\[withGrouping\].*"nope"/);
  });

  it('an unknown id declared through schema (grouping) throws the same way as initial', () => {
    expect(() =>
      inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeWidenedColumns() },
          withGrouping({
            initial: ['region'],
            schema: (path) => grouping(path['nope'], { enable: () => true }),
          })
        )
      )
    ).toThrow(/\[withGrouping\].*"nope"/);
  });

  it('aggregate on an undeclared id throws the same construction-time check — it rides Step 1, not a second one (G59)', () => {
    expect(() =>
      inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeWidenedColumns() },
          withGrouping({
            initial: ['region'],
            schema: (path) => aggregate(path['nope'], (rows) => rows.length),
          })
        )
      )
    ).toThrow(/\[withGrouping\].*"nope"/);
  });

  it("the writer half: table.grouping.update(addGroupLevel('nope')) throws, naming the unknown id", () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] })
      )
    );

    expect(() => store.grouping.update(addGroupLevel('nope'))).toThrow(/\[withGrouping\].*"nope"/);
  });

  it('G76: construction is dev-only — withGrouping({ initial: [\'nope\'] }) builds without throwing when ngDevMode is false', () => {
    const previous = getNgDevMode();
    setNgDevMode(false);
    try {
      expect(() =>
        inContext(() =>
          createTable(
            signal<GroupingMockRow[]>(mockGroupingRows),
            { trackBy: mockGroupingTrackBy, columns: makeWidenedColumns() },
            withGrouping({ initial: ['nope'] })
          )
        )
      ).not.toThrow();
    } finally {
      setNgDevMode(previous);
    }
  });

  it('G76: the writer still throws on an unknown level when ngDevMode is false', () => {
    const previous = getNgDevMode();
    setNgDevMode(false);
    try {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({ initial: ['region'] })
        )
      );

      expect(() => store.grouping.update(addGroupLevel('nope'))).toThrow(
        /\[withGrouping\].*"nope"/
      );
    } finally {
      setNgDevMode(previous);
    }
  });

  it('reorderGroupLevels with out-of-range indices stays a no-op, never a throw — only unknown ids throw', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] })
      )
    );

    expect(() => store.grouping.update(reorderGroupLevels(9, 12))).not.toThrow();
    expect(store.grouping()).toEqual(['region', 'category']); // out-of-range indices: unchanged
  });

  it("a level naming a column added by setColumns() is writable — the writer reads columns() at write time, not at construction", () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        {
          trackBy: mockGroupingTrackBy,
          columns: makeWidenedColumns().filter((column) => column.id !== 'category'),
        },
        withGrouping({ initial: ['region'] })
      )
    );

    // 'category' is not a column yet — the writer would throw if it tried now.
    expect(() => store.grouping.update(addGroupLevel('category'))).toThrow(
      /\[withGrouping\].*"category"/
    );

    store.columns.update(setColumns(makeWidenedColumns()));

    // Same id, now a real column — the writer re-reads columns() live and accepts it.
    expect(() => store.grouping.update(addGroupLevel('category'))).not.toThrow();
    expect(store.grouping()).toEqual(['region', 'category']);
  });
});

describe('aggregate over a derived-accessor column (AC #6)', () => {
  it('aggregates a column whose value comes from an accessor, not a raw row field', () => {
    const columns = [
      ...makeColumns(),
      {
        id: 'amountDoubled' as const,
        accessor: (row: GroupingMockRow) => row.amount * 2,
        visible: true,
        order: 3,
        label: 'Amount x2',
      },
    ] satisfies ColumnDef<GroupingMockRow>[];

    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns },
        withGrouping({
          initial: ['region'],
          schema: (path) =>
            aggregate(path.amountDoubled, (rows) =>
              rows.reduce((sum, row) => sum + row.amount * 2, 0)
            ),
        })
      )
    );

    const usHeader = store
      .renderRows()
      .find((row) => row.kind === 'group' && row.groupKey?.value === 'US')!;
    // US leaves: 100, 300, 50 -> doubled sum = 900.
    expect(usHeader.aggregates?.['amountDoubled']).toBe(900);
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

  // Moved up from the (now-deleted) `collapse/expand (#25)` block — its subject is `rowsOf()`'s
  // collapse-independence, grouping's own API and the D17 regression it guards, so it stays;
  // it composes `withTree()` only to produce a collapsed state to be about. See
  // `.claude/rules/spec-files-assert-own-domain-only.md`.
  it('rowsOf() on a collapsed group still returns the full leaf set, not [] (D17 regression)', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region'] }),
        withTree()
      )
    );

    // Header captured while collapsed (default: nothing toggled).
    const collapsedHeader = findHeader(store.renderRows(), US_HEADER_ID)!;
    expect(store.rowsOf(collapsedHeader).map((row) => row.id).sort()).toEqual([1, 2, 3]);

    // Same resolution holds for a header captured after an expand/collapse round-trip.
    store.tree.toggle(US_HEADER_ID);
    store.tree.toggle(US_HEADER_ID);
    const reCollapsedHeader = findHeader(store.renderRows(), US_HEADER_ID)!;
    expect(store.rowsOf(reCollapsedHeader).map((row) => row.id).sort()).toEqual([1, 2, 3]);
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

  it('is total for every applied level (AC #5) — a level a when rejects entirely still stays absent (D5)', () => {
    const admitted = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] })
      )
    );

    // Every applied level resolves to a real ColumnDef — an unknown id can no longer reach this
    // point at all, it would have thrown at construction or at the writer (AC #4).
    expect(admitted.groupingLevels()).toHaveLength(2);
    expect(admitted.groupingLevels().every((column) => column !== undefined)).toBe(true);

    const rejected = inContext(() =>
      createTable(
        signal<GroupWhenMockRow[]>(mockGroupWhenRows),
        { trackBy: mockGroupWhenTrackBy, columns: groupWhenColumns() },
        // Largest cluster is 2 rows, so a threshold of 3 rejects every cluster.
        withGrouping({ initial: ['region'], when: (c) => c.rows.length >= 3 })
      )
    );

    // Totality is about *applied* levels — it does not resurrect one that never admitted a
    // single cluster. Step 5's deletion of the silent-drop path must not read as removing this
    // applied/declared distinction too.
    expect(rejected.groupingLevels()).toEqual([]);
  });

  it('reactivity: a computed() reading groupingLevels recomputes after grouping.update', () => {
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
  });

  // `groupingLevels()`'s totality (AC #5) is only ever re-checked from the `grouping` writer's
  // side (AC #4) — a `columns` write does not re-validate the already-declared grouping array.
  // Removing a still-active level's column via `setColumns()` (a very ordinary column-picker
  // interaction) is therefore a runtime, data-dependent condition, not a construction/writer
  // contract violation — it degrades (omits the orphaned level) and reports once, rather than
  // throwing (ADR-0014).
  it('removing an active level\'s column via setColumns() degrades and reports, never throws', () => {
    const store = inContext(() =>
      createTable(
        signal<GroupingMockRow[]>(mockGroupingRows),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial: ['region', 'category'] })
      )
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      // Explicit `: boolean` return type — an inferred type predicate here would narrow the
      // filtered array's `TId` away from the store's declared union, which `setColumns()`'s
      // updater type then rejects as a mismatch rather than a subset.
      const isNotRegion = (column: ColumnDef<GroupingMockRow, MockColumnId>): boolean =>
        column.id !== 'region';
      store.columns.update(setColumns(makeColumns().filter(isNotRegion)));
      TestBed.tick();

      expect(store.groupingLevels().map((column) => column.id)).toEqual(['category']);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toMatch(/No column declares id "region"/);
    } finally {
      errorSpy.mockRestore();
    }
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
  it('no expansion feature composed at all: every cluster renders flat and fully expanded, no collapse verb exists on the store, and isExpanded is unstamped', () => {
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

    // No collapse verb exists at all — no tree feature and no expansion feature is composed.
    expect('tree' in store).toBe(false);
    expect('expansion' in store).toBe(false);

    // Unstamped, not stamped false — C4's undefined-for-no-feature contract.
    expect(rows.every((row) => row.isExpanded === undefined)).toBe(true);
  });

  it('composing withGrouping() on its own throws and warns nothing, at construction or on renderRows()', () => {
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
 * (`schema`-recorded `groupingAsync`) coverage rather than inventing a second harness. Only
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
  groupingAsync(path, {
    params: () => 'p',
    factory: () => control.resource,
    onSuccess: (result) => Boolean(result),
    onError,
  });
}

describe('grouping declarative sugar (#26)', () => {
  // `groupingAsync` without `onError` is a `@ts-expect-error` compile-time case, already
  // covered by `schema.spec.ts` (Step 3, "groupingAsync without onError is a compile
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
              grouping(path.category, { enable: () => true });
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
              grouping(path.region, { enable: () => undefined });
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
              grouping(path.region, { enable: () => false });
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
              grouping(path.region, { enable: () => regionActive() });
              grouping(path.category, { enable: () => categoryActive() });
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
              grouping(path.category, { enable: () => true });
              grouping(path.region, { enable: () => true });
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
              grouping(path.category, { enable: () => true });
              grouping(path.region, { enable: () => false });
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
              grouping(path.category, { enable: () => categoryActive() });
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
              grouping(path.category, { enable: () => undefined });
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
              grouping(path.category, { enable: () => undefined });
            },
          })
        )
      );

      expect(withSeed.grouping()).toEqual(['region']);
      expect(withoutSeed.grouping()).toEqual([]);
    });

    it('accepts the object form of initial, normalizing it to the same key list (D9)', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({ initial: [{ columnId: 'region' }] })
        )
      );

      expect(store.grouping()).toEqual(['region']);
    });

    it('accepts a mixed string/object initial array (D9)', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({ initial: ['region', { columnId: 'category' }] })
        )
      );

      expect(store.grouping()).toEqual(['region', 'category']);
    });

    it("an initial entry's label wins over a matching column's label (D9)", () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({ initial: [{ columnId: 'region', label: 'Sales Region' }] })
        )
      );

      const header = store.renderRows().find((row) => row.kind === 'group')!;
      expect(header.groupKey?.label).toBe('Sales Region');
    });

    it('an object-form level with no label falls through to the matching column label (D9)', () => {
      const store = inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeColumns() },
          withGrouping({ initial: [{ columnId: 'region' }] })
        )
      );

      const header = store.renderRows().find((row) => row.kind === 'group')!;
      expect(header.groupKey?.label).toBe('Region');
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
              grouping(path.category, { enable: () => undefined });
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
              grouping(path.region, { enable: () => true });
              grouping(path.category, { enable: () => false });
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
                grouping(path.region, { enable: () => true });
                grouping(path.category, {
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
                grouping(path.category, {});
              },
            })
          )
        )
      ).toThrow(
        "[withGrouping] grouping on field 'category' declares neither enable nor when."
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
            grouping(path.region, { when: () => true });
            grouping(path.category, { enable: () => false });
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
            grouping(path.region, { enable: () => true });
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

  it('grouping by a real row field with no declared column now throws (ADR-0024 superseded the old D7 no-guard behavior)', () => {
    // `id` is never registered as a column (`makeColumns()` only declares
    // region/category/amount) — grouping is keyed by declared column id space now, not by any
    // row field, so an undeclared field throws the same as a genuinely unknown one (AC #4).
    expect(() =>
      inContext(() =>
        createTable(
          signal<GroupingMockRow[]>(mockGroupingRows),
          { trackBy: mockGroupingTrackBy, columns: makeWidenedColumns() },
          withGrouping({ initial: ['id'] })
        )
      )
    ).toThrow(/\[withGrouping\].*"id"/);
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

// See `makeColumns()`'s header comment — same reason this drops its return-type annotation.
function groupWhenColumns() {
  return [
    {
      id: 'region' as const,
      accessor: (row: GroupWhenMockRow) => row.region,
      visible: true,
      order: 0,
      label: 'Region',
    },
    {
      id: 'amount' as const,
      accessor: (row: GroupWhenMockRow) => row.amount,
      visible: true,
      order: 1,
      label: 'Amount',
    },
  ] satisfies ColumnDef<GroupWhenMockRow>[];
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

  // The live-editing scenario: a row with no group value yet sits flat (no header). Patching its
  // grouped field to a value that has never appeared in the data before must both admit it and
  // create that header on the same write — no separate "create the group" step exists.
  it('a row edited from blank to a brand-new value moves immediately from flat into a freshly created header', () => {
    const data = signal<GroupWhenMockRow[]>([...mockGroupWhenRows]);
    const store = inContext(() =>
      createTable(
        data,
        { trackBy: mockGroupWhenTrackBy, columns: groupWhenColumns() },
        withGrouping({ initial: ['region'], when: (c) => c.key != null })
      )
    );
    const APAC_GROUP_ID = 'group:>region:string:APAC';

    // Row 5 starts with no region — flat, depth 0, no header for it anywhere.
    expect(store.groupIds()).not.toContain(APAC_GROUP_ID);
    expect(
      store
        .renderRows()
        .find((row) => row.kind === 'row' && (row.data as GroupWhenMockRow).id === 5)?.depth
    ).toBe(0);

    // Same write a dropdown-driven cell editor performs: patch the row's grouped field.
    store.value.update(patchRow<GroupWhenMockRow>(5, { region: 'APAC' }));
    TestBed.tick();

    const apacHeader = store
      .renderRows()
      .find((row) => row.kind === 'group' && row.id === APAC_GROUP_ID);
    expect(apacHeader).toBeDefined();
    expect(store.rowsOf(apacHeader!).map((row) => row.id)).toEqual([5]);
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
          { trackBy: mockGroupWhenTrackBy, columns: groupWhenColumns() },
          withGrouping({
            initial: ['region'],
            when: (c) => c.rows.length >= 2,
            schema: (path) => aggregate(path.amount, throwingAggregateFn),
          })
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
            groupOrder(path.region, (a, b) => Number(a.admitted) - Number(b.admitted)),
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
      cells: {},
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
      grouping(path.region, { enable: () => true });
    });
  });

  it('recovers the row type from the slot — config is row-typed with no explicit type argument', () => {
    expectTypeOf<Parameters<typeof withGrouping<TableStore<GroupingMockRow>>>[0]>().toEqualTypeOf<
      WithGroupingConfig<GroupingMockRow> | undefined
    >();
  });

  // Column-id typo rejection (both in `initial` and in `schema`'s `path`) is now covered by
  // `feature.types.spec.ts` against a `createTable()` with real declared columns — grouping is
  // keyed by declared column id space (ADR-0024), not by `keyof TRow`, so a generic
  // `TableStore<TRow>` with no literal columns (as used above) can no longer exercise that
  // rejection: its column-id type falls back to `string`.
});

describe('writes target rows; clustering re-derives', () => {
  // Nothing below names a group id: every write targets rows, and the clustering re-derives.
  // See the story lesson audit's D8.
  // No return-type annotation: `TableStore<GroupingMockRow, MockColumnId>` named the id union
  // directly, pre-#125; the store's second parameter is the value map now, and inferring off
  // the `createTable()` call below carries the same literal ids with no re-spelling needed.
  function setup(initial: MockColumnId[] = ['region', 'category']) {
    return inContext(() =>
      createTable(
        signal<GroupingMockRow[]>([...mockGroupingRows]),
        { trackBy: mockGroupingTrackBy, columns: makeColumns() },
        withGrouping({ initial })
      )
    );
  }

  /** Every `kind: 'group'` header id currently rendered, in render order. */
  function headerIds(store: { renderRows: () => readonly RenderRow<GroupingMockRow>[] }): string[] {
    return store
      .renderRows()
      .filter((row) => row.kind === 'group')
      .map((row) => String(row.id));
  }

  it('patching a row group field moves that row between clusters', () => {
    const store = setup(['region']);

    // Row 1 starts under US. Nothing here mentions a cluster — only the field the level reads.
    expect(store.rowsOf(findHeader(store.renderRows(), US_HEADER_ID)!).map((r) => r.id)).toEqual([
      1, 2, 3,
    ]);

    store.value.update(patchRow<GroupingMockRow>(1, { region: 'EU' }));
    TestBed.tick();

    expect(store.rowsOf(findHeader(store.renderRows(), US_HEADER_ID)!).map((r) => r.id)).toEqual([
      2, 3,
    ]);
    const euHeader = findHeader(store.renderRows(), 'group:>region:string:EU')!;
    expect(store.rowsOf(euHeader).map((r) => r.id).sort()).toEqual([1, 4, 5, 6]);
  });

  it('patching a row to a name a sibling already holds merges the two clusters', () => {
    const store = setup(['region', 'category']);

    // US has Electronics and Furniture as siblings.
    expect(headerIds(store)).toContain(US_ELECTRONICS_HEADER_ID);
    expect(headerIds(store)).toContain('group:>region:string:US>category:string:Furniture');

    // Row 3 is US > Furniture's only leaf. Renaming its category to a sibling's name is what a
    // taxonomy rename does one row at a time.
    store.value.update(patchRow<GroupingMockRow>(3, { category: 'Electronics' }));
    TestBed.tick();

    expect(headerIds(store)).not.toContain('group:>region:string:US>category:string:Furniture');
    const merged = findHeader(store.renderRows(), US_ELECTRONICS_HEADER_ID)!;
    expect(store.rowsOf(merged).map((r) => r.id).sort()).toEqual([1, 2, 3]);
  });

  it("removing a cluster's last leaf removes its header, with no group state to clean up", () => {
    const store = setup(['region', 'category']);

    // US > Furniture holds exactly row 3.
    store.value.update(removeRow<GroupingMockRow>(3));
    TestBed.tick();

    expect(headerIds(store)).not.toContain('group:>region:string:US>category:string:Furniture');
    // Its parent survives, because its other subtree still has leaves.
    expect(headerIds(store)).toContain(US_HEADER_ID);
  });

  it('an appended row lands under the cluster its field values name, with no placement write', () => {
    const store = setup(['region', 'category']);

    // Appended at the end, carrying EU > Electronics. No updater takes a group id.
    store.value.update(
      insertRow<GroupingMockRow>({ id: 7, region: 'EU', category: 'Electronics', amount: 40 })
    );
    TestBed.tick();

    const header = findHeader(store.renderRows(), EU_ELECTRONICS_HEADER_ID)!;
    expect(store.rowsOf(header).map((r) => r.id).sort()).toEqual([4, 7]);
    // And the row is rendered inside that subtree, not trailing the table.
    const rendered = store.renderRows();
    const headerIndex = rendered.findIndex((row) => row.id === EU_ELECTRONICS_HEADER_ID);
    expect(rendered[headerIndex + 1]?.data?.id).toBe(4);
    expect(rendered[headerIndex + 2]?.data?.id).toBe(7);
  });
});

