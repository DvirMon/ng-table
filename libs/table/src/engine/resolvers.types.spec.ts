import { describe, expectTypeOf, it } from 'vitest';
import type { ValueOfContext, ValueOfHandle } from './resolvers';
import type { FilterHandle, FilterValueOfContext } from './filters/types';
import type { ColumnHandle, ColumnRuleContext } from '../columns-schema/types';
import type { RangeCriterion } from '../api/features/with-filtering/rules';

/**
 * Cross-domain compile-time proof of ADR-0027 Rule 3 — the two-tier arity rule itself, owned by
 * neither filtering, sorting, nor grouping alone: a resolver that reads another *declaration* in
 * the same schema is bound to the schema and takes only a path (`criterionOf`, `stateOf`); a
 * resolver that reads *data* takes a path AND a subject (`valueOf`). See this step's own plan
 * doc for why that puts this file here rather than duplicated into (or borrowed by) one
 * feature's own `*.types.spec.ts` ([[spec-files-assert-own-domain-only]]).
 *
 * **`nx run shared-table:typecheck-spec` is what enforces this file** — the runner executes
 * `expectTypeOf` and `@ts-expect-error` without typechecking either.
 *
 * Every context/handle below is a minimal `declare const` of its own interface
 * (`engine/resolvers.ts`, `engine/filters/types.ts`, `columns-schema/types.ts`) — this file
 * asserts the contract those three interfaces state, not any one context builder's runtime
 * behavior (`buildValueOfContext`, `buildCriterionOfContext`, `wireColumnsSchemaAsync`'s own
 * `stateOf`; those are Step 7's runtime specs). `declare const` never gets a real value, which is
 * fine here: every reference lives inside a `typecheckOnly` body, and `typecheckOnly` never
 * calls its argument, so the reference is never evaluated at runtime.
 */

/** Typechecks its argument and never calls it — every body here references an unassigned
 *  `declare const`, which would throw a `ReferenceError` if actually invoked. */
function typecheckOnly(assertions: () => void): void {
  void assertions;
}

interface Row {
  id: number;
  total: number;
}

declare const row: Row;

declare const filterCtx: FilterValueOfContext<Row>;
declare const columnCtx: ColumnRuleContext<Row>;
declare const valueCtx: ValueOfContext<Row>;

/** `path.total`, fabricated per context — same declared column id, each context's own handle
 *  shape (`FilterHandle` carries a criterion-facing `V`, `ColumnHandle` carries no value type at
 *  all since `stateOf` returns column config, `ValueOfHandle` carries the row-value `V`). */
declare const totalFilterPath: FilterHandle<Row, 'total', number>;
declare const totalColumnPath: ColumnHandle<Row, 'total', unknown>;
declare const totalValuePath: ValueOfHandle<'total', number>;

describe('ADR-0027 Rule 3 — bound-tier resolvers (criterionOf, stateOf) take a path only', () => {
  it('criterionOf rejects a row argument', () => {
    typecheckOnly(() => {
      // @ts-expect-error — criterionOf reads another filter's declared criterion, not row data
      // (bound-tier), so it takes only a path. A second argument here is the widened, single
      // "valueOf covering both declarations and data" signature ADR-0027 rejected.
      filterCtx.criterionOf(totalFilterPath, row);
    });
  });

  it('stateOf rejects a row argument', () => {
    typecheckOnly(() => {
      // @ts-expect-error — stateOf reads another column's declared config, not row data
      // (bound-tier), so it takes only a handle.
      columnCtx.stateOf(totalColumnPath, row);
    });
  });
});

describe('ADR-0027 Rule 3 — the unbound-tier resolver (valueOf) requires a row', () => {
  it('rejects a 0-subject call', () => {
    typecheckOnly(() => {
      // @ts-expect-error — valueOf reads row data (unbound-tier): a column-keyed path names a
      // cross-section of every row, not one instance, so a path alone is not a legal call — it
      // requires the row too.
      valueCtx.valueOf(totalValuePath);
    });
  });
});

describe('ADR-0027 Rule 3 — criterionOf and valueOf are not the same resolver under two names', () => {
  it("valueOf(path.total, row) stays typed through the handle's own phantom V", () => {
    typecheckOnly(() => {
      expectTypeOf(valueCtx.valueOf(totalValuePath, row)).toEqualTypeOf<number>();
    });
  });

  it('criterionOf(path.total) erases to unknown, never inRange-shaped', () => {
    typecheckOnly(() => {
      // `inRange(path.total)` (`api/features/with-filtering/rules.ts`) declares a criterion of
      // `RangeCriterion = { min: number | null; max: number | null }` (checked against
      // `matchers.ts`'s `isInRange` — inclusive bounds, either side nullable, never optional
      // keys) — a richer, never-equal-to-`number` shape than `valueOf`'s return for the same
      // column. `FilterValueOfContext.criterionOf` cannot surface that shape statically though:
      // it is generic only in the handle's `id`, never in its phantom `V`
      // (`engine/filters/types.ts`'s own doc comment — "the criterion shape behind a path
      // depends on which rule registered it, which this context has no way to recover
      // statically") — so it returns `unknown` for every path, `path.total` included. Reading
      // the same `path.total` through both resolvers therefore returns `unknown` and `number` —
      // genuinely different types, never collapsible into the single `valueOf` ADR-0027 rejected
      // ("Collapsing the two ... would mean ctx.valueOf(path.total) and ctx.valueOf(path.total,
      // row) return { min, max } and 250 from what reads like the same function").
      expectTypeOf(filterCtx.criterionOf(totalFilterPath)).toEqualTypeOf<unknown>();
      expectTypeOf<RangeCriterion>().not.toEqualTypeOf<number>();
    });
  });
});
