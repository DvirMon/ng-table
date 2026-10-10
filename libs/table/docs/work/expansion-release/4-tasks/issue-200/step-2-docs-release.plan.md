---
step: 2
type: docs
commit: docs
depends_on: []
files:
  - libs/table/docs/1-state/features/expansion.md
  - libs/table/docs/adr/0006-row-id-state-reconciliation.md
  - libs/table/docs/0-product/expansion.md
  - libs/table/docs/decisions/expansion.md
---

# Step 2 — Document release() as shipped

Makes the docs describe the shipped `release()` with the open-id skip.
Changes no code.

Decisions: [E62, E63, E39](../../../../decisions/expansion.md)

## Do

Read each file first and confirm the line numbers. The ones below are where the text sits today.

- `libs/table/docs/1-state/features/expansion.md`:
  - The `release(ids?)` signature line (~L40) drops "specced, not shipped (E39, #200)".
  - Delete the "Pending (#200)" note (~L44).
  - The `everExpanded` bullet (~L68-70) says it shrinks only through `release()`, for closed ids only. It stays exempt from row-removal pruning.
  - ~L86 drops "pending in #200".
  - The verbs-table row (~L101) becomes shipped and reads: "Removes closed ids from `everExpanded`; open ids are skipped; omitted `ids` frees every closed id. Never touches the open set; emits nothing on `changed`."
  - Check ~L228 for additive-ledger wording.
  - `code:` frontmatter stays `shipped`.
- `libs/table/docs/adr/0006-row-id-state-reconciliation.md` (~L47): the `everExpanded` exemption keeps "an additive ledger". Add that it has exactly one explicit, consumer-called remover, `release()`, which skips open ids. Row removal still never prunes it.
- `libs/table/docs/0-product/expansion.md` (~L522-531):
  - Fix "no ids = clear" and "Collapse-all then release()" to the D1 rule.
  - Replace the "Still owes, in #200" sentence with a short statement that the spec, the ADR-0006 amendment and the log row landed in #200.
  - Check ~L14, ~L333, ~L471, ~L500 and ~L605, and fix any that claim otherwise.
- `libs/table/docs/decisions/expansion.md`: E39's status cell becomes shipped (#200).
- `libs/table/docs/1-state/architecture.md` (~L226): read it. Edit it only if it describes `release()` as pending or as clearing everything. If it needs an edit, add the file to this step's `files`.
- Search `libs/table/docs` for any other doc that describes `release()` as clearing everything or as pending. Skip `work/expansion-release/` and archived work folders. Correct what you find.

## Watch out

- Do not hand-edit `docs/status.md`. It is generated, and `code:` stays `shipped`, so it should not change. Do not run `npm run table:status`.
- Keep each decisions-log row to one line.

## Out of scope

- Code changes.
- A new ADR.
- #190's story 2.3.
- Renumbering log rows.

## Done when

- [ ] No doc outside the #200 work folder calls `release()` pending or says an omitted `ids` clears everything.
- [ ] E39's status reads shipped (#200).
- [ ] ADR-0006 names `release()` as the one explicit remover.

---

← [Step 1 — The release() method on the expansion slice](step-1-release-method.plan.md)
