# Gap report: column-visibility rules write state from inside `effect()`

**Status:** open — research brief, not yet a spec or ticket.
**Scope:** `libs/shared/design-system/src/ui/table/` state layer, specifically the
`columnsSchema` reactive/async visibility rules (`applyVisible`, `applyVisibleAsync`).
**Goal of this doc:** hand to a research pass ("find prior art / alternate approaches") before
committing to a refactor. Not an implementation plan.

## The issue

The table's declarative column-visibility API (`applyVisible`, `applyVisibleAsync` in
`api/column-rules.ts`) looks effect-free at the call site — a consumer declares a rule, the
engine "just handles" reactivity. But the internal wiring that fulfills that promise
(`api/features/with-columns-schema/wiring.ts`) is itself built on Angular's raw `effect()`
writing into a signal:

```ts
// wiring.ts — wireReactiveVisibleRules()
effect(() => {
  const ctx: ColumnRuleContext<TRow> = { columns: () => store.columns() };
  const combinedVisible = columnRules.every((rule) => rule.when(ctx));
  patchColumnVisible(store, columnId, combinedVisible); // → store.columns.update(...)
});

// wiring.ts — wireAsyncVisibleRule()
effect(() => {
  const status = resourceRef.status();
  if (hasResolvedValue) {
    patchColumnVisible(store, rule.columnId, rule.onSuccess(value)); // → store.columns.update(...)
  }
  ...
});
```

Both effects terminate in `patchColumnVisible()` → `updateColumns()` (`api/update-columns.ts`)
→ `store.columns.update(...)`. This is exactly the "effect writes to a signal" pattern we want
to keep out of consumer code — it has just been relocated into the library instead of
eliminated. A consumer who writes their own `effect()` to flip `visible` (the
`table-demo.ts` case that started this thread) and a consumer who calls `applyVisibleAsync`
are, underneath, doing the _same_ thing. The library API hides the pattern; it does not remove
it.

## Why this matters (not just style)

- `effect()`-driven state writes are harder to reason about than a pure derivation: ordering
  is scheduler-dependent, they can't be short-circuited/tested as pure functions, and Angular
  itself treats "writing application state from an effect" as an anti-pattern it warns about
  (`NG0600`-adjacent guidance: prefer `computed()`/derivation over `effect()` writes).
- It defeats a searchable invariant. If "no effect-driven state writes" is a rule, it needs to
  be true of the library's own internals, not just of consumer code — otherwise the rule is
  unenforceable and consumers will reasonably assume the DS's own solution is the sanctioned
  pattern to copy.
- `columns` is a `WritableSignal` that's also the single source of truth read directly by the
  render pipeline (`engine/core.ts` — no internal copy, "D3/D4" invariant). Every write path
  into it — sync rules, async rules, consumer-driven `updateColumns()` calls — currently
  funnels through imperative `.update()` calls issued from inside `effect()`s. There is no
  purely-derived (`computed()`-only) path for _any_ column mutation today.

## How Angular's own Signal Forms solves the equivalent problem

Signal Forms' `validateAsync` (`packages/forms/signals/src/api/rules/validation/`) faces the
identical shape of problem — a field's validity needs to react to an async resource — and does
**not** use a raw `effect()` to push the result into field state. Confirmed by reading the
Angular source:

- The resource/params plumbing is built with `computed()` chaining (`ɵchain`), including an
  optional `debounced()` wrapper — no `effect()`.
- The resource is attached to the field via a `metadata(path, RESOURCE, (ctx) => opts.params(ctx))`
  call — a reactive _derivation_ registered against the field's metadata system, not an
  imperative write.
- The result is read back through `addAsyncErrorRule((ctx) => { const res =
ctx.state.metadata(RESOURCE)!; switch (res.status()) { case 'resolved': ... return
addDefaultField(errors, ctx.fieldTree); } })`. This rule is _evaluated by the forms system's
  own validation pipeline_ whenever it runs — the forms engine pulls the current resource
  status when it needs validity, rather than the resource pushing a value into state via
  `effect()`.

In short: Signal Forms has a generic **rule-evaluation pipeline** (fields carry a list of
rules; validity is computed by _running_ those rules on demand, memoized via `computed()`).
Async work becomes just another rule whose "value" happens to come from a `resource()`. There
is never a moment where something reaches out and mutates field state imperatively — validity
is always a derivation, resolved lazily, cached by signals' own change detection.

This table lib has no equivalent pipeline for _column state_ (it has one for _row_ pipeline
stages — `engine/pipeline.ts`'s `PIPELINE_ORDER`/`runPipeline()` — but that's a `computed()`
chain over rows, unrelated to columns). `columns` is a flat `WritableSignal<ColumnDef[]>`
mutated in place by whoever calls `updateColumns()`, including the engine's own rule wiring.

## What would need to change (direction, not a plan)

Sketching the shape Signal Forms implies, for research to evaluate/replace:

1. `columns` (or at least `visible`) stops being a `WritableSignal` that arbitrary call sites
   `.update()`. It becomes a `computed()` derived from: the static `ColumnDefInput[]` +
   the current value of every registered visibility rule (sync `when()` results, resolved
   `resource()` statuses for async rules).
2. Sync rules (`applyVisible`) are trivial under this model — `when(ctx)` is already a pure
   function of reactive state, so folding it into a `computed()` is close to free.
3. Async rules (`applyVisibleAsync`) are the hard part: a `resource()`'s `status()`/`value()`
   are themselves signals, so `computed(() => resourceRef.value())` is legitimate signal
   composition (no `effect()` needed to _read_ a resource) — the current code only reaches for
   `effect()` because it needs to _write_ the result somewhere else (`store.columns`). If
   `columns` becomes computed instead of writable, the async rule's resource value can be
   folded directly into that computed's dependency graph instead of pushed via `.update()`.
4. Open question for research: does this generalize to a per-column-id rule registry +
   `computed()` merge (mirroring Signal Forms' per-field rule list), or is there a simpler
   Angular-idiomatic mechanism (e.g. `linkedSignal`, `toSignal` composition) that gets the same
   "no imperative write" property without building a full rule-pipeline abstraction?
5. Backward-compat concern: `updateColumns()` is also the _only_ consumer-facing write path
   for non-rule-driven column changes (`setColumns`, `reorderColumns`,
   `toggleColumnVisibility` — see `api/update-columns.ts`). Any redesign that makes `columns`
   read-only/computed needs an answer for these — they are legitimate imperative writes (a user
   clicking "hide column"), not the same problem as rule-driven reactivity. The gap here is
   specifically about _rule-driven_ writes triggered by `effect()`, not all mutation.

## Relevant files (for the research pass)

- `libs/shared/design-system/src/ui/table/api/column-rules.ts` — `applyVisible`,
  `applyVisibleAsync` (declaration only, no reactivity here today)
- `libs/shared/design-system/src/ui/table/api/features/with-columns-schema/wiring.ts` — the
  `effect()`-based reactivity this report is about
- `libs/shared/design-system/src/ui/table/api/features/with-columns-schema/feature.ts` — where
  wiring is invoked from `onInit`
- `libs/shared/design-system/src/ui/table/api/update-columns.ts` — the single imperative write
  path (`updateColumns()` → `.update()`), used by both rule wiring and direct consumer calls
- `libs/shared/design-system/src/ui/table/engine/core.ts` — confirms `columns`/`data` as
  `WritableSignal` single-source-of-truth invariant (no internal copy)
- `libs/shared/design-system/src/ui/table/engine/pipeline.ts` — existing precedent for a
  `computed()`-chain pipeline (rows, not columns) that this could potentially mirror
- Angular source, for the pattern being proposed as the fix:
  `packages/forms/signals/src/api/rules/validation/validate_async.ts` and sibling files under
  `packages/forms/signals/src/api/rules/validation/`

## Non-goals of this report

- Not proposing a specific implementation — that's the refactor ticket, after research.
- Not touching the demo consumer fix already applied (`table-demo.store.ts` now uses
  `applyVisibleAsync` instead of a hand-rolled `effect()`) — that fix is still strictly better
  than the status quo it replaced (consumer no longer writes its own effect), it just doesn't
  close this deeper gap.
