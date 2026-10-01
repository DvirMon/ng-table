import type { RowId } from '../../../api/types';

/** A project-plan task; `parentId` links it to its parent for `withTree()`, `null` for a root. */
export interface TaskRow {
  id: RowId;
  parentId: string | null;
  name: string;
  owner: string;
  status: string;
}
