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
    applyMinCategorySize: { control: 'boolean' },
    minCategoryRowCount: { control: 'number' },
  },
  args: {
    showCount: true,
    groupedColumnMode: 'keep',
    stickyHeaders: false,
    keepBlankRegionsFlat: false,
    applyMinCategorySize: false,
    minCategoryRowCount: 2,
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
 * `when: (cluster) => isPresentKey(cluster.key)` is how a consumer opts out — a rejected
 * cluster's rows render flat at the parent's depth instead. With `STATIC_GROUPING_LEVELS` at
 * `['region', 'category']`, opted-out rows leave the tree entirely and are not grouped by
 * `category` either. See `BlankRegionsFlat` below, or flip `keepBlankRegionsFlat` in the
 * Controls panel.
 *
 * The `applyMinCategorySize` toggle demonstrates a per-column `when` threshold on the
 * `category` level, AND-combined with the table-wide blank-region rule: a category cluster
 * with fewer than `minCategoryRowCount` rows dissolves to flat rows, independent of whether
 * its region is blank. Adjust `minCategoryRowCount` to see different collapse thresholds.
 */
export const Static: Story = {};

/**
 * Deals with no region stay flat
 *
 * `when: (cluster) => isPresentKey(cluster.key)` rejects the blank-region cluster, so its
 * rows render at the parent's depth with no header — one flat run, not one merged group, and
 * with no comparator supplied they land after the groups that were admitted.
 */
export const BlankRegionsFlat: Story = { args: { keepBlankRegionsFlat: true } };

/**
 * Two levels with different thresholds
 *
 * Demonstrates AND-combination of table-wide and per-column `when`: blank-region clusters
 * are rejected (table-wide), AND category clusters smaller than 2 rows are also rejected
 * (per-column). Single-row categories under any region (including non-blank) flatten.
 */
export const TwoLevelsWithThresholds: Story = {
  args: { keepBlankRegionsFlat: true, applyMinCategorySize: true, minCategoryRowCount: 2 },
};
