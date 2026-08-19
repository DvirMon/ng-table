import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createTable } from './create-table';
import type { ColumnDef } from './types';
import { withSorting } from './features/with-sorting';

interface Row {
  id: string;
  name: string;
  status: string;
}

function makeColumns(): ColumnDef<Row>[] {
  return [
    { id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'name' },
    { id: 'status', accessor: (row) => row.status, visible: true, order: 1, label: 'status' },
  ];
}

// Builds a live store instance the same way a component field does — inside an injection
// context, with a data signal. Columns tests pass no rows; row tests seed rows via the
// `data` param, which is wrapped in a signal at construction.
function makeStore(
  columns: ColumnDef<Row>[] = makeColumns(),
  data: Row[] = []
) {
  return TestBed.runInInjectionContext(() =>
    createTable(signal(data), () => ({ trackBy: 'id', columns }))
  );
}

describe('createTable', () => {
  it('normalizes a string trackBy shorthand into a function', () => {
    const store = makeStore();

    expect(store.trackBy({ id: 'r1', name: 'Ann', status: 'active' })).toBe(
      'r1'
    );
  });

  it('accepts a trackBy function as-is', () => {
    const store = TestBed.runInInjectionContext(() =>
      createTable(signal<Row[]>([]), () => ({
        trackBy: (row: Row) => `row-${row.id}`,
        columns: makeColumns(),
      }))
    );

    expect(store.trackBy({ id: 'r1', name: 'Ann', status: 'active' })).toBe(
      'row-r1'
    );
  });

  it('rows reflect the data signal directly, no internal effect', () => {
    const data = signal<Row[]>([{ id: 'r1', name: 'Ann', status: 'active' }]);
    const store = TestBed.runInInjectionContext(() =>
      createTable(data, () => ({ trackBy: 'id', columns: makeColumns() }))
    );

    expect(store.rows()).toEqual([{ id: 'r1', name: 'Ann', status: 'active' }]);

    // A new emission flows straight through the pipeline, no flush needed.
    data.set([
      { id: 'r1', name: 'Ann', status: 'active' },
      { id: 'r2', name: 'Bob', status: 'inactive' },
    ]);
    expect(store.rows()).toHaveLength(2);
  });

  it('renderRows() 1:1-wraps rows() when no grouping is composed', () => {
    const rows: Row[] = [
      { id: 'r1', name: 'Ann', status: 'active' },
      { id: 'r2', name: 'Bob', status: 'inactive' },
    ];
    const store = makeStore(makeColumns(), rows);

    expect(store.renderRows()).toEqual([
      { id: 'r1', depth: 0, kind: 'row', data: rows[0], index: 0 },
      { id: 'r2', depth: 0, kind: 'row', data: rows[1], index: 1 },
    ]);
  });

  it('renderRows() derives its ids from trackBy', () => {
    const store = TestBed.runInInjectionContext(() =>
      createTable(
        signal<Row[]>([{ id: 'r1', name: 'Ann', status: 'active' }]),
        () => ({
          trackBy: (row: Row) => `row-${row.id}`,
          columns: makeColumns(),
        })
      )
    );

    expect(store.renderRows()[0].id).toBe('row-r1');
  });

  it('renderRows() recomputes downstream of the pipeline, not just data re-emits', () => {
    const store = TestBed.runInInjectionContext(() =>
      createTable(
        signal<Row[]>([
          { id: 'r1', name: 'Ann', status: 'active' },
          { id: 'r2', name: 'Bob', status: 'inactive' },
        ]),
        () => ({
          trackBy: 'id',
          columns: makeColumns(),
          features: [withSorting<Row>()],
        })
      )
    );

    expect(store.renderRows().map((r) => r.id)).toEqual(['r1', 'r2']);

    store.toggleSort('name');
    store.toggleSort('name');

    expect(store.renderRows().map((r) => r.id)).toEqual(['r2', 'r1']);
  });

  it('gives each createTable() call independent state', () => {
    const storeA = makeStore(makeColumns(), [
      { id: 'r1', name: 'Ann', status: 'active' },
    ]);
    const storeB = makeStore();

    expect(storeA.rows()).toHaveLength(1);
    expect(storeB.rows()).toEqual([]);
  });
});
