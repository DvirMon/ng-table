# Issue graph — expansion-release epic (#200)

Epic: [#200](https://github.com/DvirMon/ng-table/issues/200) —
`table.expansion.release(ids?)`, free kept detail panels.

## Nodes

| #                                                      | Title                                               | Slice slug        | Depends on | Blocks                |
| ------------------------------------------------------ | --------------------------------------------------- | ----------------- | ---------- | --------------------- |
| [#200](https://github.com/DvirMon/ng-table/issues/200) | Table: withExpansion() release() — free kept panels | expansion-release | —          | #190 (story 2.3, E60) |

The slice slug is what `/to-tasks` uses in the issue's branch name, `<type>/<NN>-<slice-slug>`.

## Graph

```
#200 expansion-release ──► #190 story 2.3 (outside this epic)
```

## Summary

- **Parallel-safe:** — (single node)
- **Sequenced:** #190's story 2.3 waits on #200's `release()` (D4, E60).
- **Starting frontier:** #200.

## Source

Childless epic: the spec is one method on an existing slice, so #200
is its own slice (user-confirmed 2026-10-10). The #190 edge is D4.
Title from `gh issue view 200` on 2026-10-10. Related docs:
[`2-spec.md`](2-spec.md), [`1-decisions.md`](1-decisions.md).
