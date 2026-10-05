import type { Meta, StoryObj } from '@storybook/angular-vite';
import { ExternalWriteStoryHostComponent } from './external-write-story-host.component';

const meta: Meta<ExternalWriteStoryHostComponent> = {
  title: 'Table / Row Editing',
  component: ExternalWriteStoryHostComponent,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<ExternalWriteStoryHostComponent>;

/**
 * External write & reconciliation
 *
 * Data changes from outside the table while a row is being edited. An open row shows a
 * conflict banner — Keep mine, Take theirs, or merge field-by-field; a closed row is just
 * patched quietly, no banner.
 */
export const ExternalWrite: Story = {
  name: 'External Write & Reconciliation',
};
