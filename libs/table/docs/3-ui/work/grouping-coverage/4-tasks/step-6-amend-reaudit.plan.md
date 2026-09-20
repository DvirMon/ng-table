# Step 6 — Amend the coverage re-audit

**Task type:** docs
**Depends on:** Step 5

## Why

`../../grouping-stories/4-coverage-reaudit.md` is the decision record this whole workspace
executes. Two of its findings are wrong, and its §3 plan describes intentions rather than what
shipped. An audit left describing a state that no longer exists is how the next pass reasons from
stale input — the exact failure the audit itself documented in `0-product/grouping.md`.

## Files

- `libs/table/docs/3-ui/work/grouping-stories/4-coverage-reaudit.md`

## What to do

### 1. Correct the G-2 finding

§2's cross-feature table and §3d both say `row-editing.md` §5 "still claims the story exists"
and cites `grouping-crud/`. **It does not.** `row-editing.md` already marks G-2 ❌
*(forward-looking)* and never mentions that folder. The dead claim was in
`0-product/grouping.md:664-666` — grouping's own §5 — which additionally contradicted itself,
asserting a coverage claim one sentence after saying `row-editing.md` owns the mark.

Rewrite §3d to say the fix landed in `grouping.md` (step 5) and that `row-editing.md` was
correctly left untouched. Mark the original finding as corrected rather than deleting it — the
next reader should see that it was checked.

### 2. Correct the spec-assertion home

§3e says the assertion goes in `clusters.spec.ts`. It went to
`api/features/with-grouping/feature.spec.ts`, because `clusterRows` takes `rows` as a parameter
and has no filter stage — an assertion there would restate `Array.prototype.filter`. Record the
reasoning, not just the path.

### 3. Record outcomes against each decision

§3a–§3e each carry a `> **Decided 2026-09-19**` block. Add what actually shipped:

- **3a** — `withSorting()` landed in `grouping-order/`. Note the S-G1 criterion-2 trade (the
  story deliberately exhibits the dead-header anti-pattern) and that
  `3-lesson-audit.md:187-189`'s `withFiltering()` carve-out is the precedent, so a future audit
  does not read this as a D5 reversal.
- **3a-bis** — three hosts switched to `plainGroupingConfig`; F-G1's summaries half left the
  canvas.
- **3b** — `stickyHeaders` on `grouping-basic/`; §2.4 → 🟡, U5 unchanged.
- **3e** — three criteria deleted, one assertion added.

### 4. Update the tally

§2's "Tally" table gives doc-claims / actual-on-`main` / actual-once-`grouping-keys`-commits.
Add a fourth row: **after this migration**. `grouping-keys/` stays out — still uncommitted.

## Acceptance checks

- [ ] No claim in the file about `row-editing.md` that is not true of the file as it stands.
- [ ] §3e names `feature.spec.ts` and says why not `clusters.spec.ts`.
- [ ] Every decision block in §3 records an outcome, not only an intention.
- [ ] The tally's final row matches step 5's frontmatter exactly.
- [ ] The two corrections are marked as corrections, not silently overwritten.
