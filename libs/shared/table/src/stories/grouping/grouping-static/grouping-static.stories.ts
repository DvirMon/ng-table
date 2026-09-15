import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GroupingStaticStoryHostComponent } from './grouping-static-story-host.component';
import { groupingHandlers } from '../fixtures/handlers';

const meta: Meta<GroupingStaticStoryHostComponent> = {
  title: 'Table / Grouping / Static',
  component: GroupingStaticStoryHostComponent,
  parameters: {
    layout: 'padded',
    msw: { handlers: groupingHandlers },
  },
  argTypes: {
    showCount: { control: 'boolean' },
    groupOrder: {
      control: 'select',
      options: ['first-occurrence', 'by-label', 'by-count', 'external-list', 'throwing'],
    },
    groupedColumnMode: {
      control: 'radio',
      options: ['keep', 'hide', 'move-to-front'],
    },
    stickyHeaders: { control: 'boolean' },
    asyncGroupingRule: { control: 'boolean' },
    forceFailure: { control: 'boolean' },
    latencyMs: { control: { type: 'number', min: 0, max: 5000, step: 250 } },
  },
  args: {
    showCount: true,
    groupOrder: 'first-occurrence',
    groupedColumnMode: 'keep',
    stickyHeaders: false,
    asyncGroupingRule: false,
    forceFailure: false,
    latencyMs: 2500,
  },
};
export default meta;

type Story = StoryObj<GroupingStaticStoryHostComponent>;

/**
 * The grouped table as its own product — always fully shown, no expand/collapse control, because
 * nothing here expands.
 *
 * - Every group header carries its value, its row count and its `amount` total, at every depth; a
 *   parent's total is the sum of its subtree.
 * - "rep contains" filters the rows: counts and totals follow the visible rows, and a group whose
 *   rows all filter out disappears entirely.
 * - The tab strip above the table is one toggle per column — pressed means "a grouping level" —
 *   and the pills below it reorder and remove those levels. One control per column, one boolean
 *   state, so adding a duplicate level is unreachable from the UI rather than a no-op to explain.
 * - `groupedColumnMode` shows the three dispositions the major libraries disagree on; `groupOrder`
 *   is developer config, not an end-user control.
 * - Three controls are deliberate regressions: breaking a summary takes the table down, grouping
 *   by a column that isn't there degrades silently, and blank/object group keys have no label.
 */
export const Default: Story = {};

/**
 * The `groupOrder` comparator throws on every sibling pair. The table stays up on D15's fallback —
 * stable first-occurrence order, reported once per evaluation — which is a state `Default`'s DOM
 * never reaches.
 */
export const ThrowingGroupOrder: Story = {
  args: { groupOrder: 'throwing' },
};

/**
 * A grouping level decided by the server, through an `applyGroupingAsync()`-shaped column rule —
 * grouping's one genuinely async surface.
 *
 * The latency is set high enough that the pending window is visible without opening Controls. While
 * the rule is unresolved the whole rule set abstains and the table **holds the last explicit
 * grouping** rather than flashing ungrouped (D13); when it resolves, the level set becomes the
 * rule's. Turn on `forceFailure` and the rule's required `onError` resolves it to `[]` — actively
 * grouped by nothing, which is not the same state as abstaining, and not a blank table either.
 */
export const AsyncGroupingRule: Story = {
  args: { asyncGroupingRule: true, latencyMs: 2500 },
};
