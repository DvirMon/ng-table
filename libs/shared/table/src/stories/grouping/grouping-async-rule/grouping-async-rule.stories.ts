import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GroupingAsyncRuleStoryHostComponent } from './grouping-async-rule-story-host.component';
import { groupingHandlers } from '../fixtures/handlers';

const meta: Meta<GroupingAsyncRuleStoryHostComponent> = {
  title: 'Table / Grouping',
  component: GroupingAsyncRuleStoryHostComponent,
  parameters: {
    layout: 'padded',
    msw: { handlers: groupingHandlers },
  },
  argTypes: {
    forceFailure: { control: 'boolean' },
    latencyMs: { control: { type: 'number', min: 0, max: 5000, step: 250 } },
    showCount: { control: 'boolean' },
  },
  args: {
    forceFailure: false,
    latencyMs: 2500,
    showCount: true,
  },
};
export default meta;

type Story = StoryObj<GroupingAsyncRuleStoryHostComponent>;

/**
 * Server-decided grouping — async rule
 *
 * Latency is set high enough that the pending window is visible without opening Controls.
 * While unresolved, the table holds the last explicit grouping rather than flashing ungrouped.
 *
 * Toggle `forceFailure` in Controls — the rule's `onError` resolves to actively grouped by
 * nothing, a different state from abstaining or a blank table.
 */
export const AsyncRule: Story = {};
