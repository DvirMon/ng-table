import { mswLoader } from 'msw-storybook-addon/csf3';
import type { Preview } from '@storybook/angular-vite';

const preview: Preview = {
  loaders: [mswLoader()],
  parameters: {
    docs: {
      source: {
        transform: (source, { parameters }) =>
          (parameters['docs']?.['source']?.['code'] as string | undefined) ?? source,
      },
    },
  },
};

export default preview;
