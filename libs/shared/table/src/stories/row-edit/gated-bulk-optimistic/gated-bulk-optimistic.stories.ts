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
 * Adding several rows in one action, the happy path.
 *
 * - "Add N rows" opens `count` blank rows at once — one `createRow` call, not a loop.
 * - Fill them in, click "Save batch" — one request carries all of them.
 * - On success every row gets its server id in the same pass.
 */
export const GatedBulk: Story = {};

/**
 * A batch where the single request fails.
 *
 * - Every row in the batch reverts to blank and reopens together — not some succeeding while
 *   others fail, which is exactly the contrast with `../gated-multiple-optimistic/`'s Save All
 *   (N independent requests, N independent outcomes).
 */
export const GatedBulkFailure: Story = {
  name: 'Gated Bulk — Failure',
  args: { forceFailure: true },
};
