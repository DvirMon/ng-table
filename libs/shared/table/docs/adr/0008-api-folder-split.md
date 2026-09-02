# ADR-0008 — Split `api/` into `api/`, `schema/`, `mutations/`

**Status:** accepted
**Date:** 2026-09-02
**Extends:** [ADR-0004](0004-table-source-layout.md) (the phase-grouping layout this ADR deepens)
**Related:** [ADR-0007](0007-feature-member-claims.md)

## Context

ADR-0004 grouped source by lifecycle phase (`api/` / `engine/` / `directives/`) to fix a flat
17-file `src/ui/table/`. The roadmap since then landed inside `api/` itself: it now holds 29
files (15 top-level + `features/` with 9, one further split as `with-columns-schema/`).

`api/` conflates four distinct concerns:

1. **Factory/entry** — `create-table.ts`, `table-schema.ts`, `create-table-feature.ts`, `types.ts`
2. **Feature declarations** — `features/with-*.ts` (already correctly scoped, unaffected)
3. **Column schema DSL** — `column-schema.ts`, `column-schema.types.ts`, `column-metadata.ts`,
   `column-rules.ts`
4. **Mutation verbs** — `row-mutations.ts`, `row-edit-mutations.ts`, `optimistic-mutations.ts`,
   `update-columns.ts`

This is the same symptom ADR-0004 fixed (one folder absorbing unrelated concerns), recurring one
level in.

## Research

Re-checked Angular Signal Forms (`packages/forms/signals/src`) — the layout ADR-0004 modeled —
at its **current** state, not just what ADR-0004 quoted. Its `api/` stayed narrow (8 items:
`assertions.ts`, `control.ts`, `di.ts`, `structure.ts`, `symbols.ts`, `transformed_value.ts`,
`types.ts`, `rules/`) because sibling concerns got their **own top-level folder** —
`field/`, `schema/`, `controls/`, `directive/`, `compat/`, `util/`, `webmcp/` — instead of piling
into `api/`.

TanStack Table v9 (`packages/table-core/src`) re-checked too: `features/` gives every feature,
even small ones, its own folder split five ways (`.ts` / `.types.ts` / `.utils.ts` / row-model /
fns). ADR-0004 already rejected this for our `with-*.ts` files ("pre-splits 150-line features")
— still correct; not revisited here.

## Decision

Extract concerns 3 and 4 above into sibling top-level folders, same phase-grouping principle one
level deeper:

```
index.ts
api/            factory + declaration surface: create-table.ts, table-schema.ts,
                create-table-feature.ts, types.ts
  features/     with-*.ts plugins — unchanged
schema/         column-schema.ts, column-schema.types.ts, column-metadata.ts, column-rules.ts
mutations/      row-mutations.ts, row-edit-mutations.ts, optimistic-mutations.ts,
                update-columns.ts
engine/         unchanged
directives/     unchanged
```

`api/` drops from 29 to ~13 files, matching Angular's ~8-item narrowness at that phase.

Specs stay colocated with their source file in the new folders — table's `CLAUDE.md` mandates
colocated tests; this ADR does not touch that.

## Alternatives considered

| Option | Why not |
|---|---|
| Per-feature folders (TanStack style) for `schema/`/`mutations/` files | Files are still single-concern-sized (largest is a few KB); pre-splitting adds indirection with no payoff, same reasoning ADR-0004 used against it |
| Move specs to a non-colocated `test/` | Locked invariant in table `CLAUDE.md`; not the source of the file-count problem |
| Leave `api/` flat, just reorder/rename | Doesn't fix the conflated-concerns problem — file count would keep climbing as `with-columns-schema/`-style features get added |

## Consequences

**Gained**
- `api/` answerable at a glance again (~13 files, one clear concern: factory + declarations).
- `schema/` and `mutations/` each independently narrow; new column-schema or mutation-verb
  work has an obvious home instead of defaulting into `api/`.

**Cost**
- Import path rewrites across `api/column-schema.ts` → `schema/column-schema.ts` etc. and any
  doc referencing old paths (`docs/2-columns/reference/`, `docs/1-state/row-mutations.md`).
- `index.ts` barrel re-export paths update; public export names unchanged.

**Verification plan**
- `npx tsc -p apps/demo/tsconfig.app.json --noEmit` clean.
- Full table spec suite passes with import-line-only diffs (same acceptance gate ADR-0004 used).
- `git diff main -- apps/demo` empty — no consumer-visible change.
