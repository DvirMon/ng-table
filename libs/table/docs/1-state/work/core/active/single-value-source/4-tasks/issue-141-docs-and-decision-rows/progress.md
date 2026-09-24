# Implementation Progress — Docs, ADR-0019 amendment, CLAUDE.md invariant, decision rows, `llms`

**Issue:** [#141](https://github.com/DvirMon/ng-table/issues/141)
**Status:** 2 / 7 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | State and product docs | ⬚ pending | — |
| 2 | Columns and UI docs | ⬚ pending | — |
| 3 | ADR amendments | ✅ done | — |
| 4 | `CLAUDE.md` invariants and layout rows | ⬚ pending | — |
| 5 | Check #140's order-window doc | ⬚ pending | — |
| 6 | Columns decisions log | ✅ done | — |
| 7 | Regenerate `llms.txt` and run the gates | ⬚ pending | — |

## Graph

```
1 ──┐
2 ──┤
3 ──┤
4 ──┼──► 7
5 ──┤
6 ──┘
```

Parallel-safe: [1, 2, 3, 4, 5, 6]. Dependency: all → 7.

External gates (issues, not steps):

- #139 and #140 closed: Steps 1, 2 and 4.
- #140 closed: Step 5.
- Steps 3 and 6 can start now.

## Notes

- **#139 added as a blocker (user ruling, 2026-09-25).** The
  docs must not teach "columns are always a `createColumns`
  set" while the array intake still compiles.
- **Step 5 gap handling (user ruling, 2026-09-25):** if #140
  shipped without its doc, comment the gap on #140, then write
  it here.
- **Log prefix `COL` (user ruling, 2026-09-25).** This leaves
  `C` free for a possible core log.
- **ADR-0014 already carries the dev-gating clarification**
  (`## Amendment (2026-09-24)`, `:193`). Step 3 checks it and
  does not re-write it.
- Stale source comment, outside this ticket's scope:
  `engine/columns-schema/wire-columns-schema.ts:26` says
  "the legacy no-`columnsSchema` path". It is a candidate for
  #139's cleanup.
