import { computed } from '@angular/core';
import { resolveTreeLinks, type TreeLinks } from '../../../engine/tree-links';
import type { Feature, ParentLink, RowOf, StageContext, TableFeatureSpec } from '../../../engine/types';
import { stage } from '../../../schema/stage-rules';
import { stageSchema } from '../../../schema/stage-schema';
import { createTableFeature } from '../../create-table-feature';
import type { DerivedDict, RowId, TableStore, TrackByFn } from '../../types';
import { createExpansionStore, type ExpansionWriteOptions } from '../expansion/state';
import { buildFlatTreeStage } from './nest';
import type { TreeMembers, TreeSlice, WithTreeConfig } from './types';

// F-bounded so a factory body gets `input.rows(): RowOf<In>[]` with no cast. Includes `value` so
// `parentOf()` / `descendantsOf()` can walk all of the row data, not the pipeline's `rows()` view.
type TreeInput<In> = Pick<TableStore<RowOf<In>>, 'rows' | 'trackBy' | 'value'>;

// The parent link `withTree({ parentId })` contributes to `ctx.parentOf` for every stage
// (#167/ADR-0028) — total and silent. A throw or an `undefined` return both degrade to a root;
// this contribution never reports (only the `'tree'` stage does).
function toSilentParentLink<TRow>(
  parentId: (row: TRow) => RowId | null | undefined
): ParentLink<TRow> {
  return (row) => {
    try {
      return parentId(row) ?? null;
    } catch {
      return null;
    }
  };
}

// Discovers expandable ids straight from flat `input.rows()` (`expand()` with no ids, and
// `state()`) — degrades exactly like the `'tree'` stage (self/absent/cycle/throw all become a
// root), but never reports: only the `'tree'` stage reports (#167).
function discoverExpandableIdsFlat<TRow>(
  rows: readonly TRow[],
  trackBy: TrackByFn<TRow>,
  config: WithTreeConfig<TRow>
): RowId[] {
  const parentOf = toSilentParentLink(config.parentId!);
  const { parentById } = resolveTreeLinks(rows, { parentOf, trackBy });

  const idsWithChildren = new Set<RowId>();
  parentById.forEach((parent) => {
    if (parent !== null) {
      idsWithChildren.add(parent);
    }
  });

  const isExpandable = config.isExpandable;
  const canExpand: (row: TRow) => boolean = isExpandable
    ? (row) => {
        try {
          return isExpandable(row);
        } catch {
          return false;
        }
      }
    : (row) => idsWithChildren.has(trackBy(row));

  return rows.filter((row) => canExpand(row)).map((row) => trackBy(row));
}

// Discovers expandable ids when `parentId` is configured; a collapse-only instance (no
// `parentId`) has no tree structure to discover, so it always finds nothing.
function discoverExpandableIds<TRow>(
  rows: readonly TRow[],
  trackBy: TrackByFn<TRow>,
  config: WithTreeConfig<TRow>
): RowId[] {
  if (!config.parentId) {
    return [];
  }
  return discoverExpandableIdsFlat(rows, trackBy, config);
}

// Resolves every row's parent link over all of `value()`, not the pipeline's `rows()` view — a
// row a filter dropped still counts for `parentOf()` / `descendantsOf()` (#167). `null` when no
// `parentId` is configured — there is no fallback to a conventional field.
function resolveDataTreeLinks<TRow>(
  input: Pick<TableStore<TRow>, 'value' | 'trackBy'>,
  config: WithTreeConfig<TRow>
): TreeLinks | null {
  if (!config.parentId) {
    return null;
  }
  return resolveTreeLinks(input.value(), {
    parentOf: toSilentParentLink(config.parentId),
    trackBy: input.trackBy,
  });
}

// Groups `data()` ids by resolved parent, preserving each parent's children in `data()` order —
// the sibling order `descendantsOf()`'s depth-first walk below relies on.
function groupChildrenByParent<TRow>(
  rows: readonly TRow[],
  trackBy: TrackByFn<TRow>,
  parentById: ReadonlyMap<RowId, RowId | null>
): Map<RowId, RowId[]> {
  const childrenByParent = new Map<RowId, RowId[]>();
  for (const row of rows) {
    const id = trackBy(row);
    const parent = parentById.get(id) ?? null;
    if (parent === null) {
      continue;
    }
    const siblings = childrenByParent.get(parent);
    if (siblings) {
      siblings.push(id);
    } else {
      childrenByParent.set(parent, [id]);
    }
  }
  return childrenByParent;
}

// Depth-first: a child, then its own children, before the next sibling — never `id` itself.
function collectDescendantIds(
  id: RowId,
  childrenByParent: ReadonlyMap<RowId, RowId[]>
): RowId[] {
  const children = childrenByParent.get(id) ?? [];
  return children.flatMap((childId) => [
    childId,
    ...collectDescendantIds(childId, childrenByParent),
  ]);
}

const EMPTY_CONTEXT_ROW_IDS: ReadonlySet<RowId> = new Set();

function buildTreeSpec<TRow>(
  input: Pick<TableStore<TRow>, 'rows' | 'trackBy' | 'value'>,
  config: WithTreeConfig<TRow>,
  ctx: StageContext<TRow>
): TableFeatureSpec<TRow, TreeMembers> {
  // No `onExpanded`: `everExpanded` is the panel's member, not the tree's.
  const store = createExpansionStore({ initial: config.initial });

  function toggle(id: RowId, options?: ExpansionWriteOptions): void {
    store.toggle(id, options);
  }

  function expand(ids?: readonly RowId[], options?: ExpansionWriteOptions): void {
    const target = ids ?? discoverExpandableIds(input.rows(), input.trackBy, config);
    store.setExpanded([...new Set([...store.expanded(), ...target])], options);
  }

  function collapse(ids?: readonly RowId[], options?: ExpansionWriteOptions): void {
    if (ids === undefined) {
      store.setExpanded([], options);
      return;
    }
    const removing = new Set(ids);
    store.setExpanded(
      [...store.expanded()].filter((id) => !removing.has(id)),
      options
    );
  }

  function set(ids: readonly RowId[], options?: ExpansionWriteOptions): void {
    store.setExpanded(ids, options);
  }

  function parentOf(id: RowId): RowId | null {
    const links = resolveDataTreeLinks(input, config);
    return links?.parentById.get(id) ?? null;
  }

  function descendantsOf(id: RowId): RowId[] {
    const links = resolveDataTreeLinks(input, config);
    if (!links) {
      return [];
    }
    const childrenByParent = groupChildrenByParent(input.value(), input.trackBy, links.parentById);
    return collectDescendantIds(id, childrenByParent);
  }

  const state = computed<'all' | 'some' | 'none'>(() => {
    const expandable = discoverExpandableIds(input.rows(), input.trackBy, config);
    if (expandable.length === 0) {
      return 'none';
    }
    const open = store.expanded();
    const openCount = expandable.filter((id) => open.has(id)).length;
    if (openCount === 0) {
      return 'none';
    }
    return openCount === expandable.length ? 'all' : 'some';
  });

  const tree: TreeSlice = Object.assign(computed(() => store.expanded()), {
    changed: store.changed,
    state,
    toggle,
    expand,
    collapse,
    set,
    parentOf,
    descendantsOf,
    // `ctx` is read inside the computed: `withFiltering()` folds after this factory runs.
    contextRowIds: computed((): ReadonlySet<RowId> => ctx.contextRows?.() ?? EMPTY_CONTEXT_ROW_IDS),
  });

  // Claimed only when `parentId` was supplied — a collapse-only instance leaves the
  // single-claim stage free for a future claimant.
  const renderStages = config.parentId
    ? stageSchema<TRow>('render', (s) => {
        stage(s.tree, { run: buildFlatTreeStage(input.trackBy, config) });
      })
    : undefined;

  return {
    members: { tree },
    renderStages,
    // Contributed unconditionally: a collapse-only instance is exactly what hides a group
    // header's members, and the walk needs a defined set to do it.
    expandedRows: computed(() => store.expanded()),
    // Single-claim (ADR-0028) — only when `parentId` is set; a second contributor throws.
    parentLink: config.parentId ? toSilentParentLink(config.parentId) : undefined,
    onDestroy: () => store.destroy(),
    onRowsRemoved: (ids) => store.onRowsRemoved(ids),
  };
}

/**
 * Adds a real row tree to `createTable()`: expanding a parent reveals its children as rows
 * with the same columns, at any depth.
 *
 * @remarks
 * Real-row parents only — no path or levels API. Claims the `'tree'` render stage only when
 * `parentId` is supplied; omitted gives a collapse-only instance that still hides a collapsed
 * id's descendants without claiming the stage.
 *
 * @example
 * createTable(data, { trackBy: 'id' }, withTree({ parentId: (row) => row.parentId }));
 */
export function withTree<In extends TreeInput<In>, D extends DerivedDict>(
  derive: Feature<NoInfer<In> & TreeMembers, D>
): Feature<In, TreeMembers & D>;
export function withTree<In extends TreeInput<In>>(
  config?: WithTreeConfig<RowOf<In>>
): Feature<In, TreeMembers>;
export function withTree<In extends TreeInput<In>, D extends DerivedDict>(
  config: WithTreeConfig<RowOf<In>> | undefined,
  derive: Feature<NoInfer<In> & TreeMembers, D>
): Feature<In, TreeMembers & D>;
export function withTree(
  configOrDerive: WithTreeConfig<any> | Feature<any, any> = {},
  maybeDerive?: Feature<any, any>
): Feature<any, any> {
  const isDeriveFirst = typeof configOrDerive === 'function';
  const config: WithTreeConfig<any> = isDeriveFirst ? {} : configOrDerive;
  const derive = isDeriveFirst ? configOrDerive : maybeDerive;
  const factory = <In extends TreeInput<In>>(
    input: In,
    ctx: StageContext<RowOf<In>>
  ): TableFeatureSpec<RowOf<In>, TreeMembers> => buildTreeSpec(input, config, ctx);
  const feature: Feature<any, any> = derive
    ? createTableFeature(factory, derive)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withTree' });
}
