# Correctness pass over `libs/table/src` — 2026-09-24

Four parallel read-only reviewers over the library source
(~8.9k lines excluding `*.spec.ts` and `stories/`). Criteria were the
repo's own invariants: `libs/table/CLAUDE.md`, ADR-0006, ADR-0007,
ADR-0011, ADR-0014 (incl. its 2026-09-24 amendment), ADR-0023.

| Area                                                                          | File                                                                               |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `engine/**`                                                                   | [findings-engine.md](findings-engine.md)                                           |
| `api/` core, `compose-features`, `with-computed`, `editing/state`, `index.ts` | [findings-api-core.md](findings-api-core.md)                                       |
| `api/features/with-*`                                                         | [findings-features.md](findings-features.md)                                       |
| `columns-schema/`, `schema/`, `mutations/`, `directives/`                     | [findings-schema-mutations-directives.md](findings-schema-mutations-directives.md) |

**Confidence.** Every finding carries `file:line` and a constructible
failure scenario, and each was read from source rather than inferred.
None has been re-verified by a second reviewer or by running anything —
no builds or tests were run, per the repo's manual-run rule. Treat the
severity order as a triage proposal, not a verdict.

**Relationship to the conflict audit.** This pass is separate from
`docs/1-state/work/core/active/single-value-source/conflicts-vs-unshipped.md`,
which compared #129's decisions against unshipped nodes and deliberately
did not look for bugs. Two findings here bear on rulings taken that day
and are marked inline.

---

## Consolidated findings

Deduplicated across reviewers; the same defect found twice is listed
once with both citations.

### Tier 1 — a consumer callback throws and the whole table goes blank

The single largest cluster, and all one shape: ADR-0014 says a consumer
callback must never take the table down, and these are unwrapped.

|     | Defect                                                                                                                        | Where                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| C1  | `FilterOptions.when` / `source` / `gateByCondition`'s condition unguarded                                                     | engine §1 — `filters/evaluator.ts:107`, `filters/state.ts:59,98`       |
| C2  | `applyGroupKey`'s `extractValue` unguarded — the one grouping callback of five that is                                        | engine §2 = features F1 — `grouping/clusters.ts:133`                   |
| C3  | `rule.logic` / `params` / `onSuccess` / `onError` unguarded inside the `columns` computed                                     | engine §3 = features F3/F4 — `columns-schema/wiring.ts:44-48,62,70,72` |
| C4  | `enableRowSelection` / `enableMultiRowSelection` unguarded, and `isSelectable` is a public member read per row from templates | features F2 — `with-selection/feature.ts:64-65,80,90`                  |

C3's `onError` is the nastiest: it runs only when a request already
failed, so it turns a handled fetch error into a dead table.

### Tier 2 — wrong data, no error

|     | Defect                                                                                                                                                            | Where                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| C5  | `foldColumnRules` replaces an author-declared `column.meta` instead of merging — but only when some _other_ key on that column has a rule                         | engine §9 = schema F3 — `engine/columns.ts:176`           |
| C6  | `setColumns()` with a duplicate id corrupts cells in production, because the duplicate check is already dev-only and `setColumns` is a runtime write path         | schema F1 — `mutations/update-columns.ts:17`              |
| C7  | `reorderColumns()` with a partial id list collides order values; the dragged column silently does not move                                                        | schema F2 — `engine/columns.ts:65-74`                     |
| C8  | `detectComparator`'s numeric branch returns `NaN` for one non-numeric cell, which `sort` coerces to `0` — silently mis-ordered                                    | features F7 — `with-sorting.ts:79,84-86`                  |
| C9  | `removeEdit` keeps a stale `at`, so a reverted delete re-inserts the row at the wrong index                                                                       | api-core §4 — `mutations/optimistic-mutations.ts:142-152` |
| C10 | `maskGroupingLevels` returns early on an abstaining rule, leaving later rules untracked, so grouping never recomputes when they resolve                           | engine §7 — `grouping/rules.ts:121`                       |
| C11 | `columnRules` pushed after the first read of `columns()` never apply — and `withGrouping` reads `columns()` eagerly at factory time, so argument order decides it | engine §5 — `engine/core.ts:43`                           |
| C12 | the `expanded` computed can evaluate with zero dependencies and freeze at `undefined` for the table's lifetime, permanently disabling collapse                    | engine §6 — `engine/core.ts:59-70`                        |
| C13 | `resolveIndex` reads `rows[at]` unbounded; composing two row updaters in one write throws                                                                         | engine §4 — `engine/rows.ts:46`                           |

C11, C12 and C13 are latent — no shipped combination triggers them
today — but each is reachable through public API.

### Tier 3 — unbounded growth and retention

|     | Defect                                                                                                                          | Where                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| C14 | synthesized `group:` ids enter `expandedRows` but are never in `indexById`, so ADR-0006 pruning structurally cannot reach them  | engine §8 = features F8 — `compose-table.ts:212-224` |
| C15 | `withSorting()` never completes `sortChanged`; every sibling feature completes its Subject                                      | features F5 — `with-sorting.ts:201,225`              |
| C16 | `NgpTableRowDirective` registers in an `effect()` with no `onCleanup`, relying on a `track` the consumer is never told to write | schema F5 — `ngp-table-row.directive.ts:48-54`       |

C14 also contradicts ADR-0006's stated consequence: re-add a deleted id
and a group returns pre-expanded.

### Tier 4 — the types say something the runtime does not

|     | Defect                                                                                                                                                                                | Where                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| C17 | `withComputed` returns `D`, so a returned `WritableSignal` stays typed writable while the runtime hands back a `computed` — `.set()` compiles, then throws                            | api-core §1 — `with-computed.ts:48-55`                  |
| C18 | a block returning a non-object throws a bare `TypeError` outside the `[createTable]` construction message the ADR names                                                               | api-core §2 — `with-computed.ts:17`                     |
| C19 | `withSelection` classifies a data-dependent predicate conflict as construction-class and throws at runtime, though the adjacent `previousIds` path already defines a degraded reading | features F6 — `with-selection/feature.ts:96-97,111-121` |

### Tier 5 — conformance and stale documentation

|     | Item                                                                                                                                                           | Where                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| C20 | **ADR-0014's 2026-09-24 amendment is implemented at exactly one site** — `engine/columns.ts:51`. Roughly a dozen construction checks still throw in production | all four reviewers: engine §10, features F9, schema F4, api-core §3 |
| C21 | CLAUDE.md's "everything in `engine/` except `compose-table.ts` is pure" is false in five files, and its own file table describes those files as signal-owning  | engine, purity section                                              |
| C22 | CLAUDE.md points at `api/features/editing-state.ts`; the file is `api/features/editing/state.ts`                                                               | api-core, scope note                                                |
| C23 | `ngp-table-row-field.directive.ts` is a structural directive against the attribute-only locked invariant — an intentional carve-out recorded in no ADR         | schema, considered-not-reported                                     |
| C24 | `toggleColumnVisibility()` is silently inert on any column governed by `applyVisible()`                                                                        | schema, considered-not-reported                                     |

**C20 is owed work, not a bug.** The amendment landed the same day as
decision R7 and the gating rides with #129's N2. It matters here for two
reasons: the gate must land across the whole fold at once, and C6 shows
the opposite failure — a check already gated on a path where the
amendment's "it has already done its job by the time you ship"
reasoning does not hold.

---

## Two findings that bear on decisions taken 2026-09-24

- **C8 ↔ R1.** R1 accepted one release in which `detectComparator` is
  the only comparator, on the grounds that no production consumer sets
  `sortFn`. C8 says that comparator mis-orders any column holding one
  non-numeric value, silently. SO7 still has no written spec.
- **C6 ↔ R7/R8.** R8 kept grouping's _writer-path_ throw live in
  production precisely because ids reaching a writer can come from user
  data. C6 is the same argument applied to `setColumns()`, where the
  check is already gated — so the principle R8 established is violated
  today on a different path.
