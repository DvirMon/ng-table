import type { Meta, StoryObj } from '@storybook/angular-vite';
import { SortingEditingStoryHostComponent } from './sorting-editing-story-host.component';

type Host = InstanceType<typeof SortingEditingStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing',
  component: SortingEditingStoryHostComponent,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<Host>;

/**
 * Sorting × Editing
 *
 * Sorting a column with an edited-to-empty value places it predictably. Keeping an open row
 * in place while the table re-sorts around it does not work yet — a known limitation.
 */
export const SortingAndEditing: Story = {
  name: 'Sorting × Editing',};
