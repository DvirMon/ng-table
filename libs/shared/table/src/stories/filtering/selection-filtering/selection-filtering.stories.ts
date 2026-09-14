import type { Meta, StoryObj } from '@storybook/angular-vite';
import { SelectionFilteringStoryHostComponent } from './selection-filtering-story-host.component';

const meta: Meta<SelectionFilteringStoryHostComponent> = {
  title: 'Table / Filtering / Selection × Filtering',
  component: SelectionFilteringStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
};
export default meta;

type Story = StoryObj<SelectionFilteringStoryHostComponent>;

/**
 * Every verb here is synchronous and local — there is no rollback state that never renders on
 * the happy path, so there is nothing for a second story object to reveal.
 *
 * - Two select-all buttons, scoped differently, with visibly different results.
 * - The header checkbox's indeterminate state counts against the visible rows.
 * - Filtering a selected row out retains it; clearing the filter restores the selection exactly.
 * - Sorting leaves the selection alone; deleting a filtered-out selected row drops the count.
 */
export const Default: Story = {};
