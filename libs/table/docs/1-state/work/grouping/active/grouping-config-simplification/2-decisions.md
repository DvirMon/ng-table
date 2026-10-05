---
title: Decisions — `initial` declares, rules mask
type: decisions
status: D1–D4 shipped 2026-09-17 (`5ecc437`); D7 shipped 2026-09-18 (uncommitted), reversed by ADR-0024; D5/D8 decided 2026-09-19, D5 built 2026-09-19 (uncommitted); D9 built 2026-09-19 (uncommitted); D10 decided 2026-09-20, deferred to ADR-0024's keying work; D11 decided 2026-09-20 (b/c/d written up as ADR-0027, 2026-09-25; d's resolver placement settled 2026-09-20; a's "sorting is unaffected" reversed 2026-09-20 by #100); D6 open
date: 2026-09-18
audience: developers
---

# Grouping config simplification — decisions

Companion to [`1-plan-config-simplification.md`](1-plan-config-simplification.md). The plan
sequences the work; this file records what was decided and why, including one decision that
**supersedes** part of that plan.

---

- **D1 (2026-09-17) — `initial` declares the levels; rules only gate them. Supersedes D6/D7's
  base+overlay fold.**

  The plan's Step 4 states the base+overlay contract "is **not** deleted". It is. Shipped in
  `5ecc437`.

  Old fold — a resolved rule set **replaced** `initial` outright:

  ```ts
  grouping = rulesGroupingRule?.() ?? baseGrouping(); // ['region'] + rule on category → ['category']
  ```

  New fold — rules mask the declared array:

  ```ts
  grouping = maskGroupingLevels(baseGrouping(), ruleEntries);
  ```

  `initial` now owns two things at once: **which** columns group, and — because it is an array —
  **their nesting order**. A rule contributes one boolean per declared level and nothing else.

  Why: the old shape let a rule introduce a level the consumer never declared, and let a
  late-resolving rule clobber a user's write to `table.grouping`. The second was logged as
  accepted in the archived `2-decisions.md` D7 ("a user's updater write can be clobbered when a
  late-resolving rule stops abstaining"). Under a mask it cannot happen: writes are filtered,
  never replaced. **D7's accepted consequence is retired, not merely mitigated.**

- **D2 (2026-09-17) — call order in a schema fn carries no meaning.**

  The archived D8 established "Call order = group level order; no index config." Reversed. A
  schema fn is declarative; statement sequence is a hidden coupling, where swapping two lines
  silently re-nests the table with nothing at the call site saying so. Nesting order comes from
  `initial` and only from `initial`.

  Consequence: the plan's Step 8 sync/async call-order bug **dissolves**. `[...sync, ...async]`
  produced an entry order that did not match call order — which no longer matters, because entry
  order no longer decides anything. Fix it for tidiness or drop it; it is not a correctness bug
  under D1.

- **D3 (2026-09-17) — a rule naming an undeclared column is inert.**

  It cannot introduce a level, in either direction. This matches the two neighbouring rule kinds,
  which already behave this way: `collectGroupPredicates` ("a columnId with no active level is
  inert") and `GroupOrderRule` ("a silent no-op"). All three rule kinds now agree.

- **D4 (2026-09-17) — a pending rule abstains the whole set, and abstain passes the declared
  levels through unmasked.**

  `undefined` from any entry means _hold what is declared_, not _group by nothing_. A table
  therefore holds its levels while a rule resolves rather than flashing flat. Whole-set abstain
  (not per-level) is carried over unchanged from the old fold.

- **D7 (2026-09-18) — grouping's schema path is keyed by the row model, not by declared column
  ids. Removes grouping as ADR-0019's motivating consumer.**

  `GroupingSchemaFn`'s path becomes a mapped type over `Extract<keyof TRow, string>` — the same
  shape `FiltersPath<TRow>` already uses — rather than `ColumnsPath<TRow, TId, …>`.

  Rationale: grouping partitions **data**. The identifier a consumer writes should name the thing
  being partitioned, not a display concept that happens to read it. Under column keying, grouping
  by a field you do not display requires declaring a column purely as a data carrier.

  Value extraction moves to the rule. A non-primitive field supplies its own extractor:

  ```ts
  applyGrouping(path.owner, {
    enable: () => true,
    extractValue: (owner) => owner.name,
  });
  ```

  Accepted as a fair price, by explicit analogy to Signal Forms' derived-value access.

  **Contract:** `extractValue` must return a primitive. The engine does **not** defensively normalize,
  stringify or deep-compare keys — a non-primitive key is a consumer error. Two objects with equal
  contents are never `===`, so an un-extracted object field yields one group per row; stringifying
  instead collapses every row into one. Both are wrong, and papering over either puts real per-row
  cost in the hot loop.

  **Label resolution (D7a):** `label` becomes optional on the grouping rule, resolved explicit →
  matching column's `label` → raw key. Step 2 keeps the common case free but can borrow a label
  from a column whose accessor computes a different value than `extractValue`. Left standing rather
  than guarded — it is the same two-copies risk `extractValue` already introduces, and belongs in the
  docs as a consequence.

  **Counter-arguments on record, all judged non-blocking:**
  - _The value fact now exists twice_ — `accessor` for the cell, `extractValue` for the group, with
    nothing checking they agree. A group header can disagree with the column beneath it. This is
    the real cost of D7 and is accepted knowingly.
  - _Derived values have no name in row-key space_ — a `fullName` column meaning `first + ' ' +
last` cannot be named by any `keyof TRow`. Answered by `extractValue`: name any contributing field
    and extract. The path segment is then partly decorative, which is accepted.
  - _Performance_ — not a factor. Both designs do one extraction call per row per level; the
    column-keyed `Map.get(columnId)` is hoistable out of the loop either way. Allocation is a
    wash. The only real cost would be defensive key normalization, which the contract above
    forbids.

  **Effect on ADR-0019:** the ADR is not void — `applyVisible`, `applySortNulls` and `metadata()`
  are genuinely column-scoped and keep every reason the ADR gives. But ADR-0019's Consequences
  cited grouping's Phase B as the unblock it delivers, and that is no longer true. **Done
  2026-09-18** — ADR-0019 now carries an Amendment narrowing it to `columnsSchema` and retracting
  the `ColumnIdOf<S>` cross-argument recovery.

  **Generalized as [ADR-0021](../../../../adr/0021-column-concerns-and-data-concerns-are-separate-surfaces.md)**
  — a capability belongs to the column surface if it needs nothing from the row data, to a feature
  if it reads rows. D7 is that rule's first application; filtering was already compliant.

---

- **D5 (2026-09-19) — `grouping()` reports the **applied** levels, not declared intent.**

  A level that admits no cluster is not a grouping level. The render side already says so —
  `groupIds()` is `[]` and every row is flat — so reporting it as active makes `grouping()`,
  `isGroupedBy()` and `groupingLevels()` contradict what is on screen. The public read follows
  the render.

  The two specs under `describe('when rejects every cluster at a level')` in
  `with-grouping.spec.ts` are the contract. Built 2026-09-19 (uncommitted) — both now green.

  **Declared vs applied.** `grouping()` cannot both feed clustering and depend on admission, so
  the value splits in two:

  |              | source                                                                                    | consumers                                                  |
  | ------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
  | **declared** | `maskGroupingLevels(baseGrouping(), ruleEntries)`                                         | `stages.group`, `renderStages.group`, `groupIds`, `rowsOf` |
  | **applied**  | levels with at least one admitted cluster, read off the tree `clusterRows` already builds | `grouping()` read, `groupingLevels`, `isGroupedBy`         |

  No cycle: applied is derived _from_ the clustered tree, downstream of declared.

  **A level is applied when at least one cluster at its depth is admitted.** `when` is judged per
  cluster, so partial admission is normal — some clusters grouped, some dissolved to flat. Only
  total rejection drops the level. (`admitClusters` does not recurse into a rejected parent, so a
  deeper level counts only where its ancestors survived.)

  **Writes stay declared.** `table.grouping` becomes read-applied / write-declared: the updater
  still receives and replaces `baseGrouping`, so a gated-off or unadmitted level is never
  silently dropped by a `grouping.update()` round-trip.

  **Order is unaffected.** Nothing is ever pushed — declared is filtered, applied is filtered
  again. A level that returns, whether because a rule flipped or because data crossed a
  threshold, reappears at its declared index. This is what makes a separate `order:` config
  unnecessary (see D8).

  Counter-argument on record, accepted: `when` is data-dependent, so `grouping()` now changes as
  rows change, and a chip bound to `isGroupedBy` can toggle on its own. Judged correct rather
  than surprising — under D5 `grouping()` _means_ "levels currently in effect", and intent lives
  in `initial` plus the writable, not in the read.

- **D8 (2026-09-19) — no per-rule `order` field; `initial` is the only statement of nesting.**

  Considered and rejected: a zero-based `order` on each grouping rule, to pin a level's position
  regardless of when its rule resolves. Unnecessary — the mask never pushes, so position is
  already stable across resolution timing (D1). Adding it would restore D2's hidden coupling with
  a number instead of a line position: two places declaring nesting that must be hand-synced,
  unanswerable collisions and gaps, and an `initial` array whose order no longer means anything.

  Runtime reordering is a **write**, not a declaration — `addGroupLevel` / `removeGroupLevel` /
  `reorderGroupLevels` already cover it, and there the user's own click order is the intent.

  Reopens only if D3 is reversed and a rule may introduce an undeclared level, which has no
  declared position by construction.

- **D9 (2026-09-19) — one declarator per concern: `applyGrouping` activates,
  `applyGroupKey` derives, `applyGroupOrder` orders. `label` moves to `initial`.**

  D7 left `applyGrouping` carrying four unrelated things — activation (`enable`), admission
  (`when`), key derivation (`extractValue`) and display (`label`). They split:

  ```ts
  initial: [{ key: 'closedAt', label: 'Closed' }, 'region'];

  applyGrouping(path.region, { enable, when }); // activation
  applyGroupKey(path.closedAt, (d) => monthOf(d)); // key derivation
  applyGroupOrder(path.region, cmp); // sibling order
  ```

  `applyGroupKey` takes its extractor positionally, like `applyGroupOrder` — `K` comes off the
  handle, so `(fieldValue: TRow[K]) => unknown` stays narrowed without an options object. A
  second `applyGroupKey` on one field is a duplicate registration and throws at construction.

  **`initial` accepts `{ key, label? }` or a bare key.** The object form is the static, per-level
  declaration; the string shorthand keeps `initial: ['region', 'status']` free.

  **`grouping` state stays `string[]`.** The writable view reads and writes keys, never level
  objects. This is what keeps the state JSON-serializable: a level object carrying `extractValue`
  would lose its function through `JSON.stringify`, restore as `[{ key: 'closedAt' }]`, and key
  by raw `Date` — one group per row, silently, with no throw. Labels are a registry lookup off
  `initial`, so nothing new has to round-trip.

  **`extractValue` stays keyed by row field, not by `initial` entry.** `grouping.update(g => [...g,
'owner'])` can add a level never declared in `initial`; because `applyGroupKey` records against
  the field, that level still finds its extractor. Putting extraction on the `initial` entry would
  have left runtime-added levels keying raw.

  **Label resolution (supersedes D7a's first link):** `initial` entry's `label` → matching
  column's `label` → raw key. The rule is no longer a label source.

  **Consequences:**
  - New rule kind `'grouping-key'` in `AnyGroupingRule`; `collectExtractValue` reads that kind
    instead of scanning `GroupingRule`s.
  - `extractValue` and `label` come off both `GroupingRule` and `GroupingAsyncRule`. An async
    rule needing an extractor declares `applyGroupKey` on the same field, independently.
  - `feature.ts`'s "declares neither enable nor when" throw becomes correct as written. Under D7
    it rejected the legitimate `applyGrouping(path.x, { extractValue })` — that spelling no
    longer exists, so an `applyGrouping` with neither predicate is now genuinely empty.
  - The two-copies cost ADR-0021 accepted is unchanged — `accessor` and `applyGroupKey` can still
    disagree. This decision moves where the second copy is declared, not whether it exists.

  **Why not fold extraction into the column's `accessor`:** the accessor and the group key are
  the same value only in the trivial object-unwrap case. `closedAt: Date` needs the cell to show
  a date and the group to key a month; a numeric column needs `42` in the cell and `0–100` in the
  header. Folding them changes what renders. Two further cases have no accessor to borrow at all:
  a level naming a field with no column (D7's whole motivation), and a derived column whose
  `accessor` spans fields no single `keyof TRow` names.

- **D10 (2026-09-20) — `GroupingLevel.key` → `columnId`. Folded into ADR-0024's keying move, not
  landed on its own.**

  Three distinct things are named across this feature, and two of them share the word `key`:

  |                    | what it is                             | named today                         |
  | ------------------ | -------------------------------------- | ----------------------------------- |
  | declared column id | consumer-chosen, arbitrary (`'total'`) | `ColumnsPath<TRow, TId>` (ADR-0019) |
  | row field name     | `Extract<keyof TRow, string>`          | `GroupingPath<TRow>` (D7)           |
  | the grouped value  | `'north'`                              | `ClusterSummary.key`                |

  `GroupingLevel.key` is typed `ColumnId<TRow> = Extract<keyof TRow, string> | (string & {})` —
  named for the column-id space, autocompleting the field space, accepting either. Meanwhile
  `ClusterSummary` calls that same concept `columnId` and uses `key` for the **value**. So `key`
  means "which column" in `initial` and "what value" one interface over, which is the reading the
  config teaches first and the cluster then contradicts.

  `ClusterSummary.key` is the one that stays: it matches LINQ's `IGrouping.Key` and SQL's GROUP BY
  key, both of which mean the grouped value.

  **Why it does not land alone.** Renaming `key` → `columnId` while the field stays typed
  `ColumnId<TRow>` moves the lie rather than fixing it — the name would promise declared-column-id
  space while the type keeps autocompleting row fields. It is honest only once the keying moves,
  so it lands as part of that change:
  - `initial` and `GroupingPath` re-key from `Extract<keyof TRow, string>` to the declared `TId`
    space — ADR-0019's keying, which
    [ADR-0024](../../../../../adr/0024-single-value-source-accessor.md) names as "the keying this
    ADR describes".
  - `GroupingLevel.key` → `columnId`.
  - `ColumnId<TRow>` retired — it is the type that lets both readings coexist.

  Breaking on `initial`'s object form. D9's string shorthand (`initial: ['region', 'status']`) is
  unaffected.

- **D11 (2026-09-20) — Unified schema architecture: shared plumbing, per-feature entries, per-context
  resolvers.**

  Four questions settled in one session, recorded together because each one's answer constrains the
  next. Scope note: only (a) and (d) are grouping-owned; (b) and (c) are cross-cutting and are
  recorded here for traceability, not claimed by this folder — see the closing note.

  **(a) One mechanism, four entries — not one schema.**

  Rejected: a single `TableConfig.schema` that every declarator (`applyVisible`, `applySortNulls`,
  `applyGrouping`, `applyFilter`) records into, with each feature reading its own `kind`s out.
  Sorting and columns already work that way, so it was the coherent generalization.

  Rejected because a feature's rules must sit with the feature. Under one schema, `applyGrouping`
  could be declared with no `withGrouping()` composed, putting a feature's declarations in the
  column schema and forcing a new inert-or-throw rule for the uncomposed case.

  **Shared:** the path proxy, the handle, the recorder session, the key space (`schema/path-proxy.ts`,
  already key-space agnostic). **Not shared:** the schema fn's signature or its entry point.

  ~~Sorting is unaffected — it has no schema of its own and keeps riding `columnsSchema` through
  `applySortNulls`'s `SORT_NULLS` metadata, read back by `withSorting()` via `readColumnMeta`.~~

  **Reversed 2026-09-20 (same day), on [#100](https://github.com/DvirMon/ng-table/issues/100).**
  `withSorting()` gains a schema fn in the recording form, and `applySortNulls` moves into it
  alongside `applySortable` and `applySortFn`. The reason is the one this decision itself uses:
  a feature's rules must sit with the feature. `with-sorting.ts:105-113` reads `column.sortFn` and
  `readSortNulls(column)` three lines apart in one function, so leaving `nulls` in `columnsSchema`
  splits one feature's config across two homes — the exact shape (a) rejects. The earlier
  "unaffected" reading came from ADR-0021's capability test, which says what _may_ live on the
  column surface, not what _should_.

  So the mechanism has five per-feature entries, not four. The count was never the rule.
  `columnsSchema` is left with `applyVisible` / `applyVisibleAsync` and the raw `metadata()`
  channel, and carries no feature's config.

  **(b) Column-id keying in every schema.** Not decided here — decided by
  [ADR-0024](../../../../../adr/0024-single-value-source-accessor.md) and formalized as the
  general cross-cutting rule in
  [ADR-0027](../../../../../adr/0027-schema-declaration-surface.md), which also corrects ADR-0019's
  Amendment (no longer "unwritten" — see ADR-0019's own 2026-09-20 amendment, updated 2026-09-25).

  **(c) Two authoring forms, kept.** General rule — which form a schema fn picks, and why both
  are permanent rather than one converging onto the other — is now
  [ADR-0027](../../../../../adr/0027-schema-declaration-surface.md) Rule 2. Grouping's own two
  forms:

  ```ts
  schema: (path) => {
    applyGrouping(path.region, { enable });
  }; // void — columns, grouping
  schema: (path) => ({ status: equals(path.status) }); // returning — filtering
  ```

  **"Resolved before data" means declaration only.** Every rule — `when` included — is _recorded_
  before any row exists; what is recorded is the function reference, not its result. Evaluation is
  not uniform:

  | callback   | needs data          | evaluated                                                            |
  | ---------- | ------------------- | -------------------------------------------------------------------- |
  | `enable`   | no                  | wire phase, in a `computed()` (`rules.ts:62`)                        |
  | async rule | no — external fetch | own clock; pending ⇒ abstain (`rules.ts:84`)                         |
  | `when`     | **yes**             | run phase, per cluster — `collectGroupPredicates` only _collects_ it |

  This is ADR-0018's `when`/`enable` split restated as timing. A predicate needing early resolution
  is expressed as `enable`; `when` is not made to resolve sooner.

  **(d) Per-context resolvers, named for what they return — not one `valueOf`.** The general
  two-tier resolver rule (arity decided by declaration vs. data, the three registers, why
  `criterionOf` is not `valueOf` renamed, the corrected Signal Forms comparison, and the inventory
  of every consumer callback across all four schemas) is now
  [ADR-0027](../../../../../adr/0027-schema-declaration-surface.md) Rule 3. What remains here is
  grouping's own application of it.

  **Grouping's `when` is the only gap to build.** `cluster.key` is already accessor-resolved, so the
  common case (`when: (c) => c.key === 'north'`) stays free, and `c.rows` still allows direct field
  access for plain model fields. The resolver is additive, for the carrier-column case that has no
  spelling today — not a migration of existing `when` bodies.

  A resolver never changes _when_ a rule runs. It is callable only inside `when`, so it is nested in
  the latest phase, not parallel to it and not earlier.

  **Placement: a context object, never a member of `ClusterSummary`.** `valueOf` is the language's
  coercion hook, consulted before `toString` under a default hint. `ClusterSummary` is a value
  object the library builds per node and hands to a consumer comparator inside `.sort()`
  (`engine/grouping/clusters.ts:275-292`), so an own `valueOf` there would turn a consumer's
  `(a, b) => a - b` — plausible, since the cluster key is often numeric — from a silent `NaN` into
  a call of the resolver with `undefined` arguments, swallowed by the comparator's existing
  `catch`. On a context object, which is never sorted or coerced, the hazard does not arise. The
  two-tier rule puts it there independently: the resolver takes the subject as an argument, so it
  is not a member of any subject.

  Widening the arity is additive — every existing one-argument predicate still typechecks — and
  `ClusterSummary` stays `{ columnId, key, rows }`.

  **Why a context method is safe at all**, recorded because it was argued in session and written
  down nowhere: the `TypeError` that opened this thread came from an **optional rule field** that
  call sites presence-tested inconsistently. A context method is neither optional nor
  presence-tested — the library builds the context, every member is always present, and a
  consumer never asks whether it exists. That is the property to preserve when a fourth resolver
  is added; "it is a method" is not, since the original bug was one too.

  **Consequence on `applyGroupKey`.** Its extractor is typed `(fieldValue: TRow[K]) => unknown`. Once
  `K` is a declared column id, `TRow[K]` no longer resolves for a derived column, and the extractor's
  input becomes the accessor's output rather than the raw field. The signature changes with (b).

  **Not claimed by this folder.** (b) belongs to ADR-0024 and (c)'s two-form rule plus (d)'s
  resolver-naming rule are cross-cutting — the same ADR ADR-0019's Amendment already said was owed
  and never written. They are recorded here so the reasoning is not lost, and should be lifted into
  that ADR rather than left as grouping work-folder decisions.

---

## Open

- **D6 — does `schema` accept a pre-built value for cross-table reuse?**

  Moved here from ADR-0019, where it did not belong — it is this config's shape, not
  `ColumnsPath`'s keying. Holding a pre-built rules array and sharing it across tables is the one
  thing `rules` does that nothing else covers. The precedent for keeping that inside one entry is
  `TableConfig.columnsSchema?: ColumnsSchemaFn<TRow> | ColumnSchema<TRow>`, mirrored as
  `schema?: GroupingSchemaFn<TRow> | GroupingSchema<TRow>`. Decide before Phase B deletes `rules`.

---

## Known stale, not yet fixed

- **`grouping-async-rule` story is now a no-op demo.** It declares `initial: ['region',
'category']` and an async rule for `'rep'`. Under D1/D3 that rule can never add `rep`, so the
  story compiles, renders, and demonstrates nothing. Its own doc comment still claims the rule
  "replaces the level set outright". Either declare `rep` in `initial` and let the rule gate it,
  or rewrite the story around gating. No test catches this.
- **D7 is now built** (uncommitted): `GroupingSchemaFn`/`GroupingPath`/`GroupingHandle`
  (`schema/grouping-schema.types.ts`, `schema/grouping-rules.ts`) are keyed by `keyof TRow`, not
  `ColumnsPath`; `applyGrouping`/`applyGroupingAsync` carry `extractValue`/`label`;
  `engine/grouping.ts` reads a level's value via `row[key]` (through `extractValue` when declared)
  instead of a column's `accessor`; `RenderRow.groupKey` gained a resolved `label`. The
  `column-rules.ts`/`column-metadata.ts` half of ADR-0019 (declared-column-id keying) is
  untouched by this and stands on its own merits.
- **`initial` and a grouping rule no longer validate against declared columns at all** (D7's
  natural consequence — the whole point is grouping by a field with no column). A level or rule
  naming a field no row carries degrades to one phantom cluster keyed by `undefined`, never a
  throw. `engine/grouping.spec.ts` and `with-grouping.spec.ts` assert the new behavior; the
  `grouping-regressions` story's "group by a column that isn't there" control was renamed to
  match.
- **D7's field was originally named `valueOf`, fixed to `extractValue`.** `Object.prototype`
  already has a `valueOf` method, inherited by every plain object — a rule that omits the option
  entirely (`applyGrouping(path.region, { enable: () => true })`) still reads `opts.valueOf`
  (and later `rule.valueOf`) as truthy, since the lookup falls through to the built-in instead of
  landing on `undefined`. `collectValueOf` then registered `Object.prototype.valueOf` itself as
  that column's extractor, and `readGroupFieldValue` called it as a bare function —
  `Object.prototype.valueOf.call(undefined, raw)` in strict mode — throwing `TypeError: Cannot
convert undefined or null to object` for _any_ grouped column with a rule attached, whether or
  not that rule ever declared an extractor. Caught by `with-grouping.spec.ts`'s "a throwing
  enable predicate" test. Renamed throughout (`GroupingRule`/`GroupingAsyncRule.extractValue`,
  `applyGrouping`/`applyGroupingAsync`'s opts, `collectExtractValue`,
  `ClusterOpts.extractValueByColumn`) rather than switching the presence check to
  `Object.hasOwn` — same fix, but the rename also forecloses the same trap resurfacing at any
  future truthiness check on this field. Same caution applies to any future rule-option name:
  avoid `toString`/`constructor`/`hasOwnProperty`/etc. for the same reason.
- **Two `with-grouping.spec.ts` tests were still asserting the pre-D7 contract.** "an unknown
  level passed to `setGroupLevels` does not throw — it is dropped" and `groupingLevels (#81)`'s
  "dropped level (D4)" both expected an unknown field to be silently omitted from clustering.
  D7's actual, accepted contract is the opposite (phantom-cluster, never dropped — see above).
  Rewritten 2026-09-19 to assert the phantom nesting; the second also flips
  `isGroupedBy('ghost')` from `false` to `true`, since the field genuinely produces a rendered
  header and D5 now defines `isGroupedBy` against the _applied_ levels, not a column-only view.
