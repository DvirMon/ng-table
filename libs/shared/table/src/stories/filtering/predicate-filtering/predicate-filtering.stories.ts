import type { Meta, StoryObj } from '@storybook/angular-vite';
import { PredicateFilteringStoryHostComponent } from './predicate-filtering-story-host.component';

const meta: Meta<PredicateFilteringStoryHostComponent> = {
  title: 'Table / Filtering',
  component: PredicateFilteringStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
};
export default meta;

type Story = StoryObj<PredicateFilteringStoryHostComponent>;

/**
 * Filtering with nothing but plain row predicates. Synchronous, so there is no arg to vary —
 * both controls are on the canvas.
 *
 * - Each control contributes one term; the terms AND, so the count only shrinks.
 * - Emptying a control removes its term from the next pass, with no `isEmpty` contract involved.
 * - The host composes no filter model: `createFilters()` and the criterion types are absent.
 */
export const Predicates: Story = {};
