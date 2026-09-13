import type { Meta, StoryObj } from '@storybook/angular-vite';
import { ExternalWriteStoryHostComponent } from './external-write-story-host.component';

const meta: Meta<ExternalWriteStoryHostComponent> = {
  title: 'Table / Row Editing / External Write & Reconciliation',
  component: ExternalWriteStoryHostComponent,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<ExternalWriteStoryHostComponent>;

/**
 * What happens when data changes from outside the table while a row is being edited.
 *
 * - Editing a row that's changed elsewhere shows a conflict banner: Keep mine, Take theirs, or
 *   merge field-by-field.
 * - A row that isn't open just gets patched quietly, no banner.
 */
export const Default: Story = {};
