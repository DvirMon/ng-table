/**
 * How group siblings are ordered at every depth. Developer config, not an end-user affordance —
 * P9c records that no library anywhere lets a person place group instances by hand, so a story
 * must not imply one exists. `first-occurrence` is the default because 3/5 peers default to it
 * (P9). `throwing` exists only to render the D15 fallback, which never shows on a happy path.
 */
export type GroupOrderMode =
  | 'first-occurrence'
  | 'by-label'
  | 'by-count'
  | 'external-list'
  | 'throwing';

/**
 * What happens to a column once it becomes a grouping level. P12 is four libraries with four
 * defaults (AG Grid hides it, TanStack/MRT move it to the front, MUI X leaves it where it was)
 * and U2 is open — so the story renders all three rather than picking one.
 */
export type GroupedColumnMode = 'keep' | 'hide' | 'move-to-front';
