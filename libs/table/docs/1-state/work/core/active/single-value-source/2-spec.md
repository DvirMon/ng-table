---
title: createColumns() — one call declares presentation, accessor and rules
type: spec
date: 2026-09-24
status: specced
ticket: https://github.com/DvirMon/ng-table/issues/129
---

# `createColumns()` — spec

Source decisions:
[`decisions.md`](decisions.md) — `## createColumns() grill —
dependency ranking (2026-09-22)` → `### Settled` (sixteen
decisions) and `## Conflict-audit rulings (2026-09-24)` →
`### Settled` (R1–R8). Design brief:
[`design-create-columns.md`](design-create-columns.md). Edge
inventory: [`conflicts-vs-unshipped.md`](conflicts-vs-unshipped.md).

Premises: ADR-0019 (paths key by declared column id),
ADR-0024 (the accessor is the single value source),
ADR-0025 (schema rules are bare-named), ADR-0014 including its
2026-09-24 amendment (construction checks are dev-only).

---

## Problem Statement

Declaring a table's columns today takes two config properties
that do not know about each other, and the type system only
half-protects either.

**The declaration is split in two.** A consumer writes the
column list in one config property and the column rules —
visibility, metadata — in a second one beside it. Nothing ties
a rule to the column it targets except a string that has to
match. The two are ordered relative to each other by config
key, not by the thing they describe, so reading a column's
full definition means reading two places and matching ids by
eye.

**The literal ids degrade silently.** Column ids are what
every schema path autocompletes from, so losing them loses
the typing of grouping, filtering and sorting declarations
downstream. A plain array assigned to a variable widens every
`id` to `string` before the table ever sees it, and nothing
reports that — the path proxy quietly becomes an index
signature that accepts any name. The workaround shipped so
far is a curried helper the consumer has to remember to call,
with the row type written out by hand. Forgetting it is not
an error; it is a silently weaker table.

**A value the table reads but never renders is awkward to
declare.** ADR-0024 made every grouped, filtered and sorted
value come from a declared column, so a carrier column
(`visible: false`) is now routine. Writing one means writing
an object literal by hand, which is exactly the shape that
widens.

**Derived values do not type.** A column whose value comes
from an accessor — an owner's name off a nested object, a
computed total — has no way to tell the rest of the table
what type that value is unless the declaration captures the
accessor's return type at the point it is written.

**A column carries options that have a better spelling
elsewhere, and one that is actively wrong.** A declared
metadata map is silently replaced wholesale by the rule
registry rather than merged, so two ways of setting the same
key never even compare. A declared `order` competes with the
array's own position for the same fact.

**Mistyping a column id is not caught.** A rule naming a
column that does not exist, two columns sharing an id, or a
metadata key registered twice on one column are all developer
errors that should be impossible to ship and today are found
by reading output.

## Solution

One call declares a table's columns: their presentation,
their value source, and the rules that apply to them.

```ts
const dealColumns = createColumns(
  this.deals,
  (col) => [
    col('region', { label: 'Region' }),
    col('amount'),
    col('owner', { label: 'Owner',
                   accessor: (row) => row.owner.name }),
    col('selected', { visible: false }),
  ],
  (path) => {
    visible(path.region, { when: () => canSee() });
    metadata(path.owner, WIDTH_KEY, 120);
  },
);

createTable(this.deals, { trackBy: 'id',
                          columns: dealColumns }, withSorting());
```

What the consumer gets:

- **The column literals are captured, always.** Ids are
  written inside the call, so they cannot widen on the way
  out. Assigning the result to a variable, exporting it,
  sharing it across two tables — none of that degrades it.
  The correct spelling is now also the only spelling.
- **The accessor's return type reaches the rest of the
  table.** Declaring `accessor: (row) => row.owner.name`
  makes that column's value a `string` everywhere the table
  exposes values, not the nested object the row happens to
  hold. A column with no accessor keeps its own field type —
  exact, not a fallback, because the engine's default
  accessor really is "read the field named by the id".
- **Rules live with the columns they describe.** The schema
  function is the third argument of the same call, so a
  column's full definition is one expression. Its paths
  autocomplete the ids just declared, and a typo is a compile
  error.
- **Nothing is annotated in the common case.** The row type
  flows from the data signal given as the first argument, so
  `col`, `row` and `path` are all typed with nothing written.
  The data argument is read for its type only — it is never
  called, so a table rendering headers before any row arrives
  is unaffected. For a declaration shared across data sources
  there is a builder-first form taking one annotation.
- **A hand-written column object is rejected.** Column
  declarations are minted only by the builder; a plain object
  literal in the array is a compile error, not a silently
  widened column.
- **Declaring a variant is a call, not a spread.** Copying a
  declaration and overriding its id is what would type
  confidently wrong, so there is a sanctioned spelling for
  it.
- **Developer errors fire on the first render, in dev.** An
  unknown column id in a rule, a duplicate column id, a
  metadata key registered twice on one column — all throw at
  construction, all stripped from production builds.
- **A carrier column is one option.** `col('selected',
  { visible: false })` — no object literal, no widening.

Sharing one column set across two live tables is supported:
the rules compile once, and every async rule is instantiated
per table inside that table's own injection context.

## User Stories

1. As an app developer declaring a table, I want to declare
   all of a table's columns in one call, so that a column's
   definition is one expression instead of two config
   properties matched by id.
2. As an app developer, I want the column ids I write to stay
   literal no matter where I assign the result, so that every
   schema path downstream autocompletes real ids instead of
   accepting any string.
3. As an app developer, I want the row type to flow from the
   data I pass in, so that I never annotate `col`, `row` or
   `path` in the common case.
4. As an app developer, I want a builder-first form taking a
   single annotation, so that one column declaration can be
   shared across two different data sources.
5. As an app developer, I want the data argument to be read
   for its type only, so that a table rendering headers
   before the first row arrives behaves identically.
6. As an app developer reading rows from a resource rather
   than a writable signal, I want the data argument to accept
   anything callable that yields rows, so that I am not
   pushed onto the annotated form for no reason.
7. As an app developer, I want a column with no options to be
   a one-argument call, so that the default case stays the
   shortest to write.
8. As an app developer, I want to give a column a human
   label, so that a header renders something other than the
   id.
9. As an app developer, I want to declare a column hidden at
   declaration time with a plain boolean, so that a carrier
   column that the table reads but never renders has exactly
   one spelling.
10. As an app developer, I want static visibility and the
    visibility rule to stay separate, so that a constant
    never has to be written as a callback.
11. As an app developer, I want to declare an accessor on the
    column, so that a derived value is declared beside the id
    that names it.
12. As an app developer declaring an accessor, I want the
    accessor's return type to become that column's value type
    everywhere, so that a nested object is not what the rest
    of the table thinks the column holds.
13. As an app developer declaring no accessor, I want the
    column's value type to be the row field named by its id,
    so that the common case types exactly rather than falling
    back to `unknown`.
14. As an app developer, I want the accessor parameter typed
    without an annotation, so that writing `(row) =>
    row.owner.name` needs nothing else.
15. As an app developer, I want a column whose id names no
    row field to still be declarable, so that a synthesized
    or aggregate-only column remains possible.
16. As an app developer, I want the column rules to be the
    third argument of the same call, so that rules and
    columns cannot be ordered independently of each other.
17. As an app developer, I want the rule paths to autocomplete
    exactly the ids I just declared, so that a rule targeting
    a column I did not declare is caught while typing.
18. As an app developer, I want a standalone pre-built column
    schema value to be accepted in the same position, so that
    a schema authored elsewhere can still be handed in.
19. As an app developer, I want rule functions named for the
    constraint they assert, so that every schema rule in the
    library reads the same way.
20. As an app developer attaching side-channel data to a
    column, I want the metadata rule to be the only way to do
    it, so that two spellings can never disagree about the
    same key.
21. As an app developer, I want a duplicate metadata
    registration on one column to throw at construction, so
    that a silent overwrite is impossible.
22. As an app developer, I want a rule naming an undeclared
    column id to throw at construction, so that the failure
    is at wiring time rather than an absent effect at
    runtime.
23. As an app developer, I want two columns sharing an id to
    throw at construction, so that they cannot collide in the
    per-row value record.
24. As an app developer, I want all three of those checks
    stripped from a production build, so that shipped code
    carries no construction-time validation cost.
25. As an app developer, I want a hand-written column object
    in the array to be a compile error, so that a declaration
    that skipped the builder cannot silently widen.
26. As an app developer, I want a sanctioned way to derive a
    variant of an existing declaration, so that I do not
    reach for a spread that types confidently wrong.
27. As an app developer, I want an empty column list to be
    legal and to reject every path, so that a table built up
    incrementally does not need a special case.
28. As an app developer, I want `createTable` to take the
    column set directly, so that there is one column-shaped
    thing on the config rather than a list plus a schema.
29. As an app developer, I want the old array-plus-schema
    config removed rather than deprecated, so that there is
    no second surface teaching the weaker spelling.
30. As an app developer, I want to edit a column at runtime
    by id with the same four fields the builder takes, so
    that declaration and runtime write teach one shape.
31. As an app developer writing columns at runtime, I want a
    new or mistyped id to be a compile error, so that a
    runtime write cannot invent a column the table's types do
    not know.
32. As an app developer writing columns at runtime, I want a
    shorter list to still typecheck, so that dropping a
    column stays possible.
33. As an app developer, I want the runtime write path to
    reject `order` and `meta` as well, so that the two fields
    the declaration dropped are unreachable from every path
    rather than only from one.
34. As an app developer whose user has dragged columns into
    an order, I want a documented way to re-apply that order
    after a re-declaration, so that the interim behavior is
    something I was told about rather than something I
    discovered.
35. As an app developer, I want one column set to be usable
    by two live tables, so that a shared declaration does not
    have to be duplicated per table instance.
36. As an app developer sharing a column set, I want each
    table's async rules created inside that table's own
    injection context, so that a shared declaration does not
    leak one table's lifetime into another's.
37. As an app developer needing columns chosen by a
    server-sent configuration, I want to declare the superset
    once and drive visibility with a rule, so that the
    supported answer is clear even though runtime-born ids
    are not supported.
38. As a feature author reading the resolved value map, I
    want the map keyed by declared column id with exact value
    types, so that a rule's criterion type comes from the
    column rather than a guess about the row.
39. As a feature author, I want the map to reach my feature's
    slot unchanged through the composed store, so that I
    recover it structurally instead of naming it.
40. As a feature author, I want a typo'd column id in my
    feature's slot to be a compile error, so that a
    declaration naming a column that does not exist never
    reaches the engine.
41. As a feature author, I want the default accessor to stay
    resolved by the engine rather than baked by the builder,
    so that a declaration whose id was rewritten still reads
    the field its new id names.
42. As a maintainer migrating call sites, I want every
    in-repo caller to move in one pass, so that the library
    never teaches two column-declaration spellings at once.
43. As a maintainer migrating call sites, I want the generated
    call-signature file to change only in one constraint, so
    that the migration does not turn into a generator
    rewrite.
44. As a maintainer migrating specs, I want the existing
    compile-time proofs rewritten against the new call, so
    that the guarantees they encode carry forward rather than
    being re-derived later.
45. As a maintainer, I want the construction-check message to
    stop naming a config property that no longer exists, so
    that the error text points at something a reader can find.
46. As a maintainer, I want the dev-only gate applied in the
    one shared validation body, so that the policy is in one
    place rather than repeated per call site.
47. As a maintainer, I want it recorded that a dev-gated
    construction throw is not a violation of the throw-at-
    construction policy, so that the next reader does not
    file it as a bug.

## Implementation Decisions

Numbered `D-` here for reference within this spec only; the
canonical records are the `### Settled` blocks in
`decisions.md`.

### The call

**D1 — `createColumns` takes data, a builder, and an optional
schema, in that order.** The schema function is positional and
last. That position is what removes the sibling-ordering limit
the two-config-property shape had; it does not move into an
options object beside the builder.

The shapes below come from the design brief's compiled probes
and encode the decisions more precisely than prose:

```ts
declare function createColumns<
  TRow,
  TCols extends readonly AnyDecl<TRow>[],
>(
  data: () => readonly TRow[] | undefined,
  build: (col: ColumnBuilder<TRow>) => TCols,
  schema?:
    | ColumnsSchemaFn<TRow, ColumnIdIn<ValuesOf<TCols>>>
    | ColumnSchema<TRow>,
): ColumnSet<TRow, TCols>;

declare function createColumns<
  TRow,
  TCols extends readonly AnyDecl<TRow>[],
>(
  build: (col: ColumnBuilder<TRow>) => TCols,
  schema?:
    | ColumnsSchemaFn<TRow, ColumnIdIn<ValuesOf<TCols>>>
    | ColumnSchema<TRow>,
): ColumnSet<TRow, TCols>;

interface ColumnBuilder<TRow> {
  <K extends string, V>(
    id: K,
    opts: Presentation & { accessor: (row: TRow) => V },
  ): ColumnDecl<TRow, K, V>;
  <K extends string>(
    id: K,
    opts?: Presentation,
  ): ColumnDecl<
    TRow, K, K extends keyof TRow ? TRow[K] : unknown
  >;
}

interface ColumnSet<TRow, TCols> {
  readonly columns: readonly ColumnDecl[];
  readonly rules: readonly ColumnRule<TRow>[];
}
```

**D2 — the row witness is `() => readonly TRow[] | undefined`,
not a writable signal.** `createColumns` never reads the
argument; it binds `TRow`. Typing it as a writable signal
would claim a capability the function does not use and would
exclude rows that arrive from a resource, whose value is a
read-only signal that may be undefined before load. One
callable union member covers a signal, a writable signal, a
resource's pre-load value and a bare store method, with no
conditional type and no named constraint alias. A writable
signal still passes, so nothing is lost, and `createTable`
keeps its own stricter type. Rejected: a read-only
`Signal<TRow[]>`, which still rejects the resource case that
prompted this.

**D3 — the capture happens because the literals are written
inside the call.** TypeScript's `const` type parameter affects
only expressions written within the call, which is why the
curried helper could not fix a hoisted array and this shape
can. A tuple is not required — the map resolves over an
array-of-union, and declaration order is irrelevant to it.

**D4 — `col(id, opts)` accepts `label`, `visible` and
`accessor`. `meta` and `order` drop.** Three separate
rulings, not one.

- `visible` and its schema rule are complementary, not
  paired: the rule takes a predicate callback and its own
  contract already states that static visibility never goes
  through the schema. So a constant has exactly one
  spelling, and ADR-0024's carrier column is that constant.
- `meta` is redundant and actively harmful. The metadata
  rule already accepts a plain value, and while a declared
  map exists the column fold rebuilds `meta` from the rule
  registry and spreads it over the column — replacing a
  declared map wholesale rather than merging — while the
  uniqueness check scans rules only, so a declared entry
  colliding with a rule on the same key is never compared.
  Dropping the declaration form closes that by construction.
- `order` drops so that the builder array's position is the
  only source of declared order.

**D5 — `accessor` stays on `col()`; it does not move into the
schema.** The columns schema is the recording form, typed as
returning nothing, so a side effect has no type
representation — the path is built before the body runs and
nothing about a rule escapes to the type system. Registering
the accessor there would make the value map fall back to the
row-field arm, which is exactly the case ADR-0024 exists to
close. Converting the schema to a declaring form to rescue
it is self-defeating: the third argument would then be
structurally the same thing as the second, and collapsing
the redundancy returns the option on `col()`. Supporting
evidence: four surveyed table libraries put value access on
the column definition beside the id; the one that separates
them has an untyped, string-keyed accessor. Internally, a
static accessor registered as a rule would get a fresh
function identity per fold and invalidate the per-row value
record.

**D6 — `col()` does not bake the default accessor.** The
engine's existing column resolution keeps applying "read the
field named by the id" when none is declared, and the value
type rides in the builder's type parameter rather than being
inferred from a runtime function, so there is no type cost.
Leaving it there means a declaration whose id was rewritten
gets an accessor matching its new id instead of silently
reading the original field.

**D7 — `ColumnDecl` carries a type-only brand: a `unique
symbol` key, declared and never assigned, as a *required*
member.** Nine libraries were surveyed. The real-symbol-
versus-type-only split tracks exactly one variable — whether
the library must answer "is this mine?" about an unknown
value at runtime. `createColumns` receives its declarations
from its own builder inside its own call; there is no
unknown to sort and nothing asks for a runtime predicate, so
the brand is a phantom. The member is required, not optional:
an optional member is a type *carrier* and rejects nothing,
and no surveyed library uses one for nominality. Correction
recorded alongside it: this repo's existing optional phantom
members are carriers, not brands.

**D8 — a variant is re-minted through the builder, never
spread; `col.from(decl, opts)` is the sanctioned spelling.**
Spreading a declaration and overriding its id copies the
brand, so it passes every check, while the overridden id sits
in an object literal whose contextual type is `string` and
therefore widens. The map then types *confidently wrong*
rather than merely degrading, which is worse than plain
widening because the surviving brand makes the result look
validated. No branding mechanism closes this — not a symbol,
not a class, not a registry — and the one surveyed library
with a shipped answer solves it by reconstruction rather
than branding. Here the equivalent is nearly free, since a
variant already is a builder call. Rejected: a stated rule
with no API (a rule with no sanctioned alternative is the
shape that drifts), leaving it out of scope, and a
non-enumerable brand that a spread would drop (needs a real
runtime symbol, and catches the spread only after the map
has already typed wrong).

**D9 — an empty column list needs no guard.** It yields an
empty value map, a never id union and an empty path proxy, so
any path access is already a compile error and the resolver
returns an empty list.

### The set and the intake

**D10 — `ColumnSet` is a plain `{ columns, rules }`. No
carried `data` reference, no `kind` discriminant.** Carrying
`data` would let a column set's signal disagree with the one
`createTable` is given while typechecking clean — both are
the same type, and nothing would catch the mismatch. Not
carrying it makes that a non-question rather than a runtime
identity check. No discriminant, because the precedent it
would match has exactly one non-test reader and narrows a
function against an object, which a `typeof` test already
separates. A set-level brand was considered and rejected as
buying little: a hand-built set still needs real branded
declarations inside, which only the builder mints.

**D11 — `createTable`'s config becomes `{ trackBy, columns:
ColumnSet, injector? }`. The array intake and the separate
schema property are removed outright, with no compatibility
window.** Every in-repo caller lives inside the library's own
source tree — specs, story hosts and fixtures — and the docs
site names the factory only in prose. So a window has no
in-repo beneficiary, and it is not free: keeping a plain
array *typed* means building a literal-preserving default
that exists solely to be deprecated. Reopens only if a
repository outside this one already builds against the
published package. Keeping both surfaces permanently was
rejected separately — the array form silently degrades the
value map, and it would leave the schema property on the
config, which is the sibling-ordering limit the whole design
exists to remove.

**D12 — one column set may be shared by two live tables.**
Verified while settling D10: rules compile eagerly, but each
async rule's factory is invoked per table inside that table's
own injection context, and synchronous rule closures capture
nothing table-specific.

**D13 — runtime-born column ids are out of scope; the
supported answer is the declared superset plus the
visibility rule.** A configuration fetched from an API
selecting which columns a table shows is already served
declaratively. Building a column set inside a computed is not
possible today and the blocker is `createTable`, not
`createColumns` — the config is evaluated once, the column
resolution runs once, and the initial column list is seeded
once, so a recomputed declaration is never re-read. Deeper: a
declaration tracking an API response has no compile-time
literal to capture, so the id union degrades to `string`
anyway. Two alternatives were recorded and neither chosen — a
dynamic overload returning an erased set, and a reactive
`columns` config taking a signal of a column set. Both live
on #127. Standing caveat carried: the library does not
enforce `visible` — nothing filters rendering by it — so a
hidden column still runs its accessor and still contributes
to the per-row value record.

### Errors

**D14 — the rule-id and metadata-key checks move into
`createColumns`; the duplicate-id check is added there and
also stays on the write path.** `createColumns` is the
earliest point where both the rules and the declared id list
exist. The duplicate-id check is not relocated, because it
lives inside the shared column resolution that the runtime
write path also calls — so it becomes an addition rather than
a move. Its message gains a label parameter naming the
declaring surface, since a fixed prefix is wrong from one of
its two call sites.

**D15 — all three construction checks are dev-gated and
strip from a production build.** The duplicate-id check
already was; the two schema checks join it. Rejected:
ungating all three, and leaving the split as-is, which would
carry an unexplained inconsistency into the new surface.
Consequence that must be documented, not merely done:
ADR-0014's throw-at-construction policy is about throw
versus degrade, not dev versus production, so a gated
construction throw is not a violation of it — but stated out
loud, or the next reader files it as a bug. An unknown rule
id or a duplicate metadata registration now passes silently
in a production build.

**D16 (R7) — the dev-only gate goes in the shared validation
body, one place, not per call site.** Construction checks are
dev-only library-wide under ADR-0014's 2026-09-24 amendment,
so there is nothing to confine to the columns-side call
sites. This ticket's D15 is therefore consistent with policy
rather than a deviation. Accepted risk, stated at the time:
once columns stop being static (#127), an unknown column id
is no longer guaranteed to appear in dev, so a dev-only
check can miss a real production failure. No carve-out was
taken.

**D17 (R8) — grouping's writer-path throw stays live in
production.** The dev-only rule reaches the construction half
of grouping's unknown-level check only. Its writer path takes
ids that can arrive from a user action or a saved layout and
may never appear in dev, so gating it would stretch the rule
past its own argument. Not this ticket's code, but this
ticket is what makes the distinction load-bearing.

**D18 (E12) — the shared check's message stops naming the
`columns` array.** It currently reads "no column with this id
exists in the `columns` array"; after D11 there is no such
array. The label parameter names the *declaring* surface, not
the source of truth, so no call site fixes this. One string
edit, inside the same step as D14/D16.

### Naming

**D19 — schema rule functions lose the `apply` prefix,
library-wide, in this ticket (ADR-0025).** Ten functions:
eight shipped across columns, grouping and sorting, plus two
unshipped ones belonging to the sorting slice, so that slice
lands named correctly rather than being renamed immediately
after. This is not a new convention — filtering's eight rules
already ship bare, and the repo's own naming rule codifies
the split: `is*`/`has*` for a predicate that returns a
boolean, a bare name for a function that registers a
declaration. Rejected: naming the property rather than the
constraint, which has no spelling for the compound names and
turns a mechanical prefix strip into case-by-case rewording.
Flagged, not blocking: the grouping rule's bare name sits
beside the grouping store member; no compile collision, but
it is the one name in the set worth a second look.

### The runtime write path

**D20 (N6) — `setColumns()` takes a narrowed plain input:
`{ id }` plus optional `accessor`, `visible` and `label`.**
The same four fields the builder takes, so declaration and
runtime write teach one shape and `order`/`meta` are
unreachable from every path rather than only from the
declaration. No builder is needed at the call site for what
is now a small edit. The id stays bound to the declared
union, so a new or typo'd id is a compile error and a shorter
list still typechecks — which the shipped grouping-degrades-
on-column-removal ruling depends on. **`setColumns` cannot
add a column, and that is structural.** Confirmed against the
closest comparable framework, which has neither an add-field
nor a remove-field API: its structure follows the *data*,
while ours follows the *declaration*, and literal keys and a
growable key set are mutually exclusive by construction.
Rejected: builder-built declarations on the write path (a
builder must be in hand, so either the declaring call is
re-run or the builder becomes a standalone export — heavy for
editing one label), and narrower verbs for label-setting and
removal (reverses the premise that `setColumns()` is how a
column disappears, and trades one verb for three).

### Order

**D21 — the order slice is its own issue (#128); this ticket
drops only `col()`'s `order` option.** The resolved column's
`order` keeps deriving from the array index until #128 lands
— the existing default expression simply loses its left
operand. Separable because this ticket changes the
**declaration input** while #128 changes the **resolved
shape and the runtime state**. Kept apart because #128 is a
public-API change of comparable size: the resolved column
loses the field, the store gains an ordered-id member, two
order verbs retarget, and roughly ten story hosts rewrite
their visible-column loop, since sorting by that field is the
shipped consumer pattern for rendering columns in order.
Rejected: folding it in, which roughly doubles the migration
and mixes a declaration-surface change with a runtime-state
change in one review.

**D22 — the order discovery came back and confirmed the
drop.** Eight table libraries surveyed; none stores column
order as a writable per-column property, and one ships its
order index explicitly read-only. The deciding cost is not
copying definition objects — it is the invalidation edge: a
reorder writes the base column list, the derived list
recomputes to a fresh array unconditionally, and the per-row
value record is rebuilt for every row times every column,
for a record that is documented as order-independent. Two
caveats the discovery flags about itself: the accessor-call
figure is arithmetic over a verified code path rather than a
benchmark, and a smaller fix exists (a custom equality on the
derived column list) that cuts the cost with no API change
but leaves the per-column field the survey argues against.

**D23 (R4) — the column-order window is accepted and
documented.** Until #128 lands, an app that calls
`setColumns()` to re-declare columns loses the user's
dragged order, because D20 makes `order` unreachable and
every call resets to declaration order. Recoverable: the app
owns the id list and re-applies the reorder verb immediately
after the write. Two obligations follow — this ticket
documents that re-apply as the interim spelling, and #128
records the window it closes, since its own body names the
"a drag order must survive a re-declaration" rationale
without acknowledging that this ticket breaks it first.
Rejected: landing #128 first, and leaving `order` writable on
the write path for one release, which re-opens D20.

### Ship order

**D24 (R1) — this ticket ships before the sorting slice
(#100/S1), and one release without per-column `sortFn` or
`enableSorting` is accepted.** For that release a consumer
cannot give a column its own compare function and cannot
switch sorting off for a single column. There is no compile
error to catch it: the resolved column keeps both fields as
permanently-undefined, so every column falls to the
auto-detected comparator and the sortable check is vacuously
true. Measured blast radius is **0 production authors**.
Rejected: landing the sorting slice first (compile-enforced,
but it serializes the two largest unshipped nodes), and
gating this ticket on writing the fallback comparator's spec
first.

### A correction carried, not a decision

**D25 — the Signal-Forms contrast behind the two-tier
resolver rule is wrong as written; the rule itself stands.**
Verified against published framework source that its *schema
path* names a type-level slot, the same cross-section shape
as ours — only its *field tree* names instances. The two-tier
rule survives on its own evidence, an inventory of every
consumer callback across all four schemas, not on that
contrast. Noted here because it is in the same settled set;
it changes no code in this ticket.

## Testing Decisions

### What a good test is here

Assert only what a consumer can observe: the shape a call
returns, the error a wrong declaration produces, and the type
a declared column resolves to. Do not assert how the builder
stores a declaration, how the brand is spelled, or which
internal function the check calls through.

The construction checks are behavior, not implementation:
the observable fact is "this declaration throws with a
message naming the offending id", not "this assertion
function ran".

Type-level behavior is tested by type-level assertions.
Declaring a column and then asserting the value map's field
types is external behavior — it is the whole promise of the
feature.

### The seams

Two files, plus small edits to what already exists.

**1. `create-columns.spec.ts` — runtime (new file).**

- The returned set's shape: columns and rules, in the order
  declared, with no carried data reference.
- The three dev-gated construction checks, one case each: a
  rule naming an undeclared column id; two columns sharing an
  id; a metadata key registered twice on one column. Assert
  the throw and that the message names the offending id and
  the declaring surface.
- The visibility key's exemption from the duplicate-metadata
  check — it is the one deliberate multi-writer key.
- The variant builder: a variant carries the overridden
  options and the new id, and the original is unchanged.
- An empty column list returns an empty set and does not
  throw.
- Both call forms — data-first and builder-first — produce
  the same set.

**2. `create-columns.types.spec.ts` — compile-time proofs
(rewritten against the new call).**

- The brand rejects a hand-written object literal in the
  builder's array.
- `{ ...col('x'), id: 'y' }` widens. **This claim is
  reasoned from TypeScript's rules and has not been probed;
  this spec is what settles it.** If the probe comes back
  showing it does *not* widen, D8's `col.from` is still
  wanted as the sanctioned spelling, but the severity
  argument behind it changes and the finding gets recorded.
- The value map resolves a declared accessor's return type.
- The value map resolves a defaulted column's own field type.
- A column id naming no row field resolves to `unknown`
  rather than erroring.
- A typo'd id is rejected — asserted **through `createTable`
  and inside a composed feature slot**, not against the
  derivation alone, because carriage through the config
  boundary, the generated call signatures and the composed
  store is the part that can break.
- The literal ids survive assignment to a module-level
  const — the capture's own failure mode is a dead mechanism
  that still compiles and types every id as `string`.

**3. Edits to the existing `create-table` specs.** The intake
change (D11) touches every construction in them; the
runtime spec's column fixtures and the types spec's carriage
cases move to the new call. The types spec keeps owning
carriage; the new-file types spec keeps owning derivation.
That split already exists and is deliberate — a spec asserts
its own domain only.

**4. `update-columns.spec.ts`.** The narrowed write input
(D20): an edit by id applies, a shorter list drops a column,
and `order`/`meta` are not accepted. The id-union rejection
is a compile-time proof and belongs with the other type
assertions, not here.

### Prior art in this repo

- `api/create-columns.types.spec.ts` — the existing
  compile-time seam for the capture and the map's per-arm
  derivation. Its conventions carry forward: a
  typecheck-only wrapper that never calls its argument, a
  locally-declared row interface rather than a story fixture,
  and hoisting the captured declaration to a module-level
  const deliberately, because an inline literal would only
  prove something never in doubt.
- `api/create-table.types.spec.ts` — the carriage proofs,
  including the typo rejection inside a composed bundle.
- `mutations/update-columns.spec.ts` — the runtime write-path
  conventions.
- `engine/columns-schema/resolve.ts`'s existing checks are
  the behavior the new construction tests inherit; their
  current assertions are the baseline to carry over rather
  than re-derive.

### What enforces the type specs

**`nx run shared-table:typecheck-spec` is the only thing that
enforces a `*.types.spec.ts`.** The test runner executes
`expectTypeOf` and `@ts-expect-error` without typechecking
either, so **a green `nx test` proves nothing about one**. A
dead type assertion and a passing one are indistinguishable
to the runner.

The template-aware typecheck must be **run twice**: it aborts
at the first source error before reaching the template phase,
so only a source-clean second run says anything about the
story hosts — which this ticket's migration touches in bulk.

## Out of Scope

- **#127 — runtime-born column ids.** Columns chosen by a
  server-sent or user-saved configuration. The supported
  answer today is the declared superset plus the visibility
  rule (D13). Two alternatives are recorded on that issue and
  neither is chosen. It should also read D16's accepted risk:
  a dev-only construction check assumes ids appear in dev.
- **#128 — the column-order slice.** The resolved column
  losing its `order` field, the ordered-id store member, the
  order verbs retargeting, and the story hosts' visible-column
  loops. This ticket drops only the builder's `order` option
  (D21) and accepts the documented window (D23).
- **#100 / S1 — the sorting schema.** The sorting rule
  functions, the move of the two per-column sorting fields
  off the resolved column, and the nulls rule leaving the
  columns schema. Ships after this ticket (D24); the
  regression for one release is accepted.
- **#115 — filtering keying by column id.** Widening
  filtering's input to carry columns and re-keying its
  declarations. Blocked on this ticket, because its fixtures
  and specs would be written against a declaration surface
  this ticket replaces.
- **N9 — re-keying the filtering and sorting paths** by the
  column-id union recovered off the store. At execution grain
  that is the same edit #115 and #100 each already make:
  either they write that spelling directly and N9 is empty,
  or it lands after both. It cannot land before.

Also not this ticket, recorded so nobody re-derives them:
the resolver-naming sentence owed to ADR-0025 and the
corrections owed to #116/#117's published examples; the
edge-list edit adding #100 to #117's blockers; the
library's non-enforcement of `visible`, which is a standing
caveat with no owner yet.

## Further Notes

**The accepted sorting regression (D24/R1).** For one release
after this ticket ships, per-column `sortFn` and
`enableSorting` are unsettable. They are not removed — the
resolved column keeps both fields, permanently undefined — so
nothing fails to compile and nothing reports. Every column
falls to the auto-detected comparator, and no column can be
made un-sortable. The fallback comparator is itself shipped
with no written spec and its own capability log flags that it
becomes load-bearing exactly when the per-column function is
removed. Measured blast radius: 0 production authors, and the
in-repo authors are spec fixtures, so the change surfaces in
CI.

**The column-order window (D23/R4).** Until #128 lands, the
interim spelling for preserving a user's dragged order across
a re-declaration is: perform the write, then immediately
re-apply the order verb with the id list the app already
owns. This must be written into the consumer-facing docs as
part of this ticket, not left to be discovered. #128 carries
the reciprocal obligation to record the window it closes.

**The spread-widening claim is reasoned, not probed.** D8
rests on a specific reading of TypeScript's literal capture:
the builder captures its id because the parameter is a
primitive-constrained type parameter at that call, while a
spread's `id:` override sits in an object literal with no
such capture. No compiled probe was run. The planned
compile-time spec carries this case and settles it as a side
effect. If it comes back the other way, the sanctioned
variant builder still stands on the stated-rule argument —
only the severity claim ("types confidently wrong" rather
than "merely widens") would need correcting.

**Two further caveats carried from the discoveries**, neither
blocking: no compiled probe was run for the declaring-form
sketch that D5 rejects, and one surveyed library's
resolve-placement claim in that same discovery is unverified.

**Where the decisions are registered.** This workspace's
`capabilityLogPath` points at the **grouping** decisions log,
which is not this work's capability — this is core/columns
work. Rows for these decisions need a home before the work
folder can be archived, and that home is not `grouping.md`.
No rows were added to it by this spec.
