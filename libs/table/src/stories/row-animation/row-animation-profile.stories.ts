import type { Meta, StoryObj } from '@storybook/angular-vite';
import { RowAnimationProfileStoryHostComponent } from './row-animation-profile-story-host.component';

type Host = InstanceType<typeof RowAnimationProfileStoryHostComponent>;

const meta: Meta<Host> = {
  title: 'Table / Row Animation',
  component: RowAnimationProfileStoryHostComponent,
  tags: ['profile', '!autodocs'],
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<Host>;

/**
 * Profile: 1,000 rows
 *
 * Reverses 1,000 rows with `ngpTableRowAnimation`. For recording a Chrome performance profile
 * of one reorder; mirrors the benchmark's table.
 */
export const Profile1000Rows: Story = {
  name: 'Profile: 1,000 rows',
};
