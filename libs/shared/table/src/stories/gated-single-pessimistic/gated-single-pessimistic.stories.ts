import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GatedSinglePessimisticStoryHostComponent } from './gated-single-pessimistic-story-host.component';
import { rowEditHandlers } from '../shared/row-edit/handlers';

type Host = InstanceType<typeof GatedSinglePessimisticStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing / Gated / Single / Pessimistic',
  component: GatedSinglePessimisticStoryHostComponent,
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

type Story = StoryObj<Host>;

/**
 * Edits one row at a time, saving pessimistically: the row stays open until a real
 * MSW-intercepted `fetch` resolves. A failure leaves the row open with its draft intact — no
 * rollback needed since nothing closed early. Starting a new edit while one is already open
 * cancels whatever was in progress.
 */
export const Default: Story = {};

/** A save that fails: the row stays open (pessimistic never closes early), the error shows
 * inline, and Retry re-runs the same request. */
export const ForcedFailure: Story = {
  args: { forceFailure: true },
};
