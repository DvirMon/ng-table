import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GatedSinglePessimisticStoryHostComponent } from './gated-single-pessimistic-story-host.component';
import { rowEditHandlers } from '../fixtures/handlers';

type Host = InstanceType<typeof GatedSinglePessimisticStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing',
  component: GatedSinglePessimisticStoryHostComponent,
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
 * Single-row gated editing, pessimistic
 *
 * Edits one row at a time, saving pessimistically: the row stays open until a real fetch
 * resolves. Starting a new edit while one is already open cancels whatever was in progress.
 *
 * Toggle `forceFailure` in Controls: the row stays open, the error shows inline, and Retry
 * re-runs the same request — no rollback needed since nothing closed early.
 */
export const GatedSinglePessimistic: Story = {};
