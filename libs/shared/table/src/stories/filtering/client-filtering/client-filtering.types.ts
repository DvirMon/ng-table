/** Keys backing the summary row and its × buttons — declared once so iterating them stays typed
 *  against the filter set rather than degrading to a bare `string`. */
export const CLIENT_FILTER_KEYS = [
  'status',
  'customer',
  'amount',
  'issuedAt',
  'tags',
  'search',
] as const;

export type ClientFilterKey = (typeof CLIENT_FILTER_KEYS)[number];

/** One entry of the summary row, read from the filter nodes rather than a host copy. */
export interface ActiveCriterion {
  readonly key: ClientFilterKey;
  readonly label: string;
}

/** Which saved-filter load button was last pressed, if any — backs the notice `@switch`. */
export type SavedFilterLoad = 'raw' | 'guarded' | null;
