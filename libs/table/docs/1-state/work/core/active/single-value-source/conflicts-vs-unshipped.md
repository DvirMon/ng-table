# `createColumns()` decisions vs. every unshipped node — execution-grain edges

**Date:** 2026-09-22 · **Depth:** standard · **Scope:** the sixteen decisions
under `decisions.md`'s `## createColumns() grill — dependency ranking
(2026-09-22)` → `### Settled`, against #100, #102, #115, #116, #117, #127,
#128.

**Revised 2026-09-22, second pass.** The first pass had no issue text. All
eight bodies plus four comment threads have since been read [I0]. **Three
verdicts moved** — E3, E4 and E7 — and are marked ▲ below with what changed
and why. E1's severity is now firsthand on both branches. Nothing in the
issue text proved a settled decision unbuildable.

## Answer

**#100 → #129 → #115 is the spine, and only its middle link is recorded.**
#129 declares it blocks #115 [I11]; #115 agrees [I8]. Neither issue records
the #100 edge, but `with-sorting.ts:160,210` read two fields #129 makes
unsettable [R1][R2][R6], so #100/S1 goes first or #129 ships a silent sorting
regression. #128 and #127 are downstream of #129 [I13][I12]. The one genuine
**conflict** is documentary: ADR-0020's Related header asserts the keying rule
ADR-0019 reversed *and* names `TableConfig.columnsSchema`, which #129 deletes
— and #102's own open-items list does not track it [S12][I5][I11].

---

## E1 · #129 N4 + N3 + N6 ↔ #100 / S1 — **ordering constraint (hard)**

**Verdict:** #100's S1 slice lands **before** #129's N3 and N7, or #129 ships
a silent sorting regression for one release. **Unchanged; severity now
firsthand.**

**Neither issue records this edge.** #100's `blocked-by` is #111, #113, #112
[I1]; its body adds #125 [I2]. #129's `Blocks` names only #115 [I11]. So the
edge below exists in code and in neither tracker field.

**Evidence.**

- `with-sorting.ts:160` — `column.sortFn ?? detectComparator(accessor, rows)`
  [R1].
- `with-sorting.ts:210` — `const isSortable = !!column && column.enableSorting
  !== false` [R2].
- Both live on the resolved `ColumnDef`, `api/types.ts:91-92` [R3]. The only
  writer is `ColumnDefInput` (`api/types.ts:106-110`) reaching
  `resolveColumnDefs`'s spread (`engine/columns.ts:54-61`) [R4][R5]. A
  repo-wide grep returns exactly three files; no schema rule writes either
  [R6].
- #129 removes `columns: ColumnDefInput[]` and `columnsSchema` from
  `TableConfig` "outright, no compat window" [I11][D1], fixes `col()` at
  `label`/`visible`/`accessor` [I11][D2], and fixes `setColumns` at
  `{ id } & Partial<{ accessor, visible, label }>` [I11][D5].
- #100's acceptance: "`sortFn` and `enableSorting` are gone from `ColumnDef`
  and `ColumnDefInput` — deleted, not deprecated" [I3]. SO19's "0 production
  authors" is the issue's own measured blast radius [I4][S1].

**Both branches, now firsthand.**

- **#100 first:** the fields leave `ColumnDef` itself [I3], so `:160`/`:210`
  must change in the same PR. Compile-enforced. No window.
- **#129 first:** nothing in #129's Settled table touches `ColumnDef` [I11] —
  it governs `col()`'s options and `setColumns`'s input. So the fields survive
  as permanently-`undefined`, every column falls to `detectComparator`, and
  `enableSorting !== false` is vacuously true, so **no column can be made
  un-sortable**. `detectComparator` is SO7 — shipped with no written spec, and
  sorting's log flags it "becomes load-bearing once SO19 removes `sortFn`"
  [S2].

**Correction to #100's blast-radius table.** It records `enableSorting` at 1
spec author and `sortFn` at 2 (`with-sorting.spec.ts:199,466`), measured
2026-09-16 [I4]. At working tree `c3359c0` there are six: `:144`
(`enableSorting`), `:199`, `:487`, `:612`, `:639`, `:673` (`sortFn`) [R6]. The
spec surface roughly doubled since the count. It does not change the verdict —
it raises N7's migration cost and means the break surfaces in CI, not only at
runtime.

**Options.**

| | Option | Cost |
|---|---|---|
| a | #100/S1 first; #129/N7 migrates already-moved fixtures | Serializes the two largest unshipped nodes. Matches SO19 + #100's own acceptance list [I3]. |
| b | `col()` keeps the two fields one release | **Re-opens two settled decisions** — N4 [D2][I11] and #100's "deleted, not deprecated" [I3]. Forces N6 to carry them too. |
| c | Drop at #129, accept the regression | 0 production authors [I4], but `detectComparator` (unspecced) becomes the only comparator [S2]. |

**Ruled 2026-09-24: (c).** #129 ships first and the regression is
accepted for one release — see `decisions.md`'s
`## Conflict-audit rulings (2026-09-24)`, R1. (b) requires re-opening
settled text and was never on the table.

**Checked and cleared:** ADR-0025 renames `applySortFn` → `sortFn`, and
`ColumnDef.sortFn` exists today — but the two never coexist. The rule is
#100's to ship, and #100's acceptance deletes the field in the same slice
[I3]. No name collision in either order.

**Sub-edge, no conflict:** `applySortNulls` moving out of the columns schema
[I2][S3] is unaffected — the columns schema fn survives as `createColumns`'s
third positional argument [I10][S8].

---

## E2 · #129 N2 (dev-only construction throws) ↔ #114's shipped G71/G72 — **no conflict, conditional**

**Verdict — ruled 2026-09-24, and the condition is reversed.** The wrap
sits **inside** `schema/validate.ts`, the shared body, by policy: R7 makes
every construction check dev-only library-wide, so there is nothing to
confine to the columns-side call sites. That settles this edge as option
B and makes the conditional below moot — the failure mode it describes is
now the accepted behavior, not a risk. The G71 revisit this obliged is
**settled 2026-09-24**: the dev-only gate reaches G71's construction half
only, and `table.grouping`'s writer keeps throwing in production —
registered as [G76](../../../../decisions/grouping.md). See
`decisions.md`'s `## Conflict-audit rulings (2026-09-24)`, R7 and R8.

**Evidence.** #129: "Rule-id and metadata-key checks move into
`createColumns`; duplicate-id is added there and stays on the write path; all
three `ngDevMode`-gated" [I11][D4]. The first two are columns-scoped wrappers
— `engine/columns.ts:27-37` (already gated at `:51`) and
`engine/columns-schema/resolve.ts:19-28` [R5][R9]. Only `resolve.ts:19` calls
the **shared** body `assertDeclarationsAreKnown`, whose own comment says "one
body serves `columnsSchema`, `withGrouping`, `withFiltering` and
`withSorting`" [R10].

**The failure mode if the wrap moves down.** G71 is shipped: an unknown
grouping column id throws on **both** the construction and writer paths, and
`groupingLevels()`'s total read depends on it [S4]. Wrapping the shared body
makes grouping's construction throw dev-only and reintroduces, in production,
the unreachable-id case G71 closed. G72's degrade path was scoped as the
*runtime* half, not a substitute [S5].

**Not tracked anywhere.** Neither #129 nor #114 records this constraint
[I11]. It belongs in #129's spec: the wrap is `resolve.ts`-local;
`schema/validate.ts` stays ungated.

---

## E3 ▲ · #129 ↔ #115 — **ordering constraint: #129 before #115** *(moved)*

**Moved from "no conflict".** The first pass reasoned only about types and
concluded #115 was unaffected. The type half was right — and #115's body
states it in the same terms, independently: "The map this slice *reads* is
unchanged — it comes off `TableStore` through `ColumnValuesOf<In>`, which #129
does not touch" [I8]. What the first pass missed is the **migration** half.

**Why it moved.** #115's acceptance includes "Affected filtering stories and
fixtures migrated, **declaring their columns through `createColumns()`**"
[I7]. That spelling only exists after #129. #115's body records #129 as a new
hard blocker as of 2026-09-22: "every fixture, spec and story host that
declares columns changes spelling… planning this slice before #129 lands means
planning it twice" [I8]. #129 records the reciprocal under `Blocks` [I11].
#115's assessment log: "2026-09-22 — STILL BLOCKED, re-edged… Re-run /to-tasks
once #129 is done" [I9].

**The type analysis that survives.** `FiltersPath<TRow>` keys by
`Extract<keyof TRow, string>` today (`with-filtering/types.ts:96-98`);
`FilterHandle` matches (`engine/filters/types.ts:10-15`) [R11][R12]. Re-keying
is #115's own work. The recovery seam is `ColumnValuesOf<S>`
(`engine/types.ts:123-127`), reading `S.__columnValues` — a phantom on
`TableStore`/`TableCore` (`api/types.ts:238`, `engine/types.ts:57`), **not**
on `TableConfig` [R7][R8][R13]. #129 changes only `TCols`'s constraint
[I10][S8]. `withFiltering<In extends Shape>` carries no `columns` yet
(`with-filtering/feature.ts:27`) — widening it is V3, inside #115 [R14].

**N9 is not an independent leaf.** #129 lists "`FiltersPath` and `SortingPath`
key by `ColumnIdIn<ColumnValuesOf<In>>` when #115 and #100 land" under *Still
open, for the spec* [I11]. At execution grain that is the same edit #115 and
#100 each already make. Either they write that spelling directly and N9 is
empty, or N9 lands after both. It cannot land before.

**Consequence for E1.** #100 is the only one of the three **not** blocked by
#129 — neither issue claims it [I1][I11]. So `#100 → #129 → #115` is
consistent, and E1's option (a) is the only ordering that satisfies all three.

---

## E4 ▲ · #128 ↔ #117 `stateOf` — **conflict (documentary), narrowed scope** *(moved)*

**Moved from "no conflict".** The first pass reasoned from G63's one-line
summary and concluded `stateOf` merely narrows. #117's body names a field
#128 deletes.

**The conflict.** #117 illustrates the register three times as:

```ts
ctx.stateOf(path.total)        // the column config → { visible, order, … }
```

— verbatim, in both #117 [I15] and #116 [I14]. #128 removes `ColumnDef.order`
outright and moves runtime order to an ordered `string[]` slice [I13][D7]. So
`stateOf`'s only published example returns a field that will not exist.

**What survives, and it is not thin.** #117's table says `stateOf` is "another
column's state — today: untyped `columns()`" [I15], and its acceptance asks
that "column rules can name another column without a string-keyed lookup over
`columns()`" [I16]. That target is real and verifiable: `ColumnRuleContext`
exposes exactly `columns: () => ColumnDef<TRow>[]`
(`columns-schema/types.ts:9-11`) [R21]. So `stateOf` replaces a concrete
untyped lookup — it has a job regardless of `order`.

**What remains readable** after N4 drops `meta`/`order` from `col()` [D2][I11],
#128 removes `ColumnDef.order` [I13], and #100 removes `sortFn`/
`enableSorting` [I3]: `id`, `accessor`, `visible`, `label`, `meta`
(`api/types.ts:83-98`) [R3]. Two are non-trivial to read otherwise —
`visible` is rule-folded and AND-combined per column by `foldColumnRules`
(`engine/columns.ts:163-166`) off the `VISIBLE` key (`:104`), and `meta` is
rebuilt from the rule registry every fold (`:168-176`) [R15]. N4 removes only
`meta`'s *declaration* form; `metadata()` stays the writer [D2].

**Ruled 2026-09-24: `stateOf` ships without order; whether the ordered id
slice gets a reader is #128's question, not #117's.** The published
example `ctx.stateOf(path.total) // → { visible, order, … }` is wrong as
written and is **owed a correction in both #117 and #116**, which carry
it verbatim. See `decisions.md`'s
`## Conflict-audit rulings (2026-09-24)`, R2.

---

## E5 · #129 N3 (`columnsSchema` leaves `TableConfig`) ↔ G61 — **no conflict, wording amendment owed**

**Verdict:** G61's substance holds; the framing sentence is stale. Unchanged,
now firsthand on both sides.

**Evidence.** G61 rejects "a single `TableConfig.schema`" because
"`applyGrouping` could then be declared with no `withGrouping()` composed"
[S9]. #129 does not create one — it moves the *columns* schema from
`TableConfig.columnsSchema` [R16] to `createColumns`'s third argument
[I10][I11], leaving per-feature entries intact [R14]. The rejected shape stays
rejected.

**Count-independence is stated on the issues.** #100: "the shared mechanism
has five per-feature entries rather than four. The count was never the rule —
*one mechanism, per-feature entries* is (G61)" [I2]. #116 states the same as a
rule: "Every feature with per-column config declares it through a schema entry
— there is no second spelling" [I14].

**What is stale.** Both #100 and #116 still write "`columnsSchema` is left
holding `applyVisible` / `applyVisibleAsync` and the raw `metadata()` channel"
[I2][I14] — a config property #129 deletes, naming two functions ADR-0025
renames [S6]. A one-line amendment on G61's row plus a pass over both issue
bodies; not a reversal.

---

## E6 · #116 ↔ ADR-0025 and #129 — **ordering constraint on the wording + one open naming gap**

**Verdict:** #116's *decisions* are unblocked; its *prose* is stale in two
places. Refined — the first pass overstated this as a hard "#116 after #129".

**#116 says it is unblocked.** "Blocked by: None — can start immediately"
[I14]. That is right for its three rules: every schema fn names declared
column ids (ADR-0024's rule), two authoring forms, and the two-tier resolver
rule [I14]. None of the three depends on where the columns schema lives.

**Two stale spots in the filed text.**

1. Rule 2's prose names `columnsSchema`, `applyVisible`, `applyVisibleAsync`
   [I14] — one config property #129 deletes [I11], two functions ADR-0025
   renames [S6].
2. #116's acceptance already owns the reconciliation #129 needs: "ADR-0021's
   superseded path-vocabulary rule is reconciled" and "ADR-0019's Amendment
   2026-09-20 points at the new ADR" [I17].

**The open naming gap, now firsthand.** ADR-0025 governs functions that
**register** a declaration, on `declarative-naming.md`'s bare-vs-`is*`/`has*`
split [S6]. `valueOf`, `criterionOf` and `stateOf` **read** one and carry an
`*Of` suffix. #116 owns "resolver naming" [I14] and its text never mentions
the prefix convention; ADR-0025 never mentions resolvers [S6]. So no document
covers the third class.

**Ruled 2026-09-24: it extends.** ADR-0025 gains one sentence — a
function that reads a declaration ends in `Of` — and #116 makes that
edit, since it owns resolver naming. Owed, not done here. See
`decisions.md`'s `## Conflict-audit rulings (2026-09-24)`, R3.

---

## E7 ▲ · #129 N6 ↔ #128 — **ordering constraint; #128 names the property at risk** *(moved)*

**Moved from "recoverable, low cost".** Still recoverable — but #128's body
names the exact property #129/N6 breaks, which makes this a knowing regression
rather than an oversight.

**#128's own words:** "**Why both channels stay** — Declared order (array
position) and runtime order (the id list) are separate on purpose. The only
stated rationale found in any vendor is AG Grid's `maintainColumnOrder`: **a
user's drag order must survive a `setColumns()` re-declaration**" [I13].

**That is precisely what N6 removes for one release.** Today
`setColumns(defs)` calls `resolveColumnDefs` (`mutations/update-columns.ts:
14-18`), which assigns `order: def.order ?? index` (`engine/columns.ts:59`)
[R17][R5] — a caller *can* carry a drag order through. N6 narrows the input to
`{ id } & Partial<{ accessor, visible, label }>` [D5][I11], so `order` becomes
unreachable and every `setColumns()` resets order to the new array index.
#128's change table confirms the same transition [I13].

**Still recoverable:** the consumer owns the id list and can re-apply
`reorderColumns(ids)` (`mutations/update-columns.ts:21-25`) after the write
[R17]. A DX regression, not data loss.

**Ruled 2026-09-24: ship N6 with #129 and document the re-apply until
#128 lands.** Matches #128's own stated separability [I13][D7]; the
window #128 does not acknowledge is now recorded as an obligation on
both issues — see `decisions.md`'s
`## Conflict-audit rulings (2026-09-24)`, R4. Landing #128 first was
rejected.

---

## E8 · #128 ↔ #129 (both touch the column surface) — **no conflict**

**Verdict:** separated by a settled decision, and the separation holds against
code. Unchanged.

**Evidence.** #128's opening line: "That ticket drops the `order` **option**
from `col()` only; `ColumnDef.order` keeps deriving from the array index until
this lands" [I13] — matching `decisions.md` exactly [D7]. Verified:
`engine/columns.ts:59` is that expression [R5], and the two other `order`
writers — `applyColumnOrder` (`engine/columns.ts:65-74`) and `reorderColumns`
— are untouched by any #129 decision [R5][R17].

**Shared blast radius is the stories.** #128 estimates "roughly ten story
hosts change their visible-column loop" [I13]; the exact count at `c3359c0` is
**nine** files carrying `.sort((a, b) => a.order - b.order)`, all under
`stories/grouping/` [R18]. #129/N7 rewrites their `columns:` arrays; #128
rewrites the same nine files' loop. Same files, different lines — a merge-cost
note, not an edge.

---

## E9 · #129 N1/N3 ↔ #127 — **ordering constraint**

**Verdict:** #127 lands after #129. Unchanged; the narrowing point is
confirmed **absent** from the issue.

**Evidence.** #127 is `needs:grill` with both options recorded and neither
chosen [I12] — matching `decisions.md` [D8]. Its stated blocker is
`createTable`, not `createColumns`: "`createTable`'s `config` is evaluated
once…; `resolveColumnsConfig` runs once and `baseColumns` is seeded once. So
`computed(() => createColumns(…))` produces values nobody re-reads" [I12].
Verified shape: `resolveColumnsConfig` is a plain synchronous function over
`(columns, schema?)` with no signal in it (`resolve.ts:65-78`) [R9].

**The gap.** N1 dropped the `kind` discriminant because the only union to
narrow is function-vs-object, which `typeof value === 'object'` separates —
precedent `isColumnSchema` (`resolve.ts:13-17`), one non-test reader [D3][R9].
#127's **option B** puts `Signal<ColumnSet>` on `TableConfig.columns` [I12],
which is a **function** on the same slot as the object `ColumnSet`, so
`resolveColumnsConfig` needs an `isSignal` narrowing again. #127's text does
not state this. It does not reopen N1 — N1's argument was about a `kind`
*field*, and `isSignal` is a first-party runtime test — but #127's grill
should not assume the slot stayed single-shaped.

---

## E10 · #129 N3 ↔ #102 / ADR-0020 — **conflict (documentary), untracked**

**Verdict:** ADR-0020's Related header is wrong twice over, and **#102's own
open-items list does not track it.** Strengthened.

**Evidence.** ADR-0020 (`Status: proposed`) opens by citing ADR-0021 as: "a
third-party feature declaring a schema names **row fields**, not columns — the
column path belongs to `TableConfig.columnsSchema` alone" (`:11-13`) [S12].

1. **Reversed 2026-09-20.** ADR-0019's Amendment: "the rule is now simply
   **every schema fn names declared columns**" [S7]. `decisions/sorting.md`
   agrees — ADR-0021's "capability test stands; its path-vocabulary rule does
   not" [S13]. #116 exists to write this up [I14].
2. **The named home is deleted.** #129 removes `TableConfig.columnsSchema`
   outright [I11][D1]; it is live today at `api/types.ts:179-181` [R16].

**The tracking gap.** #102 lists exactly three open items — the `'expand'`
anchor vs. #101, interface declaration merging through the build, and the
ADR-0014 citation [I5]. The stale keying rule is not among them, and #102 has
no comments [I6].

**The maintainer already caught this pattern elsewhere.** #100's comment
strikes the same three citations from #100's own body: "All three of those
citations are now dead: **D7** is reversed by ADR-0024… **ADR-0019's
Amendment**… has been re-amended 2026-09-20 to say the opposite… **ADR-0021's
path-vocabulary rule** is superseded" [I18]. The identical sweep was not run
over ADR-0020.

**Code consequence.** A third-party stage author following ADR-0020 as written
builds a `keyof TRow`-keyed schema — the blind spot ADR-0019 closes and the
one ADR-0024's carrier columns depend on being closed.

**Ruled 2026-09-24: (a) — amend ADR-0020's header now, on its own.**
**Done**, not owed: the Related header's ADR-0021 citation now reads
"its capability test stands; its path-vocabulary rule does not", citing
ADR-0019's Amendment 2026-09-20. Nothing else in ADR-0020 changed and it
stays `proposed`. See `decisions.md`'s
`## Conflict-audit rulings (2026-09-24)`, R5. Folding into #116 was
rejected.

---

## E11 · #129 (`col()`, `col.from`) ↔ #102 (unexported `schema/path-proxy.ts`) — **no conflict**

**Verdict:** disjoint surfaces. Unchanged, now firsthand.

**Evidence.** `index.ts` exports `./api/create-columns` (`:8`) and
`./columns-schema/*` (`:72-75`, `:116-124`) but nothing from `schema/` [R19],
confirming `path-proxy.ts` is internal. #102's plan lists "export feature-author
surface" as its own work item 2 of 8 [I5], and #111's step plans deliberately
deferred the export to it [S14]. What #129 adds is
`col()`/`ColumnBuilder<TRow>`/`col.from` — a builder that mints **column
declarations** [I11][D9]. A third-party feature under ADR-0020 declares stages
and schemas, never columns [I5], so it has no use for `col.from`.

---

## E12 · #129 N3 ↔ `assertDeclarationsAreKnown`'s message — **no conflict, one-line fix owed**

`schema/validate.ts:17-18` hardcodes "no column with this id exists in the
`columns` array" [R10]. After N3 there is no `columns` array — declarations
come from `createColumns` [I11][D1]. The `label` parameter names the
*declaring* surface, not the source of truth, so no call site fixes this. One
string edit inside #129's N2 step. Not tracked on any issue [I11].

---

## E13 · #129 N4 (`meta` drops) ↔ `metadata()` — **no conflict, 0 in-repo authors**

A repo-wide grep for a declared `meta:` on a column returns only
`foldColumnRules`'s own local (`engine/columns.ts:168`) and three
`metadata.spec.ts` casts (`:74`, `:80`, `:86`) [R20]. No column declaration in
`src/` declares `meta`. #129 states the payoff directly: "dropping `meta`
closes a silent-replace path in `foldColumnRules`" [I11], matching N4's
"redundant, and live" argument [D2].

---

## Adjacent edge found in the issue text (not a #129 edge)

**#100 → #117 is real and unrecorded.** #117's acceptance defers the resolver
spelling: "`sortFn` can reach the resolver — either `withSorting` gains a path
or the resolver takes the column id; **settle with #100** rather than
inventing a third spelling here" [I16]. #100 answers it — a schema fn puts a
`path` in scope, "so no second spelling is needed and #117 does not have to
invent one" [I2]. But #117's `blocked-by` is #114 and #115 only [I15].

**Ruled 2026-09-24: #100 joins #117's `blocked-by`.** The field edit is
owed, made at the end of the grill — see `decisions.md`'s
`## Conflict-audit rulings (2026-09-24)`, R6. Narrowing #117 to drop the
sort-function reader was rejected.

---

## Landing order

```
#100/S1  ──► #129 ──┬──► #115 ──┐
  (E1)      (incl.  │   (E3)    ├──► #117
            ADR-0025│           │   (also needs #114 ✅,
            rename) │           │    and #100 — see
                    │           │    Adjacent edge)
                    │           │
                    ├──► N9 ────┘   (empty if #100/#115 write
                    │                ColumnIdIn<ColumnValuesOf<In>>)
                    ├──► #128        (E7 window until it lands)
                    └──► #127

#116  ── unblocked, start any time ──► #102 / ADR-0020
 │        (prose needs #129's + ADR-0025's names — E6)
 └─ E10's ADR-0020 header fix can go ahead of #116
```

**Summary line.** Strictly sequenced: `#100/S1 → #129 → #115 → #117`, with
`{N9, #128, #127}` all downstream of #129. Parallel-safe: `#116` and E10's
one-line ADR-0020 fix against everything; `[#128, #127]` with each other once
#129 lands. The whole spine is one chain — there is no parallelism among
#100/#129/#115.

---

## Needs a human ruling

**All six ruled 2026-09-24.** Each is recorded in `decisions.md`'s
`## Conflict-audit rulings (2026-09-24)` section.

1. ~~**E1 — record the `#100 → #129` edge, or take option (c)?**~~
   **Settled 2026-09-24 — (c).** See `decisions.md`,
   `## Conflict-audit rulings (2026-09-24)`, R1.
2. ~~**E4 — does `stateOf` expose #128's order slice, or does order leave
   the register?**~~ **Settled 2026-09-24 — ships without order; the
   reader is #128's call.** See `decisions.md`,
   `## Conflict-audit rulings (2026-09-24)`, R2.
3. ~~**E6 — do `valueOf`/`criterionOf`/`stateOf` fall under ADR-0025?**~~
   **Settled 2026-09-24 — yes, ADR-0025 extends to readers; #116 makes
   the edit.** See `decisions.md`,
   `## Conflict-audit rulings (2026-09-24)`, R3.
4. ~~**E7 — #128 before #129/N6, or document the `reorderColumns`
   re-apply?**~~ **Settled 2026-09-24 — document the re-apply.** See
   `decisions.md`, `## Conflict-audit rulings (2026-09-24)`, R4.
5. ~~**E10 — amend ADR-0020's header now, or fold into #116?**~~
   **Settled 2026-09-24 — amended now; the edit is done.** See
   `decisions.md`, `## Conflict-audit rulings (2026-09-24)`, R5.
6. ~~**Adjacent — add #100 to #117's `blocked-by`, or state why not?**~~
   **Settled 2026-09-24 — add it.** See `decisions.md`,
   `## Conflict-audit rulings (2026-09-24)`, R6.

Ruling 5 of the first pass ("is `{visible, label, meta}` enough for `stateOf`
to be worth a register?") is **resolved and dropped** — #117 names a concrete
target, the untyped `columns()` lookup on `ColumnRuleContext` [I15][I16][R21].

---

## Not researched

- #125's `progress.md` and the `4-tasks/` step plans beyond the four #111
  files that surfaced in grep.
- `feature-authoring/plan.md`'s "Work items 1–8", which #102 says owns its
  sequencing [I5]. Only #102's own body was read.
- The five sibling discovery docs and `proposal-column-value-mechanics.md`
  were read through the summaries `decisions.md` quotes plus targeted greps,
  not re-verified independently. `discovery-column-order.md` was read in full.
- #101, #110, #47, #45, #81 — referenced by the eight bodies, not fetched.
- The `apps/site` docs surface.
- #129's N5 (`ColumnSet` reuse across two live tables). Nothing in the seven
  nodes touches injection context.

## Unverified

- **#115's GitHub `blocked-by` field is stale.** It lists #113 and #111 [I7];
  the body adds #125 and #129 [I8] and #129 claims the reciprocal [I11].
  Whether the field or the body is authoritative for tooling is not stated
  anywhere I read. Cosmetic unless something reads the field.
- **E9's `isSignal` claim** is reasoned from N1's narrowing argument [D3] and
  `resolveColumnsConfig`'s current signature [R9]. #127 does not address it
  [I12] — confirmed absent, not confirmed wrong.
- **The 150k-accessor figure** behind #128 is arithmetic over a verified code
  path, not a benchmark — #128 flags this about itself [I13] and
  `discovery-column-order.md` does too [S11]. Per the repo's no-unprompted-runs
  rule, no bench was run here.

**Resolved since this list was written:** E2's wrap placement is no longer
undecided — ruled 2026-09-24, the wrap sits in the shared body by policy
(R7). Moved here from the list above.

**Resolved since the first pass** (was unverified, now firsthand): every issue
body and the four comment threads [I0]; the rename pass has an owner — it is
**#129's**, listed in its Settled table as "Rule naming | `apply` prefix
stripped library-wide" [I11], not an unfiled node; and E1's severity on both
branches [I3][I11].

## Sources

| | Source | Verified |
|---|---|---|
| I0 | `…\scratchpad\issues.md` — `gh issue view` output for #100, #102, #115, #116, #117, #127, #128, #129 (bodies + `--comments`), repo `DvirMon/ng-table`, fetched by the maintainer with an authenticated `gh`, 2026-09-22, 917 lines | yes — read in full; supersedes the first pass's access gap |
| I1 | `issues.md:17` — #100 `blocked-by: #111, #113, #112` | yes — read; #129 absent |
| I2 | `issues.md:177-210` — #100 "The sorting schema (decided 2026-09-20)" | yes — read; five per-feature entries, G61 count-independence, the `sortFn` resolver closing |
| I3 | `issues.md:237-238` — #100 acceptance | yes — read; "gone from `ColumnDef` and `ColumnDefInput` — deleted, not deprecated" |
| I4 | `issues.md:152-175` — #100 "Blast radius, measured (2026-09-16)" | yes — read; corrected against `c3359c0` — the spec-author counts are now low, see E1 |
| I5 | `issues.md:339-366` — #102 body, plan link and its three open items | yes — read; the stale keying rule is **not** among them |
| I6 | `issues.md:369-370` — #102 comments | yes — read; none |
| I7 | `issues.md:387,410-420` — #115 `blocked-by` field and acceptance criteria | yes — read; "migrated, declaring their columns through `createColumns()`" |
| I8 | `issues.md:431-437` — #115 "Blocked by · #129" | yes — read; **moved E3** — names the migration edge the first pass missed, while confirming the type half |
| I9 | `issues.md:454-457` — #115 assessment log, 2026-09-22 | yes — read; "STILL BLOCKED, re-edged… Re-run /to-tasks once #129 is done" |
| I10 | `issues.md:1098-1114` — #129 "The call" | yes — read; schema as `createColumns`'s third argument, `visible()` bare-named |
| I11 | `issues.md:1116-1163` — #129 Settled table, Still open, Acceptance, Blocks | yes — read; `ColumnDef` itself untouched; rename pass is #129's; `Blocks: #115` |
| I12 | `issues.md:891-973` — #127 body, options A and B, "What would settle it" | yes — read; option B puts a `Signal` on `TableConfig.columns`; no narrowing discussion |
| I13 | `issues.md:998-1062` — #128 body | yes — read; **moved E7** — "a user's drag order must survive a `setColumns()` re-declaration" |
| I14 | `issues.md:522-619` — #116 body, rules 1-3 | yes — read; "Blocked by: None"; rule 2 still names `columnsSchema`/`applyVisible` |
| I15 | `issues.md:663-730` — #117 header, `blocked-by`, resolver table, three-register block | yes — read; **moved E4** — `stateOf` → `{ visible, order, … }`; `blocked-by: #115, #114` |
| I16 | `issues.md:815-830` — #117 acceptance criteria | yes — read; "settle with #100"; "without a string-keyed lookup over `columns()`" |
| I17 | `issues.md:623-635` — #116 acceptance criteria | yes — read; ADR-0021 reconciliation and the ADR-0019 back-reference are already scoped here |
| I18 | `issues.md:288-316` — #100's single comment | yes — read; strikes D7 / ADR-0019 Amendment / ADR-0021 as dead citations — the same sweep E10 says was never run over ADR-0020 |
| D1 | `decisions.md:506-518` — N3, array intake dropped outright | yes — read |
| D2 | `decisions.md:409-426` — N4, `col(id, opts)` options | yes — read |
| D3 | `decisions.md:428-444` — N1, `ColumnSet` is `{ columns, rules }` | yes — read |
| D4 | `decisions.md:545-561` — N2, throws relocate and become dev-only | yes — read |
| D5 | `decisions.md:574-599` — N6, `setColumns`'s narrowed input | yes — read |
| D7 | `decisions.md:681-697` — the order slice is #128 | yes — read |
| D8 | `decisions.md:465-481` — runtime-dynamic ids out of scope | yes — read |
| D9 | `decisions.md:657-679` — `col.from`, never a spread | yes — read |
| S1 | `libs/table/docs/decisions/sorting.md:64` — SO19 | yes — read; corroborated firsthand by [I3] |
| S2 | `libs/table/docs/decisions/sorting.md:78-81` — SO7 still open | yes — read; the fallback comparator has no written spec |
| S3 | `libs/table/docs/decisions/sorting.md:66` — SO21 | yes — read |
| S4 | `libs/table/docs/decisions/grouping.md:112` — G71, shipped | yes — read |
| S5 | `libs/table/docs/decisions/grouping.md:113` — G72, shipped | yes — read |
| S6 | `libs/table/docs/adr/0025-schema-rule-functions-are-bare-named.md:6,8,13,20` | yes — read; governs registrars only — never mentions resolvers |
| S7 | `libs/table/docs/adr/0019-columns-path-keyed-by-declared-column-ids.md:17-51` | yes — read; the 2026-09-20 amendment |
| S8 | `design-create-columns.md:36-52` — the `createColumns` signature | yes — read |
| S9 | `libs/table/docs/decisions/grouping.md:102` — G61 | yes — read |
| S11 | `discovery-column-order.md:26-28,206-213` | yes — read; `maintainColumnOrder`, and the bench caveat |
| S12 | `libs/table/docs/adr/0020-open-stage-registration-for-third-party-features.md:11-13` | yes — read; the stale ADR-0021 citation, in a `proposed` ADR |
| S13 | `libs/table/docs/decisions/sorting.md:98-100` | yes — read |
| S14 | `4-tasks/issue-111-decouple-mechanism/step-3-shared-recording-runner.plan.md:137-138` | yes — read; "#102 … is what would export it" |
| R1 | `libs/table/src/api/features/with-sorting.ts:160` | yes — read; `column.sortFn ?? detectComparator(...)` |
| R2 | `libs/table/src/api/features/with-sorting.ts:210` | yes — read; `column.enableSorting !== false` |
| R3 | `libs/table/src/api/types.ts:83-98` — `ColumnDef` | yes — read |
| R4 | `libs/table/src/api/types.ts:106-110` — `ColumnDefInput` | yes — read |
| R5 | `libs/table/src/engine/columns.ts:27-74` | yes — read; `order: def.order ?? index` at `:59`, dev-gate at `:51`, `applyColumnOrder` at `:65-74` |
| R6 | repo-wide grep `sortFn\|enableSorting` over `libs/table/src` | yes — ran; 3 files; six spec write sites, correcting [I4]'s three |
| R7 | `libs/table/src/engine/types.ts:123-127` — `ColumnValuesOf<S>` | yes — read |
| R8 | `libs/table/src/api/types.ts:238` — `TableStore.__columnValues` | yes — read |
| R9 | `libs/table/src/engine/columns-schema/resolve.ts:13-78` | yes — read; `isColumnSchema`, both asserts, `resolveColumnsConfig` |
| R10 | `libs/table/src/schema/validate.ts:1-22` | yes — read; ungated throw; message hardcodes "`columns` array" |
| R11 | `libs/table/src/api/features/with-filtering/types.ts:96-98` | yes — read; `FiltersPath` keys by `Extract<keyof TRow, string>` |
| R12 | `libs/table/src/engine/filters/types.ts:10-15` — `FilterHandle` | yes — read |
| R13 | `libs/table/src/engine/types.ts:57` — `TableCore.__columnValues` | yes — read |
| R14 | `libs/table/src/api/features/with-filtering/feature.ts:27` | yes — read; `In extends Shape`, no `columns` |
| R15 | `libs/table/src/engine/columns.ts:104,163-177` — `VISIBLE`, `foldColumnRules` | yes — read |
| R16 | `libs/table/src/api/types.ts:179-181` — `TableConfig.columnsSchema` | yes — read |
| R17 | `libs/table/src/mutations/update-columns.ts:14-25` | yes — read; `setColumns`, `reorderColumns` |
| R18 | grep `.sort((a, b) => a.order - b.order)` over `libs/table/src` | yes — ran; **nine** grouping story hosts, against [I13]'s "roughly ten" |
| R19 | `libs/table/src/index.ts:8,72-75,116-124` | yes — read; `create-columns` exported, nothing from `schema/` |
| R20 | grep `meta:\s*new Map\|meta:\s*\w` over `libs/table/src` | yes — ran; no column declaration sets `meta` |
| R21 | `libs/table/src/columns-schema/types.ts:9-11` — `ColumnRuleContext.columns` | yes — read; the untyped `() => ColumnDef<TRow>[]` lookup `stateOf` replaces |
