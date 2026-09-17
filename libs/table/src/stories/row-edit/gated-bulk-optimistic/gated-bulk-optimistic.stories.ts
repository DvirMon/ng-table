import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GatedBulkOptimisticStoryHostComponent } from './gated-bulk-optimistic-story-host.component';
import { rowEditHandlers } from '../fixtures/handlers';

type Host = InstanceType<typeof GatedBulkOptimisticStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing',
  component: GatedBulkOptimisticStoryHostComponent,
  parameters: {
    layout: 'padded',
    msw: { handlers: rowEditHandlers },
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

type Story = StoryObj<Host>;

/**
 * Bulk row creation, gated save
 *
 * "Add N rows" opens `count` blank rows at once, then "Save batch" sends one request for all
 * of them — on success every row gets its server id in the same pass.
 *
 * Toggle `forceFailure` in Controls: the single request fails and every row in the batch
 * reverts to blank and reopens together, not some succeeding while others fail.
 */
export const GatedBulk: Story = {};
