# Step 6 — Document the shared mechanism's two new files

**PR scope:** standalone. **Depends on:** Step 3, Step 4 — both new files
must exist before the file table can describe them.

**Task type:** docs

**Skills used:** —

**Scaffolding agent:** — (main thread)

## Files

- `libs/table/CLAUDE.md` (edit)

## Why This Step Exists

`libs/table/CLAUDE.md`'s file table is the map a maintainer reads before
touching `src/`. This slice adds two files to `schema/` —
`run-schema.ts` and `validate.ts` — and both are mechanism-wide, which is
the whole point of #111. An undocumented shared runner gets re-privatised
by the next feature that needs one.

`issue-graph.md` is **no longer this step's concern** — its line 77
claim ("#111 extracts two runners") was corrected during the graph
status refresh on 2026-09-20, along with #112's closure. Do not edit
that file here; one owner per file.

## What To Do

### 1. `libs/table/CLAUDE.md` — the `schema/` rows

The file table's `schema/` block is **already stale**, independently of
this slice: it lists `schema/column-schema.ts`, `schema/column-rules.ts`,
`schema/column-metadata.ts` and `schema/column-schema.types.ts`, while
`src/` has `columns-schema/{schema,rules,metadata,types}.ts` and a
`schema/` folder holding `path-proxy.ts` alone.

Correct **those four rows' paths** to what is on disk, and add three rows —
`path-proxy.ts` is undocumented today too, and the two new files belong
beside it:

| File                   | Purpose                                                                                                                                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema/path-proxy.ts` | The key-space-agnostic declare-phase mechanism — `createPathProxy()`, `createRecorderSession()`, `recorderOf()`, `PathRecorder`, `RecordedHandle`. Imports nothing from any consumer (#111); `PathRecorder.record(rule: TRule)` is generic in the rule family, one family per session                |
| `schema/run-schema.ts` | `runRecordedSchema(buildPath, fn)` — the one body behind every **recording-form** schema fn (`columnSchema()`, `withGrouping()`, `withSorting()`). The declaring form (filtering) keeps its own body in `engine/filters/build.ts` until ADR-0020's `stageSchema` is a second caller (#111 reading B) |
| `schema/validate.ts`   | `assertDeclarationsAreKnown(declaredIds, knownIds, label)` — the one construction-time check that a declared identifier names a real column, shared by every schema form. `label` names the declaring surface in the message                                                                         |

Write the rows in the table's existing voice — one row, one purpose, no
step-by-step. The two-authoring-forms rule itself belongs to
[#116](https://github.com/DvirMon/ng-table/issues/116)'s ADR; cite it, do
not restate it.

### 2. `libs/table/CLAUDE.md` — the layout block

The ASCII tree above the table describes `schema/` as "column schema DSL:
`columnSchema()`, metadata, visibility/sort rules". That is now
`columns-schema/`'s description. Split the line in two:

```
  columns-schema/ ← column schema DSL: columnSchema(), metadata, visibility rules
  schema/         ← the shared declare-phase mechanism, key-space agnostic
```

Keep the edit to those lines. Do not audit the rest of the table.

## Implementation Notes

- **Why the stale `schema/` rows get corrected here and not in their own
  pass.** Adding three accurate rows to a block whose four neighbours name
  files that do not exist produces a table a reader cannot trust either
  half of. The correction is four paths, mechanical, and adjacent.
- **No implementation status in `CLAUDE.md`.** The rows describe what the
  files are, not that #111 shipped them —
  `.claude/rules/claude-md-no-implementation-status.md`. The `(#111)`
  citations above are pointers to the owning decision, which that rule
  allows; a "landed" or "pending" marker is not.

## Risks / Watchouts

- `npm run llms:check` must stay clean. If it fails, run `npm run llms`
  and commit the regenerated `llms.txt` — do not hand-edit it.
- Do not add `run-schema.ts` or `validate.ts` to `libs/table/src/index.ts`.
  The file table documents internals; the barrel is the public surface, and
  these are not on it (#102 is what would change that).

## Non-Goals

- No audit of the rest of `CLAUDE.md`'s file table. Other rows may be
  stale; that is `/audit-docs`' job, not this slice's.
- No `issue-graph.md` edit — already refreshed, see above.
- No `docs/1-state/features/*.md` edit. No feature's behaviour changed.
- No `docs/status.md` regeneration — no spec frontmatter changed.
- No ADR. The two-forms rule, the keying rule and the resolver tiers are
  #116's, which is already open and blocks nothing here.

## Acceptance Checks

- [ ] `libs/table/CLAUDE.md`'s file table names `schema/path-proxy.ts`,
      `schema/run-schema.ts` and `schema/validate.ts`, and every `schema/`
      or `columns-schema/` path in the table resolves to a real file.
- [ ] `npm run llms:check` clean.

---

← [Step 5: Spec the shared check](step-5-validate-spec.plan.md)
