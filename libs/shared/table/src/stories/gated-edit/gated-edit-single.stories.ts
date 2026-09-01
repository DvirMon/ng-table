import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GatedEditStoryHostComponent } from './gated-edit-story-host.component';
import { rowEditHandlers } from '../row-edit.handlers';

type Host = InstanceType<typeof GatedEditStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing / Gated Edit / Single Mode',
  component: GatedEditStoryHostComponent,
  parameters: {
    layout: 'padded',
    // Only exercised when the in-story "Save mode" toggle is flipped to Optimistic — the
    // pessimistic path (default) never hits the network.
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
 * S2/S4 — the gated table (`withRowEdit()`) in single-row mode. `multiple` defaults to `false`;
 * use the in-story toggle buttons to switch multiple-mode or save-mode live (no table rebuild).
 * `forceFailure`/`latencyMs` only apply once "Save mode" is toggled to Optimistic.
 */
export const SingleMode: Story = {};
