# ADR-0008 — Split `api/` into `api/`, `schema/`, `mutations/`

**Status:** accepted
**Date:** 2026-09-02
**Extends:** [ADR-0004](0004-table-source-layout.md) (the phase-grouping layout this ADR deepens)
**Related:** [ADR-0007](0007-feature-member-claims.md)

`api/` grew to 29 files, conflating four concerns: factory/entry, feature declarations, column
schema DSL, and mutation verbs — the same one-folder-absorbs-everything symptom ADR-0004 already
fixed once, recurring one level in. Column schema and mutation verbs are extracted into sibling
top-level folders, same phase-grouping principle as ADR-0004:

```
index.ts
api/            factory + declaration surface: create-table.ts, create-table.overloads.ts,
                create-table-feature.ts, types.ts
  features/     with-*.ts plugins — unchanged
schema/         column-schema.ts, column-schema.types.ts, column-metadata.ts, column-rules.ts
mutations/      row-mutations.ts, row-edit-mutations.ts, optimistic-mutations.ts,
                update-columns.ts
engine/         unchanged
directives/     unchanged
```

`api/` drops from 29 to ~13 files, matching the narrowness Angular Signal Forms keeps at the same
phase. Specs stay colocated with their source file in the new folders.

## Alternatives considered

| Option                                                                | Why not                                                                             |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Per-feature folders (TanStack style) for `schema/`/`mutations/` files | Files are still single-concern-sized; pre-splitting adds indirection with no payoff |
| Move specs to a non-colocated `test/`                                 | Locked invariant in table `CLAUDE.md`; not the source of the file-count problem     |
| Leave `api/` flat, just reorder/rename                                | Doesn't fix the conflated-concerns problem — file count would keep climbing         |

## Consequences

- `api/` answerable at a glance again (~13 files, one clear concern); `schema/` and `mutations/`
  each independently narrow, with an obvious home for new work.
- Import path rewrites across moved files and any doc referencing old paths
  (`docs/2-columns/reference/`, `docs/1-state/row-mutations.md`). Public export names unchanged.
