# Grouping stories — one-lesson audit

Date: 2026-09-19. Working tree, not HEAD (grouping source is mid-restructure).

**The bar applied:** one story = one concrete lesson about one thing in the public
grouping API. A story that needs "and also" to describe it is two stories. A story
whose lesson is another feature's is that feature's story.

Scope: `libs/table/src/stories/grouping/**` only.

---

## 0. Decisions

Taken story by story with the user, 2026-09-19. This section is the record; §2–§4
are the analysis that fed it and are not updated as decisions land.

### D1 — `grouping-static` → `grouping-basic`, stripped to three lessons out

**Keep**, renamed, with **three** lessons split out rather than two:

| Split out | Goes to |
|---|---|
| table-wide `when` + per-column `when` | `grouping-when` (§3.6) |
| `groupedColumnMode` | `grouping-columns` (§3.5) |
| **`aggregateFn` totals at depth** | **`grouping-aggregates` (new — D1a)** |

`BlankRegionsFlat` and `TwoLevelsWithThresholds` removed as arg presets; they
become `grouping-when`'s Controls.

**D1a — aggregates get their own story.** Subtree totals are their own lesson, not
scenery on the baseline: a parent total is the sum of its own leaves at every
depth, it is post-filter by construction (`filter` precedes `group` in
`PIPELINE_ORDER`), and `aggregateFn` is a *column-schema* option rather than a
`withGrouping()` one — which is exactly the kind of thing a reader mis-attributes
when it only ever appears inside someone else's story.

Consequence for the baseline: `grouping-basic`'s headers carry value and row count
only. The `amount` total moves to `grouping-aggregates`, and `fixtures/schema.ts`'s
`sumAmount` goes with it — the baseline's column list stops carrying an
`aggregateFn` at all, so the source a reader copies is `initial` and nothing else.

### D2 — `grouping-async-rule` keeps, unchanged

One canvas, one lesson, error case as a control rather than a second canvas. The
reference shape for every other story in the set.

It is also the only story where `initial` and a rule disagree, so
"a resolved rule overrides the base choice rather than merging with it" is visible
here and nowhere else — a reason not to touch it.

### D3 — `SilentDegradation` removed as a canvas; both cases relocate

| Case | Disposition |
|---|---|
| Break one group's summary (`aggregateFn` throws) | Moves to **`grouping-aggregates`** as a control |
| Group by a field that is not a column | Moves to **`grouping-keys`** as `label`'s third step |

**The premise the canvas was built on is stale.** Its text, the `.mdx` paragraph
and `fixtures/schema.ts`'s `sumAmount` comment all claim the whole table goes down
when `aggregateFn` throws, citing an issue #79 that in this repo is a *filtering
docs* issue, closed 2026-09-17 — the link in the `.mdx` points at `DvirMon/acme`,
not `DvirMon/ng-table`.

The ADR-0014 retrofit shipped with the restructure. Three wraps exist today:

| Callback | Site | Fallback |
|---|---|---|
| `aggregateFn` | `engine/grouping/render.ts:43` | `undefined` for that column only; reported once per column per evaluation (`reportedColumns` dedupes across every group in one pass) |
| `when` predicate | `engine/grouping/clusters.ts:138` | cluster is **admitted**; reported once per column per evaluation |
| `groupOrder` comparator | `engine/grouping/clusters.ts:269` | stable first-occurrence order for the affected levels; reported once per evaluation |

So the summary case is not a bug demo — it is the aggregate-side twin of
`ThrowingGroupOrder`, and the same verdict applies to both: a *designed*
degradation is a control on the story of the thing it protects. D1a gives
aggregates their own story, so that is where it goes.

The missing-field case is a different matter — nothing on screen reports it except
the story's own `grouping().includes(MISSING_GROUPING_LEVEL)` arithmetic, so there
is no library behaviour to watch. But the contract underneath is real: **a grouping
level names a row field, not a declared column** (D7). It moves to `grouping-keys`
(§3.3) as `label`'s third resolution step — explicit → matching column id → raw
field name — where the same fact reads as a feature rather than a warning.

`MISSING_GROUPING_LEVEL` stays in `fixtures/schema.ts` but changes owner, and its
doc comment stops describing a phantom cluster and starts describing label
fallback.

**Stale text to fix regardless of this audit** — all three describe a crash that no
longer happens:

- `grouping.mdx` — the `Regressions` section, including the wrong-repo `#79` link
- `grouping-regressions-story-host.component.html:25-27` — "The whole … calls
  `aggregateFn` unwrapped", and the `engine/grouping.ts` path no longer exists
- `fixtures/schema.ts:9-14` — `sumAmount`'s comment, same claim

### D4 — `applyGroupOrder` promoted to `grouping-order`

`ThrowingGroupOrder` stops being a canvas; the whole `groupOrder` select moves to a
new story that `applyGroupOrder` owns. Five options, one canvas:

| Option | Shows |
|---|---|
| `first-occurrence` | the no-comparator baseline — sibling order as clustering produced it |
| `by-label` | `localeCompare` on the group key |
| `by-count` | `b.rows.length - a.rows.length` — ordering by a cluster's size |
| `external-list` | a caller-supplied ranking (`EXTERNAL_GROUP_ORDER`); unlisted values sort last |
| `throwing` | the ADR-0014 fallback — stable first-occurrence order, reported once per evaluation |

Keeps today's single-closure-reading-a-signal shape: `withGrouping()` takes exactly
one comparator per level, so a comparator per mode would teach a shape a consumer
has to un-learn.

`throwing` stays last in the select, where it reads as the edge of a spectrum
rather than a mode anyone picks. It does not need pinning as its own canvas — the
reason given for pinning it ("a state nobody finds by accident") is an argument for
Controls discoverability, not for a second story.

The story also carries the one fact nothing states today: **`applyGroupOrder` never
activates or deactivates a level.** On a column with no active level it is a silent
no-op — unlike `applyGrouping`, which is why the two are separate verbs.

Consequence: the `grouping-regressions` folder disappears. Its host, toolbar and
types become `grouping-order`'s, minus the two buttons D3 relocated.

### D5 — `grouping-collapsible` keeps, stripped to two features

Remove from the host:

| Removed | Why |
|---|---|
| `withComputed()` block (`:69-75`) | Its own JSDoc documents it as the *non*-default. A story should teach the default: read `expandedRows().has(row.id)` in the template for `kind: 'group'` rows. It also composed a fourth feature into a story about two |
| `withSorting()` | Present only to give the "a sort toggle does not disturb collapse state" attack something to drive |

**An invariant that something does *not* break is a test, not a story.** The sort
claim is a regression assertion with nothing to look at — the observable outcome is
that the screen is unchanged. It belongs in `with-grouping`'s spec, asserted
directly, where it fails loudly instead of requiring someone to notice a
non-change on a canvas. Same test to apply to the remaining attacks (see below).

What the story keeps:

- `groupIds()` feeding `expandAll(table.groupIds())` — the wiring's whole reason to
  exist, since `expandAll()` alone discovers data rows via `childrenAccessor` and
  cannot reach a group header
- collapse and expand over a real chevron, three levels deep
- **Regroup** — `setGroupLevels` to a re-nested order, so every group id changes at
  once. This one *is* worth watching: the outline visibly rebuilds, which is a
  state change, not the absence of one
- **Refetch** — borderline by the same test. Kept for now because the rows visibly
  replace; if the only point being made is "collapse state survived", it is a spec
  assertion too. Revisit when the story is rewritten

Composition after the strip: `withGrouping()` + `withExpansion()`. Two features,
one lesson.

### D6 — `CollapsibleRefreshFailure` removed; coverage moves to a spec

Fails three tests at once:

1. One `args` value off `Collapsible` — a Control, not a story (convention 1)
2. Its whole claim is a non-change — "the outline is exactly as it was"
   (convention 5)
3. The lesson is not grouping's. "A failed resource leaves expansion state alone"
   is expansion's contract, or the resource wiring's; nothing in it is specific to
   group headers (convention 3)

The `.mdx` justifies it as "the half of product story 2.5 that `Default`'s DOM
never reaches" — which argues the behaviour needs **coverage**, not that the
coverage has to be a canvas.

**Coverage moves to a spec assertion**, alongside D5's sort case. Both are the same
shape: a failed or replaced data source must leave expansion state untouched.
Asserted directly, they fail loudly; on a canvas they require someone to notice
that nothing happened.

Consequence: `forceFailure` and `latencyMs` leave `grouping-collapsible`'s
`argTypes`, and with them the story's `msw` handler wiring — unless the Refetch
control survives D5's revisit, which is the only other thing using it.

### D7 — `grouping-selection` keeps; `cascade` drops to two options

Keeps its shape — one canvas, and the `cascade` control *is* the lesson (D16: the
library ships no cascade, so all peer defaults are ordinary consumer code over one
`rowsOf()` call).

`withFiltering()` stays, unlike D5's `withSorting()`: it is what makes "`rowsOf()`
is post-filter by construction" observable — filter a rep out and the group counts
and summaries follow. A visible state change, so convention 6 does not bite.

**Trim: `descendants+parents` comes out of the radio.** `onToggleGroupSelection`
branches on `cascade() !== 'self'`, so modes 2 and 3 take the identical path and
write the identical leaf set — flipping between them changes nothing on screen. A
radio option that does nothing reads as broken, not as elegant.

The fact underneath is real and worth keeping: **cascading to parents needs no
write, because a parent's tri-state derives from `selectionStateOf()`.** That moves
into the story description, where "this direction needs no code" is the actual
sentence, instead of being a control that demonstrates its own absence.

Result: `cascade` is `'self' | 'descendants'`.

**Keep `selectedGroupHeaderCount`** — the always-0 readout. Convention 5 governs
*controls*; this is a passive readout that costs nothing to ignore. Its job is to
tell someone copying the cascade code that they need not filter header ids out of
the selection, because none ever get in. That is teaching, not asserting.

**Add the assertion anyway:** "no group id ever enters selection state" belongs in
`with-grouping`'s spec. The readout does not replace it — third spec item, with
D5's sort case and D6's failed-refresh case.

### D8 — `grouping-crud` removed; its facts move to spec

**Ruled out on API surface, not on quality.** The story's intent — CRUD performed
per group, with a category dropdown that renames and deletes categories — turns out
to exercise almost no grouping API:

| What it does | Whose API |
|---|---|
| Add / update / delete a row | `insertRow`/`patchRow`/`removeRow` — **core** row mutations |
| Rename a category, delete a category | the same core mutations, applied to a set |
| Get the set to write to | `rowsOf(group)` — grouping's, but already `grouping-selection`'s primitive |
| Rows re-cluster, headers merge or vanish | engine behaviour, **no call site at all** |

So it is a consumer pattern, not an API lesson (convention 2). The behaviour is
real; it is just better stated than shown.

**Moves to `with-grouping`'s spec** — four assertions, deterministic and cheap:

1. Patching a row's group field moves it between clusters
2. Patching to a name a sibling holds **merges** the two clusters
3. Removing a cluster's last leaf removes its header
4. No write ever names a group id — writes target rows, clustering re-derives

**One consequence to absorb:** `groupingLevels()` loses its only coverage. It is a
small member and does not earn a story; fold it into `grouping-basic`, which
already renders the level set.

#### Design conclusions reached on the way, worth keeping

The story was explored as a taxonomy editor before being cut. Two conclusions
survive the cut and belong in the docs prose or the spec, not in a canvas:

- **A group has no identity in the table.** It is derived by `clusterRows` every
  evaluation. "Rename a group" and "delete a group" have no direct target — both
  are writes to the rows, and the header follows.
- **Deleting a category must never delete rows.** A taxonomy delete asks where its
  rows go: *reassign* (rows move; a name collision merges the two groups) or
  *leave uncategorized* (clear the field; rows land in a blank-key cluster, and go
  flat only if a `when` predicate rejects blank keys — a `grouping-when`
  dependency, not free). Deleting the records is a separate, explicitly
  destructive action that pairs with selection.

### D9 — `grouping-keys` carries a source fix: widen the empty-rule guard

**The framing to teach, first.** `initial` answers *which fields are levels, in
what nesting order*. `applyGrouping` answers *everything else about one field* —
split by what the option decides, not by dynamic vs. static:

| Option | Decides | Dynamic? |
|---|---|---|
| `enable` | is this field a level right now | yes |
| `when` | which clusters survive | yes |
| `extractValue` | what the group key is | no |
| `label` | what the header says | no |

Most tables need only `initial` — because they need none of the four, not because
they are "static". A static table wanting a group header that differs from its
column header needs `applyGrouping` too.

> Earlier drafts of this decision said "`schema` is for grouping that *changes*".
> That is wrong: two of the four options are static. Corrected here; the same
> wording may survive elsewhere in the docs and should be fixed on sight.

Stated that way, the construction throw on `applyGrouping(path.x, {})` reads as the
obvious consequence rather than a surprise: a rule setting none of the four
contributes nothing, and `initial` already covers the case it looks like it is
serving.

Decided in
[`1-plan-config-simplification.md`](../../../1-state/work/grouping/active/grouping-config-simplification/1-plan-config-simplification.md)
Step 3, as a construction-class error per ADR-0014. It lives in a work plan rather
than an ADR, which is why it is easy to forget it was ever discussed.

**The bug this audit found.** The guard (`feature.ts:91-93`) is

```ts
isGroupingRule(rule) && !rule.enable && !rule.when
```

— it never looks at `label` or `extractValue`. So a rule carrying only one of those
throws, although both are documented as standalone options with nothing to do with
activation:

```ts
applyGrouping(path.closedAt, { extractValue: (d) => monthOf(d) });  // throws today
```

An oversight, not a decision: Step 3's stated target was the *empty* rule, and a
label-only rule is not empty. Untested too — `feature.spec.ts` has no
`applyGrouping` call carrying only `label` or `extractValue`.

The blocked case is ordinary, not exotic: group by a field whose group header
should read differently from its column header.

```ts
withGrouping({
  initial: ['dueDate'],
  schema: (path) => applyGrouping(path.dueDate, { label: 'Due' }),  // throws today
})
```

Putting the label on a `ColumnDef` with id `dueDate` avoids the rule, but only
while the column header and the group header should say the same thing. Once they
differ, the rule is the only mechanism.

**Folded into `grouping-keys`'s work**, since the story cannot be written against
the current guard:

1. Widen the emptiness check to all four options (`enable`, `when`, `label`,
   `extractValue`)
2. Add the two missing spec cases — a `label`-only rule and an `extractValue`-only
   rule both construct cleanly
3. Keep the existing throw case green — `applyGrouping(path.x, {})` still throws

### D10 — open question: pending unmasks, it does not hold

Raised while scoping `grouping-enable`. **Not resolved** — recorded so the story is
not written against behaviour that may change.

`maskGroupingLevels` (`engine/grouping/rules.ts:106-117`) returns the **declared**
array when any entry reads `undefined`:

```ts
for (const entry of entries) {
  const value = entry.result();
  if (value === undefined) return [...levels];   // declared, not current
  results.set(entry.columnId, value);
}
return levels.filter((id) => results.get(id) !== false);
```

So a pending rule does not freeze the status quo — it **discards every other rule's
resolved `false`** and short-circuits, never reading the entries after it.

| | `region: false` (resolved) | `category: undefined` (pending) | Applied |
|---|---|---|---|
| Expected | stays off | no change | `['category']` |
| Actual | **comes back** | — | `['region', 'category']` |

Decided as whole-set abstain in **D13** (2026-09-10,
`archive/with-grouping/2-decisions.md:199`) and restated as **D4** (2026-09-17,
`active/grouping-config-simplification/2-decisions.md:62`). Its stated purpose —
hold the declared grouping rather than flash ungrouped while a rule resolves — is
true at **first paint**, when nothing has resolved and declared *is* intended. It
stops being true once some rules have already resolved `false`.

The alternative already exists in the codebase: `buildAsyncGroupingRuleEntry` holds
`previous?.value` across a reload (`rules.ts:85`), i.e. last-resolved rather than
declared. The sync mask has no equivalent.

Settle this before writing `grouping-enable` — the story's whole job is making the
four `enable` states legible, and it cannot do that against a contract still in
question.

### D11 — resolved: pending holds last resolved

**A pending rule holds its own last resolved boolean.** It does not unmask the
declared set, and it does not affect any other rule's result.

The first-paint case is unchanged, and this is what reconciles D11 with D13/D4: an
entry that has **never** resolved has nothing to hold, so it still reads
`undefined` and the whole set still abstains. That is the case D13 was actually
defending — a table holding its declared levels instead of flashing flat. The
divergence only appears *after* first resolution, which neither decision
considered.

| Entry state | `result()` | Effect on other levels |
|---|---|---|
| never resolved, pending | `undefined` | whole set abstains — declared passes through |
| resolved, now pending | last boolean | **none** |
| resolved `true` / `false` | that boolean | none |
| threw | `false`, reported once | none |

**Where the fix goes: the entry, not the mask.** `buildAsyncGroupingRuleEntry`
already holds `previous?.value` across a reload (`rules.ts:77-87`); the sync
builder has no equivalent. Giving `buildGroupingRuleEntries` the same
`linkedSignal` shape makes the two symmetric and leaves `maskGroupingLevels` pure —
it simply stops seeing `undefined` from a rule that has answered before.

```ts
// engine/grouping/rules.ts — buildGroupingRuleEntries
result: linkedSignal<boolean | undefined, boolean | undefined>({
  source: () => {
    try {
      return rule.enable?.();
    } catch {
      reportGroupingRuleError(rule.columnId);
      return false;              // throw ≠ pending, unchanged
    }
  },
  computation: (value, previous) => value ?? previous?.value,
}),
```

**Folded into `grouping-enable`'s work**, the way D9 is folded into
`grouping-keys`:

1. Change `buildGroupingRuleEntries` to hold last resolved
2. Amend `maskGroupingLevels`'s JSDoc — the whole-set abstain paragraph now
   describes first paint only
3. Spec: a resolved `false` survives another rule going pending
4. Spec: a never-resolved entry still abstains the whole set
5. Amend the two decision records rather than silently diverging from them —
   `archive/with-grouping/2-decisions.md` D13 and
   `active/grouping-config-simplification/2-decisions.md` D4

Item 5 is a change to a twice-decided contract. Whether it also needs an ADR is the
user's call; the decisions-doc amendment is the floor.

---

## 1. API surface vs. coverage

Surface taken from `api/features/with-grouping/{feature,schema,types}.ts`.

| API concept | Where it lives | Covered by | Verdict |
|---|---|---|---|
| `initial` — array order *is* nesting order | `WithGroupingConfig.initial` | Static | ✅ |
| `when` — table-wide cluster admission | `WithGroupingConfig.when` | Static | ✅ |
| `applyGrouping({ when })` — per-column admission, AND'd | `schema.ts` | Static | ✅ |
| `applyGrouping({ enable })` — level activation, tri-state | `schema.ts` | — | ❌ **none** |
| `applyGrouping({ extractValue })` — group-key derivation | `schema.ts` | — | ❌ **none** |
| `applyGrouping({ label })` — explicit header label | `schema.ts` | — | ❌ **none** |
| `applyGroupingAsync()` — server-decided level | `schema.ts` | Async Rule | ✅ |
| `applyGroupOrder()` — sibling ordering | `schema.ts` | Regressions (as misuse) | 🟡 **miscast** |
| `grouping` reads applied / writes declared (D5) | `GroupingMembers` | — | ❌ none |
| `rowsOf(group)` | `GroupingMembers` | Selection, CRUD | ✅ |
| `groupIds()` | `GroupingMembers` | Collapsible | ✅ |
| `groupingLevels()` | `GroupingMembers` | CRUD | ✅ |
| `isGroupedBy(id)` | `GroupingMembers` | Static | ✅ |
| Group updaters (`add`/`remove`/`reorder`/`setGroupLevels`) | `index.ts` | Static, Collapsible | ✅ |
| `aggregateFn` totals at every depth | column schema | Static, CRUD | ✅ |
| Collapse (`withExpansion()` + `'prune'`) | composition | Collapsible | ✅ |
| Row mutations under grouping | composition | CRUD | ✅ |
| Selection cascade over `rowsOf()` | composition | Selection | ✅ |

Three schema options have **zero** on-screen coverage: `enable`, `extractValue`,
`label`. All three are `applyGrouping`'s own options — the declarative entry point
the feature is built around.

---

## 2. Per-story verdicts

### `grouping-static` — 3 canvases, 3 lessons, and a wrong name

| Export | Lesson | Verdict |
|---|---|---|
| `Static` | `initial` + aggregates + level editing over the updaters | **Keep**, renamed and stripped |
| `BlankRegionsFlat` | `keepBlankRegionsFlat: true` | **Remove** — one arg off `Static` |
| `TwoLevelsWithThresholds` | both toggles on | **Remove** — two args off `Static` |

Both removals are already reachable from `Static`'s Controls, and the `.mdx`
documents only `Static` — so the two extra canvases are already invisible in the
docs stream and exist only in the sidebar.

**The name is wrong.** This is the baseline — "the one to copy", per the `.mdx`
itself. `Static` reads as the opposite of `applyGroupingAsync`, i.e. as a *variant*,
which is the one thing it is not. Rename to `grouping-basic`.

**And it is not yet basic.** One host currently teaches four things:

| Riding on the host | Belongs to |
|---|---|
| `initial`, aggregates at depth, add/remove/reorder levels | the baseline — **stays** |
| table-wide `when` + per-column `when`, AND-combined | its own story — see §3.6 |
| `groupedColumnMode` (`keep`/`hide`/`move-to-front`) | its own story — see §3.5 |

Stripping it is what makes the rename true: a first-read story should compose
`withGrouping({ initial })` and nothing else, with no predicate and no `effect` +
`untracked` column-sync block in the source a reader is being told to copy.

### `grouping-async-rule` — clean

One canvas, one lesson (`applyGroupingAsync` + the pending window + `onError`'s
required boolean), one control that flips to the error case. This is the shape the
others should match. **Keep as-is.**

### `grouping-regressions` — miscast, split

The folder is named for bugs but contains the *only* coverage of a shipped feature.

| Export / control | What it actually is | Verdict |
|---|---|---|
| `groupOrder: by-label` | `applyGroupOrder` — legitimate | **Promote** to a group-order story |
| `groupOrder: by-count` | `applyGroupOrder` — legitimate | **Promote** |
| `groupOrder: external-list` | `applyGroupOrder` — legitimate | **Promote** |
| `groupOrder: first-occurrence` | the no-comparator baseline | **Promote** (as the default) |
| `ThrowingGroupOrder` | ADR-0014 degrade contract | **Move** — one control on the group-order story, not its own canvas |
| `SilentDegradation` → missing level | D7: a level naming no field clusters to one phantom group | **Remove** |
| `SilentDegradation` → broken summary | [#79](https://github.com/DvirMon/ng-table/issues/79), an **open bug** | **Remove** |

`SilentDegradation` documents two things the library does not yet do correctly.
A bug tracker and a spec hold those; a docs page that teaches them teaches the
reader to expect them. The missing-level notice on canvas is the story's own
arithmetic — the library reports nothing — so the canvas is not even showing
library behavior, it is showing the story compensating for its absence.

`ThrowingGroupOrder` is different in kind: the degrade-and-report fallback is
*designed* behavior (ADR-0014), not a gap. It belongs next to the comparator it
protects, as one more option in the same select.

Net: the folder disappears; its legitimate half becomes `grouping-order`.

### `grouping-collapsible` — 2 canvases, second one is expansion's lesson

| Export | Lesson | Verdict |
|---|---|---|
| `Collapsible` | `groupIds()` feeding `expandAll()`; collapse survives refetch/sort, resets on regroup | **Keep** |
| `CollapsibleRefreshFailure` | a failed refetch leaves collapse state untouched | **Remove** |

The failure canvas is `forceFailure: true` — one arg off `Collapsible`, same as the
two `grouping-static` extras. Its lesson is also not a grouping lesson: it is
"resource error does not disturb expansion state", which belongs to expansion or
to a resource-wiring story, not to the grouping docs page.

The host additionally carries a `withComputed()` block whose own JSDoc says to
reach for it only in a narrow case. That is a third feature composed into a story
already composing three. It reads as reference wiring rather than a lesson.

### `grouping-selection` — clean

One canvas, one lesson, and the `cascade` control *is* the argument (D16: the
library ships no cascade, so all three peer defaults are consumer code over
`rowsOf()`). **Keep as-is.**

### `grouping-crud` — real lesson, undocumented

Not imported by `grouping.mdx` at all — the page says "five stories" and this is a
sixth that exists only in the sidebar. Its lesson is genuine and unique: **no write
ever names a group**; `insertRow`/`patchRow`/`removeRow` go through
`table.value.update()` and the `'group'` render stage re-clusters, so aggregates
follow and a group's last row taking its header with it needs no cleanup.

Verdict: **keep, document, retarget the description** to that sentence. The
`bannerGroupRows` control (banner vs. cell-per-column) is a rendering choice, not a
grouping-API lesson — it is a fine control, but the story's title should not be
about it.

---

## 3. Additions

### 3.1 `enable` — level activation (highest priority)

`applyGrouping({ enable })` is unrepresented, and it is the option with the most
non-obvious contract in the whole feature:

- `true` → level active, `false` → level gated off but **still declared**
- `undefined` (pending) → the **whole rule set abstains**, not just this level
- omitting `enable` entirely → the rule contributes no activation at all
- a rule declaring neither `enable` nor `when` **throws at construction**
  (`feature.ts` `emptyRule` check) — a construction-class error per ADR-0014

A story with one boolean per level plus a "pending" tri-state control makes all
four states reachable. This is also where the read-applied/write-declared
asymmetry (§3.4) is naturally visible, since a gated-off level survives a
round-trip through `.update()`.

### 3.2 `grouping-order` — `applyGroupOrder`

Promoted out of `grouping-regressions`. Same host, same select, minus the two
bug controls, plus the `throwing` option retained as the last entry so the
degrade-and-report contract sits next to the thing it protects.

Also carries the one fact nothing states today: `applyGroupOrder` never activates
or deactivates a level — on a column with no active level it is a silent no-op.

### 3.3 `extractValue` + `label` — key derivation and header naming

Two options, one lesson ("what the group key is, and what the header says it is"),
one story with two controls:

- `extractValue`: `closedAt` → month bucket. Shows that the engine does **not**
  normalize or deep-compare — the return must be a primitive (D7).
- `label`: explicit → matching column id → raw field name, the three-step
  resolution (D7a). `MISSING_GROUPING_LEVEL`-style fields are where the third
  step is observable.

### 3.4 `grouping` reads applied, writes declared (D5) — optional

Lower priority; folds naturally into §3.1 rather than standing alone. Only worth
its own story if §3.1's controls turn out not to make the asymmetry visible.

### 3.5 `grouping-columns` — split out of `grouping-static`

"What happens to a column once it becomes a level" (keep / hide / move to front),
over `toggleColumnVisibility` + `reorderColumns`. Independent of admission, and
the only thing requiring the `effect` + `untracked` block that has nothing to do
with grouping's own API.

### 3.6 `grouping-when` — split out of `grouping-static`

Admission, which is a lesson in its own right and the one place two predicates
interact:

- table-wide `WithGroupingConfig.when` — blank keys (`null`/`undefined`/`''`)
  rejected
- per-column `applyGrouping({ when })` on `category` — a minimum cluster size
- the two **AND** together, and a rejected cluster renders its rows flat at the
  parent's depth with no header, no group id and no aggregates
- a rejected cluster at level 1 takes its rows out of level 2 entirely

Inherits today's `keepBlankRegionsFlat` / `applyMinCategorySize` /
`minCategoryRowCount` controls verbatim — the two removed canvases in §2 become
this story's Controls rather than disappearing.

Note the pairing with §3.1: `when` decides *admission of a cluster*, `enable`
decides *activation of a level*. They are adjacent enough to be confused and are
the strongest argument for one story each rather than one host carrying both.

---

## 4. Resulting story set

Settled by D1–D8. Read in this order; the first is the one to copy.

**`withGrouping()`'s own surface**

| Story | Lesson | Origin |
|---|---|---|
| `grouping-basic` | `initial` — nesting order, editing the level set, `groupingLevels()` | renamed + stripped from `grouping-static` (D1, D8) |
| `grouping-when` | `when` admission — table-wide AND per-column; a rejected cluster renders flat | split out of `grouping-static` (D1) |
| `grouping-enable` | `enable` — level activation, and `undefined` abstaining the whole set | new (§3.1) |
| `grouping-keys` | `extractValue` + `label` — what the key is, what the header says, and that a level names a **row field**, not a column | new (§3.3) + D3 |
| `grouping-order` | `applyGroupOrder` — four comparators, plus the throw fallback as the fifth option | promoted from `grouping-regressions` (D4) |
| `grouping-async-rule` | `applyGroupingAsync` — server-decided level, the pending window, `onError`'s required boolean | unchanged (D2) |
| `grouping-aggregates` | `aggregateFn` — subtree totals at every depth, post-filter by construction, plus the throw fallback as a control | split out of `grouping-static` (D1a) + D3 |

**Compositions**

| Story | Lesson | Origin |
|---|---|---|
| `grouping-columns` | what happens to a column once it becomes a level | split out of `grouping-static` (D1) |
| `grouping-collapsible` | collapse over `groupIds()`, `withGrouping()` + `withExpansion()` only | stripped (D5, D6) |
| `grouping-selection` | cascade over `rowsOf()`, tri-state derived not stored | `cascade` trimmed to two options (D7) |

Ten stories, ten lessons, one canvas each.

**Removed:** `grouping-crud` (D8), the `grouping-regressions` folder (D3, D4),
`BlankRegionsFlat`, `TwoLevelsWithThresholds` (D1), `CollapsibleRefreshFailure`
(D6).

Today: six folders, ten canvases, three API options uncovered, one shipped feature
filed under "do not copy", and one folder absent from the docs page.

### 4b. Docs to re-audit once the migration lands

Deferred deliberately — audited in one pass at the end rather than chased per step.

| Doc | Why it is suspect |
|---|---|
| `docs/0-product/grouping.md` | carries per-story coverage marks against the old set |
| `d8b2434` "grouping-crud coverage sweep, six-story reindex" | indexes six stories including `grouping-crud`, now deleted (D8) |
| `76432ee` "close #88 — single-row/missing-value grouping answers" | written against the pre-split stories |
| `docs/work/grouping-doc-audit/`, `docs/work/spec-coverage-audit/` | untracked at the time of this audit; unknown overlap |
| `grouping-regressions` references anywhere in docs | the folder disappears in step 3 |

### 4a. Spec assertions this audit hands to `with-grouping`

Behaviour that left a canvas and must not leave the codebase. All seven now land in
`api/features/with-grouping/feature.spec.ts`.

| From | Assertion | Where |
|---|---|---|
| D5 | A sort toggle does not disturb collapse state | `collapse state across a sort` |
| D6 | Replacing every row object with an equal-id copy leaves `expandedRows` untouched | `collapse state across a row replacement` |
| D7 | No group id ever enters selection state | `rowsOf` → cascade recipe |
| D8 | Patching a row's group field moves it between clusters | `writes target rows; clustering re-derives` |
| D8 | Patching to a name a sibling holds merges the two clusters | same |
| D8 | Removing a cluster's last leaf removes its header | same |
| D8 | An appended row lands under the cluster its field values name | same |

Two were narrowed while writing them, and the narrowing is the honest half:

- **D6's failure path is consumer wiring, not library behaviour.** A failed refetch means the
  consumer's `linkedSignal` holds its previous value, so the data signal never changes and there
  is nothing for the library to get wrong. What the library owes is the *success* case — same
  ids, new object identities, same group ids — which is what the canvas was actually showing.
- **D8's "no write names a group id" is not separately assertable.** It is a property of the
  other three: every updater in them takes a `RowId` or a row, and none takes a group. Written as
  the append case, where a row lands inside a subtree without any placement write.

---

## 5. The convention this implies

Worth recording once the set above settles — as an ADR (it changes what a story is
*for*), with the operational half in `docs/3-ui/stories.md`:

1. **One canvas per story export.** A second canvas that differs from the first by
   one `args` value is a Control, not a story. (Removes 3 of today's 10.)
2. **A story teaches one API option or one composition.** Not both, and not two
   options that happen to share a host.
3. **A story's lesson must be the feature's own.** If the sentence describing it
   names another feature's contract, it belongs to that feature's page.
4. **Open bugs are not stories.** A gap goes in the tracker and in the spec. A
   *designed* degradation (ADR-0014 fallbacks) is a control on the story of the
   thing it protects, never its own canvas and never its own folder.
5. **An invariant that something does not break is a test, not a story.** If the
   observable outcome of a control is that the screen is unchanged, there is
   nothing to look at — assert it in the spec, where it fails loudly. A story earns
   a control when the control produces a visible state change. (D5.)
6. **A story composes the fewest features its lesson needs.** A feature present
   only to drive an attack, or to demonstrate an opt-out its own docs call
   non-default, comes out. (D5.)
7. **Every story in a domain folder appears in that domain's `.mdx`.** A story not
   on the docs page is a story nobody agreed to maintain (today: `grouping-crud`).
