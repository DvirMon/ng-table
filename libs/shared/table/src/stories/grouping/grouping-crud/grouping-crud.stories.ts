import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GroupingCrudStoryHostComponent } from './grouping-crud-story-host.component';

const meta: Meta<GroupingCrudStoryHostComponent> = {
  title: 'Table / Grouping',
  component: GroupingCrudStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    bannerGroupRows: { control: 'boolean' },
    showCount: { control: 'boolean' },
  },
  args: {
    bannerGroupRows: true,
    showCount: true,
  },
};
export default meta;

type Story = StoryObj<GroupingCrudStoryHostComponent>;

/**
 * Grouped CRUD, banner group rows
 *
 * `withGrouping()` headers drawn as one full-width banner — label, count and total, then Add row
 * to group. Add a row under Hardware and watch the Region total above it follow; `+1k` patches an
 * amount, `×` removes a row.
 *
 * Add appears on the deepest level only: a Region banner leaves Category undecided.
 */
export const Crud: Story = {};
