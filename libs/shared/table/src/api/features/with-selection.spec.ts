import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { mockRows, mockTrackBy, type MockRow } from '../../table.mock';
import { createTable } from '../create-table';
import { withSelection, type SelectionChange } from './with-selection';
import { withSorting } from './with-sorting';
import type {
  AnyTableFeature,
  ColumnDef,
  ComposedFeatureMembers,
  TableStore,
  TableStoreConfig,
} from '../types';

// `globalThis`'s static type has no `ngDevMode` — this is the one place the flag is poked,
// so the shape is named once here rather than casting inline at every read/write.
type NgDevModeGlobal = typeof globalThis & { ngDevMode?: boolean };
const ngDevModeGlobal: NgDevModeGlobal = globalThis;

function makeColumns(): ColumnDef<MockRow>[] {
  return [
    { id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'name' },
  ];
}

// Mirrors `with-expansion.spec.ts`: rows are seeded at construction via the `data` signal —
// pass `rows` for tests that need them, omit for state-only tests.
function makeStore<const F extends readonly AnyTableFeature[]>(
  cfg: () => TableStoreConfig<MockRow, F>,
  rows: MockRow[] = []
): TableStore<MockRow> & ComposedFeatureMembers<F> {
  return TestBed.runInInjectionContext(() => createTable(signal<MockRow[]>(rows), cfg));
}

/** Sets the global `ngDevMode` flag for the duration of one test, restoring it afterward. */
function withNgDevMode<T>(value: boolean, run: () => T): T {
  const previous = ngDevModeGlobal.ngDevMode;
  ngDevModeGlobal.ngDevMode = value;
  try {
    return run();
  } finally {
    ngDevModeGlobal.ngDevMode = previous;
  }
}

describe('withSelection', () => {
  it('toggle(id) adds, toggling again removes, and repeated toggles alternate', () => {
    const store = makeStore(() => ({
      trackBy: mockTrackBy,
      columns: makeColumns(),
      features: [withSelection<MockRow>()],
    }), mockRows);

    expect(store.selectedRows().has(1)).toBe(false);

    store.toggle(1);
    expect(store.selectedRows().has(1)).toBe(true);

    store.toggle(1);
    expect(store.selectedRows().has(1)).toBe(false);

    store.toggle(1);
    store.toggle(1);
    expect(store.selectedRows().has(1)).toBe(false);
  });

  it('select(ids)/deselect(ids) apply in one write; duplicate ids within a call collapse', () => {
    const store = makeStore(() => ({
      trackBy: mockTrackBy,
      columns: makeColumns(),
      features: [withSelection<MockRow>()],
    }), mockRows);

    store.select([1, 2, 1]);
    expect([...store.selectedRows()].sort()).toEqual([1, 2]);

    store.deselect([1, 3]);
    expect([...store.selectedRows()].sort()).toEqual([2]);
  });

  it('clearSelection() empties the set', () => {
    const store = makeStore(() => ({
      trackBy: mockTrackBy,
      columns: makeColumns(),
      features: [withSelection<MockRow>()],
    }), mockRows);

    store.select([1, 2]);
    store.clearSelection();
    expect(store.selectedRows().size).toBe(0);
  });

  it('with enableMultiRowSelection: false, toggle() on a second row replaces rather than adds', () => {
    withNgDevMode(false, () => {
      const store = makeStore(() => ({
        trackBy: mockTrackBy,
        columns: makeColumns(),
        features: [withSelection<MockRow>({ enableMultiRowSelection: false })],
      }), mockRows);

      store.toggle(1);
      expect([...store.selectedRows()]).toEqual([1]);

      store.toggle(2);
      expect([...store.selectedRows()]).toEqual([2]);
    });
  });

  it('with enableMultiRowSelection: false, select([a, b]) keeps only the last id (production, no throw)', () => {
    withNgDevMode(false, () => {
      const store = makeStore(() => ({
        trackBy: mockTrackBy,
        columns: makeColumns(),
        features: [withSelection<MockRow>({ enableMultiRowSelection: false })],
      }), mockRows);

      store.select([1, 2]);
      expect([...store.selectedRows()]).toEqual([2]);
    });
  });

  it('under ngDevMode, a multi-id write that violates enableMultiRowSelection throws', () => {
    withNgDevMode(true, () => {
      const store = makeStore(() => ({
        trackBy: mockTrackBy,
        columns: makeColumns(),
        features: [withSelection<MockRow>({ enableMultiRowSelection: false })],
      }), mockRows);

      expect(() => store.select([1, 2])).toThrow();
    });
  });

  it('with a per-row predicate, co-selection is forbidden only for the rows it names', () => {
    withNgDevMode(false, () => {
      const store = makeStore(() => ({
        trackBy: mockTrackBy,
        columns: makeColumns(),
        // Row 1 forbids co-selection; rows 2 and 3 allow it.
        features: [
          withSelection<MockRow>({ enableMultiRowSelection: (row) => row.id !== 1 }),
        ],
      }), mockRows);

      store.select([2, 3]);
      expect([...store.selectedRows()].sort()).toEqual([2, 3]);

      store.toggle(1);
      expect([...store.selectedRows()]).toEqual([1]);
    });
  });

  it('enableRowSelection blocks toggle() from adding a non-selectable row', () => {
    const store = makeStore(() => ({
      trackBy: mockTrackBy,
      columns: makeColumns(),
      features: [withSelection<MockRow>({ enableRowSelection: (row) => row.id !== 1 })],
    }), mockRows);

    store.toggle(1);
    expect(store.selectedRows().size).toBe(0);
  });

  it('enableRowSelection drops only the non-selectable ids from a select(ids) mixed array', () => {
    const store = makeStore(() => ({
      trackBy: mockTrackBy,
      columns: makeColumns(),
      features: [withSelection<MockRow>({ enableRowSelection: (row) => row.id !== 1 })],
    }), mockRows);

    store.select([1, 2]);
    expect([...store.selectedRows()]).toEqual([2]);
  });

  it('deselect() of an already-selected row is ungated even after the row becomes non-selectable', () => {
    const selectableIds = new Set([1, 2, 3]);
    const store = makeStore(() => ({
      trackBy: mockTrackBy,
      columns: makeColumns(),
      features: [
        withSelection<MockRow>({ enableRowSelection: (row) => selectableIds.has(row.id) }),
      ],
    }), mockRows);

    store.toggle(1);
    expect(store.selectedRows().has(1)).toBe(true);

    selectableIds.delete(1); // row 1 becomes non-selectable while selected

    store.deselect([1]);
    expect(store.selectedRows().has(1)).toBe(false);
  });

  it('enableRowSelection gates the initialSelection seed', () => {
    const store = makeStore(() => ({
      trackBy: mockTrackBy,
      columns: makeColumns(),
      features: [
        withSelection<MockRow>({
          initialSelection: [1, 2],
          enableRowSelection: (row) => row.id !== 1,
        }),
      ],
    }), mockRows);

    expect([...store.selectedRows()]).toEqual([2]);
  });

  it('enableRowSelection stays permissive for an id that resolves to no row (D8)', () => {
    const store = makeStore(() => ({
      trackBy: mockTrackBy,
      columns: makeColumns(),
      features: [withSelection<MockRow>({ enableRowSelection: () => false })],
    }), mockRows);

    store.toggle(999);
    expect(store.selectedRows().has(999)).toBe(true);
  });

  it('a write fully blocked by enableRowSelection emits no selectionChanged', () => {
    const store = makeStore(() => ({
      trackBy: mockTrackBy,
      columns: makeColumns(),
      features: [withSelection<MockRow>({ enableRowSelection: (row) => row.id !== 1 })],
    }), mockRows);

    const emissions: SelectionChange[] = [];
    store.selectionChanged.subscribe((change) => emissions.push(change));

    store.select([1]);
    expect(emissions).toEqual([]);
  });

  it('an id absent from the seeded row data still toggles/selects', () => {
    const store = makeStore(() => ({
      trackBy: mockTrackBy,
      columns: makeColumns(),
      features: [withSelection<MockRow>()],
    }), mockRows);

    store.toggle(999);
    expect(store.selectedRows().has(999)).toBe(true);
  });

  it('selectionStateOf(ids) returns none/some/all for the given id set, unaffected by ids outside it', () => {
    const store = makeStore(() => ({
      trackBy: mockTrackBy,
      columns: makeColumns(),
      features: [withSelection<MockRow>()],
    }), mockRows);

    expect(store.selectionStateOf([1, 2])).toBe('none');

    store.select([1]);
    expect(store.selectionStateOf([1, 2])).toBe('some');

    store.select([2]);
    expect(store.selectionStateOf([1, 2])).toBe('all');

    // A third, unrelated selected id must not affect the result for [1, 2].
    store.select([3]);
    expect(store.selectionStateOf([1, 2])).toBe('all');
  });

  it('every write verb emits exactly one selectionChanged delta with correct added/removed', () => {
    const store = makeStore(() => ({
      trackBy: mockTrackBy,
      columns: makeColumns(),
      features: [withSelection<MockRow>()],
    }), mockRows);

    const emissions: SelectionChange[] = [];
    store.selectionChanged.subscribe((change) => emissions.push(change));

    store.toggle(1);
    store.select([2, 3]);
    store.deselect([1]);
    store.clearSelection();

    expect(emissions).toEqual([
      { added: [1], removed: [] },
      { added: [2, 3], removed: [] },
      { added: [], removed: [1] },
      { added: [], removed: [2, 3] },
    ]);
  });

  it('a no-op write emits nothing; emitEvent: false changes state but emits nothing', () => {
    const store = makeStore(() => ({
      trackBy: mockTrackBy,
      columns: makeColumns(),
      features: [withSelection<MockRow>()],
    }), mockRows);

    const emissions: SelectionChange[] = [];
    store.selectionChanged.subscribe((change) => emissions.push(change));

    store.deselect([1]); // nothing selected yet — no-op
    store.select([]); // no-op
    store.clearSelection(); // already empty — no-op
    expect(emissions).toEqual([]);

    store.select([1], { emitEvent: false });
    expect(store.selectedRows().has(1)).toBe(true);
    expect(emissions).toEqual([]);
  });

  it('initialSelection seeds selectedRows and emits nothing, including to a subscriber attached right after construction', () => {
    const store = makeStore(() => ({
      trackBy: mockTrackBy,
      columns: makeColumns(),
      features: [withSelection<MockRow>({ initialSelection: [1, 2] })],
    }), mockRows);

    const emissions: SelectionChange[] = [];
    store.selectionChanged.subscribe((change) => emissions.push(change));

    expect([...store.selectedRows()].sort()).toEqual([1, 2]);
    expect(emissions).toEqual([]);
  });

  it('removing a selected row from data prunes its id from selectedRows and emits nothing', () => {
    const data = signal([...mockRows]);
    const store = TestBed.runInInjectionContext(() =>
      createTable(data, () => ({
        trackBy: mockTrackBy,
        columns: makeColumns(),
        features: [withSelection<MockRow>()],
      }))
    );

    store.select([1, 2]);

    const emissions: SelectionChange[] = [];
    store.selectionChanged.subscribe((change) => emissions.push(change));

    data.update((rows) => rows.filter((row) => row.id !== 1));
    TestBed.tick();

    expect(store.selectedRows().has(1)).toBe(false);
    expect(store.selectedRows().has(2)).toBe(true);
    expect(emissions).toEqual([]);
  });

  it('selection is unaffected by sorting or by a data write that reorders without removing', () => {
    const data = signal([...mockRows]);
    const store = TestBed.runInInjectionContext(() =>
      createTable(data, () => ({
        trackBy: mockTrackBy,
        columns: makeColumns(),
        features: [withSelection<MockRow>(), withSorting<MockRow>()],
      }))
    );

    store.select([1, 2]);

    store.toggleSort('name');
    TestBed.tick();
    expect([...store.selectedRows()].sort()).toEqual([1, 2]);

    data.update((rows) => [...rows].reverse());
    TestBed.tick();
    expect([...store.selectedRows()].sort()).toEqual([1, 2]);
  });

  it('selectionChanged completes when the table is destroyed', () => {
    const store = makeStore(() => ({
      trackBy: mockTrackBy,
      columns: makeColumns(),
      features: [withSelection<MockRow>()],
    }), mockRows);

    let completed = false;
    store.selectionChanged.subscribe({ complete: () => (completed = true) });
    expect(completed).toBe(false);

    TestBed.resetTestingModule();

    expect(completed).toBe(true);
  });
});
