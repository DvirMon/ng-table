import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GroupingCollapsibleStoryHostComponent } from './grouping-collapsible-story-host.component';
import { groupingHandlers } from '../fixtures/handlers';

const meta: Meta<GroupingCollapsibleStoryHostComponent> = {
  title: 'Table / Grouping',
  component: GroupingCollapsibleStoryHostComponent,
  parameters: {
    layout: 'padded',
    msw: { handlers: groupingHandlers },
  },
  argTypes: {
    forceFailure: { control: 'boolean' },
    latencyMs: { control: { type: 'number', min: 0, max: 3000, step: 100 } },
  },
  args: {
    forceFailure: false,
    latencyMs: 600,
  },
};
export default meta;

type Story = StoryObj<GroupingCollapsibleStoryHostComponent>;

/**
 * Collapsible grouping, starts collapsed
 *
 * A three-level outline that opens fully collapsed. Expand a group header's chevron to reveal
 * its subtree. Collapse state survives Refetch and sort changes, but resets when Regroup
 * re-nests the hierarchy.
 */
export const Collapsible: Story = {};

/**
 * Collapsible grouping — refresh failure
 *
 * Refetch fails on every attempt, exercising the error path: collapse state must survive a
 * failed refresh with nothing left half-applied.
 */
export const CollapsibleRefreshFailure: Story = {
  name: 'Collapsible — Refresh Failure',
  args: { forceFailure: true },
};
