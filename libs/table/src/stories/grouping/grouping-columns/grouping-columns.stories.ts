import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GroupingColumnsStoryHostComponent } from './grouping-columns-story-host.component';

const meta: Meta<GroupingColumnsStoryHostComponent> = {
  title: 'Table / Grouping',
  component: GroupingColumnsStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    groupedColumnMode: {
      control: 'radio',
      options: ['keep', 'hide', 'move-to-front'],
    },
    showCount: { control: 'boolean' },
  },
  args: {
    groupedColumnMode: 'keep',
    showCount: true,
  },
};
export default meta;

type Story = StoryObj<GroupingColumnsStoryHostComponent>;

/**
 * What happens to a column once it becomes a level
 *
 * `withGrouping()` does not touch the column list. Whether a grouped column keeps its place,
 * disappears because the header already says its value, or moves to the front so the levels read
 * left to right, is consumer code — a `computed()` over `table.columns()` and `table.grouping()`.
 *
 * Switch `groupedColumnMode`, then toggle a column in the tab strip. The disposition only shapes
 * what is rendered; `table.columns()` is never written, so the user's own layout survives every
 * mode switch and the disposition reverses cleanly when the level comes off.
 */
export const Columns: Story = {};
