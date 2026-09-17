# Replace `@ngrx/signals` with an in-house signal store engine

**Status:** ✅ landed 2026-08-11 — see [`2-decisions.md`](2-decisions.md) and
[ADR-0003](../../../../../adr/0003-in-house-table-store-engine.md)
**Created:** 2026-08-09
**Layer:** state (`createTable()`)

> Kept as the intake record. Four of its claims turned out to be wrong once tested against the
> code — spec files needed no migration, compile-time feature-input checking was not actually in
> force, the `withExpansion`-only prototype step was skipped, and `_buildRenderRows.current` was
> removed rather than preserved. `2-decisions.md` has the corrections; read it first.

## Summary

The table's state layer is built on `@ngrx/signals` (`signalStore`, `signalStoreFeature`,
`withState`/`withProps`/`withMethods`/`withComputed`/`withHooks`, `patchState`). This ticket
proposes replacing that engine with a small in-house composer built directly on Angular
signals, keeping the public API byte-for-byte identical.

This is an **internal migration, not a breaking API change** — see "The seam already exists"
below for why.

## Why — three drivers, in order of weight

### 1. Angular upgrades are gated on ngrx releases

`package.json` today:

```json
"@angular/core": "22.0.8",
"@ngrx/signals": "22.0.0-rc.0"
```

Stable Angular, pinned to a *release candidate* of ngrx, because a stable ngrx for this
Angular major wasn't available. This is the lock-step cost already being paid, not a
hypothetical. Every future Angular major repeats it.

### 2. Publishing as a primitive library

If this table ships as a standalone headless/primitive library, `@ngrx/signals` becomes a
peer dependency every consumer must install and keep version-aligned with both your release
and their Angular version. Competitors in this category (TanStack Table) ship zero runtime
dependencies. For a primitive, a state-management peer dep is a real adoption tax.

Only relevant if publishing is actually on the roadmap — **confirm this before starting.**
If publishing is off the table, driver 1 alone still stands but the urgency drops a lot.

### 3. (Bonus, not a driver) Consumers must repeat `<TRow>` on every feature

```ts
createTableSchema(columns, {
  features: [withExpansion<Department>(), withSorting<Department>()],
});
```

`Department` is already known to `createTableSchema` but cannot flow into the feature calls.
Dropping ngrx fixes this for free. **Do not treat this as the reason for the work** — it is a
side effect. Full analysis in [`../../architecture.md`](../../../../architecture.md), section
"Rejected: inferring `TRow` into `with-*()` calls".

## Already settled — do not re-investigate

Tested 2026-08-09 against the real code, both reverted afterwards. The repo is clean of these
experiments.

- **Tightening `TableStoreConfig`'s `Features` constraint so `TRow` flows from one call
  site: does not work.** Two carrier shapes tried. `TableStore<TRow>` fails assignability
  (features accept ngrx's `InnerSignalStore`, and parameters are contravariant, so the
  constraint rejected even the annotated `withSorting<Person>()` that compiles today).
  Reshaping the carrier to mimic `InnerSignalStore` then fails on
  `Property '[STATE_SOURCE]' is missing` — ngrx brands its store with a unique symbol.
- **The decisive finding, independent of assignability:** even with a carrier in place, the
  unannotated `withExpansion()` still resolved to `Signal<unknown[]>`. `SignalStoreFeature`'s
  parameter is a conditional/mapped type, and TypeScript does not infer through those. There
  is no inference site for `TRow` to land in, for *any* carrier shape. This is the root cause
  the present ticket removes.
- **Constraint-as-contextual-type is a sound TS mechanism** — verified in isolation with
  exact-type assertions and negative cases. It is not the thing that's broken; ngrx's types
  are. Relevant because it means the in-house engine can rely on it.

## The seam already exists

Three facts make this migration internal-only:

1. `TableStore<TRow>` ([`api/types.ts`](../../../../../../src/api/types.ts)) is already
   ngrx-free by design — its doc comment states swapping the state-management
   implementation must not be a breaking change.
2. `buildStoreClass()` ([`engine/core.ts`](../../../../../../src/engine/core.ts)) already ends in
   `signalStore(composedFeature) as unknown as Type<TableStore<TRow> & ComposedFeatureMembers<Features>>`.
   That cast is the boundary — the public return type is computed independently of ngrx.
3. `ComposedFeatureMembers` reads `{ stateSignals, props, methods }` **structurally**. An
   in-house engine producing that same shape keeps every derived consumer type identical.

Consequence: demo apps, directives, templates, and consumer call sites do not change. The one
group that would break is anyone who wrote a custom feature against ngrx types — inside this
repo, nobody has.

## Current ngrx surface — full inventory

Four non-spec files import `@ngrx/signals`:

| File | What it uses |
|---|---|
| `table.store.ts` | `signalStore`, `signalStoreFeature`, `withState`, `withProps`, `withMethods`, `withComputed`, `patchState`, `SignalStoreFeature` |
| `with-expansion.ts` | `signalStoreFeature`, `withState`, `withProps`, `withMethods`, `patchState`, `type` |
| `with-sorting.ts` | same shape as expansion |
| `with-columns-schema.ts` | same shape, plus `withHooks` |

Occurrence counts across non-spec files: `signalStoreFeature` 14, `patchState` 13,
`withState`/`withProps`/`withMethods` 6 each, `signalStore` 4, `withHooks`/`withComputed` 3
each. (`type` greps at 83 but that's mostly the TS keyword — treat it as unmeasured.)

Spec files also use these and will need the same treatment.

## What to build

A minimal composer over Angular signals providing:

- A state container backed by `signal()`, with the members exposed as readonly signals.
- An immutable patch function (`patchState` equivalent) accepting both an object and an
  updater function — see existing call sites in `table.store.ts:115-145` for the required
  shapes.
- A fold that merges each feature's contributed `{ stateSignals, props, methods }` into one
  object, preserving the existing structural shape.
- Lifecycle hooks (`onInit`/`onDestroy` equivalent) — currently used by
  `with-columns-schema.ts`.
- Dynamic-length feature composition. Note `table.store.ts:167-189` documents that
  `signalStore()` has no array/rest overload, forcing a runtime `reduce`. An in-house engine
  can be designed array-first and drop that workaround.

Two existing behaviors are load-bearing and easy to miss:

- **`_buildRenderRows` is a nested container (`.current`), not a bare function property.**
  The comment at `table.store.ts:105-113` explains why: ngrx hands each feature factory a
  shallow copy of the accumulated store, so a top-level reassignment wouldn't reach the
  instance that `renderRows` closes over. If the in-house engine does not shallow-copy, this
  indirection may become unnecessary — **verify before removing it**, and update the comment
  either way.
- **Fixed pipeline order** (`filter → group → sort → expand`) is independent of `features`
  array order — `table.store.ts:146-159`. Must be preserved exactly.

## What is given up

- **Compile-time feature-input checking.** `type<{ rows, trackBy, _buildRenderRows }>()`
  currently makes ngrx verify at composition time that a feature's required props exist.
  This must be re-implemented or lost. It is simpler to rebuild than ngrx's version (you
  control both ends), but it is the single piece most likely to be underestimated — scope it
  explicitly rather than discovering it late.
- Battle-tested edge cases in state merging and teardown, now owned in-house.
- Ecosystem familiarity for outside contributors.

Not lost: `rxMethod` is unused here, and `@ngrx/signals` has no official DevTools integration
to forfeit.

## Constraints — locked invariants that still apply

From [`../../../../CLAUDE.md`](../../../../../../CLAUDE.md), unchanged by this work:

- `createTable()` returns an **instance**, not a class.
- Features compose via the `features` **array** in config — no `.pipe()` chaining, no builder
  pattern.
- `rows()` never returns wrapper objects.
- Private members use `_` prefix and are stripped from public types by `OmitPrivate`.

## Open questions — resolve before implementing

1. **Is publishing as a standalone library actually planned?** Determines whether driver 2
   counts, and therefore the urgency and the timing.
2. **Rebuild compile-time feature-input checking, or drop it?** Affects scope materially.
3. **Does this need its own ADR?** It's an architecture decision with independent
   justification, currently documented only as this ticket plus a rejected-alternatives
   section in `1-state/architecture.md`.

Ask these one at a time and record each answer here before moving on.

## Suggested sequencing

1. Confirm the open questions above.
2. Prototype the engine against `withExpansion()` **only**, leaving the other features on
   ngrx, to get a real cost number instead of an estimate. `withExpansion` is the right probe
   — it is standalone with no feature dependencies.
3. If the number is acceptable: migrate `table.store.ts` core, then `with-sorting.ts`, then
   `with-columns-schema.ts` (most complex — it's the one using `withHooks` and a narrower
   feature input).
4. Migrate spec files alongside each feature.
5. Drop `@ngrx/signals` from `package.json`.
6. Land the `TRow` inference improvement as a **separate follow-up** — it is now possible but
   is a distinct, consumer-visible change. Update the rejected-alternatives section in
   `1-state/architecture.md` and the `AnyTableFeature` comment in `table.types.ts` when it
   does.

Timing note: every new `with-*()` feature added before this migration is another file to
rewrite during it.

## Definition of done

- No `@ngrx/signals` import anywhere under `src/ui/table/`, spec files included.
- `@ngrx/signals` removed from `package.json`.
- `npx tsc -p apps/demo/tsconfig.app.json --noEmit` clean.
- Existing table specs pass unmodified in behavior (rewritten in mechanism only).
- Demo apps under `apps/demo/src/app/table-*-demo/` unchanged — if any consumer file needed
  edits, the seam leaked and that is a finding worth reporting.
