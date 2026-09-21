import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GroupingAggregatesStoryHostComponent } from './grouping-aggregates-story-host.component';

const meta: Meta<GroupingAggregatesStoryHostComponent> = {
  title: 'Table / Grouping',
  component: GroupingAggregatesStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    showCount: { control: 'boolean' },
  },
  args: {
    showCount: true,
  },
};
export default meta;

type Story = StoryObj<GroupingAggregatesStoryHostComponent>;

/**
 * Group aggregates — `applyAggregate`
 *
 * Declared through `withGrouping({ schema })`, keyed by declared column id like every other data
 * concern — not a column option. That is what lets a column with no row field of its own, like
 * this story's `amount` total, carry a summary value. Every header at every depth gets one,
 * computed over that cluster's own leaves — so a parent total is the sum of its whole subtree.
 *
 * Aggregates are post-filter by construction: `filter` precedes `group` in the pipeline.
 *
 * The toolbar poisons one row so `sumAmount` throws. Per ADR-0014 the table stays up — that one
 * column's aggregate falls back to `undefined` for the affected groups, reported once per column
 * per evaluation, with every other column untouched.
 */
export const Aggregates: Story = {};
