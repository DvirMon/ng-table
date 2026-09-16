import type { Meta, StoryObj } from '@storybook/angular-vite';
import { LiveTableStoryHostComponent } from './live-table-story-host.component';
import { rowEditHandlers } from '../fixtures/handlers';

const meta: Meta<LiveTableStoryHostComponent> = {
  title: 'Table / Row Editing',
  component: LiveTableStoryHostComponent,
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

type Story = StoryObj<LiveTableStoryHostComponent>;

/**
 * The simplest editable table — every row's fields are always editable, no edit mode to enter.
 *
 * - Blur the name field or change the department: a real MSW-intercepted request fires (the
 *   save counter ticks up), and the row shows "saving…" until it resolves.
 * - Typing alone doesn't save anything until you commit the change (blur or change).
 * - Add row inserts a blank row under a temp id; its first commit is what actually creates it —
 *   the server assigns its own id (`swapRowId` keeps the row's bookkeeping correct across it).
 * - The trash icon discards a row immediately, with no confirm dialog — Undo (or Ctrl/Cmd+Z) puts
 *   it back at the index it was removed from.
 * - One undo slot covers both: it restores whichever happened last, a field commit or a
 *   confirmed discard.
 * - Turn on `forceFailure` in Controls and every request fails: an edit reverts to its pre-commit
 *   value, a create leaves the typed values in place for Retry, and a discard comes back instead of
 *   disappearing. One boolean away from the happy path, so it is a control rather than a second
 *   canvas.
 */
export const LiveBase: Story = {};
