import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GatedEditStoryHostComponent } from './gated-edit-story-host.component';

type Host = InstanceType<typeof GatedEditStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing / Gated Edit / Multiple Mode',
  component: GatedEditStoryHostComponent,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<Host>;

/**
 * S2 — the gated table (`withRowEdit()`). `multiple` reacts live to the in-story toggle button
 * (a signal passed straight through to `withRowEdit({ multiple })`, wrapped in `computed()`
 * internally). Note: `multiple: true` combined with optimistic save is explicitly
 * undesigned/unsupported (D31.2/G4) — this story only exercises multiple mode with the
 * pessimistic save path.
 */
export const MultipleMode: Story = {};
