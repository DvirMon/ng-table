# NGP Table — implementation invariants and architecture

**Scope:** Internal implementation rules for table maintainers. Consumers use the public API exported from `index.ts`; those contracts are in `docs/`.

## What this is

Data table engine for Angular 19+. Three-layer stack: state management (`createTable()`), column schema definition, and UI-layer directives. Attribute-only, no structural DOM injection. Ships as an Angular service + signals + directives, composable with `with-*()` feature plugins.

## Answering any question about a capability

Fires on _every_ question about a feature — "what's the state of grouping?", "can I change X?",
"why is Y shaped this way?" — not only when about to implement something.

1. **`docs/status.md`** (generated) — the index. Its **Decisions** column links each capability's log.
2. **`docs/decisions/<capability>.md`** — every decision ever taken about it, one line each.
3. **The capability's spec** — `docs/1-state/features/<capability>.md` and `docs/3-ui/directives/<capability>.md`. What it does _today_.

Those three answer the question. Open a work folder only when a log row sends you to one for
full rationale — never to survey what shipped. A `—` in the Decisions column means that
capability isn't consolidated yet; say so rather than treating the spread as source of truth.
Consolidate via [`docs/agents/capability-docs.md`](docs/agents/capability-docs.md), entered with
`/audit-docs <capability>`.

## Locked invariants — DO NOT CHANGE

Architectural constraints agreed in drilling sessions. Changing them requires cross-team decision and a new ADR.

- **Native `<table>` or `<div>` grid, one directive set.** Superseded 2026-08-17 by [ADR-0005](docs/adr/0005-generic-table-host.md) — selectors are dual-tag (`table[ngpTable], div[ngpTable]`, etc.), ARIA roles injected unconditionally regardless of host tag. Still no shadow DOM. Read the ADR before building the div-grid path.
- **Attribute-only directives** — never insert/remove/reorder DOM. Structural logic lives in the template (consumer's responsibility).
- **`createTable()` returns an instance, not a class.** Consumers call `const table = createTable(…)`, not `new Table(…)`.
- **`rows()` never returns wrapper objects.** Store yields `RenderRow<TRow>[]` directly.
- **State as `data-*` attributes, values as CSS custom properties.** No inline styles on directives; no attribute duplication for styling and data.

## Code layout — folders by lifecycle phase

Modeled on Angular Signal Forms (`packages/forms/signals/src`), which groups by _when code
runs_ — declare (`api/`) → compile/run (`field/`, `schema/`) — not by feature. See ADR-0004.
`schema/` and `mutations/` are top-level siblings of `api/`, not subfolders of it — see ADR-0008.

```
src/
  index.ts        ← the table's own public surface; the only barrel (ADR-0004 #93)
  api/            ← factory + declaration surface a consumer touches
  columns-schema/ ← column schema DSL: columnSchema(), metadata, visibility rules
  schema/         ← the shared declare-phase mechanism, key-space agnostic
  mutations/      ← row and column mutation verbs
  engine/         ← the runtime; exports only the feature-author surface listed in index.ts
  directives/     ← UI layer
  table.mock.ts   ← shared test fixtures
tools/            ← repo-side utilities, OUTSIDE src/ so they stay out of the published build
docs/             ← this library's own docs (see "Docs structure" below)
```

Each source file's role and behavior lives in its own JSDoc/comments (`source-docs` policy) —
read the file, not this file, for what it does; a per-file description table here would drift
from the code and duplicate it. What stays here is what a linter or a file read won't catch:

- **`api/`, `schema/`, `mutations/`, `engine/`, `directives/` have no barrels of their own.** If
  a symbol isn't re-exported from `src/index.ts`, it's internal — including engine internals
  reachable only through a feature's own config (e.g. `withFiltering`'s `schema` argument reaches
  `engine/filters/`, never a direct import).
- **`api/create-table.overloads.ts` and `docs/status.md` are generated.** Never hand-edit either
  — fix `tools/generate-overloads.ts` / the owning spec's frontmatter and regenerate
  (`npm run table:overloads`, `npm run table:status`).
- **`api/types.ts` ↔ `engine/types.ts` is a deliberate type-only import cycle** (same shape for
  `api/features/with-filtering/types.ts` ↔ `engine/filters/types.ts`). Both sides must stay
  `import type` — turning either into a value import breaks the build.
- **The two editing features never compose together.** `withOptimistic()` and `withRowEdit()`
  each build their own `createEditingStore()` instance; composing both throws on the duplicate
  `editing` member claim (ADR-0007), in either order.

Naming: the folder supplies the domain, so files inside drop the `table.` prefix
(`engine/pipeline.ts`, not `engine/table.pipeline.ts`). The compile-phase entry point is named
for its verb, not its domain — `engine/filters/build.ts`. Kebab-case, not Angular's internal
snake_case — `.claude/rules/file-organization.md` governs.

## Naming conventions — internal state and type narrowing

- **No private store members.** Pipeline stages, render stages, and per-feature internal state
  (a `Subject`, an unread signal) stay closure variables — no `_`-prefix convention, no
  `OmitPrivate` stripping (removed with `@ngrx/signals`, ADR-0003).
- **Features declare, never mutate.** A feature returns a `TableFeatureSpec` — `{ members,
stages, renderStages, setup, onDestroy }`. Writing to the store object directly is unsupported.
- **`hostDirectives` only for unconditional or internal-mechanism behavior.** Opt-in behavior
  gets its own public directive — host-composing a feature into a core directive applies it to
  every table and defeats tree-shaking. See the rejected-alternatives section of
  `docs/3-ui/directives/expansion.md`.
- **`RenderRow` field ownership by directive layer.** Core directives bind required fields
  (`id`, `depth`, `kind`); feature directives bind their own optional, feature-contributed ones
  (`isExpanded`, `hasChildren`, `aggregates`) — those are `undefined` whenever the feature isn't
  composed, so a core directive binding one lies on every table lacking that feature.
- **Type narrowing:** `as const` on discriminators; never a bare `as` assertion. Type guards over assertions.
- **`when` vs `enable`** ([ADR-0018](docs/adr/0018-when-vs-enable-predicate-naming.md)): `when` is
  a data-driven conditional (reads row/cluster data); `enable` is a gate that reads no row data
  and doesn't require a paired `when`.
- **Errors: throw at construction, degrade at runtime** ([ADR-0014](docs/adr/0014-runtime-error-policy.md)).
  Wiring errors (slot/member collisions, a `trackBy` naming no field) throw. A **consumer
  callback** (`accessor`, `sortFn`, `aggregateFn`, a filter predicate) never takes the table down
  — it falls back to a defined value chosen so the failure is visible, and reports once per
  callback per evaluation in production too. Wrap per callback, never per row. **Not enforced by
  types** — an unwrapped existing call site is never precedent for leaving the next one unwrapped.
  A **construction check** is dev-gated (`ngDevMode`) inside its own body; a check whose ids can
  first arrive at runtime (e.g. a writer path, not construction) stays ungated instead.

## Docs structure — three streams, permanent vs. episodic

Docs are numbered by dependency order: state layer (1) → columns layer (2) → UI layer (3).

| Location                                                  | Purpose                                                                                                                        | Update pattern                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `docs/1-state/prd.md`, `architecture.md`, `features/`     | State-layer specs, one per feature plugin                                                                                      | Permanent                                |
| `docs/status.md`                                          | Every capability's spec/code maturity, state + UI side by side                                                                 | **Generated** — never hand-edit          |
| `docs/1-state/row-mutations.md`, `state-persistence.md`   | Core/cross-feature specs, not one plugin's state (D8)                                                                          | Permanent                                |
| `docs/2-columns/reference/`                               | Column schema reference (tiers, ownership, derivation)                                                                         | Permanent                                |
| `docs/3-ui/directives/`                                   | Directive specs and API contracts, one per directive                                                                           | Permanent                                |
| `docs/3-ui/stories.md`                                    | Storybook story conventions                                                                                                    | Permanent                                |
| `docs/1-state/work/<capability>/{active,archive}/<slug>/` | Episodic state-layer work, grouped by the capability that owns it (`core`, `meta`, `feature-authoring` for cross-cutting work) | Episodic; moved to `archive/` after ship |
| `docs/3-ui/work/<slug>/`, `docs/work/<slug>/`             | Episodic UI-layer and cross-stream work folders                                                                                | Episodic; archived after ship            |
| `docs/decisions/<capability>.md`                          | The capability's decision history, one line per decision                                                                       | Permanent; appended as decisions land    |
| `docs/agents/`                                            | Procedures an agent follows against these docs                                                                                 | Permanent                                |

**Key rule:** Specs live in the stream's numbered folder; work happens in a work folder. Specs are edited in place; work folders are episodic containers.

### The decisions log — `docs/decisions/<capability>.md`

Two permanent files answer everything about a capability: its **spec** (what it does today) and
its **decisions log** (why, what was tried, what was reversed). Everything else is a linked
record. Format and vocabulary: `~/.claude/conventions/doc-contracts/decisions-log.md`. Converting
a capability that has none: [`docs/agents/capability-docs.md`](docs/agents/capability-docs.md).

- `adr/` holds cross-capability architectural constraints; `decisions/<capability>.md` is a
  per-capability index over that capability's own history.
- Each log uses **its own numbering** (`G1…Gn`, `E1…En`, …), never reusing another capability's
  or work folder's number — a bare "D7" once meant three different things across four logs.
- **One line per decision** — a second line belongs in the linked record.
- **A work folder may not move to `archive/` until every decision in it is registered as a row
  in its capability's log.** This is what keeps the log true.

### Feature-spec frontmatter — required fields

Feature-scoped specs (`docs/1-state/features/*.md`, `docs/3-ui/directives/*.md`, cross-feature
specs) declare three machine-read fields; architecture/PRD/reference docs keep a free-text `status:` instead.

```yaml
capability: selection # groups the state and UI docs for one feature
spec: none | stub | drafted | drilled # none → no file; stub → placeholder; drafted → written, never drilled; drilled → contract settled
code: none | partial | shipped # state-layer implementation in src/
```

Two axes, not one — `spec: drafted, code: none` and `spec: drilled, code: partial` are both real
states a single `status:` string can't express. `docs/status.md` is generated from these fields;
omitting them on a new spec silently drops it from the roll-up. Vocabulary and per-file values:
[`docs/1-state/work/meta/archive/state-feature-competitive-audit/decisions.md`](docs/1-state/work/meta/archive/state-feature-competitive-audit/decisions.md).

## Specs describe intent, not necessarily shipped code

A field named in a spec is not proof it's wired — several are drafted ahead of implementation.
`api/types.ts` is what's actually exported; `docs/status.md` (generated) is what's actually
built. Check those, never this file, for the state of anything.

## Before implementing a feature

1. **Read the capability's decisions log** (`docs/decisions/<capability>.md`) before the spec — stops re-deciding or reversing something already settled.
2. **Locate the spec** in its stream folder (e.g. `docs/1-state/features/expansion.md`). Spec is the contract; code must match it exactly.
3. **Read `docs/3-ui/architecture.md`** — marks which features are blocked, deferred, ready.
4. **Check for an active work folder** — read its own decisions file for detail the log only summarizes.
5. **Verify blockers** — `docs/3-ui/architecture.md` lists what must ship first.

**Never take a work folder's own `status:`/`state.json` as proof something shipped** — both go
stale silently. Check `src/` and `git log`.

## Feature plugin pattern (`api/features/with-*.ts`)

Authoring guide: [`docs/1-state/feature-authoring.md`](docs/1-state/feature-authoring.md).

A config-taking outer function returns a factory that receives the accumulating store and
**declares** what it contributes. The factory's own parameter type fixes `In`; the row type is
recovered as `RowOf<In>`, never written at the call site.

```ts
export function withFeature<In extends Shape>(config: FeatureConfig = {}) {
  return createTableFeature((store: In, ctx) => {
    const someState = signal(initial); // feature owns its own signals, no engine-managed state

    return {
      members: { someState: someState.asReadonly(), someMethod },
      stages: stageSchema('pipeline', (s) => { stage(s.sort, { run: (rows) => ... }); }),
      renderStages: stageSchema('render', (s) => { stage(s.tree, { run: (rows) => ... }); }),
      setup: () => ..., // optional: runs after the full fold, in DI context
    };
  });
}
```

`ctx` is the engine's `StageContext` (ADR-0028). Read `ctx.parentOf` inside stages, methods or
computeds, never in the factory body — a feature folded later has not contributed it yet.

`createTableFeature` (exported from `index.ts`) is the public authoring entry point.
`createTableFeature(factory, derive)` plumbs a trailing derive block, called with `In & Out`; a
block declaring any pipeline-behavior key (`PIPELINE_BEHAVIOR_KEYS` in
`api/create-table-feature.ts`), or a member the feature already declared, throws at construction.

Rules:

- **`Feature<In, Out>` stays callable** — a plain-object-returning feature resolves before `TCols`
  is inferred and the column-id union reaching every slot collapses. Probe:
  [`design-create-columns.md`](docs/1-state/work/core/active/single-value-source/design-create-columns.md) P1j.
- **Claiming a stage.** `stage(handle, { run })` inside `stageSchema('pipeline'|'render', (s) => ...)`
  claims a built-in anchor from `PIPELINE_ANCHORS`/`RENDER_ANCHORS` (`engine/pipeline.ts`/
  `engine/render-stages.ts`). A **new** stage name not covered by a built-in anchor is added via a
  consumer's own `declare module` merge into `PipelineStageRegistry`/`RenderStageRegistry` — the
  type exists (ADR-0020); a declared stage runs at its resolved position. Render-stage
  collision is per-named-stage, not whole-layer (ADR-0011) —
  `withTree()` claims `'tree'`, leaving `'group'` free for `withGrouping()`. A stage receives and
  returns `RenderNode<TRow>[]`, not flat rows — nest children via `mapNodes`, never as siblings.
- **A second feature claiming the same stage, or the same member key** (ADR-0007), throws at
  construction. Neither `'paginate'` nor `'prune'` is a reserved stage name today (#106, #107).
  [ADR-0012](docs/adr/0012-split-expansion-into-panel-and-tree.md) split `withExpansion()` into
  the detail-panel feature (no render stage) and `withTree()` (claims `'tree'`) — read it before
  touching `renderStages`, `withExpansion()`, or `withTree()`.
- **If your feature stores `RowId`s, declare `onRowsRemoved`** ([ADR-0006](docs/adr/0006-row-id-state-reconciliation.md)).
  The engine diffs `indexById` and announces ids that left `data`; prune with `pruneByIds()`
  (`engine/rows.ts`). Not type-enforced — forgetting it leaves dead ids until a row deletion
  surfaces them. The two editing features share one `onRowsRemoved` via `createEditingStore()`.
- **Argument order governs type-level visibility only** — slot N is typed against the base store
  plus every preceding slot's contribution (D25); pipeline execution order is fixed regardless of
  argument order. A trailing `withComputed()` reading a later feature's member needs that feature
  to precede it in argument position even though the runtime store would already have it.
- **Internal features** (column-schema wiring) receive the engine handle `TableCore<TRow>`
  directly — the only way to reach `baseColumns` (ADR-0010) — not the consumer `Feature` contract.

Plugins compose as trailing positional arguments to `createTable()`, not chained calls, not a
`features` array:

```ts
createTable(data, { trackBy: 'id', columns }, withSorting(), withExpansion());
```

`withComputed(block)` composes at the top level or as a feature's trailing derive block.
`composeFeatures(...features)` collapses N features into one slot — the arity escape hatch.
Argument order does **not** set execution order — pipeline order is fixed (filter → group →
sort) regardless of it. No `.pipe()` chaining, no builder pattern. Type-level cap: 15 features
(a 16th argument matches no overload); runtime accepts any number.

## Testing

- Unit tests in `*.spec.ts` (colocated with source) — logic-only, `TestBed` or `vitest`.
- **Everything in `engine/` except `compose-table.ts` is pure** — no signals, no Angular. Reaching for `TestBed` there means the logic is in the wrong file.
- No content/structural tests (rendering, DOM projection) — those belong in directive specs.
- Mock row data in `table.mock.ts` (exported, reusable); don't inline fixtures.

## Typechecking

```bash
nx run shared-table:typecheck        # ngc -p tsconfig.lib.json  --noEmit
nx run shared-table:typecheck-spec   # ngc -p tsconfig.spec.json --noEmit
```

Two targets — `tsconfig.lib.json` excludes `*.spec.ts` entirely. A `*.types.spec.ts` file holds
compile-time-only assertions (`expectTypeOf`, `@ts-expect-error`); `nx test` never checks them,
only `typecheck-spec` does.

Not bare `tsc` — it never opens a `.html`, so a template-only error passes clean and surfaces
only in Storybook. `ngc` aborts at the first `.ts` error before reaching the template phase, so a
run with source errors checked no templates — fix, re-run, confirm the second run is clean.
Rationale: `.claude/rules/typecheck-angular-templates.md`.

## Conventions NOT documented here

Stack-wide patterns (TypeScript, Angular, monorepo build) are in the root repo's `CLAUDE.md` and the library's parent `CONTEXT.md`. This file is table-specific only.
