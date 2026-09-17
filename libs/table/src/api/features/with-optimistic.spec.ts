import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import { createTable } from '../create-table';
import { captureEdit, releaseEdit, revertEdit } from '../../mutations/optimistic-mutations';
import { patchRow, removeRow } from '../../mutations/row-mutations';
import type { WritableView } from '../../engine/writable-view';
import type { ColumnDef, RowId, TableStore } from '../types';
import type { EditingUpdater } from './editing-state';
import { withComputed } from './with-computed';
import { withOptimistic, type OptimisticMembers } from './with-optimistic';
import { withRowEdit } from './with-row-edit';

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

/** Runs `build` inside an Angular injection context — `createTable()` requires one unless
 *  `config.injector` is passed. */
function inContext<T>(build: () => T): T {
  return TestBed.runInInjectionContext(build);
}

function optimisticStore(rows: Row[] = makeRows()) {
  return inContext(() =>
    createTable(signal<Row[]>(rows), { trackBy: 'id', columns: makeColumns() }, withOptimistic())
  );
}

describe('withOptimistic', () => {
  it('exposes editing and pending, both empty at construction', () => {
    const store = optimisticStore();

    expect(store.editing().size).toBe(0);
    expect(store.pending().size).toBe(0);
  });

  it('exposes pendingOps and unconfirmed, both empty at construction (D54)', () => {
    const store = optimisticStore();

    expect(store.pendingOps().size).toBe(0);
    expect(store.unconfirmed().size).toBe(0);
  });

  it('pendingOps pairs a pending id with the op that armed it', () => {
    const store = optimisticStore();

    store.editing.update(captureEdit<Row>('r1'));

    expect(store.pendingOps().get('r1')).toBe('update');
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

  it('prunes a removed row\'s restore point via the raw data signal (ADR-0006)', () => {
    const data = signal<Row[]>(makeRows());
    const store = inContext(() =>
      createTable(data, { trackBy: 'id', columns: makeColumns() }, withOptimistic())
    );

    store.editing.update(captureEdit<Row>('r1'));
    expect(store.pending().has('r1')).toBe(true);

    data.update((rows) => rows.filter((row) => row.id !== 'r1'));
    TestBed.tick();

    expect(store.pending().has('r1')).toBe(false);
  });

  it("prunes a removed row's restore point via the store's value WritableView (ADR-0006)", () => {
    const store = optimisticStore();

    store.editing.update(captureEdit<Row>('r1'));
    expect(store.pending().has('r1')).toBe(true);

    store.value.update(removeRow('r1'));
    TestBed.tick();

    expect(store.pending().has('r1')).toBe(false);
  });

  // -------------------------------------------------------------------------------------
  // Type-level assertions. The vitest executor does NOT typecheck `expectTypeOf` — it is
  // inert at runtime. These are only enforced by `tsc -p libs/table/tsconfig.spec.json
  // --noEmit`, which is the verification step for this describe block.
  // -------------------------------------------------------------------------------------
  describe('types', () => {
    it('withOptimistic() alone: composed members are recovered exactly, never widened to any', () => {
      const store = optimisticStore();

      expectTypeOf<keyof typeof store>().toEqualTypeOf<
        keyof TableStore<Row> | keyof OptimisticMembers<Row>
      >();
      expectTypeOf(store).not.toBeAny();
      expectTypeOf(store.editing).toEqualTypeOf<
        WritableView<ReadonlySet<RowId>, EditingUpdater<Row>>
      >();
    });

    it('withComputed() as a trailing derive block adds inFlight, derived from pending', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withOptimistic(
            withComputed((s) => {
              expectTypeOf(s.editing).toEqualTypeOf<Signal<ReadonlySet<RowId>>>();
              return { inFlight: computed(() => s.pending().size) };
            })
          )
        )
      );

      expectTypeOf(store.inFlight).toEqualTypeOf<Signal<number>>();

      expect(store.inFlight()).toBe(0);

      store.editing.update(captureEdit<Row>('r1'));
      expect(store.inFlight()).toBe(1);

      store.editing.update(releaseEdit<Row>('r1'));
      expect(store.inFlight()).toBe(0);
    });
  });
});

describe('withOptimistic + withRowEdit composed together', () => {
  it('throws — withRowEdit already composes the optimistic slice (ADR-0007/D37)', () => {
    expect(() =>
      inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withOptimistic(),
          withRowEdit()
        )
      )
    ).toThrow(/both provide the "editing" store member/);
  });

  it('names both features in the collision message: feature 1 (withOptimistic), feature 2 (withRowEdit)', () => {
    expect(() =>
      inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withOptimistic(),
          withRowEdit()
        )
      )
    ).toThrow('feature 1 (withOptimistic) and feature 2 (withRowEdit)');
  });

  it('throws in the reverse order too — withRowEdit first, withOptimistic second', () => {
    expect(() =>
      inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withRowEdit(),
          withOptimistic()
        )
      )
    ).toThrow(/both provide the "editing" store member/);
  });
});
