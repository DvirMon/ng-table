import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GroupingBasicStoryHostComponent } from './grouping-basic-story-host.component';

const meta: Meta<GroupingBasicStoryHostComponent> = {
  title: 'Table / Grouping',
  component: GroupingBasicStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    showCount: { control: 'boolean' },
    stickyHeaders: { control: 'boolean' },
  },
  args: {
    showCount: true,
    stickyHeaders: false,
  },
};
export default meta;

type Story = StoryObj<GroupingBasicStoryHostComponent>;

/**
 * Grouping, the baseline
 *
 * `withGrouping({ initial: ['region', 'category'] })` and nothing else — the whole feature, with
 * no schema and no second feature composed. Start here.
 *
 * Array order is nesting order. The tab strip adds or removes a column as a level, the pills
 * reorder and remove them, and every write is an updater on `table.grouping`:
 * `addGroupLevel`, `removeGroupLevel`, `reorderGroupLevels`, `setGroupLevels`.
 *
 * Blank group keys (`null`/`undefined`/`''`) cluster as unlabelled groups. Rejecting them is
 * `when`'s job — see `grouping-when`.
 */
export const Basic: Story = {};
