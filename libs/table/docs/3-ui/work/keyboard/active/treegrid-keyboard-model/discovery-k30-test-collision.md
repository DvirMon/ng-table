# Why do 9 tests fail on feat/233-focus-recovery, and which fixes keep every test unchanged?

**Date:** 2026-10-29 · **Depth:** standard

## Answer

The working hypothesis is only partly right. The eager seed (K30, `compose-table.ts:319-322`)
explains 7 of the 9 failures: tree G/H/I/J/O, filtering, and columns-schema. The grouping test
fails for a different reason: the recovery **effect** reads `renderRows()` on its first
`TestBed.tick()`, eager seed or not. The directive test encodes pre-#233 behaviour that K9d
deliberately changes. No fix keeps that test unchanged without breaking K9d.

None of the 9 involves the accessor hand-off from 505876a7. No failing test counts the
accessor message.

The suggested "seed from `data()`/`trackBy` only" fix is **not enough**. It leaves grouping
failing, and it breaks the collapse recovery specs with no tick before `moveTo`
(`create-table.spec.ts:1594`, `:1604`).

The one design found that passes 8 of 9:

- **Gate the effect on `focus() !== null`.**
- **Carry the `moveTo`-time snapshot with the target.**

That design reopens K30. Its "Lazy + `moveTo` seeds" column is close to this. A new decision
row is needed.

## Method

- **Specs at HEAD.** The worktree has uncommitted spec edits, and no shell/git tool was
  available. So the HEAD (1a44bd19) spec bodies were read with WebFetch from
  `raw.githubusercontent.com/DvirMon/ng-table/1a44bd19/...`. That returns a summary, not
  verbatim text, so assertion lines are quoted in fragments.
- **Source.** `compose-table.ts`, `core.ts`, `cells.ts`, `focus.ts` and the directive are not in
  `git status`, so the local file equals HEAD. Read locally.
- **origin/main.** `git diff origin/main...HEAD` was **not run**. `main`'s `compose-table.ts`
  and the directive spec were read through raw.githubusercontent `main` (2026-10-29).
- **Line numbers.** Tree/grouping/directive spec lines below are from the local file. They are
  close to HEAD, but the local edits shifted some of them.

## Per-test mechanism

### Tree G, H, I, J (`with-tree/feature.spec.ts` G:871 H:900 I:928 J:952, local lines)

1. `createTable()` → `composeTable()` seeds `previousSnapshot` with `untracked(() => handle.renderRows())` (`compose-table.ts:319-322`).
2. `renderRows` runs the render stages (`core.ts:125`). That includes the `'tree'` stage (`with-tree/feature.ts:250-253`).
3. `buildFlatTreeStage` creates fresh `reported` flags per evaluation (`with-tree/nest.ts:185-186`). It reports the self / absent / cycle link (`nest.ts:60-75`, G/H/I), or the `parentId` throw (`nest.ts:187-192`, J). **Report 1, at construction.**
4. The test calls `store.tree.toggle(…)` or `expand()`. That writes `store.expanded`, which feeds `expandedRows` (`with-tree/feature.ts:263-271`). `renderRows` reads `expanded()` (`core.ts:128`), so it is dirty.
5. `store.renderRows()` re-evaluates and the tree stage reports again. **Report 2** — "called 1 time, got 2".
6. HEAD's test bodies have no `mockClear` (WebFetch of 1a44bd19). On `main`, the first evaluation was the post-toggle read, so the count was 1.

### Tree O (`with-tree/feature.spec.ts:1136`)

- The construction build reports `parentId threw` once (`nest.ts:187-192`).
- `state()` and `expand()` use the silent `toSilentParentLink` (`with-tree/feature.ts:26-36`, `:45`) and never report.
- The test never reads `renderRows`. On `main`, nothing reports. On HEAD, construction does — "not to be called, called 1".

### Filtering "drops a throwing rule…" (`with-filtering/feature.spec.ts` ~L254)

- HEAD body: spy, `createTable`, `filters.category().value.set('b')`, `store.rows()`, `toHaveBeenCalledTimes(1)`. No `mockClear` (WebFetch 1a44bd19).
- The `broken` rule has `isEmpty: () => false`, so it is always active. The construction build runs the pipeline (`core.ts:71-77`, reached from `renderRows` at `core.ts:122`), so the predicate throws and reports. **Report 1.**
- Setting `category` dirties `rows`. `store.rows()` re-runs the pipeline and the predicate reports again. **Report 2.**

### Grouping "removing an active level's column via setColumns()…" (`with-grouping/feature.spec.ts:1143`)

- HEAD: the spy is created **after** `createTable`, then `setColumns`, `TestBed.tick()`, `groupingLevels()`, `toHaveBeenCalledTimes(1)` (WebFetch 1a44bd19). The construction build happens before the spy, so the eager seed is **not** the cause.
- `TestBed.tick()` runs the recovery effect's first run. The effect reads `handle.renderRows()` unconditionally (`compose-table.ts:324`). That is dirty, because `columns` changed.
- The `'group'` pipeline stage still clusters by `region`. `grouping()` still holds it, and an unknown column reads `undefined` into one bucket (`grouping/clusters.ts:142-143`, `:104-129`). So a `region` header is built, and `resolveGroupLabel` reports `No column declares id "region"` (`grouping/render.ts:102-109`, `:140`). **Report 1.**
- `groupingLevels()` reports the same id from its own computed, with its own `reported` set (`with-grouping/feature.ts:217-232`). **Report 2.**
- This fails under **any** effect that reads `renderRows` while focus is `null`. Lazy seeding or a `data()` seed does not help.

### Columns-schema "naming an undeclared column id throws…" (`wire-columns-schema.spec.ts` ~L447)

- HEAD: `const store = makeStore({…})` runs outside `expect`, then `expect(() => store.columns()).toThrow(…)` (WebFetch 1a44bd19).
- The seed reads `handle.renderRows()` and `handle.renderColumns()` (`compose-table.ts:320-321`). Both read `columns()` (`core.ts:119`, `:56`).
- `columns()` folds the visibility rule, whose `when` calls `ctx.stateOf({id:'nope'})`, and that throws inside `makeStore` (`wire-columns-schema.spec.ts:42` → `createTable`).

### Directive "still moves DOM focus after the focused cell was removed" (`ngp-table.directive.spec.ts:493`)

- HEAD and `main` both assert `expect(document.activeElement).toBe(document.body)` after removing row 2 (WebFetch of 1a44bd19 and of `main`).
- On HEAD, the recovery effect re-seats the target to the row at the old index, row 3 (`focus.ts:165-169`, `compose-table.ts:339-341`).
- The directive's sync effect tracks `table.focus()` (`ngp-table.directive.ts:89`). `hasFocusWithin` is still `true`, because focus lost to `<body>` counts as inside (`:103-104`). So it focuses the row-3 cell (`:106-111`), and `activeElement` is a gridcell.
- On `main` there was no recovery, `focus()` did not change, the effect did not re-run, and focus stayed on `<body>`.

## Latent vs introduced

| Test           | Class                                                                | Basis                                                                                                                                                                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tree G/H/I/J   | Test assumption exposed; product is ADR-compliant                    | ADR-0014 counts "once per callback per evaluation" (`adr/0014:89-90`). The construction build is a real evaluation. The tests assume the first evaluation is lazy.                                                                                                                                                                  |
| Tree O         | Same                                                                 | `main` reported 0 only because nothing read `renderRows`.                                                                                                                                                                                                                                                                           |
| Filtering      | Same                                                                 | Same as G.                                                                                                                                                                                                                                                                                                                          |
| Grouping       | **Latent product weakness**, exposed by the effect (not by the seed) | `render.ts:31-34` says the reporter is "shared by `groupingLevels()` and `resolveGroupLabel` so the message and dedup live in one place". The dedup sets are separate (`feature.ts:220` vs the `reportedLabels` set passed to `render.ts:140`). Any rendered table on `main` that also reads `groupingLevels()` already logs twice. |
| Columns-schema | Introduced timing change; arguably ADR-aligned                       | An undeclared id is a wiring error. ADR-0014 says "throw at construction" (`adr/0014:63-69`), and the PR makes it throw earlier.                                                                                                                                                                                                    |
| Directive      | Intended change                                                      | See "Tests that encode intended change" below.                                                                                                                                                                                                                                                                                      |

None of the 9 is a defect in the recovery logic itself. Every one is either test timing or the
grouping double report.

## Candidate fixes (all 9 tests kept unchanged)

|                                                                                    | F1 data()-only seed                                                                                                    | F2 lazy seed (effect's first run)                               | F3 eager seed, built without reports                                                               | **F4 gate on focus + `moveTo` carries snapshot**                                                                                                               |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tree G/H/I/J/O                                                                     | pass                                                                                                                   | pass                                                            | pass only if the result is not cached, else K/L lose their report (`feature.spec.ts:988`, `:1012`) | pass                                                                                                                                                           |
| Filtering                                                                          | pass                                                                                                                   | pass                                                            | as F3                                                                                              | pass                                                                                                                                                           |
| Grouping                                                                           | **fail** (the effect still reads `renderRows` at tick, `compose-table.ts:324`)                                         | **fail**                                                        | **fail**                                                                                           | pass (the effect does not read `renderRows` while `focus()` is `null`)                                                                                         |
| Columns-schema                                                                     | pass only if `columnIds` comes from `baseColumns()`, not `renderColumns()` (`core.ts:55-56`)                           | pass                                                            | **fail** (`columns()` is read)                                                                     | pass                                                                                                                                                           |
| Directive                                                                          | fail (K9d)                                                                                                             | fail                                                            | fail                                                                                               | fail (K9d)                                                                                                                                                     |
| `moveTo` → change → first tick (K30 reason 1)                                      | focus kept, but the neighbour comes from `data()` order, not navigation order                                          | **focus → `null`** (`discovery-recovery-snapshot-timing.md:24`) | kept                                                                                               | kept, and exact: the snapshot is the one `moveTo` validated against (`compose-table.ts:99`)                                                                    |
| K30 reason 2 (one writer, independent of scheduling)                               | yes                                                                                                                    | no                                                              | yes                                                                                                | `previousSnapshot` keeps one writer (the effect). `moveTo` adds data to the target write it already makes, which needs an "is the carried snapshot newer" rule |
| ADR-0014                                                                           | kept                                                                                                                   | kept                                                            | breaks "report every evaluation" for the seed build                                                | kept                                                                                                                                                           |
| Collapse specs with no tick before `moveTo` (`create-table.spec.ts:1594`, `:1604`) | **break**: no `depth`, so `findCollapseAncestorId` (`focus.ts:68-96`) cannot walk and falls back to the old-index rule | break (`snapshot-timing.md:28`)                                 | pass                                                                                               | pass                                                                                                                                                           |
| Startup builds                                                                     | 0                                                                                                                      | 1                                                               | 1 + 1 discarded                                                                                    | 0 until focus is set                                                                                                                                           |

### F4 sketch

```ts
// createFocus: moveTo already reads renderRows/renderColumns (compose-table.ts:99-102);
// store them next to the target instead of a separate seed.
target.set({ target: next, renderedAt: { rows, columnIds } });

// recovery effect
const current = focusTarget(); // tracked now
if (current === null) {
  previousSnapshot = undefined;
  return;
}
const rows = handle.renderRows();
// prev = current.renderedAt when this target was written after the last run, else previousSnapshot
```

F4 costs and risks:

- The effect now re-runs on every `moveTo`, which means every arrow key. Skip the O(n)
  `rowIds` build when `rows === prev.rows` and the column ids are unchanged.
- `focus()` needs an `equal` comparator, or has to read only `.target`.

**Rejected:** changing tests (`mockClear`), as K30 already did for two `withSorting` specs
(`snapshot-timing.md:13-16`). Valid under ADR-0014, but outside "tests unchanged".

## Tests that encode intended change

- **The directive test, yes.** K9d: "Recovery (K9a–c) moves DOM focus only when focus is inside the grid" (`1-decisions.md:48`).
- The #235 step-3 test plan predicted this exact path: "…the next write (a consumer `moveTo` now, #233 recovery later) never restores DOM focus — the keyboard user is stranded on `<body>`. The remembered focus-within flag is the fix." (`tasks/issue-235/step-3-keys-click-dom-focus.test-plan.md:136`).
- The test was written on `main` before recovery existed (WebFetch `main`). Its first assertion is a precondition about the pre-#233 world, not about the title's behaviour.
- **The other 8: no.** None of them states construction laziness as a requirement. They count reports per evaluation and assumed the first evaluation was the post-write one.

## Prior decisions check

### K1–K30 vs F1 (data()-only seed) and F4

| Decision                                                                              | F1                                                                                                | F4                                                                                                        |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| K9a old index "in navigation order" (`1-decisions.md:45`)                             | **contradicts** in the pre-tick window: `data()` order ≠ render order under sort, filter or group | keeps                                                                                                     |
| K9b nearest visible ancestor (`:46`; collapse specs `create-table.spec.ts:1594-1647`) | **contradicts**: a data seed has no `depth`/`isExpanded`, so the walk fails                       | keeps                                                                                                     |
| K9c follow id (`:47`)                                                                 | keeps                                                                                             | keeps                                                                                                     |
| K9d DOM focus only when inside (`:48`)                                                | unaffected                                                                                        | unaffected                                                                                                |
| K9e column old index (`:53`)                                                          | approximate: `baseColumns()` includes hidden columns                                              | keeps                                                                                                     |
| K12 engine keeps focus valid; "ADR-0006 removal hook" (`:49`)                         | keeps                                                                                             | keeps (K12's hook wording is stale either way, see ADR-0006 below)                                        |
| K26 `recoverFocus` takes previous `RenderRow[]` (`:74`)                               | **depends on it**: has to fabricate `RenderRow`s                                                  | keeps                                                                                                     |
| K27 edge results (`:75`)                                                              | old-index fallback uses the wrong order                                                           | keeps                                                                                                     |
| K28 group header gone counts as hidden (`:76`)                                        | **contradicts**: group ids are not in `data()`                                                    | keeps                                                                                                     |
| K29 recovery's panel→body write vs follow-focus (`:77`)                               | unaffected                                                                                        | unaffected                                                                                                |
| K30 eager seed (`:78`)                                                                | keeps the letter (one writer, focus not cleared), loses K9a/b in the window                       | **reverses**; matches its "Lazy + `moveTo` seeds" column (`snapshot-timing.md:20-28`) and needs a new row |
| K13/K13b virtual scroll (`:36`, `:51`)                                                | not affected today (not built)                                                                    | not affected                                                                                              |

### 505876a7 accessor hand-off

- **No decision record.** There is no row in `docs/decisions/` (no keyboard or core log; the folder holds columns, expansion, grouping, row-editing, sorting and tree only). No ADR or work-folder doc mentions `pendingAccessorReports` or `withAccessorReports`. The only mentions are code comments: `core.ts:67-69`, `cells.ts:14-17`, `with-sorting/feature.ts:202-204`.
- **Does it assume lazy evaluation?** No. It does assume ordered evaluation:
  - `rows` sets the pending set (`core.ts:73`), and the next `renderRows` evaluation consumes it after reading `rows()` (`core.ts:121-124`).
  - A `rows` evaluation that no `renderRows` consumes (`store.rows()`, `groupIds`, the effect's `core.rows()` at `compose-table.ts:326`) leaves its set pending, to be adopted by a later `renderRows` run over the same `rows` value. That is the same data evaluation, so it is correct.
  - The eager seed just becomes the first producer/consumer pair. None of the 9 failures counts the accessor message, so 505876a7 is not implicated.

### ADR-0006 vs the recovery effect

- **No conflict, and they do not overlap.** ADR-0006 is a contract for _features_ storing `RowId`s, and it diffs `data` (`adr/0006:19-22`; `compose-table.ts:302-314`).
- Recovery has to see render-level disappearance — filter (K9a) and collapse (K9b) — which `indexById` never sees. So it needs its own effect (`compose-table.ts:316-342`).
- K12's "ADR-0006 removal hook" (`1-decisions.md:49`) does not describe what shipped. The doc should be updated.
- Both effects seed outside the effect. `previousIds` reads only `indexById` (data + `trackBy`, `compose-table.ts:303`) and runs no consumer callbacks. K30 cites it as precedent ("as `previousIds` is", `snapshot-timing.md:7`), but that precedent is a data-only seed, which is F1, not what K30 built.
- On a data deletion with `withExpansion()`, the `onRowsRemoved` effect is created first (`:304` before `:323`). The recovery effect tracks `store.expansion()` (`:328`), so it re-runs if pruning lands after it.

### Capability log

There is no `docs/decisions/keyboard.md`. `1-decisions.md:4-5` states this on purpose
(`capabilityLogPath: null`, a table-wide model).

## Unverified

- The `git diff origin/main...HEAD` was not run, and the PR's own commit list was not walked. The "introduced by this PR" claim rests on `main`'s `compose-table.ts` having no `previousSnapshot` or recovery effect (WebFetch `main`).
- The commit dca784a5 attribution for nearest-visible-ancestor recovery was not opened. The collapse specs were read at `create-table.spec.ts:1594-1647` instead.
- F1 breaking `:1594`/`:1604` and F4 passing all recovery specs are inferences from tracing `focus.ts`. Nothing was run, by constraint.
- That Angular runs root effects in creation order is an inference, not checked against Angular source.
- HEAD spec text came through WebFetch summaries, not byte-exact reads.

## Sources

|     | Source                                                                                                                         | Version           | Verified                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ----------------------------------------------------------------- |
| R1  | libs/table/src/engine/compose-table.ts:88-117                                                                                  | HEAD              | yes — read                                                        |
| R2  | libs/table/src/engine/compose-table.ts:302-342                                                                                 | HEAD              | yes — read                                                        |
| R3  | libs/table/src/engine/core.ts:67-141                                                                                           | HEAD              | yes — read                                                        |
| R4  | libs/table/src/engine/cells.ts:14-34                                                                                           | HEAD              | yes — read                                                        |
| R5  | libs/table/src/engine/focus.ts:68-181                                                                                          | HEAD              | yes — read                                                        |
| R6  | libs/table/src/api/features/with-tree/nest.ts:56-203                                                                           | HEAD              | yes — read                                                        |
| R7  | libs/table/src/api/features/with-tree/feature.ts:26-36                                                                         | HEAD              | yes — read                                                        |
| R8  | libs/table/src/api/features/with-tree/feature.ts:250-271                                                                       | HEAD              | yes — read                                                        |
| R9  | libs/table/src/api/features/with-grouping/feature.ts:217-238                                                                   | HEAD              | yes — read                                                        |
| R10 | libs/table/src/engine/grouping/render.ts:31-112                                                                                | HEAD              | yes — read; corrected "dedup in one place" (two separate sets)    |
| R11 | libs/table/src/engine/grouping/clusters.ts:98-146                                                                              | HEAD              | yes — read                                                        |
| R12 | libs/table/src/directives/ngp-table.directive.ts:84-113                                                                        | HEAD              | yes — read                                                        |
| R13 | libs/table/src/api/features/with-sorting/feature.ts:202-204                                                                    | HEAD              | yes — read                                                        |
| R14 | libs/table/src/api/create-table.spec.ts:1421-1647                                                                              | HEAD (unmodified) | yes — read                                                        |
| R15 | libs/table/src/engine/columns-schema/wire-columns-schema.spec.ts:39-43                                                         | local             | yes — read                                                        |
| R16 | libs/table/docs/3-ui/work/keyboard/active/treegrid-keyboard-model/1-decisions.md:1-78                                          | HEAD              | yes — read in full                                                |
| R17 | libs/table/docs/3-ui/work/keyboard/active/treegrid-keyboard-model/discovery-recovery-snapshot-timing.md                        | HEAD              | yes — read                                                        |
| R18 | libs/table/docs/3-ui/work/keyboard/active/treegrid-keyboard-model/tasks/issue-235/step-3-keys-click-dom-focus.test-plan.md:136 | HEAD              | yes — grep line                                                   |
| R19 | libs/table/docs/adr/0006-row-id-state-reconciliation.md                                                                        | HEAD              | yes — read                                                        |
| R20 | libs/table/docs/adr/0014-runtime-error-policy.md                                                                               | HEAD              | yes — read                                                        |
| R21 | libs/table/docs/decisions/ (glob)                                                                                              | HEAD              | yes — no keyboard log                                             |
| S1  | https://raw.githubusercontent.com/DvirMon/ng-table/1a44bd19/libs/table/src/api/features/with-tree/feature.spec.ts              | 1a44bd19          | yes — WebFetch; confirmed no `mockClear` in G/H/I/J/O             |
| S2  | https://raw.githubusercontent.com/DvirMon/ng-table/1a44bd19/libs/table/src/api/features/with-filtering/feature.spec.ts         | 1a44bd19          | yes — WebFetch                                                    |
| S3  | https://raw.githubusercontent.com/DvirMon/ng-table/1a44bd19/libs/table/src/api/features/with-grouping/feature.spec.ts          | 1a44bd19          | yes — WebFetch; spy after construction, so the seed was ruled out |
| S4  | https://raw.githubusercontent.com/DvirMon/ng-table/1a44bd19/libs/table/src/engine/columns-schema/wire-columns-schema.spec.ts   | 1a44bd19          | yes — WebFetch                                                    |
| S5  | https://raw.githubusercontent.com/DvirMon/ng-table/1a44bd19/libs/table/src/directives/ngp-table.directive.spec.ts              | 1a44bd19          | yes — WebFetch                                                    |
| S6  | https://raw.githubusercontent.com/DvirMon/ng-table/main/libs/table/src/directives/ngp-table.directive.spec.ts                  | main @ 2026-10-29 | yes — WebFetch; the test exists on main and expects body          |
| S7  | https://raw.githubusercontent.com/DvirMon/ng-table/main/libs/table/src/engine/compose-table.ts                                 | main @ 2026-10-29 | yes — WebFetch; no recovery effect or seed on main                |
