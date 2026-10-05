---
title: 'Step 1 — stories/composition/: fixtures + derived-state story host with both derive-block placements'
type: task-step
issue: 77
---

# Step 1 — `stories/composition/`: fixtures + `derived-state` story host with both derive-block placements

**PR scope:** One new feature folder under `src/stories/`: three fixture files and one story
host (class + template). No library code, no `.stories.ts`/`.mdx` (Step 2), no docs (Step 3).

**Task type:** code

**Skills used:** angular-developer, css-styling (only if a local stylesheet is needed — prefer
none, see Implementation Notes)

**Depends on:** — (first step; #36 `withComputed()`, #38 `withFiltering()`, #39
`withSelection()` are on `feat/table`)
**Parallel-safe with:** —

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/stories/composition/fixtures/types.ts` (create — `CompositionRow`)
- `libs/shared/table/src/stories/composition/fixtures/mock.ts` (create — `COMPOSITION_ROWS_MOCK`, `COMPOSITION_DEPT_OPTIONS`)
- `libs/shared/table/src/stories/composition/fixtures/schema.ts` (create — `compositionColumns`, `derivedStateConfig`, `createDerivedStateFilters()`)
- `libs/shared/table/src/stories/composition/derived-state/derived-state-story-host.component.ts` (create)
- `libs/shared/table/src/stories/composition/derived-state/derived-state-story-host.component.html` (create)

## Why This Step Exists

Issue AC 4: "At least one story host demonstrates a derive block inside a feature and one as its
own slot, both readable from the template." No host, demo, or app calls `withComputed()` today
(verified 2026-09-13: zero hits under `src/stories/` and `apps/`). This host is the spec's
headline example running for real — the demo of the whole #33 change.

A new feature folder rather than an edit to an existing host: `selection/multi-selection/` is
uncommitted work owned by the `selection-stories` ticket, and the row-edit hosts prove editing,
not composition. `stories.md` already reserves "one folder per feature"; composition is the
feature here.

## What To Do

1. **Fixtures.** Mirror `selection/fixtures/` in shape, own copy (fixtures are per-feature —
   `stories.md` "shared by this feature's stories, nothing else"):
   - `types.ts`: `CompositionRow { id: RowId; name: string; dept: string }`. No `locked` —
     selectability is not what this story proves.
   - `mock.ts`: ~10 rows across three departments so a dept filter hides some selected rows.
     `COMPOSITION_DEPT_OPTIONS` as a `readonly` tuple for the select.
   - `schema.ts`: `compositionColumns: ColumnDefInput<CompositionRow>[]` (`name`, `dept`),
     `derivedStateConfig: TableConfig<CompositionRow>` (`trackBy: 'id'`, `columns`), and
     `createDerivedStateFilters(): Filters<CompositionRow>` wrapping
     `createFilters<CompositionRow>((path) => { equals(path.dept); })`.
     `filtering/fixtures/probe.ts` shows the exact `createFilters` + `equals` +
     `withFiltering({ filters })` wiring — copy that, don't re-derive it.
2. **Host class** (`ngp-derived-state-story-host`, `templateUrl`,
   `styleUrls: ['../../styles/story-host.css']`):

   ```ts
   protected readonly data = signal<CompositionRow[]>(COMPOSITION_ROWS_MOCK);
   protected readonly filters = createDerivedStateFilters();

   protected readonly table = createTable(
     this.data,
     derivedStateConfig,
     withFiltering({ filters: this.filters }),
     withSelection(
       {},
       withComputed((store) => ({
         hiddenSelected: computed(() => {
           const visibleIds = new Set(store.renderRows().map((row) => row.id));
           return [...store.selectedRows()].filter((id) => !visibleIds.has(id)).length;
         }),
       })),
     ),
     withComputed((store) => ({
       visibleSelected: computed(() => store.selectedRows().size - store.hiddenSelected()),
     })),
   );
   ```

   - The inner block sees core + `withSelection()`'s own members only (`with-computed.ts`
     doc-comment) — `renderRows` is core, so "hidden by the active filter" is derivable there
     without seeing `withFiltering()`.
   - The trailing slot reads `store.hiddenSelected` — a derived member declared by an _earlier_
     argument. That cross-feature read is the second half of AC 4 and the thing to keep.
   - No type arguments anywhere. If the implementer finds one is needed to compile, stop and
     report — that is a library regression, not a host problem.
   - Feature order: `withFiltering` first is presentation only (pipeline order is fixed, spec
     "What changes semantically"); keep it first so the template's filter select reads
     top-to-bottom with the call.
   - Add `toggleRowSelection(id)` / `isRowSelected(id)` and a `setDeptFilter(value)` that writes
     `this.filters.dept().value.set(...)` / `.reset(null)` for "All". Keep the host lean — no
     event log, no lock buttons; those belong to the selection stories.

3. **Template.** `story-host` block, a hint paragraph, a dept `<select>` bound to the filter,
   a `role="status"` banner reading **both** derived members
   (`{{ table.visibleSelected() }} visible · {{ table.hiddenSelected() }} hidden by filter`),
   then the table over `table.renderRows()` with a checkbox column. Follow
   `selection/multi-selection/…component.html` for the `[checked]` / `[attr.aria-selected]`
   binding recipe and `[attr.aria-label]` on each checkbox.
4. Doc-comment on the class in the existing hosts' register (`stories.md` "The story-host
   component"): what the story proves — two placements, what each can see, the cross-slot
   read — not how the fold works. No decision-number narration.

## Implementation Notes

- Imports go through the relative `api/` paths the sibling hosts use
  (`../../../api/create-table`, `../../../api/features/with-computed`, …), not the barrel.
- `store.selectedRows()` is a `ReadonlySet<RowId>`; `renderRows()[n].id` is a `RowId`. Compare
  ids, never row objects.
- Styling: reuse `.story-host__*` classes. The `selection-story__*` classes are another
  feature's stylesheet — off-limits. If the control cell needs width, a two-line
  `composition-story.css` at `composition/` level is acceptable — same placement as
  `selection/selection-story.css`.
- Explicit return types on every method; no `as`.

## Risks / Watchouts

- If `withSelection({}, withComputed(...))` fails overload resolution with an empty config,
  use the derive-first overload `withSelection(withComputed(...))` — both are shipped
  (`with-selection.ts` lines 205–214). Prefer whichever compiles without a type argument.
- A `hiddenSelected` that reads `store.rows()` instead of `store.renderRows()` compiles and is
  always 0 — `rows` is pre-pipeline. Acceptance check 3 catches it.

## Non-Goals

- `composeFeatures()` in a story — arity escape hatch, not derived state; not part of AC 4.
- `.stories.ts` / `.mdx` — Step 2. `stories.md` — Step 3.
- Touching `selection/` fixtures or hosts.

## Acceptance Checks

- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` → exit 0, and the
      `createTable(...)` call carries no `<…>` type arguments
- [ ] `grep -n "withComputed" derived-state-story-host.component.ts` → 2 call hits (one nested
      inside `withSelection(`, one as a top-level argument)
- [ ] The template binds both `table.hiddenSelected()` and `table.visibleSelected()`
- [ ] `git status --short` lists only the five files in **Files** (plus an optional
      `composition/composition-story.css`)

---

[Step 2: `derived-state.stories.ts` + `derived-state.mdx`](step-2-derived-state-story.plan.md) →
