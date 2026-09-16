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
 * Table filtering with plain predicates
 *
 * Filtering with nothing but plain row predicates — no `createFilters()`, no criterion types.
 * Each control contributes one term and the terms AND together; emptying a control just
 * removes its term from the next pass.
 */
export const Predicates: Story = {};
