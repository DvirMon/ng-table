# Implementation Progress — render stages exchange a nested node tree

**Issue:** #107
**Epic:** #105
**Status:** 0 / 7 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | [The IR migration](step-1-node-ir-migration.plan.md) | ✅ done | — |
| 2 | [The engine IR seam pair](step-2-flatten-and-fold-specs.plan.md) | ✅ done | — |
| 3 | [Grouping's node tree](step-3-grouping-render-spec.plan.md) | ✅ done | — |
| 4 | [Expansion end-to-end](step-4-expansion-spec.plan.md) | ✅ done | — |
| 5 | [core.spec and the wording sweep](step-5-core-spec-and-sweep.plan.md) | ✅ done | — |
| 6 | [The collapsible grouping story](step-6-collapsible-story.plan.md) | ✅ done | — |
| 7 | [ADRs and maintainer docs](step-7-adrs-and-docs.plan.md) | ✅ done | — |

Status values: `⬚ pending`, `▶ in progress`, `✅ done`, `⏭ skipped`.

## Dependency graph

```
Step 1 ──┬──> 2  flatten.spec + render-stages.spec
         ├──> 3  grouping/render.spec
         ├──> 4  with-expansion.spec
         ├──> 5  core.spec + wording sweep
         └──> 6  story host + mdx

Step 7  (ADRs + maintainer docs)  — no incoming edge
```

- **Parallel-safe:** `[2, 3, 4, 5, 6]` once Step 1 lands · `[1, 7]`
  from the start.
- **Dependency:** `1 → {2, 3, 4, 5, 6}`.
- Step 1 leaves the spec files uncompilable on purpose — the stage
  signature changes and nothing can stage it. Gate Step 1 on
  `typecheck`, not `typecheck-spec`; `typecheck-spec` goes green once
  Steps 2-5 land.

## The two behaviour diffs to expect, and no others

- **D2** — a group row's `hasChildren` changes source
  (`items.length > 0` → `children.length > 0`). Equivalent on every
  shape reachable today.
- **C4** — a childless data row's `isExpanded` flips `false` →
  `undefined`.

Anything else that changes is a bug, not a spec to update.

## The trap

**D1a.** `isExpanded` is stamped only when a feature actually
contributed the slot (`expanded !== undefined`) **and** the node has
children. Stamping it whenever a node has children makes a
grouping-only table report every header as expanded. It compiles, it
passes a smoke test, and it is wrong.
