import {
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import type {
  AnyTableFeature,
  FocusMoveOptions,
  FocusTarget,
  RowId,
  TableFocus,
  TableStore,
} from '../api/types';
import { createTableCore, type TableCoreHandle } from './core';
import { findUnrenderedId, recoverFocus } from './focus';
import type { PipelineStage, RowTransform } from './pipeline';
import type { RenderNodeTransform, RenderStage } from './render-stages';
import { diffRemovedIds } from './rows';
import { describeFeature, describeInternalFeature, SlotRegistry } from './slots';
import { resolveStageOrder, type LabelledStageRule } from './stage-order';
import type { StageContext, TableCore, TableEngineConfig, TableFeatureSpec } from './types';

const EMPTY_CONTEXT_ROWS: ReadonlySet<RowId> = new Set();

interface FeatureHooks {
  readonly setup: (() => void)[];
  readonly onDestroy: (() => void)[];
  readonly onRowsRemoved: ((ids: readonly RowId[]) => void)[];
}

/** Engine-supplied features receive the core handle — never a consumer `Feature`. */
export type InternalFeature<TRow> = (core: TableCore<TRow>) => TableFeatureSpec<TRow>;

// A feature paired with its collision-message label and a thunk pre-bound to its call
// argument — lets `foldFeatures` run one loop body for both consumer and internal features,
// no branching on kind.
interface LabeledFeature<TRow> {
  readonly run: () => TableFeatureSpec<TRow>;
  readonly label: string;
}

// The store while it is still being folded onto: the core members are already concrete, and
// feature members arrive as unknown keys.
type FoldingStore<TRow> = TableStore<TRow> & Record<string, unknown>;

// Pairs each feature with its 1-based positional label and pre-binds the argument it will be
// called with — `call` closes over the store for consumer features, the engine core for
// internal ones — so the fold loop never needs to know which kind it is running.
function labelFeatures<TRow, TFeature>(
  features: readonly TFeature[],
  describe: (position: number, displayName?: string) => string,
  call: (feature: TFeature) => TableFeatureSpec<TRow>,
  displayNameOf?: (feature: TFeature) => string | undefined,
): LabeledFeature<TRow>[] {
  return features.map((feature, index) => ({
    run: () => call(feature),
    label: describe(index + 1, displayNameOf?.(feature)),
  }));
}

type RenderedRows<TRow> = ReturnType<TableCoreHandle<TRow>['renderRows']>;
type RenderedColumns<TRow> = ReturnType<TableCoreHandle<TRow>['renderColumns']>;

// What focus recovery compares against: the rendered layout when focus was last placed or
// repaired, plus the open-panel set the closed-panel rule reads.
interface FocusLayout<TRow> {
  readonly rows: RenderedRows<TRow>;
  readonly columns: RenderedColumns<TRow>;
  readonly openPanelRowIds: ReadonlySet<RowId> | undefined;
}

function isSameFocusTarget(a: FocusTarget | null, b: FocusTarget | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  if (a.area !== b.area) {
    return false;
  }
  const sameRow = 'rowId' in a && 'rowId' in b ? a.rowId === b.rowId : true;
  const sameColumn = 'columnId' in a && 'columnId' in b ? a.columnId === b.columnId : true;
  return sameRow && sameColumn;
}

function reportUnrenderedFocusTarget(id: string): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    `[createTable] focus.moveTo ignored: "${id}" is not rendered. Focus stays where it was.`,
  );
}

// Per-call focus position, so two tables never share one. A target whose row or column is not
// rendered is ignored and reported on every call, never thrown (ADR-0014). A move with
// `focusElement: true` bumps `focusRequests` so the view layer can move DOM focus.
function createFocus<TRow>(
  handle: TableCoreHandle<TRow>,
  onPlaced: (rows: RenderedRows<TRow>, columns: RenderedColumns<TRow>) => void,
): {
  readonly focus: TableFocus;
  readonly target: WritableSignal<FocusTarget | null>;
} {
  const target = signal<FocusTarget | null>(null);
  const requests = signal(0);
  const focus = Object.assign(
    computed((): FocusTarget | null => target()),
    {
      moveTo: (next: FocusTarget, options?: FocusMoveOptions): void => {
        // untracked: a caller's effect must not re-run when the rendered rows or columns change.
        const rows = untracked(() => handle.renderRows());
        const columns = untracked(() => handle.renderColumns());
        const renderedRowIds = new Set(rows.map((row) => row.id));
        const renderedColumnIds = new Set(columns.map((column) => column.id));
        const unrenderedId = findUnrenderedId(next, renderedRowIds, renderedColumnIds);
        if (unrenderedId !== undefined) {
          reportUnrenderedFocusTarget(unrenderedId);
          return;
        }
        // The layout focus was placed on, so recovery diffs against it without `createTable()`
        // having to build `renderRows` up front (K31).
        onPlaced(rows, columns);
        target.set(next);
        if (options?.focusElement === true) {
          requests.update((count) => count + 1);
        }
      },
      focusRequests: requests.asReadonly(),
    },
  );
  return { focus, target };
}

// Builds the core half of the store before any feature runs, so a feature factory already
// sees `renderRows` and `totalRowCount` on the store it is handed.
function createBaseStore<TRow>(
  handle: TableCoreHandle<TRow>,
  focus: TableFocus,
): FoldingStore<TRow> {
  // Default is the row count before any virtualization/pagination trims what's actually
  // rendered — equals `renderRows().length` until a feature overrides it.
  const totalRowCount = computed(() => handle.core.rows().length);

  return {
    columns: handle.core.columns,
    rows: handle.core.rows,
    trackBy: handle.core.trackBy,
    value: handle.core.value,
    renderRows: handle.renderRows,
    renderColumns: handle.renderColumns,
    totalRowCount,
    indexById: handle.core.indexById,
    focus,
  };
}

// Calls every feature's pre-bound thunk in array order and registers what each declares.
// Members merge into `store` as they arrive — order-dependent at factory time, complete
// afterwards. `store` is one shared reference, so a feature reading it lazily (a method,
// `computed()`, a stage) sees every later feature too.
function foldFeatures<TRow>(
  features: readonly LabeledFeature<TRow>[],
  store: FoldingStore<TRow>,
  handle: TableCoreHandle<TRow>,
  registry: SlotRegistry,
): FeatureHooks {
  const hooks: FeatureHooks = { setup: [], onDestroy: [], onRowsRemoved: [] };
  const pipelineRules: LabelledStageRule<RowTransform<TRow>>[] = [];
  const renderRules: LabelledStageRule<RenderNodeTransform<TRow>>[] = [];

  for (const { run, label } of features) {
    const spec: TableFeatureSpec<TRow> = run();

    if (spec.stages) {
      for (const rule of spec.stages) {
        // Claim form (no `name`) occupies a built-in anchor's own slot — collision detection
        // stays here. Declare form is resolved, alongside every claim, once below.
        if (!('name' in rule)) {
          registry.claimStage(rule.anchor as PipelineStage, label);
        }
        pipelineRules.push({ label, rule });
      }
    }

    if (spec.renderStages) {
      for (const rule of spec.renderStages) {
        if (!('name' in rule)) {
          registry.claimRenderStage(rule.anchor as RenderStage, label);
        }
        renderRules.push({ label, rule });
      }
    }

    if (spec.members) {
      for (const key of Object.keys(spec.members)) {
        registry.claimMember(key, label);
      }
      Object.assign(store, spec.members);
    }

    if (spec.columnRules) {
      handle.columnRules.push(...spec.columnRules);
    }

    // Accumulates rather than single-claims — see `TableFeatureSpec.expandedRows` (ADR-0017).
    if (spec.expandedRows) {
      handle.expandedSources.push(spec.expandedRows);
    }

    // Accumulates rather than single-claims, like `expandedRows`.
    if (spec.contextRows) {
      handle.contextSources.push(spec.contextRows);
    }

    // Single-claim (ADR-0028) — a second contribution throws, naming both features.
    if (spec.parentLink) {
      registry.claimParentLink(label);
      handle.parentLink.value = spec.parentLink;
    }

    if (spec.setup) {
      hooks.setup.push(spec.setup);
    }
    if (spec.onDestroy) {
      hooks.onDestroy.push(spec.onDestroy);
    }
    if (spec.onRowsRemoved) {
      hooks.onRowsRemoved.push(spec.onRowsRemoved);
    }
  }

  // Resolved once per layer, after every feature has folded — a declared stage's final
  // position can depend on any anchor, claimed or declared, regardless of fold order.
  handle.stages.push(...resolveStageOrder('pipeline', pipelineRules));
  handle.renderStages.push(...resolveStageOrder('render', renderRules));

  return hooks;
}

/**
 * Composes the table's state layer from a core config and an ordered feature list into a
 * live store instance — no class, no DI token.
 *
 * @remarks
 * `internalFeatures` fold first, so a consumer feature's position in `features` is what
 * collision messages name. Must run inside an Angular injection context — `setup` hooks
 * create `effect()`/`resource()`, `onDestroy` hooks register on the ambient `DestroyRef`.
 */
export function composeTable<TRow>(
  config: TableEngineConfig<TRow>,
  features: readonly AnyTableFeature[],
  internalFeatures: readonly InternalFeature<TRow>[] = [],
): TableStore<TRow> {
  const handle = createTableCore<TRow>(config);

  // The core members are owned by the engine, so a feature declaring one collides at
  // construction like any other member clash instead of silently shadowing it.
  const registry = new SlotRegistry();
  registry.claimCoreMembers();

  // Stable reference — features that read it at factory time see the core members plus only
  // earlier features, features that read it from a method or computed see everything.
  let focusLayout: FocusLayout<TRow> | undefined;
  const { focus, target: focusTarget } = createFocus(handle, (rows, columns) => {
    focusLayout = { rows, columns, openPanelRowIds: untracked(() => readOpenPanelRowIds()) };
  });
  const store = createBaseStore(handle, focus);
  // Read only when `withExpansion()` is composed. Declared after `store` it closes over; called
  // only once a `moveTo` or the recovery effect runs.
  function readOpenPanelRowIds(): ReadonlySet<RowId> | undefined {
    return hasMember(store, 'expansion') ? store.expansion() : undefined;
  }

  // Note: `parentOf` is a getter over `handle.parentLink`. The contributing feature may fold
  // after a reader's factory runs; a copied value would stay `undefined` for earlier features.
  const stageContext: StageContext<TRow> = {
    get parentOf() {
      return handle.parentLink.value;
    },
    contextRows(): ReadonlySet<RowId> {
      return handle.contextRows() ?? EMPTY_CONTEXT_ROWS;
    },
  };

  const hooks = foldFeatures(
    [
      ...labelFeatures<TRow, InternalFeature<TRow>>(
        internalFeatures,
        describeInternalFeature,
        (feature) => feature(handle.core),
      ),
      // `AnyTableFeature` erases `In`/`Out` to `any`, so calling it back statically resolves to
      // `TableFeatureSpec<unknown>` — the same static/dynamic seam `create-table.ts` bridges
      // with its own cast, just met here instead of there.
      ...labelFeatures<TRow, AnyTableFeature>(
        features,
        describeFeature,
        (feature) => feature(store, stageContext) as TableFeatureSpec<TRow>,
        (feature) => feature.displayName,
      ),
    ],
    store,
    handle,
    registry,
  );

  // Hooks run only once every feature is composed, so a `setup` can read any other
  // feature's members.
  for (const setup of hooks.setup) {
    setup();
  }
  if (hooks.onDestroy.length > 0) {
    const destroyRef = inject(DestroyRef);
    for (const onDestroy of hooks.onDestroy) {
      destroyRef.onDestroy(onDestroy);
    }
  }

  // Reconciles feature state (expanded rows, open edits, ...) against `data`. An effect, not
  // a hook inside `updateRows` — a full `data.set(...)` replacement (paging,
  // refetch, a WebSocket snapshot) never passes through `core.value.update(...)`, so a
  // write-site hook would miss exactly the case where every id is orphaned at once. Seeding
  // `previousIds` before the effect exists means its first run diffs against itself instead of
  // reporting every row as removed at construction.
  if (hooks.onRowsRemoved.length > 0) {
    let previousIds = new Set(handle.core.indexById().keys());
    effect(() => {
      const currentIds = new Set(handle.core.indexById().keys());
      const removed = diffRemovedIds(previousIds, currentIds);
      previousIds = currentIds;
      if (removed.length > 0) {
        for (const onRowsRemoved of hooks.onRowsRemoved) {
          onRowsRemoved(removed);
        }
      }
    });
  }

  // Repairs the focus target when rows or columns change. Unconditional: any table can hold
  // focus. Writes `target` directly, not `moveTo`: recovery is silent and requests no DOM focus.
  // Reads nothing but the target while focus is unset, so a table nobody focused builds no
  // `renderRows` here. `moveTo` records the layout it placed focus on; the effect compares
  // against that and skips when rows, columns and open panels are the same references (K31).
  effect(() => {
    const current = focusTarget();
    if (current === null) {
      focusLayout = undefined;
      return;
    }
    const rows = handle.renderRows();
    const columns = handle.renderColumns();
    const openPanelRowIds = readOpenPanelRowIds();
    const previous = focusLayout ?? { rows, columns, openPanelRowIds };
    const isLayoutUnchanged =
      previous.rows === rows &&
      previous.columns === columns &&
      previous.openPanelRowIds === openPanelRowIds;
    focusLayout = { rows, columns, openPanelRowIds };
    if (isLayoutUnchanged) {
      return;
    }
    const columnIds = columns.map((column) => column.id);
    const rowIds = new Set(handle.core.rows().map((row) => handle.core.trackBy(row)));
    const isTreegrid = 'tree' in store;
    const recovered = untracked(() =>
      recoverFocus(
        current,
        { rows: previous.rows, columnIds: previous.columns.map((column) => column.id) },
        { rows, columnIds, rowIds },
        { openPanelRowIds, isTreegrid },
      ),
    );
    if (!isSameFocusTarget(recovered, current)) {
      focusTarget.set(recovered);
    }
  });

  // The one seam where static typing gives way to dynamic composition: feature members are
  // folded from a runtime-length array. The cast in `create-table.ts` is the static/dynamic
  // boundary.
  return store;
}

// Feature members are folded at runtime, so presence is checked by key, not by static type.
function hasMember<K extends string>(
  value: object,
  key: K,
): value is Record<K, () => ReadonlySet<RowId>> {
  return key in value;
}
