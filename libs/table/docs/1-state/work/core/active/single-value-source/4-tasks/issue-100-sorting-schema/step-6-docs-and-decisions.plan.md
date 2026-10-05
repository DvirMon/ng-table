# Step 6 — Docs, decisions and `llms.txt`

**PR scope:** standalone. **Depends on:** Step 3 (the docs describe the
shipped surface). **Parallel-safe with:** Step 4, Step 5.

**Task type:** docs

**Skills used:** none

**Scaffolding agent:** none

## Files

- `libs/table/docs/1-state/features/sorting.md`
- `libs/table/docs/decisions/sorting.md`
- `libs/table/docs/decisions/grouping.md` (G2 note)
- `libs/table/docs/adr/0018-when-vs-enable-predicate-naming.md` (amendment)
- `libs/table/docs/adr/0014-runtime-error-policy.md` (fallback table row for `enable`)
- `libs/table/docs/adr/0025-schema-rule-functions-are-bare-named.md` (status line)
- `libs/table/docs/2-columns/reference/tier-3-feature-config.md`, `docs/2-columns/architecture.md`, `docs/1-state/columns.md`, `docs/3-ui/directives/sort.md`, `docs/3-ui/directives/columns.md`, `docs/0-product/sorting.md`, `docs/1-state/prd.md` (story 17), `docs/overview.md`: wherever they name `enableSorting`, `ColumnDef.sortFn` or the columns-schema `sortNulls`
- `libs/table/CLAUDE.md` (file table rows)
- `libs/table/docs/1-state/work/core/active/single-value-source/decisions.md` (S1, S2, D1, D2, N9 rows)
- `llms.txt` (regenerate)

## Why This Step Exists

SO19/21/22/23/25 are `accepted, unbuilt`, and this issue builds them.
Three rulings from planning (2026-09-25) have no record yet. #100 Q4
requires D2's wording to be superseded in the record it lives in.

## What To Do

**1. `decisions/sorting.md`:**

- SO19, SO21, SO22, SO23 → `shipped`. SO25 → `shipped`; its note loses
  "pending #100's S1".
- New rows:
  - **SO26:** reuse through the `sortingSchema<Row>(fn)` identity helper,
    typing only. `apply()` was rejected: on a flat path it is just
    `fn(path.x)`. Signal Forms' `apply` exists for nested paths and
    recursive schemas, and ours have neither.
  - **SO27:** the single `sorting(path, { enable, compare, nulls })`
    options object was rejected, and SO22 stands.
  - **SO28:** `sortable` defaults to on. `{ enable }` is read at call
    time; a throw keeps the column sortable and reports once.
  - **SO29:** a duplicate declarator of the same kind on one column
    throws, extending SO15 to all three.
- Record: #100 · this workspace.
- SO16 ("overrides require a columns schema"): now `superseded` by SO21.
  Overrides need `withSorting({ schema })`.

**2. ADR-0018 amendment** (dated, appended; don't rewrite the Decision
text): `enable` names a gate that doesn't read row data, and may appear
without `when`. `sortable(path, { enable })` is the first rule like that.
`when` stays the default name for data-driven predicates.

**3. ADR-0014:** add the fallback row: `sortable` `enable` throws →
treated as sortable, reported once per column per evaluation.

**4. `decisions/grouping.md`, G2:** note that WG D2's wording ("`ColumnDef`
carries only static predicates … `sortFn`, `aggregateFn`, `filterFn`")
is superseded by #100 Q4. `ColumnDef` now carries no feature config.
Don't repeat `filterFn`: it never existed in `src/`.

**5. `features/sorting.md`:** the per-column section describes
`withSorting({ schema })` with the three declarators and a
`sortingSchema` example. Delete the "one release without per-column
`sortFn`" regression note at `:97` (R1's window closes with this issue).

**6. Other docs:** replace `enableSorting: false` with
`sortable(path.x, { enable: () => false })`, and the columns-schema
`sortNulls` with the `withSorting` schema. Search:
`rg -n "enableSorting|ColumnDef\.sortFn|sortFn\?:|SORT_NULLS|columns-schema.*sortNulls" libs/table/docs --glob '!**/work/**' --glob '!**/archive/**'`.

**7. `libs/table/CLAUDE.md`:**

- The `columns-schema/rules.ts` row drops the `sortNulls`/G69 sentence.
- The `api/features/with-*.ts` row notes `with-sorting/` as a folder.
- Add a `with-sorting/` row: `feature.ts` / `schema.ts` / `types.ts`.
- `schema/run.ts`'s row already lists `withSorting()`. Leave it.

State invariants only, never status ([[claude-md-no-implementation-status]]).

**8. Workspace `decisions.md`:** S1, S2 → done (#100). D1 and D2 sorting
slices → done. N9 `SortingPath` → done.

**9. #100's acceptance criteria:** change `applySortNulls` /
`applySortable` / `applySortFn` to the bare names, and add a
`sortingSchema` item.

**10.** `npm run llms`, then `npm run llms:check`.

## Implementation Notes

- The status column is the only place supersession is expressed; don't
  add "(was …)" prose to row text.
- Hand the edited docs to the `doc-compressor` agent afterwards, as the
  other slices' docs steps did.

## Risks / Watchouts

- **Don't edit archived work folders.** The 09-17 plan in
  `sorting/active/per-column-config-placement/` is superseded by SO21/SO22.
  Add a one-line status note at its top pointing to this workspace. Don't
  rewrite it.

## Non-Goals

- No `docs/status.md` hand edit; regenerate with `npm run table:status`
  only if a spec's frontmatter `code:` changes.
- No changes to #117's issue. It owns `ctx.valueOf`.

## Acceptance Checks

- [ ] `npm run llms:check` clean.
- [ ] The Step 6 search returns nothing outside `work/` and `archive/`.
- [ ] SO19/21/22/23/25 read `shipped`; SO26–SO29 exist.
- [ ] Nothing new mentions `filterFn`.

---

← [Step 5: Types spec](step-5-types-spec.plan.md)
