---
title: Proposal — Storybook Stories for Row Editing
type: plan
status: proposed
date: 2026-08-25
parent: ../../architecture.md
---

# Proposal — Row-editing Storybook stories

Purpose: showcase every currently shipped row-editing capability in Storybook, for
`libs/shared/table` (no Storybook exists there yet — `libs/shared/design-system/.storybook` is
the pattern to clone).

Source: [`features/row-editing.md`](../../../1-state/features/row-editing.md),
[`4-increments.md`](../../../1-state/work/with-row-editing/4-increments.md) (E1-E6, E2b, E5'),
[`5-gaps.md`](../../../1-state/work/with-row-editing/5-gaps.md) (G12 — demo coverage gaps).

## 1. Feature inventory (what's shippable today)

| # | Feature | Verb(s) | Currently demoed |
|---|---|---|---|
| F1 | Live table (no feature) — commit boundary via `debounce('blur')` / `debounce(0)` | none | `table-edit-demo` |
| F2 | Gated edit, single mode | `beginEdit`, `endEdit`, `revertEdit` | `table-row-edit-demo` |
| F3 | Gated edit, multiple mode | same + `{ multiple: true }` | not demoed (G4 — undesigned combo with optimistic) |
| F4 | Blank row add — discard intent | `addNewRow` | `table-row-edit-demo` |
| F5 | Blank row add — reset intent | `addRow` → `beginEdit` | not demoed (only in code comment) |
| F6 | Pessimistic save (row stays open through round trip) | `endEdit` after await | not demoed |
| F7 | Optimistic save + rollback | `endEdit({ keepSnapshot })`, `settleEdit`, `revertEdit` | `table-row-edit-demo` |
| F8 | External write while row open (stale snapshot) | `rebaseEdit` | not demoed — only unit tests |
| F9 | Row removed externally while open (ADR-0006 pruning) | n/a (engine reconciliation) | not demoed |
| F10 | Close-all | `clearEditing` | not demoed |
| F11 | `*ngpTableRowField` directive (field binding) | n/a | `table-row-field-demo` |

F3 + F7 combined is explicitly **unsupported** (D31.2/G4) — do not build that combination.

## 2. Proposed stories

One story = one `.stories.ts`, each with on-canvas buttons driving every updater it covers (no
Storybook actions-panel-only triggers — buttons are part of the rendered story per your ask).

| Story | Covers | Notes |
|---|---|---|
| **S1 — Live table** | F1 | No `withRowEdit()` composed at all (D29) — the control story proving the minimal table needs nothing. Debounce commit-boundary visible via a live/committed value counter, same as `table-edit-demo`. One "Add row" button — plain `data.update(rows => [...rows, blank])`, no discard/reset distinction since there's no snapshot to cancel from. |
| **S2 — Gated edit (single ⇄ multiple)** | F2, F3, F4, F5, F10 | `multiple` toggled via Storybook boolean arg. Buttons: Edit, Save (pessimistic — F6), Cancel, Clear all, plus two add-row buttons — "Add row (discard on cancel)" → `addNewRow`, "Add row (reset on cancel)" → `addRow` + `beginEdit` — folded in from former S3 so Cancel's two outcomes show side by side (G12). Opening row B while A is open shows A close as a **Save**, not a Cancel (D14). |
| **S4 — Optimistic save** | F7 | Own story, as you asked. Mocks an HTTP call at as-close-to-production fidelity as Storybook supports — MSW (`msw-storybook-addon`) intercepting a real `fetch`/`HttpClient` call, with a control to force success/failure/latency. Shows `pending` state (spinner), rollback on failure, `settleEdit` on success. |
| **S5 — External write / reconciliation** | F8, F9 | "Simulate server push" button patches `data` under the open row (`rebaseEdit` trigger) and a "Remove row externally" button deletes it from `data` while open (ADR-0006 pruning). This is G12's suggested addition — currently `rebaseEdit` only runs in unit tests. |

No standalone directive story: `*ngpTableRowField` (F11) is already exercised by every gated
story (S2, S5) — a dedicated story would just re-render S2 with the editing flow stripped out.
Dropped.

Add-row discard/reset (F4/F5) does **not** fold into S1: it's a `withRowEdit()` distinction —
Cancel needs a snapshot to discard-vs-reset, and S1 composes no editing feature (D29), so its
add-row is a plain `data.update(rows => [...rows, blank])` with nothing to cancel.

S2 stays single-flow-per-story elsewhere: F6 (pessimistic) is folded into S2 rather than its own
story since it's just "await before `endEdit`" with no distinct state shape — happy to split it
out if you'd rather see it isolated.

## 3. Setup needed before any story lands

- New `.storybook/` for `libs/shared/table` (clone `libs/shared/design-system/.storybook`:
  `main.ts`, `preview.ts`, `tsconfig.json`).
- `project.json` targets: `storybook`, `build-storybook`, `test-storybook` (copy shape from
  `shared-design-system`'s `project.json`).
- `msw` + `msw-storybook-addon` as new devDependencies, for S4 only.

## Decisions

- **S4 mock: MSW** (`msw-storybook-addon`, intercepting a real `fetch`/`HttpClient` call) —
  confirmed.
- **Storybook scope: lib-scoped, in `libs/shared/table`** — confirmed. Not reused from
  `apps/ng-table`'s existing `.storybook` (that one's scoped to the site's own 16 local
  marketing-DS components — a different subject) and not a new dedicated app. New
  `libs/shared/table/.storybook/` mirrors `libs/shared/design-system`'s setup (§3).
- Story file location: `libs/shared/table/src/stories/*.stories.ts` — new folder, colocated
  with source. `docs/3-ui/` stays doc-only per repo convention.
