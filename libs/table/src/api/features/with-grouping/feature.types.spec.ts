import { describe, expectTypeOf, it } from 'vitest';
import { createColumns } from '../../create-columns';
import { createTable } from '../../create-table';
import { groupKey, grouping } from './schema';
import { withTree } from '../with-tree';
import { withGrouping } from './feature';
import type { WritableView } from '../../../engine/writable-view';
import type { GroupingUpdater, TableDataInput } from '../../types';

/**
 * Compile-time half of Step 7 (#114) — `initial`'s string shorthand, the `key` -> `columnId`
 * rename, a typo in `initial`, and `schema`'s `path` being keyed by declared column id (G68's
 * `groupKey` extractor is `unknown`, at the type level as well as runtime). **`nx run
 * shared-table:typecheck-spec` is what enforces this file** — the runner executes
 * `expectTypeOf` and `@ts-expect-error` without typechecking either.
 *
 * Each case calls `createTable(...)` inline rather than through a shared generic helper — see
 * `with-filtering/feature.types.spec.ts`'s header note for why (a spurious `Actual: unknown`).
 * Does not duplicate #113's widening guard (`create-table.types.spec.ts` already pins that
 * failure mode generically) — this file asserts only grouping's own surface.
 */

/** Typechecks its argument and never calls it — every body here throws at construction. */
function typecheckOnly(assertions: () => void): void {
  void assertions;
}

interface Row {
  id: number;
  region: string;
  category: string;
  amount: number;
}

// A real function, not `declare const` — `createColumns()` never reads it at runtime
// (`void data`, create-columns.ts), only its type binds `TRow`.
const rowData = (): readonly Row[] | undefined => undefined;

// Hoisted to a module-level const, deliberately — same reasoning as
// `create-columns.types.spec.ts`'s `dealColumns`: reading a literal id off a variable only stays
// literal when the variable itself was never widened. No accessor needed on any column — each
// id is a keyof Row, so the defaulted arm resolves the same field type the old `accessor: (row)
// => row.<id>` calls resolved explicitly.
const columns = createColumns(rowData, (col) => [
  col('region'),
  col('category'),
  col('amount'),
]);

declare const data: TableDataInput<Row>;

describe("initial's string shorthand still compiles (AC #7)", () => {
  it('a bare declared column id compiles', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns },
        withGrouping({ initial: ['region', 'category'] })
      );

      expectTypeOf(table.grouping).toEqualTypeOf<WritableView<string[], GroupingUpdater<Row>>>();
    });
  });
});

describe("initial's object form uses columnId — the key -> columnId rename", () => {
  it('{ columnId, label } compiles', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns },
        withGrouping({ initial: [{ columnId: 'region', label: 'Sales Region' }] })
      );

      expectTypeOf(table.grouping).toEqualTypeOf<WritableView<string[], GroupingUpdater<Row>>>();
    });
  });

  it('{ key } is rejected — the old property name is gone', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns },
        withGrouping({
          // @ts-expect-error — `key` was renamed to `columnId`; the old property is gone.
          initial: [{ key: 'region' }],
        })
      );

      // Guards against `@ts-expect-error` above being satisfied by an unrelated error instead —
      // the surrounding call must still resolve to the expected store type.
      expectTypeOf(table.grouping).toEqualTypeOf<WritableView<string[], GroupingUpdater<Row>>>();
    });
  });
});

describe('initial — a typo is rejected', () => {
  it('an id never declared in columns is a compile error', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns },
        withGrouping({
          // @ts-expect-error — 'regionn' was never declared in columns.
          initial: ['regionn'],
        })
      );

      expectTypeOf(table.grouping).toEqualTypeOf<WritableView<string[], GroupingUpdater<Row>>>();
    });
  });
});

describe("schema's path is keyed by declared column id; groupKey's extractor is unknown (G68)", () => {
  it('path.<declaredId> autocompletes, a typo is rejected, and the extractor parameter is unknown', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns },
        withGrouping({
          initial: ['region'],
          schema: (path) => {
            grouping(path.region, { enable: () => true });

            groupKey(path.region, (value) => {
              expectTypeOf(value).toEqualTypeOf<unknown>();
              return String(value);
            });

            // @ts-expect-error — 'regionn' was never declared in columns.
            grouping(path.regionn, { enable: () => true });
          },
        })
      );

      // Guards against `@ts-expect-error` above being satisfied by an unrelated error instead.
      expectTypeOf(table.grouping).toEqualTypeOf<WritableView<string[], GroupingUpdater<Row>>>();
    });
  });
});

interface TaskRow {
  id: string;
  status: string;
  parentId?: string | null;
}
const taskColumns = createColumns(
  (): readonly TaskRow[] | undefined => undefined,
  (col) => [col('id'), col('status')]
);
declare const taskData: TableDataInput<TaskRow>;

describe('withTree composed before withGrouping still resolves the row type (#170)', () => {
  it('rowsOf returns readonly TaskRow[]', () => {
    typecheckOnly(() => {
      const table = createTable(
        taskData,
        { trackBy: 'id', columns: taskColumns },
        withTree({ parentId: (row) => row.parentId }),
        withGrouping({ initial: ['status'] })
      );

      expectTypeOf(table.rowsOf).returns.toEqualTypeOf<readonly TaskRow[]>();
    });
  });
});
