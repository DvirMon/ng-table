# Step 3 — Name the fallback, close SO24

**PR scope:** depends on Step 1. Parallel-safe with Step 2 — both
depend only on Step 1, not on each other.

**Depends on:** Step 1

**Parallel-safe with:** Step 2

**Task type:** docs

**Skills used:** none (main thread)

**Scaffolding agent:** none — main thread

## Files

- `libs/table/docs/1-state/features/sorting.md` (edit)
- `libs/table/docs/decisions/sorting.md` (edit)

## Why This Step Exists

#112's acceptance criteria require "the fallback for each is named in
a spec, not left implicit", and the issue body says SO24 is "registered
... close it there when this lands." Both are doc updates that follow
from Step 1's shipped behavior — no code changes here.

## What To Do

### `docs/1-state/features/sorting.md`

In the **Comparator Logic** section (after the existing bullet list
ending in "`enableSorting: false` makes `toggleSort` a no-op..."), add
one bullet naming the ADR-0014 fallback, matching the one-line-cites
pattern ADR-0014's own Consequences section calls for ("Feature specs
cite this ADR in one line rather than restating the policy... `sorting.md`
gets it when next touched"):

```markdown
- Runtime failures degrade rather than crash the table
  ([ADR-0014](../adr/0014-runtime-error-policy.md)): a column whose
  `accessor` throws sorts that row as empty for this evaluation; a
  `sortFn` (or the built-in comparator) that throws leaves the
  affected comparison unordered, so the column's sort falls back to
  input order rather than the whole table breaking. Both report once
  per column per evaluation via `console.error`.
```

Do not restate the rationale from ADR-0014 — one line, per that ADR's
own instruction.

### `docs/decisions/sorting.md`

Edit the **SO24** row: change `Status` from `**open**
([#112](https://github.com/DvirMon/ng-table/issues/112))` to
`shipped`.

In the **Still open** section, remove the SO24 bullet entirely (it is
no longer open) and leave the remaining bullets (SO7, SO9, SO17, SO8)
as-is — do not renumber anything.

In the **ADRs that constrain sorting** section, the line reading
"[ADR-0014](../adr/0014-runtime-error-policy.md) — and SO24 is the one
place that is not yet honoured" should drop the "and SO24 is the one
place that is not yet honoured" clause, since it is now honoured.

## Implementation Notes

- This log **restates nothing** — link to Step 1's change, don't
  describe it a second time. The one new sentence in `sorting.md`'s
  "Comparator Logic" section is the fallback statement itself, which
  belongs there per ADR-0014's own consequences, not narrated further
  in the decisions log.
- No new `SO`-number is needed — SO24 is being closed, not superseded.
  Per the log's own maintenance rule 4, a superseded row keeps its
  history; a *closed* (no-longer-open) row is simply flipped to
  `shipped` in place, matching how other `shipped` rows in this same
  file read (e.g. SO10–SO15).

## Risks / Watchouts

- Do not touch `libs/table/docs/1-state/work/core/active/single-value-source/decisions.md`'s
  dependency graph — V1 is already described there as "independent —
  ADR-0014 bug fix, ships alone"; that description does not change
  and this workspace doc holds no per-decision status to flip.
- Do not close GitHub issue #112 itself from this step — that is
  `/ship`'s job once the code and tests land, not a docs edit.

## Non-Goals

- No ADR changes — ADR-0014 already documents the general policy and
  fallback table; this step only makes `sorting.md` cite it, per its
  own Consequences section.
- No regeneration of `docs/status.md` or `llms.txt` — neither
  `sorting.md`'s frontmatter (`capability`/`spec`/`code`) nor any
  public export changes in this step.

## Acceptance Checks

- [ ] `docs/1-state/features/sorting.md`'s "Comparator Logic" section
      names both fallbacks in one bullet, citing ADR-0014.
- [ ] `docs/decisions/sorting.md`'s SO24 row reads `shipped`, is
      removed from "Still open", and the ADR-0014 bullet's
      "not yet honoured" clause is gone.

---
← [Step 2: Cover the two degrade paths](step-2-degrade-path-tests.plan.md)
