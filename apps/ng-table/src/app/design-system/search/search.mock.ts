import type { RecentSearchEntry, SearchResultRecord } from './search.types';

/**
 * Fixture search index — real docs indexing still depends on Content Model.md, which isn't
 * wired (`Search Index.md` § Open). These records exist only so the overlay's result list
 * (icons, active-row fill, keyboard nav, the 5-per-group cap) can be manually verified against
 * something other than an empty array; they aren't real doc content.
 */
export const SEARCH_INDEX_MOCK: readonly SearchResultRecord[] = [
  {
    id: 'table-primitive',
    kind: 'page',
    title: 'Table Primitive',
    section: 'Primitives',
    breadcrumb: 'Primitives › Table',
    body: 'Headless table primitive for building custom data grids.',
    entryOrder: 0,
  },
  {
    id: 'table-primitive#sorting',
    kind: 'heading',
    title: 'Sorting',
    section: 'Primitives',
    breadcrumb: 'Primitives › Table › Sorting',
    body: 'Enable column sorting with the table withSorting() feature.',
    entryOrder: 1,
  },
  {
    id: 'table-primitive#column-visibility',
    kind: 'heading',
    title: 'Column visibility',
    section: 'Primitives',
    breadcrumb: 'Primitives › Table › Column visibility',
    body: 'Toggle table column visibility at runtime.',
    entryOrder: 2,
  },
  {
    id: 'table-primitive#row-selection',
    kind: 'heading',
    title: 'Row selection',
    section: 'Primitives',
    breadcrumb: 'Primitives › Table › Row selection',
    body: 'Single and multi row selection for the table.',
    entryOrder: 3,
  },
  {
    id: 'table-primitive#expansion',
    kind: 'heading',
    title: 'Expansion',
    section: 'Primitives',
    breadcrumb: 'Primitives › Table › Expansion',
    body: 'Expandable table rows for nested detail content.',
    entryOrder: 4,
  },
  {
    id: 'table-primitive#virtualization',
    kind: 'heading',
    title: 'Virtualization',
    section: 'Primitives',
    breadcrumb: 'Primitives › Table › Virtualization',
    body: 'Virtualized rendering for large tables.',
    entryOrder: 5,
  },
  {
    id: 'row-editing',
    kind: 'page',
    title: 'Row editing',
    section: 'Guides',
    breadcrumb: 'Guides › Row editing',
    body: 'Guide for inline row editing patterns.',
    entryOrder: 6,
  },
  {
    id: 'pagination',
    kind: 'page',
    title: 'Pagination',
    section: 'Guides',
    breadcrumb: 'Guides › Pagination',
    body: 'Server-side and client-side pagination.',
    entryOrder: 7,
  },
];

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

/**
 * Suggested queries for the no-results "Try searching for:" prefill chips
 * (`docs/gaps-ngp-reference.md` item 14). Reuses `SEARCH_INDEX_MOCK`'s section labels as the
 * best available proxy for "top-level nav sections" — this app's navbar doesn't have doc-section
 * links yet (`Discord`/`GitHub`/`Documentation` only), so this is a placeholder source until
 * real indexing (`Search Index.md`) lands.
 */
export const SEARCH_SUGGESTIONS_MOCK: readonly string[] = ['Primitives', 'Guides'];
