import type { HomeContent } from './home.types';

/**
 * Home's authored marketing copy (`docs/CONVENTIONS.md` #5). Every claim here must be verifiable
 * against `libs/shared/table`'s own docs (`README.md`, `CLAUDE.md`) — no invented benchmarks,
 * adoption numbers, or version numbers.
 */
export const HOME_CONTENT: HomeContent = {
  hero: {
    announcement: 'Built for Angular 19+',
    announcementStatus: 'success',
    h1: 'A headless table primitive for Angular',
    lede: 'State management, column schema, and attribute-only UI directives — compose the table you need, style every pixel yourself.',
    primaryLabel: 'Get Started',
    secondaryLabel: 'View on GitHub',
  },
  features: {
    eyebrow: 'About',
    heading: "Everything a table needs, nothing it doesn't",
    cells: [
      {
        icon: 'lucideTable',
        title: 'createTable()',
        description: 'One factory returns a table instance — no class to extend, no store to configure by hand.',
      },
      {
        icon: 'lucideColumns3',
        title: 'Column schema',
        description: 'Define columns once with createTableSchema() and columnSchema(); the table derives the rest.',
      },
      {
        icon: 'lucideTag',
        title: 'Attribute-only directives',
        description: 'ngp-prefixed directives style your table — never insert, remove, or reorder DOM.',
      },
      {
        icon: 'lucidePuzzle',
        title: 'Feature plugins',
        description: "Opt into withSorting() and withExpansion() by adding them to the features array — nothing ships you don't use.",
      },
      {
        icon: 'lucideRows',
        title: 'Raw row data',
        description: 'rows() yields your row type directly, with layout and state fields colocated — no wrapper objects to unwrap.',
      },
      {
        icon: 'lucideZap',
        title: 'Zero runtime dependencies',
        description: 'Nothing beyond @angular/core. State lives in signals; UI state lives in data-* attributes.',
      },
    ],
  },
  install: {
    eyebrow: 'Get Started',
    heading: 'Install and go',
    description: 'Add the package and start composing.',
    command: 'npm install @acme/table',
  },
  footerLinks: [
    { label: 'Sponsor', href: '#' },
    { label: 'Discord', href: '#' },
    { label: 'GitHub', href: '#' },
  ],
  footerCopyright: 'Copyright © 2026 NGP Table',
};
