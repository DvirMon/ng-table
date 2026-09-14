import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { applicationConfig } from '@storybook/angular-vite';
import { mswLoader } from 'msw-storybook-addon/csf3';
import type { Preview } from '@storybook/angular-vite';
import type { SourceParameters } from '@storybook/addon-docs/blocks';

const transformDocsSource: SourceParameters['transform'] = (source, { parameters }) =>
  (parameters['docs']?.['source']?.['code'] as string | undefined) ?? source;

const preview: Preview = {
  loaders: [mswLoader()],
  decorators: [applicationConfig({ providers: [provideZonelessChangeDetection(), provideHttpClient()] })],
  parameters: {
    docs: {
      source: {
        transform: transformDocsSource,
      },
    },
  },
};

export default preview;
