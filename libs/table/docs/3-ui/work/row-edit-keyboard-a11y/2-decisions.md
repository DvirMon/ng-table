---
title: Decisions — row-edit keyboard, focus, accessibility
type: decisions
date: 2026-09-04
parent: ../../architecture.md
---

# Decisions — row-edit-keyboard-a11y

## D1 — Scope is documentation, not a shipped directive (2026-09-04)

The library does not ship an `ngpTableRowEdit` (or similarly named) directive for
Escape-to-cancel / Enter-to-save / focus management / ARIA announcements on editable rows.
G1/G9/G10 close via a **documented recipe** — a cookbook page showing a consumer how to build
their own row-scoped directive on top of the existing verbs (`revertEdit`, `endEdit`,
`captureEdit`, `beginEdit`) and `NGP_TABLE_ROW`/`NGP_TABLE_STORE` injection tokens — not via
code this package exports.

**Why:** row-editing's trigger policy is already deliberately consumer-owned (D20/D43 in
`work/row-editing/active/with-row-editing/2-decisions.md` — "editing detects no triggers," membership in the state
is the only definition). Live, gated, and optimistic tables each want different Escape/Enter/
focus semantics; a single shipped directive would either impose one opinion or grow enough
config surface to become its own feature. Distinguished explicitly from expansion's
`ngpTableExpandToggle`, which *does* ship Enter/Space activation as shipped default behavior —
expansion's activation semantics are universal and unambiguous (Enter/Space toggles), where
row-edit's are not.

**Status:** shelved, not rejected — same standing D18 gives row actions ("revisit only on real
cross-consumer duplication, and then as a UI directive"). Not ruled out for the future; not
committed to.

**Researched before deciding:** ng-primitives splits state (`NgpDialogRef`) from behavior
(`NgpFocusTrap`, escape-routing in `NgpDialogManager`), composed by default via `hostDirectives`
— i.e., they *do* ship default keyboard/focus behavior on their stateful primitives. Considered
and not followed here: their dialog's Escape/focus semantics are unambiguous across every dialog
instance, unlike row-editing's three different session shapes (live / live+optimistic / gated).
Also confirmed against this repo's own precedent (`expansion.md`'s "Rejected Alternatives" —
composing a feature into `ngpTableRow` via `hostDirectives` was already rejected for a different
but related reason: applying feature-specific behavior unconditionally to every row lies about
state on tables that don't compose the feature, and kills tree-shaking).

**Consequence for the gap register:** G1/G9/G10 in
[`3-ui/work/row-editing/5-gaps.md`](../row-editing/5-gaps.md) needs its framing updated — it
currently reads as "ship a directive," including calling this the "largest undesigned item in
the editing cluster." Re-scope to: write the cookbook recipe; downgrade from
code-effort framing to docs-effort framing.

## D2 — Recipe doc location (2026-09-04)

`docs/3-ui/cookbook/row-edit-keyboard-a11y.md` — inside the UI domain (`3-ui/`), since this is
UI-layer behavior (keyboard, focus, ARIA), but a new `cookbook/` sibling to `directives/` and
`work/`, not inside `directives/` itself — `directives/` is reserved for specs of directives this
package actually ships (per `CLAUDE.md`'s docs-structure table); this is a "how a consumer builds
their own" pattern, not a shipped contract.
