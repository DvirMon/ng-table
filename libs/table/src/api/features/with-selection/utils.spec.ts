import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { mockRows, mockTrackBy, type MockRow } from '../../../table.mock';
import { createTable } from '../../create-table';
import { filter } from '../with-filtering/rules';
import { selectAllIds } from './utils';
import { withFiltering } from '../with-filtering';
import { withSelection } from './feature';
import type { ColumnDef, TableStore } from '../../types';

function makeColumns(): ColumnDef<MockRow>[] {
  return [{ id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'name' }];
}

/** Runs a `createTable()` build inside an Angular injection context. */
function inContext<T>(build: () => T): T {
  return TestBed.runInInjectionContext(build);
}

function makeFilteredStore(): TableStore<MockRow> {
  return inContext(() =>
    createTable(
      signal<MockRow[]>(mockRows),
      { trackBy: mockTrackBy, columns: makeColumns() },
      withFiltering({
        // Unconditionally active (no user input to wait for) — `isEmpty: () => false` skips the
        // emptyValue-equality check `filter()` would otherwise apply, which would treat the
        // initial value (equal to `emptyValue`) as empty and never narrow at all.
        schema: (path) => ({
          isRowOne: filter(path.id, (cell) => cell === 1, { emptyValue: null, isEmpty: () => false }),
        }),
      })
    )
  );
}

describe('selectAllIds', () => {
  it("default scope selects exactly rows()'s ids, a strict subset of value()", () => {
    const store = makeFilteredStore();

    // Sanity: the filter genuinely narrows rows() below value() before asserting on it.
    expect(store.rows().map((row) => row.id)).toEqual([1]);
    expect(store.value().map((row) => row.id)).toEqual([1, 2, 3]);

    expect(selectAllIds(store)).toEqual([1]);
  });

  it("includeHidden: true selects exactly value()'s ids", () => {
    const store = makeFilteredStore();

    expect(selectAllIds(store, { includeHidden: true })).toEqual([1, 2, 3]);
  });

  it("composes with pre-existing selection via select()'s own dedup (D15)", () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection()
      )
    );

    store.select([1]);
    store.select(selectAllIds(store));
    // A repeat call with the same output must not grow or corrupt the set — proves
    // selectAllIds() leans on select()'s own dedup rather than re-implementing it.
    store.select(selectAllIds(store));

    expect([...store.selectedRows()].sort()).toEqual([1, 2, 3]);

    // Same output also works as the "deselect all visible" toggle half.
    store.deselect(selectAllIds(store));

    expect(store.selectedRows().size).toBe(0);
  });

  it('returns [] for an empty row set, both default and includeHidden, without throwing', () => {
    const store = inContext(() =>
      createTable(signal<MockRow[]>([]), { trackBy: mockTrackBy, columns: makeColumns() })
    );

    expect(() => selectAllIds(store)).not.toThrow();
    expect(selectAllIds(store)).toEqual([]);
    expect(selectAllIds(store, { includeHidden: true })).toEqual([]);
  });
});
