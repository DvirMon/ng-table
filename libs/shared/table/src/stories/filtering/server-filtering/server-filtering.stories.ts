import type { Meta, StoryObj } from '@storybook/angular-vite';
import { filteringHandlers } from '../fixtures/handlers';
import { ServerFilteringStoryHostComponent } from './server-filtering-story-host.component';

const meta: Meta<ServerFilteringStoryHostComponent> = {
  title: 'Table / Filtering',
  component: ServerFilteringStoryHostComponent,
  parameters: {
    layout: 'padded',
    msw: { handlers: filteringHandlers },
  },
  argTypes: {
    forceFailure: { control: 'boolean' },
    latencyMs: { control: { type: 'number', min: 0, max: 3000, step: 100 } },
  },
  args: {
    forceFailure: false,
    latencyMs: 600,
  },
};
export default meta;

type Story = StoryObj<ServerFilteringStoryHostComponent>;

/**
 * Server-side filtering, happy path
 *
 * Every filter change issues one `GET /api/invoices`; the search box waits out its debounce
 * first, so the request counter rises per typing pause, not per keystroke. `totalRowCount()`
 * is the server's `total`, rendered beside the page length.
 */
export const Server: Story = {};

/**
 * Server-side filtering — request failure
 *
 * Every request fails. The rows already on screen stay there behind the error marker — the
 * table never blanks — and Retry re-sends the current filter set rather than resetting it.
 */
export const ServerRequestFailure: Story = {
  name: 'Server — Request Failure',
  args: { forceFailure: true },
};
