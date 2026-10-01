import type { Meta, StoryObj } from '@storybook/angular-vite';
import { TreeBasicStoryHostComponent } from './tree-basic-story-host.component';

const meta: Meta<TreeBasicStoryHostComponent> = {
  title: 'Table / Tree',
  component: TreeBasicStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
};
export default meta;

type Story = StoryObj<TreeBasicStoryHostComponent>;

/**
 * Basic tree — flat data nested by parentId, with toggle and bulk control
 *
 * Flat data linked by `parentId`, displaying an outline view to depth 3. Click the chevron
 * to open or close a parent; reopen a closed parent and its previously-open descendants
 * are restored (deep restore, TR36). Expand all / Collapse all operate on every expandable
 * row, and the readout displays the three-state tree state (All open / Some open / None
 * open). The toggle appears on every row in the name cell and reads 'Children of [name]'
 * (TR39); leaf toggles render disabled and invisible but keep their width for label
 * alignment (TR38). Tab navigation reaches only parents; leaf toggles are skipped (TR36).
 * Applies the shared tree styling recipe, which includes reduced-motion support.
 */
export const Basic: Story = {};
