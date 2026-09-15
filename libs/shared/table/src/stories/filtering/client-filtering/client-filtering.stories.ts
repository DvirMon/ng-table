import type { Meta, StoryObj } from '@storybook/angular-vite';
import { ClientFilteringStoryHostComponent } from './client-filtering-story-host.component';

const meta: Meta<ClientFilteringStoryHostComponent> = {
  title: 'Table / Filtering',
  component: ClientFilteringStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
};
export default meta;

type Story = StoryObj<ClientFilteringStoryHostComponent>;

/**
 * Client-side filtering end to end. Nothing here is async, so there is no `forceFailure` or
 * `latencyMs` to vary — every control is on the canvas instead.
 *
 * - Each filter row input narrows on its own and AND's with the others; the count only shrinks.
 * - Emptying an input stops it narrowing, driven by the shipped per-kind `isEmpty`.
 * - `Reset to defaults` restores the declared `source` default; `Clear all` empties.
 * - Breaking the tags predicate widens the result set and reports once per evaluation.
 */
export const Client: Story = {};
