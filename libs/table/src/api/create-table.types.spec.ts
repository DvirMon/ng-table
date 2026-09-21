import { describe, expectTypeOf, it } from 'vitest';
import { createTable } from './create-table';
import { createTableFeature } from './create-table-feature';
import { composeFeatures } from './features/compose-features';
import { withComputed } from './features/with-computed';
import type { ColumnDef, TableDataInput } from './types';
import type { ColumnsPath } from '../columns-schema/types';
import type { ColumnIdOf, RowOf, Shape } from '../engine/types';

/**
 * Compile-time seam for `ColumnIdOf<S>` (ADR-0019, #113). **`nx run shared-table:typecheck-spec`
 * is what enforces this file** — the runner executes `expectTypeOf` and `@ts-expect-error`
 * without typechecking either.
 *
 * Each case calls `createTable(...)` inline rather than through a shared generic helper — see
 * `with-filtering/feature.types.spec.ts`'s own header comment for why.
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

// No `ColumnDef<Row>[]` return annotation — that would widen `id` to `string` and turn
// `ColumnIdOf` into its `string` fallback (ADR-0019). Cases 1 and 4 rely on this staying
// unannotated; a future reader "fixing" it to a declared return type would silently disarm both.
function makeColumns() {
  return [
    {
      id: 'name' as const,
      accessor: (row: Row) => row.name,
      visible: true,
      order: 0,
      label: 'name',
    },
    {
      id: 'status' as const,
      accessor: (row: Row) => row.status,
      visible: true,
      order: 1,
      label: 'status',
    },
  ] satisfies ColumnDef<Row>[];
}

// Annotated `: ColumnDef<Row>[]` — deliberately, unlike `makeColumns()` above. This is the
// widening failure mode itself: the annotation erases each `id` to `string` before it ever
// reaches `createTable()`. Case 3 pins the resulting behaviour rather than guarding against it.
function makeWidenedColumns(): ColumnDef<Row>[] {
  return [
    { id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'name' },
    { id: 'status', accessor: (row) => row.status, visible: true, order: 1, label: 'status' },
  ];
}

declare const data: TableDataInput<Row>;

/**
 * Stands in for #114/#115/#100's real feature configs — its only job is to occupy a
 * `createTable()` slot and put `ColumnIdOf<In>` in a consumer's hands via `schema`. Declared
 * locally: nothing here ships on the public API.
 */
const withProbe = <In extends Shape>(cfg: {
  schema: (path: ColumnsPath<RowOf<In>, ColumnIdOf<In>>) => void;
}) => createTableFeature<In, {}>(() => ({}));

describe('ColumnIdOf — case 1: a declared id is nameable', () => {
  it('recovers the literal union off the store the call returns', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns: makeColumns() },
        withProbe({
          schema: (path) => {
            path.status;
          },
        })
      );

      expectTypeOf<ColumnIdOf<typeof table>>().toEqualTypeOf<'name' | 'status'>();
    });
  });
});

describe('ColumnIdOf — case 2: a typo is rejected at the call site', () => {
  it('rejects a column id never declared in columns', () => {
    typecheckOnly(() => {
      // Kept in its own `it`, and the surrounding call re-asserted below: `@ts-expect-error`
      // is satisfied by *any* error on the next line, so an unrelated failure here would pass
      // quietly without this check.
      const table = createTable(
        data,
        { trackBy: 'id', columns: makeColumns() },
        withProbe({
          schema: (path) => {
            // @ts-expect-error — 'statuss' was never declared in columns
            path.statuss;
          },
        })
      );

      expectTypeOf<ColumnIdOf<typeof table>>().toEqualTypeOf<'name' | 'status'>();
    });
  });
});

describe('ColumnIdOf — case 3: the widening failure mode is pinned', () => {
  it('an annotated ColumnDef<Row>[] return type widens the union to string', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns: makeWidenedColumns() },
        withProbe({
          schema: (path) => {
            // The index-signature degradation, stated rather than implied: once the union
            // widens to `string`, ColumnsPath accepts any string key, typo or not.
            // Bracket notation — `noPropertyAccessFromIndexSignature` rejects dot access
            // once `path` falls back to an index signature.
            path['anythingAtAll'];
          },
        })
      );

      expectTypeOf<ColumnIdOf<typeof table>>().toEqualTypeOf<string>();
    });
  });
});

describe('ColumnIdOf — case 4: the arity escape hatch carries the union', () => {
  it('recovers the literal union through composeFeatures', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns: makeColumns() },
        // withComputed() has no column-id surface of its own — it keeps this case about
        // carriage through composeFeatures, not about a second feature's config.
        composeFeatures(
          withComputed(() => ({})),
          withProbe({
            schema: (path) => {
              path.status;
            },
          })
        )
      );

      expectTypeOf<ColumnIdOf<typeof table>>().toEqualTypeOf<'name' | 'status'>();
    });
  });

  it('rejects a typo inside the composite', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns: makeColumns() },
        composeFeatures(
          withComputed(() => ({})),
          withProbe({
            schema: (path) => {
              // @ts-expect-error — 'statuss' was never declared in columns
              path.statuss;
            },
          })
        )
      );

      expectTypeOf<ColumnIdOf<typeof table>>().toEqualTypeOf<'name' | 'status'>();
    });
  });
});
