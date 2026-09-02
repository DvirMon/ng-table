import { columnSchema } from './column-schema';
import { createColumnMetaKey, metadata, readColumnMeta } from './column-metadata';
import type { ColumnsPath } from './column-schema.types';
import { resolveColumnsConfig } from '../api/features/with-columns-schema';
import type { ColumnDefInput } from '../api/types';

interface Row {
  id: string;
  name: string;
  status: string;
}

function makeColumns(): ColumnDefInput<Row>[] {
  return [{ id: 'name' }, { id: 'status' }];
}

describe('createColumnMetaKey', () => {
  it('mints a distinct key on every call, even for the same T', () => {
    const first = createColumnMetaKey<string>();
    const second = createColumnMetaKey<string>();

    expect(first).not.toBe(second);
    expect(first.kind).toBe('column-meta-key');
  });
});

describe('metadata', () => {
  it('records a MetadataRule for the targeted column', () => {
    const KEY = createColumnMetaKey<string>();
    const schema = columnSchema<Row>((path) => {
      metadata(path.status, KEY, 'admin-only');
    });

    expect(schema.rules).toHaveLength(1);
    expect(schema.rules[0]).toMatchObject({
      kind: 'metadata',
      columnId: 'status',
      key: KEY,
      logic: 'admin-only',
    });
  });

  it('records a reactive closure form unevaluated', () => {
    const KEY = createColumnMetaKey<number>();
    const logic = () => 42;
    const schema = columnSchema<Row>((path) => {
      metadata(path.status, KEY, logic);
    });

    expect(schema.rules[0]).toMatchObject({ kind: 'metadata', logic });
  });

  it('rejects a ColumnHandle stashed and reused after the schema fn returns', () => {
    let stashedPath: ColumnsPath<Row> | undefined;
    columnSchema<Row>((path) => {
      stashedPath = path;
    });

    const KEY = createColumnMetaKey<string>();
    expect(() => {
      metadata((stashedPath as ColumnsPath<Row>).status, KEY, 'x');
    }).toThrow(/outside its schema function/);
  });
});

describe('readColumnMeta', () => {
  it('returns undefined when the column has no meta bag', () => {
    const KEY = createColumnMetaKey<string>();
    expect(readColumnMeta({ meta: undefined } as never, KEY)).toBeUndefined();
  });

  it('returns undefined for a key never registered on the column', () => {
    const KEY = createColumnMetaKey<string>();
    const other = createColumnMetaKey<string>();
    const column = { meta: new Map([[other, 'value']]) } as never;
    expect(readColumnMeta(column, KEY)).toBeUndefined();
  });

  it('returns the registered value for a matching key', () => {
    const KEY = createColumnMetaKey<string>();
    const column = { meta: new Map([[KEY, 'value']]) } as never;
    expect(readColumnMeta(column, KEY)).toBe('value');
  });
});

describe('resolveColumnsConfig — duplicate metadata registration', () => {
  it('throws when the same (column, key) pair is registered twice', () => {
    const columns = makeColumns();
    const KEY = createColumnMetaKey<string>();

    expect(() =>
      resolveColumnsConfig<Row>(columns, (path) => {
        metadata(path.status, KEY, 'a');
        metadata(path.status, KEY, 'b');
      })
    ).toThrow(/Duplicate metadata\(\) registration/);
  });

  it('allows the same key on two different columns', () => {
    const columns = makeColumns();
    const KEY = createColumnMetaKey<string>();

    const resolved = resolveColumnsConfig<Row>(columns, (path) => {
      metadata(path.status, KEY, 'a');
      metadata(path.name, KEY, 'b');
    });

    expect(resolved.rules).toHaveLength(2);
  });

  it('allows two different keys on the same column', () => {
    const columns = makeColumns();
    const keyA = createColumnMetaKey<string>();
    const keyB = createColumnMetaKey<string>();

    const resolved = resolveColumnsConfig<Row>(columns, (path) => {
      metadata(path.status, keyA, 'a');
      metadata(path.status, keyB, 'b');
    });

    expect(resolved.rules).toHaveLength(2);
  });
});
