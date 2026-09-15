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
 * A grouping level decided by the server, through an `applyGroupingAsync()`-shaped column rule —
 * grouping's one genuinely async surface.
 *
 * The latency is set high enough that the pending window is visible without opening Controls.
 * While the rule is unresolved the whole rule set abstains and the table **holds the last explicit
 * grouping** rather than flashing ungrouped; when it resolves, the level set becomes the rule's.
 */
/**
 * Turn on `forceFailure` and the rule's required `onError` resolves the set to `[]` — actively
 * grouped by nothing, which is not the same state as abstaining, and not a blank table either.
 * A control rather than a second story: it differs from this one by a single boolean.
 */
export const AsyncRule: Story = {};
