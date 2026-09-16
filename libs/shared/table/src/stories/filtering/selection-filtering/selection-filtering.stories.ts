import type { Meta, StoryObj } from '@storybook/angular-vite';
import { SelectionFilteringStoryHostComponent } from './selection-filtering-story-host.component';

const meta: Meta<SelectionFilteringStoryHostComponent> = {
  title: 'Table / Filtering',
  component: SelectionFilteringStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
};
export default meta;

type Story = StoryObj<SelectionFilteringStoryHostComponent>;

/**
 * Selection × Filtering
 *
 * The header checkbox is the only select-all/clear gesture; its indeterminate state counts
 * only the visible rows.
 *
 * Filtering a selected row out retains it and clearing the filter restores the selection
 * exactly; deleting a filtered-out selected row drops the count.
 */
export const SelectionAndFiltering: Story = {
  name: 'Selection × Filtering',};
