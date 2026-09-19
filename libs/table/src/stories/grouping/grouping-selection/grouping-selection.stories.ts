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
      options: ['self', 'descendants'],
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
 * `cascade` to compare the peer defaults, all plain consumer code over one `rowsOf()` call.
 *
 * Cascading to *parents* is not a third option, because it needs no write: a group's tri-state
 * derives from `selectionStateOf()` on every render, so ancestors follow on their own.
 *
 * A partly-selected group renders indeterminate, derived fresh on every render; Ungroup leaves
 * the selection intact since no group id was ever a member.
 */
export const GroupSelection: Story = {};
