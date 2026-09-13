import type { Meta, StoryObj } from '@storybook/angular-vite';
import { LiveOptimisticStoryHostComponent } from './live-optimistic-story-host.component';
import { rowEditHandlers } from '../fixtures/handlers';

const meta: Meta<LiveOptimisticStoryHostComponent> = {
  title: 'Table / Row Editing / Live / Optimistic',
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
 * The happy path for optimistic saves.
 *
 * - Focus a cell, type, tab away — the value commits right away and the row shows as in-flight.
 * - Once the save succeeds, the in-flight marker clears.
 * - Add row inserts a blank row under a temp id; its first blur creates it server-side
 *   (`POST`, id assigned by the server) instead of updating (`PUT`) — `swapRowId` keeps the row
 *   addressable under its new id.
 */
export const Default: Story = {};

/**
 * A save that fails.
 *
 * - The edited value shows on screen immediately, same as the happy path.
 * - When the save fails, the value reverts to what it was before the edit.
 * - The row was never in an "open for editing" state, so nothing closes — it just reverts.
 */
export const ForcedFailure: Story = {
  args: { forceFailure: true },
};
