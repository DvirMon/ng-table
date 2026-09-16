/** Payload for the bulk-add toolbar's `addBulkRows` output — how many blank rows to open and
 * at which index. */
export interface AddBulkRowsPayload {
  readonly count: number;
  readonly insertAt: number;
}
