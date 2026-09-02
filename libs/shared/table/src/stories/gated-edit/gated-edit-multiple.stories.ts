import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GatedEditStoryHostComponent } from './gated-edit-story-host.component';
import { rowEditHandlers } from '../row-edit.handlers';

type Host = InstanceType<typeof GatedEditStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing / Gated Edit / Multiple Mode',
  component: GatedEditStoryHostComponent,
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
 * Edits several rows at once.
 *
 * - Toggle "Multi row" in the story controls to switch live between single-row and multi-row
 *   editing.
 * - Multi-row editing with Optimistic save mode isn't supported yet — keep "Save mode" on
 *   Pessimistic when trying multiple mode and Save All.
 */
export const MultipleMode: Story = {};
