import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GroupingWhenStoryHostComponent } from './grouping-when-story-host.component';

const meta: Meta<GroupingWhenStoryHostComponent> = {
  title: 'Table / Grouping',
  component: GroupingWhenStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    keepBlankRegionsFlat: { control: 'boolean' },
    applyMinCategorySize: { control: 'boolean' },
    minCategoryRowCount: { control: 'number' },
    showCount: { control: 'boolean' },
  },
  args: {
    keepBlankRegionsFlat: false,
    applyMinCategorySize: false,
    minCategoryRowCount: 2,
    showCount: true,
  },
};
export default meta;

type Story = StoryObj<GroupingWhenStoryHostComponent>;

/**
 * Cluster admission — `when`
 *
 * Which clusters survive, decided by two predicates that AND together: the table-wide
 * `WithGroupingConfig.when`, judged at every active level, and a per-column `when` off an
 * `applyGrouping` rule, judged for its own column only.
 *
 * A rejected cluster is not hidden. Its rows render flat at the parent's depth — no header, no
 * group id, no aggregates — so rejecting at level 1 also takes those rows out of level 2.
 *
 * `keepBlankRegionsFlat` turns on the table-wide rule, `applyMinCategorySize` the per-column one.
 * Turn on both to see them combine.
 */
export const When: Story = {};
