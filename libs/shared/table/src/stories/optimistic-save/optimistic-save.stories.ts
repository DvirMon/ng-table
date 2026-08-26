import type { Meta, StoryObj } from '@storybook/angular-vite';
import { OptimisticSaveStoryHostComponent } from './optimistic-save-story-host.component';
import { rowEditHandlers } from '../row-edit.handlers';

const meta: Meta<OptimisticSaveStoryHostComponent> = {
  title: 'Table / Row Editing / Optimistic Save',
  component: OptimisticSaveStoryHostComponent,
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

type Story = StoryObj<OptimisticSaveStoryHostComponent>;

/** S4 — the happy path. Save closes the row, a spinner shows while `pending`, the MSW-backed
 * request resolves, and `releaseEdit` drops the restore point. */
export const Default: Story = {};

/** S4 — forced failure. Save still closes the row optimistically, but the MSW handler returns
 * 500, and `revertEdit` re-opens the row with its pre-edit value. */
export const ForcedFailure: Story = {
  args: { forceFailure: true },
};
