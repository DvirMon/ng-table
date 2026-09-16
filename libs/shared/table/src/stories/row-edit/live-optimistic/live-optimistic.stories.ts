import type { Meta, StoryObj } from '@storybook/angular-vite';
import { LiveOptimisticStoryHostComponent } from './live-optimistic-story-host.component';
import { rowEditHandlers } from '../fixtures/handlers';

const meta: Meta<LiveOptimisticStoryHostComponent> = {
  title: 'Table / Row Editing',
  component: LiveOptimisticStoryHostComponent,
  parameters: {
    layout: 'padded',
    msw: { handlers: rowEditHandlers },
  },
  argTypes: {
    forceFailure: { control: 'boolean' },
    latencyMs: { control: { type: 'number', min: 0, max: 3000, step: 100 } },
  },
  args: {
    forceFailure: false,
    latencyMs: 600,
  },
};
export default meta;

type Story = StoryObj<LiveOptimisticStoryHostComponent>;

/**
 * Focus-delimited optimistic editing
 *
 * Focus a cell, type, tab away — the value commits right away and the row shows as in-flight
 * until the save succeeds. Add row inserts a blank row under a temp id; its first blur
 * creates it server-side instead of updating it.
 *
 * Toggle `forceFailure` in Controls: the edited value still shows immediately, then reverts
 * to what it was before the edit — the row was never "open," so nothing closes, it just
 * reverts.
 */
export const LiveOptimistic: Story = {};
