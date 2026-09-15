import type { Meta, StoryObj } from '@storybook/angular-vite';
import { GroupingRegressionsStoryHostComponent } from './grouping-regressions-story-host.component';

const meta: Meta<GroupingRegressionsStoryHostComponent> = {
  title: 'Table / Grouping',
  component: GroupingRegressionsStoryHostComponent,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    groupOrder: {
      control: 'select',
      options: ['first-occurrence', 'by-label', 'by-count', 'external-list', 'throwing'],
    },
    showCount: { control: 'boolean' },
  },
  args: {
    groupOrder: 'first-occurrence',
    showCount: true,
  },
};
export default meta;

type Story = StoryObj<GroupingRegressionsStoryHostComponent>;

/**
 * Two degradations the library performs **silently** — both reached from the buttons on canvas,
 * neither reported by any library channel. Deliberate misuse, not example code;
 * `Table / Grouping / Static` is the story to copy.
 *
 * - *Group by a column that isn't there* adds a level naming no column. The table groups by the
 *   rest and says nothing — the notice is the story's own arithmetic, not a library report.
 * - *Break one group's summary* poisons one row's `amount`. The whole table goes down instead of
 *   that one summary blanking ([#79](https://github.com/DvirMon/acme/issues/79)).
 */
export const SilentDegradation: Story = {};

/**
 * The `groupOrder` comparator throws on every sibling pair. The table stays up on the fallback —
 * stable first-occurrence order, reported once per evaluation — which is a state `Default`'s DOM
 * never reaches.
 */
export const ThrowingGroupOrder: Story = {
  args: { groupOrder: 'throwing' },
};
