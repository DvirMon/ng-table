# When does focus recovery take its first "before" snapshot?

**Date:** 2026-10-29 · **Scope:** `composeTable()` recovery effect (#233)

## Answer

Eager — at the end of `createTable()`, read `untracked` (as `previousIds` is). Kept. Lazy
(on the effect's first run) saves one build in one startup pattern and depends on the
scheduler. Decision: K30.

## Context

The seed reads `renderRows()` — the pipeline plus one `accessor` call per row × column — so
`createTable()` now builds before first render. Surfaced by two `withSorting` specs counting
`console.error` across the construction build and the sorted build (each is one
ADR-0014 evaluation); the specs now `mockClear()` after construction.

## Options

|                                     | Eager (kept)                             | Lazy                                           | Lazy + `moveTo` seeds                              |
| ----------------------------------- | ---------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| Startup builds                      | 1, or 2 if state changes before first CD | 1                                              | 1                                                  |
| Table never shown                   | builds once                              | builds once (the effect reads `renderRows`)    | same                                               |
| `moveTo` → row removed → first tick | recovers to neighbour                    | focus → `null`                                 | recovers                                           |
| Depends on effect scheduling        | no                                       | yes (zone/zoneless, view/root effect, harness) | no                                                 |
| Snapshot writers                    | 1                                        | 1                                              | 2 + ordering rule                                  |
| Snapshot type                       | always set                               | `\| undefined` + first-run branch              | same, shared across `createFocus()` and the effect |
| Existing recovery specs             | pass                                     | break (no tick before `moveTo`)                | pass                                               |

## Same in every option

- Per change: an O(n) `rows()` id `Set`, a column-id map, and `recoverFocus` when focus is set.
- Memory: the snapshot keeps the previous `RenderRow[]` alive (~2× render rows). Higher
  impact than timing; fix by storing ids and positions, not rows.
- Window: between a change and the effect run, `focus()` may name an unrendered target.
- The effect's `focusTarget.set` causes one more refresh of `focus()` readers (written only on change).
- Recovery compares the last snapshot with the current state; changes in between are not seen one by one.
- Recovery runs only when rows or columns change. If a feature changes `renderRows` on
  scroll (virtual scroll, pagination), it runs on every scroll step.

## Revisit when

A large-table startup profile shows the construction build, or the snapshot's retained
`RenderRow[]` shows in memory.
