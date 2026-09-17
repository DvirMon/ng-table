# Implementation Progress — Table: pre-claim core member keys and build the base store before the feature fold

**Issue:** #68
**Status:** 4 / 4 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | slots.ts: core-key pre-claim API and positional claimant labels | ✅ done | — |
| 2 | slots.spec.ts: registry unit spec for the core-key pre-claim | ✅ done | — |
| 3 | compose-table.ts + create-table.ts: base store before the fold, positions unshifted | ✅ done | — |
| 4 | compose-table.spec.ts: base-store-before-fold, core-key collision, unshifted labels | ✅ done | — |

Graph: `1 → 3 → 4`; `2` parallel-safe with `3` (after `1`).
