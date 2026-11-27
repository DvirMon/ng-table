import type { RecentSearchEntry } from './search.types';

/**
 * In-memory recent-searches fixture. Not persisted (no localStorage) — resets on reload.
 * Real behavior stores query strings only, deduplicated, most recent first, capped at 5
 * (`Search Index.md` § Recent searches).
 */
export const RECENT_SEARCHES_MOCK: readonly RecentSearchEntry[] = [
  { id: 'recent-sorting', query: 'sorting', searchedAt: Date.now() - 5 * 60 * 1000 },
  { id: 'recent-row-editing', query: 'row editing', searchedAt: Date.now() - 45 * 60 * 1000 },
  {
    id: 'recent-column-visibility',
    query: 'column visibility',
    searchedAt: Date.now() - 3 * 60 * 60 * 1000,
  },
];
