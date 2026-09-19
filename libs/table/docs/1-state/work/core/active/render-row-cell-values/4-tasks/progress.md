# Implementation Progress — Expose a resolved cell value on `RenderRow`

**Issue:** #80
**Status:** 0 / 8 complete

## Dependency graph

```
S1 ADR-0022        ─┐
S2 duplicate id    ─┼── no edges between these four
S3 RenderRow.cells ─┤
S4 D11 report      ─┘

S2 ──┐
S3 ──┴──▶ S5 engine tests (cells + duplicate id)
S4 ─────▶ S6 grouping report test
S3 ──┬──▶ S7 docs: accessor contract
S1 ──┘
S3 ─────▶ S8 migrate 6 story hosts
```

Parallel-safe: [1, 2, 3, 4] — then [5, 6, 7, 8] once their blockers land.
Dependency: 3 → 5, 7, 8 · 2 → 5 · 4 → 6 · 1 → 7.

| Step | Title | Type | Status | PR |
|---|---|---|---|---|
| 1 | [ADR-0022: the cell-value surface](step-1-adr-cell-value-surface.plan.md) | `docs` | ✅ done | — |
| 2 | [Duplicate column ids throw at construction](step-2-duplicate-column-id-throw.plan.md) | `code` | ✅ done | — |
| 3 | [`RenderRow.cells` and the `accessor` wrap](step-3-render-row-cells.plan.md) | `code` | ✅ done | — |
| 4 | [Non-primitive group value reports](step-4-non-primitive-group-value-report.plan.md) | `code` | ✅ done | — |
| 5 | [Engine tests: cells, accessor wrap, duplicate ids](step-5-engine-tests-cells.plan.md) | `test` | ✅ done | — |
| 6 | [Test: the non-primitive group-value report](step-6-grouping-report-test.plan.md) | `test` | ✅ done | — |
| 7 | [Document `accessor` as the value contract](step-7-docs-accessor-contract.plan.md) | `docs` | ✅ done | — |
| 8 | [Migrate the grouping story hosts onto `cells`](step-8-migrate-grouping-story-hosts.plan.md) | `code` | ✅ done | — |

Status values: `⬚ pending`, `▶ in progress`, `✅ done`, `⏭ skipped`.

## Scope coverage (#80's checklist)

| #80 Scope item | Step |
|---|---|
| ADR: the cell-value surface, deciding Q1–Q5 | 1 |
| `RenderRow.cells` in `engine/core.ts` | 3 |
| Document `accessor` as the value/label contract | 7 |
| Decide whether a non-primitive reaching `toGroupKey` reports | 4 |
| Migrate `src/stories/grouping/*` off `column.accessor(rowData)` | 8 |
| — (D10, surfaced during the grill) | 2 |

## Deliberately out of this slice

- `api/features/with-sorting.ts:117-118` — the one remaining unwrapped `accessor` call. ADR-0014
  gives contradictory fallbacks inside a sort comparator (`accessor` → undefined cell, `sortFn` →
  sort does not apply), so it needs its own issue (D9).
- Per-cell reactive granularity — forked to its own session (`decisions.md`, "Forked out of this
  grill").
- A real diagnostics channel replacing `console.error` at every report site — its own ADR (D11).
- Whether the library's other construction throws should become `ngDevMode`-guarded — its own ADR
  (D10).
