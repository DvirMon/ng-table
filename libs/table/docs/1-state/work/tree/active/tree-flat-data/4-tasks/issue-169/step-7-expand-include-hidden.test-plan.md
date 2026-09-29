# Step 7 test plan — expand() scans the filtered view; `includeHidden` scans all data

Step: [step-7-expand-include-hidden.plan.md](step-7-expand-include-hidden.plan.md)
Trimmed: none. C's "why" narrowed to what `with-tree.spec.ts:172` (`expand(ids)` adds exactly those ids) does not cover.
Spec file: `libs/table/src/api/features/with-tree/feature.spec.ts`
(new nested `describe('filtered view (#169 D8)')` inside `describe('flat data — parentId (#167)')`, next to seam F and the `hasChildren follows the filtered view` test. Reuses `makeFlatRows()` / `FlatRow` from `table.mock.ts` and `inContext()`.)

Shared fixture for every seam:
`createTable(signal(makeFlatRows()), { trackBy: 'id', columns }, withTree({ parentId: (row) => row.parentId }), withFiltering({ schema: (path) => ({ name: contains(path.name) }), includeDescendants: false }))`, then `store.filters.name().value.set('One')`.
- Only c1 (`'C Child One'`) matches, and the filter keeps its ancestor r1.
- So `rows()` = [r1, c1]. g1, c2 and r2 are hidden.
- In the filtered view only r1 has a child. In `data()`, both r1 and c1 have children (c1 has g1).
- `columns` is built without a type annotation, as in the existing `hasChildren` filter test, so `path.name` keeps its literal id.

## Stubs (red phase)
- `export type TreeWriteOptions = ExpansionWriteOptions & { includeHidden?: boolean }` in `with-tree/types.ts`. A type, so no body to stub.
- `TreeSlice.expand(ids?: readonly RowId[], options?: TreeWriteOptions): void`. Red changes only the signature. The body keeps working and ignores `includeHidden`. It must not throw `not implemented`: `expand` already exists, and a throwing body would break about 10 existing tests.
- Without the wider signature, `{ includeHidden: true }` fails the excess-property check and seams B and C would not compile.

## Seams — in red-green order
### A. Filter active, `expand()` with no ids → opens only rows that are expandable in the filtered view
- Test: `it('expand() with no ids while filtered opens only rows expandable in the filtered view — c1, whose only child is hidden, stays closed (D8)')`
- Asserts: `[...store.tree()].sort()` equals `['r1']`
- Why this seam: pins the default of story 32. This step changes the exact line that picks the scan source (`input.rows()` vs `input.value()`). A reversed condition, or a default that reads `value()`, would open c1 and give `['c1', 'r1']`. No existing test pins scan-while-filtered: `with-tree.spec.ts:153` and `:792` run without a filter, and `:767` pins the render stage, not the discovery walk.
- Order reason: independent, the base case. **It passes in red by design** — a regression guard for green and the baseline B contrasts with.

### B. Filter active, `expand(undefined, { includeHidden: true })` → opens every expandable row in `data()`, including one whose children are all hidden
- Test: `it('expand() with includeHidden and no ids scans all of data() — c1 opens although its child g1 is filtered out (D8)')`
- Asserts: `[...store.tree()].sort()` equals `['c1', 'r1']`
- Why this seam: the new behaviour (story 33). Fails if the flag is ignored, or read but the walk still runs over `rows()`.
- Order reason: builds on A. Same fixture, only the flag changes.

### C. `expand(ids, { includeHidden: true })` → uses exactly those ids; the flag has no effect
- Test: `it('includeHidden has no effect when ids are given — expand([\'c2\'], { includeHidden: true }) opens exactly c2')`
- Asserts: with the filter active and nothing open, `[...store.tree()]` equals `['c2']`
- Why this seam: `with-tree.spec.ts:172` already pins that `expand(ids)` adds exactly those ids. This seam adds only the flag's precedence: it catches a branch that checks `includeHidden` before `ids` (e.g. `options?.includeHidden ? discover(value()) : ids ?? discover(rows())`), which would open `['c1', 'r1']`. c2 is hidden on purpose, so the test also proves explicit ids are not trimmed to the visible rows.
- Order reason: builds on B. **It passes in red** (the unchanged body already ignores the flag) — expected, it guards green against the precedence mistake.

## Types phase (written in red, proven by green's typecheck)
None — no public type surface to pin. Seams B and C fail to compile if `expand` does not accept `{ includeHidden: true }`.

## Not tested
- The `TreeWriteOptions` export from `src/index.ts` — a re-export; the typecheck covers it.
- `emitEvent: false` combined with `includeHidden` — `options` is forwarded unchanged. The code agent forwards the rest of the object.
- `includeHidden` on a collapse-only instance — the `discoverExpandableIds` guard returns `[]` first; covered by the existing `expand() with no ids on a collapse-only instance is a no-op` test.
- `isExpandable` combined with `includeHidden` — same walk, different array; same bug as B.
- Broken links under `includeHidden` — walk unchanged; seam O covers it.
- `toggle`/`collapse`/`set` taking `includeHidden` — only `expand` is widened.
- `state` with `includeHidden` — step 8.
- The reveal overlay — these seams assert `tree()`, the open set, which reveal never writes.

## Open questions
- None. Resolved in review: seams A and C are accepted as expected-green-in-red guards.
