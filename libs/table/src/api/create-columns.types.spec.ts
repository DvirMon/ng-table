import type { WritableSignal } from '@angular/core';
import { describe, expectTypeOf, it } from 'vitest';
import { createColumns } from './create-columns';
import type { ColumnDefInput, ColumnIdIn, ColumnSet, ColumnValues } from './types';

/**
 * Compile-time seam for `createColumns()`'s capture and `ColumnValues<>`'s per-arm derivation
 * (#125, ADR-0024). **`nx run shared-table:typecheck-spec` is what enforces this file** — the
 * vitest runner executes `expectTypeOf` and `@ts-expect-error` without typechecking either, so
 * a green `nx test` proves nothing about it.
 *
 * Never calls `createTable()` — end-to-end carriage through the store is Step 5's, in
 * `api/create-table.types.spec.ts`. This file asserts `createColumns` + `ColumnValues` alone
 * (`.claude/rules/spec-files-assert-own-domain-only.md`).
 */

/** Typechecks its argument and never calls it — every body here throws at construction. */
function typecheckOnly(assertions: () => void): void {
  void assertions;
}

// Declared locally, not imported from a story fixture — a story fixture exists to serve
// Storybook and is free to change shape out from under this spec. One object-valued field
// (`owner`) is required: that is the case ColumnValues's accessor arm exists for.
interface DealRow {
  id: string;
  amount: number;
  owner: { name: string; email: string };
}

// Hoisted to a module-level const, deliberately — an inline array literal inside
// expectTypeOf would only prove that a call expression's own type is literal, which was
// never in doubt. Hoisting is the case that matters: if the curried signature or the
// `const TCols` constraint is wrong, the literal ids fall back to the `readonly
// ColumnDefInput<TRow, string>[]` constraint the moment they're read off a variable, and
// every case below would silently be asserting that fallback instead of the real mechanism.
//
// Covers all three derivation arms in one fixture, plus the id/amount pair case 1 needs to
// prove `id` didn't widen to `string`:
//   - 'id', 'amount'  → defaulted arm (no accessor, id is a keyof DealRow)
//   - 'owner'         → accessor arm (accessor declared; 'owner' is also a keyof DealRow)
//   - 'selected'      → carrier arm (no accessor; id is not a keyof DealRow)
const capturedColumns = createColumns<DealRow>()([
  { id: 'id' },
  { id: 'amount' },
  { id: 'owner', accessor: (row) => row.owner.name },
  { id: 'selected', visible: false },
]);

describe('createColumns — case 1: a hoisted capture keeps its literal ids', () => {
  it('does not widen id to string once assigned to a module-level const', () => {
    typecheckOnly(() => {
      expectTypeOf<(typeof capturedColumns)[number]['id']>().toEqualTypeOf<
        'id' | 'amount' | 'owner' | 'selected'
      >();

      // The failure mode this case exists to catch: a dead capture mechanism still compiles,
      // it just types every id as string.
      expectTypeOf<(typeof capturedColumns)[number]['id']>().not.toEqualTypeOf<string>();
    });
  });
});

describe('ColumnValues — case 2: the accessor arm wins over keyof TRow', () => {
  it("maps 'owner' to the accessor's return type, not TRow['owner'], even though owner is a keyof DealRow", () => {
    typecheckOnly(() => {
      // This is precisely the case ADR-0024 exists to close, and precisely the case the
      // obvious patch — `K extends keyof TRow ? TRow[K] : unknown` — gets wrong: 'owner' *is*
      // a keyof DealRow, so that guess would return the whole `{ name; email }` object and
      // lie about what the column actually renders.
      expectTypeOf<ColumnValues<DealRow, typeof capturedColumns>['owner']>().toEqualTypeOf<
        string
      >();

      // The accessor param needs no annotation: the curried form (`createColumns<DealRow>()`)
      // has already bound TRow, so `(row) => row.owner.name` typechecks with `row: DealRow`.
      // If it hadn't, `row` would be an implicit-any parameter under strict mode and this
      // fixture would fail to compile at its declaration, above — this assertion pins the
      // resolved type rather than merely relying on silence.
      expectTypeOf(capturedColumns[2].accessor).parameter(0).toEqualTypeOf<DealRow>();

      // Whole-map shape, asserted once here: a per-key assertion alone cannot catch an extra
      // or missing key in ColumnValues's mapped type.
      expectTypeOf<ColumnValues<DealRow, typeof capturedColumns>>().toEqualTypeOf<{
        id: string;
        amount: number;
        owner: string;
        selected: unknown;
      }>();
    });
  });
});

describe('ColumnValues — case 3: the defaulted arm is exact, not a fallback', () => {
  it("maps 'amount' to TRow['amount'] when no accessor is declared", () => {
    typecheckOnly(() => {
      // Exact rather than a guess: the engine's documented default accessor *is*
      // `(row) => row[id]`, so TRow['amount'] is what actually runs, not merely a stand-in.
      expectTypeOf<ColumnValues<DealRow, typeof capturedColumns>['amount']>().toEqualTypeOf<
        number
      >();
    });
  });
});

describe('ColumnValues — case 4: the carrier arm degrades to unknown, not an error', () => {
  it("maps 'selected' to unknown when its id is not a keyof DealRow and it declares no accessor", () => {
    typecheckOnly(() => {
      // The carrier-column shape (`{ id, accessor, visible: false }`) minus its accessor —
      // the one combination the map genuinely cannot resolve. unknown is the honest answer;
      // there is nothing on DealRow to fall back to and no accessor to infer from.
      expectTypeOf<ColumnValues<DealRow, typeof capturedColumns>['selected']>().toEqualTypeOf<
        unknown
      >();
    });
  });
});

describe('ColumnValues — case 5: the degradation is pinned, not endorsed', () => {
  // Annotated `: ColumnDefInput<DealRow>[]` — deliberately, unlike `capturedColumns` above.
  // The return-type annotation widens every `id` to `string` before it ever reaches
  // ColumnValues, the same way `create-table.types.spec.ts`'s `makeWidenedColumns()` does for
  // ColumnIdOf. A future reader "fixing" this by switching to `createColumns()` would silently
  // disarm the case — the annotation is the point.
  function makeWidenedColumns(): ColumnDefInput<DealRow>[] {
    return [
      { id: 'id' },
      { id: 'amount' },
      { id: 'owner', accessor: (row) => row.owner.name },
    ];
  }

  const widenedColumns = makeWidenedColumns();

  it('a plain annotated ColumnDefInput<DealRow>[] yields an index-signature map, so ColumnIdIn is string', () => {
    typecheckOnly(() => {
      // Pins today's failure mode — it does not endorse it. A change in either direction (this
      // widened case tightening, or case 1's literal case widening) fails the run.
      expectTypeOf<
        ColumnIdIn<ColumnValues<DealRow, typeof widenedColumns>>
      >().toEqualTypeOf<string>();
    });
  });
});

// --- #130: `col()` builder + `ColumnSet` type proofs -----------------------
//
// Everything below targets the *new* data-first `createColumns(data, build, schema?)` call and
// its `col()` builder / `ColumnDecl` / `ColumnSet` types. The curried-form cases above are
// #138's and stay untouched. Ownership: derivation belongs here; carriage of `TRow`/`TValues`
// through `createTable()` belongs to `create-table.types.spec.ts` (#131/#138,
// `.claude/rules/spec-files-assert-own-domain-only.md`).

// A real function, not `declare const`: case 1's `dealColumns` below is hoisted to module scope
// and therefore evaluated for real when this file loads under `nx test` — a `declare const`
// witness has no runtime value, so merely referencing it at module scope would throw a
// ReferenceError the instant `createColumns()` is called, even though `createColumns()` itself
// never reads `data` (`void data`, `create-columns.ts`).
const deals = (): readonly DealRow[] | undefined => undefined;

// `declare const` must sit at module scope — TS rejects the `declare` modifier inside a
// function body (`typecheckOnly`'s closures included). Never evaluated at runtime since the
// only reference to it lives inside a `typecheckOnly` closure, which is never called.
declare const dealsSignal: WritableSignal<DealRow[]>;

// Hoisted to a module-level const, deliberately — same reasoning as `capturedColumns` above: an
// inline array literal inside expectTypeOf would only prove a call expression's own type is
// literal, which was never in doubt. Hoisting is the case that matters: if `col()`'s per-call
// inference or the `TCols` constraint were wrong, the literal ids fall back to `string` the
// moment they're read off a variable, and every case below would silently be asserting that
// fallback instead of the real mechanism.
//
// Covers all four ColumnValues derivation arms:
//   - 'id', 'amount' → the field arm (no accessor, id is a keyof DealRow)
//   - 'owner'        → the accessor arm (accessor declared; 'owner' is also a keyof DealRow)
//   - 'carrier'      → the unknown arm (no accessor, id is not a keyof DealRow)
const dealColumns = createColumns(deals, (col) => [
  col('id'),
  col('amount'),
  col('owner', { accessor: (row) => row.owner.name }),
  col('carrier'),
]);

describe('createColumns (col() builder) — case 1: a hoisted capture keeps its literal ids', () => {
  it('does not widen id to string once assigned to a module-level const', () => {
    typecheckOnly(() => {
      expectTypeOf<
        ColumnIdIn<ColumnValues<DealRow, typeof dealColumns.columns>>
      >().toEqualTypeOf<'id' | 'amount' | 'owner' | 'carrier'>();

      // The failure mode this case exists to catch: a dead capture mechanism still compiles, it
      // just types every id as string.
      expectTypeOf<
        ColumnIdIn<ColumnValues<DealRow, typeof dealColumns.columns>>
      >().not.toEqualTypeOf<string>();
    });
  });
});

describe('createColumns (col() builder) — case 2: the accessor arm wins over keyof TRow', () => {
  it("maps 'owner' to the accessor's return type, not TRow['owner']", () => {
    typecheckOnly(() => {
      expectTypeOf<ColumnValues<DealRow, typeof dealColumns.columns>['owner']>().toEqualTypeOf<
        string
      >();

      // The accessor param needs no annotation: TRow is already bound from `deals`, so
      // `(row) => row.owner.name` typechecks with `row: DealRow`. If it hadn't, `row` would be
      // an implicit-any parameter under strict mode and the fixture above would fail to compile
      // at its own declaration — this assertion pins the resolved type rather than merely
      // relying on that silence. `NonNullable` unwraps `accessor`'s own optionality on
      // `ColumnDecl` — unlike `capturedColumns` above, `col()`'s return type keeps `accessor?`
      // optional at the interface level even when a specific call supplied one.
      expectTypeOf<
        Parameters<NonNullable<(typeof dealColumns.columns)[2]['accessor']>>[0]
      >().toEqualTypeOf<DealRow>();
    });
  });
});

describe('createColumns (col() builder) — case 3: the field arm is exact, not a fallback', () => {
  it("maps 'amount' to TRow['amount'] when no accessor is declared", () => {
    typecheckOnly(() => {
      expectTypeOf<ColumnValues<DealRow, typeof dealColumns.columns>['amount']>().toEqualTypeOf<
        number
      >();
    });
  });
});

describe('createColumns (col() builder) — case 4: the unknown arm degrades to unknown, not an error', () => {
  it("maps 'carrier' to unknown when its id is not a keyof DealRow and it declares no accessor", () => {
    typecheckOnly(() => {
      expectTypeOf<ColumnValues<DealRow, typeof dealColumns.columns>['carrier']>().toEqualTypeOf<
        unknown
      >();
    });
  });
});

describe('createColumns (col() builder) — case 5: the whole value map, in one assertion', () => {
  it('resolves every declared id to its own arm, with no extra or missing key', () => {
    typecheckOnly(() => {
      expectTypeOf<ColumnValues<DealRow, typeof dealColumns.columns>>().toEqualTypeOf<{
        id: string;
        amount: number;
        owner: string;
        carrier: unknown;
      }>();
    });
  });
});

describe('createColumns (col() builder) — case 6: the brand rejects a hand-written literal', () => {
  it('rejects an object literal without the ColumnDecl brand, even a shape-matching one', () => {
    typecheckOnly(() => {
      createColumns(deals, (col) => [
        col('amount'),
        // @ts-expect-error — { id: 'x' } is shape-compatible with ColumnDefInput but was never
        // minted by col(), so it carries no [COLUMN_DECL] brand
        { id: 'x' },
      ]);

      // Positive half, on an unrelated call: the brand rejection above isn't a side effect of
      // something wrong with col() itself — an ordinary, all-branded array (dealColumns, above)
      // still resolves cleanly. (Asserting through the erroring array's own downstream type is
      // not reliable: once TS falls into error recovery on one element, `TCols` stops being a
      // literal tuple and every key's resolved type degrades, not just the bad one.)
      expectTypeOf<ColumnValues<DealRow, typeof dealColumns.columns>['amount']>().toEqualTypeOf<
        number
      >();
    });
  });
});

describe('createColumns (col() builder) — case 7: options are presentation-only', () => {
  it('rejects meta and order at the builder call, accepts a no-options call', () => {
    typecheckOnly(() => {
      createColumns(deals, (col) => [
        // @ts-expect-error — meta is not part of Presentation; col() carries no side-channel slot
        col('x', { meta: {} }),
      ]);

      createColumns(deals, (col) => [
        // @ts-expect-error — order is not part of Presentation; column order comes from array
        // position, not a declared option
        col('x', { order: 1 }),
      ]);

      const legal = createColumns(deals, (col) => [col('x')]);
      expectTypeOf<(typeof legal.columns)[number]['id']>().toEqualTypeOf<'x'>();
    });
  });
});

describe('createColumns (col() builder) — case 8: schema paths are checked against declared ids', () => {
  it('accepts a declared id and rejects a typo', () => {
    typecheckOnly(() => {
      createColumns(
        deals,
        (col) => [col('id'), col('amount'), col('owner', { accessor: (row) => row.owner.name })],
        (path) => {
          expectTypeOf(path.amount.id).toEqualTypeOf<'amount'>();

          // @ts-expect-error — 'amont' is not a declared column id; ColumnsPath is keyed by the
          // literal id union the columns array produced, not an open string index
          path.amont;
        }
      );
    });
  });
});

describe('createColumns (col() builder) — case 9: an empty column list leaves no valid schema path', () => {
  it('rejects any path property when the declared column set is empty', () => {
    typecheckOnly(() => {
      createColumns(deals, () => [], (path) => {
        // @ts-expect-error — an empty columns array carries no declared ids, so ColumnsPath's
        // key union is empty; no property access on it can ever be valid
        path.x;
      });
    });
  });
});

describe('createColumns (col() builder) — case 10: the data witness accepts a callable or a WritableSignal', () => {
  it('accepts a callable yielding undefined before load, and a WritableSignal<DealRow[]>', () => {
    typecheckOnly(() => {
      const fromCallable = createColumns(deals, (col) => [col('amount')]);
      expectTypeOf<ColumnValues<DealRow, typeof fromCallable.columns>['amount']>().toEqualTypeOf<
        number
      >();

      const fromSignal = createColumns(dealsSignal, (col) => [col('amount')]);
      expectTypeOf<ColumnValues<DealRow, typeof fromSignal.columns>['amount']>().toEqualTypeOf<
        number
      >();
    });
  });
});

describe('createColumns (col() builder) — case 11 (open Q3): TRow is recoverable off the returned ColumnSet', () => {
  it('infers DealRow from typeof dealColumns via ColumnSet<infer R, any>', () => {
    typecheckOnly(() => {
      type Recovered = typeof dealColumns extends ColumnSet<infer R, any> ? R : never;
      expectTypeOf<Recovered>().toEqualTypeOf<DealRow>();
    });
  });
});

describe('createColumns (col() builder) — case 12 (open Q6): the brand never leaks into ColumnValues', () => {
  it('keyof the value map is the declared id union only, not the brand symbol', () => {
    typecheckOnly(() => {
      expectTypeOf<keyof ColumnValues<DealRow, typeof dealColumns.columns>>().toEqualTypeOf<
        'id' | 'amount' | 'owner' | 'carrier'
      >();
    });
  });
});

describe('createColumns (col() builder) — case 13 (open Q1, probe): col.from and its new id', () => {
  it('captures a literal id when given one, and widens when it is not', () => {
    typecheckOnly(() => {
      createColumns(deals, (col) => {
        const amountDecl = col('amount');

        const renamed = col.from(amountDecl, { id: 'total' });
        expectTypeOf<typeof renamed.id>().toEqualTypeOf<'total'>();

        const relabeled = col.from(amountDecl, { label: 'Renamed only' });
        // Probe: observed behavior is a widen to string, not a preserved 'amount' — from's own
        // `id?: K` has no inference source when the option is omitted, so K falls back to its
        // `extends string` constraint. Pinned as observed; do not change ColumnBuilder to force
        // literal preservation.
        expectTypeOf<typeof relabeled.id>().toEqualTypeOf<string>();

        return [amountDecl];
      });
    });
  });
});

describe('createColumns (col() builder) — case 14 (open Q2, probe): spreading a ColumnDecl and overriding id', () => {
  it('probe: id widens to string when a ColumnDecl is spread and re-keyed inline', () => {
    typecheckOnly(() => {
      const spread = createColumns(deals, (col) => [{ ...col('amount'), id: 'total' }]);

      // Probe: observed behavior is a widen to string. The array element's expected type comes
      // from TCols' own `readonly ColumnDecl<TRow, string, unknown>[]` constraint, whose `id` is
      // `string`, not a literal — so the trailing `id: 'total'` property has no literal-typed
      // context to preserve against and infers as the widened primitive. Pinned as observed;
      // this does not endorse spreading over col.from() as the right way to re-declare a column.
      expectTypeOf<(typeof spread.columns)[0]['id']>().toEqualTypeOf<string>();
    });
  });
});
