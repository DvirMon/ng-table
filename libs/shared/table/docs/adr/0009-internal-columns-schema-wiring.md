# ADR-0009 — `withColumnsSchemaAsync` is not a `with*()` plugin: rename and relocate

**Status:** accepted
**Date:** 2026-09-02
**Related:** [ADR-0004](0004-table-source-layout.md), [ADR-0008](0008-api-folder-split.md),
[ADR-0007](0007-feature-member-claims.md)

## Context

`api/features/with-columns-schema/` sits alongside `with-sorting.ts`, `with-expansion.ts`,
`with-optimistic.ts`, `with-row-edit.ts` — the four real opt-in plugins a consumer places in
`createTable()`'s `features: [...]` array and that `index.ts` exports.

`withColumnsSchemaAsync` is neither:

- **Not exported from `index.ts`.** Only its supporting types (`ColumnsSchemaFn`) are public.
- **Not consumer-invoked.** `api/create-table.ts:68` always splices it into the fold —
  `docs/2-columns/architecture.md:270`: *"one new composed feature (`withColumnsSchemaAsync`)
  always spliced into `coreFeature`"*.
- **Contributes nothing to the public contract.** Returns `EmptyFeatureResult` — invisible to
  `ComposedFeatureMembers<Features>`, `docs/2-columns/architecture.md:284-286` compares its
  invisibility to internal engine state (`_pipeline`, `_sortChangedSource`).
- **Flagged in its own docstring**: `feature.ts:29` — *"Auto-composed by `createTable()`, unlike
  every other `with-*()` feature."* The design doc already knew; the naming never caught up.

Root cause: `withHooks`/`withState`/`withMethods` were `@ngrx/signals` composition primitives
from before ADR-0003 removed that dependency. `withColumnsSchemaAsync` was named to match that
internal-composition convention at the time it was designed (`docs/2-columns/architecture.md`
predates ADR-0003's rewrite in places). ADR-0003 replaced the engine underneath it, but this one
name survived and now collides with the unrelated, later `with*()` = "public opt-in plugin"
convention that the real features established.

This is a real API-surface defect, not folder hygiene: a maintainer skimming `api/features/`
sees five `with*` names and reasonably assumes five composable plugins. One of them will throw
`SlotRegistry` conflicts or silently no-op if a consumer ever tries to pass it into `features:
[...]` directly — because its `(rules) => (core) => spec` factory shape doesn't match the config
shape (`Config = {}`) every real `with*()` plugin takes, and it needs the internally-resolved
`rules` array `create-table.ts` produces, not something a consumer has in hand.

## Decision

1. **Rename** `withColumnsSchemaAsync` → `wireColumnsSchemaAsync`. `wire*` names an
   always-on internal composition step; `with*` is reserved for consumer-facing opt-in plugins
   from here on.
2. **Rename** `feature.ts` → `wire-columns-schema.ts` (matches the function it now exports).
3. **Relocate** the whole folder: `api/features/with-columns-schema/` → `engine/columns-schema/`.
   `engine/` already means "the runtime; nothing here is exported" (`CLAUDE.md`) — the correct
   home for an always-spliced, non-exported composition step, not `api/features/` which is
   reserved for the public plugin contract.
4. Internal phase split inside the folder is unchanged: `resolve.ts` (compile —
   `resolveColumnsConfig()`) → `wiring.ts` (run — the metadata-entry builders) →
   `wire-columns-schema.ts` (declare — the `TableFeatureSpec` factory). `index.ts` stays as the
   folder-local barrel for this one multi-file unit (not a violation of "no per-folder barrels in
   `api/`/`engine/`/`directives/`" — that rule is about the *top-level* phase folders having a
   single surface via the package `index.ts`; a feature that outgrew one file still needs one
   local list of what it exports to its two internal callers).
5. Update the two call sites: `api/create-table.ts` (`resolveColumnsConfig` +
   `wireColumnsSchemaAsync`) and the two `schema/*.spec.ts` files that import
   `resolveColumnsConfig` for direct testing.

## Alternatives considered

| Option | Why not |
|---|---|
| Rename only, leave folder in `api/features/` | Folder location is the stronger signal a maintainer scans first; leaving it there keeps implying "opt-in plugin" regardless of the function name |
| Move only, keep `with*` name | Name is the part that actively misleads (matches the public convention letter-for-letter); moving without renaming just relocates the same trap |
| Delete the phase split, flatten into one file | Not this ADR's problem — the file outgrew flat for real reasons (ADR-0004); scope is naming/location only |

## Consequences

**Gained**
- `api/features/` now contains exactly the four consumer-facing plugins — the `with*` prefix
  is trustworthy again as "safe to pass into `features: [...]`."
- `engine/` correctly owns every always-on, non-exported composition step.

**Cost**
- ~6 import sites updated (`create-table.ts`, 2 schema specs, the folder's own internal
  cross-file imports unaffected since they're relative and move together).
- `docs/2-columns/architecture.md` and `CLAUDE.md` file-layout table need the new name/path.

**Verification plan**
- `npx tsc -p apps/demo/tsconfig.app.json --noEmit` clean.
- Full table spec suite passes, import-line-only diffs on the two schema spec files.
