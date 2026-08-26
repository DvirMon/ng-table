import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GatedEditStoryHostComponent } from './gated-edit-story-host.component';

type Host = InstanceType<typeof GatedEditStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing / Gated Edit / Single Mode',
  component: GatedEditStoryHostComponent,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<Host>;

/**
 * S2 — the gated table (`withRowEdit()`) in single-row mode. `multiple` defaults to `false`;
 * use the in-story toggle button to switch modes live (no table rebuild).
 */
export const SingleMode: Story = {};
