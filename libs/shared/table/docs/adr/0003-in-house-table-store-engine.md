---
status: accepted
date: 2026-08-11
supersedes: "0002-table-store-instance-factory.md §Decision — 'Engine unchanged' and 'DI wiring is internal'"
---

> **File paths in this ADR are historical.** The engine's behavior is unchanged, but it was
> reorganized into `api/` / `engine/` / `directives/` on 2026-08-11 — see
> [ADR-0004](0004-table-source-layout.md). `table.engine.ts` is now `engine/compose-table.ts` plus
> `engine/core.ts`, and `PipelineStages` derives from `PIPELINE_ORDER` rather than being a
> hand-maintained second list.

# The table state layer runs on an in-house composition engine, not `@ngrx/signals`

## Context

`createTable()` was built on `@ngrx/signals` (`signalStore`, `signalStoreFeature`,
`withState`/`withProps`/`withMethods`/`withComputed`/`withHooks`, `patchState`). Three drivers
made that a liability:

1. **Angular upgrades were gated on ngrx releases.** `package.json` pinned stable
   `@angular/core: 22.0.8` against `@ngrx/signals: 22.0.0-rc.0` — a release candidate — because
   no stable ngrx existed for that Angular major. Every future Angular major repeats this.
2. **Peer-dependency tax if published.** Shipping the table as a headless primitive would force
   every consumer to install `@ngrx/signals` and keep it version-aligned with both our release
   and their Angular. Competitors in this category (TanStack Table) ship zero runtime deps.
3. **Feature-injection was mutation by convention.** A feature registered behavior by mutating a
   shared slot (`store._pipeline.sort = …`, `store._buildRenderRows.current = …`). No type
   declared that a feature may do this, and the timing was load-bearing: the mutation had to
   land in the factory body before the first `rows()` read, or the result was silently wrong
   rather than an error.

The migration was safe to attempt because the seam already existed: `TableStore<TRow>` never
referenced ngrx types, and `createTable()`'s return type was computed independently of the
engine.

## Decision

Replace the engine with `composeTable()` — an in-house, table-specific composer over Angular
signals. **Features declare what they contribute; the engine wires it.**

```ts
export interface TableFeatureSpec<TRow, Members extends object = object> {
  members?: Members;                      // signals + methods merged onto the store
  stages?: PipelineStages<TRow>;          // pure row transforms
  renderRows?: RenderRowsBuilder<TRow>;   // at most one feature may provide this
  onInit?: () => void;
  onDestroy?: () => void;
}

export type TableFeature<TRow, Members extends object = object> = (
  core: TableCore<TRow>,
  composed: Record<string, unknown>
) => TableFeatureSpec<TRow, Members>;
```

Specific choices:

- **Features own their signals.** A feature creates its own `signal()`s and closes over them,
  exposing them via `.asReadonly()`. There is no engine-managed state record and therefore no
  `patchState` equivalent.
- **Table-specific, not a generic store.** A general-purpose engine would need a generic slot
  mechanism to carry `stages` and `renderRows`. We need exactly one store, so the engine names
  the table's concepts directly.
- **Both composition directions kept.** `core` is the feature-to-core seam; `composed` — a
  stable reference to the accumulating member object — is the feature-to-feature seam. Read at
  factory time it holds only earlier features; read from a method or computed it holds
  everything. Untyped, exactly as ngrx's equivalent was untyped here.
- **Single-occupancy slots are validated.** Two features claiming the same pipeline stage, or
  both claiming `renderRows`, throws at construction naming both sides.
- **No store class, no child injector.** `composeTable()` returns a plain object built inside
  `runInInjectionContext(injector, …)`, which supplies the context `onInit` hooks need for
  `effect()` / `resource()` and the `DestroyRef` that `onDestroy` hooks register on.
- **Compile-time feature-input checking stays at its existing level**: each feature annotates
  its own factory parameter (`Pick<TableStore<RowOf<In>>, 'rows' | 'trackBy'> & Shape` since
  #67 — `TableCore<TRow>` now reaches internal features only, ADR-0010). No typed fold over
  the `Features` tuple — see "Not rebuilt" below.

## Consequences

### Removed outright

| Removed | Why it existed |
|---|---|
| `_pipeline`, `_buildRenderRows` store props | the only way to inject a stage under ngrx |
| `RenderRowsBuilderSlot` and its `.current` container | survived ngrx's per-feature shallow copy of the store |
| `_rowExpandedSource`, `_sortChangedSource` | now closure variables, never store members |
| `OmitPrivate` in `table.types.ts` | nothing private is left on the store to strip |
| `ColumnsSchemaFeatureInput` | ngrx-shaped `{ state, props, methods }` input wrapper |
| The runtime `reduce` fold and its `SignalStoreFeature<any, any>` cast | `signalStore()` had no array/rest overload |

Dropping `OmitPrivate` is deliberate and reversible: it guarded exactly the four members above.
Reinstating it is six lines if a future feature wants a private member.

### Not rebuilt

**Composition-time feature-input validation.** ngrx's `type<{…}>()` markers appeared to provide
this, but did not in practice: `createTable()` folded a dynamic-length array and cast every
feature to `SignalStoreFeature<any, any>`, erasing the declared Input. The markers only typed
the `store` parameter inside each feature's own factories — a job now done by annotating the
factory parameter. Building real cross-feature validation would require a recursive conditional
type folding the `Features` tuple; deferred until a feature actually depends on another
feature, which none do today.

### Gained

- Collision detection on `renderRows`. `docs/1-state/features/grouping.md` plans a second
  render-row override; under the mutation model it would have silently won or lost by array
  order.
- Features are directly unit-testable — `withSorting()(fakeCore)` returns a plain spec object.
- Zero runtime dependencies outside `@angular/*` and `rxjs`.

### Costs

- Edge cases in state merging and teardown are now owned in-house.
- No ecosystem familiarity for outside contributors.
- The child injector removed by this ADR was a place store-scoped providers *could* have been
  registered. Nothing registered any; restoring it is one `Injector.create` call.

### Not changed

- `TableStore<TRow>`, the public contract, is untouched.
- UI-layer DI (`NGP_TABLE_STORE`, `NGP_TABLE_ROW`) is untouched — the store is passed to
  directives as an input, never injected.
- Consumer call sites and demo apps are byte-identical, and all five existing spec files pass
  unmodified. That was the migration's acceptance gate.

## Deferred: `features: (ctx) => [...]` — superseded, see the 2026-09 amendment below

Consumers still repeat `<TRow>` per feature because a feature is
called before it receives the core, leaving its call site nothing to infer from. The fix
`docs/1-state/architecture.md` records as "the one surviving direction" —

```ts
features: (t) => [withExpansion(t), withSorting(t)]
```

— was blocked under ngrx on needing a phantom typed placeholder, because features composed at
store-*class* build time. **This ADR dissolves that blocker**: `composeTable()` builds core
before folding features, so a real `TableCore<TRow>` exists to pass.

It is still deferred, because its gains are DX plus a modest correctness win (a mismatched
`withExpansion<Person>()` on a `Department` table used to compile; under `ctx` it could not
be expressed), while its cost is real: every spec would be built inside one expression, so
`composed` would always be empty at factory time — half-closing the feature-to-feature seam this
ADR deliberately kept. Tree-shaking is identical either way; both shapes import features
top-level. Revisit when a second feature actually wants another feature's state.

## Amendment (2026-09, #67): row-type inference shipped — by positional composition, not `ctx`

The section above is superseded. A feature call no longer takes a row type: `withExpansion()`, not
`withExpansion<Department>()`.

**It shipped by a different mechanism than the one deferred.** Not `features: (t) => [...]`. A
feature became a function of the store built so far — `Feature<In extends Shape, Out extends
object>`, where `In` is F-bounded on the members it reads (`Pick<TableStore<RowOf<In>>, …>`) and the
row type is recovered as `RowOf<In>` (`engine/types.ts`). Features are passed as trailing
positional arguments to `createTable(data, config, ...features)`, so the row type flows from the
contextual type of the argument position — from `data`, through the accumulating store — rather
than from a `ctx` handle the consumer threads by hand.

**Why the functional surface made it typable.** The deferral's blocker was that building every spec
inside one expression leaves `composed` empty at factory time. The positional fold does not have
that problem. The base store is built before the fold, and each feature is handed the store *as
accumulated so far*, so a later argument sees the members of every earlier argument. Argument
order, not a `ctx` closure, is what makes the seam typable — and the seam stays open rather than
half-closing.

**The correctness win the deferral called "modest" is now in force.** A mismatched
`withExpansion<Person>()` on a `Department` table no longer compiles, because there is no type
argument left to mismatch.

**What did not change.** `TableStore<TRow>` is still the public contract. Tree-shaking is
unaffected — both shapes import features top-level, as the superseded section already said.

The composition model itself — argument-order member visibility against fixed pipeline execution
order — is described in `docs/1-state/architecture.md`, not here. This ADR owns the engine
decision.

## Amendment (2026-08-17): `TableFeatureSpec.columnRules` is now read

`TableFeatureSpec.columnRules` was declared by this ADR's `TableFeatureSpec` shape but not yet
read by anything — a feature could set it and nothing would happen. Landed via #49/#50:

- `composeTable()`'s `foldFeatures()` (`engine/compose-table.ts`) now reads
  `spec.columnRules` off every feature and pushes its entries onto a shared, mutable
  `columnRules` array held by `createTableCore()`'s handle.
- This is **not** a `SlotRegistry`-guarded single-occupancy slot like `stages` or `renderRows`.
  Multiple features may each contribute `columnRules` targeting the same column, and all of
  them apply — merged additively via `foldColumnRules`'s AND reducer (`engine/columns.ts`), not
  last-write-wins.
- `engine/core.ts`'s `columns` computed evaluates `foldColumnRules(baseColumns(), columnRules)`
  on every read, so rules registered anywhere in the feature fold are visible regardless of
  fold order — consistent with how `stages` and `renderRows` were already documented above as
  visible-at-evaluation-time, not registration-time.

The `TableFeatureSpec` contract's shape is unchanged; only what the engine does with an
already-declared field changed. Not a new ADR — see `libs/shared/table/docs/1-state/work/effect-free-column-reactivity/4-architecture.md`'s
open question 1.
