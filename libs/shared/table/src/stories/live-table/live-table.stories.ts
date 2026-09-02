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
 */
export const Default: Story = {};
