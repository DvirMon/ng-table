# Step 5 — Rewrite `0-product/grouping.md`

**Task type:** docs
**Depends on:** Steps 1, 2, 3, 4 — it records what those actually shipped

## Why

This is lesson-audit §4b, unblocked by the coverage re-audit. The product doc's frontmatter
claims six stories and **11 ✅ / 5 🟡 / 1 ❌**; three of those six folders no longer exist and the
real tally on `main` is **8 / 5 / 4**. Nearly every "Covered by:" line in §1–§5 cites
`grouping-static/`, `grouping-regressions/` or `grouping-crud/`.

The mapping from old story to new is already derived — `../../grouping-stories/4-coverage-reaudit.md`
§1 (inventory) and §2 (re-derived marks). **This step is transcription, not analysis.** Where the
audit and the doc disagree, the audit wins; where this step's own reading disagrees with the
audit, stop and say so rather than silently re-deriving.

## Files

- `libs/table/docs/0-product/grouping.md`

**Not** `libs/table/docs/0-product/row-editing.md` — see "G-2" below.

## What to do

### 1. Delete the three unfailable criteria (D4, step 3)

- `:498-499` — §3.4 criterion 2 ("The ordering reflects the filtered rows…"), a two-line wrapped
  bullet.
- `:500` — §3.4 criterion 3 ("The ordering updates when the data does.").
- `:776` — F-G1 criterion 2 ("A group with no surviving rows disappears rather than rendering
  empty.").

Then repair the prose that referenced them:

- §3.4 "Covered by:" (`:502-506`) — its middle sentence exists purely to argue criterion 2 is
  "checkable on screen rather than argued". Rewrite around `grouping-order/`'s `by-count`.
- §3.4 "Design status:" (`:508-510`) — ends *"worth a test, not a decision"*. Replace with a
  pointer to step 3's assertion in `with-grouping/feature.spec.ts`, which discharges it.
- F-G1 "Covered by:" (`:779-783`) — says "for the first two criteria" (now both) and spends two
  clauses on the disappearing-group half that just left.
- F-G1 "Why it is 🟡:" (`:785-788`) — calls the survivor "the third criterion"; it is now the
  second.
- F-G1's §-heading parenthetical (`:768`) — "counts and emptied groups yes" names the deleted
  criterion.
- F-G1 "Design status:" (`:790-793`) — keep "an empty group is unrepresentable" as design
  rationale; it is true and now lives only here.

### 2. Delete the `grouping-crud/` claim at `:664-666`

§5's "Owned by row editing" block says `row-editing.md` owns G-1/G-2's marks, then asserts a
coverage claim for G-2 against `grouping-crud/` — a deleted folder. Deleting that sentence fixes
the dead link and the self-contradiction at once.

**`row-editing.md` needs no edit.** It already marks G-2 ❌ *(forward-looking)* and never
mentions `grouping-crud/`. The re-audit's claim that it did is wrong; step 6 corrects that.

### 3. Re-point every "Covered by:" and update the front matter

Per `4-coverage-reaudit.md` §2. The marks to land, assuming steps 1–4 shipped:

| Entry | Mark | Covered by |
|---|---|---|
| 1.1, 1.2 | ✅ | every story; Ungroup half → `grouping-selection/` |
| 1.3 | ✅ | `grouping-aggregates/` — happy path *and* the ADR-0014 failure, in one story |
| 1.4 | 🟡 | pills → `grouping-basic/`, `groupedColumnMode` → `grouping-columns/`; the failure half returns with `grouping-keys/` |
| 2.1, 2.2, 2.3 | ✅ / 🟡 / ❌ | unchanged |
| 2.4 | 🟡 | `grouping-basic/`'s `stickyHeaders` arg (step 2). U5 keeps it off ✅ |
| 2.5 | 🟡 | Refetch and Regroup on canvas; the sort attack is `feature.spec.ts`, which is below the doc's own ✅ bar |
| 3.1, 3.2 | ✅ | `grouping-basic/`, `grouping-collapsible/`, `grouping-selection/` |
| 3.3, 3.4 | ✅ | `grouping-order/` — 3.4 on its one remaining criterion |
| 4.1, 4.3 | 🟡 / ✅ | `grouping-when/` |
| 4.2, 4.4 | 🟡 / ❌ | both pending `grouping-keys/`; do not claim them |
| X-G1 | ✅ | `grouping-selection/` — **two** cascade modes plus the derived third, not "all three peer defaults" |
| S-G1 | ✅ | `grouping-order/` (step 4), **with the criterion-2 trade named** — see below |
| S-G2 | ✅ | `grouping-order/` |
| F-G1 | 🟡 | `grouping-selection/`; counts only — summaries left the canvas with step 1 |
| E-G1 | ✅ | `grouping-collapsible/` |
| F-G2, P-G1, P-G2, D-G1 | ❌ | unchanged, forward-looking |

Then the §0 story table (eight rows, not six), the intro line naming `grouping-static/` as "the
one to copy" (now `grouping-basic/`), and the frontmatter `status:` block with the new tally.

### S-G1 needs a sentence, not just a mark

Its second criterion is *"What does not happen: the header shows a sort indicator while the table
does not change."* Under a real comparator in `grouping-order/`, clicking the grouped column does
exactly that. Mark it ✅ — the user story's verb is "I want to understand why nothing moved", and
both criterion 1 and that understanding are delivered — but state in one sentence that criterion
2 is knowingly violated under a comparator, and that this is D5's accepted cost made visible
rather than an oversight.

## Acceptance checks

- [ ] `grep -n "grouping-static\|grouping-regressions\|grouping-crud" libs/table/docs/0-product/grouping.md`
      returns nothing.
- [ ] Frontmatter `status:` names eight stories and a tally matching the body.
- [ ] Counting the ✅/🟡/❌ marks in §1–§4 and §5 reproduces the frontmatter exactly. The last two
      audits both caught a frontmatter tally that disagreed with the body — check, don't assume.
- [ ] §3.4 and F-G1 each have one fewer criterion, and no surviving prose references a deleted
      one by ordinal ("the third criterion") or by content.
- [ ] `row-editing.md` is unmodified.
- [ ] Nothing claims `grouping-keys/` — it is uncommitted and out of scope.
