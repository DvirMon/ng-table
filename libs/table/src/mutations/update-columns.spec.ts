import { describe, expect, it } from 'vitest';
import { resolveColumnDefs } from '../engine/columns';
import type { MockRow } from '../table.mock';
import { reorderColumns, setColumns, toggleColumnVisibility } from './update-columns';
import type { ColumnDef, ColumnsUpdater } from '../api/types';

describe('setColumns', () => {
  it('replaces the full column list, dropping the columns a shorter list omits', () => {
    const columns = resolveColumnDefs<MockRow>([{ id: 'id' }, { id: 'name' }], 'test');

    const result = setColumns<MockRow>([{ id: 'name' }])(columns);

    expect(result.map((column) => column.id)).toEqual(['name']);
  });

  it('resolves a sparse ColumnWrite to a full ColumnDef (mirrors engine/columns.spec.ts)', () => {
    const [column] = setColumns<MockRow>([{ id: 'name' }])([]);

    expect(column.visible).toBe(true);
    expect(column.order).toBe(0);
    expect(column.label).toBe('name');
    expect(column.accessor({ id: 1, name: 'Ann' })).toBe('Ann');
  });

  it('applies an edit to the column with the given id', () => {
    const columns = resolveColumnDefs<MockRow>([{ id: 'id' }, { id: 'name' }], 'test');

    const result = setColumns<MockRow>([
      { id: 'id' },
      { id: 'name', label: 'Full name', visible: false },
    ])(columns);

    const edited = result.find((column) => column.id === 'name');
    expect(edited?.label).toBe('Full name');
    expect(edited?.visible).toBe(false);
  });
});

describe('reorderColumns', () => {
  it('re-assigns order per the given id sequence', () => {
    const columns = resolveColumnDefs<MockRow>([{ id: 'id' }, { id: 'name' }], 'test');

    const result = reorderColumns<MockRow>(['name', 'id'])(columns);

    expect(result.map((column) => [column.id, column.order])).toEqual([
      ['id', 1],
      ['name', 0],
    ]);
  });

  it('leaves ids absent from the list at their current order', () => {
    const columns = resolveColumnDefs<MockRow>([{ id: 'id' }, { id: 'name' }], 'test');

    const result = reorderColumns<MockRow>(['name'])(columns);

    expect(result.find((column) => column.id === 'id')?.order).toBe(0);
  });
});

describe('toggleColumnVisibility', () => {
  it('flips visible for the named column', () => {
    const columns = resolveColumnDefs<MockRow>([{ id: 'id' }, { id: 'name' }], 'test');

    const result = toggleColumnVisibility<MockRow>('name')(columns);

    expect(result.find((column) => column.id === 'name')?.visible).toBe(false);
    expect(result.find((column) => column.id === 'id')?.visible).toBe(true);
  });

  it('calling it twice returns to the original value', () => {
    const columns = resolveColumnDefs<MockRow>([{ id: 'id' }, { id: 'name' }], 'test');
    const applyTwice = (updater: ColumnsUpdater<MockRow>, cols: ColumnDef<MockRow>[]) =>
      updater(updater(cols));

    const result = applyTwice(toggleColumnVisibility<MockRow>('name'), columns);

    expect(result.find((column) => column.id === 'name')?.visible).toBe(true);
  });

  it('is a no-op for an unknown id', () => {
    const columns = resolveColumnDefs<MockRow>([{ id: 'id' }, { id: 'name' }], 'test');

    const result = toggleColumnVisibility<MockRow>('nope')(columns);

    expect(result).toEqual(columns);
  });
});
