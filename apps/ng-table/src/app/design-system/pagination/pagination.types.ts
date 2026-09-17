/** Which end of the prev/next pair a `a[ngptPaginationLink]` card sits on. */
export type PaginationSide = 'prev' | 'next';

/**
 * One prev/next card's content. Not consumed by the primitives (the consumer authors the `<a>`
 * itself) — kept as the typed shape a docs page's content constants use to feed those links.
 */
export interface PaginationEntry {
  readonly label: string;
  readonly href: string;
}
