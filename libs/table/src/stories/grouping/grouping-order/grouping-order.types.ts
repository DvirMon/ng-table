/**
 * How group siblings are ordered at every depth. Developer config, not an end-user affordance.
 * `throwing` exists only to render the comparator fallback, which never shows on a happy path.
 */
export type GroupOrderMode =
  | 'first-occurrence'
  | 'by-label'
  | 'by-count'
  | 'external-list'
  | 'throwing';
