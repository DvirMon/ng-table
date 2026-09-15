import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GatedMultipleOptimisticStoryHostComponent } from './gated-multiple-optimistic-story-host.component';
import { rowEditHandlers } from '../fixtures/handlers';

type Host = InstanceType<typeof GatedMultipleOptimisticStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing',
  component: GatedMultipleOptimisticStoryHostComponent,
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
 * Several rows open and saved at once, the happy path.
 *
 * - Open two or more rows via Edit, edit them, click "Save All".
 * - Every open row closes immediately (optimistic) and shows as saving; each settles
 *   independently as its own request resolves.
 */
export const GatedMultipleOptimistic: Story = {};

/**
 * A batched save where every in-flight request fails.
 *
 * - Rows still close immediately on Save All — closing never waits on the round trip.
 * - Each failed row reverts to its pre-edit value and shows a Retry/Dismiss control.
 */
export const GatedMultipleOptimisticFailure: Story = {
  name: 'Gated Multiple Optimistic — Failure',
  args: { forceFailure: true },
};
