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
 * The reference wiring for a group checkbox, which the library deliberately does not ship (D16).
 *
 * - `cascade` switches between the three defaults AG Grid, TanStack and MUI X disagree on — all
 *   three written as ordinary consumer code off one `rowsOf()` call.
 * - A partly-selected group renders indeterminate; the state is derived every render, never stored,
 *   which is why the "parents" direction needs no code.
 * - Filter by rep, then tick a group: the checkbox and the header's count are the same set.
 * - The readout counts rows and never headers, and Ungroup leaves the selection intact — no group
 *   id was ever in it to dangle.
 *
 * Every verb here is synchronous and local, so there is no rollback state that only renders on an
 * unhappy path, and no `ForcedFailure` export is earned.
 */
export const GroupSelection: Story = {};
