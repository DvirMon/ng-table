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
 * A three-level outline that starts fully collapsed.
 *
 * - The chevron is a real `<button>` with `aria-expanded`; the whole header row is an enlarged hit
 *   area that its activation bubbles through, so mouse, Enter and Space all take the same path.
 * - Collapsing a parent hides its entire subtree.
 * - Refetch replaces every row with a freshly-constructed object over a real intercepted request;
 *   the sort toggles reorder the pipeline; Regroup re-nests so every group id changes at once.
 *   Collapse state has to survive the first two and be discarded wholesale by the third.
 * - Expand all is the story's own loop — `expandAll()` cannot discover a group (S5) — and neither
 *   button can label itself correctly without an "is everything expanded" signal (S4).
 * - The deal with line items carries a second, separate chevron from the `'tree'` render stage.
 */
export const Collapsible: Story = {};

/**
 * Refetch fails every time. The error path is the half of 2.5 that `Default`'s DOM never reaches:
 * collapse state has to survive a *failed* refresh too, and nothing may be left half-applied.
 */
export const CollapsibleRefreshFailure: Story = {
  name: 'Collapsible — Refresh Failure',
  args: { forceFailure: true },
};
