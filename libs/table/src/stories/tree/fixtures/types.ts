import type { RowId } from '../../../api/types';

/** Fixture row for the tree stories. Represents a task in a project plan, with a flat
 * `parentId` field for linking rows into a tree by the `withTree()` feature. */
export interface TaskRow {
  id: RowId;
  parentId: string | null;
  name: string;
  owner: string;
  status: string;
}
