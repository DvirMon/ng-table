import type { StorybookConfig } from '@storybook/angular-vite';

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)', '../src/stories/**/*.mdx'],
  staticDirs: ['../public'],
  addons: ['msw-storybook-addon', '@storybook/addon-docs'],
  framework: {
    name: '@storybook/angular-vite',
    options: {},
  },
};

export default config;
