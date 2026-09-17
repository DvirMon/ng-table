# Acceptance checks on an Angular project must run a template-aware typecheck

Repo-scoped narrowing of the global `typecheck-with-project-config.md`. That rule already says to
prefer `nx run <project>:typecheck` when the target exists. This file says why, for Angular
projects, the bare `tsc` fallback is not an acceptable substitute — and what to write in a step
file's **Acceptance Checks**.

## The gap

`tsc` never opens a `.html` file. A template-only error — a renamed member, a signal read without
its call parens, a binding to something that no longer exists — passes `npx tsc -p … --noEmit`
clean and surfaces when a person opens Storybook.

`strictTemplates` being set in `tsconfig.json` does not close this. `ngtsc` honours it; `tsc` does
not run `ngtsc`. Configuration is not invocation.

This is not hypothetical: it shipped a real bug. `server-filtering-story-host.component.html`
bound `[formField]="filterForm.status"` against a component whose member is `searchForm`. Plain
`tsc` exited 0 on that tree; `ngc` caught it. See
[#60](https://github.com/DvirMon/ng-table/issues/60).

## What to write in a step file

```
- [ ] `nx run <project>:typecheck` clean.
```

Not:

```
- [ ] `npx tsc -p <project>/tsconfig.lib.json --noEmit` clean.
```

Projects with a `typecheck` target today: `shared-table`. A project with **no** such target gets
one before a step file cites it — do not fall back to bare `tsc` on a project that renders
templates.

The target shape, for adding one:

```json
"typecheck": {
  "executor": "nx:run-commands",
  "cache": true,
  "inputs": ["default", "^default"],
  "options": {
    "command": "ngc -p <project>/tsconfig.lib.json --noEmit"
  }
}
```

## The trap that makes a green run meaningless

**`ngc` stops at the first `.ts` error and never reaches the template phase.** So a source error
buys back exactly the blind spot the target exists to close, while still looking like it ran.

When a typecheck run reports `.ts` errors, fix those and **run it again**. Only the second, source-
clean run tells you anything about templates. A step is not done on the strength of a run that
aborted early.

## Scope

Applies to any project containing `.html` templates — story hosts, demo apps, directive fixtures.
A pure-logic lib with no templates loses nothing by using plain `tsc`, and the global rule's
guidance on picking the right tsconfig (`.lib` vs `.spec`) still governs which one to pass.
