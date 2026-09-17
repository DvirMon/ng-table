import type { Meta, StoryObj } from '@storybook/angular-vite';
import { MultiSelectionStoryHostComponent } from './multi-selection-story-host.component';

const meta: Meta<MultiSelectionStoryHostComponent> = {
  title: 'Table / Selection',
  component: MultiSelectionStoryHostComponent,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<MultiSelectionStoryHostComponent>;

/**
 * Multi-selection, full surface
 *
 * Row checkboxes accumulate; the header checkbox selects all selectable rows and clears.
 * Locked rows stay focusable, are skipped by select-all, and keep a mark they already had
 * until an explicit clear.
 *
 * Restoring a saved selection writes silently and ignores an id no row has; deleting a
 * selected row from outside drops the count without emitting anything.
 */
export const Multi: Story = {};
