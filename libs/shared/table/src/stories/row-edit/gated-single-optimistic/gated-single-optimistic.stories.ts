import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GatedSingleOptimisticStoryHostComponent } from './gated-single-optimistic-story-host.component';
import { rowEditHandlers } from '../fixtures/handlers';

type Host = InstanceType<typeof GatedSingleOptimisticStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing / Gated / Single / Optimistic',
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
 */
export const Default: Story = {};

/**
 * A save that fails: the row still closes immediately, then reverts to its pre-edit snapshot
 * and reopens once Retry is clicked (`retrySave`).
 */
export const ForcedFailure: Story = {
  args: { forceFailure: true },
};
