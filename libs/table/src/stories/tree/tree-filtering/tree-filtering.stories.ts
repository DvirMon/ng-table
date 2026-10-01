import type { Meta, StoryObj } from '@storybook/angular-vite';
import { TreeFilteringStoryHostComponent } from './tree-filtering-story-host.component';

const meta: Meta<TreeFilteringStoryHostComponent> = {
  title: 'Table / Tree',
  component: TreeFilteringStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
};
export default meta;

type Story = StoryObj<TreeFilteringStoryHostComponent>;

/**
 * Tree with filtering and context rows
 *
 * Demonstrates `withFiltering()` composed with `withTree()`. As you type "review", ancestors
 * of each match are kept and shown open automatically (default reveal). Context rows are
 * dimmed by the recipe. The row count stays fixed on the number of matches, not visible nodes.
 * A parent whose name matches but none of its children do renders a hidden, disabled toggle
 * (TR38, 2.6). Close a revealed parent and it stays closed while you keep typing; clear the
 * filter and the branches you opened before filtering are open again (2.4).
 *
 * Coverage: 2.1, 2.2, 2.3, 2.4, 2.6, 3.1, F-T1 (TR22, TR36, TR38, TR39, TR42).
 */
export const Filtered: Story = {};
