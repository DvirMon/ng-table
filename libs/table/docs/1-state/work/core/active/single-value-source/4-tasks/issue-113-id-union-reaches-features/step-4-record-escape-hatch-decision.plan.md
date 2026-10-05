# Step 4 — Record the escape-hatch decision

**PR scope:** standalone. **Depends on:** Step 3 (the decision is written
from what its `composeFeatures` case proved, not ahead of it).

**Task type:** docs

**Skills used:** —

**Scaffolding agent:** main thread, no agent

## Files

- `libs/table/docs/1-state/work/core/active/single-value-source/decisions.md`
  (edit)
- `libs/table/docs/adr/0019-columns-path-keyed-by-declared-column-ids.md`
  (edit)
- `libs/table/docs/1-state/work/core/active/single-value-source/issue-graph.md`
  (edit)

## Why This Step Exists

AC #4 asks for a recorded decision on the arity escape hatch: _either it
carries the union or a composed feature cannot name a column — say which,
and why._ The epic's `decisions.md` names the same thing under Risks
carried — _"`compose-features.overloads.ts` has no `TRow` and no `TId`
(`:11-21`). K1 must decide whether the arity escape hatch carries the
union or drops it."_

That risk is now answered, and the answer is the cheap one: nothing
changed. A record saying so is worth more than the two-line diff it
describes — the next reader looking at
`compose-features.overloads.ts` will see a file with no `TId` in it and
reasonably assume the union was dropped.

ADR-0019's Open 1 is the other half. Its spike is recorded as _"Resolved:
it works"_ and then _"Moot as of the Amendment … Kept as the record that it
does work, should a future surface need it."_ That future surface is now
shipped and spec'd. The ADR should say so, so nobody re-runs a spike whose
result is sitting in a spec file.

## What To Do

**1. `decisions.md` § "Questions settled while sequencing" — add one
entry.** It must state, in this order:

- **The answer.** The arity escape hatch carries the declared column-id
  union. `composeFeatures()` needed no change.
- **The mechanism.** `ComposeFeaturesOverloads` is generic in
  `In extends Shape`, and `In` is bound at the call site to the concrete
  `TableStore<TRow, TId> & O1 & …` that the enclosing `createTable()` slot
  supplies. `ColumnIdOf<In>` recovers structurally off that intersection,
  so the union survives the composite without the generator ever naming
  `TId` there.
- **The evidence.** Case 4 of `api/create-table.types.spec.ts` (Step 3) —
  a column-naming probe inside a `composeFeatures()` bundle, asserting both
  the literal union and the typo rejection.
- **What reopens it.** A composite that must name a column _without_ an
  enclosing `createTable()` call to bind `In` — there is no such caller
  today. That would need `TRow`/`TId` on `COMPOSE_FEATURES`'s
  `baseGenerics`, which is a materially bigger change.

**2. `decisions.md` § "Risks carried" — retire the second bullet.**
The `compose-features.overloads.ts` risk is discharged. Rewrite it to point
at the settled entry rather than deleting it outright, so the risk register
still reads as a history of what was live.

**3. `decisions.md` § "Acceptance" — mark the K1 line satisfied** and name
the file that satisfies it (`api/create-table.types.spec.ts`), so the
acceptance list points at an artifact instead of a description.

**4. ADR-0019 § Open, item 1 — add a closing line.** State that the
recovery the spike tested is shipped as `ColumnIdOf<S>` in
`engine/types.ts` and asserted in `api/create-table.types.spec.ts`, under
[#113](https://github.com/DvirMon/ng-table/issues/113). Do not rewrite the
"Moot" paragraph above it — that is history and stays. Add the line, keep
the record additive.

**5. `issue-graph.md` — move `#113` to closed** once the other three steps
have landed, and add one line to § Summary noting that `#114`, `#115` and
`#100` are no longer gated on the id union.

## Implementation Notes

- **The decision belongs in the workspace's `decisions.md`, not in
  ADR-0019.** That ADR's own scope note says it owns one decision — how
  `ColumnsPath` is keyed. How the union travels through the arity escape
  hatch is plumbing, and the epic's log is where the epic's plumbing calls
  live. ADR-0019 gets a pointer line, nothing more.
- **No status in `CLAUDE.md`.** Nothing about #113's state goes into any
  always-loaded file
  (`.claude/rules/claude-md-no-implementation-status.md`).
- **Write the entry for someone who has not read this plan.** It should
  stand alone: the answer, the mechanism, the evidence, the reopening
  condition.

## Risks / Watchouts

- **If Step 3's case 4 failed**, everything above is written the other way
  round: the escape hatch _drops_ the union, Step 2 reopens to add
  `TRow`/`TId` to `COMPOSE_FEATURES`, and this entry records that instead.
  Write what the spec actually proved.
- **`npm run llms:check` reads the public surface.** `ColumnIdOf` is a new
  export from `engine/types.ts`; confirm whether it belongs in the public
  barrel (`src/index.ts`) before regenerating. A feature author outside the
  lib needs it to type a column-naming config — that is ADR-0020's
  third-party case — so the likely answer is yes, and that is itself worth
  a line in the decisions entry.

## Non-Goals

- **No ADR for the cross-cutting schema-fn rule.** ADR-0019's 2026-09-20
  amendment says _"every schema fn names declared columns"_ is still owed
  its own ADR. That is
  [#116](https://github.com/DvirMon/ng-table/issues/116)'s, not this
  step's.
- **No edits to `docs/decisions/grouping.md`** or any capability doc — no
  capability's contract changed here.
- **No epic-level docs pass.** Node D2 in `decisions.md` owns
  `1-state/features/*` and the `llms.txt` regen for the whole epic.

## Acceptance Checks

- [ ] `decisions.md` carries the settled entry with all four parts
      (answer, mechanism, evidence, reopening condition).
- [ ] The `compose-features.overloads.ts` risk bullet points at it.
- [ ] ADR-0019 Open 1 carries the closing line, with the "Moot" paragraph
      intact above it.
- [ ] `issue-graph.md` shows `#113` closed and the summary updated.
- [ ] `npm run llms:check` clean.
- [ ] Every link added in this step resolves — relative paths from each
      file's own directory.

---

← [Step 3: The literal-union guard](step-3-literal-union-guard.plan.md)
