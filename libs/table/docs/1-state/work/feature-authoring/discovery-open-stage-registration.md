---
title: Discovery — open stage registration for third-party features
type: discovery
date: 2026-09-18
capability: feature-authoring
parent: ../../architecture.md
---

> Written by the `discovery` agent across three passes (2026-09-17, 2026-09-18).
> Verbatim; nothing edited. Plan and decision: see `plan.md` in this folder.

# How should `libs/shared/table` let a third-party feature author register a new pipeline/render stage?

**Date:** 2026-09-17 · **Depth:** standard

## Answer

Adopt **anchor-based stage declaration in `TableFeatureSpec`** (option 2): a feature declares `{ name, after|before, preservesEmissionOrder }` and the engine topologically resolves it against fixed built-in anchors, throwing at construction on an unknown anchor, a cycle, or an unresolvable tie [R1][R2][R5]. The question's framing — "which config surface supplies the order" — is the wrong axis: every consumer-supplied-order mechanism (DI, `stageOrder` config, whole-order override) fails **R2**, because `withPinning()` then only works if the consumer _also_ edits an order array, which is precisely the wiring a plugin exists to remove [R4][S1]. DI is still worth adding, but as a **later, optional override layer over an already-resolved order** (the hybrid), never as the definition site [R7]. No surveyed table library is extensible here at all — TanStack and AG Grid both hard-code their stage sequence [S1][S2][S3], so the prior art that transfers is plugin-ordering systems (Rollup/Vite/tapable/Babel), and all four resolve ties by **registration order** [S4][S5][S6][S7] — the exact property ADR-0011 exists to eliminate [R9].

## Method

- Repo claims read from working-tree source on 2026-09-17 at the paths and lines cited; every `R*` row is a file actually opened, not grepped.
- External claims fetched as published docs pages on 2026-09-17. Version pins: **not obtainable** for TanStack Table and AG Grid from the docs pages fetched — TanStack's page is served under `/latest` with no version marker, AG Grid's stage page is only reachable under `/archive/27.1.0/` (see Unverified). ngrx was read from `main`-branch source, which this repo's own rules treat as weaker than a published package — flagged accordingly.
- Reliability: "stage" means three different things across sources. AG Grid's _stages_ are refresh entry points, not extension points [S3]. Rollup/Vite _order_ is a three-bucket coarse sort, not a total order [S4][S5]. tapable _stage_ is a true integer priority [S6]. Do not read one as precedent for another.

## Evidence

- `PIPELINE_ORDER` is a module-level `as const` array and `PipelineStage` derives from it, so the stage key set is closed at compile time and cannot be widened by a runtime value [R1].
- `RENDER_ORDER` is the same shape, with `'prune'` excluded from `RenderStages` via `Exclude<RenderStage,'prune'>`, so claiming it is a compile error rather than a runtime collision [R2][R11].
- `runPipeline`/`runRenderStages` both `reduce` over the fixed array, reading a `Partial<Record<...>>` — an extra key on that object is unreachable by construction [R1][R2].
- `foldFeatures` iterates `PIPELINE_ORDER` / `CLAIMABLE_RENDER_STAGES` and indexes the spec by those keys, so an untyped consumer's extra stage key is **silently dropped**, never reported [R3].
- `composeFeatures()` re-implements that same fold against a private `SlotRegistry`, over the same two fixed lists — any mechanism must land in both fold sites [R4].
- `SlotRegistry.claim*` is name-keyed and throws naming both claimants; it is already generic over the key type (`claim<TKey>`), so a non-union stage name needs no registry change [R5].
- `rows`/`renderRows` are `computed()`s closing over the mutable `stages`/`renderStages` objects and reading them at evaluation time — order is resolved once, before first read, so a resolve step at end-of-fold is compatible with the existing laziness [R6].
- `engine/` is Angular-free apart from `compose-table.ts`'s `inject(DestroyRef)`/`effect` [R3]; `api/create-table.ts` is the only site holding an `Injector`, and `TableConfig.injector` already exists as an escape hatch [R7].
- ADR-0011 fixes `RENDER_ORDER` membership because "order must not depend on the `features` array", and explicitly rejects an **unordered append list** (order = composition order) and **consumer-configurable `RENDER_ORDER`** — but the rejection reasoning for the latter is about _reordering built-ins_ for the pagination/expansion interaction, not about _adding_ a stage [R9].
- ADR-0017's single-forward-pass prune is correct only because both synthesizing stages emit parent-before-child; the ADR states the invariant is "load-bearing and unchecked" and that a stage inserted before `'prune'` breaks it silently [R11][R2].
- ADR-0003's motivation was `@ngrx/signals`' silent last-writer-wins slot mutation [R5][R10]; `signalStoreFeature` is a bare `features.reduce((store, feature) => feature(store), inputStore)` with no duplicate-key check, confirming that characterization from source [S8].
- `architecture.md`'s standing criterion: the extension point should be a plain function, defaults subtractable, and "unanticipated cases cost the consumer a lambda, not a library release" [R8].
- `createTableFeature`'s derive block already throws at construction when it declares `stages`/`renderStages`/`columnRules`/`expandedRows`, and `mergeMembers` throws on a duplicate member key — so a construction-time throw for a bad stage declaration matches existing authoring-time behavior [R12].
- `'paginate'` is reserved in `RENDER_ORDER` and claimed by nothing; pagination is a stub spec [R13][R2].
- **TanStack Table**: row models are passed as factory slots and the sequence is fixed internally — `getCoreRowModel → getFilteredRowModel → getGroupedRowModel → getSortedRowModel → getExpandedRowModel → getPaginatedRowModel`; the documented answer to customization is to copy the source and fork [S1].
- **TanStack Table custom features**: the `TableFeature` interface hooks are `createCell`, `createColumn`, `createRow`, `createTable`, `getDefaultColumnDef`, `getDefaultOptions`, `getInitialState` — state, options and instance APIs only. **No hook adds a row-model stage** [S2].
- **AG Grid**: named client-side stages are Group → Filter → Pivot → Aggregate → Sort → Map, described as a fixed sequence where "each stage depends on the stage before"; the API surface is `refreshClientSideRowModel(startingStage)`, i.e. a re-entry point, not a registration point. No documented custom-stage registration or reordering [S3].
- **Rollup**: hook `order: 'pre' | 'post' | null` is a three-bucket sort, and "If several plugins use `pre` or `post`, Rollup runs them in the user-specified order" [S4].
- **Vite**: `enforce: 'pre'|'post'` slots user plugins into a 7-band fixed sequence around Vite's own core plugins; hook-level `order` is a _separate_ axis [S5].
- **tapable**: `stage` is an integer, default `0`, lower runs first, and "Taps with the same stage run in registration order"; `before` names another tap [S6].
- **Babel**: "Plugins run before Presets. Plugin ordering is first to last. Preset ordering is reversed (last to first)" — pure positional [S7].
- **Angular functional interceptors**: "chained together in the order that you've listed them in the providers"; DI-based `HTTP_INTERCEPTORS` "run in the order that their providers are registered", which the docs themselves call "very hard to predict" in a hierarchical DI config, and recommend functional interceptors over DI for that reason [S9].
- **Angular `provideRouter`**: `provideRouter(routes, ...features: RouterFeatures[])` — the `withXxx()` shape this library already mirrors; the docs state nothing about feature order being significant or duplicates being an error [S10].

## Comparison

R1 deterministic order · R2 self-contained feature · R3 collision/typo throws · R4 typed, no `any` · R5 engine pure · R6 works in `composeFeatures` · R7 per-app/per-component override · R8 emission-order invariant statable · R9 built-ins unchanged · R10 general mechanism

|     | 1. DI `provideTableStages()`                                                                                                         | 2. Anchors in spec                                                                                                         | 3. Priority / `enforce`                                              | 4. `stageOrder` on config                               | 5. Fixed pre/post slots                                                              | 6. Hybrid (2 + DI override) |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| R1  | yes — but the order lives in an injector the feature author cannot see [S9]                                                          | yes — resolved from declared constraints, ties throw [R9]                                                                  | **no** — every surveyed impl ties on registration order [S4][S6][S7] | yes, per table [R7]                                     | **no** — multi-claim within a slot falls back to fold order [R3]                     | yes                         |
| R2  | **no** — `withPinning()` needs the consumer to also insert `'pin'` [R3]                                                              | yes — the feature carries its own placement [R12]                                                                          | yes                                                                  | **no** — same as DI [R7]                                | yes                                                                                  | yes                         |
| R3  | partial — needs a new cross-check that every declared name is claimed and vice versa; today an unlisted key is silently dropped [R3] | yes — unknown anchor / cycle / ambiguous tie throw at construction, `SlotRegistry` already generic over key type [R5][R12] | **no** — a free numeric priority has no name to collide on           | partial — same as DI [R3]                               | yes (per slot)                                                                       | yes                         |
| R4  | **no** — a runtime array cannot widen a `typeof array[number]` union; keys degrade to `string` [R1][R2]                              | partial — key widens to `PipelineStage \| (string & {})`; the transform stays `RowTransform<TRow>`, no `any` [R1]          | yes                                                                  | **no** — same as DI [R1]                                | yes                                                                                  | partial (as 2)              |
| R5  | yes if the order is passed **into** the engine as a parameter and the `inject()` stays in `api/create-table.ts` [R7][R3]             | yes — topological resolve is a pure function, vitest-testable [R3]                                                         | yes                                                                  | yes                                                     | yes                                                                                  | yes                         |
| R6  | partial — the composite folds with no injector in hand; it would have to defer ordering to the outer fold [R4]                       | yes — the composite merges ordered entries instead of a `Record`, same as it already merges `expandedRows` [R4]            | yes                                                                  | partial (as DI) [R4]                                    | yes                                                                                  | yes                         |
| R7  | **yes — its only unique win** [S9][S10]                                                                                              | no                                                                                                                         | no                                                                   | partial — per component instance, not per app [R7]      | no                                                                                   | yes                         |
| R8  | no place to put the flag                                                                                                             | yes — `preservesEmissionOrder` on the declaration, checked against the prune boundary [R11]                                | no                                                                   | no                                                      | partial — the slot boundary implies it                                               | yes                         |
| R9  | yes if the default equals today's array [R1][R2]                                                                                     | yes — built-ins keep their current anchors [R9]                                                                            | yes                                                                  | yes                                                     | yes                                                                                  | yes                         |
| R10 | mechanism, but consumer-facing config, not an authoring extension point [R8]                                                         | yes [R8]                                                                                                                   | yes                                                                  | no — one array per table is enumeration by another name | **no** — enumerated slots, explicitly the shape `architecture.md` warns against [R8] | yes                         |

## Synthesis

- **DI vs. anchors disagree on where placement knowledge lives.** DI puts it with the _consumer_; anchors put it with the _feature author_. The author is the only party who knows that pinning must run after `'tree'` and before `'prune'` — the consumer knows only that they want pinning. Every failure of option 1 traces back to that single misplacement, including R2, R3 and R4. This is the decision.
- **The type system disagrees with runtime configurability.** `PipelineStage` derives from a `const` array [R1]; any consumer-supplied order is a runtime value and cannot participate in that derivation. Options 1 and 4 therefore trade R4 for R7. Option 2 also loosens R4, but only for the _new_ names — built-in keys stay a closed union, and the transform signature is never weakened.
- **Prior art disagrees with ADR-0011 on tie-breaking, and ADR-0011 is right.** Rollup, Vite, tapable and Babel all resolve ties positionally [S4][S5][S6][S7], and Angular's own docs concede that DI-registration ordering is "very hard to predict" and steer users away from it [S9]. Adopting a priority model (option 3) would import exactly the property ADR-0011's "unordered append list" rejection was written against [R9]. Anchors are the only surveyed model where an ambiguous tie can be made a _construction error_ rather than a silent positional outcome.
- **The table libraries disagree with the plugin ecosystems on whether this is a solved problem.** TanStack and AG Grid simply close the pipeline [S1][S2][S3] — TanStack's official answer is "fork the row model" [S1]. That is evidence this is genuinely hard, not evidence it should not be done; it also means the design has no table-shaped precedent to copy, and the load-bearing precedent is tapable's `before` [S6], which is the anchor model minus the construction-time cycle check.
- **ADR-0017 and any new mechanism disagree about `'prune'`.** Today `'prune'` is safe because it is at a _fixed array index_ and only two stages emit before it [R11]. The moment a third party can insert a stage, that safety is gone, and the invariant ADR-0017 itself calls "load-bearing and unchecked" becomes reachable by a stranger. This is the strongest argument _for_ option 2 specifically: it is the only candidate with a declaration site where `preservesEmissionOrder` can be stated and enforced.

## Recommendation

**Option 2 (anchor-based declaration), with option 1 kept as a deferred override layer (the hybrid).**

Shape:

```ts
// engine/pipeline.ts / engine/render-stages.ts — anchors, not the whole order
export const PIPELINE_ANCHORS = ['filter', 'group', 'sort', 'expand'] as const;
export const RENDER_ANCHORS   = ['group', 'tree', 'paginate'] as const;  // 'prune' is a boundary

// TableFeatureSpec — the declaration a third party writes
stages?: {
  [K in PipelineStage]?: RowTransform<TRow>;      // built-in anchors, unchanged
} & {
  extra?: readonly StageDeclaration<TRow>[];      // third-party stages
};

interface StageDeclaration<TRow> {
  readonly name: string;                          // claimed via SlotRegistry, throws on collision
  readonly after?: StageAnchor;                   // exactly one of after/before, else throw
  readonly before?: StageAnchor;
  readonly run: RowTransform<TRow>;
}
```

Render-stage declarations additionally carry `preservesEmissionOrder: boolean`, and the engine refuses a `false` declaration positioned before the prune boundary.

**The trade, plainly:** the stage-key set stops being a closed compile-time union, so a third-party stage name is a `string` the compiler cannot check against a list. You buy back safety at construction (unknown anchor, cycle, duplicate name, ambiguous tie, emission-order violation all throw, naming both parties) rather than at compile time — the same bargain ADR-0007 and ADR-0014 already struck for member claims [R5][R12]. What you lose is the current property that `tsc` alone proves a stage name is real. Built-in stages keep their union and lose nothing [R9].

**Do not ship option 1 as the definition site.** Add `provideTableStages()` later, if and only if a real consumer needs to reposition a stage a library declared — and scope it to an **edit function over the resolved order** (`(order) => order`), never a replacement array, so a third-party feature stays self-contained by default [R7][R8].

### ADRs amended

- **ADR-0011** — decision 2 ("`RENDER_ORDER`'s membership is fixed by the engine") and its rejected alternative "Make `RENDER_ORDER` consumer-configurable". Membership becomes open to _declared_ additions; the rejection of _reordering built-ins_ and of _composition-order semantics_ both stand unchanged [R9].
- **ADR-0017** — `'prune'` stops being an array position and becomes an explicit ordering **boundary** with an enforced predicate. The ADR's own "nothing checks that a new synthesizing stage stamps `parentId`" consequence gets a checkable home [R11].
- **ADR-0007 / ADR-0003** — unchanged in substance; `SlotRegistry` extends to dynamic names with no code change beyond the key type [R5].
- A **new ADR** is warranted for the mechanism itself; this is not a footnote on 0011.

### What this means for the reserved slots

- **`'paginate'` — keep, as a built-in anchor.** It is unclaimed [R13], but its value under this mechanism is as an anchor target (`before: 'paginate'` is how a virtual-scroll or pinning stage says "before the window is cut"). Removing it would leave third parties anchoring against `'prune'`, which is a boundary and should not be an anchor.
- **`'expand'` (pipeline) — keep, as a built-in anchor,** same reasoning: it is the terminal pipeline anchor, so `after: 'expand'` is the only way to say "last row transform".
- **`'prune'` — reclassify, do not keep as an anchor.** It becomes the render-order boundary: anchorable stages resolve into the pre-prune region (and must declare `preservesEmissionOrder: true`) or the post-prune region. It remains unclaimable [R2][R11].
- Candidate third-party stages map cleanly: row pinning → render, `before: 'paginate'`, preserves order; virtual-scroll window → render, `after: 'paginate'`; post-group aggregation → pipeline, `after: 'group'`; second filter pass → pipeline, `after: 'sort'` [R13].

## Against

- **The closed union is a real asset and this gives part of it up.** Today a typo in a stage key is a compile error; after this, a typo in a third-party stage _name_ is a runtime throw. If the anticipated third-party stages never materialize, this is pure cost — `architecture.md` says so itself: "a general mechanism that no consumer ever extends is cost without payoff" [R8].
- **No table library does this.** TanStack closes the pipeline and tells you to fork [S1]; AG Grid closes it and exposes only refresh entry points [S3]. Two independent vendors choosing the same closure is a data point about the cost of the open version, even if silence is not validation.
- **DI genuinely wins on R7, and R7 was the stated motivation.** If per-app/per-component reordering is the actual need rather than third-party authoring, option 1 alone is the smaller answer and this recommendation is over-built.
- **Topological resolution adds a debuggable failure mode.** A cycle across three independently-authored features produces an error whose fix is not local to any one of them — a cost tapable's `before` model has in production and that positional ordering does not [S6].

## Not researched

- Whether any shipped consumer of this library actually wants a third-party stage today — the candidate list is from `pagination.md`'s gap analysis [R13], not from a request.
- MUI X DataGrid's pipe-processor / `useGridRegisterPipeProcessor` internals, which is the closest known analogue to an _open_ registration model in a data grid, and would likely be the strongest supporting or contradicting evidence available.
- Angular Signal Forms schema composition — named in the brief, not fetched.
- `ENVIRONMENT_INITIALIZER` multi-provider ordering.
- The concrete migration cost of the two fold sites (`compose-table.ts`, `compose-features.ts`) and the `*.overloads.ts` generators; no line estimate was produced.
- Performance of a resolve step at end-of-fold (expected negligible — it runs once per table construction, not per evaluation [R6]) — measured nowhere.

## Unverified

- **No version pin for TanStack Table or AG Grid.** The TanStack page is served under `/latest` with no version marker in the fetched content; the AG Grid stage documentation was only reachable under `/archive/27.1.0/`, and the current-version page fetched returned no stage list at all [S3][S11]. Both claims should be re-confirmed against an installed package before being cited as current. AG Grid v27 is old enough that the stage list may have changed.
- **`filter aggregates` as a seventh AG Grid stage** appeared in search-result text but not in the archived page body; the six-stage list is what the page itself states [S3].
- The tapable `stage`/`before` wording is quoted from the README as returned by two fetches of the same file; it was not cross-checked against `tapable`'s source, and the `before`-beats-`stage` precedence sentence in particular reads as summarizer paraphrase rather than verbatim README prose. Confirm from `lib/HookCodeFactory.js` before relying on the precedence rule [S6].
- **ngrx `signal-store-feature.ts` was read from `main`**, not a published package — this repo's own rule treats that as a weaker source. The claim (no duplicate-key check in the composer itself) is consistent with ADR-0003's account [R10], but `withState`/`withMethods` were not read, and one of them could carry a check [S8].
- Whether Angular's functional interceptors run before or after `withInterceptorsFromDi()` ones in a mixed setup — the guide does not say, and it was not resolved from source [S9].
- **Reasonable inference, not doc-confirmed:** that a DI-supplied order array cannot widen `PipelineStage` without module augmentation or threading a generic through `createTable`. This follows from `PipelineStage = (typeof PIPELINE_ORDER)[number]` [R1] but no compile probe was run to confirm the exact degradation.
- No compiled probe (`P*`) was run for any option. The R4 rows are reasoned from the type declarations, not from a `tsc` result.

## Sources

|     | Source                                                                                           | Version           | Verified                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `libs/shared/table/src/engine/pipeline.ts:6-28`                                                  | —                 | yes — read; `PIPELINE_ORDER` const, `PipelineStage` derived, `runPipeline` reduces                                                                                      |
| R2  | `libs/shared/table/src/engine/render-stages.ts:8-32`                                             | —                 | yes — read; `RENDER_ORDER`, `Exclude<RenderStage,'prune'>`, `CLAIMABLE_RENDER_STAGES`                                                                                   |
| R3  | `libs/shared/table/src/engine/compose-table.ts:92-112`                                           | —                 | yes — read; confirms an extra spec stage key is unreachable, never reported                                                                                             |
| R4  | `libs/shared/table/src/api/features/compose-features.ts:22-59`                                   | —                 | yes — read; second fold site over the same two fixed lists                                                                                                              |
| R5  | `libs/shared/table/src/engine/slots.ts:58-115`                                                   | —                 | yes — read; `claim<TKey>` is already generic over the key type, so a dynamic stage name needs no registry change — this weakened the "typed keys" objection to option 2 |
| R6  | `libs/shared/table/src/engine/core.ts:43-98`                                                     | —                 | yes — read; `rows`/`renderRows` read the mutable registries at evaluation time                                                                                          |
| R7  | `libs/shared/table/src/api/create-table.ts:31-64`                                                | —                 | yes — read; `config.injector ?? inject(Injector)`, the only injection site                                                                                              |
| R8  | `libs/shared/table/docs/1-state/architecture.md:20-75`                                           | 0.4               | yes — read; the four properties a candidate mechanism is checked against                                                                                                |
| R9  | `libs/shared/table/docs/adr/0011-chained-render-stages.md:52-67`                                 | accepted          | yes — read; confirms the rejection of consumer-configurable `RENDER_ORDER` targets _reordering_, not _adding_ — the brief's framing is correct                          |
| R10 | `libs/shared/table/docs/adr/0003-in-house-table-store-engine.md`                                 | accepted          | no — cited only, via ADR-0011's and `slots.ts`'s references to it                                                                                                       |
| R11 | `libs/shared/table/docs/adr/0017-engine-owned-descendant-prune.md:31-46`                         | accepted          | yes — read; "load-bearing and unchecked" is the ADR's own wording                                                                                                       |
| R12 | `libs/shared/table/src/api/create-table-feature.ts:61-124`                                       | —                 | yes — read; construction-time throw for a derive block declaring pipeline behavior, and for duplicate members — the precedent for throwing on a bad stage declaration   |
| R13 | `libs/shared/table/docs/1-state/features/pagination.md:27`                                       | —                 | yes — read; `'paginate'` reserved and unclaimed                                                                                                                         |
| S1  | https://tanstack.com/table/latest/docs/guide/row-models                                          | unpinned          | yes — fetched; fixed order quoted, "copy the source code…and modify it" is the documented customization path                                                            |
| S2  | https://tanstack.com/table/latest/docs/guide/custom-features                                     | unpinned          | partial — the direct fetch 404'd; the hook list is from the search index summarizing that page. Treat as secondary                                                      |
| S3  | https://www.ag-grid.com/archive/27.1.0/javascript-data-grid/client-side-row-stages/              | 27.1.0            | yes — fetched; six stages in order, "each stage depends on the stage before", no extensibility statement                                                                |
| S4  | https://rollupjs.org/plugin-development/                                                         | unpinned          | yes — fetched; `order: 'pre'\|'post'\|null`, ties resolve in user-specified order                                                                                       |
| S5  | https://vite.dev/guide/api-plugin.html                                                           | unpinned          | yes — fetched; the 7-band `enforce` sequence, and that hook `order` is a separate axis                                                                                  |
| S6  | https://raw.githubusercontent.com/webpack/tapable/master/README.md                               | master            | yes — read; `stage` integer default 0, same-stage ties run in registration order, `before` names taps                                                                   |
| S7  | https://babeljs.io/docs/plugins/#plugin-ordering                                                 | unpinned          | yes — fetched; plugins before presets, first-to-last, presets reversed                                                                                                  |
| S8  | https://raw.githubusercontent.com/ngrx/platform/main/modules/signals/src/signal-store-feature.ts | main (unreleased) | yes — source read; bare `features.reduce(...)` with no duplicate-key check — corroborates ADR-0003's silent-override account                                            |
| S9  | https://angular.dev/guide/http/interceptors                                                      | unpinned          | yes — fetched; DI-registration ordering "can be very hard to predict", functional interceptors recommended for predictability — this is what demoted option 1           |
| S10 | https://angular.dev/api/router/provideRouter                                                     | unpinned          | yes — fetched; `...features: RouterFeatures[]`, silent on order significance and on duplicates                                                                          |
| S11 | https://www.ag-grid.com/angular-data-grid/client-side-model/                                     | unpinned          | yes — fetched; mentions in-memory filter/sort/group/pivot/aggregate but names no stages and no ordering — the reason S3 falls back to the archive                       |
| S12 | https://docs.nestjs.com/interceptors                                                             | unpinned          | yes — fetched; documents the three scopes but states no cross-scope ordering rule, so NestJS yields no usable ordering precedent                                        |

---

## Addendum — 2026-09-17 · MUI X pipe processors, Angular Signal Forms schemas, tapable precedence

### Method (addendum)

- Versions pinned with `npm view <pkg> version` on 2026-09-17: `@mui/x-data-grid@9.13.0`, `@angular/forms@22.1.7`, `tapable@2.3.3` [P1].
- Every claim below is read from the **published package** on unpkg at that exact version — implementation `.mjs`/`.js` and shipped `.d.ts`, never a `main`/`next` branch.
- **Correction to the brief:** the current published Angular Signal Forms is **22.1.7**, not 21.x; the APIs carry `@publicApi 22.0` tags [S17]. A 21.x reading would have been a different surface.
- The Signal Forms **guide page** was also fetched and is **silent** on ordering and merge semantics [S19]; everything substantive here comes from the `.d.ts` JSDoc instead. That gap is itself the finding for item 2.

### Evidence — MUI X DataGrid pipe processing

**(a) What a pipe processor is.** A named group maps to `{ value, context? }`; a processor is `(value, context) => value`; `unstable_applyPipeProcessors(group, value, context)` folds every registered processor of that group over the value. Documented in-source as "Implement the Pipeline Pattern … Some plugins contains custom logic to enrich data provided by other plugins" [S14][S13].

**(b) Order — registration order, nothing else.** Processors live in a `Map` keyed by id, and the run list is `Array.from(map.values()).filter(v => v !== null)`, consumed by a plain forward `for` loop. Map iteration is insertion order, so execution order is **first-registration order**, which is React hook-call order, which is the grid's internal plugin-list order. There is no priority, no `before`/`after`, no anchor [S14].
A subtle consequence: unregistering sets the id's value to `null` rather than deleting the key, so a processor that re-registers **regains its original slot** [S14]. Position is owned by first registration, permanently.

**(c) The group set is a closed union — but an _open_ one.** `GridPipeProcessorGroup = keyof GridPipeProcessingLookup`, and `GridPipeProcessingLookup` is declared as an **`interface`**, not a type alias or a `const` array [S13]. That makes it extensible by TypeScript declaration merging: a plugin package augments the interface with its own group, and `GridPipeProcessor<'myGroup'>` types correctly with no change to the core package. The community lookup ships 19 groups (`columnMenu`, `exportState`, `getRowsParams`, `hydrateColumns`, `hydrateRows`, `exportMenu`, `preferencePanel`, `restoreState`, `rowHeight`, `scrollToIndexes`, `rowClassName`, `cellClassName`, `isCellSelected`, `canUpdateFocus`, `clipboardCopy`, `canStartEditing`, `isColumnPinned`, `processDataSourceRows`, `isRowReorderValid`) and notably **does not** contain `filteringMethod`/`sortingMethod` [S13] — consistent with premium augmenting the interface, though that augmentation was not itself read (see Unverified).

**(d) No duplicate detection of any kind.** `registerPipeProcessor(group, id, processor)` is a `Map.set` — same id replaces (last-writer-wins for that id), different ids both run, chained. Nothing throws, nothing warns. And `useGridRegisterPipeProcessor` generates its id as `` `mui-${Math.round(Math.random() * 1e9)}` `` per hook instance [S15], so in practice **collisions are structurally impossible and therefore structurally invisible** — the "one owner per slot" concept does not exist in this design. This is the ADR-0003 failure mode by construction, accepted deliberately because a MUI pipe group is an _accumulate_ slot, not a single-occupancy one [S14][R10].

**(e) Self-contained — within MUI's own plugin list, not for a true third party.** A plugin calls `useGridRegisterPipeProcessor(apiRef, group, callback)` and wires nothing else; the consumer writes no order config [S15]. But the hook is exported only from `@mui/x-data-grid/internals`, never the public `index.d.ts` [S16], and a plugin only runs if it is in the grid's internal `useDataGridComponent` hook list — which a consumer cannot extend. So MUI has solved R2 _for first-party premium packages_ and has not opened it to third parties at all.

**(f) Mapped to R1–R10** — see the new column 7 below.

### Evidence — Angular Signal Forms schema composition

- `schema<TValue>(fn: SchemaFn<TValue>): Schema<TValue>`; `SchemaFn<TModel, TPathKind> = (p: SchemaPathTree<TModel, TPathKind>) => void` — a schema is a **void-returning side-effecting function** over a path proxy, not a value to be merged [S17].
- `apply(path, schema)`, `applyEach(path, schema)`, `applyWhen(path, logic, schema)`, `applyWhenValue(path, predicate, schema)` all return `void` [S17]. There is **no ordering primitive anywhere in the surface** — no `before`, no `after`, no priority, no stage. The full export list confirms it: 100+ exported symbols, none of them an ordering control [S18].
- Rule application is therefore **positional** — declaration order inside the `SchemaFn`, and nesting order across `apply()` calls. Nothing resolves or reorders.
- **There is no collision detection.** The opposite: multiple contributions to one field are the _designed_ case. `MetadataKey`'s own doc states it "represents metadata that is aggregated from multiple parts according to the key's reducer function … There may be multiple rules in a schema that contribute values to the same `MetadataKey` of the same field" [S17].
- **The merge law is declared by the key, not by the contributors.** `MetadataReducer<TAcc, TItem>` is `{ reduce, getInitial }`, and the shipped reducers are `list` (accumulate all), `min`, `max`, `or`, `and`, and `override` ("always takes the next individual item value") [S17]. So "two schemas set the same metadata on the same field" has a per-key answer chosen at key-creation time, ranging from accumulate-everything to last-writer-wins — and `override` is opt-in, not the default.

**Mapped to R1–R10, briefly.** R1 **fails** (positional). R2 passes. R3 **fails by design** (no collision concept). R4 passes (fully typed, `TAcc`/`TWrite` threaded through the key). R5 n/a. R6 n/a. R7 no. R8 no. R9 n/a. R10 passes strongly.

**Does it argue for or against anchors? For — by elimination.** Signal Forms gets away with zero ordering machinery only because it made every multi-contributor slot **order-insensitive by construction**: `list`/`min`/`max`/`or`/`and` are all commutative, so declaration order cannot change the outcome [S17]. That is a genuinely better answer than ordering, where it is available — and this library already uses it once, in `expandedRows`' set union (ADR-0017 notes "Union needs no precedence: group ids and row ids are disjoint universes") [R11]. **It is not available at the stage layer.** A row-transform chain is non-commutative — filter-then-sort ≠ sort-then-filter — so no reducer can absorb the ordering question, and something explicit must carry it. Signal Forms therefore does not supply a counter-model to anchors; it supplies the boundary condition that tells you when you are allowed to skip ordering entirely, and the stage layer is on the wrong side of it. Since ADR-0004 and `CLAUDE.md` cite Signal Forms as this library's structural reference [R8], that distinction is worth writing into the new ADR explicitly, so a later reader does not "fix" anchors into a reducer.

### Evidence — tapable precedence (the flagged unverified item, now resolved)

- `HookCodeFactory.js` contains **no** `stage`/`before` handling at all — it only generates call code [S21]. The ordering lives entirely in `Hook.js`.
- `Hook.prototype._insert` is the algorithm [S20]. Fast path: no `before` and `stage === 0` and the last tap's stage `<= 0` ⇒ append. General path: build a `Set` from `item.before`, walk the taps array backwards shifting each right, **delete from the set any tap named in `before` and keep going past it**, and stop only once the set is empty **and** the current tap's stage is `<= item.stage`.
- **Therefore `before` overrides `stage`,** and the README's precedence wording — which the first pass flagged as possible summarizer paraphrase — is correct on the substance: a tap is placed ahead of every tap it names, regardless of their stages, while untargeted taps still sort by stage. Resolved; the earlier Unverified entry for S6 can be struck.
- Worth carrying into the design: tapable makes the two mechanisms coexist by giving the _named_ constraint priority over the _numeric_ one. If a numeric escape hatch is ever added alongside anchors here, that is the precedence to copy.

### Comparison — column 7 added

R1 deterministic order · R2 self-contained feature · R3 collision/typo throws · R4 typed, no `any` · R5 engine pure · R6 works in `composeFeatures` · R7 per-app/per-component override · R8 emission-order invariant statable · R9 built-ins unchanged · R10 general mechanism

|     | 2. Anchors in spec                                                            | 7. MUI-style processor groups                                                                                                                                      |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | yes — resolved from declared constraints, ties throw [R9]                     | **no** — `Map` insertion order, i.e. registration order; the exact property ADR-0011 forbids [S14][R9]                                                             |
| R2  | yes [R12]                                                                     | partial — self-contained for a package inside the grid's own plugin list, but the hook ships only under `/internals` and a consumer cannot add a plugin [S15][S16] |
| R3  | yes — unknown anchor / cycle / duplicate name throw at construction [R5][R12] | **no** — random per-instance ids make duplicates structurally impossible to detect; nothing ever throws [S14][S15]                                                 |
| R4  | partial — new names widen the key to `PipelineStage \| (string & {})`         | **yes — and better than option 2**: the group registry is an `interface`, so a third party adds a group by declaration merging and stays fully typed [S13]         |
| R5  | yes — pure topological resolve [R3]                                           | n/a — React-coupled; the fold itself is a pure `for` loop [S14]                                                                                                    |
| R6  | yes [R4]                                                                      | n/a                                                                                                                                                                |
| R7  | no                                                                            | no                                                                                                                                                                 |
| R8  | yes — `preservesEmissionOrder` checked against the prune boundary [R11]       | no — no place to declare it                                                                                                                                        |
| R9  | yes [R9]                                                                      | yes                                                                                                                                                                |
| R10 | yes [R8]                                                                      | yes — one mechanism, named groups, value + context [S14]                                                                                                           |

**Does column 7 change the recommendation? Not the choice — one component of it.** MUI is a pure _accumulate_ model with no ordering answer and no single-owner concept, so it cannot satisfy R1 or R3, both non-negotiable here [S14][R9][R5]. But **`GridPipeProcessingLookup`-by-interface is a strictly better answer to R4 than what option 2 proposed**, and it should be adopted into the recommendation: declare the stage registry as an **interface** rather than deriving the union from a `const` array, so a third-party package augments it and its stage name stays a checked literal instead of a bare `string`. That converts option 2's R4 from _partial_ to _yes_, at the cost of changing how `PipelineStage`/`RenderStage` are derived — which is the one place `CLAUDE.md` currently guarantees "one declaration, so a typed stage is always an executed stage" [R1][R2]. That guarantee has to be restated: the interface becomes the name registry, and the resolved order becomes a _derived runtime fact_ checked at construction rather than an array literal. Call that out in the new ADR; it is the single largest change this addendum makes.

### Recommendation — restated

**Unchanged in choice, changed in one mechanism.** Adopt anchor-based stage declaration in `TableFeatureSpec` — a feature declares `{ name, after|before, run, preservesEmissionOrder }`, the engine topologically resolves against fixed built-in anchors, and an unknown anchor, a cycle, an ambiguous tie, a duplicate name, or an emission-order violation before the prune boundary all throw at construction naming both parties [R5][R11][R12]. The addendum strengthens this rather than unsettling it: MUI X is the only surveyed _open_ stage registry, and it buys openness by giving up both R1 and R3 outright — registration-order execution and random per-instance ids that make collision undetectable [S14][S15] — which is the pre-ADR-0003 behavior this engine exists to have escaped [R10]; Angular Signal Forms, the library this codebase treats as its structural reference, has no ordering primitive at all and only survives that because every one of its multi-contributor slots is made commutative by a key-declared `MetadataReducer` [S17], an escape a non-commutative row-transform chain cannot take; and tapable's published `_insert` now confirms from source that where a real system does carry both a named and a numeric constraint, the **named** one wins [S20] — i.e. anchors over priorities, which is the ordering this recommendation already picked. The one substantive amendment is to R4: borrow MUI's `GridPipeProcessingLookup` shape and declare the stage-name registry as a TypeScript **interface** open to declaration merging [S13], instead of deriving the stage union from a `const` array, so a third-party stage name stays a checked literal rather than widening to `string`. DI (`provideTableStages()`) remains deferred and remains an **edit function over the already-resolved order**, never the definition site — Angular's own interceptor guide concedes that DI-registration ordering is "very hard to predict" and steers users off it [S9], and no surveyed system places extension-point _placement_ knowledge with the consumer rather than the author. ADRs amended: **0011** (fixed `RENDER_ORDER` membership, and the consumer-configurable rejection, both narrowed to "no reordering of built-ins, no composition-order semantics"), **0017** (`'prune'` becomes an enforced boundary, not an array index), and now also **0004 / `CLAUDE.md`** (the "one declaration" invariant for `PIPELINE_ORDER`/`RENDER_ORDER` is restated as an interface registry plus a construction-time resolve). A new ADR carries the mechanism itself, and should record explicitly _why_ the Signal Forms reducer model — the house reference — is not applicable here, so the next reader does not collapse anchors into a reducer.

### Not researched (updated)

- The premium/pro augmentation of `GridPipeProcessingLookup` itself — inferred from the absence of `filteringMethod`/`sortingMethod` in the community lookup, not read. `@mui/x-data-grid-premium@9.13.0` was confirmed to exist (918 files) but its declaration files were not opened [S13].
- MUI's `useDataGridComponent` plugin list, which is the thing that decides registration order and therefore _all_ of MUI's ordering semantics. Not read; the "React hook-call order" claim is an inference from `Map` insertion order plus how `useGridRegisterPipeProcessor` registers [S14][S15].
- Angular Signal Forms **validator** merge semantics specifically — `MetadataKey` aggregation is documented and read [S17], but whether two validators on one field both contribute errors was not confirmed from a declaration; only the metadata path was.
- `ENVIRONMENT_INITIALIZER` ordering — still not researched, carried over from the first pass.
- Still no compiled probe (`P*`) for the R4 rows on either option 2 or the interface-registry variant; both remain reasoned from declarations.

### Unverified (updated)

- **Struck:** the earlier tapable `before`-vs-`stage` precedence entry. Now confirmed from published source [S20].
- Whether declaration merging on an exported `interface` actually survives this repo's build and public-API extraction (`index.ts` barrel, `ngc`, the generated `*.overloads.ts`). MUI proves it works in a plain TS package [S13]; nothing was checked here.
- Whether `Map` insertion-order iteration is what MUI _intends_ as the ordering contract or merely what it happens to do — no comment or doc in the package states it [S14]. Treat "registration order" as observed behavior, not a promise.
- The Signal Forms guide page returned no ordering or merge statements [S19]; it is possible a different guide page (`field-metadata#combining-contributions-with-reducers`, linked from the JSDoc [S17]) states them. That page was not fetched.

### Sources (addendum rows)

|     | Source                                                                                              | Version  | Verified                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | `npm view @mui/x-data-grid version` / `@angular/forms` / `tapable`                                  | —        | yes — ran it; 9.13.0 / 22.1.7 / 2.3.3 on 2026-09-17. Corrected the brief's "Signal Forms 21.x"                                                                                                                                                                 |
| S13 | https://unpkg.com/@mui/x-data-grid@9.13.0/hooks/core/pipeProcessing/gridPipeProcessingApi.d.ts      | 9.13.0   | yes — full file read; `GridPipeProcessingLookup` is an **interface** (19 groups), `GridPipeProcessorGroup = keyof` it. This is what upgraded option 2's R4 from partial to yes                                                                                 |
| S14 | https://unpkg.com/@mui/x-data-grid@9.13.0/hooks/core/pipeProcessing/useGridPipeProcessing.mjs       | 9.13.0   | yes — full implementation read; `Map`-insertion-order chain, no duplicate check, `set(id, null)` on unregister keeps the slot. Contradicts any assumption that a mature grid's open pipeline has ordering guarantees                                           |
| S15 | https://unpkg.com/@mui/x-data-grid@9.13.0/hooks/core/pipeProcessing/useGridRegisterPipeProcessor.js | 9.13.0   | yes — read; `` `mui-${Math.round(Math.random()*1e9)}` `` id, which is why collision detection cannot exist in this design                                                                                                                                      |
| S16 | https://unpkg.com/@mui/x-data-grid@9.13.0/internals/index.d.ts                                      | 9.13.0   | yes — read; `useGridRegisterPipeProcessor` exported here and **not** from the public `index.d.ts`, which narrows MUI's R2 claim to first-party only                                                                                                            |
| S17 | https://unpkg.com/@angular/forms@22.1.7/types/_structure-chunk.d.ts                                 | 22.1.7   | yes — read; `schema`/`apply`/`applyEach`/`applyWhen`/`applyWhenValue` signatures, `MetadataReducer` (`list`/`min`/`max`/`or`/`and`/`override`), and the "multiple rules … contribute values to the same `MetadataKey`" doc. The load-bearing source for item 2 |
| S18 | https://unpkg.com/@angular/forms@22.1.7/types/signals.d.ts                                          | 22.1.7   | yes — read; full export list, confirming no ordering primitive exists anywhere in the public surface                                                                                                                                                           |
| S19 | https://angular.dev/guide/forms/signals/schemas                                                     | unpinned | yes — fetched; **silent** on rule order, duplicate application and merge behavior. The silence is the finding, and is why S17 carries the claim instead                                                                                                        |
| S20 | https://unpkg.com/tapable@2.3.3/lib/Hook.js                                                         | 2.3.3    | yes — source read; `_insert` walks backwards deleting from the `before` set and stops only when it is empty **and** stage allows — so `before` overrides `stage`. Resolves the first pass's flagged Unverified item                                            |
| S21 | https://unpkg.com/tapable@2.3.3/lib/HookCodeFactory.js                                              | 2.3.3    | yes — read; negative result, contains no `stage`/`before` logic. Recorded so the next reader does not look here                                                                                                                                                |

---

## Addendum 2 — 2026-09-18 · Why the stage order is what it is, edge by edge

### Method (addendum 2)

- Source files re-read on 2026-09-18 from
  `C:\Users\dmena\git\acme\libs\shared\table\src`.
- **Provenance note:** a second copy of this library now
  lives at `C:\Users\dmena\git\ng-table\libs\table`. Both
  copies were checked and agree exactly — same
  `PIPELINE_ORDER`, same `RENDER_ORDER`, same three claimed
  pipeline stages [R22]. So the edge analysis holds for
  either, but a future pass should confirm which copy is
  canonical before editing.
- Prior art pinned: `@angular/material@22.1.7` and
  `@angular/cdk@22.1.7` (`npm view`, 2026-09-18) [P2]. The
  Material chain is read from the published bundle
  `fesm2022/table.mjs`, not from GitHub.
- Not re-fetched: TanStack [S1], AG Grid [S3], MUI X [S13] —
  reused from the first pass, same pins and same caveats
  (TanStack and AG Grid still unpinned; AG Grid still only
  reachable at `/archive/27.1.0/`).

### A finding that reframes two of the edges

Two facts, both read from source, change how three edges
should be classified.

**1. `'expand'` is a reserved, unclaimed pipeline stage.**
Only `filter`, `group` and `sort` are claimed today —
`withFiltering()` [R20], `withGrouping()` [R18],
`withSorting()` [R19]. `withExpansion()` declares
`renderStages.tree` and **no pipeline stage at all** [R21].
Confirmed by grep across both repo copies [R14][R22]. So
`'expand'` sits in `PIPELINE_ORDER` exactly as `'paginate'`
sits in `RENDER_ORDER`: reserved, unoccupied. Every claim
about the `sort → expand` edge is therefore about intent,
not behavior.

**2. The render `'group'` stage re-derives its clusters from
scratch.** `buildGroupRenderRows` calls `buildClusters` on
whatever it receives [R16]. It does not consume the
contiguity the pipeline `'group'` stage produced. Nor does
anything else: `rowsBeneathGroup` and `collectGroupIds` both
call `buildClusterNodes` themselves, off `input.rows()`
[R16][R18]. That makes the pipeline `'group'` stage's only
observable effect the **order of the public `table.rows()`
signal** — not the rendered output. Stated as an inference
from reading, not from a probe (see Unverified).

### The edge table

Class: **hard** = flipping changes output incorrectly ·
**soft/contract** = flipping changes a public contract's
shape, not correctness · **soft/convention** = a product
choice libraries genuinely disagree on.

| Edge                                       | Class                                                                                           | Reason                                                                                                                                                                                                                                                                                                                 | What flips                                                                                                                                                                                                                                                                      | Prior art                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **pipeline** `filter → group`              | **hard** on group _summaries_, soft on row order                                                | `when` / `columnWhen` admission and `computeAggregates` both receive a cluster's own rows [R16]. Group first and those predicates count rows the user filtered out                                                                                                                                                     | 4 rows: A(eng,active) B(eng,inactive) C(ops,active) D(ops,inactive); filter `active`; `when: ({rows}) => rows.length >= 2`. **Ours:** eng=1, ops=1 → both dissolved → 2 flat rows, no headers. **Flipped:** eng=2, ops=2 → both admitted → 2 headers + 2 rows. Different output | **Split.** TanStack filters then groups [S1]; **AG Grid groups _first_, then filters** [S3]; Material has no grouping [S22]; MUI X does not pipe-process either [S13]                                                                                                                                                   |
| **pipeline** `group → sort`                | **soft / contract**                                                                             | The render layer re-clusters [R16], so this edge does not decide rendered order. It decides whether `table.rows()` is _globally sorted_ (sort last) or _cluster-contiguous_ (group last) — and `rowsOf()` reads `input.rows()` [R18]                                                                                   | A(eng,100) B(ops,50) C(eng,200) D(ops,300); group by dept, sort salary asc. **Ours:** rows() = [B,A,C,D] (sorted). Rendered: ops(B,D), eng(A,C). **Flipped:** rows() = [B,D,A,C] (clustered). Rendered: **identical** — the re-cluster normalizes it                            | Agreement, for a different reason. TanStack groups then sorts [S1]; AG Grid group…sort [S3]. Neither states why                                                                                                                                                                                                         |
| **pipeline** `sort → expand`               | **hard once claimed**, vacuous today                                                            | Nothing claims `'expand'` [R14][R21]. Its intended job — injecting child rows into `TRow[]` — must follow sort, or children get sorted away from their parent                                                                                                                                                          | P1(z), P2(a), C1/C2 under P1; sort name asc. **sort→expand:** [P2,P1,C1,C2] ✔. **expand→sort:** [P1,C1,C2,P2] → sort → children scattered ✗                                                                                                                                    | TanStack sorts then expands [S1]; AG Grid's `map` (flatten) is last [S3]                                                                                                                                                                                                                                                |
| **cross-layer** pipeline out → render seed | **hard, and not an edge**                                                                       | `buildDefaultRenderRows` 1:1 wraps `rows()` into `{id, depth:0, kind:'row', data:row}` [R15], and ADR-0011 D1 fixes the seed as the engine's, unreplaceable [R9]. It is a **type boundary**, so a stage picks a layer and cannot anchor across                                                                         | Not flippable. The consequence is the rule: anything that **synthesizes** rows needs `data: null`, which only `RenderRow` has → render layer. Anything that must be visible to `table.rows()` → pipeline layer                                                                  | Material's chain is single-layer (`T[]` throughout) [S22]; TanStack's row models likewise [S1]. The two-layer split is this library's own                                                                                                                                                                               |
| **render** `group → tree`                  | **hard, and self-checking**                                                                     | `buildGroupRenderRows` **throws** if any input row has `data === null`, with the message "the 'group' render stage must run first in RENDER_ORDER" [R16]. ADR-0011 adds the semantic reason: grouping is the outer structure; reversed, tree flattens first and scatters children from their value-cluster parent [R9] | P1(eng) with children C1,C2; P2(ops); group by dept. **group→tree:** eng header, P1, C1, C2, ops header, P2 ✔. **tree→group:** [P1,C1,C2,P2] then cluster — a child whose dept differs lands in another cluster, detached; and any synthesized null-data row throws ✗          | No analogue. Material and TanStack have no render-layer split                                                                                                                                                                                                                                                           |
| **render** `tree → prune`                  | **hard**                                                                                        | Prune hides a row iff `parentId` is set and absent from the unioned `expandedRows` [R2][R11]. Run it before the stage that _stamps_ `parentId` and there is nothing to hide                                                                                                                                            | P1 collapsed, children C1,C2; P2. **tree→prune:** [P1,C1,C2,P2] → [P1,P2] ✔. **prune→tree:** seed has no `parentId` → no-op → tree injects → [P1,C1,C2,P2]. Collapse silently does nothing ✗                                                                                   | No analogue                                                                                                                                                                                                                                                                                                             |
| **render** `prune → paginate`              | **hard** for page-size stability; **soft/convention** for whether hidden children consume slots | A page must contain `pageSize` rows. Prune after paging removes rows from an already-cut window                                                                                                                                                                                                                        | P1 collapsed + C1,C2 + P2, `pageSize: 2`. **Ours:** prune → [P1,P2] → slice → 2 rows ✔. **Flipped:** slice [P1,C1] → prune → **1 row on a 2-row page** ✗                                                                                                                       | **Strongest citation.** Material's `_filterData` calls `_updatePaginator(this.filteredData.length)` — the paginator's total is taken _post-filter, pre-sort_, in Angular's own code [S22]. TanStack paginates last [S1]. ADR-0011 already rules the _convention_ half is a `paginateChildRows` flag, not a reorder [R9] |

**Libraries that order differently, and why.** One real
disagreement: **AG Grid runs group before filter** [S3],
against TanStack, against Material's filter-first chain
[S22], and against this library. The effect is AG Grid's
group tree spans the unfiltered dataset, which is what
pivot and "keep the group, filter within it" semantics
need. No source read states that reason, so it is inference
(see Unverified). Nobody paginates before expanding —
Material pages last [S22], TanStack pages last [S1], AG
Grid flattens (`map`) last [S3].

**MUI X supplies no evidence on any of these edges.** Its
community pipe-group registry has 19 groups and contains
neither filtering, sorting nor pagination [S13]. The one
surveyed library with an _open_ stage registry kept its
ordered core out of it — which is the same conclusion the
first pass reached from the other direction.

### Invariants the engine can actually check

Separating _decidable by the engine_ from _only declarable
by the author_.

**Checkable, and worth asserting**

1. **Parent-before-child emission.** For each row carrying
   `parentId`, the parent id must already have been seen in
   this array. One forward pass, `O(n)`, the same shape as
   the prune itself. This is the invariant ADR-0017 names
   as "load-bearing and unchecked" [R11], and the one a
   third-party stage inserted before `'prune'` breaks
   silently [R2]. **Assert it immediately before `'prune'`.**
2. **Row-id uniqueness.** `O(n)` with a `Set`. A stage that
   duplicates a row without re-keying — row pinning, the
   flagship third-party case — produces duplicate ids,
   which corrupts `trackBy`, `indexById` and the
   `sourceIndex` stamp. Today a real row whose id is not in
   `indexById` silently reports `sourceIndex: undefined`
   [R6], so this fails quietly. **Assert it once per
   `renderRows` evaluation.**
3. **Real-row id containment** — the output's non-synthesized
   ids are a subset of the input's. Catches a stage that
   _invents_ a real row, the other way to break the
   `sourceIndex` stamp [R6]. Cheap, same pass as #2.

**Not checkable — declarable only**

4. **Row-count monotonicity.** There is no general rule:
   filter shrinks, group and tree grow, prune and paginate
   shrink. The engine cannot infer which a stranger's stage
   is. It _can_ verify a **declared** direction
   (`'preserves' | 'may-shrink' | 'may-grow'`) and use it
   positionally — a `may-grow` stage cannot sit after
   `'paginate'`, which is the page-size invariant of edge 7
   expressed as a construction-time check.
5. **Synthesized rows (`data === null`).** Already enforced
   ad hoc by one throw inside `buildGroupRenderRows` [R16].
   Generalize as a declaration `synthesizesRows: boolean`:
   a `false` stage must not increase the null-data count,
   and a `true` stage cannot be anchored before
   `'group'` — which turns that hand-written throw into a
   rule the engine owns.
6. **Which phase a stage belongs in.** Not decidable at
   all. The only _derivable_ half is the layer, and types
   already give that for free: `TRow[]` versus
   `Omit<RenderRow<TRow>,'index'>[]` [R15]. Position within
   a layer is a statement about meaning, and meaning is the
   author's.

**One performance contract, not an assertion.** `clusterRows`
and `partitionAndRecurse` deliberately return the input
reference when nothing changed, and `grouping.ts` calls that
"load-bearing for 'composing `withGrouping()` with no extra
config changes nothing'" [R16]. A third-party stage should
be told to do the same when inert. Asserting it is not
worth the cost; documenting it is.

**Where the assertions run.** #1–#3 are data-dependent —
they need rows in hand, so they cannot throw at
construction. The error policy this library states is
"throw at construction, degrade at runtime", and it
explicitly requires reporting **in production as well as
dev**, deduped once per callback per evaluation. So: report
once per stage per evaluation and pass the rows through
unchanged, never throw and never blank the table. Flagged —
that policy is read from the library's own `CLAUDE.md`
restatement, not from ADR-0014 itself (see Unverified).
#4–#5 are declarations, checked positionally at
construction, where a throw is correct.

### Consequence for the anchor design

Five anchors are load-bearing and a third-party author must
be told their constraints: pipeline **`'filter'`** must stay
first, because every group summary, aggregate and page count
downstream is computed over its output [R16][S22]; render
**`'group'`** must stay first and already self-enforces it
with a throw on null-data input [R16]; render **`'tree'`**
must precede the **`'prune'`** boundary, which must stay
terminal over every `parentId`-stamping stage [R2][R11]; and
**`'paginate'`** must stay last, or pages come out ragged
[R9][S22]. Three are convenience: pipeline **`'group'`**,
whose only observable effect is the order of `table.rows()`
because the render layer re-clusters from scratch [R16];
pipeline **`'sort'`**, whose position decides the shape of
that same public contract rather than the rendered output;
and pipeline **`'expand'`**, which nothing claims [R14] and
whose intended job is already done structurally by render
`'tree'`. That last one is a change from Addendum 1, which
said keep `'expand'` as a built-in anchor: **it should be
removed rather than exposed**, because an anchor nobody
occupies, whose semantics are covered by a render stage,
teaches a third-party author the wrong phase for exactly
the case (injecting child rows) that the two-layer split
exists to route into the render layer. `'paginate'` still
earns its keep as an unoccupied anchor — it is the only way
to say "before the window is cut" [R13]. Net: the anchor
set the mechanism exposes should be `filter` and `sort` in
the pipeline, `group`, `tree` and `paginate` in the render
layer, with `prune` as the boundary and pipeline `group`
documented as contract-shaping rather than
order-determining. And the engine can verify a declared
phase but never derive one, so the declaration —
`synthesizesRows`, `rowCount`, `preservesEmissionOrder` —
is the load-bearing part of the design, not the anchor name.

### Not researched (addendum 2)

- Whether removing the pipeline `'group'` stage actually
  leaves rendered output unchanged. Reasoned from reading
  `buildGroupRenderRows` / `rowsBeneathGroup` /
  `collectGroupIds` [R16]; **no probe run**, and running
  one would mean running tests, which is not done unasked.
- AG Grid's stated reason for grouping before filtering.
  The archived page describes the sequence but gives no
  rationale [S3]; the pivot/aggregate explanation is mine.
- `withExpansion()`'s `buildTreeStage` internals — only its
  claim site was read [R21], so the "tree stamps
  `parentId`" claim rests on ADR-0017's description [R11],
  not on that function's code.
- MUI X premium's `filteringMethod` / `sortingMethod` —
  still not read, carried over from Addendum 1.
- Which of the two repo copies (`acme` vs `ng-table`) is
  canonical. They agree today [R22]; nothing was read that
  says which one future work edits.

### Unverified (addendum 2)

- **ADR-0014 was not opened.** The error-policy ruling above
  ("throw at construction, degrade at runtime, report in
  production too") is quoted from the library's `CLAUDE.md`
  restatement [R17]. Per this repo's own rule that an ADR's
  Decision section is the only record of what was settled,
  confirm the reporting-in-production clause against
  `docs/adr/0014-runtime-error-policy.md` before writing it
  into a new ADR.
- The `filter → group` example's outcome assumes `when`
  receives post-filter rows in the current order of
  operations. That follows from `clusterRows` being the
  `'group'` pipeline stage and `admitClusters` running
  inside it on its input [R16][R18], but was not executed.
- Row counts and orders in every worked example are derived
  by reading the transforms, not by running them.
- Material's chain is read from a built ESM bundle, so
  method names are post-compilation. The names
  (`_filterData`, `_orderData`, `_pageData`) survive
  minification-free in this bundle [S22], but they are
  private API and could differ from the TypeScript source.

### Sources (addendum 2 rows)

|     | Source                                                                                           | Version | Verified                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2  | `npm view @angular/material version` / `@angular/cdk`                                            | —       | yes — ran it; 22.1.7 / 22.1.7 on 2026-09-18                                                                                                                                                                                                                                                                                                                                                                                      |
| R14 | grep for `expand:` over `libs/shared/table/src`, excluding specs                                 | —       | yes — ran it; **no hits**. `'expand'` is a reserved, unclaimed pipeline stage. This reframed the `sort → expand` edge and reversed Addendum 1's "keep `'expand'` as an anchor"                                                                                                                                                                                                                                                   |
| R15 | `libs/shared/table/src/engine/rows.ts:25-30`                                                     | —       | yes — read; `buildDefaultRenderRows` 1:1 wrap, `depth: 0`, `kind: 'row'`                                                                                                                                                                                                                                                                                                                                                         |
| R16 | `libs/shared/table/src/engine/grouping.ts`                                                       | —       | yes — full file read. `buildClusters` `Map`-order comment (l.63-64), `sortClusters` (l.193-227), `partitionAndRecurse` reference-preservation (l.234-241), `clusterRows` (l.270-290), the null-data **throw** in `buildGroupRenderRows` (l.389-397), `rowsBeneathGroup` re-deriving from `input.rows()` (l.430-443), `collectGroupIds` (l.460-480). The re-derivation is what demoted pipeline `'group'` to a convenience anchor |
| R17 | `libs/shared/table/CLAUDE.md`, "Errors: throw at construction, degrade at runtime"               | —       | partial — read, but this is the restatement, not ADR-0014. Flagged in Unverified                                                                                                                                                                                                                                                                                                                                                 |
| R18 | `libs/shared/table/src/api/features/with-grouping.ts:120-160`                                    | —       | yes — read; `clusterOpts` shared by both stages, `stages.group` → `clusterRows`, `renderStages.group` → `buildGroupRenderRows`, `rowsOf` reads `input.rows()`                                                                                                                                                                                                                                                                    |
| R19 | `libs/shared/table/src/api/features/with-sorting.ts:177-180`                                     | —       | yes — read; `stages.sort`, and `manual` short-circuits to identity                                                                                                                                                                                                                                                                                                                                                               |
| R20 | `libs/shared/table/src/api/features/with-filtering.ts:56-68`                                     | —       | yes — read; `stages.filter`, one matcher per evaluation not per row                                                                                                                                                                                                                                                                                                                                                              |
| R21 | `libs/shared/table/src/api/features/with-expansion.ts:243-245`                                   | —       | yes — read; declares `renderStages.tree` only, **no `stages`** key                                                                                                                                                                                                                                                                                                                                                               |
| R22 | `ng-table/libs/table/src/engine/pipeline.ts:6`, `.../render-stages.ts:8`, plus a claim-site grep | —       | yes — read; both order arrays and all three claim sites identical to the acme copy                                                                                                                                                                                                                                                                                                                                               |
| S22 | https://unpkg.com/@angular/material@22.1.7/fesm2022/table.mjs, lines 1091-1120                   | 22.1.7  | yes — published bundle read. `_filterData → _orderData → _pageData`; `_filterData` calls `_updatePaginator(this.filteredData.length)`, and `_orderData` does `data.slice()` before sorting. The strongest available citation that the count-deciding stage must precede paging                                                                                                                                                   |
