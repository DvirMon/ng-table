import { columnSchema } from './schema';
import { createColumnMetaKey, metadata, readColumnMeta } from './metadata';
import type { ColumnsPath } from './types';
import { resolveColumnsConfig } from '../engine/columns-schema';
import type { ColumnDefInput } from '../api/types';

interface Row {
  id: string;
  name: string;
  status: string;
}

// The declared column-id union these specs exercise — not `keyof Row` (ADR-0019).
type MockColumnId = 'name' | 'status';

// No `ColumnDefInput<Row>[]` return annotation — that would widen `id` to `string` and turn
// `ColumnsPath` into an index signature.
function makeColumns() {
  return [{ id: 'name' as const }, { id: 'status' as const }] satisfies ColumnDefInput<Row>[];
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
    const schema = columnSchema<Row, MockColumnId>((path) => {
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
    const schema = columnSchema<Row, MockColumnId>((path) => {
      metadata(path.status, KEY, logic);
    });

    expect(schema.rules[0]).toMatchObject({ kind: 'metadata', logic });
  });

  it('rejects a ColumnHandle stashed and reused after the schema fn returns', () => {
    let stashedPath: ColumnsPath<Row, MockColumnId> | undefined;
    columnSchema<Row, MockColumnId>((path) => {
      stashedPath = path;
    });

    const KEY = createColumnMetaKey<string>();
    expect(() => {
      metadata((stashedPath as ColumnsPath<Row, MockColumnId>).status, KEY, 'x');
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
      resolveColumnsConfig(columns, (path) => {
        metadata(path.status, KEY, 'a');
        metadata(path.status, KEY, 'b');
      })
    ).toThrow(/Duplicate metadata\(\) registration/);
  });

  it('allows the same key on two different columns', () => {
    const columns = makeColumns();
    const KEY = createColumnMetaKey<string>();

    const resolved = resolveColumnsConfig(columns, (path) => {
      metadata(path.status, KEY, 'a');
      metadata(path.name, KEY, 'b');
    });

    expect(resolved.rules).toHaveLength(2);
  });

  it('allows two different keys on the same column', () => {
    const columns = makeColumns();
    const keyA = createColumnMetaKey<string>();
    const keyB = createColumnMetaKey<string>();

    const resolved = resolveColumnsConfig(columns, (path) => {
      metadata(path.status, keyA, 'a');
      metadata(path.status, keyB, 'b');
    });

    expect(resolved.rules).toHaveLength(2);
  });
});
