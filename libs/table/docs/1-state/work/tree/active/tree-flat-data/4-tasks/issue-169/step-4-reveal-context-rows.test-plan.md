# Step 4 test plan — Filter reveal

Step: [step-4-reveal-context-rows.plan.md](step-4-reveal-context-rows.plan.md)
Trimmed: seams D and E merged into one throw-and-report test (same guard, first and second evaluation).
Spec file: `libs/table/src/api/features/with-tree/feature.spec.ts` (new `describe('filter reveal (#169)')` block)

Placement: the tests go in the tree spec, not the filtering spec. To break any of them you would have to change `with-tree/` (`reveal.ts` or the `expandedRows` contribution in `feature.ts`). `withFiltering()` only supplies the context-row slot, and its own spec already pins that slot (#168 step 4, seams B/E).

Fixture: `makeFlatRows()` / `FlatRow` from `table.mock.ts`.
- Input order: `[g1, r1, c1, r2, c2]`.
- Tree: r1 → c1 → g1, r1 → c2, and r2 is a leaf.
- Needle `'Grand'` matches g1 only. The kept rows are g1, r1, c1, and the context rows are {r1, c1}.
- Needle `'Child'` matches c1 and c2. The context rows are {r1}.

Local helper: `setupFiltered(config: Pick<WithTreeConfig<FlatRow>, 'revealContextRow'> = {})`.
- Builds `createTable(signal(makeFlatRows()), { trackBy: 'id', columns }, withTree({ parentId: (row) => row.parentId, ...config }), withFiltering({ schema: (path) => ({ name: contains(path.name) }) }))` inside `inContext`.
- Columns come from `createColumns(noData<FlatRow>(), (col) => [col('name')])` with no return annotation, so `path.name` keeps its literal id.
- `withTree()` goes first on purpose. `withFiltering()` is folded later, so a reveal that reads `ctx.contextRows` in the factory body (which D22 forbids) sees no slot.

Clearing the filter: `store.filters().reset(null)`, as in the filtering spec.

## Stubs (red phase)
- No function stubs. No test imports a symbol this step creates. `reveal.ts` is internal.
- Type-only addition, needed so seams C–D compile: `revealContextRow?: (row: TRow) => boolean` on `WithTreeConfig<TRow>` in `with-tree/types.ts`. In red, nothing reads it.

## Seams — in red-green order

### A. Filter makes rows context rows → they render expanded; open set untouched, `changed` silent
- Test: `it('renders every context row expanded under an active filter without writing the open set')`
- Asserts, after subscribing to `store.tree.changed` and then setting `'Grand'`:
  - `store.renderRows().map(r => r.id)` equals `['r1', 'c1', 'g1']`;
  - `isExpanded` is `true` on r1 and on c1;
  - `[...store.tree()]` equals `[]`;
  - the collected `changed` emissions equal `[]`.
- Why this seam: it catches three bugs:
  - no reveal at all, which gives `['r1']`;
  - reveal read once in the factory body, before `withFiltering()` has contributed the slot (D22), which also gives `['r1']`;
  - reveal written into the open set, the approach D16/D20a reject. That passes the render check but fails on `tree()` and `changed`.
- Order reason: independent. It is the base case. It forces the default predicate and the `expandedRows` union.

### B. Person opened c1 (r1 closed), filter then cleared → their own open set comes back exactly
- Test: `it('restores the person's own open set exactly once the filter is cleared')`
- Asserts, in sequence:
  1. `store.tree.expand(['c1'])`, then set `'Grand'`.
  2. Precondition: the render ids equal `['r1', 'c1', 'g1']`.
  3. `store.filters().reset(null)`.
  4. The render ids equal `['r1', 'r2']`, because r1 is collapsed again and hides c1.
  5. `[...store.tree()]` equals `['c1']`.
- Why this seam: it catches two bugs:
  - a revealed set that does not recompute when the context rows empty (an untracked read or a cached set) — r1 stays open after the clear;
  - a "write on reveal, remove on clear" implementation — it drops c1, which the person opened themselves and which was also revealed.
- Order reason: builds on A.

### C. `revealContextRow` narrower than the default → only matching context rows open
- Test: `it('reveals only the context rows revealContextRow accepts')`
- Asserts: `setupFiltered({ revealContextRow: (row) => !row.parentId })` (roots only), then set `'Grand'`.
  - Render ids equal `['r1', 'c1']`, so g1 stays hidden.
  - r1 `isExpanded` is `true`.
  - c1 `isExpanded` is `false`.
- Why this seam: it catches the predicate ignored (the default reveals everything and g1 shows), inverted, or applied to the wrong row set. It also proves the predicate gets the row object (reads `parentId`), not an id.
- Order reason: builds on A.

### D. Predicate throws → each context row is revealed; one report per evaluation
- Test: `it('reveals a row whose revealContextRow throws and reports once per evaluation')`
- Asserts, with `console.error` spied and restored per case (as in the existing ADR-0014 block):
  - `revealContextRow: () => { throw new Error('boom'); }`, then set `'Grand'` and read `renderRows()`;
  - render ids equal `['r1', 'c1', 'g1']`;
  - `consoleErrorSpy` is called exactly once, and `mock.calls[0][0]` contains `'revealContextRow'`;
  - then set `'Child'` (a different context set, {r1}) and read `renderRows()`: `consoleErrorSpy` has 2 calls.
- Why this seam: it catches:
  - an unguarded call, so the throw escapes `renderRows()`;
  - fallback `false`, which gives `['r1']` and hides the match (the unrecoverable direction, ADR-0014);
  - a report per row, which gives 2 calls on the first evaluation because two context rows threw;
  - a report flag created once in the factory scope, not per evaluation — the first failure would silence every later one.
  The message check catches a report that doesn't name the callback.
- Order reason: builds on C. The guard wraps the predicate call site that C wires.

## Types phase (written in red, proven by green's typecheck)
Placement: the existing in-file `describe('types')` block, next to the `parentId` inference checks.
- `withTree({ parentId: …, revealContextRow: (row) => { expectTypeOf(row).toEqualTypeOf<FlatRow>(); return true; } })` inside `createTable(signal<FlatRow[]>(…), …)`. Pins that `revealContextRow`'s parameter is inferred as `RowOf<In>`, not `any` or `unknown`.
- `expectTypeOf<WithTreeConfig<FlatRow>['revealContextRow']>().toEqualTypeOf<((row: FlatRow) => boolean) | undefined>()`. Pins the return type as `boolean` and the field as optional.

## Not tested
- **`revealContextRow: () => false` disables reveal.** Same bug as seam C (predicate result ignored for a row), and it passes against red.
- **Toggling a revealed row closed / closed-while-revealed.** Steps 5 and 6.
- **`includeHidden` on `expand()` / `state`.** Steps 7–8.
- **`state()` under an active filter.** It reads the open set, and seam A pins that reveal never writes it.
- **`contextRowIds()`.** Step 3.
- **`isContextRow` stamping, and which ids are context rows.** #168.
- **Manual filtering, or no `withFiltering()` composed.** Reveal only reads the slot; the rest of this file's suite runs without filtering and would fail if the empty-slot path broke.
- **The predicate gets the filtered-view row rather than the `data()` row.** Not observable: the filter stage does not clone rows.
- **Reporting with `ngDevMode` false.** The existing seam L pins the file's reporting path as ungated; reviewers check the guard reuses `guardCallback`.
- **Reveal under `withGrouping()`.** Not in this step's outline.

## Open questions
- None. Resolved in review: `() => false` stays folded into C; `reveal.ts`'s internal signature is green's call.
