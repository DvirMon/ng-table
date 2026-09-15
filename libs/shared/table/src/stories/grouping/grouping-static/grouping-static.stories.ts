import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GroupingStaticStoryHostComponent } from './grouping-static-story-host.component';

const meta: Meta<GroupingStaticStoryHostComponent> = {
  title: 'Table / Grouping',
  component: GroupingStaticStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    showCount: { control: 'boolean' },
    groupedColumnMode: {
      control: 'radio',
      options: ['keep', 'hide', 'move-to-front'],
    },
    stickyHeaders: { control: 'boolean' },
  },
  args: {
    showCount: true,
    groupedColumnMode: 'keep',
    stickyHeaders: false,
  },
};
export default meta;

type Story = StoryObj<GroupingStaticStoryHostComponent>;

/**
 * The grouped table as its own product — always fully shown, no expand/collapse control, because
 * nothing here expands.
 *
 * - Every group header carries its value, its row count and its `amount` total, at every depth; a
 *   parent's total is the sum of its subtree.
 * - "rep contains" filters the rows: counts and totals follow the visible rows, and a group whose
 *   rows all filter out disappears entirely.
 * - The tab strip above the table is one toggle per column — pressed means "a grouping level" —
 *   and the pills below it reorder and remove those levels. One control per column, one boolean
 *   state, so adding a duplicate level is unreachable from the UI rather than a no-op to explain.
 * - `groupedColumnMode` shows the three dispositions the major libraries disagree on.
 * - Blank group keys (`null` / `undefined` / `''`) still cluster as three unlabelled groups;
 *   `owner` does not, because its column declares an `accessor`.
 */
export const Static: Story = {};
