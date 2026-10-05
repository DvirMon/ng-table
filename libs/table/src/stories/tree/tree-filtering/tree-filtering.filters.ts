import { contains } from '../../../api/features/with-filtering/rules';
import type { FiltersPath } from '../../../api/features/with-filtering/types';
import type { ColumnValues } from '../../../api/types';
import { treeColumns } from '../fixtures/schema';
import type { TaskRow } from '../fixtures/types';

/**
 * The tree-filtering story's filter schema: a single `name` filter using `contains()` over the
 * task name. This fixture is designed for searching "review" to hit:
 * - A depth-3 leaf under two non-matching ancestors (2.1, 2.3)
 * - Another matching leaf in a separate branch (2.2: close one, stays closed)
 * - A parent whose name matches but none of its children do (2.6)
 */
export const treeFilters = (
  path: FiltersPath<TaskRow, ColumnValues<TaskRow, typeof treeColumns.columns>>,
) => ({
  name: contains(path.name),
});
