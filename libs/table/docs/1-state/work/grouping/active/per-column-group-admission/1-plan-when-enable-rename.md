---
title: Plan — rename grouping's predicates to the `when`/`enable` convention (#86)
type: plan
status: decided 2026-09-17, not executed. Convention settled; rename + ADR-0018 pending.
date: 2026-09-17
audience: developers
---

# Rename grouping's two rule predicates to the `when`/`enable` convention

## Context

`withGrouping()` carries two unrelated predicates whose names collide conceptually:

| Field | Signature | Driven by | Scopes |
|---|---|---|---|
| `when` | `() => boolean \| undefined` | outside component state (zero-arg) | per-column only |
| `groupWhen` | `(cluster: ClusterSummary<TRow>) => boolean` | cluster data | per-column **and** table-wide |

Level activation (`when`) asks *is this column a grouping level*; admission (`groupWhen`) asks
*did this built cluster earn a header, or does it dissolve to flat rows*. Full design context:
[`design-group-admission.md`](../../archive/with-grouping/design-group-admission.md)
— "The surface", "Combining the two scopes".

Table-wide `groupWhen` shipped in #85 (commit 2bc86a6). Per-column `groupWhen` is #86,
currently **uncommitted** in the working tree (`schema/grouping-rules.ts`,
`grouping-schema.types.ts`, `engine/grouping-rules.ts` `collectGroupPredicates`,
`engine/grouping.ts` `columnGroupWhen`, + specs + the `grouping-static` story).

**The convention, as decided 2026-09-17:**

- **`when`** is the keyword for any dynamically-toggled conditional on a feature — data-driven
  or external-state-driven. One `when` serving both sources is the default and stays.
- **`enable`** appears *only* where a feature must **separate** a data condition from an
  external-state condition. Grouping is the only such feature: two orthogonal predicates sit on
  one rule object, so they cannot share a name.

Applied: admission is the data condition → `when` (both scopes). Activation is the
external-state condition → `enable`.

Deliberately unchanged, because one `when` covers both sources there:
`applyVisible({ when: (ctx: ColumnRuleContext<TRow>) => boolean })` (`schema/column-rules.ts:17`)
and `FilterOptions.when` (`filters/types.ts:21`).

Intended outcome: `when` means the same thing everywhere in the public API, and grouping's
external-state gate stops competing for the word.

## Rename map

| Site | From | To |
|---|---|---|
`WithGroupingConfig` (`api/features/with-grouping.ts:50`) | `groupWhen` | `when` |
`GroupingRule` (`schema/grouping-schema.types.ts:14`) | `when` | `enable` |
`GroupingRule` (`:16`) | `groupWhen` | `when` |
`GroupingAsyncRule` (`:38`) | `groupWhen` | `when` |
`GroupingAsyncOpts` (`schema/grouping-rules.ts:35`) | `groupWhen` | `when` |
`applyGrouping` opts (`:15`) | `{ when, groupWhen }` | `{ enable, when }` |
`ClusterOpts` (`engine/grouping.ts:44`) | `groupWhen` | `when` |
`ClusterOpts` (`:46`) | `columnGroupWhen` | `columnWhen` |

`GroupingAsyncRule` has **no** `when` — its activation is `onSuccess`/`onError`. Do not add
`enable` to it; only its admission field renames.

### The type name `GroupWhen<TRow>` stays

`api/types.ts:126`, public via `index.ts:9`'s `export * from './api/types'`. It still reads
correctly as the group-admission predicate type, and keeping it holds ~97 `GroupWhen`-cased
occurrences out of scope: `evaluateGroupWhen`, `reportGroupWhenError`, and the
`GroupWhenMockRow`/`mockGroupWhenRows`/`mockGroupWhenTrackBy`/`groupWhenColumns` fixtures
(`table.mock.ts:85-102`) all keep their names.

Trade, stated: grepping `groupWhen` still hits live identifiers after the field is gone. Accepted
— it is the cheapest cut, and `GroupAdmission<TRow>` remains available later as an isolated
follow-up. The two `ClusterOpts` members are the exception because they mirror the config object
directly.

## Code changes

Rename the fields, then fix what reads them. All within `libs/table` — the inventory
confirms zero references in `apps/` or any other lib.

**Declarations** — `schema/grouping-schema.types.ts`, `schema/grouping-rules.ts` (both
`applyGrouping` and `applyGroupingAsync` record sites), `api/features/with-grouping.ts:50`,
`engine/grouping.ts:42-47`.

**Readers** — `engine/grouping-rules.ts`: `rule.when()` → `rule.enable()` inside
`buildGroupingRuleEntries` (`:47`); `collectGroupPredicates` reads `rule.groupWhen` → `rule.when`
(`:112-113`). `engine/grouping.ts`: `admitClusters`' params and the three threading call sites
(`:281-287`, `:400`, `:471-477`), plus the `evaluateGroupWhen` calls at `:150-156`.
`api/features/with-grouping.ts:130-136` builds `ClusterOpts` from config.

**Two runtime error strings must change — they name the fields in user-facing output:**

- `engine/grouping-rules.ts:35` — `a groupingRule 'when' predicate threw` → `'enable'`
- `engine/grouping.ts:99` — `groupWhen threw for column` → `when threw for column`

Specs assert that reporting happens (`engine/grouping.spec.ts:266+`,
`api/features/with-grouping.spec.ts:1750+`) — check whether they match on message text.

**Specs** — `schema/grouping-rules.spec.ts`, `engine/grouping-rules.spec.ts`,
`engine/grouping.spec.ts`, `api/features/with-grouping.spec.ts` (largest: 27 `groupWhen` + 19
grouping-`when` occurrences, concentrated in `describe('groupWhen (#85 table-wide admission)')`
at `:1679`, `:1847`, `:1875`, and the rules/schema blocks at `:1364-1632`). Rename the `describe`
labels too.

**Story** — `grouping-static` only; every other grouping story has zero occurrences.
`grouping-static-story-host.component.ts:62-66` (table-wide) and `:117-125` (the hand-built
per-column rule using both fields), plus description prose in `grouping-static.stories.ts:42,48,58,67`
and `grouping-static-story-host.component.html:77`.

## Docs

**Live** — `docs/1-state/features/grouping.md:58-59` (the only live doc naming either field).

**Active work docs** — `work/grouping/active/column-group-index/2-decisions.md:143,160` (both cite
`GroupingRule.when` as the activation field → `GroupingRule.enable`);
`work/sorting/active/per-column-config-placement/1-plan-sorting.md:48,80` (cites
`applyGrouping.when`); `docs/2-columns/architecture.md:125` (pending-semantics table row).

**Canonical design doc** — `work/grouping/archive/with-grouping/design-group-admission.md`: update
the terminology in "The surface", "Rules", "Combining the two scopes", and the
"`groupWhen` does not flow through `foldGroupingRules`" heading. It is archived but is what #86
is built from, so stale names there are actively misleading. Add a dated line to its frontmatter
`status:` recording the rename.

**Leave alone** — the archived `issue-84-*` / `issue-85-*` step plans and `progress.md` files
(historical record of what shipped under the old names), and the
`issue-85-group-when-table-wide/` directory name. Renaming a shipped task folder breaks the
cross-links at `step-2-…:147` and `step-4-tests.plan.md:124` for no gain.

## Record the convention

It governs future features, not just grouping, so it needs a durable home:

1. **New ADR** — `docs/adr/0018-when-vs-enable-predicate-naming.md` (next free number; 0009 is
   already absent from the sequence). Decision: `when` for any dynamic conditional; `enable` only
   to separate an external-state condition from a data condition on the same rule. Consequences:
   `applyVisible`/`FilterOptions` keep a single `when`; a future `applySortable()` (#100) gets
   `when` unless it needs the same two-source split.
2. **Pointer in `libs/table/CLAUDE.md`** — one line under "Naming conventions — internal
   state and type narrowing", citing the ADR. Conventions only, no status.
3. **#85 API break, recorded** — table-wide `groupWhen` → `when` breaks a merged public API.
   Pre-1.0, single in-repo consumer (`grouping-static` + specs), no deprecation window — the same
   trade `design-group-admission.md` took for removing `WithGroupingConfig.groupOrder`. State it
   in the #86 PR body and in the ADR's consequences.

## Verification

```bash
nx run shared-table:typecheck
nx run shared-table:typecheck-spec
```

Two targets, and `ngc` aborts at the first `.ts` error before reaching templates — a run with
source errors checked no template. Fix, re-run, confirm the second run is clean.

```bash
nx test shared-table
```

Then confirm the rename left nothing behind:

```bash
grep -rn "groupWhen" libs/table/src
```

Expected survivors only: `GroupWhen` type references, `evaluateGroupWhen`,
`reportGroupWhenError`, the `table.mock.ts` fixtures, `groupWhenColumns`. Any lowercase
`groupWhen:` field or `.groupWhen` access is a miss.

Storybook check on `grouping-static`: `keepBlankRegionsFlat` still dissolves the blank-region
cluster (table-wide `when`), and `applyMinCategorySize` + `minCategoryRowCount` still dissolve
small category clusters (per-column `when`), AND-combined. Both toggles are the only end-to-end
proof the two scopes still wire.
