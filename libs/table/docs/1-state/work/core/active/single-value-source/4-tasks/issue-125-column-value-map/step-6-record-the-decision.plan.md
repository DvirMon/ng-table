# Step 6 — Record the decision

**PR scope:** standalone. **Depends on:** Step 5 (the record is written
from what the guard proved, not ahead of it).
**Parallel-safe with:** nothing.

**Task type:** docs

**Skills used:** —

**Scaffolding agent:** main thread, no agent

## Files

- `libs/table/docs/decisions/grouping.md` (edit)
- `libs/table/docs/1-state/work/core/active/single-value-source/decisions.md`
  (edit)
- `libs/table/docs/1-state/work/core/active/single-value-source/issue-graph.md`
  (edit)
- `llms.txt` (regenerated)

## Why This Step Exists

K0 is registered in the workspace log as `pending (#125)`, and the
workspace's **Acceptance** section still lists the value-map types-spec as
owed. Both are now false. More importantly, the capability log has no row
for any of this: a reader asking "how does a column's value type reach a
schema?" reads `docs/decisions/<capability>.md` first, and today it stops
at G72.

The library's own rule is that **a work folder may not move to `archive/`
until every decision in it is registered as a `G`-row**. This folder is
not archiving yet — #115, #100 and the grouping retrofit are still open in
it — but the row is written when the decision lands, not when the folder
closes. That is precisely the sprawl the log exists to prevent.

## What To Do

**1. `docs/decisions/grouping.md` — append `G73`.** Next free number; G72
is the last. One line, per the log's format contract:

- **What.** The declared column-value map. `createColumns<TRow>()([...])`
  captures the declared ids and accessor return types that a plain array
  widens away; `ColumnValues<TRow, TCols>` derives the id → value map;
  `TableStore`'s second type parameter becomes that map, carried through a
  phantom `__columnValues`, with `TId` derivable as `keyof TValues & string`
  rather than a parameter of its own.
- **Status** `shipped`, dated, linked to
  [#125](https://github.com/DvirMon/ng-table/issues/125) and the workspace
  decisions log.

Detail belongs in the linked record — if the row needs a second line, move
that line into `decisions.md`.

**2. `decisions.md` — flip K0 and record what implementing it settled.**

- The node table's **K0** row: `pending (#125)` → shipped, with the issue
  link, matching how K2/V2/V4 were marked.
- Add an entry under § "Questions settled while sequencing" covering the
  two calls made during implementation that the node description did not
  anticipate:
  - **`createColumns` is curried — `createColumns<TRow>()([...])`.**
    TypeScript has no partial type-argument inference, so a single
    `createColumns<TRow, const TCols>(columns)` call cannot take `TRow`
    explicitly and still infer `TCols`. The extra `()` also buys
    contextual typing of every accessor param, so
    `accessor: (row) => row.owner.name` needs no annotation. The
    alternatives — inferring `TRow` from annotated accessor params, or
    dropping `TRow` entirely — were both rejected: the first makes an
    all-defaulted column list infer `TRow = unknown`, the second makes an
    unannotated accessor param silently `any`.
  - **`TCols` on the config, `TValues` on the store.** The config takes the
    declaration because that is what a call site can infer; the store
    carries the derived map because that is what downstream reads.
    Deriving at the config boundary is what keeps #113's id-union
    inference working for a plain array — a `TValues`-on-the-config shape
    has nothing to infer from, since `T` cannot be inferred from a
    `keyof T` position, so every un-helped array would fall back to the
    constraint and silently lose the literal union #113 shipped.
- § **Acceptance** — the last bullet currently says a `*.types.spec.ts`
  proving the value map is owed. Mark it satisfied and name both files
  that satisfy it: `api/create-columns.types.spec.ts` (the derivation) and
  `api/create-table.types.spec.ts` (the carriage). Point at artifacts, not
  descriptions, the way the K1 bullet above it already does.

**3. `issue-graph.md` — close #125.** Its node row moves to closed with
the date; `#115` and `#100` lose `#125` from their `Depends on` column and
stop being marked **blocked**; add one line to § Summary noting they are
back on the frontier, and that the grouping retrofit — still unfiled — is
now unblocked too.

**4. `npm run llms`, then `npm run llms:check` clean.** Step 1 added four
exports to `src/index.ts`; `llms.txt` is generated from the public surface
and will have drifted.

## Implementation Notes

- **Why `grouping.md`.** It is not obviously the right log for a
  columns/engine decision — but it is where every row of this migration
  has been registered since G53, including G60, G68 and G69, which are
  sorting's and columns' as much as grouping's. There is no `columns.md`
  log, and opening one for a single row is not this slice's call. Write
  the row where its siblings are, and say nothing about the taxonomy in
  the row itself.
- **The G-row is an index, not a record.** It records nothing that is not
  recorded elsewhere — it links to #125 and to the workspace log, and
  those hold the rationale. ADR-0024 holds the _why_ for the whole
  migration and is already linked from the log's header.
- **Write the workspace entry for someone who has not read this plan.**
  Each of the two settled questions should stand alone: the answer, the
  mechanism, and what was rejected.
- **No status in any always-loaded file.** Nothing about #125's state goes
  into `libs/table/CLAUDE.md` or any other injected file
  (`.claude/rules/claude-md-no-implementation-status.md`).

## Risks / Watchouts

- **Never renumber, never reuse a `G`-number.** Confirm G72 is still the
  last before appending — another issue in this folder may have landed a
  row in the meantime.
- **If Step 5's `composeFeatures` case failed**, the record is written the
  other way round: the escape hatch _drops_ the map, Step 4 reopened to add
  the parameters to `COMPOSE_FEATURES`, and the entry says that instead.
  Write what the spec actually proved.
- **Every link added must resolve** — relative paths from each file's own
  directory. The workspace log sits five levels below `docs/`, so its
  links to `decisions/grouping.md` and `adr/` are long; copy the shape of
  the links already in the file rather than composing new ones.

## Non-Goals

- **No ADR.** ADR-0024 already holds the rationale for the single value
  source, and this slice adds no new cross-capability constraint — it
  implements one. [#116](https://github.com/DvirMon/ng-table/issues/116)
  owns the schema-declaration-surface ADR that is separately owed.
- **No archiving.** #115, #100 and the grouping retrofit are still open in
  this work folder; it stays in `active/`.
- **No capability spec edit.** `docs/1-state/features/*` describes what
  each feature does; no feature's behaviour changed here. The docs pass for
  the epic is node D2's.
- **No `docs/status.md` edit.** It is generated from spec frontmatter, and
  no frontmatter changed.

## Acceptance Checks

- [ ] `docs/decisions/grouping.md` carries `G73`, numbered without reuse,
      one line, linked to #125 and the workspace log.
- [ ] `decisions.md`'s K0 row reads shipped, and § "Questions settled
      while sequencing" carries both implementation calls.
- [ ] `decisions.md`'s § Acceptance value-map bullet names both spec
      files.
- [ ] `issue-graph.md` shows #125 closed, #115 and #100 unblocked, and the
      summary updated.
- [ ] `npm run llms:check` clean.
- [ ] Every link added in this step resolves.

---

← [Step 5: The end-to-end guard](step-5-end-to-end-guard.plan.md)
