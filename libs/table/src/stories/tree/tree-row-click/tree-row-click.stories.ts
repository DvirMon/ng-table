import type { Meta, StoryObj } from '@storybook/angular-vite';
import { TreeRowClickStoryHostComponent } from './tree-row-click-story-host.component';

const meta: Meta<TreeRowClickStoryHostComponent> = {
  title: 'Table / Tree',
  component: TreeRowClickStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
};
export default meta;

type Story = StoryObj<TreeRowClickStoryHostComponent>;

/**
 * Whole-row click to toggle parent expansion (TR44).
 *
 * Clicking anywhere on a parent row's text toggles its expansion, while the
 * toggle button (chevron) still works independently. The toggle's click bubbles
 * to the row handler, which must guard against it — this story shows why the
 * page (not the table) is responsible for that guard. A leaf row does not respond
 * to clicks.
 */
export const RowClick: Story = {
  name: 'Whole-row click',
};
