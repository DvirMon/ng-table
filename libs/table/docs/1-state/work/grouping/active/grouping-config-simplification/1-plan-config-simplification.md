---
title: Plan — simplify `WithGroupingConfig` to `{ initial, when, schema }`
type: plan
status: Phase A largely landed 2026-09-17; partly superseded by 2-decisions.md D1. Phase B gated on ADR-0019's inference spike.
date: 2026-09-17
audience: developers
---

# Simplify `withGrouping()` configuration

> **Amended 2026-09-17 — read [`2-decisions.md`](2-decisions.md) first.**
> Step 4's claim that the base+overlay contract (D6/D7) "is **not** deleted" no longer holds:
> `5ecc437` replaced the overriding fold with a mask, so `initial` declares the levels and their
> nesting order and rules only gate them. That also dissolves Step 8's sync/async call-order bug
> (entry order no longer decides anything) and retires D7's accepted write-shadowing consequence.
> Steps 1–3 and 5 are unaffected.

## Context

`WithGroupingConfig` has five fields, three of which compile to the same
`() => string[] | undefined` slot: `groupingRule`, `rules`, `schema`.
`with-grouping.spec.ts:1420` asserts all three "produce the same fold for
equivalent rules" — three public spellings of one mechanism. The story
corpus reaches for none of them except as an ordering vehicle: 6/6 hosts
declare levels with `initial`, `groupingRule` has zero call sites outside
its own definition, and the one `schema:` use carries nothing but
`applyGroupOrder`.

That layering is the complexity, not the three declarative functions.

Two decisions taken while planning:

**`applyGroupOrder` stays standalone.** It was considered for merging into
`applyGrouping` as a third `order` slot beside `enable`/`when`. Rejected:
`order` is orthogonal to _how_ a level was activated, so a merge forces it
onto `GroupingAsyncOpts` too — a 6th field with no relation to the async
machinery, and [`design-group-admission.md`](../../archive/with-grouping/design-group-admission.md)'s
own example orders an async-activated level. It also makes
`applyGrouping(path.x, { order })` declare no level in the
`initial`-driven case, which the usage data says is the dominant one.
Issue #87 Step 1's finding holds: admission and ordering are different
engine slots.

**`enable` becomes optional.** This is the change worth making, and it is
independent of the merge question. Today `enable` is required, so
attaching a per-column `when` with no activation opinion requires
`enable: () => undefined` — which abstains the _entire rule set_, not just
that column. `grouping-static-story-host.component.ts:117-125` ships that
hack today with the comment `// Abstain: never affect level activation`.
It works only because that rule is alone; adding one real `enable` rule
beside it would silently freeze grouping at `initial` forever.

Endpoint: `WithGroupingConfig` is `{ initial, when, schema }`, with
`schema` the single declarative entry. Phase A gets three of the four
fields there without blocking on anything. Phase B is gated on
[ADR-0019](../../../../../adr/0019-columns-path-keyed-by-declared-column-ids.md).

---

# Step 0 — commit issue #87 first (precondition)

Issue #87's work is **entirely uncommitted**: 14 modified files,
~278 insertions, plus its untracked task folder. Phase A's first three
steps rewrite `grouping-schema.types.ts`, `engine/grouping-rules.ts` and
`with-grouping.ts` — all three already carry #87 changes. Starting Phase A
on this tree makes the two efforts' diffs inseparable and leaves no revert
point if the `enable` change goes wrong.

The tree holds three unrelated concerns. Commit as three, not one:

**1. Issue #87 — order groups per column.** The 14 modified files plus
`../../archive/with-grouping/docs/tasks/issue-87-group-order-per-column/`.
Its `progress.md` reads `7 / 7 complete`, and the Step 7 doc edits
(`grouping.md`, `3-spec.md`, `design-group-admission.md`,
`issue-graph.md`, `state.json`) are part of the same landing.

**2. ADR-0019**
([`0019-columns-path-keyed-by-declared-column-ids.md`](../../../../../adr/0019-columns-path-keyed-by-declared-column-ids.md),
untracked). A proposed ADR, not part of #87 — it is Phase B's input. Its
own docs commit.

**3. `docs/work/adr-scope-audit/`** (untracked). Belongs to neither. Commit
separately or leave it out; do not let it ride along in the #87 commit.

Before committing #87, confirm it is actually green — the task folder's
`progress.md` records that the suite was **not** run locally (repo policy
is per-step typecheck, CI is the real gate), and that Step 3 broke two
reference-identity tests before Step 6 caught and fixed them:

```bash
nx run shared-table:typecheck
nx run shared-table:typecheck-spec
nx test shared-table
```

Phase A does not start until #87 is committed.

---

# Phase A — ship now, not gated

## Step 1 — `enable` becomes optional

`libs/table/src/schema/grouping-schema.types.ts:11-17`

```ts
export interface GroupingRule<TRow = unknown> {
  readonly kind: 'grouping';
  readonly columnId: string;
  /** Omitted: this rule contributes no level activation — it carries only
   * `when`. Present and `undefined` (pending) still makes the whole rule
   * set abstain. */
  readonly enable?: () => boolean | undefined;
  readonly when?: GroupWhen<TRow>;
}
```

`libs/table/src/schema/grouping-rules.ts:13-23` — `applyGrouping`'s opts
become `{ enable?: () => boolean | undefined; when?: GroupWhen<TRow> }`.

Update its JSDoc: "Call order = level order" now reads "the Nth call
**that declares `enable`**".

`applyGroupingAsync` is untouched — activation there is `onSuccess`/
`onError`, which stay required
([ADR-0018](../../../../../adr/0018-when-vs-enable-predicate-naming.md)).

## Step 2 — the fold skips rules that declare no `enable`

`libs/table/src/api/features/with-grouping.ts:108-111`

An order-only or `when`-only rule must produce **no** `GroupingRuleEntry`.
If it produced one, `enable` being absent would read as `undefined` and
abstain the whole set — reintroducing the exact footgun this removes.

```ts
const activationRules = rules.filter(isGroupingRule).filter((r) => r.enable);
```

Behavior is preserved at every existing call site. A schema containing
only `applyGroupOrder` calls already yields `ruleEntries.length === 0` →
no overlay → `baseGrouping()`. Rules with no `enable` land in the same
place by the same path.

Amend `foldGroupingRules`'s JSDoc (`engine/grouping-rules.ts:93-102`) —
entry order is call order _of activating rules_.

## Step 3 — construction throw for an empty rule

`applyGrouping(path.x, {})` now typechecks and contributes nothing.
Construction-class error per
[ADR-0014](../../../../../adr/0014-runtime-error-policy.md): deterministic,
fires on first run, no coherent degraded reading. Throw in
`buildGroupingSpec`, beside the existing unknown-column-id throws
(`with-grouping.ts:88-104`):

```
[withGrouping] applyGrouping on column '<id>' declares neither enable nor when.
```

## Step 4 — delete `groupingRule`

Drop the field from `WithGroupingConfig` (`with-grouping.ts:46-50`) and
collapse the `??` (`:114`):

```ts
const grouping = computed(() => rulesGroupingRule?.() ?? baseGrouping());
```

This also closes a live asymmetry: with `config.groupingRule` set today,
`schema`'s _activation_ was dropped while its `when`/`order` still applied
(`collectGroupPredicates`/`collectGroupOrder` run over the full array at
`:125-126` regardless). One less way for the config to half-apply.

The base+overlay contract (D6/D7) is **not** deleted — `string[]`
overrides `initial`, `undefined` abstains and holds it, `[]` is actively
grouped by nothing. It now describes `foldGroupingRules`' output rather
than a consumer lambda. All three outcomes remain reachable from `schema`:
all-`false` → `[]`, any-`undefined` → abstain.

**Consequence to record:** `groupingRule` was the only _reactive_
free-string path to a level id. After Phase B, a column added later via
`setColumns()` is reachable only through `initial` and
`table.grouping.update()` — imperative, not declarative. ADR-0019:29 cites
`groupingRule` as one of three escapes for dynamic columns; that line
needs amending to two.

## Step 5 — migrate the story hack

`libs/table/src/stories/grouping/grouping-static/grouping-static-story-host.component.ts:117-125`

```ts
private buildCategoryMinSizeRule(): GroupingRule<DealRow> {
  return {
    kind: 'grouping',
    columnId: 'category',
    when: (cluster) =>
      !this.applyMinCategorySize() || cluster.rows.length >= this.minCategoryRowCountValue(),
  };
}
```

`enable: () => undefined` and its comment are deleted. Behavior is
identical; the mechanism stops being accidental.

Leave it on `rules:` for now — Phase B moves it to `schema:`.

## Step 6 — specs

`libs/table/src/api/features/with-grouping.spec.ts` — five `groupingRule`
sites go (`:1378`, `:1394`, `:1409`, `:1454-1461`, `:1657`). The
three-equivalent-layers test at `:1420` becomes a two-layer test. Rewrite
each to its `schema`/`rules` equivalent rather than deleting the
behavior — `() => []` and the abstain case are D6/D7 contract coverage and
must survive the move.

New cases:

- `applyGrouping(path.x, { when })` with no `enable` — does not enter the
  fold, `initial` holds, `when` still applies (this is Step 2's contract).
- `applyGrouping(path.x, {})` throws at construction.
- One activating rule beside one `when`-only rule — the `when`-only rule
  does not abstain the set. This is the footgun regression test.

`libs/table/src/schema/grouping-rules.spec.ts` — recording case for the
optional-`enable` shape.

## Step 7 — docs

- [`../../archive/with-grouping/3-spec.md`](../../archive/with-grouping/3-spec.md)
  — config block at `:172-179` drops `groupingRule`, and `rules` → pending;
  amend D6/D7 to describe the fold's output, not a consumer lambda.
  (Also still spells the table-wide predicate `groupWhen` at `:174` —
  stale since ADR-0018 renamed it to `when`. Fix while there.)
- [`../../../../features/grouping.md`](../../../../features/grouping.md) —
  same config summary. Separately stale: `:98` shows
  `withGrouping({ manual: true })`, which is not a real key.
- [ADR-0018](../../../../../adr/0018-when-vs-enable-predicate-naming.md) —
  the `enable`/`when` pairing description assumes `enable` is required.
- [ADR-0019](../../../../../adr/0019-columns-path-keyed-by-declared-column-ids.md)
  — amend `:29` (escapes for dynamic columns), and close Open question 2
  ("Does `groupingRule` survive?") as **no**.
- `libs/table/CLAUDE.md` — the `when` vs `enable` bullet cites
  `applyGrouping({ enable, when })`.
- `npm run llms` must stay clean (`npm run llms:check`).

## Step 8 — separable: sync/async call-order bug

**Flagged, not required. Drop it if you want Phase A minimal.**

`with-grouping.ts:108-111` builds entries as `[...sync, ...async]`, so a
schema interleaving `applyGrouping` and `applyGroupingAsync` does not get
true call order — async levels are pushed to the end. This contradicts
`schema/grouping-rules.ts:7-12`'s documented contract. Step 2 edits
exactly this expression, so fixing it is nearly free: map over `rules` in
recorded order, dispatching per kind, instead of two filtered passes.

---

# Phase B — gated on ADR-0019 (sketch only)

Blocked on [ADR-0019](../../../../../adr/0019-columns-path-keyed-by-declared-column-ids.md)'s
Open question 1: `TId` must infer from `createTable()`'s argument 2 and
flow into argument 3's contextual type. The existing `NoInfer<In>` in
`withGrouping()`'s second overload is evidence of prior inference trouble
in that position.

Once the spike resolves:

- Re-key `ColumnsPath` by literal ids declared in `TableConfig.columns`,
  recovered as `ColumnIdOf<S>` the way `RowOf<S>` recovers the row type.
- Delete `rules` from `WithGroupingConfig`. `schema` is the single
  declarative entry; config reaches `{ initial, when, schema }`.
- Migrate the two remaining `rules:` stories (`grouping-static` from
  Step 5, `grouping-async-rule`) and ~8 spec sites.
- Decide ADR-0019 Open question 3 — whether `schema` accepts a pre-built
  `GroupingSchema` value for cross-table reuse, mirroring
  `TableConfig.columnsSchema?: ColumnsSchemaFn<TRow> | ColumnSchema<TRow>`.
  This is the only thing `rules` did that nothing else covers.

---

# Verification

Static, no processes started:

```bash
nx run shared-table:typecheck
nx run shared-table:typecheck-spec
```

Both targets, and `typecheck` twice if the first run reports `.ts` errors
— `ngc` aborts before the template phase, so a run with source errors
checked no templates
(`.claude/rules/typecheck-angular-templates.md`).

Then worth running yourself:

- `nx test shared-table` — the D6/D7 coverage moved in Step 6 is the part
  most likely to have lost meaning in translation.
- Storybook, `grouping-static`: the min-category-size toggle still
  dissolves small category clusters, and the `keepBlankRegionsFlat`
  toggle still works alongside it. That pair is the Step 5 migration.
- Storybook, `grouping-regressions`: all five `groupOrder` modes still
  order, including `throwing` falling back to pre-sort order.

## Behavior that must not change

Every existing call site is expected to be untouched in behavior. The two
paths worth asserting explicitly:

- A schema containing only `applyGroupOrder` calls → no overlay →
  `grouping` is `initial`. (`grouping-regressions`)
- A `when`-only rule → no overlay → `grouping` is `initial`, `when` still
  applies per column. (`grouping-static`, post-Step-5)
