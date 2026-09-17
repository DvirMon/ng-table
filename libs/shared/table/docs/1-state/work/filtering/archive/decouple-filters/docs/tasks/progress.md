# Implementation Progress — decouple-filters (`#101`)

**Epic:** [#101](https://github.com/DvirMon/acme/issues/101)
**Status:** 13 / 13 complete

Three issues remain, one PR each, strictly sequential. Steps 1–5 were `#104` and have landed.

## `#104` — migrate every call site, split specs by ownership · ✅ merged (`6627b0c`)

| Step | Title | Type | Status | PR |
|---|---|---|---|---|
| 1 | [Migrate the five story hosts to the predicate list](step-1-migrate-story-hosts.plan.md) | `code` | ✅ done | `6627b0c` |
| 2 | [Move the criterion-map typing assertions into the filter model's own spec](step-2-move-criterion-map-typing.plan.md) | `test` | ✅ done | `6627b0c` |
| 3 | [Split `with-filtering.spec.ts` by ownership](step-3-split-feature-spec.plan.md) | `test` | ✅ done | `6627b0c` |
| 4 | [Cross-feature specs narrow with bare predicates](step-4-cross-feature-specs.plan.md) | `test` | ✅ done | `6627b0c` |
| 5 | [Update the prose that describes the old config shape](step-5-update-prose.plan.md) | `docs` | ✅ done | `6627b0c` |

## `#105` — delete the coupled surface + ADR-0016 · PR 1 of 3

| Step | Title | Type | Status | PR |
|---|---|---|---|---|
| 6 | [Migrate `create-filters.spec.ts` off `createFilterEvaluator(filters)`](step-6-migrate-evaluator-spec-to-matcher.plan.md) | `test` | ✅ done | `d59ab3e` |
| 7 | [Delete the coupled filtering surface and the filters side channel](step-7-delete-coupled-surface.plan.md) | `code` | ✅ done | `d59ab3e` |
| 8 | [ADR-0016: the filter model is the consumer's, the table takes a predicate list](step-8-adr-0016.plan.md) | `docs` | ✅ done | `d59ab3e` |

## `#106` — relocate the filters domain · PR 2 of 3

| Step | Title | Type | Status | PR |
|---|---|---|---|---|
| 9 | [Relocate the filters domain to its own top-level folder](step-9-relocate-filters-domain.plan.md) | `code` | ✅ done | `6b8e251` |
| 10 | [Give the filters domain its own barrel; the public barrel delegates to it](step-10-filters-barrel.plan.md) | `code` | ✅ done | `6b8e251` |

## `#107` — split the filtering docs by domain · PR 3 of 3

| Step | Title | Type | Status | PR |
|---|---|---|---|---|
| 11 | [Rewrite the feature's spec for the predicate list](step-11-feature-spec-predicate-list.plan.md) | `docs` | ✅ done | — |
| 12 | [Document the filter model's match contract](step-12-filters-spec-matcher-contract.plan.md) | `docs` | ✅ done | — |
| 13 | [Split the older workspace's pointers and regenerate the roll-up](step-13-split-pointers-regenerate.plan.md) | `chore` | ✅ done | — |

Status values: `⬚ pending`, `▶ in progress`, `✅ done`, `⏭ skipped`.

## Dependency graph

```
6 ──> 7 ──> 8
      │
      └──> 9 ──> 10 ──┬──> 11 ──┐
                      └──> 12 ──┴──> 13
```

- **Parallel-safe:** `[11, 12]` — two documents, two domains, no shared line.
- **Dependency:** `6 → 7` (the spec must stop calling `createFilterEvaluator(filters)` before that
  overload is deleted, so no revision of the branch fails to compile); `7 → 8` (the ADR records what
  shipped); `7 → 9` (independence in code precedes rearranging the layout to say so); `9 → 10` (the
  files must be in place before a barrel can define them); `10 → {11, 12}` (every doc path must be
  post-move, or it is written twice); `{11, 12} → 13` (the roll-up is generated from frontmatter the
  two doc steps own).
- **Frontier at start:** `[6]`.

## Notes carried from planning

- Steps 8 and 9 have no edge between them, but sit in different PRs and are listed in PR order.
  `#106` cannot open until `#105` merges.
- The architecture doc's own sequencing labels (`S1`–`S6`) do not line up with these step numbers.
  `S1`–`S3` shipped as `#102`–`#104`; this plan starts at its `S4`/`S5`/`S6`.
- **Step 6 is not mechanical.** `matcher()` returns a fresh evaluator per call, so the two
  per-filter error-dedup tests must hoist one `matcher()` result rather than inline it. A blind
  find-and-replace passes for the wrong reason.
- **Step 7 makes `predicates` required.** With `filters` gone it is the feature's only input. Every
  caller already passes it (verified in `#104`); a `tsc` error here means a caller was missed, and
  the fix is the caller, not re-widening the field.
- **Step 9 conflicts with anything in flight inside the domain.** Land it alone and rebase.
- `libs/shared/table/docs/status.md` and root `llms.txt` are generated. Never hand-edit; Step 13
  runs `npm run table:status` and `npm run llms`.
