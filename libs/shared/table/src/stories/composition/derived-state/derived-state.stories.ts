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
 * Two `withComputed()` placements over one table: `hiddenSelected` is declared inside
 * `withSelection()`'s own derive slot, `visibleSelected` as a trailing top-level argument that
 * reads `hiddenSelected` back across slots.
 *
 * - Tick rows, then filter by department — the banner splits the selection into visible and
 *   hidden-by-filter.
 * - A hidden row keeps its mark; clearing the filter restores the count.
 */
export const DerivedState: Story = {};
