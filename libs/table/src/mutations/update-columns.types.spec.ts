import { describe, it } from 'vitest';
import { createColumns } from '../api/create-columns';
import { createTable } from '../api/create-table';
import type { TableDataInput } from '../api/types';
import { noData } from '../table.mock';
import { setColumns } from './update-columns';

/**
 * Compile-time seam for `setColumns()`'s narrowed input (#140): `order` and `meta` are rejected,
 * an unknown or mistyped id is a compile error, and a shorter list still typechecks.
 * **`nx run shared-table:typecheck-spec` is what enforces this file** — `nx test` executes
 * `@ts-expect-error` without typechecking it, so a green run proves nothing about it.
 */

/** Typechecks its argument and never calls it — every body here throws at construction. */
function typecheckOnly(assertions: () => void): void {
  void assertions;
}

interface Row {
  id: string;
  name: string;
  status: string;
}

declare const data: TableDataInput<Row>;

// No return annotation on purpose: case 3 needs the literal id union inferred from `col()`.
function makeColumns() {
  return createColumns(noData<Row>(), (col) => [col('id'), col('name'), col('status')]);
}

describe('setColumns — case 1: order is rejected', () => {
  it('rejects order at the call site', () => {
    typecheckOnly(() => {
      const table = createTable(data, { trackBy: 'id', columns: makeColumns() });

      table.columns.update(
        // @ts-expect-error — order is not writable through setColumns; it derives from array
        // position only
        setColumns([{ id: 'name', order: 0 }]),
      );
    });
  });
});

describe('setColumns — case 2: meta is rejected', () => {
  it('rejects meta at the call site', () => {
    typecheckOnly(() => {
      const table = createTable(data, { trackBy: 'id', columns: makeColumns() });

      table.columns.update(
        // @ts-expect-error — meta is not writable through setColumns; use metadata() instead
        setColumns([{ id: 'name', meta: new Map() }]),
      );
    });
  });
});

describe('setColumns — case 3: an unknown id is rejected', () => {
  it('rejects an id never declared in columns', () => {
    typecheckOnly(() => {
      const table = createTable(data, { trackBy: 'id', columns: makeColumns() });

      table.columns.update(
        // @ts-expect-error — 'nam' was never declared as a column id
        setColumns([{ id: 'nam' }]),
      );
    });
  });
});

describe('setColumns — case 4: a shorter list still typechecks', () => {
  it('accepts a subset of the declared ids', () => {
    typecheckOnly(() => {
      const table = createTable(data, { trackBy: 'id', columns: makeColumns() });

      // Positive case, beside the rejections above: dropping 'status' entirely is legal —
      // setColumns() cannot invent a column, but it can omit one.
      table.columns.update(setColumns([{ id: 'id' }, { id: 'name' }]));
    });
  });
});

describe('setColumns — case 5: accessor/visible/label are accepted', () => {
  it('accepts an edit through the narrowed shape', () => {
    typecheckOnly(() => {
      const table = createTable(data, { trackBy: 'id', columns: makeColumns() });

      table.columns.update(
        setColumns([
          { id: 'id' },
          {
            id: 'name',
            label: 'Full name',
            visible: false,
            accessor: (row) => row.name,
          },
        ]),
      );
    });
  });
});
