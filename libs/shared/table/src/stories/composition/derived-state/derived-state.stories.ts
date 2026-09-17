import type { Meta, StoryObj } from '@storybook/angular-vite';
import { DerivedStateStoryHostComponent } from './derived-state-story-host.component';

const meta: Meta<DerivedStateStoryHostComponent> = {
  title: 'Table / Composition',
  component: DerivedStateStoryHostComponent,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<DerivedStateStoryHostComponent>;

/**
 * `withComputed()` — cross-slot derived state
 *
 * Two `withComputed()` placements over one table: `hiddenSelected` declared inside
 * `withSelection()`'s derive slot, `visibleSelected` as a trailing argument reading it back
 * across slots. Tick rows, then filter by department to split the selection into visible and
 * hidden-by-filter.
 *
 * A hidden row keeps its mark; clearing the filter restores the count.
 */
export const DerivedState: Story = {};
