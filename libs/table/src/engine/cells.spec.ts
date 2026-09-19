import { describe, expect, it, vi } from 'vitest';
import type { ColumnDef } from '../api/types';
import { buildDataCells, buildGroupCells, readAccessor } from './cells';

interface Row {
  id: number;
  name: string;
}

function makeColumn(
  id: string,
  accessor: (row: Row) => unknown
): ColumnDef<Row> {
  return { id, accessor, visible: true, order: 0, label: id };
}

describe('readAccessor', () => {
  it("returns the accessor's value for a well-behaved column", () => {
    const column = makeColumn('name', (row) => row.name);
    const reported = new Set<string>();

    expect(readAccessor(column, { id: 1, name: 'Ada' }, reported)).toBe('Ada');
  });

  it('returns undefined and does not rethrow when the accessor throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const column = makeColumn('name', () => {
        throw new Error('boom');
      });
      const reported = new Set<string>();

      expect(() => readAccessor(column, { id: 1, name: 'Ada' }, reported)).not.toThrow();
      expect(readAccessor(column, { id: 1, name: 'Ada' }, reported)).toBeUndefined();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('reports once per column across many rows sharing one reportedColumns set', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const column = makeColumn('name', () => {
        throw new Error('boom');
      });
      const reported = new Set<string>();

      readAccessor(column, { id: 1, name: 'Ada' }, reported);
      readAccessor(column, { id: 2, name: 'Bea' }, reported);
      readAccessor(column, { id: 3, name: 'Cid' }, reported);

      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('reports once per column when two different columns both throw', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const first = makeColumn('name', () => {
        throw new Error('boom-1');
      });
      const second = makeColumn('age', () => {
        throw new Error('boom-2');
      });
      const reported = new Set<string>();

      readAccessor(first, { id: 1, name: 'Ada' }, reported);
      readAccessor(second, { id: 1, name: 'Ada' }, reported);
      readAccessor(first, { id: 2, name: 'Bea' }, reported);
      readAccessor(second, { id: 2, name: 'Bea' }, reported);

      expect(errorSpy).toHaveBeenCalledTimes(2);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('reports again when given a fresh reportedColumns set — dedup is scoped to the set', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const column = makeColumn('name', () => {
        throw new Error('boom');
      });

      readAccessor(column, { id: 1, name: 'Ada' }, new Set<string>());
      readAccessor(column, { id: 1, name: 'Ada' }, new Set<string>());

      expect(errorSpy).toHaveBeenCalledTimes(2);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe('buildDataCells', () => {
  it('keys by column.id for every column passed, including visible: false ones', () => {
    const columns: ColumnDef<Row>[] = [
      makeColumn('name', (row) => row.name),
      { ...makeColumn('id', (row) => row.id), visible: false },
    ];
    const reported = new Set<string>();

    expect(buildDataCells({ id: 1, name: 'Ada' }, columns, reported)).toEqual({
      name: 'Ada',
      id: 1,
    });
  });

  it("one throwing column leaves every other column's value intact in the same row", () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const columns: ColumnDef<Row>[] = [
        makeColumn('name', (row) => row.name),
        makeColumn('bad', () => {
          throw new Error('boom');
        }),
      ];
      const reported = new Set<string>();

      expect(buildDataCells({ id: 1, name: 'Ada' }, columns, reported)).toEqual({
        name: 'Ada',
        bad: undefined,
      });
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe('buildGroupCells', () => {
  it('copies aggregates', () => {
    expect(buildGroupCells({ amount: 150 })).toEqual({ amount: 150 });
  });

  it('returns {} for undefined', () => {
    expect(buildGroupCells(undefined)).toEqual({});
  });

  it('returns a new object rather than the aggregates reference — mutating one does not reach the other', () => {
    const aggregates: Record<string, unknown> = { amount: 150 };
    const cells = buildGroupCells(aggregates) as Record<string, unknown>;

    expect(cells).not.toBe(aggregates);
    cells['amount'] = 999;
    expect(aggregates['amount']).toBe(150);
  });
});
