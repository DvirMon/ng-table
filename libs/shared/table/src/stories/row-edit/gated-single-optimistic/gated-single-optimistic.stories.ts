import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GatedSingleOptimisticStoryHostComponent } from './gated-single-optimistic-story-host.component';
import { rowEditHandlers } from '../fixtures/handlers';

type Host = InstanceType<typeof GatedSingleOptimisticStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing',
  component: GatedSingleOptimisticStoryHostComponent,
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
 * The happy path: edits one row at a time, save closes it immediately and confirms over the
 * network. Starting a new edit while one is already open cancels whatever was in progress.
 *
 * Turn on `forceFailure` in Controls for the unhappy path: the row still closes immediately, then
 * reverts to its pre-edit snapshot and reopens once Retry is clicked (`retrySave`). One boolean
 * away from the happy path, so it is a control rather than a second canvas.
 */
export const GatedSingleOptimistic: Story = {};
