import type { Meta, StoryObj } from '@storybook/angular-vite';
import { FormWriteMutationsStoryHostComponent } from './form-write-mutations-story-host.component';

type Host = InstanceType<typeof FormWriteMutationsStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing',
  component: FormWriteMutationsStoryHostComponent,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<Host>;

/**
 * Row mutations via raw form writes
 *
 * Adds and deletes rows by writing straight through the form, bypassing the table's own
 * add/delete actions. Compare against the normal flow to see what guarantees are lost.
 */
export const FormDrivenMutations: Story = {};
