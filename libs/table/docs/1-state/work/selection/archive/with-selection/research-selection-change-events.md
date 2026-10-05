---
title: Research — how other libraries announce a selection change
type: research
status: complete
date: 2026-09-06
audience: developers
---

# How other libraries announce a selection change

Run during the `withSelection()` grill to settle the `selectionChanged` payload shape. Every
claim below was read from published package typings (versions pinned per row), not from memory.

## Findings

| Library                      | Version read                                                                    | What it emits                                                                                                                                                                                        | Delta?                                          |
| ---------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Angular CDK `SelectionModel` | `@angular/cdk` 22.x (installed, `types/_selection-model-chunk.d.ts`)            | `changed: Subject<SelectionChange<T>>` where `SelectionChange<T> = { source: SelectionModel<T>; added: T[]; removed: T[] }`                                                                          | **yes — added + removed**                       |
| TanStack Table v8            | `@tanstack/table-core@8.21.3` (`src/features/RowSelection.ts`)                  | `onRowSelectionChange?: OnChangeFn<RowSelectionState>` — an updater of the whole `rowSelection` record. No event stream at all                                                                       | no                                              |
| Material React Table         | `material-react-table@3.2.1` (`dist/index.d.ts`)                                | Pass-through to TanStack state; ships handlers (`getMRT_RowSelectionHandler`, `getMRT_SelectAllHandler`) rather than events                                                                          | no                                              |
| AG Grid                      | `ag-grid-community@36.1.0` (`dist/types/src/events.d.ts`)                       | `SelectionChangedEvent { source: SelectionEventSourceType; selectedNodes; serverSideState }` plus a per-row `RowSelectedEvent { source }`                                                            | no — but a 16-value `source`                    |
| PrimeNG                      | `primeng@22.1.0` (`types/primeng-table.d.ts`, `types/primeng-types-table.d.ts`) | `selection: ModelSignal<any>`, plus `onRowSelect` / `onRowUnselect` (`{ originalEvent?, data?, type?, index? }`), `selectAllChange` and `onHeaderCheckboxToggle` (both `{ originalEvent, checked }`) | no — split into separate select/unselect events |

## Reading

**Only CDK ships the delta, and it is the one library whose job is _just_ the selection state** —
no rendering, no DOM. That is the closest analogue to our state layer, and it landed on exactly
`{ added, removed }` plus a `source` back-reference for reading current state. Notably the payload
does **not** include the selected set itself; a consumer reads `source.selected`.

**The three table libraries all avoid a delta, and each pays for it differently:**

- PrimeNG pays by splitting the event in two — `onRowSelect` / `onRowUnselect`. That _is_ a delta,
  just expressed as two streams instead of two fields, and it cannot describe a write that both
  adds and removes (the single-select replace case) in one emission.
- AG Grid pays by not answering "what changed" at all, and instead answering "why did it change"
  via `SelectionEventSourceType`: `'api' | 'apiSelectAll' | 'apiSelectAllFiltered' |
'apiSelectAllCurrentPage' | 'checkboxSelected' | 'rowClicked' | 'rowDataChanged' |
'rowGroupChanged' | 'selectableChanged' | 'spaceKey' | 'keyboardSelectAll' | 'uiSelectAll' |
'uiSelectAllFiltered' | 'uiSelectAllCurrentPage' | 'masterDetail' | 'gridInitializing'`.
- TanStack pays by having no event: the consumer owns the state (`onRowSelectionChange` is an
  updater callback), so "what changed" is diffed by whoever holds it.

## Side finding — the scope question (D1) is visible in two of these APIs

AG Grid's source enum distinguishes `apiSelectAll` / `apiSelectAllFiltered` /
`apiSelectAllCurrentPage`, and MRT's `getMRT_SelectAllHandler` takes a `forceAll?: boolean`. Both
are the page/filtered/all ambiguity leaking out of the API — after the fact, into an event or a
handler flag, rather than being decided. Supports D1: refusing the denominator entirely is
cleaner than either.

## Bearing on the open decision

- The delta shape is not exotic — it is what Angular's own selection primitive does, and it is
  the shape PrimeNG approximates with two events.
- CDK's precedent argues for `{ added, removed }` **without** the set in the payload (read the
  signal for state), which is the cheaper two-field variant.
- Nothing here supports inferring "what changed" from set ordering; no library attempts it.
- AG Grid's `source` is worth noting as a separate, orthogonal idea: not _what_ changed but
  _what caused it_. Out of scope for this decision; recorded in case selection ever needs to
  distinguish a UI click from a programmatic write.
