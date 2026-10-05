import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import { removeRow } from '../../mutations/row-mutations';
import { beginEdit, clearEdit, createRow, endEdit } from '../../mutations/row-edit-mutations';
import {
  captureEdit,
  releaseEdit,
  removeEdit,
  revertEdit,
} from '../../mutations/optimistic-mutations';
import { noData } from '../../table.mock';
import { createColumns } from '../create-columns';
import { createTable } from '../create-table';
import type { ColumnDecl, ColumnSet, TableStore } from '../types';
import { withComputed } from './with-computed';
import type { OptimisticMembers } from './with-optimistic';
import { withRowEdit, type RowEditMembers } from './with-row-edit';

interface Row {
  id: string;
  name: string;
}

// Widened `TId` (plain `string`) — no `path.<id>` usage in this file.
function makeColumns(): ColumnSet<Row, readonly ColumnDecl<Row, string, unknown>[]> {
  return createColumns(noData<Row>(), (col) => [col('name')]);
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

describe('withRowEdit', () => {
  it('editing starts empty', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withRowEdit(),
      ),
    );

    expect(store.editing().size).toBe(0);
  });

  it('default (single) mode: a second beginEdit closes whatever row was already open', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withRowEdit(),
      ),
    );

    store.editing.update(beginEdit('r1'));
    expect(store.editing().has('r1')).toBe(true);

    store.editing.update(beginEdit('r2'));
    expect(store.editing().has('r1')).toBe(false);
    expect(store.editing().has('r2')).toBe(true);
    expect(store.editing().size).toBe(1);
  });

  it('{ multiple: true } accumulates open rows instead of closing the previous one', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withRowEdit({ multiple: true }),
      ),
    );

    store.editing.update(beginEdit('r1'));
    store.editing.update(beginEdit('r2'));

    expect(store.editing().has('r1')).toBe(true);
    expect(store.editing().has('r2')).toBe(true);
    expect(store.editing().size).toBe(2);
  });

  it('single-mode switching closes the displaced row as a Save, not a Cancel (D31.2)', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withRowEdit(),
      ),
    );

    store.editing.update(beginEdit('r1'));
    store.editing.update(beginEdit('r2'));

    // Dropped outright: no snapshot is retained for r1, so nothing can revert it, and
    // whatever blur already committed to `data` stands.
    expect(store.editing().has('r1')).toBe(false);
    expect(store.pending().has('r1')).toBe(false);
  });

  it('pending starts empty and receives endEdit entries (D31/D41)', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withRowEdit(),
      ),
    );

    expect(store.pending().size).toBe(0);

    store.editing.update(beginEdit('r1'));
    store.editing.update(endEdit('r1'));

    expect(store.editing().size).toBe(0);
    expect(store.pending().has('r1')).toBe(true);

    store.editing.update(releaseEdit('r1'));

    expect(store.pending().size).toBe(0);
  });

  it('removing an open row from data clears it from editing and pending (ADR-0006)', () => {
    const data = signal(makeRows());
    const store = inContext(() =>
      createTable(data, { trackBy: 'id', columns: makeColumns() }, withRowEdit()),
    );

    store.editing.update(beginEdit('r1'));
    expect(store.editing().has('r1')).toBe(true);

    data.update((rows) => rows.filter((row) => row.id !== 'r1'));
    TestBed.tick();

    expect(store.editing().has('r1')).toBe(false);
    expect(store.pending().has('r1')).toBe(false);
  });

  it('removing a pending (closed, snapshot-kept) row drops its snapshot too (ADR-0006)', () => {
    const data = signal(makeRows());
    const store = inContext(() =>
      createTable(data, { trackBy: 'id', columns: makeColumns() }, withRowEdit()),
    );

    store.editing.update(beginEdit('r1'));
    store.editing.update(endEdit('r1'));
    expect(store.pending().has('r1')).toBe(true);

    data.update((rows) => rows.filter((row) => row.id !== 'r1'));
    TestBed.tick();

    expect(store.pending().has('r1')).toBe(false);
  });

  it('editing prunes when a row leaves data via store.value.update, the second write path (ADR-0006)', () => {
    const data = signal(makeRows());
    const store = inContext(() =>
      createTable(data, { trackBy: 'id', columns: makeColumns() }, withRowEdit()),
    );

    store.editing.update(beginEdit('r1'));
    expect(store.editing().has('r1')).toBe(true);

    store.value.update(removeRow('r1'));
    TestBed.tick();

    expect(store.editing().size).toBe(0);
    expect(store.draft().some((row) => row.id === 'r1')).toBe(false);
  });

  it('removeEdit on a never-opened row survives the ADR-0006 effect, and revertEdit reinserts it (Change 4)', () => {
    const data = signal(makeRows());
    const store = inContext(() =>
      createTable(data, { trackBy: 'id', columns: makeColumns() }, withRowEdit()),
    );

    store.editing.update(removeEdit<Row>('r1'));
    TestBed.tick();

    // Without the `op === 'delete'` exemption, the ADR-0006 reconciliation effect would have pruned
    // this snapshot the instant removeEdit took the row out of `data` — Change 4's regression
    // guard. The ordering is safe (writeData applies synchronously, before the effect flushes)
    // but this is what pins it.
    expect(store.pending().has('r1')).toBe(true);
    expect(data().some((row) => row.id === 'r1')).toBe(false);

    store.editing.update(revertEdit<Row>('r1'));

    expect(data().find((row) => row.id === 'r1')?.name).toBe('Ada');
    expect(store.pending().size).toBe(0);
  });

  it("removeEdit on an already-open row keeps its pre-edit restore point through the effect, and flips op to 'delete' (Change 4)", () => {
    const data = signal(makeRows());
    const store = inContext(() =>
      createTable(data, { trackBy: 'id', columns: makeColumns() }, withRowEdit()),
    );

    store.editing.update(beginEdit('r1'));
    data.update((rows) => rows.map((row) => (row.id === 'r1' ? { ...row, name: 'typed' } : row)));
    TestBed.tick();

    store.editing.update(removeEdit<Row>('r1'));
    TestBed.tick();

    expect(store.editing().has('r1')).toBe(false); // removeEdit clears open
    expect(store.pending().has('r1')).toBe(true);

    store.editing.update(revertEdit<Row>('r1'));

    // The restore point held from `beginEdit` (pre-edit "Ada"), not the externally typed value —
    // removeEdit on an already-open row keeps the true pre-edit snapshot rather than re-capturing.
    expect(data().find((row) => row.id === 'r1')?.name).toBe('Ada');
  });

  // A write through Signal Forms' root value signal (`form(data, schema)` writes back into
  // `data`) is indistinguishable from any other `data.update(...)` — the table has no notion of
  // a call site. These pin the sync contract for the writes ADR-0006 does *not* cover:
  // additions and in-place patches, where nothing is pruned but state must still line up.
  it('a row added externally renders but does not open itself', () => {
    const data = signal(makeRows());
    const store = inContext(() =>
      createTable(data, { trackBy: 'id', columns: makeColumns() }, withRowEdit()),
    );

    data.update((rows) => [...rows, { id: 'r3', name: 'Cid' }]);
    TestBed.tick();

    expect(store.renderRows().map((row) => row.id)).toEqual(['r1', 'r2', 'r3']);
    expect(store.editing().size).toBe(0);
    expect(store.pending().size).toBe(0);
  });

  it('keeps an open row open when rows are inserted before it, and sourceIndex follows', () => {
    const data = signal(makeRows());
    const store = inContext(() =>
      createTable(data, { trackBy: 'id', columns: makeColumns() }, withRowEdit()),
    );

    store.editing.update(beginEdit('r2'));
    expect(store.renderRows().find((row) => row.id === 'r2')?.sourceIndex).toBe(1);

    data.update((rows) => [{ id: 'r0', name: 'Zed' }, ...rows]);
    TestBed.tick();

    // Editing is keyed by trackBy id, so the shift cannot displace it — and `sourceIndex`
    // (what `*ngpTableRowField` indexes the form's field tree with) moves with the row.
    expect(store.editing().has('r2')).toBe(true);
    expect(store.renderRows().find((row) => row.id === 'r2')?.sourceIndex).toBe(2);
  });

  it('does not move an open row restore point when data is patched externally (D34)', () => {
    const data = signal(makeRows());
    const store = inContext(() =>
      createTable(data, { trackBy: 'id', columns: makeColumns() }, withRowEdit()),
    );

    store.editing.update(beginEdit('r1'));
    data.update((rows) => rows.map((row) => (row.id === 'r1' ? { ...row, name: 'Server' } : row)));
    TestBed.tick();

    // Stale by design: the library cannot tell an external write from the user's own typing,
    // so Cancel still returns to the value captured at beginEdit. Moving it is captureEdit's job.
    store.editing.update(revertEdit('r1'));

    expect(data().find((row) => row.id === 'r1')?.name).toBe('Ada');
  });

  it('captureEdit after an external patch makes revertEdit restore the external value (D34/D40)', () => {
    const data = signal(makeRows());
    const store = inContext(() =>
      createTable(data, { trackBy: 'id', columns: makeColumns() }, withRowEdit()),
    );

    store.editing.update(beginEdit('r1'));
    data.update((rows) => rows.map((row) => (row.id === 'r1' ? { ...row, name: 'Server' } : row)));
    TestBed.tick();
    store.editing.update(captureEdit('r1'));

    // The user then types over it, and cancels.
    data.update((rows) => rows.map((row) => (row.id === 'r1' ? { ...row, name: 'Typed' } : row)));
    TestBed.tick();
    store.editing.update(revertEdit('r1'));

    expect(data().find((row) => row.id === 'r1')?.name).toBe('Server');
    expect(store.editing().has('r1')).toBe(false);
  });

  it('mode flip true -> false closes every open row, no survivor, dropping their restore points', () => {
    const isMultiple = signal(true);
    const data = signal(makeRows());
    const store = inContext(() =>
      createTable(
        data,
        { trackBy: 'id', columns: makeColumns() },
        withRowEdit({ multiple: isMultiple }),
      ),
    );

    store.editing.update(beginEdit('r1'));
    store.editing.update(beginEdit('r2'));
    expect(store.editing().size).toBe(2);

    isMultiple.set(false);
    TestBed.tick();

    // Neither survives — a flip is nobody's request to keep one specific row open, unlike
    // `beginEdit`'s on-write single-mode trim (D14).
    expect(store.editing().size).toBe(0);
    // Restore points are dropped along with the close, not left `pending` — a rejected save
    // arriving later would otherwise find nothing to restore (D41).
    expect(store.pending().size).toBe(0);
  });

  it('mode flip leaves a single open row alone — already valid under single mode', () => {
    const isMultiple = signal(true);
    const data = signal(makeRows());
    const store = inContext(() =>
      createTable(
        data,
        { trackBy: 'id', columns: makeColumns() },
        withRowEdit({ multiple: isMultiple }),
      ),
    );

    store.editing.update(beginEdit('r1'));
    isMultiple.set(false);
    TestBed.tick();

    expect(store.editing().has('r1')).toBe(true);
  });

  it('claims no render stage — renderRows() stays the default 1:1 mapping', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withRowEdit(),
      ),
    );

    expect(store.renderRows().map((row) => row.id)).toEqual(['r1', 'r2']);
  });

  it('exposes pendingOps and unconfirmed — same member set withOptimistic declares (D54/R2)', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withRowEdit(),
      ),
    );

    const optimisticKeys: (keyof OptimisticMembers<Row>)[] = [
      'editing',
      'pending',
      'pendingOps',
      'unconfirmed',
    ];
    for (const key of optimisticKeys) {
      expect(typeof store[key]).toBe('function');
    }
    expect(store.pendingOps().size).toBe(0);
    expect(store.unconfirmed().size).toBe(0);
  });

  it('createRow marks the id unconfirmed; releaseEdit clears it once confirmed', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withRowEdit(),
      ),
    );

    store.editing.update(createRow<Row>('r3', { id: 'r3', name: 'Cid' }));
    expect(store.unconfirmed().has('r3')).toBe(true);

    store.editing.update(endEdit<Row>('r3'));
    store.editing.update(releaseEdit<Row>('r3'));

    expect(store.unconfirmed().has('r3')).toBe(false);
  });

  it(
    'removeEdit on an unconfirmed create survives the ADR-0006 prune, and revertEdit ' +
      'preserves unconfirmed for retry (D54/R1)',
    () => {
      const data = signal(makeRows());
      const store = inContext(() =>
        createTable(data, { trackBy: 'id', columns: makeColumns() }, withRowEdit()),
      );

      store.editing.update(createRow<Row>('r3', { id: 'r3', name: 'Cid' }));
      expect(store.unconfirmed().has('r3')).toBe(true);

      store.editing.update(removeEdit<Row>('r3'));
      TestBed.tick(); // flushes ADR-0006 — must not prune the delete-pending snapshot or unconfirmed

      expect(store.unconfirmed().has('r3')).toBe(true);
      expect(store.pending().has('r3')).toBe(true);

      store.editing.update(revertEdit<Row>('r3'));

      expect(data().some((row) => row.id === 'r3')).toBe(true);
      expect(store.unconfirmed().has('r3')).toBe(true); // still needs a retry POST
      expect(store.pending().has('r3')).toBe(false);
    },
  );

  // -------------------------------------------------------------------------------------
  // Type-level assertions. The vitest executor does NOT typecheck `expectTypeOf` — it is
  // inert at runtime. These are only enforced by `tsc -p libs/table/tsconfig.spec.json
  // --noEmit`, which is the verification step for this describe block.
  // -------------------------------------------------------------------------------------
  describe('types', () => {
    it('withRowEdit() alone: composed members are recovered exactly, never widened to any', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withRowEdit(),
        ),
      );

      expectTypeOf<keyof typeof store>().toEqualTypeOf<
        keyof TableStore<Row> | keyof RowEditMembers<Row>
      >();
      expectTypeOf(store).not.toBeAny();
      expectTypeOf(store.draft).toEqualTypeOf<WritableSignal<Row[]>>();
    });

    it(
      'trailing derive block: withComputed() adds a typed member; draft stays a plain ' +
        'WritableSignal, not a WritableView — the projection leaves it alone (D28 edge)',
      () => {
        const store = inContext(() =>
          createTable(
            signal<Row[]>(makeRows()),
            { trackBy: 'id', columns: makeColumns() },
            withRowEdit(
              { multiple: true },
              withComputed((s) => ({ openCount: computed(() => s.editing().size) })),
            ),
          ),
        );

        expectTypeOf(store.openCount).toEqualTypeOf<Signal<number>>();
        expectTypeOf(store.draft).toEqualTypeOf<WritableSignal<Row[]>>();

        expect(store.openCount()).toBe(0);

        store.editing.update(beginEdit('r1'));
        expect(store.openCount()).toBe(1);

        store.editing.update(beginEdit('r2'));
        expect(store.openCount()).toBe(2);

        store.editing.update(clearEdit());
        expect(store.openCount()).toBe(0);
      },
    );

    it('derive-first: withRowEdit(withComputed(...)) contributes the same member with no config', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withRowEdit(withComputed((s) => ({ hasOpen: computed(() => s.editing().size > 0) }))),
        ),
      );

      expectTypeOf(store.hasOpen).toEqualTypeOf<Signal<boolean>>();
      expectTypeOf(store.draft).toEqualTypeOf<WritableSignal<Row[]>>();

      expect(store.hasOpen()).toBe(false);

      store.editing.update(beginEdit('r1'));
      expect(store.hasOpen()).toBe(true);
    });
  });
});
