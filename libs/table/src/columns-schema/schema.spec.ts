import { columnSchema } from './schema';
import { applyVisible, applyVisibleAsync } from './rules';
import type { ColumnHandle, ColumnsPath } from './types';
import type { ColumnDefInput } from '../api/types';
import { resolveColumnsConfig } from '../engine/columns-schema';

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

describe('columnSchema', () => {
  it('records an applyVisible rule for the targeted column', () => {
    const schema = columnSchema<Row, MockColumnId>((path) => {
      applyVisible(path.status, { when: () => false });
    });

    expect(schema.kind).toBe('column-schema');
    expect(schema.rules).toHaveLength(1);
    expect(schema.rules[0]).toMatchObject({
      kind: 'metadata',
      columnId: 'status',
    });
  });

  it('records multiple rules across different columns in call order', () => {
    const schema = columnSchema<Row, MockColumnId>((path) => {
      applyVisible(path.status, { when: () => true });
      applyVisible(path.name, { when: () => false });
    });

    expect(schema.rules.map((rule) => rule.columnId)).toEqual([
      'status',
      'name',
    ]);
  });

  it('records an applyVisibleAsync rule', () => {
    const schema = columnSchema<Row, MockColumnId>((path) => {
      applyVisibleAsync(path.status, {
        params: () => 'role',
        factory: () =>
          ({
            value: () => undefined,
            status: () => 'idle',
            error: () => undefined,
          }) as never,
        onSuccess: () => true,
        onError: () => false,
      });
    });

    expect(schema.rules[0]).toMatchObject({
      kind: 'metadata-async',
      columnId: 'status',
    });
  });

  it('assertPathIsCurrent rejects a ColumnHandle stashed and reused after the schema fn returns', () => {
    let stashedPath: ColumnsPath<Row, MockColumnId> | undefined;
    columnSchema<Row, MockColumnId>((path) => {
      stashedPath = path;
    });

    expect(stashedPath).toBeDefined();
    expect(() => {
      applyVisible((stashedPath as ColumnsPath<Row, MockColumnId>).status, {
        when: () => true,
      });
    }).toThrow(/outside its schema function/);
  });

  it('produces a fresh, independent recorder session per call', () => {
    let firstHandle: ColumnHandle<Row> | undefined;
    columnSchema<Row, MockColumnId>((path) => {
      firstHandle = path.name;
    });

    const second = columnSchema<Row, MockColumnId>((path) => {
      applyVisible(path.status, { when: () => true });
    });

    expect(() =>
      applyVisible(firstHandle as ColumnHandle<Row>, { when: () => true })
    ).toThrow();
    expect(second.rules).toHaveLength(1);
  });
});

describe('resolveColumnsConfig', () => {
  it('passes columns through unchanged and returns an empty rule list when no schema is given', () => {
    const columns = makeColumns();

    const resolved = resolveColumnsConfig(columns);

    expect(resolved.columns).toBe(columns);
    expect(resolved.rules).toEqual([]);
  });

  it('normalizes an inline schema fn through the same recorder path as columnSchema()', () => {
    const columns = makeColumns();

    const resolved = resolveColumnsConfig(columns, (path) => {
      applyVisible(path.status, { when: () => false });
    });

    expect(resolved.rules).toHaveLength(1);
    expect(resolved.rules[0]).toMatchObject({ columnId: 'status' });
  });

  it('accepts a standalone columnSchema() value directly', () => {
    const columns = makeColumns();
    const schema = columnSchema<Row, MockColumnId>((path) => {
      applyVisible(path.name, { when: () => true });
    });

    const resolved = resolveColumnsConfig(columns, schema);

    expect(resolved.rules).toBe(schema.rules);
  });

  it('throws for an unknown columnId recorded via a real path handle', () => {
    interface WithExtra extends Row {
      extra: string;
    }
    const columns = makeColumns() as unknown as ColumnDefInput<
      WithExtra,
      'name' | 'status' | 'extra'
    >[];

    expect(() =>
      resolveColumnsConfig<WithExtra, 'name' | 'status' | 'extra'>(columns, (path) => {
        applyVisible(path.extra, { when: () => true });
      })
    ).toThrow(/Unknown column id "extra"/);
  });
});
