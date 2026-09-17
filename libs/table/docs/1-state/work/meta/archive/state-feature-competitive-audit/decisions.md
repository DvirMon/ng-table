# Decisions — status vocabulary and verdict format

Node **A** of [plan.md](plan.md). Resolved 2026-09-05. Five downstream nodes
(C, D, E, F, G) encode these decisions, so they are settled here once rather
than re-decided per file.

Filename is unnumbered (`decisions.md`, not `2-decisions.md`) to match this
folder's existing siblings — `audit.md`, `gap-analysis.md`, `plan.md`.

---

## D1 — Two status axes replace the free-text `status:` string

Today `status:` is prose, and it conflates two independent facts. `expansion.md`
reads `shipped — everExpanded specced, not yet implemented`; `row-editing.md`
reads `shipped — the two-feature split (D37–D44) landed 2026-08-26; optimistic
CRUD (D45–D49) landed 2026-08-27`. Neither is machine-readable, and answering
"what is the state of pagination?" currently takes three file opens.

Replace with two enum fields:

```yaml
spec: none | stub | drafted | drilled
code: none | partial | shipped
```

| `spec:` | Meaning |
|---|---|
| `none` | No spec file exists |
| `stub` | File exists, placeholder only — today's "not yet drilled" |
| `drafted` | Full spec written, never validated through a decisions session |
| `drilled` | Been through a grill/decisions session; contract settled |

| `code:` | Meaning |
|---|---|
| `none` | Nothing in `src/` |
| `partial` | Some of the spec implemented |
| `shipped` | Spec fully implemented |

The prose that used to live in `status:` is not lost — it moves into the body,
where it was always more readable anyway.

**Why two axes and not one:** the interesting states are precisely the ones a
single axis cannot express. `grouping.md` is `spec: drafted, code: none` —
fully designed, zero implementation. `expansion.md` is `spec: drilled, code:
partial`. Collapsing either into one word discards the half you needed.

### Assigned values

Settled here so C, D and E do not each re-derive them.

| File | `spec:` | `code:` | Was |
|---|---|---|---|
| `1-state/features/sorting.md` | `drilled` | `shipped` | `drafted` |
| `1-state/features/row-editing.md` | `drilled` | `shipped` | long prose |
| `1-state/features/expansion.md` | `drilled` | `partial` | `shipped — …not yet implemented` |
| `1-state/features/grouping.md` | `drafted` | `none` | `drafted` |
| `1-state/features/filtering.md` | `drafted` | `none` | `drafted` |
| `1-state/features/virtual-scroll.md` | `drafted` | `none` | `drafted — not yet fully specced` |
| `1-state/features/selection.md` | `stub` | `none` | `not yet drilled` |
| `1-state/features/pagination.md` | `stub` | `none` | `not yet drilled` |
| `1-state/features/drag-drop.md` | `stub` | `none` | `not yet drilled` |
| `1-state/features/infinite-scroll.md` | `stub` | `none` | `not yet drilled` |
| `1-state/features/column-sizing.md` *(new)* | `drafted` | `none` | — |
| `1-state/features/column-pinning.md` *(new)* | `drafted` | `none` | — |
| `1-state/state-persistence.md` *(new)* | `drafted` | `none` | — |

`sorting.md` is promoted `drafted` → `drilled`: it carries ADR-0001, a settled
null-ordering contract, and D-numbered decisions. Its old `drafted` value was
stale, not a considered claim.

`virtual-scroll.md` stays `code: none` because this axis tracks the **state
layer**. Its implementation is CDK-backed and lives in the UI layer; the body
already says so.

---

## D2 — A `capability:` field pairs the same feature across layers

The roll-up must answer "where is selection?" across state *and* UI in one row.
Selection today is `1-state/features/selection.md` (stub) plus
`3-ui/directives/selection.md` (stub) — two files, no declared relationship.

Add to both:

```yaml
capability: selection
```

The generator groups rows by `capability:`. This keeps the pairing as **one
declaration inside each file** rather than a separate mapping table that would
have to be kept in sync — the duplicate-declaration failure
`.claude/rules/file-organization.md` warns about.

Capability slugs: `sorting`, `filtering`, `grouping`, `selection`, `expansion`,
`pagination`, `infinite-scroll`, `virtual-scroll`, `drag-drop`, `row-editing`,
`column-sizing`, `column-pinning`, `state-persistence`, `columns`.

---

## D3 — Only feature-scoped specs carry the axes

The axes describe *a capability's* maturity. Architecture, PRD and reference
docs do not have a "code" state, so forcing the fields on them would produce
meaningless rows in the roll-up.

**Carry `spec:`/`code:`/`capability:`** — `1-state/features/*.md`,
`3-ui/directives/*.md`, and cross-feature capability specs
(`1-state/state-persistence.md`).

**Keep free-text `status:`** — `overview.md`, `*/architecture.md`,
`1-state/prd.md`, `1-state/columns.md`, `1-state/row-mutations.md`,
`2-columns/reference/*.md`, `3-ui/cross-cutting/*.md`.

The generator globs the first set only.

---

## D4 — Verdict block format

Every doc the gap-analysis assigns a verdict to gets this section appended,
verbatim in shape, so seventeen files come out consistent:

```markdown
## Competitive position

**Verdict: <ahead | on par | gap | missing | not assessed>** — <one line>.

Assessed 2026-09-05 against TanStack Table v8, AG Grid, Material React Table,
and PrimeNG. Full reasoning: [gap-analysis.md](<relative path>).
```

Verdict values are exactly the four from `gap-analysis.md`'s legend, plus
`not assessed` for node E:

- **ahead** — does something the four don't, or does it more deliberately
- **on par**
- **gap** — present but narrower or weaker
- **missing** — nothing in `src/`
- **not assessed** — outside the audit's scope; the block says why

`drag-drop.md` is **missing**, not "behind": the legend defines `gap` as
present-but-weaker, and row reordering is not present at all.

The block goes at the **end** of the doc, not the top. It is context for
whoever plans the work, not the contract a reader came for.

---

## D5 — New spec filenames, pinned now

Pinned in this node specifically so node C can link to these paths before node
F creates the files. That removes what would otherwise be a C→F edge and keeps
both parallel-safe.

- `docs/1-state/features/column-sizing.md`
- `docs/1-state/features/column-pinning.md`
- `docs/1-state/state-persistence.md`

**Placement rationale for the third:** persistence is a sibling of
`row-mutations.md`, *not* under `features/`, because it is cross-feature rather
than a `with-*()` plugin — the same reasoning D8 used to keep row mutations out
of `features/`. Persistence serialises sort + columns + filters + pagination as
one object; it is not one plugin's state.

---

## D6 — Fold in the broken `parent:` links while editing frontmatter

Not part of the audit, but discovered while surveying frontmatter and cheapest
to fix in the same pass rather than as a separate sweep.

Feature specs disagree on `parent:`. From `docs/1-state/features/`,
`row-editing.md` correctly has `parent: ../architecture.md`, while
`expansion.md`, `sorting.md`, `selection.md`, `grouping.md`, `pagination.md`
and others have `parent: ../1-state/architecture.md` — which resolves to
`docs/1-state/1-state/architecture.md` and is broken.

Nodes C, D and E each fix `parent:` to `../architecture.md` in the files they
already touch. No separate node — the files are already open.

---

## Consequences

- `libs/shared/table/CLAUDE.md`'s docs-structure section gains a short
  subsection describing the two axes and pointing at this file, so a future
  maintainer adding a feature spec knows which fields are required.
- `docs/status.md` becomes a generated file and carries a header saying so.
  Editing it by hand is a mistake the header must name explicitly.
- Any new feature spec from here on declares `spec:`, `code:` and `capability:`
  or it silently vanishes from the roll-up.
