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
 * left to right, is consumer code over `toggleColumnVisibility` and `reorderColumns`.
 *
 * Switch `groupedColumnMode`, then toggle a column in the tab strip. `hide` sets
 * `visible: false` — the column stays in `table.columns()`, so the disposition reverses cleanly
 * when the level comes off.
 */
export const Columns: Story = {};
