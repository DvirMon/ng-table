import type { ColumnDefInput } from './types';

/**
 * Captures a column array's declared ids and accessor return types, which a plain array
 * literal would otherwise widen away.
 *
 * @remarks
 * Curried: call with the row type first, then write the column array *inside* the second
 * call — `createColumns<DealRow>()([...])` — so TypeScript's `const` modifier applies to
 * the literal. Safe to hoist the result to a `const`.
 *
 * @example
 * ```ts
 * const columns = createColumns<DealRow>()([
 *   { id: 'name' },
 *   { id: 'amount' },
 * ]);
 * ```
 */
export function createColumns<TRow>() {
  return <const TCols extends readonly ColumnDefInput<TRow, string>[]>(
    columns: TCols,
  ): TCols => columns;
}
