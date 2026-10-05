---
title: Row editing — decision history
type: decisions-log
capability: row-editing
date: 2026-09-20
audience: developers
---

# Row editing — decision history

**Read this before changing anything about row editing.** It is the complete
list of decisions taken about this capability, one line each, oldest first. The
contract itself — what row editing does today — is
[`1-state/features/row-editing.md`](../1-state/features/row-editing.md).

This log **restates nothing**. Every row links to the record that holds the
rationale, the counter-arguments and the rejected alternatives. If a row needs
a second line, that second line belongs in the linked record.

**Numbering is this log's own (`RE1…REn`).** Source numbers are kept in the
last column so older cross-references still resolve. They had to be abandoned:
this capability accumulated **five decision namespaces**, four of them
numbering from `D1`, and one file numbers **two different decisions `D48`**.
A bare "D5" here means either "no CRUD surface on the store" (2026-08-11) or
"the restore point is tagged with the operation it undoes" (2026-09-05),
depending on which folder you are standing in. Dates come from each decision's
own heading; the few that carry none are marked.

**Format contract:** `~/.claude/conventions/doc-contracts/decisions-log.md`.

## Two features, one store

`withRowEdit()` and `withOptimistic()` are separate features built on one
`createEditingStore()` instance (RE40). Composing both explicitly **throws** —
a duplicate `editing` member claim, in either argument order
([ADR-0007](../adr/0007-feature-member-claims.md)). Decisions below apply to
the shared store unless a row says otherwise.

## Source keys

| Key      | Record                                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MUT**  | [`archive/with-mutations/2-decisions.md`](../1-state/work/row-editing/archive/with-mutations/2-decisions.md) — the **core** mutation log; only the rows editing depends on are registered here |
| **WRE**  | [`active/with-row-editing/2-decisions.md`](../1-state/work/row-editing/active/with-row-editing/2-decisions.md) — the foundational grill                                                        |
| **OPT**  | [`archive/with-optimistic/2-decisions.md`](../1-state/work/row-editing/archive/with-optimistic/2-decisions.md) — the two-feature split                                                         |
| **CRUD** | [`archive/with-optimistic-crud/2-decisions.md`](../1-state/work/row-editing/archive/with-optimistic-crud/2-decisions.md) — delete rollback                                                     |
| **MUL**  | [`archive/with-multiple-edit/1-design.md`](../1-state/work/row-editing/archive/with-multiple-edit/1-design.md) — **unnumbered in source**                                                      |
| **DUP**  | [`archive/with-duplicate-row/1-design.md`](../1-state/work/row-editing/archive/with-duplicate-row/1-design.md) — **unnumbered in source**                                                      |
| **PAT**  | [`archive/optimistic-ui-state-patterns/decisions.md`](../1-state/work/row-editing/archive/optimistic-ui-state-patterns/decisions.md) — folder-local `D1–D5`, design-first                      |
| **OPA**  | [`active/optimistic-pessimistic-api/2-decisions.md`](../1-state/work/row-editing/active/optimistic-pessimistic-api/2-decisions.md) — `D50–D57`                                                 |
| **KBD**  | [`3-ui/work/row-edit-keyboard-a11y/2-decisions.md`](../3-ui/work/row-edit-keyboard-a11y/2-decisions.md) — folder-local `D1–D2`, UI                                                             |

## Decisions

|      | Decision                                                                                      | Date  | Status                                                                                                                                                 | Record                                                 |
| ---- | --------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| RE1  | Mutation/pipeline interaction is deferred to the editing feature                              | 08-11 | shipped                                                                                                                                                | MUT D9                                                 |
| RE2  | Row edit mode is a store slice, mirroring `withExpansion()`                                   | 08-11 | shipped                                                                                                                                                | WRE D10                                                |
| RE3  | Always-edit is not a state-layer concern                                                      | 08-11 | **superseded by RE11**, then restored by RE19                                                                                                          | WRE D13                                                |
| RE4  | `withRowEdit({ multiple })`, default single                                                   | 08-11 | shipped                                                                                                                                                | WRE D14                                                |
| RE5  | Signal Forms binds to the same `data` signal                                                  | 08-11 | shipped · draft seam added by RE67                                                                                                                     | WRE D15                                                |
| RE6  | No edit verbs on the store; editing state uses the updater pattern                            | 08-11 | shipped                                                                                                                                                | WRE D16                                                |
| RE7  | Editing state is `Map<RowId, TRow>` holding pre-edit snapshots                                | 08-11 | **superseded by RE29**                                                                                                                                 | WRE D17                                                |
| RE8  | Row actions are consumer template code                                                        | 08-11 | standing                                                                                                                                               | WRE D18                                                |
| RE9  | v1 ships three updaters: `addRow`, `removeRow`, `patchRow`                                    | 08-12 | shipped · `addRow` renamed by RE49                                                                                                                     | MUT D19                                                |
| RE10 | Editing rows are exempt from the pipeline                                                     | 08-12 | **superseded by RE14** — mechanism replaced, intent kept                                                                                               | WRE D20                                                |
| RE11 | `withRowEdit()` serves both UI modes; RE3 revised                                             | 08-12 | **superseded by RE19 + RE33**                                                                                                                          | WRE D21                                                |
| RE12 | One array form over `data`; no per-row forms                                                  | 08-12 | shipped                                                                                                                                                | WRE D22                                                |
| RE13 | `RenderRow.sourceIndex`, derived by the engine                                                | 08-12 | shipped                                                                                                                                                | WRE D23                                                |
| RE14 | The commit boundary is Signal Forms `debounce()`, not pipeline exemption                      | 08-12 | shipped                                                                                                                                                | WRE D24                                                |
| RE15 | A row edited out of the filter stays visible, marked, until the filter changes                | 08-12 | **open** — specced against a then-phantom `withFiltering()`, which now ships                                                                           | WRE D25                                                |
| RE16 | Temp ids are the consumer's; the table tolerates an identity swap                             | 08-13 | shipped · mechanism is RE51                                                                                                                            | MUT D26                                                |
| RE17 | `at` is `splice` semantics; omitted means append                                              | 08-13 | shipped                                                                                                                                                | MUT D27                                                |
| RE18 | `revertEdit` derives add-cancel from edit-cancel via the snapshot                             | 08-13 | **superseded by RE42**                                                                                                                                 | WRE D28                                                |
| RE19 | `withRowEdit()` is optional; the minimal live table uses none of it                           | 08-13 | shipped                                                                                                                                                | WRE D29                                                |
| RE20 | Optimistic save: `endEdit({ keepSnapshot })` moves the entry to `pending`                     | 08-19 | **superseded by RE35**; RE63 would split it again                                                                                                      | WRE D31                                                |
| RE21 | `beginEdit` on a pending row re-opens it, keeping the original snapshot                       | 08-19 | shipped                                                                                                                                                | WRE D31.1                                              |
| RE22 | Single-mode row switching is an implicit **Save**                                             | 08-19 | **superseded by RE50**                                                                                                                                 | WRE D31.2                                              |
| RE23 | The restore point is writable; the library never watches `data` for staleness                 | 08-19 | **superseded by RE34**                                                                                                                                 | WRE D34                                                |
| RE24 | `*ngpTableRowField` ships behind the `@ngp/table/forms` secondary entry point                 | 08-19 | shipped                                                                                                                                                | WRE D33                                                |
| RE25 | Bulk is widened arity plus `batch()`; the word "bulk" never enters the API                    | 08-25 | shipped                                                                                                                                                | MUT D32                                                |
| RE26 | Implementation resolutions for the optimistic-save slice                                      | 08-25 | shipped                                                                                                                                                | WRE D31.3                                              |
| RE27 | The public verbs are the edit lifecycle; "snapshot" leaves the API                            | 08-25 | shipped                                                                                                                                                | WRE D31.4                                              |
| RE28 | `addNewRow(row, opts?)`: add and open as one write                                            | 08-25 | **superseded by RE36**                                                                                                                                 | WRE D35                                                |
| RE29 | State is restore points plus open ids; `pending` is derived, never stored                     | 08-25 | shipped                                                                                                                                                | WRE D31.5                                              |
| RE30 | `addNewRow` stops forcing `ABSENT`; discard is composed, not a `revertEdit` option            | 08-26 | **superseded by RE36**                                                                                                                                 | WRE D36                                                |
| RE31 | Optimistic rollback is its own feature                                                        | 08-26 | shipped · ownership half corrected by RE40                                                                                                             | OPT D37                                                |
| RE32 | The feature's name must carry its scope                                                       | 08-26 | shipped                                                                                                                                                | OPT D38                                                |
| RE33 | Live tables compose `withOptimistic()`; RE19 narrows                                          | 08-26 | shipped                                                                                                                                                | OPT D39                                                |
| RE34 | `captureEdit` replaces `rebaseEdit`, unguarded                                                | 08-26 | shipped                                                                                                                                                | OPT D40                                                |
| RE35 | `endEdit` closes, `releaseEdit` drops; `keepSnapshot` removed                                 | 08-26 | shipped · RE63 would split `endEdit` again                                                                                                             | OPT D41                                                |
| RE36 | `beginEdit(id, { insert })` replaces `addNewRow`                                              | 08-26 | **superseded by RE62** — `beginEdit` is to lose `{ insert }` to `createRow`                                                                            | OPT D42                                                |
| RE37 | Trigger detection stays out of the engine                                                     | 08-26 | standing                                                                                                                                               | OPT D43                                                |
| RE38 | Bulk teardown stays one atomic verb: `clearEditing()` survives                                | 08-26 | shipped · renamed `clearEdit` by RE49                                                                                                                  | OPT D44                                                |
| RE39 | `cancelEdit` dropped — it was `revertEdit` under another name                                 | 08-26 | shipped                                                                                                                                                | OPT A1                                                 |
| RE40 | **Both features call one `createEditingStore()`; neither composes the other**                 | 08-26 | shipped — **[ADR-0015](../adr/0015-feature-member-namespacing.md) still states RE31's superseded framing**                                             | OPT A2                                                 |
| RE41 | The restore point carries its position (`at`) as well as its value                            | 08-27 | shipped                                                                                                                                                | CRUD D45                                               |
| RE42 | `revertEdit` restores only; `ABSENT` is removed                                               | 08-27 | shipped (breaking)                                                                                                                                     | CRUD D46                                               |
| RE43 | Capture-composing verbs: `removeEdit`, `patchEdit`                                            | 08-27 | shipped                                                                                                                                                | CRUD D47                                               |
| RE44 | O(1) id lookups via `indexById`                                                               | 08-27 | shipped                                                                                                                                                | CRUD D48 **(first)**                                   |
| RE45 | `restored` signal dropped; scroll/flash stays consumer-space                                  | 08-27 | shipped                                                                                                                                                | CRUD D48 **(second — same number, undated)**           |
| RE46 | Bulk edit is optimistic-only; pessimistic save is unsupported under `multiple: true`          | 08-27 | shipped — **contradicts the spec §5, which documents it with no caveat**                                                                               | MUL (unnumbered)                                       |
| RE47 | A `true`→`false` `multiple` flip closes every open row; no survivor                           | 08-27 | shipped                                                                                                                                                | MUL (unnumbered)                                       |
| RE48 | Duplicate-a-row needs no new API; placement is `at: sourceIndex + 1`                          | —     | shipped — **source carries no date**                                                                                                                   | DUP (unnumbered)                                       |
| RE49 | Two breaking renames: `addRow`→`insertRow`, `clearEditing`→`clearEdit`                        | —     | shipped — **source carries no date**                                                                                                                   | DUP (unnumbered)                                       |
| RE50 | Single-mode row switching **discards** the displaced row's draft                              | 09-03 | shipped — **and nothing records that this reversal was intended** (RE68)                                                                               | WRE D31.2 (re-decided, same heading)                   |
| RE51 | `swapRowId(from, to)`, no forced end-edit                                                     | 09-03 | shipped                                                                                                                                                | WRE D49                                                |
| RE52 | Keyboard/a11y closes via a **documented recipe, not a shipped directive**                     | 09-04 | shelved, not rejected                                                                                                                                  | KBD D1                                                 |
| RE53 | The recipe lives at `3-ui/cookbook/row-edit-keyboard-a11y.md`                                 | 09-04 | **decided, never done** — neither the file nor the folder exists                                                                                       | KBD D2                                                 |
| RE54 | The table holds the rollback state, not the consumer's query cache                            | 09-05 | shipped                                                                                                                                                | PAT D1                                                 |
| RE55 | A restore point is the prior row plus its position                                            | 09-05 | shipped — same conclusion as RE41, reached independently                                                                                               | PAT D2                                                 |
| RE56 | One write per row in flight at a time                                                         | 09-05 | shipped                                                                                                                                                | PAT D3                                                 |
| RE57 | Fresh server data moves the fallback forward; it never moves the display                      | 09-05 | shipped                                                                                                                                                | PAT D4                                                 |
| RE58 | The restore point is tagged with the operation it undoes                                      | 09-05 | shipped **as RE60** — decided twice, in two namespaces, one day apart                                                                                  | PAT D5                                                 |
| RE59 | Optimistic and pessimistic are call-site facts, named by the verb                             | 09-05 | accepted — [ADR-0013](../adr/0013-optimistic-and-pessimistic-are-call-site-facts.md), status flipped from `proposed` 09-20; **implementation partial** | OPA D50                                                |
| RE60 | `RowRestorePoint.detached` becomes `op: 'create' \| 'update' \| 'delete'`                     | 09-05 | shipped `2cd10a0`                                                                                                                                      | OPA D53                                                |
| RE61 | `unconfirmed` becomes a library slice                                                         | 09-05 | shipped `914fbe1` — **but all six stories still hand-roll `pendingCreateIds`**                                                                         | OPA D54                                                |
| RE62 | `beginEdit` loses `{ insert }`; `createRow` becomes the only insert-and-arm verb              | 09-05 | **reserved, unwritten** — `BeginEditOptions` still exported                                                                                            | OPA D51                                                |
| RE63 | `endEdit` splits into `commitEdit` / `closeEdit`                                              | 09-05 | **reserved, unwritten** — `endEdit` is still the exported verb                                                                                         | OPA D52                                                |
| RE64 | Per-row error state stays consumer-side                                                       | 09-05 | **reserved, unwritten**                                                                                                                                | OPA D55                                                |
| RE65 | A pessimistic create shows no row at all                                                      | 09-05 | **reserved, unwritten**                                                                                                                                | OPA D56                                                |
| RE66 | A dev-mode warning on session-verb misuse                                                     | 09-05 | **reserved, unwritten**                                                                                                                                | OPA D57                                                |
| RE67 | `table.draft: WritableSignal<TRow[]>` — the signal `form()` binds to instead of `table.value` | —     | **shipped with no decision record** (RE68)                                                                                                             | none — found in `src/api/features/with-row-edit.ts:33` |
| RE68 | Registered 09-20: `draft` and RE50 both ship without a decision anyone can cite               | 09-20 | **open**                                                                                                                                               | this run                                               |

## Core decisions this capability depends on but does not own

`archive/with-mutations/` is filed under `row-editing/` but is the **core**
mutation log — its own D8 says mutation is core, "not a `with-*()` feature",
and calls its slug a misnomer. Its contract is
[`1-state/row-mutations.md`](../1-state/row-mutations.md), a core-API spec with
no `capability:` field.

`MUT` D1–D8, D11, D12 and D30 are therefore **not** registered above. They
belong to `core`'s log when `core` is consolidated. The ones editing genuinely
depends on — D9, D19, D26, D27, D32 — are RE1, RE9, RE16, RE17, RE25.

## Still open

- **RE68** — `draft` is a shipped public member with no decision record in any
  namespace, and RE50 reversed RE22 without one either. Both need a decision or
  an explicit "this was accidental".
- **RE62–RE66** — the rest of ADR-0013. Steps 3a onward of the sequenced plan;
  none started. `endEdit` and `BeginEditOptions` still ship.
- **RE15** — written against a phantom `withFiltering()`. It ships now
  (`src/index.ts:15`), so this and its open questions (`O15`, `O16`, `O17`) are
  answerable and were never re-derived.
- **RE53** — the a11y recipe was decided on and never written. Until it exists,
  RE52 leaves keyboard support documented nowhere.
- **RE46** — the spec contradicts it. One of the two is wrong.
- **RE61** — the slice shipped; the six stories that motivated it never adopted it.
- **`O23`** — should openness be declarative, `applyEditable({ when })`?
  Unblocked 2026-08-27; nothing has picked it up.
- **`O11` / `O6`** — a change event on a row write. Open since 2026-08-11,
  marked "decide both together", never done.
- **`O22`** — inverse-operation representation for **move** rollback. Correctly
  deferred: `moveRow` / `withDragDrop()` do not exist.

## Known defects in the records this log points at

### Fixed by this run (2026-09-20)

- **The spec was stale in five verified places** against `src/`. Corrected:
  `RowRestorePoint` is `{row, at, op}`; `EditingState` also has `unconfirmed`;
  `OptimisticMembers` also has `pendingOps` and `unconfirmed`; the ADR-0006
  exemption is `op === 'delete'`; and `RowEditMembers` adds `draft`. The story
  table and the `apps/demo` paths were rewritten against the nine real hosts.
- **The "one-tick saving flicker"** in the spec's Accepted Costs was not real.
  The product doc had said so since 2026-08-27; the fix was filed 2026-08-28 and
  never applied. Applied now.
- **~70 links pointing at the pre-restructure flat paths** — the ones that read
  `work/` + the bare effort slug, before efforts moved under
  `work/<capability>/{active,archive}/`. Every row-editing one is repaired;
  none remains in any row-editing-owned file.
- **[ADR-0013](../adr/0013-optimistic-and-pessimistic-are-call-site-facts.md)
  read `Status: proposed`** while RE60 and RE61 had shipped commits. Flipped to
  `accepted`, with implementation state pointed here rather than inlined. Its two
  dead citations were repaired.
- **`active/doc-corrections/` archived** — all three of its items are now
  resolved or moot.

### Still open

- **`CRUD` numbers two decisions `D48`.** Left as-is on purpose: it is archived
  and cited. RE44/RE45 disambiguate it here instead. Renumbering a source to fix
  a namespace is how five namespaces happened.
- **[ADR-0015](../adr/0015-feature-member-namespacing.md) repeats RE31's
  superseded framing**, seventeen days after RE40 corrected it. Not touched —
  it belongs to `core`'s namespacing work, not here.
- **[`3-ui/stories.md`](../3-ui/stories.md) still publishes the save-mode
  paragraph ADR-0013 supersedes**, unmarked. ADR-0013 now says so; the target
  still needs a banner.
- **`with-row-editing/state.json` says `spec: false`** and points at
  acme-monorepo paths, as do both archived `state.json`s.
- **`active/with-row-editing/` is misfiled as active** — every decision in it is
  shipped or superseded. It stays put because `5-gaps.md` beside it is genuinely
  live (G5, G6, G13). Splitting the folder is its own job.
- **49 broken links remain in permanent docs**, every one belonging to another
  capability — selection, expansion, grouping, filtering, core. That capability's
  run fixes them, not this one.

## ADRs that constrain row editing

In descending order of how badly this goes wrong without them.

| ADR                                                                                                                                                                                                                   | What it constrains                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [0013](../adr/0013-optimistic-and-pessimistic-are-call-site-facts.md)                                                                                                                                                 | The only row-editing-specific ADR. The invariant: a row is in `pending` **iff** an optimistic write is in flight                            |
| [0007](../adr/0007-feature-member-claims.md)                                                                                                                                                                          | Composing both editing features throws — the duplicate `editing` claim                                                                      |
| [0006](../adr/0006-row-id-state-reconciliation.md)                                                                                                                                                                    | `onRowsRemoved` pruning; the `op === 'delete'` exemption                                                                                    |
| [0015](../adr/0015-feature-member-namespacing.md)                                                                                                                                                                     | Would move `pending`/`pendingOps`/`unconfirmed`/`draft` onto `table.editing`. Accepted, unimplemented                                       |
| [0014](../adr/0014-runtime-error-policy.md)                                                                                                                                                                           | Binds any future consumer callback; row editing has none today                                                                              |
| [0011](../adr/0011-chained-render-stages.md)                                                                                                                                                                          | Supplies the render slot ADR-0013 **declines** to use for pessimistic create                                                                |
| [0012](../adr/0012-split-expansion-into-panel-and-tree.md), [0008](../adr/0008-api-folder-split.md), [0010](../adr/0010-no-angular-lifecycle-names-on-engine-concepts.md), [0004](../adr/0004-table-source-layout.md) | Background: `sourceIndex` narrowing, why updaters live in `mutations/`, naming, and the barrel exception that lets `@ngp/table/forms` exist |

## Maintaining this log

Format contract: `~/.claude/conventions/doc-contracts/decisions-log.md`.

- A decision is registered here **before** its work folder moves to `archive/`.
  That rule is in [`libs/table/CLAUDE.md`](../../CLAUDE.md) and is what keeps
  this file true.
- Append with the next free `RE`-number. Never renumber, never reuse.
- Superseding a row means editing the old row's `Status` to point forward, not
  deleting it. The history is the point.
