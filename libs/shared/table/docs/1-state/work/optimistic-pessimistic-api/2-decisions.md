---
title: Decisions — optimistic and pessimistic as a definitive API
type: decisions
status: open — D50–D57 reserved, rationale written per step as it lands
date: 2026-09-05
parent: ./1-proposal.md
---

# Optimistic / pessimistic API — decisions

> **This file is the reasoning, not the contract.** The shipped surface is specced in
> [`features/row-editing.md`](../../features/row-editing.md); the concept and its supersessions are
> in [ADR-0013](../../../adr/0013-optimistic-and-pessimistic-are-call-site-facts.md).

D- and O-numbers are **global** across the `1-state/work/` folders. Last allocated before this
file: **D49** (`swapRowId`, in [`with-row-editing/2-decisions.md`](../with-row-editing/2-decisions.md)),
**O26**.

## How this file gets written

Each decision below is **reserved, not yet written**. Per this repo's practice, the rationale lands
in the same commit as the code implementing it — D45–D47 shipped inside
`🎸 feat(shared-table/row-edit): optimistic delete rollback (D45-D47)` (2026-08-27), and D49 was
appended after `swapRowId` landed. Pre-writing all eight would be inventing rationale for code that
does not exist, and this repo's decision logs already show amendments (A1/A2 in
[`with-optimistic/2-decisions.md`](../with-optimistic/2-decisions.md)) where implementation taught
something the design pass missed.

Reserving the numbers now is the part that *is* urgent: the sequence is global, so a concurrent
effort could otherwise take D50.

## Reserved

| # | Title | Lands with |
|---|---|---|
| **D50** | Optimistic and pessimistic are call-site facts, named by the verb — not configuration | [ADR-0013](../../../adr/0013-optimistic-and-pessimistic-are-call-site-facts.md) (written) |
| **D51** | `beginEdit` loses its `{ insert }` data write; `createRow` becomes the only insert-and-arm verb | step 3a/3b |
| **D52** | `endEdit` splits into `commitEdit` (keep the restore point) and `closeEdit` (release it) | step 3a/3b |
| **D53** | `RowRestorePoint.detached` becomes `op: 'create' \| 'update' \| 'delete'` | step 1 |
| **D54** | `unconfirmed` becomes a library slice — unconfirmed identity outlives a restore point | step 2 |
| **D55** | Per-row error state stays consumer-side; the library cannot know when to clear it | step 5 |
| **D56** | A pessimistic create shows no row at all — composer form, no render-stage injection | step 6 |
| **D57** | Session verbs warn in dev mode on a `withOptimistic()`-only table | step 4 |

## D50 — Optimistic and pessimistic are call-site facts, named by the verb (2026-09-05)

**Decision:** adopt the product-level definition — *optimistic* is reflected before the server
answers, *pessimistic* only after it confirms — as a **per-operation** axis (create / update /
delete) applying to live and gated tables alike. The mode is not library configuration but a
property of where in the async flow the call sits, so the verb names it rather than a config flag.

Full reasoning, the four verb families, the rejected alternatives, and the two doc claims this acts
on: **[ADR-0013](../../../adr/0013-optimistic-and-pessimistic-are-call-site-facts.md)**.

**Consequences:** supersedes [`3-ui/stories.md`](../../../3-ui/stories.md) :142 (which scoped the
axis to gated tables only); narrows — does not reverse —
[`0-product/row-editing.md`](../../../0-product/row-editing.md) OQ-7, whose finding that a flow is
undetectable *at composition time* remains true. Obliges D51–D57 and the step sequence in
[`1-proposal.md`](./1-proposal.md).

## D51–D57

Reserved; see the table above. Each is written when its step lands.

## Open questions

None allocated yet. Next free: **O27**.
