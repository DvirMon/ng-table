import type { RecentSearchEntry, SearchResultRecord } from './search.types';

/**
 * Stubbed search index — empty this round. Docs pages aren't built yet, and real indexing
 * depends on Content Model.md, which isn't wired (`Search Index.md` § Open). The overlay's
 * result-list render path exists against this type but never has data to show this round.
 */
export const SEARCH_INDEX_MOCK: readonly SearchResultRecord[] = [];

/**
 * In-memory recent-searches fixture. Not persisted (no localStorage) — resets on reload.
 * Real behavior stores query strings only, deduplicated, most recent first, capped at 5
 * (`Search Index.md` § Recent searches).
 */
export const RECENT_SEARCHES_MOCK: readonly RecentSearchEntry[] = [
  { query: 'sorting', searchedAt: Date.now() - 5 * 60 * 1000 },
  { query: 'row editing', searchedAt: Date.now() - 45 * 60 * 1000 },
  { query: 'column visibility', searchedAt: Date.now() - 3 * 60 * 60 * 1000 },
];
