import type { Meta, StoryObj } from '@storybook/angular-vite';
import { LiveOptimisticStoryHostComponent } from './live-optimistic-story-host.component';
import { rowEditHandlers } from '../row-edit.handlers';

const meta: Meta<LiveOptimisticStoryHostComponent> = {
  title: 'Table / Row Editing / Live Table + Rollback',
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

/** S6 — the happy path. Focus a cell, type, tab away: the value commits, the row shows as
 * in-flight, and `releaseEdit` drops the restore point once the request resolves. */
export const Default: Story = {};

/** S6 — forced failure. The optimistic write lands on screen first, then the MSW handler
 * returns 500 and `revertEdit` puts the captured value back. Nothing closes, because nothing
 * was ever open. */
export const ForcedFailure: Story = {
  args: { forceFailure: true },
};
