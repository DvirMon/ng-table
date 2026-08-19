import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createTable } from '../create-table';
import { beginEdit } from '../row-edit-mutations';
import { withRowEdit } from './with-row-edit';
import type { AnyTableFeature, ColumnDef, TableStoreConfig } from '../types';

interface Row {
  id: string;
  name: string;
}

function makeColumns(): ColumnDef<Row>[] {
  return [{ id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'name' }];
}

function makeRows(): Row[] {
  return [
    { id: 'r1', name: 'Ada' },
    { id: 'r2', name: 'Bea' },
  ];
}

// Mirrors `with-expansion.spec.ts`.
function makeStore<const F extends readonly AnyTableFeature[]>(
  cfg: () => TableStoreConfig<Row, F>,
  rows: Row[] = []
) {
  return TestBed.runInInjectionContext(() => createTable(signal<Row[]>(rows), cfg));
}

describe('withRowEdit', () => {
  it('editing starts empty', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withRowEdit<Row>()],
    }), makeRows());

    expect(store.editing().size).toBe(0);
  });

  it('default (single) mode: a second beginEdit closes whatever row was already open', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withRowEdit<Row>()],
    }), makeRows());

    store.editing.update(beginEdit('r1'));
    expect(store.editing().has('r1')).toBe(true);

    store.editing.update(beginEdit('r2'));
    expect(store.editing().has('r1')).toBe(false);
    expect(store.editing().has('r2')).toBe(true);
    expect(store.editing().size).toBe(1);
  });

  it('{ multiple: true } accumulates open rows instead of closing the previous one', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withRowEdit<Row>({ multiple: true })],
    }), makeRows());

    store.editing.update(beginEdit('r1'));
    store.editing.update(beginEdit('r2'));

    expect(store.editing().has('r1')).toBe(true);
    expect(store.editing().has('r2')).toBe(true);
    expect(store.editing().size).toBe(2);
  });

  it('claims no renderRows slot — renderRows() stays the default 1:1 mapping', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withRowEdit<Row>()],
    }), makeRows());

    expect(store.renderRows().map((row) => row.id)).toEqual(['r1', 'r2']);
  });
});
