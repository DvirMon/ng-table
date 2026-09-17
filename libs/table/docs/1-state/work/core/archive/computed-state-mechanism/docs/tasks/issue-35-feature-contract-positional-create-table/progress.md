# Implementation Progress — Table: Feature<In, Out> contract and positional createTable(data, config, ...features)

**Issue:** #35
**Status:** 6 / 6 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | engine/types.ts + api/types.ts: Feature<In, Out>, TableConfig, ReadonlyStore, indexById | ✅ done | — |
| 2 | tools/generate-overloads.ts: 15 + 15 overloads as call-signature interfaces (user runs it) | ✅ done | — |
| 3 | compose-table.ts: fold hands each consumer feature the store only; base store gains indexById | ✅ done | — |
| 4 | create-table.ts: positional signature, config.injector, delete table-schema.ts | ✅ done | — |
| 5 | create-table-feature.ts: re-typed, trailing derive-block plumbing | ✅ done | — |
| 6 | compose-table.spec.ts + create-table.spec.ts: fold runtime, positional runtime, type assertions | ✅ done | — |

Graph: `1 → {2, 3, 5}`; `{2, 3} → 4`; `{4, 5} → 6`.
Parallel-safe: `[2, 3, 5]` after `1`. Dependency: `1 → 3 → 4 → 6`.

```
        ┌── 2 ──┐
  1 ────┼── 3 ──┼── 4 ──┐
        └── 5 ──────────┴── 6
```

Step 2 gate: the user runs `npm run table:overloads` and commits the output before Step 4.
