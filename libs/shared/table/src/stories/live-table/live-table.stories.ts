import type { Meta, StoryObj } from '@storybook/angular-vite';
import { LiveTableStoryHostComponent } from './live-table-story-host.component';

const meta: Meta<LiveTableStoryHostComponent> = {
  title: 'Table / Row Editing / Live Table',
  component: LiveTableStoryHostComponent,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<LiveTableStoryHostComponent>;

/**
 * The simplest editable table — every row's fields are always editable, no edit mode to enter.
 *
 * - Blur the name field or change the department to see the save counter tick up.
 * - Typing alone doesn't save anything until you commit the change (blur or change).
 * - The trash icon discards a row immediately, with no confirm dialog — Undo (or Ctrl/Cmd+Z) puts
 *   it back at the index it was removed from.
 * - One undo slot covers both: it restores whichever happened last, a field commit or a discard.
 */
export const Default: Story = {};
