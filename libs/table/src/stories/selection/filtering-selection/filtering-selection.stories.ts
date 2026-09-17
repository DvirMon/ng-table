import type { Meta, StoryObj } from '@storybook/angular-vite';
import { FilteringSelectionStoryHostComponent } from './filtering-selection-story-host.component';

const meta: Meta<FilteringSelectionStoryHostComponent> = {
  title: 'Table / Selection',
  component: FilteringSelectionStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
};
export default meta;

type Story = StoryObj<FilteringSelectionStoryHostComponent>;

/**
 * Filtering × Selection
 *
 * The header checkbox is the only select-all/clear gesture; its indeterminate state counts
 * only the visible rows.
 *
 * Filtering a selected row out retains it and clearing the filter restores the selection
 * exactly; deleting a filtered-out selected row drops the count.
 */
export const FilteringAndSelection: Story = {
  name: 'Filtering × Selection',
};
