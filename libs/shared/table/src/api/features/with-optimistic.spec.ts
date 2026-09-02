import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createTable } from '../create-table';
import { captureEdit, releaseEdit, revertEdit } from '../../mutations/optimistic-mutations';
import { patchRow } from '../../mutations/row-mutations';
import { withOptimistic } from './with-optimistic';
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

// Mirrors `with-row-edit.spec.ts`.
function makeStore<const F extends readonly AnyTableFeature[]>(
  cfg: () => TableStoreConfig<Row, F>,
  rows: Row[] = []
) {
  return TestBed.runInInjectionContext(() => createTable(signal<Row[]>(rows), cfg));
}

function optimisticStore(rows: Row[] = makeRows()) {
  return makeStore(
    () => ({ trackBy: 'id', columns: makeColumns(), features: [withOptimistic<Row>()] }),
    rows
  );
}

describe('withOptimistic', () => {
  it('exposes editing and pending, both empty at construction', () => {
    const store = optimisticStore();

    expect(store.editing().size).toBe(0);
    expect(store.pending().size).toBe(0);
  });

  it('never opens a row — editing stays empty even after a capture (D39)', () => {
    const store = optimisticStore();

    store.editing.update(captureEdit<Row>('r1'));

    expect(store.editing().size).toBe(0);
  });

  it('every held restore point is pending, since nothing is ever open (D39)', () => {
    const store = optimisticStore();

    store.editing.update(captureEdit<Row>('r1'));
    store.editing.update(captureEdit<Row>('r2'));

    expect(store.pending().has('r1')).toBe(true);
    expect(store.pending().has('r2')).toBe(true);
  });

  it('the live round trip: capture on focus, write on blur, revert on rejection', () => {
    const store = optimisticStore();

    store.editing.update(captureEdit<Row>('r1'));
    store.value.update(patchRow<Row>('r1', { name: 'typed' }));
    expect(store.value().find((row) => row.id === 'r1')?.name).toBe('typed');

    store.editing.update(revertEdit<Row>('r1'));

    expect(store.value().find((row) => row.id === 'r1')?.name).toBe('Ada');
    expect(store.pending().size).toBe(0);
  });

  it('releaseEdit leaves the written value in place', () => {
    const store = optimisticStore();

    store.editing.update(captureEdit<Row>('r1'));
    store.value.update(patchRow<Row>('r1', { name: 'typed' }));
    store.editing.update(releaseEdit<Row>('r1'));

    expect(store.value().find((row) => row.id === 'r1')?.name).toBe('typed');
    expect(store.pending().size).toBe(0);
  });

  it('a second capture overwrites the restore point, so revert lands on the newer value', () => {
    const store = optimisticStore();

    store.editing.update(captureEdit<Row>('r1'));
    store.value.update(patchRow<Row>('r1', { name: 'external' }));
    store.editing.update(captureEdit<Row>('r1'));
    store.value.update(patchRow<Row>('r1', { name: 'typed' }));

    store.editing.update(revertEdit<Row>('r1'));

    expect(store.value().find((row) => row.id === 'r1')?.name).toBe('external');
  });

  it('prunes a removed rows restore point (ADR-0006)', () => {
    const data = signal<Row[]>(makeRows());
    const store = TestBed.runInInjectionContext(() =>
      createTable(data, () => ({
        trackBy: 'id' as const,
        columns: makeColumns(),
        features: [withOptimistic<Row>()],
      }))
    );

    store.editing.update(captureEdit<Row>('r1'));
    expect(store.pending().has('r1')).toBe(true);

    data.update((rows) => rows.filter((row) => row.id !== 'r1'));
    TestBed.tick();

    expect(store.pending().has('r1')).toBe(false);
  });
});

describe('withOptimistic + withRowEdit composed together', () => {
  it('throws — withRowEdit already composes the optimistic slice (ADR-0007/D37)', () => {
    expect(() =>
      makeStore(
        () => ({
          trackBy: 'id',
          columns: makeColumns(),
          features: [withOptimistic<Row>(), withRowEdit<Row>()],
        }),
        makeRows()
      )
    ).toThrow(/both provide the "editing" store member/);
  });
});
