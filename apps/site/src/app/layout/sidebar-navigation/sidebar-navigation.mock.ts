import type { NavRootEntry, NavSection } from './sidebar-navigation.types';

/**
 * Source of truth: `docs/design-handoff/specs/Content Model.md` § Seed tree.
 * Keep in sync — this file is a transcription, not a second authority.
 */
export const DOCS_NAV_ROOT: NavRootEntry = {
  label: 'Overview',
  slug: '/overview',
};

export const DOCS_NAV_SECTIONS: readonly NavSection[] = [
  {
    heading: '0. Getting Started',
    entries: [
      { label: 'Introduction', slug: '/getting-started/introduction' },
      { label: 'Installation', slug: '/getting-started/installation' },
      { label: 'First Table', slug: '/getting-started/first-table' },
      { label: 'Building a Custom Feature', slug: '/getting-started/custom-feature' },
    ],
  },
  {
    heading: '1. State Layer',
    entries: [
      { label: 'Columns', slug: '/state-layer/columns' },
      { label: 'Row Mutations', slug: '/state-layer/row-mutations' },
      { label: 'Drag & Drop', slug: '/state-layer/drag-drop' },
      { label: 'Expansion', slug: '/state-layer/expansion' },
      { label: 'Filtering', slug: '/state-layer/filtering' },
      { label: 'Grouping', slug: '/state-layer/grouping' },
      { label: 'Infinite Scroll', slug: '/state-layer/infinite-scroll' },
      { label: 'Pagination', slug: '/state-layer/pagination' },
      { label: 'Row Editing', slug: '/state-layer/row-editing' },
      { label: 'Selection', slug: '/state-layer/selection' },
      { label: 'Sorting', slug: '/state-layer/sorting' },
      { label: 'Virtual Scroll', slug: '/state-layer/virtual-scroll' },
    ],
  },
  {
    heading: '2. Columns',
    entries: [
      { label: 'Column Metadata', slug: '/columns/column-metadata' },
      { label: 'Data-Derived Columns', slug: '/columns/data-derived' },
      { label: 'Ownership Model', slug: '/columns/ownership-model' },
      { label: 'Signal Forms Techniques', slug: '/columns/signal-forms-techniques' },
      { label: 'Tier 1 — Intrinsic', slug: '/columns/tier-1-intrinsic' },
      { label: 'Tier 2 — Layout', slug: '/columns/tier-2-layout' },
      { label: 'Tier 3 — Feature Config', slug: '/columns/tier-3-feature-config' },
    ],
  },
  {
    heading: '3. UI Layer',
    entries: [
      { label: 'Core Directives', slug: '/ui-layer/core' },
      { label: 'Column Identity', slug: '/ui-layer/columns' },
      { label: 'Sort', slug: '/ui-layer/sort' },
      { label: 'Selection', slug: '/ui-layer/selection' },
      { label: 'Expansion', slug: '/ui-layer/expansion' },
      { label: 'Grouping', slug: '/ui-layer/grouping' },
      { label: 'Drag & Drop', slug: '/ui-layer/drag-drop' },
      { label: 'Resizing', slug: '/ui-layer/resizing' },
      { label: 'Row Reorder Animation', slug: '/ui-layer/row-animation', hidden: true },
      { label: 'Accessibility', slug: '/ui-layer/accessibility' },
      { label: 'Styling & Tokens', slug: '/ui-layer/styling-tokens' },
      { label: 'Virtual Scroll', slug: '/ui-layer/virtual-scroll' },
    ],
  },
];
