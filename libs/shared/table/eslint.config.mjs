import nx from '@nx/eslint-plugin';
import baseConfig from '../../../eslint.config.mjs';

export default [
  { ignores: ['public/mockServiceWorker.js'] },
  ...baseConfig,
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared']
            }
          ]
        }
      ]
    }
  },
  {
    files: ['**/*.ts'],
    rules: {
      // `{}` here means "contributes nothing" as a type-parameter default
      // (`Members extends object = {}`), not an unconstrained value type.
      '@typescript-eslint/no-empty-object-type': ['error', { allowObjectTypes: 'always' }]
    }
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      // noop spy bodies: `mockImplementation(() => {})`
      '@typescript-eslint/no-empty-function': 'off',
      // `@ts-expect-error` type assertions read or assign a member for its compile error
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-self-assign': 'off'
    }
  },
  {
    files: ['**/*.html'],
    rules: {}
  }
];
