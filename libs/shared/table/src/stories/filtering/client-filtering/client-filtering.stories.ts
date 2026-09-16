import type { Meta, StoryObj } from '@storybook/angular-vite';
import { ClientFilteringStoryHostComponent } from './client-filtering-story-host.component';

const meta: Meta<ClientFilteringStoryHostComponent> = {
  title: 'Table / Filtering',
  component: ClientFilteringStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
};
export default meta;

type Story = StoryObj<ClientFilteringStoryHostComponent>;

/**
 * Table with client-side filtering
 *
 * Per-column inputs and a quick filter, all driven by `createFilters()` feeding
 * `withFiltering()`. Type in the customer box and watch the row count follow.
 *
 * Reset restores the declared defaults; Clear all empties every criterion.
 */
export const Client: Story = {};
