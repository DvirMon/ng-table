import type { Meta, StoryObj } from '@storybook/angular-vite';
import { FormWriteMutationsStoryHostComponent } from './form-write-mutations-story-host.component';

type Host = InstanceType<typeof FormWriteMutationsStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing / Form-Driven Mutations',
  component: FormWriteMutationsStoryHostComponent,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<Host>;

/**
 * Add/delete bypass `table.editing`/`table.value` and write straight through the form's
 * root value signal — see what breaks vs. the normal `beginEdit({ insert })`/`removeRow` flow.
 */
export const Default: Story = {};
