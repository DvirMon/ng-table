# Implementation Progress — Order groups per column (`applyGroupOrder`)

**Issue:** #87
**Status:** 7 / 7 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | GroupOrder type, GroupOrderRule, and the per-column collector | ✅ done | — |
| 2 | `applyGroupOrder(path.x, cmp)` schema sugar | ✅ done | — |
| 3 | Engine: `sortClusters` resolves its comparator per column | ✅ done | — |
| 4 | `withGrouping()`: drop `config.groupOrder`, collect per-column comparators | ✅ done | — |
| 5 | Migrate `grouping-regressions` story to `applyGroupOrder` | ✅ done | — |
| 6 | Tests: per-column `sortClusters`, `applyGroupOrder` through the public surface | ✅ done | — |
| 7 | Documentation: `applyGroupOrder` replaces `config.groupOrder` | ✅ done | — |

**Verification note:** per repo policy, `nx test shared-table` is not run locally during
implementation — each step's acceptance checks that depend on it stay unverified until CI runs
the PR. `nx run shared-table:typecheck`/`typecheck-spec` are run per step (source-clean, both
targets — see `.claude/rules/typecheck-angular-templates.md`).

**Follow-up fix during Step 6:** Step 3's per-column rewrite of `sortClusters` (`engine/grouping.ts`)
dropped the reference-preserving recursion the original `partitionAndRecurse` had — it
unconditionally spread `{...node, children: ...}` even when nothing changed, breaking 2
pre-existing reference-identity tests once Step 6 migrated them to the new call shape. Restored
`partitionAndRecurse` (now per-column-aware, threading `groupOrderByColumn` through the
recursion) so a subtree with no comparator and no dissolution stays reference-identical to its
input — the invariant Step 3's own Acceptance Checks named but that had no test coverage until
Step 6. `nx test`, scoped to `grouping.spec.ts` + `with-grouping.spec.ts`: 120/120 passing after
the fix (was 118/120). Full suite still gated on CI per policy.
