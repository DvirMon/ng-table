import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GroupingSelectionStoryHostComponent } from './grouping-selection-story-host.component';

const meta: Meta<GroupingSelectionStoryHostComponent> = {
  title: 'Table / Grouping',
  component: GroupingSelectionStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    cascade: {
      control: 'radio',
      options: ['self', 'descendants', 'descendants+parents'],
    },
  },
  args: {
    cascade: 'descendants',
  },
};
export default meta;

type Story = StoryObj<GroupingSelectionStoryHostComponent>;

/**
 * Group selection, reference wiring
 *
 * The reference wiring for a group checkbox — the library ships no built-in cascade. Switch
 * `cascade` to compare the three defaults, all plain consumer code over one `rowsOf()` call.
 *
 * A partly-selected group renders indeterminate, derived fresh on every render; Ungroup leaves
 * the selection intact since no group id was ever a member.
 */
export const GroupSelection: Story = {};
