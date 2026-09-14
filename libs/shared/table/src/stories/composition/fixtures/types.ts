import type { RowId } from '../../../api/types';

/** Fixture row for the composition stories. No `locked` — this story proves derived-state
 * composition, not row selectability. */
export interface CompositionRow {
  id: RowId;
  name: string;
  dept: string;
}

/**
 * The criterion model behind `equals(path.dept)` — `null` is "All".
 *
 * `type`, never `interface`: an interface has no implicit index signature, so it fails
 * `createFilters`' `TState extends Record<string, unknown>` constraint outright.
 */
export type CompositionFilterState = {
  dept: string | null;
};
