/** Result of a `saveAll()` run — `total` open rows attempted, `failed` of those that errored. */
export interface SaveAllOutcome {
  readonly total: number;
  readonly failed: number;
}
