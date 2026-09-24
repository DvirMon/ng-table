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

// --- #131 step 5: carriage proofs, cases 9-15 ------------------------------
//
// Cases 9-15 own **carriage**: that ColumnValuesOf survives the createTable() config boundary,
// the generated overloads (Step 2) and a composed slot, for a *set*-built table (the col()
// builder from #130) — not derivation itself, which create-columns.types.spec.ts already
// proves (`.claude/rules/spec-files-assert-own-domain-only.md`). Also pins the scope amendment:
// `columnsSchema` is gone from `TableConfig` (Step 4).

// One object-valued field (`owner`), matching create-columns.types.spec.ts's own DealRow — the
// case ColumnValues's accessor arm exists for, so case 9 can tell "carried the accessor's own
// return type through the store" apart from "flattened to the field type" without re-proving
// derivation itself.
interface CarriageRow {
  id: string;
  status: string;
  owner: { name: string; email: string };
}

// A real function, not `declare const` — hoisted below, so it is evaluated for real when this
// module loads under `nx test`, same reasoning as create-columns.types.spec.ts's own `deals`.
// createColumns() never reads it at runtime (`void data`, create-columns.ts) — only its type
// matters.
const carriageData = (): readonly CarriageRow[] | undefined => undefined;

// `declare const` is fine here, unlike `carriageData` above — every reference to this one lives
// inside a `typecheckOnly` closure, which is never called, so no runtime binding is required.
declare const carriageTableData: TableDataInput<CarriageRow>;

// Hoisted to module scope, deliberately — an inline set inside expectTypeOf would only prove
// createColumns()'s own call-expression type is literal, which #130 already proved. `owner`
// declares an accessor returning `row.owner.name` (`string`), differing from its own field type
// (`{ name; email }`) — case 9's accessor arm. `status` declares none, so it defaults to
// `TRow['status']` — case 9's defaulted arm.
const carriageSet = createColumns(carriageData, (col) => [
  col('owner', { accessor: (row) => row.owner.name }),
  col('status'),
]);

// A second row type, for case 15's mismatch probe — deliberately unrelated to CarriageRow/Row.
interface OtherRow {
  id: string;
  color: string;
}

const otherRowData = (): readonly OtherRow[] | undefined => undefined;

// Hoisted, same reasoning as carriageSet above.
const otherRowSet = createColumns(otherRowData, (col) => [col('color')]);

describe('ColumnValuesOf / TableConfig — carriage proofs (#131, step 5)', () => {
  it('case 9: the map comes back off a set-built table store', () => {
    typecheckOnly(() => {
      const table = createTable(carriageTableData, { trackBy: 'id', columns: carriageSet });

      // Whole-map shape, not member by member — same reasoning as case 5.
      expectTypeOf<ColumnValuesOf<typeof table>>().toEqualTypeOf<{
        owner: string;
        status: string;
      }>();
    });
  });

  it('case 10: the same map survives a composed slot', () => {
    typecheckOnly(() => {
      const table = createTable(
        carriageTableData,
        { trackBy: 'id', columns: carriageSet },
        // withComputed() has no column-id surface of its own — same filler as case 4/8, keeps
        // this case about carriage through composeFeatures, not about a second feature's config.
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
        owner: string;
        status: string;
      }>();
    });
  });

  it('case 11: a typo inside a composed slot is rejected, correct usage beside it', () => {
    typecheckOnly(() => {
      const table = createTable(
        carriageTableData,
        { trackBy: 'id', columns: carriageSet },
        composeFeatures(
          withComputed(() => ({})),
          withProbe({
            schema: (path) => {
              // Positive, right beside the typo below: 'status' was declared.
              path.status;
              // @ts-expect-error — 'statuss' was never declared in columns
              path.statuss;
            },
          })
        )
      );

      expectTypeOf<ColumnValuesOf<typeof table>>().toEqualTypeOf<{
        owner: string;
        status: string;
      }>();
    });
  });

  it('case 12: a typo at a direct slot is rejected, correct usage beside it', () => {
    typecheckOnly(() => {
      const table = createTable(
        carriageTableData,
        { trackBy: 'id', columns: carriageSet },
        withProbe({
          schema: (path) => {
            path.status;
            // @ts-expect-error — 'statuss' was never declared in columns
            path.statuss;
          },
        })
      );

      expectTypeOf<ColumnValuesOf<typeof table>>().toEqualTypeOf<{
        owner: string;
        status: string;
      }>();
    });
  });

  it('case 13: the array form still yields the exact literal id-keyed map', () => {
    typecheckOnly(() => {
      // capturedValueColumns is a plain array (createColumns<Row>()'s curried form), never a
      // ColumnSet — this guards the array arm of TableConfig's `TCols | ColumnSet<...>` union
      // (Step 1) against having widened it once a second union member exists to match against.
      const table = createTable(data, { trackBy: 'id', columns: capturedValueColumns });

      expectTypeOf<ColumnValuesOf<typeof table>>().toEqualTypeOf<{
        name: number;
        status: string;
      }>();
    });
  });

  it('case 14: columnsSchema is rejected as an excess property, array and set form alike', () => {
    typecheckOnly(() => {
      createTable(data, {
        trackBy: 'id',
        columns: makeColumns(),
        // @ts-expect-error — columnsSchema was removed from TableConfig (Step 4)
        columnsSchema: {},
      });

      // Positive, beside it: the array form alone, with no columnsSchema, is legal.
      const arrayTable = createTable(data, { trackBy: 'id', columns: makeColumns() });
      expectTypeOf<ColumnIdOf<typeof arrayTable>>().toEqualTypeOf<'name' | 'status'>();

      createTable(carriageTableData, {
        trackBy: 'id',
        columns: carriageSet,
        // @ts-expect-error — columnsSchema was removed from TableConfig (Step 4)
        columnsSchema: {},
      });

      // Positive, beside it: the set form alone, with no columnsSchema, is legal.
      const setTable = createTable(carriageTableData, { trackBy: 'id', columns: carriageSet });
      expectTypeOf<ColumnValuesOf<typeof setTable>>().toEqualTypeOf<{
        owner: string;
        status: string;
      }>();
    });
  });

  it('case 15: a ColumnSet built for a different row type', () => {
    typecheckOnly(() => {
      // Observed (design brief P5e): this DOES error, but TS anchors the mismatch on the
      // call's `data` argument, not on `columns` — `otherRowSet` is `ColumnSet<OtherRow, ...>`,
      // TRow infers as OtherRow from `columns`, and `data` (`TableDataInput<Row>`) is then the
      // argument that fails to satisfy `TableDataInput<OtherRow>`. Placing `@ts-expect-error`
      // on the `columns` line itself leaves it unused — this is not a case where Step 1's types
      // need tightening, the mismatch is already caught, just reported at a different argument.
      // @ts-expect-error — see above: the reported error is on this line, at `data`
      createTable(data, {
        trackBy: 'id',
        columns: otherRowSet,
      });

      // Positive, beside it: a ColumnSet built for the same row type as `data` is legal.
      const table = createTable(carriageTableData, { trackBy: 'id', columns: carriageSet });
      expectTypeOf<ColumnValuesOf<typeof table>>().toEqualTypeOf<{
        owner: string;
        status: string;
      }>();
    });
  });
});
