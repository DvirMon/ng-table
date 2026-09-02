import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GatedEditStoryHostComponent } from './gated-edit-story-host.component';
import { rowEditHandlers } from '../row-edit.handlers';

type Host = InstanceType<typeof GatedEditStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing / Gated Edit / Single Mode',
  component: GatedEditStoryHostComponent,
  parameters: {
    layout: 'padded',
    // Network calls only fire when "Save mode" is switched to Optimistic in the story controls.
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
 * Edits one row at a time. Starting a new edit cancels whatever was in progress.
 *
 * - Toggle "Multi row" in the story controls to allow editing several rows at once.
 * - Toggle "Save mode" to Optimistic to see saves go over the network.
 * - `forceFailure` and `latencyMs` only affect Optimistic save mode.
 */
export const SingleMode: Story = {};
