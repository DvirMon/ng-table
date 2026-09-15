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
 * The whole read/write surface of `withSelection()` in multi mode.
 *
 * - Row checkboxes accumulate; the header checkbox selects all selectable rows and clears.
 * - Locked rows stay focusable, are skipped by select-all, keep a mark they already had, and
 *   lose it on an explicit clear.
 * - Restoring a saved selection writes silently and ignores an id no row has.
 * - Deleting a selected row from outside drops the count without emitting anything.
 *
 * Every verb is synchronous and local, so there is no failure path to pin as a second story.
 */
export const Multi: Story = {};
