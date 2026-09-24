import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GroupingKeysStoryHostComponent } from './grouping-keys-story-host.component';

const meta: Meta<GroupingKeysStoryHostComponent> = {
  title: 'Table / Grouping',
  component: GroupingKeysStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    bucketClosedAtByMonth: { control: 'boolean' },
    showCount: { control: 'boolean' },
  },
  args: {
    bucketClosedAtByMonth: true,
    showCount: true,
  },
};
export default meta;

type Story = StoryObj<GroupingKeysStoryHostComponent>;

/**
 * Key derivation and label naming — `groupKey` + `label` (D9)
 *
 * Two declarators, one lesson: `groupKey(path.closedAt, extractValue)` decides what a level
 * clusters *on*; an `initial` entry's `label` decides what its header *calls itself*.
 *
 * `Sales Region`'s explicit `initial` label wins over its column's own. `Closed` has none, so it
 * falls back to the `closedAt` column's own label.
 *
 * `bucketClosedAtByMonth` toggles `groupKey`: on, twelve distinct timestamps collapse into
 * five month buckets; off, the engine groups on the exact `Date` instead — it never coarsens a
 * key on its own (D7).
 */
export const Keys: Story = {};
