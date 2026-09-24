# Step 5 — Record the ruling

**PR scope:** standalone. **Depends on:** Step 2.
**Parallel-safe with:** Step 3, Step 4.

**Task type:** docs

**Skills used:** —

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/docs/1-state/work/core/active/single-value-source/decisions.md`
  (append)
- `libs/table/docs/1-state/work/core/active/single-value-source/3-architecture.md`
  (edit — file-layout row for `engine/columns-schema/resolve.ts`)
- `libs/table/docs/1-state/work/core/active/single-value-source/issue-graph.md`
  (edit — #139 row)

## Why This Step Exists

#139 left one shaping question for the implementing session:
what the compile step becomes. It was settled on 2026-09-24,
and the ruling lives only in this plan until it is written down.

## What To Do

1. `decisions.md`: append one entry, using the file's own
   numbering:
   - **Decision:** the compile step folds into the intake.
     `createTable` unpacks `config.columns` directly;
     `engine/columns-schema/resolve.ts` is deleted.
   - **Why:** after #132, `resolveColumnsConfig` only turned a
     schema fn into rules, and a `ColumnSet` already carries
     resolved rules. The alternative (a slim
     `resolveColumnsConfig(set)`) would have been a
     pass-through with no state or reasoning of its own.
   - Record that `ColumnDefInput` survives as the resolved-input
     shape.
2. `3-architecture.md`: the `resolve.ts` row says
   "`resolveColumnsConfig` consumes a `ColumnSet`". Amend it to
   "deleted — intake unpacks the set (#139)".
3. `issue-graph.md`: mark #139 as shipped only after the ship
   commit exists. Otherwise leave it to `/ship`.

## Non-Goals

- No consumer-facing prose docs (#141).
- No status in any `CLAUDE.md`.

## Acceptance Checks

- [ ] `decisions.md` entry names the decision, the rejected
      alternative, and the date.
- [ ] `3-architecture.md` no longer describes
      `resolveColumnsConfig` as a surviving seam.

---
← [Step 4: Array-rejection proofs](step-4-array-rejection-proofs.plan.md)
