# Implementation Progress — Table: integrate and verify positional composition — green promised here

**Issue:** #43
**Status:** 5 / 5 complete — issue closed

| Step | Title                                                                                           | Status                                                             | PR      |
| ---- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------- |
| 1    | `stories/composition/`: fixtures + `derived-state` story host with both derive-block placements | ✅ done                                                            | 80c991d |
| 2    | `derived-state.stories.ts` + `derived-state.mdx` — `Table / Composition / Derived State`        | ✅ done                                                            | 80c991d |
| 3    | `docs/3-ui/stories.md`: `composition/` in the layout tree and fixtures table                    | ✅ done                                                            | 80c991d |
| 4    | Agent-run static gates: type-check + lint across the library and both apps                      | ⚠ run — 2 pre-existing failures, not from #43 (see results below) | —       |
| 5    | User-run gates (unit suites, Storybook build, walkthrough) and #43 close-out                    | ✅ done                                                            | —       |

Graph: `1 → {2, 3} → 4 → 5`.
Parallel-safe: `[2, 3]` after 1. Dependency: `1 → 2`, `1 → 3`, `{2, 3} → 4`, `4 → 5`.

```
  1 ──┬── 2 ──┐
      └── 3 ──┴── 4 ── 5
```

Plan written 2026-09-13. Every blocker (#37, #41, #42 code steps) is on `feat/table` already —
no integration branch was ever cut, so issue ACs 1 and 5 are recorded as satisfied by
construction in Step 5, not executed. #41 Step 4 and #42 Step 3 (user-run walkthroughs) are
still pending at plan time; Step 5 confirms them rather than duplicating their checklists.

## Step 4 — static gate results (2026-09-14, working tree as-is, other tickets' WIP present)

| Command                                                          | Exit                                                                                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit`        | 0                                                                                                                                   |
| `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit`       | 0                                                                                                                                   |
| `npx tsc -p libs/shared/table/.storybook/tsconfig.json --noEmit` | 2 — pre-existing, `preview.ts(13)` TS7006/TS7031 implicit `any`; file unmodified since `e80d3fa`, nothing in `stories/composition/` |
| `npx tsc -p apps/demo/tsconfig.app.json --noEmit`                | 0                                                                                                                                   |
| `npx tsc -p apps/ng-table/tsconfig.app.json --noEmit`            | 0                                                                                                                                   |
| `npx nx run-many -t lint -p shared-table demo ng-table`          | 1 — 42 errors / 108 warnings, all pre-existing classes                                                                              |

Lint classification: 24 of the 42 errors are `Parsing error: Unexpected token <`, one per
story-host `.html` — every host in the repo hits it, including the eleven committed `row-edit/`
hosts on `feat/table`. It is an ESLint config gap (templates matched by the TS parser), not a
#43 regression; `composition/derived-state/…component.html` is one instance of the 24. The
remaining 18 are library/spec debt (`no-empty-function`, `no-empty-object-type`,
`no-output-native`, `no-self-assign`) in files this ticket does not touch. No error originates
in `stories/composition/*.ts` or `docs/3-ui/stories.md`.

## Code review (2026-09-14) — findings applied

Two parallel reviews (Standards, Spec) ran over the #43 file set. Both raised the same root
issue and it is now fixed:

- `createFilters()` moved out of `composition/fixtures/schema.ts` into the host's field
  initializer, with an explicit `TState` (`CompositionFilterState`, new in `fixtures/types.ts`).
  `stories.md`'s "**`createFilters()` is the exception, and belongs in the host**" paragraph
  landed from the concurrent `filtering-stories` ticket after this plan was written; step 1's
  fixtures placement predates it. `client-filtering-story-host.component.ts:155` is the
  precedent followed. Consequences: `filters.dept()` is dot access again (the defaulted
  `Record<string, unknown>` had forced `filters['dept']()` under
  `noPropertyAccessFromIndexSignature`), and `.value.set()` is type-checked.
- Removed a comment claiming `dept`'s criterion was `string` — it was `unknown` at the time and
  is `string | null` now.
- Template no longer carries an inline `'' ? null :` ternary; `setDeptFilter(value: string)`
  branches once, behind a named `isAllSelected`. Repeated `filters['dept']().value()` reads
  replaced by one `activeDept` computed.
- `derived-state.stories.ts` doc-comment called both blocks "nested"; corrected to one nested
  slot + one trailing top-level argument reading across slots.
- `stories.md` fixtures rows re-synced to the moved code, rationale clause dropped per step 3.

Spec axis confirmed AC 4 directly: `hiddenSelected` reads `renderRows()` (post-pipeline), the
nested block reads only core + `SelectionMembers`, the trailing block reads `hiddenSelected`.

Re-ran after the fixes: `tsconfig.lib.json` exit 0; `.storybook/tsconfig.json` unchanged (the
same two pre-existing `preview.ts` implicit-`any` errors).

## Step 5 — user-run gates (2026-09-14)

All three commands run by the user, all reported green:

| Command                                                 | Result                                             |
| ------------------------------------------------------- | -------------------------------------------------- |
| `npx nx run-many -t test -p shared-table demo ng-table` | pass (user-reported)                               |
| `npx nx run shared-table:build-storybook`               | pass (user-reported)                               |
| `npx nx run shared-table:storybook`                     | served; sidebar scanned, every table story renders |

`Table / Composition / Derived State` walkthrough: every row of the Step 5 table green — banner
counts track selection and filtering together, a filtered-out row keeps its mark, neither number
goes negative, and no `[createTable] derived member … threw` line appeared in the console.

Sibling walkthroughs confirmed in the same session: #41 Step 4 (nine row-edit stories) and #42
Step 3 (seven demos + ng-table home) both green.

ACs 1 and 5 are satisfied by construction: no integration branch was ever cut — #34–#42 landed on
`feat/table` directly, so there was nothing to merge.

Steps 1–3 shipped in `80c991d` (composition host, story, MDX, fixtures, `stories.md` rows).
Step 4's two static-gate failures stay as recorded above: both pre-existing, neither from #43.
