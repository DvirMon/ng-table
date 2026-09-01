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
 * S2 — the gated table (`withRowEdit()`). `multiple` reacts live to the in-story toggle button
 * (a signal passed straight through to `withRowEdit({ multiple })`, wrapped in `computed()`
 * internally). Note: `multiple: true` combined with optimistic save is explicitly
 * undesigned/unsupported (D31.2/G4) — leave "Save mode" on Pessimistic when exercising multiple
 * mode and Save All.
 */
export const MultipleMode: Story = {};
