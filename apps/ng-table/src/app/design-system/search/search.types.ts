/** Visual variant for `[ngptSearchField]`. `on-band` is the hero navbar's translucent well treatment. */
export type SearchFieldVariant = 'default' | 'on-band';

/**
 * One indexed unit: a heading and the prose beneath it, or a page record itself.
 * Shape per `docs/design-handoff/specs/Search Index.md` § Record shape — this app doesn't
 * populate it yet (see `search.mock.ts`), but the shape is fixed now so the overlay can render
 * against it once indexing lands.
 */
export interface SearchResultRecord {
  /** `slug#anchor`, or `slug` for a page record — the row key and navigation target. */
  readonly id: string;
  /** Heading text, or `entry.label` for a page record. */
  readonly title: string;
  /** The entry's parent section label — drives group assignment. */
  readonly section: string;
  /** `section.label › entry.label › heading`, heading omitted on a page record. */
  readonly breadcrumb: string;
  /** Prose under the heading. Matching only — never rendered. */
  readonly body: string;
  /** The entry's flattened tree position — tie-breaking only. */
  readonly entryOrder: number;
}

/** Records grouped by nav section, in tree order. `Search Index.md` § Groups. */
export interface SearchResultGroup {
  readonly label: string;
  readonly results: readonly SearchResultRecord[];
}

/** A stored query string, not a result — `Search Index.md` § Recent searches. */
export interface RecentSearchEntry {
  readonly query: string;
  readonly searchedAt: number;
}
