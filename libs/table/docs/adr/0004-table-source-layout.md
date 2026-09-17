# ADR-0004 — Table source layout: folders by lifecycle phase

**Status:** accepted
**Date:** 2026-08-11
**Supersedes:** the flat-file layout described in `src/ui/table/CLAUDE.md` before this date
**Related:** [ADR-0003](0003-in-house-table-store-engine.md) (the engine this layout organizes)

## Context

ADR-0003 landed the in-house `composeTable()` engine and left `src/ui/table/` at 17 flat source
files. The roadmap adds ~9 more `with-*()` features and ~6 more directives — roughly 34 flat
files. Two concrete defects were already visible, independent of the file count:

1. **`PIPELINE_ORDER` was declared twice.** The `as const` array lived in `table.engine.ts`; the
   matching optional keys lived in `PipelineStages` in `table.pipeline.ts`. Adding a stage to the
   interface and forgetting the array produced a stage that features could declare and the engine
   would **silently never execute** — no compile error, no failing test.
2. **`composeTable()` was 135 lines doing four jobs.** The column logic inside it was pure
   `ColumnDef[] → ColumnDef[]` work trapped behind signal closures, reachable only through a live
   store, so none of it was unit-testable.

## Decision

Adopt the layout Angular's Signal Forms package uses (`packages/forms/signals/src`): **group by
lifecycle phase, not by feature.**

```
index.ts        the ONLY definition of the public surface — no other barrels
api/            everything a consumer touches   (Angular's api/)
  features/     one file per opt-in feature      (Angular's api/rules/)
engine/         the runtime                      (Angular's field/ + schema/)
directives/     UI layer                         (Angular's directive/)
```

Angular splits one concept across phases rather than co-locating it: `api/structure.ts` declares
`schema()`, `schema/logic_node.ts` compiles it, `field/validation.ts` runs it. The table's engine
already had those phases — a feature **declares** a `TableFeatureSpec`, `composeTable()` **folds**
it, the computeds **run** it — so the mapping was direct. `api/features/with-columns-schema/`
follows the same split internally: `resolve.ts` (compile) → `wiring.ts` (run) → `feature.ts`
(declare).

Alongside the move, three code changes that the move made obvious:

- **`PipelineStages` is now derived from `PIPELINE_ORDER`**
  (`Partial<Record<PipelineStage, RowTransform<TRow>>>`). One declaration; adding a stage is a
  one-line edit and a typed stage is guaranteed to execute. `runPipeline()` is pure.
- **`engine/columns.ts` and `engine/rows.ts`** hold the pure transforms lifted out of
  `composeTable()`'s core object literal. `engine/slots.ts` owns every collision message.
- **`composeTable()` is ~70 lines** — folding features and wiring hooks, nothing else.
  Construction moved to `engine/core.ts`.

## Alternatives considered

| Option | Why not |
|---|---|
| **Stay flat** (NgRx signals ships 18 flat files, `signal-store.ts` at 49 KB) | Works at NgRx's scale, but the double-declared `PIPELINE_ORDER` and the untestable column logic are defects at any file count, and the roadmap doubles the file count |
| **TanStack Table v9** — `core/` + `features/<name>/`, each feature split five ways (`.ts` / `.types.ts` / `.utils.ts` / row-model / fns) | Pre-splits features that are 150 lines. Angular's own `api/rules/disabled.ts` is 3 KB in one file; only the rule that outgrew a file (`validation/`) got a folder. We follow that: `with-sorting.ts` and `with-expansion.ts` stay single files |
| **TanStack's pipeline model** — no order constant; each stage reads a named `getPreSortedRowModel()` predecessor | Forces every feature to know its neighbours, the opposite of the declare-don't-mutate model ADR-0003 chose |
| **Folders named for the doc streams** (`state/`, `columns/`, `3-ui/`) | Stronger internal consistency with `docs/`, but diverges from the layout another developer or agent would recognize |

AG Grid was checked as a third reference: it has the same ordered stage constant
(`ClientSideRowModelSteps`) with each stage a class implementing `IRowNodeStage`. That confirmed
an ordered constant is normal — the fix was to derive everything from one declaration, not to
remove it.

## Deliberately not adopted from Angular

- **snake_case** (`logic_node.ts`) — Angular framework-internal convention.
  `.claude/rules/file-organization.md` governs this repo; kebab-case stays.
- **A non-colocated `test/` folder** — the table's `CLAUDE.md` mandates colocated specs.
- **A `util/` folder** — Angular's holds genuinely shared leaf helpers (`array.ts`, `parser.ts`).
  Ours would hold feature-specific logic used by exactly one caller. Not creating a ceremonial
  empty folder; revisit when something is actually shared.
- **Per-folder barrels** — `api/`, `engine/` and `directives/` have none. `index.ts` is the single
  explicit public surface (Angular's `public_api.ts` role). Unused barrels are dead code, and two
  places defining the surface is how it drifts. See the 2026-09 amendment below: the rule is one
  barrel per *domain*, and a folder is not a domain.

## Consequences

**Gained**

- Adding a pipeline stage is one edit. The silent-skip bug class is gone.
- `engine/pipeline.ts`, `engine/columns.ts`, `engine/rows.ts`, `engine/slots.ts` are pure — 17 new
  tests run with plain `vitest`, no `TestBed`, no injection context.
- Where a new feature goes is answerable without reading the folder.

**Cost**

- ~50 relative imports rewritten; every doc referencing a source filename updated.
- One more hop to read the engine end to end (six files instead of one).
- `api/types.ts` ↔ `engine/types.ts` is a type-only import cycle. It existed before the move and
  is harmless, but both sides must stay `import type` forever.

**Verified**

- `npx tsc -p apps/demo/tsconfig.app.json --noEmit` — clean.
- 90 tests / 11 files pass (was 73 / 8). All 7 pre-existing spec files changed **import lines
  only** — no assertion edits, the same acceptance gate ADR-0003 used.
- `git diff main -- apps/demo` empty. The public export list in `index.ts` is unchanged name for
  name; only paths moved.

## Amendment (2026-09, #72): one barrel per domain, and `filters/` is a domain

`filters/` is now a top-level sibling of `api/`, `engine/` and `directives/`, and it has its own
`index.ts`. That is not a per-folder barrel, and it is not a retraction of the rule above.

The rejection stands on "two places defining the surface is how it drifts". That argument bites
when two files define *the same* surface. `filters/index.ts` defines a different one: the
`createFilters()` domain is usable with no table at all, has no import edge to the table in either
direction ([ADR-0016](0016-filtering-takes-a-predicate-list.md)), and in server mode ships to
consumers who compose no filtering feature. Its surface is its own, so it is defined once, in the
domain that owns it. `src/index.ts` re-exports it wholesale with `export * from './filters'` — one
hand-maintained list, not two.

Restated, the invariant is: **one barrel per domain, not one per folder, and not one per repo.**
`api/`, `schema/`, `mutations/`, `engine/` and `directives/` are phases of the table's own domain,
so they keep having none — anything under them not listed in `src/index.ts` is internal.
`filters/` is a second domain, so it has exactly one of its own — anything under it not listed in
`src/filters/index.ts` is internal, which is what makes `evaluator.ts`, `recorder.ts`, `state.ts`
and `validate.ts` enforceably private.

The test for a future folder is therefore not size but independence: could it be consumed without
the table, and does it import nothing from it? If not, it is a phase and gets no barrel. Extracting
`filters/` to its own package is now a move rather than a rewrite; do that when a second consumer
exists, not before.
