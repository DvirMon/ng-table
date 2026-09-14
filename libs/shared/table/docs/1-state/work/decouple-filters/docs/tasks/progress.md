# Implementation Progress — Table: migrate every filtering call site to the predicate list, split specs by ownership

**Issue:** [#104](https://github.com/DvirMon/acme/issues/104)
**Epic:** [#101](https://github.com/DvirMon/acme/issues/101) · **Blocks:** #105
**Status:** 5 / 5 complete

| Step | Title | Type | Status | PR |
|---|---|---|---|---|
| 1 | [Migrate the five story hosts to the predicate list](step-1-migrate-story-hosts.plan.md) | `code` | ✅ done | — |
| 2 | [Move the criterion-map typing assertions into the filter model's own spec](step-2-move-criterion-map-typing.plan.md) | `test` | ✅ done | — |
| 3 | [Split `with-filtering.spec.ts` by ownership](step-3-split-feature-spec.plan.md) | `test` | ✅ done | — |
| 4 | [Cross-feature specs narrow with bare predicates](step-4-cross-feature-specs.plan.md) | `test` | ✅ done | — |
| 5 | [Update the prose that describes the old config shape](step-5-update-prose.plan.md) | `docs` | ✅ done | — |

Status values: `⬚ pending`, `▶ in progress`, `✅ done`, `⏭ skipped`.

## Dependency graph

```
Step 1 (story hosts) ──────────────────────> Step 5 (prose)

Step 2 (criterion-map typing) ─────────────> Step 3 (feature spec split)

Step 4 (cross-feature specs) ── no edges
```

- **Parallel-safe:** `[1, 2, 4]` — three independent entry points, no shared file between them.
- **Dependency:** `2 → 3` (the assertions must exist in `create-filters.spec.ts` before they are
  deleted from `with-filtering.spec.ts`, so no revision of the branch is missing them);
  `1 → 5` (prose is rewritten against the migrated hosts, not against the intention).
- **Frontier at start:** `[1, 2, 4]`.

## Notes carried from planning

- `#102` and `#103` have both landed. `predicates` already sits alongside `filters` in
  `WithFilteringConfig`, and `matcher()` already exists on the filters root.
- The plain-predicate story host (`stories/filtering/predicate-filtering/`) shipped with `#103`.
  This issue owns only the five pre-existing hosts.
- Two cases the issue describes as *moves* are already present in `create-filters.spec.ts` —
  OR-within-a-group (`:587`), empty-criterion skipping (`:575`), and row-type accept/reject
  (`:699`, `:709`). For those, Step 3 is a delete, not a copy. Only the criterion-map typing block
  is a genuine move (Step 2).
- The `filters` config field stays through this issue and is deleted by `#105` — the build is green
  at every step.
