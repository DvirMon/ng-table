import type { Meta, StoryObj } from '@storybook/angular-vite';
import { LiveTableStoryHostComponent } from './live-table-story-host.component';
import { rowEditHandlers } from '../fixtures/handlers';

const meta: Meta<LiveTableStoryHostComponent> = {
  title: 'Table / Row Editing',
  component: LiveTableStoryHostComponent,
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

type Story = StoryObj<LiveTableStoryHostComponent>;

/**
 * Live table, no edit session
 *
 * Every row's fields are always editable — no edit mode to enter. Blur or change a field to
 * commit it and fire a real save request; the trash icon discards a row immediately, with
 * Undo (or Ctrl/Cmd+Z) restoring whichever happened last.
 *
 * Toggle `forceFailure` in Controls: an edit reverts to its pre-commit value, a create keeps
 * typed values for Retry, and a discard comes back instead of disappearing.
 */
export const LiveBase: Story = {};
