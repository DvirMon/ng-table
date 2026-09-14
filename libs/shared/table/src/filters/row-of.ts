declare const ROW_TOKEN: unique symbol;

/** Phantom carrier for a row type when no row data exists yet (server mode). Never read. */
export interface RowToken<TRow> {
  readonly [ROW_TOKEN]: TRow;
}

/** Declares a row type in the slot real row data would otherwise occupy. Return value is never read. */
export function rowOf<TRow>(): RowToken<TRow> {
  return {} as RowToken<TRow>;
}
