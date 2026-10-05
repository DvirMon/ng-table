# Decisions — effect-free column reactivity

Companion to `1-gap-report.md`. Records what was settled during the research pass, so the
refactor ticket doesn't re-decide it.

## D1 — Root cause: one signal, three write sources (2026-08-17)

`columns` is a single `WritableSignal` that merges three unrelated sources:

1. static config (`resolveColumnDefs(config.columns)`)
2. imperative consumer writes (`setColumns`, `reorderColumns`, `toggleColumnVisibility`)
3. rule-driven `visible` (`applyVisible` / `applyVisibleAsync`)

`effect()` is the only mechanism that can fold source 3 into a signal source 2 also owns.
The gap report frames the problem as "the library uses `effect()`"; the actual invariant
being violated is source separation. Split the sources and the effects disappear as a
consequence, not as a target.

## D2 — Target shape: writable base + derived overlay (2026-08-17)

```ts
const baseColumns = signal(resolveColumnDefs(config.columns)); // sources 1 + 2
const ruleResults = computed(() => /* fold rule registry */);   // source 3
const columns = computed(() => applyRuleResults(baseColumns(), ruleResults()));
```

- `store.columns` stays a readonly `Signal` in the public type — no consumer-visible change.
- `updateColumns()` keeps its signature; it retargets `baseColumns` internally.
- Backward-compat concern in the gap report (item 5) dissolves: imperative writes are
  preserved in the base, rules overlay on top.

**Rejected: `linkedSignal`.** A rule re-firing resets the linked value, losing an imperative
reorder unless `previous` is threaded through the computation — strictly more complex than
the base/overlay split, for no gain.

**Consequence, accepted:** a rule-governed column cannot be manually toggled — the rule wins.
This is not a regression: today the `effect()` clobbers such a toggle on its next firing. The
split makes existing behavior deterministic instead of scheduler-dependent.

## D3 — Async needs no effect (2026-08-17)

`resource()` _creation_ requires an injection context (stays in `onInit`); _reading_ it does
not. `computed(() => resourceRef.status())` is ordinary signal composition. The current
`wireAsyncVisibleRule` reaches for `effect()` only because it must write the result into a
different signal — which D2 removes.

## D4 — General rule reducer, not a `visible`-only overlay (2026-08-17)

The derivation layer is built as a per-column **rule registry** folded by one `computed()`,
keyed by rule kind — mirroring Signal Forms' per-field rule list. `visible` is the only kind
implemented today; a future `applyDisabled` / `applyLabel` registers into the fold instead of
forcing a rework of the merge.

**Why:** a `Map<columnId, boolean>` overlay is the degenerate single-property case of the same
structure; the general form costs roughly one extra module under
`api/features/with-columns-schema/` and removes the next rule kind's migration entirely.

## D5 — Unresolved async state: hold last resolved, in a per-rule `linkedSignal` (2026-08-17)

**Superseded an earlier draft of this decision** that had unresolved rules abstain to the
column's declared `visible`. That draft was wrong; the reasoning is kept below because the
correction is the substance.

An async rule's result is produced by one `linkedSignal` per rule, which retains its previous
value while the resource is unresolved:

```ts
const ruleVisible = linkedSignal<ResourceStatus, boolean | undefined>({
  source: () => resourceRef.status(),
  computation: (status, previous) => {
    if (status === 'resolved' || status === 'local') return rule.onSuccess(resourceRef.value());
    if (status === 'error') return rule.onError(resourceRef.error());
    return previous?.value; // loading / reloading / idle → hold
  },
});
```

Before first resolution `previous` is `undefined`, which falls through to the column's declared
`visible` — the only case where a default is needed. `onError` still becomes **required**, so
the failure branch is explicit at the call site.

### Why the abstain draft was wrong

It rested on two claims about Angular. The first is true; the second was not.

**True — params change drops the value.** From `@angular/core/fesm2022/_resource-chunk.mjs`,
the state `linkedSignal` computation:

```js
status = request === undefined ? 'idle' : 'loading';
if (previous.value.extRequest.request === request) {
  stream = previous.value.stream; // same request → previous value survives
}
// different request → stream undefined → value() undefined, hasValue() false
```

plus `projectStatusOfState`: `state.extRequest.reload === 0 ? 'loading' : 'reloading'`. So a
**params change** yields `'loading'` with no value; **`.reload()`** yields `'reloading'` with
the value intact.

**False — that Signal Forms therefore reverts to a default.** It does not. `validateAsync`
returns `'pending'` while loading, and a pending field **is not valid** — submit stays blocked.
Angular fails _safe_, toward the restrictive side. It never falls back to the declared value.
"Abstain to the declared default" was a third behavior, not the Angular one.

**And Angular does use previous-value memory** — one layer lower than validation, which is why
it isn't visible in `validateAsync`. `resource()` itself is built on a `linkedSignal` taking
`previous`, and the `debounced()` helper in `core.mjs` carries the value forward explicitly:

```js
state.set({ status: 'loading', value: currentState.value });
```

Retention-while-loading is an Angular idiom. It belongs at the resource boundary, not in the
merge — which is exactly where this decision puts it.

### Why this does not compromise D2

The memory is confined to how a single rule's result signal is _produced_. The fold over those
signals stays a pure function of `{ baseColumns, ruleResults }`. No `effect()` is involved —
`linkedSignal` is a derivation primitive — so the gap report's actual invariant holds.

### Known limitation, accepted

When params change because the _subject_ changed (user switches tenant, permission query
re-runs), the retained value answers the previous subject's question — a column stays visible
on the old tenant's permissions for the duration of the fetch. The library cannot distinguish
this from a benign re-query; only the rule author can.

**Deferred: optional `onPending?: () => boolean`** to override the retained value for
fail-closed rules. Purely additive — nothing here blocks adding it when a real fail-closed rule
appears. Not shipped now because no consumer needs it.

**Breaking change, accepted:** `applyVisibleAsync` is Tier 1; the demo is its only consumer today.

## D6 — Rule registry reaches `columns` via a mutable handle registry (2026-08-17)

`columns` is built in `createTableCore()`, but rules are owned by `withColumnsSchemaAsync`,
which runs _after_ core construction and can only contribute
`members`/`stages`/`renderRows`/hooks. Resolution: core builds

```ts
const columns = computed(() => foldColumnRules(baseColumns(), columnRules));
```

over a mutable `columnRules` registry handed out on `TableCoreHandle`, populated during
`foldFeatures()`. `TableFeatureSpec` gains a `columnRules` key, claimed through `SlotRegistry`
like `stages` and `renderRows`.

**Why:** this is the mechanism the engine already uses — `core.ts:16` documents that `stages`
and the render-rows builder are handed out as mutable registries precisely because the
computeds read them at _evaluation_ time, so features registering during the fold are visible
before any consumer reads. No new engine concept is introduced. Registration completes during
the fold; `composeTable()` runs `onInit` before returning the store, so async rules' `resource()`
instances exist before `columns()` can be read.

**Rejected: a full column pipeline** (`COLUMN_PIPELINE_ORDER`, symmetric with
`engine/pipeline.ts` for rows). Correct long-term symmetry, but only one stage exists to
justify the surface today. D4's rule registry already provides the extension point that
matters.

**Rejected: rules in `TableEngineConfig`.** Smallest diff — `createTable()` already resolves
`columnsSchema` before composing and already auto-composes this feature — but it hardcodes one
feature's concern into the engine, against the "features declare, engine folds" contract.

## D7 — Signal Forms' `metadata` system: reducers adopted, managed construction rejected (2026-08-17)

`validateAsync` reaches the resource through two separable metadata mechanisms. They get
different verdicts.

**Managed construction** (`createManagedMetadataKey`) — a framework-owned slot that lazily
builds the `resource` per field, in the right injection context, torn down with the field.
Signal Forms needs it because fields are _dynamic_: `applyEach` over an array creates and
destroys fields as data changes, so resources cannot be built up front. And a resource cannot
be constructed inside a rule at all — Angular throws `NG0992`
(`invalidResourceCreationInParams`) — so construction must live outside rule evaluation.

**Rejected for this lib.** Our rules are static: resolved at construction by `resolve.ts`, one
table instance, no rule node created or destroyed at runtime. Building the resources once in
`onInit` and closing over them is the degenerate case of the same idea.

**Reducers** (`MetadataReducer`) — multiple rules contributing to one key, merged by a declared
reducer: `.and()`, `.or()`, `.list()`, `.min()`, `.max()`, `override()`
(`@angular/forms/types/_structure-chunk.d.ts:867-887`).

**Already adopted, under a different name.** `MetadataReducer.and()` _is_
`columnRules.every((rule) => rule.when(ctx))`. D4's rule registry is a narrow hand-roll of this
mechanism — recorded here so it reads as prior art rather than invention, and so a future
second rule kind reaches for the reducer vocabulary Angular already settled on.

## D8 — `ColumnRuleContext` must expose base columns, not derived columns (2026-08-17)

Rule callbacks receive `{ columns: () => store.columns() }` — both `when()` and `params()` read
the resolved columns. Under D2 `columns` becomes derived _from rule results_, which closes a
cycle: rule result → `columns` → params → resource → rule result.

Today's `effect()` masks this — the scheduler breaks the loop, and it converges by accident.
A `computed()` will surface it as a cycle error instead.

**Resolution:** `ColumnRuleContext.columns` resolves to `baseColumns()` — the writable source,
before rule results are overlaid. Rules see declared and imperatively-updated column state, never
their own output. This is a contract change to `ColumnRuleContext` and must land in the same
refactor, not after it.

## D9 — `applyVisibleAsync.factory` widens from `ResourceRef<T>` to `Resource<T>` (2026-08-17)

`VisibleAsyncOpts.factory` is currently typed `(params) => ResourceRef<TResult | undefined>`
([column-rules.ts:36](../../../../../../src/schema/column-rules.ts)). Checked `wiring.ts`'s actual usage
([wireAsyncVisibleRule](../../../../../../src/engine/columns-schema/wiring.ts)): it only ever
calls `.status()`, `.value()`, `.error()` — never `.set()`, `.reload()`, `.destroy()`. The
`ResourceRef<T>` type is stricter than what the code needs; it was an accidental constraint
from importing the concrete type instead of its interface, not an intentional one.

Angular's own `validateAsync` doesn't make this mistake — its `factory` is typed
`(params) => Resource<TResult | undefined>` (`@angular/forms/types/signals.d.ts:368`), where
`Resource<T>` is Angular's public read-only structural interface (`value`, `status`, `error`,
`isLoading`, `hasValue()` — no mutation members). Its own doc comment: _"various other APIs may
present `Resource` instances to describe their own concepts."_ — a declared extension point for
exactly this.

Confirmed `validateHttp` is sugar over `validateAsync`, not a separate abstraction tier —
`factory: request => httpResource(request, opts.options)`, everything else forwarded. So
`applyVisibleAsync` already sits at the right level (the `validateAsync` level); there is no
missing `applyVisibleHttp` tier to add. The only correction needed is the type.

**Change:** `column-rules.ts` imports `Resource` instead of `ResourceRef` from `@angular/core`
and retypes `factory` accordingly. Every existing/planned call site keeps compiling — `resource()`
and `httpResource()` both already satisfy `Resource<T>`, being its subtypes — while a consumer
wrapping TanStack Query (or any other async source) into the same
`{status, value, error, isLoading, hasValue()}` shape becomes usable without Angular's `resource()`
at all. Zero change to D5/D8's wiring logic; this is a type-only widening.

## D9 — The rule _set_ is static; columns and rule _results_ are not (2026-08-17)

D6 rejects a keyed registry on the grounds that rules are static. That claim needs its scope
stated, because two other things nearby genuinely are dynamic:

|                                                      | Dynamic? | Mechanism                                     |
| ---------------------------------------------------- | -------- | --------------------------------------------- |
| Rule results (`when()`, resource)                    | yes      | re-evaluated by the fold on dependency change |
| Columns (`setColumns` replaces the list)             | yes      | fold re-reads `baseColumns()`                 |
| The rule set — which rules exist, on which column id | **no**   | fixed by `resolve.ts` at construction         |

Only the third justifies Angular's keyed `Map`. Signal Forms needs one because _field nodes_
are created and destroyed at runtime (`applyEach` over an array), each owning a stateful
resource that must be found by key and torn down with its node.

Our rules key on `columnId`, not node identity, and our async resources are per-rule, not
per-column — so they are built once and outlive any column churn. When `setColumns()` replaces
the list, the fold walks the rule array and skips ids not present; a newly-added column with a
declared rule is picked up on the next evaluation. No registration, no teardown, no lookup
structure.

**Test this refactor owes:** `setColumns()` adding and removing a rule-governed column.

**If runtime rule mutation is ever added** (a consumer calling `applyVisible` post-construction),
the fix is making the registry a `signal(rules[])` the fold reads — still a fold, still no
`effect()`.

## D10 — `ColumnRuleContext` stays minimal; rules compose through external signals (2026-08-17)

`when` is a plain closure, so any signal it reads is tracked. That — not the context object —
is the composition mechanism:

```ts
const showDiscount = signal(false);
applyVisible(schema.discount, { when: () => showDiscount() });
```

Three extensions were considered and all three rejected:

**`ctx.rows()` — rejected, cyclic.** `with-sorting.ts:142` passes `core.columns()` into
`sortRows`, and `rows = computed(() => runPipeline(config.data(), stages))`. So `rows` already
depends on `columns`. Under D2 a rule reading `rows()` closes
`columns → ruleResults → rows → sort stage → columns`. Today's `effect()` masks it; a
`computed()` throws.

**`ctx.data()` — rejected on semantics, not mechanics.** It would be acyclic (`config.data` is
the consumer's source signal, upstream of both the pipeline and columns). Rejected because
`visible` is table-scoped and row data is row-scoped: any row-derived rule must aggregate
(`some`/`every`/threshold), and a per-row value driving whole-column visibility is incoherent
as UX. A table-scoped input belongs in a table-scoped signal, which the closure already covers.

**Rule-to-rule dependency — rejected.** A rule reading another column's _rule-computed_
`visible` is the D8 cycle. Under D8 rules see `baseColumns()`, so they observe imperative
visibility changes (`toggleColumnVisibility`) but not other rules' outputs. Supporting the
latter would require dependency-ordered resolution and real cycle detection. Rules coordinate
through a shared external signal instead — both read `showDiscount()`, neither reads the
other's output, and there is no ordering problem to solve.

**Out of scope entirely:** a cell whose rendering changes based on another cell's value is
per-row and presentational. `visible` is per-table and structural. That belongs in the
consumer's template, not in a rule.

## Net effect on the gap report

Both `effect()` calls in `wiring.ts` are removed. `wireReactiveVisibleRules` becomes a pure
`when(ctx)` fold; `wireAsyncVisibleRule` keeps only the `resource()` construction that
genuinely needs an injection context, and its result is produced by the D5 `linkedSignal`. The
`no effect-driven state writes` invariant becomes true of the library's own internals, which
is what made it unenforceable (gap report, "Why this matters").

## Open — documentation gap: `MetadataAsyncRule`'s prior shape

`schema/column-schema.types.ts`'s `MetadataAsyncRule` docblock states it was "generalized from
the old `visible-async` shape to carry an arbitrary `key`" — implying a prior version scoped
specifically to `visible`, later widened. D4 above generalizes the **sync** rule kind
(`MetadataRule`) from a `visible`-only overlay to a keyed reducer, but no decision here covers
an equivalent narrowing/widening of the **async** kind specifically.

Flagged 2026-09-03 while trimming decision-history narration out of source comments: the claim
couldn't be verified against this file, `1-gap-report.md`, or anywhere else under `docs/**`. Not
resolved here — either the prior shape genuinely predates this log (find and cite the commit/PR)
or the comment's framing is simply inaccurate and should be corrected to describe only the
current, general shape. Left as `visible-async` framing in the source for now; whoever picks
this up should settle it one way and update both the doc comment and this entry.
