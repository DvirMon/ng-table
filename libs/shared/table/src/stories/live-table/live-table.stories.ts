import type { Meta, StoryObj } from '@storybook/angular-vite';
import { LiveTableStoryHostComponent } from './live-table-story-host.component';

const meta: Meta<LiveTableStoryHostComponent> = {
  title: 'Table / Row Editing / Live Table',
  component: LiveTableStoryHostComponent,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<LiveTableStoryHostComponent>;

/**
 * S1 — the minimal editable table (D29). No editing feature composed at all; every row's
 * inputs are always rendered. Blur the name field or change dept to see the commit-boundary
 * counter tick — typing alone never touches `data()`.
 */
export const Default: Story = {};
