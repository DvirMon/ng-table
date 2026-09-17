import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  {
    ignores: ['apps/ng-table/docs/design-handoff/**'],
  },
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'ngpt',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        [
          {
            type: 'element',
            prefix: 'ngpt',
            style: 'kebab-case',
          },
          {
            // Attribute-hosted components (ADR-0005): hosted on a real native element (e.g.
            // `button[ngptPillButton]`) so a caller-bound directive (ARIA/focus wiring like
            // `[ngpMenuTrigger]`) lands on that actual element instead of a wrapper — see
            // design-system/pill-button/docs/decisions.md. camelCase matches Angular's own
            // directive-selector convention (`ngpMenuTrigger`, `ngpTableCell`).
            type: 'attribute',
            prefix: 'ngpt',
            style: 'camelCase',
          },
        ],
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
