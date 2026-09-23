import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GroupingEditingStoryHostComponent } from './grouping-editing-story-host.component';

type Host = InstanceType<typeof GroupingEditingStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing',
  component: GroupingEditingStoryHostComponent,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<Host>;

/**
 * Grouping × Editing
 *
 * Picking a category from a row's dropdown regroups the table immediately — including into a
 * brand-new group section for a category that has never been picked before. Group headers stay
 * alphabetical through edits and through sorting by name.
 */
export const GroupingAndEditing: Story = {
  name: 'Grouping × Editing',
};
