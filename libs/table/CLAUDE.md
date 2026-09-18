# NGP Table — implementation invariants and architecture

**Scope:** Internal implementation rules for table maintainers. Consumers use the public API exported from `index.ts`; those contracts are in `docs/`.

## What this is

Data table engine for Angular 19+. Three-layer stack: state management (`createTable()`), column schema definition, and UI-layer directives. Attribute-only, no structural DOM injection. Ships as an Angular service + signals + directives, composable with `with-*()` feature plugins.

## Locked invariants — DO NOT CHANGE

These are architectural constraints agreed in drilling sessions. Changing them requires cross-team decision and a new ADR.

- **Native `<table>` or `<div>` grid, one directive set.** Superseded 2026-08-17 by [ADR-0005](docs/adr/0005-generic-table-host.md) — selectors are dual-tag (`table[ngpTable], div[ngpTable]`, etc.), ARIA roles injected unconditionally regardless of host tag (matches Angular CDK Table precedent). Still no shadow DOM. Read the ADR — including its status and open questions — before building the div-grid path.
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
src/
  index.ts      ← the table's own public surface; the only barrel (ADR-0004's 2026-09 #93 amendment)
  api/          ← factory + declaration surface a consumer touches
  schema/       ← column schema DSL: columnSchema(), metadata, visibility/sort rules
  mutations/    ← row and column mutation verbs
  engine/       ← the runtime; nothing here is exported
  directives/   ← UI layer
  table.mock.ts ← shared test fixtures
tools/          ← repo-side utilities, OUTSIDE src/ so they stay out of the published build
docs/           ← this library's own docs (see "Docs structure" below)
```

| File | Purpose |
|---|---|
| `index.ts` | Public API. `api/`, `schema/`, `mutations/`, `engine/`, `directives/` deliberately have **no** barrels — if it isn't listed here it's internal. Lists filtering's rules, matchers and public types (`Filters`, `FilterNode`, `FilterOptions`, `FiltersPath`) explicitly, same as every other feature — `filters/` was a second domain with its own barrel until R50 (ADR-0004, 2026-09 #93 amendment) closed the standalone trajectory that justified it |
| `api/features/with-filtering/` | `feature.ts` (declare — `withFiltering()`), `rules.ts`, `matchers.ts`, public `types.ts`. Its own `index.ts` re-exports only `feature.ts` — a resolution convenience, not a second barrel |
| `engine/filters/` | `create-filters.ts` (compile — `buildFilterModel()`), `state.ts`/`evaluator.ts` (run), `validate.ts`, internal `types.ts`. Nothing here is reachable from `src/index.ts`; a consumer reaches the model through `withFiltering`'s `schema` config |
| `api/types.ts` | Public and internal type definitions: `ColumnDef`, `RenderRow`, `TableStore` interface |
| `api/create-table.ts` | The `createTable()` factory only — resolves config, composes, wires the data effect |
| `api/create-table.overloads.ts` | **Generated** — `CreateTableOverloads`, the 16 call signatures typing `createTable()`, one per arity 0-15. Never hand-edit; fix `tools/generate-overloads.ts` and run `npm run table:overloads` |
| `api/features/with-*.ts` | Feature plugins: `withSorting()`, `withExpansion()`, `withSelection()`, `withGrouping()`, `withFiltering()`, `withOptimistic()`, `withRowEdit()`, `withComputed()`. One file each |
| `api/features/with-computed.ts` | `withComputed(block)` — library-declared derived state as a feature. The block is validated at construction (it must return signals; a throw while declaring throws) and every returned signal is rewrapped to report its member key and rethrow at evaluation (ADR-0014). Both checks live here, never in the fold |
| `api/features/compose-features.ts` | `composeFeatures(...features)` — collapses N features into one `createTable()` slot, the arity escape hatch. Inner features fold against a per-composite `SlotRegistry` and merge into one spec; collisions are labelled `composeFeatures inner feature N` |
| `api/features/editing-state.ts` | The editing state model — `RowRestorePoint` (value + position + `op`), `EditingState`/`EditingUpdater`, `pendingIds()`, and `createEditingStore()`. **Not a feature**: `withOptimistic()` and `withRowEdit()` each call the factory, each building its own instance. Composing both explicitly is a duplicate `editing` member claim and throws (ADR-0007), in either argument order |
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
| `engine/render-stages.ts` | `RENDER_ORDER` + `runRenderStages()` — the `RenderRow[] → RenderRow[]` mirror of `pipeline.ts` (ADR-0011). **`RenderStages` is derived from the array**, same invariant as `PipelineStages` |
| `engine/columns.ts` | Pure `ColumnDef[] → ColumnDef[]` transforms. No signals, no Angular |
| `engine/rows.ts` | Pure `normalizeTrackBy` / `buildDefaultRenderRows` — the always-run `RenderRow[]` seed a render stage chain starts from (ADR-0011) |
| `engine/slots.ts` | `SlotRegistry` — every single-occupancy collision message lives here. Claims pipeline stages, render stages, **and member keys** (ADR-0007): two features declaring the same member throw at construction rather than silently overwriting via `Object.assign` |
| `engine/types.ts` | `Feature<In, Out>`, `Shape`, `RowOf`, `TableCore`, `TableFeatureSpec`, `TableEngineConfig` — the feature contract |
| `engine/writable-view.ts` | `createWritableView()` / `WritableView<T, Updater>` — the `() => T` read + `.update(updater)` write shape backing `table.value`/`table.columns`/`table.editing` (D30). Used by `engine/core.ts` (`value`, `columns`) and `api/features/editing-state.ts` (`editing`, declared by whichever editing feature is composed — always exactly one) |
| `engine/columns-schema/` | Always-composed internal step (ADR-0010), not a consumer `with*()` plugin — `createTable()` passes it to `composeTable()`'s `internalFeatures` parameter, which folds before consumer features and labels collisions `internal feature N`, so it never shifts a consumer's own position — `resolve.ts` (compile — `resolveColumnsConfig()`) → `wiring.ts` (run) → `wire-columns-schema.ts` (declare — `wireColumnsSchemaAsync()`) |
| `directives/` | `ngp-table.directive.ts`, `ngp-table-row.directive.ts`, `table.tokens.ts` |
| `*.spec.ts` | Unit tests; always live colocated with the source file |
| `tools/generate-overloads.ts` | Regenerates the two `*.overloads.ts` files (arity 15). `npm run table:overloads`; `npm run table:overloads:check` fails on drift |
| `tools/generate-status.ts` | Regenerates `docs/status.md` from the specs' frontmatter. Run `npm run table:status` (add `-- --dry-run` to print instead of write). Deliberately outside `src/` — `tsconfig.lib.json` includes `src/**/*.ts`, so anything there ships in the published build |

Naming: the folder supplies the domain, so files inside drop the `table.` prefix
(`engine/pipeline.ts`, not `engine/table.pipeline.ts`; `engine/filters/types.ts`, not
`engine/filters/filters.types.ts`). A factory verb is not the domain, so
`engine/filters/create-filters.ts` keeps its name — it is named for the symbol it exports, like
`api/create-table.ts`. Kebab-case, not Angular's internal snake_case —
`.claude/rules/file-organization.md` governs.

**`api/types.ts` ↔ `engine/types.ts` is a deliberate type-only import cycle.** Both sides must
stay `import type`; making either a value import breaks the build. Same shape, same invariant,
for **`api/features/with-filtering/types.ts` ↔ `engine/filters/types.ts`**: `FilterOptions.when`
(public) reads through `FilterValueOfContext` (engine-internal), and `FilterRuleRecord.options`
(engine-internal) is typed as `FilterOptions` (public).

## Naming conventions — internal state and type narrowing

- **No private store members.** The engine exposes nothing internal on the store: pipeline stages,
  render stages, and the render-row seed are `composeTable()`/`createTableCore()` closure
  variables, and a feature's internal state (a `Subject`, an unread signal) stays a closure
  variable in its factory. There is no `_`-prefix convention and no `OmitPrivate` type stripping
  them — both were removed with `@ngrx/signals` (ADR-0003). If a future feature genuinely needs a
  private *store* member, reintroduce `OmitPrivate` in `api/types.ts` rather than leaking it.
- **Features declare, never mutate.** A feature returns a `TableFeatureSpec` — `{ members,
  stages, renderStages, setup, onDestroy }`. Injecting behavior by writing to the store object
  is not a supported mechanism.

- **Directive composition — `hostDirectives` vs. public directives:** `hostDirectives` is statically resolved, so use it only for behavior that is **unconditional** (always-present core bindings) or for sharing internal mechanism between feature directives (private, never exported from `index.ts`). Behavior that is **opt-in** gets its own public directive the consumer places. Host-composing a feature into a core directive applies it to every table, defeats tree-shaking, and forces the feature's inputs to be re-declared in the core directive's metadata. See the rejected-alternatives section of `docs/3-ui/directives/expansion.md`.
- **Which `RenderRow` fields a directive may bind:** core directives bind the required fields (`id`, `depth`, `kind`); feature directives bind the optional, feature-contributed ones (`isExpanded`, `hasChildren`, `aggregates`). An optional field is `undefined` whenever its `with-*()` feature is not composed, so binding it from a core directive emits a lie on every table that lacks the feature.

- **Type narrowing:** Use `as const` on discriminators (`data-row-kind: 'header' | 'body' as const`); never use bare `as` assertions. Type guards preferred over assertions.

- **`when` vs `enable` on a rule's predicates** ([ADR-0018](docs/adr/0018-when-vs-enable-predicate-naming.md)):
  `when` is the default name for any dynamically-toggled conditional, data- or state-driven alike.
  `enable` is reserved for the narrow case where one rule object must carry two orthogonal
  predicates — one data-driven, one external-state-driven — that cannot share a name; there, the
  external-state one becomes `enable` and `when` is freed for the data-driven one (grouping's
  `applyGrouping({ enable?, when })` is the only feature with this shape today — `enable` is
  optional; a rule with no activation opinion omits it rather than abstaining the whole set).

- **Errors: throw at construction, degrade at runtime** ([ADR-0014](docs/adr/0014-runtime-error-policy.md)).
  Wiring errors — slot/member collisions, duplicate registration, a `trackBy` naming no field —
  throw, and every existing throw site is one of these. A **consumer callback** (`accessor`,
  `sortFn`, `aggregateFn`, a filter predicate) must never take the table down: it falls back to a
  defined value, chosen so the failure is visible rather than silent, and reports once per
  callback per evaluation in production as well as dev. Wrap per callback, never per row.
  A new feature taking a consumer callback names its own fallback in the ADR's table.
  **Not enforced by types.** Some call sites predate this policy, so the absence of a wrap in
  existing code is never precedent for leaving the next one unwrapped — check the ADR, not the
  neighbouring code.

## Docs structure — three streams, permanent vs. episodic

Docs are numbered by dependency order: state layer (1) → columns layer (2) → UI layer (3).

| Location | Purpose | Update pattern |
|---|---|---|
| `docs/1-state/prd.md`, `architecture.md`, `features/` | State-layer specs, one per feature plugin; feature-local config | Permanent; edited in place as code changes |
| `docs/status.md` | Every capability's spec/code maturity, state and UI layer side by side. The entry point for "what's the state of X?" | **Generated** — `npm run table:status`. Never hand-edit; fix the owning spec's frontmatter and regenerate |
| `docs/1-state/row-mutations.md` | Core-API spec — `table.value.update()` + the row updaters. Not in `features/` because mutation is core, not a `with-*()` plugin (D8) | Permanent |
| `docs/1-state/state-persistence.md` | Cross-feature spec — one atomic snapshot of sort + columns + filters + pagination. Sibling of `row-mutations.md` for the same D8 reason: persistence spans features, it isn't one plugin's state | Permanent |
| `docs/2-columns/reference/` | Column schema reference (tier levels, ownership, derivation); read-only reference | Permanent; reflects current schema semantics |
| `docs/3-ui/directives/` | Directive specs and API contracts, one per directive; core pattern + DI wiring | Permanent; edited in place as directives ship |
| `docs/3-ui/stories.md` | Storybook story conventions for `src/stories/` — file layout, story-host shape, mocking-actions pattern | Permanent; edited in place as story practice evolves |
| `docs/3-ui/work/<slug>/` | Episodic work folder: intake ticket, decisions, issues, task steps. One folder per implementation effort (e.g. `core-directives`, `with-expansion`) | Episodic; created fresh per effort, archived after ship |

**Key rule:** Specs live in the stream's numbered folder (e.g. `docs/1-state/features/expansion.md`). Work happens in `docs/3-ui/work/<slug>/` (or `docs/1-state/work/with-expansion/` for state-layer efforts). Specs are edited in place; work folders are episodic containers.

### Feature-spec frontmatter — required fields

Feature-scoped specs (`docs/1-state/features/*.md`, `docs/3-ui/directives/*.md`, and
cross-feature capability specs like `docs/1-state/state-persistence.md`) declare three machine-read
fields. Architecture, PRD and reference docs do **not** — they keep a free-text `status:`.

```yaml
capability: selection                    # groups the state and UI docs for one feature
spec: none | stub | drafted | drilled    # none → no file; stub → placeholder; drafted → written, never drilled; drilled → contract settled
code: none | partial | shipped           # state-layer implementation in src/
```

Two axes, not one: `spec: drafted, code: none` (designed, unbuilt) and `spec: drilled, code:
partial` are both real states that a single free-text `status:` string cannot express — which is
why the old one-line form is gone.

`docs/status.md` is **generated** from these fields — one row per `capability:`, pairing its state
and UI docs. Never hand-edit it; fix the owning spec's frontmatter and regenerate. Omit these
fields on a new feature spec and it silently vanishes from the roll-up.

Vocabulary, per-file assigned values, and the competitive-verdict block format:
[`docs/1-state/work/state-feature-competitive-audit/decisions.md`](docs/1-state/work/state-feature-competitive-audit/decisions.md).

## Specs describe intent, not necessarily shipped code

A field named in a spec or reference doc is not proof it is wired — several are typed or drafted
ahead of implementation. `api/types.ts` is what is actually exported, and `docs/status.md`
(generated) is what is actually built. Check those, never this file, for the state of anything.

## Before implementing a feature

1. **Read the 3-stream architecture index:** `docs/3-ui/architecture.md` — marks which features are blocked, which are deferred, which are ready.
2. **Locate the spec:** check the stream folder (e.g. `docs/1-state/features/expansion.md` for a state feature). Spec is the contract; code must match it exactly.
3. **Check for a work folder:** if one exists (e.g. `docs/3-ui/work/core-directives/`), read `2-decisions.md` — it records what was decided during grill/interview, not what your PR should decide again.
4. **Verify blockers:** `docs/3-ui/architecture.md` lists what else must ship first (e.g. `ngpTableRow` must exist before any row-scoped directive can land).

## Feature plugin pattern (`api/features/with-*.ts`)

All feature plugins follow the same shape: a config-taking outer function returning a factory
that receives the accumulating store and **declares** what it contributes. The factory's own
parameter type is what fixes `In`; the row type is recovered from it as `RowOf<In>`, never
written at the call site.

```ts
export function withFeature<In extends Shape>(config: FeatureConfig = {}) {
  return createTableFeature((store: In) => {
    // The feature owns its own signals — no engine-managed state, no patchState.
    const someState = signal(initial);

    return {
      members: { someState: someState.asReadonly(), someMethod },
      stages: { sort: (rows) => ... },          // optional: one pipeline stage
      renderStages: { tree: (rows) => ... },    // optional: one or more named render stages
      setup: () => ...,                   // optional: runs after the full fold, in DI context
    };
  });
}
```

`createTableFeature` (exported from `index.ts`) is the public authoring entry point. Two call
forms: `createTableFeature(factory)` is the identity, inferring `In`/`Out` from `factory`'s own
signature; `createTableFeature(factory, derive)` additionally plumbs a trailing derive block —
the block is called with `In & Out` and its members merge into the returned `Feature<In, Out &
D>`. A block declaring `stages`/`renderStages`/`columnRules`, or a member key the feature
already declared, throws at construction.

Rules:
- Add a pipeline stage by editing `PIPELINE_ORDER` in `engine/pipeline.ts` — nothing else.
  `PipelineStages` derives from it, so there is no second list to keep in sync.
- Add a render stage by editing `RENDER_ORDER` in `engine/render-stages.ts` — nothing else.
  `RenderStages` derives from it, same invariant as `PipelineStages`.
- A second feature claiming the same `stages` key, the same `renderStages` key, or the same
  **member key** (ADR-0007), **throws at construction**. Render stages are per-named-stage
  collision, not whole-layer (ADR-0011) — `withExpansion()` claims `'tree'`, leaving
  `'group'`/`'paginate'` free for `withGrouping()`/`withPagination()` once built.
  [ADR-0012](docs/adr/0012-split-expansion-into-panel-and-tree.md) covers splitting
  `withExpansion()` into a detail-panel feature plus a `withTree()` claiming `'tree'` — read it,
  and its current status, before touching `renderStages` or `withExpansion()`.
- **If your feature stores `RowId`s, declare `onRowsRemoved`** ([ADR-0006](docs/adr/0006-row-id-state-reconciliation.md)).
  The engine diffs `indexById` and announces ids that left `data`; the feature prunes its own
  state with `pruneByIds()` (`engine/rows.ts`). Not enforced by the type system — forget it and
  the feature retains dead ids until someone deletes a row and notices. Exemptions are per slice
  and belong to the feature: `everExpanded` (additive ledger) and `op: 'delete'` restore points
  (D45's delete rollback — captured by a verb that then removed the row) are the two that exist.
  Both editing features share one `onRowsRemoved` from `createEditingStore()`, which prunes `open`
  and `snapshots` together and keeps the `op: 'delete'` exemption; `pending` is derived and never
  pruned.
- The factory's single parameter is the store itself, and the feature-to-feature seam: the core
  members plus earlier features' members at factory time, all features' members when read later
  (the store is one shared reference, so a deferred read sees every later feature). Core members
  (`columns`, `rows`, `trackBy`, `value`, `renderRows`, `indexById`, `totalRowCount`) are
  concrete before the fold starts, so a factory may read them. All but `totalRowCount` are
  claimed by the engine — declaring one in `members` throws (ADR-0005 keeps `totalRowCount`
  overridable for virtualization/pagination). The two editing features are each built on their own
  `createEditingStore()` instance so a rollback finds the snapshot its capture wrote; composing
  both explicitly throws on the duplicate `editing` claim (ADR-0007), in either order.
- Argument order governs *type-level* visibility: slot N is typed against the base store plus
  every preceding slot's contribution, so reading a later feature's member is a compile error
  even though the runtime store would have it (D25 — types are stricter than runtime). Pipeline
  execution order is fixed and does not follow argument order. A trailing `withComputed()` block
  reading `s.expandedRows` off the accumulated `In` is typed only when `withExpansion()` precedes
  it, though the runtime store would have the member either way — features that do read `composed`
  should write the compile-time-legal order. `withGrouping()` is no longer such an example: it read
  `composed['expandedRows']` as a lazy guarded read inside its group render stage until #99/
  ADR-0017 moved collapse/expand visibility entirely into the engine-owned `'prune'` render stage —
  `withGrouping()` now composes with zero knowledge of expansion, in any argument order.
- Internal features (the column-schema wiring) are not consumer `Feature`s: they keep receiving
  the engine handle `TableCore<TRow>`, which is the only way to reach `baseColumns` (ADR-0010).

Plugins compose as trailing positional arguments to `createTable()`, not chained calls and not
a `features` array. No feature call needs an explicit row type — it is inferred from `data`:

```ts
createTable(data, { trackBy: 'id', columns }, withSorting(), withExpansion());
```

Two composition primitives sit alongside the `with-*()` plugins:

- `withComputed(block)` — derived state as a feature. Composes at the top level or as a feature's
  trailing derive block; at the top level it sees every earlier slot.
- `composeFeatures(...features)` — collapses N features into one slot, the escape hatch for the
  arity cap.

Argument order does NOT set execution order — pipeline order is fixed (filter → group → sort →
expand) regardless of it. Do NOT use `.pipe()` chaining or a builder pattern. The type-level cap
is 15 features (a 16th argument matches no overload); the runtime accepts any number.

## Testing

- Unit tests in `*.spec.ts` (colocated with source) — logic-only, use `TestBed` or `vitest`.
- **Everything in `engine/` except `compose-table.ts` is pure** — no signals, no Angular. Test it
  with plain `vitest`; reaching for `TestBed` there means the logic ended up in the wrong file.
- No content/structural tests (rendering, DOM projection). Structural tests belong in directive specs (`docs/3-ui/directives/*.spec.ts`), not store tests.
- Mock row data in `table.mock.ts` (exported, reusable); don't inline fixtures.

## Typechecking

```bash
nx run shared-table:typecheck        # ngc -p tsconfig.lib.json  --noEmit
nx run shared-table:typecheck-spec   # ngc -p tsconfig.spec.json --noEmit
```

Two targets, because `tsconfig.lib.json`'s include excludes `*.spec.ts` — the lib target cannot
see a spec file at all. A `*.types.spec.ts` file holds compile-time assertions only
(`expectTypeOf`, `@ts-expect-error`); the runner executes those without checking them, so
`typecheck-spec` is the only thing that enforces one. A green `nx test` proves nothing about it.

Not bare `tsc` — it never opens a `.html`, so a template-only error passes clean and surfaces
only in Storybook. Highest risk: `src/stories/**/*-story-host.component.html`. `ngc` aborts at
the first `.ts` error before reaching the template phase, so a run with source errors checked no
templates — fix, re-run, confirm the second run is clean. Rationale:
`.claude/rules/typecheck-angular-templates.md`.

## Conventions NOT documented here

Stack-wide patterns (TypeScript, Angular, monorepo build) are in the root repo's `CLAUDE.md` and the library's parent `CONTEXT.md`. This file is table-specific only.
