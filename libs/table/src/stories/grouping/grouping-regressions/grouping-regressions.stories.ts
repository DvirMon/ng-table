import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GroupingRegressionsStoryHostComponent } from './grouping-regressions-story-host.component';

const meta: Meta<GroupingRegressionsStoryHostComponent> = {
  title: 'Table / Grouping',
  component: GroupingRegressionsStoryHostComponent,
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

type Story = StoryObj<GroupingRegressionsStoryHostComponent>;

/**
 * Grouping — throwing comparator
 *
 * The `groupOrder` comparator throws on every sibling pair. The table stays up on the
 * fallback — stable first-occurrence order — reported once per evaluation.
 */
export const ThrowingGroupOrder: Story = {
  args: { groupOrder: 'throwing' },
};
