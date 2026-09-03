# NGP Table — implementation invariants and architecture

**Scope:** Internal implementation rules for table maintainers. Consumers use the public API exported from `index.ts`; those contracts are in `docs/`.

## What this is

Data table engine for Angular 19+. Three-layer stack: state management (`createTable()`), column schema definition, and UI-layer directives. Attribute-only, no structural DOM injection. Ships as an Angular service + signals + directives, composable with `with-*()` feature plugins.

## Locked invariants — DO NOT CHANGE

These are architectural constraints agreed in drilling sessions. Changing them requires cross-team decision and a new ADR.

- **Native `<table>` or `<div>` grid, one directive set.** Superseded 2026-08-17 by [ADR-0005](docs/adr/0005-generic-table-host.md) — selectors are dual-tag (`table[ngpTable], div[ngpTable]`, etc.), ARIA roles injected unconditionally regardless of host tag (matches Angular CDK Table precedent). Still no shadow DOM. Status `proposed`; div-grid path not yet implemented — see ADR open questions before building it.
- **Attribute-only directives** — never insert/remove/reorder DOM. Structural logic lives in the template (consumer's responsibility).
- **`createTable()` returns an instance, not a class.** Consumers call `const table = createTable(…)`, not `new Table(…)`.
- **`rows()` never returns wrapper objects.** Store yields `RenderRow<TRow>[]` directly; consumers get raw row data with layout/state fields colocated.
- **State as `data-*` attributes, values as CSS custom properties.** No inline styles on directives; no attribute duplication for styling and data.

## Code layout — folders by lifecycle phase

Modeled on Angular Signal Forms (`packages/forms/signals/src`), which groups by *when code
runs* — declare (`api/`) → compile/run (`field/`, `schema/`) — not by feature. See ADR-0004.
`schema/` and `mutations/` were split out of an overloaded `api/` (29 files) into their own
sibling folders, matching how Angular's own `api/` stays narrow by keeping `field/`/`schema/`
as top-level siblings rather than subfolders. See ADR-0008.

```
index.ts        ← the ONLY definition of the public surface. No other barrels.
api/            ← factory + declaration surface a consumer touches
schema/         ← column schema DSL: columnSchema(), metadata, visibility/sort rules
mutations/      ← row and column mutation verbs
engine/         ← the runtime; nothing here is exported
directives/     ← UI layer
table.mock.ts   ← shared test fixtures
```

| File | Purpose |
|---|---|
| `index.ts` | Public API. `api/`, `schema/`, `mutations/`, `engine/`, `directives/` deliberately have **no** barrels — if it isn't listed here it's internal |
| `api/types.ts` | Public and internal type definitions: `ColumnDef`, `RenderRow`, `TableStore` interface |
| `api/create-table.ts` | The `createTable()` factory only — resolves config, composes, wires the data effect |
| `api/table-schema.ts` | `createTableSchema()` — the config builder |
| `api/features/with-*.ts` | Feature plugins: `withSorting()`, `withExpansion()`, `withOptimistic()`, `withRowEdit()`. One file each |
| `api/features/editing-state.ts` | The editing state model — `RowRestorePoint` (value + position + `detached`), `EditingState`/`EditingUpdater`, `pendingIds()`, and `createEditingStore()`. **Not a feature**: `withOptimistic()` and `withRowEdit()` each call the factory, so neither reads the other's signal and composition never depends on `features` order (D37/A2) |
| `schema/column-schema.ts` | `columnSchema()` and the `ColumnsPath` proxy |
| `schema/column-rules.ts` | `applyVisible()` / `applyVisibleAsync()` — convenience wrappers over `metadata()`/internal `metadataAsync()` targeting the unexported `VISIBLE` key (`engine/columns.ts`); public signatures unchanged |
| `schema/column-metadata.ts` | `createColumnMetaKey()` / `metadata()` / `readColumnMeta()` — consumer-facing, non-participating column side channel, plus internal `metadataAsync()` (used only by `column-rules.ts`). Not the internal metadata+reducer core sketched in `docs/2-columns/reference/signal-forms-techniques.md` §1 |
| `schema/column-schema.types.ts` | `ColumnHandle`, `ColumnRule`, `ColumnSchema`, `ColumnsSchemaStore`, `ColumnMetaKey`, `MetadataRule`, `MetadataAsyncRule` |
| `mutations/update-columns.ts` | `setColumns`/`reorderColumns`/`toggleColumnVisibility` updater factories, consumed via `table.columns.update(updater)` (D30) — writes always target `baseColumns` internally, never the derived fold |
| `mutations/optimistic-mutations.ts` | `captureEdit`/`releaseEdit`/`revertEdit`/`discardEdit`/`removeEdit`/`patchEdit` — the rollback and capture-composing verbs, meaningful under either editing feature |
| `mutations/row-edit-mutations.ts` | `beginEdit`/`endEdit`/`clearEdit` — the edit-session verbs; no-ops without `withRowEdit()` |
| `mutations/row-mutations.ts` | `insertRow`/`removeRow`/`patchRow` — the core row updater verbs |
| `engine/compose-table.ts` | `composeTable()`: folds features, wires hooks. Nothing else |
| `engine/core.ts` | `createTableCore()`: the consumer's row-data signal is the single source of truth for rows (no internal row copy), wrapped as `core.value` — a `WritableView` (`.update(updater)` writes through, D30). Columns split the same way but through an extra derivation: `baseColumns` (writable, private closure var, the actual write target) + `columnRules` (mutable array, populated additively by `composeTable()`'s `foldFeatures()` from each feature's `TableFeatureSpec.columnRules`) + `core.columns` — a `WritableView` reading `foldColumnRules(baseColumns(), columnRules)` and writing through to `baseColumns`. Plus the pipeline computeds. No bare mutation methods — every write is `table.<slice>.update(updater)` on the per-slice `WritableView` member (`engine/writable-view.ts`), D30 |
| `engine/pipeline.ts` | `PIPELINE_ORDER` + `runPipeline()`. **`PipelineStages` is derived from the array** — one declaration, so a typed stage is always an executed stage |
| `engine/columns.ts` | Pure `ColumnDef[] → ColumnDef[]` transforms. No signals, no Angular |
| `engine/rows.ts` | Pure `normalizeTrackBy` / `buildDefaultRenderRows` |
| `engine/slots.ts` | `SlotRegistry` — every single-occupancy collision message lives here. Claims stages, `renderRows`, **and member keys** (ADR-0007): two features declaring the same member throw at construction rather than silently overwriting via `Object.assign` |
| `engine/types.ts` | `TableCore`, `TableFeatureSpec`, `TableFeature`, `TableEngineConfig` — the feature contract |
| `engine/writable-view.ts` | `createWritableView()` / `WritableView<T, Updater>` — the `() => T` read + `.update(updater)` write shape backing `table.value`/`table.columns`/`table.editing` (D30). Used by `engine/core.ts` (`value`, `columns`) and `api/features/editing-state.ts` (`editing`, declared by whichever editing feature is composed — always exactly one) |
| `engine/columns-schema/` | Always-spliced internal composition step (ADR-0010), not a consumer `with*()` plugin — `resolve.ts` (compile — `resolveColumnsConfig()`) → `wiring.ts` (run) → `wire-columns-schema.ts` (declare — `wireColumnsSchemaAsync()`) |
| `directives/` | `ngp-table.directive.ts`, `ngp-table-row.directive.ts`, `table.tokens.ts` |
| `*.spec.ts` | Unit tests; always live colocated with the source file |

Naming: the folder supplies the domain, so files inside drop the `table.` prefix
(`engine/pipeline.ts`, not `engine/table.pipeline.ts`). Kebab-case, not Angular's internal
snake_case — `.claude/rules/file-organization.md` governs.

**`api/types.ts` ↔ `engine/types.ts` is a deliberate type-only import cycle.** Both sides must
stay `import type`; making either a value import breaks the build.

## Naming conventions — internal state and type narrowing

- **No private store members.** The engine exposes nothing internal on the store: pipeline stages
  and the render-row builder are `composeTable()` closure variables, and a feature's internal
  state (a `Subject`, an unread signal) stays a closure variable in its factory. There is no
  `_`-prefix convention and no `OmitPrivate` type stripping them — both were removed with
  `@ngrx/signals` (ADR-0003). If a future feature genuinely needs a private *store* member,
  reintroduce `OmitPrivate` in `api/types.ts` rather than leaking it.
- **Features declare, never mutate.** A feature returns a `TableFeatureSpec` — `{ members,
  stages, renderRows, setup, onDestroy }`. Injecting behavior by writing to the store object
  is not a supported mechanism.

- **Directive composition — `hostDirectives` vs. public directives:** `hostDirectives` is statically resolved, so use it only for behavior that is **unconditional** (always-present core bindings) or for sharing internal mechanism between feature directives (private, never exported from `index.ts`). Behavior that is **opt-in** gets its own public directive the consumer places. Host-composing a feature into a core directive applies it to every table, defeats tree-shaking, and forces the feature's inputs to be re-declared in the core directive's metadata. See the rejected-alternatives section of `docs/3-ui/directives/expansion.md`.
- **Which `RenderRow` fields a directive may bind:** core directives bind the required fields (`id`, `depth`, `kind`); feature directives bind the optional, feature-contributed ones (`isExpanded`, `hasChildren`, `aggregates`). An optional field is `undefined` whenever its `with-*()` feature is not composed, so binding it from a core directive emits a lie on every table that lacks the feature.

- **Type narrowing:** Use `as const` on discriminators (`data-row-kind: 'header' | 'body' as const`); never use bare `as` assertions. Type guards preferred over assertions.

## Docs structure — three streams, permanent vs. episodic

Docs are numbered by dependency order: state layer (1) → columns layer (2) → UI layer (3).

| Location | Purpose | Update pattern |
|---|---|---|
| `docs/1-state/prd.md`, `architecture.md`, `features/` | State-layer specs, one per feature plugin; feature-local config | Permanent; edited in place as code changes |
| `docs/1-state/row-mutations.md` | Core-API spec — `table.value.update()` + the row updaters. Not in `features/` because mutation is core, not a `with-*()` plugin (D8) | Permanent |
| `docs/2-columns/reference/` | Column schema reference (tier levels, ownership, derivation); read-only reference | Permanent; reflects current schema semantics |
| `docs/3-ui/directives/` | Directive specs and API contracts, one per directive; core pattern + DI wiring | Permanent; edited in place as directives ship |
| `docs/3-ui/stories.md` | Storybook story conventions for `src/stories/` — file layout, story-host shape, mocking-actions pattern | Permanent; edited in place as story practice evolves |
| `docs/3-ui/work/<slug>/` | Episodic work folder: intake ticket, decisions, issues, task steps. One folder per implementation effort (e.g. `core-directives`, `with-expansion`) | Episodic; created fresh per effort, archived after ship |

**Key rule:** Specs live in the stream's numbered folder (e.g. `docs/1-state/features/expansion.md`). Work happens in `docs/3-ui/work/<slug>/` (or `docs/1-state/work/with-expansion/` for state-layer efforts). Specs are edited in place; work folders are episodic containers.

## The `ColumnDef` footprint — incomplete

**WARNING:** Several fields appear in docs but have no implementation yet:

- `ColumnDef.width` — typed, sketched in `docs/2-columns/reference/`, not used by code. Blocked on presentation-fields ADR.
- `statusMessage` — drafted in specs, not wired. Accessibility message channel TBD.

Reading a spec that mentions these does NOT mean they work; check `api/types.ts` for what's actually exported.

## Before implementing a feature

1. **Read the 3-stream architecture index:** `docs/3-ui/architecture.md` — marks which features are blocked, which are deferred, which are ready.
2. **Locate the spec:** check the stream folder (e.g. `docs/1-state/features/expansion.md` for a state feature). Spec is the contract; code must match it exactly.
3. **Check for a work folder:** if one exists (e.g. `docs/3-ui/work/core-directives/`), read `2-decisions.md` — it records what was decided during grill/interview, not what your PR should decide again.
4. **Verify blockers:** `docs/3-ui/architecture.md` lists what else must ship first (e.g. `ngpTableRow` must exist before any row-scoped directive can land).

## Feature plugin pattern (`api/features/with-*.ts`)

All feature plugins follow the same shape: a config-taking outer function returning a factory
that receives the core store and **declares** what it contributes.

```ts
export function withFeature<TRow = unknown>(config: FeatureConfig = {}) {
  return createTableFeature<TRow, FeatureMembers>((core) => {
    // The feature owns its own signals — no engine-managed state, no patchState.
    const someState = signal(initial);

    return {
      members: { someState: someState.asReadonly(), someMethod },
      stages: { sort: (rows) => ... },   // optional: one pipeline stage
      renderRows: (rows) => ...,          // optional: at most one feature may declare this
      setup: () => ...,                   // optional: runs after the full fold, in DI context
    };
  });
}
```

`createTableFeature` (exported from `index.ts`) is the public authoring entry point — a pure
identity function that infers `core: TableCore<TRow>` and the return type from `Members`, so a
consumer authoring a custom feature never needs to name `TableCore`/`TableFeatureSpec`
directly. Internal `with-*()` files may still annotate with `TableCore`/`TableFeatureSpec`
from `engine/types.ts` directly (as `withExpansion` does) since engine/ is already in scope —
`createTableFeature` exists for code outside this package.

Rules:
- Add a pipeline stage by editing `PIPELINE_ORDER` in `engine/pipeline.ts` — nothing else.
  `PipelineStages` derives from it, so there is no second list to keep in sync.
- A second feature claiming the same `stages` key, the same **member key** (ADR-0007), or a
  second claiming `renderRows`, **throws at construction** — this is why `withExpansion()` and a future `withGrouping()` cannot yet be
  composed together.
  **Pending change:** [ADR-0011](docs/adr/0011-chained-render-stages.md) (`proposed`) replaces the
  single-claim `renderRows` with an ordered, multi-claim `RENDER_ORDER` chain over `RenderRow[]`,
  and [ADR-0012](docs/adr/0012-split-expansion-into-panel-and-tree.md) (`proposed`) splits
  `withExpansion()` into a detail-panel feature (no render stage) plus a new `withTree()`. Read
  both before touching `renderRows`, `SlotRegistry.claimRenderRows()`, or `withExpansion()`.
- **If your feature stores `RowId`s, declare `onRowsRemoved`** ([ADR-0006](docs/adr/0006-row-id-state-reconciliation.md)).
  The engine diffs `indexById` and announces ids that left `data`; the feature prunes its own
  state with `pruneByIds()` (`engine/rows.ts`). Not enforced by the type system — forget it and
  the feature retains dead ids until someone deletes a row and notices. Exemptions are per slice
  and belong to the feature: `everExpanded` (additive ledger) and `detached` restore points
  (D45's delete rollback — captured by a verb that then removed the row) are the two that exist.
  Both editing features share one `onRowsRemoved` from `createEditingStore()`, which prunes `open`
  and `snapshots` together and keeps the `detached` exemption; `pending` is derived and never
  pruned.
- The factory's second parameter (`composed`) is the feature-to-feature seam: earlier features'
  members at factory time, all features' members when read later. **No feature uses it**, and the
  two editing features deliberately do not: they share state through `createEditingStore()`
  instead, so composition is never array-order dependent (D37/A2).
- Export a named `*Members` interface — `ComposedFeatureMembers` reads it to type the store.

Plugins compose via the `features` array in `createTable()`'s config, not chained calls:

```ts
createTable(data, () => ({
  trackBy: 'id',
  columns,
  features: [withSorting<Person>(), withExpansion<Person>()],
}));
```

Array order does NOT set execution order — pipeline order is fixed (filter → group → sort → expand) regardless of `features` order. Do NOT use `.pipe()` chaining or a builder pattern.

## Testing

- Unit tests in `*.spec.ts` (colocated with source) — logic-only, use `TestBed` or `vitest`.
- **Everything in `engine/` except `compose-table.ts` is pure** — no signals, no Angular. Test it
  with plain `vitest`; reaching for `TestBed` there means the logic ended up in the wrong file.
- No content/structural tests (rendering, DOM projection). Structural tests belong in directive specs (`docs/3-ui/directives/*.spec.ts`), not store tests.
- Mock row data in `table.mock.ts` (exported, reusable); don't inline fixtures.

## Conventions NOT documented here

Stack-wide patterns (TypeScript, Angular, monorepo build) are in the root repo's `CLAUDE.md` and the library's parent `CONTEXT.md`. This file is table-specific only.
