import type { Meta, StoryObj } from '@storybook/angular-vite';
import { SingleSelectionStoryHostComponent } from './single-selection-story-host.component';

const meta: Meta<SingleSelectionStoryHostComponent> = {
  title: 'Table / Selection',
  component: SingleSelectionStoryHostComponent,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<SingleSelectionStoryHostComponent>;

/**
 * `withSelection({ enableMultiRowSelection: false })` behind a radio group.
 *
 * - Picking a second row unticks the first; arrow keys and Space come from the group.
 * - Clear is a button, because a radio cannot be unticked by clicking it.
 * - A two-id restore is refused, and the discarded id is named on canvas.
 */
export const Single: Story = {};
