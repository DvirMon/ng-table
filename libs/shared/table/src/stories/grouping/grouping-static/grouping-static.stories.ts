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
    keepBlankRegionsFlat: { control: 'boolean' },
  },
  args: {
    showCount: true,
    groupedColumnMode: 'keep',
    stickyHeaders: false,
    keepBlankRegionsFlat: false,
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
 * Blank group keys (`null`/`undefined`/`''`) cluster as unlabelled groups by default.
 * `groupWhen: (cluster) => isPresentKey(cluster.key)` is how a consumer opts out — a rejected
 * cluster's rows render flat at the parent's depth instead. With `STATIC_GROUPING_LEVELS` at
 * `['region', 'category']`, opted-out rows leave the tree entirely and are not grouped by
 * `category` either. See `BlankRegionsFlat` below, or flip `keepBlankRegionsFlat` in the
 * Controls panel.
 */
export const Static: Story = {};

/**
 * Deals with no region stay flat
 *
 * `groupWhen: (cluster) => isPresentKey(cluster.key)` rejects the blank-region cluster, so its
 * rows render at the parent's depth with no header — one flat run, not one merged group, and
 * with no comparator supplied they land after the groups that were admitted.
 */
export const BlankRegionsFlat: Story = { args: { keepBlankRegionsFlat: true } };
