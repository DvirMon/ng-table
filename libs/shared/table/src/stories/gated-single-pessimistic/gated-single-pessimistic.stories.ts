import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GatedSinglePessimisticStoryHostComponent } from './gated-single-pessimistic-story-host.component';

type Host = InstanceType<typeof GatedSinglePessimisticStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing / Gated / Single / Pessimistic',
  component: GatedSinglePessimisticStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
};
export default meta;

type Story = StoryObj<Host>;

/**
 * Edits one row at a time, saving pessimistically: the row stays open until
 * `saveRowPessimistic` resolves. A failure (blank name) leaves the row open with its draft
 * intact — no rollback needed since nothing closed early. Starting a new edit while one is
 * already open cancels whatever was in progress.
 */
export const Default: Story = {};
