import type { Meta, StoryObj } from '@storybook/angular-vite';
import { LivePessimisticStoryHostComponent } from './live-pessimistic-story-host.component';
import { rowEditHandlers } from '../row-edit.handlers';

const meta: Meta<LivePessimisticStoryHostComponent> = {
  title: 'Table / Row Editing / Live / Pessimistic',
  component: LivePessimisticStoryHostComponent,
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

type Story = StoryObj<LivePessimisticStoryHostComponent>;

/**
 * The happy path for a pessimistic save.
 *
 * - Focus a cell, type, tab away — the field immediately reverts to its old value and locks.
 * - Once the save succeeds, the new value appears and the lock lifts.
 */
export const Default: Story = {};

/**
 * A save that fails.
 *
 * - The field reverts and locks exactly as in the happy path — nothing about the failure changes
 *   what's on screen up to that point.
 * - When the save fails, the lock simply lifts; the field is already showing the correct
 *   (pre-edit) value, so there is nothing left to visibly roll back.
 */
export const ForcedFailure: Story = {
  args: { forceFailure: true },
};
