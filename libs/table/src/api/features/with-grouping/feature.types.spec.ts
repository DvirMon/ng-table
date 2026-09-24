import { describe, expectTypeOf, it } from 'vitest';
import { createTable } from '../../create-table';
import { groupKey, grouping } from './schema';
import { withGrouping } from './feature';
import type { WritableView } from '../../../engine/writable-view';
import type { ColumnDef, GroupingUpdater, TableDataInput } from '../../types';

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

// No `ColumnDef<Row>[]` return annotation — that would widen every `id` to `string` and defeat
// every case below (`create-table.spec.ts:20-36`).
function makeColumns() {
  return [
    {
      id: 'region' as const,
      accessor: (row: Row) => row.region,
      visible: true,
      order: 0,
      label: 'Region',
    },
    {
      id: 'category' as const,
      accessor: (row: Row) => row.category,
      visible: true,
      order: 1,
      label: 'Category',
    },
    {
      id: 'amount' as const,
      accessor: (row: Row) => row.amount,
      visible: true,
      order: 2,
      label: 'Amount',
    },
  ] satisfies ColumnDef<Row>[];
}

declare const data: TableDataInput<Row>;

describe("initial's string shorthand still compiles (AC #7)", () => {
  it('a bare declared column id compiles', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns: makeColumns() },
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
        { trackBy: 'id', columns: makeColumns() },
        withGrouping({ initial: [{ columnId: 'region', label: 'Sales Region' }] })
      );

      expectTypeOf(table.grouping).toEqualTypeOf<WritableView<string[], GroupingUpdater<Row>>>();
    });
  });

  it('{ key } is rejected — the old property name is gone', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns: makeColumns() },
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
        { trackBy: 'id', columns: makeColumns() },
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
        { trackBy: 'id', columns: makeColumns() },
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
