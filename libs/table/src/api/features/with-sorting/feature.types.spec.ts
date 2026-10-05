import { describe, expectTypeOf, it } from 'vitest';
import { createColumns } from '../../create-columns';
import { createTable } from '../../create-table';
import { withSorting } from './feature';
import { sortable, sortFn, sortingSchema } from './schema';
import type { SortingHandle, SortingPath } from './types';
import type { ColumnDef, ColumnValues, TableDataInput } from '../../types';

/**
 * Compile-time half of N9 (#100, #125's edge on it) — `SortingPath` keys by the declared
 * column-id union, so a typo in `sortFn`/`sortable`/`sortNulls` is a compile error, not a
 * construction throw; `sortingSchema()` exists only for its types, and has no reason to exist
 * if it doesn't actually infer the handle. **`nx run shared-table:typecheck-spec` is what
 * enforces this file** — the runner executes `expectTypeOf` and `@ts-expect-error` without
 * typechecking either.
 *
 * Every schema below annotates its `path` parameter explicitly as `SortingPath<Row,
 * RowValues>`, the same mitigation `with-filtering/feature.types.spec.ts`'s header documents:
 * an unannotated `path` inside `withSorting({ schema })` still compiles, but resolves `TValues`
 * to the fallback `ColumnValueMap` (`keyof Record<string, unknown> & string` = `string`)
 * before the surrounding `createTable()` call supplies `In` — which would make `path.nope`
 * compile too, silently defeating assertion 1 below.
 */

/** Typechecks its argument and never calls it — every body here throws at construction. */
function typecheckOnly(assertions: () => void): void {
  void assertions;
}

interface Row {
  id: number;
  name: string;
  total: number;
  dueDate: Date | null;
}

// A real function, not `declare const` — `createColumns()` never reads it at runtime
// (`void data`, create-columns.ts), only its type binds `TRow`.
const rowData = (): readonly Row[] | undefined => undefined;

// Hoisted to a module-level const, deliberately — same reasoning as
// `with-grouping/feature.types.spec.ts`'s `columns`. No accessor needed: each id is a keyof
// Row, so the defaulted arm resolves the field type directly.
const columns = createColumns(rowData, (col) => [
  col('id'),
  col('name'),
  col('total'),
  col('dueDate'),
]);

/** `SortingPath<Row, ...>`'s explicit `TValues` — every case below. */
type RowValues = ColumnValues<Row, typeof columns.columns>;

declare const data: TableDataInput<Row>;

describe("withSorting's schema path is keyed by declared column id (#100, #125)", () => {
  it('a declared id (path.name) is accepted', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns },
        withSorting({
          schema: (path: SortingPath<Row, RowValues>) => {
            sortFn(path.name, (a, b) => a.name.localeCompare(b.name));
          },
        }),
      );

      // Guards against a later `@ts-expect-error` in this file being satisfied by an unrelated
      // error instead — the surrounding call must still resolve to the expected store shape.
      expectTypeOf(table.toggleSort).toEqualTypeOf<(columnId: string) => void>();
    });
  });

  it('an id never declared in columns is rejected', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns },
        withSorting({
          schema: (path: SortingPath<Row, RowValues>) => {
            // @ts-expect-error — 'nope' was never declared in columns.
            sortFn(path.nope, (a, b) => a.total - b.total);
          },
        }),
      );

      expectTypeOf(table.toggleSort).toEqualTypeOf<(columnId: string) => void>();
    });
  });
});

describe("path.total resolves to SortingHandle<Row, 'total', number> (#125's edge on #100)", () => {
  it('the column value map reaches the handle', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns },
        withSorting({
          schema: (path: SortingPath<Row, RowValues>) => {
            expectTypeOf(path.total).toEqualTypeOf<SortingHandle<Row, 'total', number>>();
          },
        }),
      );

      expectTypeOf(table.toggleSort).toEqualTypeOf<(columnId: string) => void>();
    });
  });
});

describe('sortingSchema — col is inferred with no annotation (Step 1)', () => {
  it('the resulting function compiles on both a numeric handle and a nullable-Date handle', () => {
    typecheckOnly(() => {
      // `col` needs no annotation — `sortingSchema<Row>` alone is enough to type it as
      // `SortingHandle<Row>` (K defaults to `string`, V to `unknown`).
      const highlightSortable = sortingSchema<Row>((col) => {
        sortable(col, { enable: () => true });
      });

      const table = createTable(
        data,
        { trackBy: 'id', columns },
        withSorting({
          schema: (path: SortingPath<Row, RowValues>) => {
            // `SortingHandle<Row, 'total', number>` widens to `SortingHandle<Row, string,
            // unknown>` — no generic-in-K helper needed for either call to compile (the
            // "simplest signature" Step 1 bet on).
            highlightSortable(path.total);
            highlightSortable(path.dueDate);
          },
        }),
      );

      expectTypeOf(table.toggleSort).toEqualTypeOf<(columnId: string) => void>();
    });
  });
});

describe("sortFn's comparator parameters are Row, not unknown", () => {
  it('a and b are typed Row inside the comparator', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns },
        withSorting({
          schema: (path: SortingPath<Row, RowValues>) => {
            sortFn(path.total, (a, b) => {
              expectTypeOf(a).toEqualTypeOf<Row>();
              expectTypeOf(b).toEqualTypeOf<Row>();
              return a.total - b.total;
            });
          },
        }),
      );

      expectTypeOf(table.toggleSort).toEqualTypeOf<(columnId: string) => void>();
    });
  });
});

describe('sortable — the key is `enable`, not `when` (ADR-0018)', () => {
  it('{ when } is rejected', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns },
        withSorting({
          schema: (path: SortingPath<Row, RowValues>) => {
            sortable(path.total, {
              // @ts-expect-error — the key is `enable`, not `when`; `when` doesn't exist on
              // `SortableOpts` and `enable` is missing.
              when: () => true,
            });
          },
        }),
      );

      expectTypeOf(table.toggleSort).toEqualTypeOf<(columnId: string) => void>();
    });
  });
});

describe('ColumnDef carries no sortFn / enableSorting key', () => {
  it('keyof ColumnDef does not extend "sortFn" | "enableSorting"', () => {
    typecheckOnly(() => {
      expectTypeOf<keyof ColumnDef>().not.toExtend<'sortFn' | 'enableSorting'>();
    });
  });

  it('col() rejects sortFn and enableSorting in its opts', () => {
    typecheckOnly(() => {
      createColumns(rowData, (col) => [
        col('total', {
          // @ts-expect-error — `sortFn` is not a column option; sorting behavior is declared
          // through `withSorting()`'s schema, not on the column itself.
          sortFn: (a: Row, b: Row) => a.total - b.total,
        }),
        // @ts-expect-error — `enableSorting` is not a column option either; sortability is
        // declared through `sortable()` in `withSorting()`'s schema.
        col('id', { enableSorting: false }),
      ]);
    });
  });
});
