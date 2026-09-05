import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { applicationConfig } from '@storybook/angular-vite';
import { mswLoader } from 'msw-storybook-addon/csf3';
import type { Preview } from '@storybook/angular-vite';

const preview: Preview = {
  loaders: [mswLoader()],
  decorators: [applicationConfig({ providers: [provideZonelessChangeDetection(), provideHttpClient()] })],
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
