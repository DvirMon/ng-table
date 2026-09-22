import { describe, expectTypeOf, it } from 'vitest';
import { createColumns } from './create-columns';
import { createTable } from './create-table';
import { createTableFeature } from './create-table-feature';
import { composeFeatures } from './features/compose-features';
import { withComputed } from './features/with-computed';
import type { ColumnDef, TableDataInput } from './types';
import type { ColumnsPath } from '../columns-schema/types';
import type { ColumnIdOf, ColumnValuesOf, RowOf, Shape } from '../engine/types';

/**
 * Compile-time seam for what a `createTable()` call returns, at the type level: `ColumnIdOf<S>`
 * (ADR-0019, #113) and, since #125, `ColumnValuesOf<S>` — the map surviving `TableConfig`, the
 * 16 generated overloads and the composed store. **`nx run shared-table:typecheck-spec` is what
 * enforces this file** — the runner executes `expectTypeOf` and `@ts-expect-error` without
 * typechecking either.
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

// Hoisted, captured via `createColumns()` — the value-map counterpart to `makeColumns()` above.
// `name` declares an accessor returning `number` (`row.name.length`, not `TRow['name']`, which
// is `string`) so cases 5-8 below can tell "carried through" apart from "flattened to the
// defaulted arm" without changing `Row`'s own shape. `status` declares none, so it defaults to
// `TRow['status']`. No return-type annotation, same reason as `makeColumns()`: annotating would
// widen `id` to `string` before `createColumns()` ever sees it. The arm-selection logic itself —
// which shape a column resolves to — is `create-columns.types.spec.ts`'s, asserted directly
// against `ColumnValues<>` with no `createTable()` call; this file only proves the map's
// carriage through `TableConfig`, the generated overloads and the composed store.
const capturedValueColumns = createColumns<Row>()([
  { id: 'name', accessor: (row) => row.name.length },
  { id: 'status' },
]);

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

describe('ColumnValuesOf — case 5: the value map comes back off the store', () => {
  it('recovers the whole map, and ColumnIdOf stays the literal union derived from it', () => {
    typecheckOnly(() => {
      const table = createTable(data, { trackBy: 'id', columns: capturedValueColumns });

      // Whole-map shape, not member by member — a per-key assertion alone cannot catch an
      // extra or missing key.
      expectTypeOf<ColumnValuesOf<typeof table>>().toEqualTypeOf<{
        name: number;
        status: string;
      }>();

      // `TId` stays derivable as `keyof TValues & string` (#125) — one parameter now carries
      // what two used to, and `ColumnIdOf` was not edited to make it work.
      expectTypeOf<ColumnIdOf<typeof table>>().toEqualTypeOf<'name' | 'status'>();
    });
  });
});

describe('ColumnValuesOf — case 6: both arms resolve off the store, not only off the columns value', () => {
  it('the accessor arm and the defaulted arm both survive the round trip', () => {
    typecheckOnly(() => {
      const table = createTable(data, { trackBy: 'id', columns: capturedValueColumns });

      // The accessor arm: `number`, not `TRow['name']` (`string`) — proves the round trip
      // through `TableConfig`, the generated overloads and the composed store doesn't flatten
      // it to the defaulted arm.
      expectTypeOf<ColumnValuesOf<typeof table>['name']>().toEqualTypeOf<number>();

      // The defaulted arm: `TRow['status']` exactly, unchanged by the round trip.
      expectTypeOf<ColumnValuesOf<typeof table>['status']>().toEqualTypeOf<string>();
    });
  });
});

describe('ColumnValuesOf — case 7: a typo is rejected with createColumns()-captured columns too', () => {
  it('rejects a column id never declared in columns', () => {
    typecheckOnly(() => {
      // Kept in its own `it`, and the surrounding call re-asserted below: `@ts-expect-error`
      // is satisfied by *any* error on the next line, so an unrelated failure here would pass
      // quietly without this check. Same shape as case 2, with the captured-columns fixture.
      const table = createTable(
        data,
        { trackBy: 'id', columns: capturedValueColumns },
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

describe('ColumnValuesOf — case 8: carriage through composeFeatures', () => {
  it('recovers the whole map through the arity escape hatch, not only the id union', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'id', columns: capturedValueColumns },
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

      expectTypeOf<ColumnValuesOf<typeof table>>().toEqualTypeOf<{
        name: number;
        status: string;
      }>();
    });
  });
});
