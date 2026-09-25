import type { StorybookConfig } from '@storybook/angular-vite';

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(ts|tsx)', '../src/stories/**/*.mdx'],
  staticDirs: ['../public'],
  addons: ['msw-storybook-addon', '@storybook/addon-docs'],
  // Profiling-only stories: hidden from the sidebar by default, still reachable by their
  // `iframe.html?id=…` URL (e.g. for a Chrome DevTools recording).
  tags: { profile: { defaultFilterSelection: 'exclude' } },
  framework: {
    name: '@storybook/angular-vite',
    options: {},
  },
};

export default config;
