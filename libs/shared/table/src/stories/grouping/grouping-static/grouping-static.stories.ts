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
 * Static grouping, full canvas
 *
 * Group headers show value, row count, and amount total at every depth, aggregating each
 * subtree. Toggle a column in the tab strip to add a grouping level; reorder or remove levels
 * from the pills below.
 *
 * Blank group keys (`null`/`undefined`/`''`) still cluster as unlabelled groups unless the
 * column declares an `accessor`.
 */
export const Static: Story = {};
