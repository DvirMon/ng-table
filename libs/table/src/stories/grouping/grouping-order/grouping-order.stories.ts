import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GroupingOrderStoryHostComponent } from './grouping-order-story-host.component';

const meta: Meta<GroupingOrderStoryHostComponent> = {
  title: 'Table / Grouping',
  component: GroupingOrderStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    groupOrder: {
      control: 'select',
      options: ['first-occurrence', 'by-label', 'by-count', 'external-list', 'throwing'],
    },
    showCount: { control: 'boolean' },
  },
  args: {
    groupOrder: 'first-occurrence',
    showCount: true,
  },
};
export default meta;

type Story = StoryObj<GroupingOrderStoryHostComponent>;

/**
 * Sibling order — `applyGroupOrder`
 *
 * The order group **headers** appear among their siblings at one level. Not the rows inside a
 * group (`withSorting()`), not which groups exist (`when`), not which columns are levels
 * (`initial`).
 *
 * `first-occurrence` is the default with no comparator declared — the order each key was first
 * seen while scanning the rows. `by-label`, `by-count` and `external-list` are three ordinary
 * comparators over `GroupSummary`, whose `rows` field is the cluster's own leaves.
 *
 * `throwing` is last in the select because nobody picks it: the comparator throws on every
 * sibling pair and the table stays up, falling back to first-occurrence order and reporting once
 * per evaluation (ADR-0014).
 *
 * A comparator is also declared for `Rep`, which is not a level by default — `applyGroupOrder`
 * never activates one, so that declaration is inert until the canvas button adds it.
 */
export const Order: Story = {};
