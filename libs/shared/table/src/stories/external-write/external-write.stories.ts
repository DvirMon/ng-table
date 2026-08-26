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
 * S5 — `rebaseEdit` (a stale restore point from an external write) and ADR-0006's
 * `onRowsRemoved` pruning (a row removed while its editing entry is still live), both only
 * previously exercised in unit tests (G12).
 */
export const Default: Story = {};
