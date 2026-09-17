import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GatedMultipleOptimisticStoryHostComponent } from './gated-multiple-optimistic-story-host.component';
import { rowEditHandlers } from '../fixtures/handlers';

type Host = InstanceType<typeof GatedMultipleOptimisticStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing',
  component: GatedMultipleOptimisticStoryHostComponent,
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
 * Multi-row gated editing, optimistic
 *
 * Open two or more rows via Edit, edit them, click "Save All". Every row closes immediately
 * and shows as saving, then each settles independently as its own request resolves.
 *
 * Toggle `forceFailure` in Controls: rows still close immediately, but each one reverts to
 * its pre-edit value and shows its own Retry/Dismiss control.
 */
export const GatedMultipleOptimistic: Story = {};
