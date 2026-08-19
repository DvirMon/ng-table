import { signal, type WritableSignal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { resolveColumnDefs } from '../engine/columns';
import type { MockRow } from '../table.mock';
import {
  reorderColumns,
  setColumns,
  toggleColumnVisibility,
  updateColumns,
} from './update-columns';
import type { ColumnDef } from './types';

/** Minimal fake satisfying `{ baseColumns: WritableSignal<ColumnDef<TRow>[]> }` — no full store. */
function fakeTable(
  columns: ColumnDef<MockRow>[]
): { baseColumns: WritableSignal<ColumnDef<MockRow>[]> } {
  return { baseColumns: signal(columns) };
}

describe('updateColumns', () => {
  it('applies the given updater to the columns signal', () => {
    const columns = resolveColumnDefs<MockRow>([{ id: 'id' }, { id: 'name' }]);
    const table = fakeTable(columns);

    updateColumns(table, (cols) => cols.filter((column) => column.id === 'id'));

    expect(table.baseColumns().map((column) => column.id)).toEqual(['id']);
  });
});

describe('setColumns', () => {
  it('replaces the full column list, ignoring the previous one', () => {
    const table = fakeTable(resolveColumnDefs<MockRow>([{ id: 'id' }, { id: 'name' }]));

    updateColumns(table, setColumns<MockRow>([{ id: 'name' }]));

    expect(table.baseColumns().map((column) => column.id)).toEqual(['name']);
  });

  it('resolves sparse ColumnDefInputs to full ColumnDefs (mirrors engine/columns.spec.ts)', () => {
    const table = fakeTable([]);

    updateColumns(table, setColumns<MockRow>([{ id: 'name' }]));

    const [column] = table.baseColumns();
    expect(column.visible).toBe(true);
    expect(column.order).toBe(0);
    expect(column.label).toBe('name');
    expect(column.accessor({ id: 1, name: 'Ann' })).toBe('Ann');
  });
});

describe('reorderColumns', () => {
  it('re-assigns order per the given id sequence', () => {
    const table = fakeTable(resolveColumnDefs<MockRow>([{ id: 'id' }, { id: 'name' }]));

    updateColumns(table, reorderColumns<MockRow>(['name', 'id']));

    expect(table.baseColumns().map((column) => [column.id, column.order])).toEqual([
      ['id', 1],
      ['name', 0],
    ]);
  });

  it('leaves ids absent from the list at their current order', () => {
    const table = fakeTable(resolveColumnDefs<MockRow>([{ id: 'id' }, { id: 'name' }]));

    updateColumns(table, reorderColumns<MockRow>(['name']));

    expect(table.baseColumns().find((column) => column.id === 'id')?.order).toBe(0);
  });
});

describe('toggleColumnVisibility', () => {
  it('flips visible for the named column', () => {
    const table = fakeTable(resolveColumnDefs<MockRow>([{ id: 'id' }, { id: 'name' }]));

    updateColumns(table, toggleColumnVisibility<MockRow>('name'));

    expect(table.baseColumns().find((column) => column.id === 'name')?.visible).toBe(false);
    expect(table.baseColumns().find((column) => column.id === 'id')?.visible).toBe(true);
  });

  it('calling it twice returns to the original value', () => {
    const table = fakeTable(resolveColumnDefs<MockRow>([{ id: 'id' }, { id: 'name' }]));

    updateColumns(table, toggleColumnVisibility<MockRow>('name'));
    updateColumns(table, toggleColumnVisibility<MockRow>('name'));

    expect(table.baseColumns().find((column) => column.id === 'name')?.visible).toBe(true);
  });

  it('is a no-op for an unknown id', () => {
    const columns = resolveColumnDefs<MockRow>([{ id: 'id' }, { id: 'name' }]);
    const table = fakeTable(columns);

    updateColumns(table, toggleColumnVisibility<MockRow>('nope'));

    expect(table.baseColumns()).toEqual(columns);
  });
});
