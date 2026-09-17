# ADR-0010 — Don't borrow Angular lifecycle/composition names for engine-only concepts

**Status:** accepted
**Date:** 2026-09-02
**Related:** [ADR-0003](0003-in-house-table-store-engine.md) (introduced `onInit`),
[ADR-0004](0004-table-source-layout.md), [ADR-0008](0008-api-folder-split.md),
[ADR-0007](0007-feature-member-claims.md)

## Context

Two names in the engine borrow Angular vocabulary for concepts that don't mean what that
vocabulary means in Angular. Both trace back to the same root cause: `withHooks`/`withState`/
`withMethods` were `@ngrx/signals` composition primitives used before ADR-0003 replaced that
dependency with the in-house engine. Names chosen to match that convention at design time
outlived the rewrite underneath them.

### 1. `withColumnsSchemaAsync`

Sits in `api/features/with-columns-schema/` alongside the four real opt-in plugins
(`withSorting`, `withExpansion`, `withOptimistic`, `withRowEdit`) that consumers pass as
trailing arguments to `createTable()` and that `index.ts` exports. It is neither:

- **Not exported from `index.ts`** — only its supporting types are public.
- **Not consumer-invoked** — `api/create-table.ts` always splices it into the fold
  (`docs/2-columns/architecture.md`: *"one new composed feature always spliced into
  `coreFeature`"*).
- **Contributes nothing to the public contract** — it declares no members, so it adds nothing
  to the accumulating `Feature<In, Out>` fold; same invisibility class as internal engine state.
- **Flagged in its own docstring** before this ADR: *"Auto-composed by `createTable()`, unlike
  every other `with-*()` feature."* The design doc already knew; the naming never caught up.

A maintainer skimming `api/features/` reasonably assumes five composable plugins. One of them
doesn't match the `Config = {}` shape every real `with*()` plugin takes and needs internally
resolved rules a consumer never has in hand — a real defect, not folder hygiene.

### 2. `onInit`

`TableFeatureSpec.onInit` (`engine/types.ts`) is collected by `composeTable()` and run once,
synchronously, right after every feature is folded — still inside the same construction call as
`createTable()` itself (`engine/compose-table.ts`: *"Must run inside an Angular injection
context: `onInit` hooks create `effect()`/`resource()`"*).

Angular's own `ngOnInit` means something specific and different: a method Angular itself calls
on a class it instantiates and tracks as a component/directive/pipe in its view tree, firing
after inputs are bound and after the first change-detection pass. `createTable()` returns a
plain object from a factory function — Angular's change-detection machinery never calls
anything on it, regardless of what a property is named. Our `onInit` is really "run once, after
composition, still synchronously inside the constructing call" — a construction-time hook, not
a lifecycle-phase hook.

By contrast, `TableFeatureSpec.onDestroy` is **not** a naming problem: it's a real delegation to
`inject(DestroyRef).onDestroy(callback)` (`engine/compose-table.ts`), an actual Angular
primitive that does exactly what the name says.

## Decision

1. **Rename** `withColumnsSchemaAsync` → `wireColumnsSchemaAsync`. `wire*` names an always-on
   internal composition step; `with*` is reserved for consumer-facing opt-in plugins.
2. **Relocate** `api/features/with-columns-schema/` → `engine/columns-schema/`. `engine/` already
   means "the runtime; nothing here is exported" (`CLAUDE.md`) — the correct home for an
   always-spliced, non-exported composition step, not `api/features/`.
3. **Rename** `feature.ts` → `wire-columns-schema.ts` inside that folder (matches the function it
   exports); `resolve.ts` (compile) → `wiring.ts` (run) → `wire-columns-schema.ts` (declare) keeps
   the existing internal phase split.
4. **Rename** `TableFeatureSpec.onInit` → `setup`, and `FeatureHooks.onInit` /
   `composeTable()`'s internal `hooks.onInit` collection to match. Named for *what it does*
   (construction-time setup), not *when* in a lifecycle it fires — sidesteps borrowing Angular
   vocabulary at all.
5. **Keep** `onDestroy` as-is — it's correctly named because it's a direct pass-through to a real
   `DestroyRef.onDestroy` call.

## Alternatives considered

| Option | Why not |
|---|---|
| Rename `withColumnsSchemaAsync` only, leave folder in `api/features/` | Folder location is the stronger signal a maintainer scans first; leaving it there keeps implying "opt-in plugin" regardless of the function name |
| Move folder only, keep `with*` name | Name is the part that actively misleads (matches the public convention letter-for-letter); moving without renaming just relocates the same trap |
| Give `setup` a phase-timing name (`onConstruct`, `afterCompose`) | Considered and rejected in discussion — naming it for *when* it runs is exactly the pattern that caused the `onInit` collision in the first place; naming for *what it does* doesn't collide with any Angular vocabulary |
| Rename by editing ADR-0003 (which introduced `onInit`) | ADR-0003 is `accepted` and already shipped/verified — editing it rewrites a historical record. This is a new decision for a reason ADR-0003 never considered, so it gets its own ADR, same as ADR-0005 superseded a specific point in ADR-0004 without editing it |

## Consequences

**Gained**
- `api/features/` contains exactly the consumer-facing plugins — `with*` is trustworthy
  again as "safe to pass as a `createTable()` feature argument."
- `engine/` correctly owns every always-on, non-exported composition step.
- `TableFeatureSpec`'s hook names no longer imply Angular component-lifecycle timing that
  `createTable()` — a plain factory, not a class Angular instantiates — cannot actually provide.

**Cost**
- Renamed across `engine/types.ts`, `engine/compose-table.ts`, `engine/compose-table.spec.ts`,
  `api/types.ts`, `api/create-table.ts`, `api/features/with-row-edit.ts`, and the moved
  `engine/columns-schema/` folder (5 files) — import-line and identifier-only diffs, no behavior
  change.
- `CLAUDE.md` and `docs/2-columns/architecture.md` updated to the new names/paths. ADR-0003 and
  ADR-0006 (which used `onInit` in their own historical descriptions) are left untouched —
  accurate records of what was decided at the time, not live specs.

**Verification plan**
- `npx tsc -p apps/demo/tsconfig.app.json --noEmit` clean.
- Full table spec suite passes.
- `git diff main -- apps/demo` empty — no consumer-visible change (neither renamed symbol was
  ever part of the public `index.ts` barrel).
