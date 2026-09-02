import type { Meta, StoryObj } from '@storybook/angular-vite';
import { SortingEditingStoryHostComponent } from './sorting-editing-story-host.component';

type Host = InstanceType<typeof SortingEditingStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing / Sorting × Editing',
  component: SortingEditingStoryHostComponent,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<Host>;

/**
 * Sorting combined with row editing.
 *
 * - Sorting a column with an edited-to-empty value places it predictably (this works today).
 * - Keeping an open row in place while the table re-sorts around it does not work yet — a known
 *   limitation, see the story's host component for detail.
 */
export const Default: Story = {};
