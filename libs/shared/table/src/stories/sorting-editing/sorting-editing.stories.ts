import type { Meta, StoryObj } from '@storybook/angular-vite';
import { SortingEditingStoryHostComponent } from './sorting-editing-story-host.component';

type Host = InstanceType<typeof SortingEditingStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Editing / Sorting × Editing',
  component: SortingEditingStoryHostComponent,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<Host>;

/**
 * S-1/S-2 (`0-product/row-editing.md` §5) — `withSorting()` + `withRowEdit()` composed on one
 * table. S-2 (null placement) is expected to pass; S-1 (row-hold while open) is expected to
 * fail today, on purpose — see the host component's doc-comment.
 */
export const Default: Story = {};
