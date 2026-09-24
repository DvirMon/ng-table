import { createColumns } from './create-columns';
import { columnSchema } from '../columns-schema/schema';
import { createColumnMetaKey, metadata } from '../columns-schema/metadata';
import type { ColumnsSchemaFn } from '../columns-schema/types';

interface Row {
  id: string;
  name: string;
  amount: number;
}

const mockRows: Row[] = [
  { id: '1', name: 'Alice', amount: 10 },
  { id: '2', name: 'Bob', amount: 20 },
];

describe('createColumns', () => {
  it('returns exactly the keys columns and rules — no data reference, no kind', () => {
    const result = createColumns(
      vi.fn(() => mockRows),
      (col) => [col('id'), col('name')]
    );

    expect(Object.keys(result).sort()).toEqual(['columns', 'rules']);
  });

  it('preserves declaration order in columns', () => {
    const result = createColumns(
      vi.fn(() => mockRows),
      (col) => [col('amount'), col('name'), col('id')]
    );

    expect(result.columns.map((c) => c.id)).toEqual(['amount', 'name', 'id']);
  });

  it('never calls data — even when the witness returns rows', () => {
    const data = vi.fn(() => mockRows);

    createColumns(data, (col) => [col('id')]);

    expect(data).not.toHaveBeenCalled();
  });

  it('never calls data and still builds the set when the witness returns undefined (resource pre-load case)', () => {
    const data = vi.fn((): readonly Row[] | undefined => undefined);

    const result = createColumns(data, (col) => [col('id'), col('name')]);

    expect(data).not.toHaveBeenCalled();
    expect(result.columns).toHaveLength(2);
  });

  it('col(id) yields a declaration with no accessor key — the engine owns the default', () => {
    const result = createColumns(
      vi.fn(() => mockRows),
      (col) => [col('amount')]
    );

    expect(
      Object.prototype.hasOwnProperty.call(result.columns[0], 'accessor')
    ).toBe(false);
  });

  it('col(id, opts) carries label, visible and accessor', () => {
    const accessor = (row: Row): number => row.amount;

    const result = createColumns(
      vi.fn(() => mockRows),
      (col) => [col('amount', { label: 'Amount', visible: false, accessor })]
    );

    expect(result.columns[0]).toMatchObject({
      label: 'Amount',
      visible: false,
      accessor,
    });
  });

  describe('col.from', () => {
    it('carries the new id and options, keeps the other fields, and leaves decl unchanged', () => {
      const accessor = (row: Row): number => row.amount;

      const result = createColumns(
        vi.fn(() => mockRows),
        (col) => {
          const original = col('amount', { label: 'Amount', accessor });
          const snapshot = { ...original };

          const renamed = col.from(original, { id: 'total', label: 'Total' });

          expect(renamed).toEqual({ id: 'total', label: 'Total', accessor });
          expect(renamed).not.toBe(original);
          expect(original).toEqual(snapshot);

          return [original, renamed];
        }
      );

      expect(result.columns.map((c) => c.id)).toEqual(['amount', 'total']);
    });

    it('keeps the original id when from is called without one', () => {
      createColumns(
        vi.fn(() => mockRows),
        (col) => {
          const original = col('amount', { label: 'Amount' });
          const relabeled = col.from(original, { label: 'Renamed only' });

          expect(relabeled.id).toBe(original.id);

          return [original, relabeled];
        }
      );
    });
  });

  it('createColumns(data, () => []) returns an empty set without throwing', () => {
    let result: unknown;

    expect(() => {
      result = createColumns(
        vi.fn(() => mockRows),
        () => []
      );
    }).not.toThrow();

    expect(result).toEqual({ columns: [], rules: [] });
  });

  describe('schema forms', () => {
    const AMOUNT_FLAG = createColumnMetaKey<string>();
    const schemaBody: ColumnsSchemaFn<Row, 'amount'> = (path) => {
      metadata(path.amount, AMOUNT_FLAG, 'flag');
    };

    it('an inline schema fn and the same body wrapped in columnSchema() produce equal rules', () => {
      const inline = createColumns(
        vi.fn(() => mockRows),
        (col) => [col('amount')],
        schemaBody
      );
      const wrapped = createColumns(
        vi.fn(() => mockRows),
        (col) => [col('amount')],
        columnSchema(schemaBody)
      );

      expect(inline.rules).toEqual(wrapped.rules);
      expect(inline.rules[0]).toMatchObject({ columnId: 'amount' });
    });

    it('produces no rules when schema is omitted', () => {
      const result = createColumns(
        vi.fn(() => mockRows),
        (col) => [col('amount')]
      );

      expect(result.rules).toEqual([]);
    });
  });
});
