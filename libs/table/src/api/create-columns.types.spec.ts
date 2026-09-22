import { describe, expectTypeOf, it } from 'vitest';
import { createColumns } from './create-columns';
import type { ColumnDefInput, ColumnIdIn, ColumnValues } from './types';

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
